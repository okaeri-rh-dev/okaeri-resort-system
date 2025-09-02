/**
 * Route guard component for advanced route protection
 * Implements role-based and permission-based access control
 */

import { auditLogger, permissionGuard, PERMISSIONS } from "@/lib/security";
import { useAuthStore } from "@/stores/authStore";
import type { ProjectRole, UserRole } from "@/types/common";
import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useCallback } from "react";

export interface RouteGuardConfig {
  requiredRoles?: UserRole[];
  requiredProjectRoles?: ProjectRole[];
  requiredPermissions?: Array<{
    resource: string;
    action: string;
  }>;
  requireProjectAccess?: boolean;
  requireAllRoles?: boolean;
  requireAllPermissions?: boolean;
  customCheck?: (user: any) => boolean;
  redirectTo?: string;
  onAccessDenied?: () => void;
}

interface RouteGuardProps extends RouteGuardConfig {
  children: ReactNode;
  name?: string; // Route name for logging
}

export function RouteGuard({
  children,
  name,
  requiredRoles = [],
  requiredProjectRoles = [],
  requiredPermissions = [],
  requireProjectAccess = false,
  requireAllRoles = false,
  requireAllPermissions = true,
  customCheck,
  redirectTo = "/dashboard",
  onAccessDenied,
}: RouteGuardProps) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const activeProjectId = useAuthStore((state) => state.activeProjectId);

  // Memoize handleAccessDenied to prevent recreation on every render
  const handleAccessDenied = useCallback(
    (reason: string) => {
      // Log access denial
      auditLogger.logSecurityEvent("violation", {
        route: name || window.location.pathname,
        reason,
        userId: user?.id,
        userEmail: user?.email,
        projectId: activeProjectId,
      });

      // Call custom handler if provided
      if (onAccessDenied) {
        onAccessDenied();
      }

      // Redirect
      navigate({ to: redirectTo });
    },
    [name, user?.id, user?.email, activeProjectId, onAccessDenied, redirectTo, navigate]
  );

  useEffect(() => {
    if (!user) {
      // User not authenticated, redirect to login
      navigate({ to: "/login" });
      return;
    }

    // Check user roles
    if (requiredRoles.length > 0) {
      const hasRequiredRoles = requireAllRoles
        ? requiredRoles.every((role) => user.role === role)
        : requiredRoles.some((role) => user.role === role);

      if (!hasRequiredRoles) {
        handleAccessDenied("insufficient_role");
        return;
      }
    }

    // Check project roles
    if (requiredProjectRoles.length > 0 && activeProjectId) {
      const membership = user.projects?.find((p) => p.projectId === activeProjectId);

      if (!membership) {
        handleAccessDenied("not_project_member");
        return;
      }

      const hasRequiredProjectRoles = requireAllRoles
        ? requiredProjectRoles.every((role) => membership.role === role)
        : requiredProjectRoles.some((role) => membership.role === role);

      if (!hasRequiredProjectRoles) {
        handleAccessDenied("insufficient_project_role");
        return;
      }
    }

    // Check permissions
    if (requiredPermissions.length > 0) {
      const permissionResults = requiredPermissions.map((perm) =>
        permissionGuard.hasPermission(user, {
          resource: perm.resource,
          action: perm.action,
          projectId: requireProjectAccess ? activeProjectId : undefined,
        })
      );

      const hasRequiredPermissions = requireAllPermissions
        ? permissionResults.every((r) => r.allowed)
        : permissionResults.some((r) => r.allowed);

      if (!hasRequiredPermissions) {
        handleAccessDenied("insufficient_permissions");
        return;
      }
    }

    // Check project access
    if (requireProjectAccess && activeProjectId) {
      const canAccess = permissionGuard.canAccessProject(user, activeProjectId);

      if (!canAccess) {
        handleAccessDenied("no_project_access");
        return;
      }
    }

    // Custom check
    if (customCheck && !customCheck(user)) {
      handleAccessDenied("custom_check_failed");
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user,
    activeProjectId,
    handleAccessDenied,
    // Stable prop dependencies
    requireAllRoles,
    requireAllPermissions,
    requireProjectAccess,
    // Note: Arrays are converted to stable strings to avoid reference changes
    // that would cause unnecessary re-renders
    requiredRoles.join(","),
    requiredProjectRoles.join(","),
    JSON.stringify(requiredPermissions),
    customCheck,
  ]);

  return <>{children}</>;
}

/**
 * Pre-configured route guards for common scenarios
 */
export const RouteGuards = {
  /**
   * Admin only routes
   */
  AdminOnly: ({ children, ...props }: Omit<RouteGuardProps, "requiredRoles">) => (
    <RouteGuard {...props} requiredRoles={["SUPER_ADMIN", "ADMIN"] as UserRole[]}>
      {children}
    </RouteGuard>
  ),

  /**
   * Manager and above
   */
  ManagerLevel: ({ children, ...props }: Omit<RouteGuardProps, "requiredRoles">) => (
    <RouteGuard {...props} requiredRoles={["SUPER_ADMIN", "ADMIN", "MANAGER"] as UserRole[]}>
      {children}
    </RouteGuard>
  ),

  /**
   * Project owner only
   */
  ProjectOwnerOnly: ({ children, ...props }: Omit<RouteGuardProps, "requiredProjectRoles">) => (
    <RouteGuard {...props} requiredProjectRoles={["OWNER"] as ProjectRole[]} requireProjectAccess>
      {children}
    </RouteGuard>
  ),

  /**
   * Financial access (expenses, reports)
   */
  FinancialAccess: ({ children, ...props }: Omit<RouteGuardProps, "requiredPermissions">) => (
    <RouteGuard
      {...props}
      requiredPermissions={[
        { resource: PERMISSIONS.RESOURCES.EXPENSE, action: PERMISSIONS.ACTIONS.READ },
        { resource: PERMISSIONS.RESOURCES.REPORT, action: PERMISSIONS.ACTIONS.READ },
      ]}
      requireAllPermissions={false}
    >
      {children}
    </RouteGuard>
  ),

  /**
   * Booking management
   */
  BookingManagement: ({ children, ...props }: Omit<RouteGuardProps, "requiredPermissions">) => (
    <RouteGuard
      {...props}
      requiredPermissions={[
        { resource: PERMISSIONS.RESOURCES.BOOKING, action: PERMISSIONS.ACTIONS.MANAGE },
      ]}
    >
      {children}
    </RouteGuard>
  ),

  /**
   * Settings access
   */
  SettingsAccess: ({ children, ...props }: Omit<RouteGuardProps, "requiredPermissions">) => (
    <RouteGuard
      {...props}
      requiredPermissions={[
        { resource: PERMISSIONS.RESOURCES.SETTINGS, action: PERMISSIONS.ACTIONS.MANAGE },
      ]}
    >
      {children}
    </RouteGuard>
  ),
};

/**
 * Hook for programmatic route guard checks
 */
export function useRouteGuard(config: RouteGuardConfig): {
  allowed: boolean;
  loading: boolean;
  reason?: string;
} {
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const activeProjectId = useAuthStore((state) => state.activeProjectId);

  if (!user) {
    return { allowed: false, loading: isLoading, reason: "not_authenticated" };
  }

  // Check roles
  if (config.requiredRoles && config.requiredRoles.length > 0) {
    const hasRequiredRoles = config.requireAllRoles
      ? config.requiredRoles.every((role) => user.role === role)
      : config.requiredRoles.some((role) => user.role === role);

    if (!hasRequiredRoles) {
      return { allowed: false, loading: false, reason: "insufficient_role" };
    }
  }

  // Check permissions
  if (config.requiredPermissions && config.requiredPermissions.length > 0) {
    const permissionResults = config.requiredPermissions.map((perm) =>
      permissionGuard.hasPermission(user, {
        resource: perm.resource,
        action: perm.action,
        projectId: config.requireProjectAccess ? activeProjectId : undefined,
      })
    );

    const hasRequiredPermissions = config.requireAllPermissions
      ? permissionResults.every((r) => r.allowed)
      : permissionResults.some((r) => r.allowed);

    if (!hasRequiredPermissions) {
      return { allowed: false, loading: false, reason: "insufficient_permissions" };
    }
  }

  // Custom check
  if (config.customCheck && !config.customCheck(user)) {
    return { allowed: false, loading: false, reason: "custom_check_failed" };
  }

  return { allowed: true, loading: false };
}
