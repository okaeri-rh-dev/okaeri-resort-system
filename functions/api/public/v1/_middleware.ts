/**
 * Rate Limiting Middleware for Public Availability API
 *
 * Limits requests to 60 per minute per IP address.
 * CDN caching handles normal traffic, rate limiting prevents abuse.
 *
 * Uses Cloudflare KV with coarse-window strategy for free tier optimization.
 */

import { checkKVRateLimit } from "../../../../src/lib/kv-rate-limit";

interface Env {
  RATE_LIMIT_KV: KVNamespace;
}

const RATE_LIMIT = 60; // 60 requests per window (CDN caching handles normal traffic)
const WINDOW_SIZE = 60; // 60 seconds (1 minute window)

export async function onRequest(context: {
  request: Request;
  env: Env;
  next: () => Promise<Response>;
}) {
  const { request, env, next } = context;

  try {
    // Get client IP from Cloudflare headers
    const clientIP = request.headers.get("CF-Connecting-IP") ||
                     request.headers.get("X-Forwarded-For")?.split(",")[0] ||
                     "unknown";

    // Check if KV is available (may not be in local development)
    if (env.RATE_LIMIT_KV) {
      // Check rate limit using KV
      const rateLimit = await checkKVRateLimit(env.RATE_LIMIT_KV, clientIP, {
        limit: RATE_LIMIT,
        windowSeconds: WINDOW_SIZE,
      });

      // If rate limit exceeded, return 429
      if (!rateLimit.allowed) {
        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded. Please try again later.",
            retryAfter: rateLimit.retryAfter,
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": String(rateLimit.retryAfter),
              "X-RateLimit-Limit": String(RATE_LIMIT),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": String(Date.now() + rateLimit.retryAfter * 1000),
            },
          }
        );
      }

      // Add rate limit headers to response
      const response = await next();
      const newResponse = new Response(response.body, response);

      newResponse.headers.set("X-RateLimit-Limit", String(RATE_LIMIT));
      newResponse.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
      newResponse.headers.set("X-RateLimit-Reset", String(Date.now() + WINDOW_SIZE * 1000));

      return newResponse;
    } else {
      // KV not available (local development) - skip rate limiting
      console.warn("[Rate Limit] KV unavailable, skipping rate limiting (local development)");
      return next();
    }
  } catch (error) {
    console.error("[Rate Limit Middleware] Error:", error);

    // On error, allow request through (fail open) but log the issue
    console.warn("[Rate Limit Middleware] Allowing request due to error (fail open)");
    return next();
  }
}
