/**
 * Rate Limiting Configuration and Re-exports
 *
 * Centralizes rate limit configuration for all API endpoints
 * Re-exports KV-based rate limiting utilities
 *
 * Source: docs/implementation/guest-booking-multi-unit/chunks/014-admin-api-endpoints/instructions.md
 */

// Re-export KV rate limiting functions
export { checkKVRateLimit, getClientIp, createClientFingerprint } from "./kv-rate-limit";

/**
 * Rate limit configurations by endpoint
 *
 * Format: {
 *   limit: number of requests allowed
 *   window: time window in seconds
 * }
 */
export const RATE_LIMIT_CONFIG = {
  // Guest booking endpoints (public)
  "guest-booking": { max: 5, window: 3600 }, // 5 requests per hour
  "preview-pricing": { max: 20, window: 3600 }, // 20 requests per hour
  "upload-url": { max: 5, window: 3600 }, // 5 uploads per hour
  "booking-status": { max: 10, window: 3600 }, // 10 status checks per hour

  // Admin endpoints (protected)
  "admin-pending-bookings": { max: 100, window: 3600 }, // 100 requests per hour
  "admin-available-units": { max: 100, window: 3600 }, // 100 requests per hour
  "admin-assign-units": { max: 100, window: 3600 }, // 100 requests per hour
  "admin-verify-payment": { max: 100, window: 3600 }, // 100 requests per hour
} as const;

/**
 * Get rate limit configuration for an endpoint
 *
 * @param endpoint - Endpoint identifier
 * @returns Rate limit configuration
 */
export function getRateLimitConfig(endpoint: keyof typeof RATE_LIMIT_CONFIG) {
  const config = RATE_LIMIT_CONFIG[endpoint];
  return {
    limit: config.max,
    windowSeconds: config.window,
  };
}
