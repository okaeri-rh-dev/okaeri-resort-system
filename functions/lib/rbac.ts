/**
 * Role-Based Access Control (RBAC) for Cloudflare Workers
 *
 * Provides role validation and authorization helpers for multi-unit booking API endpoints.
 * Integrates with JWT middleware to enforce role-based permissions.
 *
 * @module RBAC
 */

// ============================================
// TYPE DEFINITIONS
// ============================================

/**
 * User roles in the system (hierarchical)
 */
export type UserRole = "user" | "staff" | "manager" | "admin";

/**
 * User context attached to request by middleware
 */
export interface RequestUser {
  id: string;
  email?: string;
  role: UserRole;
  [key: string]: unknown;
}

/**
 * Authenticated request with user context
 */
export interface AuthenticatedRequest extends Request {
  user?: RequestUser;
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
 * @param request - Request with user context
 * @param allowedRoles - Array of roles that can access this resource
 * @throws {UnauthorizedError} If no user context
 * @throws {ForbiddenError} If user role not in allowedRoles
 *
 * @example
 * // Staff, manager, or admin can add units
 * requireRole(request, ['staff', 'manager', 'admin']);
 *
 * @example
 * // Only managers and admins can process refunds
 * requireRole(request, ['manager', 'admin']);
 */
export function requireRole(request: Request, allowedRoles: UserRole[]): void {
  const user = (request as AuthenticatedRequest).user;

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
 * Check if user has a specific role
 *
 * @param request - Request with user context
 * @param role - Role to check
 * @returns True if user has the specified role
 *
 * @example
 * if (hasRole(request, 'admin')) {
 *   // Show admin-only features
 * }
 */
export function hasRole(request: Request, role: UserRole): boolean {
  const user = (request as AuthenticatedRequest).user;
  return user?.role === role;
}

/**
 * Check if user is staff or above (staff, manager, admin)
 *
 * Staff members have basic operational permissions:
 * - View bookings
 * - Add units to bookings
 * - Update booking details
 *
 * @param request - Request with user context
 * @returns True if user is staff, manager, or admin
 *
 * @example
 * if (isStaffOrAbove(request)) {
 *   // Allow adding units to booking
 * }
 */
export function isStaffOrAbove(request: Request): boolean {
  const user = (request as AuthenticatedRequest).user;
  return ["staff", "manager", "admin"].includes(user?.role || "");
}

/**
 * Check if user is manager or above (manager, admin)
 *
 * Managers have elevated permissions:
 * - Process refunds
 * - Remove units from bookings
 * - Access financial reports
 * - Manage staff accounts
 *
 * @param request - Request with user context
 * @returns True if user is manager or admin
 *
 * @example
 * if (isManagerOrAbove(request)) {
 *   // Allow processing refund
 * }
 */
export function isManagerOrAbove(request: Request): boolean {
  const user = (request as AuthenticatedRequest).user;
  return ["manager", "admin"].includes(user?.role || "");
}

/**
 * Check if user is admin
 *
 * Admins have full system access:
 * - All manager permissions
 * - System configuration
 * - User management
 * - Security settings
 *
 * @param request - Request with user context
 * @returns True if user is admin
 *
 * @example
 * if (isAdmin(request)) {
 *   // Allow system configuration changes
 * }
 */
export function isAdmin(request: Request): boolean {
  return hasRole(request, "admin");
}

/**
 * Get current user from request context
 *
 * @param request - Request with user context
 * @returns User object or null if not authenticated
 */
export function getCurrentUser(request: Request): RequestUser | null {
  return (request as AuthenticatedRequest).user || null;
}

/**
 * Get user ID from request context
 *
 * @param request - Request with user context
 * @returns User ID or null if not authenticated
 */
export function getUserId(request: Request): string | null {
  const user = getCurrentUser(request);
  return user?.id || null;
}

/**
 * Create error response for RBAC failures
 *
 * @param error - RBAC error
 * @returns Response with appropriate status code and error message
 *
 * @example
 * try {
 *   requireRole(request, ['manager', 'admin']);
 * } catch (error) {
 *   return createErrorResponse(error);
 * }
 */
export function createErrorResponse(error: UnauthorizedError | ForbiddenError): Response {
  return Response.json(
    {
      error: error.name,
      message: error.message,
      code: error.status,
    },
    { status: error.status }
  );
}

// ============================================
// RBAC MIDDLEWARE WRAPPER
// ============================================

/**
 * Wrap endpoint handler with RBAC check
 *
 * Automatically handles RBAC errors and returns appropriate responses.
 *
 * @param allowedRoles - Roles that can access this endpoint
 * @param handler - Endpoint handler function
 * @returns Wrapped handler with RBAC enforcement
 *
 * @example
 * export const onRequestPost = withRBAC(
 *   ['staff', 'manager', 'admin'],
 *   async (context) => {
 *     // Handler code - user is already authorized
 *     return Response.json({ success: true });
 *   }
 * );
 */
export function withRBAC<Env = unknown>(
  allowedRoles: UserRole[],
  handler: (context: EventContext<Env, string, Record<string, unknown>>) => Promise<Response>
) {
  return async (context: EventContext<Env, string, Record<string, unknown>>): Promise<Response> => {
    try {
      // Check RBAC
      requireRole(context.request, allowedRoles);

      // Call handler if authorized
      return await handler(context);
    } catch (error) {
      // Handle RBAC errors
      if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
        return createErrorResponse(error);
      }

      // Re-throw other errors
      throw error;
    }
  };
}

// ============================================
// ROLE HIERARCHY UTILITIES
// ============================================

/**
 * Get role hierarchy level (higher = more privileged)
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  user: 0,
  staff: 1,
  manager: 2,
  admin: 3,
};

/**
 * Check if one role has higher or equal privileges than another
 *
 * @param userRole - User's current role
 * @param requiredRole - Minimum required role
 * @returns True if userRole >= requiredRole in hierarchy
 *
 * @example
 * hasRoleOrAbove('manager', 'staff'); // true (manager > staff)
 * hasRoleOrAbove('staff', 'manager'); // false (staff < manager)
 */
export function hasRoleOrAbove(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Get all roles at or above a certain level
 *
 * @param minRole - Minimum role level
 * @returns Array of roles at or above minRole
 *
 * @example
 * getRolesAbove('staff'); // ['staff', 'manager', 'admin']
 * getRolesAbove('admin'); // ['admin']
 */
export function getRolesAbove(minRole: UserRole): UserRole[] {
  const minLevel = ROLE_HIERARCHY[minRole];
  return (Object.keys(ROLE_HIERARCHY) as UserRole[]).filter(
    (role) => ROLE_HIERARCHY[role] >= minLevel
  );
}
