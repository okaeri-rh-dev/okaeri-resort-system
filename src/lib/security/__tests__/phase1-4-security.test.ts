/**
 * Phase 1.4 Security Implementation Tests
 * Tests basic security hardening features
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { basicSecurityChecker } from "../phase1-4-checklist";
import { simpleRateLimiter } from "../simple-rate-limiter";
import { securityHeadersValidator } from "../security-headers";
import { basicAuditLogger } from "../basic-audit-logger";
import { basicTokenManager } from "../basic-token-manager";
import { basicOwaspValidator } from "../basic-owasp-validator";

describe("Phase 1.4 Security Implementation", () => {
  beforeEach(() => {
    // Clear any existing state
    simpleRateLimiter.clear();
    basicAuditLogger.clearAllEvents();
  });

  describe("Basic Security Checker", () => {
    it("should run security checklist", async () => {
      const result = await basicSecurityChecker.runSecurityCheck();

      expect(result).toHaveProperty("passed");
      expect(result).toHaveProperty("score");
      expect(result).toHaveProperty("issues");
      expect(result).toHaveProperty("recommendations");

      expect(typeof result.passed).toBe("boolean");
      expect(typeof result.score).toBe("number");
      expect(Array.isArray(result.issues)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it("should validate security measures", async () => {
      const checklist = await basicSecurityChecker.validateSecurityMeasures();

      expect(checklist).toHaveProperty("passwords");
      expect(checklist).toHaveProperty("tokens");
      expect(checklist).toHaveProperty("validation");
      expect(checklist).toHaveProperty("rateLimit");
      expect(checklist).toHaveProperty("headers");

      // Check that basic measures are in place
      expect(checklist.passwords.hashed).toBe(true);
      expect(checklist.validation.xssProtection).toBe(true);
      expect(checklist.validation.sqlInjection).toBe(true);
    });
  });

  describe("Simple Rate Limiter", () => {
    it("should allow initial login attempts", () => {
      const identifier = "test@example.com";
      const result = simpleRateLimiter.checkLoginAttempt(identifier);

      expect(result.allowed).toBe(true);
      expect(result.attemptsRemaining).toBe(4); // 5 max - 1 used
    });

    it("should block after max attempts", () => {
      const identifier = "blocked@example.com";

      // Use up all attempts
      for (let i = 0; i < 5; i++) {
        simpleRateLimiter.checkLoginAttempt(identifier);
      }

      // Next attempt should be blocked
      const result = simpleRateLimiter.checkLoginAttempt(identifier);
      expect(result.allowed).toBe(false);
      expect(result.attemptsRemaining).toBe(0);
      expect(result.blockedUntil).toBeDefined();
    });

    it("should reset attempts after successful login", () => {
      const identifier = "success@example.com";

      // Make some attempts
      simpleRateLimiter.checkLoginAttempt(identifier);
      simpleRateLimiter.checkLoginAttempt(identifier);

      let status = simpleRateLimiter.getStatus(identifier);
      expect(status.attemptsRemaining).toBe(3);

      // Successful login resets
      simpleRateLimiter.recordSuccessfulLogin(identifier);

      status = simpleRateLimiter.getStatus(identifier);
      expect(status.attemptsRemaining).toBe(5);
    });

    it("should provide accurate statistics", () => {
      simpleRateLimiter.checkLoginAttempt("user1@example.com");
      simpleRateLimiter.checkLoginAttempt("user2@example.com");

      const stats = simpleRateLimiter.getStats();
      expect(stats.totalTracked).toBeGreaterThanOrEqual(2);
      expect(stats.totalAttempts).toBeGreaterThanOrEqual(2);
      expect(stats.currentlyBlocked).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Security Headers Validator", () => {
    it("should validate basic headers", () => {
      const mockHeaders = {
        "content-security-policy": "default-src 'self'",
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
      };

      const result = securityHeadersValidator.validateHeaders(mockHeaders);

      expect(result).toHaveProperty("configured");
      expect(result).toHaveProperty("missing");
      expect(result).toHaveProperty("recommendations");
      expect(result).toHaveProperty("score");

      expect(Array.isArray(result.missing)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(typeof result.score).toBe("number");
    });

    it("should detect missing headers", () => {
      const mockHeaders = {}; // No headers

      const result = securityHeadersValidator.validateHeaders(mockHeaders);

      expect(result.configured).toBe(false);
      expect(result.missing.length).toBeGreaterThan(0);
      expect(result.score).toBeLessThan(100);
    });

    it("should generate Vercel headers configuration", () => {
      const config = securityHeadersValidator.generateVercelHeaders("production");

      expect(Array.isArray(config)).toBe(true);
      expect(config.length).toBeGreaterThan(0);
      expect(config[0]).toHaveProperty("source");
      expect(config[0]).toHaveProperty("headers");
      expect(Array.isArray(config[0].headers)).toBe(true);
    });
  });

  describe("Basic Audit Logger", () => {
    it("should log security events", () => {
      basicAuditLogger.logSecurityEvent("test_event", {
        level: "info",
        details: { test: "data" },
      });

      const events = basicAuditLogger.getRecentEvents(10);
      expect(events.length).toBeGreaterThan(0);

      const testEvent = events.find((e) => e.event === "test_event");
      expect(testEvent).toBeDefined();
      expect(testEvent?.level).toBe("info");
    });

    it("should log authentication events", () => {
      basicAuditLogger.logAuthEvent("login_attempt", {
        email: "test@example.com",
        success: false,
        reason: "invalid_password",
      });

      const events = basicAuditLogger.getEventsByType("login_attempt");
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].details?.email).toBe("test@example.com");
    });

    it("should provide event statistics", () => {
      basicAuditLogger.logSecurityEvent("test_event_1");
      basicAuditLogger.logSecurityEvent("test_event_2", { level: "error" });

      const stats = basicAuditLogger.getEventStatistics();

      expect(stats).toHaveProperty("totalEvents");
      expect(stats).toHaveProperty("eventCounts");
      expect(stats).toHaveProperty("recentActivity");
      expect(stats).toHaveProperty("errorRate");

      expect(stats.totalEvents).toBeGreaterThan(0);
      expect(typeof stats.errorRate).toBe("number");
    });
  });

  describe("Basic Token Manager", () => {
    it("should store and retrieve tokens", () => {
      const mockToken = `mock-token-${Date.now()}`;

      basicTokenManager.storeTokens(mockToken);
      const retrieved = basicTokenManager.getAccessToken();

      expect(retrieved).toBe(mockToken);
    });

    it("should validate token format", () => {
      const invalidToken = "invalid.token.format";

      expect(() => {
        basicTokenManager.storeTokens(invalidToken);
      }).toThrow();
    });

    it("should handle token expiry", () => {
      // Mock expired JWT token
      const expiredToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid";

      const validation = basicTokenManager.validateToken(expiredToken);
      expect(validation.valid).toBe(false);
    });

    it("should provide security status", () => {
      const status = basicTokenManager.getSecurityStatus();

      expect(status).toHaveProperty("hasToken");
      expect(status).toHaveProperty("tokenValid");
      expect(status).toHaveProperty("expiresIn");
      expect(status).toHaveProperty("refreshScheduled");

      expect(typeof status.hasToken).toBe("boolean");
      expect(typeof status.tokenValid).toBe("boolean");
      expect(typeof status.expiresIn).toBe("number");
      expect(typeof status.refreshScheduled).toBe("boolean");
    });
  });

  describe("Basic OWASP Validator", () => {
    it("should run OWASP assessment", async () => {
      const assessment = await basicOwaspValidator.runOwaspAssessment();

      expect(assessment).toHaveProperty("overallScore");
      expect(assessment).toHaveProperty("compliantCategories");
      expect(assessment).toHaveProperty("totalCategories");
      expect(assessment).toHaveProperty("categories");
      expect(assessment).toHaveProperty("summary");

      expect(typeof assessment.overallScore).toBe("number");
      expect(typeof assessment.compliantCategories).toBe("number");
      expect(typeof assessment.totalCategories).toBe("number");
      expect(Array.isArray(assessment.categories)).toBe(true);
      expect(typeof assessment.summary).toBe("string");
    });

    it("should validate applicable OWASP categories", async () => {
      const assessment = await basicOwaspValidator.runOwaspAssessment();

      const applicableCategories = assessment.categories.filter((c) => c.applicable);
      expect(applicableCategories.length).toBeGreaterThan(0);

      // Should have authentication-related categories
      const authCategory = assessment.categories.find((c) => c.category === "A07");
      expect(authCategory).toBeDefined();
      expect(authCategory?.title).toContain("Authentication");
    });

    it("should generate OWASP report", async () => {
      const assessment = await basicOwaspValidator.runOwaspAssessment();
      const report = basicOwaspValidator.generateOwaspReport(assessment);

      expect(typeof report).toBe("string");
      expect(report).toContain("OWASP Top 10 2021 Compliance Report");
      expect(report).toContain("Overall Score");
      expect(report.length).toBeGreaterThan(100);
    });
  });

  describe("Integration Tests", () => {
    it("should integrate rate limiting with audit logging", () => {
      const identifier = "integration@example.com";

      // Make login attempts that trigger rate limiting
      for (let i = 0; i < 6; i++) {
        const result = simpleRateLimiter.checkLoginAttempt(identifier);

        if (!result.allowed) {
          basicAuditLogger.logRateLimitEvent("blocked", identifier, {
            attemptsRemaining: result.attemptsRemaining,
            blockedUntil: result.blockedUntil,
          });
        }
      }

      const rateLimitEvents = basicAuditLogger.getEventsByType("rate_limit_blocked");
      expect(rateLimitEvents.length).toBeGreaterThan(0);
    });

    it("should integrate token management with audit logging", () => {
      const mockToken = `mock-integration-token-${Date.now()}`;

      basicTokenManager.storeTokens(mockToken);

      const tokenEvents = basicAuditLogger.getEventsByType("tokens_stored");
      expect(tokenEvents.length).toBeGreaterThan(0);
    });

    it("should maintain security score across components", async () => {
      // Run all security checks
      const securityCheck = await basicSecurityChecker.runSecurityCheck();
      const owaspAssessment = await basicOwaspValidator.runOwaspAssessment();

      // Both should indicate reasonable security levels
      expect(securityCheck.score).toBeGreaterThan(60); // Minimum acceptable
      expect(owaspAssessment.overallScore).toBeGreaterThan(60);

      // If one is significantly better, investigate discrepancies
      const scoreDifference = Math.abs(securityCheck.score - owaspAssessment.overallScore);
      expect(scoreDifference).toBeLessThan(30); // Scores should be relatively consistent
    });
  });
});
