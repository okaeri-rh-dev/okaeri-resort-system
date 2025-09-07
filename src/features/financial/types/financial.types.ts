/**
 * Financial Domain Types
 * Philippine BIR-compliant financial management types
 */

import { Decimal } from "decimal.js";

// ============================================================================
// PRECISION CONSTANTS
// ============================================================================

export const FINANCIAL_PRECISION = {
  AMOUNT: 2, // PHP 1,234.56
  UNIT_PRICE: 4, // PHP 123.4567 for precise calculations
  TAX_RATE: 4, // 12.0000% for VAT
  WITHHOLDING_RATE: 4, // 10.0000% for EWT
  PERCENTAGE: 2, // 85.75%
  DISCOUNT_RATE: 2, // 10.00%
  EXCHANGE_RATE: 6, // 56.123456 PHP/USD
  QUANTITY: 4, // 1.2345 units
  AVERAGE: 2, // 85.75
  RATIO: 4, // 0.8575
} as const;

export const ROUNDING_RULES = {
  MONETARY: "ROUND_HALF_UP",
  TAX: "ROUND_DOWN",
  PERCENTAGE: "ROUND_HALF_UP",
  QUANTITY: "ROUND_UP",
} as const;

// ============================================================================
// TAX CONSTANTS
// ============================================================================

export const TAX_RATES = {
  VAT: 0.12, // 12% Value Added Tax
  VAT_INCLUSIVE_DIVISOR: 1.12, // For extracting VAT from gross
  EWT_INDIVIDUAL_PROFESSIONAL: 0.1, // 10% for individual professionals
  EWT_INDIVIDUAL_RENTAL: 0.05, // 5% for individual rental
  EWT_CORPORATION_SERVICES: 0.02, // 2% for corporate services
  EWT_CORPORATION_RENTAL: 0.05, // 5% for corporate rental
  PERCENTAGE_TAX: 0.03, // 3% for non-VAT registered
} as const;

// ============================================================================
// EXPENSE CATEGORIES
// ============================================================================

export enum ExpenseCategory {
  // Utilities
  UTILITIES_ELECTRICITY = "UTIL_ELEC",
  UTILITIES_WATER = "UTIL_WATER",
  UTILITIES_INTERNET = "UTIL_NET",
  UTILITIES_GAS = "UTIL_GAS",
  UTILITIES_TELEPHONE = "UTIL_TEL",

  // Supplies
  SUPPLIES_HOUSEKEEPING = "SUPP_HOUSE",
  SUPPLIES_KITCHEN = "SUPP_KITCHEN",
  SUPPLIES_OFFICE = "SUPP_OFFICE",
  SUPPLIES_POOL = "SUPP_POOL",
  SUPPLIES_TOILETRIES = "SUPP_TOILET",
  SUPPLIES_LINENS = "SUPP_LINENS",

  // Maintenance
  MAINTENANCE_REPAIRS = "MAINT_REPAIR",
  MAINTENANCE_PREVENTIVE = "MAINT_PREV",
  MAINTENANCE_EQUIPMENT = "MAINT_EQUIP",
  MAINTENANCE_LANDSCAPING = "MAINT_LAND",
  MAINTENANCE_POOL = "MAINT_POOL",
  MAINTENANCE_BUILDING = "MAINT_BUILD",

  // Marketing
  MARKETING_ONLINE_ADS = "MARK_ADS",
  MARKETING_COMMISSIONS = "MARK_COMM",
  MARKETING_PROMOTIONS = "MARK_PROMO",
  MARKETING_PLATFORM_FEES = "MARK_PLATFORM",
  MARKETING_PRINTED = "MARK_PRINT",

  // Payroll
  PAYROLL_SALARIES = "PAY_SALARY",
  PAYROLL_WAGES = "PAY_WAGES",
  PAYROLL_BENEFITS = "PAY_BENEFITS",
  PAYROLL_SSS = "PAY_SSS",
  PAYROLL_PHILHEALTH = "PAY_PHIL",
  PAYROLL_PAGIBIG = "PAY_PAGIBIG",
  PAYROLL_13THMONTH = "PAY_13TH",

  // Professional Fees
  PROFESSIONAL_ACCOUNTING = "PROF_ACCT",
  PROFESSIONAL_LEGAL = "PROF_LEGAL",
  PROFESSIONAL_CONSULTING = "PROF_CONSULT",
  PROFESSIONAL_ARCHITECT = "PROF_ARCH",
  PROFESSIONAL_ENGINEERING = "PROF_ENG",

  // Permits and Licenses
  PERMITS_BUSINESS = "PERM_BUS",
  PERMITS_TOURISM = "PERM_TOUR",
  PERMITS_HEALTH = "PERM_HEALTH",
  PERMITS_FIRE = "PERM_FIRE",
  PERMITS_ENVIRONMENTAL = "PERM_ENV",
  PERMITS_BARANGAY = "PERM_BRGY",

  // Insurance
  INSURANCE_PROPERTY = "INS_PROP",
  INSURANCE_LIABILITY = "INS_LIAB",
  INSURANCE_VEHICLE = "INS_VEH",
  INSURANCE_EMPLOYEE = "INS_EMP",
  INSURANCE_BUSINESS = "INS_BUS",

  // Equipment
  EQUIPMENT_PURCHASE = "EQUIP_PURCH",
  EQUIPMENT_RENTAL = "EQUIP_RENT",
  EQUIPMENT_SOFTWARE = "EQUIP_SOFT",
  EQUIPMENT_FURNITURE = "EQUIP_FURN",

  // Food and Beverage
  FB_INGREDIENTS = "FB_INGRED",
  FB_BEVERAGES = "FB_BEV",
  FB_PACKAGING = "FB_PACK",
  FB_COMPLIMENTARY = "FB_COMP",

  // Financial
  FINANCIAL_BANK_CHARGES = "FIN_BANK",
  FINANCIAL_INTEREST = "FIN_INT",
  FINANCIAL_CREDIT_CARD_FEES = "FIN_CC",

  // Other
  OTHER_MISCELLANEOUS = "OTHER_MISC",
  OTHER_DONATIONS = "OTHER_DONATE",
  OTHER_PENALTIES = "OTHER_PENALTY",
}

// ============================================================================
// EXPENSE TYPES
// ============================================================================

export interface Expense {
  id: string;
  projectId: string;
  transactionDate: Date;
  category: ExpenseCategory;
  amount: Decimal;
  description: string;
  vendorId?: string;

  // Tax Information
  isVatable: boolean;
  vatAmount?: Decimal;
  netAmount?: Decimal;
  ewtAmount?: Decimal;
  ewtRate?: number;

  // Documentation
  receiptNumber?: string;
  receiptImage?: string;
  invoiceNumber?: string;
  invoiceImage?: string;

  // Approval
  status: ExpenseStatus;
  approvalLevel: ApprovalLevel;
  approvedBy?: string;
  approvedDate?: Date;
  rejectionReason?: string;

  // Payment
  paymentMethod?: PaymentMethod;
  paymentReference?: string;
  paymentDate?: Date;

  // Audit
  createdBy: string;
  createdAt: Date;
  updatedBy?: string;
  updatedAt?: Date;
  deletedAt?: Date;
}

export enum ExpenseStatus {
  DRAFT = "DRAFT",
  PENDING_APPROVAL = "PENDING_APPROVAL",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  PAID = "PAID",
  CANCELLED = "CANCELLED",
  RECONCILED = "RECONCILED",
}

export enum ApprovalLevel {
  AUTO = "AUTO",
  MANAGER = "MANAGER",
  OWNER = "OWNER",
  DUAL = "DUAL",
}

export enum PaymentMethod {
  CASH = "CASH",
  BANK_TRANSFER = "BANK_TRANSFER",
  CHECK = "CHECK",
  GCASH = "GCASH",
  CREDIT_CARD = "CREDIT_CARD",
  PETTY_CASH = "PETTY_CASH",
}

// ============================================================================
// VENDOR TYPES
// ============================================================================

export interface Vendor {
  id: string;
  projectId: string;

  // Basic Information
  vendorName: string;
  tin: string;
  businessAddress: string;
  contactPerson: string;
  contactNumber: string;
  email?: string;

  // Tax Information
  vendorType: VendorType;
  vatRegistered: boolean;
  vatNumber?: string;
  withholdingTaxApplicable: boolean;
  withholdingTaxRate?: number;

  // Banking
  bankName?: string;
  accountName?: string;
  accountNumber?: string;

  // Documentation
  birForm2307Required: boolean;
  requiresOR: boolean;
  paymentTerms: number;

  // Categories
  serviceCategories: ExpenseCategory[];

  // Compliance
  permitNumber?: string;
  permitExpiry?: Date;
  insuranceCoverage?: boolean;
  insuranceExpiry?: Date;

  // Status
  isActive: boolean;
  blacklisted: boolean;
  blacklistReason?: string;

  // Audit
  createdBy: string;
  createdAt: Date;
  updatedBy?: string;
  updatedAt?: Date;
}

export enum VendorType {
  INDIVIDUAL = "individual",
  CORPORATION = "corporation",
  GOVERNMENT = "government",
}

// ============================================================================
// PETTY CASH TYPES
// ============================================================================

export interface PettyCashFund {
  id: string;
  projectId: string;
  fundName: string;
  fundLimit: Decimal;
  currentBalance: Decimal;
  custodian: string;
  alternateCustodian?: string;
  location: string;
  lastReplenishmentDate?: Date;
  lastReconciliationDate?: Date;
  isActive: boolean;
}

export interface PettyCashTransaction {
  id: string;
  fundId: string;
  transactionDate: Date;
  amount: Decimal;
  category: ExpenseCategory;
  description: string;
  requestedBy: string;
  approvedBy?: string;

  // Documentation
  receiptNumber?: string;
  receiptImage?: string;
  vendorName?: string;

  // Fund tracking
  fundBalanceBefore: Decimal;
  fundBalanceAfter: Decimal;

  // Reconciliation
  reconciledDate?: Date;
  reconciledBy?: string;
  discrepancy?: Decimal;
}

export interface PettyCashReplenishment {
  id: string;
  fundId: string;
  replenishmentDate: Date;
  amount: Decimal;
  fromAccount: string;
  checkNumber?: string;

  // Supporting documents
  transactionIds: string[];
  totalExpenses: Decimal;
  cashOnHand: Decimal;

  // Approval
  preparedBy: string;
  approvedBy: string;
  receivedBy: string;

  // Status
  status: ReplenishmentStatus;
}

export enum ReplenishmentStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  DISBURSED = "DISBURSED",
  RECEIVED = "RECEIVED",
  CANCELLED = "CANCELLED",
}

// ============================================================================
// RECEIPT TYPES
// ============================================================================

export interface Receipt {
  id: string;
  projectId: string;
  receiptNumber: string; // Format: YYYY-SSSS-NNNNNNNN
  receiptDate: Date;

  // Transaction Details
  transactionType: "expense" | "revenue";
  transactionId: string;
  amount: Decimal;

  // Customer/Vendor Information
  payorName?: string;
  payorTin?: string;
  payorAddress?: string;

  // Tax Breakdown
  vatableSales?: Decimal;
  vatExemptSales?: Decimal;
  zeroRatedSales?: Decimal;
  vatAmount?: Decimal;
  totalAmount: Decimal;

  // Payment
  paymentMethod: PaymentMethod;
  paymentReference?: string;

  // Compliance
  birPermitNumber: string;
  machineNumber?: string;
  isOfficial: boolean;
  isCancelled: boolean;
  cancellationReason?: string;

  // Audit
  issuedBy: string;
  issuedAt: Date;
  printedAt?: Date;
  emailedTo?: string;
}

// ============================================================================
// APPROVAL TYPES
// ============================================================================

export interface ApprovalMatrix {
  category: ExpenseCategory;
  vendorType: VendorType;
  amount: Decimal;
  urgency: "routine" | "urgent" | "emergency";
  requiredApprovers: string[];
  approvalDeadline: Date;
  escalationPath: string[];
}

export interface ApprovalHistory {
  id: string;
  expenseId: string;
  status: ApprovalStatus;
  approver: string;
  timestamp: Date;
  comments?: string;
  amountApproved?: Decimal;
  conditions?: string[];
}

export enum ApprovalStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  ESCALATED = "ESCALATED",
  EXPIRED = "EXPIRED",
}

// ============================================================================
// AUDIT TYPES
// ============================================================================

export interface AuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  action: AuditAction;
  resourceType: "expense" | "vendor" | "payment" | "approval" | "receipt";
  resourceId: string;

  // Change tracking
  previousValue?: any;
  newValue?: any;
  changeReason?: string;

  // Context
  ipAddress: string;
  userAgent: string;
  sessionId: string;

  // Compliance
  requiresReview: boolean;
  reviewedBy?: string;
  reviewedDate?: Date;
}

export enum AuditAction {
  CREATE = "CREATE",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
  APPROVE = "APPROVE",
  REJECT = "REJECT",
  CANCEL = "CANCEL",
  RECONCILE = "RECONCILE",
  EXPORT = "EXPORT",
  PRINT = "PRINT",
  EMAIL = "EMAIL",
}

// ============================================================================
// REPORTING TYPES
// ============================================================================

export interface ExpenseReport {
  reportId: string;
  projectId: string;
  reportType: "daily" | "weekly" | "monthly" | "quarterly" | "annual";
  periodStart: Date;
  periodEnd: Date;

  // Summary
  totalExpenses: Decimal;
  expensesByCategory: Map<ExpenseCategory, Decimal>;
  expensesByVendor: Map<string, Decimal>;
  expensesByStatus: Map<ExpenseStatus, Decimal>;

  // Tax Summary
  totalVat: Decimal;
  totalEwt: Decimal;

  // Comparisons
  previousPeriodTotal?: Decimal;
  percentageChange?: number;
  budgetVariance?: Decimal;

  // Details
  expenses: Expense[];

  // Metadata
  generatedAt: Date;
  generatedBy: string;
}

export interface VendorReport {
  reportId: string;
  vendorId: string;
  periodStart: Date;
  periodEnd: Date;

  // Transaction Summary
  totalTransactions: number;
  totalAmount: Decimal;
  averageTransactionAmount: Decimal;

  // Performance
  onTimeDeliveryRate: number;
  qualityRating: number;
  documentComplianceRate: number;

  // Aging
  currentBalance: Decimal;
  days30: Decimal;
  days60: Decimal;
  days90: Decimal;
  over90: Decimal;

  // Tax
  totalEwtWithheld: Decimal;
  form2307Issued: number;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface FinancialConfig {
  projectId: string;

  // Company Information
  companyName: string;
  tin: string;
  businessAddress: string;
  birRdoCode: string;

  // Tax Settings
  isVatRegistered: boolean;
  vatNumber?: string;
  percentageTaxApplicable: boolean;

  // Receipt Settings
  receiptSeriesPrefix: string;
  currentReceiptNumber: number;
  birPermitNumber: string;
  machineNumber?: string;

  // Approval Settings
  approvalThresholds: {
    autoApprove: number;
    managerApproval: number;
    ownerApproval: number;
    dualApproval: number;
  };

  // Petty Cash Settings
  pettyCashSettings: {
    fundLimit: number;
    disbursementLimit: number;
    replenishmentThreshold: number;
    requireReceipt: boolean;
    approvalRequiredAbove: number;
  };

  // Document Retention
  retentionPeriodYears: number;

  // Notifications
  notifyOnApprovalRequired: boolean;
  notifyOnPaymentDue: boolean;
  notifyOnLowPettyCash: boolean;
}

// ============================================================================
// HELPER TYPES
// ============================================================================

export type DecimalInput = string | number | Decimal;

export interface DateRange {
  start: Date;
  end: Date;
}

export interface Money {
  amount: Decimal;
  currency: "PHP" | "USD";
}

export interface TaxBreakdown {
  grossAmount: Decimal;
  netAmount: Decimal;
  vatAmount?: Decimal;
  ewtAmount?: Decimal;
  totalTax: Decimal;
  netPayable: Decimal;
}
