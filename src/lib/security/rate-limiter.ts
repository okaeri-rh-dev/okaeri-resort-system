/**
 * Client-side rate limiting to prevent abuse and coordinate with server limits
 * Implements exponential backoff and circuit breaker patterns
 */

import { RATE_LIMITS, SECURITY_ERROR_CODES } from "./constants";
import { auditLogger } from "./audit-logger";

export interface RateLimitConfig {
  max: number;
  window: number;
  identifier?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
  locked: boolean;
  lockedUntil?: number;
}

export class RateLimiter {
  private static instance: RateLimiter;
  private limits: Map<string, RateLimitEntry> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  private constructor() {
    // Clean up old entries periodically
    setInterval(() => this.cleanup(), 60000); // Every minute
  }

  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  /**
   * Check if action is allowed under rate limit
   */
  check(key: string, config: RateLimitConfig): RateLimitResult {
    const identifier = config.identifier || key;
    const entry = this.getOrCreateEntry(identifier);
    const now = Date.now();

    // Check if locked out
    if (entry.locked && entry.lockedUntil && now < entry.lockedUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.lockedUntil,
        retryAfter: Math.ceil((entry.lockedUntil - now) / 1000),
      };
    }

    // Reset window if expired
    if (now - entry.windowStart > config.window) {
      entry.count = 0;
      entry.windowStart = now;
      entry.locked = false;
      entry.lockedUntil = undefined;
    }

    // Check rate limit
    if (entry.count >= config.max) {
      // Apply lockout
      if (key === "login" && RATE_LIMITS.LOGIN_ATTEMPTS.LOCKOUT) {
        entry.locked = true;
        entry.lockedUntil = now + RATE_LIMITS.LOGIN_ATTEMPTS.LOCKOUT;

        // Log security event
        auditLogger.logSecurityEvent("rate_limit", {
          key,
          identifier,
          lockoutDuration: RATE_LIMITS.LOGIN_ATTEMPTS.LOCKOUT,
        });
      }

      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.windowStart + config.window,
        retryAfter: Math.ceil((entry.windowStart + config.window - now) / 1000),
      };
    }

    // Increment counter
    entry.count++;

    return {
      allowed: true,
      remaining: config.max - entry.count,
      resetAt: entry.windowStart + config.window,
    };
  }

  /**
   * Track failed attempt (for exponential backoff)
   */
  trackFailure(key: string): void {
    const breaker = this.getOrCreateCircuitBreaker(key);
    breaker.recordFailure();
  }

  /**
   * Track successful attempt (reset backoff)
   */
  trackSuccess(key: string): void {
    const breaker = this.getOrCreateCircuitBreaker(key);
    breaker.recordSuccess();
  }

  /**
   * Check if circuit breaker is open
   */
  isCircuitOpen(key: string): boolean {
    const breaker = this.circuitBreakers.get(key);
    return breaker ? breaker.isOpen() : false;
  }

  /**
   * Get retry delay with exponential backoff
   */
  getRetryDelay(key: string): number {
    const breaker = this.getOrCreateCircuitBreaker(key);
    return breaker.getRetryDelay();
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.limits.delete(key);
    this.circuitBreakers.delete(key);
  }

  /**
   * Get or create rate limit entry
   */
  private getOrCreateEntry(key: string): RateLimitEntry {
    if (!this.limits.has(key)) {
      this.limits.set(key, {
        count: 0,
        windowStart: Date.now(),
        locked: false,
      });
    }
    return this.limits.get(key)!;
  }

  /**
   * Get or create circuit breaker
   */
  private getOrCreateCircuitBreaker(key: string): CircuitBreaker {
    if (!this.circuitBreakers.has(key)) {
      this.circuitBreakers.set(key, new CircuitBreaker());
    }
    return this.circuitBreakers.get(key)!;
  }

  /**
   * Clean up old entries
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    // Clean rate limits
    for (const [key, entry] of this.limits.entries()) {
      if (now - entry.windowStart > maxAge) {
        this.limits.delete(key);
      }
    }

    // Clean circuit breakers
    for (const [key, breaker] of this.circuitBreakers.entries()) {
      if (breaker.canCleanup()) {
        this.circuitBreakers.delete(key);
      }
    }
  }
}

/**
 * Circuit breaker implementation
 */
class CircuitBreaker {
  private failures: number = 0;
  private lastFailure: number = 0;
  private state: "closed" | "open" | "half-open" = "closed";
  private readonly threshold: number = 5;
  private readonly timeout: number = 30000; // 30 seconds
  private readonly baseDelay: number = 1000; // 1 second
  private readonly maxDelay: number = 60000; // 60 seconds

  /**
   * Record a failure
   */
  recordFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();

    if (this.failures >= this.threshold) {
      this.state = "open";
    }
  }

  /**
   * Record a success
   */
  recordSuccess(): void {
    this.failures = 0;
    this.state = "closed";
  }

  /**
   * Check if circuit is open
   */
  isOpen(): boolean {
    if (this.state === "closed") return false;

    // Check if timeout has passed
    if (Date.now() - this.lastFailure > this.timeout) {
      this.state = "half-open";
      return false;
    }

    return this.state === "open";
  }

  /**
   * Get retry delay with exponential backoff
   */
  getRetryDelay(): number {
    if (this.failures === 0) return 0;

    const delay = Math.min(this.baseDelay * Math.pow(2, this.failures - 1), this.maxDelay);

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * delay;

    return Math.floor(delay + jitter);
  }

  /**
   * Check if can be cleaned up
   */
  canCleanup(): boolean {
    return (
      this.failures === 0 && this.state === "closed" && Date.now() - this.lastFailure > 3600000 // 1 hour
    );
  }
}

// Export singleton instance
export const rateLimiter = RateLimiter.getInstance();
