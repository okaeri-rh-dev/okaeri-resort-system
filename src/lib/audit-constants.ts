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

import { logger } from "@/lib/logger";
import { type AuditAction } from "@/types/audit.types";

// ============================================
// OWNER EMAIL UTILITIES
// ============================================

/**
 * @deprecated Use getUserAuditRole() from audit-roles.ts instead
 * Owner emails are now managed in the app_roles table, not environment variables.
 * This section has been removed as part of Phase 4 migration.
 */

// ============================================
// DEBUG CONFIGURATION
// ============================================

import { isEnvEnabled } from "./env";

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
  "expense_categories", // Expense category management events
] as const;

/**
 * ALL_AUDIT_TABLES - Complete list of valid table names (physical + pseudo)
 */
export const ALL_AUDIT_TABLES = [...PHYSICAL_AUDIT_TABLES, ...AUDIT_PSEUDO_TABLES] as const;

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

// ============================================
// DISPLAY NAMES FOR UI
// ============================================

/**
 * TABLE_DISPLAY_NAMES - Human-readable table names for UI
 */
export const TABLE_DISPLAY_NAMES: Record<AuditTableName, string> = {
  // Physical tables
  units: "Cabins",
  guests: "Guests",
  bookings: "Bookings",
  payments: "Payments",
  expenses: "Expenses",
  maintenance_logs: "Maintenance",

  // Pseudo tables
  system: "System",
  authentication: "Authentication",
  expense_categories: "Expense Categories",
};

/**
 * ACTION_DISPLAY_NAMES - Human-readable action names
 */
export const ACTION_DISPLAY_NAMES: Record<AuditAction, string> = {
  INSERT: "Created",
  UPDATE: "Updated",
  DELETE: "Deleted",
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

/**
 * Debug flag for audit system
 * Uses the environment compatibility layer to work in both Vite and Workers contexts
 */
export const AUDIT_DEBUG = isEnvEnabled("VITE_AUDIT_DEBUG");

/**
 * Log debug message if audit debugging is enabled
 * @param message - Debug message
 * @param data - Optional data to log
 */
export function auditDebugLog(message: string, data?: unknown): void {
  if (AUDIT_DEBUG) {
    logger.info(`[AUDIT DEBUG] ${message}`, { data });
  }
}
