/**
 * Role-Based Access Control (RBAC) for Cloudflare Workers
 *
 * Provides role validation and authorization helpers for multi-unit booking API endpoints.
 * Integrates with JWT middleware to enforce role-based permissions.
 *
 * @module RBAC
 */

import type { AppRoleName } from "@/types/app-role";

// ============================================
// TYPE DEFINITIONS
// ============================================

/**
 * An app_roles role, or "user" when the account has no active app_roles row
 * (hierarchical: admin > owner > manager > staff > user)
 */
export type UserRole = AppRoleName | "user";

export const STAFF_OR_ABOVE: UserRole[] = ["staff", "manager", "owner", "admin"];
export const MANAGER_OR_ABOVE: UserRole[] = ["manager", "owner", "admin"];
export const OWNER_OR_ABOVE: UserRole[] = ["owner", "admin"];

/**
 * The caller, as resolved by the root middleware and passed to routes on
 * `context.data.user` (the Pages runtime hands each handler a fresh Request,
 * so nothing attached to the request survives; `data` is shared across the chain)
 */
export interface AuthenticatedUser {
  id: string;
  email?: string;
  role: UserRole;
}

export interface AuthenticatedData {
  user?: AuthenticatedUser;
}

/**
 * RBAC error types
 */
export class UnauthorizedError extends Error {
  status = 401;
  constructor(message = "Unauthorized: Authentication required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  status = 403;
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

// ============================================
// RBAC HELPER FUNCTIONS
// ============================================

/**
 * Require that user has one of the specified roles
 *
 * Throws ForbiddenError if user role is not in allowedRoles.
 * Throws UnauthorizedError if no user context exists.
 *
 * @param user - `context.data.user`, undefined when unauthenticated
 * @param allowedRoles - Array of roles that can access this resource
 * @throws {UnauthorizedError} If no user context
 * @throws {ForbiddenError} If user role not in allowedRoles
 *
 * @example
 * // Staff, manager, or admin can add units
 * requireRole(context.data.user, ['staff', 'manager', 'admin']);
 *
 * @example
 * // Only managers and admins can process refunds
 * requireRole(context.data.user, ['manager', 'admin']);
 */
export function requireRole(user: AuthenticatedUser | undefined, allowedRoles: UserRole[]): void {
  if (!user) {
    throw new UnauthorizedError("Authentication required");
  }

  if (!allowedRoles.includes(user.role)) {
    throw new ForbiddenError(
      `Access denied: Requires one of [${allowedRoles.join(", ")}], but user has role "${user.role}"`
    );
  }
}

/**
 * Check if user is staff or above (staff, manager, owner, admin)
 *
 * Staff members have basic operational permissions:
 * - View bookings
 * - Add units to bookings
 * - Update booking details
 *
 * @param user - `context.data.user`, undefined when unauthenticated
 * @returns True if user is staff, manager, owner, or admin
 *
 * @example
 * if (isStaffOrAbove(context.data.user)) {
 *   // Allow adding units to booking
 * }
 */
export function isStaffOrAbove(user: AuthenticatedUser | undefined): boolean {
  return STAFF_OR_ABOVE.includes(user?.role as UserRole);
}

/**
 * Check if user is manager or above (manager, owner, admin)
 *
 * Managers have elevated permissions:
 * - Process refunds
 * - Remove units from bookings
 * - Access financial reports
 * - Manage staff accounts
 *
 * @param user - `context.data.user`, undefined when unauthenticated
 * @returns True if user is manager, owner, or admin
 *
 * @example
 * if (isManagerOrAbove(context.data.user)) {
 *   // Allow processing refund
 * }
 */
export function isManagerOrAbove(user: AuthenticatedUser | undefined): boolean {
  return MANAGER_OR_ABOVE.includes(user?.role as UserRole);
}
