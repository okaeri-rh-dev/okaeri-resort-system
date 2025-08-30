# Security Implementation Guide - Okaeri Resort System

## Priority Implementation Roadmap

### 🔴 CRITICAL - Implement Within 24 Hours

#### 1. Replace Token Manager

```bash
# Replace the existing token manager with secure implementation
mv src/lib/security/token-manager.ts src/lib/security/token-manager.old.ts
mv src/lib/security/secure-token-manager.ts src/lib/security/token-manager.ts
```

Update imports in:

- `/src/stores/authStore.ts`
- `/src/routes/_protected.tsx`
- `/src/lib/security/index.ts`

#### 2. Implement CSRF Protection in API Client

```typescript
// src/lib/api-client.ts - Add CSRF protection
import { csrfProtection } from "@/lib/security/csrf-protection";

class ApiClient {
  private async request<T>(
    method: string,
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    // ... existing code ...

    // Add CSRF protection for state-changing requests
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      const csrfToken = await csrfProtection.getCSRFToken();
      if (csrfToken) {
        requestHeaders["X-CSRF-Token"] = csrfToken;
      }
    }

    // ... rest of implementation
  }
}
```

#### 3. Add Proper Encryption for Audit Logs

```bash
# Install encryption library
npm install crypto-js @types/crypto-js
```

```typescript
// src/lib/security/audit-logger.ts - Replace btoa/atob
import CryptoJS from 'crypto-js';

private encrypt(data: string): string {
  const key = import.meta.env.VITE_AUDIT_ENCRYPTION_KEY;
  if (!key) {
    console.error('Encryption key not configured');
    return data; // Fallback - should throw in production
  }
  return CryptoJS.AES.encrypt(data, key).toString();
}

private decrypt(data: string): string {
  const key = import.meta.env.VITE_AUDIT_ENCRYPTION_KEY;
  if (!key) {
    console.error('Encryption key not configured');
    return data;
  }
  const bytes = CryptoJS.AES.decrypt(data, key);
  return bytes.toString(CryptoJS.enc.Utf8);
}
```

### 🟠 HIGH PRIORITY - Implement Within 1 Week

#### 1. Server-Side Security Headers

Create `/api/middleware/security.ts`:

```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node";

export function securityHeaders(req: VercelRequest, res: VercelResponse) {
  // Security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()"
  );

  // CSP Header
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' data:; " +
      "connect-src 'self' https://api.okaeri.ph; " +
      "frame-ancestors 'none';"
  );
}
```

#### 2. Input Validation with Zod

```typescript
// src/lib/validation/route-params.ts
import { z } from "zod";

// UUID validation for all ID parameters
export const UUIDSchema = z.string().uuid();

// Sanitized string schema
export const SanitizedStringSchema = z
  .string()
  .transform((val) => val.trim())
  .refine((val) => !/<[^>]*>/g.test(val), {
    message: "HTML tags are not allowed",
  });

// Common route parameter schemas
export const RouteParamSchemas = {
  bookingId: UUIDSchema,
  propertyId: UUIDSchema,
  expenseId: UUIDSchema,
  projectId: UUIDSchema,
  userId: UUIDSchema,

  // Search parameters
  search: SanitizedStringSchema.optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
};

// Validate all route parameters
export function validateRouteParams<T>(
  schema: z.ZodSchema<T>,
  params: unknown
): T {
  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Route parameter validation failed:", error.errors);
      throw new Error("Invalid route parameters");
    }
    throw error;
  }
}
```

#### 3. Rate Limiting Implementation

```typescript
// src/lib/security/server-rate-limiter.ts
import { Redis } from "@upstash/redis";

export class ServerRateLimiter {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }

  async checkRateLimit(
    identifier: string,
    limit: number = 100,
    window: number = 60000
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const key = `rate_limit:${identifier}`;
    const now = Date.now();
    const windowStart = now - window;

    // Remove old entries
    await this.redis.zremrangebyscore(key, 0, windowStart);

    // Count requests in current window
    const count = await this.redis.zcard(key);

    if (count < limit) {
      // Add current request
      await this.redis.zadd(key, { score: now, member: `${now}` });
      await this.redis.expire(key, Math.ceil(window / 1000));

      return {
        allowed: true,
        remaining: limit - count - 1,
        resetAt: now + window,
      };
    }

    // Get oldest request time
    const oldestRequest = await this.redis.zrange(key, 0, 0, {
      withScores: true,
    });

    const resetAt = oldestRequest[0]?.score
      ? (oldestRequest[0].score as number) + window
      : now + window;

    return {
      allowed: false,
      remaining: 0,
      resetAt,
    };
  }
}
```

### 🟡 MEDIUM PRIORITY - Implement Within 1 Month

#### 1. Philippine Data Privacy Act Compliance

```typescript
// src/components/privacy/ConsentManager.tsx
import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';

export function ConsentManager() {
  const [consents, setConsents] = useState({
    dataProcessing: false,
    marketing: false,
    thirdPartySharing: false,
    crossBorderTransfer: false,
  });

  const handleConsentChange = async (type: string, granted: boolean) => {
    try {
      await api.post('/api/consent', {
        type,
        granted,
        timestamp: new Date().toISOString(),
        ipAddress: await getClientIP(),
      });

      setConsents(prev => ({
        ...prev,
        [type]: granted,
      }));

      // Log consent event for DPA compliance
      auditLogger.logConsent(
        granted ? 'given' : 'withdrawn',
        type,
        user
      );
    } catch (error) {
      console.error('Failed to update consent:', error);
    }
  };

  return (
    <div className="consent-manager">
      <h3>Privacy Preferences</h3>
      <p>
        In compliance with the Data Privacy Act of 2012 (Republic Act 10173),
        we need your consent for the following:
      </p>

      {Object.entries(consents).map(([type, granted]) => (
        <ConsentItem
          key={type}
          type={type}
          granted={granted}
          onChange={handleConsentChange}
        />
      ))}
    </div>
  );
}
```

#### 2. Security Monitoring Dashboard

```typescript
// src/pages/admin/SecurityDashboard.tsx
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export function SecurityDashboard() {
  const { data: metrics } = useQuery({
    queryKey: ['security', 'metrics'],
    queryFn: () => api.get('/api/security/metrics'),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: threats } = useQuery({
    queryKey: ['security', 'threats'],
    queryFn: () => api.get('/api/security/threats'),
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  return (
    <div className="security-dashboard">
      <h1>Security Monitoring</h1>

      <div className="metrics-grid">
        <MetricCard
          title="Failed Login Attempts"
          value={metrics?.failedLogins || 0}
          threshold={10}
        />
        <MetricCard
          title="Suspicious Activities"
          value={metrics?.suspiciousActivities || 0}
          threshold={5}
        />
        <MetricCard
          title="Rate Limit Violations"
          value={metrics?.rateLimitViolations || 0}
          threshold={20}
        />
        <MetricCard
          title="CSRF Attempts"
          value={metrics?.csrfAttempts || 0}
          threshold={1}
        />
      </div>

      <ThreatList threats={threats} />
      <AuditLogViewer />
    </div>
  );
}
```

## Environment Variables Setup

Add to `.env`:

```bash
# Security Configuration
VITE_AUDIT_ENCRYPTION_KEY=your-256-bit-key-here
VITE_SESSION_TIMEOUT=1800000
VITE_TOKEN_REFRESH_INTERVAL=840000
VITE_CSRF_TOKEN_LIFETIME=3600000
VITE_ENABLE_SECURITY_HEADERS=true
VITE_ENABLE_RATE_LIMITING=true
VITE_MAX_LOGIN_ATTEMPTS=5
VITE_RATE_LIMIT_WINDOW=60000
VITE_ENABLE_AUDIT_LOGGING=true

# Redis for Rate Limiting
UPSTASH_REDIS_REST_URL=your-redis-url
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# Session Configuration
SESSION_SECRET=your-session-secret
SESSION_NAME=okaeri_session
SESSION_MAX_AGE=604800000

# Philippine Compliance
ENABLE_DPA_COMPLIANCE=true
DATA_RETENTION_DAYS=1825
AUDIT_LOG_RETENTION_DAYS=2555
```

## Testing Security Implementations

### 1. Token Security Test

```typescript
// src/__tests__/security/token-security.test.ts
import { secureTokenManager } from "@/lib/security/secure-token-manager";

describe("Secure Token Manager", () => {
  it("should not expose tokens in window object", () => {
    const token = "test-token";
    secureTokenManager.storeTokens(token);

    expect(window.__OKAERI_ACCESS_TOKEN__).toBeUndefined();
    expect(secureTokenManager.getAccessToken()).toBe(token);
  });

  it("should detect token theft via fingerprint", () => {
    // Test fingerprint validation
  });

  it("should handle token rotation correctly", () => {
    // Test token rotation
  });
});
```

### 2. CSRF Protection Test

```typescript
// src/__tests__/security/csrf-protection.test.ts
import { csrfProtection } from "@/lib/security/csrf-protection";

describe("CSRF Protection", () => {
  it("should add CSRF token to state-changing requests", async () => {
    const token = await csrfProtection.getCSRFToken();
    expect(token).toBeDefined();
  });

  it("should validate CSRF tokens in responses", () => {
    // Test CSRF validation
  });
});
```

### 3. Security Audit Checklist

- [ ] All tokens stored securely in memory
- [ ] CSRF protection on all state-changing endpoints
- [ ] Proper encryption for sensitive data
- [ ] Input validation on all route parameters
- [ ] Rate limiting implemented server-side
- [ ] Security headers configured
- [ ] Audit logging for all security events
- [ ] Session timeout enforced
- [ ] DPA compliance features implemented
- [ ] Security monitoring dashboard operational

## Deployment Security Checklist

### Pre-Production

- [ ] Run security scan with OWASP ZAP
- [ ] Perform penetration testing
- [ ] Review all dependencies for vulnerabilities
- [ ] Verify all environment variables are secure
- [ ] Test rate limiting under load
- [ ] Verify CSRF protection works
- [ ] Check audit logging is functional
- [ ] Test session timeout behavior
- [ ] Verify encryption is working

### Production

- [ ] Enable all security headers
- [ ] Configure WAF (Web Application Firewall)
- [ ] Set up security monitoring alerts
- [ ] Enable intrusion detection
- [ ] Configure backup encryption
- [ ] Set up security incident response plan
- [ ] Schedule regular security audits
- [ ] Enable continuous vulnerability scanning

## Security Contacts

**Security Issues:** security@okaeri.ph  
**Data Privacy Officer:** dpo@okaeri.ph  
**Incident Response:** incident-response@okaeri.ph

## Compliance Documentation

- [Philippine Data Privacy Act Compliance Checklist](./docs/compliance/dpa-checklist.md)
- [Security Incident Response Plan](./docs/security/incident-response.md)
- [Data Breach Notification Procedure](./docs/security/breach-notification.md)
- [Security Training Materials](./docs/security/training.md)

---

**Last Updated:** 2025-08-26  
**Review Schedule:** Monthly  
**Classification:** CONFIDENTIAL - Development Team Only
