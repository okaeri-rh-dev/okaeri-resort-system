import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/authStore";
import { useProjectStore } from "@/stores/projectStore";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { tokenManager, auditLogger, sessionMonitor } from "@/lib/security";

/**
 * Protected route layout with enhanced security
 * Implements token validation, session monitoring, and audit logging
 */
export const Route = createFileRoute("/_protected")({
  beforeLoad: async ({ location, context }) => {
    const authStore = useAuthStore.getState();
    const token = tokenManager.getAccessToken();

    // Check if user has valid token
    if (!token) {
      // Log unauthorized access attempt
      auditLogger.logSecurityEvent("invalid_token", {
        path: location.pathname,
        reason: "no_token",
      });

      throw redirect({
        to: "/login",
        search: {
          redirect: location.href,
        },
      });
    }

    // Validate token structure and expiry
    const validation = tokenManager.validateTokenStructure(token);
    if (!validation.valid) {
      // Log invalid token
      auditLogger.logSecurityEvent("invalid_token", {
        path: location.pathname,
        reason: validation.error,
      });

      // Clear invalid auth state
      await authStore.logout();

      throw redirect({
        to: "/login",
        search: {
          redirect: location.href,
        },
      });
    }

    // Check if token is expired
    if (tokenManager.isTokenExpired(token, 0)) {
      try {
        // Attempt to refresh token
        await authStore.refreshToken();
      } catch (error) {
        // Refresh failed, redirect to login
        auditLogger.logSecurityEvent("invalid_token", {
          path: location.pathname,
          reason: "token_expired_refresh_failed",
        });

        throw redirect({
          to: "/login",
          search: {
            redirect: location.href,
          },
        });
      }
    }

    // Check if user data is loaded
    if (!authStore.user) {
      try {
        await authStore.fetchCurrentUser();
      } catch (error) {
        // Failed to fetch user, redirect to login
        auditLogger.logSecurityEvent("invalid_token", {
          path: location.pathname,
          reason: "user_fetch_failed",
        });

        throw redirect({
          to: "/login",
          search: {
            redirect: location.href,
          },
        });
      }
    }

    // Ensure session monitoring is active
    if (!sessionMonitor.isSessionActive()) {
      sessionMonitor.start({
        timeout: 30 * 60 * 1000, // 30 minutes
        warningTime: 5 * 60 * 1000, // 5 minutes warning
        onTimeout: () => {
          authStore.logout();
          window.location.href = "/login?reason=session_timeout";
        },
        onWarning: (timeLeft) => {
          // Could show a warning modal here
          console.warn(`Session will expire in ${timeLeft / 1000} seconds`);
        },
      });
    }

    // Load projects for authenticated users
    const projectStore = useProjectStore.getState();
    if (!projectStore.activeProjectId && projectStore.projects.length === 0) {
      try {
        await projectStore.fetchProjects();
      } catch (error) {
        console.warn("Failed to load projects:", error);
        // Don't block navigation, UI will handle empty projects state
      }
    }

    // Log successful navigation
    auditLogger.logAccess("route", "navigate", true, authStore.user, { path: location.pathname });
  },

  errorComponent: ({ error }) => {
    // Log route error
    auditLogger.logSecurityEvent("suspicious", {
      error: error.message,
      stack: error.stack,
    });

    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="mt-2 text-gray-600">You don't have permission to access this page.</p>
          <button
            onClick={() => (window.location.href = "/login")}
            className="mt-4 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  },

  component: ProtectedLayout,
});

function ProtectedLayout() {
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
}
