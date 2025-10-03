// src/lib/audit-logger-workers.ts

import { supabase } from "./supabase";
import type { AuditEventContext } from "../../database.types";

/**
 * Log audit event with IP capture via Cloudflare Workers
 *
 * Use this ONLY for critical security events where IP forensics matter:
 * - Authentication (login, logout, failed attempts)
 * - Financial operations (refunds, chargebacks)
 * - Data deletions
 * - Sensitive data exports
 *
 * For regular events, use logAuditEvent() from audit-logger.ts (client-side)
 *
 * @param context - Audit event context with business information
 * @returns Promise resolving to success/error status
 *
 * @example
 * // Log critical authentication event with IP
 * await logAuditEventWithIP({
 *   tableName: 'authentication',
 *   description: 'Failed login attempt',
 *   category: AuditCategory.AUTHENTICATION,
 *   severity: AuditSeverity.WARNING,
 *   metadata: {
 *     email: 'user@example.com',
 *     reason: 'Invalid password'
 *   }
 * });
 *
 * @example
 * // Log refund with IP
 * await logAuditEventWithIP({
 *   tableName: 'payments',
 *   recordId: paymentId,
 *   description: `Refund processed: ₱${amount.toLocaleString()}`,
 *   category: AuditCategory.PAYMENT,
 *   severity: AuditSeverity.WARNING,
 *   metadata: { amount, reason },
 *   oldData: { payment_status: 'completed' },
 *   newData: { payment_status: 'refunded' }
 * });
 */
export async function logAuditEventWithIP(
  context: AuditEventContext
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current user session token
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      console.warn("[Audit Workers] No active session, skipping IP capture");
      return { success: false, error: "No active session" };
    }

    // Call Cloudflare Workers endpoint
    const response = await fetch("/api/audit/log-with-ip", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        tableName: context.tableName,
        recordId: context.recordId,
        description: context.description,
        category: context.category,
        severity: context.severity || "INFO",
        metadata: context.metadata,
        oldData: context.oldData,
        newData: context.newData,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[Audit Workers] Failed:", errorData);
      return { success: false, error: errorData.error };
    }

    const result = await response.json();
    console.log("[Audit Workers] Logged with IP:", result.audit_id);
    return { success: true };
  } catch (error) {
    console.error("[Audit Workers] Exception:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
