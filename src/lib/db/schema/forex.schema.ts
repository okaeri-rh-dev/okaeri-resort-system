/**
 * Foreign Exchange Management Database Schema
 *
 * Drizzle ORM schema definitions for currency exchange and forex tracking
 * with application-level multi-tenant isolation using project_id filtering.
 * All monetary values use decimal(19, 2) for precision.
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
  time,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { projects, users } from "./global";

// =============================================
// Currencies Table - Supported currencies
// =============================================
export const currencies = pgTable(
  "currencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    // Currency Information
    currencyCode: varchar("currency_code", { length: 3 }).notNull(), // ISO 4217 code (USD, EUR, JPY, CNY, KRW, etc.)
    currencyName: varchar("currency_name", { length: 100 }).notNull(),
    currencySymbol: varchar("currency_symbol", { length: 10 }).notNull(),

    // Country Information
    countryCode: varchar("country_code", { length: 2 }), // ISO 3166-1 alpha-2
    countryName: varchar("country_name", { length: 100 }),

    // Display Configuration
    decimalPlaces: integer("decimal_places").default(2).notNull(),
    symbolPosition: varchar("symbol_position", { length: 10 }).default("before").notNull(), // before, after
    thousandsSeparator: varchar("thousands_separator", { length: 5 }).default(","),
    decimalSeparator: varchar("decimal_separator", { length: 5 }).default("."),

    // Exchange Configuration
    isBaseCurrency: boolean("is_base_currency").default(false).notNull(), // PHP is typically base
    isActive: boolean("is_active").default(true).notNull(),
    isSupported: boolean("is_supported").default(true).notNull(),

    // Conversion Settings
    defaultExchangeRate: decimal("default_exchange_rate", { precision: 10, scale: 6 }), // Fallback rate to PHP
    marginPercentage: decimal("margin_percentage", { precision: 5, scale: 2 }).default("0"), // Markup/markdown for customer rates

    // Update Configuration
    autoUpdate: boolean("auto_update").default(true).notNull(), // Auto-fetch latest rates
    updateFrequency: varchar("update_frequency", { length: 50 }).default("daily"), // realtime, hourly, daily
    lastUpdatedAt: timestamp("last_updated_at"),
    lastUpdateSource: varchar("last_update_source", { length: 100 }), // API source or manual

    // Popular Denominations (for cash handling)
    cashDenominations: jsonb("cash_denominations").$type<number[]>().default([]),

    // Restrictions
    minimumExchange: decimal("minimum_exchange", { precision: 19, scale: 2 }),
    maximumExchange: decimal("maximum_exchange", { precision: 19, scale: 2 }),

    // Statistics
    totalTransactions: integer("total_transactions").default(0).notNull(),
    totalVolumeInPhp: decimal("total_volume_in_php", { precision: 19, scale: 2 }).default("0"),

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
    // Unique currency code per project
    uniqueCurrencyCode: unique("currencies_project_code_unique").on(
      table.projectId,
      table.currencyCode
    ),

    // Business constraints
    decimalPlacesRange: check(
      "currency_decimal_places_range",
      `${table.decimalPlaces.name} >= 0 AND ${table.decimalPlaces.name} <= 4`
    ),
    marginPercentageRange: check(
      "currency_margin_percentage_range",
      `${table.marginPercentage.name} >= -100 AND ${table.marginPercentage.name} <= 100`
    ),
    minimumExchangePositive: check(
      "currency_minimum_exchange_positive",
      `${table.minimumExchange.name} IS NULL OR ${table.minimumExchange.name} > 0`
    ),
    maximumExchangeValid: check(
      "currency_maximum_exchange_valid",
      `${table.maximumExchange.name} IS NULL OR ${table.minimumExchange.name} IS NULL OR ${table.maximumExchange.name} >= ${table.minimumExchange.name}`
    ),

    // Performance indexes
    projectIdIdx: index("idx_currency_project_id").on(table.projectId),
    projectActiveIdx: index("idx_currency_project_active").on(table.projectId, table.isActive),
    currencyCodeIdx: index("idx_currency_code").on(table.projectId, table.currencyCode),
    baseCurrencyIdx: index("idx_currency_base").on(table.projectId, table.isBaseCurrency),
  })
);

// =============================================
// Exchange Rates Table - Daily rates
// =============================================
export const exchangeRates = pgTable(
  "exchange_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    // Rate Information
    fromCurrency: varchar("from_currency", { length: 3 }).notNull(),
    toCurrency: varchar("to_currency", { length: 3 }).notNull(),
    rateDate: date("rate_date").notNull(),
    rateTime: time("rate_time"), // For intraday rates

    // Exchange Rates
    buyRate: decimal("buy_rate", { precision: 10, scale: 6 }).notNull(), // Bank buys foreign currency
    sellRate: decimal("sell_rate", { precision: 10, scale: 6 }).notNull(), // Bank sells foreign currency
    midRate: decimal("mid_rate", { precision: 10, scale: 6 }).notNull(), // Middle rate

    // Customer Rates (with margin applied)
    customerBuyRate: decimal("customer_buy_rate", { precision: 10, scale: 6 }),
    customerSellRate: decimal("customer_sell_rate", { precision: 10, scale: 6 }),

    // Rate Source
    source: varchar("source", { length: 100 }).notNull(), // manual, bsp, xe, fixer, etc.
    sourceReference: varchar("source_reference", { length: 255 }), // API response ID or reference
    isOfficial: boolean("is_official").default(false).notNull(), // Official rate from central bank

    // Rate Type
    rateType: varchar("rate_type", { length: 50 }).notNull().default("daily"), // spot, daily, monthly_average

    // Validity
    validFrom: timestamp("valid_from").notNull(),
    validUntil: timestamp("valid_until"),
    isActive: boolean("is_active").default(true).notNull(),

    // Override Information (for manual rates)
    isManualOverride: boolean("is_manual_override").default(false).notNull(),
    overrideReason: text("override_reason"),
    overrideBy: uuid("override_by"),
    // .references(() => users.id), // Commented for RED phase
    overrideAt: timestamp("override_at"),

    // Historical Tracking
    previousRate: decimal("previous_rate", { precision: 10, scale: 6 }),
    changeAmount: decimal("change_amount", { precision: 10, scale: 6 }),
    changePercentage: decimal("change_percentage", { precision: 5, scale: 2 }),

    // Statistics
    usageCount: integer("usage_count").default(0).notNull(),
    totalVolumeExchanged: decimal("total_volume_exchanged", { precision: 19, scale: 2 }).default(
      "0"
    ),

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
    // Unique rate per currency pair per date/time per project
    uniqueRate: unique("exchange_rates_unique").on(
      table.projectId,
      table.fromCurrency,
      table.toCurrency,
      table.rateDate,
      table.rateTime
    ),

    // Business constraints
    buyRatePositive: check("exchange_buy_rate_positive", `${table.buyRate.name} > 0`),
    sellRatePositive: check("exchange_sell_rate_positive", `${table.sellRate.name} > 0`),
    midRatePositive: check("exchange_mid_rate_positive", `${table.midRate.name} > 0`),
    rateSpreadValid: check(
      "exchange_rate_spread_valid",
      `${table.sellRate.name} >= ${table.buyRate.name}`
    ),
    changePercentageRange: check(
      "exchange_change_percentage_range",
      `${table.changePercentage.name} IS NULL OR (${table.changePercentage.name} >= -100 AND ${table.changePercentage.name} <= 1000)`
    ),

    // Performance indexes
    projectIdIdx: index("idx_exchange_rate_project_id").on(table.projectId),
    currencyPairIdx: index("idx_exchange_rate_pair").on(
      table.projectId,
      table.fromCurrency,
      table.toCurrency
    ),
    rateDateIdx: index("idx_exchange_rate_date").on(table.projectId, table.rateDate),
    activeRatesIdx: index("idx_exchange_rate_active").on(
      table.projectId,
      table.isActive,
      table.rateDate
    ),
    validFromIdx: index("idx_exchange_rate_valid_from").on(table.projectId, table.validFrom),
  })
);

// =============================================
// Forex Transactions Table - Currency conversions
// =============================================
export const forexTransactions = pgTable(
  "forex_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    // Transaction Identification
    transactionCode: varchar("transaction_code", { length: 50 }).notNull(),
    transactionDate: timestamp("transaction_date").notNull(),
    transactionType: varchar("transaction_type", { length: 50 }).notNull(), // exchange, payment, refund, adjustment

    // Customer Information
    customerId: uuid("customer_id"),
    customerName: varchar("customer_name", { length: 255 }).notNull(),
    customerEmail: varchar("customer_email", { length: 255 }),
    customerPhone: varchar("customer_phone", { length: 20 }),
    customerIdNumber: varchar("customer_id_number", { length: 100 }), // Passport or ID
    customerIdType: varchar("customer_id_type", { length: 50 }), // passport, drivers_license, national_id

    // Currency Information
    fromCurrency: varchar("from_currency", { length: 3 }).notNull(),
    toCurrency: varchar("to_currency", { length: 3 }).notNull(),

    // Amount Information
    fromAmount: decimal("from_amount", { precision: 19, scale: 2 }).notNull(),
    exchangeRate: decimal("exchange_rate", { precision: 10, scale: 6 }).notNull(),
    toAmount: decimal("to_amount", { precision: 19, scale: 2 }).notNull(),

    // Rate Information
    rateType: varchar("rate_type", { length: 50 }).notNull(), // buy, sell, mid
    baseRate: decimal("base_rate", { precision: 10, scale: 6 }).notNull(), // Original rate before margin
    marginApplied: decimal("margin_applied", { precision: 5, scale: 2 }).default("0"), // Margin percentage
    finalRate: decimal("final_rate", { precision: 10, scale: 6 }).notNull(), // Rate after margin

    // Fees
    serviceFee: decimal("service_fee", { precision: 19, scale: 2 }).default("0"),
    commissionAmount: decimal("commission_amount", { precision: 19, scale: 2 }).default("0"),
    totalFees: decimal("total_fees", { precision: 19, scale: 2 }).default("0"),

    // Net Settlement
    netFromAmount: decimal("net_from_amount", { precision: 19, scale: 2 }).notNull(), // After fees
    netToAmount: decimal("net_to_amount", { precision: 19, scale: 2 }).notNull(), // After fees

    // PHP Equivalent (for reporting)
    phpEquivalent: decimal("php_equivalent", { precision: 19, scale: 2 }).notNull(),

    // Related Transaction
    relatedTransactionType: varchar("related_transaction_type", { length: 50 }), // booking, payment, etc.
    relatedTransactionId: uuid("related_transaction_id"),

    // Payment Method
    paymentMethod: varchar("payment_method", { length: 50 }).notNull(), // cash, bank_transfer, credit_card
    paymentReference: varchar("payment_reference", { length: 100 }),

    // Settlement
    settlementStatus: varchar("settlement_status", { length: 50 }).notNull().default("pending"), // pending, completed, cancelled
    settledAt: timestamp("settled_at"),
    settlementReference: varchar("settlement_reference", { length: 100 }),

    // Reversal Information (if applicable)
    isReversed: boolean("is_reversed").default(false).notNull(),
    reversalTransactionId: uuid("reversal_transaction_id"),
    reversalReason: text("reversal_reason"),
    reversedAt: timestamp("reversed_at"),
    reversedBy: uuid("reversed_by"),
    // .references(() => users.id), // Commented for RED phase

    // Compliance
    amlChecked: boolean("aml_checked").default(false).notNull(), // Anti-money laundering check
    amlCheckDate: timestamp("aml_check_date"),
    amlStatus: varchar("aml_status", { length: 50 }), // clear, flagged, under_review
    complianceNotes: text("compliance_notes"),

    // Documentation
    receiptNumber: varchar("receipt_number", { length: 100 }),
    documents: jsonb("documents").$type<string[]>().default([]), // File paths or URLs

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
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Unique transaction code per project
    uniqueTransactionCode: unique("forex_transactions_project_code_unique").on(
      table.projectId,
      table.transactionCode
    ),

    // Business constraints
    fromAmountPositive: check("forex_from_amount_positive", `${table.fromAmount.name} > 0`),
    toAmountPositive: check("forex_to_amount_positive", `${table.toAmount.name} > 0`),
    exchangeRatePositive: check("forex_exchange_rate_positive", `${table.exchangeRate.name} > 0`),
    baseRatePositive: check("forex_base_rate_positive", `${table.baseRate.name} > 0`),
    finalRatePositive: check("forex_final_rate_positive", `${table.finalRate.name} > 0`),
    serviceFeePositive: check("forex_service_fee_positive", `${table.serviceFee.name} >= 0`),
    commissionPositive: check("forex_commission_positive", `${table.commissionAmount.name} >= 0`),
    phpEquivalentPositive: check(
      "forex_php_equivalent_positive",
      `${table.phpEquivalent.name} > 0`
    ),

    // Performance indexes
    projectIdIdx: index("idx_forex_project_id").on(table.projectId),
    transactionDateIdx: index("idx_forex_transaction_date").on(
      table.projectId,
      table.transactionDate
    ),
    customerIdx: index("idx_forex_customer").on(table.projectId, table.customerId),
    currencyPairIdx: index("idx_forex_currency_pair").on(
      table.projectId,
      table.fromCurrency,
      table.toCurrency
    ),
    settlementStatusIdx: index("idx_forex_settlement_status").on(
      table.projectId,
      table.settlementStatus
    ),
    relatedTransactionIdx: index("idx_forex_related").on(
      table.relatedTransactionType,
      table.relatedTransactionId
    ),
    reversalIdx: index("idx_forex_reversal").on(table.reversalTransactionId),
    receiptNumberIdx: index("idx_forex_receipt").on(table.projectId, table.receiptNumber),
  })
);

// =============================================
// Database Relations (Commented for RED phase)
// =============================================
// export const currenciesRelations = relations(currencies, ({ one, many }) => ({
//   project: one(projects, {
//     fields: [currencies.projectId],
//     references: [projects.id],
//   }),
//   createdByUser: one(users, {
//     fields: [currencies.createdBy],
//     references: [users.id],
//   }),
//   exchangeRatesFrom: many(exchangeRates, {
//     relationName: "fromCurrency",
//   }),
//   exchangeRatesTo: many(exchangeRates, {
//     relationName: "toCurrency",
//   }),
// }));

// export const exchangeRatesRelations = relations(exchangeRates, ({ one }) => ({
//   project: one(projects, {
//     fields: [exchangeRates.projectId],
//     references: [projects.id],
//   }),
//   createdByUser: one(users, {
//     fields: [exchangeRates.createdBy],
//     references: [users.id],
//   }),
//   overrideByUser: one(users, {
//     fields: [exchangeRates.overrideBy],
//     references: [users.id],
//   }),
// }));

// export const forexTransactionsRelations = relations(forexTransactions, ({ one }) => ({
//   project: one(projects, {
//     fields: [forexTransactions.projectId],
//     references: [projects.id],
//   }),
//   createdByUser: one(users, {
//     fields: [forexTransactions.createdBy],
//     references: [users.id],
//   }),
//   reversedByUser: one(users, {
//     fields: [forexTransactions.reversedBy],
//     references: [users.id],
//   }),
//   reversalTransaction: one(forexTransactions, {
//     fields: [forexTransactions.reversalTransactionId],
//     references: [forexTransactions.id],
//   }),
// }));

// =============================================
// TypeScript Type Inference
// =============================================
export type Currency = typeof currencies.$inferSelect;
export type NewCurrency = typeof currencies.$inferInsert;
export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type NewExchangeRate = typeof exchangeRates.$inferInsert;
export type ForexTransaction = typeof forexTransactions.$inferSelect;
export type NewForexTransaction = typeof forexTransactions.$inferInsert;
