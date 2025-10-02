# Phase 2e: IP Capture with Cloudflare Workers (Hybrid Approach)

## Purpose

This document covers the **hybrid IP capture strategy** using Cloudflare Workers for critical security events while maintaining client-side logging for regular operations. This approach provides accurate IP forensics where it matters most while staying within the Cloudflare free tier limits.

**Why Hybrid?**: Browser clients cannot reliably capture true client IP addresses. For security-critical events (authentication, refunds, deletions), IP forensics are valuable for investigations and compliance.

---

## Decision: Option C (Hybrid IP Capture)

### Approach Comparison

| Approach                        | IP Capture                      | Performance      | Cost                    | Use Case             |
| ------------------------------- | ------------------------------- | ---------------- | ----------------------- | -------------------- |
| **Option A: Workers for All**   | ✅ Accurate for all             | ❌ Extra latency | ⚠️ May exceed free tier | High-security apps   |
| **Option B: No IP Capture**     | ❌ Always null                  | ✅ Fast          | ✅ Free                 | Low-security apps    |
| **Option C: Hybrid** (Selected) | ✅ Accurate for critical events | ✅ Fast for most | ✅ Free                 | **Small businesses** |

### Why Option C for Okaeri Resort?

**✅ Selected: Hybrid (Workers for Critical Events Only)**

**Free Tier Analysis**:

- Cloudflare Free: 100,000 Workers requests/day
- Estimated resort audit events: ~50/day total
- Critical security events: ~10-20/day (auth, refunds, deletions)
- **Usage**: 0.01-0.02% of free tier limit ✅

**Event Classification**:

- **Use Workers** (IP important): Authentication, refunds, data exports, deletions
- **Use Client** (IP not needed): Bookings, payments, updates, regular changes

**★ Insight ─────────────────────────────────────**
For a 3-room resort, critical security events requiring IP forensics (login attempts, refunds) average ~15/day. At 100,000 free Workers requests/day, this uses only 0.015% of the free tier—making Option C cost-free and practical.
**─────────────────────────────────────────────────**

---

## Cloudflare Workers Function

### File Structure

```
functions/
└── api/
    └── audit/
        └── log-with-ip.ts  # Worker function for IP capture
```

### Worker Implementation

```typescript
// functions/api/audit/log-with-ip.ts

import { Env } from "@cloudflare/workers-types";

/**
 * Cloudflare Workers function for audit logging with IP capture
 *
 * Purpose: Capture true client IP for security-critical events
 * Free tier: 100,000 requests/day (resort uses ~10-20/day)
 *
 * Endpoints:
 * POST /api/audit/log-with-ip
 *
 * Request body:
 * {
 *   tableName: string;
 *   recordId?: string;
 *   description: string;
 *   category: string;
 *   severity?: string;
 *   metadata?: Record<string, unknown>;
 *   oldData?: Record<string, unknown>;
 *   newData?: Record<string, unknown>;
 * }
 */

interface AuditLogRequest {
  tableName: string;
  recordId?: string;
  description: string;
  category: string;
  severity?: "INFO" | "WARNING" | "CRITICAL" | "DEBUG";
  metadata?: Record<string, unknown>;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;

  // CORS headers for browser requests
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*", // Restrict to your domain in production
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Parse request body
    const body: AuditLogRequest = await request.json();

    // Validate required fields
    if (!body.tableName || !body.description || !body.category) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: tableName, description, category" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract true client IP from Cloudflare headers
    const clientIP =
      request.headers.get("CF-Connecting-IP") || // Cloudflare-provided client IP
      request.headers.get("X-Forwarded-For")?.split(",")[0] || // Fallback
      null;

    // Extract user agent
    const userAgent = request.headers.get("User-Agent") || null;

    // Extract authorization token
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing auth token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Supabase to insert audit log
    // NOTE: Use env.SUPABASE_URL and env.SUPABASE_ANON_KEY from Worker secrets
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_ANON_KEY;

    const auditLogData = {
      table_name: body.tableName,
      record_id: body.recordId || null,
      action: "INSERT", // Layer 2 convention
      source: "app", // Layer 2 source
      description: body.description,
      category: body.category,
      severity: body.severity || "INFO",
      metadata: body.metadata || null,
      old_data: body.oldData || null,
      new_data: body.newData || null,
      ip_address: clientIP,
      user_agent: userAgent,
      // Note: user_id and user_email will be set by BEFORE INSERT trigger from JWT
    };

    // Insert into Supabase
    const response = await fetch(`${supabaseUrl}/rest/v1/audit_logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: supabaseKey,
        Prefer: "return=representation",
      },
      body: JSON.stringify(auditLogData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Supabase insert failed:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to create audit log", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();

    return new Response(JSON.stringify({ success: true, audit_id: result[0]?.audit_id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Worker error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
```

---

## Environment Variables

Add to your Cloudflare Workers environment (via Cloudflare Dashboard or wrangler.toml):

```toml
# wrangler.toml

name = "okaeri-resort-system"
compatibility_date = "2025-01-01"

[env.production.vars]
SUPABASE_URL = "https://your-project.supabase.co"
SUPABASE_ANON_KEY = "your-anon-key-here"
```

**Security Note**: Use Cloudflare Workers Secrets for sensitive values in production:

```bash
npx wrangler secret put SUPABASE_ANON_KEY
```

---

## Client-Side Integration

### Helper Function for Workers Logging

```typescript
// src/lib/audit-logger-workers.ts

import { supabase } from "./supabase";
import type { AuditEventContext } from "../../database.types";

/**
 * Log audit event with IP capture via Cloudflare Workers
 *
 * Use this ONLY for critical security events:
 * - Authentication (login, logout, failed attempts)
 * - Financial operations (refunds, chargebacks)
 * - Data deletions
 * - Sensitive data exports
 *
 * For regular events, use logAuditEvent() from audit-logger.ts (client-side)
 */
export async function logAuditEventWithIP(
  context: AuditEventContext
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current user session token
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      console.warn("[Audit Workers] No active session, skipping IP capture");
      return { success: false, error: "No active session" };
    }

    // Call Cloudflare Workers endpoint
    const response = await fetch("/api/audit/log-with-ip", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        tableName: context.tableName,
        recordId: context.recordId,
        description: context.description,
        category: context.category,
        severity: context.severity || "INFO",
        metadata: context.metadata,
        oldData: context.oldData,
        newData: context.newData,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[Audit Workers] Failed:", errorData);
      return { success: false, error: errorData.error };
    }

    const result = await response.json();
    console.log("[Audit Workers] Logged with IP:", result.audit_id);
    return { success: true };
  } catch (error) {
    console.error("[Audit Workers] Exception:", error);
    return { success: false, error: String(error) };
  }
}
```

---

## Usage Examples

### Critical Event: Authentication (Use Workers)

```typescript
// src/lib/auth-helpers.ts

import { logAuditEventWithIP } from "./audit-logger-workers";
import { AuditCategory, AuditSeverity } from "../../database.types";

export async function handleLogin(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Log failed login with IP
    await logAuditEventWithIP({
      tableName: "authentication",
      description: `Failed login attempt for ${email}`,
      category: AuditCategory.AUTHENTICATION,
      severity: AuditSeverity.WARNING,
      metadata: {
        email,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
    });
    throw error;
  }

  // Log successful login with IP
  await logAuditEventWithIP({
    tableName: "authentication",
    description: `User logged in: ${email}`,
    category: AuditCategory.AUTHENTICATION,
    severity: AuditSeverity.INFO,
    metadata: {
      email,
      timestamp: new Date().toISOString(),
    },
  });

  return data;
}
```

### Critical Event: Refund (Use Workers)

```typescript
// src/lib/payment-helpers.ts

import { logAuditEventWithIP } from "./audit-logger-workers";
import { AuditCategory, AuditSeverity } from "../../database.types";

export async function processRefund(paymentId: string, amount: number, reason: string) {
  // Process refund
  const { data, error } = await db.payments.refund(paymentId, amount);

  if (error) throw error;

  // Log refund with IP (critical financial event)
  await logAuditEventWithIP({
    tableName: "payments",
    recordId: paymentId,
    description: `Refund processed: ₱${amount.toLocaleString()}`,
    category: AuditCategory.PAYMENT,
    severity: AuditSeverity.WARNING,
    metadata: {
      amount,
      reason,
      timestamp: new Date().toISOString(),
    },
    oldData: { payment_status: "completed" },
    newData: { payment_status: "refunded" },
  });

  return data;
}
```

### Regular Event: Booking Creation (Use Client-Side)

```typescript
// src/lib/booking-helpers.ts

import { logAuditEvent } from "./audit-logger"; // Client-side logger (NO IP)
import { AuditCategory, AuditSeverity } from "../../database.types";

export async function createBooking(bookingData: BookingFormData) {
  // Create booking
  const { data, error } = await db.bookings.create(bookingData);

  if (error) throw error;

  // Log booking creation WITHOUT IP (regular operation)
  await logAuditEvent({
    tableName: "bookings",
    recordId: data.booking_id,
    description: `New booking created for ${bookingData.guest_name}`,
    category: AuditCategory.BOOKING,
    severity: AuditSeverity.INFO,
    metadata: {
      check_in: bookingData.check_in_date,
      check_out: bookingData.check_out_date,
      total_amount: bookingData.total_amount,
    },
  });

  return data;
}
```

---

## Event Classification Guide

### Use Workers (IP Capture)

**Authentication Events**:

- ✅ Login attempts (success/failure)
- ✅ Logout
- ✅ Password resets
- ✅ Account lockouts

**Financial Operations**:

- ✅ Refunds
- ✅ Chargebacks
- ✅ Manual payment adjustments
- ✅ Large transactions (> ₱50,000)

**Data Security**:

- ✅ Data exports (CSV, reports)
- ✅ Record deletions
- ✅ Bulk operations
- ✅ Role/permission changes

### Use Client-Side (No IP)

**Regular Operations** (~80% of events):

- ❌ Booking creation/updates
- ❌ Payment completion (non-refund)
- ❌ Guest information updates
- ❌ Unit status changes
- ❌ Maintenance logs
- ❌ Expense tracking

**Rationale**: IP forensics not needed for routine business operations. Layer 1 database triggers already capture the data changes.

---

## Performance Considerations

### Latency Impact

| Logging Method     | Latency | Use Case                           |
| ------------------ | ------- | ---------------------------------- |
| Client-side logger | ~50ms   | Regular operations (80% of events) |
| Workers IP capture | ~150ms  | Critical security events (20%)     |

**User Experience**: 100ms extra latency acceptable for critical operations (login, refunds) but not for every booking update.

### Free Tier Monitoring

**Cloudflare Dashboard**: Monitor Workers requests at:
`https://dash.cloudflare.com → Workers & Pages → Analytics`

**Alert if approaching limits**:

```bash
# Simple alert script (run daily via cron)
# Check if requests > 80,000/day (80% of free tier)

if [ $DAILY_REQUESTS -gt 80000 ]; then
  echo "WARNING: Approaching Workers free tier limit"
  # Send email/Slack notification
fi
```

---

## Security Best Practices

### 1. CORS Configuration

In production, restrict CORS to your domain:

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://your-resort-domain.com",
  "Access-Control-Allow-Methods": "POST",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
```

### 2. Rate Limiting

Add rate limiting to prevent abuse:

```typescript
// Simple rate limit: 10 requests per minute per IP
const rateLimitKey = `audit:${clientIP}`;
const requestCount = await env.RATE_LIMITER.get(rateLimitKey);

if (requestCount && parseInt(requestCount) > 10) {
  return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
    status: 429,
    headers: corsHeaders,
  });
}

await env.RATE_LIMITER.put(rateLimitKey, String(parseInt(requestCount || "0") + 1), {
  expirationTtl: 60, // 1 minute
});
```

### 3. Token Validation

Workers rely on Supabase RLS for auth. Ensure:

- JWT tokens are validated by Supabase
- BEFORE INSERT trigger enforces identity
- No client-supplied user_id/email trusted

---

## Troubleshooting

### Problem: IP always null in Workers

**Diagnosis**:

```typescript
console.log("CF-Connecting-IP:", request.headers.get("CF-Connecting-IP"));
console.log("X-Forwarded-For:", request.headers.get("X-Forwarded-For"));
```

**Solution**: Ensure Cloudflare proxy is enabled (orange cloud in DNS settings).

### Problem: CORS errors

**Diagnosis**: Check browser console for "CORS policy" errors

**Solution**: Verify `Access-Control-Allow-Origin` matches your frontend domain.

### Problem: Approaching free tier limit

**Diagnosis**: Check Cloudflare dashboard analytics

**Solutions**:

1. Review event classification - move non-critical events to client-side
2. Upgrade to Cloudflare Workers Paid ($5/month for 10M requests)
3. Consolidate multiple events into batch logging

---

## Migration from Full Workers Logging

If you previously logged all events via Workers:

```bash
# 1. Update all non-critical event calls
# Replace: logAuditEventWithIP() → logAuditEvent()

# Example:
git grep "logAuditEventWithIP" src/lib/booking-helpers.ts
# Change to: logAuditEvent()

# 2. Keep only critical events using Workers
# - Authentication: src/lib/auth-helpers.ts
# - Refunds: src/lib/payment-helpers.ts
# - Deletions: src/lib/data-helpers.ts
```

---

## Next Steps

**Integration Checklist**:

- [ ] Create `functions/api/audit/log-with-ip.ts` Worker function
- [ ] Set Cloudflare Workers secrets (SUPABASE_URL, SUPABASE_ANON_KEY)
- [ ] Create `src/lib/audit-logger-workers.ts` client helper
- [ ] Update authentication handlers to use Workers logging
- [ ] Update refund handlers to use Workers logging
- [ ] Update data deletion handlers to use Workers logging
- [ ] Test IP capture with VPN (should see real IP, not VPN)
- [ ] Monitor Cloudflare dashboard for request usage

**Next**: Return to [Phase 2c: Audit Logger](./02c-audit-logger.md) to integrate Workers logging for critical events.

---

**Workers IP Capture Checklist:**

- [ ] Worker function deployed to Cloudflare Pages
- [ ] Environment secrets configured
- [ ] Client helper function created
- [ ] Critical events identified and updated
- [ ] Regular events use client-side logger
- [ ] CORS configured for production domain
- [ ] Rate limiting implemented
- [ ] Free tier usage monitored
- [ ] IP capture tested and verified
