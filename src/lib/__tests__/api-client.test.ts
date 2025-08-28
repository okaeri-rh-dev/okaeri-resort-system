/**
 * API Client Tests
 * Comprehensive tests for authentication integration, error handling, and type safety
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { z } from "zod";
import { ApiClient, apiClient, api, isApiError, isValidApiResponse } from "../api-client";
import { server } from "@tests/mocks/server";
import { mockHelpers } from "@tests/mocks/handlers";
import { TEST_CONSTANTS, MOCK_USERS } from "@tests/utils/test-utils";

// Mock the auth store
const mockAuthStore = {
  getState: vi.fn(() => ({
    token: null,
    refreshToken: null,
    sessionExpiry: null,
    user: null,
  })),
  logout: vi.fn(),
  refreshSession: vi.fn(),
};

vi.mock("@/stores/authStore", () => ({
  useAuthStore: mockAuthStore,
}));

describe("API Client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHelpers.reset();

    // Reset auth store mock
    mockAuthStore.getState.mockReturnValue({
      token: null,
      refreshToken: null,
      sessionExpiry: null,
      user: null,
    });
  });

  afterEach(() => {
    // Cancel any pending requests
    apiClient.cancelAllRequests();
  });

  describe("ApiClient Class", () => {
    it("should create instance with default config", () => {
      const client = new ApiClient({
        baseURL: "http://test.com",
      });

      expect(client).toBeInstanceOf(ApiClient);
    });

    it("should create instance with custom config", () => {
      const client = new ApiClient({
        baseURL: "http://test.com",
        timeout: 5000,
        headers: {
          "X-Custom-Header": "test",
        },
      });

      expect(client).toBeInstanceOf(ApiClient);
    });
  });

  describe("Authentication Integration", () => {
    it("should make authenticated requests with valid token", async () => {
      const mockUser = MOCK_USERS.OWNER;
      const token = TEST_CONSTANTS.MOCK_TOKEN;

      mockAuthStore.getState.mockReturnValue({
        token,
        refreshToken: TEST_CONSTANTS.MOCK_REFRESH_TOKEN,
        sessionExpiry: Date.now() + 3600000, // 1 hour from now
        user: mockUser,
      });

      const response = await apiClient.get("/auth/me");

      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockUser);
    });

    it("should refresh token if close to expiry", async () => {
      const mockUser = MOCK_USERS.MANAGER;
      const oldToken = "old-token";
      const newToken = TEST_CONSTANTS.MOCK_TOKEN;

      // Mock store state with token close to expiry
      mockAuthStore.getState
        .mockReturnValueOnce({
          token: oldToken,
          refreshToken: TEST_CONSTANTS.MOCK_REFRESH_TOKEN,
          sessionExpiry: Date.now() + 2 * 60 * 1000, // 2 minutes from now (less than 5 min threshold)
          user: mockUser,
        })
        .mockReturnValueOnce({
          token: newToken,
          refreshToken: TEST_CONSTANTS.MOCK_REFRESH_TOKEN,
          sessionExpiry: Date.now() + 3600000,
          user: mockUser,
        });

      mockAuthStore.refreshSession.mockResolvedValue();

      await apiClient.get("/auth/me");

      expect(mockAuthStore.refreshSession).toHaveBeenCalled();
    });

    it("should logout user on token refresh failure", async () => {
      mockAuthStore.getState.mockReturnValue({
        token: "expired-token",
        refreshToken: "expired-refresh",
        sessionExpiry: Date.now() + 2 * 60 * 1000, // Close to expiry
        user: MOCK_USERS.STAFF,
      });

      mockAuthStore.refreshSession.mockRejectedValue(new Error("Refresh failed"));

      await apiClient.get("/auth/me");

      expect(mockAuthStore.logout).toHaveBeenCalled();
    });

    it("should handle unauthenticated requests", async () => {
      const response = await apiClient.get("/health/check", { skipAuth: true });

      expect(response.success).toBe(true);
      expect(response.data).toEqual({
        status: "healthy",
        timestamp: expect.any(String),
        environment: "test",
      });
    });

    it("should include project ID header when available", async () => {
      const mockUser = {
        ...MOCK_USERS.OWNER,
        projects: ["project-123"],
      };

      mockAuthStore.getState.mockReturnValue({
        token: TEST_CONSTANTS.MOCK_TOKEN,
        refreshToken: TEST_CONSTANTS.MOCK_REFRESH_TOKEN,
        sessionExpiry: Date.now() + 3600000,
        user: mockUser,
      });

      // Mock fetch to inspect headers
      const originalFetch = global.fetch;
      const fetchSpy = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: mockUser }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
      global.fetch = fetchSpy;

      await apiClient.get("/auth/me");

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Project-Id": "project-123",
          }),
        })
      );

      global.fetch = originalFetch;
    });
  });

  describe("HTTP Methods", () => {
    it("should make GET requests correctly", async () => {
      const response = await apiClient.get("/health/check", { skipAuth: true });

      expect(response.status).toBe(200);
      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty("status", "healthy");
    });

    it("should make POST requests correctly", async () => {
      const loginData = {
        email: MOCK_USERS.OWNER.email,
        password: "correct-password",
      };

      const response = await apiClient.post("/auth/login", loginData, { skipAuth: true });

      expect(response.status).toBe(200);
      expect(response.success).toBe(true);
      expect(response.data.user).toEqual(MOCK_USERS.OWNER);
    });

    it("should make PUT requests correctly", async () => {
      mockAuthStore.getState.mockReturnValue({
        token: TEST_CONSTANTS.MOCK_TOKEN,
        refreshToken: TEST_CONSTANTS.MOCK_REFRESH_TOKEN,
        sessionExpiry: Date.now() + 3600000,
        user: MOCK_USERS.OWNER,
      });

      const updateData = { name: "Updated Name" };
      const response = await apiClient.put("/auth/profile", updateData);

      expect(response.status).toBe(200);
      expect(response.success).toBe(true);
    });

    it("should make PATCH requests correctly", async () => {
      mockAuthStore.getState.mockReturnValue({
        token: TEST_CONSTANTS.MOCK_TOKEN,
        refreshToken: TEST_CONSTANTS.MOCK_REFRESH_TOKEN,
        sessionExpiry: Date.now() + 3600000,
        user: MOCK_USERS.OWNER,
      });

      const updateData = { name: "Patched Name" };
      const response = await apiClient.patch("/auth/profile", updateData);

      expect(response.status).toBe(200);
      expect(response.success).toBe(true);
    });

    it("should make DELETE requests correctly", async () => {
      mockAuthStore.getState.mockReturnValue({
        token: TEST_CONSTANTS.MOCK_TOKEN,
        refreshToken: TEST_CONSTANTS.MOCK_REFRESH_TOKEN,
        sessionExpiry: Date.now() + 3600000,
        user: MOCK_USERS.OWNER,
      });

      const response = await apiClient.delete("/auth/logout");

      expect(response.status).toBe(200);
      expect(response.success).toBe(true);
    });
  });

  describe("Request Parameters and Query Strings", () => {
    it("should handle query parameters", async () => {
      // Mock fetch to inspect the URL
      const originalFetch = global.fetch;
      const fetchSpy = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
      global.fetch = fetchSpy;

      await apiClient.get("/test", {
        params: {
          page: 1,
          limit: 10,
          search: "test query",
          active: true,
          optional: undefined, // Should be excluded
        },
        skipAuth: true,
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("page=1&limit=10&search=test+query&active=true"),
        expect.any(Object)
      );

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.not.stringContaining("optional"),
        expect.any(Object)
      );

      global.fetch = originalFetch;
    });

    it("should handle empty parameters", async () => {
      const response = await apiClient.get("/health/check", {
        params: {},
        skipAuth: true,
      });

      expect(response.success).toBe(true);
    });

    it("should handle null and undefined parameters", async () => {
      const originalFetch = global.fetch;
      const fetchSpy = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
      global.fetch = fetchSpy;

      await apiClient.get("/test", {
        params: {
          value1: null,
          value2: undefined,
          value3: "",
          value4: 0,
          value5: false,
        },
        skipAuth: true,
      });

      const calledUrl = fetchSpy.mock.calls[0][0];
      expect(calledUrl).toContain("value3=");
      expect(calledUrl).toContain("value4=0");
      expect(calledUrl).toContain("value5=false");
      expect(calledUrl).not.toContain("value1");
      expect(calledUrl).not.toContain("value2");

      global.fetch = originalFetch;
    });
  });

  describe("Schema Validation", () => {
    it("should validate response with schema", async () => {
      const userSchema = z.object({
        id: z.string(),
        email: z.string().email(),
        name: z.string(),
        role: z.string(),
      });

      mockAuthStore.getState.mockReturnValue({
        token: TEST_CONSTANTS.MOCK_TOKEN,
        refreshToken: TEST_CONSTANTS.MOCK_REFRESH_TOKEN,
        sessionExpiry: Date.now() + 3600000,
        user: MOCK_USERS.OWNER,
      });

      const response = await apiClient.get("/auth/me", { schema: userSchema });

      expect(response.success).toBe(true);
      expect(response.data).toMatchObject({
        id: expect.any(String),
        email: expect.stringMatching(/\S+@\S+\.\S+/),
        name: expect.any(String),
        role: expect.any(String),
      });
    });

    it("should handle schema validation errors in development", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const strictSchema = z.object({
        id: z.string(),
        email: z.string().email(),
        name: z.string(),
        role: z.enum(["ADMIN"]), // Will fail for OWNER role
      });

      mockAuthStore.getState.mockReturnValue({
        token: TEST_CONSTANTS.MOCK_TOKEN,
        refreshToken: TEST_CONSTANTS.MOCK_REFRESH_TOKEN,
        sessionExpiry: Date.now() + 3600000,
        user: MOCK_USERS.OWNER,
      });

      await expect(apiClient.get("/auth/me", { schema: strictSchema })).rejects.toThrow(
        "API response validation failed"
      );

      process.env.NODE_ENV = originalEnv;
    });

    it("should log schema validation errors in production", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const strictSchema = z.object({
        invalid: z.string(), // Will fail
      });

      mockAuthStore.getState.mockReturnValue({
        token: TEST_CONSTANTS.MOCK_TOKEN,
        refreshToken: TEST_CONSTANTS.MOCK_REFRESH_TOKEN,
        sessionExpiry: Date.now() + 3600000,
        user: MOCK_USERS.OWNER,
      });

      const response = await apiClient.get("/auth/me", { schema: strictSchema });

      expect(response.success).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith("API response validation failed:", expect.any(Array));

      process.env.NODE_ENV = originalEnv;
      consoleSpy.mockRestore();
    });
  });

  describe("Error Handling", () => {
    it("should handle 401 unauthorized errors", async () => {
      mockAuthStore.getState.mockReturnValue({
        token: "invalid-token",
        refreshToken: "invalid-refresh",
        sessionExpiry: Date.now() + 3600000,
        user: MOCK_USERS.OWNER,
      });

      try {
        await apiClient.get("/auth/me");
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.status).toBe(401);
        expect(mockAuthStore.logout).toHaveBeenCalled();
      }
    });

    it("should handle 404 not found errors", async () => {
      try {
        await apiClient.get("/non-existent-endpoint", { skipAuth: true });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.status).toBe(404);
        expect(error.message).toContain("Unhandled request");
      }
    });

    it("should handle 500 server errors", async () => {
      try {
        await apiClient.post("/auth/login-server-error", {}, { skipAuth: true });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.status).toBe(500);
        expect(error.message).toBe("Internal server error");
      }
    });

    it("should handle network errors", async () => {
      try {
        await apiClient.post("/auth/login-network-error", {}, { skipAuth: true });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.message).toBe("Network error occurred");
      }
    });

    it("should handle request timeout", async () => {
      try {
        await apiClient.post(
          "/auth/login-slow",
          {},
          {
            skipAuth: true,
            timeout: 1000, // 1 second timeout for slow endpoint (5 second response)
          }
        );
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.status).toBe(408);
        expect(error.message).toBe("Request timeout");
      }
    });

    it("should handle malformed JSON responses", async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue(
        new Response("invalid json{", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const response = await apiClient.get("/test", { skipAuth: true });
      expect(response.data).toBe(null);

      global.fetch = originalFetch;
    });

    it("should handle non-JSON responses", async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue(
        new Response("Plain text response", {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        })
      );

      const response = await apiClient.get("/test", { skipAuth: true });
      expect(response.data).toBe("Plain text response");

      global.fetch = originalFetch;
    });

    it("should handle 204 No Content responses", async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue(
        new Response("", {
          status: 204,
        })
      );

      const response = await apiClient.delete("/test", { skipAuth: true });
      expect(response.status).toBe(204);
      expect(response.data).toBe(null);

      global.fetch = originalFetch;
    });
  });

  describe("Request Cancellation", () => {
    it("should cancel specific requests", async () => {
      // Start a request
      const requestPromise = apiClient.get("/auth/login-slow", { skipAuth: true });

      // Cancel it immediately
      apiClient.cancelRequest("/auth/login-slow");

      try {
        await requestPromise;
        expect.fail("Request should have been cancelled");
      } catch (error: any) {
        expect(error.status).toBe(408);
        expect(error.message).toBe("Request timeout");
      }
    });

    it("should cancel all requests", async () => {
      // Start multiple requests
      const requests = [
        apiClient.get("/auth/login-slow", { skipAuth: true }),
        apiClient.get("/auth/login-slow", { skipAuth: true }),
        apiClient.get("/auth/login-slow", { skipAuth: true }),
      ];

      // Cancel all
      apiClient.cancelAllRequests();

      // All should fail
      const results = await Promise.allSettled(requests);
      results.forEach((result) => {
        expect(result.status).toBe("rejected");
        if (result.status === "rejected") {
          expect(result.reason.status).toBe(408);
        }
      });
    });
  });

  describe("File Upload", () => {
    it("should handle file uploads", async () => {
      const formData = new FormData();
      formData.append("file", new Blob(["test content"], { type: "text/plain" }));
      formData.append("name", "test.txt");

      mockAuthStore.getState.mockReturnValue({
        token: TEST_CONSTANTS.MOCK_TOKEN,
        refreshToken: TEST_CONSTANTS.MOCK_REFRESH_TOKEN,
        sessionExpiry: Date.now() + 3600000,
        user: MOCK_USERS.OWNER,
      });

      // Mock fetch to handle FormData
      const originalFetch = global.fetch;
      const fetchSpy = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              id: "file-123",
              filename: "test.txt",
              size: 12,
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      );
      global.fetch = fetchSpy;

      const response = await apiClient.upload("/files/upload", formData);

      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty("filename", "test.txt");

      // Verify Content-Type header was removed
      const { headers } = fetchSpy.mock.calls[0][1];
      expect(headers).not.toHaveProperty("Content-Type");

      global.fetch = originalFetch;
    });
  });

  describe("Type Guards", () => {
    it("should identify API errors correctly", () => {
      const validError = {
        message: "Test error",
        status: 400,
        errors: { field: ["error"] },
      };

      const invalidErrors = [
        null,
        undefined,
        {},
        { message: "test" }, // missing status
        { status: 400 }, // missing message
        { message: 123, status: 400 }, // wrong type for message
        { message: "test", status: "400" }, // wrong type for status
      ];

      expect(isApiError(validError)).toBe(true);

      invalidErrors.forEach((error) => {
        expect(isApiError(error)).toBe(false);
      });
    });

    it("should identify valid API responses correctly", () => {
      const validResponse = {
        data: { test: "data" },
        status: 200,
        success: true,
        message: "Success",
      };

      const invalidResponses = [
        null,
        undefined,
        {},
        { data: "test" }, // missing status and success
        { data: "test", status: 200 }, // missing success
        { data: "test", success: true }, // missing status
        { data: "test", status: "200", success: true }, // wrong type for status
        { data: "test", status: 200, success: "true" }, // wrong type for success
      ];

      expect(isValidApiResponse(validResponse)).toBe(true);

      invalidResponses.forEach((response) => {
        expect(isValidApiResponse(response)).toBe(false);
      });
    });
  });

  describe("Simplified API Functions", () => {
    it("should use api.get shorthand", async () => {
      const data = await api.get("/health/check", { skipAuth: true });

      expect(data).toHaveProperty("status", "healthy");
    });

    it("should use api.post shorthand", async () => {
      const loginData = {
        email: MOCK_USERS.OWNER.email,
        password: "correct-password",
      };

      const data = await api.post("/auth/login", loginData, { skipAuth: true });

      expect(data.user).toEqual(MOCK_USERS.OWNER);
    });

    it("should use typed API functions", async () => {
      const userSchema = z.object({
        id: z.string(),
        email: z.string().email(),
        name: z.string(),
        role: z.string(),
      });

      mockAuthStore.getState.mockReturnValue({
        token: TEST_CONSTANTS.MOCK_TOKEN,
        refreshToken: TEST_CONSTANTS.MOCK_REFRESH_TOKEN,
        sessionExpiry: Date.now() + 3600000,
        user: MOCK_USERS.OWNER,
      });

      const data = await api.getTyped("/auth/me", userSchema);

      expect(data).toMatchObject({
        id: expect.any(String),
        email: expect.stringMatching(/\S+@\S+\.\S+/),
        name: expect.any(String),
        role: expect.any(String),
      });
    });

    it("should handle api shorthand errors", async () => {
      try {
        await api.get("/non-existent", { skipAuth: true });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });
  });

  describe("Rate Limiting Integration", () => {
    it("should handle rate limit responses", async () => {
      // Trigger rate limit by making multiple login attempts
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          apiClient
            .post(
              "/auth/login",
              { email: "ratelimited@example.com", password: "password" },
              { skipAuth: true }
            )
            .catch((error) => error)
        );
      }

      const results = await Promise.all(promises);

      // Some requests should be rate limited
      const rateLimitedResults = results.filter((result) => result.status === 429);

      expect(rateLimitedResults.length).toBeGreaterThan(0);
    });
  });

  describe("Custom Headers", () => {
    it("should include custom headers", async () => {
      const originalFetch = global.fetch;
      const fetchSpy = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: {} }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
      global.fetch = fetchSpy;

      await apiClient.get("/test", {
        headers: {
          "X-Custom-Header": "custom-value",
          "X-Another-Header": "another-value",
        },
        skipAuth: true,
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Custom-Header": "custom-value",
            "X-Another-Header": "another-value",
          }),
        })
      );

      global.fetch = originalFetch;
    });

    it("should merge default and custom headers", async () => {
      const originalFetch = global.fetch;
      const fetchSpy = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: {} }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
      global.fetch = fetchSpy;

      await apiClient.get("/test", {
        headers: {
          "Content-Type": "application/xml", // Override default
          "X-Custom": "value",
        },
        skipAuth: true,
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/xml", // Should be overridden
            "X-Custom": "value",
          }),
        })
      );

      global.fetch = originalFetch;
    });
  });

  describe("Environment Integration", () => {
    it("should use environment variables for base URL", () => {
      const originalEnv = import.meta.env;
      import.meta.env = {
        ...originalEnv,
        VITE_API_URL: "https://custom.api.com",
      };

      const client = new ApiClient({
        baseURL: import.meta.env.VITE_API_URL || "/api",
      });

      expect(client).toBeInstanceOf(ApiClient);

      import.meta.env = originalEnv;
    });
  });
});
