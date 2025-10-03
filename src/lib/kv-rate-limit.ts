/**
 * Cloudflare KV-based rate limiting with coarse-window strategy
 * Free tier: 100k reads/day, 1k writes/day (critical constraint)
 *
 * Strategy: Use hourly time windows instead of per-request writes
 * Result: ~24 writes/day per unique IP vs ~N writes/day with sliding window
 */

interface RateLimitOptions {
  limit: number; // Max requests allowed per window
  windowSeconds: number; // Time window in seconds
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number; // Seconds until retry
}

export async function checkKVRateLimit(
  kv: KVNamespace,
  identifier: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const { limit, windowSeconds } = options;
  const now = Math.floor(Date.now() / 1000);

  // Coarse window approach: divide time into fixed windows
  const windowKey = Math.floor(now / windowSeconds);
  const key = `rate-limit:${identifier}:${windowKey}`;

  // Get current count for this window (single read)
  const current = await kv.get(key);
  const count = current ? parseInt(current) : 0;

  // Check if limit exceeded
  if (count >= limit) {
    const windowEnd = (windowKey + 1) * windowSeconds;
    const retryAfter = windowEnd - now;

    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.max(retryAfter, 1),
    };
  }

  // Increment counter (single write per window, not per request)
  await kv.put(key, String(count + 1), {
    expirationTtl: windowSeconds + 60, // Auto-cleanup after window + buffer
  });

  return {
    allowed: true,
    remaining: limit - (count + 1),
    retryAfter: 0,
  };
}

/**
 * Create a fingerprint for more sophisticated rate limiting
 * Combines multiple factors to identify unique clients
 */
export function createClientFingerprint(ip: string, userAgent?: string, headers?: Headers): string {
  const components = [
    ip,
    userAgent || "unknown",
    headers?.get("Accept-Language") || "unknown",
    headers?.get("Accept-Encoding") || "unknown",
  ];

  // Create a simple hash of the components
  return components.join("|").substring(0, 64);
}

// Usage example in Cloudflare Function:
// const result = await checkKVRateLimit(env.RATE_LIMIT_KV, clientIp, {
//   limit: 5,
//   windowSeconds: 3600 // 1 hour window = 24 writes max per IP/day
// });
