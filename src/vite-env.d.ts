/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Application Settings
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_APP_ENV: "development" | "production" | "test";

  // URLs
  readonly VITE_APP_URL: string;
  readonly VITE_API_URL: string;
  readonly VITE_PUBLIC_URL: string;

  // Security Settings
  readonly VITE_ENABLE_CSRF: string; // "true" | "false"

  // Feature Flags
  readonly VITE_FEATURE_BOOKINGS: string;
  readonly VITE_FEATURE_FINANCES: string;
  readonly VITE_FEATURE_REPORTS: string;
  readonly VITE_FEATURE_MULTI_PROJECT: string;
  readonly VITE_FEATURE_OFFLINE_MODE: string;
  readonly VITE_FEATURE_PWA: string;
  readonly VITE_FEATURE_NOTIFICATIONS: string;

  // Development Tools
  readonly VITE_ENABLE_DEVTOOLS: string;
  readonly VITE_ENABLE_MOCK_DATA: string;
  readonly VITE_ENABLE_API_LOGS: string;
  readonly VITE_LOG_LEVEL: "debug" | "info" | "warn" | "error";

  // Mock Authentication
  readonly VITE_MOCK_AUTH: string;
  readonly VITE_MOCK_USER_ID?: string;
  readonly VITE_MOCK_PROJECT_ID?: string;

  // Regional Settings
  readonly VITE_APP_TIMEZONE: string;
  readonly VITE_APP_LOCALE: string;
  readonly VITE_APP_CURRENCY: string;
  readonly VITE_APP_DATE_FORMAT: string;

  // Other settings
  readonly VITE_MAX_FILE_SIZE: string;
  readonly VITE_ALLOWED_FILE_TYPES: string;
  readonly VITE_CACHE_TTL: string;
  readonly VITE_CACHE_STRATEGY: string;
  readonly VITE_ENABLE_SERVICE_WORKER: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
