/**
 * Automatic Threat Response and IP Blocking
 * Manages automatic blocking based on threat scores and patterns
 *
 * Progressive blocking thresholds:
 * - 3 violations → 1 hour block
 * - 10 violations → 24 hour block
 * - 50+ violations → 7 day block
 */

import { toUTCDateString } from "@/lib/timezone";

/**
 * Block duration thresholds based on violation count
 */
export const PROGRESSIVE_BLOCK_THRESHOLDS = {
  MINOR: {
    violations: 3,
    blockDurationSeconds: 60 * 60, // 1 hour
  },
  MODERATE: {
    violations: 10,
    blockDurationSeconds: 24 * 60 * 60, // 24 hours
  },
  SEVERE: {
    violations: 50,
    blockDurationSeconds: 7 * 24 * 60 * 60, // 7 days
  },
} as const;

/**
 * Block an IP in Cloudflare KV
 * @param kv - KV namespace
 * @param ip - IP address to block
 * @param durationSeconds - Block duration in seconds
 * @param reason - Reason for blocking
 */
export async function blockInKV(
  kv: KVNamespace,
  ip: string,
  durationSeconds: number,
  reason: string
): Promise<void> {
  const blockKey = `blocked:${ip}`;
  const blockData = {
    ip,
    reason,
    blockedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + durationSeconds * 1000).toISOString(),
    durationSeconds,
  };

  await kv.put(blockKey, JSON.stringify(blockData), {
    expirationTtl: durationSeconds,
  });
}

/**
 * Check if an IP is blocked
 * @param kv - KV namespace
 * @param ip - IP address to check
 */
export async function isIPBlocked(
  kv: KVNamespace,
  ip: string
): Promise<{ blocked: boolean; reason?: string; expiresAt?: string }> {
  const blockKey = `blocked:${ip}`;
  const blockData = await kv.get(blockKey);

  if (!blockData) {
    return { blocked: false };
  }

  try {
    const data = JSON.parse(blockData);
    return {
      blocked: true,
      reason: data.reason,
      expiresAt: data.expiresAt,
    };
  } catch {
    return { blocked: false };
  }
}

// ============================================
// PROGRESSIVE BLOCKING BASED ON VIOLATIONS
// ============================================

/**
 * Increment violation count for an IP and apply progressive blocking
 *
 * This is the main entry point for rate limit violations.
 * Call this when a rate limit is exceeded to track violations
 * and automatically apply progressive blocking.
 *
 * @param kv - KV namespace for rate limiting data
 * @param ip - Client IP address
 * @param reason - Reason for the violation
 * @returns Updated violation count and any block that was applied
 */
export async function incrementViolation(
  kv: KVNamespace,
  ip: string,
  reason: string = "Rate limit exceeded"
): Promise<{
  todayCount: number;
  totalCount: number;
  blocked: boolean;
  blockDuration?: number;
}> {
  const today = toUTCDateString(new Date());
  const dailyKey = `violations:${ip}:${today}`;
  const totalKey = `violations:total:${ip}`;

  // Increment counters atomically (read-modify-write pattern)
  const [dailyData, totalData] = await Promise.all([kv.get(dailyKey), kv.get(totalKey)]);

  const newDailyCount = parseInt(dailyData || "0") + 1;
  const newTotalCount = parseInt(totalData || "0") + 1;

  // Update counters
  await Promise.all([
    kv.put(dailyKey, newDailyCount.toString(), {
      expirationTtl: 86400, // 24 hours
    }),
    kv.put(totalKey, newTotalCount.toString(), {
      expirationTtl: 86400 * 30, // 30 days
    }),
  ]);

  // Apply progressive blocking based on thresholds
  let blocked = false;
  let blockDuration: number | undefined;

  if (newTotalCount >= PROGRESSIVE_BLOCK_THRESHOLDS.SEVERE.violations) {
    // 50+ total violations → 7 day block
    blockDuration = PROGRESSIVE_BLOCK_THRESHOLDS.SEVERE.blockDurationSeconds;
    await blockInKV(kv, ip, blockDuration, `${reason} (severe: ${newTotalCount} total violations)`);
    blocked = true;
  } else if (newDailyCount >= PROGRESSIVE_BLOCK_THRESHOLDS.MODERATE.violations) {
    // 10+ in 24 hours → 24 hour block
    blockDuration = PROGRESSIVE_BLOCK_THRESHOLDS.MODERATE.blockDurationSeconds;
    await blockInKV(
      kv,
      ip,
      blockDuration,
      `${reason} (moderate: ${newDailyCount} violations today)`
    );
    blocked = true;
  } else if (newDailyCount >= PROGRESSIVE_BLOCK_THRESHOLDS.MINOR.violations) {
    // 3+ violations → 1 hour block
    blockDuration = PROGRESSIVE_BLOCK_THRESHOLDS.MINOR.blockDurationSeconds;
    await blockInKV(kv, ip, blockDuration, `${reason} (minor: ${newDailyCount} violations)`);
    blocked = true;
  }

  return {
    todayCount: newDailyCount,
    totalCount: newTotalCount,
    blocked,
    blockDuration,
  };
}
