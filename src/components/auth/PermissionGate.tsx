/**
 * Permission-based access control component
 * Renders children only if user has required permissions
 */

import type { ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/authStore";
import { permissionGuard, auditLogger } from "@/lib/security";
import type { UserRole, ProjectRole } from "@/types/common";

interface PermissionGateProps {
  children: ReactNode;
  resource?: string;
  action?: string;
  role?: UserRole | UserRole[];
  projectRole?: ProjectRole | ProjectRole[];
  projectId?: string;
  fallback?: ReactNode;
  redirectTo?: string;
  requireAll?: boolean; // Require all permissions vs any permission
}

export function PermissionGate({
  children,
  resource,
  action,
  role,
  projectRole,
  projectId,
  fallback,
  redirectTo,
  requireAll = false,
}: PermissionGateProps) {
  const user = useAuthStore((state) => state.user);
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const hasRole = useAuthStore((state) => state.hasRole);

  // Check if user is authenticated
  if (!user) {
    if (redirectTo) {
      return <Navigate to={redirectTo} />;
    }
    return <>{fallback || null}</>;
  }

  const checks: boolean[] = [];

  // Check resource/action permission
  if (resource && action) {
    const result = permissionGuard.hasPermission(user, {
      resource,
      action,
      projectId,
    });

    checks.push(result.allowed);

    if (!result.allowed) {
      // Log access denial
      auditLogger.logAccess(resource, action, false, user, {
        reason: result.reason,
        projectId,
      });
    }
  }

  // Check user role
  if (role) {
    const roles = Array.isArray(role) ? role : [role];
    const hasRequiredRole = requireAll
      ? roles.every((r) => hasRole(r))
      : roles.some((r) => hasRole(r));
    checks.push(hasRequiredRole);
  }

  // Check project role
  if (projectRole && projectId && user.projects) {
    const projectRoles = Array.isArray(projectRole) ? projectRole : [projectRole];
    const membership = user.projects.find((p) => p.projectId === projectId);

    if (membership) {
      const hasProjectRole = requireAll
        ? projectRoles.every((r) => membership.role === r)
        : projectRoles.some((r) => membership.role === r);
      checks.push(hasProjectRole);
    } else {
      checks.push(false);
    }
  }

  // Determine if access is allowed
  const allowed =
    checks.length === 0 || (requireAll ? checks.every(Boolean) : checks.some(Boolean));

  if (!allowed) {
    if (redirectTo) {
      return <Navigate to={redirectTo} />;
    }
    return <>{fallback || <AccessDenied />}</>;
  }

  return <>{children}</>;
}

/**
 * Default access denied component
 */
function AccessDenied() {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-red-400"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">Access Denied</h3>
          <p className="mt-1 text-sm text-red-700">
            You don't have permission to access this content.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to check permissions programmatically
 */
export function usePermissionCheck(
  resource?: string,
  action?: string,
  projectId?: string
): {
  allowed: boolean;
  loading: boolean;
  reason?: string;
} {
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);

  if (!user || !resource || !action) {
    return { allowed: false, loading: isLoading };
  }

  const result = permissionGuard.hasPermission(user, {
    resource,
    action,
    projectId,
  });

  return {
    allowed: result.allowed,
    loading: isLoading,
    reason: result.reason,
  };
}
