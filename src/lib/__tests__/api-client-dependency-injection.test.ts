/**
 * API Client Dependency Injection Tests
 * Tests the enhanced API client with dependency injection capabilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { z } from "zod";
import {
  createApiClient,
  ApiClient,
  type AuthProvider,
  type TokenManager,
  type ApiClientConfig,
} from "../api-client";
import {
  ApiClientFactory,
  DependencyContainer,
  setupTestEnvironment,
  setupProductionEnvironment,
  createEnvironmentClient,
} from "../api-client-factory";
import {
  MockAuthProvider,
  MockTokenManager,
  TestApiClientFactory,
  TestScenarios,
  createMockUser,
  createMockResponse,
  createMockErrorResponse,
} from "@tests/mocks/api-client-mocks";
import type { User } from "@/types/common";

// Mock fetch globally for these tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("API Client Dependency Injection", () => {
  let mockAuthProvider: MockAuthProvider;
  let mockTokenManager: MockTokenManager;
  let container: DependencyContainer;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();

    mockAuthProvider = new MockAuthProvider();
    mockTokenManager = new MockTokenManager();
    container = DependencyContainer.getInstance();
    container.reset();
  });

  afterEach(() => {
    container.reset();
  });

  describe("Dependency Injection Interfaces", () => {
    it("should create API client with custom dependencies", () => {
      const config: ApiClientConfig = {
        baseURL: "/api/test",
        authProvider: mockAuthProvider,
        tokenManager: mockTokenManager,
      };

      const client = createApiClient(config);
      expect(client).toBeInstanceOf(ApiClient);
    });

    it("should fall back to default dependencies when none provided", () => {
      const config: ApiClientConfig = {
        baseURL: "/api/test",
      };

      const client = createApiClient(config);
      expect(client).toBeInstanceOf(ApiClient);
    });
  });

  describe("MockAuthProvider", () => {
    it("should return configured tokens and user", () => {
      const user = createMockUser();
      mockAuthProvider.setUser(user);
      mockAuthProvider.setToken("test-token");
      mockAuthProvider.setProjectId("test-project");

      expect(mockAuthProvider.getToken()).toBe("test-token");
      expect(mockAuthProvider.getUser()).toEqual(user);
      expect(mockAuthProvider.getProjectId()).toBe("test-project");
    });

    it("should simulate token expiration", () => {
      mockAuthProvider.setTokenExpired(true);
      expect(mockAuthProvider.isTokenExpired("any-token")).toBe(true);

      mockAuthProvider.setTokenExpired(false);
      expect(mockAuthProvider.isTokenExpired("any-token")).toBe(false);
    });

    it("should simulate refresh session success and failure", async () => {
      // Test successful refresh
      mockAuthProvider.setRefreshSessionShouldFail(false);
      await expect(mockAuthProvider.refreshSession()).resolves.toBeUndefined();
      expect(mockAuthProvider.getToken()).toBe("new-access-token");

      // Test failed refresh
      mockAuthProvider.setRefreshSessionShouldFail(true);
      await expect(mockAuthProvider.refreshSession()).rejects.toThrow("Refresh session failed");
    });

    it("should track logout calls", () => {
      expect(mockAuthProvider.wasLogoutCalled()).toBe(false);

      mockAuthProvider.logout();

      expect(mockAuthProvider.wasLogoutCalled()).toBe(true);
      expect(mockAuthProvider.getToken()).toBe(null);
      expect(mockAuthProvider.getUser()).toBe(null);
    });
  });

  describe("MockTokenManager", () => {
    it("should store and retrieve tokens", () => {
      mockTokenManager.storeTokens("access-token", "refresh-token");

      expect(mockTokenManager.getAccessToken()).toBe("access-token");
      expect(mockTokenManager.getRefreshToken()).toBe("refresh-token");
    });

    it("should clear tokens", () => {
      mockTokenManager.storeTokens("access-token", "refresh-token");
      mockTokenManager.clearTokens();

      expect(mockTokenManager.getAccessToken()).toBe(null);
      expect(mockTokenManager.getRefreshToken()).toBe(null);
    });

    it("should simulate token validation", () => {
      mockTokenManager.setTokenValidationResult({ valid: true });
      expect(mockTokenManager.validateTokenStructure("token")).toEqual({ valid: true });

      mockTokenManager.setTokenValidationResult({ valid: false, error: "Invalid structure" });
      expect(mockTokenManager.validateTokenStructure("token")).toEqual({
        valid: false,
        error: "Invalid structure",
      });
    });
  });

  describe("API Client Factory", () => {
    it("should create production client with default dependencies", () => {
      const client = ApiClientFactory.createProductionClient();
      expect(client).toBeInstanceOf(ApiClient);
    });

    it("should create test client with mock dependencies", () => {
      const client = ApiClientFactory.createTestClient({
        authProvider: mockAuthProvider,
        tokenManager: mockTokenManager,
      });
      expect(client).toBeInstanceOf(ApiClient);
    });

    it("should create development client with debug headers", () => {
      const client = ApiClientFactory.createDevelopmentClient();
      expect(client).toBeInstanceOf(ApiClient);
    });

    it("should create custom client with specific configuration", () => {
      const config: ApiClientConfig = {
        baseURL: "/custom/api",
        timeout: 5000,
        authProvider: mockAuthProvider,
        tokenManager: mockTokenManager,
      };

      const client = ApiClientFactory.createCustomClient(config);
      expect(client).toBeInstanceOf(ApiClient);
    });
  });

  describe("Dependency Container", () => {
    it("should store and retrieve dependencies", () => {
      container
        .setAuthProvider(mockAuthProvider)
        .setTokenManager(mockTokenManager)
        .setEnvironment("test");

      expect(container.getAuthProvider()).toBe(mockAuthProvider);
      expect(container.getTokenManager()).toBe(mockTokenManager);
      expect(container.getEnvironment()).toBe("test");
    });

    it("should reset to default state", () => {
      container
        .setAuthProvider(mockAuthProvider)
        .setTokenManager(mockTokenManager)
        .setEnvironment("test");

      container.reset();

      expect(container.getAuthProvider()).toBeUndefined();
      expect(container.getTokenManager()).toBeUndefined();
      expect(container.getEnvironment()).toBe("production");
    });
  });

  describe("Test Scenarios", () => {
    it("should provide authenticated user scenario", () => {
      const scenario = TestScenarios.authenticatedUser();

      expect(scenario.user).toBeDefined();
      expect(scenario.authProvider.getToken()).toBeTruthy();
      expect(scenario.tokenManager.getAccessToken()).toBeTruthy();
    });

    it("should provide unauthenticated user scenario", () => {
      const scenario = TestScenarios.unauthenticatedUser();

      expect(scenario.user).toBe(null);
      expect(scenario.authProvider.getToken()).toBe(null);
      expect(scenario.tokenManager.getAccessToken()).toBe(null);
    });

    it("should provide expired token scenario", () => {
      const scenario = TestScenarios.expiredToken();

      expect(scenario.authProvider.isTokenExpired("any-token")).toBe(true);
      expect(scenario.tokenManager.isTokenExpired("any-token")).toBe(true);
    });

    it("should provide Philippine admin scenario", () => {
      const scenario = TestScenarios.philippineAdmin();

      expect(scenario.user?.role).toBe("admin");
      expect(scenario.user?.preferredPaymentMethod).toBe("gcash");
      expect(scenario.user?.gcashNumber).toBeDefined();
      expect(scenario.user?.phoneNumber).toMatch(/^\+63/);
    });
  });

  describe("Environment-based Client Creation", () => {
    it("should create appropriate client based on environment", () => {
      // Test production environment
      container.setEnvironment("production");
      const prodClient = createEnvironmentClient();
      expect(prodClient).toBeInstanceOf(ApiClient);

      // Test development environment
      container.setEnvironment("development");
      const devClient = createEnvironmentClient();
      expect(devClient).toBeInstanceOf(ApiClient);

      // Test test environment
      container.setEnvironment("test");
      const testClient = createEnvironmentClient();
      expect(testClient).toBeInstanceOf(ApiClient);
    });
  });

  describe("Real API Integration Tests", () => {
    it("should handle authenticated requests with mock dependencies", async () => {
      const user = createMockUser();
      mockAuthProvider.setUser(user);
      mockAuthProvider.setToken("valid-token");
      mockAuthProvider.setProjectId(user.projects![0]);

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          data: user,
          message: "Success",
        })
      );

      const client = createApiClient({
        baseURL: "/api",
        authProvider: mockAuthProvider,
        tokenManager: mockTokenManager,
      });

      const response = await client.get("/auth/me");

      expect(response.success).toBe(true);
      expect(response.data).toEqual(user);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/auth/me"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer valid-token",
            "X-Project-Id": user.projects![0],
          }),
        })
      );
    });

    it("should handle token refresh scenario", async () => {
      const user = createMockUser();
      mockAuthProvider.setUser(user);
      mockAuthProvider.setToken("expired-token");
      mockAuthProvider.setTokenExpired(true);
      mockAuthProvider.setRefreshToken("valid-refresh-token");

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          data: user,
        })
      );

      const client = createApiClient({
        baseURL: "/api",
        authProvider: mockAuthProvider,
        tokenManager: mockTokenManager,
      });

      await client.get("/auth/me");

      // Should have triggered token refresh
      expect(mockAuthProvider.getToken()).toBe("new-access-token");
    });

    it("should handle logout on 401 error", async () => {
      mockAuthProvider.setToken("invalid-token");

      mockFetch.mockResolvedValueOnce(createMockErrorResponse("Unauthorized", 401));

      const client = createApiClient({
        baseURL: "/api",
        authProvider: mockAuthProvider,
        tokenManager: mockTokenManager,
      });

      try {
        await client.get("/auth/me");
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.status).toBe(401);
        expect(mockAuthProvider.wasLogoutCalled()).toBe(true);
      }
    });

    it("should handle requests without authentication", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "healthy",
          timestamp: new Date().toISOString(),
        })
      );

      const client = createApiClient({
        baseURL: "/api",
        authProvider: mockAuthProvider,
        tokenManager: mockTokenManager,
      });

      const response = await client.get("/health/check", { skipAuth: true });

      expect(response.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/health/check"),
        expect.not.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.any(String),
          }),
        })
      );
    });
  });

  describe("TestApiClientFactory", () => {
    it("should create client with authenticated user", () => {
      const { client, authProvider, tokenManager, user } =
        TestApiClientFactory.createWithAuthenticatedUser({ name: "Test User" });

      expect(client).toBeInstanceOf(ApiClient);
      expect(user?.name).toBe("Test User");
      expect(authProvider.getToken()).toBeTruthy();
      expect(tokenManager.getAccessToken()).toBeTruthy();
    });

    it("should create client with specific scenario", () => {
      const { client, authProvider, tokenManager, user } =
        TestApiClientFactory.createWithScenario("philippineAdmin");

      expect(client).toBeInstanceOf(ApiClient);
      expect(user?.role).toBe("admin");
      expect(user?.preferredPaymentMethod).toBe("gcash");
      expect(authProvider.getToken()).toBeTruthy();
    });
  });

  describe("Backward Compatibility", () => {
    it("should maintain compatibility with existing singleton instance", () => {
      // Import the existing singleton
      const { apiClient } = require("../api-client");

      expect(apiClient).toBeInstanceOf(ApiClient);

      // Should still work with existing methods
      expect(typeof apiClient.get).toBe("function");
      expect(typeof apiClient.post).toBe("function");
      expect(typeof apiClient.put).toBe("function");
      expect(typeof apiClient.patch).toBe("function");
      expect(typeof apiClient.delete).toBe("function");
      expect(typeof apiClient.upload).toBe("function");
    });

    it("should maintain compatibility with existing api helper functions", () => {
      const { api } = require("../api-client");

      expect(typeof api.get).toBe("function");
      expect(typeof api.post).toBe("function");
      expect(typeof api.getTyped).toBe("function");
      expect(typeof api.postTyped).toBe("function");
    });

    it("should work with existing auth store integration", async () => {
      // Mock the actual auth store
      const mockUseAuthStore = {
        getState: vi.fn().mockReturnValue({
          token: "test-token",
          refreshToken: "test-refresh-token",
          sessionExpiry: Date.now() + 3600000,
          user: createMockUser(),
        }),
      };

      vi.mock("@/stores/authStore", () => ({
        useAuthStore: mockUseAuthStore,
      }));

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          data: createMockUser(),
        })
      );

      // Use the default singleton (should use real auth store through default auth provider)
      const { apiClient } = require("../api-client");
      const response = await apiClient.get("/auth/me");

      expect(response.success).toBe(true);
    });
  });
});

describe("Philippine-specific Features Integration", () => {
  it("should handle GCash payment method preferences", () => {
    const user = createMockUser({
      preferredPaymentMethod: "gcash",
      gcashNumber: "09171234567",
    });

    expect(user.preferredPaymentMethod).toBe("gcash");
    expect(user.gcashNumber).toBe("09171234567");
  });

  it("should handle Philippine phone number formats", () => {
    const user = createMockUser({
      phoneNumber: "+63 917 123 4567",
    });

    expect(user.phoneNumber).toMatch(/^\+63/);
  });

  it("should support Philippine resort admin scenario", () => {
    const { user, authProvider } = TestScenarios.philippineAdmin();

    expect(user?.email).toMatch(/\.ph$/);
    expect(user?.name).toBe("Maria Santos");
    expect(user?.preferredPaymentMethod).toBe("gcash");
    expect(authProvider.getProjectId()).toBe("okaeri-resort-bohol");
  });
});
