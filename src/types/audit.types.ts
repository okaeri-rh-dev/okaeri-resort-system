// ============================================
// AUDIT SYSTEM APPLICATION TYPES
// ============================================
// These types extend the database schema with application-level audit types
// Separated from database.types.ts as these are application-layer constructs

import type { Database } from "./database.types";

/**
 * AuditAction - Database audit action types
 * Matches the action column in audit_logs table
 */
export enum AuditAction {
  INSERT = "INSERT",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
}

/**
 * AuditCategory - Application-level category for audit events
 * Matches the category column in audit_logs table
 */
export enum AuditCategory {
  AUTHENTICATION = "AUTHENTICATION",
  BOOKING = "BOOKING",
  PAYMENT = "PAYMENT",
  GUEST = "GUEST",
  UNIT = "UNIT",
  EXPENSE = "EXPENSE",
  MAINTENANCE = "MAINTENANCE",
  SYSTEM = "SYSTEM",
}

/**
 * AuditSeverity - Severity level for audit events
 * Matches the severity column in audit_logs table
 */
export enum AuditSeverity {
  INFO = "INFO",
  WARNING = "WARNING",
  CRITICAL = "CRITICAL",
  DEBUG = "DEBUG",
}

/**
 * AuditEventType - Event type classification
 * Matches the event_type column in audit_logs table
 * Using const object instead of enum for runtime access
 */
export const AuditEventType = {
  // Authentication events
  LOGIN: "login",
  LOGOUT: "logout",
  LOGIN_FAILED: "login_failed",
  PASSWORD_RESET: "password_reset",

  // Booking events
  BOOKING_CREATED: "booking_created",
  BOOKING_UPDATED: "booking_updated",
  CANCEL_BOOKING: "booking_cancelled",
  BOOKING_CHECKED_IN: "booking_checked_in",
  BOOKING_CHECKED_OUT: "booking_checked_out",
  BOOKING_STATUS_OVERRIDE: "booking_status_override",

  // Payment events
  PAYMENT_RECEIVED: "payment_received",
  REFUND_PAYMENT: "payment_refunded",
  PAYMENT_FAILED: "payment_failed",
  PAYMENT_VERIFIED: "payment_verified",

  // Guest events
  GUEST_CREATED: "guest_created",
  GUEST_UPDATED: "guest_updated",

  // Unit events
  UNIT_UPDATED: "unit_updated",
  UNIT_CREATED: "unit_created",

  // Expense events
  EXPENSE_RECORDED: "expense_recorded",
  EXPENSE_UPDATED: "expense_updated",
  EXPENSE_DELETED: "expense_deleted",
  EXPENSE_CATEGORY_CHANGED: "expense_category_changed",

  // Maintenance events
  MAINTENANCE_SCHEDULED: "maintenance_scheduled",
  MAINTENANCE_COMPLETED: "maintenance_completed",

  // System events
  SYSTEM_CONFIG_CHANGED: "system_config_changed",
  SYSTEM_MIGRATION: "system_migration",
  SYSTEM_BACKUP: "system_backup",
} as const;

export type AuditEventTypeValue = (typeof AuditEventType)[keyof typeof AuditEventType];

/**
 * AuditLog - Extended audit log type with all fields
 */
export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];

/**
 * AuditLogFilters - Filters for querying audit logs
 * Uses camelCase for frontend compatibility
 */
export interface AuditLogFilters {
  tableName?: string;
  entity_type?: string;
  action?: AuditAction | string;
  category?: AuditCategory | string;
  severity?: AuditSeverity | string;
  eventType?: AuditEventTypeValue | string;
  userEmail?: string;
  userId?: string;
  userRole?: string;
  source?: string;
  startDate?: string;
  endDate?: string;
  recordId?: string;
  correlationId?: string;
  search?: string;
  offset?: number;
  limit?: number;
}

/**
 * AuditLogQueryResult - Result of audit log query with pagination
 */
export interface AuditLogQueryResult {
  data: AuditLog[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * AuditLogStats - Statistics for audit logs
 * Uses camelCase for frontend compatibility
 */
export interface AuditLogStats {
  totalLogs: number;
  byTable: Record<string, number>;
  byAction: Record<string, number>;
  byUser: Array<{
    email: string;
    count: number;
  }>;
  recentActivity: Array<{
    date: string;
    count: number;
  }>;
}

/**
 * AuditEventContext - Context information for logging audit events
 */
export interface AuditEventContext {
  category?: AuditCategory;
  severity?: AuditSeverity;
  event_type?: AuditEventTypeValue;
  description?: string;
  metadata?: Record<string, unknown>;
  correlation_id?: string;
  tableName?: string;
  recordId?: string;
  recordPk?: Database["public"]["Tables"]["audit_logs"]["Row"]["record_pk"];
  oldData?: unknown;
  newData?: unknown;
}

/**
 * EVENT_TYPE_DISPLAY_NAMES - Human-readable names for event types
 */
export const EVENT_TYPE_DISPLAY_NAMES: Record<string, string> = {
  login: "User Login",
  logout: "User Logout",
  login_failed: "Failed Login Attempt",
  password_reset: "Password Reset",
  booking_created: "Booking Created",
  booking_updated: "Booking Updated",
  booking_cancelled: "Booking Cancelled",
  payment_received: "Payment Received",
  guest_created: "Guest Created",
  unit_updated: "Unit Updated",
  expense_recorded: "Expense Recorded",
  maintenance_scheduled: "Maintenance Scheduled",
  system_config_changed: "System Configuration Changed",
};
