// src/lib/auth-password-reset.ts

import { AuditCategory, AuditSeverity } from "@/types/audit.types";

import { logAuditEventWithIP } from "./audit-logger-workers";
import { supabase } from "./supabase";

/**
 * Password reset wrapper module with audit logging
 *
 * Purpose: Provides audit logging for password reset events
 * without modifying the existing auth.ts security module.
 *
 * Strategy: Wrapper functions that call Supabase auth + Workers logging
 *
 * Security Note: Always returns success to prevent email enumeration
 * - Success message is shown regardless of whether email exists
 * - Errors are logged internally but not exposed to users
 */

/**
 * Request password reset with audit logging
 *
 * This function ALWAYS succeeds from the UI perspective to prevent
 * email enumeration attacks. The actual success/failure is logged
 * for security monitoring.
 *
 * @param email - User email address
 *
 * @example
 * // In ForgotPasswordForm.tsx
 * await requestPasswordResetWithAudit(email);
 * // Always show success message
 * setSubmitted(true);
 */
export async function requestPasswordResetWithAudit(email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();

  try {
    await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
  } catch (error) {
    // Log error but don't expose to user (prevents enumeration)
    console.error("[Password Reset] Error:", error);
  }

  // Log password reset request (best-effort, non-blocking)
  // Note: This may fail if there's no session, which is expected
  // for password reset requests from unauthenticated users
  logAuditEventWithIP({
    tableName: "authentication",
    description: "Password reset requested",
    category: AuditCategory.AUTHENTICATION,
    severity: AuditSeverity.INFO,
    metadata: {
      email: normalizedEmail,
      event: "password_reset_requested",
      timestamp: new Date().toISOString(),
    },
  }).catch((error) => {
    // Silent failure - password reset should proceed regardless
    console.warn("[Password Reset Audit] Logging failed:", error);
  });
}

/**
 * Update password with audit logging
 *
 * Requires an active recovery session (from clicking the email link).
 * Logs the password change for security monitoring.
 *
 * @param newPassword - The new password to set
 * @throws Error if password update fails
 *
 * @example
 * // In ResetPasswordForm.tsx
 * try {
 *   await updatePasswordWithAudit(newPassword);
 *   toast.success("Password updated!");
 *   navigate("/login");
 * } catch (error) {
 *   toast.error(error.message);
 * }
 */
export async function updatePasswordWithAudit(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    // Log failed attempt
    logAuditEventWithIP({
      tableName: "authentication",
      description: "Password update failed",
      category: AuditCategory.AUTHENTICATION,
      severity: AuditSeverity.WARNING,
      metadata: {
        event: "password_update_failed",
        error: error.message,
        timestamp: new Date().toISOString(),
      },
    }).catch(console.error);

    throw new Error("Failed to update password. Please try again.");
  }

  // Get user email for audit log
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Log successful password update (higher severity for security monitoring)
  logAuditEventWithIP({
    tableName: "authentication",
    description: "Password updated successfully",
    category: AuditCategory.AUTHENTICATION,
    severity: AuditSeverity.WARNING, // Higher severity for password changes
    metadata: {
      email: user?.email,
      event: "password_updated",
      timestamp: new Date().toISOString(),
    },
  }).catch((error) => {
    // Silent failure - password update succeeded
    console.warn("[Password Update Audit] Logging failed:", error);
  });
}
