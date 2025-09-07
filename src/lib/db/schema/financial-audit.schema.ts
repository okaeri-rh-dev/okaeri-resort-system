/**
 * Financial Audit Trail Database Schema
 *
 * Comprehensive audit logging for all financial transactions
 * ensuring immutability, compliance, and traceability for Philippine
 * BIR requirements and internal security.
 */

import {
  pgTable,
  uuid,
  varchar,
  decimal,
  boolean,
  timestamp,
  jsonb,
  text,
  inet,
  index,
  integer,
} from "drizzle-orm/pg-core";
import { projects, users } from "./global";

// =============================================
// Financial Audit Trail Table - Immutable audit log
// =============================================
export const financialAuditTrail = pgTable(
  "financial_audit_trail",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    // Audit Event Details
    eventId: uuid("event_id").notNull(), // Unique identifier for this event
    eventType: varchar("event_type", { length: 100 }).notNull(), // expense_created, payment_processed, etc.
    eventCategory: varchar("event_category", { length: 50 }).notNull(), // expense, income, payment, tax, etc.
    eventSeverity: varchar("event_severity", { length: 20 }).notNull().default("info"), // info, warning, error, critical
    eventTimestamp: timestamp("event_timestamp").defaultNow().notNull(),

    // Entity References
    entityType: varchar("entity_type", { length: 50 }).notNull(), // expense, income, payment, vendor, etc.
    entityId: uuid("entity_id").notNull(), // ID of the affected entity
    entityCode: varchar("entity_code", { length: 100 }), // Human-readable code (expense_code, etc.)

    // Financial Impact
    monetaryAmount: decimal("monetary_amount", { precision: 19, scale: 2 }),
    previousAmount: decimal("previous_amount", { precision: 19, scale: 2 }),
    amountDifference: decimal("amount_difference", { precision: 19, scale: 2 }),
    currency: varchar("currency", { length: 3 }).default("PHP"),

    // User & Session Information
    userId: uuid("user_id").notNull(),
    // .references(() => users.id), // Commented for RED phase
    userName: varchar("user_name", { length: 255 }),
    userRole: varchar("user_role", { length: 50 }),
    sessionId: varchar("session_id", { length: 255 }),

    // Action Details
    action: varchar("action", { length: 100 }).notNull(), // create, update, delete, approve, reject, etc.
    actionMethod: varchar("action_method", { length: 50 }), // api, ui, batch, system
    actionReason: text("action_reason"),

    // Change Tracking
    changeSet: jsonb("change_set")
      .$type<
        {
          field: string;
          oldValue: any;
          newValue: any;
          dataType: string;
        }[]
      >()
      .default([]),
    previousState: jsonb("previous_state").default({}),
    newState: jsonb("new_state").default({}),

    // System Information
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    requestId: varchar("request_id", { length: 100 }), // For tracing related operations
    apiEndpoint: varchar("api_endpoint", { length: 255 }),
    httpMethod: varchar("http_method", { length: 10 }),
    responseCode: varchar("response_code", { length: 10 }),

    // Compliance & Security
    requiresReview: boolean("requires_review").default(false),
    reviewedBy: uuid("reviewed_by"),
    // .references(() => users.id), // Commented for RED phase
    reviewedAt: timestamp("reviewed_at"),
    reviewNotes: text("review_notes"),

    // Regulatory Compliance
    birReportable: boolean("bir_reportable").default(false), // Needs to be included in BIR reports
    birFormType: varchar("bir_form_type", { length: 50 }), // 2307, 2550M, etc.
    complianceFlags: jsonb("compliance_flags").$type<string[]>().default([]),

    // Data Integrity
    checksum: varchar("checksum", { length: 128 }), // SHA-512 hash of critical fields
    isVerified: boolean("is_verified").default(true),
    verificationFailureReason: text("verification_failure_reason"),

    // Metadata
    metadata: jsonb("metadata").default({}),
    tags: jsonb("tags").$type<string[]>().default([]),

    // Immutable timestamp (never updated)
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    // Indexes for efficient querying
    projectEventIdx: index("financial_audit_project_event_idx").on(
      table.projectId,
      table.eventTimestamp
    ),
    entityIdx: index("financial_audit_entity_idx").on(table.entityType, table.entityId),
    userIdx: index("financial_audit_user_idx").on(table.userId),
    severityIdx: index("financial_audit_severity_idx").on(table.eventSeverity),
    reviewRequiredIdx: index("financial_audit_review_required_idx").on(table.requiresReview),
    birReportableIdx: index("financial_audit_bir_reportable_idx").on(table.birReportable),
  })
);

// =============================================
// Cash Reconciliation Audit Table
// =============================================
export const cashReconciliationAudit = pgTable(
  "cash_reconciliation_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    // Reconciliation Details
    reconciliationDate: timestamp("reconciliation_date").notNull(),
    reconciliationType: varchar("reconciliation_type", { length: 50 }).notNull(), // daily, shift_change, monthly

    // Cash Drawer/Register Information
    drawerId: varchar("drawer_id", { length: 50 }),
    drawerLocation: varchar("drawer_location", { length: 100 }),
    shiftId: varchar("shift_id", { length: 50 }),

    // Opening Balance
    openingBalance: decimal("opening_balance", { precision: 19, scale: 2 }).notNull(),
    openingDenominations: jsonb("opening_denominations")
      .$type<
        {
          denomination: number;
          quantity: number;
          total: number;
        }[]
      >()
      .default([]),

    // Transactions During Period
    cashSales: decimal("cash_sales", { precision: 19, scale: 2 }).notNull(),
    cashRefunds: decimal("cash_refunds", { precision: 19, scale: 2 }).notNull(),
    cashExpenses: decimal("cash_expenses", { precision: 19, scale: 2 }).notNull(),
    cashDeposits: decimal("cash_deposits", { precision: 19, scale: 2 }).notNull(),
    cashWithdrawals: decimal("cash_withdrawals", { precision: 19, scale: 2 }).notNull(),

    // Expected vs Actual
    expectedClosingBalance: decimal("expected_closing_balance", {
      precision: 19,
      scale: 2,
    }).notNull(),
    actualClosingBalance: decimal("actual_closing_balance", { precision: 19, scale: 2 }).notNull(),
    closingDenominations: jsonb("closing_denominations")
      .$type<
        {
          denomination: number;
          quantity: number;
          total: number;
        }[]
      >()
      .default([]),

    // Variance Analysis
    variance: decimal("variance", { precision: 19, scale: 2 }).notNull(),
    variancePercentage: decimal("variance_percentage", { precision: 5, scale: 2 }),
    varianceStatus: varchar("variance_status", { length: 50 }).notNull(), // balanced, over, short
    varianceExplanation: text("variance_explanation"),

    // Supporting Documents
    transactionCount: integer("transaction_count").notNull(),
    receiptNumbers: jsonb("receipt_numbers").$type<string[]>().default([]),
    voidedTransactions: jsonb("voided_transactions")
      .$type<
        {
          transactionId: string;
          amount: number;
          reason: string;
        }[]
      >()
      .default([]),

    // Reconciliation Process
    reconciledBy: uuid("reconciled_by").notNull(),
    // .references(() => users.id), // Commented for RED phase
    witnessedBy: uuid("witnessed_by"),
    // .references(() => users.id), // Commented for RED phase
    approvedBy: uuid("approved_by"),
    // .references(() => users.id), // Commented for RED phase

    // Status
    status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, approved, disputed, resolved
    disputeReason: text("dispute_reason"),
    resolutionNotes: text("resolution_notes"),

    // Metadata
    metadata: jsonb("metadata").default({}),

    // Audit Fields
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Indexes
    projectDateIdx: index("cash_reconciliation_project_date_idx").on(
      table.projectId,
      table.reconciliationDate
    ),
    statusIdx: index("cash_reconciliation_status_idx").on(table.status),
    reconciledByIdx: index("cash_reconciliation_reconciled_by_idx").on(table.reconciledBy),
  })
);

// =============================================
// Tax Compliance Audit Table
// =============================================
export const taxComplianceAudit = pgTable(
  "tax_compliance_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    // Compliance Period
    periodType: varchar("period_type", { length: 50 }).notNull(), // monthly, quarterly, annual
    periodStart: timestamp("period_start").notNull(),
    periodEnd: timestamp("period_end").notNull(),

    // VAT Compliance
    vatSales: decimal("vat_sales", { precision: 19, scale: 2 }),
    vatExemptSales: decimal("vat_exempt_sales", { precision: 19, scale: 2 }),
    zeroRatedSales: decimal("zero_rated_sales", { precision: 19, scale: 2 }),
    outputVat: decimal("output_vat", { precision: 19, scale: 2 }),
    inputVat: decimal("input_vat", { precision: 19, scale: 2 }),
    netVatPayable: decimal("net_vat_payable", { precision: 19, scale: 2 }),

    // Withholding Tax
    ewtAmount: decimal("ewt_amount", { precision: 19, scale: 2 }),
    ewtCertificatesIssued: integer("ewt_certificates_issued"),

    // Income Tax
    grossIncome: decimal("gross_income", { precision: 19, scale: 2 }),
    deductibleExpenses: decimal("deductible_expenses", { precision: 19, scale: 2 }),
    taxableIncome: decimal("taxable_income", { precision: 19, scale: 2 }),
    incomeTaxDue: decimal("income_tax_due", { precision: 19, scale: 2 }),

    // Percentage Tax (for non-VAT)
    percentageTaxBase: decimal("percentage_tax_base", { precision: 19, scale: 2 }),
    percentageTaxDue: decimal("percentage_tax_due", { precision: 19, scale: 2 }),

    // Filing Information
    formType: varchar("form_type", { length: 50 }), // 2550M, 2550Q, 1702RT, etc.
    filingReference: varchar("filing_reference", { length: 100 }),
    filingDate: timestamp("filing_date"),
    paymentDate: timestamp("payment_date"),
    paymentReference: varchar("payment_reference", { length: 100 }),

    // Compliance Status
    isCompliant: boolean("is_compliant").default(true),
    complianceIssues: jsonb("compliance_issues")
      .$type<
        {
          issue: string;
          severity: string;
          resolution: string;
        }[]
      >()
      .default([]),

    // Audit Trail
    preparedBy: uuid("prepared_by").notNull(),
    // .references(() => users.id), // Commented for RED phase
    reviewedBy: uuid("reviewed_by"),
    // .references(() => users.id), // Commented for RED phase
    filedBy: uuid("filed_by"),
    // .references(() => users.id), // Commented for RED phase

    // Supporting Documents
    supportingDocuments: jsonb("supporting_documents")
      .$type<
        {
          documentType: string;
          documentUrl: string;
          uploadedAt: string;
        }[]
      >()
      .default([]),

    // Metadata
    notes: text("notes"),
    metadata: jsonb("metadata").default({}),

    // Audit Fields
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Indexes
    projectPeriodIdx: index("tax_compliance_project_period_idx").on(
      table.projectId,
      table.periodStart,
      table.periodEnd
    ),
    formTypeIdx: index("tax_compliance_form_type_idx").on(table.formType),
    complianceIdx: index("tax_compliance_is_compliant_idx").on(table.isCompliant),
  })
);

// =============================================
// Document Generation Audit Table
// =============================================
export const documentGenerationAudit = pgTable(
  "document_generation_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    // Document Information
    documentType: varchar("document_type", { length: 100 }).notNull(), // official_receipt, sales_invoice, etc.
    documentNumber: varchar("document_number", { length: 100 }).notNull(),
    documentDate: timestamp("document_date").notNull(),

    // Related Entity
    entityType: varchar("entity_type", { length: 50 }),
    entityId: uuid("entity_id"),

    // Generation Details
    generatedBy: uuid("generated_by").notNull(),
    // .references(() => users.id), // Commented for RED phase
    generatedAt: timestamp("generated_at").defaultNow().notNull(),
    generationMethod: varchar("generation_method", { length: 50 }), // manual, automatic, batch

    // Document Content Hash
    contentHash: varchar("content_hash", { length: 128 }), // SHA-512 hash for integrity

    // Document URLs
    pdfUrl: text("pdf_url"),
    htmlUrl: text("html_url"),

    // Delivery Information
    deliveryMethod: varchar("delivery_method", { length: 50 }), // email, print, download
    deliveredTo: varchar("delivered_to", { length: 255 }),
    deliveredAt: timestamp("delivered_at"),
    deliveryStatus: varchar("delivery_status", { length: 50 }), // pending, sent, failed

    // Cancellation/Void Information
    isCancelled: boolean("is_cancelled").default(false),
    cancelledBy: uuid("cancelled_by"),
    // .references(() => users.id), // Commented for RED phase
    cancelledAt: timestamp("cancelled_at"),
    cancellationReason: text("cancellation_reason"),

    // BIR Compliance
    birCompliant: boolean("bir_compliant").default(true),
    permitNumber: varchar("permit_number", { length: 100 }),
    machineNumber: varchar("machine_number", { length: 100 }),

    // Metadata
    metadata: jsonb("metadata").default({}),

    // Audit Fields
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    // Indexes
    projectDocumentIdx: index("document_generation_project_document_idx").on(
      table.projectId,
      table.documentType,
      table.documentNumber
    ),
    entityIdx: index("document_generation_entity_idx").on(table.entityType, table.entityId),
    generatedByIdx: index("document_generation_generated_by_idx").on(table.generatedBy),
  })
);

// Type exports
export type FinancialAuditTrail = typeof financialAuditTrail.$inferSelect;
export type NewFinancialAuditTrail = typeof financialAuditTrail.$inferInsert;
export type CashReconciliationAudit = typeof cashReconciliationAudit.$inferSelect;
export type NewCashReconciliationAudit = typeof cashReconciliationAudit.$inferInsert;
export type TaxComplianceAudit = typeof taxComplianceAudit.$inferSelect;
export type NewTaxComplianceAudit = typeof taxComplianceAudit.$inferInsert;
export type DocumentGenerationAudit = typeof documentGenerationAudit.$inferSelect;
export type NewDocumentGenerationAudit = typeof documentGenerationAudit.$inferInsert;
