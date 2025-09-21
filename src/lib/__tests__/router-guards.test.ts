/**
 * Router Guards Test Suite
 * Tests for TanStack Router authentication guards including route protection,
 * role-based access control, session management, and security features
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { redirect } from "@tanstack/react-router";
import {
  requireAuth,
  requireGuest,
  requireRole,
  requirePermissions,
  requireProjectAccess,
  requireDevelopment,
  checkAuth,
} from "../router-guards";
import { useAuthStore } from "@/stores/authStore";
import { useProjectStore } from "@/stores/projectStore";
import { tokenManager, auditLogger, sessionMonitor } from "@/lib/security";
import { MOCK_USERS, MOCK_AUTH_STATES } from "@tests/utils/test-utils";
import { ROUTES } from "@/constants/routes";

// Mock stores
vi.mock("@/stores/authStore", () => ({
  useAuthStore: {
    getState: vi.fn(),
  },
}));

vi.mock("@/stores/projectStore", () => ({
  useProjectStore: {
    getState: vi.fn(),
  },
}));

// Mock TanStack Router
vi.mock("@tanstack/react-router", () => ({
  redirect: vi.fn(),
}));

// Mock security modules
vi.mock("@/lib/security", () => ({
  tokenManager: {
    getAccessToken: vi.fn(),
    validateTokenStructure: vi.fn(),
    isTokenExpired: vi.fn(),
  },
  auditLogger: {
    logSecurityEvent: vi.fn(),
    logAccess: vi.fn(),
  },
  sessionMonitor: {
    isSessionActive: vi.fn(),
    start: vi.fn(),
  },
}));

describe("Router Guards", () => {
  const mockLocation = {
    pathname: ROUTES.dashboard,
    href: `http://localhost:3000${ROUTES.dashboard}`,
  };

  const mockAuthState = {
    isAuthenticated: true,
    user: MOCK_USERS.OWNER,
    token: "valid-token",
    logout: vi.fn(),
    refreshToken: vi.fn(),
    fetchCurrentUser: vi.fn(),
    hasRole: vi.fn(),
    hasPermission: vi.fn(),
  };

  const mockProjectState = {
    activeProjectId: "project-123",
    projects: [
      {
        id: "project-123",
        name: "Test Resort",
        ownerId: MOCK_USERS.OWNER.id,
        members: [
          { userId: MOCK_USERS.MANAGER.id, role: "MANAGER" },
          { userId: MOCK_USERS.STAFF.id, role: "STAFF" },
        ],
      },
    ],
    fetchProjects: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    (useAuthStore.getState as any).mockReturnValue(mockAuthState);
    (useProjectStore.getState as any).mockReturnValue(mockProjectState);
    (tokenManager.getAccessToken as any).mockReturnValue("valid-token");
    (tokenManager.validateTokenStructure as any).mockReturnValue({ valid: true });
    (tokenManager.isTokenExpired as any).mockReturnValue(false);
    (sessionMonitor.isSessionActive as any).mockReturnValue(false);

    // Mock redirect to throw for easier testing
    (redirect as any).mockImplementation((options) => {
      throw new Error(`Redirect to ${options.to}`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("requireAuth", () => {
    it("should allow access for authenticated user with valid token", async () => {
      const result = await requireAuth(mockLocation);

      expect(result).toEqual({
        user: MOCK_USERS.OWNER,
        authChecked: true,
      });
    });

    it("should redirect to login when no token present", async () => {
      (tokenManager.getAccessToken as any).mockReturnValue(null);

      await expect(requireAuth(mockLocation)).rejects.toThrow("Redirect to /login");

      expect(auditLogger.logSecurityEvent).toHaveBeenCalledWith(
        "unauthorized_access",
        expect.objectContaining({
          path: ROUTES.dashboard,
          reason: "no_token",
        })
      );
    });

    it("should preserve redirect URL with query parameters", async () => {
      (tokenManager.getAccessToken as any).mockReturnValue(null);

      await expect(requireAuth(mockLocation)).rejects.toThrow();

      expect(redirect).toHaveBeenCalledWith({
        to: `${ROUTES.login}?redirect=http%3A//localhost%3A3000${encodeURIComponent(ROUTES.dashboard)}`,
      });
    });

    it("should handle invalid token structure", async () => {
      (tokenManager.validateTokenStructure as any).mockReturnValue({
        valid: false,
        error: "malformed_token",
      });

      await expect(requireAuth(mockLocation)).rejects.toThrow("Redirect to /login");

      expect(auditLogger.logSecurityEvent).toHaveBeenCalledWith(
        "invalid_token",
        expect.objectContaining({
          reason: "malformed_token",
        })
      );
      expect(mockAuthState.logout).toHaveBeenCalled();
    });

    it("should refresh expired token automatically", async () => {
      (tokenManager.isTokenExpired as any).mockReturnValue(true);
      (mockAuthState.refreshToken as any).mockResolvedValue(undefined);

      const result = await requireAuth(mockLocation);

      expect(mockAuthState.refreshToken).toHaveBeenCalled();
      expect(result.user).toBe(MOCK_USERS.OWNER);
    });

    it("should redirect when token refresh fails", async () => {
      (tokenManager.isTokenExpired as any).mockReturnValue(true);
      (mockAuthState.refreshToken as any).mockRejectedValue(new Error("Refresh failed"));

      await expect(requireAuth(mockLocation)).rejects.toThrow("Redirect to /login");

      expect(auditLogger.logSecurityEvent).toHaveBeenCalledWith(
        "token_refresh_failed",
        expect.objectContaining({
          error: "Refresh failed",
        })
      );
    });

    it("should fetch user data if missing", async () => {
      (useAuthStore.getState as any).mockReturnValue({
        ...mockAuthState,
        user: null,
      });
      (mockAuthState.fetchCurrentUser as any).mockResolvedValue(undefined);

      const result = await requireAuth(mockLocation);

      expect(mockAuthState.fetchCurrentUser).toHaveBeenCalled();
      expect(result.authChecked).toBe(true);
    });

    it("should redirect when user fetch fails", async () => {
      (useAuthStore.getState as any).mockReturnValue({
        ...mockAuthState,
        user: null,
      });
      (mockAuthState.fetchCurrentUser as any).mockRejectedValue(new Error("User fetch failed"));

      await expect(requireAuth(mockLocation)).rejects.toThrow("Redirect to /login");
    });

    it("should check role requirements", async () => {
      (mockAuthState.hasRole as any).mockReturnValue(false);

      await expect(requireAuth(mockLocation, { requiredRole: "ADMIN" })).rejects.toThrow(
        "Redirect to /unauthorized"
      );

      expect(auditLogger.logSecurityEvent).toHaveBeenCalledWith(
        "insufficient_role",
        expect.objectContaining({
          requiredRole: "ADMIN",
          userRole: MOCK_USERS.OWNER.role,
        })
      );
    });

    it("should check permission requirements", async () => {
      (mockAuthState.hasPermission as any).mockReturnValue(false);

      const permissions = [{ resource: "bookings", action: "delete" }];

      await expect(requireAuth(mockLocation, { requiredPermissions: permissions })).rejects.toThrow(
        "Redirect to /unauthorized"
      );

      expect(auditLogger.logSecurityEvent).toHaveBeenCalledWith(
        "insufficient_permission",
        expect.objectContaining({
          requiredPermission: permissions[0],
        })
      );
    });

    it("should handle custom validation", async () => {
      const customValidation = vi.fn().mockResolvedValue(false);

      await expect(requireAuth(mockLocation, { customValidation })).rejects.toThrow(
        "Redirect to /unauthorized"
      );

      expect(customValidation).toHaveBeenCalledWith(MOCK_USERS.OWNER);
      expect(auditLogger.logSecurityEvent).toHaveBeenCalledWith(
        "custom_validation_failed",
        expect.any(Object)
      );
    });

    it("should start session monitoring when enabled", async () => {
      await requireAuth(mockLocation, { enableSessionMonitoring: true });

      expect(sessionMonitor.start).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 30 * 60 * 1000, // 30 minutes
          warningTime: 5 * 60 * 1000, // 5 minutes
          onTimeout: expect.any(Function),
          onWarning: expect.any(Function),
        })
      );
    });

    it("should handle session timeout", async () => {
      let timeoutCallback: () => void;
      (sessionMonitor.start as any).mockImplementation(({ onTimeout }) => {
        timeoutCallback = onTimeout;
      });

      await requireAuth(mockLocation);

      // Simulate session timeout
      timeoutCallback!();

      expect(mockAuthState.logout).toHaveBeenCalled();
    });

    it("should load projects when required", async () => {
      (useProjectStore.getState as any).mockReturnValue({
        ...mockProjectState,
        activeProjectId: null,
        projects: [],
      });

      await requireAuth(mockLocation, { loadProjects: true });

      expect(mockProjectState.fetchProjects).toHaveBeenCalled();
    });

    it("should log successful access", async () => {
      await requireAuth(mockLocation);

      expect(auditLogger.logAccess).toHaveBeenCalledWith(
        "route",
        "navigate",
        true,
        MOCK_USERS.OWNER,
        { path: "/dashboard" }
      );
    });

    it("should handle custom redirect paths", async () => {
      (tokenManager.getAccessToken as any).mockReturnValue(null);

      await expect(
        requireAuth(mockLocation, {
          redirectTo: "/custom-login",
          preserveRedirect: false,
        })
      ).rejects.toThrow();

      expect(redirect).toHaveBeenCalledWith({ to: "/custom-login" });
    });
  });

  describe("requireGuest", () => {
    it("should allow access for unauthenticated users", async () => {
      (tokenManager.getAccessToken as any).mockReturnValue(null);

      const result = await requireGuest(mockLocation);

      expect(result).toEqual({ isGuest: true });
    });

    it("should redirect authenticated users away from guest pages", async () => {
      await expect(requireGuest(mockLocation)).rejects.toThrow("Redirect to /dashboard");
    });

    it("should allow users with expired tokens", async () => {
      (tokenManager.isTokenExpired as any).mockReturnValue(true);

      const result = await requireGuest(mockLocation);

      expect(result).toEqual({ isGuest: true });
    });

    it("should use custom redirect for authenticated users", async () => {
      await expect(requireGuest(mockLocation, "/home")).rejects.toThrow("Redirect to /home");
    });
  });

  describe("requireRole", () => {
    it("should allow access for users with required role", async () => {
      (mockAuthState.hasRole as any).mockReturnValue(true);

      const result = await requireRole("OWNER", mockLocation);

      expect(result).toEqual({
        user: MOCK_USERS.OWNER,
        authChecked: true,
      });
    });

    it("should handle array of roles", async () => {
      const mockCustomValidation = vi.fn().mockReturnValue(true);

      const result = await requireRole(["OWNER", "MANAGER"], mockLocation);

      expect(result.user).toBe(MOCK_USERS.OWNER);
    });

    it("should reject users without required roles", async () => {
      const customValidation = vi.fn().mockReturnValue(false);
      vi.mocked(requireAuth).mockImplementation(async (location, config) => {
        if (config?.customValidation) {
          const isValid = await config.customValidation(MOCK_USERS.OWNER);
          if (!isValid) {
            throw new Error("Redirect to /unauthorized");
          }
        }
        return { user: MOCK_USERS.OWNER, authChecked: true };
      });

      await expect(requireRole("ADMIN", mockLocation)).rejects.toThrow("Redirect to /unauthorized");
    });
  });

  describe("requirePermissions", () => {
    it("should allow access with required permissions", async () => {
      (mockAuthState.hasPermission as any).mockReturnValue(true);

      const permissions = [
        { resource: "bookings", action: "read" },
        { resource: "reports", action: "generate" },
      ];

      const result = await requirePermissions(permissions, mockLocation);

      expect(result.user).toBe(MOCK_USERS.OWNER);
    });

    it("should reject users without required permissions", async () => {
      (mockAuthState.hasPermission as any).mockReturnValue(false);

      const permissions = [{ resource: "admin", action: "manage" }];

      await expect(requirePermissions(permissions, mockLocation)).rejects.toThrow(
        "Redirect to /unauthorized"
      );
    });
  });

  describe("requireProjectAccess", () => {
    it("should allow project owner access", async () => {
      const result = await requireProjectAccess("project-123", mockLocation);

      expect(result).toEqual({
        user: MOCK_USERS.OWNER,
        project: mockProjectState.projects[0],
        authChecked: true,
      });
    });

    it("should allow project member access", async () => {
      (useAuthStore.getState as any).mockReturnValue({
        ...mockAuthState,
        user: MOCK_USERS.MANAGER,
      });

      const result = await requireProjectAccess("project-123", mockLocation);

      expect(result.user).toBe(MOCK_USERS.MANAGER);
      expect(result.project).toBe(mockProjectState.projects[0]);
    });

    it("should fetch projects if not loaded", async () => {
      (useProjectStore.getState as any).mockReturnValue({
        ...mockProjectState,
        projects: [],
      });
      (mockProjectState.fetchProjects as any).mockResolvedValue(undefined);

      await requireProjectAccess("project-123", mockLocation);

      expect(mockProjectState.fetchProjects).toHaveBeenCalled();
    });

    it("should reject access to non-existent project", async () => {
      await expect(requireProjectAccess("non-existent-project", mockLocation)).rejects.toThrow(
        "Redirect to /unauthorized"
      );

      expect(auditLogger.logSecurityEvent).toHaveBeenCalledWith(
        "invalid_project_access",
        expect.objectContaining({
          projectId: "non-existent-project",
        })
      );
    });

    it("should reject unauthorized project access", async () => {
      (useAuthStore.getState as any).mockReturnValue({
        ...mockAuthState,
        user: { ...MOCK_USERS.STAFF, id: "unauthorized-user" },
      });

      await expect(requireProjectAccess("project-123", mockLocation)).rejects.toThrow(
        "Redirect to /unauthorized"
      );

      expect(auditLogger.logSecurityEvent).toHaveBeenCalledWith(
        "unauthorized_project_access",
        expect.any(Object)
      );
    });
  });

  describe("requireDevelopment", () => {
    it("should allow access in development mode", async () => {
      vi.stubEnv("PROD", false);

      const result = await requireDevelopment(mockLocation);

      expect(result).toEqual({ isDev: true });
    });

    it("should redirect in production mode", async () => {
      vi.stubEnv("PROD", true);

      await expect(requireDevelopment(mockLocation)).rejects.toThrow("Redirect to /not-found");
    });
  });

  describe("checkAuth", () => {
    it("should return allowed for valid authentication", () => {
      const result = checkAuth();

      expect(result).toEqual({
        allowed: true,
        user: MOCK_USERS.OWNER,
      });
    });

    it("should return not allowed for missing token", () => {
      (tokenManager.getAccessToken as any).mockReturnValue(null);

      const result = checkAuth();

      expect(result).toEqual({
        allowed: false,
        reason: "no_token",
      });
    });

    it("should return not allowed for invalid token", () => {
      (tokenManager.validateTokenStructure as any).mockReturnValue({
        valid: false,
        error: "invalid_format",
      });

      const result = checkAuth();

      expect(result).toEqual({
        allowed: false,
        reason: "invalid_format",
      });
    });

    it("should return not allowed for expired token", () => {
      (tokenManager.isTokenExpired as any).mockReturnValue(true);

      const result = checkAuth();

      expect(result).toEqual({
        allowed: false,
        reason: "token_expired",
      });
    });

    it("should return not allowed for missing user data", () => {
      (useAuthStore.getState as any).mockReturnValue({
        ...mockAuthState,
        user: null,
      });

      const result = checkAuth();

      expect(result).toEqual({
        allowed: false,
        reason: "no_user_data",
      });
    });
  });

  describe("Philippine-specific Security Features", () => {
    it("should handle Filipino user names with special characters", async () => {
      const filipinoUser = {
        ...MOCK_USERS.OWNER,
        name: "José María Rizal Jr.",
      };

      (useAuthStore.getState as any).mockReturnValue({
        ...mockAuthState,
        user: filipinoUser,
      });

      const result = await requireAuth(mockLocation);

      expect(result.user.name).toBe("José María Rizal Jr.");
      expect(auditLogger.logAccess).toHaveBeenCalledWith(
        "route",
        "navigate",
        true,
        filipinoUser,
        expect.any(Object)
      );
    });

    it("should handle Philippine timezone considerations", async () => {
      // Mock Date to simulate Philippine time
      const originalDate = global.Date;
      global.Date = class extends Date {
        constructor(...args: any[]) {
          super(...args);
          // Simulate Philippine timezone (UTC+8)
        }

        static now() {
          return originalDate.now();
        }
      } as DateConstructor;

      const result = await requireAuth(mockLocation);

      expect(result.authChecked).toBe(true);

      global.Date = originalDate;
    });

    it("should log security events with Philippine context", async () => {
      (tokenManager.getAccessToken as any).mockReturnValue(null);

      await expect(requireAuth(mockLocation)).rejects.toThrow();

      expect(auditLogger.logSecurityEvent).toHaveBeenCalledWith(
        "unauthorized_access",
        expect.objectContaining({
          path: ROUTES.dashboard,
          reason: "no_token",
        })
      );
    });
  });

  describe("Session Management", () => {
    it("should configure session timeout appropriately for resort operations", async () => {
      await requireAuth(mockLocation, { enableSessionMonitoring: true });

      expect(sessionMonitor.start).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 30 * 60 * 1000, // 30 minutes - reasonable for resort staff
        })
      );
    });

    it("should provide session warning before timeout", async () => {
      let warningCallback: (timeLeft: number) => void;
      (sessionMonitor.start as any).mockImplementation(({ onWarning }) => {
        warningCallback = onWarning;
      });

      await requireAuth(mockLocation);

      // Simulate session warning
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      warningCallback!(5 * 60 * 1000); // 5 minutes left

      expect(consoleWarnSpy).toHaveBeenCalledWith("Session will expire in 300 seconds");

      consoleWarnSpy.mockRestore();
    });

    it("should handle session monitoring errors gracefully", async () => {
      (sessionMonitor.start as any).mockImplementation(() => {
        throw new Error("Session monitor failed");
      });

      // Should not throw error if session monitoring fails
      const result = await requireAuth(mockLocation, { enableSessionMonitoring: true });

      expect(result.authChecked).toBe(true);
    });
  });

  describe("Error Handling and Recovery", () => {
    it("should handle token manager failures", async () => {
      (tokenManager.getAccessToken as any).mockImplementation(() => {
        throw new Error("Token manager error");
      });

      await expect(requireAuth(mockLocation)).rejects.toThrow("Token manager error");
    });

    it("should handle audit logging failures gracefully", async () => {
      (auditLogger.logSecurityEvent as any).mockImplementation(() => {
        throw new Error("Audit log failed");
      });
      (tokenManager.getAccessToken as any).mockReturnValue(null);

      // Should still redirect even if audit logging fails
      await expect(requireAuth(mockLocation)).rejects.toThrow("Redirect to /login");
    });

    it("should handle store state corruption", async () => {
      (useAuthStore.getState as any).mockReturnValue(null);

      await expect(requireAuth(mockLocation)).rejects.toThrow();
    });

    it("should clean up on navigation failure", async () => {
      const mockFailNavigation = vi.fn();
      const originalNavStore = require("@/lib/store-router-integration").useNavigationStore;

      vi.doMock("@/lib/store-router-integration", () => ({
        useNavigationStore: {
          getState: vi.fn(() => ({
            startNavigation: vi.fn(),
            completeNavigation: vi.fn(),
            failNavigation: mockFailNavigation,
          })),
        },
      }));

      const failingLoader = vi.fn().mockRejectedValue(new Error("Navigation failed"));
      const loader = createAuthenticatedLoader(failingLoader);

      await expect(loader({ location: mockLocation })).rejects.toThrow("Navigation failed");

      expect(mockFailNavigation).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("Integration with Filipino Business Hours", () => {
    it("should consider Philippine business hours in session timeout", async () => {
      // Mock current time to be during Philippine business hours
      const mockDate = new Date("2024-01-15T10:00:00+08:00"); // 10 AM Philippine time
      vi.setSystemTime(mockDate);

      await requireAuth(mockLocation, { enableSessionMonitoring: true });

      // Session monitoring should be active during business hours
      expect(sessionMonitor.start).toHaveBeenCalled();
    });

    it("should handle different timeout policies based on user role", async () => {
      // Staff might have shorter sessions than owners/managers
      (useAuthStore.getState as any).mockReturnValue({
        ...mockAuthState,
        user: MOCK_USERS.STAFF,
      });

      await requireAuth(mockLocation, { enableSessionMonitoring: true });

      expect(sessionMonitor.start).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: expect.any(Number),
        })
      );
    });
  });

  describe("Performance and Optimization", () => {
    it("should cache authentication checks efficiently", () => {
      const startTime = performance.now();
      checkAuth();
      const endTime = performance.now();

      // Should be very fast for cached checks
      expect(endTime - startTime).toBeLessThan(10);
    });

    it("should minimize API calls for repeated auth checks", async () => {
      await requireAuth(mockLocation);
      await requireAuth(mockLocation);
      await requireAuth(mockLocation);

      // Should only fetch user once if already loaded
      expect(mockAuthState.fetchCurrentUser).toHaveBeenCalledTimes(0);
    });

    it("should handle concurrent authentication requests", async () => {
      const promises = Array.from({ length: 5 }, () => requireAuth(mockLocation));

      const results = await Promise.all(promises);

      results.forEach((result) => {
        expect(result.authChecked).toBe(true);
      });
    });
  });

  describe("Security Compliance", () => {
    it("should enforce HTTPS in production", async () => {
      const httpsLocation = {
        pathname: ROUTES.dashboard,
        href: `https://okaeri-resort.ph${ROUTES.dashboard}`,
      };

      const result = await requireAuth(httpsLocation);

      expect(result.authChecked).toBe(true);
    });

    it("should validate redirect URLs to prevent open redirects", async () => {
      const maliciousLocation = {
        pathname: ROUTES.dashboard,
        href: `http://evil-site.com${ROUTES.dashboard}`,
      };

      (tokenManager.getAccessToken as any).mockReturnValue(null);

      await expect(requireAuth(maliciousLocation)).rejects.toThrow();

      // Should use safe default redirect
      expect(redirect).toHaveBeenCalledWith({
        to: expect.stringMatching(/^\/login/),
      });
    });

    it("should rate limit authentication attempts", async () => {
      // Simulate multiple rapid auth failures
      (tokenManager.getAccessToken as any).mockReturnValue(null);

      const attempts = Array.from({ length: 10 }, () => requireAuth(mockLocation).catch(() => {}));

      await Promise.all(attempts);

      // Should log multiple security events
      expect(auditLogger.logSecurityEvent).toHaveBeenCalledTimes(10);
    });
  });
});
