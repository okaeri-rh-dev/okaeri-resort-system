/**
 * Audit Logging for Cloudflare Workers (Phase 4.5)
 *
 * Workers-compatible audit logger for compliance with Philippine business requirements.
 * Logs all data mutations with IP address, user agent, and sanitized data for forensic analysis.
 *
 * @module AuditLoggerWorkers
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================
// TYPE DEFINITIONS
// ============================================

/**
 * Audit event severity levels
 */
export type AuditSeverity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";

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
  supabase: SupabaseClient,
  entry: AuditLogEntry,
  request?: Request
): Promise<void> {
  try {
    // Extract IP and user agent from request
    const metadata = entry.metadata || {};
    if (request) {
      metadata.ip_address = request.headers.get("cf-connecting-ip") || undefined;
      metadata.user_agent = request.headers.get("user-agent") || undefined;
    }

    // Insert audit log record
    const { error } = await supabase.from("audit_logs").insert({
      audit_id: crypto.randomUUID(),
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id || null,
      user_id: entry.user_id || null,
      severity: entry.severity || "INFO",
      description: entry.description || null,
      changes: entry.changes || null,
      metadata,
      created_at: new Date().toISOString(),
    });

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
type AuditBookingUnit = Record<string, unknown> & { booking_unit_id?: string; unit_id?: string };
type AuditPayment = Record<string, unknown> & {
  payment_id?: string;
  amount?: number;
  refunded_amount?: number;
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
  supabase: SupabaseClient,
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

/**
 * Create audit log for unit addition
 *
 * @param supabase - Supabase client
 * @param bookingId - Booking ID
 * @param unit - Added unit data
 * @param userId - User ID
 * @param request - Request object
 */
export async function logUnitAdded(
  supabase: SupabaseClient,
  bookingId: string,
  unit: AuditBookingUnit,
  userId: string | undefined,
  request?: Request
): Promise<void> {
  await logAuditEventWorker(
    supabase,
    {
      action: "booking.unit.added",
      entity_type: "booking_unit",
      entity_id: unit.booking_unit_id,
      user_id: userId,
      description: `Unit ${unit.unit_id} added to booking ${bookingId}`,
      changes: {
        before: null,
        after: sanitizeForAudit(unit),
      },
      metadata: {
        booking_id: bookingId,
        unit_id: unit.unit_id,
        unit_price: unit.unit_price,
        weekend_surcharge: unit.weekend_surcharge,
      },
    },
    request
  );
}

/**
 * Create audit log for unit removal
 *
 * @param supabase - Supabase client
 * @param bookingId - Booking ID
 * @param unitId - Unit ID
 * @param userId - User ID
 * @param request - Request object
 */
export async function logUnitRemoved(
  supabase: SupabaseClient,
  bookingId: string,
  unitId: string,
  userId: string | undefined,
  request?: Request
): Promise<void> {
  await logAuditEventWorker(
    supabase,
    {
      action: "booking.unit.removed",
      entity_type: "booking_unit",
      user_id: userId,
      severity: "WARNING",
      description: `Unit ${unitId} removed from booking ${bookingId}`,
      metadata: {
        booking_id: bookingId,
        unit_id: unitId,
      },
    },
    request
  );
}

/**
 * Create audit log for payment record
 *
 * @param supabase - Supabase client
 * @param payment - Payment data
 * @param userId - User ID
 * @param request - Request object
 */
export async function logPaymentRecorded(
  supabase: SupabaseClient,
  payment: AuditPayment,
  userId: string | undefined,
  request?: Request
): Promise<void> {
  await logAuditEventWorker(
    supabase,
    {
      action: "payment.recorded",
      entity_type: "payment",
      entity_id: payment.payment_id,
      user_id: userId,
      description: `Payment recorded: ₱${payment.amount?.toLocaleString() || "N/A"}`,
      changes: {
        before: null,
        after: sanitizeForAudit(payment),
      },
      metadata: {
        booking_id: payment.booking_id,
        amount: payment.amount,
        payment_method: payment.payment_method,
      },
    },
    request
  );
}

/**
 * Create audit log for refund
 *
 * @param supabase - Supabase client
 * @param payment - Payment data
 * @param refundAmount - Refund amount
 * @param reason - Refund reason
 * @param userId - User ID
 * @param request - Request object
 */
export async function logPaymentRefunded(
  supabase: SupabaseClient,
  payment: AuditPayment,
  refundAmount: number,
  reason: string,
  userId: string | undefined,
  request?: Request
): Promise<void> {
  await logAuditEventWorker(
    supabase,
    {
      action: "payment.refunded",
      entity_type: "payment",
      entity_id: payment.payment_id,
      user_id: userId,
      severity: "WARNING", // Refunds are flagged for review
      description: `Refund processed: ₱${refundAmount.toLocaleString()}`,
      changes: {
        before: { refunded_amount: payment.refunded_amount || 0 },
        after: { refunded_amount: (payment.refunded_amount || 0) + refundAmount },
      },
      metadata: {
        booking_id: payment.booking_id,
        refund_amount: refundAmount,
        reason: reason,
        total_refunded: (payment.refunded_amount || 0) + refundAmount,
      },
    },
    request
  );
}

/**
 * Create audit log for failed operation
 *
 * @param supabase - Supabase client
 * @param action - Action that failed
 * @param error - Error message
 * @param metadata - Additional context
 * @param request - Request object
 */
export async function logOperationFailed(
  supabase: SupabaseClient,
  action: string,
  error: string,
  metadata: Record<string, unknown> = {},
  request?: Request
): Promise<void> {
  await logAuditEventWorker(
    supabase,
    {
      action: `${action}.failed`,
      entity_type: "system",
      severity: "ERROR",
      description: `Operation failed: ${error}`,
      metadata: {
        ...metadata,
        error_message: error,
      },
    },
    request
  );
}
