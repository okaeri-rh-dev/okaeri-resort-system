// src/lib/auth-password-reset.ts

import { AuditCategory, AuditSeverity } from "@/types/audit.types";

import { logAuditEventWithIP } from "./audit-logger-workers";
import { supabase } from "./supabase";

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
