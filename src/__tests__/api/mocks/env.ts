/**
 * Mock Environment Variables for Cloudflare Workers
 *
 * Provides test environment with all required config values
 */

import { createMockKV } from "./kv";

export interface TestEnv {
  // Frontend environment variables (Vite)
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  // Cloudflare Workers environment variables (no VITE_ prefix)
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_JWT_SECRET: string;
  CRON_SECRET: string;
  TURNSTILE_SECRET_KEY: string;
  RATE_LIMIT_KV: KVNamespace;
  BLOCKED_IPS_KV: KVNamespace;
  ENVIRONMENT: "production" | "development";
  APP_VERSION: string;
}

export const createMockEnv = (): TestEnv => ({
  // Frontend environment variables (Vite)
  VITE_SUPABASE_URL: "https://test.supabase.co",
  VITE_SUPABASE_ANON_KEY: "test-anon-key",
  // Cloudflare Workers environment variables (no VITE_ prefix)
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_ANON_KEY: "test-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  SUPABASE_JWT_SECRET: "test-jwt-secret-key-for-hmac-256-signing",
  CRON_SECRET: "test-cron-secret",
  TURNSTILE_SECRET_KEY: "test-turnstile-secret",
  RATE_LIMIT_KV: createMockKV(),
  BLOCKED_IPS_KV: createMockKV(),
  ENVIRONMENT: "development",
  APP_VERSION: "0.0.1-test",
});
