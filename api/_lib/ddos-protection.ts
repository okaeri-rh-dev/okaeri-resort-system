/**
 * Simple DDoS Protection System
 * Phase 5.2 Security Hardening - Focused on basic cost-based rate limiting
 *
 * Provides basic protection against billing attacks by monitoring Vercel usage.
 * Integrates with existing Redis infrastructure for simple request tracking.
 */

import { Redis } from "@upstash/redis";
// DDoS Protection types and utilities
import { logger } from "../../src/lib/logger";

// Simple configuration constants for Vercel Free Tier protection
const VERCEL_LIMITS = {
  BANDWIDTH_LIMIT_GB: 95, // 5GB buffer from 100GB free tier
  FUNCTION_EXECUTION_LIMIT_GB_HOURS: 95, // 5GB-hours buffer from 100GB-hours
  MONTHLY_RESET_DAY: 1, // Reset on 1st of each month
};

// Redis key patterns for tracking usage
const REDIS_KEYS = {
  BANDWIDTH_USAGE: "ddos:bandwidth:monthly",
  EXECUTION_USAGE: "ddos:execution:monthly",
  REQUEST_COUNT: "ddos:requests:monthly",
};

// Initialize Redis client
let redis: Redis | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

// Basic interfaces
interface DDoSProtectionResult {
  allowed: boolean;
  reason?: string;
  currentLimits?: {
    bandwidthUsed: number;
    executionHoursUsed: number;
  };
}

interface DDoSMetrics {
  bandwidthUsedMB: number;
  bandwidthLimitMB: number;
  executionHoursUsed: number;
  executionHoursLimit: number;
  riskLevel: "low" | "medium" | "high";
}

/**
 * Check if requests should be allowed based on current usage
 */
export async function checkDDoSProtection(): Promise<DDoSProtectionResult> {
  if (!redis) {
    // When Redis is not configured, allow requests (fail open)
    logger.warn("DDoS protection disabled - Redis not configured");
    return { allowed: true };
  }

  try {
    // Get current usage from Redis
    const [bandwidthMB, executionHours] = await Promise.all([
      redis.get(REDIS_KEYS.BANDWIDTH_USAGE) || "0",
      redis.get(REDIS_KEYS.EXECUTION_USAGE) || "0",
    ]);

    const bandwidthUsed = parseInt(bandwidthMB as string, 10);
    const executionUsed = parseFloat(executionHours as string);

    // Convert limits to MB for comparison
    const bandwidthLimitMB = VERCEL_LIMITS.BANDWIDTH_LIMIT_GB * 1024;
    const executionLimitHours = VERCEL_LIMITS.FUNCTION_EXECUTION_LIMIT_GB_HOURS;

    // Check if we're approaching limits
    if (bandwidthUsed >= bandwidthLimitMB) {
      logger.warn("DDoS protection activated - bandwidth limit exceeded", {
        bandwidthUsed,
        limit: bandwidthLimitMB,
      });

      return {
        allowed: false,
        reason: "Bandwidth limit exceeded",
        currentLimits: {
          bandwidthUsed,
          executionHoursUsed: executionUsed,
        },
      };
    }

    if (executionUsed >= executionLimitHours) {
      logger.warn("DDoS protection activated - execution hours limit exceeded", {
        executionHoursUsed: executionUsed,
        limit: executionLimitHours,
      });

      return {
        allowed: false,
        reason: "Execution hours limit exceeded",
        currentLimits: {
          bandwidthUsed,
          executionHoursUsed: executionUsed,
        },
      };
    }

    // Request allowed
    return {
      allowed: true,
      reason: "Within limits",
      currentLimits: {
        bandwidthUsed,
        executionHoursUsed: executionUsed,
      },
    };
  } catch (error) {
    // On error, fail open but log the issue
    logger.error("DDoS protection check failed", error as Error);
    return {
      allowed: true,
      reason: "Monitoring unavailable - allowing request",
    };
  }
}

/**
 * Record completion of a request for usage tracking
 */
export async function recordRequestCompletion(): Promise<void> {
  if (!redis) {
    return; // Silently skip if Redis not configured
  }

  try {
    // Simple request counting - increment monthly request counter
    await redis.incr(REDIS_KEYS.REQUEST_COUNT);

    // Set expiry to reset at month end if not already set
    const ttl = await redis.ttl(REDIS_KEYS.REQUEST_COUNT);
    if (ttl === -1) {
      // No expiry set
      const now = new Date();
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      const ttlSeconds = Math.floor((monthEnd.getTime() - now.getTime()) / 1000);
      await redis.expire(REDIS_KEYS.REQUEST_COUNT, ttlSeconds);
    }
  } catch (error) {
    // Log but don't throw - request completion recording should not block responses
    logger.debug("Failed to record request completion", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Get current DDoS protection metrics
 */
export async function getDDoSMetrics(): Promise<DDoSMetrics> {
  if (!redis) {
    return {
      bandwidthUsedMB: 0,
      bandwidthLimitMB: VERCEL_LIMITS.BANDWIDTH_LIMIT_GB * 1024,
      executionHoursUsed: 0,
      executionHoursLimit: VERCEL_LIMITS.FUNCTION_EXECUTION_LIMIT_GB_HOURS,
      riskLevel: "low",
    };
  }

  try {
    const [bandwidthMB, executionHours] = await Promise.all([
      redis.get(REDIS_KEYS.BANDWIDTH_USAGE) || "0",
      redis.get(REDIS_KEYS.EXECUTION_USAGE) || "0",
    ]);

    const bandwidthUsed = parseInt(bandwidthMB as string, 10);
    const executionUsed = parseFloat(executionHours as string);
    const bandwidthLimit = VERCEL_LIMITS.BANDWIDTH_LIMIT_GB * 1024;
    const executionLimit = VERCEL_LIMITS.FUNCTION_EXECUTION_LIMIT_GB_HOURS;

    // Calculate risk level based on usage percentages
    const bandwidthRisk = bandwidthUsed / bandwidthLimit;
    const executionRisk = executionUsed / executionLimit;
    const maxRisk = Math.max(bandwidthRisk, executionRisk);

    let riskLevel: "low" | "medium" | "high" = "low";
    if (maxRisk > 0.85) {
      riskLevel = "high";
    } else if (maxRisk > 0.65) {
      riskLevel = "medium";
    }

    return {
      bandwidthUsedMB: bandwidthUsed,
      bandwidthLimitMB: bandwidthLimit,
      executionHoursUsed: executionUsed,
      executionHoursLimit: executionLimit,
      riskLevel,
    };
  } catch (error) {
    logger.error("Failed to get DDoS metrics", error as Error);
    return {
      bandwidthUsedMB: 0,
      bandwidthLimitMB: VERCEL_LIMITS.BANDWIDTH_LIMIT_GB * 1024,
      executionHoursUsed: 0,
      executionHoursLimit: VERCEL_LIMITS.FUNCTION_EXECUTION_LIMIT_GB_HOURS,
      riskLevel: "low",
    };
  }
}

/**
 * Reset monthly metrics (typically called on 1st of each month)
 */
export async function resetMonthlyMetrics(): Promise<void> {
  if (!redis) {
    return;
  }

  try {
    await Promise.all([
      redis.del(REDIS_KEYS.BANDWIDTH_USAGE),
      redis.del(REDIS_KEYS.EXECUTION_USAGE),
      redis.del(REDIS_KEYS.REQUEST_COUNT),
    ]);

    logger.info("DDoS protection metrics reset for new month");
  } catch (error) {
    logger.error("Failed to reset monthly DDoS metrics", error as Error);
  }
}
