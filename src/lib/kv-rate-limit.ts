/**
 * Cloudflare KV-based rate limiting with coarse-window strategy
 * Free tier: 100k reads/day, 1k writes/day (critical constraint)
 *
 * Strategy: fixed time windows, one KV write per allowed request (up to `limit` per window).
 * KV errors fail open, so the limiter never turns a full quota into an outage.
 *
 * Security Enhancement: When rate limit is exceeded, violations are tracked
 * and progressive blocking is applied:
 * - 3 violations → 1 hour block
 * - 10 violations → 24 hour block
 * - 50+ violations → 7 day block
 */

import { incrementViolation } from "./auto-blocking";

interface RateLimitOptions {
  limit: number; // Max requests allowed per window
  windowSeconds: number; // Time window in seconds
  environment?: string; // Optional: "development" | "production"
  skipInDev?: boolean; // Optional: Skip rate limiting in development (default: true)
  trackViolations?: boolean; // Optional: Track violations for progressive blocking (default: true)
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number; // Seconds until retry
  violationTracked?: boolean; // If violation was tracked for progressive blocking
}

export async function checkKVRateLimit(
  kv: KVNamespace,
  identifier: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const { limit, windowSeconds, environment, skipInDev = true, trackViolations = true } = options;

  // Development mode bypass: Skip rate limiting if environment is "development"
  const isDevelopment = environment === "development";
  if (isDevelopment && skipInDev) {
    return {
      allowed: true,
      remaining: 999, // Indicate unlimited in dev
      retryAfter: 0,
    };
  }

  const now = Math.floor(Date.now() / 1000);

  // Coarse window approach: divide time into fixed windows
  const windowKey = Math.floor(now / windowSeconds);
  const key = `rate-limit:${identifier}:${windowKey}`;

  let count: number;
  try {
    const current = await kv.get(key);
    count = current ? parseInt(current) : 0;
  } catch (error) {
    console.error("Rate limit KV read failed, allowing request:", error);
    return { allowed: true, remaining: limit, retryAfter: 0 };
  }

  // Check if limit exceeded
  if (count >= limit) {
    const windowEnd = (windowKey + 1) * windowSeconds;
    const retryAfter = windowEnd - now;

    // Track violation for progressive blocking (non-blocking)
    let violationTracked = false;
    if (trackViolations) {
      try {
        await incrementViolation(kv, identifier, "Rate limit exceeded");
        violationTracked = true;
      } catch (error) {
        // Don't fail the rate limit check if violation tracking fails
        console.error("Failed to track violation:", error);
      }
    }

    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.max(retryAfter, 1),
      violationTracked,
    };
  }

  // shortcut: once the daily KV write quota is gone, nothing is limited until 00:00 UTC; add a WAF rule if abused
  try {
    await kv.put(key, String(count + 1), {
      expirationTtl: windowSeconds + 60, // Auto-cleanup after window + buffer
    });
  } catch (error) {
    console.error("Rate limit KV write failed, allowing request:", error);
  }

  return {
    allowed: true,
    remaining: limit - (count + 1),
    retryAfter: 0,
  };
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

  // Only headers that stay the same across one client's requests (no CF-Ray or Connection)
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
    headers.get("CF-IPCountry") || "",
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
//   windowSeconds: 3600, // 1 hour window = 24 writes max per IP/day
//   environment: env.ENVIRONMENT, // "development" or "production"
//   skipInDev: true // Optional: Skip rate limiting in development (default: true)
// });
//
// Development bypass:
// - Automatically bypasses rate limiting when environment === "development"
// - Returns { allowed: true, remaining: 999, retryAfter: 0 }
// - Set skipInDev: false to test rate limiting in development
