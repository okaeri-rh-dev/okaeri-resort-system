/**
 * Income Management Database Schema
 *
 * Drizzle ORM schema definitions for income tracking and management
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
import { bookings, rooms } from "./booking";

// =============================================
// Income Transactions Table - Core income recording
// =============================================
export const incomeTransactions = pgTable(
  "income_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    // Transaction Details
    transactionCode: varchar("transaction_code", { length: 50 }).notNull(),
    transactionDate: timestamp("transaction_date").notNull(),
    transactionType: varchar("transaction_type", { length: 50 }).notNull(), // booking, addon, package, other

    // Financial Details
    grossAmount: decimal("gross_amount", { precision: 19, scale: 2 }).notNull(),
    discountAmount: decimal("discount_amount", { precision: 19, scale: 2 }).default("0").notNull(),
    taxAmount: decimal("tax_amount", { precision: 19, scale: 2 }).default("0").notNull(),
    serviceChargeAmount: decimal("service_charge_amount", { precision: 19, scale: 2 })
      .default("0")
      .notNull(),
    netAmount: decimal("net_amount", { precision: 19, scale: 2 }).notNull(),

    // Related Entities
    bookingId: uuid("booking_id"), // Optional link to booking
    // .references(() => bookings.id, { onDelete: "set null" }), // Commented for RED phase
    roomId: uuid("room_id"), // Optional link to room
    // .references(() => rooms.id, { onDelete: "set null" }), // Commented for RED phase
    customerId: uuid("customer_id"), // Reference to customer (could be guest)

    // Income Category
    incomeCategory: varchar("income_category", { length: 100 }).notNull(), // room, amenity, food, beverage, etc.
    incomeSubcategory: varchar("income_subcategory", { length: 100 }),

    // Payment Information
    paymentMethod: varchar("payment_method", { length: 50 }).notNull(), // cash, gcash, bank_transfer, credit_card
    paymentStatus: varchar("payment_status", { length: 50 }).notNull().default("pending"), // pending, completed, failed, refunded
    paymentReference: varchar("payment_reference", { length: 255 }),

    // Additional Details
    description: text("description"),
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
    // Unique transaction code per project
    uniqueTransactionCode: unique("income_transactions_project_code_unique").on(
      table.projectId,
      table.transactionCode
    ),

    // Business constraints
    grossAmountPositive: check("income_gross_amount_positive", `${table.grossAmount.name} >= 0`),
    discountAmountPositive: check(
      "income_discount_amount_positive",
      `${table.discountAmount.name} >= 0`
    ),
    taxAmountPositive: check("income_tax_amount_positive", `${table.taxAmount.name} >= 0`),
    serviceChargePositive: check(
      "income_service_charge_positive",
      `${table.serviceChargeAmount.name} >= 0`
    ),
    netAmountPositive: check("income_net_amount_positive", `${table.netAmount.name} >= 0`),

    // Performance indexes
    projectIdIdx: index("idx_income_project_id").on(table.projectId),
    projectDateIdx: index("idx_income_project_date").on(table.projectId, table.transactionDate),
    projectCategoryIdx: index("idx_income_project_category").on(
      table.projectId,
      table.incomeCategory
    ),
    projectStatusIdx: index("idx_income_project_status").on(table.projectId, table.paymentStatus),
    bookingIdx: index("idx_income_booking").on(table.bookingId),
    customerIdx: index("idx_income_customer").on(table.customerId),
    paymentMethodIdx: index("idx_income_payment_method").on(table.projectId, table.paymentMethod),
    dateRangeIdx: index("idx_income_date_range").on(table.transactionDate),
  })
);

// =============================================
// Income Allocations Table - Package component allocation
// =============================================
export const incomeAllocations = pgTable(
  "income_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    // Parent Transaction
    incomeTransactionId: uuid("income_transaction_id").notNull(),
    // .references(() => incomeTransactions.id, { onDelete: "cascade" }), // Commented for RED phase

    // Allocation Details
    allocationCategory: varchar("allocation_category", { length: 100 }).notNull(), // room, meal, amenity, etc.
    allocationDescription: text("allocation_description"),
    allocatedAmount: decimal("allocated_amount", { precision: 19, scale: 2 }).notNull(),
    allocatedPercentage: decimal("allocated_percentage", { precision: 5, scale: 2 }), // 0.00 to 100.00

    // Related Entity (optional)
    relatedEntityType: varchar("related_entity_type", { length: 50 }), // room, service, product
    relatedEntityId: uuid("related_entity_id"),

    // Metadata
    metadata: jsonb("metadata").default({}),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Business constraints
    allocatedAmountPositive: check(
      "allocation_amount_positive",
      `${table.allocatedAmount.name} >= 0`
    ),
    percentageRange: check(
      "allocation_percentage_range",
      `${table.allocatedPercentage.name} IS NULL OR (${table.allocatedPercentage.name} >= 0 AND ${table.allocatedPercentage.name} <= 100)`
    ),

    // Performance indexes
    projectIdIdx: index("idx_allocation_project_id").on(table.projectId),
    transactionIdx: index("idx_allocation_transaction").on(table.incomeTransactionId),
    categoryIdx: index("idx_allocation_category").on(table.projectId, table.allocationCategory),
    entityIdx: index("idx_allocation_entity").on(table.relatedEntityType, table.relatedEntityId),
  })
);

// =============================================
// Package Deals Table - Package configurations
// =============================================
export const packageDeals = pgTable(
  "package_deals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    // Package Information
    packageCode: varchar("package_code", { length: 50 }).notNull(),
    packageName: varchar("package_name", { length: 255 }).notNull(),
    packageDescription: text("package_description"),
    packageType: varchar("package_type", { length: 50 }).notNull(), // standard, promo, seasonal, custom

    // Pricing
    basePrice: decimal("base_price", { precision: 19, scale: 2 }).notNull(),
    discountPercentage: decimal("discount_percentage", { precision: 5, scale: 2 }).default("0"),
    finalPrice: decimal("final_price", { precision: 19, scale: 2 }).notNull(),

    // Validity
    validFrom: date("valid_from").notNull(),
    validUntil: date("valid_until").notNull(),
    isActive: boolean("is_active").default(true).notNull(),

    // Package Components
    components: jsonb("components")
      .$type<
        Array<{
          type: string; // room, meal, amenity, service
          name: string;
          quantity: number;
          value: number;
          description?: string;
        }>
      >()
      .default([])
      .notNull(),

    // Terms and Conditions
    minimumStay: integer("minimum_stay").default(1),
    maximumGuests: integer("maximum_guests").default(2),
    advanceBookingRequired: integer("advance_booking_required"), // days
    cancellationPolicy: text("cancellation_policy"),
    termsAndConditions: text("terms_and_conditions"),

    // Usage Tracking
    usageCount: integer("usage_count").default(0).notNull(),
    totalRevenue: decimal("total_revenue", { precision: 19, scale: 2 }).default("0").notNull(),

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
    // Unique package code per project
    uniquePackageCode: unique("package_deals_project_code_unique").on(
      table.projectId,
      table.packageCode
    ),

    // Business constraints
    basePricePositive: check("package_base_price_positive", `${table.basePrice.name} > 0`),
    finalPricePositive: check("package_final_price_positive", `${table.finalPrice.name} > 0`),
    discountRange: check(
      "package_discount_range",
      `${table.discountPercentage.name} >= 0 AND ${table.discountPercentage.name} <= 100`
    ),
    validityCheck: check(
      "package_validity_check",
      `${table.validUntil.name} >= ${table.validFrom.name}`
    ),
    minimumStayPositive: check("package_minimum_stay_positive", `${table.minimumStay.name} > 0`),
    maximumGuestsPositive: check(
      "package_maximum_guests_positive",
      `${table.maximumGuests.name} > 0`
    ),

    // Performance indexes
    projectIdIdx: index("idx_package_project_id").on(table.projectId),
    projectActiveIdx: index("idx_package_project_active").on(table.projectId, table.isActive),
    projectTypeIdx: index("idx_package_project_type").on(table.projectId, table.packageType),
    validityIdx: index("idx_package_validity").on(table.validFrom, table.validUntil),
    projectCodeIdx: index("idx_package_project_code").on(table.projectId, table.packageCode),
  })
);

// =============================================
// Seasonal Pricing Table - Rate adjustments
// =============================================
export const seasonalPricing = pgTable(
  "seasonal_pricing",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    // Pricing Information
    pricingCode: varchar("pricing_code", { length: 50 }).notNull(),
    pricingName: varchar("pricing_name", { length: 255 }).notNull(),
    pricingDescription: text("pricing_description"),
    pricingType: varchar("pricing_type", { length: 50 }).notNull(), // peak, off_peak, holiday, special_event

    // Adjustment Details
    adjustmentType: varchar("adjustment_type", { length: 20 }).notNull(), // percentage, fixed
    adjustmentValue: decimal("adjustment_value", { precision: 19, scale: 2 }).notNull(),
    isIncrease: boolean("is_increase").default(true).notNull(), // true for increase, false for discount

    // Applicable Entities
    appliesToRooms: boolean("applies_to_rooms").default(true).notNull(),
    appliesToPackages: boolean("applies_to_packages").default(false).notNull(),
    appliesToServices: boolean("applies_to_services").default(false).notNull(),
    specificRoomIds: jsonb("specific_room_ids").$type<string[]>().default([]),
    specificPackageIds: jsonb("specific_package_ids").$type<string[]>().default([]),

    // Validity Period
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    recurringYearly: boolean("recurring_yearly").default(false).notNull(),
    daysOfWeek: jsonb("days_of_week").$type<number[]>().default([]), // 0-6, Sunday-Saturday

    // Priority and Status
    priority: integer("priority").default(0).notNull(), // Higher priority overrides lower
    isActive: boolean("is_active").default(true).notNull(),

    // Conditions
    minimumStayRequired: integer("minimum_stay_required"),
    maximumStayAllowed: integer("maximum_stay_allowed"),
    advanceBookingDays: integer("advance_booking_days"),
    blackoutDates: jsonb("blackout_dates").$type<string[]>().default([]),

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
    // Unique pricing code per project
    uniquePricingCode: unique("seasonal_pricing_project_code_unique").on(
      table.projectId,
      table.pricingCode
    ),

    // Business constraints
    adjustmentValuePositive: check(
      "seasonal_adjustment_positive",
      `${table.adjustmentValue.name} >= 0`
    ),
    dateRangeValid: check(
      "seasonal_date_range_valid",
      `${table.endDate.name} >= ${table.startDate.name}`
    ),
    priorityPositive: check("seasonal_priority_positive", `${table.priority.name} >= 0`),

    // Performance indexes
    projectIdIdx: index("idx_seasonal_project_id").on(table.projectId),
    projectActiveIdx: index("idx_seasonal_project_active").on(table.projectId, table.isActive),
    dateRangeIdx: index("idx_seasonal_date_range").on(table.startDate, table.endDate),
    projectTypeIdx: index("idx_seasonal_project_type").on(table.projectId, table.pricingType),
    priorityIdx: index("idx_seasonal_priority").on(table.projectId, table.priority),
  })
);

// =============================================
// Service Charges Table - Service charge configurations
// =============================================
export const serviceCharges = pgTable(
  "service_charges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    // Service Charge Information
    chargeCode: varchar("charge_code", { length: 50 }).notNull(),
    chargeName: varchar("charge_name", { length: 255 }).notNull(),
    chargeDescription: text("charge_description"),
    chargeType: varchar("charge_type", { length: 50 }).notNull(), // cleaning, corkage, damage, late_checkout, etc.

    // Calculation Method
    calculationType: varchar("calculation_type", { length: 20 }).notNull(), // percentage, fixed
    chargeValue: decimal("charge_value", { precision: 19, scale: 2 }).notNull(),
    minimumCharge: decimal("minimum_charge", { precision: 19, scale: 2 }).default("0"),
    maximumCharge: decimal("maximum_charge", { precision: 19, scale: 2 }),

    // Applicability
    isAutomatic: boolean("is_automatic").default(false).notNull(), // Automatically applied
    isMandatory: boolean("is_mandatory").default(false).notNull(), // Cannot be waived
    isActive: boolean("is_active").default(true).notNull(),

    // Application Rules
    appliesToBookings: boolean("applies_to_bookings").default(true).notNull(),
    appliesToServices: boolean("applies_to_services").default(false).notNull(),
    conditions: jsonb("conditions")
      .$type<{
        minimumAmount?: number;
        maximumAmount?: number;
        roomTypes?: string[];
        bookingTypes?: string[];
        customerTypes?: string[];
      }>()
      .default({}),

    // Tax Treatment
    isTaxable: boolean("is_taxable").default(true).notNull(),
    taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("12"), // Philippine VAT

    // Distribution (for staff tips/service charges)
    isDistributable: boolean("is_distributable").default(false).notNull(),
    distributionRules: jsonb("distribution_rules")
      .$type<{
        staffPercentage?: number;
        managementPercentage?: number;
        poolPercentage?: number;
      }>()
      .default({}),

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
    // Unique charge code per project
    uniqueChargeCode: unique("service_charges_project_code_unique").on(
      table.projectId,
      table.chargeCode
    ),

    // Business constraints
    chargeValuePositive: check("service_charge_value_positive", `${table.chargeValue.name} >= 0`),
    minimumChargePositive: check(
      "service_minimum_charge_positive",
      `${table.minimumCharge.name} >= 0`
    ),
    maximumChargeValid: check(
      "service_maximum_charge_valid",
      `${table.maximumCharge.name} IS NULL OR ${table.maximumCharge.name} >= ${table.minimumCharge.name}`
    ),
    taxRateRange: check(
      "service_tax_rate_range",
      `${table.taxRate.name} >= 0 AND ${table.taxRate.name} <= 100`
    ),

    // Performance indexes
    projectIdIdx: index("idx_service_charge_project_id").on(table.projectId),
    projectActiveIdx: index("idx_service_charge_project_active").on(
      table.projectId,
      table.isActive
    ),
    projectTypeIdx: index("idx_service_charge_project_type").on(table.projectId, table.chargeType),
    automaticIdx: index("idx_service_charge_automatic").on(table.projectId, table.isAutomatic),
  })
);

// =============================================
// Database Relations (Commented for RED phase)
// =============================================
// export const incomeTransactionsRelations = relations(incomeTransactions, ({ one, many }) => ({
//   project: one(projects, {
//     fields: [incomeTransactions.projectId],
//     references: [projects.id],
//   }),
//   booking: one(bookings, {
//     fields: [incomeTransactions.bookingId],
//     references: [bookings.id],
//   }),
//   room: one(rooms, {
//     fields: [incomeTransactions.roomId],
//     references: [rooms.id],
//   }),
//   createdByUser: one(users, {
//     fields: [incomeTransactions.createdBy],
//     references: [users.id],
//   }),
//   allocations: many(incomeAllocations),
// }));

// export const incomeAllocationsRelations = relations(incomeAllocations, ({ one }) => ({
//   project: one(projects, {
//     fields: [incomeAllocations.projectId],
//     references: [projects.id],
//   }),
//   transaction: one(incomeTransactions, {
//     fields: [incomeAllocations.incomeTransactionId],
//     references: [incomeTransactions.id],
//   }),
// }));

// export const packageDealsRelations = relations(packageDeals, ({ one }) => ({
//   project: one(projects, {
//     fields: [packageDeals.projectId],
//     references: [projects.id],
//   }),
//   createdByUser: one(users, {
//     fields: [packageDeals.createdBy],
//     references: [users.id],
//   }),
// }));

// export const seasonalPricingRelations = relations(seasonalPricing, ({ one }) => ({
//   project: one(projects, {
//     fields: [seasonalPricing.projectId],
//     references: [projects.id],
//   }),
//   createdByUser: one(users, {
//     fields: [seasonalPricing.createdBy],
//     references: [users.id],
//   }),
// }));

// export const serviceChargesRelations = relations(serviceCharges, ({ one }) => ({
//   project: one(projects, {
//     fields: [serviceCharges.projectId],
//     references: [projects.id],
//   }),
//   createdByUser: one(users, {
//     fields: [serviceCharges.createdBy],
//     references: [users.id],
//   }),
// }));

// =============================================
// TypeScript Type Inference
// =============================================
export type IncomeTransaction = typeof incomeTransactions.$inferSelect;
export type NewIncomeTransaction = typeof incomeTransactions.$inferInsert;
export type IncomeAllocation = typeof incomeAllocations.$inferSelect;
export type NewIncomeAllocation = typeof incomeAllocations.$inferInsert;
export type PackageDeal = typeof packageDeals.$inferSelect;
export type NewPackageDeal = typeof packageDeals.$inferInsert;
export type SeasonalPricing = typeof seasonalPricing.$inferSelect;
export type NewSeasonalPricing = typeof seasonalPricing.$inferInsert;
export type ServiceCharge = typeof serviceCharges.$inferSelect;
export type NewServiceCharge = typeof serviceCharges.$inferInsert;
