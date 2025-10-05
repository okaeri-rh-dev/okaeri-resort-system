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

/**
 * Advanced fingerprinting with SHA-256 hash
 * Creates a more unique identifier using multiple browser characteristics
 */
export async function createAdvancedFingerprint(request: Request): Promise<string> {
  const headers = request.headers;

  // Extract client IP from Cloudflare headers
  const ip =
    headers.get("CF-Connecting-IP") || headers.get("X-Forwarded-For")?.split(",")[0] || "unknown";

  // Collect fingerprinting factors
  const factors = [
    ip,
    headers.get("User-Agent") || "",
    headers.get("Accept-Language") || "",
    headers.get("Accept-Encoding") || "",
    headers.get("Accept") || "",
    headers.get("Sec-CH-UA") || "", // Client hints
    headers.get("Sec-CH-UA-Platform") || "",
    headers.get("Sec-CH-UA-Mobile") || "",
    headers.get("DNT") || "",
    headers.get("Connection") || "",
    // Add CF-specific headers for better accuracy
    headers.get("CF-IPCountry") || "",
    headers.get("CF-Ray") || "",
  ].filter(Boolean); // Remove empty values

  // Create SHA-256 hash for consistent length and uniqueness
  const encoder = new TextEncoder();
  const data = encoder.encode(factors.join("|"));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  // Return first 16 characters for efficiency
  return hashHex.substring(0, 16);
}

/**
 * Get client IP from Cloudflare headers
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0] ||
    "unknown"
  );
}

// Usage example in Cloudflare Function:
// const result = await checkKVRateLimit(env.RATE_LIMIT_KV, clientIp, {
//   limit: 5,
//   windowSeconds: 3600 // 1 hour window = 24 writes max per IP/day
// });
