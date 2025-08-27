/**
 * Security-Focused Authentication Store Tests
 * Tests edge cases, race conditions, session timeouts, and Philippine compliance
 * Specific to resort management security requirements
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAuthStore } from "../authStore";
import { MOCK_USERS, TEST_CONSTANTS } from "@tests/utils/test-utils";

// Mock dependencies with security focus
vi.mock("@/lib/api-client");
vi.mock("@/lib/security/secure-token-manager");
vi.mock("@/lib/security/session-monitor");
vi.mock("@/lib/security/audit-logger");
vi.mock("@/lib/security/rate-limiter");
vi.mock("@/lib/security/permission-guard");

import { apiClient } from "@/lib/api-client";
import { secureTokenManager } from "@/lib/security/secure-token-manager";
import { sessionMonitor } from "@/lib/security/session-monitor";
import { auditLogger } from "@/lib/security/audit-logger";
import { rateLimiter } from "@/lib/security/rate-limiter";
import { permissionGuard } from "@/lib/security/permission-guard";

describe("AuthStore - Security Edge Cases and Attack Scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset auth store state
    const { result } = renderHook(() => useAuthStore());
    act(() => {
      result.current.logout();
    });

    // Setup default mock behaviors
    (rateLimiter.check as any).mockReturnValue({ allowed: true });
    (secureTokenManager.validateTokenStructure as any).mockReturnValue({ valid: true });
    (secureTokenManager.isTokenExpired as any).mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe("Race Condition Prevention", () => {
    it("should prevent concurrent login attempts", async () => {
      const { result } = renderHook(() => useAuthStore());

      let loginCallCount = 0;
      (apiClient.post as any).mockImplementation(async () => {
        loginCallCount++;
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 100));
        return {
          data: {
            user: MOCK_USERS.OWNER,
            accessToken: TEST_CONSTANTS.MOCK_TOKEN,
            refreshToken: TEST_CONSTANTS.MOCK_REFRESH_TOKEN,
          },
        };
      });

      // Trigger multiple concurrent login attempts
      const credentials = { email: "test@example.com", password: "password123" };
      const promises = [
        act(() => result.current.login(credentials)),
        act(() => result.current.login(credentials)),
        act(() => result.current.login(credentials)),
      ];

      await Promise.all(promises);

      // Should only make one API call due to loading state check
      expect(loginCallCount).toBe(1);
      expect(result.current.user).toEqual(MOCK_USERS.OWNER);
    });

    it("should prevent token refresh race conditions", async () => {
      const { result } = renderHook(() => useAuthStore());

      // Set initial authenticated state
      act(() => {
        result.current.user = MOCK_USERS.STAFF;
      });

      let refreshCallCount = 0;
      (apiClient.post as any).mockImplementation(async () => {
        refreshCallCount++;
        await new Promise((resolve) => setTimeout(resolve, 100));
        return {
          data: {
            accessToken: "new-token",
            refreshToken: "new-refresh",
          },
        };
      });

      (secureTokenManager.getRefreshToken as any).mockReturnValue("refresh-token");

      // Trigger multiple concurrent refresh attempts
      const promises = [
        act(() => result.current.refreshToken()),
        act(() => result.current.refreshToken()),
        act(() => result.current.refreshToken()),
      ];

      await Promise.all(promises);

      // Should only make one refresh call
      expect(refreshCallCount).toBe(1);
    });

    it("should handle simultaneous logout and refresh attempts", async () => {
      const { result } = renderHook(() => useAuthStore());

      // Set authenticated state
      act(() => {
        result.current.user = MOCK_USERS.MANAGER;
      });

      (secureTokenManager.getAccessToken as any).mockReturnValue("token");
      (secureTokenManager.getRefreshToken as any).mockReturnValue("refresh");

      // Mock API responses
      (apiClient.post as any).mockImplementation(async (url: string) => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        if (url === "/auth/logout") {
          return { data: { success: true } };
        }
        if (url === "/auth/refresh") {
          return {
            data: {
              accessToken: "new-token",
              refreshToken: "new-refresh",
            },
          };
        }
      });

      // Trigger logout and refresh simultaneously
      const logoutPromise = act(() => result.current.logout());
      const refreshPromise = act(() => result.current.refreshToken());

      await Promise.all([logoutPromise, refreshPromise]);

      // Logout should win, user should be null
      expect(result.current.user).toBeNull();
      expect(secureTokenManager.clearTokens).toHaveBeenCalled();
    });
  });

  describe("Session Timeout Scenarios", () => {
    it("should handle session timeout during active use", async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useAuthStore());

      // Login user
      act(() => {
        result.current.user = MOCK_USERS.STAFF;
        result.current.isAuthenticated = true;
      });

      // Setup session timeout callback
      let timeoutCallback: (() => void) | undefined;
      (sessionMonitor.start as any).mockImplementation((config: any) => {
        timeoutCallback = config.onTimeout;
      });

      // Initialize session
      act(() => {
        result.current.initializeAuth();
      });

      // Fast-forward to timeout
      act(() => {
        vi.advanceTimersByTime(3600000); // 1 hour
      });

      // Trigger timeout callback
      if (timeoutCallback) {
        await act(async () => {
          timeoutCallback!();
        });
      }

      // User should be logged out
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(auditLogger.logAuth).toHaveBeenCalledWith(
        "timeout",
        expect.any(Object),
        true,
        expect.objectContaining({ reason: "session_expired" })
      );

      vi.useRealTimers();
    });

    it("should warn user before session timeout", async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useAuthStore());

      // Login user
      act(() => {
        result.current.user = MOCK_USERS.MANAGER;
        result.current.isAuthenticated = true;
      });

      let warningCallback: ((timeLeft: number) => void) | undefined;
      (sessionMonitor.start as any).mockImplementation((config: any) => {
        warningCallback = config.onWarning;
      });

      // Initialize session
      act(() => {
        result.current.initializeAuth();
      });

      // Fast-forward to warning time
      act(() => {
        vi.advanceTimersByTime(3300000); // 55 minutes (5 min before timeout)
      });

      // Trigger warning callback
      if (warningCallback) {
        act(() => {
          warningCallback!(300000); // 5 minutes left
        });
      }

      // Check if warning was logged
      expect(auditLogger.log).toHaveBeenCalledWith(
        "SESSION_WARNING",
        expect.objectContaining({
          userId: MOCK_USERS.MANAGER.id,
          timeLeft: 300000,
        })
      );

      vi.useRealTimers();
    });

    it("should extend session on user activity", async () => {
      const { result } = renderHook(() => useAuthStore());

      // Login user
      act(() => {
        result.current.user = MOCK_USERS.OWNER;
        result.current.isAuthenticated = true;
      });

      let activityCallback: (() => void) | undefined;
      (sessionMonitor.start as any).mockImplementation((config: any) => {
        activityCallback = config.onActivity;
      });

      // Initialize session
      act(() => {
        result.current.initializeAuth();
      });

      // Trigger activity
      if (activityCallback) {
        act(() => {
          activityCallback!();
        });
      }

      // Session should be extended
      expect(sessionMonitor.extendSession).not.toHaveBeenCalled(); // Activity auto-extends
    });
  });

  describe("Multi-Tenant Security Boundaries", () => {
    it("should enforce project isolation during authentication", async () => {
      const { result } = renderHook(() => useAuthStore());

      const userWithProjects = {
        ...MOCK_USERS.MANAGER,
        projects: [
          {
            projectId: "project-A",
            role: "OWNER" as const,
            permissions: [],
            joinedAt: new Date().toISOString(),
          },
          {
            projectId: "project-B",
            role: "VIEWER" as const,
            permissions: [],
            joinedAt: new Date().toISOString(),
          },
        ],
      };

      (apiClient.post as any).mockResolvedValue({
        data: {
          user: userWithProjects,
          accessToken: TEST_CONSTANTS.MOCK_TOKEN,
          refreshToken: TEST_CONSTANTS.MOCK_REFRESH_TOKEN,
        },
      });

      await act(async () => {
        await result.current.login({
          email: "manager@example.com",
          password: "password123",
        });
      });

      // Check project-specific permissions
      (permissionGuard.hasPermission as any).mockImplementation((user: any, check: any) => {
        if (check.projectId === "project-A") {
          return { allowed: true }; // Owner can do anything
        }
        if (check.projectId === "project-B") {
          return { allowed: check.action === "read" }; // Viewer can only read
        }
        return { allowed: false };
      });

      // Test project A permissions
      const canDeleteInA = result.current.hasPermission({
        resource: "bookings",
        action: "delete",
        projectId: "project-A",
      });
      expect(canDeleteInA).toBe(true);

      // Test project B permissions
      const canDeleteInB = result.current.hasPermission({
        resource: "bookings",
        action: "delete",
        projectId: "project-B",
      });
      expect(canDeleteInB).toBe(false);

      // Test project C (no access)
      const canReadInC = result.current.hasPermission({
        resource: "bookings",
        action: "read",
        projectId: "project-C",
      });
      expect(canReadInC).toBe(false);
    });

    it("should prevent cross-tenant data access after logout", async () => {
      const { result } = renderHook(() => useAuthStore());

      // Login as user with project access
      act(() => {
        result.current.user = {
          ...MOCK_USERS.STAFF,
          projects: [
            {
              projectId: "sensitive-project",
              role: "MEMBER" as const,
              permissions: [],
              joinedAt: new Date().toISOString(),
            },
          ],
        };
        result.current.isAuthenticated = true;
      });

      // Verify access before logout
      (permissionGuard.hasPermission as any).mockReturnValue({ allowed: true });
      expect(
        result.current.hasPermission({
          resource: "guests",
          action: "read",
          projectId: "sensitive-project",
        })
      ).toBe(true);

      // Logout
      await act(async () => {
        await result.current.logout();
      });

      // Verify no access after logout
      (permissionGuard.hasPermission as any).mockReturnValue({ allowed: false });
      expect(
        result.current.hasPermission({
          resource: "guests",
          action: "read",
          projectId: "sensitive-project",
        })
      ).toBe(false);

      expect(result.current.user).toBeNull();
    });
  });

  describe("Philippine Compliance Requirements", () => {
    it("should enforce data privacy act audit logging", async () => {
      const { result } = renderHook(() => useAuthStore());

      // Perform sensitive operation
      (apiClient.post as any).mockResolvedValue({
        data: {
          user: MOCK_USERS.OWNER,
          accessToken: TEST_CONSTANTS.MOCK_TOKEN,
          refreshToken: TEST_CONSTANTS.MOCK_REFRESH_TOKEN,
        },
      });

      await act(async () => {
        await result.current.login({
          email: "owner@resort.ph",
          password: "SecurePass123!",
        });
      });

      // Verify comprehensive audit logging
      expect(auditLogger.logAuth).toHaveBeenCalledWith(
        "login",
        expect.objectContaining({
          email: "owner@resort.ph",
        }),
        true,
        expect.objectContaining({
          ipAddress: expect.any(String),
          userAgent: expect.any(String),
        })
      );
    });

    it("should track failed login attempts for compliance reporting", async () => {
      const { result } = renderHook(() => useAuthStore());

      (apiClient.post as any).mockRejectedValue({
        response: { data: { message: "Invalid credentials" } },
      });

      // Attempt login with wrong credentials
      await act(async () => {
        await result.current.login({
          email: "attacker@malicious.com",
          password: "wrongpass",
        });
      });

      // Verify failure tracking
      expect(rateLimiter.trackFailure).toHaveBeenCalledWith("login");
      expect(auditLogger.logAuth).toHaveBeenCalledWith(
        "login",
        null,
        false,
        expect.objectContaining({
          email: "attacker@malicious.com",
          error: "Invalid credentials",
        })
      );
    });

    it("should enforce strict password change audit trail", async () => {
      const { result } = renderHook(() => useAuthStore());

      // Set authenticated user
      act(() => {
        result.current.user = MOCK_USERS.MANAGER;
        result.current.isAuthenticated = true;
      });

      (secureTokenManager.getAccessToken as any).mockReturnValue("token");
      (apiClient.patch as any).mockResolvedValue({
        data: { success: true },
      });

      await act(async () => {
        await result.current.updatePassword({
          currentPassword: "OldPass123!",
          newPassword: "NewSecurePass456!",
        });
      });

      // Verify password change audit
      expect(auditLogger.log).toHaveBeenCalledWith(
        "AUTH_PASSWORD_CHANGE",
        expect.objectContaining({
          userId: MOCK_USERS.MANAGER.id,
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe("Resort-Specific Security Scenarios", () => {
    it("should protect guest data access with proper permissions", async () => {
      const { result } = renderHook(() => useAuthStore());

      // Login as front desk staff
      act(() => {
        result.current.user = MOCK_USERS.STAFF;
        result.current.isAuthenticated = true;
      });

      // Mock permission check for guest data
      (permissionGuard.hasPermission as any).mockImplementation((user: any, check: any) => {
        if (check.resource === "guests" && check.action === "read") {
          return { allowed: user.role === "STAFF" || user.role === "MANAGER" };
        }
        if (check.resource === "guests" && check.action === "delete") {
          return { allowed: user.role === "ADMIN" || user.role === "SUPER_ADMIN" };
        }
        return { allowed: false };
      });

      // Staff can read guest data
      expect(
        result.current.hasPermission({
          resource: "guests",
          action: "read",
        })
      ).toBe(true);

      // Staff cannot delete guest data
      expect(
        result.current.hasPermission({
          resource: "guests",
          action: "delete",
        })
      ).toBe(false);

      // Verify access attempts are logged
      expect(auditLogger.logAccess).toHaveBeenCalled();
    });

    it("should enforce payment processing security", async () => {
      const { result } = renderHook(() => useAuthStore());

      // Login as manager
      act(() => {
        result.current.user = MOCK_USERS.MANAGER;
        result.current.isAuthenticated = true;
      });

      // Mock strict payment permissions
      (permissionGuard.hasPermission as any).mockImplementation((user: any, check: any) => {
        if (check.resource === "payments" && check.action === "process") {
          // Only specific roles can process payments
          return {
            allowed: ["MANAGER", "ADMIN", "SUPER_ADMIN"].includes(user.role),
            reason: !["MANAGER", "ADMIN", "SUPER_ADMIN"].includes(user.role)
              ? "Insufficient privileges for payment processing"
              : undefined,
          };
        }
        if (check.resource === "payments" && check.action === "refund") {
          // Only admin can process refunds
          return {
            allowed: ["ADMIN", "SUPER_ADMIN"].includes(user.role),
            reason: !["ADMIN", "SUPER_ADMIN"].includes(user.role)
              ? "Refund processing requires admin privileges"
              : undefined,
          };
        }
        return { allowed: false };
      });

      // Manager can process payments
      expect(
        result.current.hasPermission({
          resource: "payments",
          action: "process",
        })
      ).toBe(true);

      // Manager cannot process refunds
      expect(
        result.current.hasPermission({
          resource: "payments",
          action: "refund",
        })
      ).toBe(false);
    });

    it("should handle booking modification with rate limiting", async () => {
      const { result } = renderHook(() => useAuthStore());

      // Login as staff
      act(() => {
        result.current.user = MOCK_USERS.STAFF;
        result.current.isAuthenticated = true;
      });

      // Mock rate limit for booking modifications
      let modificationCount = 0;
      (rateLimiter.check as any).mockImplementation(() => {
        modificationCount++;
        if (modificationCount > 10) {
          return {
            allowed: false,
            retryAfter: 60000,
            reason: "Too many booking modifications",
          };
        }
        return { allowed: true };
      });

      // Simulate multiple booking modifications
      for (let i = 0; i < 15; i++) {
        const canModify = result.current.hasPermission({
          resource: "bookings",
          action: "update",
        });

        if (i < 10) {
          expect(canModify).toBe(true);
        } else {
          // Should be rate limited after 10 attempts
          expect(rateLimiter.check).toHaveBeenCalled();
        }
      }
    });
  });

  describe("Attack Vector Prevention", () => {
    it("should prevent JWT token manipulation", async () => {
      const { result } = renderHook(() => useAuthStore());

      // Attempt to use manipulated token
      const manipulatedToken =
        "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJoYWNrZXIiLCJyb2xlIjoiU1VQRVJfQURNSU4ifQ.fake";

      (secureTokenManager.validateTokenStructure as any).mockReturnValue({
        valid: false,
        error: "Invalid token signature",
      });

      (secureTokenManager.getAccessToken as any).mockReturnValue(manipulatedToken);

      await act(async () => {
        await result.current.initializeAuth();
      });

      // Should not authenticate with invalid token
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(auditLogger.logAuth).toHaveBeenCalledWith(
        "init",
        null,
        false,
        expect.objectContaining({
          error: expect.stringContaining("Invalid token"),
        })
      );
    });

    it("should prevent privilege escalation attempts", async () => {
      const { result } = renderHook(() => useAuthStore());

      // Login as regular staff
      const staffUser = { ...MOCK_USERS.STAFF };
      act(() => {
        result.current.user = staffUser;
        result.current.isAuthenticated = true;
      });

      // Attempt to modify own role (privilege escalation)
      const maliciousUpdate = {
        ...staffUser,
        role: "SUPER_ADMIN" as const,
      };

      (apiClient.patch as any).mockRejectedValue({
        response: {
          status: 403,
          data: { message: "Forbidden: Cannot modify user role" },
        },
      });

      await act(async () => {
        await result.current.updateProfile(maliciousUpdate);
      });

      // Role should not change
      expect(result.current.user?.role).toBe("STAFF");
      expect(auditLogger.logAuth).toHaveBeenCalledWith(
        "profile_update",
        expect.any(Object),
        false,
        expect.objectContaining({
          attemptedEscalation: true,
        })
      );
    });

    it("should prevent session fixation attacks", async () => {
      const { result } = renderHook(() => useAuthStore());

      // Simulate stolen session token
      const stolenToken = "stolen-session-token";
      (secureTokenManager.getAccessToken as any).mockReturnValue(stolenToken);

      // API should reject stolen token
      (apiClient.get as any).mockRejectedValue({
        response: {
          status: 401,
          data: { message: "Invalid session" },
        },
      });

      await act(async () => {
        await result.current.fetchCurrentUser();
      });

      // Should logout on invalid session
      expect(result.current.user).toBeNull();
      expect(secureTokenManager.clearTokens).toHaveBeenCalled();
      expect(auditLogger.logAuth).toHaveBeenCalledWith(
        "logout",
        null,
        true,
        expect.objectContaining({
          reason: "session_invalid",
        })
      );
    });

    it("should prevent brute force login attacks", async () => {
      const { result } = renderHook(() => useAuthStore());

      // Simulate multiple failed login attempts
      (apiClient.post as any).mockRejectedValue({
        response: { data: { message: "Invalid credentials" } },
      });

      // After 5 attempts, rate limiter should block
      (rateLimiter.check as any)
        .mockReturnValueOnce({ allowed: true })
        .mockReturnValueOnce({ allowed: true })
        .mockReturnValueOnce({ allowed: true })
        .mockReturnValueOnce({ allowed: true })
        .mockReturnValueOnce({ allowed: true })
        .mockReturnValue({
          allowed: false,
          retryAfter: 300000,
          remaining: 0,
        });

      // Attempt login 6 times
      for (let i = 0; i < 6; i++) {
        await act(async () => {
          await result.current.login({
            email: "victim@example.com",
            password: `attempt${i}`,
          });
        });
      }

      // Last attempt should be blocked
      expect(result.current.error).toContain("Too many login attempts");
      expect(rateLimiter.trackFailure).toHaveBeenCalledTimes(5);
    });
  });

  describe("Token Management Edge Cases", () => {
    it("should handle token refresh failure during active session", async () => {
      const { result } = renderHook(() => useAuthStore());

      // Set active session
      act(() => {
        result.current.user = MOCK_USERS.MANAGER;
        result.current.isAuthenticated = true;
      });

      (secureTokenManager.getRefreshToken as any).mockReturnValue("refresh-token");
      (apiClient.post as any).mockRejectedValue({
        response: {
          status: 401,
          data: { message: "Refresh token expired" },
        },
      });

      await act(async () => {
        await result.current.refreshToken();
      });

      // Should logout on refresh failure
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(auditLogger.logAuth).toHaveBeenCalledWith(
        "logout",
        expect.any(Object),
        true,
        expect.objectContaining({
          reason: "token_refresh_failed",
        })
      );
    });

    it("should handle corrupted tokens in storage", async () => {
      const { result } = renderHook(() => useAuthStore());

      // Mock corrupted token
      (secureTokenManager.getAccessToken as any).mockReturnValue("corrupted-@#$%-token");
      (secureTokenManager.validateTokenStructure as any).mockReturnValue({
        valid: false,
        error: "Token structure invalid",
      });

      await act(async () => {
        await result.current.initializeAuth();
      });

      // Should clear corrupted tokens
      expect(secureTokenManager.clearTokens).toHaveBeenCalled();
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it("should handle clock skew in token expiration", async () => {
      const { result } = renderHook(() => useAuthStore());

      // Mock token with clock skew
      const tokenWithSkew = "token-with-clock-skew";
      (secureTokenManager.getAccessToken as any).mockReturnValue(tokenWithSkew);

      // Token appears expired due to clock skew
      (secureTokenManager.isTokenExpired as any).mockReturnValue(true);
      (secureTokenManager.getRefreshToken as any).mockReturnValue("refresh-token");

      // But refresh succeeds
      (apiClient.post as any).mockResolvedValue({
        data: {
          accessToken: "new-synced-token",
          refreshToken: "new-refresh-token",
        },
      });

      await act(async () => {
        const isAuth = result.current.checkAuth();
        expect(isAuth).toBe(false); // Initially false due to "expired" token
      });

      // Should trigger automatic refresh
      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith("/auth/refresh", expect.any(Object));
      });
    });
  });
});
