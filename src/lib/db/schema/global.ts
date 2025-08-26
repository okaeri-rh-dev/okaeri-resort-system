import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * Global Users Table
 * Stores all user accounts across the entire platform
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    avatarUrl: text("avatar_url"),
    isActive: boolean("is_active").default(true).notNull(),
    isEmailVerified: boolean("is_email_verified").default(false).notNull(),
    emailVerificationToken: text("email_verification_token"),
    emailVerificationExpiry: timestamp("email_verification_expiry"),
    passwordResetToken: text("password_reset_token"),
    passwordResetExpiry: timestamp("password_reset_expiry"),
    lastLoginAt: timestamp("last_login_at"),
    loginAttempts: jsonb("login_attempts")
      .$type<
        Array<{
          timestamp: string;
          ipAddress: string;
          userAgent: string;
          success: boolean;
        }>
      >()
      .default([]),
    preferences: jsonb("preferences")
      .$type<{
        language?: "en" | "fil";
        timezone?: string;
        notifications?: {
          email: boolean;
          sms: boolean;
          push: boolean;
        };
      }>()
      .default({}),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
    phoneIdx: index("users_phone_idx").on(table.phone),
    lastLoginIdx: index("users_last_login_idx").on(table.lastLoginAt),
    createdAtIdx: index("users_created_at_idx").on(table.createdAt),
  })
);

/**
 * Projects Table
 * Represents individual resort businesses
 */
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    schemaName: varchar("schema_name", { length: 63 }).notNull().unique(), // PostgreSQL schema name limit
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id),
    businessType: varchar("business_type", { length: 50 }).notNull().default("resort"),
    description: text("description"),
    logo: text("logo"),
    coverImage: text("cover_image"),

    // Business Information
    businessName: varchar("business_name", { length: 255 }),
    businessRegistrationNumber: varchar("business_registration_number", { length: 100 }),
    taxIdentificationNumber: varchar("tax_identification_number", { length: 100 }),

    // Location
    address: text("address"),
    city: varchar("city", { length: 100 }),
    province: varchar("province", { length: 100 }),
    postalCode: varchar("postal_code", { length: 10 }),
    country: varchar("country", { length: 2 }).default("PH").notNull(),
    coordinates: jsonb("coordinates").$type<{
      lat: number;
      lng: number;
    }>(),

    // Contact Information
    contactEmail: varchar("contact_email", { length: 255 }),
    contactPhone: varchar("contact_phone", { length: 20 }),
    website: text("website"),
    socialMedia: jsonb("social_media")
      .$type<{
        facebook?: string;
        instagram?: string;
        twitter?: string;
      }>()
      .default({}),

    // Settings
    currency: varchar("currency", { length: 3 }).default("PHP").notNull(),
    timezone: varchar("timezone", { length: 50 }).default("Asia/Manila").notNull(),
    settings: jsonb("settings")
      .$type<{
        bookingRules?: {
          advanceBookingDays?: number;
          cancellationHours?: number;
          requireDeposit?: boolean;
          depositPercentage?: number;
        };
        paymentMethods?: {
          cash?: boolean;
          gcash?: boolean;
          bankTransfer?: boolean;
          creditCard?: boolean;
        };
        notifications?: {
          bookingConfirmation?: boolean;
          paymentReceived?: boolean;
          dailyReport?: boolean;
        };
      }>()
      .default({}),

    // Status
    isActive: boolean("is_active").default(true).notNull(),
    isPaid: boolean("is_paid").default(false).notNull(), // For future subscription model
    trialEndsAt: timestamp("trial_ends_at"),
    suspendedAt: timestamp("suspended_at"),
    suspensionReason: text("suspension_reason"),

    // Metadata
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex("projects_slug_idx").on(table.slug),
    schemaNameIdx: uniqueIndex("projects_schema_name_idx").on(table.schemaName),
    ownerIdx: index("projects_owner_idx").on(table.ownerId),
    isActiveIdx: index("projects_is_active_idx").on(table.isActive),
    createdAtIdx: index("projects_created_at_idx").on(table.createdAt),
  })
);

/**
 * User Project Permissions Table
 * Manages user access and roles for each project
 */
export const userProjectPermissions = pgTable(
  "user_project_permissions",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 50 }).notNull(), // owner, admin, manager, staff, viewer
    permissions: jsonb("permissions")
      .$type<{
        bookings?: {
          view?: boolean;
          create?: boolean;
          update?: boolean;
          delete?: boolean;
        };
        payments?: {
          view?: boolean;
          create?: boolean;
          update?: boolean;
          delete?: boolean;
        };
        expenses?: {
          view?: boolean;
          create?: boolean;
          update?: boolean;
          delete?: boolean;
        };
        reports?: {
          view?: boolean;
          export?: boolean;
        };
        settings?: {
          view?: boolean;
          update?: boolean;
        };
        users?: {
          view?: boolean;
          invite?: boolean;
          remove?: boolean;
          updateRoles?: boolean;
        };
      }>()
      .default({}),

    // Invitation tracking
    invitedBy: uuid("invited_by").references(() => users.id),
    invitedAt: timestamp("invited_at"),
    acceptedAt: timestamp("accepted_at"),
    invitationToken: text("invitation_token"),
    invitationExpiry: timestamp("invitation_expiry"),

    // Status
    isActive: boolean("is_active").default(true).notNull(),
    lastAccessedAt: timestamp("last_accessed_at"),

    // Metadata
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.projectId] }),
    userIdx: index("user_project_permissions_user_idx").on(table.userId),
    projectIdx: index("user_project_permissions_project_idx").on(table.projectId),
    roleIdx: index("user_project_permissions_role_idx").on(table.role),
    invitationTokenIdx: index("user_project_permissions_invitation_token_idx").on(
      table.invitationToken
    ),
  })
);

/**
 * Audit Logs Table
 * Tracks all system-wide security and compliance events
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id),
    projectId: uuid("project_id").references(() => projects.id),
    action: varchar("action", { length: 100 }).notNull(),
    category: varchar("category", { length: 50 }).notNull(), // auth, booking, payment, expense, user, settings
    severity: varchar("severity", { length: 20 }).notNull(), // info, warning, error, critical

    // Request details
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    requestMethod: varchar("request_method", { length: 10 }),
    requestPath: text("request_path"),
    requestId: uuid("request_id"),

    // Change tracking
    entityType: varchar("entity_type", { length: 50 }),
    entityId: uuid("entity_id"),
    oldValues: jsonb("old_values").default({}),
    newValues: jsonb("new_values").default({}),

    // Result
    success: boolean("success").notNull(),
    errorMessage: text("error_message"),
    errorStack: text("error_stack"),

    // Additional context
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("audit_logs_user_idx").on(table.userId),
    projectIdx: index("audit_logs_project_idx").on(table.projectId),
    categoryIdx: index("audit_logs_category_idx").on(table.category),
    severityIdx: index("audit_logs_severity_idx").on(table.severity),
    entityIdx: index("audit_logs_entity_idx").on(table.entityType, table.entityId),
    createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
    requestIdIdx: index("audit_logs_request_id_idx").on(table.requestId),
  })
);

/**
 * Define relations between tables
 */
export const usersRelations = relations(users, ({ many }) => ({
  ownedProjects: many(projects),
  permissions: many(userProjectPermissions),
  auditLogs: many(auditLogs),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, {
    fields: [projects.ownerId],
    references: [users.id],
  }),
  permissions: many(userProjectPermissions),
  auditLogs: many(auditLogs),
}));

export const userProjectPermissionsRelations = relations(userProjectPermissions, ({ one }) => ({
  user: one(users, {
    fields: [userProjectPermissions.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [userProjectPermissions.projectId],
    references: [projects.id],
  }),
  invitedByUser: one(users, {
    fields: [userProjectPermissions.invitedBy],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [auditLogs.projectId],
    references: [projects.id],
  }),
}));
