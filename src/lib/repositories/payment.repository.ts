/**
 * Payment Repository
 * Handles all payment-related database operations with Philippine payment method support
 */

import { and, eq, gte, lte, between, or, sql, desc, asc, isNull, isNotNull } from "drizzle-orm";
import { MultiTenantRepository, type TransactionContext } from "./base.repository";
import { createProjectSchema } from "../db/schema/project";
import type { PaymentStatus, PaymentMethod } from "../db/schema";

/**
 * Payment entity type
 */
export interface Payment {
  id: string;
  bookingId: string | null;
  paymentCode: string;
  amount: string;
  paymentMethod: PaymentMethod;
  paymentType: string; // deposit, partial, full, refund
  transactionId: string | null;
  referenceNumber: string | null;
  gcashReferenceNumber: string | null;
  gcashAccountName: string | null;
  gcashAccountNumber: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  status: PaymentStatus;
  verifiedAt: Date | null;
  verifiedBy: string | null;
  receiptNumber: string | null;
  receiptUrl: string | null;
  notes: string | null;
  failureReason: string | null;
  metadata: any;
  processedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Payment creation input
 */
export type NewPayment = Omit<Payment, "id" | "createdAt" | "updatedAt">;

/**
 * Payment update input
 */
export type UpdatePayment = Partial<Omit<Payment, "id" | "createdAt">>;

/**
 * GCash payment details
 */
export interface GCashPaymentDetails {
  referenceNumber: string;
  accountName: string;
  accountNumber: string;
  amount: number;
  timestamp: Date;
}

/**
 * Bank transfer details
 */
export interface BankTransferDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
  referenceNumber: string;
  amount: number;
  timestamp: Date;
}

/**
 * Payment summary statistics
 */
export interface PaymentSummary {
  totalAmount: number;
  completedAmount: number;
  pendingAmount: number;
  refundedAmount: number;
  paymentCount: number;
  averagePaymentAmount: number;
  methodBreakdown: {
    cash: number;
    gcash: number;
    bankTransfer: number;
    creditCard: number;
  };
}

/**
 * Daily payment report
 */
export interface DailyPaymentReport {
  date: Date;
  totalAmount: number;
  paymentCount: number;
  methods: {
    method: PaymentMethod;
    amount: number;
    count: number;
  }[];
  topPayments: Payment[];
}

/**
 * Balance calculation result
 */
export interface BalanceCalculation {
  bookingId: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  balanceAmount: number;
  isFullyPaid: boolean;
  lastPaymentDate: Date | null;
}

/**
 * Payment repository interface
 */
export interface IPaymentRepository {
  // Standard CRUD operations
  findById(id: string, tx?: TransactionContext): Promise<Payment | null>;
  findByPaymentCode(code: string, tx?: TransactionContext): Promise<Payment | null>;
  findByBookingId(bookingId: string, tx?: TransactionContext): Promise<Payment[]>;
  create(data: NewPayment, tx?: TransactionContext): Promise<Payment>;
  update(id: string, data: UpdatePayment, tx?: TransactionContext): Promise<Payment | null>;
  delete(id: string, tx?: TransactionContext): Promise<boolean>;

  // Payment method specific queries
  findGCashPayments(startDate?: Date, endDate?: Date, tx?: TransactionContext): Promise<Payment[]>;
  findBankTransfers(startDate?: Date, endDate?: Date, tx?: TransactionContext): Promise<Payment[]>;
  findCashPayments(startDate?: Date, endDate?: Date, tx?: TransactionContext): Promise<Payment[]>;

  // GCash specific operations
  verifyGCashPayment(
    paymentId: string,
    details: GCashPaymentDetails,
    verifiedBy: string,
    tx?: TransactionContext
  ): Promise<Payment | null>;
  findUnverifiedGCashPayments(tx?: TransactionContext): Promise<Payment[]>;
  matchGCashReference(referenceNumber: string, tx?: TransactionContext): Promise<Payment | null>;

  // Bank transfer operations
  verifyBankTransfer(
    paymentId: string,
    details: BankTransferDetails,
    verifiedBy: string,
    tx?: TransactionContext
  ): Promise<Payment | null>;
  findUnverifiedBankTransfers(tx?: TransactionContext): Promise<Payment[]>;

  // Balance and reconciliation
  calculateBookingBalance(bookingId: string, tx?: TransactionContext): Promise<BalanceCalculation>;
  findOverduePayments(daysOverdue: number, tx?: TransactionContext): Promise<Payment[]>;
  reconcilePayments(bookingId: string, tx?: TransactionContext): Promise<boolean>;

  // Reporting
  getDailyReport(date: Date, tx?: TransactionContext): Promise<DailyPaymentReport>;
  getMonthlyRevenue(year: number, month: number, tx?: TransactionContext): Promise<PaymentSummary>;
  getPaymentsByDateRange(
    startDate: Date,
    endDate: Date,
    tx?: TransactionContext
  ): Promise<Payment[]>;

  // Refund operations
  processRefund(
    originalPaymentId: string,
    refundAmount: number,
    reason: string,
    processedBy: string,
    tx?: TransactionContext
  ): Promise<Payment>;
  findRefunds(startDate?: Date, endDate?: Date, tx?: TransactionContext): Promise<Payment[]>;

  // Philippine tax compliance
  generateOfficialReceipt(paymentId: string, tx?: TransactionContext): Promise<string>;
  calculateWithholdingTax(
    paymentId: string,
    rate: number,
    tx?: TransactionContext
  ): Promise<number>;
}

/**
 * Payment repository implementation
 */
export class PaymentRepository
  extends MultiTenantRepository<Payment, NewPayment, UpdatePayment>
  implements IPaymentRepository
{
  protected table: any;

  constructor(projectId: string) {
    super(projectId);
    const schema = createProjectSchema(this.schemaName);
    this.table = schema.payments;
  }

  /**
   * Find payment by payment code
   */
  async findByPaymentCode(code: string, tx?: TransactionContext): Promise<Payment | null> {
    return this.findOne([{ field: "paymentCode", operator: "eq", value: code }], tx);
  }

  /**
   * Find all payments for a booking
   */
  async findByBookingId(bookingId: string, tx?: TransactionContext): Promise<Payment[]> {
    return this.findMany([{ field: "bookingId", operator: "eq", value: bookingId }], tx);
  }

  /**
   * Find GCash payments within date range
   */
  async findGCashPayments(
    startDate?: Date,
    endDate?: Date,
    tx?: TransactionContext
  ): Promise<Payment[]> {
    const db = this.getDb(tx);

    let query = db.select().from(this.table).where(eq(this.table.paymentMethod, "gcash"));

    if (startDate && endDate) {
      query = query.where(
        and(
          eq(this.table.paymentMethod, "gcash"),
          between(this.table.createdAt, startDate, endDate)
        )
      );
    }

    const result = await query.orderBy(desc(this.table.createdAt));
    return result as Payment[];
  }

  /**
   * Find bank transfer payments within date range
   */
  async findBankTransfers(
    startDate?: Date,
    endDate?: Date,
    tx?: TransactionContext
  ): Promise<Payment[]> {
    const db = this.getDb(tx);

    let conditions = eq(this.table.paymentMethod, "bank_transfer");

    if (startDate && endDate) {
      conditions = and(conditions, between(this.table.createdAt, startDate, endDate));
    }

    const result = await db
      .select()
      .from(this.table)
      .where(conditions)
      .orderBy(desc(this.table.createdAt));

    return result as Payment[];
  }

  /**
   * Find cash payments within date range
   */
  async findCashPayments(
    startDate?: Date,
    endDate?: Date,
    tx?: TransactionContext
  ): Promise<Payment[]> {
    const db = this.getDb(tx);

    let conditions = eq(this.table.paymentMethod, "cash");

    if (startDate && endDate) {
      conditions = and(conditions, between(this.table.createdAt, startDate, endDate));
    }

    const result = await db
      .select()
      .from(this.table)
      .where(conditions)
      .orderBy(desc(this.table.createdAt));

    return result as Payment[];
  }

  /**
   * Verify GCash payment with details
   */
  async verifyGCashPayment(
    paymentId: string,
    details: GCashPaymentDetails,
    verifiedBy: string,
    tx?: TransactionContext
  ): Promise<Payment | null> {
    const updateData: UpdatePayment = {
      gcashReferenceNumber: details.referenceNumber,
      gcashAccountName: details.accountName,
      gcashAccountNumber: details.accountNumber,
      status: "completed",
      verifiedAt: new Date(),
      verifiedBy,
      updatedAt: new Date(),
    };

    return this.update(paymentId, updateData, tx);
  }

  /**
   * Find unverified GCash payments
   */
  async findUnverifiedGCashPayments(tx?: TransactionContext): Promise<Payment[]> {
    const db = this.getDb(tx);

    const result = await db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.paymentMethod, "gcash"),
          or(eq(this.table.status, "pending"), eq(this.table.status, "processing")),
          isNull(this.table.verifiedAt)
        )
      )
      .orderBy(asc(this.table.createdAt));

    return result as Payment[];
  }

  /**
   * Match payment by GCash reference number
   */
  async matchGCashReference(
    referenceNumber: string,
    tx?: TransactionContext
  ): Promise<Payment | null> {
    return this.findOne(
      [{ field: "gcashReferenceNumber", operator: "eq", value: referenceNumber }],
      tx
    );
  }

  /**
   * Verify bank transfer with details
   */
  async verifyBankTransfer(
    paymentId: string,
    details: BankTransferDetails,
    verifiedBy: string,
    tx?: TransactionContext
  ): Promise<Payment | null> {
    const updateData: UpdatePayment = {
      bankName: details.bankName,
      bankAccountNumber: details.accountNumber,
      bankAccountName: details.accountName,
      referenceNumber: details.referenceNumber,
      status: "completed",
      verifiedAt: new Date(),
      verifiedBy,
      updatedAt: new Date(),
    };

    return this.update(paymentId, updateData, tx);
  }

  /**
   * Find unverified bank transfers
   */
  async findUnverifiedBankTransfers(tx?: TransactionContext): Promise<Payment[]> {
    const db = this.getDb(tx);

    const result = await db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.paymentMethod, "bank_transfer"),
          or(eq(this.table.status, "pending"), eq(this.table.status, "processing")),
          isNull(this.table.verifiedAt)
        )
      )
      .orderBy(asc(this.table.createdAt));

    return result as Payment[];
  }

  /**
   * Calculate booking balance from payments
   */
  async calculateBookingBalance(
    bookingId: string,
    tx?: TransactionContext
  ): Promise<BalanceCalculation> {
    const db = this.getDb(tx);

    // Get booking total (would normally join with bookings table)
    // For now, we'll calculate from payments
    const result = await db
      .select({
        totalPaid: sql`COALESCE(SUM(CASE WHEN ${this.table.status} = 'completed' AND ${this.table.paymentType} != 'refund' THEN ${this.table.amount}::numeric ELSE 0 END), 0)`,
        totalRefunded: sql`COALESCE(SUM(CASE WHEN ${this.table.paymentType} = 'refund' THEN ${this.table.amount}::numeric ELSE 0 END), 0)`,
        totalPending: sql`COALESCE(SUM(CASE WHEN ${this.table.status} IN ('pending', 'processing') THEN ${this.table.amount}::numeric ELSE 0 END), 0)`,
        lastPaymentDate: sql`MAX(CASE WHEN ${this.table.status} = 'completed' THEN ${this.table.createdAt} END)`,
        paymentCount: sql`COUNT(*)::int`,
      })
      .from(this.table)
      .where(eq(this.table.bookingId, bookingId));

    const summary = result[0];
    const paidAmount =
      parseFloat(summary.totalPaid as string) - parseFloat(summary.totalRefunded as string);
    const pendingAmount = parseFloat(summary.totalPending as string);

    // Note: totalAmount should come from booking, using a placeholder here
    const totalAmount = paidAmount + pendingAmount + 1000; // Placeholder
    const balanceAmount = totalAmount - paidAmount;

    return {
      bookingId,
      totalAmount,
      paidAmount,
      pendingAmount,
      balanceAmount,
      isFullyPaid: balanceAmount <= 0,
      lastPaymentDate: summary.lastPaymentDate as Date | null,
    };
  }

  /**
   * Find overdue payments
   */
  async findOverduePayments(daysOverdue: number, tx?: TransactionContext): Promise<Payment[]> {
    const db = this.getDb(tx);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOverdue);

    const result = await db
      .select()
      .from(this.table)
      .where(
        and(
          or(eq(this.table.status, "pending"), eq(this.table.status, "processing")),
          lte(this.table.createdAt, cutoffDate)
        )
      )
      .orderBy(asc(this.table.createdAt));

    return result as Payment[];
  }

  /**
   * Reconcile payments for a booking
   */
  async reconcilePayments(bookingId: string, tx?: TransactionContext): Promise<boolean> {
    const balance = await this.calculateBookingBalance(bookingId, tx);

    // Update booking payment status based on balance
    // This would normally update the booking table
    // For now, we'll just return the reconciliation status

    return balance.isFullyPaid;
  }

  /**
   * Get daily payment report
   */
  async getDailyReport(date: Date, tx?: TransactionContext): Promise<DailyPaymentReport> {
    const db = this.getDb(tx);
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get summary statistics
    const summary = await db
      .select({
        totalAmount: sql`COALESCE(SUM(CASE WHEN ${this.table.status} = 'completed' THEN ${this.table.amount}::numeric ELSE 0 END), 0)`,
        paymentCount: sql`COUNT(CASE WHEN ${this.table.status} = 'completed' THEN 1 END)::int`,
      })
      .from(this.table)
      .where(between(this.table.createdAt, startOfDay, endOfDay));

    // Get method breakdown
    const methods = await db
      .select({
        method: this.table.paymentMethod,
        amount: sql`COALESCE(SUM(${this.table.amount}::numeric), 0)`,
        count: sql`COUNT(*)::int`,
      })
      .from(this.table)
      .where(
        and(between(this.table.createdAt, startOfDay, endOfDay), eq(this.table.status, "completed"))
      )
      .groupBy(this.table.paymentMethod);

    // Get top payments
    const topPayments = await db
      .select()
      .from(this.table)
      .where(
        and(between(this.table.createdAt, startOfDay, endOfDay), eq(this.table.status, "completed"))
      )
      .orderBy(desc(this.table.amount))
      .limit(5);

    return {
      date,
      totalAmount: parseFloat(summary[0].totalAmount as string),
      paymentCount: summary[0].paymentCount as number,
      methods: methods.map((m) => ({
        method: m.method as PaymentMethod,
        amount: parseFloat(m.amount as string),
        count: m.count as number,
      })),
      topPayments: topPayments as Payment[],
    };
  }

  /**
   * Get monthly revenue summary
   */
  async getMonthlyRevenue(
    year: number,
    month: number,
    tx?: TransactionContext
  ): Promise<PaymentSummary> {
    const db = this.getDb(tx);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const result = await db
      .select({
        totalAmount: sql`COALESCE(SUM(${this.table.amount}::numeric), 0)`,
        completedAmount: sql`COALESCE(SUM(CASE WHEN ${this.table.status} = 'completed' THEN ${this.table.amount}::numeric ELSE 0 END), 0)`,
        pendingAmount: sql`COALESCE(SUM(CASE WHEN ${this.table.status} IN ('pending', 'processing') THEN ${this.table.amount}::numeric ELSE 0 END), 0)`,
        refundedAmount: sql`COALESCE(SUM(CASE WHEN ${this.table.paymentType} = 'refund' THEN ${this.table.amount}::numeric ELSE 0 END), 0)`,
        paymentCount: sql`COUNT(*)::int`,
        cashAmount: sql`COALESCE(SUM(CASE WHEN ${this.table.paymentMethod} = 'cash' AND ${this.table.status} = 'completed' THEN ${this.table.amount}::numeric ELSE 0 END), 0)`,
        gcashAmount: sql`COALESCE(SUM(CASE WHEN ${this.table.paymentMethod} = 'gcash' AND ${this.table.status} = 'completed' THEN ${this.table.amount}::numeric ELSE 0 END), 0)`,
        bankTransferAmount: sql`COALESCE(SUM(CASE WHEN ${this.table.paymentMethod} = 'bank_transfer' AND ${this.table.status} = 'completed' THEN ${this.table.amount}::numeric ELSE 0 END), 0)`,
        creditCardAmount: sql`COALESCE(SUM(CASE WHEN ${this.table.paymentMethod} = 'credit_card' AND ${this.table.status} = 'completed' THEN ${this.table.amount}::numeric ELSE 0 END), 0)`,
      })
      .from(this.table)
      .where(between(this.table.createdAt, startDate, endDate));

    const summary = result[0];
    const totalAmount = parseFloat(summary.totalAmount as string);
    const paymentCount = summary.paymentCount as number;

    return {
      totalAmount,
      completedAmount: parseFloat(summary.completedAmount as string),
      pendingAmount: parseFloat(summary.pendingAmount as string),
      refundedAmount: parseFloat(summary.refundedAmount as string),
      paymentCount,
      averagePaymentAmount: paymentCount > 0 ? totalAmount / paymentCount : 0,
      methodBreakdown: {
        cash: parseFloat(summary.cashAmount as string),
        gcash: parseFloat(summary.gcashAmount as string),
        bankTransfer: parseFloat(summary.bankTransferAmount as string),
        creditCard: parseFloat(summary.creditCardAmount as string),
      },
    };
  }

  /**
   * Get payments within date range
   */
  async getPaymentsByDateRange(
    startDate: Date,
    endDate: Date,
    tx?: TransactionContext
  ): Promise<Payment[]> {
    const db = this.getDb(tx);

    const result = await db
      .select()
      .from(this.table)
      .where(between(this.table.createdAt, startDate, endDate))
      .orderBy(desc(this.table.createdAt));

    return result as Payment[];
  }

  /**
   * Process refund for a payment
   */
  async processRefund(
    originalPaymentId: string,
    refundAmount: number,
    reason: string,
    processedBy: string,
    tx?: TransactionContext
  ): Promise<Payment> {
    // Get original payment
    const originalPayment = await this.findById(originalPaymentId, tx);
    if (!originalPayment) {
      throw new Error("Original payment not found");
    }

    // Create refund payment
    const refundPayment: NewPayment = {
      bookingId: originalPayment.bookingId,
      paymentCode: await this.generatePaymentCode(tx),
      amount: refundAmount.toString(),
      paymentMethod: originalPayment.paymentMethod,
      paymentType: "refund",
      transactionId: null,
      referenceNumber: `REFUND-${originalPayment.paymentCode}`,
      gcashReferenceNumber: originalPayment.gcashReferenceNumber,
      gcashAccountName: originalPayment.gcashAccountName,
      gcashAccountNumber: originalPayment.gcashAccountNumber,
      bankName: originalPayment.bankName,
      bankAccountNumber: originalPayment.bankAccountNumber,
      bankAccountName: originalPayment.bankAccountName,
      status: "completed",
      verifiedAt: new Date(),
      verifiedBy: processedBy,
      receiptNumber: null,
      receiptUrl: null,
      notes: `Refund for payment ${originalPayment.paymentCode}: ${reason}`,
      failureReason: null,
      metadata: {
        originalPaymentId,
        refundReason: reason,
      },
      processedBy,
    };

    return this.create(refundPayment, tx);
  }

  /**
   * Find refund payments
   */
  async findRefunds(startDate?: Date, endDate?: Date, tx?: TransactionContext): Promise<Payment[]> {
    const db = this.getDb(tx);

    let conditions = eq(this.table.paymentType, "refund");

    if (startDate && endDate) {
      conditions = and(conditions, between(this.table.createdAt, startDate, endDate));
    }

    const result = await db
      .select()
      .from(this.table)
      .where(conditions)
      .orderBy(desc(this.table.createdAt));

    return result as Payment[];
  }

  /**
   * Generate official receipt number for BIR compliance
   */
  async generateOfficialReceipt(paymentId: string, tx?: TransactionContext): Promise<string> {
    const payment = await this.findById(paymentId, tx);
    if (!payment) {
      throw new Error("Payment not found");
    }

    // Format: OR-YYYY-MM-NNNNNN
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");

    // Get the next receipt number for this month
    const db = this.getDb(tx);
    const result = await db
      .select({
        maxReceipt: sql`MAX(CAST(SUBSTRING(${this.table.receiptNumber} FROM 11) AS INTEGER))`,
      })
      .from(this.table)
      .where(sql`${this.table.receiptNumber} LIKE 'OR-${year}-${month}-%'`);

    const nextNumber = ((result[0].maxReceipt as number) || 0) + 1;
    const receiptNumber = `OR-${year}-${month}-${String(nextNumber).padStart(6, "0")}`;

    // Update payment with receipt number
    await this.update(paymentId, { receiptNumber }, tx);

    return receiptNumber;
  }

  /**
   * Calculate withholding tax for Philippine tax compliance
   */
  async calculateWithholdingTax(
    paymentId: string,
    rate: number,
    tx?: TransactionContext
  ): Promise<number> {
    const payment = await this.findById(paymentId, tx);
    if (!payment) {
      throw new Error("Payment not found");
    }

    const amount = parseFloat(payment.amount);
    const withholdingTax = amount * rate;

    return Math.round(withholdingTax * 100) / 100;
  }

  /**
   * Generate unique payment code
   */
  private async generatePaymentCode(tx?: TransactionContext): Promise<string> {
    const prefix = "PAY";
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();

    let code = `${prefix}${timestamp}${random}`;

    // Ensure uniqueness
    let exists = await this.exists([{ field: "paymentCode", operator: "eq", value: code }], tx);
    let attempts = 0;

    while (exists && attempts < 10) {
      const newRandom = Math.random().toString(36).substring(2, 5).toUpperCase();
      code = `${prefix}${timestamp}${newRandom}`;
      exists = await this.exists([{ field: "paymentCode", operator: "eq", value: code }], tx);
      attempts++;
    }

    if (exists) {
      throw new Error("Unable to generate unique payment code");
    }

    return code;
  }
}
