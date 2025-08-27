/**
 * Auth endpoint tests with comprehensive error handling and Philippine-specific scenarios
 * Tests authentication flows, rate limiting, and security scenarios
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { server } from "@tests/mocks/server";
import { http, HttpResponse } from "msw";
import { authApi } from "../auth";
import {
  TEST_CONSTANTS,
  MOCK_USERS,
  philippineTestData,
  securityHelpers,
} from "@tests/utils/test-utils";
import { mockHelpers } from "@tests/mocks/handlers";

describe("Auth API Endpoints", () => {
  beforeEach(() => {
    mockHelpers.reset();
    mockHelpers.clearAuditLogs();
    vi.clearAllMocks();
  });

  describe("POST /auth/login", () => {
    it("should successfully login with valid credentials", async () => {
      const loginData = {
        email: MOCK_USERS.OWNER.email,
        password: "valid-password",
      };

      const result = await authApi.login(loginData);

      expect(result).toMatchObject({
        user: expect.objectContaining({
          id: MOCK_USERS.OWNER.id,
          email: MOCK_USERS.OWNER.email,
          name: MOCK_USERS.OWNER.name,
          role: MOCK_USERS.OWNER.role,
        }),
        token: expect.stringMatching(/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/),
        refreshToken: expect.stringContaining("refresh_"),
      });

      // Verify audit log was created
      const auditLogs = mockHelpers.getAuditLogs();
      expect(auditLogs).toContainEqual(
        expect.objectContaining({
          event: "LOGIN_SUCCESS",
          userId: MOCK_USERS.OWNER.id,
          details: expect.objectContaining({ email: loginData.email }),
        })
      );
    });

    it("should handle login with Philippine phone number format", async () => {
      const userWithPhone = {
        ...MOCK_USERS.OWNER,
        email: "test@okaeriresort.ph",
        phone: philippineTestData.validPhoneNumbers[0],
      };

      mockHelpers.addUser(userWithPhone);

      const result = await authApi.login({
        email: userWithPhone.email,
        password: "valid-password",
      });

      expect(result.user.phone).toBe(userWithPhone.phone);
    });

    it("should return 401 for invalid credentials", async () => {
      const loginData = {
        email: MOCK_USERS.OWNER.email,
        password: "wrong-password",
      };

      await expect(authApi.login(loginData)).rejects.toMatchObject({
        status: 401,
        message: "Invalid credentials",
      });
    });

    it("should return 404 for non-existent user", async () => {
      const loginData = {
        email: "nonexistent@test.com",
        password: "any-password",
      };

      await expect(authApi.login(loginData)).rejects.toMatchObject({
        status: 404,
        message: "User not found",
      });
    });

    it("should handle rate limiting correctly", async () => {
      const email = MOCK_USERS.OWNER.email;

      // Set rate limit to trigger
      mockHelpers.setRateLimit(`login:${email}`, 5, Date.now() + 300000);

      await expect(
        authApi.login({
          email,
          password: "any-password",
        })
      ).rejects.toMatchObject({
        status: 429,
        message: "Too many login attempts",
        details: expect.objectContaining({
          retryAfter: expect.any(Number),
        }),
      });
    });

    it("should handle network timeout", async () => {
      // Mock slow response
      server.use(
        http.post(`${TEST_CONSTANTS.API_BASE_URL}/auth/login`, () => {
          return HttpResponse.json({ error: "Request timeout" }, { status: 408 });
        })
      );

      await expect(
        authApi.login({
          email: MOCK_USERS.OWNER.email,
          password: "valid-password",
        })
      ).rejects.toMatchObject({
        status: 408,
        message: "Request timeout",
      });
    });

    it("should handle server errors gracefully", async () => {
      server.use(
        http.post(`${TEST_CONSTANTS.API_BASE_URL}/auth/login`, () => {
          return HttpResponse.json({ error: "Internal server error" }, { status: 500 });
        })
      );

      await expect(
        authApi.login({
          email: MOCK_USERS.OWNER.email,
          password: "valid-password",
        })
      ).rejects.toMatchObject({
        status: 500,
        message: "Internal server error",
      });
    });

    it("should validate email format", async () => {
      const invalidEmails = ["invalid-email", "test@", "@test.com", "test.com"];

      for (const email of invalidEmails) {
        await expect(
          authApi.login({
            email,
            password: "any-password",
          })
        ).rejects.toMatchObject({
          status: 400,
        });
      }
    });
  });

  describe("POST /auth/register", () => {
    it("should successfully register new user with Philippine data", async () => {
      const registerData = {
        name: philippineTestData.validNames[0],
        email: "newuser@okaeriresort.ph",
        password: "SecurePassword123!",
        projectName: philippineTestData.validProjectNames[0],
        phone: philippineTestData.validPhoneNumbers[0],
      };

      const result = await authApi.register(registerData);

      expect(result).toMatchObject({
        user: expect.objectContaining({
          email: registerData.email,
          name: registerData.name,
          role: "OWNER",
          phone: registerData.phone,
        }),
        token: expect.stringMatching(/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/),
        refreshToken: expect.stringContaining("refresh_"),
      });

      // Verify audit log was created
      const auditLogs = mockHelpers.getAuditLogs();
      expect(auditLogs).toContainEqual(
        expect.objectContaining({
          event: "REGISTER_SUCCESS",
          details: expect.objectContaining({
            email: registerData.email,
            projectName: registerData.projectName,
          }),
        })
      );
    });

    it("should handle registration without optional fields", async () => {
      const registerData = {
        name: "Juan Dela Cruz",
        email: "minimal@test.com",
        password: "SecurePassword123!",
      };

      const result = await authApi.register(registerData);

      expect(result.user).toMatchObject({
        email: registerData.email,
        name: registerData.name,
        phone: null,
      });
    });

    it("should return 409 for existing user", async () => {
      const registerData = {
        name: "Test User",
        email: MOCK_USERS.OWNER.email, // Use existing email
        password: "SecurePassword123!",
      };

      await expect(authApi.register(registerData)).rejects.toMatchObject({
        status: 409,
        message: "User already exists",
      });
    });

    it("should validate Philippine phone number format", async () => {
      const registerData = {
        name: "Test User",
        email: "test@example.com",
        password: "SecurePassword123!",
        phone: philippineTestData.invalidPhoneNumbers[0],
      };

      await expect(authApi.register(registerData)).rejects.toMatchObject({
        status: 400,
        message: expect.stringContaining("phone"),
      });
    });

    it("should handle rate limiting for registration", async () => {
      const email = "test@ratelimit.com";
      mockHelpers.setRateLimit(`register:${email}`, 3, Date.now() + 3600000);

      await expect(
        authApi.register({
          name: "Test User",
          email,
          password: "SecurePassword123!",
        })
      ).rejects.toMatchObject({
        status: 429,
        message: "Too many registration attempts",
      });
    });

    it("should validate password strength", async () => {
      const weakPasswords = ["123", "password", "12345678"];

      for (const password of weakPasswords) {
        await expect(
          authApi.register({
            name: "Test User",
            email: `test${Date.now()}@example.com`,
            password,
          })
        ).rejects.toMatchObject({
          status: 400,
          message: expect.stringContaining("password"),
        });
      }
    });
  });

  describe("POST /auth/refresh", () => {
    it("should successfully refresh valid token", async () => {
      // First login to get tokens
      const loginResult = await authApi.login({
        email: MOCK_USERS.OWNER.email,
        password: "valid-password",
      });

      const result = await authApi.refreshToken({
        refreshToken: loginResult.refreshToken,
      });

      expect(result).toMatchObject({
        token: expect.stringMatching(/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/),
        refreshToken: expect.stringContaining("refresh_"),
      });

      // Verify audit log was created
      const auditLogs = mockHelpers.getAuditLogs();
      expect(auditLogs).toContainEqual(
        expect.objectContaining({
          event: "TOKEN_REFRESH_SUCCESS",
          userId: MOCK_USERS.OWNER.id,
        })
      );
    });

    it("should reject invalid refresh token", async () => {
      await expect(
        authApi.refreshToken({
          refreshToken: "invalid-refresh-token",
        })
      ).rejects.toMatchObject({
        status: 401,
        message: "Invalid or expired refresh token",
      });
    });

    it("should reject expired refresh token", async () => {
      const expiredToken = securityHelpers.createExpiredToken();

      await expect(
        authApi.refreshToken({
          refreshToken: expiredToken,
        })
      ).rejects.toMatchObject({
        status: 401,
        message: "Invalid or expired refresh token",
      });
    });
  });

  describe("GET /auth/me", () => {
    it("should return current user profile", async () => {
      // Login first to get token
      const loginResult = await authApi.login({
        email: MOCK_USERS.OWNER.email,
        password: "valid-password",
      });

      // Set up API client with token
      const { apiClient } = await import("@/api/client");
      apiClient.setAuthToken(loginResult.token);

      const result = await authApi.getProfile();

      expect(result).toMatchObject({
        id: MOCK_USERS.OWNER.id,
        email: MOCK_USERS.OWNER.email,
        name: MOCK_USERS.OWNER.name,
        role: MOCK_USERS.OWNER.role,
      });
    });

    it("should reject requests without authorization", async () => {
      const { apiClient } = await import("@/api/client");
      apiClient.setAuthToken(null);

      await expect(authApi.getProfile()).rejects.toMatchObject({
        status: 401,
        message: "No authorization token provided",
      });
    });

    it("should reject requests with expired token", async () => {
      const { apiClient } = await import("@/api/client");
      const expiredToken = securityHelpers.createExpiredToken();
      apiClient.setAuthToken(expiredToken);

      await expect(authApi.getProfile()).rejects.toMatchObject({
        status: 401,
        message: "Invalid or expired token",
      });
    });
  });

  describe("POST /auth/logout", () => {
    it("should successfully logout authenticated user", async () => {
      // Login first
      const loginResult = await authApi.login({
        email: MOCK_USERS.OWNER.email,
        password: "valid-password",
      });

      const { apiClient } = await import("@/api/client");
      apiClient.setAuthToken(loginResult.token);

      await expect(authApi.logout()).resolves.toBeUndefined();

      // Verify audit log was created
      const auditLogs = mockHelpers.getAuditLogs();
      expect(auditLogs).toContainEqual(
        expect.objectContaining({
          event: "LOGOUT_SUCCESS",
          userId: MOCK_USERS.OWNER.id,
        })
      );
    });

    it("should handle logout without token gracefully", async () => {
      const { apiClient } = await import("@/api/client");
      apiClient.setAuthToken(null);

      await expect(authApi.logout()).resolves.toBeUndefined();
    });
  });

  describe("PATCH /auth/profile", () => {
    it("should successfully update user profile with Philippine data", async () => {
      // Login first
      const loginResult = await authApi.login({
        email: MOCK_USERS.OWNER.email,
        password: "valid-password",
      });

      const { apiClient } = await import("@/api/client");
      apiClient.setAuthToken(loginResult.token);

      const updates = {
        name: philippineTestData.validNames[1],
        phone: philippineTestData.validPhoneNumbers[1],
      };

      const result = await authApi.updateProfile(updates);

      expect(result).toMatchObject({
        id: MOCK_USERS.OWNER.id,
        name: updates.name,
        phone: updates.phone,
        updatedAt: expect.any(Date),
      });

      // Verify audit log was created
      const auditLogs = mockHelpers.getAuditLogs();
      expect(auditLogs).toContainEqual(
        expect.objectContaining({
          event: "PROFILE_UPDATE_SUCCESS",
          userId: MOCK_USERS.OWNER.id,
          details: updates,
        })
      );
    });

    it("should validate Philippine phone number in updates", async () => {
      const loginResult = await authApi.login({
        email: MOCK_USERS.OWNER.email,
        password: "valid-password",
      });

      const { apiClient } = await import("@/api/client");
      apiClient.setAuthToken(loginResult.token);

      await expect(
        authApi.updateProfile({
          phone: philippineTestData.invalidPhoneNumbers[0],
        })
      ).rejects.toMatchObject({
        status: 400,
        message: expect.stringContaining("phone"),
      });
    });

    it("should reject unauthorized profile updates", async () => {
      const { apiClient } = await import("@/api/client");
      apiClient.setAuthToken(null);

      await expect(
        authApi.updateProfile({
          name: "Updated Name",
        })
      ).rejects.toMatchObject({
        status: 401,
        message: "No authorization token provided",
      });
    });
  });

  describe("POST /auth/reset-password", () => {
    it("should send reset email for existing user", async () => {
      await expect(
        authApi.resetPassword({
          email: MOCK_USERS.OWNER.email,
        })
      ).resolves.toBeUndefined();

      // Verify audit log was created
      const auditLogs = mockHelpers.getAuditLogs();
      expect(auditLogs).toContainEqual(
        expect.objectContaining({
          event: "PASSWORD_RESET_REQUEST",
          userId: MOCK_USERS.OWNER.id,
        })
      );
    });

    it("should not reveal if user doesn't exist", async () => {
      await expect(
        authApi.resetPassword({
          email: "nonexistent@test.com",
        })
      ).resolves.toBeUndefined();
    });

    it("should handle rate limiting for password reset", async () => {
      const email = MOCK_USERS.OWNER.email;
      mockHelpers.setRateLimit(`password-reset:${email}`, 3, Date.now() + 3600000);

      await expect(
        authApi.resetPassword({
          email,
        })
      ).rejects.toMatchObject({
        status: 429,
        message: "Too many password reset attempts",
      });
    });
  });

  describe("POST /auth/update-password", () => {
    it("should successfully update password", async () => {
      const loginResult = await authApi.login({
        email: MOCK_USERS.OWNER.email,
        password: "valid-password",
      });

      const { apiClient } = await import("@/api/client");
      apiClient.setAuthToken(loginResult.token);

      await expect(
        authApi.updatePassword({
          currentPassword: "current-password",
          newPassword: "NewSecurePassword123!",
        })
      ).resolves.toBeUndefined();

      // Verify audit log was created
      const auditLogs = mockHelpers.getAuditLogs();
      expect(auditLogs).toContainEqual(
        expect.objectContaining({
          event: "PASSWORD_CHANGE_SUCCESS",
          userId: MOCK_USERS.OWNER.id,
        })
      );
    });

    it("should reject incorrect current password", async () => {
      const loginResult = await authApi.login({
        email: MOCK_USERS.OWNER.email,
        password: "valid-password",
      });

      const { apiClient } = await import("@/api/client");
      apiClient.setAuthToken(loginResult.token);

      await expect(
        authApi.updatePassword({
          currentPassword: "wrong-current-password",
          newPassword: "NewSecurePassword123!",
        })
      ).rejects.toMatchObject({
        status: 400,
        message: "Current password is incorrect",
      });
    });

    it("should validate new password strength", async () => {
      const loginResult = await authApi.login({
        email: MOCK_USERS.OWNER.email,
        password: "valid-password",
      });

      const { apiClient } = await import("@/api/client");
      apiClient.setAuthToken(loginResult.token);

      await expect(
        authApi.updatePassword({
          currentPassword: "current-password",
          newPassword: "weak",
        })
      ).rejects.toMatchObject({
        status: 400,
        message: expect.stringContaining("password"),
      });
    });
  });

  describe("POST /auth/verify-email", () => {
    it("should successfully verify email with valid token", async () => {
      await expect(authApi.verifyEmail("valid-verification-token")).resolves.toBeUndefined();
    });

    it("should reject invalid verification token", async () => {
      server.use(
        http.post(`${TEST_CONSTANTS.API_BASE_URL}/auth/verify-email`, () => {
          return HttpResponse.json({ error: "Invalid verification token" }, { status: 400 });
        })
      );

      await expect(authApi.verifyEmail("invalid-token")).rejects.toMatchObject({
        status: 400,
        message: "Invalid verification token",
      });
    });
  });

  describe("POST /auth/resend-verification", () => {
    it("should resend verification email for authenticated user", async () => {
      const loginResult = await authApi.login({
        email: MOCK_USERS.OWNER.email,
        password: "valid-password",
      });

      const { apiClient } = await import("@/api/client");
      apiClient.setAuthToken(loginResult.token);

      await expect(authApi.resendVerification()).resolves.toBeUndefined();
    });

    it("should reject unauthenticated requests", async () => {
      const { apiClient } = await import("@/api/client");
      apiClient.setAuthToken(null);

      server.use(
        http.post(`${TEST_CONSTANTS.API_BASE_URL}/auth/resend-verification`, () => {
          return HttpResponse.json({ error: "No authorization token provided" }, { status: 401 });
        })
      );

      await expect(authApi.resendVerification()).rejects.toMatchObject({
        status: 401,
        message: "No authorization token provided",
      });
    });
  });

  describe("Network resilience and Philippine connection issues", () => {
    it("should handle slow network connections", async () => {
      server.use(
        http.post(`${TEST_CONSTANTS.API_BASE_URL}/auth/login`, async () => {
          // Simulate slow connection (3G speeds)
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return HttpResponse.json({
            user: MOCK_USERS.OWNER,
            token: "slow-response-token",
            refreshToken: "slow-response-refresh",
          });
        })
      );

      const result = await authApi.login({
        email: MOCK_USERS.OWNER.email,
        password: "valid-password",
      });

      expect(result.token).toBe("slow-response-token");
    }, 10000); // Increase timeout for slow network test

    it("should handle intermittent connection failures", async () => {
      let attempt = 0;
      server.use(
        http.post(`${TEST_CONSTANTS.API_BASE_URL}/auth/login`, () => {
          attempt++;
          if (attempt < 3) {
            return HttpResponse.error(); // Network error
          }
          return HttpResponse.json({
            user: MOCK_USERS.OWNER,
            token: "retry-success-token",
            refreshToken: "retry-success-refresh",
          });
        })
      );

      // This test would require retry logic in the API client
      // For now, we just verify the error is properly handled
      await expect(
        authApi.login({
          email: MOCK_USERS.OWNER.email,
          password: "valid-password",
        })
      ).rejects.toMatchObject({
        code: "NETWORK_ERROR",
      });
    });
  });
});
