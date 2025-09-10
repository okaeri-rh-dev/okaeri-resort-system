/**
 * Phase 5.3: Multi-Layer Caching Strategy
 * Implements Memory → Redis → Source caching pattern
 * Optimized for Vercel Edge Functions and Philippine network conditions
 */

import { LRUCache } from "lru-cache";

// Types
interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  staleWhileRevalidate?: number; // Serve stale content while revalidating
  tags?: string[]; // Cache tags for invalidation
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  tags: string[];
  staleUntil?: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  staleHits: number;
  errors: number;
  avgLatency: number;
}

/**
 * Memory cache layer (L1)
 * Fastest access, limited size, per-instance
 */
class MemoryCache {
  private cache: LRUCache<string, CacheEntry<any>>;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    staleHits: 0,
    errors: 0,
    avgLatency: 0,
  };

  constructor(maxSize: number = 100) {
    this.cache = new LRUCache({
      max: maxSize,
      ttl: 1000 * 60 * 5, // 5 minutes default
      updateAgeOnGet: true,
      updateAgeOnHas: false,
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const startTime = performance.now();

    try {
      const entry = this.cache.get(key);

      if (!entry) {
        this.stats.misses++;
        return null;
      }

      const now = Date.now();
      const isExpired = now > entry.timestamp + entry.ttl;
      const isStale =
        entry.staleUntil && now > entry.timestamp + entry.ttl && now < entry.staleUntil;

      if (isExpired && !isStale) {
        this.cache.delete(key);
        this.stats.misses++;
        return null;
      }

      if (isStale) {
        this.stats.staleHits++;
      } else {
        this.stats.hits++;
      }

      return entry.data;
    } finally {
      this.updateLatency(performance.now() - startTime);
    }
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const entry: CacheEntry<T> = {
      data: value,
      timestamp: Date.now(),
      ttl: options.ttl || 1000 * 60 * 5, // 5 minutes default
      tags: options.tags || [],
      staleUntil: options.staleWhileRevalidate
        ? Date.now() + (options.ttl || 0) + options.staleWhileRevalidate
        : undefined,
    };

    this.cache.set(key, entry);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async invalidateByTags(tags: string[]): Promise<void> {
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (tags.some((tag) => entry.tags.includes(tag))) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  private updateLatency(latency: number): void {
    const total = this.stats.hits + this.stats.misses + this.stats.staleHits;
    this.stats.avgLatency = (this.stats.avgLatency * (total - 1) + latency) / total;
  }
}

/**
 * Redis cache layer (L2)
 * Shared across instances, larger capacity
 */
class RedisCache {
  private redisUrl: string;
  private redisToken: string;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    staleHits: 0,
    errors: 0,
    avgLatency: 0,
  };

  constructor(url: string, token: string) {
    this.redisUrl = url;
    this.redisToken = token;
  }

  async get<T>(key: string): Promise<T | null> {
    const startTime = performance.now();

    try {
      const response = await fetch(`${this.redisUrl}/get/${key}`, {
        headers: {
          Authorization: `Bearer ${this.redisToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          this.stats.misses++;
          return null;
        }
        throw new Error(`Redis error: ${response.status}`);
      }

      const { result } = await response.json();

      if (!result) {
        this.stats.misses++;
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(result);
      const now = Date.now();
      const isExpired = now > entry.timestamp + entry.ttl;
      const isStale =
        entry.staleUntil && now > entry.timestamp + entry.ttl && now < entry.staleUntil;

      if (isExpired && !isStale) {
        await this.delete(key);
        this.stats.misses++;
        return null;
      }

      if (isStale) {
        this.stats.staleHits++;
      } else {
        this.stats.hits++;
      }

      return entry.data;
    } catch (error) {
      this.stats.errors++;
      console.error("Redis get error:", error);
      return null;
    } finally {
      this.updateLatency(performance.now() - startTime);
    }
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    try {
      const entry: CacheEntry<T> = {
        data: value,
        timestamp: Date.now(),
        ttl: options.ttl || 1000 * 60 * 5,
        tags: options.tags || [],
        staleUntil: options.staleWhileRevalidate
          ? Date.now() + (options.ttl || 0) + options.staleWhileRevalidate
          : undefined,
      };

      const ttlSeconds = Math.ceil((entry.ttl + (options.staleWhileRevalidate || 0)) / 1000);

      await fetch(`${this.redisUrl}/set/${key}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.redisToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          value: JSON.stringify(entry),
          ex: ttlSeconds,
        }),
      });
    } catch (error) {
      this.stats.errors++;
      console.error("Redis set error:", error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await fetch(`${this.redisUrl}/del/${key}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this.redisToken}`,
        },
      });
    } catch (error) {
      this.stats.errors++;
      console.error("Redis delete error:", error);
    }
  }

  async invalidateByTags(tags: string[]): Promise<void> {
    // This would require scanning Redis keys which is expensive
    // In production, consider using Redis Sets for tag-based invalidation
    console.warn("Tag-based invalidation not implemented for Redis layer");
  }

  async clear(): Promise<void> {
    try {
      await fetch(`${this.redisUrl}/flushdb`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.redisToken}`,
        },
      });
    } catch (error) {
      this.stats.errors++;
      console.error("Redis clear error:", error);
    }
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  private updateLatency(latency: number): void {
    const total = this.stats.hits + this.stats.misses + this.stats.staleHits;
    if (total > 0) {
      this.stats.avgLatency = (this.stats.avgLatency * (total - 1) + latency) / total;
    }
  }
}

/**
 * Multi-layer cache orchestrator
 * Coordinates between Memory (L1) → Redis (L2) → Source (L3)
 */
export class MultiLayerCache {
  private memoryCache: MemoryCache;
  private redisCache: RedisCache | null;
  private revalidationQueue = new Map<string, Promise<any>>();

  constructor(
    options: {
      memoryCacheSize?: number;
      redisUrl?: string;
      redisToken?: string;
    } = {}
  ) {
    this.memoryCache = new MemoryCache(options.memoryCacheSize || 100);

    // Redis is optional
    this.redisCache =
      options.redisUrl && options.redisToken
        ? new RedisCache(options.redisUrl, options.redisToken)
        : null;
  }

  /**
   * Get value with waterfall through cache layers
   */
  async get<T>(
    key: string,
    fetcher?: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T | null> {
    // L1: Memory cache
    const memoryResult = await this.memoryCache.get<T>(key);
    if (memoryResult !== null) {
      // Check if we need background revalidation
      if (options.staleWhileRevalidate && fetcher) {
        this.revalidateInBackground(key, fetcher, options);
      }
      return memoryResult;
    }

    // L2: Redis cache
    if (this.redisCache) {
      const redisResult = await this.redisCache.get<T>(key);
      if (redisResult !== null) {
        // Promote to memory cache
        await this.memoryCache.set(key, redisResult, options);

        // Check if we need background revalidation
        if (options.staleWhileRevalidate && fetcher) {
          this.revalidateInBackground(key, fetcher, options);
        }
        return redisResult;
      }
    }

    // L3: Source (fetch fresh data)
    if (fetcher) {
      try {
        const freshData = await fetcher();

        // Update all cache layers
        await this.set(key, freshData, options);

        return freshData;
      } catch (error) {
        console.error("Fetcher error:", error);

        // Try to return stale data if available
        const staleMemory = await this.memoryCache.get<T>(key);
        if (staleMemory !== null) return staleMemory;

        if (this.redisCache) {
          const staleRedis = await this.redisCache.get<T>(key);
          if (staleRedis !== null) return staleRedis;
        }

        throw error;
      }
    }

    return null;
  }

  /**
   * Set value in all cache layers
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    // Set in all layers concurrently
    const promises: Promise<void>[] = [this.memoryCache.set(key, value, options)];

    if (this.redisCache) {
      promises.push(this.redisCache.set(key, value, options));
    }

    await Promise.all(promises);
  }

  /**
   * Delete from all cache layers
   */
  async delete(key: string): Promise<void> {
    const promises: Promise<void>[] = [this.memoryCache.delete(key)];

    if (this.redisCache) {
      promises.push(this.redisCache.delete(key));
    }

    await Promise.all(promises);
  }

  /**
   * Invalidate by tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    const promises: Promise<void>[] = [this.memoryCache.invalidateByTags(tags)];

    if (this.redisCache) {
      promises.push(this.redisCache.invalidateByTags(tags));
    }

    await Promise.all(promises);
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    const promises: Promise<void>[] = [this.memoryCache.clear()];

    if (this.redisCache) {
      promises.push(this.redisCache.clear());
    }

    await Promise.all(promises);
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    memory: CacheStats;
    redis: CacheStats | null;
    hitRate: number;
  } {
    const memoryStats = this.memoryCache.getStats();
    const redisStats = this.redisCache?.getStats() || null;

    const totalHits = memoryStats.hits + (redisStats?.hits || 0);
    const totalMisses = memoryStats.misses + (redisStats?.misses || 0);
    const hitRate = totalHits / (totalHits + totalMisses) || 0;

    return {
      memory: memoryStats,
      redis: redisStats,
      hitRate,
    };
  }

  /**
   * Background revalidation for stale-while-revalidate pattern
   */
  private async revalidateInBackground<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions
  ): Promise<void> {
    // Check if revalidation is already in progress
    if (this.revalidationQueue.has(key)) {
      return;
    }

    const revalidationPromise = (async () => {
      try {
        const freshData = await fetcher();
        await this.set(key, freshData, options);
      } catch (error) {
        console.error(`Background revalidation failed for ${key}:`, error);
      } finally {
        this.revalidationQueue.delete(key);
      }
    })();

    this.revalidationQueue.set(key, revalidationPromise);
  }
}

/**
 * Cache key generators for consistent naming
 */
export const CacheKeys = {
  // API responses
  api: (endpoint: string, params?: Record<string, any>) => {
    const paramStr = params ? JSON.stringify(params) : "";
    return `api:${endpoint}:${paramStr}`;
  },

  // User-specific data
  user: (userId: string, resource: string) => {
    return `user:${userId}:${resource}`;
  },

  // Project-specific data
  project: (projectId: string, resource: string) => {
    return `project:${projectId}:${resource}`;
  },

  // Financial data
  financial: (projectId: string, type: string, params?: Record<string, any>) => {
    const paramStr = params ? JSON.stringify(params) : "";
    return `financial:${projectId}:${type}:${paramStr}`;
  },

  // Booking data
  booking: (projectId: string, bookingId?: string) => {
    return bookingId ? `booking:${projectId}:${bookingId}` : `booking:${projectId}:list`;
  },

  // Report data
  report: (projectId: string, reportType: string, dateRange: string) => {
    return `report:${projectId}:${reportType}:${dateRange}`;
  },
};

/**
 * Cache tags for invalidation groups
 */
export const CacheTags = {
  USER: "user",
  PROJECT: "project",
  BOOKING: "booking",
  FINANCIAL: "financial",
  REPORT: "report",
  DASHBOARD: "dashboard",
};

/**
 * Default cache TTLs (in milliseconds)
 */
export const CacheTTL = {
  SHORT: 1000 * 30, // 30 seconds
  MEDIUM: 1000 * 60 * 5, // 5 minutes
  LONG: 1000 * 60 * 30, // 30 minutes
  HOUR: 1000 * 60 * 60, // 1 hour
  DAY: 1000 * 60 * 60 * 24, // 24 hours
};

// Create singleton instance
let cacheInstance: MultiLayerCache | null = null;

export function initializeCache(options: {
  memoryCacheSize?: number;
  redisUrl?: string;
  redisToken?: string;
}): MultiLayerCache {
  if (!cacheInstance) {
    cacheInstance = new MultiLayerCache(options);
  }
  return cacheInstance;
}

export function getCache(): MultiLayerCache {
  if (!cacheInstance) {
    // Initialize with defaults if not already initialized
    cacheInstance = new MultiLayerCache({
      memoryCacheSize: 100,
      redisUrl: process.env.UPSTASH_REDIS_REST_URL,
      redisToken: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return cacheInstance;
}
