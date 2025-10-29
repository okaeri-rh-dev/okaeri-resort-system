/**
 * Environment Variable Access Compatibility Layer
 *
 * This module provides environment variable access that works in both
 * Vite (browser/frontend) and Cloudflare Workers (serverless) contexts.
 *
 * Problem:
 * - Vite uses `import.meta.env` (only available in browser/Vite build)
 * - Workers use `process.env` or context-passed env objects
 * - Direct use of `import.meta.env` in Workers causes runtime errors
 *
 * Solution:
 * - Check for import.meta first (Vite context)
 * - Fall back to process.env (Node.js/Workers context)
 * - Provide type-safe access to all environment variables
 */

// ============================================
// ENVIRONMENT VARIABLE TYPES
// ============================================

/**
 * Type definition for all environment variables used in the application
 * Add new environment variables here to ensure type safety
 */
export interface Env {
  // Supabase Configuration
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;

  // Cloudflare Workers Configuration
  VITE_API_URL?: string;
  VITE_API_BASE_URL?: string;

  // Cloudflare Turnstile (Bot Protection)
  TURNSTILE_SECRET_KEY?: string;

  // Email Configuration
  RESEND_API_KEY?: string;

  // Debug Flags
  VITE_AUDIT_DEBUG?: string;
  VITE_QUERY_DEBUG?: string;
  VITE_TEST_VERBOSE?: string;

  // Node Environment
  NODE_ENV?: string;
}

// ============================================
// ENVIRONMENT ACCESS FUNCTIONS
// ============================================

/**
 * Get environment variable value from any context
 *
 * Checks multiple sources in order:
 * 1. import.meta.env (Vite/browser context)
 * 2. process.env (Node.js/Workers context)
 * 3. globalThis.env (Workers context with env passed via context)
 *
 * @param key - Environment variable key
 * @returns Value of the environment variable, or undefined if not found
 *
 * @example
 * ```typescript
 * const apiUrl = getEnv('VITE_API_URL');
 * if (apiUrl) {
 *   console.log('API URL:', apiUrl);
 * }
 * ```
 */
export function getEnv(key: keyof Env): string | undefined {
  // Browser/Vite context - import.meta.env is available
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env[key] as string | undefined;
  }

  // Node.js/Workers context - process.env is available
  if (typeof process !== "undefined" && process.env) {
    return process.env[key] as string | undefined;
  }

  // Workers globalThis context (if env is passed via context)
  // This is used when Workers receive env via the context parameter
  if (typeof globalThis !== "undefined" && (globalThis as any).env) {
    return (globalThis as any).env[key] as string | undefined;
  }

  return undefined;
}

/**
 * Get required environment variable value
 *
 * Same as getEnv() but throws an error if the variable is not defined.
 * Use this for critical environment variables that must be present.
 *
 * @param key - Environment variable key
 * @returns Value of the environment variable
 * @throws Error if the environment variable is not defined
 *
 * @example
 * ```typescript
 * const supabaseUrl = requireEnv('VITE_SUPABASE_URL');
 * // Guaranteed to be a string, or will throw
 * ```
 */
export function requireEnv(key: keyof Env): string {
  const value = getEnv(key);
  if (!value) {
    throw new Error(
      `Required environment variable ${key} is not defined. ` +
        `Please check your .env.local or .env.test file.`
    );
  }
  return value;
}

/**
 * Check if a boolean environment variable is enabled
 *
 * Treats "true" (case-insensitive) as true, everything else as false.
 * Useful for debug flags and feature toggles.
 *
 * @param key - Environment variable key
 * @returns true if the variable is set to "true", false otherwise
 *
 * @example
 * ```typescript
 * if (isEnvEnabled('VITE_AUDIT_DEBUG')) {
 *   console.log('Audit debugging is enabled');
 * }
 * ```
 */
export function isEnvEnabled(key: keyof Env): boolean {
  const value = getEnv(key);
  return value?.toLowerCase() === "true";
}

/**
 * Get environment with default value
 *
 * Returns the environment variable value if set, otherwise returns the default.
 *
 * @param key - Environment variable key
 * @param defaultValue - Default value to return if env var is not set
 * @returns Environment variable value or default
 *
 * @example
 * ```typescript
 * const apiUrl = getEnvWithDefault('VITE_API_URL', 'http://localhost:8788');
 * ```
 */
export function getEnvWithDefault(key: keyof Env, defaultValue: string): string {
  return getEnv(key) ?? defaultValue;
}

// ============================================
// CONTEXT DETECTION UTILITIES
// ============================================

/**
 * Check if running in Vite/browser context
 */
export function isViteContext(): boolean {
  return typeof import.meta !== "undefined" && import.meta.env !== undefined;
}

/**
 * Check if running in Node.js context
 */
export function isNodeContext(): boolean {
  return typeof process !== "undefined" && process.env !== undefined;
}

/**
 * Check if running in Workers context
 * This is a best-guess heuristic
 */
export function isWorkersContext(): boolean {
  return (
    !isViteContext() &&
    typeof globalThis !== "undefined" &&
    ((globalThis as any).env !== undefined ||
      (typeof process !== "undefined" && process.env?.NODE_ENV === "test"))
  );
}

/**
 * Get current execution context
 */
export function getExecutionContext(): "vite" | "node" | "workers" | "unknown" {
  if (isViteContext()) return "vite";
  if (isWorkersContext()) return "workers";
  if (isNodeContext()) return "node";
  return "unknown";
}
