/**
 * Compliance Monitoring Type Definitions
 *
 * Comprehensive types for Philippine business compliance monitoring,
 * deadline tracking, and automated alert systems.
 */

import { Decimal } from "decimal.js";

/**
 * Alert severity levels for compliance issues
 */
export enum ComplianceAlertSeverity {
  CRITICAL = "CRITICAL", // Immediate Action: Deadline missed, sequence gap
  HIGH = "HIGH", // Same Day: 2-day warning, missing approvals
  MEDIUM = "MEDIUM", // 48 Hours: 5-day warning, document issues
  LOW = "LOW", // Next Review: 30-day expiry, minor discrepancies
}

/**
 * Compliance monitoring categories
 */
export enum ComplianceCategory {
  TAX_FILING = "TAX_FILING",
  PERMIT_RENEWAL = "PERMIT_RENEWAL",
  DOCUMENT_INTEGRITY = "DOCUMENT_INTEGRITY",
  SEQUENCE_COMPLIANCE = "SEQUENCE_COMPLIANCE",
  AUDIT_READINESS = "AUDIT_READINESS",
  DATA_PRIVACY = "DATA_PRIVACY",
  SAFETY_COMPLIANCE = "SAFETY_COMPLIANCE",
}

/**
 * Philippine tax filing types
 */
export enum TaxFilingType {
  VAT_MONTHLY = "VAT_MONTHLY", // Form 2550M - Monthly VAT
  VAT_QUARTERLY = "VAT_QUARTERLY", // Form 2550Q - Quarterly VAT
  WITHHOLDING_MONTHLY = "WITHHOLDING_MONTHLY", // Form 1601C - Monthly Withholding
  WITHHOLDING_QUARTERLY = "WITHHOLDING_QUARTERLY", // Form 1601EQ - Quarterly Withholding
  ANNUAL_ITR = "ANNUAL_ITR", // Form 1700/1701 - Annual Income Tax
  PERCENTAGE_TAX = "PERCENTAGE_TAX", // Form 2551M - Percentage Tax
  EXPANDED_WITHHOLDING = "EXPANDED_WITHHOLDING", // Form 1601E - Expanded Withholding
}

/**
 * Philippine business permit types
 */
export enum PermitType {
  MAYORS_PERMIT = "MAYORS_PERMIT",
  BUSINESS_PERMIT = "BUSINESS_PERMIT",
  FIRE_SAFETY_CERTIFICATE = "FIRE_SAFETY_CERTIFICATE",
  HEALTH_CERTIFICATE = "HEALTH_CERTIFICATE",
  DOT_ACCREDITATION = "DOT_ACCREDITATION",
  LOCAL_TOURISM_REGISTRATION = "LOCAL_TOURISM_REGISTRATION",
  ENVIRONMENTAL_COMPLIANCE = "ENVIRONMENTAL_COMPLIANCE",
  OCCUPANCY_PERMIT = "OCCUPANCY_PERMIT",
  BIR_PERMIT_TO_USE = "BIR_PERMIT_TO_USE",
  SANITARY_PERMIT = "SANITARY_PERMIT",
}

/**
 * Compliance alert status
 */
export enum ComplianceAlertStatus {
  ACTIVE = "ACTIVE",
  ACKNOWLEDGED = "ACKNOWLEDGED",
  IN_PROGRESS = "IN_PROGRESS",
  RESOLVED = "RESOLVED",
  DISMISSED = "DISMISSED",
  ESCALATED = "ESCALATED",
}

/**
 * Document compliance status
 */
export enum DocumentComplianceStatus {
  COMPLIANT = "COMPLIANT",
  MISSING = "MISSING",
  EXPIRED = "EXPIRED",
  INVALID = "INVALID",
  PENDING_APPROVAL = "PENDING_APPROVAL",
  REQUIRES_UPDATE = "REQUIRES_UPDATE",
}

/**
 * Receipt sequence integrity issues
 */
export enum SequenceIssueType {
  GAP = "GAP", // Missing numbers in sequence
  DUPLICATE = "DUPLICATE", // Duplicate receipt numbers
  OUT_OF_ORDER = "OUT_OF_ORDER", // Numbers used out of sequence
  EXCEEDS_LIMIT = "EXCEEDS_LIMIT", // Beyond permitted range
  VOID_IMPROPER = "VOID_IMPROPER", // Voided receipts without proper documentation
}

/**
 * Compliance deadline alert
 */
export interface ComplianceDeadlineAlert {
  alertId: string;
  category: ComplianceCategory;
  severity: ComplianceAlertSeverity;
  title: string;
  description: string;
  deadlineDate: Date;
  daysUntilDeadline: number;
  filingType?: TaxFilingType;
  permitType?: PermitType;
  affectedEntity: string;
  actionRequired: string[];
  estimatedTimeToComplete: number; // minutes
  potentialPenalty?: Decimal;
  status: ComplianceAlertStatus;
  assignedTo?: string;
  createdAt: Date;
  updatedAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  metadata?: Record<string, any>;
}

/**
 * Receipt sequence for BIR compliance
 */
export interface ReceiptSequence {
  projectId: string;
  sequenceType: "OR" | "SI"; // Official Receipt or Sales Invoice
  startNumber: number;
  endNumber: number;
  prefix: string;
  currentNumber: number;
  isActive: boolean;
  approvedBy: string;
  approvalDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Individual receipt record for sequence checking
 */
export interface ReceiptRecord {
  sequenceNumber: number;
  issuedDate: Date;
  isVoided: boolean;
  projectId: string;
}

/**
 * Receipt sequence integrity result
 */
export interface SequenceIntegrityResult {
  documentType?: "OR" | "SI"; // Official Receipt or Sales Invoice
  sequenceRange?: {
    start: number;
    end: number;
    current: number;
  };
  totalIssued?: number;
  totalVoided?: number;
  gaps?: SequenceGap[];
  duplicates?: SequenceDuplicate[];
  outOfOrderIssues?: OutOfOrderIssue[];
  voidingIssues?: VoidingIssue[];
  complianceScore?: number; // 0-100
  lastChecked?: Date;
  nextSequenceNumber?: number;
  // Essential fields for BIR compliance test
  hasGaps: boolean;
  hasDuplicates: boolean;
  isValid: boolean;
}

/**
 * Sequence gap details
 */
export interface SequenceGap {
  gapStart: number;
  gapEnd: number;
  gapSize: number;
  dateIdentified: Date;
  possibleCause?: string;
  investigationStatus: "OPEN" | "INVESTIGATING" | "RESOLVED" | "ESCALATED";
  notes?: string;
}

/**
 * Duplicate sequence number
 */
export interface SequenceDuplicate {
  sequenceNumber: number;
  occurrences: DuplicateOccurrence[];
  dateIdentified: Date;
  resolutionAction?: string;
  resolved: boolean;
}

/**
 * Duplicate occurrence details
 */
export interface DuplicateOccurrence {
  transactionId: string;
  issueDate: Date;
  issuedBy: string;
  amount: Decimal;
  customer?: string;
  status: "ACTIVE" | "VOIDED" | "CANCELLED";
}

/**
 * Out of order issue
 */
export interface OutOfOrderIssue {
  sequenceNumber: number;
  expectedOrder: number;
  actualOrder: number;
  dateIssued: Date;
  issuedBy: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  correctionRequired: boolean;
}

/**
 * Voiding issue details
 */
export interface VoidingIssue {
  receiptNumber: string;
  voidDate: Date;
  voidReason?: string;
  voidedBy: string;
  supervisorApproval: boolean;
  properDocumentation: boolean;
  issueType: "MISSING_REASON" | "MISSING_APPROVAL" | "IMPROPER_PROCEDURE";
}

/**
 * Philippine tax filing deadline configuration
 */
export interface TaxFilingDeadline {
  filingType: TaxFilingType;
  formNumber: string;
  description: string;
  frequency: "MONTHLY" | "QUARTERLY" | "ANNUALLY";
  dueDayOfMonth: number; // e.g., 20 for monthly VAT
  dueDayOfQuarter?: number; // e.g., 15 for quarterly withholding
  gracePeriod?: number; // days
  penaltyRate?: Decimal;
  nextDueDate: Date;
  reminderDays: number[]; // Days before deadline to send reminders
  isEnabled: boolean;
  applicableBusinessTypes: string[];
}

/**
 * Permit expiry tracking
 */
export interface PermitExpiryTracker {
  permitId: string;
  permitType: PermitType;
  permitNumber: string;
  issuingAuthority: string;
  issueDate: Date;
  expiryDate: Date;
  renewalRequiredBy: Date;
  renewalProcess: string[];
  estimatedRenewalTime: number; // days
  renewalCost?: Decimal;
  documentsRequired: string[];
  status: "ACTIVE" | "EXPIRING" | "EXPIRED" | "RENEWAL_IN_PROGRESS";
  remindersSent: Date[];
  lastRenewalDate?: Date;
  notes?: string;
}

/**
 * Document compliance check result
 */
export interface DocumentComplianceCheck {
  checkId: string;
  documentType: string;
  documentId: string;
  status: DocumentComplianceStatus;
  requiredDocuments: RequiredDocument[];
  missingDocuments: string[];
  expiredDocuments: ExpiredDocument[];
  pendingApprovals: PendingApproval[];
  complianceScore: number; // 0-100
  lastChecked: Date;
  nextCheckDate: Date;
  issues: DocumentIssue[];
  recommendations: string[];
}

/**
 * Required document definition
 */
export interface RequiredDocument {
  documentName: string;
  documentType: string;
  required: boolean;
  frequency?: "ONCE" | "ANNUAL" | "MONTHLY" | "AS_NEEDED";
  expiryMonths?: number;
  issuingAuthority?: string;
  template?: string;
}

/**
 * Expired document details
 */
export interface ExpiredDocument {
  documentName: string;
  documentId: string;
  expiryDate: Date;
  daysExpired: number;
  renewalRequired: boolean;
  renewalProcess?: string[];
  urgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

/**
 * Pending approval tracking
 */
export interface PendingApproval {
  approvalId: string;
  documentType: string;
  submittedDate: Date;
  expectedDecisionDate?: Date;
  approvingAuthority: string;
  status: "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "ADDITIONAL_REQUIREMENTS";
  followUpDate?: Date;
  contactPerson?: string;
  referenceNumber?: string;
}

/**
 * Document compliance issue
 */
export interface DocumentIssue {
  issueType: "MISSING" | "EXPIRED" | "INVALID" | "INCOMPLETE";
  severity: ComplianceAlertSeverity;
  description: string;
  documentName: string;
  dueDate?: Date;
  potentialImpact: string;
  resolutionSteps: string[];
  estimatedResolutionTime: number; // hours
}

/**
 * Comprehensive compliance check result
 */
export interface ComplianceCheckResult {
  checkId: string;
  projectId: string;
  checkDate: Date;
  overallScore: number; // 0-100
  categories: ComplianceCategoryResult[];
  criticalIssues: ComplianceDeadlineAlert[];
  upcomingDeadlines: ComplianceDeadlineAlert[];
  sequenceIntegrity: SequenceIntegrityResult[];
  documentCompliance: DocumentComplianceCheck[];
  auditReadiness: AuditReadinessScore;
  recommendations: ComplianceRecommendation[];
  nextCheckDate: Date;
  checkDuration: number; // seconds
}

/**
 * Compliance category result
 */
export interface ComplianceCategoryResult {
  category: ComplianceCategory;
  score: number; // 0-100
  status: "COMPLIANT" | "NON_COMPLIANT" | "NEEDS_ATTENTION";
  issueCount: number;
  criticalIssueCount: number;
  lastUpdated: Date;
}

/**
 * Audit readiness scoring
 */
export interface AuditReadinessScore {
  overallScore: number; // 0-100
  documentationScore: number;
  recordKeepingScore: number;
  taxComplianceScore: number;
  internalControlsScore: number;
  riskAssessment: "LOW" | "MEDIUM" | "HIGH";
  readinessLevel: "NOT_READY" | "PARTIALLY_READY" | "AUDIT_READY";
  deficiencies: AuditDeficiency[];
  strengths: string[];
  lastAuditDate?: Date;
  nextRecommendedAuditDate?: Date;
}

/**
 * Audit deficiency
 */
export interface AuditDeficiency {
  area: string;
  severity: ComplianceAlertSeverity;
  description: string;
  impact: string;
  remediation: string[];
  timeToResolve: number; // hours
  priority: number; // 1-10
}

/**
 * Compliance recommendation
 */
export interface ComplianceRecommendation {
  category: ComplianceCategory;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description: string;
  actionSteps: string[];
  estimatedEffort: number; // hours
  potentialSavings?: Decimal;
  implementBy?: Date;
  assignTo?: string;
  resources?: string[];
}

/**
 * Compliance monitoring configuration
 */
export interface ComplianceMonitoringConfig {
  projectId: string;
  businessType: "RESORT" | "HOTEL" | "RESTAURANT" | "GENERAL";
  location: {
    municipality: string;
    province: string;
    region: string;
  };
  taxSettings: {
    isVATRegistered: boolean;
    tin: string;
    rdoCode: string;
    registrationType: "VAT" | "NON_VAT" | "PERCENTAGE";
  };
  monitoringSettings: {
    dailyChecksEnabled: boolean;
    checkTime: string; // HH:mm format
    alertChannels: ("EMAIL" | "SMS" | "PUSH" | "WEBHOOK")[];
    criticalAlertChannels: ("EMAIL" | "SMS" | "PUSH" | "WEBHOOK")[];
    reminderDays: number[];
  };
  customDeadlines: TaxFilingDeadline[];
  exemptions: ComplianceExemption[];
  lastConfigUpdate: Date;
  configuredBy: string;
}

/**
 * Compliance exemption
 */
export interface ComplianceExemption {
  category: ComplianceCategory;
  exemptionType: string;
  reason: string;
  validFrom: Date;
  validTo?: Date;
  approvedBy: string;
  supportingDocuments: string[];
  conditions?: string[];
}

/**
 * Compliance monitoring statistics
 */
export interface ComplianceMonitoringStats {
  periodStart: Date;
  periodEnd: Date;
  totalChecks: number;
  alertsGenerated: number;
  alertsByCategory: Record<ComplianceCategory, number>;
  alertsBySeverity: Record<ComplianceAlertSeverity, number>;
  averageResolutionTime: number; // hours
  complianceScoreTrend: ComplianceScorePoint[];
  deadlinesMissed: number;
  deadlinesMet: number;
  sequenceIssuesDetected: number;
  sequenceIssuesResolved: number;
  auditReadinessImprovement: number; // percentage points
  topIssueCategories: string[];
}

/**
 * Compliance score tracking point
 */
export interface ComplianceScorePoint {
  date: Date;
  overallScore: number;
  categoryScores: Record<ComplianceCategory, number>;
}

/**
 * Compliance notification preferences
 */
export interface ComplianceNotificationPreferences {
  userId: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  categories: ComplianceCategory[];
  severityLevels: ComplianceAlertSeverity[];
  quietHours: {
    start: string; // HH:mm
    end: string; // HH:mm
  };
  digestFrequency: "IMMEDIATE" | "HOURLY" | "DAILY" | "WEEKLY";
  lastUpdated: Date;
}

/**
 * Compliance historical data
 */
export interface ComplianceHistoricalData {
  date: Date;
  overallScore: number;
  categoryScores: Record<ComplianceCategory, number>;
  alertCount: number;
  criticalAlertCount: number;
  issuesResolved: number;
  newIssuesIdentified: number;
  auditReadinessScore: number;
  sequenceComplianceScore: number;
  documentComplianceScore: number;
}
