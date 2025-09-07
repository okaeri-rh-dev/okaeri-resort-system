/**
 * Financial Validation Schemas
 * Zod schemas for Philippine BIR-compliant financial operations
 */

import { z } from "zod";
import {
  ExpenseCategory,
  ExpenseStatus,
  ApprovalLevel,
  PaymentMethod,
  VendorType,
} from "../types/financial.types";

// ============================================================================
// HELPER SCHEMAS
// ============================================================================

/**
 * Philippine TIN validation
 * Formats:
 * - Individual: XXX-XXX-XXX-XXX (with optional branch code)
 * - Corporation: XXX-XXX-XXX
 */
export const tinSchema = z
  .string()
  .regex(/^\d{3}-\d{3}-\d{3}(-\d{3})?$/, "Invalid TIN format. Use XXX-XXX-XXX or XXX-XXX-XXX-XXX")
  .refine((tin) => {
    // TODO: Implement Luhn algorithm check for TIN validation
    return true;
  }, "Invalid TIN check digit");

/**
 * Philippine phone number validation
 * Formats: +639XX, 09XX, 02-XXXX, etc.
 */
export const phoneSchema = z
  .string()
  .regex(
    /^(\+63|0)[2-9]\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}$/,
    "Invalid Philippine phone number format"
  );

/**
 * Money amount validation
 * Ensures proper decimal precision for Philippine Peso
 */
export const moneySchema = z
  .number()
  .positive("Amount must be positive")
  .multipleOf(0.01, "Amount must have maximum 2 decimal places")
  .max(999999999.99, "Amount exceeds maximum limit")
  .or(
    z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, "Invalid money format")
      .transform((v) => parseFloat(v))
  );

/**
 * Receipt number validation
 * Format: YYYY-SSSS-NNNNNNNN
 */
export const receiptNumberSchema = z
  .string()
  .regex(/^\d{4}-\d{4}-\d{8}$/, "Invalid receipt number format. Use YYYY-SSSS-NNNNNNNN");

/**
 * Bank account validation
 */
export const bankAccountSchema = z
  .string()
  .min(10, "Bank account must be at least 10 digits")
  .max(16, "Bank account must not exceed 16 digits")
  .regex(/^\d+$/, "Bank account must contain only numbers");

// ============================================================================
// EXPENSE SCHEMAS
// ============================================================================

/**
 * Expense creation schema
 */
export const createExpenseSchema = z
  .object({
    transactionDate: z
      .string()
      .or(z.date())
      .refine((date) => {
        const d = new Date(date);
        return d <= new Date();
      }, "Transaction date cannot be in the future"),

    category: z.nativeEnum(ExpenseCategory),

    amount: moneySchema,

    description: z
      .string()
      .min(5, "Description must be at least 5 characters")
      .max(500, "Description must not exceed 500 characters"),

    vendorId: z.string().uuid().optional(),

    // Tax Information
    isVatable: z.boolean(),
    vatAmount: moneySchema.optional(),
    netAmount: moneySchema.optional(),
    ewtAmount: moneySchema.optional(),
    ewtRate: z.number().min(0).max(0.15).multipleOf(0.0001).optional(),

    // Documentation
    receiptNumber: receiptNumberSchema.optional(),
    receiptImage: z.string().url().optional(),
    invoiceNumber: z.string().optional(),
    invoiceImage: z.string().url().optional(),

    // Payment
    paymentMethod: z.nativeEnum(PaymentMethod).optional(),
    paymentReference: z.string().optional(),
    paymentDate: z.string().or(z.date()).optional(),
  })
  .refine(
    (data) => {
      // If VATable, VAT amount should be present
      if (data.isVatable && !data.vatAmount) {
        return false;
      }
      return true;
    },
    {
      message: "VAT amount is required for VATable expenses",
      path: ["vatAmount"],
    }
  )
  .refine(
    (data) => {
      // Validate total amount equals net + VAT
      if (data.isVatable && data.netAmount && data.vatAmount) {
        const total = data.netAmount + data.vatAmount;
        return Math.abs(total - data.amount) < 0.01;
      }
      return true;
    },
    {
      message: "Total amount must equal net amount + VAT",
      path: ["amount"],
    }
  );

/**
 * Expense update schema
 */
export const updateExpenseSchema = createExpenseSchema.partial().extend({
  id: z.string().uuid(),
  status: z.nativeEnum(ExpenseStatus).optional(),
});

/**
 * Expense approval schema
 */
export const approveExpenseSchema = z
  .object({
    expenseId: z.string().uuid(),
    approved: z.boolean(),
    comments: z.string().optional(),
    amountApproved: moneySchema.optional(),
    conditions: z.array(z.string()).optional(),
  })
  .refine(
    (data) => {
      // If rejecting, comments are required
      if (!data.approved && !data.comments) {
        return false;
      }
      return true;
    },
    {
      message: "Comments are required when rejecting an expense",
      path: ["comments"],
    }
  );

/**
 * Expense filter schema
 */
export const filterExpenseSchema = z.object({
  startDate: z.string().or(z.date()).optional(),
  endDate: z.string().or(z.date()).optional(),
  category: z.nativeEnum(ExpenseCategory).optional(),
  status: z.nativeEnum(ExpenseStatus).optional(),
  vendorId: z.string().uuid().optional(),
  minAmount: moneySchema.optional(),
  maxAmount: moneySchema.optional(),
  hasReceipt: z.boolean().optional(),
  approvalLevel: z.nativeEnum(ApprovalLevel).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sortBy: z.enum(["date", "amount", "category", "status"]).default("date"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ============================================================================
// VENDOR SCHEMAS
// ============================================================================

/**
 * Vendor registration schema
 */
export const createVendorSchema = z
  .object({
    // Basic Information
    vendorName: z
      .string()
      .min(2, "Vendor name must be at least 2 characters")
      .max(200, "Vendor name must not exceed 200 characters"),

    tin: tinSchema,

    businessAddress: z
      .string()
      .min(10, "Business address must be at least 10 characters")
      .max(500, "Business address must not exceed 500 characters"),

    contactPerson: z
      .string()
      .min(2, "Contact person name must be at least 2 characters")
      .max(100, "Contact person name must not exceed 100 characters"),

    contactNumber: phoneSchema,

    email: z.string().email("Invalid email format").optional(),

    // Tax Information
    vendorType: z.nativeEnum(VendorType),
    vatRegistered: z.boolean(),
    vatNumber: z
      .string()
      .regex(/^\d{3}-\d{3}-\d{3}-\d{4}$/, "Invalid VAT number format")
      .optional(),
    withholdingTaxApplicable: z.boolean(),
    withholdingTaxRate: z.number().min(0).max(0.15).multipleOf(0.0001).optional(),

    // Banking
    bankName: z.string().max(100).optional(),
    accountName: z.string().max(200).optional(),
    accountNumber: bankAccountSchema.optional(),

    // Documentation
    birForm2307Required: z.boolean(),
    requiresOR: z.boolean(),
    paymentTerms: z.number().int().min(0).max(180).default(30),

    // Categories
    serviceCategories: z
      .array(z.nativeEnum(ExpenseCategory))
      .min(1, "At least one service category is required"),

    // Compliance
    permitNumber: z.string().optional(),
    permitExpiry: z.string().or(z.date()).optional(),
    insuranceCoverage: z.boolean().optional(),
    insuranceExpiry: z.string().or(z.date()).optional(),
  })
  .refine(
    (data) => {
      // If VAT registered, VAT number is required
      if (data.vatRegistered && !data.vatNumber) {
        return false;
      }
      return true;
    },
    {
      message: "VAT number is required for VAT-registered vendors",
      path: ["vatNumber"],
    }
  )
  .refine(
    (data) => {
      // If withholding tax applicable, rate is required
      if (data.withholdingTaxApplicable && !data.withholdingTaxRate) {
        return false;
      }
      return true;
    },
    {
      message: "Withholding tax rate is required when applicable",
      path: ["withholdingTaxRate"],
    }
  );

/**
 * Vendor update schema
 */
export const updateVendorSchema = createVendorSchema.partial().extend({
  id: z.string().uuid(),
  isActive: z.boolean().optional(),
  blacklisted: z.boolean().optional(),
  blacklistReason: z.string().optional(),
});

/**
 * Vendor search schema
 */
export const searchVendorSchema = z.object({
  query: z.string().optional(),
  vendorType: z.nativeEnum(VendorType).optional(),
  vatRegistered: z.boolean().optional(),
  category: z.nativeEnum(ExpenseCategory).optional(),
  isActive: z.boolean().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

// ============================================================================
// PETTY CASH SCHEMAS
// ============================================================================

/**
 * Petty cash fund creation schema
 */
export const createPettyCashFundSchema = z.object({
  fundName: z
    .string()
    .min(3, "Fund name must be at least 3 characters")
    .max(100, "Fund name must not exceed 100 characters"),

  fundLimit: z.number().positive().max(10000, "Fund limit cannot exceed PHP 10,000"),

  custodian: z
    .string()
    .min(2, "Custodian name must be at least 2 characters")
    .max(100, "Custodian name must not exceed 100 characters"),

  alternateCustodian: z
    .string()
    .min(2, "Alternate custodian name must be at least 2 characters")
    .max(100, "Alternate custodian name must not exceed 100 characters")
    .optional(),

  location: z
    .string()
    .min(3, "Location must be at least 3 characters")
    .max(200, "Location must not exceed 200 characters"),
});

/**
 * Petty cash transaction schema
 */
export const createPettyCashTransactionSchema = z
  .object({
    fundId: z.string().uuid(),

    transactionDate: z
      .string()
      .or(z.date())
      .refine((date) => {
        const d = new Date(date);
        return d <= new Date();
      }, "Transaction date cannot be in the future"),

    amount: z.number().positive().max(2000, "Petty cash disbursement cannot exceed PHP 2,000"),

    category: z.nativeEnum(ExpenseCategory).refine((cat) => {
      // Only allow certain categories for petty cash
      const allowed = [
        ExpenseCategory.SUPPLIES_OFFICE,
        ExpenseCategory.SUPPLIES_HOUSEKEEPING,
        ExpenseCategory.MAINTENANCE_REPAIRS,
        ExpenseCategory.OTHER_MISCELLANEOUS,
      ];
      return allowed.includes(cat);
    }, "This category is not allowed for petty cash"),

    description: z
      .string()
      .min(5, "Description must be at least 5 characters")
      .max(500, "Description must not exceed 500 characters"),

    requestedBy: z
      .string()
      .min(2, "Requestor name must be at least 2 characters")
      .max(100, "Requestor name must not exceed 100 characters"),

    receiptNumber: z.string().optional(),
    receiptImage: z.string().url().optional(),
    vendorName: z.string().optional(),
  })
  .refine(
    (data) => {
      // Receipts required for all transactions
      if (!data.receiptNumber && !data.receiptImage) {
        return false;
      }
      return true;
    },
    {
      message: "Receipt is required for petty cash transactions",
      path: ["receiptNumber"],
    }
  );

/**
 * Petty cash replenishment schema
 */
export const createReplenishmentSchema = z.object({
  fundId: z.string().uuid(),
  amount: moneySchema,
  fromAccount: z
    .string()
    .min(3, "Account name must be at least 3 characters")
    .max(100, "Account name must not exceed 100 characters"),
  checkNumber: z.string().optional(),
  transactionIds: z.array(z.string().uuid()).min(1, "At least one transaction must be included"),
  preparedBy: z
    .string()
    .min(2, "Preparer name must be at least 2 characters")
    .max(100, "Preparer name must not exceed 100 characters"),
});

// ============================================================================
// RECEIPT SCHEMAS
// ============================================================================

/**
 * Receipt generation schema
 */
export const generateReceiptSchema = z.object({
  transactionType: z.enum(["expense", "revenue"]),
  transactionId: z.string().uuid(),

  // Payor/Payee Information
  payorName: z
    .string()
    .min(2, "Payor name must be at least 2 characters")
    .max(200, "Payor name must not exceed 200 characters")
    .optional(),
  payorTin: tinSchema.optional(),
  payorAddress: z
    .string()
    .min(10, "Payor address must be at least 10 characters")
    .max(500, "Payor address must not exceed 500 characters")
    .optional(),

  // Payment Details
  paymentMethod: z.nativeEnum(PaymentMethod),
  paymentReference: z.string().optional(),

  // Delivery
  emailTo: z.string().email().optional(),
  printCopy: z.boolean().default(false),
});

/**
 * Receipt cancellation schema
 */
export const cancelReceiptSchema = z.object({
  receiptId: z.string().uuid(),
  reason: z
    .string()
    .min(10, "Cancellation reason must be at least 10 characters")
    .max(500, "Cancellation reason must not exceed 500 characters"),
  authorizedBy: z
    .string()
    .min(2, "Authorizer name must be at least 2 characters")
    .max(100, "Authorizer name must not exceed 100 characters"),
});

// ============================================================================
// REPORT SCHEMAS
// ============================================================================

/**
 * Report generation schema
 */
export const generateReportSchema = z
  .object({
    reportType: z.enum([
      "expense_summary",
      "vendor_summary",
      "category_breakdown",
      "tax_summary",
      "cash_flow",
      "budget_variance",
      "bir_vat_return",
      "bir_withholding_tax",
      "bir_income_tax",
      "audit_trail",
    ]),

    periodStart: z.string().or(z.date()),
    periodEnd: z.string().or(z.date()),

    // Filters
    categories: z.array(z.nativeEnum(ExpenseCategory)).optional(),
    vendors: z.array(z.string().uuid()).optional(),
    statuses: z.array(z.nativeEnum(ExpenseStatus)).optional(),

    // Options
    includeDetails: z.boolean().default(false),
    includeCharts: z.boolean().default(true),
    compareWithPrevious: z.boolean().default(false),

    // Export
    format: z.enum(["pdf", "excel", "csv", "json"]).default("pdf"),
    emailTo: z.string().email().optional(),
  })
  .refine(
    (data) => {
      // End date must be after start date
      const start = new Date(data.periodStart);
      const end = new Date(data.periodEnd);
      return end >= start;
    },
    {
      message: "End date must be after or equal to start date",
      path: ["periodEnd"],
    }
  );

// ============================================================================
// CONFIGURATION SCHEMAS
// ============================================================================

/**
 * Financial configuration schema
 */
export const financialConfigSchema = z
  .object({
    // Company Information
    companyName: z
      .string()
      .min(2, "Company name must be at least 2 characters")
      .max(200, "Company name must not exceed 200 characters"),
    tin: tinSchema,
    businessAddress: z
      .string()
      .min(10, "Business address must be at least 10 characters")
      .max(500, "Business address must not exceed 500 characters"),
    birRdoCode: z.string().regex(/^\d{3}$/, "RDO code must be 3 digits"),

    // Tax Settings
    isVatRegistered: z.boolean(),
    vatNumber: z
      .string()
      .regex(/^\d{3}-\d{3}-\d{3}-\d{4}$/, "Invalid VAT number format")
      .optional(),
    percentageTaxApplicable: z.boolean(),

    // Receipt Settings
    receiptSeriesPrefix: z.string().regex(/^\d{4}$/, "Series prefix must be 4 digits"),
    currentReceiptNumber: z.number().int().positive(),
    birPermitNumber: z.string(),
    machineNumber: z.string().optional(),

    // Approval Settings
    approvalThresholds: z.object({
      autoApprove: z.number().positive().default(1000),
      managerApproval: z.number().positive().default(10000),
      ownerApproval: z.number().positive().default(10000),
      dualApproval: z.number().positive().default(50000),
    }),

    // Petty Cash Settings
    pettyCashSettings: z.object({
      fundLimit: z.number().positive().max(10000).default(10000),
      disbursementLimit: z.number().positive().max(2000).default(2000),
      replenishmentThreshold: z.number().min(0.1).max(0.5).default(0.2),
      requireReceipt: z.boolean().default(true),
      approvalRequiredAbove: z.number().positive().default(500),
    }),

    // Document Retention
    retentionPeriodYears: z.number().int().min(5).default(5),

    // Notifications
    notifyOnApprovalRequired: z.boolean().default(true),
    notifyOnPaymentDue: z.boolean().default(true),
    notifyOnLowPettyCash: z.boolean().default(true),
  })
  .refine(
    (data) => {
      // If VAT registered, VAT number is required
      if (data.isVatRegistered && !data.vatNumber) {
        return false;
      }
      return true;
    },
    {
      message: "VAT number is required for VAT-registered businesses",
      path: ["vatNumber"],
    }
  )
  .refine(
    (data) => {
      // Cannot be both VAT registered and percentage tax applicable
      if (data.isVatRegistered && data.percentageTaxApplicable) {
        return false;
      }
      return true;
    },
    {
      message: "Cannot be both VAT registered and percentage tax applicable",
      path: ["percentageTaxApplicable"],
    }
  );

// ============================================================================
// EXPORT ALL SCHEMAS
// ============================================================================

export const financialSchemas = {
  // Expenses
  createExpense: createExpenseSchema,
  updateExpense: updateExpenseSchema,
  approveExpense: approveExpenseSchema,
  filterExpense: filterExpenseSchema,

  // Vendors
  createVendor: createVendorSchema,
  updateVendor: updateVendorSchema,
  searchVendor: searchVendorSchema,

  // Petty Cash
  createPettyCashFund: createPettyCashFundSchema,
  createPettyCashTransaction: createPettyCashTransactionSchema,
  createReplenishment: createReplenishmentSchema,

  // Receipts
  generateReceipt: generateReceiptSchema,
  cancelReceipt: cancelReceiptSchema,

  // Reports
  generateReport: generateReportSchema,

  // Configuration
  financialConfig: financialConfigSchema,

  // Helpers
  tin: tinSchema,
  phone: phoneSchema,
  money: moneySchema,
  receiptNumber: receiptNumberSchema,
  bankAccount: bankAccountSchema,
};
