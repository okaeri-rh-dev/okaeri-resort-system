/**
 * Database Schema Exports
 * Central location for all database schema definitions
 */

// Export all global schema tables and relations
export {
  users,
  projects,
  userProjectPermissions,
  auditLogs,
  usersRelations,
  projectsRelations,
  userProjectPermissionsRelations,
  auditLogsRelations,
  // Additional security tables
  sessions,
  passwordResetTokens,
  emailVerificationTokens,
  userSessions,
  loginAttempts,
  securityAuditLogs,
} from "./global";

// Export DPA compliance schema tables
export {
  privacyConsents,
  dataSubjectRequests,
  dataRetentionPolicies,
  dataProcessingActivities,
  securityBreaches,
  encryptedFields,
  privacyNotices,
  // Relations
  privacyConsentsRelations,
  dataSubjectRequestsRelations,
  dataRetentionPoliciesRelations,
  dataProcessingActivitiesRelations,
  securityBreachesRelations,
  encryptedFieldsRelations,
  privacyNoticesRelations,
} from "./dpa-compliance";

// Export project schema creator and types
export { createProjectSchema, type ProjectSchema } from "./project";

// Export booking system schema tables and relations
export {
  rooms,
  bookings,
  roomsRelations,
  bookingsRelations,
  BOOKING_STATUSES,
  PAYMENT_STATUSES,
  type Room,
  type NewRoom,
  type Booking,
  type NewBooking,
  type BookingStatus,
  type PaymentStatus,
} from "./booking";

// Re-export common types from global schema for convenience
export type User = typeof import("./global").users.$inferSelect;
export type NewUser = typeof import("./global").users.$inferInsert;
export type Project = typeof import("./global").projects.$inferSelect;
export type NewProject = typeof import("./global").projects.$inferInsert;
export type UserProjectPermission = typeof import("./global").userProjectPermissions.$inferSelect;
export type NewUserProjectPermission =
  typeof import("./global").userProjectPermissions.$inferInsert;
export type AuditLog = typeof import("./global").auditLogs.$inferSelect;
export type NewAuditLog = typeof import("./global").auditLogs.$inferInsert;

// Export role types
export const USER_ROLES = {
  OWNER: "owner",
  ADMIN: "admin",
  MANAGER: "manager",
  STAFF: "staff",
  VIEWER: "viewer",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

// Export booking status types
export const BOOKING_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  CHECKED_IN: "checked_in",
  CHECKED_OUT: "checked_out",
  CANCELLED: "cancelled",
  NO_SHOW: "no_show",
} as const;

export type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];

// Export payment status types
export const PAYMENT_STATUS = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

// Export payment method types
export const PAYMENT_METHODS = {
  CASH: "cash",
  GCASH: "gcash",
  BANK_TRANSFER: "bank_transfer",
  CREDIT_CARD: "credit_card",
} as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

// Export expense status types
export const EXPENSE_STATUS = {
  DRAFT: "draft",
  PENDING_APPROVAL: "pending_approval",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export type ExpenseStatus = (typeof EXPENSE_STATUS)[keyof typeof EXPENSE_STATUS];

// Export audit log categories
export const AUDIT_CATEGORIES = {
  AUTH: "auth",
  BOOKING: "booking",
  PAYMENT: "payment",
  EXPENSE: "expense",
  USER: "user",
  SETTINGS: "settings",
} as const;

export type AuditCategory = (typeof AUDIT_CATEGORIES)[keyof typeof AUDIT_CATEGORIES];

// Export audit log severities
export const AUDIT_SEVERITIES = {
  INFO: "info",
  WARNING: "warning",
  ERROR: "error",
  CRITICAL: "critical",
} as const;

export type AuditSeverity = (typeof AUDIT_SEVERITIES)[keyof typeof AUDIT_SEVERITIES];
