/**
 * Mock Cloudflare KV Namespace for testing
 *
 * Provides in-memory KV operations for:
 * - Rate limiting counters
 * - Idempotency key storage
 * - Blocked IPs tracking
 */

import { vi } from "vitest";

// In-memory storage for KV
const kvStore = new Map<string, string>();

export const createMockKV = (): KVNamespace => ({
  get: vi.fn(async (key: string) => {
    const value = kvStore.get(key);
    return value || null;
  }),

  put: vi.fn(async (key: string, value: string, options?: { expirationTtl?: number }) => {
    kvStore.set(key, value);

    // Auto-delete after TTL (for testing)
    if (options?.expirationTtl) {
      setTimeout(() => kvStore.delete(key), options.expirationTtl * 1000);
    }
  }),

  delete: vi.fn(async (key: string) => {
    kvStore.delete(key);
  }),

  list: vi.fn(async (options?: { prefix?: string; limit?: number }) => {
    const keys = Array.from(kvStore.keys());
    const filtered = options?.prefix ? keys.filter((k) => k.startsWith(options.prefix!)) : keys;

    return {
      keys: filtered.slice(0, options?.limit || 1000).map((name) => ({ name })),
      list_complete: true,
      cursor: "",
    };
  }),

  getWithMetadata: vi.fn(async () => ({
    value: null,
    metadata: null,
  })),
});

/**
 * Reset KV store between tests
 */
export const resetKVStore = () => {
  kvStore.clear();
};

/**
 * Get current KV store state (for assertions)
 */
export const getKVState = () => new Map(kvStore);
