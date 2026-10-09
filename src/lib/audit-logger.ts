// src/lib/audit-logger.ts

import { AuditSeverity, type AuditEventContext } from "@/types/audit.types";

import { auditDebugLog, isValidAuditTable, redactSensitiveData } from "./audit-constants";
import { getUserAuditRole as getUserRole } from "./audit-roles";
import { db, supabase } from "./supabase";

// ============================================
// MAIN AUDIT LOGGING FUNCTION
// ============================================

/**
 * Log an audit event with business context
 *
 * This creates a Layer 2 audit log with enriched metadata.
 * Database triggers (Layer 1) still capture the actual data changes.
 *
 * NOTE: Layer 2 logs always use action='INSERT' and source='app' internally.
 * Store semantic action meaning in description or metadata.action if needed.
 *
 * @param context - Audit event context with business information
 * @returns Promise resolving to created audit log (or null if failed)
 *
 * @example
 * // Basic usage without correlation
 * await logAuditEvent({
 *   tableName: 'bookings',
 *   recordId: booking.booking_id,
 *   description: 'Booking cancelled by guest request',
 *   category: AuditCategory.BOOKING,
 *   severity: AuditSeverity.WARNING,
 *   metadata: { action: 'cancelled', cancellationReason: 'Personal emergency' }
 * });
 *
 * @example
 * // With correlation ID to link trigger log and app log
 * import { v4 as uuidv4 } from 'uuid';
 *
 * const correlationId = uuidv4();
 *
 * // 1. Perform database mutation (triggers fire)
 * const { data: booking } = await db.bookings.update(bookingId, { status: 'cancelled' });
 *
 * // 2. Log business context with same correlation_id
 * await logAuditEvent({
 *   tableName: 'bookings',
 *   recordId: bookingId,
 *   correlationId,  // ← Links this app log to the trigger log
 *   description: 'Booking cancelled by guest request',
 *   category: AuditCategory.BOOKING,
 *   severity: AuditSeverity.WARNING,
 * });
 */
export async function logAuditEvent(
  context: AuditEventContext
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate table name (includes both physical and pseudo tables)
    if (!context.tableName || !isValidAuditTable(context.tableName)) {
      console.warn(
        `[Audit] Table "${context.tableName ?? "undefined"}" is not a valid audit table`
      );
      return { success: false, error: "Invalid table name" };
    }

    // Warn if critical category without IP capture
    const CRITICAL_CATEGORIES = ["authentication", "payment"] as const;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (CRITICAL_CATEGORIES.includes(context.category as any)) {
      console.warn(
        `[Audit] Critical event ${context.category} logged without IP. ` +
          `Consider using server-side logging for accurate IP capture.`
      );
    }

    // Get current user from Supabase Auth
    const { error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.warn("[Audit] Failed to get current user:", authError.message);
      // Continue anyway - system operations may not have a user
    }

    // NOTE: XSS sanitization happens at UI rendering layer (see Phase 3b: Table Component)
    // The description is stored raw here and sanitized when displayed to users

    // Redact sensitive data
    const redactedOldData = context.oldData
      ? redactSensitiveData(
          context.tableName,
          context.oldData as
            | string
            | number
            | boolean
            | null
            | { [key: string]: unknown }
            | unknown[]
        )
      : null;
    const redactedNewData = context.newData
      ? redactSensitiveData(
          context.tableName,
          context.newData as
            | string
            | number
            | boolean
            | null
            | { [key: string]: unknown }
            | unknown[]
        )
      : null;

    // Build audit log metadata (only for extra context, NOT for dedicated columns)
    const metadata = context.metadata
      ? {
          ...(typeof context.metadata === "object" && !Array.isArray(context.metadata)
            ? context.metadata
            : {}),
          // Add timestamp for reference
          logged_at: new Date().toISOString(),
        }
      : { logged_at: new Date().toISOString() };

    // Create audit log via db helper
    // IMPORTANT: db.auditLogs.create() automatically sets action='INSERT' and source='app'
    const { data, error } = await db.auditLogs.create({
      tableName: context.tableName,
      recordId: context.recordId,
      correlation_id: context.correlation_id, // Optional: links to related trigger logs
      event_type: context.event_type, // Optional: semantic event type (e.g., AuditEventType.CANCEL_BOOKING)
      description: context.description, // Stored raw, sanitized at UI layer
      category: context.category,
      severity: context.severity || AuditSeverity.INFO,
      metadata, // Extra context only, NOT dedicated column values
      oldData: redactedOldData as unknown, // Type cast needed due to Json union types
      newData: redactedNewData as unknown, // Type cast needed due to Json union types
    });

    if (error) {
      console.error("[Audit] Failed to create audit log:", error.message);
      return { success: false, error: error.message };
    }

    auditDebugLog("Audit log created", { audit_id: data?.audit_id, context });

    return { success: true };
  } catch (error) {
    // Non-blocking: Audit logging failures should not break app functionality
    console.error("[Audit] Exception in logAuditEvent:", error);
    return { success: false, error: String(error) };
  }
}

// ============================================
// USER CONTEXT UTILITIES
// ============================================

/**
 * Check if current user is an owner (full audit access)
 * Now uses app_roles table instead of environment variables
 * @returns true if user is owner or admin
 * @deprecated Use getUserAuditRole() or canAccessAuditTrail() instead
 */
export async function isCurrentUserOwner(): Promise<boolean> {
  const role = await getUserRole();
  return role === "owner" || role === "admin";
}
