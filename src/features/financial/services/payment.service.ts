/**
 * Payment Service
 *
 * Multi-gateway payment processing service for Philippine payment methods
 * including GCash, PayMongo, bank transfers, and cash management.
 */

import { Money } from "@/lib/money";
import { db } from "@/lib/db";
import {
  paymentTransactions as payments,
  paymentGateways,
  cashPayments,
  bankTransfers,
  refundTransactions as refunds,
  type PaymentTransaction as Payment,
  type NewPaymentTransaction as NewPayment,
  type RefundTransaction as Refund,
} from "@/lib/db/schema/payments.schema";
import { incomeTransactions } from "@/lib/db/schema/income.schema";
// import { cashReconciliationAudit } from "@/lib/db/schema/financial-audit.schema"; // TODO: Enable when implemented
import { eq, and, gte, lte, desc, sql, isNull } from "drizzle-orm";
import { generateCode } from "@/lib/utils";
import { auditLog, auditFinancialTransaction } from "@/lib/audit";
import { createHash, randomBytes } from "node:crypto";

// Payment gateway configuration
const GATEWAY_CONFIG = {
  PAYMONGO: {
    name: "PayMongo",
    supportedMethods: ["credit_card", "debit_card", "gcash", "grab_pay"],
    processingFee: { percentage: 0.0275, fixed: 15 }, // 2.75% + ₱15
    settlementDays: 3,
  },
  GCASH: {
    name: "GCash Direct",
    supportedMethods: ["gcash"],
    processingFee: { percentage: 0.018, fixed: 0 }, // 1.8% for direct integration
    settlementDays: 1,
  },
  DRAGONPAY: {
    name: "DragonPay",
    supportedMethods: ["bank_transfer", "over_the_counter", "e_wallet"],
    processingFee: { percentage: 0.025, fixed: 0 }, // 2.5%
    settlementDays: 2,
  },
  BANK_TRANSFER: {
    name: "Direct Bank Transfer",
    supportedMethods: ["bank_transfer"],
    processingFee: { percentage: 0, fixed: 15 }, // ₱15 bank fee
    settlementDays: 1,
  },
  CASH: {
    name: "Cash",
    supportedMethods: ["cash"],
    processingFee: { percentage: 0, fixed: 0 },
    settlementDays: 0,
  },
} as const;

type PaymentGateway = keyof typeof GATEWAY_CONFIG;

interface ProcessPaymentInput {
  projectId: string;
  amount: number | string | Money;
  currency?: string;
  method: string;
  gateway: PaymentGateway;

  // Transaction reference
  transactionType: "booking" | "expense" | "income";
  transactionId: string;

  // Payment details
  reference?: string;
  description?: string;

  // Customer info
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;

  // Gateway-specific data
  gatewayData?: Record<string, any>;

  // User context
  userId: string;
}

interface GCashPaymentInput {
  projectId: string;
  amount: number | string | Money;
  referenceNumber: string; // 13-digit GCash reference
  senderName: string;
  senderNumber: string;
  transactionId: string;
  transactionType: string;
  userId: string;
}

interface BankTransferInput {
  projectId: string;
  amount: number | string | Money;
  bankName: string;
  accountNumber: string;
  referenceNumber: string;
  depositDate: Date;
  depositSlipUrl?: string;
  transactionId: string;
  transactionType: string;
  userId: string;
}

interface CashPaymentInput {
  projectId: string;
  amount: number | string | Money;
  receivedAmount: number | string | Money;
  denominations?: Array<{ value: number; quantity: number }>;
  drawerId?: string;
  transactionId: string;
  transactionType: string;
  userId: string;
}

interface RefundInput {
  paymentId: string;
  amount: number | string | Money;
  reason: string;
  refundMethod?: string;
  userId: string;
}

export class PaymentService {
  /**
   * Process payment through specified gateway
   */
  async processPayment(input: ProcessPaymentInput): Promise<Payment> {
    // Convert amount to Money instance
    const amount = input.amount instanceof Money ? input.amount : new Money(input.amount);

    // Validate amount
    if (!amount.isPositive()) {
      throw new Error("Payment amount must be positive");
    }

    // Validate gateway supports the payment method
    const gatewayConfig = GATEWAY_CONFIG[input.gateway];
    if (!gatewayConfig.supportedMethods.includes(input.method)) {
      throw new Error(`Gateway ${input.gateway} does not support payment method ${input.method}`);
    }

    // Calculate processing fees
    const processingFee = this.calculateProcessingFee(amount, input.gateway);
    const netAmount = amount.subtract(processingFee);

    // Generate payment code
    const paymentCode = await this.generatePaymentCode(input.projectId);

    // Generate idempotency key for gateway requests
    const idempotencyKey = this.generateIdempotencyKey(input);

    // Create payment record
    const [payment] = await db
      .insert(payments)
      .values({
        projectId: input.projectId,
        paymentCode,
        transactionType: input.transactionType,
        transactionId: input.transactionId,
        amount: amount.toNumber().toString(),
        currency: input.currency || "PHP",
        paymentMethod: input.method,
        gatewayId: input.gateway,
        gatewayReference: input.reference,
        processingFee: processingFee.toNumber().toString(),
        netAmount: netAmount.toNumber().toString(),
        status: "pending",
        description: input.description,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        metadata: {
          ...input.gatewayData,
          idempotencyKey,
        },
        createdBy: input.userId,
      })
      .returning();

    // Process payment based on gateway
    try {
      const result = await this.processGatewayPayment(payment, input);

      // Update payment status
      await db
        .update(payments)
        .set({
          status: result.status,
          gatewayReference: result.reference,
          gatewayResponseCode: result.responseCode,
          processedAt: new Date(),
          metadata: sql`
            COALESCE(metadata, '{}'::jsonb) || 
            ${JSON.stringify(result.metadata)}::jsonb
          `,
        })
        .where(eq(payments.id, payment.id));

      // Update related transaction if payment successful
      if (result.status === "completed") {
        await this.updateTransactionPaymentStatus(
          input.transactionType,
          input.transactionId,
          "paid"
        );
      }

      // Audit log
      await auditFinancialTransaction({
        userId: input.userId,
        transactionType: "payment",
        transactionId: payment.id,
        amount: amount.toNumber(),
        description: `Payment processed via ${input.gateway}`,
        metadata: {
          projectId: input.projectId,
          gateway: input.gateway,
          method: input.method,
          status: result.status,
          processingFee: processingFee.toNumber(),
        },
      });

      return { ...payment, status: result.status };
    } catch (error) {
      // Update payment as failed
      await db
        .update(payments)
        .set({
          status: "failed",
          failureReason: error.message,
          failedAt: new Date(),
        })
        .where(eq(payments.id, payment.id));

      throw error;
    }
  }

  /**
   * Process GCash payment
   */
  async processGCashPayment(input: GCashPaymentInput): Promise<Payment> {
    // Validate GCash reference number (13 digits)
    if (!/^\d{13}$/.test(input.referenceNumber)) {
      throw new Error("Invalid GCash reference number. Must be 13 digits.");
    }

    // Validate sender mobile number (Philippine format)
    if (!/^(09|\+639)\d{9}$/.test(input.senderNumber)) {
      throw new Error("Invalid Philippine mobile number");
    }

    // Process as GCash payment
    return this.processPayment({
      ...input,
      method: "gcash",
      gateway: "GCASH",
      reference: input.referenceNumber,
      customerName: input.senderName,
      customerPhone: input.senderNumber,
      gatewayData: {
        gcashReference: input.referenceNumber,
        senderName: input.senderName,
        senderNumber: input.senderNumber,
        verificationRequired: true,
      },
    });
  }

  /**
   * Process bank transfer payment
   */
  async processBankTransfer(input: BankTransferInput): Promise<Payment> {
    // Validate bank details
    const validBanks = [
      "BDO",
      "BPI",
      "Metrobank",
      "UnionBank",
      "Landbank",
      "PNB",
      "RCBC",
      "Security Bank",
    ];
    if (!validBanks.includes(input.bankName)) {
      throw new Error(`Unsupported bank: ${input.bankName}`);
    }

    // Process as bank transfer
    const payment = await this.processPayment({
      ...input,
      method: "bank_transfer",
      gateway: "BANK_TRANSFER",
      reference: input.referenceNumber,
      gatewayData: {
        bankName: input.bankName,
        accountNumber: input.accountNumber,
        depositDate: input.depositDate.toISOString(),
        depositSlipUrl: input.depositSlipUrl,
        verificationRequired: true,
      },
    });

    // Bank transfers need manual verification
    await db
      .update(payments)
      .set({
        status: "pending_verification",
        metadata: sql`
          COALESCE(metadata, '{}'::jsonb) || 
          ${JSON.stringify({
            verificationNote: "Awaiting bank deposit confirmation",
            expectedClearance: this.calculateBankClearanceDate(input.bankName),
          })}::jsonb
        `,
      })
      .where(eq(payments.id, payment.id));

    return payment;
  }

  /**
   * Process cash payment
   */
  async processCashPayment(input: CashPaymentInput): Promise<Payment> {
    const amount = input.amount instanceof Money ? input.amount : new Money(input.amount);

    const receivedAmount =
      input.receivedAmount instanceof Money
        ? input.receivedAmount
        : new Money(input.receivedAmount);

    // Calculate change
    const change = receivedAmount.subtract(amount);
    if (change.isNegative()) {
      throw new Error("Received amount is less than payment amount");
    }

    // Generate receipt number
    const receiptNumber = await this.generateReceiptNumber(input.projectId);

    // Process cash payment
    const payment = await this.processPayment({
      ...input,
      method: "cash",
      gateway: "CASH",
      reference: receiptNumber,
      gatewayData: {
        receivedAmount: receivedAmount.toNumber(),
        change: change.toNumber(),
        denominations: input.denominations,
        drawerId: input.drawerId,
        receiptNumber,
      },
    });

    // TODO: Implement cash drawer functionality in future phase
    // if (input.drawerId) {
    //   await this.updateCashDrawer(input.drawerId, amount, "IN", input.userId);
    // }

    // Mark as immediately completed (cash is instant)
    await db
      .update(payments)
      .set({
        status: "completed",
        processedAt: new Date(),
        settledAt: new Date(),
      })
      .where(eq(payments.id, payment.id));

    return { ...payment, status: "completed" };
  }

  /**
   * Process payment refund
   */
  async processRefund(input: RefundInput): Promise<Refund> {
    // Get original payment
    const payment = await db
      .select()
      .from(payments)
      .where(eq(payments.id, input.paymentId))
      .limit(1)
      .then((r) => r[0]);

    if (!payment) {
      throw new Error("Payment not found");
    }

    if (payment.status !== "completed") {
      throw new Error("Can only refund completed payments");
    }

    // Convert amounts to Money
    const refundAmount = input.amount instanceof Money ? input.amount : new Money(input.amount);

    const originalAmount = new Money(payment.amount);

    // Validate refund amount
    if (refundAmount.greaterThan(originalAmount)) {
      throw new Error("Refund amount cannot exceed original payment amount");
    }

    // Check for existing refunds
    const existingRefunds = await db
      .select({
        totalRefunded: sql<string>`SUM(${refunds.refundAmount})`,
      })
      .from(refunds)
      .where(and(eq(refunds.paymentId, input.paymentId), eq(refunds.status, "completed")))
      .then((r) => r[0]);

    const totalRefunded = new Money(existingRefunds?.totalRefunded || 0);
    if (totalRefunded.add(refundAmount).greaterThan(originalAmount)) {
      throw new Error("Total refunds would exceed original payment amount");
    }

    // Calculate refund fees (some gateways charge for refunds)
    const refundFee = this.calculateRefundFee(refundAmount, payment.gatewayId);
    const netRefund = refundAmount.subtract(refundFee);

    // Generate refund code
    const refundCode = await this.generateRefundCode(payment.projectId);

    // Create refund record
    const [refund] = await db
      .insert(refunds)
      .values({
        paymentId: input.paymentId,
        refundCode,
        originalAmount: payment.amount,
        refundAmount: refundAmount.toNumber().toString(),
        refundFee: refundFee.toNumber().toString(),
        netRefundAmount: netRefund.toNumber().toString(),
        reason: input.reason,
        refundMethod: input.refundMethod || payment.paymentMethod,
        status: "pending",
        createdBy: input.userId,
      })
      .returning();

    // Process refund based on payment method
    try {
      const result = await this.processGatewayRefund(payment, refund);

      // Update refund status
      await db
        .update(refunds)
        .set({
          status: result.status,
          gatewayReference: result.reference,
          processedAt: result.status === "completed" ? new Date() : undefined,
          metadata: result.metadata,
        })
        .where(eq(refunds.id, refund.id));

      // Update payment status if fully refunded
      if (result.status === "completed") {
        const newTotalRefunded = totalRefunded.add(refundAmount);
        if (newTotalRefunded.equals(originalAmount)) {
          await db
            .update(payments)
            .set({
              status: "refunded",
              refundedAt: new Date(),
            })
            .where(eq(payments.id, input.paymentId));
        } else {
          await db
            .update(payments)
            .set({ status: "partially_refunded" })
            .where(eq(payments.id, input.paymentId));
        }
      }

      // Audit log
      await auditLog({
        userId: input.userId,
        action: "payment.refunded",
        entityType: "refund",
        entityId: refund.id,
        amount: refundAmount.toNumber(),
        metadata: {
          paymentId: input.paymentId,
          reason: input.reason,
          refundMethod: refund.refundMethod,
          status: result.status,
        },
      });

      return { ...refund, status: result.status };
    } catch (error) {
      // Update refund as failed
      await db
        .update(refunds)
        .set({
          status: "failed",
          failureReason: error.message,
        })
        .where(eq(refunds.id, refund.id));

      throw error;
    }
  }

  /**
   * Reconcile cash drawer
   * TODO: Implement cash drawer reconciliation in future phase
   */
  async reconcileCashDrawer(
    projectId: string,
    drawerId: string,
    actualCount: number | string | Money,
    denominations: Array<{ value: number; quantity: number }>,
    userId: string
  ) {
    throw new Error("Cash drawer reconciliation not implemented yet");
    // TODO: Implement cash drawer functionality
    // Implementation will be added in future phase when cash drawer schema is available
  }

  /**
   * Verify payment webhook
   */
  async verifyWebhook(payload: any, signature: string, gateway: PaymentGateway): Promise<boolean> {
    // Each gateway has different webhook verification methods
    switch (gateway) {
      case "PAYMONGO":
        return this.verifyPayMongoWebhook(payload, signature);
      case "GCASH":
        return this.verifyGCashWebhook(payload, signature);
      case "DRAGONPAY":
        return this.verifyDragonPayWebhook(payload, signature);
      default:
        return false;
    }
  }

  // Private helper methods

  private calculateProcessingFee(amount: Money, gateway: PaymentGateway): Money {
    const config = GATEWAY_CONFIG[gateway];
    const percentageFee = amount.multiply(config.processingFee.percentage);
    const fixedFee = new Money(config.processingFee.fixed);
    return percentageFee.add(fixedFee);
  }

  private calculateRefundFee(amount: Money, gateway: string): Money {
    // Some gateways charge for refunds
    const refundFees = {
      PAYMONGO: { percentage: 0, fixed: 0 }, // No refund fees
      GCASH: { percentage: 0.01, fixed: 10 }, // 1% + ₱10
      DRAGONPAY: { percentage: 0, fixed: 25 }, // ₱25 fixed
    };

    const fee = refundFees[gateway] || { percentage: 0, fixed: 0 };
    return amount.multiply(fee.percentage).add(fee.fixed);
  }

  private async processGatewayPayment(payment: Payment, input: ProcessPaymentInput) {
    // Simulate gateway processing - in production, this would call actual gateway APIs
    switch (input.gateway) {
      case "CASH":
        return {
          status: "completed" as const,
          reference: payment.paymentCode,
          responseCode: "SUCCESS",
          metadata: { processedAt: new Date().toISOString() },
        };

      case "GCASH":
        // Simulate GCash verification
        return {
          status: "pending_verification" as const,
          reference: input.gatewayData?.gcashReference,
          responseCode: "PENDING",
          metadata: {
            verificationRequired: true,
            estimatedVerification: "5 minutes",
          },
        };

      case "BANK_TRANSFER":
        return {
          status: "pending_verification" as const,
          reference: input.reference,
          responseCode: "PENDING",
          metadata: {
            clearanceDate: this.calculateBankClearanceDate(input.gatewayData?.bankName),
          },
        };

      default:
        // PayMongo, DragonPay, etc.
        return {
          status: "processing" as const,
          reference: `${input.gateway}_${Date.now()}`,
          responseCode: "PROCESSING",
          metadata: {
            gatewayResponse: "Simulated response",
            settlementDate: this.calculateSettlementDate(input.gateway),
          },
        };
    }
  }

  private async processGatewayRefund(payment: Payment, refund: Refund) {
    // Simulate refund processing
    return {
      status: "completed" as const,
      reference: `REF_${refund.refundCode}`,
      metadata: {
        refundedAt: new Date().toISOString(),
        gateway: payment.gatewayId,
      },
    };
  }

  private calculateBankClearanceDate(bankName: string): string {
    const clearanceDays = {
      BDO: 1,
      BPI: 1,
      Metrobank: 2,
      UnionBank: 1,
      default: 3,
    };

    const days = clearanceDays[bankName] || clearanceDays.default;
    const clearanceDate = new Date();
    clearanceDate.setDate(clearanceDate.getDate() + days);
    return clearanceDate.toISOString();
  }

  private calculateSettlementDate(gateway: PaymentGateway): string {
    const days = GATEWAY_CONFIG[gateway].settlementDays;
    const settlementDate = new Date();
    settlementDate.setDate(settlementDate.getDate() + days);
    return settlementDate.toISOString();
  }

  private async updateCashDrawer(
    drawerId: string,
    amount: Money,
    direction: "IN" | "OUT",
    userId: string
  ) {
    // TODO: Implement cash drawer updates in future phase
    console.log(`Cash drawer ${drawerId} ${direction} ${amount.toNumber()} by ${userId}`);
  }

  private async updateTransactionPaymentStatus(
    transactionType: string,
    transactionId: string,
    status: string
  ) {
    if (transactionType === "income") {
      await db
        .update(incomeTransactions)
        .set({
          paymentStatus: status,
          updatedAt: new Date(),
        })
        .where(eq(incomeTransactions.id, transactionId));
    }
    // Add other transaction types as needed
  }

  private generateIdempotencyKey(input: ProcessPaymentInput): string {
    const data = `${input.projectId}-${input.transactionId}-${input.amount}-${Date.now()}`;
    return createHash("sha256").update(data).digest("hex");
  }

  private async generatePaymentCode(projectId: string): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const prefix = `PAY-${year}${month}`;

    const [lastPayment] = await db
      .select({ paymentCode: payments.paymentCode })
      .from(payments)
      .where(
        and(eq(payments.projectId, projectId), sql`${payments.paymentCode} LIKE ${prefix + "%"}`)
      )
      .orderBy(desc(payments.paymentCode))
      .limit(1);

    let sequence = 1;
    if (lastPayment) {
      const lastSequence = parseInt(lastPayment.paymentCode.split("-")[2] || "0");
      sequence = lastSequence + 1;
    }

    return generateCode(prefix, sequence, 5);
  }

  private async generateReceiptNumber(projectId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `RCP-${year}`;

    // This would typically check against a receipt sequence table
    const sequence = Math.floor(Math.random() * 999999) + 1;
    return generateCode(prefix, sequence, 6);
  }

  private async generateRefundCode(projectId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `RFD-${year}`;

    const [lastRefund] = await db
      .select({ refundCode: refunds.refundCode })
      .from(refunds)
      .where(sql`${refunds.refundCode} LIKE ${prefix + "%"}`)
      .orderBy(desc(refunds.refundCode))
      .limit(1);

    let sequence = 1;
    if (lastRefund) {
      const lastSequence = parseInt(lastRefund.refundCode.split("-")[2] || "0");
      sequence = lastSequence + 1;
    }

    return generateCode(prefix, sequence, 5);
  }

  private verifyPayMongoWebhook(payload: any, signature: string): boolean {
    // PayMongo uses HMAC-SHA256 for webhook verification
    const secret = process.env.PAYMONGO_WEBHOOK_SECRET || "";
    const computedSignature = createHash("sha256")
      .update(JSON.stringify(payload) + secret)
      .digest("hex");

    return computedSignature === signature;
  }

  private verifyGCashWebhook(payload: any, signature: string): boolean {
    // GCash webhook verification
    const secret = process.env.GCASH_WEBHOOK_SECRET || "";
    const computedSignature = createHash("sha256")
      .update(JSON.stringify(payload) + secret)
      .digest("hex");

    return computedSignature === signature;
  }

  private verifyDragonPayWebhook(payload: any, signature: string): boolean {
    // DragonPay uses a different verification method
    const secret = process.env.DRAGONPAY_API_KEY || "";
    const computedSignature = createHash("sha1")
      .update(
        payload.txnid +
          ":" +
          payload.refno +
          ":" +
          payload.status +
          ":" +
          payload.message +
          ":" +
          secret
      )
      .digest("hex");

    return computedSignature.toLowerCase() === signature.toLowerCase();
  }
}
