/**
 * Expense Management Database Schema
 *
 * Drizzle ORM schema definitions for expense tracking and management
 * with application-level multi-tenant isolation using project_id filtering.
 * All monetary values use decimal(19, 2) for Philippine Peso precision.
 *
 * Supports:
 * - Expense tracking with VAT/EWT calculations
 * - Vendor management with TIN validation
 * - Receipt/document management
 * - Petty cash fund tracking
 * - Approval workflows
 * - BIR compliance for Philippine operations
 */

import {
  pgTable,
  uuid,
  varchar,
  decimal,
  integer,
  boolean,
  date,
  timestamp,
  jsonb,
  text,
  unique,
  check,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { projects, users } from "./global";

// =============================================
// Expense Transactions Table - Core expense recording
// =============================================
export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    // Transaction Details
    expenseCode: varchar("expense_code", { length: 50 }).notNull(),
    expenseDate: date("expense_date").notNull(),
    dueDate: date("due_date"),

    // Financial Details (all amounts in Philippine Peso)
    grossAmount: decimal("gross_amount", { precision: 19, scale: 2 }).notNull(),
    vatAmount: decimal("vat_amount", { precision: 19, scale: 2 }).default("0").notNull(),
    ewtAmount: decimal("ewt_amount", { precision: 19, scale: 2 }).default("0").notNull(), // Expanded Withholding Tax
    netAmount: decimal("net_amount", { precision: 19, scale: 2 }).notNull(),

    // Category & Classification
    category: varchar("category", { length: 100 }).notNull(),
    subcategory: varchar("subcategory", { length: 100 }),
    expenseType: varchar("expense_type", { length: 50 }).notNull(), // operating, capital, prepaid
    isRecurring: boolean("is_recurring").default(false),
    recurringFrequency: varchar("recurring_frequency", { length: 50 }), // monthly, quarterly, annually

    // Vendor Information
    vendorId: uuid("vendor_id"),
    // .references(() => vendors.id, { onDelete: "restrict" }), // Commented for RED phase
    vendorName: varchar("vendor_name", { length: 255 }),
    vendorTin: varchar("vendor_tin", { length: 20 }),

    // Tax Information
    isVatable: boolean("is_vatable").default(false),
    vatRate: decimal("vat_rate", { precision: 5, scale: 4 }).default("0.12"), // 12% standard VAT
    isEwtApplicable: boolean("is_ewt_applicable").default(false),
    ewtRate: decimal("ewt_rate", { precision: 5, scale: 4 }), // 1%, 2%, 5%, 10%, 15%

    // Documentation
    invoiceNumber: varchar("invoice_number", { length: 100 }),
    receiptNumber: varchar("receipt_number", { length: 100 }),
    orNumber: varchar("or_number", { length: 100 }), // Official Receipt number
    referenceNumber: varchar("reference_number", { length: 100 }),

    // Payment Information
    paymentStatus: varchar("payment_status", { length: 50 }).notNull().default("unpaid"), // unpaid, partial, paid
    paymentMethod: varchar("payment_method", { length: 50 }), // cash, bank_transfer, check, gcash, credit_card
    paymentDate: date("payment_date"),
    checkNumber: varchar("check_number", { length: 50 }),
    bankReference: varchar("bank_reference", { length: 100 }),

    // Approval Workflow
    approvalStatus: varchar("approval_status", { length: 50 }).notNull().default("draft"), // draft, pending, approved, rejected
    approvalLevel: varchar("approval_level", { length: 50 }), // auto, manager, owner, dual
    approvedBy: uuid("approved_by"),
    // .references(() => users.id), // Commented for RED phase
    approvedAt: timestamp("approved_at"),
    rejectionReason: text("rejection_reason"),

    // Description & Notes
    description: text("description").notNull(),
    notes: text("notes"),
    tags: jsonb("tags").$type<string[]>().default([]),

    // Attachments & Metadata
    attachments: jsonb("attachments")
      .$type<{ url: string; type: string; name: string }[]>()
      .default([]),
    metadata: jsonb("metadata").default({}),

    // Reconciliation
    isReconciled: boolean("is_reconciled").default(false),
    reconciledBy: uuid("reconciled_by"),
    reconciledAt: timestamp("reconciled_at"),

    // Audit Fields
    createdBy: uuid("created_by").notNull(),
    // .references(() => users.id), // Commented for RED phase
    updatedBy: uuid("updated_by"),
    // .references(() => users.id), // Commented for RED phase
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"), // Soft delete
  },
  (table) => ({
    // Unique expense code per project
    uniqueExpenseCode: unique("expenses_project_code_unique").on(
      table.projectId,
      table.expenseCode
    ),

    // Business constraints
    grossAmountPositive: check("expense_gross_amount_positive", `${table.grossAmount.name} > 0`),
    vatAmountPositive: check("expense_vat_amount_positive", `${table.vatAmount.name} >= 0`),
    ewtAmountPositive: check("expense_ewt_amount_positive", `${table.ewtAmount.name} >= 0`),

    // Indexes for performance
    projectDateIdx: index("expenses_project_date_idx").on(table.projectId, table.expenseDate),
    projectCategoryIdx: index("expenses_project_category_idx").on(table.projectId, table.category),
    projectVendorIdx: index("expenses_project_vendor_idx").on(table.projectId, table.vendorId),
    projectStatusIdx: index("expenses_project_status_idx").on(
      table.projectId,
      table.approvalStatus
    ),
    paymentStatusIdx: index("expenses_payment_status_idx").on(table.paymentStatus),
  })
);

// =============================================
// Vendors Table - Supplier management
// =============================================
export const vendors = pgTable(
  "vendors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    // Basic Information
    vendorCode: varchar("vendor_code", { length: 50 }).notNull(),
    vendorName: varchar("vendor_name", { length: 255 }).notNull(),
    vendorType: varchar("vendor_type", { length: 50 }).notNull(), // individual, corporation, government

    // Tax Information
    tin: varchar("tin", { length: 20 }).notNull(), // Format: XXX-XXX-XXX-XXX
    vatRegistered: boolean("vat_registered").default(false),
    vatNumber: varchar("vat_number", { length: 50 }),
    ewtApplicable: boolean("ewt_applicable").default(false),
    ewtRate: decimal("ewt_rate", { precision: 5, scale: 4 }), // Default withholding tax rate

    // Contact Information
    contactPerson: varchar("contact_person", { length: 255 }),
    contactNumber: varchar("contact_number", { length: 50 }),
    email: varchar("email", { length: 255 }),
    address: text("address"),
    city: varchar("city", { length: 100 }),
    province: varchar("province", { length: 100 }),
    postalCode: varchar("postal_code", { length: 10 }),

    // Banking Information
    bankName: varchar("bank_name", { length: 100 }),
    accountName: varchar("account_name", { length: 255 }),
    accountNumber: varchar("account_number", { length: 50 }),
    bankBranch: varchar("bank_branch", { length: 100 }),

    // Business Terms
    paymentTerms: integer("payment_terms").default(30), // Days
    creditLimit: decimal("credit_limit", { precision: 19, scale: 2 }),
    discountRate: decimal("discount_rate", { precision: 5, scale: 2 }), // Early payment discount

    // Categories & Services
    serviceCategories: jsonb("service_categories").$type<string[]>().default([]),
    productCategories: jsonb("product_categories").$type<string[]>().default([]),

    // Compliance & Documentation
    businessPermitNumber: varchar("business_permit_number", { length: 100 }),
    businessPermitExpiry: date("business_permit_expiry"),
    birRegistrationNumber: varchar("bir_registration_number", { length: 100 }),
    form2307Required: boolean("form_2307_required").default(false), // BIR Form 2307 for withholding tax

    // Status
    isActive: boolean("is_active").default(true),
    isBlacklisted: boolean("is_blacklisted").default(false),
    blacklistReason: text("blacklist_reason"),
    rating: decimal("rating", { precision: 3, scale: 2 }), // 0.00 to 5.00

    // Notes & Metadata
    notes: text("notes"),
    tags: jsonb("tags").$type<string[]>().default([]),
    metadata: jsonb("metadata").default({}),

    // Audit Fields
    createdBy: uuid("created_by").notNull(),
    // .references(() => users.id), // Commented for RED phase
    updatedBy: uuid("updated_by"),
    // .references(() => users.id), // Commented for RED phase
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Unique vendor code per project
    uniqueVendorCode: unique("vendors_project_code_unique").on(table.projectId, table.vendorCode),

    // Unique TIN per project (same vendor can exist in different projects)
    uniqueTin: unique("vendors_project_tin_unique").on(table.projectId, table.tin),

    // Indexes for performance
    projectActiveIdx: index("vendors_project_active_idx").on(table.projectId, table.isActive),
    vendorNameIdx: index("vendors_name_idx").on(table.vendorName),
  })
);

// =============================================
// Expense Receipts Table - Document management
// =============================================
export const expenseReceipts = pgTable(
  "expense_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),

    // Document Details
    documentType: varchar("document_type", { length: 50 }).notNull(), // receipt, invoice, or_copy, delivery_receipt
    documentNumber: varchar("document_number", { length: 100 }),
    documentDate: date("document_date"),

    // File Information
    fileUrl: text("file_url").notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileType: varchar("file_type", { length: 50 }).notNull(), // pdf, jpg, png
    fileSize: integer("file_size"), // In bytes
    thumbnailUrl: text("thumbnail_url"),

    // OCR Data (if extracted)
    ocrExtracted: boolean("ocr_extracted").default(false),
    ocrData: jsonb("ocr_data")
      .$type<{
        vendor?: string;
        amount?: number;
        date?: string;
        items?: any[];
        taxDetails?: any;
      }>()
      .default({}),

    // Verification
    isVerified: boolean("is_verified").default(false),
    verifiedBy: uuid("verified_by"),
    // .references(() => users.id), // Commented for RED phase
    verifiedAt: timestamp("verified_at"),

    // Metadata
    metadata: jsonb("metadata").default({}),

    // Audit Fields
    uploadedBy: uuid("uploaded_by").notNull(),
    // .references(() => users.id), // Commented for RED phase
    uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  },
  (table) => ({
    // Indexes
    expenseIdx: index("expense_receipts_expense_idx").on(table.expenseId),
    documentTypeIdx: index("expense_receipts_type_idx").on(table.documentType),
  })
);

// =============================================
// Petty Cash Funds Table - Cash fund management
// =============================================
export const pettyCashFunds = pgTable(
  "petty_cash_funds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    // Fund Details
    fundCode: varchar("fund_code", { length: 50 }).notNull(),
    fundName: varchar("fund_name", { length: 255 }).notNull(),
    fundLimit: decimal("fund_limit", { precision: 19, scale: 2 }).notNull(),
    currentBalance: decimal("current_balance", { precision: 19, scale: 2 }).notNull(),

    // Custodians
    custodian: uuid("custodian").notNull(),
    // .references(() => users.id), // Commented for RED phase
    alternateCustodian: uuid("alternate_custodian"),
    // .references(() => users.id), // Commented for RED phase

    // Location & Settings
    location: varchar("location", { length: 255 }),
    disbursementLimit: decimal("disbursement_limit", { precision: 19, scale: 2 }),
    replenishmentThreshold: decimal("replenishment_threshold", { precision: 19, scale: 2 }),
    requireReceipt: boolean("require_receipt").default(true),
    approvalRequiredAbove: decimal("approval_required_above", { precision: 19, scale: 2 }),

    // Status
    isActive: boolean("is_active").default(true),
    lastReplenishmentDate: date("last_replenishment_date"),
    lastReconciliationDate: date("last_reconciliation_date"),

    // Metadata
    notes: text("notes"),
    metadata: jsonb("metadata").default({}),

    // Audit Fields
    createdBy: uuid("created_by").notNull(),
    // .references(() => users.id), // Commented for RED phase
    updatedBy: uuid("updated_by"),
    // .references(() => users.id), // Commented for RED phase
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Unique fund code per project
    uniqueFundCode: unique("petty_cash_funds_project_code_unique").on(
      table.projectId,
      table.fundCode
    ),

    // Indexes
    projectActiveIdx: index("petty_cash_funds_project_active_idx").on(
      table.projectId,
      table.isActive
    ),
  })
);

// =============================================
// Petty Cash Transactions Table
// =============================================
export const pettyCashTransactions = pgTable(
  "petty_cash_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fundId: uuid("fund_id")
      .notNull()
      .references(() => pettyCashFunds.id, { onDelete: "cascade" }),

    // Transaction Details
    transactionCode: varchar("transaction_code", { length: 50 }).notNull(),
    transactionDate: timestamp("transaction_date").notNull(),
    transactionType: varchar("transaction_type", { length: 50 }).notNull(), // disbursement, replenishment, adjustment

    // Financial Details
    amount: decimal("amount", { precision: 19, scale: 2 }).notNull(),
    balanceBefore: decimal("balance_before", { precision: 19, scale: 2 }).notNull(),
    balanceAfter: decimal("balance_after", { precision: 19, scale: 2 }).notNull(),

    // Expense Details (for disbursements)
    expenseCategory: varchar("expense_category", { length: 100 }),
    description: text("description").notNull(),
    vendorName: varchar("vendor_name", { length: 255 }),
    receiptNumber: varchar("receipt_number", { length: 100 }),

    // Approval
    requestedBy: uuid("requested_by").notNull(),
    // .references(() => users.id), // Commented for RED phase
    approvedBy: uuid("approved_by"),
    // .references(() => users.id), // Commented for RED phase
    approvedAt: timestamp("approved_at"),

    // Reconciliation
    isReconciled: boolean("is_reconciled").default(false),
    reconciledBy: uuid("reconciled_by"),
    // .references(() => users.id), // Commented for RED phase
    reconciledAt: timestamp("reconciled_at"),
    discrepancy: decimal("discrepancy", { precision: 19, scale: 2 }),

    // Attachments & Metadata
    attachments: jsonb("attachments").$type<{ url: string; type: string }[]>().default([]),
    metadata: jsonb("metadata").default({}),

    // Audit Fields
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Indexes
    fundDateIdx: index("petty_cash_transactions_fund_date_idx").on(
      table.fundId,
      table.transactionDate
    ),
    transactionTypeIdx: index("petty_cash_transactions_type_idx").on(table.transactionType),
  })
);

// =============================================
// Expense Approval History Table
// =============================================
export const expenseApprovalHistory = pgTable(
  "expense_approval_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),

    // Action Details
    action: varchar("action", { length: 50 }).notNull(), // submitted, approved, rejected, escalated, recalled
    actionBy: uuid("action_by").notNull(),
    // .references(() => users.id), // Commented for RED phase
    actionAt: timestamp("action_at").defaultNow().notNull(),

    // Status Change
    previousStatus: varchar("previous_status", { length: 50 }),
    newStatus: varchar("new_status", { length: 50 }).notNull(),

    // Approval Details
    approvalLevel: varchar("approval_level", { length: 50 }),
    amountApproved: decimal("amount_approved", { precision: 19, scale: 2 }),

    // Comments & Conditions
    comments: text("comments"),
    conditions: jsonb("conditions").$type<string[]>().default([]),

    // Metadata
    metadata: jsonb("metadata").default({}),
  },
  (table) => ({
    // Indexes
    expenseIdx: index("expense_approval_history_expense_idx").on(table.expenseId),
    actionByIdx: index("expense_approval_history_action_by_idx").on(table.actionBy),
  })
);

// =============================================
// Withholding Tax Certificates Table - BIR Form 2307
// =============================================
export const withholdingTaxCertificates = pgTable(
  "withholding_tax_certificates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    expenseId: uuid("expense_id").references(() => expenses.id, { onDelete: "set null" }),

    // Certificate Details
    certificateNumber: varchar("certificate_number", { length: 100 }).notNull(),
    formType: varchar("form_type", { length: 50 }).notNull().default("2307"), // BIR Form 2307
    periodCovered: varchar("period_covered", { length: 50 }).notNull(), // Format: YYYY-MM or YYYY-QX

    // Payee Information
    payeeName: varchar("payee_name", { length: 255 }).notNull(),
    payeeTin: varchar("payee_tin", { length: 20 }).notNull(),
    payeeAddress: text("payee_address"),

    // Tax Details
    incomePayment: decimal("income_payment", { precision: 19, scale: 2 }).notNull(),
    taxRate: decimal("tax_rate", { precision: 5, scale: 4 }).notNull(),
    taxWithheld: decimal("tax_withheld", { precision: 19, scale: 2 }).notNull(),
    atcCode: varchar("atc_code", { length: 20 }).notNull(), // Alphanumeric Tax Code

    // Filing Information
    filingDate: date("filing_date"),
    filingReference: varchar("filing_reference", { length: 100 }),

    // Document
    certificateUrl: text("certificate_url"),

    // Status
    status: varchar("status", { length: 50 }).notNull().default("draft"), // draft, issued, filed, cancelled

    // Audit Fields
    createdBy: uuid("created_by").notNull(),
    // .references(() => users.id), // Commented for RED phase
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Unique certificate number per project
    uniqueCertNumber: unique("withholding_tax_cert_project_number_unique").on(
      table.projectId,
      table.certificateNumber
    ),

    // Indexes
    projectPeriodIdx: index("withholding_tax_cert_project_period_idx").on(
      table.projectId,
      table.periodCovered
    ),
    payeeTinIdx: index("withholding_tax_cert_payee_tin_idx").on(table.payeeTin),
  })
);

// =============================================
// Relations (commented for RED phase)
// =============================================
// export const expensesRelations = relations(expenses, ({ one, many }) => ({
//   project: one(projects, {
//     fields: [expenses.projectId],
//     references: [projects.id],
//   }),
//   vendor: one(vendors, {
//     fields: [expenses.vendorId],
//     references: [vendors.id],
//   }),
//   receipts: many(expenseReceipts),
//   approvalHistory: many(expenseApprovalHistory),
//   withholdingCert: one(withholdingTaxCertificates),
// }));

// export const vendorsRelations = relations(vendors, ({ one, many }) => ({
//   project: one(projects, {
//     fields: [vendors.projectId],
//     references: [projects.id],
//   }),
//   expenses: many(expenses),
// }));

// export const pettyCashFundsRelations = relations(pettyCashFunds, ({ one, many }) => ({
//   project: one(projects, {
//     fields: [pettyCashFunds.projectId],
//     references: [projects.id],
//   }),
//   transactions: many(pettyCashTransactions),
// }));

// Type exports
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type Vendor = typeof vendors.$inferSelect;
export type NewVendor = typeof vendors.$inferInsert;
export type ExpenseReceipt = typeof expenseReceipts.$inferSelect;
export type NewExpenseReceipt = typeof expenseReceipts.$inferInsert;
export type PettyCashFund = typeof pettyCashFunds.$inferSelect;
export type NewPettyCashFund = typeof pettyCashFunds.$inferInsert;
export type PettyCashTransaction = typeof pettyCashTransactions.$inferSelect;
export type NewPettyCashTransaction = typeof pettyCashTransactions.$inferInsert;
export type ExpenseApprovalHistory = typeof expenseApprovalHistory.$inferSelect;
export type NewExpenseApprovalHistory = typeof expenseApprovalHistory.$inferInsert;
export type WithholdingTaxCertificate = typeof withholdingTaxCertificates.$inferSelect;
export type NewWithholdingTaxCertificate = typeof withholdingTaxCertificates.$inferInsert;
