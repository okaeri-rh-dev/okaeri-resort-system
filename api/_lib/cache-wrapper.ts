/**
 * Phase 5.3: Cache Wrapper for API Routes
 * Provides easy-to-use caching for Vercel Edge Functions
 */

import {
  getCache,
  CacheKeys,
  CacheTags,
  CacheTTL,
  type MultiLayerCache,
} from "@/lib/cache/multi-layer-cache";
import type { VercelRequest, VercelResponse } from "@vercel/node";

interface CachedResponse<T = any> {
  data: T;
  cached: boolean;
  cacheAge?: number;
}

/**
 * Wrapper for caching API responses
 */
export async function withCache<T>(
  req: VercelRequest,
  res: VercelResponse,
  key: string,
  fetcher: () => Promise<T>,
  options: {
    ttl?: number;
    tags?: string[];
    staleWhileRevalidate?: number;
    skipCache?: boolean;
  } = {}
): Promise<void> {
  // Skip cache if requested
  if (options.skipCache || req.headers["cache-control"] === "no-cache") {
    const data = await fetcher();
    return res.status(200).json({ data, cached: false });
  }

  const cache = getCache();

  try {
    // Try to get from cache
    const cachedData = await cache.get<T>(key, fetcher, {
      ttl: options.ttl || CacheTTL.MEDIUM,
      tags: options.tags || [],
      staleWhileRevalidate: options.staleWhileRevalidate || CacheTTL.SHORT,
    });

    if (cachedData !== null) {
      // Add cache headers
      res.setHeader("X-Cache", "HIT");
      res.setHeader(
        "Cache-Control",
        `public, max-age=${Math.floor((options.ttl || CacheTTL.MEDIUM) / 1000)}`
      );

      return res.status(200).json({
        data: cachedData,
        cached: true,
      });
    }

    // Cache miss - this shouldn't happen with fetcher provided
    // but handle it just in case
    const freshData = await fetcher();

    res.setHeader("X-Cache", "MISS");
    return res.status(200).json({
      data: freshData,
      cached: false,
    });
  } catch (error) {
    console.error("Cache wrapper error:", error);

    // On error, try to fetch fresh data
    try {
      const freshData = await fetcher();
      res.setHeader("X-Cache", "ERROR");
      return res.status(200).json({
        data: freshData,
        cached: false,
      });
    } catch (fetchError) {
      return res.status(500).json({
        error: "Failed to fetch data",
        message: process.env.NODE_ENV === "development" ? fetchError.message : undefined,
      });
    }
  }
}

/**
 * Invalidate cache by tags
 */
export async function invalidateCache(tags: string[]): Promise<void> {
  const cache = getCache();
  await cache.invalidateByTags(tags);
}

/**
 * Example usage in an API route:
 *
 * export default async function handler(req: VercelRequest, res: VercelResponse) {
 *   const { projectId } = req.query;
 *
 *   await withCache(
 *     req,
 *     res,
 *     CacheKeys.project(projectId, "dashboard"),
 *     async () => {
 *       // Expensive database query
 *       const data = await db.query.bookings.findMany({
 *         where: eq(bookings.projectId, projectId),
 *       });
 *       return data;
 *     },
 *     {
 *       ttl: CacheTTL.MEDIUM,
 *       tags: [CacheTags.PROJECT, CacheTags.DASHBOARD],
 *       staleWhileRevalidate: CacheTTL.SHORT,
 *     }
 *   );
 * }
 */

/**
 * Middleware for automatic cache headers
 */
export function setCacheHeaders(
  res: VercelResponse,
  options: {
    maxAge?: number;
    sMaxAge?: number;
    staleWhileRevalidate?: number;
    private?: boolean;
  } = {}
): void {
  const parts: string[] = [];

  if (options.private) {
    parts.push("private");
  } else {
    parts.push("public");
  }

  if (options.maxAge !== undefined) {
    parts.push(`max-age=${options.maxAge}`);
  }

  if (options.sMaxAge !== undefined) {
    parts.push(`s-maxage=${options.sMaxAge}`);
  }

  if (options.staleWhileRevalidate !== undefined) {
    parts.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
  }

  res.setHeader("Cache-Control", parts.join(", "));
}

/**
 * Cache warmer for critical data
 */
export class CacheWarmer {
  private warmupTasks: Array<{
    key: string;
    fetcher: () => Promise<any>;
    ttl: number;
    tags: string[];
  }> = [];

  /**
   * Register a warmup task
   */
  register(
    key: string,
    fetcher: () => Promise<any>,
    ttl: number = CacheTTL.LONG,
    tags: string[] = []
  ): void {
    this.warmupTasks.push({ key, fetcher, ttl, tags });
  }

  /**
   * Execute all warmup tasks
   */
  async warmup(): Promise<void> {
    const cache = getCache();

    await Promise.allSettled(
      this.warmupTasks.map(async (task) => {
        try {
          const data = await task.fetcher();
          await cache.set(task.key, data, {
            ttl: task.ttl,
            tags: task.tags,
          });
        } catch (error) {
          console.error(`Cache warmup failed for ${task.key}:`, error);
        }
      })
    );
  }
}

// Create singleton warmer
export const cacheWarmer = new CacheWarmer();
