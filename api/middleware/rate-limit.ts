/**
 * Rate limiting middleware for API routes
 * Implements token bucket algorithm with memory/Redis storage
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// In-memory store for development (when Redis not available)
const memoryStore = new Map<string, { tokens: number; lastRefill: number }>();

// Rate limit configurations for different endpoints
export const RATE_LIMITS = {
  // Auth endpoints
  login: { tokens: 5, window: "15m" }, // 5 attempts per 15 minutes
  register: { tokens: 3, window: "1h" }, // 3 registrations per hour
  resetPassword: { tokens: 3, window: "1h" }, // 3 reset attempts per hour

  // API endpoints
  default: { tokens: 100, window: "1m" }, // 100 requests per minute
  read: { tokens: 200, window: "1m" }, // 200 read requests per minute
  write: { tokens: 50, window: "1m" }, // 50 write requests per minute
  upload: { tokens: 10, window: "10m" }, // 10 uploads per 10 minutes
  report: { tokens: 5, window: "5m" }, // 5 report generations per 5 minutes
} as const;

// Initialize Redis client if available
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

// Create rate limiter instances
const rateLimiters: Record<string, Ratelimit | null> = {};

// Initialize rate limiters for each configuration
Object.entries(RATE_LIMITS).forEach(([key, config]) => {
  if (redis) {
    rateLimiters[key] = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.tokens, config.window),
    });
  } else {
    rateLimiters[key] = null; // Will use in-memory fallback
  }
});

/**
 * Get client identifier from request
 */
function getClientId(req: VercelRequest, customId?: string): string {
  if (customId) return customId;

  // Try to get authenticated user ID from token
  const userId = (req as any).user?.userId;
  if (userId) return `user:${userId}`;

  // Fallback to IP address
  const ip =
    req.headers["x-forwarded-for"] ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown";

  return `ip:${Array.isArray(ip) ? ip[0] : ip}`;
}

/**
 * In-memory rate limiting (fallback when Redis not available)
 */
async function checkMemoryRateLimit(
  clientId: string,
  limit: number,
  windowMs: number
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const now = Date.now();
  const bucket = memoryStore.get(clientId);

  if (!bucket || now - bucket.lastRefill > windowMs) {
    // Create new bucket or refill expired one
    memoryStore.set(clientId, { tokens: limit - 1, lastRefill: now });
    return {
      success: true,
      remaining: limit - 1,
      reset: now + windowMs,
    };
  }

  if (bucket.tokens > 0) {
    // Consume token
    bucket.tokens -= 1;
    memoryStore.set(clientId, bucket);
    return {
      success: true,
      remaining: bucket.tokens,
      reset: bucket.lastRefill + windowMs,
    };
  }

  // No tokens left
  return {
    success: false,
    remaining: 0,
    reset: bucket.lastRefill + windowMs,
  };
}

/**
 * Parse window string to milliseconds
 */
function parseWindow(window: string): number {
  const match = window.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid window format: ${window}`);

  const [, value, unit] = match;
  const num = parseInt(value, 10);

  switch (unit) {
    case "s":
      return num * 1000;
    case "m":
      return num * 60 * 1000;
    case "h":
      return num * 60 * 60 * 1000;
    case "d":
      return num * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Invalid time unit: ${unit}`);
  }
}

/**
 * Rate limiting middleware
 */
export function rateLimit(limitKey: keyof typeof RATE_LIMITS = "default", customId?: string) {
  return (handler: (req: VercelRequest, res: VercelResponse) => Promise<void>) => {
    return async (req: VercelRequest, res: VercelResponse) => {
      try {
        const clientId = getClientId(req, customId);
        const config = RATE_LIMITS[limitKey];
        const limiter = rateLimiters[limitKey];

        let result: { success: boolean; remaining: number; reset: number };

        if (limiter) {
          // Use Redis-based rate limiting
          const { success, limit, reset, remaining } = await limiter.limit(clientId);
          result = {
            success,
            remaining,
            reset,
          };
        } else {
          // Fallback to in-memory rate limiting
          const windowMs = parseWindow(config.window);
          result = await checkMemoryRateLimit(clientId, config.tokens, windowMs);
        }

        // Set rate limit headers
        res.setHeader("X-RateLimit-Limit", config.tokens.toString());
        res.setHeader("X-RateLimit-Remaining", result.remaining.toString());
        res.setHeader("X-RateLimit-Reset", new Date(result.reset).toISOString());

        if (!result.success) {
          res.status(429).json({
            error: "Too many requests",
            code: "RATE_LIMIT_EXCEEDED",
            retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
            reset: new Date(result.reset).toISOString(),
          });
          return;
        }

        // Continue to handler
        await handler(req, res);
      } catch (error) {
        console.error("[RateLimit] Error:", error);
        // On error, allow request through (fail open)
        await handler(req, res);
      }
    };
  };
}

/**
 * Custom rate limit with specific configuration
 */
export function customRateLimit(tokens: number, window: string, identifier?: string) {
  return (handler: (req: VercelRequest, res: VercelResponse) => Promise<void>) => {
    return async (req: VercelRequest, res: VercelResponse) => {
      try {
        const clientId = getClientId(req, identifier);
        const windowMs = parseWindow(window);

        let result: { success: boolean; remaining: number; reset: number };

        if (redis) {
          // Use Redis-based rate limiting
          const limiter = new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(tokens, window),
          });
          const { success, limit, reset, remaining } = await limiter.limit(clientId);
          result = { success, remaining, reset };
        } else {
          // Fallback to in-memory
          result = await checkMemoryRateLimit(clientId, tokens, windowMs);
        }

        // Set headers
        res.setHeader("X-RateLimit-Limit", tokens.toString());
        res.setHeader("X-RateLimit-Remaining", result.remaining.toString());
        res.setHeader("X-RateLimit-Reset", new Date(result.reset).toISOString());

        if (!result.success) {
          res.status(429).json({
            error: "Too many requests",
            code: "RATE_LIMIT_EXCEEDED",
            retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
            reset: new Date(result.reset).toISOString(),
          });
          return;
        }

        await handler(req, res);
      } catch (error) {
        console.error("[RateLimit] Custom error:", error);
        await handler(req, res);
      }
    };
  };
}

/**
 * Clean up expired memory store entries (for development)
 */
if (!redis && process.env.NODE_ENV !== "production") {
  setInterval(
    () => {
      const now = Date.now();
      const maxAge = 60 * 60 * 1000; // 1 hour

      for (const [key, value] of memoryStore.entries()) {
        if (now - value.lastRefill > maxAge) {
          memoryStore.delete(key);
        }
      }
    },
    5 * 60 * 1000
  ); // Clean every 5 minutes
}
