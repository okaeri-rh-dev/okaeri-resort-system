/**
 * Centralized application configuration
 * Provides type-safe access to environment variables and application settings
 */

import { z } from "zod";

/**
 * Environment variable schema validation
 */
const envSchema = z.object({
  // Application Settings
  VITE_APP_NAME: z.string().default("Okaeri Resort Management System"),
  VITE_APP_VERSION: z.string().default("1.0.0"),
  VITE_APP_ENV: z.enum(["development", "staging", "production"]).default("development"),

  // URLs
  VITE_APP_URL: z.string().url().default("http://localhost:5173"),
  VITE_API_URL: z.string().url().default("http://localhost:5173/api"),
  VITE_PUBLIC_URL: z.string().url().default("http://localhost:5173"),

  // Regional Settings
  VITE_APP_TIMEZONE: z.string().default("Asia/Manila"),
  VITE_APP_LOCALE: z.string().default("en-PH"),
  VITE_APP_CURRENCY: z.string().default("PHP"),
  VITE_APP_DATE_FORMAT: z.string().default("MM/DD/YYYY"),

  // API Configuration
  VITE_API_TIMEOUT: z.string().transform(Number).default("30000"),
  VITE_API_RETRY_ATTEMPTS: z.string().transform(Number).default("3"),

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
  VITE_FEATURE_CHAT_INTEGRATION: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
  VITE_FEATURE_AIRBNB_SYNC: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
  VITE_FEATURE_PAYMENT_PROCESSING: z
    .string()
    .transform((val) => val === "true")
    .default("false"),

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

  // File Upload Settings
  VITE_MAX_FILE_SIZE: z.string().transform(Number).default("10485760"), // 10MB
  VITE_ALLOWED_FILE_TYPES: z
    .string()
    .default("image/jpeg,image/png,image/webp,application/pdf,text/csv"),

  // Multi-tenant Settings
  VITE_MAX_PROJECTS_PER_USER: z.string().transform(Number).default("5"),
  VITE_DEFAULT_PROJECT_STORAGE: z.string().default("100MB"),
  VITE_ENABLE_PROJECT_SWITCHING: z
    .string()
    .transform((val) => val === "true")
    .default("true"),

  // Localization
  VITE_DEFAULT_LANGUAGE: z.string().default("en"),
  VITE_SUPPORTED_LANGUAGES: z.string().default("en,fil"),
  VITE_COUNTRY_CODE: z.string().default("PH"),
  VITE_PHONE_PREFIX: z.string().default("+63"),

  // Caching
  VITE_CACHE_TTL: z.string().transform(Number).default("3600"),
  VITE_CACHE_STRATEGY: z.enum(["memory", "localStorage", "sessionStorage"]).default("memory"),
  VITE_ENABLE_SERVICE_WORKER: z
    .string()
    .transform((val) => val === "true")
    .default("false"),

  // Mock Authentication (Development Only)
  VITE_MOCK_AUTH: z
    .string()
    .transform((val) => val === "true")
    .optional(),
  VITE_MOCK_USER_ID: z.string().optional(),
  VITE_MOCK_PROJECT_ID: z.string().optional(),
});

/**
 * Parse and validate environment variables
 */
const parseEnv = () => {
  try {
    return envSchema.parse(import.meta.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Invalid environment variables:", error.errors);
      throw new Error("Failed to load environment configuration");
    }
    throw error;
  }
};

/**
 * Validated environment configuration
 */
const env = parseEnv();

/**
 * Application configuration object
 */
export const config = {
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

  api: {
    url: env.VITE_API_URL,
    timeout: env.VITE_API_TIMEOUT,
    retryAttempts: env.VITE_API_RETRY_ATTEMPTS,
    enableLogs: env.VITE_ENABLE_API_LOGS,
  },

  regional: {
    timezone: env.VITE_APP_TIMEZONE,
    locale: env.VITE_APP_LOCALE,
    currency: env.VITE_APP_CURRENCY,
    dateFormat: env.VITE_APP_DATE_FORMAT,
    countryCode: env.VITE_COUNTRY_CODE,
    phonePrefix: env.VITE_PHONE_PREFIX,
  },

  features: {
    bookings: env.VITE_FEATURE_BOOKINGS,
    finances: env.VITE_FEATURE_FINANCES,
    reports: env.VITE_FEATURE_REPORTS,
    multiProject: env.VITE_FEATURE_MULTI_PROJECT,
    offlineMode: env.VITE_FEATURE_OFFLINE_MODE,
    pwa: env.VITE_FEATURE_PWA,
    notifications: env.VITE_FEATURE_NOTIFICATIONS,
    chatIntegration: env.VITE_FEATURE_CHAT_INTEGRATION,
    airbnbSync: env.VITE_FEATURE_AIRBNB_SYNC,
    paymentProcessing: env.VITE_FEATURE_PAYMENT_PROCESSING,
  },

  development: {
    enableDevtools: env.VITE_ENABLE_DEVTOOLS,
    enableMockData: env.VITE_ENABLE_MOCK_DATA,
    logLevel: env.VITE_LOG_LEVEL,
    mockAuth: env.VITE_MOCK_AUTH || false,
    mockUserId: env.VITE_MOCK_USER_ID,
    mockProjectId: env.VITE_MOCK_PROJECT_ID,
  },

  upload: {
    maxFileSize: env.VITE_MAX_FILE_SIZE,
    allowedFileTypes: env.VITE_ALLOWED_FILE_TYPES.split(","),
    getMaxFileSizeMB: () => env.VITE_MAX_FILE_SIZE / (1024 * 1024),
  },

  multiTenant: {
    maxProjectsPerUser: env.VITE_MAX_PROJECTS_PER_USER,
    defaultProjectStorage: env.VITE_DEFAULT_PROJECT_STORAGE,
    enableProjectSwitching: env.VITE_ENABLE_PROJECT_SWITCHING,
  },

  localization: {
    defaultLanguage: env.VITE_DEFAULT_LANGUAGE,
    supportedLanguages: env.VITE_SUPPORTED_LANGUAGES.split(","),
    isLanguageSupported: (lang: string) => env.VITE_SUPPORTED_LANGUAGES.split(",").includes(lang),
  },

  cache: {
    ttl: env.VITE_CACHE_TTL,
    strategy: env.VITE_CACHE_STRATEGY,
    enableServiceWorker: env.VITE_ENABLE_SERVICE_WORKER,
  },
} as const;

/**
 * Type-safe feature flag checker
 */
export function isFeatureEnabled(feature: keyof typeof config.features): boolean {
  return config.features[feature];
}

/**
 * Get configuration value with fallback
 */
export function getConfigValue<T>(path: string, fallback: T): T {
  const keys = path.split(".");
  let value: any = config;

  for (const key of keys) {
    if (value && typeof value === "object" && key in value) {
      value = value[key];
    } else {
      return fallback;
    }
  }

  return value as T;
}

/**
 * Currency formatter based on locale settings
 */
export const currencyFormatter = new Intl.NumberFormat(config.regional.locale, {
  style: "currency",
  currency: config.regional.currency,
});

/**
 * Date formatter based on locale settings
 */
export const dateFormatter = new Intl.DateTimeFormat(config.regional.locale, {
  timeZone: config.regional.timezone,
});

/**
 * Logger utility based on environment
 */
export const logger = {
  debug: (...args: any[]) => {
    if (config.development.logLevel === "debug") {
      console.log("[DEBUG]", ...args);
    }
  },
  info: (...args: any[]) => {
    if (["debug", "info"].includes(config.development.logLevel)) {
      console.info("[INFO]", ...args);
    }
  },
  warn: (...args: any[]) => {
    if (["debug", "info", "warn"].includes(config.development.logLevel)) {
      console.warn("[WARN]", ...args);
    }
  },
  error: (...args: any[]) => {
    console.error("[ERROR]", ...args);
  },
};

/**
 * Export type definitions for use in other files
 */
export type Config = typeof config;
export type FeatureFlags = typeof config.features;
export type Environment = typeof config.app.env;

// Default export for convenience
export default config;
