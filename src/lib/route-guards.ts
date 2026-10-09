/**
 * Route Guards for TanStack Router
 *
 * Centralized route protection utilities using the role hierarchy from audit-roles.ts.
 * These guards are designed for use in beforeLoad hooks to enforce RBAC.
 *
 * Role Hierarchy: admin (4) > owner (3) > manager (2) > staff (1)
 *
 * @example
 * // In a route file:
 * import { requireOwner } from "@/lib/route-guards";
 *
 * export const Route = createFileRoute("/admin/units")({
 *   beforeLoad: async () => {
 *     await requireOwner();
 *   },
 *   component: UnitsPage,
 * });
 */

import { redirect } from "@tanstack/react-router";

import { AuditRole, getUserAuditRole } from "./audit-roles";
import { logger } from "./logger";

// ============================================
// TYPES
// ============================================

export interface RouteGuardOptions {
  /** Minimum role required to access the route */
  requiredRole: AuditRole;
  /** URL to redirect to on failure (default: /admin/dashboard) */
  redirectTo?: string;
  /** Custom error message for the redirect */
  message?: string;
}

// ============================================
// MAIN GUARD FUNCTION
// ============================================

/**
 * Route guard for beforeLoad hooks
 * Validates user has required role or higher based on role hierarchy
 *
 * @param options - Configuration for the guard
 * @throws redirect to dashboard if access denied
 *
 * @example
 * beforeLoad: async () => {
 *   await requireRole({ requiredRole: AuditRole.MANAGER });
 * }
 */
export async function requireRole(options: RouteGuardOptions): Promise<void> {
  const { requiredRole, redirectTo = "/admin/dashboard" } = options;

  const userRole = await getUserAuditRole();
  const hasAccess = hasRoleLevel(userRole, requiredRole);

  if (!hasAccess) {
    logger.warn("Unauthorized route access attempt", {
      userRole: userRole || "none",
      requiredRole,
      redirectTo,
    });

    throw redirect({
      to: redirectTo,
    });
  }

  logger.info("Route access granted", { userRole, requiredRole });
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Require staff role or higher
 * Access: staff, manager, owner, admin
 */
export async function requireStaff(): Promise<void> {
  await requireRole({
    requiredRole: AuditRole.STAFF,
    message: "This page requires Staff access or higher",
  });
}

/**
 * Require manager role or higher
 * Access: manager, owner, admin
 * Use for: Guests, Payments
 */
export async function requireManager(): Promise<void> {
  await requireRole({
    requiredRole: AuditRole.MANAGER,
    message: "This page requires Manager access or higher",
  });
}

// ============================================
// SYNCHRONOUS ROLE CHECK HELPER
// ============================================

/**
 * Check if a user role meets the minimum required role level
 * Useful for synchronous checks in UI components
 *
 * @param userRole - The user's current role
 * @param requiredRole - The minimum required role
 * @returns true if userRole meets or exceeds requiredRole
 */
export function hasRoleLevel(userRole: AuditRole | null, requiredRole: AuditRole): boolean {
  if (!userRole) return false;

  const roleHierarchy: Record<AuditRole, number> = {
    [AuditRole.ADMIN]: 4,
    [AuditRole.OWNER]: 3,
    [AuditRole.MANAGER]: 2,
    [AuditRole.STAFF]: 1,
  };

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}
