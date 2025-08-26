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
  integer,
  inet,
  decimal,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * Global Users Table
 * Stores all user accounts across the entire platform
 * Enhanced with comprehensive authentication fields for Philippine business context
 */
export const users = pgTable(
  "users",
  {
    // Primary identification
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),

    // Personal information
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    phone: varchar("phone", { length: 20 }), // E.164 format with +63
    avatarUrl: text("avatar_url"),

    // Account status
    isActive: boolean("is_active").default(true).notNull(),
    isEmailVerified: boolean("is_email_verified").default(false).notNull(),
    emailVerifiedAt: timestamp("email_verified_at"),
    phoneVerifiedAt: timestamp("phone_verified_at"),

    // Authentication tracking
    lastLoginAt: timestamp("last_login_at"),
    loginCount: integer("login_count").default(0).notNull(),
    failedLoginAttempts: integer("failed_login_attempts").default(0).notNull(),
    lockedUntil: timestamp("locked_until"),

    // Two-factor authentication
    twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
    twoFactorSecret: text("two_factor_secret"),

    // Session management
    rememberToken: text("remember_token"),

    // Token fields (legacy - kept for backward compatibility)
    emailVerificationToken: text("email_verification_token"),
    emailVerificationExpiry: timestamp("email_verification_expiry"),
    passwordResetToken: text("password_reset_token"),
    passwordResetExpiry: timestamp("password_reset_expiry"),

    // Philippine localization
    timezone: varchar("timezone", { length: 50 }).default("Asia/Manila").notNull(),
    locale: varchar("locale", { length: 10 }).default("en-PH").notNull(),
    currency: varchar("currency", { length: 3 }).default("PHP").notNull(),

    // Login history (for audit trail)
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

    // User preferences
    preferences: jsonb("preferences")
      .$type<{
        language?: "en" | "fil";
        notifications?: {
          email: boolean;
          sms: boolean;
          push: boolean;
        };
        dashboard?: {
          defaultView?: string;
          widgets?: string[];
        };
      }>()
      .default({}),

    // Additional metadata
    metadata: jsonb("metadata").default({}),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"), // Soft delete support
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

/**
 * Sessions Table
 * Manages active user sessions for authentication and security
 */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),

    // Session details
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),

    // Activity tracking
    lastActivity: timestamp("last_activity").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),

    // Revocation
    revokedAt: timestamp("revoked_at"),
    revocationReason: text("revocation_reason"),

    // Device information
    deviceInfo: jsonb("device_info")
      .$type<{
        type?: "desktop" | "mobile" | "tablet";
        browser?: string;
        os?: string;
        location?: {
          country?: string;
          city?: string;
        };
      }>()
      .default({}),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tokenIdx: uniqueIndex("sessions_token_idx").on(table.token),
    userIdx: index("sessions_user_idx").on(table.userId),
    expiresAtIdx: index("sessions_expires_at_idx").on(table.expiresAt),
    lastActivityIdx: index("sessions_last_activity_idx").on(table.lastActivity),
  })
);

/**
 * Password Reset Tokens Table
 * Manages secure password reset tokens with expiration
 */
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),

    // Token lifecycle
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),

    // Request details
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tokenIdx: uniqueIndex("password_reset_tokens_token_idx").on(table.token),
    userIdx: index("password_reset_tokens_user_idx").on(table.userId),
    expiresAtIdx: index("password_reset_tokens_expires_at_idx").on(table.expiresAt),
  })
);

/**
 * Email Verification Tokens Table
 * Manages email verification tokens for account activation
 */
export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    token: text("token").notNull().unique(),

    // Token lifecycle
    expiresAt: timestamp("expires_at").notNull(),
    verifiedAt: timestamp("verified_at"),

    // Request details
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tokenIdx: uniqueIndex("email_verification_tokens_token_idx").on(table.token),
    userIdx: index("email_verification_tokens_user_idx").on(table.userId),
    emailIdx: index("email_verification_tokens_email_idx").on(table.email),
    expiresAtIdx: index("email_verification_tokens_expires_at_idx").on(table.expiresAt),
  })
);

/**
 * User Sessions Table
 * Tracks all user sessions for security and audit purposes
 */
export const userSessions = pgTable(
  "user_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),

    // Session metadata
    loginMethod: varchar("login_method", { length: 50 }), // password, oauth, sso
    projectId: uuid("project_id").references(() => projects.id),

    // Activity tracking
    pagesViewed: integer("pages_viewed").default(0).notNull(),
    actionsPerformed: integer("actions_performed").default(0).notNull(),
    lastPageVisited: text("last_page_visited"),

    // Security
    suspiciousActivity: boolean("suspicious_activity").default(false).notNull(),
    riskScore: integer("risk_score").default(0).notNull(),

    // Timestamps
    startedAt: timestamp("started_at").defaultNow().notNull(),
    endedAt: timestamp("ended_at"),
  },
  (table) => ({
    userIdx: index("user_sessions_user_idx").on(table.userId),
    sessionIdx: index("user_sessions_session_idx").on(table.sessionId),
    projectIdx: index("user_sessions_project_idx").on(table.projectId),
    startedAtIdx: index("user_sessions_started_at_idx").on(table.startedAt),
  })
);

/**
 * Login Attempts Table
 * Tracks login attempts for rate limiting and security monitoring
 */
export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),

    // Attempt details
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    success: boolean("success").notNull(),

    // Failure tracking
    failureReason: varchar("failure_reason", { length: 100 }),
    errorCode: varchar("error_code", { length: 50 }),

    // Security scoring
    riskScore: integer("risk_score").default(0).notNull(),
    blocked: boolean("blocked").default(false).notNull(),

    // Geographic info
    geoLocation: jsonb("geo_location")
      .$type<{
        country?: string;
        region?: string;
        city?: string;
        lat?: number;
        lng?: number;
      }>()
      .default({}),

    // Timestamp
    attemptedAt: timestamp("attempted_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index("login_attempts_email_idx").on(table.email),
    ipAddressIdx: index("login_attempts_ip_address_idx").on(table.ipAddress),
    attemptedAtIdx: index("login_attempts_attempted_at_idx").on(table.attemptedAt),
    successIdx: index("login_attempts_success_idx").on(table.success),
    // Composite index for rate limiting checks
    rateLimitIdx: index("login_attempts_rate_limit_idx").on(
      table.email,
      table.ipAddress,
      table.attemptedAt
    ),
  })
);

/**
 * Enhanced Audit Logs Table
 * Extended with additional security fields for comprehensive tracking
 */
export const securityAuditLogs = pgTable(
  "security_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id),
    projectId: uuid("project_id").references(() => projects.id),

    // Event classification
    eventType: varchar("event_type", { length: 100 }).notNull(),
    resourceType: varchar("resource_type", { length: 100 }),
    resourceId: text("resource_id"),
    action: varchar("action", { length: 100 }).notNull(),

    // Security context
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    sessionId: uuid("session_id").references(() => sessions.id),

    // Risk assessment
    riskScore: integer("risk_score").default(0).notNull(),
    threatLevel: varchar("threat_level", { length: 20 }), // low, medium, high, critical

    // Result
    success: boolean("success").notNull(),
    errorMessage: text("error_message"),

    // Additional context
    metadata: jsonb("metadata").default({}),

    // Compliance
    retentionDate: timestamp("retention_date"), // 5 years from creation for Philippine compliance

    // Timestamp
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("security_audit_logs_user_idx").on(table.userId),
    projectIdx: index("security_audit_logs_project_idx").on(table.projectId),
    eventTypeIdx: index("security_audit_logs_event_type_idx").on(table.eventType),
    resourceIdx: index("security_audit_logs_resource_idx").on(table.resourceType, table.resourceId),
    createdAtIdx: index("security_audit_logs_created_at_idx").on(table.createdAt),
    riskScoreIdx: index("security_audit_logs_risk_score_idx").on(table.riskScore),
    sessionIdx: index("security_audit_logs_session_idx").on(table.sessionId),
    // Partitioned index for efficient time-based queries
    partitionIdx: index("security_audit_logs_partition_idx").on(table.createdAt, table.eventType),
  })
);

// Additional Relations
export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
  userSessions: many(userSessions),
  securityAuditLogs: many(securityAuditLogs),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}));

export const emailVerificationTokensRelations = relations(emailVerificationTokens, ({ one }) => ({
  user: one(users, {
    fields: [emailVerificationTokens.userId],
    references: [users.id],
  }),
}));

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id],
  }),
  session: one(sessions, {
    fields: [userSessions.sessionId],
    references: [sessions.id],
  }),
  project: one(projects, {
    fields: [userSessions.projectId],
    references: [projects.id],
  }),
}));

export const securityAuditLogsRelations = relations(securityAuditLogs, ({ one }) => ({
  user: one(users, {
    fields: [securityAuditLogs.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [securityAuditLogs.projectId],
    references: [projects.id],
  }),
  session: one(sessions, {
    fields: [securityAuditLogs.sessionId],
    references: [sessions.id],
  }),
}));
