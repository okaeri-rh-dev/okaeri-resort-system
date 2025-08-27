/**
 * Basic demonstration of API Client Dependency Injection
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createApiClient,
  type AuthProvider,
  type TokenManager,
  type ApiClientConfig,
} from "../api-client";
import { ApiClientFactory } from "../api-client-factory";

// Mock implementation of AuthProvider
class TestAuthProvider implements AuthProvider {
  private token = "test-token";
  private refreshToken = "test-refresh-token";
  private user = { id: "1", email: "test@example.com", name: "Test User", role: "admin" };
  private projectId = "test-project";

  getToken(): string | null {
    return this.token;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  getUser() {
    return this.user;
  }

  getProjectId(): string | null {
    return this.projectId;
  }

  async refreshSession(): Promise<void> {
    // Mock refresh
  }

  logout(): void {
    this.token = null;
  }

  isTokenExpired(): boolean {
    return false;
  }
}

// Mock implementation of TokenManager
class TestTokenManager implements TokenManager {
  private accessToken = "access-token";
  private refreshTokenValue = "refresh-token";

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getRefreshToken(): string | null {
    return this.refreshTokenValue;
  }

  storeTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    this.refreshTokenValue = refreshToken;
  }

  clearTokens(): void {
    this.accessToken = null;
    this.refreshTokenValue = null;
  }

  isTokenExpired(): boolean {
    return false;
  }

  validateTokenStructure(): { valid: boolean; error?: string } {
    return { valid: true };
  }
}

describe("API Client Dependency Injection Demo", () => {
  let mockAuthProvider: TestAuthProvider;
  let mockTokenManager: TestTokenManager;

  beforeEach(() => {
    mockAuthProvider = new TestAuthProvider();
    mockTokenManager = new TestTokenManager();
  });

  it("should create API client with custom dependencies", () => {
    const config: ApiClientConfig = {
      baseURL: "/api/test",
      timeout: 5000,
      authProvider: mockAuthProvider,
      tokenManager: mockTokenManager,
    };

    const client = createApiClient(config);
    expect(client).toBeDefined();
  });

  it("should create API client using factory", () => {
    const client = ApiClientFactory.createTestClient({
      authProvider: mockAuthProvider,
      tokenManager: mockTokenManager,
    });

    expect(client).toBeDefined();
  });

  it("should work with existing singleton for backward compatibility", async () => {
    const { apiClient } = await import("../api-client");
    expect(apiClient).toBeDefined();
    expect(typeof apiClient.get).toBe("function");
    expect(typeof apiClient.post).toBe("function");
  });

  it("should demonstrate mock auth provider behavior", () => {
    expect(mockAuthProvider.getToken()).toBe("test-token");
    expect(mockAuthProvider.getUser()?.email).toBe("test@example.com");

    mockAuthProvider.logout();
    expect(mockAuthProvider.getToken()).toBe(null);
  });

  it("should demonstrate mock token manager behavior", () => {
    expect(mockTokenManager.getAccessToken()).toBe("access-token");

    mockTokenManager.storeTokens("new-access", "new-refresh");
    expect(mockTokenManager.getAccessToken()).toBe("new-access");
    expect(mockTokenManager.getRefreshToken()).toBe("new-refresh");

    mockTokenManager.clearTokens();
    expect(mockTokenManager.getAccessToken()).toBe(null);
  });

  it("should support Philippine-specific user data", () => {
    const philippineUser = {
      id: "ph-1",
      email: "maria@okaeri-resort.ph",
      name: "Maria Santos",
      role: "admin" as const,
      phoneNumber: "+63 917 123 4567",
      preferredPaymentMethod: "gcash" as const,
      gcashNumber: "09171234567",
    };

    // Create custom auth provider with Philippine user
    class PhilippineAuthProvider extends TestAuthProvider {
      getUser() {
        return philippineUser;
      }
    }

    const philippineAuthProvider = new PhilippineAuthProvider();
    expect(philippineAuthProvider.getUser()?.preferredPaymentMethod).toBe("gcash");
    expect(philippineAuthProvider.getUser()?.phoneNumber).toMatch(/^\+63/);
  });
});

describe("Factory Configuration", () => {
  it("should configure factory defaults", () => {
    ApiClientFactory.configureDefaults({
      baseURL: "/custom/api",
      timeout: 10000,
    });

    const client = ApiClientFactory.createProductionClient();
    expect(client).toBeDefined();

    // Reset to defaults
    ApiClientFactory.reset();
  });

  it("should reset factory configuration", () => {
    ApiClientFactory.configureDefaults({
      baseURL: "/custom/api",
      timeout: 10000,
    });

    ApiClientFactory.reset();

    // Should work with reset configuration
    const client = ApiClientFactory.createProductionClient();
    expect(client).toBeDefined();
  });
});
