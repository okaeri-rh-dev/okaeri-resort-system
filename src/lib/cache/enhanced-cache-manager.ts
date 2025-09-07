/**
 * Enhanced Cache Manager Service
 * Phase 4.4 Week 3.2 - Smart Caching with Background Refresh
 *
 * Advanced Redis caching layer with intelligent TTL management, dependency tracking,
 * background refresh capabilities, and Philippine resort business optimization patterns.
 *
 * Key Features:
 * - Smart TTL based on data volatility patterns
 * - Dependency-based cache invalidation
 * - Background refresh with worker queues
 * - Cache warming for predictable access patterns
 * - Performance monitoring with 90%+ hit rate targets
 */

import { getRedisClient, type RedisClient } from "./redis";
import { cacheManager, type CacheConfig, type CacheStats } from "./cache-manager";

export interface SmartCacheConfig extends CacheConfig {
  // Smart TTL configuration
  minTTL?: number; // Minimum TTL (default: 30 seconds)
  maxTTL?: number; // Maximum TTL (default: 24 hours)
  volatilityFactor?: number; // How much data changes (0-1, default: 0.3)

  // Dependency tracking
  dependencies?: string[]; // Other cache keys this depends on
  dependents?: string[]; // Cache keys that depend on this

  // Background refresh
  refreshThreshold?: number; // Refresh when TTL < threshold (default: 0.2)
  backgroundRefresh?: boolean; // Enable background refresh (default: true)
  refreshPriority?: "high" | "normal" | "low"; // Refresh priority

  // Performance optimization
  warmupPredictable?: boolean; // Pre-warm predictable patterns (default: false)
  batchInvalidation?: boolean; // Batch related invalidations (default: true)
}

export interface CacheDependencyGraph {
  [key: string]: {
    dependencies: Set<string>;
    dependents: Set<string>;
    lastAccessed: number;
    accessCount: number;
    hitRate: number;
  };
}

export interface BackgroundRefreshJob {
  id: string;
  cacheKey: string;
  config: SmartCacheConfig;
  fetchFunction: () => Promise<any>;
  priority: "high" | "normal" | "low";
  scheduledAt: number;
  retryCount: number;
  projectId?: string;
}

export interface EnhancedCacheStats extends CacheStats {
  backgroundRefreshes: number;
  dependencyInvalidations: number;
  warmupHits: number;
  smartTTLAdjustments: number;
  queuedRefreshJobs: number;
  failedRefreshJobs: number;
  averageRefreshTime: number;
}

/**
 * Philippine Resort Business Cache Patterns
 */
export const RESORT_CACHE_PATTERNS = {
  // Peak season optimization (Dec-Jan, Mar-May)
  SEASONAL_REPORTS: {
    prefix: "seasonal" as const,
    scope: "project" as const,
    ttl: 6 * 60 * 60, // 6 hours during peak
    minTTL: 2 * 60 * 60, // 2 hours minimum
    maxTTL: 24 * 60 * 60, // 24 hours max
    volatilityFactor: 0.6, // High volatility during peak season
    backgroundRefresh: true,
    refreshThreshold: 0.3,
    warmupPredictable: true,
    tags: ["seasonal", "reports", "peak-season"],
  },

  // Daily operational metrics (high volatility)
  DAILY_OPERATIONS: {
    prefix: "operations" as const,
    scope: "project" as const,
    ttl: 15 * 60, // 15 minutes
    minTTL: 5 * 60, // 5 minutes minimum
    maxTTL: 30 * 60, // 30 minutes max
    volatilityFactor: 0.8, // Very high volatility
    backgroundRefresh: true,
    refreshThreshold: 0.5, // Refresh aggressively
    dependencies: ["bookings", "payments", "occupancy"],
    tags: ["operations", "realtime", "volatile"],
  },

  // BIR compliance reports (stable, predictable)
  BIR_COMPLIANCE: {
    prefix: "bir" as const,
    scope: "project" as const,
    ttl: 4 * 60 * 60, // 4 hours
    minTTL: 2 * 60 * 60, // 2 hours minimum
    maxTTL: 12 * 60 * 60, // 12 hours max
    volatilityFactor: 0.2, // Low volatility (stable)
    backgroundRefresh: true,
    refreshThreshold: 0.2,
    warmupPredictable: true,
    tags: ["bir", "compliance", "stable"],
  },

  // Financial analytics (medium volatility)
  FINANCIAL_ANALYTICS: {
    prefix: "analytics" as const,
    scope: "project" as const,
    ttl: 30 * 60, // 30 minutes
    minTTL: 10 * 60, // 10 minutes minimum
    maxTTL: 2 * 60 * 60, // 2 hours max
    volatilityFactor: 0.4, // Medium volatility
    backgroundRefresh: true,
    refreshThreshold: 0.3,
    dependencies: ["transactions", "bookings", "expenses"],
    tags: ["analytics", "financial", "medium-volatility"],
  },

  // Guest booking patterns (predictable, cache-friendly)
  BOOKING_PATTERNS: {
    prefix: "bookings" as const,
    scope: "project" as const,
    ttl: 2 * 60 * 60, // 2 hours
    minTTL: 30 * 60, // 30 minutes minimum
    maxTTL: 6 * 60 * 60, // 6 hours max
    volatilityFactor: 0.3, // Low-medium volatility
    backgroundRefresh: true,
    refreshThreshold: 0.25,
    warmupPredictable: true,
    dependents: ["occupancy", "revenue", "analytics"],
    tags: ["bookings", "patterns", "predictable"],
  },
} as const;

export class EnhancedCacheManager {
  private redis: RedisClient;
  private dependencyGraph: CacheDependencyGraph = {};
  private refreshQueue: Map<string, BackgroundRefreshJob> = new Map();
  private stats: EnhancedCacheStats;
  private refreshWorkerInterval: NodeJS.Timeout | null = null;
  private accessPatterns: Map<string, number[]> = new Map();

  constructor() {
    this.redis = getRedisClient();
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalKeys: 0,
      memoryUsage: 0,
      avgResponseTime: 0,
      backgroundRefreshes: 0,
      dependencyInvalidations: 0,
      warmupHits: 0,
      smartTTLAdjustments: 0,
      queuedRefreshJobs: 0,
      failedRefreshJobs: 0,
      averageRefreshTime: 0,
    };

    this.initializeBackgroundWorker();
  }

  /**
   * Initialize background refresh worker
   */
  private initializeBackgroundWorker(): void {
    // Process background refresh queue every 30 seconds
    this.refreshWorkerInterval = setInterval(() => {
      this.processRefreshQueue();
    }, 30 * 1000);
  }

  /**
   * Enhanced get with smart TTL and dependency tracking
   */
  async getWithSmartTTL<T = any>(
    key: string,
    config: SmartCacheConfig,
    fetchFunction: () => Promise<T>,
    projectId?: string
  ): Promise<T> {
    const startTime = Date.now();
    const cacheKey = this.buildSmartKey(key, config, projectId);

    try {
      // Try to get from cache
      const cached = await this.redis.get(cacheKey);

      if (cached) {
        const item = JSON.parse(cached);
        const now = Date.now();

        // Track access pattern
        this.trackAccess(cacheKey);

        // Check if within TTL
        if (now < item.expiresAt) {
          this.stats.hits++;

          // Schedule background refresh if approaching expiry
          if (config.backgroundRefresh && this.shouldScheduleRefresh(item, config)) {
            this.scheduleBackgroundRefresh(cacheKey, config, fetchFunction, projectId);
          }

          this.updateResponseStats(Date.now() - startTime);
          return item.data;
        } else {
          // Expired - remove from cache
          await this.redis.del(cacheKey);
        }
      }

      // Cache miss - fetch fresh data
      this.stats.misses++;
      const data = await fetchFunction();

      // Calculate smart TTL based on access patterns and volatility
      const smartTTL = this.calculateSmartTTL(cacheKey, config);
      const smartConfig = { ...config, ttl: smartTTL };

      // Store with smart TTL
      await this.setWithDependencies(key, data, smartConfig, projectId);

      this.updateResponseStats(Date.now() - startTime);
      return data;
    } catch (error) {
      console.warn("Enhanced cache get error:", error);
      this.stats.misses++;
      return await fetchFunction();
    }
  }

  /**
   * Set with dependency tracking
   */
  async setWithDependencies<T = any>(
    key: string,
    data: T,
    config: SmartCacheConfig,
    projectId?: string
  ): Promise<void> {
    const cacheKey = this.buildSmartKey(key, config, projectId);
    const now = Date.now();

    const item = {
      data,
      cachedAt: now,
      expiresAt: now + config.ttl * 1000,
      tags: config.tags,
      dependencies: config.dependencies || [],
      volatility: config.volatilityFactor || 0.3,
      accessCount: 0,
      lastAccessed: now,
    };

    try {
      // Store the cached item
      await this.redis.set(cacheKey, JSON.stringify(item), "EX", config.ttl);

      // Update dependency graph
      this.updateDependencyGraph(cacheKey, config);

      this.stats.totalKeys++;
    } catch (error) {
      console.warn("Enhanced cache set error:", error);
    }
  }

  /**
   * Calculate smart TTL based on access patterns and volatility
   */
  private calculateSmartTTL(cacheKey: string, config: SmartCacheConfig): number {
    const baseRelative = config.ttl;
    const minTTL = config.minTTL || 30; // 30 seconds
    const maxTTL = config.maxTTL || 24 * 60 * 60; // 24 hours
    const volatility = config.volatilityFactor || 0.3;

    // Get access pattern for this key
    const accessPattern = this.accessPatterns.get(cacheKey) || [];
    const recentAccess = accessPattern.filter((time) => Date.now() - time < 60 * 60 * 1000); // Last hour

    // Calculate adjustment factors
    let adjustmentFactor = 1.0;

    // More frequent access = longer TTL (up to 2x)
    if (recentAccess.length > 10) {
      adjustmentFactor *= Math.min(2.0, 1 + recentAccess.length / 100);
    }

    // Lower volatility = longer TTL
    adjustmentFactor *= 2 - volatility; // volatility 0.1 -> 1.9x, 0.9 -> 1.1x

    // Business hours optimization (Philippine timezone UTC+8)
    const now = new Date();
    const philippineHour = (now.getUTCHours() + 8) % 24;
    const isBusinessHours = philippineHour >= 8 && philippineHour <= 18;

    if (isBusinessHours) {
      // Shorter TTL during business hours (more volatile)
      adjustmentFactor *= 0.7;
    } else {
      // Longer TTL during off-hours (less volatile)
      adjustmentFactor *= 1.3;
    }

    // Calculate final TTL
    const smartTTL = Math.round(baseRelative * adjustmentFactor);
    const finalTTL = Math.max(minTTL, Math.min(maxTTL, smartTTL));

    // Track smart TTL adjustments
    if (finalTTL !== baseRelative) {
      this.stats.smartTTLAdjustments++;
    }

    return finalTTL;
  }

  /**
   * Check if background refresh should be scheduled
   */
  private shouldScheduleRefresh(item: any, config: SmartCacheConfig): boolean {
    const refreshThreshold = config.refreshThreshold || 0.2;
    const timeRemaining = item.expiresAt - Date.now();
    const totalTTL = item.expiresAt - item.cachedAt;
    const remainingRatio = timeRemaining / totalTTL;

    return remainingRatio <= refreshThreshold;
  }

  /**
   * Schedule background refresh
   */
  private scheduleBackgroundRefresh(
    cacheKey: string,
    config: SmartCacheConfig,
    fetchFunction: () => Promise<any>,
    projectId?: string
  ): void {
    const jobId = `${cacheKey}-${Date.now()}`;
    const priority = config.refreshPriority || "normal";

    const job: BackgroundRefreshJob = {
      id: jobId,
      cacheKey,
      config,
      fetchFunction,
      priority,
      scheduledAt: Date.now(),
      retryCount: 0,
      projectId,
    };

    this.refreshQueue.set(jobId, job);
    this.stats.queuedRefreshJobs = this.refreshQueue.size;
  }

  /**
   * Process background refresh queue
   */
  private async processRefreshQueue(): Promise<void> {
    if (this.refreshQueue.size === 0) return;

    // Sort jobs by priority and schedule time
    const jobs = Array.from(this.refreshQueue.values()).sort((a, b) => {
      const priorityWeight = { high: 3, normal: 2, low: 1 };
      if (priorityWeight[a.priority] !== priorityWeight[b.priority]) {
        return priorityWeight[b.priority] - priorityWeight[a.priority];
      }
      return a.scheduledAt - b.scheduledAt;
    });

    // Process up to 5 jobs per batch to avoid overwhelming the system
    const batchSize = 5;
    const batch = jobs.slice(0, batchSize);

    await Promise.allSettled(batch.map((job) => this.executeRefreshJob(job)));
  }

  /**
   * Execute individual refresh job
   */
  private async executeRefreshJob(job: BackgroundRefreshJob): Promise<void> {
    const startTime = Date.now();

    try {
      const data = await job.fetchFunction();
      const [, key] = job.cacheKey.split(":", 2); // Extract original key

      await this.setWithDependencies(key, data, job.config, job.projectId);

      this.stats.backgroundRefreshes++;
      this.updateRefreshStats(Date.now() - startTime);
    } catch (error) {
      console.warn(`Background refresh failed for ${job.cacheKey}:`, error);

      job.retryCount++;
      if (job.retryCount < 3) {
        // Reschedule with exponential backoff
        job.scheduledAt = Date.now() + Math.pow(2, job.retryCount) * 60 * 1000;
        return; // Keep job in queue
      } else {
        this.stats.failedRefreshJobs++;
      }
    }

    // Remove job from queue
    this.refreshQueue.delete(job.id);
    this.stats.queuedRefreshJobs = this.refreshQueue.size;
  }

  /**
   * Update dependency graph
   */
  private updateDependencyGraph(cacheKey: string, config: SmartCacheConfig): void {
    if (!this.dependencyGraph[cacheKey]) {
      this.dependencyGraph[cacheKey] = {
        dependencies: new Set(),
        dependents: new Set(),
        lastAccessed: Date.now(),
        accessCount: 0,
        hitRate: 0,
      };
    }

    const graph = this.dependencyGraph[cacheKey];

    // Add dependencies
    if (config.dependencies) {
      config.dependencies.forEach((dep) => {
        graph.dependencies.add(dep);

        // Add reverse relationship
        if (!this.dependencyGraph[dep]) {
          this.dependencyGraph[dep] = {
            dependencies: new Set(),
            dependents: new Set(),
            lastAccessed: Date.now(),
            accessCount: 0,
            hitRate: 0,
          };
        }
        this.dependencyGraph[dep].dependents.add(cacheKey);
      });
    }

    // Add dependents
    if (config.dependents) {
      config.dependents.forEach((dependent) => {
        graph.dependents.add(dependent);

        // Add reverse relationship
        if (!this.dependencyGraph[dependent]) {
          this.dependencyGraph[dependent] = {
            dependencies: new Set(),
            dependents: new Set(),
            lastAccessed: Date.now(),
            accessCount: 0,
            hitRate: 0,
          };
        }
        this.dependencyGraph[dependent].dependencies.add(cacheKey);
      });
    }
  }

  /**
   * Invalidate by dependency
   */
  async invalidateByDependency(dependency: string, projectId?: string): Promise<string[]> {
    const invalidatedKeys: string[] = [];

    // Find all cache keys that depend on this dependency
    const keysToInvalidate = new Set<string>();

    // Direct dependents
    if (this.dependencyGraph[dependency]) {
      this.dependencyGraph[dependency].dependents.forEach((key) => {
        keysToInvalidate.add(key);
      });
    }

    // Pattern-based invalidation for related keys
    const pattern = projectId ? `*:${projectId}:*${dependency}*` : `*${dependency}*`;
    // Note: In production, you'd use Redis SCAN for pattern matching
    // For now, we'll track keys manually

    // Invalidate found keys
    const invalidationPromises = Array.from(keysToInvalidate).map(async (key) => {
      try {
        await this.redis.del(key);
        invalidatedKeys.push(key);

        // Update stats
        if (this.dependencyGraph[key]) {
          this.dependencyGraph[key].accessCount = 0;
        }
      } catch (error) {
        console.warn(`Failed to invalidate key ${key}:`, error);
      }
    });

    await Promise.allSettled(invalidationPromises);

    this.stats.dependencyInvalidations += invalidatedKeys.length;
    this.stats.totalKeys = Math.max(0, this.stats.totalKeys - invalidatedKeys.length);

    return invalidatedKeys;
  }

  /**
   * Warm cache for predictable patterns
   */
  async warmCacheForPredictablePatterns(
    projectId: string,
    patterns: Array<{
      key: string;
      config: SmartCacheConfig;
      fetchFunction: () => Promise<any>;
    }>
  ): Promise<void> {
    const warmupPromises = patterns
      .filter((p) => p.config.warmupPredictable)
      .map(async ({ key, config, fetchFunction }) => {
        try {
          const cacheKey = this.buildSmartKey(key, config, projectId);
          const exists = await this.redis.exists(cacheKey);

          if (!exists) {
            const data = await fetchFunction();
            await this.setWithDependencies(key, data, config, projectId);
            this.stats.warmupHits++;
          }
        } catch (error) {
          console.warn(`Cache warmup failed for pattern ${key}:`, error);
        }
      });

    await Promise.allSettled(warmupPromises);
  }

  /**
   * Track access patterns
   */
  private trackAccess(cacheKey: string): void {
    const now = Date.now();

    // Update access pattern
    if (!this.accessPatterns.has(cacheKey)) {
      this.accessPatterns.set(cacheKey, []);
    }

    const pattern = this.accessPatterns.get(cacheKey)!;
    pattern.push(now);

    // Keep only last 1000 access times to manage memory
    if (pattern.length > 1000) {
      pattern.splice(0, pattern.length - 1000);
    }

    // Update dependency graph
    if (this.dependencyGraph[cacheKey]) {
      this.dependencyGraph[cacheKey].lastAccessed = now;
      this.dependencyGraph[cacheKey].accessCount++;
    }
  }

  /**
   * Build smart cache key
   */
  private buildSmartKey(key: string, config: SmartCacheConfig, projectId?: string): string {
    const parts = [config.prefix];

    if (config.scope === "project" && projectId) {
      parts.push(projectId);
    }

    parts.push(key);

    return parts.join(":");
  }

  /**
   * Update response time statistics
   */
  private updateResponseStats(responseTime: number): void {
    const totalRequests = this.stats.hits + this.stats.misses;
    this.stats.avgResponseTime =
      totalRequests > 0
        ? (this.stats.avgResponseTime * (totalRequests - 1) + responseTime) / totalRequests
        : responseTime;
  }

  /**
   * Update refresh time statistics
   */
  private updateRefreshStats(refreshTime: number): void {
    const totalRefreshes = this.stats.backgroundRefreshes;
    this.stats.averageRefreshTime =
      totalRefreshes > 0
        ? (this.stats.averageRefreshTime * (totalRefreshes - 1) + refreshTime) / totalRefreshes
        : refreshTime;
  }

  /**
   * Get enhanced cache statistics
   */
  getEnhancedStats(): EnhancedCacheStats {
    this.stats.hitRate =
      this.stats.hits + this.stats.misses > 0
        ? this.stats.hits / (this.stats.hits + this.stats.misses)
        : 0;

    return { ...this.stats };
  }

  /**
   * Get dependency graph analysis
   */
  getDependencyAnalysis(): {
    totalDependencies: number;
    averageDependencies: number;
    mostAccessedKeys: Array<{ key: string; accessCount: number; hitRate: number }>;
    orphanedKeys: string[];
  } {
    const keys = Object.keys(this.dependencyGraph);
    const totalDependencies = keys.reduce((sum, key) => {
      return sum + this.dependencyGraph[key].dependencies.size;
    }, 0);

    const averageDependencies = keys.length > 0 ? totalDependencies / keys.length : 0;

    const mostAccessedKeys = keys
      .map((key) => ({
        key,
        accessCount: this.dependencyGraph[key].accessCount,
        hitRate: this.dependencyGraph[key].hitRate,
      }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10);

    const orphanedKeys = keys.filter((key) => {
      const graph = this.dependencyGraph[key];
      return (
        graph.dependencies.size === 0 && graph.dependents.size === 0 && graph.accessCount === 0
      );
    });

    return {
      totalDependencies,
      averageDependencies,
      mostAccessedKeys,
      orphanedKeys,
    };
  }

  /**
   * Cleanup orphaned keys and optimize memory
   */
  async optimizeCache(): Promise<{
    removedKeys: number;
    freedMemory: number;
    optimizedDependencies: number;
  }> {
    const analysis = this.getDependencyAnalysis();
    let removedKeys = 0;
    let optimizedDependencies = 0;

    // Remove orphaned keys that haven't been accessed in 24 hours
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000;
    const keysToRemove = analysis.orphanedKeys.filter((key) => {
      const graph = this.dependencyGraph[key];
      return graph.lastAccessed < cutoffTime;
    });

    for (const key of keysToRemove) {
      try {
        await this.redis.del(key);
        delete this.dependencyGraph[key];
        this.accessPatterns.delete(key);
        removedKeys++;
      } catch (error) {
        console.warn(`Failed to remove orphaned key ${key}:`, error);
      }
    }

    // Clean up stale access patterns (older than 1 hour)
    const accessCutoff = Date.now() - 60 * 60 * 1000;
    for (const [key, pattern] of this.accessPatterns.entries()) {
      const filtered = pattern.filter((time) => time > accessCutoff);
      if (filtered.length !== pattern.length) {
        this.accessPatterns.set(key, filtered);
        optimizedDependencies++;
      }
    }

    return {
      removedKeys,
      freedMemory: removedKeys * 1024, // Rough estimate
      optimizedDependencies,
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.refreshWorkerInterval) {
      clearInterval(this.refreshWorkerInterval);
    }

    this.refreshQueue.clear();
    this.dependencyGraph = {};
    this.accessPatterns.clear();
  }
}

// Export singleton instance
export const enhancedCacheManager = new EnhancedCacheManager();

/**
 * Decorator for automatic smart caching with dependencies
 */
export function SmartCached(config: SmartCacheConfig) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${target.constructor.name}:${propertyKey}:${JSON.stringify(args).slice(0, 100)}`;

      return await enhancedCacheManager.getWithSmartTTL(
        cacheKey,
        config,
        () => originalMethod.apply(this, args),
        args[0]?.projectId
      );
    };

    return descriptor;
  };
}

export default EnhancedCacheManager;
