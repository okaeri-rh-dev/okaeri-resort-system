/**
 * Authentication Security Test Suite
 * Tests authentication mechanisms implemented in Phase 1
 * Validates session management, route protection, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { auth } from "@/lib/auth";

// Mock Supabase client is already configured in setup.ts
const mockSupabase = {
  auth: {
    getSession: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn(),
    refreshSession: vi.fn(),
  },
};

// Mock window.location for redirect tests
const mockLocation = {
  href: "",
  replace: vi.fn(),
  reload: vi.fn(),
};

Object.defineProperty(window, "location", {
  value: mockLocation,
  writable: true,
});

describe("Authentication Security Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers(); // Reset timers first
    vi.useFakeTimers();
    mockLocation.href = "http://localhost:3000/dashboard";
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Session Refresh Security", () => {
    it("should use random refresh intervals between 45-55 minutes", () => {
      vi.useRealTimers(); // Reset timers before test
      const intervals: number[] = [];

      // Spy on setTimeout to capture intervals
      const setTimeoutSpy = vi.spyOn(global, "setTimeout");

      // Start multiple refresh cycles
      for (let i = 0; i < 10; i++) {
        auth.startSessionRefresh();

        // Get the last call to setTimeout
        const lastCall = setTimeoutSpy.mock.calls[setTimeoutSpy.mock.calls.length - 1];
        if (lastCall && typeof lastCall[1] === "number") {
          intervals.push(lastCall[1]);
        }

        auth.stopSessionRefresh();
      }

      // Verify intervals are randomized
      const uniqueIntervals = new Set(intervals);
      expect(uniqueIntervals.size).toBeGreaterThan(1); // Should have variation

      // Verify intervals are within expected range (45-55 minutes)
      intervals.forEach((interval) => {
        expect(interval).toBeGreaterThanOrEqual(45 * 60 * 1000);
        expect(interval).toBeLessThanOrEqual(55 * 60 * 1000);
      });

      setTimeoutSpy.mockRestore();
    });

    it("should clear timers on cleanup", () => {
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      auth.startSessionRefresh();
      auth.stopSessionRefresh();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it("should handle refresh errors gracefully", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const originalEnv = process.env.NODE_ENV;

      // Set to development mode to enable error logging
      process.env.NODE_ENV = "development";

      // Mock the supabase client directly for this test
      const mockSupabase = await import("@/lib/supabase");
      vi.mocked(mockSupabase.supabase.auth.refreshSession).mockRejectedValueOnce(
        new Error("Network error")
      );

      try {
        await auth.refreshSession();
      } catch (error) {
        // Expected to catch and log error
      }

      // Should log error in development mode
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Session refresh failed:"),
        expect.any(Error)
      );

      // Restore environment
      process.env.NODE_ENV = originalEnv;
      consoleErrorSpy.mockRestore();
    });
  });

  describe("Route Protection and Validation", () => {
    it("should validate routes from whitelist before redirect", () => {
      // Use exact routes from VALID_ROUTES in auth.ts
      const validRoutes = ["/login", "/dashboard", "/bookings", "/units", "/guests"];
      const invalidRoutes = [
        "javascript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "http://evil.com",
        "//evil.com",
        "../../../etc/passwd",
      ];

      // Test valid routes
      validRoutes.forEach((route) => {
        const isValid = auth.isValidRoute(route);
        expect(isValid).toBe(true);
      });

      // Test invalid routes
      invalidRoutes.forEach((route) => {
        const isValid = auth.isValidRoute(route);
        expect(isValid).toBe(false);
      });
    });

    it("should prevent open redirect vulnerabilities", () => {
      const maliciousRedirects = [
        "http://evil.com",
        "//evil.com",
        "\\\\evil.com",
        "javascript:alert(document.cookie)",
        "data:text/html,<script>alert(1)</script>",
      ];

      maliciousRedirects.forEach((redirect) => {
        auth.handleRedirect(redirect);

        // Should redirect to login instead of malicious URL
        expect(mockLocation.replace).toHaveBeenCalledWith("/login");
        mockLocation.replace.mockClear();
      });
    });

    it("should handle returnUrl parameter safely", () => {
      // Safe returnUrl
      const safeUrl = "/dashboard?tab=bookings";
      auth.handleRedirect(safeUrl);
      expect(mockLocation.replace).toHaveBeenCalledWith(safeUrl);

      mockLocation.replace.mockClear();

      // Unsafe returnUrl
      const unsafeUrl = "https://evil.com/phishing";
      auth.handleRedirect(unsafeUrl);
      expect(mockLocation.replace).toHaveBeenCalledWith("/login");
    });
  });

  describe("Session Cleanup and Data Protection", () => {
    it("should clear all sensitive data on logout", async () => {
      // Set various types of sensitive data
      localStorage.setItem("auth-token", "secret-token-123");
      localStorage.setItem("user-data", JSON.stringify({ id: "user-123" }));
      sessionStorage.setItem("session-id", "session-456");
      sessionStorage.setItem("temp-data", "sensitive");
      document.cookie = "auth_session=abc123; path=/";
      document.cookie = "remember_me=true; path=/";

      await auth.signOut();

      // Verify all storage cleared
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);

      // Cookies should be expired
      expect(document.cookie).not.toContain("auth_session=abc123");
      expect(document.cookie).not.toContain("remember_me=true");
    });

    it("should prevent back button access after logout", () => {
      // Mock browser history
      const pushStateSpy = vi.spyOn(window.history, "pushState");
      const replaceStateSpy = vi.spyOn(window.history, "replaceState");

      auth.preventBackButtonAccess();

      // Should manipulate history to prevent back button
      expect(pushStateSpy).toHaveBeenCalled();
      expect(replaceStateSpy).toHaveBeenCalled();

      pushStateSpy.mockRestore();
      replaceStateSpy.mockRestore();
    });

    it("should clear clipboard on sensitive operations", async () => {
      // Mock clipboard API with proper property descriptor
      const mockClipboard = {
        writeText: vi.fn().mockResolvedValue(undefined),
      };
      Object.defineProperty(navigator, "clipboard", {
        value: mockClipboard,
        writable: true,
        configurable: true,
      });

      await auth.clearSensitiveClipboard();

      expect(mockClipboard.writeText).toHaveBeenCalledWith("");
    });
  });

  describe("Error Message Sanitization", () => {
    it("should not leak user existence information", async () => {
      const errors = [
        { code: "auth/user-not-found", message: "User not found" },
        { code: "auth/wrong-password", message: "Invalid password" },
        { code: "auth/invalid-email", message: "Email not registered" },
      ];

      errors.forEach((error) => {
        const sanitized = auth.sanitizeAuthError(error);

        // Should return generic message
        expect(sanitized).toBe("Authentication failed. Please check your credentials.");
        expect(sanitized).not.toContain("not found");
        expect(sanitized).not.toContain("wrong");
        expect(sanitized).not.toContain("invalid");
        expect(sanitized).not.toContain("registered");
      });
    });

    it("should sanitize database error messages", () => {
      const dbErrors = [
        "SQLITE_ERROR: no such table: users",
        'PostgreSQL error: column "password_hash" does not exist',
        "Connection refused to database at 192.168.1.100:5432",
      ];

      dbErrors.forEach((error) => {
        const sanitized = auth.sanitizeAuthError({ message: error });

        // Should not expose internal details
        expect(sanitized).not.toContain("SQLITE");
        expect(sanitized).not.toContain("PostgreSQL");
        expect(sanitized).not.toContain("192.168");
        expect(sanitized).not.toContain("password_hash");
        expect(sanitized).not.toContain("table");
      });
    });

    it("should log detailed errors in development only", () => {
      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const originalEnv = process.env.NODE_ENV;

      // Test in production
      process.env.NODE_ENV = "production";
      auth.logAuthError(new Error("Sensitive error details"));
      expect(consoleLogSpy).not.toHaveBeenCalled();

      // Test in development
      process.env.NODE_ENV = "development";
      auth.logAuthError(new Error("Sensitive error details"));
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Auth Error:"),
        expect.any(Error)
      );

      process.env.NODE_ENV = originalEnv;
      consoleLogSpy.mockRestore();
    });
  });

  describe("Session Timeout and Expiry", () => {
    it("should handle session expiry correctly", async () => {
      const onExpiry = vi.fn();
      auth.onSessionExpired(onExpiry);

      // Simulate session expiry
      await auth.checkSessionExpiry();

      // Mock expired session
      mockSupabase.auth.getSession.mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });

      await auth.checkSessionExpiry();

      expect(onExpiry).toHaveBeenCalled();
      expect(mockLocation.replace).toHaveBeenCalledWith("/login");
    });

    it("should warn before session expires", async () => {
      const onWarning = vi.fn();
      auth.onSessionWarning(onWarning);

      // Set session to expire in 3 minutes (within warning threshold)
      const expiresAt = Math.floor((Date.now() + 3 * 60 * 1000) / 1000); // Convert to Unix timestamp

      // Mock the supabase client directly
      const mockSupabase = await import("@/lib/supabase");
      vi.mocked(mockSupabase.supabase.auth.getSession).mockResolvedValueOnce({
        data: {
          session: {
            expires_at: expiresAt,
            expires_in: 3600,
            token_type: "bearer" as const,
            access_token: "token",
            refresh_token: "refresh",
            user: {
              id: "test-user",
              email: "test@example.com",
              app_metadata: {},
              user_metadata: {},
              aud: "authenticated",
              created_at: new Date().toISOString(),
            },
          },
        },
        error: null,
      });

      await auth.checkSessionExpiry();

      // Warning should be triggered immediately since we're within 5 minutes of expiry
      expect(onWarning).toHaveBeenCalledWith(3);
    });
  });

  describe("CSRF Protection", () => {
    it("should generate and validate CSRF tokens", () => {
      const token = auth.generateCSRFToken();

      expect(token).toBeTruthy();
      expect(token.length).toBeGreaterThan(30);

      // Token should be stored
      expect(sessionStorage.getItem("csrf_token")).toBe(token);

      // Validation
      expect(auth.validateCSRFToken(token)).toBe(true);
      expect(auth.validateCSRFToken("invalid-token")).toBe(false);
    });

    it("should include CSRF token in API requests", () => {
      const token = auth.generateCSRFToken();
      const headers = auth.getSecureHeaders();

      expect(headers["X-CSRF-Token"]).toBe(token);
      expect(headers["Content-Type"]).toBe("application/json");
    });

    it("should reject requests with invalid CSRF tokens", () => {
      const isValid = auth.validateRequest({
        headers: {
          "X-CSRF-Token": "invalid-token",
        },
      });

      expect(isValid).toBe(false);
    });
  });

  describe("Rate Limiting", () => {
    it("should track failed login attempts", () => {
      const email = "test@example.com";

      // Simulate multiple failed attempts
      for (let i = 0; i < 5; i++) {
        auth.recordFailedAttempt(email);
      }

      const attempts = auth.getFailedAttempts(email);
      expect(attempts).toBe(5);
    });

    it("should block after too many failed attempts", () => {
      const email = "test@example.com";

      // Simulate 10 failed attempts (assuming limit is 5)
      for (let i = 0; i < 10; i++) {
        auth.recordFailedAttempt(email);
      }

      const isBlocked = auth.isAccountLocked(email);
      expect(isBlocked).toBe(true);
    });

    it("should reset failed attempts after successful login", () => {
      const email = "test@example.com";

      // Record failed attempts
      auth.recordFailedAttempt(email);
      auth.recordFailedAttempt(email);

      // Successful login should reset
      auth.resetFailedAttempts(email);

      const attempts = auth.getFailedAttempts(email);
      expect(attempts).toBe(0);
    });

    it("should expire lockouts after timeout period", () => {
      const email = "test@example.com";

      // Lock the account
      for (let i = 0; i < 10; i++) {
        auth.recordFailedAttempt(email);
      }

      expect(auth.isAccountLocked(email)).toBe(true);

      // Fast forward past lockout period (e.g., 30 minutes)
      vi.advanceTimersByTime(30 * 60 * 1000);

      expect(auth.isAccountLocked(email)).toBe(false);
    });
  });
});
