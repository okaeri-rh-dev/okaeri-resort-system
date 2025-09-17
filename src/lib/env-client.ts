/**
 * Client-Safe Environment Variables Helper
 *
 * This module provides safe access to environment variables in both browser and server contexts.
 * It uses Vite's import.meta.env for client-side and process.env for server-side (Node.js).
 */

// Type definitions for Vite environment variables
interface ImportMetaEnv {
  MODE: string;
  DEV: boolean;
  PROD: boolean;
  SSR: boolean;

  // Application configuration
  VITE_API_URL?: string;
  VITE_APP_URL?: string;
  VITE_PUBLIC_URL?: string;
  VITE_APP_VERSION?: string;

  // Feature flags
  VITE_ENABLE_MONITORING?: string;
  VITE_ENABLE_PWA?: string;
  VITE_MOCK_AUTH?: string;
  VITE_USE_MOCKS?: string;

  // Third-party services
  VITE_SENTRY_DSN?: string;
  VITE_UPSTASH_REDIS_REST_URL?: string;
  VITE_UPSTASH_REDIS_REST_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Server-only environment variables (not exposed to client)
interface ServerEnv {
  // Database
  DATABASE_URL: string;
  DATABASE_POOL_URL?: string;

  // Authentication & Security
  JWT_SECRET: string;
  JWT_REFRESH_SECRET?: string;
  NEXTAUTH_SECRET?: string;
  NEXTAUTH_URL?: string;

  // Email configuration
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  SMTP_PASS?: string;

  // Reserved for future internal integrations
  // (No external payment providers in internal-only system)

  // Monitoring & Alerts
  SLACK_WEBHOOK_URL?: string;
  ALERT_WEBHOOK_URL?: string;
  WEBHOOK_AUTH_TOKEN?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;

  // Cloudflare R2
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;

  // Internal
  DEFAULT_PROJECT_ID?: string;
  CRON_SECRET?: string;
  INTERNAL_API_KEY?: string;
}

/**
 * Check if we're running in a browser environment
 */
export const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

/**
 * Check if we're running in a Node.js environment
 */
export const isServer = typeof process !== "undefined" && process.versions?.node;

/**
 * Get the current environment mode
 */
export function getEnvMode(): "development" | "production" | "test" {
  if (isBrowser) {
    return import.meta.env.MODE as "development" | "production" | "test";
  }

  // Server-side fallback
  if (isServer) {
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv === "production" || nodeEnv === "development" || nodeEnv === "test") {
      return nodeEnv;
    }
  }

  return "development";
}

/**
 * Check if we're in development mode
 */
export function isDevelopment(): boolean {
  if (isBrowser) {
    return import.meta.env.DEV;
  }
  return getEnvMode() === "development";
}

/**
 * Check if we're in production mode
 */
export function isProduction(): boolean {
  if (isBrowser) {
    return import.meta.env.PROD;
  }
  return getEnvMode() === "production";
}

/**
 * Check if we're in test mode
 */
export function isTest(): boolean {
  return getEnvMode() === "test";
}

/**
 * Safely get an environment variable value
 * In browser: only VITE_ prefixed variables are accessible
 * In server: all process.env variables are accessible
 */
export function getEnvVar(key: string, defaultValue?: string): string | undefined {
  // Browser environment - only VITE_ prefixed vars are available
  if (isBrowser) {
    // Check if it's a VITE_ prefixed variable
    if (key.startsWith("VITE_")) {
      return (import.meta.env as any)[key] || defaultValue;
    }

    // Map common non-VITE variables to their VITE equivalents
    const mappings: Record<string, string> = {
      NODE_ENV: import.meta.env.MODE,
      PUBLIC_URL: import.meta.env.VITE_PUBLIC_URL || "",
      API_URL: import.meta.env.VITE_API_URL || "/api",
      APP_URL: import.meta.env.VITE_APP_URL || window.location.origin,
    };

    return mappings[key] || defaultValue;
  }

  // Server environment - access process.env
  if (isServer) {
    return process.env[key] || defaultValue;
  }

  return defaultValue;
}

/**
 * Get a required environment variable (throws if not found)
 */
export function requireEnvVar(key: string): string {
  const value = getEnvVar(key);
  if (!value) {
    throw new Error(`Required environment variable ${key} is not defined`);
  }
  return value;
}

/**
 * Environment configuration object that works in both browser and server
 */
export const clientEnv = {
  mode: getEnvMode(),
  isDevelopment: isDevelopment(),
  isProduction: isProduction(),
  isTest: isTest(),
  isBrowser,
  isServer,

  // Common environment variables
  apiUrl: getEnvVar("VITE_API_URL", "/api"),
  appUrl: getEnvVar("VITE_APP_URL", isBrowser ? window.location.origin : "http://localhost:3000"),
  publicUrl: getEnvVar("VITE_PUBLIC_URL", "/"),

  // Feature flags
  enableMonitoring: getEnvVar("VITE_ENABLE_MONITORING", "true") === "true",
  enablePWA: getEnvVar("VITE_ENABLE_PWA", "true") === "true",

  // Third-party services (client-safe)
  sentryDsn: getEnvVar("VITE_SENTRY_DSN"),

  // Server-only variables (will be undefined in browser)
  databaseUrl: isServer ? getEnvVar("DATABASE_URL") : undefined,
  jwtSecret: isServer ? getEnvVar("JWT_SECRET") : undefined,
};

/**
 * Helper to check if a server-only environment variable is being accessed in the browser
 */
export function assertServerOnly(variableName: string): void {
  if (isBrowser) {
    console.warn(
      `Warning: Attempted to access server-only environment variable "${variableName}" in browser context. ` +
        `This variable is not available in the browser for security reasons.`
    );
  }
}

export default clientEnv;
