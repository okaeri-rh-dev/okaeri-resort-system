# Cloudflare Workers Functions - AI Assistant Guide

## Module Purpose

Serverless backend for the Okaeri Resort System using Cloudflare Workers (Pages Functions). Provides globally distributed API endpoints, cron jobs, and edge computing with zero cold starts and automatic scaling within free tier limits.

## Architecture

```
functions/
├── _middleware.ts                  # Global middleware (auth, CORS, rate limiting)
├── api/
│   ├── guest-booking.ts           # Public booking endpoint
│   ├── guest-booking/
│   │   ├── confirm.ts             # Confirm upload completion
│   │   └── status.ts              # Check booking status
│   ├── audit/
│   │   └── log-with-ip.ts        # IP-aware audit logging
│   ├── monitoring/
│   │   └── check-quotas.ts       # Quota monitoring endpoint
│   └── health.ts                  # Health check
├── cron/
│   └── cleanup-guest-bookings.ts  # Scheduled cleanup (every 6 hours)
└── README.md                       # Full documentation
```

## Environment Variables

```typescript
// Accessed via context.env in functions

interface Env {
  // Supabase
  VITE_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;

  // Cloudflare Turnstile
  TURNSTILE_SECRET_KEY: string;

  // Email (Resend)
  RESEND_API_KEY: string;

  // KV Namespaces
  RATE_LIMIT_KV: KVNamespace;
  BLOCKED_IPS_KV?: KVNamespace; // Optional - not yet implemented

  // Environment
  ENVIRONMENT: "production" | "development";
  APP_VERSION: string;
}
```

## Common Tasks

### 1. Create New API Endpoint

```typescript
// functions/api/example.ts
import type { PagesFunction } from "@cloudflare/workers-types";

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    // Parse request body
    const data = await request.json();

    // Validate with Zod
    const validated = schema.parse(data);

    // Process request
    const result = await processRequest(validated, env);

    // Return success response
    return Response.json(result, { status: 200 });
  } catch (error) {
    console.error("API error:", error);
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
};
```

### 2. Add CORS Headers

```typescript
// CORS handled by _middleware.ts automatically

// Or add custom CORS:
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Or specific origin
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Idempotency-Key",
};

// Handle preflight
if (request.method === "OPTIONS") {
  return new Response(null, { headers: corsHeaders });
}

// Add to response
return Response.json(data, { headers: corsHeaders });
```

### 3. Implement Rate Limiting

```typescript
import { checkKVRateLimit } from "@/lib/rate-limiting";

const clientIp = request.headers.get("cf-connecting-ip") || "unknown";

const rateLimit = await checkKVRateLimit(env.RATE_LIMIT_KV, clientIp, {
  limit: 5, // 5 requests
  windowSeconds: 3600, // per hour
});

if (!rateLimit.allowed) {
  return Response.json(
    {
      error: "Too many requests",
      retryAfter: rateLimit.retryAfter,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(rateLimit.retryAfter),
      },
    }
  );
}
```

### 4. Verify Turnstile Token

```typescript
async function verifyTurnstile(token: string, env: Env): Promise<boolean> {
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: env.TURNSTILE_SECRET_KEY,
      response: token,
    }),
  });

  const data = await response.json();
  return data.success === true;
}

// Usage
const isValid = await verifyTurnstile(data.turnstile_token, env);
if (!isValid) {
  return Response.json({ error: "Invalid Turnstile token" }, { status: 400 });
}
```

### 5. Create Cron Job

```typescript
// functions/cron/example-job.ts
export async function scheduled(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  const startTime = Date.now();

  try {
    // Perform scheduled task
    const result = await performCleanup(env);

    // Log execution
    await logCronExecution({
      job: "example-job",
      scheduled_time: event.scheduledTime,
      execution_time: Date.now(),
      duration: Date.now() - startTime,
      records_processed: result.count,
      status: "success",
    });

    console.log(`Cron job completed: ${result.count} records processed`);
  } catch (error) {
    console.error("Cron job failed:", error);

    // Log failure
    await logCronExecution({
      job: "example-job",
      status: "failed",
      error: error.message,
    });

    // Re-throw to mark as failed in Cloudflare dashboard
    throw error;
  }
}
```

## Critical Patterns

### Request Context

```typescript
interface PagesFunction<Env = unknown> {
  (context: {
    request: Request; // Incoming request
    env: Env; // Environment variables & KV
    params: Record<string, string>; // URL params
    waitUntil: (promise: Promise<any>) => void; // Background tasks
    next: () => Promise<Response>; // Call next middleware
    data: Record<string, any>; // Shared data between middleware
  }): Promise<Response> | Response;
}
```

### Error Handling

```typescript
try {
  // Your code
} catch (error) {
  // Log to console (visible in Cloudflare dashboard)
  console.error("Error:", error);

  // Log to audit trail (if applicable)
  await logAuditEvent({
    action: "api.error",
    severity: "ERROR",
    description: error.message,
  });

  // Return standardized error response
  return Response.json(
    {
      error: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
      code: 500,
    },
    { status: 500 }
  );
}
```

### Background Tasks

```typescript
// Use waitUntil for non-blocking tasks
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, waitUntil } = context

  const result = await processRequest(data)

  // Non-blocking: Send email in background
  waitUntil(
    sendConfirmationEmail(result.email).catch(console.error)
  )

  // Non-blocking: Log to audit trail
  waitUntil(
    logAuditEvent({ action: 'api.success', ... }).catch(console.error)
  )

  // Return immediately
  return Response.json(result)
}
```

### Idempotency

```typescript
const idempotencyKey =
  request.headers.get("X-Idempotency-Key") || (await generateIdempotencyKey(request));

// Check if already processed
const cached = await env.RATE_LIMIT_KV.get(`idempotency:${idempotencyKey}`);
if (cached) {
  return new Response(cached, { status: 200 });
}

// Process request
const result = await processRequest(data);

// Cache result (1 hour TTL)
await env.RATE_LIMIT_KV.put(`idempotency:${idempotencyKey}`, JSON.stringify(result), {
  expirationTtl: 3600,
});

return Response.json(result);
```

## Integration Points

### With Supabase

```typescript
import { createClient } from "@supabase/supabase-js";

// Create admin client (bypasses RLS)
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Use with service role permissions
const { data, error } = await supabase.from("bookings").insert(bookingData);
```

### With KV Storage

```typescript
// Store rate limit counter
await env.RATE_LIMIT_KV.put(`rate:${clientIp}:${endpoint}`, JSON.stringify({ count, timestamp }), {
  expirationTtl: 3600, // Auto-expire after 1 hour
});

// Retrieve
const data = await env.RATE_LIMIT_KV.get(`rate:${clientIp}:${endpoint}`);
const rateLimit = data ? JSON.parse(data) : null;

// Delete
await env.RATE_LIMIT_KV.delete(`rate:${clientIp}:${endpoint}`);

// List keys (avoid in production - expensive)
const { keys } = await env.RATE_LIMIT_KV.list({ prefix: "rate:" });
```

### With Resend Email

```typescript
import { Resend } from "resend";

const resend = new Resend(env.RESEND_API_KEY);

const { data, error } = await resend.emails.send({
  from: "Okaeri Resort <bookings@okaeri-resort.com>",
  to: booking.email,
  subject: "Booking Confirmation",
  html: `<p>Your booking ${booking.booking_reference} is confirmed!</p>`,
});

if (error) {
  console.error("Email send failed:", error);
  // Don't throw - email failure shouldn't block booking
}
```

## Common Gotchas

1. **Don't use Node.js APIs**

   ```typescript
   // ❌ BAD - Node.js APIs not available
   import fs from "fs";
   import crypto from "crypto";

   // ✅ GOOD - Use Web APIs
   const crypto = globalThis.crypto;
   const hash = await crypto.subtle.digest("SHA-256", data);
   ```

2. **No File System Access**

   ```typescript
   // ❌ BAD
   fs.writeFileSync("data.json", JSON.stringify(data));

   // ✅ GOOD - Use KV or R2
   await env.DATA_KV.put("data", JSON.stringify(data));
   ```

3. **Response Must Be Returned**

   ```typescript
   // ❌ BAD - Doesn't return Response
   export const onRequest = async (context) => {
     await processRequest(context.request);
   };

   // ✅ GOOD
   export const onRequest = async (context) => {
     const result = await processRequest(context.request);
     return Response.json(result);
   };
   ```

4. **Execution Time Limit**

   ```typescript
   // Workers have 50ms CPU time limit (free)
   // Use waitUntil for long-running tasks

   // ✅ GOOD
   const result = await quickOperation(); // < 50ms

   waitUntil(longRunningTask().catch(console.error));

   return Response.json(result);
   ```

5. **KV Eventual Consistency**

   ```typescript
   // ✅ GOOD - Account for propagation delay
   await env.KV.put("key", "value");

   // May not be immediately available globally
   // Wait a bit before reading
   await new Promise((r) => setTimeout(r, 100));

   const value = await env.KV.get("key");
   ```

## Testing

```typescript
// Test with miniflare or wrangler
describe('API Endpoint', () => {
  it('creates booking', async () => {
    const env = getMiniflareBindings()

    const request = new Request('https://example.com/api/guest-booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookingData),
    })

    const response = await onRequestPost({ request, env, ... })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.booking_id).toBeDefined()
  })
})
```

## Performance Notes

- **Cold start**: 0ms (Cloudflare Workers have no cold starts)
- **Execution time**: Target < 50ms for free tier
- **Memory limit**: 128MB
- **Request size**: 100MB max
- **Response size**: 100MB max
- **CPU time**: 50ms free, 50s paid
- **KV operations**: ~1ms per operation
- **Global distribution**: Automatic across 300+ data centers
