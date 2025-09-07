/**
 * Payment Management Database Schema
 *
 * Drizzle ORM schema definitions for payment processing and tracking
 * with application-level multi-tenant isolation using project_id filtering.
 * All monetary values use decimal(19, 2) for Philippine Peso precision.
 */

import {
  pgTable,
  uuid,
  varchar,
  decimal,
  integer,
  boolean,
  timestamp,
  jsonb,
  text,
  unique,
  check,
  index,
  inet,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { projects, users } from "./global";
import { bookings } from "./booking";

// =============================================
// Payment Transactions Table - All payment records
// =============================================
export const paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    // Transaction Identification
    transactionId: varchar("transaction_id", { length: 100 }).notNull(), // Unique transaction ID
    referenceNumber: varchar("reference_number", { length: 100 }).notNull(), // Internal reference
    externalTransactionId: varchar("external_transaction_id", { length: 255 }), // From payment gateway

    // Payment Details
    paymentType: varchar("payment_type", { length: 50 }).notNull(), // payment, refund, partial_refund, chargeback
    paymentMethod: varchar("payment_method", { length: 50 }).notNull(), // cash, gcash, bank_transfer, credit_card
    paymentGateway: varchar("payment_gateway", { length: 50 }), // gcash, paymaya, paypal, stripe

    // Financial Information
    amount: decimal("amount", { precision: 19, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("PHP").notNull(),
    exchangeRate: decimal("exchange_rate", { precision: 10, scale: 6 }).default("1.000000"),
    amountInPhp: decimal("amount_in_php", { precision: 19, scale: 2 }).notNull(),

    // Processing Fees
    processingFee: decimal("processing_fee", { precision: 19, scale: 2 }).default("0"),
    gatewayFee: decimal("gateway_fee", { precision: 19, scale: 2 }).default("0"),
    netAmount: decimal("net_amount", { precision: 19, scale: 2 }).notNull(),

    // Related Entities
    bookingId: uuid("booking_id"), // Link to booking
    // .references(() => bookings.id, { onDelete: "set null" }), // Commented for RED phase
    incomeTransactionId: uuid("income_transaction_id"), // Link to income transaction
    customerId: uuid("customer_id"), // Customer reference

    // Payment Status
    status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, processing, completed, failed, cancelled, refunded
    statusReason: text("status_reason"),
    processedAt: timestamp("processed_at"),
    settledAt: timestamp("settled_at"),

    // Customer Information
    payerName: varchar("payer_name", { length: 255 }).notNull(),
    payerEmail: varchar("payer_email", { length: 255 }),
    payerPhone: varchar("payer_phone", { length: 20 }),
    payerAddress: text("payer_address"),

    // Gateway Response
    gatewayResponse: jsonb("gateway_response").default({}),
    gatewayStatus: varchar("gateway_status", { length: 100 }),
    gatewayMessage: text("gateway_message"),

    // Security and Validation
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    isVerified: boolean("is_verified").default(false).notNull(),
    verificationMethod: varchar("verification_method", { length: 50 }), // sms, email, manual
    verifiedBy: uuid("verified_by"),
    // .references(() => users.id), // Commented for RED phase
    verifiedAt: timestamp("verified_at"),

    // Retry Information
    attemptCount: integer("attempt_count").default(1).notNull(),
    lastAttemptAt: timestamp("last_attempt_at"),
    nextRetryAt: timestamp("next_retry_at"),

    // Metadata
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
    // Unique transaction ID per project
    uniqueTransactionId: unique("payment_transactions_project_transaction_unique").on(
      table.projectId,
      table.transactionId
    ),
    // Unique reference number per project
    uniqueReferenceNumber: unique("payment_transactions_project_reference_unique").on(
      table.projectId,
      table.referenceNumber
    ),

    // Business constraints
    amountPositive: check("payment_amount_positive", `${table.amount.name} > 0`),
    processingFeePositive: check(
      "payment_processing_fee_positive",
      `${table.processingFee.name} >= 0`
    ),
    gatewayFeePositive: check("payment_gateway_fee_positive", `${table.gatewayFee.name} >= 0`),
    netAmountPositive: check("payment_net_amount_positive", `${table.netAmount.name} >= 0`),
    attemptCountPositive: check("payment_attempt_count_positive", `${table.attemptCount.name} > 0`),

    // Performance indexes
    projectIdIdx: index("idx_payment_project_id").on(table.projectId),
    projectStatusIdx: index("idx_payment_project_status").on(table.projectId, table.status),
    projectMethodIdx: index("idx_payment_project_method").on(table.projectId, table.paymentMethod),
    bookingIdx: index("idx_payment_booking").on(table.bookingId),
    customerIdx: index("idx_payment_customer").on(table.customerId),
    externalTxnIdx: index("idx_payment_external_txn").on(table.externalTransactionId),
    processedAtIdx: index("idx_payment_processed_at").on(table.processedAt),
    createdAtIdx: index("idx_payment_created_at").on(table.projectId, table.createdAt),
  })
);

// =============================================
// Payment Gateways Table - Gateway configurations
// =============================================
export const paymentGateways = pgTable(
  "payment_gateways",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    // Gateway Information
    gatewayCode: varchar("gateway_code", { length: 50 }).notNull(), // gcash, paymaya, paypal, stripe
    gatewayName: varchar("gateway_name", { length: 255 }).notNull(),
    gatewayType: varchar("gateway_type", { length: 50 }).notNull(), // ewallet, bank, card_processor

    // Configuration
    isActive: boolean("is_active").default(true).notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    priority: integer("priority").default(0).notNull(), // Display order

    // Credentials (encrypted in production)
    merchantId: varchar("merchant_id", { length: 255 }),
    apiKey: text("api_key"), // Should be encrypted
    apiSecret: text("api_secret"), // Should be encrypted
    publicKey: text("public_key"),
    webhookSecret: text("webhook_secret"), // Should be encrypted

    // URLs and Endpoints
    apiEndpoint: text("api_endpoint"),
    webhookUrl: text("webhook_url"),
    returnUrl: text("return_url"),
    cancelUrl: text("cancel_url"),

    // Fee Structure
    transactionFeeType: varchar("transaction_fee_type", { length: 20 }), // percentage, fixed, tiered
    transactionFeeValue: decimal("transaction_fee_value", { precision: 10, scale: 4 }).default("0"),
    minimumTransactionFee: decimal("minimum_transaction_fee", { precision: 19, scale: 2 }).default(
      "0"
    ),
    maximumTransactionFee: decimal("maximum_transaction_fee", { precision: 19, scale: 2 }),
    monthlyFee: decimal("monthly_fee", { precision: 19, scale: 2 }).default("0"),
    setupFee: decimal("setup_fee", { precision: 19, scale: 2 }).default("0"),

    // Limits
    minimumAmount: decimal("minimum_amount", { precision: 19, scale: 2 }).default("1"),
    maximumAmount: decimal("maximum_amount", { precision: 19, scale: 2 }),
    dailyLimit: decimal("daily_limit", { precision: 19, scale: 2 }),
    monthlyLimit: decimal("monthly_limit", { precision: 19, scale: 2 }),

    // Settlement
    settlementPeriod: varchar("settlement_period", { length: 50 }), // instant, daily, weekly, monthly
    settlementDays: integer("settlement_days").default(1), // Business days to settlement
    bankAccountNumber: varchar("bank_account_number", { length: 100 }), // Encrypted
    bankAccountName: varchar("bank_account_name", { length: 255 }),
    bankName: varchar("bank_name", { length: 255 }),

    // Supported Features
    supportedCurrencies: jsonb("supported_currencies").$type<string[]>().default(["PHP"]),
    supportedPaymentTypes: jsonb("supported_payment_types").$type<string[]>().default(["payment"]),
    supportedFeatures: jsonb("supported_features")
      .$type<{
        refunds?: boolean;
        partialRefunds?: boolean;
        recurring?: boolean;
        tokenization?: boolean;
        qrCode?: boolean;
      }>()
      .default({}),

    // Configuration Options
    configuration: jsonb("configuration").default({}),

    // Testing
    isTestMode: boolean("is_test_mode").default(false).notNull(),
    testApiKey: text("test_api_key"), // Should be encrypted
    testApiSecret: text("test_api_secret"), // Should be encrypted

    // Metadata
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
    // Unique gateway code per project
    uniqueGatewayCode: unique("payment_gateways_project_code_unique").on(
      table.projectId,
      table.gatewayCode
    ),

    // Business constraints
    priorityPositive: check("gateway_priority_positive", `${table.priority.name} >= 0`),
    minimumAmountPositive: check(
      "gateway_minimum_amount_positive",
      `${table.minimumAmount.name} > 0`
    ),
    maximumAmountValid: check(
      "gateway_maximum_amount_valid",
      `${table.maximumAmount.name} IS NULL OR ${table.maximumAmount.name} >= ${table.minimumAmount.name}`
    ),
    settlementDaysPositive: check(
      "gateway_settlement_days_positive",
      `${table.settlementDays.name} >= 0`
    ),

    // Performance indexes
    projectIdIdx: index("idx_gateway_project_id").on(table.projectId),
    projectActiveIdx: index("idx_gateway_project_active").on(table.projectId, table.isActive),
    projectDefaultIdx: index("idx_gateway_project_default").on(table.projectId, table.isDefault),
    priorityIdx: index("idx_gateway_priority").on(table.projectId, table.priority),
  })
);

// =============================================
// Cash Payments Table - Cash denomination tracking
// =============================================
export const cashPayments = pgTable(
  "cash_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    // Payment Reference
    paymentTransactionId: uuid("payment_transaction_id").notNull(),
    // .references(() => paymentTransactions.id, { onDelete: "cascade" }), // Commented for RED phase

    // Cash Details
    amountReceived: decimal("amount_received", { precision: 19, scale: 2 }).notNull(),
    changeGiven: decimal("change_given", { precision: 19, scale: 2 }).default("0").notNull(),

    // Denomination Breakdown
    denominations: jsonb("denominations")
      .$type<
        Array<{
          value: number; // 1000, 500, 200, 100, 50, 20, 10, 5, 1
          quantity: number;
          total: number;
        }>
      >()
      .default([]),

    // Cash Register Information
    cashRegisterId: varchar("cash_register_id", { length: 50 }),
    shiftId: varchar("shift_id", { length: 50 }),
    drawerBalance: decimal("drawer_balance", { precision: 19, scale: 2 }),

    // Verification
    isCounted: boolean("is_counted").default(false).notNull(),
    countedBy: uuid("counted_by"),
    // .references(() => users.id), // Commented for RED phase
    countedAt: timestamp("counted_at"),
    countDiscrepancy: decimal("count_discrepancy", { precision: 19, scale: 2 }).default("0"),

    // Receipt Information
    receiptNumber: varchar("receipt_number", { length: 100 }),
    receiptPrinted: boolean("receipt_printed").default(false).notNull(),
    receiptPrintedAt: timestamp("receipt_printed_at"),

    // Metadata
    notes: text("notes"),
    metadata: jsonb("metadata").default({}),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Business constraints
    amountReceivedPositive: check(
      "cash_amount_received_positive",
      `${table.amountReceived.name} > 0`
    ),
    changeGivenPositive: check("cash_change_given_positive", `${table.changeGiven.name} >= 0`),

    // Performance indexes
    projectIdIdx: index("idx_cash_project_id").on(table.projectId),
    paymentTransactionIdx: index("idx_cash_payment_transaction").on(table.paymentTransactionId),
    shiftIdx: index("idx_cash_shift").on(table.projectId, table.shiftId),
    receiptNumberIdx: index("idx_cash_receipt_number").on(table.projectId, table.receiptNumber),
  })
);

// =============================================
// Bank Transfers Table - Transfer details
// =============================================
export const bankTransfers = pgTable(
  "bank_transfers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    // Payment Reference
    paymentTransactionId: uuid("payment_transaction_id").notNull(),
    // .references(() => paymentTransactions.id, { onDelete: "cascade" }), // Commented for RED phase

    // Transfer Details
    transferType: varchar("transfer_type", { length: 50 }).notNull(), // online, otc, check, wire
    referenceNumber: varchar("reference_number", { length: 100 }).notNull(),

    // Bank Information
    senderBankName: varchar("sender_bank_name", { length: 255 }),
    senderAccountNumber: varchar("sender_account_number", { length: 100 }),
    senderAccountName: varchar("sender_account_name", { length: 255 }),

    // Recipient Bank (Resort's Bank)
    recipientBankName: varchar("recipient_bank_name", { length: 255 }).notNull(),
    recipientAccountNumber: varchar("recipient_account_number", { length: 100 }).notNull(),
    recipientAccountName: varchar("recipient_account_name", { length: 255 }).notNull(),

    // Transfer Information
    transferDate: timestamp("transfer_date").notNull(),
    valueDate: timestamp("value_date"), // When funds become available
    amount: decimal("amount", { precision: 19, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("PHP").notNull(),

    // Verification
    isVerified: boolean("is_verified").default(false).notNull(),
    verifiedBy: uuid("verified_by"),
    // .references(() => users.id), // Commented for RED phase
    verifiedAt: timestamp("verified_at"),
    verificationMethod: varchar("verification_method", { length: 50 }), // manual, api, bank_statement

    // Documentation
    proofOfTransfer: text("proof_of_transfer"), // File path or URL
    bankStatement: text("bank_statement"), // File path or URL
    additionalDocuments: jsonb("additional_documents").$type<string[]>().default([]),

    // Status
    status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, verified, rejected, reconciled
    statusReason: text("status_reason"),

    // Reconciliation
    isReconciled: boolean("is_reconciled").default(false).notNull(),
    reconciledBy: uuid("reconciled_by"),
    // .references(() => users.id), // Commented for RED phase
    reconciledAt: timestamp("reconciled_at"),
    reconciliationNotes: text("reconciliation_notes"),

    // Metadata
    notes: text("notes"),
    metadata: jsonb("metadata").default({}),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Unique reference number per project
    uniqueReferenceNumber: unique("bank_transfers_project_reference_unique").on(
      table.projectId,
      table.referenceNumber
    ),

    // Business constraints
    amountPositive: check("bank_transfer_amount_positive", `${table.amount.name} > 0`),

    // Performance indexes
    projectIdIdx: index("idx_bank_transfer_project_id").on(table.projectId),
    paymentTransactionIdx: index("idx_bank_transfer_payment_transaction").on(
      table.paymentTransactionId
    ),
    statusIdx: index("idx_bank_transfer_status").on(table.projectId, table.status),
    transferDateIdx: index("idx_bank_transfer_date").on(table.projectId, table.transferDate),
    verifiedIdx: index("idx_bank_transfer_verified").on(table.projectId, table.isVerified),
  })
);

// =============================================
// Refund Transactions Table - Refund tracking
// =============================================
export const refundTransactions = pgTable(
  "refund_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    // Refund Identification
    refundId: varchar("refund_id", { length: 100 }).notNull(),
    originalPaymentId: uuid("original_payment_id").notNull(),
    // .references(() => paymentTransactions.id), // Commented for RED phase

    // Refund Details
    refundType: varchar("refund_type", { length: 50 }).notNull(), // full, partial, credit_note
    refundReason: varchar("refund_reason", { length: 100 }).notNull(), // cancellation, dispute, error, other
    refundDescription: text("refund_description"),

    // Financial Information
    originalAmount: decimal("original_amount", { precision: 19, scale: 2 }).notNull(),
    refundAmount: decimal("refund_amount", { precision: 19, scale: 2 }).notNull(),
    refundFee: decimal("refund_fee", { precision: 19, scale: 2 }).default("0"),
    netRefundAmount: decimal("net_refund_amount", { precision: 19, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("PHP").notNull(),

    // Processing
    refundMethod: varchar("refund_method", { length: 50 }).notNull(), // same_as_payment, cash, bank_transfer, credit_note
    status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, processing, completed, failed, cancelled
    processedAt: timestamp("processed_at"),
    completedAt: timestamp("completed_at"),

    // Gateway Information
    gatewayRefundId: varchar("gateway_refund_id", { length: 255 }),
    gatewayResponse: jsonb("gateway_response").default({}),
    gatewayStatus: varchar("gateway_status", { length: 100 }),

    // Credit Note (if applicable)
    creditNoteNumber: varchar("credit_note_number", { length: 100 }),
    creditNoteIssuedAt: timestamp("credit_note_issued_at"),
    creditNoteExpiresAt: timestamp("credit_note_expires_at"),
    creditNoteUsed: boolean("credit_note_used").default(false),
    creditNoteUsedAt: timestamp("credit_note_used_at"),

    // Approval
    requiresApproval: boolean("requires_approval").default(true).notNull(),
    approvedBy: uuid("approved_by"),
    // .references(() => users.id), // Commented for RED phase
    approvedAt: timestamp("approved_at"),
    approvalNotes: text("approval_notes"),

    // Customer Information
    customerNotified: boolean("customer_notified").default(false).notNull(),
    customerNotifiedAt: timestamp("customer_notified_at"),
    customerEmail: varchar("customer_email", { length: 255 }),
    customerPhone: varchar("customer_phone", { length: 20 }),

    // Documentation
    supportingDocuments: jsonb("supporting_documents").$type<string[]>().default([]),

    // Metadata
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
    // Unique refund ID per project
    uniqueRefundId: unique("refund_transactions_project_refund_unique").on(
      table.projectId,
      table.refundId
    ),
    // Unique credit note number per project
    uniqueCreditNote: unique("refund_transactions_project_credit_note_unique").on(
      table.projectId,
      table.creditNoteNumber
    ),

    // Business constraints
    originalAmountPositive: check(
      "refund_original_amount_positive",
      `${table.originalAmount.name} > 0`
    ),
    refundAmountPositive: check("refund_amount_positive", `${table.refundAmount.name} > 0`),
    refundNotExceedOriginal: check(
      "refund_not_exceed_original",
      `${table.refundAmount.name} <= ${table.originalAmount.name}`
    ),
    refundFeePositive: check("refund_fee_positive", `${table.refundFee.name} >= 0`),
    netRefundPositive: check("refund_net_amount_positive", `${table.netRefundAmount.name} >= 0`),

    // Performance indexes
    projectIdIdx: index("idx_refund_project_id").on(table.projectId),
    originalPaymentIdx: index("idx_refund_original_payment").on(table.originalPaymentId),
    statusIdx: index("idx_refund_status").on(table.projectId, table.status),
    refundTypeIdx: index("idx_refund_type").on(table.projectId, table.refundType),
    creditNoteIdx: index("idx_refund_credit_note").on(table.projectId, table.creditNoteNumber),
    createdAtIdx: index("idx_refund_created_at").on(table.projectId, table.createdAt),
  })
);

// =============================================
// Database Relations (Commented for RED phase)
// =============================================
// export const paymentTransactionsRelations = relations(paymentTransactions, ({ one, many }) => ({
//   project: one(projects, {
//     fields: [paymentTransactions.projectId],
//     references: [projects.id],
//   }),
//   booking: one(bookings, {
//     fields: [paymentTransactions.bookingId],
//     references: [bookings.id],
//   }),
//   createdByUser: one(users, {
//     fields: [paymentTransactions.createdBy],
//     references: [users.id],
//   }),
//   cashPayment: one(cashPayments),
//   bankTransfer: one(bankTransfers),
//   refunds: many(refundTransactions),
// }));

// export const paymentGatewaysRelations = relations(paymentGateways, ({ one }) => ({
//   project: one(projects, {
//     fields: [paymentGateways.projectId],
//     references: [projects.id],
//   }),
//   createdByUser: one(users, {
//     fields: [paymentGateways.createdBy],
//     references: [users.id],
//   }),
// }));

// export const cashPaymentsRelations = relations(cashPayments, ({ one }) => ({
//   project: one(projects, {
//     fields: [cashPayments.projectId],
//     references: [projects.id],
//   }),
//   paymentTransaction: one(paymentTransactions, {
//     fields: [cashPayments.paymentTransactionId],
//     references: [paymentTransactions.id],
//   }),
//   countedByUser: one(users, {
//     fields: [cashPayments.countedBy],
//     references: [users.id],
//   }),
// }));

// export const bankTransfersRelations = relations(bankTransfers, ({ one }) => ({
//   project: one(projects, {
//     fields: [bankTransfers.projectId],
//     references: [projects.id],
//   }),
//   paymentTransaction: one(paymentTransactions, {
//     fields: [bankTransfers.paymentTransactionId],
//     references: [paymentTransactions.id],
//   }),
//   verifiedByUser: one(users, {
//     fields: [bankTransfers.verifiedBy],
//     references: [users.id],
//   }),
// }));

// export const refundTransactionsRelations = relations(refundTransactions, ({ one }) => ({
//   project: one(projects, {
//     fields: [refundTransactions.projectId],
//     references: [projects.id],
//   }),
//   originalPayment: one(paymentTransactions, {
//     fields: [refundTransactions.originalPaymentId],
//     references: [paymentTransactions.id],
//   }),
//   approvedByUser: one(users, {
//     fields: [refundTransactions.approvedBy],
//     references: [users.id],
//   }),
//   createdByUser: one(users, {
//     fields: [refundTransactions.createdBy],
//     references: [users.id],
//   }),
// }));

// =============================================
// TypeScript Type Inference
// =============================================
export type PaymentTransaction = typeof paymentTransactions.$inferSelect;
export type NewPaymentTransaction = typeof paymentTransactions.$inferInsert;
export type PaymentGateway = typeof paymentGateways.$inferSelect;
export type NewPaymentGateway = typeof paymentGateways.$inferInsert;
export type CashPayment = typeof cashPayments.$inferSelect;
export type NewCashPayment = typeof cashPayments.$inferInsert;
export type BankTransfer = typeof bankTransfers.$inferSelect;
export type NewBankTransfer = typeof bankTransfers.$inferInsert;
export type RefundTransaction = typeof refundTransactions.$inferSelect;
export type NewRefundTransaction = typeof refundTransactions.$inferInsert;
