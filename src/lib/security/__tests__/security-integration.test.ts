/**
 * Security Integration Tests
 * Comprehensive tests for all security utilities working together
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  tokenManager,
  secureTokenManager,
  sessionMonitor,
  auditLogger,
  rateLimiter,
  permissionGuard,
  csrfProtection,
} from "../index";
import { TOKEN_EXPIRY, RATE_LIMITS, AUDIT_EVENTS, SESSION_CONFIG } from "../constants";
import { MOCK_USERS, TEST_CONSTANTS } from "@tests/utils/test-utils";

// Mock crypto for token tests
Object.defineProperty(global.crypto, "randomUUID", {
  value: () => "test-uuid-123",
  writable: true,
});

Object.defineProperty(global.crypto, "subtle", {
  value: {
    digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    sign: vi.fn().mockResolvedValue(new ArrayBuffer(64)),
    verify: vi.fn().mockResolvedValue(true),
  },
  writable: true,
});

describe("Security Integration Tests", () => {
  beforeEach(() => {
    // Reset all security modules
    vi.clearAllMocks();

    // Reset localStorage and sessionStorage
    localStorage.clear();
    sessionStorage.clear();

    // Reset timers
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Token Manager Integration", () => {
    it("should handle complete token lifecycle with validation", async () => {
      const accessToken = TEST_CONSTANTS.MOCK_TOKEN;
      const refreshToken = TEST_CONSTANTS.MOCK_REFRESH_TOKEN;

      // Store tokens
      tokenManager.storeTokens(accessToken, refreshToken);

      // Verify storage
      expect(tokenManager.getAccessToken()).toBe(accessToken);
      expect(tokenManager.getRefreshToken()).toBe(refreshToken);

      // Validate token structure
      const validation = tokenManager.validateTokenStructure(accessToken);
      expect(validation.valid).toBe(true);

      // Check expiration
      const isExpired = tokenManager.isTokenExpired(accessToken, 0);
      expect(typeof isExpired).toBe("boolean");

      // Clear tokens
      tokenManager.clearTokens();
      expect(tokenManager.getAccessToken()).toBe(null);
      expect(tokenManager.getRefreshToken()).toBe(null);
    });

    it("should handle secure token manager with enhanced security", async () => {
      const accessToken = TEST_CONSTANTS.MOCK_TOKEN;
      const refreshToken = TEST_CONSTANTS.MOCK_REFRESH_TOKEN;

      // Store tokens securely
      secureTokenManager.storeTokens(accessToken, refreshToken);

      // Verify secure storage (should not be in localStorage)
      expect(localStorage.getItem("auth_token")).toBe(null);
      expect(sessionStorage.getItem("auth_token")).toBe(null);

      // Get tokens from secure storage
      expect(secureTokenManager.getAccessToken()).toBe(accessToken);
      expect(secureTokenManager.getRefreshToken()).toBe(refreshToken);

      // Validate token with security checks
      const validation = secureTokenManager.validateTokenStructure(accessToken);
      expect(validation.valid).toBe(true);

      // Test token refresh callback
      let refreshCalled = false;
      const unsubscribe = secureTokenManager.onTokenRefresh(() => {
        refreshCalled = true;
      });

      // Simulate token refresh
      secureTokenManager.storeTokens("new-token", "new-refresh-token");
      expect(refreshCalled).toBe(false); // Should not trigger for manual storage

      unsubscribe();

      // Clear secure tokens
      secureTokenManager.clearTokens();
      expect(secureTokenManager.getAccessToken()).toBe(null);
    });

    it("should detect and handle invalid tokens", () => {
      const invalidTokens = [
        "invalid.token",
        "not-a-token",
        "",
        null,
        undefined,
        "header.payload", // missing signature
        "header.payload.signature.extra", // too many parts
      ];

      invalidTokens.forEach((token) => {
        const validation = tokenManager.validateTokenStructure(token as any);
        expect(validation.valid).toBe(false);
        expect(validation.error).toBeDefined();
      });
    });

    it("should handle token expiration scenarios", () => {
      // Create expired token (past exp claim)
      const expiredPayload = {
        sub: "user-123",
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      };
      const expiredToken = `header.${btoa(JSON.stringify(expiredPayload))}.signature`;

      expect(tokenManager.isTokenExpired(expiredToken, 0)).toBe(true);
      expect(tokenManager.isTokenExpired(expiredToken, 3600)).toBe(true); // Still expired even with buffer

      // Create valid token
      const validPayload = {
        sub: "user-123",
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      };
      const validToken = `header.${btoa(JSON.stringify(validPayload))}.signature`;

      expect(tokenManager.isTokenExpired(validToken, 0)).toBe(false);
      expect(tokenManager.isTokenExpired(validToken, 60)).toBe(false); // Not expired with 60s buffer
    });
  });

  describe("Session Monitor Integration", () => {
    it("should start and manage session with timeout", () => {
      const onTimeout = vi.fn();
      const onWarning = vi.fn();

      const config = {
        timeout: SESSION_CONFIG.TIMEOUT,
        warningTime: SESSION_CONFIG.WARNING,
        onTimeout,
        onWarning,
      };

      // Start session monitoring
      sessionMonitor.start(config);

      // Fast-forward to warning time
      vi.advanceTimersByTime(SESSION_CONFIG.TIMEOUT - SESSION_CONFIG.WARNING);
      expect(onWarning).toHaveBeenCalledWith(SESSION_CONFIG.WARNING);

      // Fast-forward to timeout
      vi.advanceTimersByTime(SESSION_CONFIG.WARNING);
      expect(onTimeout).toHaveBeenCalled();
    });

    it("should extend session and reset timers", () => {
      const onTimeout = vi.fn();
      const onWarning = vi.fn();

      sessionMonitor.start({
        timeout: 10000,
        warningTime: 2000,
        onTimeout,
        onWarning,
      });

      // Advance halfway to warning
      vi.advanceTimersByTime(4000);
      expect(onWarning).not.toHaveBeenCalled();

      // Extend session
      sessionMonitor.extendSession();

      // Advance to where warning would have been
      vi.advanceTimersByTime(4000);
      expect(onWarning).not.toHaveBeenCalled();

      // Advance to new warning time
      vi.advanceTimersByTime(2000);
      expect(onWarning).toHaveBeenCalled();
    });

    it("should stop session monitoring cleanly", () => {
      const onTimeout = vi.fn();

      sessionMonitor.start({
        timeout: 5000,
        warningTime: 1000,
        onTimeout,
        onWarning: vi.fn(),
      });

      // Stop monitoring
      sessionMonitor.stop();

      // Advance past timeout
      vi.advanceTimersByTime(10000);
      expect(onTimeout).not.toHaveBeenCalled();
    });
  });

  describe("Rate Limiter Integration", () => {
    it("should enforce rate limits with different keys", () => {
      const email1 = "user1@test.com";
      const email2 = "user2@test.com";
      const maxAttempts = 3;
      const window = 60000; // 1 minute

      // First user - should allow initial attempts
      for (let i = 0; i < maxAttempts; i++) {
        const result = rateLimiter.check("login", {
          max: maxAttempts,
          window,
          identifier: email1,
        });
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(maxAttempts - i - 1);
      }

      // First user - should block after limit
      const blockedResult = rateLimiter.check("login", {
        max: maxAttempts,
        window,
        identifier: email1,
      });
      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.retryAfter).toBeGreaterThan(0);

      // Second user - should still be allowed
      const secondUserResult = rateLimiter.check("login", {
        max: maxAttempts,
        window,
        identifier: email2,
      });
      expect(secondUserResult.allowed).toBe(true);
    });

    it("should track success and failure correctly", () => {
      const identifier = "test@example.com";

      // Consume some attempts
      rateLimiter.check("login", {
        max: 5,
        window: 60000,
        identifier,
      });

      // Track failure - should increment failure count
      rateLimiter.trackFailure("login");

      // Track success - should reset or improve standing
      rateLimiter.trackSuccess("login");

      // Should still be able to make requests
      const result = rateLimiter.check("login", {
        max: 5,
        window: 60000,
        identifier,
      });
      expect(result.allowed).toBe(true);
    });

    it("should reset rate limit after time window", () => {
      const identifier = "reset-test@example.com";
      const maxAttempts = 2;
      const window = 10000; // 10 seconds

      // Consume all attempts
      for (let i = 0; i < maxAttempts; i++) {
        rateLimiter.check("test-action", {
          max: maxAttempts,
          window,
          identifier,
        });
      }

      // Should be blocked
      const blockedResult = rateLimiter.check("test-action", {
        max: maxAttempts,
        window,
        identifier,
      });
      expect(blockedResult.allowed).toBe(false);

      // Fast-forward past window
      vi.advanceTimersByTime(window + 1000);

      // Should be allowed again
      const allowedResult = rateLimiter.check("test-action", {
        max: maxAttempts,
        window,
        identifier,
      });
      expect(allowedResult.allowed).toBe(true);
    });
  });

  describe("Permission Guard Integration", () => {
    it("should check permissions for different user roles", () => {
      const ownerUser = MOCK_USERS.OWNER;
      const managerUser = MOCK_USERS.MANAGER;
      const staffUser = MOCK_USERS.STAFF;

      // Owner permissions - should have access to everything
      const ownerBookingPermission = permissionGuard.hasPermission(ownerUser, {
        resource: "bookings",
        action: "create",
      });
      expect(ownerBookingPermission.allowed).toBe(true);

      const ownerAdminPermission = permissionGuard.hasPermission(ownerUser, {
        resource: "admin",
        action: "delete",
      });
      expect(ownerAdminPermission.allowed).toBe(true);

      // Manager permissions - should have limited access
      const managerBookingPermission = permissionGuard.hasPermission(managerUser, {
        resource: "bookings",
        action: "create",
      });
      expect(managerBookingPermission.allowed).toBe(true);

      // Staff permissions - should have basic access only
      const staffBookingPermission = permissionGuard.hasPermission(staffUser, {
        resource: "bookings",
        action: "read",
      });
      expect(staffBookingPermission.allowed).toBe(true);
    });

    it("should deny access for insufficient permissions", () => {
      const staffUser = MOCK_USERS.STAFF;

      // Staff trying to delete - should be denied
      const deletePermission = permissionGuard.hasPermission(staffUser, {
        resource: "bookings",
        action: "delete",
      });
      expect(deletePermission.allowed).toBe(false);
      expect(deletePermission.reason).toBeDefined();

      // Staff trying admin actions - should be denied
      const adminPermission = permissionGuard.hasPermission(staffUser, {
        resource: "admin",
        action: "read",
      });
      expect(adminPermission.allowed).toBe(false);
    });

    it("should handle null/undefined user", () => {
      const nullUserPermission = permissionGuard.hasPermission(null, {
        resource: "bookings",
        action: "read",
      });
      expect(nullUserPermission.allowed).toBe(false);
      expect(nullUserPermission.reason).toContain("No user provided");

      const undefinedUserPermission = permissionGuard.hasPermission(undefined as any, {
        resource: "bookings",
        action: "read",
      });
      expect(undefinedUserPermission.allowed).toBe(false);
    });
  });

  describe("Audit Logger Integration", () => {
    it("should log authentication events with proper context", () => {
      const mockUser = MOCK_USERS.OWNER;
      const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});

      // Log successful login
      auditLogger.logAuth("login", mockUser, true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[AUDIT] AUTH_LOGIN:"),
        expect.objectContaining({
          event: "login",
          success: true,
          userId: mockUser.id,
          userEmail: mockUser.email,
        })
      );

      // Log failed login
      auditLogger.logAuth("login", null, false, { reason: "invalid_credentials" });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[AUDIT] AUTH_LOGIN:"),
        expect.objectContaining({
          event: "login",
          success: false,
          userId: null,
          details: { reason: "invalid_credentials" },
        })
      );

      consoleSpy.mockRestore();
    });

    it("should log data operations with full context", () => {
      const mockUser = MOCK_USERS.MANAGER;
      const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});

      auditLogger.logDataOperation("create", "booking", "booking-123", mockUser);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[AUDIT] DATA_CREATE:"),
        expect.objectContaining({
          event: "DATA_CREATE",
          resource: "booking",
          resourceId: "booking-123",
          userId: mockUser.id,
          userEmail: mockUser.email,
        })
      );

      consoleSpy.mockRestore();
    });

    it("should log access attempts with permission results", () => {
      const mockUser = MOCK_USERS.STAFF;
      const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});

      auditLogger.logAccess("admin", "delete", false, mockUser);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[AUDIT] ACCESS:"),
        expect.objectContaining({
          event: "ACCESS",
          resource: "admin",
          action: "delete",
          allowed: false,
          userId: mockUser.id,
        })
      );

      consoleSpy.mockRestore();
    });

    it("should log generic events with custom data", () => {
      const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});

      auditLogger.log("CUSTOM_EVENT", {
        customField: "customValue",
        userId: "user-123",
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[AUDIT] CUSTOM_EVENT:"),
        expect.objectContaining({
          event: "CUSTOM_EVENT",
          customField: "customValue",
          userId: "user-123",
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe("CSRF Protection Integration", () => {
    beforeEach(() => {
      // Mock DOM methods for CSRF tests
      document.querySelector = vi.fn();
      document.createElement = vi.fn().mockReturnValue({
        setAttribute: vi.fn(),
        getAttribute: vi.fn(),
      });
      document.head = {
        appendChild: vi.fn(),
        querySelector: vi.fn(),
      } as any;
    });

    it("should generate and validate CSRF tokens", () => {
      const token = csrfProtection.generateToken();
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(0);

      const isValid = csrfProtection.validateToken(token);
      expect(isValid).toBe(true);
    });

    it("should reject invalid CSRF tokens", () => {
      const validToken = csrfProtection.generateToken();

      // Invalid tokens
      expect(csrfProtection.validateToken("invalid-token")).toBe(false);
      expect(csrfProtection.validateToken("")).toBe(false);
      expect(csrfProtection.validateToken(null as any)).toBe(false);
      expect(csrfProtection.validateToken(undefined as any)).toBe(false);

      // Valid token should still work
      expect(csrfProtection.validateToken(validToken)).toBe(true);
    });

    it("should set and get CSRF token from meta tag", () => {
      const mockElement = {
        getAttribute: vi.fn().mockReturnValue("meta-token-123"),
        setAttribute: vi.fn(),
      };

      (document.querySelector as any).mockReturnValue(mockElement);

      csrfProtection.setTokenInMeta("new-token-456");
      expect(mockElement.setAttribute).toHaveBeenCalledWith("content", "new-token-456");

      const token = csrfProtection.getTokenFromMeta();
      expect(token).toBe("meta-token-123");
    });
  });

  describe("Cross-Module Integration Scenarios", () => {
    it("should handle complete login flow with all security features", () => {
      const mockUser = MOCK_USERS.OWNER;
      const { email } = mockUser;

      // Check rate limiting first
      const rateLimitResult = rateLimiter.check("login", {
        max: RATE_LIMITS.LOGIN_ATTEMPTS.MAX,
        window: RATE_LIMITS.LOGIN_ATTEMPTS.WINDOW,
        identifier: email,
      });
      expect(rateLimitResult.allowed).toBe(true);

      // Store tokens after successful login
      const accessToken = TEST_CONSTANTS.MOCK_TOKEN;
      const refreshToken = TEST_CONSTANTS.MOCK_REFRESH_TOKEN;
      secureTokenManager.storeTokens(accessToken, refreshToken);

      // Start session monitoring
      const onTimeout = vi.fn();
      sessionMonitor.start({
        timeout: TOKEN_EXPIRY.SESSION_TIMEOUT,
        warningTime: TOKEN_EXPIRY.SESSION_WARNING,
        onTimeout,
      });

      // Check permissions
      const hasPermission = permissionGuard.hasPermission(mockUser, {
        resource: "dashboard",
        action: "read",
      });
      expect(hasPermission.allowed).toBe(true);

      // Log the successful login
      const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      auditLogger.logAuth("login", mockUser, true);
      auditLogger.logAccess("dashboard", "read", true, mockUser);

      // Track successful login for rate limiter
      rateLimiter.trackSuccess("login");

      // Verify everything is working together
      expect(secureTokenManager.getAccessToken()).toBe(accessToken);
      expect(consoleSpy).toHaveBeenCalledTimes(2); // login + access log

      consoleSpy.mockRestore();
    });

    it("should handle failed login with security measures", () => {
      const email = "attacker@malicious.com";

      // Simulate multiple failed attempts
      for (let i = 0; i < RATE_LIMITS.LOGIN_ATTEMPTS.MAX; i++) {
        const rateLimitResult = rateLimiter.check("login", {
          max: RATE_LIMITS.LOGIN_ATTEMPTS.MAX,
          window: RATE_LIMITS.LOGIN_ATTEMPTS.WINDOW,
          identifier: email,
        });

        if (rateLimitResult.allowed) {
          // Simulate failed login attempt
          rateLimiter.trackFailure("login");

          // Log failed attempt
          const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
          auditLogger.logAuth("login", null, false, {
            email,
            attempt: i + 1,
            reason: "invalid_credentials",
          });
          consoleSpy.mockRestore();
        }
      }

      // Next attempt should be rate limited
      const finalAttempt = rateLimiter.check("login", {
        max: RATE_LIMITS.LOGIN_ATTEMPTS.MAX,
        window: RATE_LIMITS.LOGIN_ATTEMPTS.WINDOW,
        identifier: email,
      });

      expect(finalAttempt.allowed).toBe(false);
      expect(finalAttempt.retryAfter).toBeGreaterThan(0);

      // Log rate limit hit
      const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      auditLogger.logAuth("login", null, false, {
        email,
        reason: "rate_limit_exceeded",
        retryAfter: finalAttempt.retryAfter,
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should handle token refresh scenario with security validation", () => {
      const mockUser = MOCK_USERS.MANAGER;

      // Store initial tokens
      const oldAccessToken = "old-access-token";
      const refreshToken = TEST_CONSTANTS.MOCK_REFRESH_TOKEN;
      secureTokenManager.storeTokens(oldAccessToken, refreshToken);

      // Simulate token expiration
      const expiredPayload = {
        sub: mockUser.id,
        exp: Math.floor(Date.now() / 1000) - 100, // Expired 100 seconds ago
      };
      const expiredToken = `header.${btoa(JSON.stringify(expiredPayload))}.signature`;

      expect(tokenManager.isTokenExpired(expiredToken, 0)).toBe(true);

      // Simulate successful token refresh
      const newAccessToken = TEST_CONSTANTS.MOCK_TOKEN;
      const newRefreshToken = "new-refresh-token";

      // Validate new token structure
      const validation = secureTokenManager.validateTokenStructure(newAccessToken);
      expect(validation.valid).toBe(true);

      // Store new tokens
      secureTokenManager.storeTokens(newAccessToken, newRefreshToken);

      // Extend session
      sessionMonitor.extendSession();

      // Log successful refresh
      const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      auditLogger.logAuth("refresh", mockUser, true);

      expect(secureTokenManager.getAccessToken()).toBe(newAccessToken);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should handle session timeout with proper cleanup", () => {
      const mockUser = MOCK_USERS.STAFF;
      let logoutCalled = false;

      // Store tokens and start session
      secureTokenManager.storeTokens(TEST_CONSTANTS.MOCK_TOKEN, TEST_CONSTANTS.MOCK_REFRESH_TOKEN);

      sessionMonitor.start({
        timeout: 5000, // 5 seconds
        warningTime: 1000, // 1 second warning
        onTimeout: () => {
          // Simulate logout on timeout
          logoutCalled = true;
          secureTokenManager.clearTokens();

          // Log session timeout
          const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
          auditLogger.logAuth("timeout", mockUser, true, {
            reason: "session_expired",
          });
          consoleSpy.mockRestore();
        },
        onWarning: (timeLeft) => {
          // Log session warning
          const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
          auditLogger.log("SESSION_WARNING", {
            userId: mockUser.id,
            timeLeft,
          });
          consoleSpy.mockRestore();
        },
      });

      // Fast-forward to warning
      vi.advanceTimersByTime(4000);

      // Fast-forward to timeout
      vi.advanceTimersByTime(1000);

      expect(logoutCalled).toBe(true);
      expect(secureTokenManager.getAccessToken()).toBe(null);
    });
  });

  describe("Security Constants Validation", () => {
    it("should have proper token expiry constants", () => {
      expect(TOKEN_EXPIRY.ACCESS_TOKEN).toBeGreaterThan(0);
      expect(TOKEN_EXPIRY.REFRESH_TOKEN).toBeGreaterThan(TOKEN_EXPIRY.ACCESS_TOKEN);
      expect(TOKEN_EXPIRY.SESSION_TIMEOUT).toBeGreaterThan(0);
      expect(TOKEN_EXPIRY.SESSION_WARNING).toBeGreaterThan(0);
      expect(TOKEN_EXPIRY.SESSION_WARNING).toBeLessThan(TOKEN_EXPIRY.SESSION_TIMEOUT);
    });

    it("should have proper rate limit constants", () => {
      expect(RATE_LIMITS.LOGIN_ATTEMPTS.MAX).toBeGreaterThan(0);
      expect(RATE_LIMITS.LOGIN_ATTEMPTS.WINDOW).toBeGreaterThan(0);
      expect(RATE_LIMITS.PASSWORD_RESET.MAX).toBeGreaterThan(0);
      expect(RATE_LIMITS.PASSWORD_RESET.WINDOW).toBeGreaterThan(0);
    });

    it("should have proper audit event constants", () => {
      expect(AUDIT_EVENTS.AUTH_LOGIN).toBeDefined();
      expect(AUDIT_EVENTS.AUTH_LOGOUT).toBeDefined();
      expect(AUDIT_EVENTS.AUTH_REFRESH).toBeDefined();
      expect(AUDIT_EVENTS.DATA_CREATE).toBeDefined();
      expect(AUDIT_EVENTS.DATA_UPDATE).toBeDefined();
      expect(AUDIT_EVENTS.DATA_DELETE).toBeDefined();
    });

    it("should have proper session config constants", () => {
      expect(SESSION_CONFIG.TIMEOUT).toBeGreaterThan(0);
      expect(SESSION_CONFIG.WARNING).toBeGreaterThan(0);
      expect(SESSION_CONFIG.WARNING).toBeLessThan(SESSION_CONFIG.TIMEOUT);
    });
  });
});
