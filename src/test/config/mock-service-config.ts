/**
 * Deterministic Mock Service Configuration
 * Central configuration for all mock services with deterministic behavior
 */

import type {
  MockServiceConfig,
  ErrorSimulatorConfig,
  TestLevel,
  TestScenario,
} from "../types/test-interfaces";

// ====================================
// TEST SCENARIO CONFIGURATIONS
// ====================================

/**
 * Predefined test scenario configurations
 */
export const TEST_SCENARIOS = {
  // Unit testing - no errors, minimal delays
  STABLE: {
    deterministic: true,
    errorRate: 0,
    networkDelay: { min: 0, max: 10 },
    seed: "stable-test-seed",
    forceScenarios: [],
  },

  // Integration testing - controlled errors
  CONTROLLED_ERRORS: {
    deterministic: true,
    errorRate: 0.1, // 10% controlled error rate
    networkDelay: { min: 10, max: 50 },
    seed: "controlled-error-seed",
    forceScenarios: [],
  },

  // E2E testing - realistic network conditions
  REALISTIC: {
    deterministic: true,
    errorRate: 0.05, // 5% realistic error rate
    networkDelay: { min: 100, max: 300 },
    seed: "realistic-test-seed",
    forceScenarios: [],
  },

  // Stress testing - higher error rates and delays
  STRESS: {
    deterministic: true,
    errorRate: 0.15, // 15% error rate for stress testing
    networkDelay: { min: 500, max: 1000 },
    seed: "stress-test-seed",
    forceScenarios: [],
  },

  // Error-focused testing - force specific errors
  ERROR_FOCUSED: {
    deterministic: true,
    errorRate: 1.0, // 100% error rate when forced
    networkDelay: { min: 50, max: 100 },
    seed: "error-focused-seed",
    forceScenarios: ["networkError", "validationError"],
  },

  // Development mode - non-deterministic, realistic
  DEVELOPMENT: {
    deterministic: false,
    errorRate: 0.05,
    networkDelay: { min: 200, max: 800 },
    seed: undefined,
    forceScenarios: [],
  },
} as const;

/**
 * Get configuration for specific test level and scenario
 */
export function getTestConfig(
  level: TestLevel,
  scenario: TestScenario = "standard"
): MockServiceConfig {
  const baseConfigs = {
    unit: {
      minimal: TEST_SCENARIOS.STABLE,
      standard: TEST_SCENARIOS.STABLE,
      comprehensive: { ...TEST_SCENARIOS.STABLE, errorRate: 0.02 },
      stress: TEST_SCENARIOS.CONTROLLED_ERRORS,
    },
    integration: {
      minimal: TEST_SCENARIOS.STABLE,
      standard: TEST_SCENARIOS.CONTROLLED_ERRORS,
      comprehensive: TEST_SCENARIOS.REALISTIC,
      stress: TEST_SCENARIOS.STRESS,
    },
    e2e: {
      minimal: TEST_SCENARIOS.CONTROLLED_ERRORS,
      standard: TEST_SCENARIOS.REALISTIC,
      comprehensive: TEST_SCENARIOS.REALISTIC,
      stress: TEST_SCENARIOS.STRESS,
    },
  };

  return baseConfigs[level][scenario] || TEST_SCENARIOS.DEVELOPMENT;
}

// ====================================
// ERROR SCENARIO DEFINITIONS
// ====================================

/**
 * Standard error scenarios for mock services
 */
export const ERROR_SCENARIOS = {
  networkError: {
    probability: 0.05,
    error: new Error("Network request failed"),
    retryable: true,
    httpStatus: 0,
  },

  timeout: {
    probability: 0.02,
    error: new Error("Request timeout"),
    retryable: true,
    httpStatus: 408,
  },

  serverError: {
    probability: 0.03,
    error: new Error("Internal server error"),
    retryable: false,
    httpStatus: 500,
  },

  validationError: {
    probability: 0.1,
    error: new Error("Validation failed"),
    retryable: false,
    httpStatus: 400,
  },

  authError: {
    probability: 0.02,
    error: new Error("Unauthorized"),
    retryable: false,
    httpStatus: 401,
  },

  rateLimitError: {
    probability: 0.01,
    error: new Error("Rate limit exceeded"),
    retryable: true,
    httpStatus: 429,
  },

  notFoundError: {
    probability: 0.05,
    error: new Error("Resource not found"),
    retryable: false,
    httpStatus: 404,
  },

  conflictError: {
    probability: 0.03,
    error: new Error("Resource conflict"),
    retryable: false,
    httpStatus: 409,
  },
} as const;

// ====================================
// SERVICE-SPECIFIC CONFIGURATIONS
// ====================================

/**
 * Configuration for authentication service
 */
export const AUTH_SERVICE_CONFIG = {
  baseConfig: TEST_SCENARIOS.STABLE,
  customDelays: {
    login: { min: 200, max: 800 },
    logout: { min: 100, max: 300 },
    register: { min: 500, max: 1200 },
    refresh: { min: 150, max: 400 },
  },
  errorScenarios: ["authError", "validationError", "rateLimitError", "networkError"],
};

/**
 * Configuration for booking service
 */
export const BOOKING_SERVICE_CONFIG = {
  baseConfig: TEST_SCENARIOS.REALISTIC,
  customDelays: {
    list: { min: 300, max: 600 },
    get: { min: 150, max: 300 },
    create: { min: 500, max: 1000 },
    update: { min: 400, max: 800 },
    delete: { min: 200, max: 400 },
    checkAvailability: { min: 400, max: 800 },
  },
  errorScenarios: [
    "validationError",
    "conflictError",
    "notFoundError",
    "networkError",
    "serverError",
  ],
};

/**
 * Configuration for expense service
 */
export const EXPENSE_SERVICE_CONFIG = {
  baseConfig: TEST_SCENARIOS.CONTROLLED_ERRORS,
  customDelays: {
    list: { min: 200, max: 500 },
    get: { min: 100, max: 200 },
    create: { min: 300, max: 600 },
    update: { min: 250, max: 500 },
    delete: { min: 150, max: 300 },
  },
  errorScenarios: ["validationError", "authError", "notFoundError", "networkError"],
};

/**
 * Configuration for payment service
 */
export const PAYMENT_SERVICE_CONFIG = {
  baseConfig: TEST_SCENARIOS.REALISTIC,
  customDelays: {
    list: { min: 250, max: 500 },
    get: { min: 150, max: 300 },
    create: { min: 800, max: 1500 }, // Payment processing takes longer
    update: { min: 400, max: 800 },
    verify: { min: 600, max: 1200 },
  },
  errorScenarios: ["validationError", "serverError", "timeout", "networkError", "conflictError"],
};

// ====================================
// CONFIGURATION BUILDER
// ====================================

/**
 * Mock service configuration builder
 */
export class MockConfigBuilder {
  private config: Partial<MockServiceConfig> = {};

  /**
   * Set base scenario
   */
  scenario(scenarioName: keyof typeof TEST_SCENARIOS): this {
    this.config = { ...TEST_SCENARIOS[scenarioName] };
    return this;
  }

  /**
   * Set deterministic mode
   */
  deterministic(enabled: boolean): this {
    this.config.deterministic = enabled;
    return this;
  }

  /**
   * Set error rate
   */
  errorRate(rate: number): this {
    this.config.errorRate = Math.max(0, Math.min(1, rate));
    return this;
  }

  /**
   * Set network delay range
   */
  networkDelay(min: number, max: number): this {
    this.config.networkDelay = { min, max };
    return this;
  }

  /**
   * Set random seed
   */
  seed(seedValue: string): this {
    this.config.seed = seedValue;
    return this;
  }

  /**
   * Force specific error scenarios
   */
  forceErrors(scenarios: string[]): this {
    this.config.forceScenarios = [...scenarios];
    return this;
  }

  /**
   * Add forced error scenario
   */
  addForcedError(scenario: string): this {
    if (!this.config.forceScenarios) {
      this.config.forceScenarios = [];
    }
    if (!this.config.forceScenarios.includes(scenario)) {
      this.config.forceScenarios.push(scenario);
    }
    return this;
  }

  /**
   * Build final configuration
   */
  build(): MockServiceConfig {
    return {
      deterministic: true,
      errorRate: 0,
      networkDelay: { min: 0, max: 10 },
      seed: "default-seed",
      forceScenarios: [],
      ...this.config,
    };
  }
}

/**
 * Create mock configuration builder
 */
export function createMockConfig(): MockConfigBuilder {
  return new MockConfigBuilder();
}

// ====================================
// ENVIRONMENT-SPECIFIC CONFIGURATIONS
// ====================================

/**
 * Get configuration based on environment
 */
export function getEnvironmentConfig(): MockServiceConfig {
  const nodeEnv = process.env.NODE_ENV;
  const testEnv = process.env.VITEST || process.env.JEST_WORKER_ID;

  // Test environment - deterministic
  if (testEnv || nodeEnv === "test") {
    return TEST_SCENARIOS.STABLE;
  }

  // Development environment - realistic but controllable
  if (nodeEnv === "development") {
    return TEST_SCENARIOS.DEVELOPMENT;
  }

  // Production - should not use mocks
  if (nodeEnv === "production") {
    throw new Error("🚨 Mock services cannot be used in production environment");
  }

  // Default to development-like behavior
  return TEST_SCENARIOS.DEVELOPMENT;
}

// ====================================
// CONFIGURATION PRESETS
// ====================================

/**
 * Common configuration presets for different testing scenarios
 */
export const CONFIG_PRESETS = {
  /**
   * Unit test preset - fast, deterministic, no errors
   */
  UNIT_TESTS: createMockConfig()
    .scenario("STABLE")
    .deterministic(true)
    .errorRate(0)
    .networkDelay(0, 5)
    .seed("unit-test-preset")
    .build(),

  /**
   * Integration test preset - controlled errors, moderate delays
   */
  INTEGRATION_TESTS: createMockConfig()
    .scenario("CONTROLLED_ERRORS")
    .deterministic(true)
    .errorRate(0.05)
    .networkDelay(10, 50)
    .seed("integration-test-preset")
    .build(),

  /**
   * E2E test preset - realistic conditions
   */
  E2E_TESTS: createMockConfig()
    .scenario("REALISTIC")
    .deterministic(true)
    .errorRate(0.03)
    .networkDelay(100, 300)
    .seed("e2e-test-preset")
    .build(),

  /**
   * Performance test preset - stress conditions
   */
  PERFORMANCE_TESTS: createMockConfig()
    .scenario("STRESS")
    .deterministic(true)
    .errorRate(0.1)
    .networkDelay(200, 500)
    .seed("performance-test-preset")
    .build(),

  /**
   * Error testing preset - force specific errors
   */
  ERROR_TESTS: createMockConfig()
    .scenario("ERROR_FOCUSED")
    .deterministic(true)
    .errorRate(0.8)
    .networkDelay(50, 100)
    .seed("error-test-preset")
    .forceErrors(["validationError", "networkError", "serverError"])
    .build(),

  /**
   * Development preset - non-deterministic, realistic
   */
  DEVELOPMENT: createMockConfig()
    .scenario("DEVELOPMENT")
    .deterministic(false)
    .errorRate(0.05)
    .networkDelay(200, 800)
    .build(),
};

// ====================================
// CONFIGURATION VALIDATION
// ====================================

/**
 * Validate mock service configuration
 */
export function validateMockConfig(config: MockServiceConfig): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check error rate
  if (config.errorRate < 0 || config.errorRate > 1) {
    errors.push("Error rate must be between 0 and 1");
  }

  // Check network delay
  if (config.networkDelay.min < 0) {
    errors.push("Minimum network delay cannot be negative");
  }

  if (config.networkDelay.max < config.networkDelay.min) {
    errors.push("Maximum network delay must be greater than or equal to minimum");
  }

  // Check deterministic mode requirements
  if (config.deterministic && !config.seed) {
    warnings.push("Deterministic mode enabled but no seed provided");
  }

  // Check error scenarios
  if (config.forceScenarios && config.forceScenarios.length > 0) {
    const validScenarios = Object.keys(ERROR_SCENARIOS);
    const invalidScenarios = config.forceScenarios.filter(
      (scenario) => !validScenarios.includes(scenario)
    );

    if (invalidScenarios.length > 0) {
      errors.push(`Invalid error scenarios: ${invalidScenarios.join(", ")}`);
    }
  }

  // Performance warnings
  if (config.networkDelay.max > 2000) {
    warnings.push("Network delay over 2 seconds may slow down tests significantly");
  }

  if (config.errorRate > 0.5) {
    warnings.push("High error rate may cause excessive test failures");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ====================================
// UTILITIES
// ====================================

/**
 * Convert string to seed number for deterministic random generation
 */
export function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Create seeded random function
 */
export function createSeededRandom(seed: string): () => number {
  let seedNumber = stringToSeed(seed);

  return () => {
    seedNumber = (seedNumber * 9301 + 49297) % 233280;
    return seedNumber / 233280;
  };
}

/**
 * Calculate delay based on configuration
 */
export function calculateDelay(
  config: MockServiceConfig,
  operation?: string,
  serviceConfig?: any
): number {
  // Use service-specific delay if available
  if (serviceConfig?.customDelays?.[operation]) {
    const delay = serviceConfig.customDelays[operation];
    return config.deterministic
      ? delay.min
      : Math.floor(Math.random() * (delay.max - delay.min + 1)) + delay.min;
  }

  // Use general network delay
  return config.deterministic
    ? config.networkDelay.min
    : Math.floor(Math.random() * (config.networkDelay.max - config.networkDelay.min + 1)) +
        config.networkDelay.min;
}

/**
 * Check if error should be simulated
 */
export function shouldSimulateError(
  config: MockServiceConfig,
  scenario?: string,
  randomFn?: () => number
): boolean {
  // Force specific scenarios
  if (config.forceScenarios && scenario && config.forceScenarios.includes(scenario)) {
    return true;
  }

  // Use seeded or regular random
  const random =
    randomFn ||
    (config.deterministic && config.seed ? createSeededRandom(config.seed) : Math.random);

  return random() < config.errorRate;
}

/**
 * Default export with common configurations
 */
export default {
  TEST_SCENARIOS,
  CONFIG_PRESETS,
  ERROR_SCENARIOS,
  getTestConfig,
  getEnvironmentConfig,
  createMockConfig,
  validateMockConfig,
  AUTH_SERVICE_CONFIG,
  BOOKING_SERVICE_CONFIG,
  EXPENSE_SERVICE_CONFIG,
  PAYMENT_SERVICE_CONFIG,
};
