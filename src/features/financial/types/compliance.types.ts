/**
 * Financial Compliance Type Definitions
 *
 * Handles Philippine regulatory compliance including BIR requirements,
 * senior/PWD discounts, VAT/tax calculations, and audit trails.
 */

import { Decimal } from "decimal.js";

/**
 * BIR document types
 */
export enum BIRDocumentType {
  OFFICIAL_RECEIPT = "OFFICIAL_RECEIPT", // OR
  SALES_INVOICE = "SALES_INVOICE", // SI
  BILLING_STATEMENT = "BILLING_STATEMENT", // BS
  COLLECTION_RECEIPT = "COLLECTION_RECEIPT", // CR
  ACKNOWLEDGEMENT_RECEIPT = "ACKNOWLEDGEMENT_RECEIPT", // AR
  PROVISIONAL_RECEIPT = "PROVISIONAL_RECEIPT", // PR
  DELIVERY_RECEIPT = "DELIVERY_RECEIPT", // DR
}

/**
 * Tax types in the Philippines
 */
export enum TaxType {
  VAT = "VAT", // 12% Value Added Tax
  PERCENTAGE_TAX = "PERCENTAGE_TAX", // 3% for non-VAT registered
  WITHHOLDING_TAX = "WITHHOLDING_TAX", // Various rates
  INCOME_TAX = "INCOME_TAX", // Corporate income tax
  LOCAL_TAX = "LOCAL_TAX", // LGU taxes
  TOURIST_TAX = "TOURIST_TAX", // Municipality tourist tax
  DOCUMENTARY_STAMP = "DOCUMENTARY_STAMP", // DST
}

/**
 * Discount types as per Philippine law
 */
export enum DiscountType {
  SENIOR_CITIZEN = "SENIOR_CITIZEN", // RA 9994 - 20% discount
  PWD = "PWD", // RA 10754 - 20% discount
  GOVERNMENT = "GOVERNMENT", // Government employee discount
  CORPORATE = "CORPORATE", // Corporate negotiated rates
  PROMOTIONAL = "PROMOTIONAL", // Marketing promotions
  VOLUME = "VOLUME", // Volume-based discounts
  LOYALTY = "LOYALTY", // Loyalty program discounts
  EARLY_BIRD = "EARLY_BIRD", // Advance booking discounts
  LAST_MINUTE = "LAST_MINUTE", // Last-minute booking discounts
}

/**
 * Compliance status levels
 */
export enum ComplianceStatus {
  COMPLIANT = "COMPLIANT",
  NON_COMPLIANT = "NON_COMPLIANT",
  PENDING_REVIEW = "PENDING_REVIEW",
  REQUIRES_ACTION = "REQUIRES_ACTION",
  EXEMPTED = "EXEMPTED",
}

/**
 * Audit event types
 */
export enum AuditEventType {
  CREATE = "CREATE",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
  VIEW = "VIEW",
  EXPORT = "EXPORT",
  PRINT = "PRINT",
  VOID = "VOID",
  CANCEL = "CANCEL",
  APPROVE = "APPROVE",
  REJECT = "REJECT",
  RECONCILE = "RECONCILE",
}

/**
 * Financial reporting period types
 */
export enum ReportingPeriod {
  DAILY = "DAILY",
  WEEKLY = "WEEKLY",
  MONTHLY = "MONTHLY",
  QUARTERLY = "QUARTERLY",
  ANNUAL = "ANNUAL",
  CUSTOM = "CUSTOM",
}

/**
 * BIR compliance configuration
 */
export interface BIRComplianceConfig {
  tin: string; // Tax Identification Number
  registeredName: string;
  tradeName?: string;
  rdoCode: string; // Revenue District Office code
  registrationType: "VAT" | "NON_VAT" | "PERCENTAGE";
  vatRate: Decimal; // 0.12 for VAT registered
  percentageTaxRate?: Decimal; // 0.03 for non-VAT
  permitNumber: string; // BIR Permit to Use number
  machineIdentificationNumber: string; // MIN for POS
  serialNumberStart: number; // Starting OR/SI number
  serialNumberEnd: number; // Ending OR/SI number
  dateIssued: Date; // Permit issue date
  dateExpiry: Date; // Permit expiry date
  accreditationNumber?: string; // For accredited printers
  isEInvoicingEnabled: boolean;
}

/**
 * Official Receipt (OR) structure per BIR requirements
 */
export interface OfficialReceipt {
  receiptNumber: string; // Sequential number with prefix
  machineId: string; // Machine Identification Number
  tin: string; // Business TIN
  businessName: string;
  businessAddress: string;
  transactionDate: Date;
  customerName?: string;
  customerTin?: string;
  customerAddress?: string;
  customerBusinessStyle?: string;
  items: ReceiptItem[];
  subtotal: Decimal; // Amount before tax
  totalDiscounts: Decimal;
  vatableSales: Decimal;
  vatExemptSales: Decimal;
  zeroRatedSales: Decimal;
  vatAmount: Decimal;
  totalAmount: Decimal; // Final amount
  paymentMethod: string;
  cashierName: string;
  cashierId: string;
  remarks?: string;
  isCancelled: boolean;
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: Date;
  printedAt: Date;
  reprintCount: number;
  signature?: string; // Digital signature if e-invoicing
}

/**
 * Receipt line item
 */
export interface ReceiptItem {
  itemCode: string;
  description: string;
  quantity: number;
  unitPrice: Decimal;
  discount?: Decimal;
  discountType?: DiscountType;
  taxType: TaxType;
  taxRate: Decimal;
  taxAmount: Decimal;
  netAmount: Decimal;
  totalAmount: Decimal;
}

/**
 * Senior Citizen/PWD discount structure (RA 9994 & RA 10754)
 */
export interface SeniorPWDDiscount {
  discountType: DiscountType.SENIOR_CITIZEN | DiscountType.PWD;
  idNumber: string; // Senior Citizen or PWD ID number
  fullName: string;
  birthDate?: Date; // For senior citizen verification
  discountRate: Decimal; // 0.20 (20% discount)
  vatExemption: boolean; // true - exempt from 12% VAT
  applicableCategories: string[]; // Categories eligible for discount
  restrictions?: string[]; // Any restrictions or limits
  validFrom: Date;
  validTo?: Date;
  verifiedBy: string; // Staff who verified the ID
  verifiedAt: Date;
  attachments?: DiscountAttachment[]; // Scanned IDs or documents
}

/**
 * Discount verification attachment
 */
export interface DiscountAttachment {
  attachmentId: string;
  fileName: string;
  fileType: "ID_CARD" | "CERTIFICATE" | "PRESCRIPTION" | "OTHER";
  fileUrl: string;
  uploadedAt: Date;
  uploadedBy: string;
}

/**
 * VAT calculation details
 */
export interface VATCalculation {
  transactionId: string;
  transactionDate: Date;
  vatableAmount: Decimal; // Amount subject to VAT
  vatRate: Decimal; // 0.12 (12%)
  vatAmount: Decimal; // Calculated VAT
  vatExemptAmount?: Decimal; // Senior/PWD exempt amount
  zeroRatedAmount?: Decimal; // Export or special economic zone
  totalAmount: Decimal; // Total including VAT
  isInclusive: boolean; // VAT-inclusive pricing
  exemptionReason?: string;
  zeroRatingReason?: string;
  supportingDocuments?: string[];
}

/**
 * Withholding tax record
 */
export interface WithholdingTax {
  transactionId: string;
  payeeType: "INDIVIDUAL" | "CORPORATION";
  payeeTin: string;
  payeeName: string;
  incomeType: string; // Type of income payment
  atcCode: string; // ATC (Alphanumeric Tax Code)
  taxRate: Decimal; // Withholding tax rate
  taxBase: Decimal; // Amount subject to withholding
  taxAmount: Decimal; // Withheld amount
  paymentDate: Date;
  remittanceDate?: Date; // Date remitted to BIR
  remittanceReference?: string; // BIR payment reference
  form2307Number?: string; // Certificate of Creditable Tax Withheld
  issuedDate?: Date;
}

/**
 * Tourist tax collection
 */
export interface TouristTax {
  municipalityCode: string;
  municipalityName: string;
  taxRate: Decimal; // Rate per room night
  taxAmount: Decimal; // Calculated tax
  roomNights: number;
  guestCount: number;
  nationality?: string;
  exempted: boolean;
  exemptionReason?: string;
  collectionDate: Date;
  remittanceDate?: Date;
  remittanceReference?: string;
  orNumber: string; // Official receipt number
}

/**
 * Data privacy compliance record (RA 10173)
 */
export interface DataPrivacyCompliance {
  dataSubjectId: string;
  dataSubjectType: "GUEST" | "EMPLOYEE" | "SUPPLIER" | "PARTNER";
  consentDate: Date;
  consentMethod: "WRITTEN" | "ELECTRONIC" | "VERBAL";
  purposesConsented: string[];
  dataCategories: string[];
  retentionPeriod: number; // Days
  optInMarketing: boolean;
  optInThirdPartySharing: boolean;
  privacyNoticeVersion: string;
  privacyNoticeAcknowledged: boolean;
  dataBreachNotified?: boolean;
  dataBreachDate?: Date;
  lastUpdated: Date;
  updatedBy: string;
}

/**
 * Anti-Money Laundering (AML) compliance
 */
export interface AMLCompliance {
  transactionId: string;
  transactionAmount: Decimal;
  transactionDate: Date;
  customerName: string;
  customerIdType: string;
  customerIdNumber: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  flagged: boolean;
  flagReason?: string;
  reportedToAMLC: boolean; // Anti-Money Laundering Council
  amlcReferenceNumber?: string;
  investigationStatus?: "PENDING" | "CLEARED" | "ESCALATED";
  investigationNotes?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
}

/**
 * Know Your Customer (KYC) record
 */
export interface KYCRecord {
  customerId: string;
  verificationType: "BASIC" | "ENHANCED" | "SIMPLIFIED";
  identityVerified: boolean;
  addressVerified: boolean;
  documentsProvided: string[];
  verificationDate: Date;
  verifiedBy: string;
  riskScore?: number;
  politicallyExposed: boolean;
  sanctionsScreened: boolean;
  sanctionsHit: boolean;
  nextReviewDate: Date;
  notes?: string;
}

/**
 * Audit trail record
 */
export interface AuditTrail {
  auditId: string;
  timestamp: Date;
  userId: string;
  userName: string;
  userRole: string;
  ipAddress: string;
  userAgent?: string;
  eventType: AuditEventType;
  entityType: string; // Table or resource type
  entityId: string; // Record ID
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  changes?: AuditChange[];
  metadata?: Record<string, any>;
  sessionId?: string;
  correlationId?: string; // For tracking related events
}

/**
 * Individual audit change
 */
export interface AuditChange {
  fieldName: string;
  oldValue: any;
  newValue: any;
  changeType: "ADD" | "UPDATE" | "DELETE";
}

/**
 * Financial reporting requirement
 */
export interface FinancialReportingRequirement {
  reportType: string;
  reportCode: string; // BIR form number or report code
  frequency: ReportingPeriod;
  dueDay: number; // Day of month/quarter when due
  filingDeadline?: Date;
  penalties?: Decimal; // Late filing penalties
  requiresAuditorCertification: boolean;
  requiresNotarization: boolean;
  electronicFiling: boolean;
  attachmentRequirements?: string[];
  complianceStatus: ComplianceStatus;
  lastFiledDate?: Date;
  nextDueDate: Date;
}

/**
 * BIR form submission record
 */
export interface BIRFormSubmission {
  submissionId: string;
  formType: string; // e.g., '2550M', '1601C', '0605'
  formDescription: string;
  taxPeriod: Date;
  filingDate: Date;
  dueDate: Date;
  referenceNumber: string; // BIR reference number
  amountDeclared: Decimal;
  taxDue: Decimal;
  taxPaid: Decimal;
  penalties?: Decimal;
  interest?: Decimal;
  paymentDate?: Date;
  paymentReference?: string;
  bankCode?: string;
  status: "DRAFT" | "FILED" | "PAID" | "AMENDED" | "CANCELLED";
  amendmentReason?: string;
  attachments?: string[];
  preparedBy: string;
  reviewedBy?: string;
  approvedBy?: string;
}

/**
 * Compliance checklist item
 */
export interface ComplianceChecklistItem {
  itemId: string;
  category: string;
  requirement: string;
  description?: string;
  frequency: ReportingPeriod;
  dueDate?: Date;
  responsible: string;
  status: ComplianceStatus;
  completedDate?: Date;
  evidenceRequired: boolean;
  evidenceProvided?: string[];
  notes?: string;
  lastReviewDate?: Date;
  nextReviewDate?: Date;
}

/**
 * Regulatory compliance summary
 */
export interface ComplianceSummary {
  periodStart: Date;
  periodEnd: Date;
  businessTin: string;
  businessName: string;
  complianceScore: number; // 0-100
  birCompliance: {
    status: ComplianceStatus;
    filedReports: number;
    pendingReports: number;
    overdueReports: number;
    totalTaxPaid: Decimal;
    outstandingLiabilities?: Decimal;
  };
  dataPrivacyCompliance: {
    status: ComplianceStatus;
    consentRecords: number;
    dataBreaches: number;
    subjectRequests: number;
  };
  amlCompliance: {
    status: ComplianceStatus;
    flaggedTransactions: number;
    reportedTransactions: number;
    pendingInvestigations: number;
  };
  auditReadiness: {
    auditTrailCompleteness: number; // Percentage
    documentationStatus: ComplianceStatus;
    lastAuditDate?: Date;
    nextAuditDate?: Date;
  };
  issues: ComplianceIssue[];
  recommendations: string[];
}

/**
 * Compliance issue or violation
 */
export interface ComplianceIssue {
  issueId: string;
  category: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description: string;
  identifiedDate: Date;
  dueDate?: Date;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "ESCALATED";
  assignedTo?: string;
  resolution?: string;
  resolvedDate?: Date;
  potentialPenalty?: Decimal;
  actualPenalty?: Decimal;
}
