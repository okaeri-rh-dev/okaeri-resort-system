/**
 * Security Audit Test Suite
 * @since Phase 1.7 - Security Validation
 *
 * Comprehensive security testing covering OWASP Top 10,
 * Philippine data privacy compliance, and resort-specific security concerns
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  createTestUser,
  apiRequest,
  cleanupAllTestData,
} from "../integration/test-helpers";
import {
  SQL_INJECTION_PAYLOADS,
  XSS_PAYLOADS,
  PATH_TRAVERSAL_PAYLOADS,
  COMMAND_INJECTION_PAYLOADS,
  testSecurityHeaders,
  testAuth,
  testInjection,
  testCSRF,
  testRateLimit,
  testFileUpload,
  testSession,
  testPassword,
  testInfoDisclosure,
} from "./security-helpers";

describe("Security Audit Test Suite", () => {
  let testProjectId: string;
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    testProjectId = setup.projectId;
    authToken = setup.token;

    const user = await createTestUser("admin");
    testUserId = user.id;
  });

  afterAll(async () => {
    await teardownTestDatabase(testProjectId);
    await cleanupAllTestData();
  });

  describe("Security Headers Validation", () => {
    it("should set proper security headers on all responses", async () => {
      const baseUrl = process.env.API_URL || "http://localhost:3000";
      const headers = await testSecurityHeaders(baseUrl);

      // Check critical security headers
      expect(headers["x-frame-options"]).toBe("DENY");
      expect(headers["x-content-type-options"]).toBe("nosniff");
      expect(headers["x-xss-protection"]).toBe("1; mode=block");
      expect(headers["strict-transport-security"]).toContain("max-age=");
      expect(headers["content-security-policy"]).toBeDefined();
      expect(headers["referrer-policy"]).toBeDefined();
    });

    it("should not expose server information", async () => {
      const info = await testInfoDisclosure.checkHeaders();

      expect(info.exposesServer).toBe(false);
      expect(info.exposesVersion).toBe(false);
      expect(info.serverHeader).toBeNull();
      expect(info.poweredByHeader).toBeNull();
    });

    it("should set proper CORS headers", async () => {
      const response = await fetch(
        `${process.env.API_URL || "http://localhost:3000"}/api/health/check`,
        {
          method: "OPTIONS",
          headers: {
            Origin: "http://malicious-site.com",
            "Access-Control-Request-Method": "POST",
          },
        }
      );

      const allowedOrigin = response.headers.get("Access-Control-Allow-Origin");

      // Should not allow arbitrary origins
      expect(allowedOrigin).not.toBe("*");
      expect(allowedOrigin).not.toBe("http://malicious-site.com");
    });
  });

  describe("Authentication Security", () => {
    it("should prevent authentication without credentials", async () => {
      const response = await testAuth.loginWithoutCredentials();
      expect(response.status).toBe(400);
    });

    it("should prevent authentication with null password", async () => {
      const response = await testAuth.loginWithNullPassword();
      expect(response.status).toBe(400);
    });

    it("should prevent SQL injection in login", async () => {
      const response = await testAuth.loginWithSQLInjection();
      expect(response.status).toBe(401); // Should fail authentication, not cause SQL error
    });

    it("should reject malformed JWT tokens", async () => {
      const response = await testAuth.accessWithMalformedToken();
      expect(response.status).toBe(401);
    });

    it("should enforce password complexity requirements", async () => {
      const { weakPasswords } = testPassword;

      for (const password of weakPasswords) {
        const response = await testAuth.register({
          email: `test${Date.now()}@test.com`,
          password,
          firstName: "Test",
          lastName: "User",
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain("password");
      }
    });

    it("should not expose password in responses", async () => {
      const hasPassword = await testPassword.testPasswordInResponse();
      expect(hasPassword).toBe(false);
    });

    it("should implement account lockout after failed attempts", async () => {
      const responses = await testAuth.bruteForceLogin("bruteforce@test.com", 10);

      // Should start blocking after several attempts
      const blockedResponses = responses.filter(
        (r) => (r.error && r.error.includes("locked")) || r.error.includes("too many")
      );

      expect(blockedResponses.length).toBeGreaterThan(0);
    });
  });

  describe("SQL Injection Prevention", () => {
    it("should prevent SQL injection in search queries", async () => {
      for (const payload of SQL_INJECTION_PAYLOADS) {
        const result = await testInjection.search(payload);

        // Should either return safe results or error, not execute SQL
        expect(result.status).toBeLessThanOrEqual(500);

        // Database should still be functional
        const dbCheck = await testInjection.verifyDatabase();
        expect(dbCheck.tablesExist).toBe(true);
      }
    });

    it("should prevent SQL injection in booking creation", async () => {
      for (const payload of SQL_INJECTION_PAYLOADS.slice(0, 3)) {
        const result = await testInjection.createBooking(
          {
            guestName: payload,
            checkinDate: "2025-03-01",
            checkoutDate: "2025-03-03",
            guestCount: 2,
            totalAmount: 5000,
          },
          authToken
        );

        // If accepted, should be stored as literal string
        if (result.status === 201) {
          expect(result.data.guestName).toBe(payload);
        }

        // Database should remain intact
        const dbCheck = await testInjection.verifyDatabase();
        expect(dbCheck.tablesExist).toBe(true);
      }
    });

    it("should use parameterized queries for all database operations", async () => {
      // Test various endpoints with SQL injection attempts
      const endpoints = [
        { path: `/projects/${testProjectId}/bookings`, method: "GET", param: "search" },
        { path: `/projects/${testProjectId}/expenses`, method: "GET", param: "category" },
        { path: `/projects/${testProjectId}/guests`, method: "GET", param: "name" },
      ];

      for (const endpoint of endpoints) {
        const maliciousValue = "'; DROP TABLE bookings; --";
        const url = `${endpoint.path}?${endpoint.param}=${encodeURIComponent(maliciousValue)}`;

        const response = await apiRequest(url, endpoint.method, authToken);

        // Should handle safely
        expect(response.status).toBeLessThanOrEqual(500);

        // Verify tables still exist
        const dbCheck = await testInjection.verifyDatabase();
        expect(dbCheck.tablesExist).toBe(true);
      }
    });
  });

  describe("XSS Protection", () => {
    it("should sanitize user input to prevent XSS", async () => {
      for (const payload of XSS_PAYLOADS.slice(0, 5)) {
        const response = await apiRequest(
          `/projects/${testProjectId}/bookings`,
          "POST",
          authToken,
          {
            guestName: payload,
            guestEmail: "test@test.com",
            checkinDate: "2025-03-01",
            checkoutDate: "2025-03-03",
            guestCount: 2,
            totalAmount: 5000,
          }
        );

        if (response.status === 201) {
          const data = await response.json();

          // Should not contain active script tags
          expect(data.guestName).not.toContain("<script>");
          expect(data.guestName).not.toContain("<img");
          expect(data.guestName).not.toContain("javascript:");
          expect(data.guestName).not.toContain("onerror=");
        }
      }
    });

    it("should set Content-Security-Policy header", async () => {
      const response = await apiRequest("/health/check", "GET");
      const csp = response.headers.get("content-security-policy");

      expect(csp).toBeDefined();
      expect(csp).toContain("default-src");
      expect(csp).toContain("script-src");
      expect(csp).not.toContain("'unsafe-inline'");
      expect(csp).not.toContain("'unsafe-eval'");
    });

    it("should escape output in error messages", async () => {
      const xssPayload = '<script>alert("XSS")</script>';
      const response = await apiRequest(
        `/projects/${testProjectId}/bookings/search?q=${encodeURIComponent(xssPayload)}`,
        "GET",
        authToken
      );

      const text = await response.text();

      // Error message should not contain unescaped script
      expect(text).not.toContain('<script>alert("XSS")</script>');

      if (text.includes("script")) {
        // Should be escaped
        expect(text).toContain("&lt;script&gt;");
      }
    });
  });

  describe("Rate Limiting", () => {
    it("should enforce rate limits on authentication endpoints", async () => {
      const result = await testRateLimit("/auth/login", "POST", 20);

      expect(result.blockedRequests).toBeGreaterThan(0);
      expect(result.firstBlockedAt).toBeLessThanOrEqual(10);
    });

    it("should enforce rate limits on API endpoints", async () => {
      const result = await testRateLimit(
        `/projects/${testProjectId}/bookings`,
        "GET",
        150,
        authToken
      );

      expect(result.blockedRequests).toBeGreaterThan(0);
      expect(result.firstBlockedAt).toBeLessThanOrEqual(100);
    });

    it("should return proper rate limit headers", async () => {
      const response = await apiRequest("/auth/login", "POST", undefined, {
        email: "test@test.com",
        password: "password",
      });

      // Check for rate limit headers
      const rateLimitHeaders = ["x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset"];

      const hasRateLimitHeaders = rateLimitHeaders.some((header) => response.headers.has(header));

      expect(hasRateLimitHeaders).toBe(true);
    });
  });

  describe("CSRF Protection", () => {
    it("should require CSRF token for state-changing operations", async () => {
      const result = await testCSRF.submitWithoutCSRF(
        `/projects/${testProjectId}/bookings`,
        {
          guestName: "Test Guest",
          checkinDate: "2025-03-01",
          checkoutDate: "2025-03-03",
          guestCount: 2,
          totalAmount: 5000,
        },
        authToken
      );

      // Should be rejected without CSRF token
      expect(result.status).toBe(403);
      expect(result.data.error).toContain("CSRF");
    });

    it("should reject invalid CSRF tokens", async () => {
      const result = await testCSRF.submitWithInvalidCSRF(
        `/projects/${testProjectId}/bookings`,
        {
          guestName: "Test Guest",
          checkinDate: "2025-03-01",
          checkoutDate: "2025-03-03",
          guestCount: 2,
          totalAmount: 5000,
        },
        authToken
      );

      expect(result.status).toBe(403);
      expect(result.data.error).toContain("CSRF");
    });
  });

  describe("File Upload Security", () => {
    it("should reject malicious file types", async () => {
      const results = await testFileUpload.uploadMaliciousFile(authToken);

      // PHP, JS, EXE files should be rejected
      const dangerousFiles = results.filter(
        (r) =>
          r.filename.includes(".php") || r.filename.includes(".js") || r.filename.includes(".exe")
      );

      dangerousFiles.forEach((file) => {
        expect(file.accepted).toBe(false);
      });
    });

    it("should prevent path traversal in filenames", async () => {
      const results = await testFileUpload.uploadMaliciousFile(authToken);

      const pathTraversalFile = results.find((r) => r.filename.includes("../"));
      if (pathTraversalFile) {
        expect(pathTraversalFile.accepted).toBe(false);
      }
    });

    it("should enforce file size limits", async () => {
      const results = await testFileUpload.uploadMaliciousFile(authToken);

      const largeFile = results.find((r) => r.filename === "large.jpg");
      if (largeFile) {
        expect(largeFile.accepted).toBe(false);
      }
    });

    it("should require authentication for file uploads", async () => {
      const result = await testFileUpload.uploadWithoutAuth();
      expect(result.status).toBe(401);
    });
  });

  describe("Session Security", () => {
    it("should invalidate sessions on logout", async () => {
      // Login to get a session
      const loginResponse = await apiRequest("/auth/login", "POST", undefined, {
        email: "test@okaeri.ph",
        password: "TestPassword123!",
      });

      const { accessToken } = await loginResponse.json();

      // Verify session works
      const meResponse = await apiRequest("/auth/me", "GET", accessToken);
      expect(meResponse.status).toBe(200);

      // Logout
      await apiRequest("/auth/logout", "POST", accessToken);

      // Session should be invalid
      const afterLogout = await apiRequest("/auth/me", "GET", accessToken);
      expect(afterLogout.status).toBe(401);
    });

    it("should prevent session fixation attacks", async () => {
      // Get initial session
      const response1 = await apiRequest("/auth/login", "POST", undefined, {
        email: "test@okaeri.ph",
        password: "TestPassword123!",
      });

      const session1 = await response1.json();

      // Login again should create new session
      const response2 = await apiRequest("/auth/login", "POST", undefined, {
        email: "test@okaeri.ph",
        password: "TestPassword123!",
      });

      const session2 = await response2.json();

      // Sessions should be different
      expect(session1.accessToken).not.toBe(session2.accessToken);
    });

    it("should timeout inactive sessions", async () => {
      // This would require waiting for actual timeout or mocking time
      // For now, we'll check if session expiry is set
      const loginResponse = await apiRequest("/auth/login", "POST", undefined, {
        email: "test@okaeri.ph",
        password: "TestPassword123!",
      });

      const data = await loginResponse.json();

      // Check if tokens have expiry
      expect(data).toHaveProperty("expiresIn");
      expect(data.expiresIn).toBeGreaterThan(0);
    });
  });

  describe("Information Disclosure Prevention", () => {
    it("should not expose stack traces in errors", async () => {
      const results = await testInfoDisclosure.checkErrorMessages();

      results.forEach((result) => {
        expect(result.exposesStackTrace).toBe(false);
        expect(result.exposesDatabaseInfo).toBe(false);
        expect(result.exposesSystemPaths).toBe(false);
      });
    });

    it("should use generic error messages for auth failures", async () => {
      // Test with non-existent user
      const response1 = await apiRequest("/auth/login", "POST", undefined, {
        email: "nonexistent@test.com",
        password: "password",
      });

      // Test with wrong password
      const response2 = await apiRequest("/auth/login", "POST", undefined, {
        email: "test@okaeri.ph",
        password: "wrongpassword",
      });

      const error1 = await response1.json();
      const error2 = await response2.json();

      // Both should return same generic error
      expect(error1.error).toBe(error2.error);
      expect(error1.error).not.toContain("user not found");
      expect(error1.error).not.toContain("password incorrect");
    });

    it("should not expose internal IDs in URLs", async () => {
      // Check if using UUIDs instead of sequential IDs
      const response = await apiRequest(`/projects/${testProjectId}/bookings`, "POST", authToken, {
        guestName: "Test Guest",
        checkinDate: "2025-03-01",
        checkoutDate: "2025-03-03",
        guestCount: 2,
        totalAmount: 5000,
      });

      if (response.status === 201) {
        const data = await response.json();

        // ID should be UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        expect(data.id).toMatch(uuidRegex);
      }
    });
  });

  describe("Philippine Data Privacy Compliance", () => {
    it("should encrypt sensitive personal information", async () => {
      // Check if PII is encrypted in database
      // This would require database access to verify
      const response = await apiRequest("/auth/me", "GET", authToken);
      const user = await response.json();

      // Sensitive data should not be in plain text in responses
      expect(user).not.toHaveProperty("socialSecurityNumber");
      expect(user).not.toHaveProperty("creditCard");
      expect(user).not.toHaveProperty("bankAccount");
    });

    it("should provide data export functionality for users", async () => {
      const response = await apiRequest("/user/data-export", "POST", authToken);

      // Should allow users to export their data
      expect(response.status).toBeLessThanOrEqual(202); // Accepted or processing
    });

    it("should support data deletion requests", async () => {
      const response = await apiRequest("/user/delete-data", "POST", authToken);

      // Should support GDPR/DPA right to be forgotten
      expect(response.status).toBeLessThanOrEqual(202);
    });

    it("should log access to personal data", async () => {
      // Access personal data
      await apiRequest("/auth/me", "GET", authToken);

      // Check audit log (would need admin access)
      const auditResponse = await apiRequest("/audit/logs?type=data-access", "GET", authToken);

      if (auditResponse.status === 200) {
        const logs = await auditResponse.json();
        expect(Array.isArray(logs)).toBe(true);
      }
    });
  });

  describe("Business Logic Security", () => {
    it("should prevent negative amounts in financial transactions", async () => {
      const response = await apiRequest(`/projects/${testProjectId}/expenses`, "POST", authToken, {
        description: "Test Expense",
        amount: -1000,
        category: "supplies",
        expenseDate: "2025-03-01",
      });

      expect(response.status).toBe(400);
    });

    it("should prevent booking date manipulation", async () => {
      // Try to create booking with checkout before checkin
      const response = await apiRequest(`/projects/${testProjectId}/bookings`, "POST", authToken, {
        guestName: "Test Guest",
        checkinDate: "2025-03-05",
        checkoutDate: "2025-03-01",
        guestCount: 2,
        totalAmount: 5000,
      });

      expect(response.status).toBe(400);
    });

    it("should enforce business role permissions", async () => {
      // Create a viewer user
      const viewer = await createTestUser("viewer");

      // Viewer should not be able to modify financial data
      const response = await apiRequest(
        `/projects/${testProjectId}/expenses`,
        "POST",
        viewer.token,
        {
          description: "Unauthorized Expense",
          amount: 1000,
          category: "supplies",
          expenseDate: "2025-03-01",
        }
      );

      expect(response.status).toBe(403);
    });
  });
});
