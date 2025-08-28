/**
 * TanStack Router Authentication Guards
 * Implements comprehensive route protection with enhanced security
 */

import { redirect } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/authStore";
import { useProjectStore } from "@/stores/projectStore";
import { secureTokenManager as tokenManager, auditLogger, sessionMonitor } from "@/lib/security";
import type { User } from "@/types/common";
// [PHASE 1-4 MOCK AUTH - Remove in Phase 5.2]
import { config } from "@/config";

// Re-export for easier imports
export { redirect };

/**
 * Configuration for authentication guards
 */
export interface AuthGuardConfig {
  /**
   * Redirect path when authentication fails
   * @default "/login"
   */
  redirectTo?: string;

  /**
   * Required role for access
   */
  requiredRole?: string;

  /**
   * Required permissions for access
   */
  requiredPermissions?: Array<{ resource: string; action: string }>;

  /**
   * Whether to preserve the current location for post-login redirect
   * @default true
   */
  preserveRedirect?: boolean;

  /**
   * Whether to initialize projects on successful auth
   * @default true
   */
  loadProjects?: boolean;

  /**
   * Custom validation function
   */
  customValidation?: (user: User) => boolean | Promise<boolean>;

  /**
   * Whether to start session monitoring
   * @default true
   */
  enableSessionMonitoring?: boolean;
}

/**
 * Result of authentication guard check
 */
export interface AuthGuardResult {
  allowed: boolean;
  redirectTo?: string;
  reason?: string;
  user?: User | null;
}

/**
 * Main authentication guard function for TanStack Router beforeLoad hooks
 *
 * @param location - Current location object from TanStack Router
 * @param config - Authentication guard configuration
 * @returns Promise that resolves to context or throws redirect
 */
export async function requireAuth(
  location: { pathname: string; href: string },
  guardConfig: AuthGuardConfig = {}
): Promise<{ user: User; authChecked: true }> {
  const {
    redirectTo = "/login",
    requiredRole,
    requiredPermissions = [],
    preserveRedirect = true,
    loadProjects = true,
    customValidation,
    enableSessionMonitoring = true,
  } = guardConfig;

  const authStore = useAuthStore.getState();
  const token = tokenManager.getAccessToken();

  // [PHASE 1-4 MOCK AUTH - Remove this block in Phase 5.2]
  if (import.meta.env.DEV && config.development?.mockAuth) {
    console.warn("[DEV MODE] Using mock authentication - DO NOT USE IN PRODUCTION");

    // For mock auth, be more lenient with token requirements
    if (token && (token.includes("mock") || token.startsWith("eyJ"))) {
      // Mock tokens are always valid in dev mode
      // Just ensure user data is loaded
      if (!authStore.user) {
        try {
          await authStore.fetchCurrentUser();
        } catch (error) {
          console.warn("[DEV MODE] Failed to fetch mock user, attempting login redirect");
          const redirectUrl = preserveRedirect
            ? `${redirectTo}?redirect=${encodeURIComponent(location.href)}`
            : redirectTo;
          throw redirect({ to: redirectUrl });
        }
      }

      const { user } = authStore;
      if (user) {
        // Skip other validations for mock auth, just return success
        auditLogger.logAccess("route", "navigate", true, user, {
          path: location.pathname,
          mockAuth: true,
        });

        // Load projects if needed
        if (loadProjects) {
          const projectStore = useProjectStore.getState();
          if (!projectStore.activeProjectId && projectStore.projects.length === 0) {
            try {
              await projectStore.fetchProjects();
            } catch (error) {
              console.warn("Failed to load projects:", error);
            }
          }
        }

        return { user, authChecked: true };
      }
    } else if (!token) {
      // In dev mode with mock auth, if no token exists, redirect to login
      console.warn("[DEV MODE] No token found, redirecting to login");
      const redirectUrl = preserveRedirect
        ? `${redirectTo}?redirect=${encodeURIComponent(location.href)}`
        : redirectTo;
      throw redirect({ to: redirectUrl });
    }
  }
  // [END PHASE 1-4 MOCK AUTH]

  // Step 1: Check if user has valid token
  if (!token) {
    auditLogger.logSecurityEvent("unauthorized_access", {
      path: location.pathname,
      reason: "no_token",
    });

    const redirectUrl = preserveRedirect
      ? `${redirectTo}?redirect=${encodeURIComponent(location.href)}`
      : redirectTo;

    throw redirect({ to: redirectUrl });
  }

  // Step 2: Validate token structure and expiry
  const validation = tokenManager.validateTokenStructure(token);

  // [PHASE 1-4 MOCK AUTH - Remove condition in Phase 5.2]
  // In dev mode with mock auth, be more lenient with token validation
  if (!validation.valid && !(import.meta.env.DEV && config.development?.mockAuth)) {
    auditLogger.logSecurityEvent("invalid_token", {
      path: location.pathname,
      reason: validation.error,
    });

    // Clear invalid auth state
    await authStore.logout();

    const redirectUrl = preserveRedirect
      ? `${redirectTo}?redirect=${encodeURIComponent(location.href)}`
      : redirectTo;

    throw redirect({ to: redirectUrl });
  }

  // Step 3: Check if token is expired
  // [PHASE 1-4 MOCK AUTH - Skip expiry check for mock tokens in Phase 5.2]
  const isMockToken =
    import.meta.env.DEV &&
    config.development?.mockAuth &&
    (token.includes("mock") || token.includes("dev-user"));

  if (!isMockToken && tokenManager.isTokenExpired(token, 0)) {
    try {
      await authStore.refreshTokens();
    } catch (error) {
      auditLogger.logSecurityEvent("token_refresh_failed", {
        path: location.pathname,
        error: error instanceof Error ? error.message : String(error),
      });

      const redirectUrl = preserveRedirect
        ? `${redirectTo}?redirect=${encodeURIComponent(location.href)}`
        : redirectTo;

      throw redirect({ to: redirectUrl });
    }
  }

  // Step 4: Ensure user data is loaded
  if (!authStore.user) {
    try {
      await authStore.fetchCurrentUser();
    } catch (error) {
      auditLogger.logSecurityEvent("user_fetch_failed", {
        path: location.pathname,
        error: error instanceof Error ? error.message : String(error),
      });

      const redirectUrl = preserveRedirect
        ? `${redirectTo}?redirect=${encodeURIComponent(location.href)}`
        : redirectTo;

      throw redirect({ to: redirectUrl });
    }
  }

  const { user } = authStore;
  if (!user) {
    throw redirect({ to: redirectTo });
  }

  // Step 5: Check role requirements
  if (requiredRole && !authStore.hasRole(requiredRole)) {
    auditLogger.logSecurityEvent("insufficient_role", {
      path: location.pathname,
      requiredRole,
      userRole: user.role,
      userId: user.id,
    });

    throw redirect({
      to: "/unauthorized",
      search: preserveRedirect ? { redirect: location.href } : undefined,
    });
  }

  // Step 6: Check permission requirements
  for (const permission of requiredPermissions) {
    if (!authStore.hasPermission(permission.resource, permission.action)) {
      auditLogger.logSecurityEvent("insufficient_permission", {
        path: location.pathname,
        requiredPermission: permission,
        userId: user.id,
      });

      throw redirect({
        to: "/unauthorized",
        search: preserveRedirect ? { redirect: location.href } : undefined,
      });
    }
  }

  // Step 7: Custom validation
  if (customValidation) {
    try {
      const isValid = await customValidation(user);
      if (!isValid) {
        auditLogger.logSecurityEvent("custom_validation_failed", {
          path: location.pathname,
          userId: user.id,
        });

        throw redirect({
          to: "/unauthorized",
          search: preserveRedirect ? { redirect: location.href } : undefined,
        });
      }
    } catch (error) {
      auditLogger.logSecurityEvent("custom_validation_error", {
        path: location.pathname,
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      });

      throw redirect({ to: redirectTo });
    }
  }

  // Step 8: Start session monitoring if enabled
  if (enableSessionMonitoring && !sessionMonitor.isSessionActive()) {
    sessionMonitor.start({
      timeout: 30 * 60 * 1000, // 30 minutes
      warningTime: 5 * 60 * 1000, // 5 minutes warning
      onTimeout: () => {
        authStore.logout();
        window.location.href = `${redirectTo}?reason=session_timeout`;
      },
      onWarning: (timeLeft) => {
        // Could show a warning modal here
        console.warn(`Session will expire in ${timeLeft / 1000} seconds`);
      },
    });
  }

  // Step 9: Load projects if needed
  if (loadProjects) {
    const projectStore = useProjectStore.getState();
    if (!projectStore.activeProjectId && projectStore.projects.length === 0) {
      try {
        await projectStore.fetchProjects();
      } catch (error) {
        console.warn("Failed to load projects:", error);
        // Don't block navigation, UI will handle empty projects state
      }
    }
  }

  // Step 10: Log successful access
  auditLogger.logAccess("route", "navigate", true, user, {
    path: location.pathname,
  });

  return { user, authChecked: true };
}

/**
 * Guard for routes that should redirect authenticated users (e.g., login page)
 *
 * @param location - Current location object
 * @param redirectTo - Where to redirect authenticated users (default: "/dashboard")
 */
export async function requireGuest(
  location: { pathname: string; href: string },
  redirectTo: string = "/dashboard"
): Promise<{ isGuest: true }> {
  const authStore = useAuthStore.getState();
  const token = tokenManager.getAccessToken();

  // If user has valid token and session, redirect them away
  if (token && !tokenManager.isTokenExpired(token, 0) && authStore.isAuthenticated) {
    throw redirect({ to: redirectTo });
  }

  return { isGuest: true };
}

/**
 * Role-based access guard
 *
 * @param roles - Required roles (user needs at least one)
 * @param location - Current location
 * @param config - Additional configuration
 */
export async function requireRole(
  roles: string | string[],
  location: { pathname: string; href: string },
  guardConfig: Omit<AuthGuardConfig, "requiredRole"> = {}
): Promise<{ user: User; authChecked: true }> {
  const roleArray = Array.isArray(roles) ? roles : [roles];

  return requireAuth(location, {
    ...guardConfig,
    customValidation: (user) => {
      return roleArray.some((role) => user.role === role);
    },
  });
}

/**
 * Permission-based access guard
 *
 * @param permissions - Required permissions (user needs all)
 * @param location - Current location
 * @param config - Additional configuration
 */
export async function requirePermissions(
  permissions: Array<{ resource: string; action: string }>,
  location: { pathname: string; href: string },
  guardConfig: Omit<AuthGuardConfig, "requiredPermissions"> = {}
): Promise<{ user: User; authChecked: true }> {
  return requireAuth(location, {
    ...guardConfig,
    requiredPermissions: permissions,
  });
}

/**
 * Project context guard - ensures user has access to current project
 *
 * @param projectId - Project ID to check access for
 * @param location - Current location
 * @param config - Additional configuration
 */
export async function requireProjectAccess(
  projectId: string,
  location: { pathname: string; href: string },
  guardConfig: AuthGuardConfig = {}
): Promise<{ user: User; project: any; authChecked: true }> {
  const authResult = await requireAuth(location, guardConfig);
  const projectStore = useProjectStore.getState();

  // Ensure project is loaded
  if (!projectStore.projects.find((p) => p.id === projectId)) {
    try {
      await projectStore.fetchProjects();
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    }
  }

  const project = projectStore.projects.find((p) => p.id === projectId);
  if (!project) {
    auditLogger.logSecurityEvent("invalid_project_access", {
      path: location.pathname,
      projectId,
      userId: authResult.user.id,
    });

    throw redirect({ to: "/unauthorized" });
  }

  // Check if user has access to this project
  const hasAccess =
    project.ownerId === authResult.user.id ||
    project.members?.some((m) => m.userId === authResult.user.id);

  if (!hasAccess) {
    auditLogger.logSecurityEvent("unauthorized_project_access", {
      path: location.pathname,
      projectId,
      userId: authResult.user.id,
    });

    throw redirect({ to: "/unauthorized" });
  }

  return { ...authResult, project };
}

/**
 * Development-only guard - only allows access in development mode
 *
 * @param location - Current location
 */
export async function requireDevelopment(location: {
  pathname: string;
  href: string;
}): Promise<{ isDev: true }> {
  if (import.meta.env.PROD) {
    throw redirect({ to: "/not-found" });
  }

  return { isDev: true };
}

/**
 * Utility function to check auth without redirecting
 * Useful for conditional rendering or client-side checks
 */
export function checkAuth(): AuthGuardResult {
  const authStore = useAuthStore.getState();
  const token = tokenManager.getAccessToken();

  // [PHASE 1-4 MOCK AUTH - Remove in Phase 5.2]
  if (import.meta.env.DEV && config.development?.mockAuth) {
    console.warn("[DEV MODE] Mock authentication check - DO NOT USE IN PRODUCTION");
    if (token && authStore.user) {
      return { allowed: true, user: authStore.user };
    }
  }
  // [END PHASE 1-4 MOCK AUTH]

  if (!token) {
    return { allowed: false, reason: "no_token" };
  }

  const validation = tokenManager.validateTokenStructure(token);
  if (!validation.valid) {
    return { allowed: false, reason: validation.error };
  }

  if (tokenManager.isTokenExpired(token, 0)) {
    return { allowed: false, reason: "token_expired" };
  }

  if (!authStore.user) {
    return { allowed: false, reason: "no_user_data" };
  }

  return { allowed: true, user: authStore.user };
}
