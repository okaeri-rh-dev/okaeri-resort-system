# API Endpoints - AI Assistant Guide

## Module Purpose

RESTful API endpoints for the Okaeri Resort System with multi-layer security (Turnstile, rate limiting, validation, sanitization), idempotency protection, and comprehensive audit logging. All endpoints are serverless Cloudflare Workers with global distribution.

## Quick Reference

### Public Endpoints (No Auth)

| Endpoint                     | Method | Purpose        | Rate Limit     |
| ---------------------------- | ------ | -------------- | -------------- |
| `/api/health`                | GET    | Health check   | None           |
| `/api/guest-booking`         | POST   | Create booking | 5/hour per IP  |
| `/api/guest-booking/confirm` | POST   | Confirm upload | 5/hour per IP  |
| `/api/guest-booking/status`  | GET    | Check status   | 10/hour per IP |

### Protected Endpoints (Auth Required)

| Endpoint                       | Method | Purpose         | Rate Limit |
| ------------------------------ | ------ | --------------- | ---------- |
| `/api/audit/log-with-ip`       | POST   | Log audit event | 100/hour   |
| `/api/monitoring/check-quotas` | GET    | Check quotas    | 60/hour    |

## Common Tasks

### 1. Create Guest Booking

```typescript
// POST /api/guest-booking
const response = await fetch("/api/guest-booking", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Idempotency-Key": `booking-${Date.now()}-${Math.random()}`,
  },
  body: JSON.stringify({
    turnstile_token: await getTurnstileToken(),
    guest_name: "John Doe",
    email: "john@example.com",
    phone_number: "+63 912 345 6789",
    unit_id: "uuid-here",
    check_in: "2024-12-20T14:00:00Z",
    check_out: "2024-12-22T11:00:00Z",
    num_guests: 2,
    special_requests: "Early check-in if possible",
    file_name: "receipt.jpg",
    file_type: "image/jpeg",
    file_size: 1024000,
  }),
});

if (response.status === 429) {
  const retryAfter = response.headers.get("Retry-After");
  console.log(`Rate limited. Retry after ${retryAfter} seconds`);
  return;
}

const { booking, upload } = await response.json();

// Upload file to signed URL
await fetch(upload.url, {
  method: "PUT",
  body: file,
  headers: { "Content-Type": file.type },
});

// Confirm upload
await fetch("/api/guest-booking/confirm", {
  method: "POST",
  body: JSON.stringify({
    booking_id: booking.booking_id,
    upload_path: upload.path,
  }),
});
```

### 2. Check Booking Status

```typescript
// GET /api/guest-booking/status?booking_id=xxx
const response = await fetch(
  `/api/guest-booking/status?booking_id=${bookingId}`
)

const { booking } = await response.json()

// Returns:
{
  booking_id: 'uuid',
  booking_reference: 'BKG-2024-001',
  status: 'pending' | 'confirmed' | 'cancelled',
  payment_status: 'pending' | 'partial' | 'paid',
  created_at: '2024-12-06T10:30:00Z',
  check_in: '2024-12-20T14:00:00Z',
  check_out: '2024-12-22T11:00:00Z',
}
```

### 3. Log Audit Event with IP

```typescript
// POST /api/audit/log-with-ip (Protected)
await fetch("/api/audit/log-with-ip", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    action: "guest_booking.created",
    entity_type: "booking",
    entity_id: booking.booking_id,
    user_id: null, // Public endpoint, no user
    changes: {
      before: null,
      after: booking,
    },
    metadata: {
      user_agent: navigator.userAgent,
    },
  }),
});

// IP address automatically captured from cf-connecting-ip header
```

### 4. Check System Quotas

```typescript
// GET /api/monitoring/check-quotas (Protected)
const response = await fetch("/api/monitoring/check-quotas", {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

const quotas = await response.json();

// Returns quota status for KV, email, bandwidth
if (quotas.kv.writes.percentage > 80) {
  console.warn("KV write quota approaching limit");
}
```

## Security Layers

### 1. Turnstile Verification

```typescript
// Every public endpoint requires Turnstile
const isValid = await verifyTurnstile(data.turnstile_token, env);

if (!isValid) {
  return Response.json(
    {
      error: "INVALID_TURNSTILE",
      message: "Turnstile verification failed",
    },
    { status: 400 }
  );
}
```

### 2. Rate Limiting

```typescript
const clientIp = request.headers.get("cf-connecting-ip") || "unknown";

const rateLimit = await checkKVRateLimit(env.RATE_LIMIT_KV, clientIp, {
  limit: 5,
  windowSeconds: 3600,
});

if (!rateLimit.allowed) {
  return Response.json(
    {
      error: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests",
      retryAfter: rateLimit.retryAfter,
    },
    {
      status: 429,
      headers: { "Retry-After": String(rateLimit.retryAfter) },
    }
  );
}
```

### 3. CORS Validation

```typescript
const allowedOrigins = [
  "https://okaeri-resort-system.pages.dev",
  /^https:\/\/[a-z0-9-]+\.okaeri-resort-system\.pages\.dev$/,
];

const origin = request.headers.get("origin");
const isAllowed = allowedOrigins.some((allowed) =>
  typeof allowed === "string" ? allowed === origin : allowed.test(origin)
);

const corsHeaders = {
  "Access-Control-Allow-Origin": isAllowed ? origin : allowedOrigins[0],
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Idempotency-Key",
};
```

### 4. Idempotency Protection

```typescript
const idempotencyKey =
  request.headers.get("X-Idempotency-Key") || (await generateIdempotencyKey(request));

const cached = await env.RATE_LIMIT_KV.get(`idempotency:${idempotencyKey}`);

if (cached) {
  // Already processed, return cached result
  return new Response(cached, { status: 200 });
}

// Process request...
const result = await processRequest(data);

// Cache result for 1 hour
await env.RATE_LIMIT_KV.put(`idempotency:${idempotencyKey}`, JSON.stringify(result), {
  expirationTtl: 3600,
});
```

### 5. Input Validation

```typescript
import { z } from "zod";
import DOMPurify from "dompurify";

const guestBookingSchema = z.object({
  guest_name: z
    .string()
    .min(2)
    .max(100)
    .transform((val) => DOMPurify.sanitize(val)),
  email: z.string().email().toLowerCase(),
  phone_number: z.string().regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?...$/),
  // ... more fields
});

try {
  const validated = guestBookingSchema.parse(await request.json());
} catch (error) {
  return Response.json(
    {
      error: "INVALID_INPUT",
      message: "Validation failed",
      details: error.errors,
    },
    { status: 400 }
  );
}
```

### 6. Availability Checking

```typescript
import { checkUnitAvailability } from "@/lib/availability";

const isAvailable = await checkUnitAvailability(
  data.unit_id,
  new Date(data.check_in),
  new Date(data.check_out)
);

if (!isAvailable) {
  return Response.json(
    {
      error: "UNIT_UNAVAILABLE",
      message: "Unit not available for selected dates",
    },
    { status: 400 }
  );
}
```

## Request/Response Patterns

### Success Response

```json
{
  "booking": {
    "booking_id": "uuid",
    "booking_reference": "BKG-2024-001",
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

### Error Response

```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests. Please try again later.",
  "code": 429,
  "retryAfter": 3456
}
```

### Validation Error Response

```json
{
  "error": "INVALID_INPUT",
  "message": "Validation failed",
  "details": {
    "guest_name": ["Must be at least 2 characters"],
    "email": ["Invalid email format"],
    "phone_number": ["Invalid phone number format"]
  }
}
```

## Common Gotchas

1. **Turnstile Required on All Public Endpoints**

   ```typescript
   // ✅ GOOD
   const isValid = await verifyTurnstile(data.turnstile_token, env);

   // ❌ BAD - Missing Turnstile check
   const booking = await createBooking(data);
   ```

2. **Use Idempotency Keys**

   ```typescript
   // ✅ GOOD - Client provides key
   fetch("/api/guest-booking", {
     headers: {
       "X-Idempotency-Key": `booking-${Date.now()}-${Math.random()}`,
     },
   });

   // ⚠️ ACCEPTABLE - Server generates if missing
   const key = request.headers.get("X-Idempotency-Key") || (await generateFromRequest(request));
   ```

3. **Check Availability Before Creating Booking**

   ```typescript
   // ✅ GOOD
   const isAvailable = await checkUnitAvailability(...)
   if (!isAvailable) {
     return Response.json({ error: 'UNIT_UNAVAILABLE' }, { status: 400 })
   }

   // ❌ BAD - Creates conflicting booking
   await createBooking(data)
   ```

4. **Sanitize All User Input**

   ```typescript
   // ✅ GOOD
   guest_name: z.string().transform((val) => DOMPurify.sanitize(val));

   // ❌ BAD - No sanitization
   guest_name: z.string();
   ```

5. **Handle Rate Limit Responses**

   ```typescript
   // ✅ GOOD
   if (response.status === 429) {
     const retryAfter = response.headers.get("Retry-After");
     await new Promise((r) => setTimeout(r, retryAfter * 1000));
     return retry();
   }

   // ❌ BAD - Immediate retry spam
   if (!response.ok) {
     return retry();
   }
   ```

## Testing

```typescript
describe("Guest Booking API", () => {
  it("creates booking with valid data", async () => {
    const response = await fetch("/api/guest-booking", {
      method: "POST",
      body: JSON.stringify({
        turnstile_token: "mock-token",
        ...validBookingData,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.booking.booking_id).toBeDefined();
    expect(data.upload.token).toBeDefined();
  });

  it("rejects without Turnstile token", async () => {
    const response = await fetch("/api/guest-booking", {
      method: "POST",
      body: JSON.stringify({
        ...validBookingData,
        turnstile_token: null,
      }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("INVALID_TURNSTILE");
  });

  it("enforces rate limiting", async () => {
    // Make 6 requests (limit is 5/hour)
    for (let i = 0; i < 6; i++) {
      await fetch("/api/guest-booking", {
        method: "POST",
        body: JSON.stringify(validBookingData),
      });
    }

    const response = await fetch("/api/guest-booking", {
      method: "POST",
      body: JSON.stringify(validBookingData),
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();
  });
});
```

## Performance Notes

- **Average Response Time**: 100-200ms (includes DB + email)
- **Cold Start**: 0ms (Cloudflare Workers)
- **Rate Limit Check**: ~5ms (KV lookup)
- **Turnstile Verification**: ~50-100ms (external API)
- **Database Operations**: ~30-80ms (Supabase)
- **Email Sending**: ~100-200ms (Resend)
- **File Upload URL Generation**: ~10ms

### Optimization Tips

- Use `waitUntil()` for non-critical tasks (email, audit logging)
- Cache frequently accessed data in KV (1-5 minute TTL)
- Validate input before expensive operations
- Return early on validation/auth failures
- Use batch operations for multiple DB queries
- Enable compression on responses > 1KB
