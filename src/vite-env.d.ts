/// <reference types="vite/client" />

/**
 * Vite Environment Variables Type Definitions
 * All browser-accessible variables must have VITE_ prefix
 */
interface ImportMetaEnv {
  // Core API Configuration
  readonly VITE_API_MODE: "mock" | "real" | "test";
  readonly VITE_API_URL: string;
  readonly VITE_API_TIMEOUT: string;
  readonly VITE_API_RETRY_ATTEMPTS: string;

  // Test Configuration (for deterministic testing)
  readonly VITE_TEST_SCENARIO: "STABLE" | "ERROR_PRONE" | "SLOW_NETWORK";
  readonly VITE_TEST_SEED: string;

  // Application Settings
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_APP_ENV: "development" | "staging" | "production";
  readonly VITE_APP_URL: string;
  readonly VITE_PUBLIC_URL: string;

  // Regional Settings
  readonly VITE_APP_TIMEZONE: string;
  readonly VITE_APP_LOCALE: string;
  readonly VITE_APP_CURRENCY: string;
  readonly VITE_APP_DATE_FORMAT: string;
  readonly VITE_COUNTRY_CODE: string;
  readonly VITE_PHONE_PREFIX: string;

  // Development Settings
  readonly VITE_ENABLE_DEVTOOLS: string; // "true" | "false"
  readonly VITE_ENABLE_MOCK_DATA: string; // "true" | "false"
  readonly VITE_ENABLE_API_LOGS: string; // "true" | "false"
  readonly VITE_LOG_LEVEL: "debug" | "info" | "warn" | "error";
  readonly VITE_SHOW_MOCK_INDICATOR: string; // "true" | "false"

  // Security Settings
  readonly VITE_ENABLE_CSRF: string; // "true" | "false"

  // Feature Flags (Browser Accessible)
  readonly VITE_FEATURE_BOOKINGS: string; // "true" | "false"
  readonly VITE_FEATURE_FINANCES: string; // "true" | "false"
  readonly VITE_FEATURE_REPORTS: string; // "true" | "false"
  readonly VITE_FEATURE_MULTI_PROJECT: string; // "true" | "false"
  readonly VITE_FEATURE_OFFLINE_MODE: string; // "true" | "false"
  readonly VITE_FEATURE_PWA: string; // "true" | "false"
  readonly VITE_FEATURE_NOTIFICATIONS: string; // "true" | "false"

  // Mock Authentication (Development Only)
  readonly VITE_MOCK_AUTH?: string; // "true" | "false"
  readonly VITE_MOCK_USER_ID?: string;
  readonly VITE_MOCK_PROJECT_ID?: string;

  // File Upload Settings
  readonly VITE_MAX_FILE_SIZE: string; // bytes as string
  readonly VITE_ALLOWED_FILE_TYPES: string; // comma-separated MIME types

  // Caching Configuration
  readonly VITE_CACHE_TTL: string; // seconds as string
  readonly VITE_CACHE_STRATEGY: "memory" | "localStorage" | "sessionStorage";
  readonly VITE_ENABLE_SERVICE_WORKER: string; // "true" | "false"
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Type definitions for environment configuration
 */
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Server-only environment variables (no VITE_ prefix needed)

      // Database Configuration
      DATABASE_URL?: string;
      DATABASE_DIRECT_URL?: string;

      // JWT Configuration
      JWT_SECRET?: string;
      JWT_REFRESH_SECRET?: string;
      JWT_ACCESS_TOKEN_EXPIRES_IN?: string;
      JWT_REFRESH_TOKEN_EXPIRES_IN?: string;

      // Redis Configuration
      UPSTASH_REDIS_REST_URL?: string;
      UPSTASH_REDIS_REST_TOKEN?: string;

      // Cloudflare R2 Configuration
      R2_ACCOUNT_ID?: string;
      R2_ACCESS_KEY_ID?: string;
      R2_SECRET_ACCESS_KEY?: string;
      R2_BUCKET_NAME?: string;
      R2_PUBLIC_URL?: string;

      // Email Configuration
      SMTP_HOST?: string;
      SMTP_PORT?: string;
      SMTP_USER?: string;
      SMTP_PASS?: string;
      EMAIL_FROM?: string;

      // Security Configuration
      ALLOWED_ORIGINS?: string;
      SESSION_TIMEOUT?: string;
      MAX_LOGIN_ATTEMPTS?: string;
      PASSWORD_MIN_LENGTH?: string;
      RATE_LIMIT_WINDOW_MS?: string;
      RATE_LIMIT_MAX_REQUESTS?: string;

      // Server Feature Flags
      ENABLE_CSV_IMPORT?: string;
      ENABLE_GOOGLE_SHEETS?: string;
      ENABLE_EMAIL_NOTIFICATIONS?: string;
      ENABLE_SMS_NOTIFICATIONS?: string;

      // Google Sheets Integration
      GOOGLE_SHEETS_CLIENT_EMAIL?: string;
      GOOGLE_SHEETS_PRIVATE_KEY?: string;
      GOOGLE_SHEETS_PROJECT_ID?: string;

      // SMS Configuration
      SMS_API_KEY?: string;
      SMS_SENDER_NAME?: string;

      // Monitoring and Analytics
      SENTRY_DSN?: string;
      VERCEL_ANALYTICS_ID?: string;
      GOOGLE_ANALYTICS_ID?: string;

      // Development and Testing
      LOG_LEVEL?: string;
      ENABLE_QUERY_LOGGING?: string;
      ENABLE_PERFORMANCE_MONITORING?: string;
    }
  }
}
