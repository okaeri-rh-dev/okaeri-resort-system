/**
 * Commission Management Database Schema
 *
 * Drizzle ORM schema definitions for commission tracking and settlements
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
// Commissions Table - Commission calculations
// =============================================
export const commissions = pgTable(
  "commissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    // Commission Identification
    commissionCode: varchar("commission_code", { length: 50 }).notNull(),
    commissionType: varchar("commission_type", { length: 50 }).notNull(), // booking, referral, agent, partner, staff

    // Beneficiary Information
    beneficiaryType: varchar("beneficiary_type", { length: 50 }).notNull(), // staff, agent, partner, referrer
    beneficiaryId: uuid("beneficiary_id").notNull(), // Could be user, partner, or external agent
    beneficiaryName: varchar("beneficiary_name", { length: 255 }).notNull(),
    beneficiaryEmail: varchar("beneficiary_email", { length: 255 }),
    beneficiaryPhone: varchar("beneficiary_phone", { length: 20 }),

    // Source Transaction
    sourceType: varchar("source_type", { length: 50 }).notNull(), // booking, income_transaction, package_sale
    sourceId: uuid("source_id").notNull(), // Reference to source transaction
    sourceReference: varchar("source_reference", { length: 100 }), // Source transaction code/reference
    sourceDate: timestamp("source_date").notNull(),

    // Calculation Details
    baseAmount: decimal("base_amount", { precision: 19, scale: 2 }).notNull(), // Amount commission is calculated from
    commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).notNull(), // Percentage rate (0.00 to 100.00)
    commissionAmount: decimal("commission_amount", { precision: 19, scale: 2 }).notNull(),

    // Tier Information (if applicable)
    tierId: uuid("tier_id"), // Link to commission tier
    // .references(() => commissionTiers.id), // Commented for RED phase
    tierName: varchar("tier_name", { length: 100 }),

    // Adjustments
    adjustmentAmount: decimal("adjustment_amount", { precision: 19, scale: 2 }).default("0"),
    adjustmentReason: text("adjustment_reason"),
    finalAmount: decimal("final_amount", { precision: 19, scale: 2 }).notNull(),

    // Tax and Deductions
    withholdingTaxRate: decimal("withholding_tax_rate", { precision: 5, scale: 2 }).default("0"), // Philippine withholding tax
    withholdingTaxAmount: decimal("withholding_tax_amount", { precision: 19, scale: 2 }).default(
      "0"
    ),
    otherDeductions: decimal("other_deductions", { precision: 19, scale: 2 }).default("0"),
    netAmount: decimal("net_amount", { precision: 19, scale: 2 }).notNull(),

    // Status and Settlement
    status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, approved, settled, cancelled, disputed
    approvedBy: uuid("approved_by"),
    // .references(() => users.id), // Commented for RED phase
    approvedAt: timestamp("approved_at"),
    settlementId: uuid("settlement_id"), // Link to batch settlement
    // .references(() => commissionSettlements.id), // Commented for RED phase
    settledAt: timestamp("settled_at"),

    // Payment Information
    paymentMethod: varchar("payment_method", { length: 50 }), // bank_transfer, cash, gcash, check
    paymentReference: varchar("payment_reference", { length: 100 }),
    paymentDate: date("payment_date"),

    // Period Information
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),

    // Notes and Documentation
    notes: text("notes"),
    supportingDocuments: jsonb("supporting_documents").$type<string[]>().default([]),

    // Metadata
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
    // Unique commission code per project
    uniqueCommissionCode: unique("commissions_project_code_unique").on(
      table.projectId,
      table.commissionCode
    ),

    // Business constraints
    baseAmountPositive: check("commission_base_amount_positive", `${table.baseAmount.name} > 0`),
    commissionRateRange: check(
      "commission_rate_range",
      `${table.commissionRate.name} >= 0 AND ${table.commissionRate.name} <= 100`
    ),
    commissionAmountPositive: check(
      "commission_amount_positive",
      `${table.commissionAmount.name} >= 0`
    ),
    finalAmountPositive: check(
      "commission_final_amount_positive",
      `${table.finalAmount.name} >= 0`
    ),
    withholdingTaxRange: check(
      "commission_withholding_tax_range",
      `${table.withholdingTaxRate.name} >= 0 AND ${table.withholdingTaxRate.name} <= 100`
    ),
    netAmountPositive: check("commission_net_amount_positive", `${table.netAmount.name} >= 0`),
    periodValid: check(
      "commission_period_valid",
      `${table.periodEnd.name} >= ${table.periodStart.name}`
    ),

    // Performance indexes
    projectIdIdx: index("idx_commission_project_id").on(table.projectId),
    beneficiaryIdx: index("idx_commission_beneficiary").on(table.projectId, table.beneficiaryId),
    sourceIdx: index("idx_commission_source").on(table.sourceType, table.sourceId),
    statusIdx: index("idx_commission_status").on(table.projectId, table.status),
    settlementIdx: index("idx_commission_settlement").on(table.settlementId),
    periodIdx: index("idx_commission_period").on(
      table.projectId,
      table.periodStart,
      table.periodEnd
    ),
    typeIdx: index("idx_commission_type").on(table.projectId, table.commissionType),
  })
);

// =============================================
// Commission Settlements Table - Batch settlements
// =============================================
export const commissionSettlements = pgTable(
  "commission_settlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    // Settlement Identification
    settlementCode: varchar("settlement_code", { length: 50 }).notNull(),
    settlementType: varchar("settlement_type", { length: 50 }).notNull(), // regular, bonus, adjustment, final

    // Period Information
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    settlementDate: date("settlement_date").notNull(),

    // Beneficiary (if single beneficiary settlement)
    beneficiaryId: uuid("beneficiary_id"),
    beneficiaryName: varchar("beneficiary_name", { length: 255 }),
    beneficiaryType: varchar("beneficiary_type", { length: 50 }), // staff, agent, partner

    // Financial Summary
    totalCommissions: integer("total_commissions").notNull().default(0), // Count of commissions
    grossAmount: decimal("gross_amount", { precision: 19, scale: 2 }).notNull(),
    totalAdjustments: decimal("total_adjustments", { precision: 19, scale: 2 }).default("0"),
    totalWithholdingTax: decimal("total_withholding_tax", { precision: 19, scale: 2 }).default("0"),
    totalDeductions: decimal("total_deductions", { precision: 19, scale: 2 }).default("0"),
    netAmount: decimal("net_amount", { precision: 19, scale: 2 }).notNull(),

    // Payment Information
    paymentMethod: varchar("payment_method", { length: 50 }).notNull(), // bank_transfer, cash, gcash, check
    paymentStatus: varchar("payment_status", { length: 50 }).notNull().default("pending"), // pending, processing, completed, failed
    paymentReference: varchar("payment_reference", { length: 100 }),
    paymentDate: date("payment_date"),

    // Bank Details (for transfers)
    bankName: varchar("bank_name", { length: 255 }),
    bankAccountNumber: varchar("bank_account_number", { length: 100 }),
    bankAccountName: varchar("bank_account_name", { length: 255 }),

    // Check Details (if applicable)
    checkNumber: varchar("check_number", { length: 50 }),
    checkDate: date("check_date"),
    checkIssuedBy: varchar("check_issued_by", { length: 255 }),

    // Settlement Details
    commissionIds: jsonb("commission_ids").$type<string[]>().notNull().default([]), // Array of commission IDs in this settlement
    settlementBreakdown: jsonb("settlement_breakdown")
      .$type<
        Array<{
          commissionId: string;
          commissionCode: string;
          amount: number;
          tax: number;
          net: number;
        }>
      >()
      .default([]),

    // Approval
    requiresApproval: boolean("requires_approval").default(true).notNull(),
    approvedBy: uuid("approved_by"),
    // .references(() => users.id), // Commented for RED phase
    approvedAt: timestamp("approved_at"),
    approvalNotes: text("approval_notes"),

    // Documentation
    settlementDocument: text("settlement_document"), // File path or URL
    supportingDocuments: jsonb("supporting_documents").$type<string[]>().default([]),

    // Status
    status: varchar("status", { length: 50 }).notNull().default("draft"), // draft, pending_approval, approved, paid, cancelled
    statusReason: text("status_reason"),

    // Notes
    notes: text("notes"),
    internalNotes: text("internal_notes"),

    // Metadata
    tags: jsonb("tags").$type<string[]>().default([]),
    metadata: jsonb("metadata").default({}),

    // Audit Fields
    createdBy: uuid("created_by").notNull(),
    // .references(() => users.id), // Commented for RED phase
    updatedBy: uuid("updated_by"),
    // .references(() => users.id), // Commented for RED phase
    processedBy: uuid("processed_by"),
    // .references(() => users.id), // Commented for RED phase
    processedAt: timestamp("processed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Unique settlement code per project
    uniqueSettlementCode: unique("settlements_project_code_unique").on(
      table.projectId,
      table.settlementCode
    ),

    // Business constraints
    periodValid: check(
      "settlement_period_valid",
      `${table.periodEnd.name} >= ${table.periodStart.name}`
    ),
    commissionsPositive: check(
      "settlement_commissions_positive",
      `${table.totalCommissions.name} >= 0`
    ),
    grossAmountPositive: check(
      "settlement_gross_amount_positive",
      `${table.grossAmount.name} >= 0`
    ),
    netAmountPositive: check("settlement_net_amount_positive", `${table.netAmount.name} >= 0`),

    // Performance indexes
    projectIdIdx: index("idx_settlement_project_id").on(table.projectId),
    beneficiaryIdx: index("idx_settlement_beneficiary").on(table.projectId, table.beneficiaryId),
    statusIdx: index("idx_settlement_status").on(table.projectId, table.status),
    periodIdx: index("idx_settlement_period").on(
      table.projectId,
      table.periodStart,
      table.periodEnd
    ),
    settlementDateIdx: index("idx_settlement_date").on(table.projectId, table.settlementDate),
    paymentStatusIdx: index("idx_settlement_payment_status").on(
      table.projectId,
      table.paymentStatus
    ),
  })
);

// =============================================
// Commission Tiers Table - Tiered rate structures
// =============================================
export const commissionTiers = pgTable(
  "commission_tiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    // Tier Information
    tierCode: varchar("tier_code", { length: 50 }).notNull(),
    tierName: varchar("tier_name", { length: 255 }).notNull(),
    tierDescription: text("tier_description"),

    // Tier Type
    tierType: varchar("tier_type", { length: 50 }).notNull(), // volume_based, revenue_based, performance_based, seniority_based
    calculationType: varchar("calculation_type", { length: 50 }).notNull(), // progressive, flat, cumulative

    // Applicable To
    appliesToType: varchar("applies_to_type", { length: 50 }).notNull(), // staff, agent, partner, all
    appliesToIds: jsonb("applies_to_ids").$type<string[]>().default([]), // Specific IDs if not all

    // Tier Levels
    tierLevels: jsonb("tier_levels")
      .$type<
        Array<{
          level: number;
          name: string;
          minValue: number; // Minimum value to qualify
          maxValue?: number; // Maximum value (null for highest tier)
          rate: number; // Commission rate percentage
          fixedBonus?: number; // Optional fixed bonus
          description?: string;
        }>
      >()
      .notNull()
      .default([]),

    // Performance Metrics (for performance-based tiers)
    performanceMetrics: jsonb("performance_metrics")
      .$type<{
        metricType?: string; // bookings_count, revenue_total, customer_satisfaction
        evaluationPeriod?: string; // monthly, quarterly, yearly
        targetValues?: Record<string, number>;
      }>()
      .default({}),

    // Validity
    effectiveFrom: date("effective_from").notNull(),
    effectiveUntil: date("effective_until"),
    isActive: boolean("is_active").default(true).notNull(),

    // Reset Configuration
    resetPeriod: varchar("reset_period", { length: 50 }), // monthly, quarterly, yearly, never
    lastResetDate: date("last_reset_date"),
    nextResetDate: date("next_reset_date"),

    // Bonus Configuration
    bonusEnabled: boolean("bonus_enabled").default(false).notNull(),
    bonusRules: jsonb("bonus_rules")
      .$type<{
        targetAchievementBonus?: number;
        consecutiveMonthsBonus?: number;
        yearEndBonus?: number;
        specialEventBonus?: number;
      }>()
      .default({}),

    // Priority (when multiple tiers apply)
    priority: integer("priority").default(0).notNull(),

    // Statistics
    activeUsers: integer("active_users").default(0).notNull(),
    totalCommissionsPaid: decimal("total_commissions_paid", { precision: 19, scale: 2 }).default(
      "0"
    ),

    // Metadata
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
    // Unique tier code per project
    uniqueTierCode: unique("commission_tiers_project_code_unique").on(
      table.projectId,
      table.tierCode
    ),

    // Business constraints
    priorityPositive: check("tier_priority_positive", `${table.priority.name} >= 0`),
    activeUsersPositive: check("tier_active_users_positive", `${table.activeUsers.name} >= 0`),
    totalCommissionsPositive: check(
      "tier_total_commissions_positive",
      `${table.totalCommissionsPaid.name} >= 0`
    ),

    // Performance indexes
    projectIdIdx: index("idx_tier_project_id").on(table.projectId),
    projectActiveIdx: index("idx_tier_project_active").on(table.projectId, table.isActive),
    tierTypeIdx: index("idx_tier_type").on(table.projectId, table.tierType),
    appliesToIdx: index("idx_tier_applies_to").on(table.projectId, table.appliesToType),
    effectiveFromIdx: index("idx_tier_effective_from").on(table.projectId, table.effectiveFrom),
    priorityIdx: index("idx_tier_priority").on(table.projectId, table.priority),
  })
);

// =============================================
// Database Relations (Commented for RED phase)
// =============================================
// export const commissionsRelations = relations(commissions, ({ one }) => ({
//   project: one(projects, {
//     fields: [commissions.projectId],
//     references: [projects.id],
//   }),
//   tier: one(commissionTiers, {
//     fields: [commissions.tierId],
//     references: [commissionTiers.id],
//   }),
//   settlement: one(commissionSettlements, {
//     fields: [commissions.settlementId],
//     references: [commissionSettlements.id],
//   }),
//   approvedByUser: one(users, {
//     fields: [commissions.approvedBy],
//     references: [users.id],
//   }),
//   createdByUser: one(users, {
//     fields: [commissions.createdBy],
//     references: [users.id],
//   }),
// }));

// export const commissionSettlementsRelations = relations(commissionSettlements, ({ one, many }) => ({
//   project: one(projects, {
//     fields: [commissionSettlements.projectId],
//     references: [projects.id],
//   }),
//   commissions: many(commissions),
//   approvedByUser: one(users, {
//     fields: [commissionSettlements.approvedBy],
//     references: [users.id],
//   }),
//   createdByUser: one(users, {
//     fields: [commissionSettlements.createdBy],
//     references: [users.id],
//   }),
//   processedByUser: one(users, {
//     fields: [commissionSettlements.processedBy],
//     references: [users.id],
//   }),
// }));

// export const commissionTiersRelations = relations(commissionTiers, ({ one, many }) => ({
//   project: one(projects, {
//     fields: [commissionTiers.projectId],
//     references: [projects.id],
//   }),
//   commissions: many(commissions),
//   createdByUser: one(users, {
//     fields: [commissionTiers.createdBy],
//     references: [users.id],
//   }),
// }));

// =============================================
// TypeScript Type Inference
// =============================================
export type Commission = typeof commissions.$inferSelect;
export type NewCommission = typeof commissions.$inferInsert;
export type CommissionSettlement = typeof commissionSettlements.$inferSelect;
export type NewCommissionSettlement = typeof commissionSettlements.$inferInsert;
export type CommissionTier = typeof commissionTiers.$inferSelect;
export type NewCommissionTier = typeof commissionTiers.$inferInsert;
