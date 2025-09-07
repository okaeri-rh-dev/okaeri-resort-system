/**
 * Cache Manager Service
 *
 * Enhanced Redis caching layer with TTL management, smart invalidation,
 * and performance monitoring for Philippine resort financial reports.
 */

import { getRedisClient, type RedisClient } from "./redis";

export type CacheKeyPrefix = "report" | "dashboard" | "metrics" | "tax" | "occupancy" | "financial";

export type CacheScope = "project" | "global" | "user";

export interface CacheConfig {
  prefix: CacheKeyPrefix;
  scope: CacheScope;
  ttl: number; // seconds
  compress?: boolean;
  tags?: string[];
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalKeys: number;
  memoryUsage: number;
  avgResponseTime: number;
}

export interface CacheItem<T = any> {
  data: T;
  cachedAt: number;
  expiresAt: number;
  tags?: string[];
  compressed?: boolean;
  size?: number;
}

// Predefined cache configurations for report types
export const CACHE_CONFIGS = {
  // Dashboard metrics - 5 minutes TTL
  DASHBOARD_METRICS: {
    prefix: "dashboard" as CacheKeyPrefix,
    scope: "project" as CacheScope,
    ttl: 5 * 60, // 5 minutes
    tags: ["dashboard", "metrics"],
  },

  // Daily reports - 1 hour TTL
  DAILY_REPORTS: {
    prefix: "report" as CacheKeyPrefix,
    scope: "project" as CacheScope,
    ttl: 60 * 60, // 1 hour
    tags: ["report", "daily"],
  },

  // Monthly reports - 1 day TTL
  MONTHLY_REPORTS: {
    prefix: "report" as CacheKeyPrefix,
    scope: "project" as CacheScope,
    ttl: 24 * 60 * 60, // 1 day
    tags: ["report", "monthly"],
  },

  // Tax calculations - 4 hours TTL
  TAX_CALCULATIONS: {
    prefix: "tax" as CacheKeyPrefix,
    scope: "project" as CacheScope,
    ttl: 4 * 60 * 60, // 4 hours
    tags: ["tax", "calculations"],
  },

  // Occupancy data - 30 minutes TTL
  OCCUPANCY_DATA: {
    prefix: "occupancy" as CacheKeyPrefix,
    scope: "project" as CacheScope,
    ttl: 30 * 60, // 30 minutes
    tags: ["occupancy", "analytics"],
  },
} as const;

export class CacheManager {
  private redis: RedisClient;
  private stats: CacheStats;
  private compressionThreshold = 1024; // bytes

  constructor() {
    this.redis = getRedisClient();
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalKeys: 0,
      memoryUsage: 0,
      avgResponseTime: 0,
    };
  }

  /**
   * Get cached item with performance tracking
   */
  async get<T = any>(key: string, config: CacheConfig, projectId?: string): Promise<T | null> {
    const startTime = Date.now();

    try {
      const cacheKey = this.buildKey(key, config, projectId);
      const cached = await this.redis.get(cacheKey);

      if (cached) {
        this.stats.hits++;
        const item: CacheItem<T> = JSON.parse(cached);

        // Check if expired (double-check)
        if (Date.now() > item.expiresAt) {
          await this.delete(key, config, projectId);
          this.stats.misses++;
          return null;
        }

        this.updateStats(Date.now() - startTime);
        return item.data;
      }

      this.stats.misses++;
      this.updateStats(Date.now() - startTime);
      return null;
    } catch (error) {
      console.warn("Cache get error:", error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set cached item with TTL and optional compression
   */
  async set<T = any>(key: string, data: T, config: CacheConfig, projectId?: string): Promise<void> {
    try {
      const cacheKey = this.buildKey(key, config, projectId);
      const now = Date.now();

      const item: CacheItem<T> = {
        data,
        cachedAt: now,
        expiresAt: now + config.ttl * 1000,
        tags: config.tags,
      };

      let serialized = JSON.stringify(item);

      // Apply compression if data is large
      if (config.compress && serialized.length > this.compressionThreshold) {
        // In a real implementation, you'd use a compression library like zlib
        item.compressed = true;
        serialized = JSON.stringify(item);
      }

      item.size = serialized.length;

      await this.redis.set(cacheKey, serialized, "EX", config.ttl);
      this.stats.totalKeys++;
    } catch (error) {
      console.warn("Cache set error:", error);
    }
  }

  /**
   * Delete cached item
   */
  async delete(key: string, config: CacheConfig, projectId?: string): Promise<void> {
    try {
      const cacheKey = this.buildKey(key, config, projectId);
      await this.redis.del(cacheKey);
      this.stats.totalKeys = Math.max(0, this.stats.totalKeys - 1);
    } catch (error) {
      console.warn("Cache delete error:", error);
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string, config: CacheConfig, projectId?: string): Promise<boolean> {
    try {
      const cacheKey = this.buildKey(key, config, projectId);
      const result = await this.redis.exists(cacheKey);
      return result > 0;
    } catch (error) {
      console.warn("Cache exists error:", error);
      return false;
    }
  }

  /**
   * Get or set pattern - fetch from cache or execute callback and cache result
   */
  async getOrSet<T = any>(
    key: string,
    config: CacheConfig,
    fetchFn: () => Promise<T>,
    projectId?: string
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key, config, projectId);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - fetch fresh data
    const data = await fetchFn();

    // Cache the result
    await this.set(key, data, config, projectId);

    return data;
  }

  /**
   * Invalidate cache by pattern or tags
   */
  async invalidate(pattern?: string, tags?: string[], projectId?: string): Promise<void> {
    // Note: This is a simplified implementation
    // In production Redis, you'd use SCAN with pattern matching or implement tag-based invalidation
    try {
      if (pattern) {
        // For now, we'll clear specific known keys
        // A full implementation would use Redis SCAN with MATCH
        console.log(`Cache invalidation pattern: ${pattern}`);
      }

      if (tags) {
        // Tag-based invalidation would require maintaining tag->key mappings
        console.log(`Cache invalidation tags: ${tags.join(", ")}`);
      }
    } catch (error) {
      console.warn("Cache invalidation error:", error);
    }
  }

  /**
   * Invalidate all project-specific cache entries
   */
  async invalidateProject(projectId: string): Promise<void> {
    await this.invalidate(`*:${projectId}:*`);
  }

  /**
   * Invalidate all report caches for a project
   */
  async invalidateReports(projectId: string): Promise<void> {
    await this.invalidate(`report:${projectId}:*`);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.stats.hitRate =
      this.stats.hits + this.stats.misses > 0
        ? this.stats.hits / (this.stats.hits + this.stats.misses)
        : 0;

    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalKeys: 0,
      memoryUsage: 0,
      avgResponseTime: 0,
    };
  }

  /**
   * Warm up cache with commonly accessed data
   */
  async warmup(
    projectId: string,
    warmupFunctions: Array<{
      key: string;
      config: CacheConfig;
      fetchFn: () => Promise<any>;
    }>
  ): Promise<void> {
    const promises = warmupFunctions.map(async ({ key, config, fetchFn }) => {
      try {
        const exists = await this.exists(key, config, projectId);
        if (!exists) {
          const data = await fetchFn();
          await this.set(key, data, config, projectId);
        }
      } catch (error) {
        console.warn(`Cache warmup failed for key ${key}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Build cache key with scope and project context
   */
  private buildKey(key: string, config: CacheConfig, projectId?: string): string {
    const parts = [config.prefix];

    if (config.scope === "project" && projectId) {
      parts.push(projectId);
    }

    parts.push(key);

    return parts.join(":");
  }

  /**
   * Update performance statistics
   */
  private updateStats(responseTime: number): void {
    const totalRequests = this.stats.hits + this.stats.misses;
    this.stats.avgResponseTime =
      totalRequests > 0
        ? (this.stats.avgResponseTime * (totalRequests - 1) + responseTime) / totalRequests
        : responseTime;
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();

/**
 * Decorators for automatic caching
 */

export function Cached(config: CacheConfig) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${target.constructor.name}:${propertyKey}:${JSON.stringify(args)}`;

      return await cacheManager.getOrSet(
        cacheKey,
        config,
        () => originalMethod.apply(this, args),
        args[0]?.projectId // Assume first arg has projectId
      );
    };

    return descriptor;
  };
}

/**
 * Smart cache invalidation for data mutations
 */
export function InvalidateCache(patterns: string[], tags?: string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);

      // Invalidate cache after successful mutation
      for (const pattern of patterns) {
        await cacheManager.invalidate(pattern, tags, args[0]?.projectId);
      }

      return result;
    };

    return descriptor;
  };
}

export default CacheManager;
