/**
 * Test Doubles for API Client Dependencies
 *
 * This file provides mock implementations of AuthProvider and TokenManager
 * for testing purposes, enabling fast and isolated unit tests.
 *
 * Features:
 * - MockAuthProvider with configurable behavior
 * - MockTokenManager with in-memory token storage
 * - Philippine-specific testing scenarios (GCash, etc.)
 * - Test helper functions for common scenarios
 */

import type { User } from "@/types/common";
import type { AuthProvider, TokenManager } from "@/lib/api-client";
import { ApiClientFactory, setupTestEnvironment } from "@/lib/api-client-factory";

/**
 * Mock User factory for testing
 */
export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: "test-user-1",
    email: "test@okaeri-resort.com",
    name: "Test User",
    role: "admin",
    projects: ["test-project-1"],
    isVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // Philippine-specific fields
    phoneNumber: "+63 912 345 6789",
    preferredPaymentMethod: "gcash",
    gcashNumber: "09123456789",
    ...overrides,
  };
}

/**
 * Mock AuthProvider for testing
 */
export class MockAuthProvider implements AuthProvider {
  private token: string | null = null;
  private refreshToken: string | null = null;
  private user: User | null = null;
  private projectId: string | null = null;
  private isTokenExpiredValue: boolean = false;
  private refreshSessionShouldFail: boolean = false;
  private logoutCalled: boolean = false;

  constructor(
    initialState: {
      token?: string | null;
      refreshToken?: string | null;
      user?: User | null;
      projectId?: string | null;
    } = {}
  ) {
    this.token = initialState.token || null;
    this.refreshToken = initialState.refreshToken || null;
    this.user = initialState.user || null;
    this.projectId = initialState.projectId || null;
  }

  getToken(): string | null {
    return this.token;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  getUser(): User | null {
    return this.user;
  }

  getProjectId(): string | null {
    return this.projectId;
  }

  async refreshSession(): Promise<void> {
    if (this.refreshSessionShouldFail) {
      throw new Error("Refresh session failed");
    }
    // Simulate successful refresh
    this.token = "new-access-token";
    this.refreshToken = "new-refresh-token";
  }

  logout(): void {
    this.logoutCalled = true;
    this.token = null;
    this.refreshToken = null;
    this.user = null;
    this.projectId = null;
  }

  isTokenExpired(token: string, buffer?: number): boolean {
    return this.isTokenExpiredValue;
  }

  // Test helper methods
  setToken(token: string | null): void {
    this.token = token;
  }

  setRefreshToken(refreshToken: string | null): void {
    this.refreshToken = refreshToken;
  }

  setUser(user: User | null): void {
    this.user = user;
  }

  setProjectId(projectId: string | null): void {
    this.projectId = projectId;
  }

  setTokenExpired(expired: boolean): void {
    this.isTokenExpiredValue = expired;
  }

  setRefreshSessionShouldFail(shouldFail: boolean): void {
    this.refreshSessionShouldFail = shouldFail;
  }

  wasLogoutCalled(): boolean {
    return this.logoutCalled;
  }

  reset(): void {
    this.token = null;
    this.refreshToken = null;
    this.user = null;
    this.projectId = null;
    this.isTokenExpiredValue = false;
    this.refreshSessionShouldFail = false;
    this.logoutCalled = false;
  }
}

/**
 * Mock TokenManager for testing
 */
export class MockTokenManager implements TokenManager {
  private accessToken: string | null = null;
  private refreshTokenValue: string | null = null;
  private isTokenExpiredValue: boolean = false;
  private tokenValidationResult: { valid: boolean; error?: string } = { valid: true };

  constructor(
    initialState: {
      accessToken?: string | null;
      refreshToken?: string | null;
    } = {}
  ) {
    this.accessToken = initialState.accessToken || null;
    this.refreshTokenValue = initialState.refreshToken || null;
  }

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

  isTokenExpired(token: string, buffer?: number): boolean {
    return this.isTokenExpiredValue;
  }

  validateTokenStructure(token: string): { valid: boolean; error?: string } {
    return this.tokenValidationResult;
  }

  // Test helper methods
  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  setRefreshToken(token: string | null): void {
    this.refreshTokenValue = token;
  }

  setTokenExpired(expired: boolean): void {
    this.isTokenExpiredValue = expired;
  }

  setTokenValidationResult(result: { valid: boolean; error?: string }): void {
    this.tokenValidationResult = result;
  }

  reset(): void {
    this.accessToken = null;
    this.refreshTokenValue = null;
    this.isTokenExpiredValue = false;
    this.tokenValidationResult = { valid: true };
  }
}

/**
 * Pre-configured test scenarios
 */
export const TestScenarios = {
  /**
   * Authenticated user with valid tokens
   */
  authenticatedUser: () => {
    const user = createMockUser();
    const authProvider = new MockAuthProvider({
      token: "valid-access-token",
      refreshToken: "valid-refresh-token",
      user,
      projectId: user.projects![0],
    });
    const tokenManager = new MockTokenManager({
      accessToken: "valid-access-token",
      refreshToken: "valid-refresh-token",
    });

    return { user, authProvider, tokenManager };
  },

  /**
   * Unauthenticated user
   */
  unauthenticatedUser: () => {
    const authProvider = new MockAuthProvider();
    const tokenManager = new MockTokenManager();

    return { user: null, authProvider, tokenManager };
  },

  /**
   * User with expired token
   */
  expiredToken: () => {
    const user = createMockUser();
    const authProvider = new MockAuthProvider({
      token: "expired-token",
      refreshToken: "valid-refresh-token",
      user,
      projectId: user.projects![0],
    });
    authProvider.setTokenExpired(true);

    const tokenManager = new MockTokenManager({
      accessToken: "expired-token",
      refreshToken: "valid-refresh-token",
    });
    tokenManager.setTokenExpired(true);

    return { user, authProvider, tokenManager };
  },

  /**
   * User with refresh failure scenario
   */
  refreshFailure: () => {
    const user = createMockUser();
    const authProvider = new MockAuthProvider({
      token: "expired-token",
      refreshToken: "invalid-refresh-token",
      user,
      projectId: user.projects![0],
    });
    authProvider.setTokenExpired(true);
    authProvider.setRefreshSessionShouldFail(true);

    const tokenManager = new MockTokenManager({
      accessToken: "expired-token",
      refreshToken: "invalid-refresh-token",
    });
    tokenManager.setTokenExpired(true);

    return { user, authProvider, tokenManager };
  },

  /**
   * Philippine resort admin with GCash payment preferences
   */
  philippineAdmin: () => {
    const user = createMockUser({
      role: "admin",
      phoneNumber: "+63 917 123 4567",
      preferredPaymentMethod: "gcash",
      gcashNumber: "09171234567",
      name: "Maria Santos",
      email: "maria.santos@okaeri-resort.ph",
    });
    const authProvider = new MockAuthProvider({
      token: "valid-admin-token",
      refreshToken: "valid-admin-refresh-token",
      user,
      projectId: "okaeri-resort-bohol",
    });
    const tokenManager = new MockTokenManager({
      accessToken: "valid-admin-token",
      refreshToken: "valid-admin-refresh-token",
    });

    return { user, authProvider, tokenManager };
  },

  /**
   * Staff member with limited permissions
   */
  staffMember: () => {
    const user = createMockUser({
      role: "staff",
      phoneNumber: "+63 912 987 6543",
      name: "Juan Dela Cruz",
      email: "juan.delacruz@okaeri-resort.ph",
      projects: ["okaeri-resort-bohol"],
    });
    const authProvider = new MockAuthProvider({
      token: "valid-staff-token",
      refreshToken: "valid-staff-refresh-token",
      user,
      projectId: "okaeri-resort-bohol",
    });
    const tokenManager = new MockTokenManager({
      accessToken: "valid-staff-token",
      refreshToken: "valid-staff-refresh-token",
    });

    return { user, authProvider, tokenManager };
  },
};

/**
 * Test API Client Factory
 */
export class TestApiClientFactory {
  /**
   * Create API client with mock authenticated user
   */
  static createWithAuthenticatedUser(userOverrides: Partial<User> = {}) {
    const user = createMockUser(userOverrides);
    const authProvider = new MockAuthProvider({
      token: "valid-token",
      refreshToken: "valid-refresh-token",
      user,
      projectId: user.projects![0],
    });
    const tokenManager = new MockTokenManager({
      accessToken: "valid-token",
      refreshToken: "valid-refresh-token",
    });

    setupTestEnvironment(authProvider, tokenManager);
    return {
      client: ApiClientFactory.createTestClient(),
      authProvider,
      tokenManager,
      user,
    };
  }

  /**
   * Create API client with unauthenticated user
   */
  static createWithUnauthenticatedUser() {
    const authProvider = new MockAuthProvider();
    const tokenManager = new MockTokenManager();

    setupTestEnvironment(authProvider, tokenManager);
    return {
      client: ApiClientFactory.createTestClient(),
      authProvider,
      tokenManager,
      user: null,
    };
  }

  /**
   * Create API client with specific scenario
   */
  static createWithScenario(scenario: keyof typeof TestScenarios) {
    const { user, authProvider, tokenManager } = TestScenarios[scenario]();

    setupTestEnvironment(authProvider, tokenManager);
    return {
      client: ApiClientFactory.createTestClient(),
      authProvider,
      tokenManager,
      user,
    };
  }

  /**
   * Create API client with custom mocks
   */
  static createWithCustomMocks(authProvider: MockAuthProvider, tokenManager: MockTokenManager) {
    setupTestEnvironment(authProvider, tokenManager);
    return {
      client: ApiClientFactory.createTestClient(),
      authProvider,
      tokenManager,
    };
  }
}

/**
 * Test helper functions
 */

/**
 * Wait for async operations to complete
 */
export const waitForAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Create a mock fetch response
 */
export function createMockResponse(
  data: any,
  options: {
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
  } = {}
) {
  const {
    status = 200,
    statusText = "OK",
    headers = { "Content-Type": "application/json" },
  } = options;

  return new Response(JSON.stringify(data), {
    status,
    statusText,
    headers,
  });
}

/**
 * Create a mock error response
 */
export function createMockErrorResponse(message: string, status: number = 400) {
  return new Response(
    JSON.stringify({
      message,
      error: message,
      status,
    }),
    {
      status,
      statusText: "Error",
      headers: { "Content-Type": "application/json" },
    }
  );
}

/**
 * Philippine-specific test data generators
 */
export const PhilippineTestData = {
  phoneNumbers: [
    "+63 912 345 6789",
    "+63 917 123 4567",
    "+63 932 987 6543",
    "09123456789",
    "09171234567",
  ],

  gcashNumbers: ["09123456789", "09171234567", "09321234567"],

  provinces: ["Bohol", "Cebu", "Palawan", "Siargao", "Boracay"],

  resortNames: [
    "Okaeri Resort Bohol",
    "Okaeri Beach Resort Palawan",
    "Okaeri Island Resort Siargao",
  ],
};

// MockAuthProvider and MockTokenManager are already exported above
