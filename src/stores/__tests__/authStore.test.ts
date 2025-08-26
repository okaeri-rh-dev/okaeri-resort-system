/**
 * Comprehensive tests for authentication store
 * Tests all auth actions, security features, and edge cases
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAuthStore } from "../authStore";
import { MOCK_USERS, TEST_CONSTANTS, securityHelpers } from "@tests/utils/test-utils";
import { server } from "@tests/mocks/server";
import { mockHelpers } from "@tests/mocks/handlers";

// Mock dependencies
vi.mock("@/lib/api-client", () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    setAuthToken: vi.fn(),
  },
}));

vi.mock("@/lib/security/secure-token-manager", () => ({
  secureTokenManager: {
    storeTokens: vi.fn(),
    clearTokens: vi.fn(),
    getAccessToken: vi.fn(),
    getRefreshToken: vi.fn(),
    validateTokenStructure: vi.fn(() => ({ valid: true })),
    isTokenExpired: vi.fn(() => false),
    onTokenRefresh: vi.fn(() => () => {}),
  },
}));

vi.mock("@/lib/security/session-monitor", () => ({
  sessionMonitor: {
    start: vi.fn(),
    stop: vi.fn(),
    extendSession: vi.fn(),
  },
}));

vi.mock("@/lib/security/audit-logger", () => ({
  auditLogger: {
    logAuth: vi.fn(),
    log: vi.fn(),
    logAccess: vi.fn(),
    logDataOperation: vi.fn(),
  },
}));

vi.mock("@/lib/security/rate-limiter", () => ({
  rateLimiter: {
    check: vi.fn(() => ({ allowed: true })),
    trackSuccess: vi.fn(),
    trackFailure: vi.fn(),
  },
}));

vi.mock("@/lib/security/permission-guard", () => ({
  permissionGuard: {
    hasPermission: vi.fn(() => ({ allowed: true })),
  },
}));

vi.mock("@/lib/security/constants", () => ({
  TOKEN_EXPIRY: {
    ACCESS_TOKEN: 900000,
    SESSION_TIMEOUT: 3600000,
    SESSION_WARNING: 300000,
  },
  RATE_LIMITS: {
    LOGIN_ATTEMPTS: { MAX: 5, WINDOW: 300000 },
    PASSWORD_RESET: { MAX: 3, WINDOW: 3600000 },
  },
  AUDIT_EVENTS: {
    DATA_CREATE: "DATA_CREATE",
    AUTH_PASSWORD_CHANGE: "AUTH_PASSWORD_CHANGE",
  },
  SESSION_CONFIG: {
    TIMEOUT: 3600000,
    WARNING: 300000,
  },
}));

// Import mocked modules
import { apiClient } from "@/lib/api-client";
import { secureTokenManager as tokenManager } from "@/lib/security/secure-token-manager";
import { sessionMonitor } from "@/lib/security/session-monitor";
import { auditLogger } from "@/lib/security/audit-logger";
import { rateLimiter } from "@/lib/security/rate-limiter";
import { permissionGuard } from "@/lib/security/permission-guard";

describe("AuthStore - Comprehensive Security Tests", () => {
  beforeEach(() => {
    // Reset MSW handlers and mock database
    mockHelpers.reset();

    // Reset store state
    const { result } = renderHook(() => useAuthStore());
    act(() => {
      result.current.setUser(null);
      result.current.setToken(null);
      result.current.setRefreshToken(null);
      result.current.setError(null);
      result.current.setLoading(false);
    });

    // Clear all mocks
    vi.clearAllMocks();

    // Reset security mocks to defaults
    (tokenManager.validateTokenStructure as any).mockReturnValue({ valid: true });
    (tokenManager.isTokenExpired as any).mockReturnValue(false);
    (rateLimiter.check as any).mockReturnValue({ allowed: true });
    (permissionGuard.hasPermission as any).mockReturnValue({ allowed: true });
  });

  afterEach(() => {
    mockHelpers.clearAuditLogs();
  });

  describe("login", () => {
    it("should successfully login a user with complete security flow", async () => {
      const mockUser = MOCK_USERS.OWNER;
      const mockToken = TEST_CONSTANTS.MOCK_TOKEN;
      const mockRefreshToken = TEST_CONSTANTS.MOCK_REFRESH_TOKEN;

      (apiClient.post as any).mockResolvedValue({
        data: {
          user: mockUser,
          token: mockToken,
          refreshToken: mockRefreshToken,
        },
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login(mockUser.email, "correct-password");
      });

      // Verify auth state
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.token).toBe(mockToken);
      expect(result.current.refreshToken).toBe(mockRefreshToken);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.sessionExpiry).toBeGreaterThan(Date.now());

      // Verify security integrations
      expect(rateLimiter.check).toHaveBeenCalledWith(
        "login",
        expect.objectContaining({
          max: 5,
          window: 300000,
          identifier: mockUser.email,
        })
      );
      expect(tokenManager.validateTokenStructure).toHaveBeenCalledWith(mockToken);
      expect(tokenManager.storeTokens).toHaveBeenCalledWith(mockToken, mockRefreshToken);
      expect(apiClient.setAuthToken).toHaveBeenCalledWith(mockToken);
      expect(sessionMonitor.start).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 3600000,
          warningTime: 300000,
          onTimeout: expect.any(Function),
          onWarning: expect.any(Function),
        })
      );
      expect(tokenManager.onTokenRefresh).toHaveBeenCalledWith(expect.any(Function));
      expect(auditLogger.logAuth).toHaveBeenCalledWith("login", mockUser, true);
      expect(rateLimiter.trackSuccess).toHaveBeenCalledWith("login");
    });

    it("should handle invalid token structure", async () => {
      const mockUser = MOCK_USERS.OWNER;
      const invalidToken = securityHelpers.createInvalidToken();

      (apiClient.post as any).mockResolvedValue({
        data: {
          user: mockUser,
          token: invalidToken,
          refreshToken: "valid-refresh-token",
        },
      });

      (tokenManager.validateTokenStructure as any).mockReturnValue({
        valid: false,
        error: "Invalid token format",
      });

      const { result } = renderHook(() => useAuthStore());

      await expect(
        act(async () => {
          await result.current.login(mockUser.email, "password");
        })
      ).rejects.toThrow("Invalid token format");

      expect(result.current.isAuthenticated).toBe(false);
      expect(tokenManager.storeTokens).not.toHaveBeenCalled();
    });

    it("should handle login failure with proper error state", async () => {
      const error = new Error("Invalid credentials");
      (apiClient.post as any).mockRejectedValue(error);

      const { result } = renderHook(() => useAuthStore());

      await expect(
        act(async () => {
          await result.current.login("wrong@email.com", "wrong-password");
        })
      ).rejects.toThrow("Invalid credentials");

      expect(result.current.user).toBe(null);
      expect(result.current.token).toBe(null);
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe("Invalid credentials");
      expect(auditLogger.logAuth).toHaveBeenCalledWith("login", null, false, {
        error: "Invalid credentials",
      });
      expect(rateLimiter.trackFailure).toHaveBeenCalledWith("login");
    });

    it("should enforce rate limiting with proper error handling", async () => {
      const email = "ratelimited@example.com";
      (rateLimiter.check as any).mockReturnValue({
        allowed: false,
        retryAfter: 60,
      });

      const { result } = renderHook(() => useAuthStore());

      await expect(
        act(async () => {
          await result.current.login(email, "password");
        })
      ).rejects.toThrow("Too many login attempts. Please try again in 60 seconds.");

      expect(result.current.error).toContain("Too many login attempts");
      expect(apiClient.post).not.toHaveBeenCalled();
      expect(auditLogger.logAuth).toHaveBeenCalledWith("login", null, false, {
        reason: "rate_limit",
      });
    });

    it("should handle network errors gracefully", async () => {
      const networkError = new Error("Network Error");
      networkError.name = "NetworkError";
      (apiClient.post as any).mockRejectedValue(networkError);

      const { result } = renderHook(() => useAuthStore());

      await expect(
        act(async () => {
          await result.current.login("test@example.com", "password");
        })
      ).rejects.toThrow("Network Error");

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe("Network Error");
    });

    it("should properly set loading states during login", async () => {
      let resolvePromise: (value: any) => void;
      const loginPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      (apiClient.post as any).mockReturnValue(loginPromise);

      const { result } = renderHook(() => useAuthStore());

      // Start login
      const loginCall = act(async () => {
        await result.current.login("test@example.com", "password");
      });

      // Check loading state is true
      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBe(null);

      // Resolve the promise
      resolvePromise!({
        data: {
          user: MOCK_USERS.OWNER,
          token: TEST_CONSTANTS.MOCK_TOKEN,
          refreshToken: TEST_CONSTANTS.MOCK_REFRESH_TOKEN,
        },
      });

      await loginCall;

      // Check loading state is false
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("logout", () => {
    it("should successfully logout authenticated user with complete cleanup", async () => {
      const mockUser = MOCK_USERS.OWNER;
      const { result } = renderHook(() => useAuthStore());

      // Set initial authenticated state
      act(() => {
        result.current.setUser(mockUser);
        result.current.setToken(TEST_CONSTANTS.MOCK_TOKEN);
        result.current.setRefreshToken(TEST_CONSTANTS.MOCK_REFRESH_TOKEN);
      });

      (apiClient.post as any).mockResolvedValue({ data: { message: "Logged out successfully" } });

      await act(async () => {
        await result.current.logout();
      });

      // Verify complete state cleanup
      expect(result.current.user).toBe(null);
      expect(result.current.token).toBe(null);
      expect(result.current.refreshToken).toBe(null);
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);

      // Verify security cleanup
      expect(apiClient.post).toHaveBeenCalledWith("/auth/logout");
      expect(sessionMonitor.stop).toHaveBeenCalled();
      expect(tokenManager.clearTokens).toHaveBeenCalled();
      expect(apiClient.setAuthToken).toHaveBeenCalledWith(null);
      expect(auditLogger.logAuth).toHaveBeenCalledWith("logout", mockUser, true);
    });

    it("should handle logout API errors gracefully", async () => {
      const mockUser = MOCK_USERS.OWNER;
      const { result } = renderHook(() => useAuthStore());

      // Set initial authenticated state
      act(() => {
        result.current.setUser(mockUser);
        result.current.setToken(TEST_CONSTANTS.MOCK_TOKEN);
      });

      // Mock API error
      const logoutError = new Error("Logout failed");
      (apiClient.post as any).mockRejectedValue(logoutError);

      // Mock console.error to avoid test output noise
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await act(async () => {
        await result.current.logout();
      });

      // Should still clean up local state even if API fails
      expect(result.current.user).toBe(null);
      expect(result.current.token).toBe(null);
      expect(result.current.isAuthenticated).toBe(false);
      expect(sessionMonitor.stop).toHaveBeenCalled();
      expect(tokenManager.clearTokens).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith("Logout error:", logoutError);

      consoleSpy.mockRestore();
    });

    it("should handle logout without token", async () => {
      const { result } = renderHook(() => useAuthStore());

      // No token set - simulate unauthenticated logout
      act(() => {
        result.current.setUser(null);
        result.current.setToken(null);
      });

      await act(async () => {
        await result.current.logout();
      });

      // Should not call API but still perform cleanup
      expect(apiClient.post).not.toHaveBeenCalled();
      expect(sessionMonitor.stop).toHaveBeenCalled();
      expect(tokenManager.clearTokens).toHaveBeenCalled();
      expect(result.current.user).toBe(null);
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe("refreshToken", () => {
    it("should successfully refresh tokens with security validation", async () => {
      const mockUser = MOCK_USERS.OWNER;
      const oldRefreshToken = "old-refresh-token";
      const newToken = "new-access-token";
      const newRefreshToken = "new-refresh-token";

      // Set up initial state
      const { result } = renderHook(() => useAuthStore());
      act(() => {
        result.current.setUser(mockUser);
      });

      (tokenManager.getRefreshToken as any).mockReturnValue(oldRefreshToken);
      (apiClient.post as any).mockResolvedValue({
        data: {
          token: newToken,
          refreshToken: newRefreshToken,
        },
      });

      await act(async () => {
        await result.current.refreshToken();
      });

      // Verify token update
      expect(result.current.token).toBe(newToken);
      expect(result.current.refreshToken).toBe(newRefreshToken);
      expect(result.current.sessionExpiry).toBeGreaterThan(Date.now());

      // Verify security flow
      expect(apiClient.post).toHaveBeenCalledWith("/auth/refresh", {
        refreshToken: oldRefreshToken,
      });
      expect(tokenManager.validateTokenStructure).toHaveBeenCalledWith(newToken);
      expect(tokenManager.storeTokens).toHaveBeenCalledWith(newToken, newRefreshToken);
      expect(apiClient.setAuthToken).toHaveBeenCalledWith(newToken);
      expect(sessionMonitor.extendSession).toHaveBeenCalled();
      expect(auditLogger.logAuth).toHaveBeenCalledWith("refresh", mockUser, true);
    });

    it("should handle invalid new token from refresh", async () => {
      const mockUser = MOCK_USERS.OWNER;
      const oldRefreshToken = "old-refresh-token";
      const invalidNewToken = securityHelpers.createInvalidToken();

      const { result } = renderHook(() => useAuthStore());
      act(() => {
        result.current.setUser(mockUser);
      });

      (tokenManager.getRefreshToken as any).mockReturnValue(oldRefreshToken);
      (apiClient.post as any).mockResolvedValue({
        data: {
          token: invalidNewToken,
          refreshToken: "new-refresh-token",
        },
      });

      (tokenManager.validateTokenStructure as any).mockReturnValue({
        valid: false,
        error: "Invalid token format",
      });

      // Mock logout to prevent side effects
      const logoutSpy = vi.spyOn(result.current, "logout").mockImplementation(async () => {});

      await expect(
        act(async () => {
          await result.current.refreshToken();
        })
      ).rejects.toThrow("Invalid token format");

      expect(logoutSpy).toHaveBeenCalled();
    });

    it("should handle missing refresh token", async () => {
      const { result } = renderHook(() => useAuthStore());

      (tokenManager.getRefreshToken as any).mockReturnValue(null);

      await expect(
        act(async () => {
          await result.current.refreshToken();
        })
      ).rejects.toThrow("No refresh token available");

      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it("should logout on refresh API failure", async () => {
      const mockUser = MOCK_USERS.OWNER;
      const oldRefreshToken = "expired-refresh-token";

      const { result } = renderHook(() => useAuthStore());
      act(() => {
        result.current.setUser(mockUser);
      });

      (tokenManager.getRefreshToken as any).mockReturnValue(oldRefreshToken);

      const refreshError = new Error("Invalid refresh token");
      (apiClient.post as any).mockRejectedValue(refreshError);

      // Mock logout to prevent side effects
      const logoutSpy = vi.spyOn(result.current, "logout").mockImplementation(async () => {});

      await expect(
        act(async () => {
          await result.current.refreshToken();
        })
      ).rejects.toThrow("Invalid refresh token");

      expect(auditLogger.logAuth).toHaveBeenCalledWith("refresh", mockUser, false, {
        error: "Invalid refresh token",
      });
      expect(logoutSpy).toHaveBeenCalled();
    });

    it("should handle refreshSession wrapper method", async () => {
      const { result } = renderHook(() => useAuthStore());

      // Mock the refreshToken method
      const refreshTokenSpy = vi
        .spyOn(result.current, "refreshToken")
        .mockImplementation(async () => {});

      await act(async () => {
        await result.current.refreshSession();
      });

      expect(refreshTokenSpy).toHaveBeenCalled();
    });
  });

  describe("register", () => {
    it("should successfully register a new user", async () => {
      const registrationData = {
        name: "New User",
        email: "newuser@okaeriresort.ph",
        password: "NewPassword123!",
        projectName: "New Resort",
      };

      const mockNewUser = {
        ...MOCK_USERS.OWNER,
        id: "new-user-123",
        email: registrationData.email,
        name: registrationData.name,
      };

      (apiClient.post as any).mockResolvedValue({
        data: {
          user: mockNewUser,
          token: TEST_CONSTANTS.MOCK_TOKEN,
          refreshToken: TEST_CONSTANTS.MOCK_REFRESH_TOKEN,
        },
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.register(registrationData);
      });

      expect(result.current.user).toEqual(mockNewUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.token).toBe(TEST_CONSTANTS.MOCK_TOKEN);
      expect(result.current.isLoading).toBe(false);

      // Verify security flow for registration
      expect(rateLimiter.check).toHaveBeenCalledWith("register", {
        max: 3,
        window: 3600000,
        identifier: registrationData.email,
      });
      expect(tokenManager.validateTokenStructure).toHaveBeenCalledWith(TEST_CONSTANTS.MOCK_TOKEN);
      expect(sessionMonitor.start).toHaveBeenCalled();
    });

    it("should handle registration rate limiting", async () => {
      const registrationData = {
        name: "Rate Limited",
        email: "ratelimited@example.com",
        password: "Password123!",
      };

      (rateLimiter.check as any).mockReturnValue({
        allowed: false,
        retryAfter: 3600,
      });

      const { result } = renderHook(() => useAuthStore());

      await expect(
        act(async () => {
          await result.current.register(registrationData);
        })
      ).rejects.toThrow("Too many registration attempts. Please try again later.");

      expect(apiClient.post).not.toHaveBeenCalled();
    });
  });

  describe("resetPassword", () => {
    it("should successfully request password reset", async () => {
      const email = "reset@okaeriresort.ph";

      (apiClient.post as any).mockResolvedValue({
        data: { message: "Password reset email sent" },
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.resetPassword(email);
      });

      expect(result.current.isLoading).toBe(false);
      expect(apiClient.post).toHaveBeenCalledWith("/auth/reset-password", { email });
      expect(auditLogger.logAuth).toHaveBeenCalledWith("password_reset", null, true, { email });
    });

    it("should handle password reset rate limiting", async () => {
      const email = "ratelimited@example.com";

      (rateLimiter.check as any).mockReturnValue({
        allowed: false,
        retryAfter: 3600,
      });

      const { result } = renderHook(() => useAuthStore());

      await expect(
        act(async () => {
          await result.current.resetPassword(email);
        })
      ).rejects.toThrow("Too many password reset attempts. Please try again later.");

      expect(apiClient.post).not.toHaveBeenCalled();
    });
  });

  describe("updatePassword", () => {
    it("should successfully update password", async () => {
      const mockUser = MOCK_USERS.OWNER;
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setUser(mockUser);
      });

      (apiClient.post as any).mockResolvedValue({
        data: { message: "Password updated successfully" },
      });

      await act(async () => {
        await result.current.updatePassword("currentPass123!", "newPass123!");
      });

      expect(result.current.isLoading).toBe(false);
      expect(apiClient.post).toHaveBeenCalledWith("/auth/update-password", {
        currentPassword: "currentPass123!",
        newPassword: "newPass123!",
      });
      expect(auditLogger.log).toHaveBeenCalledWith("AUTH_PASSWORD_CHANGE", {
        userId: mockUser.id,
        userEmail: mockUser.email,
        result: "success",
      });
    });
  });

  describe("checkAuth", () => {
    it("should return true for valid authenticated user", () => {
      const validToken = "valid-token";
      (tokenManager.getAccessToken as any).mockReturnValue(validToken);
      (tokenManager.isTokenExpired as any).mockReturnValue(false);

      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setUser(MOCK_USERS.OWNER);
      });

      const isAuthenticated = result.current.checkAuth();

      expect(isAuthenticated).toBe(true);
      expect(tokenManager.getAccessToken).toHaveBeenCalled();
      expect(tokenManager.isTokenExpired).toHaveBeenCalledWith(validToken, 0);
    });

    it("should return false for missing token", () => {
      (tokenManager.getAccessToken as any).mockReturnValue(null);

      const { result } = renderHook(() => useAuthStore());

      const isAuthenticated = result.current.checkAuth();

      expect(isAuthenticated).toBe(false);
    });

    it("should return false for missing user", () => {
      (tokenManager.getAccessToken as any).mockReturnValue("valid-token");

      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setUser(null);
      });

      const isAuthenticated = result.current.checkAuth();

      expect(isAuthenticated).toBe(false);
    });

    it("should return false and trigger refresh for expired token", () => {
      const expiredToken = securityHelpers.createExpiredToken();
      (tokenManager.getAccessToken as any).mockReturnValue(expiredToken);
      (tokenManager.isTokenExpired as any).mockReturnValue(true);

      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setUser(MOCK_USERS.OWNER);
      });

      const refreshSpy = vi
        .spyOn(result.current, "refreshToken")
        .mockImplementation(async () => {});

      const logoutSpy = vi.spyOn(result.current, "logout").mockImplementation(async () => {});

      const isAuthenticated = result.current.checkAuth();

      expect(isAuthenticated).toBe(false);
      expect(refreshSpy).toHaveBeenCalled();

      // Simulate refresh failure
      refreshSpy.mockRejectedValue(new Error("Refresh failed"));

      // Should call logout on refresh failure
      waitFor(() => {
        expect(logoutSpy).toHaveBeenCalled();
      });
    });
  });

  describe("hasPermission", () => {
    it("should check and log permission access for authenticated user", () => {
      const mockUser = MOCK_USERS.OWNER;
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setUser(mockUser);
      });

      const hasPermission = result.current.hasPermission("bookings", "create");

      expect(hasPermission).toBe(true);
      expect(permissionGuard.hasPermission).toHaveBeenCalledWith(mockUser, {
        resource: "bookings",
        action: "create",
      });
      expect(auditLogger.logAccess).toHaveBeenCalledWith("bookings", "create", true, mockUser);
    });

    it("should handle permission denial", () => {
      const mockUser = MOCK_USERS.STAFF;

      (permissionGuard.hasPermission as any).mockReturnValue({ allowed: false });

      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setUser(mockUser);
      });

      const hasPermission = result.current.hasPermission("admin", "delete");

      expect(hasPermission).toBe(false);
      expect(auditLogger.logAccess).toHaveBeenCalledWith("admin", "delete", false, mockUser);
    });
  });

  describe("hasRole", () => {
    it("should correctly check user role", () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setUser(MOCK_USERS.MANAGER);
      });

      expect(result.current.hasRole("MANAGER")).toBe(true);
      expect(result.current.hasRole("OWNER")).toBe(false);
      expect(result.current.hasRole("STAFF")).toBe(false);
    });

    it("should return false for null user", () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setUser(null);
      });

      expect(result.current.hasRole("OWNER")).toBe(false);
      expect(result.current.hasRole("MANAGER")).toBe(false);
      expect(result.current.hasRole("STAFF")).toBe(false);
    });
  });

  describe("fetchCurrentUser", () => {
    it("should fetch and set current user", async () => {
      const mockUser = MOCK_USERS.OWNER;

      (tokenManager.getAccessToken as any).mockReturnValue(TEST_CONSTANTS.MOCK_TOKEN);
      (apiClient.get as any).mockResolvedValue({ data: mockUser });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.fetchCurrentUser();
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(apiClient.get).toHaveBeenCalledWith("/auth/me");
    });

    it("should not fetch if no token available", async () => {
      (tokenManager.getAccessToken as any).mockReturnValue(null);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.fetchCurrentUser();
      });

      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should logout on fetch user failure", async () => {
      (tokenManager.getAccessToken as any).mockReturnValue(TEST_CONSTANTS.MOCK_TOKEN);
      (apiClient.get as any).mockRejectedValue(new Error("Unauthorized"));

      const { result } = renderHook(() => useAuthStore());

      const logoutSpy = vi.spyOn(result.current, "logout").mockImplementation(async () => {});

      await act(async () => {
        await result.current.fetchCurrentUser();
      });

      expect(logoutSpy).toHaveBeenCalled();
    });
  });

  describe("initializeAuth", () => {
    it("should initialize auth with valid stored tokens", async () => {
      const mockUser = MOCK_USERS.OWNER;
      const validToken = TEST_CONSTANTS.MOCK_TOKEN;
      const validRefreshToken = TEST_CONSTANTS.MOCK_REFRESH_TOKEN;

      (tokenManager.getAccessToken as any).mockReturnValue(validToken);
      (tokenManager.getRefreshToken as any).mockReturnValue(validRefreshToken);
      (tokenManager.isTokenExpired as any).mockReturnValue(false);
      (apiClient.get as any).mockResolvedValue({ data: mockUser });

      const { result } = renderHook(() => useAuthStore());

      const fetchUserSpy = vi.spyOn(result.current, "fetchCurrentUser").mockResolvedValue();

      await act(async () => {
        await result.current.initializeAuth();
      });

      expect(apiClient.setAuthToken).toHaveBeenCalledWith(validToken);
      expect(fetchUserSpy).toHaveBeenCalled();
      expect(sessionMonitor.start).toHaveBeenCalled();
      expect(tokenManager.onTokenRefresh).toHaveBeenCalled();
    });

    it("should refresh expired token on init", async () => {
      const expiredToken = securityHelpers.createExpiredToken();
      const validRefreshToken = TEST_CONSTANTS.MOCK_REFRESH_TOKEN;

      (tokenManager.getAccessToken as any).mockReturnValue(expiredToken);
      (tokenManager.getRefreshToken as any).mockReturnValue(validRefreshToken);
      (tokenManager.isTokenExpired as any).mockReturnValue(true);

      const { result } = renderHook(() => useAuthStore());

      const refreshTokenSpy = vi.spyOn(result.current, "refreshToken").mockResolvedValue();

      await act(async () => {
        await result.current.initializeAuth();
      });

      expect(refreshTokenSpy).toHaveBeenCalled();
    });

    it("should logout on init failure", async () => {
      const expiredToken = securityHelpers.createExpiredToken();
      const validRefreshToken = TEST_CONSTANTS.MOCK_REFRESH_TOKEN;

      (tokenManager.getAccessToken as any).mockReturnValue(expiredToken);
      (tokenManager.getRefreshToken as any).mockReturnValue(validRefreshToken);
      (tokenManager.isTokenExpired as any).mockReturnValue(true);

      const { result } = renderHook(() => useAuthStore());

      const refreshTokenSpy = vi
        .spyOn(result.current, "refreshToken")
        .mockRejectedValue(new Error("Refresh failed"));
      const logoutSpy = vi.spyOn(result.current, "logout").mockImplementation(async () => {});

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await act(async () => {
        await result.current.initializeAuth();
      });

      expect(refreshTokenSpy).toHaveBeenCalled();
      expect(logoutSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith("Failed to refresh token:", expect.any(Error));

      consoleSpy.mockRestore();
    });

    it("should do nothing with no stored tokens", async () => {
      (tokenManager.getAccessToken as any).mockReturnValue(null);
      (tokenManager.getRefreshToken as any).mockReturnValue(null);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.initializeAuth();
      });

      expect(apiClient.setAuthToken).not.toHaveBeenCalled();
      expect(sessionMonitor.start).not.toHaveBeenCalled();
    });
  });

  describe("updateProfile", () => {
    it("should successfully update user profile", async () => {
      const mockUser = MOCK_USERS.OWNER;
      const updatedUser = { ...mockUser, name: "Updated Name" };
      const updateData = { name: "Updated Name" };

      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setUser(mockUser);
      });

      (apiClient.patch as any).mockResolvedValue({ data: updatedUser });

      await act(async () => {
        await result.current.updateProfile(updateData);
      });

      expect(result.current.user).toEqual(updatedUser);
      expect(result.current.isLoading).toBe(false);
      expect(apiClient.patch).toHaveBeenCalledWith("/auth/profile", updateData);
      expect(auditLogger.logDataOperation).toHaveBeenCalledWith(
        "update",
        "user",
        mockUser.id,
        mockUser
      );
    });
  });

  describe("State Management", () => {
    it("should properly manage loading states", async () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setLoading(true);
      });
      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.setLoading(false);
      });
      expect(result.current.isLoading).toBe(false);
    });

    it("should properly manage error states", () => {
      const { result } = renderHook(() => useAuthStore());
      const errorMessage = "Test error message";

      act(() => {
        result.current.setError(errorMessage);
      });
      expect(result.current.error).toBe(errorMessage);

      act(() => {
        result.current.clearError();
      });
      expect(result.current.error).toBe(null);
    });

    it("should properly set authentication state with user", () => {
      const { result } = renderHook(() => useAuthStore());
      const mockUser = MOCK_USERS.OWNER;

      act(() => {
        result.current.setUser(mockUser);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);

      act(() => {
        result.current.setUser(null);
      });

      expect(result.current.user).toBe(null);
      expect(result.current.isAuthenticated).toBe(false);
    });
  });
});
