# 🔌 API Endpoints Documentation

## Overview

The API endpoints provide **serverless backend functionality** for the Okaeri Resort System using Cloudflare Workers. This architecture delivers globally distributed, low-latency API responses with comprehensive security, rate limiting, and monitoring capabilities optimized for small business operations within free tier constraints.

All endpoints implement **defense-in-depth security** with Turnstile verification, rate limiting, input sanitization, idempotency, and comprehensive audit logging.

## 🏗️ API Architecture

```
api/
├── guest-booking.ts              # Main guest booking endpoint (POST)
├── guest-booking/
│   ├── confirm.ts               # Confirm upload completion (POST)
│   └── status.ts                # Check booking status (GET)
├── audit/
│   └── log-with-ip.ts          # IP-aware audit logging (POST)
├── monitoring/
│   └── check-quotas.ts         # Quota monitoring (GET)
└── health.ts                    # Health check endpoint (GET)
```

## 📋 Endpoint Reference

### Public Endpoints (No Auth Required)

| Endpoint | Method | Description | Rate Limit |
|----------|--------|-------------|------------|
| `/api/health` | GET | Health check | None |
| `/api/guest-booking` | POST | Create guest booking | 5/hour per IP |
| `/api/guest-booking/confirm` | POST | Confirm file upload | 5/hour per IP |
| `/api/guest-booking/status` | GET | Check booking status | 10/hour per IP |

### Protected Endpoints (Auth Required)

| Endpoint | Method | Description | Rate Limit |
|----------|--------|-------------|------------|
| `/api/audit/log-with-ip` | POST | Log audit event with IP | 100/hour |
| `/api/monitoring/check-quotas` | GET | Check all quota statuses | 60/hour |

## 🔐 Security Architecture

### Multi-Layer Security

```
Request Flow Security Layers:
1. Cloudflare Turnstile Verification
2. IP-based Rate Limiting (KV)
3. CORS Validation
4. Idempotency Protection
5. Input Validation (Zod)
6. Input Sanitization (DOMPurify)
7. Availability Checking
8. Database Transaction
9. Audit Trail Logging
```

### Rate Limiting

```typescript
// KV-based rate limiting
const rateLimitResult = await checkKVRateLimit(env.RATE_LIMIT_KV, clientIp, {
  limit: 5,                 // 5 requests
  windowSeconds: 3600,      // per hour
})

if (!rateLimitResult.allowed) {
  return Response.json({
    error: "Too many requests",
    retryAfter: rateLimitResult.retryAfter
  }, {
    status: 429,
    headers: { 'Retry-After': String(rateLimitResult.retryAfter) }
  })
}
```

### CORS Configuration

```typescript
// Environment-aware CORS
const allowedOrigins = [
  "https://okaeri-resort-system.pages.dev",
  /^https:\/\/[a-z0-9-]+\.okaeri-resort-system\.pages\.dev$/,  // Preview branches
]

const corsHeaders = {
  'Access-Control-Allow-Origin': isAllowed ? origin : defaultOrigin,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Idempotency-Key',
  'Access-Control-Max-Age': '86400',
}
```

### Idempotency Protection

```typescript
// Prevent duplicate bookings
const idempotencyKey = request.headers.get('X-Idempotency-Key')
  || await generateIdempotencyKey(request)

const idempotencyCheck = await checkIdempotency(
  env.RATE_LIMIT_KV,
  `idempotency:${idempotencyKey}`
)

if (idempotencyCheck.isProcessed) {
  // Return cached response
  return new Response(idempotencyCheck.response, { status: 200 })
}

// Process request and cache result
const result = await processRequest(data)
await setIdempotencyResult(env.RATE_LIMIT_KV, `idempotency:${idempotencyKey}`, result, 3600)
```

## 📝 Guest Booking Endpoint

**POST `/api/guest-booking`**

Create a new booking with Turnstile verification and file upload.

### Request

```typescript
// Headers
Content-Type: application/json
X-Idempotency-Key: optional-unique-key  // Prevents duplicate submissions

// Body
{
  turnstile_token: string,          // Required: Turnstile verification token
  guest_name: string,               // 2-100 chars, sanitized
  email: string,                    // Valid email, lowercased
  phone_number: string,             // International format
  unit_id: string,                  // UUID
  check_in: string,                 // ISO 8601 datetime
  check_out: string,                // ISO 8601 datetime
  num_guests: number,               // 1-20
  special_requests?: string,        // Max 500 chars, sanitized
  file_name: string,                // Receipt filename
  file_type: string,                // MIME type
  file_size: number                 // Max 2MB
}
```

### Response (Success)

```json
{
  "booking": {
    "booking_id": "uuid",
    "booking_reference": "BKG-2024-12-001",
    "guest_id": "uuid",
    "guest_name": "John Doe",
    "email": "john@example.com",
    "unit_id": "uuid",
    "check_in": "2024-12-20T14:00:00Z",
    "check_out": "2024-12-22T11:00:00Z",
    "num_guests": 2,
    "total_amount": 4500,
    "status": "pending",
    "created_at": "2024-12-06T10:30:00Z"
  },
  "upload": {
    "bucket": "payment-proofs",
    "path": "2024/12/booking-123-payment.jpg",
    "token": "signed-upload-token",
    "expiresAt": "2024-12-06T11:30:00Z"
  }
}
```

### Response (Error)

```json
{
  "error": "string",
  "message": "string",
  "code": "string",           // Optional error code
  "details": {}               // Optional error details
}
```

### Error Codes

| Status | Code | Message |
|--------|------|---------|
| 400 | INVALID_INPUT | Validation failed |
| 400 | UNIT_UNAVAILABLE | Unit not available for dates |
| 400 | INVALID_TURNSTILE | Turnstile verification failed |
| 429 | RATE_LIMIT_EXCEEDED | Too many requests |
| 409 | DUPLICATE_BOOKING | Idempotency key already processed |
| 500 | INTERNAL_ERROR | Server error |

### Implementation Flow

```typescript
1. Verify Turnstile token with Cloudflare
2. Check IP-based rate limit (5/hour)
3. Check idempotency key
4. Validate input with Zod schema
5. Sanitize text inputs with DOMPurify
6. Find or create guest record
7. Check unit availability
8. Calculate pricing (base + weekend + extra persons)
9. Create booking record
10. Generate signed upload URL
11. Send booking confirmation email
12. Log audit event
13. Cache result for idempotency
14. Return booking + upload details
```

## 🏥 Health Check Endpoint

**GET `/api/health`**

Simple health check for monitoring.

### Request

```bash
curl https://api.okaeri-resort.com/api/health
```

### Response

```json
{
  "status": "healthy",
  "timestamp": "2024-12-06T10:30:00Z",
  "version": "1.0.0",
  "environment": "production"
}
```

## 📊 Monitoring Endpoint

**GET `/api/monitoring/check-quotas`**

Check all quota statuses (KV, Email, Bandwidth).

### Request

```bash
curl -H "Authorization: Bearer <token>" \
  https://api.okaeri-resort.com/api/monitoring/check-quotas
```

### Response

```json
{
  "kv": {
    "writes": {
      "current": 450,
      "limit": 1000,
      "percentage": 45,
      "status": "ok"
    },
    "reads": {
      "current": 15000,
      "limit": 100000,
      "percentage": 15,
      "status": "ok"
    }
  },
  "email": {
    "daily": {
      "current": 35,
      "limit": 100,
      "percentage": 35,
      "status": "ok"
    },
    "monthly": {
      "current": 450,
      "limit": 3000,
      "percentage": 15,
      "status": "ok"
    }
  },
  "bandwidth": {
    "current": 3.5,
    "limit": 10,
    "unit": "GB",
    "percentage": 35,
    "status": "ok"
  },
  "timestamp": "2024-12-06T10:30:00Z"
}
```

### Status Values

| Status | Meaning | Threshold |
|--------|---------|-----------|
| ok | Normal | < 80% |
| warning | Approaching limit | 80-95% |
| critical | Near limit | 95-100% |
| exceeded | Over limit | > 100% |

## 🎯 Best Practices

### Client Implementation

```typescript
// 1. Always use Turnstile
const turnstileToken = await getTurnstileToken()

// 2. Include idempotency key
const idempotencyKey = `booking-${Date.now()}-${Math.random()}`

// 3. Handle rate limiting
const response = await fetch('/api/guest-booking', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Idempotency-Key': idempotencyKey,
  },
  body: JSON.stringify({
    turnstile_token: turnstileToken,
    // ... booking data
  })
})

if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After')
  console.log(`Rate limited. Retry after ${retryAfter} seconds`)
  return
}

// 4. Handle errors gracefully
if (!response.ok) {
  const error = await response.json()
  toast.error(error.message || 'An error occurred')
  return
}

const data = await response.json()
```

### Server Implementation

```typescript
// 1. Always validate input
const validated = guestBookingSchema.parse(requestBody)

// 2. Always sanitize text
const sanitized = {
  ...validated,
  guest_name: DOMPurify.sanitize(validated.guest_name),
  special_requests: validated.special_requests
    ? DOMPurify.sanitize(validated.special_requests)
    : undefined,
}

// 3. Always check availability
const isAvailable = await checkUnitAvailability(
  sanitized.unit_id,
  sanitized.check_in,
  sanitized.check_out
)

if (!isAvailable) {
  return Response.json({ error: 'Unit unavailable' }, { status: 400 })
}

// 4. Always log to audit trail
await logAuditEvent({
  action: 'guest_booking.created',
  entity_type: 'booking',
  entity_id: booking.booking_id,
  metadata: {
    ip_address: getClientIp(request),
    user_agent: request.headers.get('user-agent'),
  }
})

// 5. Always return consistent errors
return Response.json({
  error: 'UNIT_UNAVAILABLE',
  message: 'The selected unit is not available for the chosen dates',
  code: 'AVAILABILITY_CONFLICT'
}, { status: 400 })
```

## 🔄 Response Patterns

### Success Response Template

```json
{
  "data": {},           // Primary response data
  "meta": {             // Optional metadata
    "timestamp": "ISO8601",
    "requestId": "uuid"
  }
}
```

### Error Response Template

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable message",
  "details": {          // Optional validation errors
    "field": ["error1", "error2"]
  },
  "code": "HTTP_STATUS_CODE"
}
```

## 🧪 Testing

### cURL Examples

```bash
# Health check
curl https://api.okaeri-resort.com/api/health

# Create booking
curl -X POST https://api.okaeri-resort.com/api/guest-booking \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: unique-key-123" \
  -d '{
    "turnstile_token": "token",
    "guest_name": "John Doe",
    "email": "john@example.com",
    "phone_number": "+63 912 345 6789",
    "unit_id": "unit-uuid",
    "check_in": "2024-12-20T14:00:00Z",
    "check_out": "2024-12-22T11:00:00Z",
    "num_guests": 2,
    "file_name": "receipt.jpg",
    "file_type": "image/jpeg",
    "file_size": 1024000
  }'

# Check quotas (protected)
curl https://api.okaeri-resort.com/api/monitoring/check-quotas \
  -H "Authorization: Bearer <token>"
```

### Integration Tests

```typescript
describe('Guest Booking API', () => {
  it('creates booking with valid data', async () => {
    const response = await fetch('/api/guest-booking', {
      method: 'POST',
      body: JSON.stringify(validBookingData),
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.booking).toHaveProperty('booking_id')
    expect(data.upload).toHaveProperty('token')
  })

  it('rejects booking without Turnstile', async () => {
    const response = await fetch('/api/guest-booking', {
      method: 'POST',
      body: JSON.stringify({ ...validBookingData, turnstile_token: null }),
    })

    expect(response.status).toBe(400)
  })

  it('enforces rate limiting', async () => {
    // Make 6 requests (limit is 5/hour)
    for (let i = 0; i < 6; i++) {
      await fetch('/api/guest-booking', {
        method: 'POST',
        body: JSON.stringify(validBookingData),
      })
    }

    const response = await fetch('/api/guest-booking', {
      method: 'POST',
      body: JSON.stringify(validBookingData),
    })

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBeTruthy()
  })
})
```

## 📚 Related Documentation

- [Serverless Functions](/functions/README.md) - Cloudflare Workers architecture
- [Guest Booking API](/functions/api/guest-booking/README.md) - Detailed guest booking docs
- [Audit API](/functions/api/audit/README.md) - Audit logging endpoint
- [Monitoring API](/functions/api/monitoring/README.md) - Quota monitoring
- [Cron Jobs](/functions/cron/README.md) - Scheduled tasks
- [Security Guidelines](/docs/security/README.md) - Security best practices

## 🔧 Environment Variables

```bash
# Supabase
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
VITE_SUPABASE_URL=https://xxx.supabase.co

# Turnstile
TURNSTILE_SECRET_KEY=0x4xxx

# Email
RESEND_API_KEY=re_xxx

# Environment
ENVIRONMENT=production|development
APP_VERSION=1.0.0
```

## 🚨 Error Handling

### Standard Error Codes

```typescript
// 4xx Client Errors
400 - INVALID_INPUT           // Validation failed
400 - UNIT_UNAVAILABLE        // Booking conflict
400 - INVALID_TURNSTILE       // Failed verification
401 - UNAUTHORIZED            // Missing/invalid auth
403 - FORBIDDEN               // Insufficient permissions
404 - NOT_FOUND               // Resource not found
409 - CONFLICT                // Duplicate/conflict
422 - UNPROCESSABLE_ENTITY    // Semantic error
429 - RATE_LIMIT_EXCEEDED     // Too many requests

// 5xx Server Errors
500 - INTERNAL_ERROR          // Unexpected error
502 - BAD_GATEWAY             // Upstream error
503 - SERVICE_UNAVAILABLE     // Temporary unavailable
504 - GATEWAY_TIMEOUT         // Upstream timeout
```

### Error Response Examples

```json
// Validation error
{
  "error": "INVALID_INPUT",
  "message": "Validation failed",
  "details": {
    "guest_name": ["Must be at least 2 characters"],
    "email": ["Invalid email format"]
  }
}

// Rate limit error
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests. Please try again later.",
  "retryAfter": 3456
}

// Availability conflict
{
  "error": "UNIT_UNAVAILABLE",
  "message": "The selected unit is not available for the chosen dates",
  "code": "AVAILABILITY_CONFLICT",
  "details": {
    "unit_id": "uuid",
    "check_in": "2024-12-20",
    "check_out": "2024-12-22",
    "conflicting_bookings": ["BKG-2024-001"]
  }
}
```

## 📈 Performance Optimization

- **Edge deployment**: Global distribution via Cloudflare
- **KV caching**: Rate limiting and idempotency checks
- **Connection pooling**: Supabase connection management
- **Minimal dependencies**: Reduce cold start time
- **Streaming responses**: For large payloads
- **Compression**: gzip/brotli for API responses

## 🔒 Security Checklist

- [x] Turnstile verification on public endpoints
- [x] Rate limiting via KV namespace
- [x] CORS validation
- [x] Input validation with Zod
- [x] Input sanitization with DOMPurify
- [x] Idempotency protection
- [x] Audit trail logging
- [x] HTTPS only
- [x] SQL injection prevention (parameterized queries)
- [x] XSS prevention (sanitized inputs)
- [x] CSRF protection (SameSite cookies)
- [x] Content Security Policy headers
- [x] Rate limit headers (Retry-After)
- [x] Error message sanitization (no sensitive info)
