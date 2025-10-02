// src/lib/audit-constants.ts

/**
 * Audit System Constants
 *
 * Central location for all audit-related constants, including:
 * - Sensitive field redaction configuration
 * - Table name constants and validation
 * - Display names for UI
 * - Pagination and cache configuration
 */

import { AuditCategory, AuditSeverity, type AuditAction } from "../../database.types";

// ============================================
// SENSITIVE FIELDS CONFIGURATION
// ============================================

/**
 * SENSITIVE_FIELDS - Fields that should be redacted in audit logs
 *
 * Why redaction?
 * - Guest privacy: PII shouldn't be in plain text logs
 * - Security: Payment details need extra protection
 * - Compliance: Even internal logs should minimize PII exposure
 *
 * What's redacted?
 * - Guest personal information (phone, email, address)
 * - Payment sensitive data (card numbers, GCash reference)
 * - Authentication secrets (passwords, tokens)
 */
export const SENSITIVE_FIELDS: Record<string, string[]> = {
  // Guest PII
  guests: [
    "guest_phone",
    "guest_email",
    "guest_address",
    "guest_notes", // May contain sensitive personal info
    "emergency_contact_phone",
  ],

  // Booking PII (guest details captured in bookings)
  bookings: [
    "special_requests", // May contain medical/dietary info
    "internal_notes", // Staff notes may contain sensitive context
  ],

  // Payment sensitive data
  payments: [
    "payment_method_details", // GCash reference numbers, bank details
    "transaction_reference", // External payment IDs
    "proof_url", // May expose sensitive file paths
  ],

  // User authentication (if you add user management later)
  users: ["password_hash", "reset_token", "email_verification_token"],

  // Expense receipts (may contain personal vendor info)
  expenses: ["vendor_contact", "proof_url"],
};

/**
 * Get sensitive fields for a specific table
 * @param tableName - Table to check
 * @returns Array of field names to redact
 */
export function getSensitiveFields(tableName: string): string[] {
  return SENSITIVE_FIELDS[tableName] || [];
}

/**
 * Check if a field should be redacted
 * @param tableName - Table name
 * @param fieldName - Field to check
 * @returns true if field should be redacted
 */
export function isSensitiveField(tableName: string, fieldName: string): boolean {
  const sensitiveFields = getSensitiveFields(tableName);
  return sensitiveFields.includes(fieldName);
}

/**
 * REDACTION_PLACEHOLDER - Value used for redacted fields
 */
export const REDACTION_PLACEHOLDER = "[REDACTED]";

/**
 * Redact sensitive fields in an object
 * @param tableName - Table name
 * @param data - Data object to redact (Json type from database)
 * @returns New object with sensitive fields redacted
 */
export function redactSensitiveData(
  tableName: string,
  data: string | number | boolean | null | { [key: string]: unknown } | unknown[]
): typeof data {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;

  const sensitiveFields = getSensitiveFields(tableName);
  if (sensitiveFields.length === 0) return data;

  const redacted = { ...data };
  sensitiveFields.forEach((field) => {
    if (field in redacted) {
      redacted[field] = REDACTION_PLACEHOLDER;
    }
  });

  return redacted;
}

// ============================================
// TABLE NAME CONSTANTS
// ============================================

/**
 * Physical database tables with audit triggers
 */
export const PHYSICAL_AUDIT_TABLES = [
  "units",
  "guests",
  "bookings",
  "payments",
  "expenses",
  "maintenance_logs",
] as const;

/**
 * AUDIT_PSEUDO_TABLES - Virtual tables for application events
 * These don't have database triggers but are used for categorizing system/auth events
 */
export const AUDIT_PSEUDO_TABLES = [
  "system", // System-wide events (migrations, config changes, backups)
  "authentication", // Auth events (login, logout, failed attempts, password resets)
] as const;

/**
 * ALL_AUDIT_TABLES - Complete list of valid table names (physical + pseudo)
 */
export const ALL_AUDIT_TABLES = [...PHYSICAL_AUDIT_TABLES, ...AUDIT_PSEUDO_TABLES] as const;

/**
 * MANAGER_VISIBLE_TABLES - Tables visible to manager role
 * Excludes maintenance_logs (owner-only)
 */
export const MANAGER_VISIBLE_TABLES = [
  "bookings",
  "payments",
  "guests",
  "expenses",
  "system",
  "authentication",
] as const;

/**
 * Type-safe table name (physical + pseudo)
 */
export type AuditTableName =
  | (typeof PHYSICAL_AUDIT_TABLES)[number]
  | (typeof AUDIT_PSEUDO_TABLES)[number];

/**
 * Validate if a table name is auditable (includes both physical and pseudo tables)
 */
export function isValidAuditTable(tableName: string): tableName is AuditTableName {
  return ALL_AUDIT_TABLES.includes(tableName as AuditTableName);
}

/**
 * Check if a table has database triggers (Layer 1)
 */
export function hasAuditTrigger(tableName: string): boolean {
  return PHYSICAL_AUDIT_TABLES.includes(tableName as (typeof PHYSICAL_AUDIT_TABLES)[number]);
}

// ============================================
// DISPLAY NAMES FOR UI
// ============================================

/**
 * TABLE_DISPLAY_NAMES - Human-readable table names for UI
 */
export const TABLE_DISPLAY_NAMES: Record<AuditTableName, string> = {
  // Physical tables
  units: "Units",
  guests: "Guests",
  bookings: "Bookings",
  payments: "Payments",
  expenses: "Expenses",
  maintenance_logs: "Maintenance",

  // Pseudo tables
  system: "System",
  authentication: "Authentication",
};

/**
 * ACTION_DISPLAY_NAMES - Human-readable action names
 */
export const ACTION_DISPLAY_NAMES: Record<AuditAction, string> = {
  INSERT: "Created",
  UPDATE: "Updated",
  DELETE: "Deleted",
};

/**
 * CATEGORY_DISPLAY_NAMES - Human-readable category names
 */
export const CATEGORY_DISPLAY_NAMES: Record<AuditCategory, string> = {
  [AuditCategory.AUTHENTICATION]: "Authentication",
  [AuditCategory.BOOKING]: "Booking",
  [AuditCategory.PAYMENT]: "Payment",
  [AuditCategory.GUEST]: "Guest",
  [AuditCategory.UNIT]: "Unit",
  [AuditCategory.EXPENSE]: "Expense",
  [AuditCategory.MAINTENANCE]: "Maintenance",
  [AuditCategory.SYSTEM]: "System",
};

/**
 * SEVERITY_COLORS - Tailwind CSS color classes for severity badges
 * Keys match uppercase enum values
 */
export const SEVERITY_COLORS: Record<AuditSeverity, string> = {
  [AuditSeverity.INFO]: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  [AuditSeverity.WARNING]: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  [AuditSeverity.CRITICAL]: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  [AuditSeverity.DEBUG]: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
};

// ============================================
// PAGINATION DEFAULTS
// ============================================

/**
 * PAGINATION_DEFAULTS - Default pagination settings
 */
export const PAGINATION_DEFAULTS = {
  PAGE_SIZE: 50, // Default logs per page
  MAX_PAGE_SIZE: 200, // Maximum allowed per page
  STATS_LIMIT: 10, // Top N users in stats
  EXPORT_BATCH_SIZE: 1000, // Records per export batch
  RECENT_ACTIVITY_DAYS: 7, // Days for "recent activity" stats
} as const;

/**
 * CACHE_CONFIG - TanStack Query cache settings for audit logs
 */
export const AUDIT_CACHE_CONFIG = {
  STALE_TIME: 5 * 60 * 1000, // 5 minutes (logs don't change often)
  CACHE_TIME: 30 * 60 * 1000, // 30 minutes in cache
  RETRY: 2, // Retry failed queries twice
  REFETCH_ON_WINDOW_FOCUS: false, // Don't refetch on tab focus
} as const;

// ============================================
// OWNER EMAIL UTILITIES
// ============================================

/**
 * Get list of owner emails from environment
 */
export function getOwnerEmails(): string[] {
  const ownerEmailsEnv = import.meta.env.VITE_OWNER_EMAILS;
  if (!ownerEmailsEnv) {
    console.warn("VITE_OWNER_EMAILS not configured. Audit logs will have no owners.");
    return [];
  }
  return ownerEmailsEnv.split(",").map((email) => email.trim());
}

/**
 * Check if an email is an owner
 */
export function isOwnerEmail(email: string): boolean {
  const owners = getOwnerEmails();
  return owners.includes(email);
}

/**
 * Debug flag for audit system
 */
export const AUDIT_DEBUG = import.meta.env.VITE_AUDIT_DEBUG === "true";

export function auditDebugLog(message: string, data?: unknown): void {
  if (AUDIT_DEBUG) {
    console.log(`[AUDIT DEBUG] ${message}`, data);
  }
}
