# Phase 4.3: Implement Financial System (GREEN Phase)

## Overview

This document guides the minimal implementation necessary to make all financial
tests pass. Focus on correctness and Philippine compliance requirements before
optimization.

## Agent Responsibility

**Financial Systems Architect**: Implement core financial features with emphasis
on accuracy, compliance, and security. All implementations must pass the tests
defined in phases 4.1 and 4.2.

## Implementation Architecture

### Core System Design

```typescript
// Core financial system architecture
interface FinancialSystem {
  expenses: ExpenseModule;
  income: IncomeModule;
  payments: PaymentModule;
  reporting: ReportingModule;
  compliance: ComplianceModule;
  audit: AuditModule;
}

// Database schema design - all amounts are numbers
interface FinancialDatabase {
  transactions: TransactionTable;
  expenses: ExpenseTable; // amount: number
  income: IncomeTable; // amount: number
  payments: PaymentTable; // amount: number
  vendors: VendorTable;
  receipts: ReceiptTable;
  exchange_rates: ExchangeRateTable;
  audit_logs: AuditLogTable;
}

/**
 * CRITICAL: Currency Type Consistency Pattern
 *
 * This implementation MUST follow the Currency Type Standard:
 * See: ../../Currency_Type_Standard.md
 *
 * Key Principles from the Standard:
 * 1. Domain Layer: Always use number type (with decimal.js for precision)
 * 2. Database Layer: DECIMAL(12,2) for Philippine Peso
 * 3. API Layer: Accept strings, validate with Zod, convert to numbers
 * 4. Display Layer: Format numbers to strings with Intl.NumberFormat
 *
 * Tax Rates (per Currency Type Standard):
 * - VAT: 12%
 * - Service Charge: 10%
 * - Senior/PWD Discount: 20%
 * - Withholding: 2% services, 5% rentals, 10% individuals, 15% corporations
 *
 * Example Flow (from Currency Type Standard):
 * Input: "5000.00" -> Zod validation -> 5000 (number)
 * Domain: 5000 -> decimal.js calculations -> 5600 (with VAT)
 * Database: Store as DECIMAL(12,2) -> 5600.00
 * Display: 5600 -> Intl.NumberFormat -> "₱5,600.00"
 */
```

## 1. Expense Tracking Implementation

### Expense Service

```typescript
// services/expense.service.ts
import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/services/prisma.service";
import { ValidationService } from "@/services/validation.service";
import { AuditService } from "@/services/audit.service";

@Injectable()
export class ExpenseService {
  constructor(
    private prisma: PrismaService,
    private validation: ValidationService,
    private audit: AuditService
  ) {}

  async create(expenseData: CreateExpenseDto): Promise<Expense> {
    // Validate amount is a number with max 2 decimal places
    const decimalPlaces = (expenseData.amount.toString().split(".")[1] || "")
      .length;
    if (decimalPlaces > 2) {
      throw new ValidationError("Amount must have maximum 2 decimal places");
    }

    // Validate vendor TIN for large amounts
    if (expenseData.amount > 10000 && !expenseData.vendorTin) {
      throw new ValidationError(
        "Vendor TIN required for amounts above PHP 10,000"
      );
    }

    // Validate expense date
    if (new Date(expenseData.date) > new Date()) {
      throw new ValidationError("Expense date cannot be in the future");
    }

    // Calculate VAT if applicable
    const vatAmount = expenseData.isVatable
      ? this.calculateVAT(expenseData.amount)
      : 0;

    // Create expense with audit trail
    const expense = await this.prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          ...expenseData,
          vatAmount,
          netAmount: expenseData.amount - vatAmount,
          status: "PENDING_APPROVAL",
          createdBy: expenseData.userId,
        },
      });

      // Create audit log
      await this.audit.log({
        entityType: "EXPENSE",
        entityId: created.id,
        action: "CREATE",
        userId: expenseData.userId,
        details: expenseData,
      });

      return created;
    });

    return expense;
  }

  private calculateVAT(amount: number): number {
    // Philippine VAT calculation (12%)
    const vatableSales = amount / 1.12;
    const vatAmount = vatableSales * 0.12;
    return Math.round(vatAmount * 100) / 100; // Round to 2 decimal places for precision
  }

  async getCategories(): Promise<ExpenseCategory[]> {
    return [
      {
        code: "UTILITIES",
        name: "Utilities",
        subcategories: ["Electricity", "Water", "Internet", "Gas"],
        glCode: "5100",
      },
      {
        code: "SUPPLIES",
        name: "Supplies",
        subcategories: ["Housekeeping", "Kitchen", "Office", "Pool"],
        glCode: "5200",
      },
      {
        code: "MAINTENANCE",
        name: "Maintenance",
        subcategories: ["Repairs", "Preventive", "Equipment", "Landscaping"],
        glCode: "5300",
      },
      {
        code: "MARKETING",
        name: "Marketing",
        subcategories: ["Online Ads", "Commissions", "Promotions", "Materials"],
        glCode: "5400",
      },
      {
        code: "PAYROLL",
        name: "Payroll",
        subcategories: ["Salaries", "Benefits", "SSS", "PhilHealth", "PagIBIG"],
        glCode: "5500",
      },
      {
        code: "PROFESSIONAL",
        name: "Professional Fees",
        subcategories: ["Accounting", "Legal", "Consulting"],
        glCode: "5600",
      },
      {
        code: "PERMITS",
        name: "Permits & Licenses",
        subcategories: ["Business Permit", "Tourism", "Health", "Fire"],
        glCode: "5700",
      },
      {
        code: "INSURANCE",
        name: "Insurance",
        subcategories: ["Property", "Liability", "Vehicle", "Employee"],
        glCode: "5800",
      },
      {
        code: "EQUIPMENT",
        name: "Equipment",
        subcategories: ["Purchase", "Rental", "Software"],
        glCode: "1500",
        isCapital: true,
      },
      {
        code: "FOOD_BEVERAGE",
        name: "Food & Beverage",
        subcategories: ["Ingredients", "Beverages", "Packaging"],
        glCode: "5900",
      },
    ];
  }
}
```

### Receipt Management

```typescript
// services/receipt.service.ts
import { Injectable } from "@nestjs/common";
import { S3Service } from "@/services/s3.service";
import { OCRService } from "@/services/ocr.service";
import { PDFService } from "@/services/pdf.service";

@Injectable()
export class ReceiptService {
  constructor(
    private s3: S3Service,
    private ocr: OCRService,
    private pdf: PDFService,
    private prisma: PrismaService
  ) {}

  async upload(expenseId: string, file: Express.Multer.File): Promise<Receipt> {
    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new ValidationError(
        "File type not allowed. Allowed types: jpg, png, pdf"
      );
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      throw new ValidationError("File size exceeds 10MB limit");
    }

    // Generate storage path (organized by year/month)
    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
    });
    const date = new Date(expense.date);
    const path = `receipts/${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${expenseId}/`;

    // Upload to S3
    const uploadResult = await this.s3.upload({
      bucket: process.env.AWS_BUCKET,
      key: `${path}${file.originalname}`,
      body: file.buffer,
      contentType: file.mimetype,
    });

    // Generate thumbnail if image
    let thumbnailUrl = null;
    if (file.mimetype.startsWith("image/")) {
      thumbnailUrl = await this.generateThumbnail(file, path);
    }

    // Save receipt record
    const receipt = await this.prisma.receipt.create({
      data: {
        expenseId,
        url: uploadResult.Location,
        thumbnailUrl,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedAt: new Date(),
      },
    });

    return receipt;
  }

  async extractText(receiptImage: Buffer): Promise<ExtractedData> {
    // Use OCR service to extract text
    const text = await this.ocr.extractText(receiptImage);

    // Parse extracted text for key information
    const extracted: ExtractedData = {
      vendor: this.parseVendor(text),
      amount: this.parseAmount(text),
      date: this.parseDate(text),
      referenceNumber: this.parseReference(text),
      tin: this.parseTIN(text),
    };

    return extracted;
  }

  async generateOR(expense: Expense): Promise<OfficialReceipt> {
    const business = await this.prisma.businessInfo.findFirst();

    // Generate sequential OR number
    const lastOR = await this.prisma.officialReceipt.findFirst({
      orderBy: { createdAt: "desc" },
    });
    const orNumber = this.generateORNumber(lastOR?.orNumber);

    // Prepare OR data
    const orData = {
      orNumber,
      date: expense.date,
      tin: business.tin,
      permitToPrint: business.permitToPrint,
      machineNumber: business.machineNumber,
      vendor: expense.vendor,
      amount: expense.amount,
      vatBreakdown: expense.isVatable
        ? {
            vatableSales: expense.netAmount,
            vatAmount: expense.vatAmount,
            totalAmount: expense.amount,
          }
        : null,
      footer: expense.isVatable
        ? `VAT Reg. TIN: ${business.tin}`
        : `NON-VAT Reg. TIN: ${business.tin}`,
    };

    // Generate PDF
    const pdfBuffer = await this.pdf.generateOR(orData);

    // Save OR record
    const or = await this.prisma.officialReceipt.create({
      data: {
        ...orData,
        expenseId: expense.id,
        pdfUrl: await this.uploadORPdf(pdfBuffer, orNumber),
      },
    });

    return or;
  }

  private generateORNumber(lastNumber?: string): string {
    const year = new Date().getFullYear();
    const sequence = lastNumber ? parseInt(lastNumber.split("-")[2]) + 1 : 1;
    return `OR-${year}-${String(sequence).padStart(6, "0")}`;
  }

  private parseAmount(text: string): number {
    // Extract numeric value from text (OCR or user input)
    const amountRegex = /(?:PHP|₱|P)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi;
    const matches = text.match(amountRegex);
    if (matches) {
      const amount = matches[0].replace(/[^0-9.]/g, "");
      const parsed = parseFloat(amount);
      // Round to 2 decimal places for monetary precision
      return Math.round(parsed * 100) / 100;
    }
    return 0;
  }
}
```

### Vendor Management

```typescript
// services/vendor.service.ts
@Injectable()
export class VendorService {
  async create(vendorData: CreateVendorDto): Promise<Vendor> {
    // Validate TIN format (XXX-XXX-XXX-XXX)
    const tinRegex = /^\d{3}-\d{3}-\d{3}-\d{3}$/;
    if (!tinRegex.test(vendorData.tin)) {
      throw new ValidationError("Invalid TIN format. Use XXX-XXX-XXX-XXX");
    }

    const vendor = await this.prisma.vendor.create({
      data: {
        ...vendorData,
        status: "ACTIVE",
        createdAt: new Date(),
      },
    });

    return vendor;
  }

  async calculateWithholding(
    expense: WithholdingExpense
  ): Promise<WithholdingTax> {
    // Determine withholding tax rate based on vendor type and service
    let rate = 0;
    let form = "";

    if (expense.category === "PROFESSIONAL") {
      if (expense.vendorType === "INDIVIDUAL_PROFESSIONAL") {
        rate = 0.1; // 10% for individual professionals
      } else if (expense.vendorType === "CORPORATION") {
        rate = 0.15; // 15% for corporate professional services
      }
      form = "2307"; // BIR Form 2307 for EWT
    }

    const withholdingAmount = expense.amount * rate;
    const netPayment = expense.amount - withholdingAmount;

    return {
      rate,
      amount: Math.round(withholdingAmount * 100) / 100,
      netPayment: Math.round(netPayment * 100) / 100,
      form,
      dueDate: this.calculateDueDate(expense.date),
    };
  }

  async generateWTCert(
    expense: WithholdingExpense
  ): Promise<WithholdingCertificate> {
    const cert = {
      formNumber: "2307",
      payee: expense.vendor,
      payeeTin: expense.vendorTin,
      incomePayment: expense.amount,
      taxWithheld: expense.withholdingTax,
      period: this.getQuarter(expense.date),
      atcCode: this.getATCCode(expense.category),
    };

    // Generate PDF certificate
    const pdf = await this.pdf.generateWTCert(cert);

    return {
      ...cert,
      pdfUrl: await this.uploadCertificate(pdf),
    };
  }

  private getATCCode(category: string): string {
    // ATC (Alphanumeric Tax Code) mapping
    const atcCodes = {
      PROFESSIONAL: "WI010",
      RENTAL: "WI020",
      CONTRACTOR: "WI030",
    };
    return atcCodes[category] || "WI999";
  }
}
```

## 2. Income Management Implementation

### Income Service

```typescript
// services/income.service.ts
@Injectable()
export class IncomeService {
  async recordBooking(booking: CreateBookingDto): Promise<Income> {
    // Ensure totalAmount is a number
    const amount =
      typeof booking.totalAmount === "string"
        ? parseFloat(booking.totalAmount)
        : booking.totalAmount;

    // Calculate VAT
    const vatAmount = booking.isVatable ? this.calculateVAT(amount) : 0;

    const income = await this.prisma.$transaction(async (tx) => {
      // Create income record
      const incomeRecord = await tx.income.create({
        data: {
          bookingId: booking.bookingId,
          category: "ACCOMMODATION",
          description: `${booking.roomType} - ${booking.numberOfNights} nights`,
          amount, // Use parsed number
          vatAmount,
          netAmount: amount - vatAmount,
          revenueDate: booking.checkInDate,
          recognitionMethod: "CHECK_IN_DATE",
          guestName: booking.guestName,
          source: booking.source,
          status: "CONFIRMED",
        },
      });

      // Create payment record if fully paid
      if (booking.paymentStatus === "FULLY_PAID") {
        await tx.payment.create({
          data: {
            incomeId: incomeRecord.id,
            amount, // Use parsed number
            paymentDate: new Date(),
            method: booking.paymentMethod,
            status: "COMPLETED",
          },
        });
      }

      // Create audit log
      await this.audit.log({
        entityType: "INCOME",
        entityId: incomeRecord.id,
        action: "BOOKING_RECORDED",
        details: booking,
      });

      return incomeRecord;
    });

    return income;
  }

  async recordPlatformBooking(booking: PlatformBookingDto): Promise<Income> {
    // Handle platform-specific fees
    const platformFees = {
      AIRBNB: 0.03, // 3% host service fee
      BOOKING_COM: 0.15, // 15% commission
      AGODA: 0.18, // 18% commission
      EXPEDIA: 0.15, // 15% commission
    };

    const feeRate = platformFees[booking.platform] || 0;
    const serviceFee = booking.grossAmount * feeRate;
    const netPayout = booking.grossAmount - serviceFee;

    const income = await this.prisma.income.create({
      data: {
        platform: booking.platform,
        platformBookingId: booking.confirmationCode,
        grossRevenue: booking.grossAmount,
        platformFees: serviceFee,
        netRevenue: netPayout,
        revenueRecognition: "CHECK_IN_DATE",
        payoutDate: booking.payoutDate,
        status: "PENDING_PAYOUT",
      },
    });

    return income;
  }

  async allocatePackage(packageData: PackageDto): Promise<Allocation[]> {
    const allocations = [];
    const vatRate = 0.12;

    for (const component of packageData.components) {
      const amount = packageData.totalPrice * component.allocation;
      const vatAmount = (amount / 1.12) * vatRate;

      allocations.push({
        category: component.category,
        amount: Math.round(amount * 100) / 100,
        vatAmount: Math.round(vatAmount * 100) / 100,
      });
    }

    // Save allocations to database
    await this.prisma.packageAllocation.createMany({
      data: allocations.map((a) => ({
        packageId: packageData.id,
        ...a,
      })),
    });

    return allocations;
  }

  async calculatePricing(booking: PricingRequest): Promise<PricingResult> {
    // Get base rate
    const room = await this.prisma.roomType.findUnique({
      where: { name: booking.roomType },
    });

    // Determine season
    const seasonalRates = {
      PEAK: 1.5, // 50% surcharge
      HIGH: 1.25, // 25% surcharge
      REGULAR: 1.0, // No adjustment
      OFF_PEAK: 0.8, // 20% discount
    };

    const multiplier = seasonalRates[booking.seasonType] || 1.0;
    const adjustedRate = room.baseRate * multiplier;
    const totalAmount = adjustedRate * booking.nights;

    return {
      baseRate: room.baseRate,
      seasonalMultiplier: multiplier,
      adjustedRate: Math.round(adjustedRate * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
      season: booking.seasonType,
    };
  }
}
```

### Payment Processing

```typescript
// services/payment.service.ts
@Injectable()
export class PaymentService {
  async processCash(payment: CashPaymentDto): Promise<PaymentResult> {
    // Ensure amount is a number
    const amount =
      typeof payment.amount === "string"
        ? parseFloat(payment.amount)
        : payment.amount;

    const result = await this.prisma.$transaction(async (tx) => {
      // Record payment with numeric amount
      const paymentRecord = await tx.payment.create({
        data: {
          bookingId: payment.bookingId,
          amount, // Use parsed number
          currency: payment.currency,
          method: "CASH",
          status: "COMPLETED",
          receivedBy: payment.receivedBy,
          receiptNumber: await this.generateReceiptNumber(),
          paymentDate: new Date(),
        },
      });

      // Update cash drawer with numeric amount
      await this.updateCashDrawer(amount, "IN");

      // Generate receipt
      const receipt = await this.generateReceipt(paymentRecord);

      return {
        ...paymentRecord,
        receiptUrl: receipt.url,
        status: "COMPLETED",
        receiptGenerated: true,
        cashDrawerUpdated: true,
      };
    });

    return result;
  }

  async processGCash(payment: GCashPaymentDto): Promise<PaymentResult> {
    // Record GCash payment
    const paymentRecord = await this.prisma.payment.create({
      data: {
        bookingId: payment.bookingId,
        amount: payment.amount,
        method: "GCASH",
        referenceNumber: payment.gcashRefNumber,
        senderName: payment.senderName,
        senderNumber: payment.senderNumber,
        status: "PENDING_VERIFICATION",
        paymentDate: new Date(),
      },
    });

    // Queue for manual verification
    await this.queueForVerification(paymentRecord.id, "GCASH");

    return {
      ...paymentRecord,
      verificationMethod: "MANUAL",
      expectedClearance: "INSTANT",
    };
  }

  async processBankTransfer(payment: BankTransferDto): Promise<PaymentResult> {
    // Validate and store bank transfer details
    const paymentRecord = await this.prisma.payment.create({
      data: {
        bookingId: payment.bookingId,
        amount: payment.amount,
        method: "BANK_TRANSFER",
        bankName: payment.bankName,
        accountNumber: payment.accountNumber,
        referenceNumber: payment.referenceNumber,
        depositSlipUrl: await this.uploadDepositSlip(payment.depositSlip),
        status: "PENDING_VERIFICATION",
        paymentDate: new Date(),
      },
    });

    return {
      ...paymentRecord,
      verificationRequired: true,
      clearanceDays: 1,
    };
  }

  async processCreditCard(payment: CreditCardDto): Promise<PaymentResult> {
    // Calculate MDR (Merchant Discount Rate)
    const mdrRates = {
      VISA: 0.025,
      MASTERCARD: 0.025,
      AMEX: 0.035,
      JCB: 0.03,
    };

    const mdrRate = mdrRates[payment.cardType] || 0.025;
    const processorFee = payment.amount * mdrRate;
    const netAmount = payment.amount - processorFee;

    const paymentRecord = await this.prisma.payment.create({
      data: {
        bookingId: payment.bookingId,
        amount: payment.amount,
        method: "CREDIT_CARD",
        cardType: payment.cardType,
        lastFourDigits: payment.lastFourDigits,
        authorizationCode: payment.authorizationCode,
        processorFee,
        netAmount,
        status: "COMPLETED",
        settlementDate: this.calculateSettlementDate(3),
        paymentDate: new Date(),
      },
    });

    return {
      ...paymentRecord,
      grossAmount: payment.amount,
      processorFee,
      netAmount,
      settlementDays: 3,
    };
  }

  async recordDeposit(deposit: DepositDto): Promise<BookingPayment> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: deposit.bookingId },
    });

    // Parse amounts to numbers
    const depositAmount =
      typeof deposit.depositAmount === "string"
        ? parseFloat(deposit.depositAmount)
        : deposit.depositAmount;
    const balanceDue =
      typeof deposit.balanceDue === "string"
        ? parseFloat(deposit.balanceDue)
        : deposit.balanceDue;

    // Create deposit payment with numeric amounts
    await this.prisma.payment.create({
      data: {
        bookingId: deposit.bookingId,
        amount: depositAmount,
        method: deposit.paymentMethod,
        type: "DEPOSIT",
        status: "COMPLETED",
        paymentDate: new Date(),
      },
    });

    // Update booking payment status with numeric amounts
    await this.prisma.booking.update({
      where: { id: deposit.bookingId },
      data: {
        paymentStatus: "PARTIALLY_PAID",
        depositReceived: depositAmount,
        remainingBalance: balanceDue,
        balanceDueDate: deposit.dueDate,
      },
    });

    // Schedule balance reminder
    await this.scheduleBalanceReminder(deposit.bookingId, deposit.dueDate);

    return {
      bookingId: deposit.bookingId,
      paymentStatus: "PARTIALLY_PAID",
      depositReceived: depositAmount,
      remainingBalance: balanceDue,
      balanceReminder: true,
    };
  }

  async processRefund(refund: RefundDto): Promise<RefundResult> {
    const refundRecord = await this.prisma.refund.create({
      data: {
        bookingId: refund.bookingId,
        originalAmount: refund.originalAmount,
        refundAmount: refund.refundAmount,
        cancellationFee: refund.cancellationFee,
        reason: refund.reason,
        refundMethod: refund.refundMethod,
        status: "PENDING_PROCESSING",
        requestedAt: new Date(),
      },
    });

    // Process refund based on method
    const processingDays = {
      BANK_TRANSFER: 5,
      GCASH: 3,
      CREDIT_CARD: 7,
      CASH: 0,
    };

    return {
      ...refundRecord,
      refundAmount: refund.refundAmount,
      retainedAmount: refund.cancellationFee,
      refundStatus: "PENDING_PROCESSING",
      estimatedDays: processingDays[refund.refundMethod] || 5,
    };
  }

  async reconcileCashDrawer(
    drawer: CashDrawerDto
  ): Promise<ReconciliationResult> {
    const expectedClosing =
      drawer.openingBalance + drawer.cashSales - drawer.cashPayouts;

    const variance = drawer.actualCount - expectedClosing;
    const tolerance = 100; // PHP 100 tolerance

    const reconciliation = await this.prisma.cashReconciliation.create({
      data: {
        date: drawer.date,
        openingBalance: drawer.openingBalance,
        cashSales: drawer.cashSales,
        cashPayouts: drawer.cashPayouts,
        expectedClosing,
        actualCount: drawer.actualCount,
        variance,
        status:
          Math.abs(variance) <= tolerance
            ? "BALANCED"
            : variance > 0
              ? "OVER"
              : "SHORT",
        reconciledBy: drawer.userId,
      },
    });

    return {
      ...reconciliation,
      requiresInvestigation: Math.abs(variance) > tolerance,
    };
  }
}
```

### Multi-Currency Support

```typescript
// services/currency.service.ts
@Injectable()
export class CurrencyService {
  private bspApiUrl = "https://api.bsp.gov.ph/rates";

  async convert(
    amount: CurrencyAmount,
    targetCurrency: string
  ): Promise<Conversion> {
    // Get exchange rate from BSP or cached rates
    const rate = await this.getExchangeRate(amount.currency, targetCurrency);

    const convertedAmount = amount.amount * rate;

    return {
      originalAmount: amount.amount,
      originalCurrency: amount.currency,
      exchangeRate: rate,
      convertedAmount: Math.round(convertedAmount * 100) / 100,
      targetCurrency,
      conversionDate: new Date(),
      rateSource: "BSP",
    };
  }

  async getExchangeRate(from: string, to: string): Promise<number> {
    // Check cache first
    const cached = await this.redis.get(`rate:${from}:${to}`);
    if (cached) return parseFloat(cached);

    // Fetch from BSP API
    try {
      const response = await axios.get(`${this.bspApiUrl}/current`);
      const rates = response.data.rates;

      // Calculate cross rate if needed
      let rate: number;
      if (from === "PHP") {
        rate = 1 / rates[to];
      } else if (to === "PHP") {
        rate = rates[from];
      } else {
        // Cross rate calculation
        rate = rates[from] / rates[to];
      }

      // Cache for 1 hour
      await this.redis.set(`rate:${from}:${to}`, rate, "EX", 3600);

      return rate;
    } catch (error) {
      // Fallback to stored rates
      return this.getFallbackRate(from, to);
    }
  }

  async exchangeCash(exchange: CashExchangeDto): Promise<ExchangeResult> {
    const bankRate = await this.getExchangeRate(
      exchange.fromCurrency,
      exchange.toCurrency
    );

    // Apply margin for cash exchanges
    const margin = 0.02; // 2% margin
    const effectiveRate = bankRate * (1 - margin);
    const convertedAmount = exchange.amount * effectiveRate;

    return {
      amount: exchange.amount,
      fromCurrency: exchange.fromCurrency,
      toCurrency: exchange.toCurrency,
      bankRate,
      marginPercent: margin * 100,
      effectiveRate,
      phpAmount: Math.round(convertedAmount * 100) / 100,
    };
  }

  async recordForeignCurrency(
    transaction: ForeignCurrencyDto
  ): Promise<ForeignTransaction> {
    const phpEquivalent = transaction.amount * transaction.exchangeRate;

    const record = await this.prisma.foreignCurrencyTransaction.create({
      data: {
        bookingId: transaction.bookingId,
        originalAmount: transaction.amount,
        originalCurrency: transaction.currency,
        exchangeRate: transaction.exchangeRate,
        phpEquivalent,
        transactionDate: transaction.paymentDate,
        rateDate: transaction.paymentDate,
      },
    });

    return record;
  }

  async calculateForexGainLoss(payment: ForexPayment): Promise<ForexResult> {
    const bookingValue = payment.bookingAmount * payment.bookingRate;
    const paymentValue = payment.bookingAmount * payment.paymentRate;
    const gainLoss = paymentValue - bookingValue;

    return {
      bookingValue,
      paymentValue,
      gainLoss: Math.round(gainLoss * 100) / 100,
      type: gainLoss > 0 ? "GAIN" : "LOSS",
      percentage: (gainLoss / bookingValue) * 100,
    };
  }

  private getFallbackRate(from: string, to: string): number {
    // Fallback rates (as of typical 2025 rates)
    const rates = {
      "USD-PHP": 56.25,
      "EUR-PHP": 61.375,
      "JPY-PHP": 0.385,
      "CNY-PHP": 7.775,
      "KRW-PHP": 0.043,
      "AUD-PHP": 36.5,
      "SGD-PHP": 41.8,
    };

    const key = `${from}-${to}`;
    const reverseKey = `${to}-${from}`;

    if (rates[key]) return rates[key];
    if (rates[reverseKey]) return 1 / rates[reverseKey];

    return 1; // Default to 1:1 if no rate found
  }
}
```

## 3. Compliance and Tax Implementation

### Tax Calculator

```typescript
// services/tax-calculator.service.ts
@Injectable()
export class TaxCalculatorService {
  calculateVAT(amount: number, isInclusive: boolean = true): VATCalculation {
    const vatRate = 0.12; // 12% Philippine VAT

    if (isInclusive) {
      // Amount already includes VAT
      const vatableSales = amount / 1.12;
      const vatAmount = amount - vatableSales;

      return {
        vatableSales: Math.round(vatableSales * 100) / 100,
        vatAmount: Math.round(vatAmount * 100) / 100,
        totalAmount: amount,
        rate: vatRate,
      };
    } else {
      // Amount excludes VAT
      const vatAmount = amount * vatRate;
      const totalAmount = amount + vatAmount;

      return {
        vatableSales: amount,
        vatAmount: Math.round(vatAmount * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
        rate: vatRate,
      };
    }
  }

  calculateWithholdingTax(payment: WithholdingPayment): WithholdingCalculation {
    // EWT rates based on income type and payee
    const ewtRates = {
      PROFESSIONAL_INDIVIDUAL: 0.1, // 10% for individuals
      PROFESSIONAL_CORPORATION: 0.15, // 15% for corporations
      RENTAL_INDIVIDUAL: 0.05, // 5% for rental
      RENTAL_CORPORATION: 0.05,
      CONTRACTOR_GOODS: 0.01, // 1% for goods
      CONTRACTOR_SERVICES: 0.02, // 2% for services
    };

    const key = `${payment.incomeType}_${payment.payeeType}`;
    const rate = ewtRates[key] || 0;
    const withholdingAmount = payment.amount * rate;

    return {
      grossAmount: payment.amount,
      withholdingRate: rate,
      withholdingAmount: Math.round(withholdingAmount * 100) / 100,
      netAmount: Math.round((payment.amount - withholdingAmount) * 100) / 100,
      formType: this.getFormType(payment.incomeType),
      atcCode: this.getATCCode(key),
    };
  }

  calculatePercentageTax(revenue: number): PercentageTaxCalculation {
    // For non-VAT businesses (gross receipts < 3M annually)
    const percentageTaxRate = 0.03; // 3% percentage tax
    const tax = revenue * percentageTaxRate;

    return {
      grossReceipts: revenue,
      taxRate: percentageTaxRate,
      taxAmount: Math.round(tax * 100) / 100,
      netRevenue: Math.round((revenue - tax) * 100) / 100,
      applicable: "Non-VAT registered businesses",
    };
  }

  private getFormType(incomeType: string): string {
    const forms = {
      PROFESSIONAL: "2307",
      RENTAL: "2307",
      CONTRACTOR: "2307",
      COMPENSATION: "2316",
    };
    return forms[incomeType] || "2307";
  }

  private getATCCode(key: string): string {
    const codes = {
      PROFESSIONAL_INDIVIDUAL: "WI010",
      PROFESSIONAL_CORPORATION: "WC010",
      RENTAL_INDIVIDUAL: "WI050",
      RENTAL_CORPORATION: "WC050",
      CONTRACTOR_GOODS: "WC140",
      CONTRACTOR_SERVICES: "WC160",
    };
    return codes[key] || "WI999";
  }
}
```

### Discount Service

```typescript
// services/discount.service.ts
@Injectable()
export class DiscountService {
  async applySeniorDiscount(
    sale: SeniorDiscountDto
  ): Promise<DiscountedInvoice> {
    // Validate senior ID
    if (!sale.idPresented || !sale.idNumber) {
      throw new ValidationError("Senior Citizen ID required for discount");
    }

    // Apply 20% discount (RA 9994)
    const discountRate = 0.2;
    const maxDiscountableUnits = 1; // Personal use only

    // Calculate discount (limited to personal use)
    const discountableAmount = sale.items
      .slice(0, maxDiscountableUnits)
      .reduce((sum, item) => sum + item.amount, 0);

    const discount = discountableAmount * discountRate;
    const discountedAmount =
      sale.items.reduce((sum, item) => sum + item.amount, 0) - discount;

    // Senior citizens are VAT exempt on discounted amount
    const vatAmount = 0;

    // Log discount for BIR compliance
    await this.logDiscount({
      type: "SENIOR",
      customerName: sale.customerName,
      idNumber: sale.idNumber,
      originalAmount: sale.items.reduce((sum, item) => sum + item.amount, 0),
      discountAmount: discount,
      vatExempted: (discountableAmount / 1.12) * 0.12,
    });

    return {
      originalAmount: sale.items.reduce((sum, item) => sum + item.amount, 0),
      discount,
      discountedAmount,
      vatAmount,
      totalDue: discountedAmount,
      compliance: "RA 9994",
      discountAppliedTo: maxDiscountableUnits,
    };
  }

  async applyPWDDiscount(sale: PWDDiscountDto): Promise<DiscountedInvoice> {
    // Validate PWD ID
    if (!sale.idPresented || !sale.idNumber) {
      throw new ValidationError("PWD ID required for discount");
    }

    // Apply 20% discount (RA 10754)
    const discountRate = 0.2;
    const discount = sale.amount * discountRate;
    const discountedAmount = sale.amount - discount;

    // PWDs are VAT exempt on discounted amount
    const vatAmount = 0;

    // Log discount for BIR compliance
    await this.logDiscount({
      type: "PWD",
      customerName: sale.customerName,
      idNumber: sale.idNumber,
      originalAmount: sale.amount,
      discountAmount: discount,
      vatExempted: (sale.amount / 1.12) * 0.12,
    });

    return {
      originalAmount: sale.amount,
      discount,
      discountedAmount,
      vatAmount,
      totalDue: discountedAmount,
      compliance: "RA 10754",
    };
  }

  async logDiscount(discount: DiscountLog): Promise<LogEntry> {
    const logNumber = await this.generateLogNumber();

    const entry = await this.prisma.discountLog.create({
      data: {
        logNumber,
        date: new Date(),
        type: discount.type,
        customerName: discount.customerName,
        idNumber: discount.idNumber,
        originalAmount: discount.originalAmount,
        discountAmount: discount.discountAmount,
        vatExempted: discount.vatExempted,
        birCompliant: true,
        attachments: ["id-copy.jpg"],
      },
    });

    return entry;
  }

  private async generateLogNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const lastLog = await this.prisma.discountLog.findFirst({
      orderBy: { createdAt: "desc" },
    });

    const sequence = lastLog
      ? parseInt(lastLog.logNumber.split("-")[2]) + 1
      : 1;

    return `DL-${year}-${String(sequence).padStart(6, "0")}`;
  }
}
```

## 4. Financial Reporting

### Report Generator

```typescript
// services/report-generator.service.ts
@Injectable()
export class ReportGeneratorService {
  async generateMonthlyPL(month: string): Promise<ProfitLossStatement> {
    const startDate = new Date(`${month}-01`);
    const endDate = new Date(
      startDate.getFullYear(),
      startDate.getMonth() + 1,
      0
    );

    // Get income data
    const income = await this.prisma.income.aggregate({
      where: {
        revenueDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        amount: true,
        vatAmount: true,
      },
      _count: true,
    });

    // Get expense data
    const expenses = await this.prisma.expense.aggregate({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        amount: true,
        vatAmount: true,
      },
    });

    // Get expense breakdown by category
    const expenseByCategory = await this.prisma.expense.groupBy({
      by: ["category"],
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        amount: true,
      },
    });

    // Calculate totals
    const grossRevenue = income._sum.amount || 0;
    const totalExpenses = expenses._sum.amount || 0;
    const grossProfit = grossRevenue - totalExpenses;
    const netProfit = grossProfit; // Simplified (before tax)

    // Generate report
    const report = {
      period: month,
      revenue: {
        gross: grossRevenue,
        vat: income._sum.vatAmount || 0,
        net: grossRevenue - (income._sum.vatAmount || 0),
      },
      expenses: {
        total: totalExpenses,
        byCategory: expenseByCategory.map((e) => ({
          category: e.category,
          amount: e._sum.amount,
        })),
      },
      profit: {
        gross: grossProfit,
        operating: grossProfit, // Simplified
        net: netProfit,
      },
      metrics: {
        profitMargin: (netProfit / grossRevenue) * 100,
        expenseRatio: (totalExpenses / grossRevenue) * 100,
      },
    };

    // Generate PDF
    const pdf = await this.generatePLPdf(report);

    return {
      ...report,
      pdfUrl: await this.uploadReport(pdf, `PL_${month}.pdf`),
    };
  }

  async generateCashFlow(dateRange: DateRange): Promise<CashFlowStatement> {
    // Operating activities
    const cashReceipts = await this.prisma.payment.aggregate({
      where: {
        paymentDate: {
          gte: dateRange.from,
          lte: dateRange.to,
        },
        status: "COMPLETED",
      },
      _sum: {
        amount: true,
      },
    });

    const cashPayments = await this.prisma.expense.aggregate({
      where: {
        date: {
          gte: dateRange.from,
          lte: dateRange.to,
        },
        paymentStatus: "PAID",
      },
      _sum: {
        amount: true,
      },
    });

    // Calculate cash flow
    const operatingCashFlow =
      (cashReceipts._sum.amount || 0) - (cashPayments._sum.amount || 0);

    return {
      period: {
        from: dateRange.from,
        to: dateRange.to,
      },
      operating: {
        receipts: cashReceipts._sum.amount || 0,
        payments: cashPayments._sum.amount || 0,
        net: operatingCashFlow,
      },
      investing: {
        acquisitions: 0, // Placeholder
        disposals: 0,
        net: 0,
      },
      financing: {
        loans: 0, // Placeholder
        repayments: 0,
        net: 0,
      },
      netCashFlow: operatingCashFlow,
      openingBalance: await this.getOpeningCashBalance(dateRange.from),
      closingBalance: await this.getClosingCashBalance(dateRange.to),
    };
  }

  async generateBIRCompliantReport(
    type: string,
    period: string
  ): Promise<BIRReport> {
    switch (type) {
      case "MONTHLY_VAT":
        return this.generateMonthlyVATReturn(period);
      case "QUARTERLY_VAT":
        return this.generateQuarterlyVATReturn(period);
      case "ANNUAL_ITR":
        return this.generateAnnualITR(period);
      default:
        throw new Error(`Unknown report type: ${type}`);
    }
  }

  private async generateMonthlyVATReturn(month: string): Promise<VATReturn> {
    const startDate = new Date(`${month}-01`);
    const endDate = new Date(
      startDate.getFullYear(),
      startDate.getMonth() + 1,
      0
    );

    // Calculate VAT on sales
    const sales = await this.prisma.income.aggregate({
      where: {
        revenueDate: {
          gte: startDate,
          lte: endDate,
        },
        isVatable: true,
      },
      _sum: {
        amount: true,
        vatAmount: true,
      },
    });

    // Calculate input VAT (from expenses)
    const purchases = await this.prisma.expense.aggregate({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
        isVatable: true,
      },
      _sum: {
        vatAmount: true,
      },
    });

    const outputVAT = sales._sum.vatAmount || 0;
    const inputVAT = purchases._sum.vatAmount || 0;
    const netVAT = outputVAT - inputVAT;

    return {
      form: "2550M", // BIR Form 2550M (Monthly VAT)
      period: month,
      taxableBase: (sales._sum.amount || 0) - (sales._sum.vatAmount || 0),
      outputVAT,
      inputVAT,
      netVATPayable: Math.max(0, netVAT),
      excessInputVAT: Math.max(0, -netVAT),
      dueDate: this.getVATDueDate(endDate),
    };
  }

  private getVATDueDate(periodEnd: Date): Date {
    // VAT due on 20th of following month
    const dueDate = new Date(periodEnd);
    dueDate.setMonth(dueDate.getMonth() + 1);
    dueDate.setDate(20);
    return dueDate;
  }
}
```

## 5. Database Schema

```sql
-- Financial tables schema
-- All monetary columns use DECIMAL(12, 2) for precise numeric storage
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  category VARCHAR(50) NOT NULL,
  subcategory VARCHAR(50),
  vendor VARCHAR(255),
  vendor_tin VARCHAR(20),
  description TEXT,
  amount DECIMAL(12, 2) NOT NULL,        -- Stored as precise decimal
  vat_amount DECIMAL(12, 2) DEFAULT 0,   -- Stored as precise decimal
  net_amount DECIMAL(12, 2) NOT NULL,    -- Stored as precise decimal
  payment_method VARCHAR(50),
  reference_number VARCHAR(100),
  is_capital BOOLEAN DEFAULT FALSE,
  depreciation_years INTEGER,
  status VARCHAR(50) DEFAULT 'PENDING',
  created_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id VARCHAR(100),
  category VARCHAR(50) NOT NULL,
  description TEXT,
  amount DECIMAL(12, 2) NOT NULL,
  vat_amount DECIMAL(12, 2) DEFAULT 0,
  net_amount DECIMAL(12, 2) NOT NULL,
  revenue_date DATE NOT NULL,
  recognition_method VARCHAR(50),
  platform VARCHAR(50),
  platform_fees DECIMAL(12, 2) DEFAULT 0,
  guest_name VARCHAR(255),
  source VARCHAR(50),
  status VARCHAR(50) DEFAULT 'CONFIRMED',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id VARCHAR(100),
  income_id UUID,
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'PHP',
  method VARCHAR(50) NOT NULL,
  reference_number VARCHAR(100),
  card_type VARCHAR(50),
  last_four_digits VARCHAR(4),
  processor_fee DECIMAL(12, 2) DEFAULT 0,
  net_amount DECIMAL(12, 2),
  status VARCHAR(50) DEFAULT 'PENDING',
  payment_date DATE NOT NULL,
  settlement_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (income_id) REFERENCES income(id)
);

CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  tin VARCHAR(20) UNIQUE,
  address TEXT,
  contact_person VARCHAR(255),
  contact_number VARCHAR(50),
  email VARCHAR(255),
  payment_terms VARCHAR(50),
  category VARCHAR(50),
  status VARCHAR(50) DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency VARCHAR(3) NOT NULL,
  buy_rate DECIMAL(10, 4),
  sell_rate DECIMAL(10, 4),
  mid_rate DECIMAL(10, 4),
  rate_date DATE NOT NULL,
  source VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(currency, rate_date)
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  user_id UUID NOT NULL,
  details JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_income_date ON income(revenue_date);
CREATE INDEX idx_income_booking ON income(booking_id);
CREATE INDEX idx_payments_booking ON payments(booking_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
```

## Testing the Implementation

```bash
# Run all financial tests
npm test -- --grep "ExpenseManagement|IncomeManagement|PaymentProcessing"

# Run specific test suites
npm test -- --grep "VAT Calculation"
npm test -- --grep "Senior Discount"
npm test -- --grep "Multi-Currency"

# Run integration tests
npm run test:integration -- financial

# Run performance tests
npm run test:performance -- financial
```

## Next Steps

With the core implementation complete, proceed to Phase 4.4 for refactoring,
optimization, and advanced reporting features.

---

**Phase Lead**: Financial Systems Architect **Document Status**: GREEN Phase -
Minimal Implementation **Implementation Progress**: Core features complete
**Tests Passing**: Target 100% **Next Phase**: 4.4 - Reporting & Compliance
(REFACTOR)
