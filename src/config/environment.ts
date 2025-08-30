/**
 * Standardized Environment Configuration for Vite-based Resort System
 *
 * This module provides type-safe access to environment variables and configuration
 * for the resort management system. All browser-accessible variables must be prefixed
 * with VITE_ to be exposed by Vite.
 *
 * @fileoverview Environment configuration with proper Vite compatibility
 */

import { z } from "zod";

/**
 * API Mode type definition
 * - mock: Use mock services for development
 * - real: Use real API endpoints
 * - test: Use deterministic mock services for testing
 */
export type ApiMode = "mock" | "real" | "test";

/**
 * Test scenario types for deterministic testing
 */
export type TestScenario = "STABLE" | "ERROR_PRONE" | "SLOW_NETWORK";

/**
 * Environment variable schema with Vite-compatible naming
 * All browser-accessible variables must have VITE_ prefix
 */
const environmentSchema = z.object({
  // Core API Configuration
  VITE_API_MODE: z.enum(["mock", "real", "test"]).default("mock"),
  VITE_API_URL: z.string().default("/api"),

  // Test Configuration (for deterministic testing)
  VITE_TEST_SCENARIO: z.enum(["STABLE", "ERROR_PRONE", "SLOW_NETWORK"]).default("STABLE"),
  VITE_TEST_SEED: z.string().default("stable-test-seed"),

  // Application Settings
  VITE_APP_NAME: z.string().default("Okaeri Resort Management System"),
  VITE_APP_VERSION: z.string().default("1.0.0"),
  VITE_APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  VITE_APP_URL: z.string().url().default("http://localhost:5173"),
  VITE_PUBLIC_URL: z.string().url().default("http://localhost:5173"),

  // Regional Settings
  VITE_APP_TIMEZONE: z.string().default("Asia/Manila"),
  VITE_APP_LOCALE: z.string().default("en-PH"),
  VITE_APP_CURRENCY: z.string().default("PHP"),
  VITE_APP_DATE_FORMAT: z.string().default("MM/DD/YYYY"),
  VITE_COUNTRY_CODE: z.string().default("PH"),
  VITE_PHONE_PREFIX: z.string().default("+63"),

  // API Configuration
  VITE_API_TIMEOUT: z.string().transform(Number).default("30000"),
  VITE_API_RETRY_ATTEMPTS: z.string().transform(Number).default("3"),

  // Development Settings
  VITE_ENABLE_DEVTOOLS: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
  VITE_ENABLE_MOCK_DATA: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
  VITE_ENABLE_API_LOGS: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
  VITE_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  VITE_SHOW_MOCK_INDICATOR: z
    .string()
    .transform((val) => val === "true")
    .default("false"),

  // Security Settings
  VITE_ENABLE_CSRF: z
    .string()
    .transform((val) => val === "true")
    .default("true"),

  // Feature Flags
  VITE_FEATURE_BOOKINGS: z
    .string()
    .transform((val) => val === "true")
    .default("true"),
  VITE_FEATURE_FINANCES: z
    .string()
    .transform((val) => val === "true")
    .default("true"),
  VITE_FEATURE_REPORTS: z
    .string()
    .transform((val) => val === "true")
    .default("true"),
  VITE_FEATURE_MULTI_PROJECT: z
    .string()
    .transform((val) => val === "true")
    .default("true"),
  VITE_FEATURE_OFFLINE_MODE: z
    .string()
    .transform((val) => val === "true")
    .default("true"),
  VITE_FEATURE_PWA: z
    .string()
    .transform((val) => val === "true")
    .default("true"),
  VITE_FEATURE_NOTIFICATIONS: z
    .string()
    .transform((val) => val === "true")
    .default("true"),

  // Mock Authentication (Development Only)
  VITE_MOCK_AUTH: z
    .string()
    .transform((val) => val === "true")
    .optional(),
  VITE_MOCK_USER_ID: z.string().optional(),
  VITE_MOCK_PROJECT_ID: z.string().optional(),

  // File Upload Settings
  VITE_MAX_FILE_SIZE: z.string().transform(Number).default("10485760"), // 10MB
  VITE_ALLOWED_FILE_TYPES: z
    .string()
    .default("image/jpeg,image/png,image/webp,application/pdf,text/csv"),

  // Caching
  VITE_CACHE_TTL: z.string().transform(Number).default("3600"),
  VITE_CACHE_STRATEGY: z.enum(["memory", "localStorage", "sessionStorage"]).default("memory"),
  VITE_ENABLE_SERVICE_WORKER: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
});

/**
 * Parse and validate environment variables using import.meta.env
 */
function parseEnvironment() {
  try {
    return environmentSchema.parse(import.meta.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Invalid environment variables:", error.errors);
      throw new Error("Failed to load environment configuration");
    }
    throw error;
  }
}

/**
 * Validated environment configuration
 */
const env = parseEnvironment();

/**
 * Test configuration constants
 */
export const TEST_SCENARIOS = {
  STABLE: {
    deterministic: true,
    errorRate: 0,
    networkDelay: { min: 10, max: 50 },
    seed: "stable-test-seed",
  },
  ERROR_PRONE: {
    deterministic: true,
    errorRate: 0.1, // 10% controlled error rate
    networkDelay: { min: 100, max: 200 },
    seed: "error-test-seed",
  },
  SLOW_NETWORK: {
    deterministic: true,
    errorRate: 0.05,
    networkDelay: { min: 1000, max: 2000 },
    seed: "slow-network-seed",
  },
} as const;

/**
 * Get current API mode from environment
 * @returns {ApiMode} Current API mode
 */
export function getApiMode(): ApiMode {
  return env.VITE_API_MODE;
}

/**
 * Check if using mock services
 * @returns {boolean} True if using mock or test mode
 */
export function isUsingMocks(): boolean {
  return env.VITE_API_MODE === "mock" || env.VITE_API_MODE === "test";
}

/**
 * Check if in deterministic test mode
 * @returns {boolean} True if in test mode with deterministic behavior
 */
export function isDeterministicMode(): boolean {
  return env.VITE_API_MODE === "test";
}

/**
 * Get current test scenario configuration
 * @returns {object} Test scenario configuration
 */
export function getTestScenario() {
  const scenario = env.VITE_TEST_SCENARIO;
  return TEST_SCENARIOS[scenario];
}

/**
 * Get test seed for deterministic behavior
 * @returns {string} Test seed value
 */
export function getTestSeed(): string {
  return env.VITE_TEST_SEED;
}

/**
 * Check if development tools should be enabled
 * @returns {boolean} True if devtools should be enabled
 */
export function shouldShowDevTools(): boolean {
  return env.VITE_APP_ENV === "development" && env.VITE_ENABLE_DEVTOOLS;
}

/**
 * Check if mock indicator should be shown
 * @returns {boolean} True if mock indicator should be displayed
 */
export function shouldShowMockIndicator(): boolean {
  return env.VITE_APP_ENV === "development" && env.VITE_SHOW_MOCK_INDICATOR && isUsingMocks();
}

/**
 * Check if feature is enabled
 * @param {string} feature Feature name without VITE_FEATURE_ prefix
 * @returns {boolean} True if feature is enabled
 */
export function isFeatureEnabled(feature: string): boolean {
  const envKey = `VITE_FEATURE_${feature.toUpperCase()}` as keyof typeof env;
  return Boolean(env[envKey]);
}

/**
 * Environment configuration object for easy access
 */
export const environment = {
  // API Configuration
  api: {
    mode: env.VITE_API_MODE,
    url: env.VITE_API_URL,
    timeout: env.VITE_API_TIMEOUT,
    retryAttempts: env.VITE_API_RETRY_ATTEMPTS,
    enableLogs: env.VITE_ENABLE_API_LOGS,
  },

  // Application Settings
  app: {
    name: env.VITE_APP_NAME,
    version: env.VITE_APP_VERSION,
    env: env.VITE_APP_ENV,
    url: env.VITE_APP_URL,
    publicUrl: env.VITE_PUBLIC_URL,
    isDevelopment: env.VITE_APP_ENV === "development",
    isStaging: env.VITE_APP_ENV === "staging",
    isProduction: env.VITE_APP_ENV === "production",
  },

  // Regional Settings
  regional: {
    timezone: env.VITE_APP_TIMEZONE,
    locale: env.VITE_APP_LOCALE,
    currency: env.VITE_APP_CURRENCY,
    dateFormat: env.VITE_APP_DATE_FORMAT,
    countryCode: env.VITE_COUNTRY_CODE,
    phonePrefix: env.VITE_PHONE_PREFIX,
  },

  // Test Configuration
  test: {
    scenario: env.VITE_TEST_SCENARIO,
    seed: env.VITE_TEST_SEED,
    isDeterministic: isDeterministicMode(),
    config: getTestScenario(),
  },

  // Development Settings
  development: {
    enableDevtools: env.VITE_ENABLE_DEVTOOLS,
    enableMockData: env.VITE_ENABLE_MOCK_DATA,
    logLevel: env.VITE_LOG_LEVEL,
    showMockIndicator: shouldShowMockIndicator(),
    mockAuth: env.VITE_MOCK_AUTH || false,
    mockUserId: env.VITE_MOCK_USER_ID,
    mockProjectId: env.VITE_MOCK_PROJECT_ID,
  },

  // Security Settings
  security: {
    enableCsrf: env.VITE_ENABLE_CSRF,
  },

  // Feature Flags
  features: {
    bookings: env.VITE_FEATURE_BOOKINGS,
    finances: env.VITE_FEATURE_FINANCES,
    reports: env.VITE_FEATURE_REPORTS,
    multiProject: env.VITE_FEATURE_MULTI_PROJECT,
    offlineMode: env.VITE_FEATURE_OFFLINE_MODE,
    pwa: env.VITE_FEATURE_PWA,
    notifications: env.VITE_FEATURE_NOTIFICATIONS,
  },

  // File Upload Settings
  upload: {
    maxFileSize: env.VITE_MAX_FILE_SIZE,
    allowedFileTypes: env.VITE_ALLOWED_FILE_TYPES.split(","),
    getMaxFileSizeMB: () => env.VITE_MAX_FILE_SIZE / (1024 * 1024),
  },

  // Caching Configuration
  cache: {
    ttl: env.VITE_CACHE_TTL,
    strategy: env.VITE_CACHE_STRATEGY,
    enableServiceWorker: env.VITE_ENABLE_SERVICE_WORKER,
  },
} as const;

/**
 * Type definitions for TypeScript support
 */
export type Environment = typeof environment;
export type ApiConfiguration = typeof environment.api;
export type FeatureFlags = typeof environment.features;
export type TestConfiguration = typeof environment.test;

/**
 * Logger utility based on environment log level
 */
export const logger = {
  debug: (...args: any[]) => {
    if (env.VITE_LOG_LEVEL === "debug") {
      console.log("[DEBUG]", ...args);
    }
  },
  info: (...args: any[]) => {
    if (["debug", "info"].includes(env.VITE_LOG_LEVEL)) {
      console.info("[INFO]", ...args);
    }
  },
  warn: (...args: any[]) => {
    if (["debug", "info", "warn"].includes(env.VITE_LOG_LEVEL)) {
      console.warn("[WARN]", ...args);
    }
  },
  error: (...args: any[]) => {
    console.error("[ERROR]", ...args);
  },
};

/**
 * Currency formatter based on locale settings
 */
export const currencyFormatter = new Intl.NumberFormat(environment.regional.locale, {
  style: "currency",
  currency: environment.regional.currency,
});

/**
 * Date formatter based on locale settings
 */
export const dateFormatter = new Intl.DateTimeFormat(environment.regional.locale, {
  timeZone: environment.regional.timezone,
});

// Default export for convenience
export default environment;
