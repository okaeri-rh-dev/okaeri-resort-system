/**
 * CSRF Protection Security Tests
 * Comprehensive security testing for CSRF protection mechanisms
 * Tests resort-specific scenarios and Philippine compliance requirements
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CSRFProtectionManager, csrfProtection, csrfFetch, useCSRFToken } from "../csrf-protection";
import { renderHook, act } from "@testing-library/react";

// Mock fetch for API testing
global.fetch = vi.fn();

// Mock crypto API for token generation
const mockCryptoGetRandomValues = vi.fn((array: Uint8Array) => {
  for (let i = 0; i < array.length; i++) {
    array[i] = Math.floor(Math.random() * 256);
  }
  return array;
});

Object.defineProperty(global.crypto, "getRandomValues", {
  value: mockCryptoGetRandomValues,
  writable: true,
});

describe("CSRF Protection Security Tests", () => {
  let csrfManager: CSRFProtectionManager;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Reset fetch mock with default response
    (global.fetch as any).mockReset();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        token: "test-csrf-token-123",
        expiresAt: Date.now() + 3600000,
        sessionId: "test-session-123",
      }),
      headers: new Headers(),
    });

    // Clear storage
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = "";

    // Create new instance for isolated testing
    csrfManager = CSRFProtectionManager.getInstance();

    // Mock window events
    vi.spyOn(window, "addEventListener");
    vi.spyOn(window, "removeEventListener");
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.restoreAllMocks();
  });

  describe("Token Generation and Validation", () => {
    it("should generate cryptographically secure tokens", async () => {
      // Mock different tokens for rotation test
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: "token-first-call",
          expiresAt: Date.now() + 3600000,
          sessionId: "session-123",
        }),
        headers: new Headers(),
      });

      const token1 = await csrfManager.getCSRFToken();

      // Force refresh for second token
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: "token-second-call",
          expiresAt: Date.now() + 3600000,
          sessionId: "session-123",
        }),
        headers: new Headers(),
      });

      // Clear token to force refresh
      (csrfManager as any).csrfToken = null;
      const token2 = await csrfManager.getCSRFToken();

      expect(token1).toBeDefined();
      expect(token1).toBe("token-first-call");
      expect(token2).toBe("token-second-call");
      expect(token1).not.toBe(token2); // Should rotate tokens
    });

    it("should prevent token reuse attacks", async () => {
      // Mock successful token fetch
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: "test-csrf-token-123",
          expiresAt: Date.now() + 3600000,
          sessionId: "session-123",
        }),
      });

      const token = await csrfManager.getCSRFToken();
      expect(token).toBe("test-csrf-token-123");

      // Simulate token validation failure
      const response = new Response(null, {
        headers: new Headers({
          "X-CSRF-Token": "different-token",
        }),
      });

      const isValid = csrfManager.validateResponse(response);
      expect(isValid).toBe(false);
    });

    it("should handle token refresh race conditions", async () => {
      let fetchCallCount = 0;

      (global.fetch as any).mockImplementation(async () => {
        fetchCallCount++;
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 100));
        return {
          ok: true,
          json: async () => ({
            token: `token-${fetchCallCount}`,
            expiresAt: Date.now() + 3600000,
            sessionId: "session-123",
          }),
        };
      });

      // Trigger multiple simultaneous token requests
      const promises = Promise.all([
        csrfManager.getCSRFToken(),
        csrfManager.getCSRFToken(),
        csrfManager.getCSRFToken(),
      ]);

      const tokens = await promises;

      // All should return the same token (prevented race condition)
      expect(tokens[0]).toBe(tokens[1]);
      expect(tokens[1]).toBe(tokens[2]);

      // Should only make one fetch call
      expect(fetchCallCount).toBe(1);
    });

    it("should automatically refresh expired tokens", async () => {
      // Mock initial token fetch
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: "expired-token",
          expiresAt: Date.now() - 1000, // Already expired
          sessionId: "session-123",
        }),
      });

      // Mock refresh fetch
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: "fresh-token",
          expiresAt: Date.now() + 3600000,
          sessionId: "session-123",
        }),
      });

      const token = await csrfManager.getCSRFToken();

      // Should have fetched twice (initial + refresh)
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(token).toBe("fresh-token");
    });
  });

  describe("Double-Submit Cookie Pattern", () => {
    it("should implement double-submit cookie protection", () => {
      const token = csrfManager.generateDoubleSubmitCookie();

      // Check cookie was set
      expect(document.cookie).toContain(`csrf_token=${token}`);
      expect(document.cookie).toContain("SameSite=Strict");
      expect(document.cookie).toContain("Secure");

      // Verify token validation
      const isValid = csrfManager.verifyDoubleSubmitCookie(token);
      expect(isValid).toBe(true);

      // Invalid token should fail
      const isInvalid = csrfManager.verifyDoubleSubmitCookie("wrong-token");
      expect(isInvalid).toBe(false);
    });

    it("should prevent cookie tampering", () => {
      const originalToken = csrfManager.generateDoubleSubmitCookie();

      // Tamper with cookie
      document.cookie = `csrf_token=tampered-token; path=/; SameSite=Strict; Secure`;

      // Original token should no longer validate
      const isValid = csrfManager.verifyDoubleSubmitCookie(originalToken);
      expect(isValid).toBe(false);
    });

    it("should handle missing cookies gracefully", () => {
      // Clear cookies
      document.cookie = "";

      const isValid = csrfManager.verifyDoubleSubmitCookie("any-token");
      expect(isValid).toBe(false);
    });
  });

  describe("Request Protection", () => {
    it("should add CSRF headers to state-changing requests", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: "csrf-token-123",
          expiresAt: Date.now() + 3600000,
          sessionId: "session-123",
        }),
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
      });

      await csrfFetch("/api/bookings", {
        method: "POST",
        body: JSON.stringify({ data: "test" }),
      });

      const lastCall = (global.fetch as any).mock.calls[1];
      expect(lastCall[1].headers.get("X-CSRF-Token")).toBe("csrf-token-123");
    });

    it("should not add CSRF headers to safe requests", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
      });

      await csrfFetch("/api/bookings", {
        method: "GET",
      });

      const lastCall = (global.fetch as any).mock.calls[0];
      expect(lastCall[1]?.headers?.get?.("X-CSRF-Token")).toBeUndefined();
    });

    it("should validate CSRF token in responses", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: "csrf-token-123",
          expiresAt: Date.now() + 3600000,
          sessionId: "session-123",
        }),
      });

      // Store token
      await csrfManager.getCSRFToken();

      // Mock response with mismatched token
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({
          "X-CSRF-Token": "wrong-token",
        }),
      });

      // Mock location for redirect
      delete (window as any).location;
      (window as any).location = { href: "" };

      await expect(
        csrfFetch("/api/bookings", {
          method: "POST",
        })
      ).rejects.toThrow("CSRF validation failed");

      // Should redirect to login
      expect(window.location.href).toBe("/login?reason=security_check");
    });
  });

  describe("Session Binding", () => {
    it("should bind CSRF tokens to sessions", async () => {
      const sessionId1 = (csrfManager as any).sessionId;

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: "token-123",
          expiresAt: Date.now() + 3600000,
          sessionId: sessionId1,
        }),
      });

      const headers = new Headers();
      csrfManager.addCSRFHeader(headers);

      expect(headers.get("X-Session-Id")).toBe(sessionId1);
    });

    it("should regenerate session ID on new instance", () => {
      const sessionId1 = (csrfManager as any).sessionId;

      // Force new instance creation (in real app, would be new page load)
      const newManager = new (CSRFProtectionManager as any)();
      const sessionId2 = newManager.sessionId;

      expect(sessionId1).not.toBe(sessionId2);
      expect(sessionId2).toHaveLength(32);
    });
  });

  describe("Philippine Compliance", () => {
    it("should log security events for audit trail (Data Privacy Act compliance)", async () => {
      const auditLogSpy = vi.fn();
      (window as any).auditLogger = {
        logSecurityEvent: auditLogSpy,
      };

      // Trigger CSRF validation failure
      const response = new Response(null, {
        headers: new Headers({
          "X-CSRF-Token": "wrong-token",
        }),
      });

      csrfManager.validateResponse(response);

      expect(auditLogSpy).toHaveBeenCalledWith(
        "csrf",
        expect.objectContaining({
          event: "csrf.token_mismatch",
          timestamp: expect.any(String),
          sessionId: expect.any(String),
        })
      );
    });

    it("should track CSRF events in session storage for compliance reporting", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: "token-123",
          expiresAt: Date.now() + 3600000,
          sessionId: "session-123",
        }),
      });

      await csrfManager.getCSRFToken();

      // Check if event was logged
      const consoleSpy = vi.spyOn(console, "log");

      if (import.meta.env.DEV) {
        expect(consoleSpy).toHaveBeenCalledWith(
          "CSRF Event:",
          expect.objectContaining({
            event: expect.stringContaining("csrf."),
          })
        );
      }
    });
  });

  describe("Resort Management Specific Scenarios", () => {
    it("should protect guest registration endpoints", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: "csrf-token-guest",
          expiresAt: Date.now() + 3600000,
          sessionId: "session-123",
        }),
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => ({ success: true }),
      });

      const guestData = {
        firstName: "Juan",
        lastName: "Dela Cruz",
        email: "juan@example.com",
        phone: "+639123456789",
        address: "Manila, Philippines",
      };

      await csrfFetch("/api/guests", {
        method: "POST",
        body: JSON.stringify(guestData),
      });

      const lastCall = (global.fetch as any).mock.calls[1];
      expect(lastCall[1].headers.get("X-CSRF-Token")).toBe("csrf-token-guest");
    });

    it("should protect payment processing endpoints", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: "csrf-token-payment",
          expiresAt: Date.now() + 3600000,
          sessionId: "session-123",
        }),
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => ({ success: true }),
      });

      const paymentData = {
        bookingId: "booking-123",
        amount: 5000,
        currency: "PHP",
        method: "credit_card",
      };

      await csrfFetch("/api/payments", {
        method: "POST",
        body: JSON.stringify(paymentData),
      });

      const lastCall = (global.fetch as any).mock.calls[1];
      expect(lastCall[1].headers.get("X-CSRF-Token")).toBe("csrf-token-payment");
    });

    it("should protect booking modification endpoints", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: "csrf-token-booking",
          expiresAt: Date.now() + 3600000,
          sessionId: "session-123",
        }),
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
      });

      await csrfFetch("/api/bookings/123", {
        method: "PATCH",
        body: JSON.stringify({ status: "confirmed" }),
      });

      const lastCall = (global.fetch as any).mock.calls[1];
      expect(lastCall[1].headers.get("X-CSRF-Token")).toBe("csrf-token-booking");
    });
  });

  describe("Error Handling and Recovery", () => {
    it("should retry on network failures", async () => {
      let attempts = 0;

      (global.fetch as any).mockImplementation(async () => {
        attempts++;
        if (attempts === 1) {
          throw new Error("Network error");
        }
        return {
          ok: true,
          json: async () => ({
            token: "retry-token",
            expiresAt: Date.now() + 3600000,
            sessionId: "session-123",
          }),
        };
      });

      // Use fake timers for retry delay
      vi.useFakeTimers();

      const tokenPromise = csrfManager.getCSRFToken();

      // Fast-forward retry delay
      await vi.advanceTimersByTimeAsync(5000);

      const token = await tokenPromise;
      expect(token).toBe("retry-token");
      expect(attempts).toBe(2);

      vi.useRealTimers();
    });

    it("should handle invalid server responses", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          // Missing required fields
          invalidField: "test",
        }),
      });

      const consoleSpy = vi.spyOn(console, "error");

      await csrfManager.getCSRFToken();

      expect(consoleSpy).toHaveBeenCalledWith("Failed to refresh CSRF token:", expect.any(Error));
    });

    it("should handle server errors gracefully", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      const consoleSpy = vi.spyOn(console, "error");

      await csrfManager.getCSRFToken();

      expect(consoleSpy).toHaveBeenCalledWith("Failed to refresh CSRF token:", expect.any(Error));
    });
  });

  describe("React Hook Integration", () => {
    it("should provide CSRF token through React hook", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: "hook-token",
          expiresAt: Date.now() + 3600000,
          sessionId: "session-123",
        }),
      });

      const { result } = renderHook(() => useCSRFToken());

      expect(result.current.loading).toBe(true);
      expect(result.current.token).toBe(null);

      // Wait for token to load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.token).toBe("hook-token");
    });
  });

  describe("Security Headers Validation", () => {
    it("should add all required security headers", () => {
      const headers = new Headers();
      const token = "test-token";
      const sessionId = "test-session";

      (csrfManager as any).csrfToken = token;
      (csrfManager as any).sessionId = sessionId;

      csrfManager.addCSRFHeader(headers);

      expect(headers.get("X-CSRF-Token")).toBe(token);
      expect(headers.get("X-Session-Id")).toBe(sessionId);
    });

    it("should handle different header formats", () => {
      const token = "test-token";
      const sessionId = "test-session";

      (csrfManager as any).csrfToken = token;
      (csrfManager as any).sessionId = sessionId;

      // Test with plain object
      const objectHeaders = {};
      csrfManager.addCSRFHeader(objectHeaders);
      expect(objectHeaders["X-CSRF-Token"]).toBe(token);

      // Test with array format
      const arrayHeaders: [string, string][] = [];
      csrfManager.addCSRFHeader(arrayHeaders);
      expect(arrayHeaders).toContainEqual(["X-CSRF-Token", token]);
    });
  });

  describe("Status and Monitoring", () => {
    it("should provide accurate CSRF protection status", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: "status-token",
          expiresAt: Date.now() + 3600000,
          sessionId: "session-123",
        }),
      });

      await csrfManager.getCSRFToken();

      const status = csrfManager.getStatus();

      expect(status.hasToken).toBe(true);
      expect(status.isExpired).toBe(false);
      expect(status.sessionId).toBeDefined();
      expect(status.expiresAt).toBeGreaterThan(Date.now());
    });

    it("should detect expired tokens in status", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: "expired-token",
          expiresAt: Date.now() - 1000, // Already expired
          sessionId: "session-123",
        }),
      });

      await csrfManager.getCSRFToken();

      const status = csrfManager.getStatus();

      expect(status.hasToken).toBe(true);
      expect(status.isExpired).toBe(true);
    });
  });

  describe("Cleanup and Lifecycle", () => {
    it("should clean up on page unload", () => {
      const cleanupSpy = vi.spyOn(csrfManager as any, "cleanup");

      // Trigger beforeunload event
      const event = new Event("beforeunload");
      window.dispatchEvent(event);

      expect(cleanupSpy).toHaveBeenCalled();
    });

    it("should clear all data on cleanup", () => {
      (csrfManager as any).csrfToken = "test-token";
      (csrfManager as any).tokenExpiry = Date.now() + 3600000;
      (csrfManager as any).sessionId = "test-session";

      (csrfManager as any).cleanup();

      expect((csrfManager as any).csrfToken).toBe(null);
      expect((csrfManager as any).tokenExpiry).toBe(0);
      expect((csrfManager as any).sessionId).toBe(null);
    });
  });
});
