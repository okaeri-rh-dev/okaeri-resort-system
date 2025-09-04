/**
 * Simple Rate Limiter for Login Attempts
 * Phase 1.4 implementation - basic, in-memory rate limiting
 * 5 attempts per 15 minutes per IP/email combination
 */

interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  lastAttempt: number;
  blockedUntil?: number;
}

interface RateLimitResult {
  allowed: boolean;
  attemptsRemaining: number;
  resetTime?: number;
  blockedUntil?: number;
}

/**
 * Simple in-memory rate limiter for Phase 1.4
 * Production would use Redis or similar distributed cache
 */
export class SimpleRateLimiter {
  private static instance: SimpleRateLimiter;

  // In-memory storage - would be Redis in production
  private attempts: Map<string, RateLimitEntry> = new Map();

  // Rate limit configuration
  private readonly MAX_ATTEMPTS = 5;
  private readonly WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  private readonly BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

  private constructor() {
    // Clean up old entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  static getInstance(): SimpleRateLimiter {
    if (!SimpleRateLimiter.instance) {
      SimpleRateLimiter.instance = new SimpleRateLimiter();
    }
    return SimpleRateLimiter.instance;
  }

  /**
   * Check and record login attempt
   * @param identifier - IP address or email for rate limiting
   * @returns Rate limit result
   */
  checkLoginAttempt(identifier: string): RateLimitResult {
    const key = this.normalizeIdentifier(identifier);
    const now = Date.now();

    // Get existing entry or create new one
    let entry = this.attempts.get(key);

    if (!entry) {
      // First attempt
      entry = {
        attempts: 1,
        firstAttempt: now,
        lastAttempt: now,
      };
      this.attempts.set(key, entry);

      return {
        allowed: true,
        attemptsRemaining: this.MAX_ATTEMPTS - 1,
      };
    }

    // Check if currently blocked
    if (entry.blockedUntil && now < entry.blockedUntil) {
      return {
        allowed: false,
        attemptsRemaining: 0,
        blockedUntil: entry.blockedUntil,
      };
    }

    // Check if window has expired (reset attempts)
    if (now - entry.firstAttempt > this.WINDOW_MS) {
      entry = {
        attempts: 1,
        firstAttempt: now,
        lastAttempt: now,
      };
      this.attempts.set(key, entry);

      return {
        allowed: true,
        attemptsRemaining: this.MAX_ATTEMPTS - 1,
      };
    }

    // Increment attempts within window
    entry.attempts++;
    entry.lastAttempt = now;

    // Check if limit exceeded
    if (entry.attempts > this.MAX_ATTEMPTS) {
      entry.blockedUntil = now + this.BLOCK_DURATION_MS;
      this.attempts.set(key, entry);

      return {
        allowed: false,
        attemptsRemaining: 0,
        blockedUntil: entry.blockedUntil,
      };
    }

    this.attempts.set(key, entry);

    return {
      allowed: true,
      attemptsRemaining: this.MAX_ATTEMPTS - entry.attempts,
      resetTime: entry.firstAttempt + this.WINDOW_MS,
    };
  }

  /**
   * Record successful login (resets attempts)
   * @param identifier - IP address or email
   */
  recordSuccessfulLogin(identifier: string): void {
    const key = this.normalizeIdentifier(identifier);
    this.attempts.delete(key);
  }

  /**
   * Get current status for identifier
   * @param identifier - IP address or email
   */
  getStatus(identifier: string): RateLimitResult {
    const key = this.normalizeIdentifier(identifier);
    const entry = this.attempts.get(key);
    const now = Date.now();

    if (!entry) {
      return {
        allowed: true,
        attemptsRemaining: this.MAX_ATTEMPTS,
      };
    }

    // Check if currently blocked
    if (entry.blockedUntil && now < entry.blockedUntil) {
      return {
        allowed: false,
        attemptsRemaining: 0,
        blockedUntil: entry.blockedUntil,
      };
    }

    // Check if window has expired
    if (now - entry.firstAttempt > this.WINDOW_MS) {
      return {
        allowed: true,
        attemptsRemaining: this.MAX_ATTEMPTS,
      };
    }

    return {
      allowed: entry.attempts < this.MAX_ATTEMPTS,
      attemptsRemaining: Math.max(0, this.MAX_ATTEMPTS - entry.attempts),
      resetTime: entry.firstAttempt + this.WINDOW_MS,
    };
  }

  /**
   * Manually block an identifier (for admin use)
   * @param identifier - IP address or email
   * @param durationMs - Block duration in milliseconds
   */
  blockIdentifier(identifier: string, durationMs: number = this.BLOCK_DURATION_MS): void {
    const key = this.normalizeIdentifier(identifier);
    const now = Date.now();

    const entry: RateLimitEntry = {
      attempts: this.MAX_ATTEMPTS + 1,
      firstAttempt: now,
      lastAttempt: now,
      blockedUntil: now + durationMs,
    };

    this.attempts.set(key, entry);
  }

  /**
   * Unblock an identifier (for admin use)
   * @param identifier - IP address or email
   */
  unblockIdentifier(identifier: string): void {
    const key = this.normalizeIdentifier(identifier);
    this.attempts.delete(key);
  }

  /**
   * Get statistics for monitoring
   */
  getStats(): {
    totalTracked: number;
    currentlyBlocked: number;
    totalAttempts: number;
  } {
    const now = Date.now();
    let currentlyBlocked = 0;
    let totalAttempts = 0;

    for (const entry of this.attempts.values()) {
      totalAttempts += entry.attempts;

      if (entry.blockedUntil && now < entry.blockedUntil) {
        currentlyBlocked++;
      }
    }

    return {
      totalTracked: this.attempts.size,
      currentlyBlocked,
      totalAttempts,
    };
  }

  /**
   * Clear all rate limit data (for testing)
   */
  clear(): void {
    this.attempts.clear();
  }

  /**
   * Normalize identifier for consistent storage
   * @param identifier - Raw identifier (IP or email)
   */
  private normalizeIdentifier(identifier: string): string {
    // Convert to lowercase and trim for consistency
    return identifier.toLowerCase().trim();
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [key, entry] of this.attempts.entries()) {
      // Remove if window expired and not blocked
      if (
        now - entry.firstAttempt > this.WINDOW_MS &&
        (!entry.blockedUntil || now > entry.blockedUntil)
      ) {
        expired.push(key);
      }
    }

    expired.forEach((key) => this.attempts.delete(key));

    if (expired.length > 0) {
      console.debug(`[SimpleRateLimiter] Cleaned up ${expired.length} expired entries`);
    }
  }

  /**
   * Format time remaining for user display
   * @param timestamp - Future timestamp
   */
  formatTimeRemaining(timestamp: number): string {
    const now = Date.now();
    const remaining = Math.max(0, timestamp - now);

    if (remaining === 0) return "0 seconds";

    const minutes = Math.floor(remaining / (60 * 1000));
    const seconds = Math.floor((remaining % (60 * 1000)) / 1000);

    if (minutes > 0) {
      return `${minutes} minute${minutes === 1 ? "" : "s"} ${seconds} second${seconds === 1 ? "" : "s"}`;
    }

    return `${seconds} second${seconds === 1 ? "" : "s"}`;
  }
}

// Export singleton instance
export const simpleRateLimiter = SimpleRateLimiter.getInstance();

/**
 * Rate limiting middleware for API routes
 * Usage: await rateLimitMiddleware(request, 'login', identifier)
 */
export async function rateLimitMiddleware(
  request: Request,
  action: "login" | "register" | "password-reset",
  identifier: string
): Promise<{ allowed: boolean; message?: string; retryAfter?: number }> {
  // Only rate limit login attempts in Phase 1.4
  if (action !== "login") {
    return { allowed: true };
  }

  const result = simpleRateLimiter.checkLoginAttempt(identifier);

  if (!result.allowed) {
    const retryAfter = result.blockedUntil
      ? Math.ceil((result.blockedUntil - Date.now()) / 1000)
      : 900; // 15 minutes in seconds

    return {
      allowed: false,
      message: `Too many login attempts. Please try again in ${simpleRateLimiter.formatTimeRemaining(
        result.blockedUntil || Date.now() + 900000
      )}.`,
      retryAfter,
    };
  }

  return {
    allowed: true,
    message:
      result.attemptsRemaining > 0 ? `${result.attemptsRemaining} attempts remaining` : undefined,
  };
}

/**
 * Get client identifier for rate limiting
 * Uses IP address or email as fallback
 */
export function getClientIdentifier(request: Request, email?: string): string {
  // Try to get IP from headers (Vercel/Cloudflare)
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfIp = request.headers.get("cf-connecting-ip");

  const ip = cfIp || realIp || forwarded?.split(",")[0] || "unknown";

  // Use email as additional identifier if available
  return email ? `${ip}:${email}` : ip;
}
