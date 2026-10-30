# ⚡ Serverless Functions Architecture

## Overview

The `/functions` directory contains Cloudflare Workers and serverless API endpoints that power the backend functionality of the Okaeri Resort System. This architecture provides scalable, cost-effective serverless execution with global edge deployment.

## 🏗️ Directory Structure

```
functions/
├── _middleware.ts              # Global middleware (security, CORS, rate limiting)
├── api/                        # API endpoints
│   ├── audit/                 # Audit logging endpoints
│   │   └── log-with-ip.ts    # IP-aware audit logging
│   ├── guest-booking/        # Public booking endpoints
│   │   └── (handlers)        # Unauthenticated booking creation
│   ├── monitoring/           # Health and quota monitoring
│   │   └── check-quotas.ts   # KV/Email/Bandwidth quota checks
│   ├── guest-booking.ts      # Main guest booking handler (10.4KB)
│   └── health.ts             # Health check endpoint (1KB)
└── cron/                      # Scheduled tasks
    └── (cron jobs)           # Automated cleanup, monitoring
```

## 📦 Core Modules

### Global Middleware (`_middleware.ts`)

Applies comprehensive security, CORS, and rate limiting to all API routes.

#### Security Headers (A+ Rating)

```typescript
// Comprehensive security headers
const securityHeaders = {
  'Content-Security-Policy': `
    default-src 'self';
    script-src 'self' 'unsafe-inline' challenges.cloudflare.com;
    style-src 'self' 'unsafe-inline';
    connect-src 'self' https://*.supabase.co wss://*.supabase.co;
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `,
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}
```

#### CORS Configuration

```typescript
// Environment-aware CORS
const corsHeaders = {
  'Access-Control-Allow-Origin':
    env.ENVIRONMENT === 'production'
      ? 'https://okaeri-resort.com'
      : '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
}
```

#### Rate Limiting

```typescript
// Request fingerprinting for rate limiting
const fingerprint = await generateFingerprint(request, {
  ip: request.headers.get('cf-connecting-ip'),
  userAgent: request.headers.get('user-agent'),
  path: new URL(request.url).pathname,
})

// Check rate limit (stored in KV)
const allowed = await checkRateLimit(fingerprint, {
  limit: 100, // requests
  window: 60 * 1000, // per minute
})
```

### Health Check (`api/health.ts`)

Simple health check endpoint for monitoring.

```typescript
// GET /api/health
export async function onRequestGet() {
  return new Response(JSON.stringify({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION,
  }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
```

### Guest Booking (`api/guest-booking.ts`)

Public booking endpoint with Turnstile verification (10.4KB).

#### Features

1. **Turnstile Verification**
   - Bot protection via Cloudflare Turnstile
   - Token validation on server-side
   - Rate limiting per IP

2. **Data Validation**
   - Input sanitization with DOMPurify
   - Zod schema validation
   - Philippine phone number validation

3. **Booking Creation**
   - Availability checking
   - Conflict detection
   - Audit trail logging
   - Email confirmation

#### Usage

```typescript
// POST /api/guest-booking
const response = await fetch('/api/guest-booking', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    turnstile_token: token,
    guest_name: 'John Doe',
    guest_email: 'john@example.com',
    guest_phone: '+639123456789',
    unit_id: 'unit-001',
    check_in_date: '2024-12-20',
    check_out_date: '2024-12-25',
    guest_count: 2,
    special_requests: 'Late check-in',
  }),
})

const booking = await response.json()
// Returns: { id, booking_code, status, ... }
```

#### Security Flow

```typescript
// 1. Verify Turnstile token
const turnstileValid = await verifyTurnstile(token, env.TURNSTILE_SECRET_KEY)
if (!turnstileValid) {
  return Response.json({ error: 'Invalid verification' }, { status: 400 })
}

// 2. Rate limit check
const fingerprint = generateFingerprint(request)
const allowed = await checkRateLimit(fingerprint)
if (!allowed) {
  return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })
}

// 3. Sanitize inputs
const sanitized = {
  ...data,
  special_requests: sanitizeHTML(data.special_requests),
  guest_name: sanitizeInput(data.guest_name),
}

// 4. Validate with Zod
const validated = guestBookingSchema.parse(sanitized)

// 5. Create booking with audit trail
const booking = await createBooking(validated)
await logAuditEvent({ action: 'guest_booking.created', ... })
```

## 🔐 Security Features

### 1. Comprehensive Security Headers

Achieves **A+ rating** on securityheaders.com:

- **CSP**: Strict Content Security Policy
- **HSTS**: HTTP Strict Transport Security
- **X-Frame-Options**: Clickjacking protection
- **X-Content-Type-Options**: MIME sniffing prevention
- **Permissions Policy**: Disable unnecessary browser features

### 2. DDoS & Bot Protection

```typescript
// Cloudflare native features
- Turnstile verification for forms
- Rate limiting via Workers KV
- IP-based request fingerprinting
- Challenge pages for suspicious traffic
```

### 3. Input Validation

All inputs are validated and sanitized:

```typescript
import { sanitizeHTML, sanitizeInput } from '@/lib/security/sanitize'
import { guestBookingSchema } from '@/lib/validation/guest-booking'

// Multi-layer validation
const safe = sanitizeInput(userInput)
const validated = schema.parse(safe)
```

## 📊 Monitoring Integration

Functions integrate with the monitoring system:

```typescript
import { KVQuotaMonitor } from '@/lib/monitoring/kv-quota-monitor'
import { BandwidthMonitor } from '@/lib/monitoring/bandwidth-monitor'

export async function onRequest(context) {
  const kvMonitor = new KVQuotaMonitor(context.env.KV)
  const bandwidthMonitor = new BandwidthMonitor()

  // Track KV operations
  await kvMonitor.trackOperation({
    type: 'write',
    key: 'rate-limit:' + fingerprint,
    timestamp: new Date(),
  })

  // Track bandwidth
  await bandwidthMonitor.trackRequest({
    path: context.request.url,
    requestSize: parseInt(context.request.headers.get('content-length') || '0'),
    responseSize: responseBody.length,
  })
}
```

## 🚀 Deployment

### Cloudflare Pages Deployment

```bash
# Deploy to Cloudflare Pages
npm run deploy

# Deploy preview
npm run deploy:preview

# Environment variables (set in Cloudflare dashboard)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx
TURNSTILE_SECRET_KEY=0x4xxx
ENVIRONMENT=production
```

### Wrangler Configuration

```toml
# wrangler.toml
name = "okaeri-resort-api"
compatibility_date = "2024-01-01"

[env.production]
vars = { ENVIRONMENT = "production" }
kv_namespaces = [
  { binding = "RATE_LIMIT_KV", id = "xxx" }
]
```

## 📁 API Endpoint Reference

### Public Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/health` | GET | Health check | No |
| `/api/guest-booking` | POST | Create guest booking | Turnstile |

### Protected Endpoints (Require Auth)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/audit/log-with-ip` | POST | Log audit event with IP |
| `/api/monitoring/check-quotas` | GET | Check all quota statuses |

### Cron Jobs

| Schedule | Function | Description |
|----------|----------|-------------|
| `0 0 * * *` | Cleanup old logs | Delete audit logs >90 days |
| `0 * * * *` | Check quotas | Monitor KV/Email/Bandwidth |
| `*/15 * * * *` | Health check | Ping health endpoint |

## 🎯 Best Practices

### 1. Error Handling

```typescript
export async function onRequest(context) {
  try {
    // Function logic
    return Response.json({ success: true })
  } catch (error) {
    // Log error to audit trail
    await logAuditEvent({
      action: 'api.error',
      severity: 'error',
      metadata: { error: error.message },
    })

    // Return user-friendly error
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### 2. Response Headers

Always include security headers and cache control:

```typescript
const headers = {
  ...getSecurityHeaders(env),
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'X-Request-ID': requestId,
}

return new Response(JSON.stringify(data), { headers })
```

### 3. Audit Logging

Log all significant actions:

```typescript
await logAuditEvent({
  action: 'booking.created',
  entity_type: 'booking',
  entity_id: booking.id,
  changes: { before: null, after: booking },
  user_id: null, // Guest booking
  metadata: {
    ip_address: request.headers.get('cf-connecting-ip'),
    user_agent: request.headers.get('user-agent'),
    turnstile_verified: true,
  },
})
```

## 🔧 Development

### Local Development

```bash
# Install Wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Start local dev server
wrangler pages dev

# Test function locally
curl http://localhost:8788/api/health
```

### Testing

```typescript
// Integration test
describe('Guest Booking API', () => {
  it('creates booking with valid data', async () => {
    const response = await fetch('/api/guest-booking', {
      method: 'POST',
      body: JSON.stringify(validBookingData),
    })

    expect(response.status).toBe(200)
    const booking = await response.json()
    expect(booking).toHaveProperty('id')
    expect(booking.status).toBe('pending')
  })

  it('rejects booking without Turnstile', async () => {
    const response = await fetch('/api/guest-booking', {
      method: 'POST',
      body: JSON.stringify({ ...validBookingData, turnstile_token: null }),
    })

    expect(response.status).toBe(400)
  })
})
```

## 📚 Related Documentation

- [API Endpoints](/functions/api/README.md) - Detailed API documentation
- [Audit API](/functions/api/audit/README.md) - Audit logging endpoints
- [Guest Booking API](/functions/api/guest-booking/README.md) - Public booking API
- [Monitoring API](/functions/api/monitoring/README.md) - Quota monitoring endpoints
- [Cron Jobs](/functions/cron/README.md) - Scheduled tasks
- [Security Guidelines](/src/lib/security/README.md) - Security best practices
- [Monitoring System](/src/lib/monitoring/README.md) - Quota and performance monitoring

## 🚨 Security Considerations

1. **Always verify Turnstile tokens** for public endpoints
2. **Implement rate limiting** on all endpoints
3. **Sanitize all user inputs** before processing
4. **Log security events** to audit trail
5. **Use HTTPS only** in production
6. **Validate Content-Type** headers
7. **Leave CORS to the global middleware** (no per-route CORS headers or OPTIONS handlers)
8. **Monitor for suspicious patterns**

## 📈 Performance Tips

- Use edge caching for static responses
- Minimize KV operations (quota limits)
- Batch database queries when possible
- Implement request coalescing for duplicate requests
- Use streaming responses for large payloads
- Monitor cold start times and optimize bundle size
