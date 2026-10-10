// src/lib/audit-constants.ts

/**
 * Audit System Constants
 *
 * Central location for all audit-related constants, including:
 * - Table name constants
 * - Display names for UI
 * - Pagination and cache configuration
 */

import { type AuditAction } from "@/types/audit.types";

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
