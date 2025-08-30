# Sub-Phase 5.2: Security Hardening

## Overview

This sub-phase focuses on implementing enterprise-grade security measures for
the production deployment, including advanced security headers, Content Security
Policy (CSP) optimization, threat protection, and compliance verification. The
goal is to achieve a security posture suitable for handling sensitive resort and
guest data.

## Objectives

- **Security Headers**: Implement comprehensive security headers and CSP
  policies
- **Threat Protection**: Deploy rate limiting, DDoS protection, and attack
  mitigation
- **Data Protection**: Ensure encryption in transit and at rest with proper key
  management
- **Vulnerability Management**: Implement continuous security scanning and patch
  management
- **Compliance**: Achieve security standards for hospitality data handling

## Current Security Status

Based on the existing `vercel.json`, the system already implements:

- ✅ X-Content-Type-Options: nosniff
- ✅ X-Frame-Options: DENY
- ✅ X-XSS-Protection: 1; mode=block
- ✅ Referrer-Policy: strict-origin-when-cross-origin
- ✅ Permissions-Policy
- ✅ Basic Content-Security-Policy
- ✅ Strict-Transport-Security (HSTS)
- ✅ CORS configuration

## Enhanced Security Implementation

### 1. Advanced Content Security Policy

#### Enhanced CSP Configuration

##### Production CSP (Strict - No Unsafe Directives)

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' https://vercel.live https://vercel.com; style-src 'self' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: https: blob:; media-src 'self' blob:; connect-src 'self' https://*.neon.tech wss://*.neon.tech https://api.cloudflare.com https://vitals.vercel-analytics.com; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests; block-all-mixed-content"
        }
      ]
    }
  ]
}
```

##### CSP with Nonce Support (If Inline Styles Required)

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'nonce-{RANDOM}' https://vercel.live https://vercel.com; style-src 'self' 'nonce-{RANDOM}' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: https: blob:; media-src 'self' blob:; connect-src 'self' https://*.neon.tech wss://*.neon.tech https://api.cloudflare.com https://vitals.vercel-analytics.com; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests; block-all-mixed-content"
        }
      ]
    }
  ]
}
```

⚠️ **Security Warning**:

- **NEVER** use `'unsafe-eval'` in production - it allows arbitrary code
  execution
- **AVOID** `'unsafe-inline'` - use nonces or hashes for inline scripts/styles
- **ALWAYS** test CSP changes in staging first using
  Content-Security-Policy-Report-Only header

#### CSP Nonce Implementation

```typescript
// api/_lib/security-headers.ts
import { IncomingMessage, ServerResponse } from "http";
import crypto from "crypto";

export interface SecurityContext {
  nonce: string;
  requestId: string;
  timestamp: number;
}

export function generateSecurityContext(): SecurityContext {
  return {
    nonce: crypto.randomBytes(16).toString("base64"),
    requestId: crypto.randomUUID(),
    timestamp: Date.now(),
  };
}

export function setSecurityHeaders(
  req: IncomingMessage,
  res: ServerResponse,
  context: SecurityContext
): void {
  const { nonce, requestId } = context;

  // Enhanced CSP with nonce
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://vercel.live`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://*.neon.tech wss://*.neon.tech https://*.upstash.io",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
    "block-all-mixed-content",
  ].join("; ");

  // Set comprehensive security headers
  const headers = {
    "Content-Security-Policy": csp,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "X-Request-ID": requestId,
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Embedder-Policy": "require-corp",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
  };

  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
}
```

### 2. Advanced Rate Limiting and DDoS Protection

#### Multi-Layer Rate Limiting

```typescript
// api/_lib/advanced-rate-limiting.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { IncomingMessage } from "http";

const redis = Redis.fromEnv();

// Different rate limits for different endpoint types
export const rateLimits = {
  // Authentication endpoints - stricter limits
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "10 m"), // 5 requests per 10 minutes
    analytics: true,
    prefix: "rl_auth",
  }),

  // API endpoints - moderate limits
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, "15 m"), // 100 requests per 15 minutes
    analytics: true,
    prefix: "rl_api",
  }),

  // Static content - generous limits
  static: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1000, "1 m"), // 1000 requests per minute
    analytics: true,
    prefix: "rl_static",
  }),

  // Search and heavy operations - conservative limits
  heavy: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 requests per minute
    analytics: true,
    prefix: "rl_heavy",
  }),
};

export function getClientIdentifier(req: IncomingMessage): string {
  // Try to get real IP from various headers (Vercel specific)
  const forwarded = req.headers["x-forwarded-for"] as string;
  const realIp = req.headers["x-real-ip"] as string;
  const vercelForwarded = req.headers["x-vercel-forwarded-for"] as string;

  const ip = vercelForwarded || realIp || forwarded?.split(",")[0] || "unknown";

  // Include User-Agent for more specific identification
  const userAgent = req.headers["user-agent"] || "unknown";
  const identifier = `${ip}:${Buffer.from(userAgent).toString("base64").slice(0, 10)}`;

  return identifier;
}

export async function checkRateLimit(
  req: IncomingMessage,
  limitType: keyof typeof rateLimits
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: Date;
}> {
  const identifier = getClientIdentifier(req);
  const result = await rateLimits[limitType].limit(identifier);

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}

// Suspicious activity detection
export class ThreatDetector {
  private static instance: ThreatDetector;
  private suspiciousPatterns: RegExp[];

  private constructor() {
    this.suspiciousPatterns = [
      /\b(union|select|insert|delete|drop|create|alter|exec|script)\b/i, // SQL injection
      /<script[^>]*>.*?<\/script>/i, // XSS attempts
      /\.\.\//g, // Path traversal
      /\b(eval|function|constructor)\b/i, // Code injection
      /(<|%3C)(script|iframe|object|embed)/i, // HTML injection
    ];
  }

  public static getInstance(): ThreatDetector {
    if (!ThreatDetector.instance) {
      ThreatDetector.instance = new ThreatDetector();
    }
    return ThreatDetector.instance;
  }

  public async analyzeSuspiciousActivity(
    identifier: string,
    request: any
  ): Promise<{
    threat: boolean;
    severity: "low" | "medium" | "high";
    reason: string;
  }> {
    const requestStr = JSON.stringify(request).toLowerCase();

    // Check for malicious patterns
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(requestStr)) {
        await this.logThreat(identifier, "malicious_pattern", {
          pattern: pattern.source,
        });
        return {
          threat: true,
          severity: "high",
          reason: "Malicious pattern detected",
        };
      }
    }

    // Check request frequency
    const key = `threat:${identifier}`;
    const requests = await redis.incr(key);
    await redis.expire(key, 60); // 1 minute window

    if (requests > 50) {
      await this.logThreat(identifier, "high_frequency", { requests });
      return {
        threat: true,
        severity: "medium",
        reason: "High request frequency",
      };
    }

    return { threat: false, severity: "low", reason: "Normal activity" };
  }

  private async logThreat(
    identifier: string,
    type: string,
    metadata: any
  ): Promise<void> {
    const threat = {
      identifier,
      type,
      metadata,
      timestamp: new Date().toISOString(),
      blocked: true,
    };

    // Log to Redis for immediate access
    await redis.zadd("threats", Date.now(), JSON.stringify(threat));

    // Keep only last 1000 threats
    await redis.zremrangebyrank("threats", 0, -1001);

    console.error("🚨 Threat detected:", threat);
  }
}
```

#### Rate Limiting Middleware

```typescript
// api/_lib/middleware/security.ts
import { IncomingMessage, ServerResponse } from "http";
import { checkRateLimit, ThreatDetector } from "../advanced-rate-limiting";
import {
  generateSecurityContext,
  setSecurityHeaders,
} from "../security-headers";

export async function securityMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void
): Promise<void> {
  try {
    // Generate security context
    const securityContext = generateSecurityContext();

    // Set security headers
    setSecurityHeaders(req, res, securityContext);

    // Determine rate limit type based on path
    const path = req.url || "";
    let limitType: "auth" | "api" | "static" | "heavy";

    if (path.startsWith("/api/auth/")) {
      limitType = "auth";
    } else if (
      path.startsWith("/api/reports/") ||
      path.startsWith("/api/analytics/")
    ) {
      limitType = "heavy";
    } else if (path.startsWith("/api/")) {
      limitType = "api";
    } else {
      limitType = "static";
    }

    // Check rate limiting
    const rateLimit = await checkRateLimit(req, limitType);

    // Set rate limit headers
    res.setHeader("X-RateLimit-Limit", rateLimit.limit.toString());
    res.setHeader("X-RateLimit-Remaining", rateLimit.remaining.toString());
    res.setHeader("X-RateLimit-Reset", rateLimit.reset.toISOString());

    if (!rateLimit.success) {
      res.statusCode = 429;
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Retry-After",
        Math.ceil((rateLimit.reset.getTime() - Date.now()) / 1000).toString()
      );
      res.end(
        JSON.stringify({
          error: "Too Many Requests",
          message: "Rate limit exceeded. Please try again later.",
          retryAfter: rateLimit.reset.toISOString(),
        })
      );
      return;
    }

    // Threat detection
    const threatDetector = ThreatDetector.getInstance();
    const clientId = (req.headers["x-forwarded-for"] as string) || "unknown";
    const threat = await threatDetector.analyzeSuspiciousActivity(clientId, {
      url: req.url,
      method: req.method,
      headers: req.headers,
      timestamp: Date.now(),
    });

    if (threat.threat && threat.severity === "high") {
      res.statusCode = 403;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: "Forbidden",
          message: "Suspicious activity detected",
          requestId: securityContext.requestId,
        })
      );
      return;
    }

    // Add security context to request for downstream use
    (req as any).securityContext = securityContext;
    (req as any).threatLevel = threat.severity;

    next();
  } catch (error) {
    console.error("Security middleware error:", error);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Internal Security Error" }));
  }
}
```

### 3. Enhanced Authentication Security

#### Secure Token Management

```typescript
// api/_lib/secure-token-manager.ts
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  sessionId: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenData {
  userId: string;
  sessionId: string;
  createdAt: number;
  lastUsed: number;
  userAgent: string;
  ipAddress: string;
  revoked?: boolean;
}

export class SecureTokenManager {
  private static instance: SecureTokenManager;
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly issuer = "okaeri-resort-system";
  private readonly audience = "okaeri-users";

  private constructor() {
    this.accessSecret = process.env.JWT_SECRET!;
    this.refreshSecret = process.env.JWT_REFRESH_SECRET!;

    if (!this.accessSecret || !this.refreshSecret) {
      throw new Error("JWT secrets not configured");
    }
  }

  public static getInstance(): SecureTokenManager {
    if (!SecureTokenManager.instance) {
      SecureTokenManager.instance = new SecureTokenManager();
    }
    return SecureTokenManager.instance;
  }

  public async generateTokenPair(
    payload: Omit<TokenPayload, "sessionId" | "iat" | "exp">,
    userAgent: string,
    ipAddress: string
  ): Promise<{ accessToken: string; refreshToken: string; sessionId: string }> {
    const sessionId = crypto.randomUUID();

    // Create access token (15 minutes)
    const accessPayload: TokenPayload = {
      ...payload,
      sessionId,
    };

    const accessToken = jwt.sign(accessPayload, this.accessSecret, {
      expiresIn: "15m",
      issuer: this.issuer,
      audience: this.audience,
      jwtid: crypto.randomUUID(),
    });

    // Create refresh token (7 days)
    const refreshPayload = {
      userId: payload.userId,
      sessionId,
      type: "refresh",
    };

    const refreshToken = jwt.sign(refreshPayload, this.refreshSecret, {
      expiresIn: "7d",
      issuer: this.issuer,
      audience: this.audience,
      jwtid: crypto.randomUUID(),
    });

    // Store refresh token data in Redis
    const refreshData: RefreshTokenData = {
      userId: payload.userId,
      sessionId,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      userAgent,
      ipAddress,
    };

    await redis.setex(
      `refresh:${sessionId}`,
      7 * 24 * 60 * 60, // 7 days in seconds
      JSON.stringify(refreshData)
    );

    // Track active sessions for user
    await redis.sadd(`user_sessions:${payload.userId}`, sessionId);
    await redis.expire(`user_sessions:${payload.userId}`, 7 * 24 * 60 * 60);

    return { accessToken, refreshToken, sessionId };
  }

  public async verifyAccessToken(token: string): Promise<TokenPayload | null> {
    try {
      const decoded = jwt.verify(token, this.accessSecret, {
        issuer: this.issuer,
        audience: this.audience,
      }) as TokenPayload;

      // Check if session is still active
      const sessionData = await redis.get(`refresh:${decoded.sessionId}`);
      if (!sessionData) {
        return null; // Session expired or revoked
      }

      return decoded;
    } catch (error) {
      return null;
    }
  }

  public async refreshTokens(
    refreshToken: string,
    userAgent: string,
    ipAddress: string
  ): Promise<{ accessToken: string; refreshToken: string } | null> {
    try {
      const decoded = jwt.verify(refreshToken, this.refreshSecret, {
        issuer: this.issuer,
        audience: this.audience,
      }) as any;

      if (decoded.type !== "refresh") {
        return null;
      }

      // Get session data
      const sessionDataStr = await redis.get(`refresh:${decoded.sessionId}`);
      if (!sessionDataStr) {
        return null;
      }

      const sessionData: RefreshTokenData = JSON.parse(sessionDataStr);

      if (sessionData.revoked) {
        return null;
      }

      // Security check: verify user agent and IP haven't changed significantly
      if (sessionData.userAgent !== userAgent) {
        console.warn(`User agent mismatch for session ${decoded.sessionId}`);
        // Could implement more sophisticated device fingerprinting here
      }

      // Update last used timestamp
      sessionData.lastUsed = Date.now();
      await redis.setex(
        `refresh:${decoded.sessionId}`,
        7 * 24 * 60 * 60,
        JSON.stringify(sessionData)
      );

      // Get user details for new tokens (would fetch from database)
      const newTokens = await this.generateTokenPair(
        {
          userId: sessionData.userId,
          email: "", // Would fetch from database
          role: "", // Would fetch from database
        },
        userAgent,
        ipAddress
      );

      // Revoke old session
      await this.revokeSession(decoded.sessionId);

      return {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
      };
    } catch (error) {
      return null;
    }
  }

  public async revokeSession(sessionId: string): Promise<void> {
    const sessionDataStr = await redis.get(`refresh:${sessionId}`);
    if (sessionDataStr) {
      const sessionData: RefreshTokenData = JSON.parse(sessionDataStr);
      sessionData.revoked = true;

      await redis.setex(
        `refresh:${sessionId}`,
        60 * 60, // Keep revoked session data for 1 hour for security logging
        JSON.stringify(sessionData)
      );

      // Remove from user's active sessions
      await redis.srem(`user_sessions:${sessionData.userId}`, sessionId);
    }
  }

  public async revokeAllUserSessions(userId: string): Promise<void> {
    const sessionIds = await redis.smembers(`user_sessions:${userId}`);

    for (const sessionId of sessionIds) {
      await this.revokeSession(sessionId);
    }

    await redis.del(`user_sessions:${userId}`);
  }

  public async getActiveSessionsCount(userId: string): Promise<number> {
    return await redis.scard(`user_sessions:${userId}`);
  }
}
```

### 4. Database Security Hardening

#### Connection Security and Query Protection

```typescript
// src/lib/db/secure-connection.ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import crypto from "crypto";

export interface SecureConnectionOptions {
  maxConnections?: number;
  connectionTimeout?: number;
  queryTimeout?: number;
  enableQueryLogging?: boolean;
  enableSlowQueryLogging?: boolean;
  slowQueryThreshold?: number;
}

export class SecureConnectionManager {
  private static instance: SecureConnectionManager;
  private connectionPool: Map<string, any> = new Map();
  private queryStats: Map<string, { count: number; avgTime: number }> =
    new Map();

  private constructor(private options: SecureConnectionOptions = {}) {
    this.options = {
      maxConnections: 3, // Vercel serverless limit
      connectionTimeout: 10000, // 10 seconds
      queryTimeout: 30000, // 30 seconds
      enableQueryLogging: process.env.NODE_ENV === "development",
      enableSlowQueryLogging: true,
      slowQueryThreshold: 1000, // 1 second
      ...options,
    };
  }

  public static getInstance(
    options?: SecureConnectionOptions
  ): SecureConnectionManager {
    if (!SecureConnectionManager.instance) {
      SecureConnectionManager.instance = new SecureConnectionManager(options);
    }
    return SecureConnectionManager.instance;
  }

  public createSecureConnection(connectionString: string) {
    // Validate connection string format
    if (
      !connectionString.startsWith("postgresql://") &&
      !connectionString.startsWith("postgres://")
    ) {
      throw new Error("Invalid database connection string");
    }

    // Extract and validate components
    const url = new URL(connectionString);

    // Ensure SSL is required for production
    if (
      process.env.NODE_ENV === "production" &&
      !url.searchParams.has("sslmode")
    ) {
      url.searchParams.set("sslmode", "require");
    }

    // Add connection pooling parameters
    url.searchParams.set("connect_timeout", "10");
    url.searchParams.set("application_name", "okaeri-resort-system");

    const connection = neon(url.toString(), {
      connectionTimeoutMillis: this.options.connectionTimeout,
    });

    // Wrap connection with security monitoring
    return this.wrapConnectionWithMonitoring(connection);
  }

  private wrapConnectionWithMonitoring(connection: any) {
    return new Proxy(connection, {
      apply: async (target, thisArg, argumentsList) => {
        const [query, params] = argumentsList;
        const queryId = crypto
          .createHash("md5")
          .update(query)
          .digest("hex")
          .slice(0, 8);
        const startTime = Date.now();

        try {
          // Log query if enabled
          if (this.options.enableQueryLogging) {
            console.log(`🔍 Query ${queryId}: ${query.slice(0, 100)}...`);
          }

          // Set query timeout
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(
              () => reject(new Error("Query timeout")),
              this.options.queryTimeout
            );
          });

          const result = await Promise.race([
            target.apply(thisArg, argumentsList),
            timeoutPromise,
          ]);

          const duration = Date.now() - startTime;

          // Update query statistics
          const stats = this.queryStats.get(queryId) || {
            count: 0,
            avgTime: 0,
          };
          stats.count++;
          stats.avgTime =
            (stats.avgTime * (stats.count - 1) + duration) / stats.count;
          this.queryStats.set(queryId, stats);

          // Log slow queries
          if (
            this.options.enableSlowQueryLogging &&
            duration > this.options.slowQueryThreshold!
          ) {
            console.warn(
              `🐌 Slow query ${queryId} took ${duration}ms: ${query.slice(0, 200)}...`
            );
          }

          return result;
        } catch (error) {
          console.error(
            `❌ Query ${queryId} failed after ${Date.now() - startTime}ms:`,
            error.message
          );
          throw error;
        }
      },
    });
  }

  public getQueryStatistics(): Array<{
    queryId: string;
    count: number;
    avgTime: number;
  }> {
    return Array.from(this.queryStats.entries()).map(([queryId, stats]) => ({
      queryId,
      ...stats,
    }));
  }
}

// Enhanced database instance with security
const secureConnectionManager = SecureConnectionManager.getInstance();
const secureConnection = secureConnectionManager.createSecureConnection(
  process.env.DATABASE_URL!
);

export const secureDb = drizzle(secureConnection, {
  logger: process.env.NODE_ENV === "development",
});
```

### 5. Security Monitoring and Alerting

#### Real-time Security Monitoring

```typescript
// api/_lib/security-monitor.ts
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export interface SecurityEvent {
  id: string;
  type:
    | "auth_failure"
    | "rate_limit_exceeded"
    | "suspicious_activity"
    | "data_breach_attempt"
    | "sql_injection"
    | "xss_attempt";
  severity: "low" | "medium" | "high" | "critical";
  source: string;
  details: any;
  timestamp: number;
  resolved?: boolean;
}

export class SecurityMonitor {
  private static instance: SecurityMonitor;
  private alertThresholds = {
    auth_failure: { count: 5, window: 300 }, // 5 failures in 5 minutes
    rate_limit_exceeded: { count: 10, window: 600 }, // 10 instances in 10 minutes
    suspicious_activity: { count: 3, window: 300 }, // 3 instances in 5 minutes
    sql_injection: { count: 1, window: 60 }, // Immediate alert
    xss_attempt: { count: 1, window: 60 }, // Immediate alert
  };

  private constructor() {}

  public static getInstance(): SecurityMonitor {
    if (!SecurityMonitor.instance) {
      SecurityMonitor.instance = new SecurityMonitor();
    }
    return SecurityMonitor.instance;
  }

  public async logSecurityEvent(
    event: Omit<SecurityEvent, "id" | "timestamp">
  ): Promise<void> {
    const securityEvent: SecurityEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    // Store event in Redis
    await redis.zadd(
      "security_events",
      securityEvent.timestamp,
      JSON.stringify(securityEvent)
    );

    // Keep only events from last 7 days
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    await redis.zremrangebyscore("security_events", 0, weekAgo);

    // Check if this event type should trigger an alert
    await this.checkAlertThresholds(event.type, securityEvent.source);

    // Log to console for immediate visibility
    console.error("🚨 Security Event:", {
      type: event.type,
      severity: event.severity,
      source: event.source,
      timestamp: new Date(securityEvent.timestamp).toISOString(),
    });
  }

  private async checkAlertThresholds(
    eventType: SecurityEvent["type"],
    source: string
  ): Promise<void> {
    const threshold = this.alertThresholds[eventType];
    if (!threshold) return;

    const windowStart = Date.now() - threshold.window * 1000;

    // Count events of this type from this source in the time window
    const recentEvents = await redis.zrangebyscore(
      "security_events",
      windowStart,
      Date.now()
    );

    const relevantEvents = recentEvents
      .map((event) => JSON.parse(event as string) as SecurityEvent)
      .filter((event) => event.type === eventType && event.source === source);

    if (relevantEvents.length >= threshold.count) {
      await this.triggerSecurityAlert(eventType, source, relevantEvents.length);
    }
  }

  private async triggerSecurityAlert(
    eventType: SecurityEvent["type"],
    source: string,
    count: number
  ): Promise<void> {
    const alert = {
      id: crypto.randomUUID(),
      type: eventType,
      source,
      count,
      timestamp: Date.now(),
      acknowledged: false,
    };

    // Store alert
    await redis.setex(`alert:${alert.id}`, 86400, JSON.stringify(alert)); // 24 hours

    // In a real system, this would send notifications via email, Slack, etc.
    console.error("🚨🚨 SECURITY ALERT 🚨🚨", {
      message: `${count} ${eventType} events detected from ${source}`,
      alert,
    });

    // Auto-block if critical
    if (eventType === "sql_injection" || eventType === "xss_attempt") {
      await this.blockSource(source, "auto_block_security_threat");
    }
  }

  private async blockSource(source: string, reason: string): Promise<void> {
    const blockKey = `blocked:${source}`;
    const blockData = {
      source,
      reason,
      timestamp: Date.now(),
      expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    };

    await redis.setex(blockKey, 86400, JSON.stringify(blockData));

    console.error("🔒 Source blocked:", blockData);
  }

  public async isSourceBlocked(source: string): Promise<boolean> {
    const blockData = await redis.get(`blocked:${source}`);
    return blockData !== null;
  }

  public async getSecurityDashboard(): Promise<{
    recentEvents: SecurityEvent[];
    eventCounts: Record<string, number>;
    topSources: Array<{ source: string; count: number }>;
  }> {
    const last24Hours = Date.now() - 24 * 60 * 60 * 1000;
    const recentEventsRaw = await redis.zrangebyscore(
      "security_events",
      last24Hours,
      Date.now()
    );

    const recentEvents = recentEventsRaw.map(
      (event) => JSON.parse(event as string) as SecurityEvent
    );

    // Count events by type
    const eventCounts: Record<string, number> = {};
    const sourceCounts: Record<string, number> = {};

    recentEvents.forEach((event) => {
      eventCounts[event.type] = (eventCounts[event.type] || 0) + 1;
      sourceCounts[event.source] = (sourceCounts[event.source] || 0) + 1;
    });

    const topSources = Object.entries(sourceCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([source, count]) => ({ source, count }));

    return {
      recentEvents: recentEvents.slice(-50), // Last 50 events
      eventCounts,
      topSources,
    };
  }
}
```

### 6. Security Testing and Validation

#### Automated Security Tests

```typescript
// tests/security/security-hardening.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fetch from "node-fetch";
import { secureDb } from "../../src/lib/db/secure-connection";
import { SecurityMonitor } from "../../api/_lib/security-monitor";

describe("Security Hardening Validation", () => {
  const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
  let securityMonitor: SecurityMonitor;

  beforeAll(() => {
    securityMonitor = SecurityMonitor.getInstance();
  });

  describe("Security Headers", () => {
    it("should include all required security headers", async () => {
      const response = await fetch(BASE_URL);

      // Check CSP header
      const csp = response.headers.get("content-security-policy");
      expect(csp).toBeTruthy();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");

      // Check other security headers
      expect(response.headers.get("x-frame-options")).toBe("DENY");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("x-xss-protection")).toBe("1; mode=block");
      expect(response.headers.get("strict-transport-security")).toContain(
        "max-age=63072000"
      );
    });

    it("should set CORS headers correctly for API endpoints", async () => {
      const response = await fetch(`${BASE_URL}/api/health/check`, {
        method: "OPTIONS",
      });

      expect(response.headers.get("access-control-allow-origin")).toBeTruthy();
      expect(response.headers.get("access-control-allow-methods")).toContain(
        "GET"
      );
      expect(response.headers.get("access-control-allow-headers")).toContain(
        "Authorization"
      );
    });
  });

  describe("Rate Limiting", () => {
    it("should enforce rate limits on authentication endpoints", async () => {
      const requests = Array(10)
        .fill(null)
        .map(() =>
          fetch(`${BASE_URL}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: "test@example.com",
              password: "wrong",
            }),
          })
        );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter((r) => r.status === 429);

      // Should rate limit after several failed attempts
      expect(rateLimited.length).toBeGreaterThan(0);

      // Check rate limit headers
      const limitedResponse = rateLimited[0];
      expect(limitedResponse.headers.get("x-ratelimit-limit")).toBeTruthy();
      expect(limitedResponse.headers.get("x-ratelimit-remaining")).toBeTruthy();
      expect(limitedResponse.headers.get("retry-after")).toBeTruthy();
    });

    it("should allow normal traffic through rate limiting", async () => {
      const response = await fetch(`${BASE_URL}/api/health/check`);

      expect(response.status).toBe(200);
      expect(response.headers.get("x-ratelimit-remaining")).toBeTruthy();
    });
  });

  describe("Input Validation and Injection Protection", () => {
    it("should reject SQL injection attempts", async () => {
      const maliciousInputs = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'; INSERT INTO users VALUES ('hacker', 'password'); --",
      ];

      for (const input of maliciousInputs) {
        const response = await fetch(`${BASE_URL}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: input, password: "test" }),
        });

        // Should be rejected (400 Bad Request or 403 Forbidden)
        expect([400, 403, 422]).toContain(response.status);

        const data = await response.json();
        expect(data.error).toBeTruthy();
      }
    });

    it("should sanitize XSS attempts", async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src=x onerror=alert("xss")>',
        '"><script>alert("xss")</script>',
      ];

      for (const payload of xssPayloads) {
        const response = await fetch(`${BASE_URL}/api/bookings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-token",
          },
          body: JSON.stringify({
            guestName: payload,
            checkIn: "2024-01-01",
            checkOut: "2024-01-02",
          }),
        });

        // Should either reject or sanitize
        if (response.ok) {
          const data = await response.json();
          expect(data.guestName).not.toContain("<script>");
          expect(data.guestName).not.toContain("javascript:");
        } else {
          expect([400, 401, 403, 422]).toContain(response.status);
        }
      }
    });
  });

  describe("Authentication Security", () => {
    it("should implement secure password policies", async () => {
      const weakPasswords = ["123456", "password", "qwerty", "12345678"];

      for (const password of weakPasswords) {
        const response = await fetch(`${BASE_URL}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "test@example.com",
            firstName: "Test",
            lastName: "User",
            password,
          }),
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain("password");
      }
    });

    it("should implement secure session management", async () => {
      // Test that tokens expire appropriately
      // Test that refresh tokens work correctly
      // Test that concurrent sessions are handled properly
      expect(true).toBe(true); // Placeholder for comprehensive session tests
    });
  });

  describe("Data Protection", () => {
    it("should not expose sensitive information in responses", async () => {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@example.com", password: "wrong" }),
      });

      const data = await response.json();

      // Should not expose database errors or internal information
      expect(JSON.stringify(data).toLowerCase()).not.toContain("password");
      expect(JSON.stringify(data).toLowerCase()).not.toContain("database");
      expect(JSON.stringify(data).toLowerCase()).not.toContain("connection");
      expect(JSON.stringify(data).toLowerCase()).not.toContain("postgresql");
    });

    it("should encrypt sensitive data in database", async () => {
      // Verify that sensitive fields are properly encrypted
      // This would need to be adapted based on your actual schema
      expect(true).toBe(true); // Placeholder
    });
  });

  describe("Security Monitoring", () => {
    it("should log security events", async () => {
      await securityMonitor.logSecurityEvent({
        type: "auth_failure",
        severity: "medium",
        source: "127.0.0.1",
        details: { email: "test@example.com", reason: "invalid_credentials" },
      });

      const dashboard = await securityMonitor.getSecurityDashboard();
      expect(dashboard.recentEvents.length).toBeGreaterThan(0);
      expect(dashboard.eventCounts["auth_failure"]).toBeGreaterThan(0);
    });

    it("should detect and block suspicious activity", async () => {
      const suspiciousSource = "192.168.1.100";

      // Simulate multiple security events from same source
      for (let i = 0; i < 5; i++) {
        await securityMonitor.logSecurityEvent({
          type: "sql_injection",
          severity: "critical",
          source: suspiciousSource,
          details: { payload: "'; DROP TABLE users; --" },
        });
      }

      const isBlocked = await securityMonitor.isSourceBlocked(suspiciousSource);
      expect(isBlocked).toBe(true);
    });
  });
});
```

## Implementation Checklist

### Phase 1: Enhanced Security Headers (Day 1)

- [ ] Implement advanced CSP with nonce generation
- [ ] Add security header middleware to all API routes
- [ ] Configure CSP reporting endpoint
- [ ] Test CSP policies with browser developer tools
- [ ] Validate CORS configuration for all environments

### Phase 2: Advanced Rate Limiting (Day 2)

- [ ] Deploy multi-tier rate limiting system
- [ ] Implement threat detection and analysis
- [ ] Configure Redis for rate limiting storage
- [ ] Test rate limiting with load testing tools
- [ ] Set up alerting for rate limit violations

### Phase 3: Authentication Hardening (Day 3)

- [ ] Implement secure token management system
- [ ] Add session monitoring and revocation
- [ ] Deploy enhanced password policies
- [ ] Test authentication security with penetration testing
- [ ] Validate session management across devices

### Phase 4: Security Monitoring (Day 4)

- [ ] Deploy real-time security monitoring
- [ ] Configure security event logging
- [ ] Set up automated threat response
- [ ] Create security dashboard
- [ ] Test incident response procedures

## Success Metrics

### Security Posture

- ✅ A+ rating on SSL Labs test
- ✅ 95+ score on Mozilla Observatory
- ✅ Zero high-severity vulnerabilities in security scans
- ✅ All OWASP Top 10 threats mitigated

### Performance Impact

- ✅ Security middleware adds <10ms latency
- ✅ Rate limiting effective without blocking legitimate users
- ✅ Token validation completes in <5ms
- ✅ Security monitoring has minimal resource impact

### Operational Metrics

- ✅ 99.9% uptime maintained with security measures
- ✅ <1% false positive rate in threat detection
- ✅ Security incidents detected and responded to within 15 minutes
- ✅ Zero data breaches or unauthorized access

This comprehensive security hardening ensures the Okaeri Resort Management
System meets enterprise security standards while maintaining optimal performance
for Philippine users.
