// src/lib/auth-audit.ts

import { auth } from "./auth";
import { logAuditEventWithIP } from "./audit-logger-workers";
import { AuditCategory, AuditSeverity } from "../../database.types";

/**
 * Authentication wrapper module with IP-captured audit logging
 *
 * Purpose: Provides non-invasive audit logging for authentication events
 * without modifying the existing auth.ts security module (613 lines).
 *
 * Strategy: Wrapper functions that call auth module + Workers logging
 *
 * Usage: Replace auth.signIn() with signInWithAudit() in components
 * that require IP forensics (login forms, admin panels).
 *
 * Benefits:
 * - Zero modifications to existing auth.ts
 * - Audit failures don't block authentication
 * - Opt-in design (gradual migration)
 * - Easy to test in isolation
 */

/**
 * Sign in with IP-captured audit logging
 *
 * Wrapper for auth.signIn() that logs both successful and failed
 * login attempts with accurate IP addresses via Cloudflare Workers.
 *
 * @param email - User email
 * @param password - User password
 * @returns Auth data on successful login
 * @throws Error on authentication failure
 *
 * @example
 * // In LoginForm.tsx
 * try {
 *   const data = await signInWithAudit(email, password);
 *   navigate('/dashboard');
 * } catch (error) {
 *   setError(error.message);
 * }
 */
export async function signInWithAudit(email: string, password: string) {
  try {
    // Attempt login
    const result = await auth.signIn(email, password);

    // Log successful login with IP
    // Note: This is non-blocking - authentication succeeded even if logging fails
    await logAuditEventWithIP({
      tableName: "authentication",
      description: `User logged in: ${email}`,
      category: AuditCategory.AUTHENTICATION,
      severity: AuditSeverity.INFO,
      metadata: {
        email,
        timestamp: new Date().toISOString(),
        event: "login_success",
      },
    });

    return result;
  } catch (error) {
    // Log failed login attempt with IP
    // This provides forensic evidence for security investigations
    await logAuditEventWithIP({
      tableName: "authentication",
      description: `Failed login attempt for ${email}`,
      category: AuditCategory.AUTHENTICATION,
      severity: AuditSeverity.WARNING,
      metadata: {
        email,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        event: "login_failed",
      },
    });

    // Re-throw error to maintain original auth behavior
    throw error;
  }
}

/**
 * Sign out with IP-captured audit logging
 *
 * Wrapper for auth.signOut() that logs logout events with IP addresses.
 *
 * @returns Promise resolving when sign out completes
 *
 * @example
 * // In Header.tsx or Settings.tsx
 * await signOutWithAudit();
 * navigate('/login');
 */
export async function signOutWithAudit() {
  // Get current user before signing out (session will be cleared)
  const user = await auth.getCurrentUser();

  // Perform sign out
  await auth.signOut();

  // Log logout event with IP (if user was authenticated)
  if (user?.email) {
    // Note: This happens after signOut, so it might fail if session is cleared
    // We call it anyway for completeness, but don't await to avoid delays
    logAuditEventWithIP({
      tableName: "authentication",
      description: `User logged out: ${user.email}`,
      category: AuditCategory.AUTHENTICATION,
      severity: AuditSeverity.INFO,
      metadata: {
        email: user.email,
        timestamp: new Date().toISOString(),
        event: "logout",
      },
    }).catch((error) => {
      // Silent failure - logout succeeded, audit logging is best-effort
      console.warn("[Auth Audit] Logout logging failed:", error);
    });
  }
}

/**
 * Migration guide for existing components
 *
 * BEFORE (direct auth usage):
 * ```typescript
 * import { auth } from '@/lib/auth';
 *
 * const handleSubmit = async (data) => {
 *   await auth.signIn(data.email, data.password);
 *   navigate('/dashboard');
 * };
 * ```
 *
 * AFTER (with IP logging):
 * ```typescript
 * import { signInWithAudit } from '@/lib/auth-audit';
 *
 * const handleSubmit = async (data) => {
 *   await signInWithAudit(data.email, data.password);
 *   navigate('/dashboard');
 * };
 * ```
 *
 * The error handling remains identical - audit logging is transparent.
 */
