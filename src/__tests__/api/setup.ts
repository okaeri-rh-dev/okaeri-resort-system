/**
 * Test Setup for API Endpoint Tests
 *
 * Provides shared test configuration, mocks, and utilities
 */

import { webcrypto } from "node:crypto";

import { afterEach, beforeEach, vi } from "vitest";

import { createMockEnv, type TestEnv } from "./mocks/env";
import { resetKVStore } from "./mocks/kv";
import { mockSupabaseModule, resetMockData } from "./mocks/supabase";

// Hoist module mocks to top level (required by Vitest)
vi.mock("@supabase/supabase-js", () => mockSupabaseModule());

/**
 * Global mock environment
 * Can be overridden per test if needed
 */
export let mockEnv: TestEnv;

/**
 * Setup runs before each test
 */
beforeEach(() => {
  // Reset mock environment
  mockEnv = createMockEnv();

  // Reset KV store
  resetKVStore();

  // Reset Supabase mock data
  resetMockData();

  // Clear all mocks
  vi.clearAllMocks();

  // Add Web Crypto API support for JWT verification
  // Node.js 20+ has built-in webcrypto that matches Cloudflare Workers API
  if (!globalThis.crypto) {
    Object.defineProperty(globalThis, "crypto", {
      value: webcrypto,
      writable: true,
      configurable: true,
    });
  }

  // Mock fetch for external API calls (Turnstile, Resend, etc.)
  global.fetch = vi.fn(async (url: string | URL) => {
    const urlString = url.toString();

    // Mock Turnstile verification
    if (urlString.includes("challenges.cloudflare.com/turnstile")) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Mock Resend email API
    if (urlString.includes("api.resend.com")) {
      return new Response(JSON.stringify({ id: "mock-email-id" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Default mock response
    return new Response(JSON.stringify({ error: "Unmocked fetch call" }), { status: 500 });
  }) as typeof fetch;
});

/**
 * Cleanup runs after each test
 */
afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Re-export common utilities for convenience
 */
export {
  createMockRequest,
  createMockContext,
  generateTestJWT,
  generateExpiredJWT,
  generateIdempotencyKey,
} from "./utils/test-helpers";
