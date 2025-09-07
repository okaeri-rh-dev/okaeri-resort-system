/**
 * Discount Management Database Schema
 *
 * Philippine regulatory compliant discount management for:
 * - Senior Citizen discounts (RA 9994)
 * - PWD discounts (RA 10754)
 * - Promotional discounts
 * - Loyalty discounts
 */

import {
  pgTable,
  uuid,
  varchar,
  decimal,
  boolean,
  timestamp,
  date,
  jsonb,
  text,
  unique,
  check,
  index,
  integer,
} from "drizzle-orm/pg-core";
import { projects, users } from "./global";

// =============================================
// Discount Logs Table - BIR-compliant discount tracking
// =============================================
export const discountLogs = pgTable(
  "discount_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    // Discount Details
    discountCode: varchar("discount_code", { length: 50 }).notNull(),
    discountDate: timestamp("discount_date").notNull(),
    discountType: varchar("discount_type", { length: 50 }).notNull(), // senior, pwd, promotional, loyalty, group

    // Transaction Reference
    transactionType: varchar("transaction_type", { length: 50 }).notNull(), // booking, expense, income
    transactionId: uuid("transaction_id").notNull(),
    transactionCode: varchar("transaction_code", { length: 100 }),

    // Customer Information
    customerName: varchar("customer_name", { length: 255 }).notNull(),
    customerId: uuid("customer_id"),

    // Senior/PWD Specific (RA 9994 / RA 10754)
    idType: varchar("id_type", { length: 50 }), // senior_citizen, pwd, osca
    idNumber: varchar("id_number", { length: 100 }), // ID number for verification
    idExpiryDate: date("id_expiry_date"),
    bookletNumber: varchar("booklet_number", { length: 100 }), // For medicine purchases

    // Financial Details (all in Philippine Peso)
    originalAmount: decimal("original_amount", { precision: 19, scale: 2 }).notNull(),
    discountPercentage: decimal("discount_percentage", { precision: 5, scale: 2 }).notNull(), // 20% for senior/pwd
    discountAmount: decimal("discount_amount", { precision: 19, scale: 2 }).notNull(),
    discountedAmount: decimal("discounted_amount", { precision: 19, scale: 2 }).notNull(),

    // VAT Exemption (for Senior/PWD)
    isVatExempt: boolean("is_vat_exempt").default(false),
    vatExemptedAmount: decimal("vat_exempted_amount", { precision: 19, scale: 2 }),
    vatableSales: decimal("vatable_sales", { precision: 19, scale: 2 }),

    // Discount Limits
    maxDiscountableUnits: integer("max_discountable_units").default(1), // Personal use only for senior/pwd
    unitsDiscounted: integer("units_discounted").default(1),

    // Compliance Information
    complianceType: varchar("compliance_type", { length: 100 }), // RA 9994, RA 10754, etc.
    birCompliant: boolean("bir_compliant").default(true),
    orNumber: varchar("or_number", { length: 100 }), // Official Receipt number
    siNumber: varchar("si_number", { length: 100 }), // Sales Invoice number

    // Supporting Documents
    idCopyUrl: text("id_copy_url"), // Scanned copy of ID
    attachments: jsonb("attachments")
      .$type<
        {
          type: string;
          url: string;
          uploadedAt: string;
        }[]
      >()
      .default([]),

    // Approval (for non-standard discounts)
    requiresApproval: boolean("requires_approval").default(false),
    approvedBy: uuid("approved_by"),
    // .references(() => users.id), // Commented for RED phase
    approvedAt: timestamp("approved_at"),
    approvalNotes: text("approval_notes"),

    // Status
    status: varchar("status", { length: 50 }).notNull().default("active"), // active, cancelled, expired
    cancellationReason: text("cancellation_reason"),

    // Metadata
    notes: text("notes"),
    metadata: jsonb("metadata").default({}),

    // Audit Fields
    createdBy: uuid("created_by").notNull(),
    // .references(() => users.id), // Commented for RED phase
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Unique discount code per project
    uniqueDiscountCode: unique("discount_logs_project_code_unique").on(
      table.projectId,
      table.discountCode
    ),

    // Business constraints
    discountPercentageValid: check(
      "discount_percentage_valid",
      `${table.discountPercentage.name} >= 0 AND ${table.discountPercentage.name} <= 100`
    ),
    amountsPositive: check(
      "discount_amounts_positive",
      `${table.originalAmount.name} > 0 AND ${table.discountAmount.name} >= 0`
    ),

    // Indexes
    projectDateIdx: index("discount_logs_project_date_idx").on(table.projectId, table.discountDate),
    transactionIdx: index("discount_logs_transaction_idx").on(
      table.transactionType,
      table.transactionId
    ),
    discountTypeIdx: index("discount_logs_type_idx").on(table.discountType),
    idNumberIdx: index("discount_logs_id_number_idx").on(table.idNumber),
  })
);

// =============================================
// Senior/PWD Registry Table - Pre-registered beneficiaries
// =============================================
export const seniorPwdRegistry = pgTable(
  "senior_pwd_registry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    // Personal Information
    registryCode: varchar("registry_code", { length: 50 }).notNull(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    middleName: varchar("middle_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    birthDate: date("birth_date").notNull(),

    // ID Information
    idType: varchar("id_type", { length: 50 }).notNull(), // senior_citizen, pwd
    idNumber: varchar("id_number", { length: 100 }).notNull(),
    idIssueDate: date("id_issue_date"),
    idExpiryDate: date("id_expiry_date"),
    issuingOffice: varchar("issuing_office", { length: 255 }),

    // PWD Specific
    disabilityType: varchar("disability_type", { length: 100 }), // visual, hearing, mobility, etc.
    disabilityDetails: text("disability_details"),

    // Contact Information
    contactNumber: varchar("contact_number", { length: 50 }),
    email: varchar("email", { length: 255 }),
    address: text("address"),
    city: varchar("city", { length: 100 }),
    province: varchar("province", { length: 100 }),

    // Companion/Guardian (if applicable)
    companionName: varchar("companion_name", { length: 255 }),
    companionRelation: varchar("companion_relation", { length: 100 }),
    companionContact: varchar("companion_contact", { length: 50 }),

    // Verification
    isVerified: boolean("is_verified").default(false),
    verifiedBy: uuid("verified_by"),
    // .references(() => users.id), // Commented for RED phase
    verifiedAt: timestamp("verified_at"),
    verificationMethod: varchar("verification_method", { length: 50 }), // manual, osca_api, etc.

    // Usage Statistics
    totalTransactions: integer("total_transactions").default(0),
    totalDiscountAmount: decimal("total_discount_amount", { precision: 19, scale: 2 }).default("0"),
    lastUsedDate: timestamp("last_used_date"),

    // Status
    isActive: boolean("is_active").default(true),
    isBlacklisted: boolean("is_blacklisted").default(false),
    blacklistReason: text("blacklist_reason"),

    // Documents
    idCopyUrl: text("id_copy_url"),
    photoUrl: text("photo_url"),

    // Notes
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
    // Unique registry code per project
    uniqueRegistryCode: unique("senior_pwd_registry_project_code_unique").on(
      table.projectId,
      table.registryCode
    ),

    // Unique ID number per project and type
    uniqueIdNumber: unique("senior_pwd_registry_project_id_unique").on(
      table.projectId,
      table.idType,
      table.idNumber
    ),

    // Indexes
    projectActiveIdx: index("senior_pwd_registry_project_active_idx").on(
      table.projectId,
      table.isActive
    ),
    idNumberIdx: index("senior_pwd_registry_id_number_idx").on(table.idNumber),
    nameIdx: index("senior_pwd_registry_name_idx").on(table.lastName, table.firstName),
  })
);

// =============================================
// Promotional Discounts Table
// =============================================
export const promotionalDiscounts = pgTable(
  "promotional_discounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    // Promotion Details
    promoCode: varchar("promo_code", { length: 50 }).notNull(),
    promoName: varchar("promo_name", { length: 255 }).notNull(),
    description: text("description"),

    // Discount Configuration
    discountType: varchar("discount_type", { length: 50 }).notNull(), // percentage, fixed_amount
    discountValue: decimal("discount_value", { precision: 19, scale: 2 }).notNull(),
    maxDiscountAmount: decimal("max_discount_amount", { precision: 19, scale: 2 }),
    minPurchaseAmount: decimal("min_purchase_amount", { precision: 19, scale: 2 }),

    // Validity Period
    validFrom: timestamp("valid_from").notNull(),
    validUntil: timestamp("valid_until").notNull(),

    // Applicability
    applicableCategories: jsonb("applicable_categories").$type<string[]>().default([]),
    applicableServices: jsonb("applicable_services").$type<string[]>().default([]),
    applicableRooms: jsonb("applicable_rooms").$type<string[]>().default([]),

    // Usage Limits
    usageLimit: integer("usage_limit"), // Total usage limit
    usageLimitPerCustomer: integer("usage_limit_per_customer"),
    currentUsageCount: integer("current_usage_count").default(0),

    // Conditions
    conditions: jsonb("conditions")
      .$type<
        {
          type: string;
          value: any;
          operator: string;
        }[]
      >()
      .default([]),

    // Stackability
    isStackable: boolean("is_stackable").default(false),
    excludedDiscounts: jsonb("excluded_discounts").$type<string[]>().default([]),

    // Status
    isActive: boolean("is_active").default(true),
    requiresApproval: boolean("requires_approval").default(false),

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
    // Unique promo code per project
    uniquePromoCode: unique("promotional_discounts_project_code_unique").on(
      table.projectId,
      table.promoCode
    ),

    // Indexes
    projectActiveIdx: index("promotional_discounts_project_active_idx").on(
      table.projectId,
      table.isActive
    ),
    validityIdx: index("promotional_discounts_validity_idx").on(table.validFrom, table.validUntil),
  })
);

// Type exports
export type DiscountLog = typeof discountLogs.$inferSelect;
export type NewDiscountLog = typeof discountLogs.$inferInsert;
export type SeniorPwdRegistry = typeof seniorPwdRegistry.$inferSelect;
export type NewSeniorPwdRegistry = typeof seniorPwdRegistry.$inferInsert;
export type PromotionalDiscount = typeof promotionalDiscounts.$inferSelect;
export type NewPromotionalDiscount = typeof promotionalDiscounts.$inferInsert;
