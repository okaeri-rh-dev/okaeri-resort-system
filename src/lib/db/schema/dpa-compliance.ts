/**
 * DPA Compliance Database Schema
 * Tables for Philippine Data Privacy Act compliance features
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  integer,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users, projects } from "./global";

/**
 * Privacy Consent Records Table
 * Tracks all consent given by data subjects
 */
export const privacyConsents = pgTable(
  "privacy_consents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Consent details
    purpose: varchar("purpose", { length: 100 }).notNull(),
    legalBasis: varchar("legal_basis", { length: 50 }).notNull(),
    status: varchar("status", { length: 20 }).notNull(), // granted, withdrawn, expired, pending
    version: varchar("version", { length: 20 }).notNull(),

    // Consent scope
    scope: jsonb("scope").$type<string[]>().default([]),

    // Data categories consented to
    dataCategories: jsonb("data_categories").$type<string[]>().default([]),

    // Timestamps
    grantedAt: timestamp("granted_at"),
    withdrawnAt: timestamp("withdrawn_at"),
    expiresAt: timestamp("expires_at"),

    // Consent method
    consentMethod: varchar("consent_method", { length: 50 }), // web_form, email, phone, in_person
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),

    // Withdrawal details
    withdrawalReason: text("withdrawal_reason"),
    withdrawalMethod: varchar("withdrawal_method", { length: 50 }),

    // Metadata
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("privacy_consents_user_idx").on(table.userId),
    purposeIdx: index("privacy_consents_purpose_idx").on(table.purpose),
    statusIdx: index("privacy_consents_status_idx").on(table.status),
    expiresAtIdx: index("privacy_consents_expires_at_idx").on(table.expiresAt),
    createdAtIdx: index("privacy_consents_created_at_idx").on(table.createdAt),
  })
);

/**
 * Data Subject Requests Table
 * Tracks all data subject rights requests (access, correction, deletion, etc.)
 */
export const dataSubjectRequests = pgTable(
  "data_subject_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requesterId: uuid("requester_id")
      .notNull()
      .references(() => users.id),
    dataSubjectId: uuid("data_subject_id")
      .notNull()
      .references(() => users.id),

    // Request details
    requestType: varchar("request_type", { length: 50 }).notNull(), // access, correction, deletion, portability, objection
    status: varchar("status", { length: 20 }).notNull(), // pending, processing, completed, rejected
    priority: varchar("priority", { length: 20 }).default("normal").notNull(),

    // Request content
    description: text("description").notNull(),
    requestedData: jsonb("requested_data").default({}),

    // Processing details
    processedBy: uuid("processed_by").references(() => users.id),
    processedAt: timestamp("processed_at"),
    processingNotes: text("processing_notes"),

    // Response
    responseData: jsonb("response_data").default({}),
    responseMethod: varchar("response_method", { length: 50 }), // email, download, mail
    responseSentAt: timestamp("response_sent_at"),

    // Rejection details
    rejectionReason: text("rejection_reason"),
    rejectionDate: timestamp("rejection_date"),

    // Legal compliance
    dueDate: timestamp("due_date").notNull(), // Legal deadline for response
    extensionReason: text("extension_reason"),
    extensionGrantedUntil: timestamp("extension_granted_until"),

    // Verification
    identityVerified: boolean("identity_verified").default(false).notNull(),
    verificationMethod: varchar("verification_method", { length: 50 }),
    verifiedAt: timestamp("verified_at"),

    // Metadata
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    requesterIdx: index("dsr_requester_idx").on(table.requesterId),
    dataSubjectIdx: index("dsr_data_subject_idx").on(table.dataSubjectId),
    requestTypeIdx: index("dsr_request_type_idx").on(table.requestType),
    statusIdx: index("dsr_status_idx").on(table.status),
    dueDateIdx: index("dsr_due_date_idx").on(table.dueDate),
    createdAtIdx: index("dsr_created_at_idx").on(table.createdAt),
  })
);

/**
 * Data Retention Policies Table
 * Defines retention periods for different data categories
 */
export const dataRetentionPolicies = pgTable(
  "data_retention_policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id").references(() => projects.id),

    // Policy details
    dataCategory: varchar("data_category", { length: 100 }).notNull(),
    retentionDays: integer("retention_days").notNull(),
    purgeAction: varchar("purge_action", { length: 20 }).notNull(), // delete, anonymize, archive, pseudonymize

    // Legal basis
    legalBasis: text("legal_basis"),
    regulatoryRequirement: varchar("regulatory_requirement", { length: 100 }),

    // Conditions
    excludeConditions: jsonb("exclude_conditions").$type<string[]>().default([]),

    // Automation
    autoExecute: boolean("auto_execute").default(true).notNull(),
    lastExecutedAt: timestamp("last_executed_at"),
    nextExecutionAt: timestamp("next_execution_at"),

    // Status
    isActive: boolean("is_active").default(true).notNull(),

    // Metadata
    description: text("description"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    projectIdx: index("retention_policies_project_idx").on(table.projectId),
    categoryIdx: index("retention_policies_category_idx").on(table.dataCategory),
    activeIdx: index("retention_policies_active_idx").on(table.isActive),
    nextExecutionIdx: index("retention_policies_next_execution_idx").on(table.nextExecutionAt),
  })
);

/**
 * Data Processing Activities Table
 * Records of all data processing activities for accountability
 */
export const dataProcessingActivities = pgTable(
  "data_processing_activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id").references(() => projects.id),

    // Activity details
    activityName: varchar("activity_name", { length: 200 }).notNull(),
    activityType: varchar("activity_type", { length: 50 }).notNull(),
    purpose: text("purpose").notNull(),
    legalBasis: varchar("legal_basis", { length: 50 }).notNull(),

    // Data categories
    dataCategories: jsonb("data_categories").$type<string[]>().notNull(),

    // Data subjects
    dataSubjectCategories: jsonb("data_subject_categories").$type<string[]>().notNull(),

    // Recipients
    recipients: jsonb("recipients")
      .$type<
        Array<{
          name: string;
          type: string;
          country?: string;
        }>
      >()
      .default([]),

    // International transfers
    hasInternationalTransfer: boolean("has_international_transfer").default(false).notNull(),
    transferCountries: jsonb("transfer_countries").$type<string[]>().default([]),
    transferSafeguards: text("transfer_safeguards"),

    // Retention
    retentionPeriod: varchar("retention_period", { length: 100 }),
    deletionProcess: text("deletion_process"),

    // Security measures
    technicalMeasures: jsonb("technical_measures").$type<string[]>().default([]),
    organizationalMeasures: jsonb("organizational_measures").$type<string[]>().default([]),

    // Risk assessment
    riskLevel: varchar("risk_level", { length: 20 }), // low, medium, high, critical
    dpiaRequired: boolean("dpia_required").default(false).notNull(),
    dpiaCompletedAt: timestamp("dpia_completed_at"),

    // Status
    status: varchar("status", { length: 20 }).default("active").notNull(),

    // Metadata
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    projectIdx: index("processing_activities_project_idx").on(table.projectId),
    activityTypeIdx: index("processing_activities_type_idx").on(table.activityType),
    statusIdx: index("processing_activities_status_idx").on(table.status),
    riskLevelIdx: index("processing_activities_risk_level_idx").on(table.riskLevel),
  })
);

/**
 * Security Breach Records Table
 * Tracks all security breaches for NPC reporting
 */
export const securityBreaches = pgTable(
  "security_breaches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id").references(() => projects.id),

    // Breach details
    breachType: varchar("breach_type", { length: 100 }).notNull(),
    severity: varchar("severity", { length: 20 }).notNull(), // low, medium, high, critical
    description: text("description").notNull(),

    // Impact
    affectedRecords: integer("affected_records").notNull(),
    affectedDataCategories: jsonb("affected_data_categories").$type<string[]>().notNull(),

    // Discovery and response
    detectedAt: timestamp("detected_at").notNull(),
    reportedAt: timestamp("reported_at"),
    containedAt: timestamp("contained_at"),
    resolvedAt: timestamp("resolved_at"),

    // Notification
    npcNotifiedAt: timestamp("npc_notified_at"), // National Privacy Commission
    dataSubjectsNotifiedAt: timestamp("data_subjects_notified_at"),
    publicDisclosureAt: timestamp("public_disclosure_at"),

    // Investigation
    rootCause: text("root_cause"),
    containmentActions: jsonb("containment_actions").$type<string[]>().default([]),
    preventiveMeasures: jsonb("preventive_measures").$type<string[]>().default([]),

    // Risk assessment
    riskScore: integer("risk_score"),
    likelihoodOfHarm: varchar("likelihood_of_harm", { length: 20 }),

    // Documentation
    investigationReport: text("investigation_report"),
    npcCaseNumber: varchar("npc_case_number", { length: 50 }),

    // Status
    status: varchar("status", { length: 20 }).notNull(), // detected, contained, investigating, resolved, closed

    // Metadata
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    projectIdx: index("security_breaches_project_idx").on(table.projectId),
    severityIdx: index("security_breaches_severity_idx").on(table.severity),
    statusIdx: index("security_breaches_status_idx").on(table.status),
    detectedAtIdx: index("security_breaches_detected_at_idx").on(table.detectedAt),
  })
);

/**
 * Encrypted Fields Registry Table
 * Tracks which fields are encrypted and their encryption metadata
 */
export const encryptedFields = pgTable(
  "encrypted_fields",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Entity reference
    tableName: varchar("table_name", { length: 100 }).notNull(),
    columnName: varchar("column_name", { length: 100 }).notNull(),
    recordId: uuid("record_id").notNull(),

    // Encryption details
    encryptionAlgorithm: varchar("encryption_algorithm", { length: 50 }).notNull(),
    keyId: varchar("key_id", { length: 100 }).notNull(),
    encryptionVersion: integer("encryption_version").notNull(),

    // Search support
    searchHash: text("search_hash"), // Blind index for searching

    // Audit
    encryptedAt: timestamp("encrypted_at").notNull(),
    encryptedBy: uuid("encrypted_by").references(() => users.id),
    lastAccessedAt: timestamp("last_accessed_at"),
    accessCount: integer("access_count").default(0).notNull(),

    // Key rotation
    keyRotationDue: timestamp("key_rotation_due"),
    lastRotatedAt: timestamp("last_rotated_at"),

    // Metadata
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    entityIdx: uniqueIndex("encrypted_fields_entity_idx").on(
      table.tableName,
      table.columnName,
      table.recordId
    ),
    keyIdx: index("encrypted_fields_key_idx").on(table.keyId),
    searchHashIdx: index("encrypted_fields_search_hash_idx").on(table.searchHash),
    rotationDueIdx: index("encrypted_fields_rotation_due_idx").on(table.keyRotationDue),
  })
);

/**
 * Privacy Notices Table
 * Stores versions of privacy notices and policies
 */
export const privacyNotices = pgTable(
  "privacy_notices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id").references(() => projects.id),

    // Notice details
    title: varchar("title", { length: 200 }).notNull(),
    version: varchar("version", { length: 20 }).notNull(),
    language: varchar("language", { length: 10 }).notNull(), // en, fil

    // Content
    content: text("content").notNull(),
    summary: text("summary"),

    // Sections
    sections: jsonb("sections")
      .$type<
        Array<{
          heading: string;
          content: string;
          purposes?: string[];
          required?: boolean;
        }>
      >()
      .notNull(),

    // Validity
    effectiveFrom: timestamp("effective_from").notNull(),
    effectiveUntil: timestamp("effective_until"),

    // Publication
    publishedAt: timestamp("published_at"),
    publishedBy: uuid("published_by").references(() => users.id),

    // Status
    status: varchar("status", { length: 20 }).notNull(), // draft, published, archived

    // Metadata
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    projectIdx: index("privacy_notices_project_idx").on(table.projectId),
    versionIdx: index("privacy_notices_version_idx").on(table.version),
    languageIdx: index("privacy_notices_language_idx").on(table.language),
    statusIdx: index("privacy_notices_status_idx").on(table.status),
    effectiveFromIdx: index("privacy_notices_effective_from_idx").on(table.effectiveFrom),
  })
);

/**
 * Define relations
 */
export const privacyConsentsRelations = relations(privacyConsents, ({ one }) => ({
  user: one(users, {
    fields: [privacyConsents.userId],
    references: [users.id],
  }),
}));

export const dataSubjectRequestsRelations = relations(dataSubjectRequests, ({ one }) => ({
  requester: one(users, {
    fields: [dataSubjectRequests.requesterId],
    references: [users.id],
  }),
  dataSubject: one(users, {
    fields: [dataSubjectRequests.dataSubjectId],
    references: [users.id],
  }),
  processor: one(users, {
    fields: [dataSubjectRequests.processedBy],
    references: [users.id],
  }),
}));

export const dataRetentionPoliciesRelations = relations(dataRetentionPolicies, ({ one }) => ({
  project: one(projects, {
    fields: [dataRetentionPolicies.projectId],
    references: [projects.id],
  }),
}));

export const dataProcessingActivitiesRelations = relations(dataProcessingActivities, ({ one }) => ({
  project: one(projects, {
    fields: [dataProcessingActivities.projectId],
    references: [projects.id],
  }),
}));

export const securityBreachesRelations = relations(securityBreaches, ({ one }) => ({
  project: one(projects, {
    fields: [securityBreaches.projectId],
    references: [projects.id],
  }),
}));

export const encryptedFieldsRelations = relations(encryptedFields, ({ one }) => ({
  encryptedBy: one(users, {
    fields: [encryptedFields.encryptedBy],
    references: [users.id],
  }),
}));

export const privacyNoticesRelations = relations(privacyNotices, ({ one }) => ({
  project: one(projects, {
    fields: [privacyNotices.projectId],
    references: [projects.id],
  }),
  publishedBy: one(users, {
    fields: [privacyNotices.publishedBy],
    references: [users.id],
  }),
}));
