/**
 * Compliance Monitoring Types - Export Index
 *
 * Centralized exports for all compliance monitoring type definitions
 */

export * from "./compliance-monitoring.types";

// Specific exports for common use
export type {
  ReceiptSequence,
  SequenceIntegrityResult,
  ReceiptRecord,
} from "./compliance-monitoring.types";

// Re-export commonly used types from financial compliance
export type {
  ComplianceStatus,
  ComplianceIssue,
  AuditEventType,
  BIRDocumentType,
  TaxType,
  DiscountType,
  ReportingPeriod,
  BIRComplianceConfig,
  OfficialReceipt,
  ReceiptItem,
  VATCalculation,
  WithholdingTax,
  TouristTax,
  AuditTrail,
  FinancialReportingRequirement,
  BIRFormSubmission,
  ComplianceChecklistItem,
  ComplianceSummary,
} from "../../features/financial/types/compliance.types";
