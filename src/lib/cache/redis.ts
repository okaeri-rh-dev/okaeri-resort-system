/**
 * Redis Client Stub
 * Simple stub for testing - will be mocked by tests
 */

export interface RedisClient {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, mode?: string, duration?: number) => Promise<void>;
  del: (key: string) => Promise<void>;
  exists: (key: string) => Promise<number>;
}

export function getRedisClient(): RedisClient {
  // This will be mocked in tests
  return {
    get: async () => null,
    set: async () => {},
    del: async () => {},
    exists: async () => 0,
  };
}
