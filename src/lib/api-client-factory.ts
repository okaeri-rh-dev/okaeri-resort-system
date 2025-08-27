/**
 * API Client Factory with Dependency Injection
 *
 * This factory provides different configurations for API clients:
 * - Production configuration with real dependencies
 * - Test configuration with mock dependencies
 * - Custom configuration for specific needs
 *
 * Enables TDD by allowing easy swapping between real and mock implementations.
 */

import {
  createApiClient,
  type ApiClientConfig,
  type AuthProvider,
  type TokenManager,
} from "./api-client";
import type { User } from "@/types/common";

/**
 * Factory configuration options
 */
export interface ApiClientFactoryConfig {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
  environment?: "production" | "test" | "development";
  authProvider?: AuthProvider;
  tokenManager?: TokenManager;
}

/**
 * Dependency injection container for API client dependencies
 */
export class DependencyContainer {
  private static instance: DependencyContainer;
  private authProvider?: AuthProvider;
  private tokenManager?: TokenManager;
  private environment: "production" | "test" | "development" = "production";

  private constructor() {}

  static getInstance(): DependencyContainer {
    if (!DependencyContainer.instance) {
      DependencyContainer.instance = new DependencyContainer();
    }
    return DependencyContainer.instance;
  }

  setAuthProvider(authProvider: AuthProvider): this {
    this.authProvider = authProvider;
    return this;
  }

  setTokenManager(tokenManager: TokenManager): this {
    this.tokenManager = tokenManager;
    return this;
  }

  setEnvironment(environment: "production" | "test" | "development"): this {
    this.environment = environment;
    return this;
  }

  getAuthProvider(): AuthProvider | undefined {
    return this.authProvider;
  }

  getTokenManager(): TokenManager | undefined {
    return this.tokenManager;
  }

  getEnvironment(): "production" | "test" | "development" {
    return this.environment;
  }

  reset(): void {
    this.authProvider = undefined;
    this.tokenManager = undefined;
    this.environment = "production";
  }
}

/**
 * API Client Factory
 */
export class ApiClientFactory {
  private static defaultConfig: ApiClientFactoryConfig = {
    baseURL: (typeof window !== "undefined" && (window as any).VITE_API_URL) || "/api",
    timeout: 30000,
    environment: "production",
  };

  /**
   * Create API client for production use with real dependencies
   */
  static createProductionClient(config: Partial<ApiClientFactoryConfig> = {}) {
    const container = DependencyContainer.getInstance();

    const finalConfig: ApiClientConfig = {
      baseURL: config.baseURL || this.defaultConfig.baseURL || "/api",
      timeout: config.timeout || this.defaultConfig.timeout || 30000,
      headers: config.headers || this.defaultConfig.headers,
      // Use container dependencies if available, otherwise let API client use defaults
      authProvider: config.authProvider || container.getAuthProvider(),
      tokenManager: config.tokenManager || container.getTokenManager(),
    };

    return createApiClient(finalConfig);
  }

  /**
   * Create API client for testing with mock dependencies
   * This will be populated by the test doubles file
   */
  static createTestClient(config: Partial<ApiClientFactoryConfig> = {}) {
    const container = DependencyContainer.getInstance();

    const finalConfig: ApiClientConfig = {
      baseURL: config.baseURL || "/api/test",
      timeout: config.timeout || 5000, // Shorter timeout for tests
      headers: {
        ...this.defaultConfig.headers,
        ...config.headers,
      },
      authProvider: config.authProvider || container.getAuthProvider(),
      tokenManager: config.tokenManager || container.getTokenManager(),
    };

    return createApiClient(finalConfig);
  }

  /**
   * Create API client for development with optional debugging features
   */
  static createDevelopmentClient(config: Partial<ApiClientFactoryConfig> = {}) {
    const container = DependencyContainer.getInstance();

    const finalConfig: ApiClientConfig = {
      baseURL: config.baseURL || this.defaultConfig.baseURL || "/api",
      timeout: config.timeout || this.defaultConfig.timeout || 30000,
      headers: {
        "X-Debug-Mode": "true",
        ...this.defaultConfig.headers,
        ...config.headers,
      },
      authProvider: config.authProvider || container.getAuthProvider(),
      tokenManager: config.tokenManager || container.getTokenManager(),
    };

    return createApiClient(finalConfig);
  }

  /**
   * Create API client with completely custom configuration
   */
  static createCustomClient(config: ApiClientFactoryConfig) {
    return createApiClient(config);
  }

  /**
   * Configure default settings for all clients
   */
  static configureDefaults(config: Partial<ApiClientFactoryConfig>): void {
    this.defaultConfig = {
      baseURL: config.baseURL || this.defaultConfig.baseURL || "/api",
      timeout: config.timeout || this.defaultConfig.timeout || 30000,
      environment: config.environment || this.defaultConfig.environment || "production",
      headers: {
        ...this.defaultConfig.headers,
        ...config.headers,
      },
    };
  }

  /**
   * Reset factory to default configuration
   */
  static reset(): void {
    this.defaultConfig = {
      baseURL: (typeof window !== "undefined" && (window as any).VITE_API_URL) || "/api",
      timeout: 30000,
      environment: "production",
    };
    DependencyContainer.getInstance().reset();
  }
}

/**
 * Helper functions for common patterns
 */

/**
 * Setup for testing - configures the factory with test dependencies
 */
export function setupTestEnvironment(authProvider: AuthProvider, tokenManager: TokenManager) {
  const container = DependencyContainer.getInstance();
  container.setEnvironment("test").setAuthProvider(authProvider).setTokenManager(tokenManager);
}

/**
 * Setup for production - ensures clean production state
 */
export function setupProductionEnvironment() {
  const container = DependencyContainer.getInstance();
  container
    .setEnvironment("production")
    .setAuthProvider(undefined) // Use defaults
    .setTokenManager(undefined); // Use defaults
}

/**
 * Create API client based on current environment
 */
export function createEnvironmentClient(config: Partial<ApiClientFactoryConfig> = {}) {
  const container = DependencyContainer.getInstance();
  const environment = container.getEnvironment();

  switch (environment) {
    case "test":
      return ApiClientFactory.createTestClient(config);
    case "development":
      return ApiClientFactory.createDevelopmentClient(config);
    case "production":
    default:
      return ApiClientFactory.createProductionClient(config);
  }
}

// Export singleton instances for convenience
export const dependencyContainer = DependencyContainer.getInstance();
export { ApiClientFactory as default };
