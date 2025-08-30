/**
 * Auth Store Mock Helpers
 * Provides utilities for mocking authentication state in tests
 */

import {
  createAuthenticatedUser,
  createUser,
  type AuthenticatedUser,
} from "../factories/user.factory";
import type { User } from "@/types/common";

/**
 * Mock auth store interface
 */
export interface MockAuthStore {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: jest.Mock;
  logout: jest.Mock;
  register: jest.Mock;
  refreshSession: jest.Mock;
  updateUser: jest.Mock;
  clearError: jest.Mock;
}

/**
 * Create a mock auth store with default values
 */
export function createMockAuthStore(overrides?: Partial<MockAuthStore>): MockAuthStore {
  return {
    user: null,
    token: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    login: jest.fn(),
    logout: jest.fn(),
    register: jest.fn(),
    refreshSession: jest.fn(),
    updateUser: jest.fn(),
    clearError: jest.fn(),
    ...overrides,
  };
}

/**
 * Create an authenticated mock auth store
 */
export function createAuthenticatedMockAuthStore(
  user?: User,
  overrides?: Partial<MockAuthStore>
): MockAuthStore {
  const authData = createAuthenticatedUser(user ? { ...user } : undefined);

  return createMockAuthStore({
    user: authData.user,
    token: authData.token,
    refreshToken: authData.refreshToken,
    isAuthenticated: true,
    ...overrides,
  });
}

/**
 * Create a loading mock auth store
 */
export function createLoadingMockAuthStore(overrides?: Partial<MockAuthStore>): MockAuthStore {
  return createMockAuthStore({
    isLoading: true,
    ...overrides,
  });
}

/**
 * Create an error mock auth store
 */
export function createErrorMockAuthStore(
  error: string = "Authentication failed",
  overrides?: Partial<MockAuthStore>
): MockAuthStore {
  return createMockAuthStore({
    error,
    isAuthenticated: false,
    ...overrides,
  });
}

/**
 * Mock successful login
 */
export function mockSuccessfulLogin(authStore: MockAuthStore, user?: User): AuthenticatedUser {
  const authData = createAuthenticatedUser(user ? { ...user } : undefined);

  authStore.login.mockResolvedValue(authData);
  authStore.user = authData.user;
  authStore.token = authData.token;
  authStore.refreshToken = authData.refreshToken;
  authStore.isAuthenticated = true;
  authStore.error = null;

  return authData;
}

/**
 * Mock failed login
 */
export function mockFailedLogin(authStore: MockAuthStore, error: string = "Invalid credentials") {
  authStore.login.mockRejectedValue(new Error(error));
  authStore.error = error;
  authStore.isAuthenticated = false;
  authStore.user = null;
  authStore.token = null;
  authStore.refreshToken = null;
}

/**
 * Mock successful logout
 */
export function mockSuccessfulLogout(authStore: MockAuthStore) {
  authStore.logout.mockResolvedValue(undefined);
  authStore.user = null;
  authStore.token = null;
  authStore.refreshToken = null;
  authStore.isAuthenticated = false;
  authStore.error = null;
}

/**
 * Mock successful token refresh
 */
export function mockSuccessfulRefresh(authStore: MockAuthStore, user?: User) {
  const authData = createAuthenticatedUser(user || authStore.user || undefined);

  authStore.refreshSession.mockResolvedValue({
    token: authData.token,
    refreshToken: authData.refreshToken,
    expiresIn: authData.expiresIn,
  });

  authStore.token = authData.token;
  authStore.refreshToken = authData.refreshToken;
}

/**
 * Mock failed token refresh
 */
export function mockFailedRefresh(authStore: MockAuthStore, error: string = "Token expired") {
  authStore.refreshSession.mockRejectedValue(new Error(error));
  authStore.error = error;
  authStore.isAuthenticated = false;
  authStore.user = null;
  authStore.token = null;
  authStore.refreshToken = null;
}

/**
 * Mock auth API responses
 */
export class MockAuthAPI {
  private users: Map<string, { user: User; password: string }> = new Map();

  constructor() {
    // Add some default users
    this.addUser(createUser({ email: "admin@test.com", role: "admin" }), "Admin123!");
    this.addUser(createUser({ email: "user@test.com", role: "viewer" }), "User123!");
  }

  /**
   * Add a user to the mock database
   */
  addUser(user: User, password: string) {
    this.users.set(user.email, { user, password });
  }

  /**
   * Mock login endpoint
   */
  async login(email: string, password: string): Promise<AuthenticatedUser> {
    const userData = this.users.get(email);

    if (!userData || userData.password !== password) {
      throw new Error("Invalid credentials");
    }

    if (!userData.user.emailVerified) {
      throw new Error("Email not verified");
    }

    return createAuthenticatedUser(userData.user);
  }

  /**
   * Mock register endpoint
   */
  async register(email: string, password: string, fullName: string): Promise<AuthenticatedUser> {
    if (this.users.has(email)) {
      throw new Error("Email already registered");
    }

    const user = createUser({
      email,
      fullName,
      emailVerified: false,
      role: "viewer",
    });

    this.addUser(user, password);
    return createAuthenticatedUser(user);
  }

  /**
   * Mock refresh token endpoint
   */
  async refreshToken(refreshToken: string): Promise<{
    token: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    // Extract user ID from refresh token
    const userId = refreshToken.split("-")[1];

    // Find user by ID
    const userData = Array.from(this.users.values()).find(({ user }) => user.id === userId);

    if (!userData) {
      throw new Error("Invalid refresh token");
    }

    const authData = createAuthenticatedUser(userData.user);
    return {
      token: authData.token,
      refreshToken: authData.refreshToken,
      expiresIn: authData.expiresIn,
    };
  }

  /**
   * Mock get current user endpoint
   */
  async getCurrentUser(token: string): Promise<User> {
    // Parse token to get user ID
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid token");
    }

    try {
      const payload = JSON.parse(atob(parts[1]));
      const userData = Array.from(this.users.values()).find(({ user }) => user.id === payload.sub);

      if (!userData) {
        throw new Error("User not found");
      }

      return userData.user;
    } catch {
      throw new Error("Invalid token");
    }
  }

  /**
   * Clear all users (useful for test cleanup)
   */
  clear() {
    this.users.clear();
  }
}

/**
 * Create a mock auth API instance
 */
export function createMockAuthAPI(): MockAuthAPI {
  return new MockAuthAPI();
}

/**
 * Setup global auth mocks for testing
 */
export function setupAuthMocks() {
  const authAPI = createMockAuthAPI();
  const authStore = createMockAuthStore();

  // Mock global fetch for auth endpoints
  global.fetch = jest.fn((url: string, options?: RequestInit) => {
    const { method = "GET", body } = options || {};
    const data = body ? JSON.parse(body as string) : {};

    // Login endpoint
    if (url.includes("/api/auth/login") && method === "POST") {
      return authAPI
        .login(data.email, data.password)
        .then((response) =>
          Promise.resolve({
            ok: true,
            json: async () => response,
          } as Response)
        )
        .catch((error) =>
          Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({ error: error.message }),
          } as Response)
        );
    }

    // Register endpoint
    if (url.includes("/api/auth/register") && method === "POST") {
      return authAPI
        .register(data.email, data.password, data.fullName)
        .then((response) =>
          Promise.resolve({
            ok: true,
            json: async () => response,
          } as Response)
        )
        .catch((error) =>
          Promise.resolve({
            ok: false,
            status: 400,
            json: async () => ({ error: error.message }),
          } as Response)
        );
    }

    // Refresh token endpoint
    if (url.includes("/api/auth/refresh") && method === "POST") {
      return authAPI
        .refreshToken(data.refreshToken)
        .then((response) =>
          Promise.resolve({
            ok: true,
            json: async () => response,
          } as Response)
        )
        .catch((error) =>
          Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({ error: error.message }),
          } as Response)
        );
    }

    // Get current user endpoint
    if (url.includes("/api/auth/me") && method === "GET") {
      const token = options?.headers?.["Authorization"]?.replace("Bearer ", "");

      if (!token) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({ error: "Unauthorized" }),
        } as Response);
      }

      return authAPI
        .getCurrentUser(token)
        .then((response) =>
          Promise.resolve({
            ok: true,
            json: async () => response,
          } as Response)
        )
        .catch((error) =>
          Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({ error: error.message }),
          } as Response)
        );
    }

    // Default 404 response
    return Promise.resolve({
      ok: false,
      status: 404,
      json: async () => ({ error: "Not found" }),
    } as Response);
  }) as any;

  return {
    authAPI,
    authStore,
    cleanup: () => {
      jest.restoreAllMocks();
      authAPI.clear();
    },
  };
}
