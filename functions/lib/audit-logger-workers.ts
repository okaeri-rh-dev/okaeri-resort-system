/**
 * Audit Logging for Cloudflare Workers (Phase 4.5)
 *
 * Workers-compatible audit logger for compliance with Philippine business requirements.
 * Logs all data mutations with IP address, user agent, and sanitized data for forensic analysis.
 *
 * @module AuditLoggerWorkers
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json, TablesInsert } from "@/types/database.types";

// ============================================
// TYPE DEFINITIONS
// ============================================

/**
 * Audit event severity levels
 */
export type AuditSeverity = "INFO" | "WARNING" | "CRITICAL" | "DEBUG";

/**
 * Audit event entry
 */
export interface AuditLogEntry {
  action: string; // e.g., 'multi_unit_booking.created', 'booking.unit.added'
  entity_type: string; // e.g., 'booking', 'booking_unit', 'payment'
  entity_id?: string; // UUID of affected entity
  user_id?: string; // UUID of user performing action
  severity?: AuditSeverity; // Default: 'INFO'
  description?: string; // Human-readable description
  changes?: {
    before: Record<string, unknown> | null; // State before mutation (null for creates)
    after: Record<string, unknown> | null; // State after mutation (null for deletes)
  };
  metadata?: {
    ip_address?: string; // Client IP from Cloudflare
    user_agent?: string; // User agent string
    [key: string]: unknown; // Additional metadata
  };
}

// ============================================
// SENSITIVE DATA PATTERNS
// ============================================

/**
 * Fields that should never appear in audit logs
 */
const SENSITIVE_FIELDS = [
  "password",
  "password_hash",
  "password_salt",
  "credit_card",
  "credit_card_number",
  "card_number",
  "cvv",
  "cvc",
  "ssn",
  "social_security",
  "token",
  "secret",
  "api_key",
  "private_key",
  "access_token",
  "refresh_token",
] as const;

// ============================================
// AUDIT LOGGING FUNCTIONS
// ============================================

/**
 * Log audit event to Supabase audit_logs table
 *
 * Automatically captures IP address and user agent from request headers.
 * Never throws errors - logs failures to console instead to prevent blocking operations.
 *
 * @param supabase - Supabase client (service role)
 * @param entry - Audit log entry
 * @param request - Optional request object for IP/user agent extraction
 *
 * @example
 * // Log multi-unit booking creation
 * await logAuditEventWorker(supabase, {
 *   action: 'multi_unit_booking.created',
 *   entity_type: 'booking',
 *   entity_id: booking.booking_id,
 *   user_id: user.id,
 *   changes: {
 *     before: null,
 *     after: sanitizeForAudit(booking),
 *   },
 *   metadata: {
 *     unit_count: booking.booking_units.length,
 *     total_amount: booking.total_amount,
 *   },
 * }, request);
 *
 * @example
 * // Log payment refund (WARNING severity)
 * await logAuditEventWorker(supabase, {
 *   action: 'payment.refunded',
 *   entity_type: 'payment',
 *   entity_id: payment.payment_id,
 *   severity: 'WARNING',
 *   changes: {
 *     before: { refunded_amount: payment.refunded_amount },
 *     after: { refunded_amount: payment.refunded_amount + refundAmount },
 *   },
 *   metadata: { refund_amount: refundAmount, reason: data.reason },
 * }, request);
 */
export async function logAuditEventWorker(
  supabase: SupabaseClient<Database>,
  entry: AuditLogEntry,
  request?: { headers: { get(name: string): string | null } }
): Promise<void> {
  try {
    // Extract IP and user agent from request
    const metadata = entry.metadata || {};
    if (request) {
      metadata.ip_address = request.headers.get("cf-connecting-ip") || undefined;
      metadata.user_agent = request.headers.get("user-agent") || undefined;
    }

    // Insert audit log record
    // Application events use action INSERT + source "app", like db.auditLogs.create;
    // the event name goes in event_type (audit_logs_action_check allows only INSERT/UPDATE/DELETE)
    const { error } = await supabase.from("audit_logs").insert({
      action: "INSERT",
      source: "app",
      event_type: entry.action,
      table_name: entry.entity_type,
      record_id: entry.entity_id ?? null,
      user_id: entry.user_id ?? null,
      severity: entry.severity ?? "INFO",
      description: entry.description ?? null,
      old_data: (entry.changes?.before ?? null) as Json,
      new_data: (entry.changes?.after ?? null) as Json,
      metadata: metadata as Json,
      ip_address: metadata.ip_address ?? null,
      user_agent: metadata.user_agent ?? null,
    } satisfies TablesInsert<"audit_logs">);

    if (error) {
      // Log but don't throw - audit logging should never block operations
      console.error("[Audit Workers] Failed to log event:", error);
      console.error("[Audit Workers] Event:", entry);
    }
  } catch (error) {
    // Catch-all for any unexpected errors
    console.error("[Audit Workers] Exception during audit logging:", error);
    console.error("[Audit Workers] Event:", entry);
  }
}

/**
 * Sanitize data before logging to audit trail
 *
 * Removes sensitive fields that should never appear in logs.
 * Handles nested objects and arrays recursively.
 *
 * @param data - Data to sanitize
 * @returns Sanitized copy of data
 *
 * @example
 * const booking = {
 *   booking_id: '123',
 *   guest_name: 'John Doe',
 *   credit_card: '1234-5678-9012-3456', // SENSITIVE
 *   payment_method: 'GCash'
 * };
 *
 * const sanitized = sanitizeForAudit(booking);
 * // {
 * //   booking_id: '123',
 * //   guest_name: 'John Doe',
 * //   payment_method: 'GCash'
 * //   // credit_card removed
 * // }
 */
export function sanitizeForAudit<T>(data: T): Partial<T> {
  if (data === null || data === undefined) {
    return data as Partial<T>;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForAudit(item)) as unknown as Partial<T>;
  }

  // Handle objects
  if (typeof data === "object") {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      // Skip sensitive fields
      if (SENSITIVE_FIELDS.some((field) => key.toLowerCase().includes(field))) {
        continue;
      }

      // Recursively sanitize nested objects
      if (value !== null && typeof value === "object") {
        sanitized[key] = sanitizeForAudit(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized as Partial<T>;
  }

  // Return primitive values as-is
  return data as Partial<T>;
}

// Rows passed to the convenience loggers; only the fields they read are typed
type AuditBooking = Record<string, unknown> & {
  booking_id?: string;
  booking_reference?: string;
  booking_units?: unknown[];
};

/**
 * Create audit log for booking creation
 *
 * Convenience wrapper for multi-unit booking creation events.
 *
 * @param supabase - Supabase client
 * @param booking - Booking data
 * @param userId - User ID
 * @param request - Request object
 */
export async function logBookingCreated(
  supabase: SupabaseClient<Database>,
  booking: AuditBooking,
  userId: string | undefined,
  request?: Request
): Promise<void> {
  await logAuditEventWorker(
    supabase,
    {
      action: "multi_unit_booking.created",
      entity_type: "booking",
      entity_id: booking.booking_id,
      user_id: userId,
      description: `Multi-unit booking created: ${booking.booking_reference || "N/A"}`,
      changes: {
        before: null,
        after: sanitizeForAudit(booking),
      },
      metadata: {
        unit_count: booking.booking_units?.length || 0,
        total_amount: booking.total_amount,
        payment_method: booking.payment_method,
      },
    },
    request
  );
}
