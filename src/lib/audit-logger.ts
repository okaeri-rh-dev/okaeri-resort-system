// src/lib/audit-logger.ts

import { db, supabase } from "./supabase";
import {
  AuditCategory,
  AuditSeverity,
  AuditEventType,
  type AuditEventContext,
  type AuditEventTypeValue,
} from "../../database.types";
import { redactSensitiveData, isValidAuditTable, auditDebugLog } from "./audit-constants";
import { getUserAuditRole as getUserRole, canAccessAuditTrail as canAccess } from "./audit-roles";

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
      oldData: redactedOldData as any, // Type cast needed due to Json union types
      newData: redactedNewData as any, // Type cast needed due to Json union types
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
// SPECIALIZED AUDIT LOGGING HELPERS
// ============================================

/**
 * Log authentication events
 * @param event - Auth event type
 * @param details - Additional context
 */
export async function logAuthEvent(
  event: "login" | "logout" | "login_failed" | "password_reset",
  details?: {
    email?: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  // Map event to AuditEventTypeValue
  const eventTypeMap: Record<typeof event, AuditEventTypeValue> = {
    login: AuditEventType.LOGIN,
    logout: AuditEventType.LOGOUT,
    login_failed: AuditEventType.LOGIN_FAILED,
    password_reset: AuditEventType.PASSWORD_RESET,
  };

  const severity =
    event === "login_failed"
      ? AuditSeverity.WARNING
      : event === "login"
        ? AuditSeverity.INFO
        : AuditSeverity.INFO;

  await logAuditEvent({
    tableName: "authentication", // Virtual table for auth events (Layer 2)
    recordId: undefined, // No specific record for auth events
    event_type: eventTypeMap[event], // Map to semantic event type
    description: `User ${event.replace("_", " ")}: ${details?.email || "unknown"}`,
    category: AuditCategory.AUTHENTICATION,
    severity,
    metadata: {
      event, // Also store in metadata for backward compatibility
      ...details?.metadata,
    },
  });
}

/**
 * Log booking lifecycle events
 * @param bookingId - Booking UUID
 * @param action - Booking action
 * @param details - Business context
 */
export async function logBookingEvent(
  bookingId: string,
  action: "created" | "updated" | "cancelled" | "checked_in" | "checked_out",
  details: {
    oldStatus?: string;
    newStatus?: string;
    reason?: string;
    amount?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  // Map action to AuditEventTypeValue (only for specific business events)
  const eventTypeMap: Partial<Record<typeof action, AuditEventTypeValue>> = {
    cancelled: AuditEventType.CANCEL_BOOKING,
    checked_in: AuditEventType.BOOKING_CHECKED_IN,
    checked_out: AuditEventType.BOOKING_CHECKED_OUT,
    // Note: 'created' and 'updated' don't have specific event types
  };

  const severity =
    action === "cancelled"
      ? AuditSeverity.WARNING
      : action === "created"
        ? AuditSeverity.INFO
        : AuditSeverity.INFO;

  await logAuditEvent({
    tableName: "bookings",
    recordId: bookingId,
    event_type: eventTypeMap[action], // Map to semantic event type (optional)
    description: `Booking ${action}${details.reason ? `: ${details.reason}` : ""}`,
    category: AuditCategory.BOOKING,
    severity,
    metadata: {
      action, // Also store in metadata for backward compatibility
      oldStatus: details.oldStatus,
      newStatus: details.newStatus,
      amount: details.amount,
      ...details.metadata,
    },
    oldData: details.oldStatus ? { booking_status: details.oldStatus } : undefined,
    newData: details.newStatus ? { booking_status: details.newStatus } : undefined,
  });
}

/**
 * Log payment events
 * @param paymentId - Payment UUID
 * @param action - Payment action
 * @param details - Financial context
 */
export async function logPaymentEvent(
  paymentId: string,
  action: "recorded" | "verified" | "refunded" | "failed",
  details: {
    amount: number;
    paymentMethod: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  // Map action to AuditEventTypeValue
  const eventTypeMap: Partial<Record<typeof action, AuditEventTypeValue>> = {
    refunded: AuditEventType.REFUND_PAYMENT,
    failed: AuditEventType.PAYMENT_FAILED,
    verified: AuditEventType.PAYMENT_VERIFIED,
    // Note: 'recorded' doesn't have a specific event type
  };

  const severity =
    action === "refunded"
      ? AuditSeverity.WARNING
      : action === "failed"
        ? AuditSeverity.CRITICAL
        : AuditSeverity.INFO;

  await logAuditEvent({
    tableName: "payments",
    recordId: paymentId,
    event_type: eventTypeMap[action], // Map to semantic event type (optional)
    description: `Payment ${action}: ₱${details.amount.toFixed(2)} via ${details.paymentMethod}${details.reason ? ` - ${details.reason}` : ""}`,
    category: AuditCategory.PAYMENT,
    severity,
    metadata: {
      action, // Also store in metadata for backward compatibility
      amount: details.amount,
      paymentMethod: details.paymentMethod,
      currency: "PHP",
      reason: details.reason,
      ...details.metadata,
    },
  });
}

/**
 * Log expense tracking events
 * @param expenseId - Expense UUID
 * @param action - Expense action
 * @param details - Expense context
 */
export async function logExpenseEvent(
  expenseId: string,
  action: "created" | "updated" | "deleted" | "category_changed",
  details: {
    amount: number;
    category: string;
    description: string;
    oldCategory?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  // Map action to AuditEventTypeValue
  const eventTypeMap: Partial<Record<typeof action, AuditEventTypeValue>> = {
    deleted: AuditEventType.EXPENSE_DELETED,
    category_changed: AuditEventType.EXPENSE_CATEGORY_CHANGED,
    // Note: 'created' and 'updated' don't have specific event types
  };

  const severity = action === "deleted" ? AuditSeverity.WARNING : AuditSeverity.INFO;

  await logAuditEvent({
    tableName: "expenses",
    recordId: expenseId,
    event_type: eventTypeMap[action], // Map to semantic event type (optional)
    description: `Expense ${action}: ${details.description} - ₱${details.amount.toFixed(2)}`,
    category: AuditCategory.EXPENSE,
    severity,
    metadata: {
      action, // Also store in metadata for backward compatibility
      amount: details.amount,
      expenseCategory: details.category,
      oldCategory: details.oldCategory,
      currency: "PHP",
      ...details.metadata,
    },
  });
}

/**
 * Log critical system operations
 * @param operation - System operation type
 * @param details - Operation context
 */
export async function logSystemEvent(
  operation: "migration" | "config_change" | "backup" | "other",
  details: {
    description: string;
    severity?: AuditSeverity;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  // Map operation to AuditEventTypeValue
  const eventTypeMap: Record<typeof operation, AuditEventTypeValue | undefined> = {
    migration: AuditEventType.SYSTEM_MIGRATION,
    config_change: AuditEventType.SYSTEM_CONFIG_CHANGED,
    backup: AuditEventType.SYSTEM_BACKUP,
    other: undefined, // No specific event type for generic operations
  };

  await logAuditEvent({
    tableName: "system", // Virtual table for system events (Layer 2)
    recordId: undefined, // No specific record for system events
    event_type: eventTypeMap[operation], // Map to semantic event type (optional)
    description: `System: ${details.description}`,
    category: AuditCategory.SYSTEM,
    severity: details.severity || AuditSeverity.INFO,
    metadata: {
      operation,
      ...details.metadata,
    },
  });
}

// ============================================
// BULK LOGGING HELPERS
// ============================================

/**
 * Log multiple audit events in sequence
 * Useful for batch operations
 *
 * @param contexts - Array of audit event contexts
 * @returns Array of results (success/failure for each)
 */
export async function logAuditEvents(
  contexts: AuditEventContext[]
): Promise<Array<{ success: boolean; error?: string }>> {
  const results = [];
  for (const context of contexts) {
    const result = await logAuditEvent(context);
    results.push(result);
  }
  return results;
}

// ============================================
// USER CONTEXT UTILITIES
// ============================================

/**
 * Get current user context for audit logging
 * Extracts user information from Supabase Auth
 *
 * @returns User context object or null
 */
export async function getCurrentUserContext(): Promise<{
  userId: string | null;
  email: string | null;
} | null> {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return {
      userId: user.id,
      email: user.email || null,
    };
  } catch (error) {
    console.error("[Audit] Failed to get user context:", error);
    return null;
  }
}

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

/**
 * Get current user's audit role
 * Re-exported from audit-roles module for convenience
 *
 * @returns User's audit role (admin, owner, manager, staff) or null
 */
export const getUserAuditRole = getUserRole;

/**
 * Check if user can access audit trail
 * Re-exported from audit-roles module for convenience
 *
 * @returns true if user has any audit role
 */
export const canAccessAuditTrail = canAccess;

// ============================================
// WORKERS IP CAPTURE (Phase 2E)
// ============================================

/**
 * Re-export Workers IP capture function for convenience
 * Use this for critical security events (authentication, refunds, deletions)
 */
export { logAuditEventWithIP } from "./audit-logger-workers";
