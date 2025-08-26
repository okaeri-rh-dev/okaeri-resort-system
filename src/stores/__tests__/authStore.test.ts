/**
 * Tests for authentication store
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAuthStore } from "../authStore";
import { apiClient } from "@/api/client";
import { tokenManager, sessionMonitor, auditLogger, rateLimiter } from "@/lib/security";

// Mock dependencies
vi.mock("@/api/client", () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    setAuthToken: vi.fn(),
  },
}));

vi.mock("@/lib/security", () => ({
  tokenManager: {
    storeTokens: vi.fn(),
    clearTokens: vi.fn(),
    getAccessToken: vi.fn(),
    getRefreshToken: vi.fn(),
    validateTokenStructure: vi.fn(() => ({ valid: true })),
    isTokenExpired: vi.fn(() => false),
    onTokenRefresh: vi.fn(() => () => {}),
  },
  sessionMonitor: {
    start: vi.fn(),
    stop: vi.fn(),
    extendSession: vi.fn(),
  },
  auditLogger: {
    logAuth: vi.fn(),
    log: vi.fn(),
    logAccess: vi.fn(),
    logDataOperation: vi.fn(),
  },
  rateLimiter: {
    check: vi.fn(() => ({ allowed: true })),
    trackSuccess: vi.fn(),
    trackFailure: vi.fn(),
  },
  permissionGuard: {
    hasPermission: vi.fn(() => ({ allowed: true })),
  },
  TOKEN_EXPIRY: {
    ACCESS_TOKEN: 900000,
    SESSION_TIMEOUT: 3600000,
  },
  RATE_LIMITS: {
    LOGIN_ATTEMPTS: { MAX: 5, WINDOW: 300000 },
    PASSWORD_RESET: { MAX: 3, WINDOW: 3600000 },
  },
  AUDIT_EVENTS: {
    DATA_CREATE: "DATA_CREATE",
    AUTH_PASSWORD_CHANGE: "AUTH_PASSWORD_CHANGE",
  },
}));

describe("AuthStore", () => {
  beforeEach(() => {
    // Reset store state
    const { result } = renderHook(() => useAuthStore());
    act(() => {
      result.current.setUser(null);
      result.current.setToken(null);
      result.current.setRefreshToken(null);
      result.current.setError(null);
    });

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe("login", () => {
    it("should successfully login a user", async () => {
      const mockUser = {
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
        role: "OWNER",
      };
      const mockToken = "access-token";
      const mockRefreshToken = "refresh-token";

      (apiClient.post as any).mockResolvedValue({
        data: {
          user: mockUser,
          token: mockToken,
          refreshToken: mockRefreshToken,
        },
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login("test@example.com", "password");
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(tokenManager.storeTokens).toHaveBeenCalledWith(mockToken, mockRefreshToken);
      expect(sessionMonitor.start).toHaveBeenCalled();
      expect(auditLogger.logAuth).toHaveBeenCalledWith("login", mockUser, true);
    });

    it("should handle login failure", async () => {
      const error = new Error("Invalid credentials");
      (apiClient.post as any).mockRejectedValue(error);

      const { result } = renderHook(() => useAuthStore());

      await expect(
        act(async () => {
          await result.current.login("test@example.com", "wrong-password");
        })
      ).rejects.toThrow("Invalid credentials");

      expect(result.current.user).toBe(null);
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBe("Invalid credentials");
      expect(rateLimiter.trackFailure).toHaveBeenCalledWith("login");
    });

    it("should enforce rate limiting", async () => {
      (rateLimiter.check as any).mockReturnValue({
        allowed: false,
        retryAfter: 60,
      });

      const { result } = renderHook(() => useAuthStore());

      await expect(
        act(async () => {
          await result.current.login("test@example.com", "password");
        })
      ).rejects.toThrow("Too many login attempts");

      expect(apiClient.post).not.toHaveBeenCalled();
      expect(auditLogger.logAuth).toHaveBeenCalledWith("login", null, false, {
        reason: "rate_limit",
      });
    });
  });

  describe("logout", () => {
    it("should successfully logout a user", async () => {
      const { result } = renderHook(() => useAuthStore());

      // Set initial authenticated state
      act(() => {
        result.current.setUser({
          id: "user-1",
          email: "test@example.com",
          name: "Test User",
          role: "OWNER",
        } as any);
        result.current.setToken("access-token");
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBe(null);
      expect(result.current.token).toBe(null);
      expect(result.current.isAuthenticated).toBe(false);
      expect(sessionMonitor.stop).toHaveBeenCalled();
      expect(tokenManager.clearTokens).toHaveBeenCalled();
    });
  });

  describe("refreshToken", () => {
    it("should successfully refresh tokens", async () => {
      const newToken = "new-access-token";
      const newRefreshToken = "new-refresh-token";

      (tokenManager.getRefreshToken as any).mockReturnValue("old-refresh-token");
      (apiClient.post as any).mockResolvedValue({
        data: {
          token: newToken,
          refreshToken: newRefreshToken,
        },
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.refreshToken();
      });

      expect(result.current.token).toBe(newToken);
      expect(result.current.refreshToken).toBe(newRefreshToken);
      expect(tokenManager.storeTokens).toHaveBeenCalledWith(newToken, newRefreshToken);
      expect(sessionMonitor.extendSession).toHaveBeenCalled();
    });

    it("should logout on refresh failure", async () => {
      (tokenManager.getRefreshToken as any).mockReturnValue("old-refresh-token");
      (apiClient.post as any).mockRejectedValue(new Error("Invalid refresh token"));

      const { result } = renderHook(() => useAuthStore());

      // Mock logout to prevent side effects
      const logoutSpy = vi.spyOn(result.current, "logout").mockImplementation(async () => {});

      await expect(
        act(async () => {
          await result.current.refreshToken();
        })
      ).rejects.toThrow();

      expect(logoutSpy).toHaveBeenCalled();
    });
  });

  describe("checkAuth", () => {
    it("should return true for authenticated user", () => {
      (tokenManager.getAccessToken as any).mockReturnValue("valid-token");
      (tokenManager.isTokenExpired as any).mockReturnValue(false);

      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setUser({ id: "user-1" } as any);
      });

      const isAuthenticated = result.current.checkAuth();
      expect(isAuthenticated).toBe(true);
    });

    it("should return false and trigger refresh for expired token", () => {
      (tokenManager.getAccessToken as any).mockReturnValue("expired-token");
      (tokenManager.isTokenExpired as any).mockReturnValue(true);

      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setUser({ id: "user-1" } as any);
      });

      const refreshSpy = vi
        .spyOn(result.current, "refreshToken")
        .mockImplementation(async () => {});

      const isAuthenticated = result.current.checkAuth();
      expect(isAuthenticated).toBe(false);
      expect(refreshSpy).toHaveBeenCalled();
    });
  });

  describe("hasPermission", () => {
    it("should check and log permission access", () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setUser({ id: "user-1", role: "OWNER" } as any);
      });

      const hasPermission = result.current.hasPermission("bookings", "create");

      expect(hasPermission).toBe(true);
      expect(auditLogger.logAccess).toHaveBeenCalledWith(
        "bookings",
        "create",
        true,
        expect.any(Object)
      );
    });
  });

  describe("hasRole", () => {
    it("should correctly check user role", () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setUser({ id: "user-1", role: "MANAGER" } as any);
      });

      expect(result.current.hasRole("MANAGER")).toBe(true);
      expect(result.current.hasRole("OWNER")).toBe(false);
    });
  });
});
