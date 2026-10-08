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

import { logSecurityEvent, shouldAutoBlock } from "./security-monitoring";

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

/**
 * Unblock an IP manually
 * @param kv - KV namespace
 * @param ip - IP address to unblock
 */
export async function unblockIP(kv: KVNamespace, ip: string): Promise<void> {
  const blockKey = `blocked:${ip}`;
  await kv.delete(blockKey);
}

/**
 * Automatic threat response based on audit logs
 * @param ip - IP address to evaluate
 * @param kv - KV namespace for blocking
 */
export async function autoBlockThreats(
  ip: string,
  kv: KVNamespace,
  userAgent: string = "unknown"
): Promise<{
  blocked: boolean;
  reason?: string;
  threatScore?: number;
}> {
  try {
    // Check if already blocked
    const blockStatus = await isIPBlocked(kv, ip);
    if (blockStatus.blocked) {
      return {
        blocked: true,
        reason: blockStatus.reason,
      };
    }

    // Check if should be blocked
    const { shouldBlock: shouldBlockIP, reason, threatScore } = await shouldAutoBlock(ip);

    if (shouldBlockIP && reason) {
      // Determine block duration based on threat score
      let blockDuration = 3600; // 1 hour default

      if (threatScore && threatScore >= 90) {
        blockDuration = 86400; // 24 hours for very high threats
      } else if (threatScore && threatScore >= 75) {
        blockDuration = 14400; // 4 hours for high threats
      } else if (threatScore && threatScore >= 50) {
        blockDuration = 7200; // 2 hours for moderate threats
      }

      // Block the IP
      await blockInKV(kv, ip, blockDuration, reason);

      // Log the automatic blocking
      await logSecurityEvent({
        type: "suspicious_pattern",
        ip,
        userAgent,
        metadata: {
          auto_blocked: true,
          threat_score: threatScore,
          block_duration: blockDuration,
          reason,
        },
      });

      return {
        blocked: true,
        reason,
        threatScore,
      };
    }

    return {
      blocked: false,
      threatScore,
    };
  } catch (error) {
    console.error("Auto-blocking error:", error);
    return { blocked: false };
  }
}

/**
 * Get list of currently blocked IPs
 * @param kv - KV namespace
 */
export async function getBlockedIPs(kv: KVNamespace): Promise<
  Array<{
    ip: string;
    reason: string;
    blockedAt: string;
    expiresAt: string;
  }>
> {
  try {
    // List all keys with blocked: prefix
    const list = await kv.list({ prefix: "blocked:" });
    const blockedIPs = [];

    for (const key of list.keys) {
      const data = await kv.get(key.name);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          blockedIPs.push({
            ip: parsed.ip,
            reason: parsed.reason,
            blockedAt: parsed.blockedAt,
            expiresAt: parsed.expiresAt,
          });
        } catch {
          // Skip invalid entries
        }
      }
    }

    return blockedIPs;
  } catch (error) {
    console.error("Failed to get blocked IPs:", error);
    return [];
  }
}

/**
 * Middleware to check if request should be blocked
 * Use this at the beginning of API endpoints
 */
export async function checkRequestBlocking(
  request: Request,
  kv: KVNamespace
): Promise<Response | null> {
  const ip = getClientIp(request);
  const userAgent = request.headers.get("User-Agent") || "unknown";

  // Check if IP is blocked
  const blockStatus = await isIPBlocked(kv, ip);
  if (blockStatus.blocked) {
    return new Response(
      JSON.stringify({
        error: "ACCESS_DENIED",
        message: "Your IP has been temporarily blocked due to suspicious activity",
        reason: blockStatus.reason,
        expiresAt: blockStatus.expiresAt,
      }),
      {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          "X-Blocked-IP": "true",
        },
      }
    );
  }

  // Check for auto-blocking based on patterns
  const autoBlockResult = await autoBlockThreats(ip, kv, userAgent);
  if (autoBlockResult.blocked) {
    return new Response(
      JSON.stringify({
        error: "ACCESS_DENIED",
        message: "Access denied due to security threat detection",
        threatScore: autoBlockResult.threatScore,
      }),
      {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          "X-Auto-Blocked": "true",
        },
      }
    );
  }

  // Request is allowed
  return null;
}

/**
 * Get client IP from request headers
 */
function getClientIp(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0] ||
    "unknown"
  );
}

/**
 * Clean up expired blocks (for maintenance)
 * This can be run periodically to clean KV storage
 */
export async function cleanupExpiredBlocks(kv: KVNamespace): Promise<number> {
  try {
    const list = await kv.list({ prefix: "blocked:" });
    let cleaned = 0;

    for (const key of list.keys) {
      const data = await kv.get(key.name);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          const expiresAt = new Date(parsed.expiresAt);

          // If expired, delete the entry
          if (expiresAt < new Date()) {
            await kv.delete(key.name);
            cleaned++;
          }
        } catch {
          // Delete invalid entries
          await kv.delete(key.name);
          cleaned++;
        }
      }
    }

    return cleaned;
  } catch (error) {
    console.error("Failed to cleanup expired blocks:", error);
    return 0;
  }
}

// ============================================
// PROGRESSIVE BLOCKING BASED ON VIOLATIONS
// ============================================

/**
 * Get the current violation count for an IP
 *
 * @param kv - KV namespace for rate limiting data
 * @param ip - Client IP address
 * @returns Current violation count (today + total)
 */
export async function getViolationCount(
  kv: KVNamespace,
  ip: string
): Promise<{ today: number; total: number }> {
  const today = toUTCDateString(new Date());
  const dailyKey = `violations:${ip}:${today}`;
  const totalKey = `violations:total:${ip}`;

  const [dailyData, totalData] = await Promise.all([kv.get(dailyKey), kv.get(totalKey)]);

  return {
    today: parseInt(dailyData || "0"),
    total: parseInt(totalData || "0"),
  };
}

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

/**
 * Get comprehensive stats for an IP (for admin dashboards)
 *
 * @param kv - KV namespace for rate limiting data
 * @param ip - Client IP address
 * @returns Block status and violation counts
 */
export async function getIPStats(
  kv: KVNamespace,
  ip: string
): Promise<{
  blocked: boolean;
  reason?: string;
  expiresAt?: string;
  violations: { today: number; total: number };
}> {
  const [blockStatus, violations] = await Promise.all([
    isIPBlocked(kv, ip),
    getViolationCount(kv, ip),
  ]);

  return {
    blocked: blockStatus.blocked,
    reason: blockStatus.reason,
    expiresAt: blockStatus.expiresAt,
    violations,
  };
}
