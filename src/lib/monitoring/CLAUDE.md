# Monitoring System - AI Assistant Guide

## Module Purpose

Real-time quota monitoring and alerting system for tracking resource usage across Cloudflare KV, Resend email, and Vercel bandwidth within free tier limits. Prevents service disruptions by proactively alerting when quotas approach limits.

## Key Files

```
monitoring/
├── kv-quota-monitor.ts (150 lines)          # KV writes/reads tracking
├── email-quota-monitor.ts (140 lines)       # Resend email quota
├── bandwidth-monitor.ts (130 lines)         # Vercel bandwidth usage
├── cleanup-monitor.ts (120 lines)           # Database cleanup tracking
├── cron-monitor.ts (110 lines)              # Cron job execution
├── alert-system.ts (200 lines)              # Alert notifications
└── README.md                                 # Full documentation
```

## Quick Reference - Free Tier Limits

```typescript
const FREE_TIER_LIMITS = {
  kv: {
    writes_per_day: 1000, // Cloudflare KV
    reads_per_day: 100000,
    storage_gb: 1,
  },
  email: {
    daily: 100, // Resend free tier
    monthly: 3000,
  },
  bandwidth: {
    monthly_gb: 100, // Vercel Hobby
  },
  cron: {
    invocations_per_day: 500, // Cloudflare Workers
  },
};
```

## Common Tasks

### 1. Check Current Quota Usage

```typescript
import { checkAllQuotas } from '@/lib/monitoring'

const quotas = await checkAllQuotas()

// Returns:
{
  kv: {
    writes: { current: 450, limit: 1000, percentage: 45, status: 'ok' },
    reads: { current: 15000, limit: 100000, percentage: 15, status: 'ok' },
  },
  email: {
    daily: { current: 35, limit: 100, percentage: 35, status: 'ok' },
    monthly: { current: 450, limit: 3000, percentage: 15, status: 'ok' },
  },
  bandwidth: {
    current: 3.5, limit: 100, unit: 'GB', percentage: 3.5, status: 'ok'
  },
  timestamp: '2024-12-06T10:30:00Z'
}
```

### 2. Track KV Operations

```typescript
import { trackKVOperation } from "@/lib/monitoring/kv-quota-monitor";

// Track a KV write
await trackKVOperation("write", "rate-limit:192.168.1.1");

// Track a KV read
await trackKVOperation("read", "idempotency:abc123");

// Internally increments counters in KV:
// - quota:kv:writes:2024-12-06 → 451
// - quota:kv:reads:2024-12-06 → 15001
```

### 3. Track Email Sends

```typescript
import { trackEmailSend } from '@/lib/monitoring/email-quota-monitor'

// Track email before sending
await trackEmailSend({
  to: 'guest@example.com',
  type: 'booking_confirmation',
  size_kb: 12,
})

// Checks quota
const canSend = await checkEmailQuota()
if (!canSend) {
  throw new Error('Daily email quota exceeded')
}

// Send email
await resend.emails.send({...})
```

### 4. Monitor Bandwidth

```typescript
import { trackBandwidth } from "@/lib/monitoring/bandwidth-monitor";

// Track file uploads
await trackBandwidth({
  type: "upload",
  bytes: file.size,
  path: "/api/upload-payment-proof",
});

// Track API responses
await trackBandwidth({
  type: "response",
  bytes: responseSize,
  path: "/api/bookings",
});
```

### 5. Send Alerts

```typescript
import { sendQuotaAlert } from "@/lib/monitoring/alert-system";

// Auto-triggered at thresholds
if (kvWrites.percentage > 80) {
  await sendQuotaAlert({
    service: "kv_writes",
    current: kvWrites.current,
    limit: kvWrites.limit,
    percentage: kvWrites.percentage,
    severity: "warning", // warning | critical
  });
}
```

## Critical Patterns

### Quota Status Levels

```typescript
export type QuotaStatus = "ok" | "warning" | "critical" | "exceeded";

function getQuotaStatus(percentage: number): QuotaStatus {
  if (percentage >= 100) return "exceeded";
  if (percentage >= 95) return "critical";
  if (percentage >= 80) return "warning";
  return "ok";
}
```

### Daily Counter Reset

```typescript
// Counters automatically reset at midnight UTC
// Key format: quota:{service}:{metric}:{YYYY-MM-DD}

// Example:
const key = `quota:kv:writes:${format(new Date(), "yyyy-MM-dd")}`;
await env.RATE_LIMIT_KV.put(key, writeCount.toString(), {
  expirationTtl: 86400, // 24 hours - auto-cleanup
});
```

### Alert Deduplication

```typescript
// Prevent alert spam
const alertKey = `alert:${service}:${severity}:${format(new Date(), "yyyy-MM-dd-HH")}`;

const recentAlert = await env.RATE_LIMIT_KV.get(alertKey);
if (recentAlert) {
  // Already alerted this hour
  return;
}

// Send alert
await sendEmail({
  to: "admin@resort.com",
  subject: `⚠️ ${service} quota ${severity}`,
  html: alertContent,
});

// Mark alert sent (expires in 1 hour)
await env.RATE_LIMIT_KV.put(alertKey, "sent", { expirationTtl: 3600 });
```

## Integration Points

### With Cloudflare Workers

```typescript
// functions/api/guest-booking.ts
export async function onRequest(context) {
  const { request, env } = context;

  // Track KV operations
  await trackKVOperation("read", `rate-limit:${clientIp}`);

  // Check email quota before sending
  const canSendEmail = await checkEmailQuota(env);
  if (!canSendEmail) {
    // Log but don't block booking
    console.error("Email quota exceeded, booking confirmation not sent");
  } else {
    await sendBookingConfirmation(booking);
    await trackEmailSend({ to: booking.email, type: "confirmation" });
  }

  // Track response bandwidth
  const responseSize = JSON.stringify(booking).length;
  await trackBandwidth({ type: "response", bytes: responseSize });

  return Response.json(booking);
}
```

### With Cron Jobs

```typescript
// functions/cron/cleanup-guest-bookings.ts
export async function scheduled(event: ScheduledEvent, env: Env) {
  const startTime = Date.now();

  try {
    // Perform cleanup
    const deleted = await cleanupExpiredBookings();

    // Track cron execution
    await logCronExecution({
      job: "cleanup-guest-bookings",
      duration: Date.now() - startTime,
      records_processed: deleted.length,
      status: "success",
    });

    // Check quota
    const cronQuota = await checkCronQuota(env);
    if (cronQuota.percentage > 80) {
      await sendQuotaAlert({
        service: "cron_invocations",
        current: cronQuota.current,
        limit: cronQuota.limit,
        percentage: cronQuota.percentage,
      });
    }
  } catch (error) {
    await logCronExecution({
      job: "cleanup-guest-bookings",
      duration: Date.now() - startTime,
      status: "failed",
      error: error.message,
    });
  }
}
```

### With Alert System

```typescript
// Automatic alerts at thresholds
const quotas = await checkAllQuotas();

// 80% warning
if (quotas.kv.writes.percentage >= 80) {
  await sendQuotaAlert({
    service: "kv_writes",
    ...quotas.kv.writes,
    severity: "warning",
    message: "Consider optimizing KV writes or upgrading plan",
  });
}

// 95% critical
if (quotas.email.daily.percentage >= 95) {
  await sendQuotaAlert({
    service: "email_daily",
    ...quotas.email.daily,
    severity: "critical",
    message: "Email quota almost exceeded - service disruption imminent",
  });
}

// 100% exceeded
if (quotas.bandwidth.percentage >= 100) {
  await sendQuotaAlert({
    service: "bandwidth",
    ...quotas.bandwidth,
    severity: "exceeded",
    message: "URGENT: Bandwidth quota exceeded - site may be throttled",
  });
}
```

## Common Gotchas

1. **Don't Block on Monitoring**

   ```typescript
   // ✅ GOOD - Fire and forget
   trackKVOperation("write", key).catch(console.error);

   // ❌ BAD - Blocks critical operation
   await trackKVOperation("write", key);
   ```

2. **Handle Missing Env Variables**

   ```typescript
   // ✅ GOOD
   if (!env.RATE_LIMIT_KV) {
     console.warn("Monitoring disabled - KV not configured");
     return;
   }

   // ❌ BAD - Crashes on missing env
   await env.RATE_LIMIT_KV.put(key, value);
   ```

3. **Use Correct Date Format**

   ```typescript
   // ✅ GOOD - ISO date
   const key = `quota:kv:writes:${format(new Date(), "yyyy-MM-dd")}`;

   // ❌ BAD - Inconsistent format
   const key = `quota:kv:writes:${new Date().toLocaleDateString()}`;
   ```

4. **Alert Deduplication**

   ```typescript
   // ✅ GOOD - One alert per hour
   const alertKey = `alert:${service}:${format(new Date(), 'yyyy-MM-dd-HH')}`

   // ❌ BAD - Alerts every check (spam)
   await sendAlert(...)  // No dedup
   ```

5. **Increment Atomically**

   ```typescript
   // ✅ GOOD - Atomic increment (if supported)
   await env.QUOTA_KV.increment(`quota:kv:writes:${date}`);

   // ⚠️ ACCEPTABLE - Read-modify-write (race condition possible)
   const current = parseInt((await env.QUOTA_KV.get(key)) || "0");
   await env.QUOTA_KV.put(key, (current + 1).toString());
   ```

## Monitoring Dashboard

```typescript
// GET /api/monitoring/check-quotas
export async function onRequest({ env }) {
  const quotas = await checkAllQuotas(env);

  return Response.json({
    quotas,
    alerts:
      quotas.kv.writes.status !== "ok" ||
      quotas.email.daily.status !== "ok" ||
      quotas.bandwidth.status !== "ok",
    recommendations: generateRecommendations(quotas),
  });
}

function generateRecommendations(quotas) {
  const recs = [];

  if (quotas.kv.writes.percentage > 70) {
    recs.push("Consider caching frequently accessed data");
    recs.push("Review rate limiting implementation");
  }

  if (quotas.email.daily.percentage > 70) {
    recs.push("Batch email notifications");
    recs.push("Consider digest emails instead of individual sends");
  }

  if (quotas.bandwidth.percentage > 70) {
    recs.push("Enable compression on API responses");
    recs.push("Optimize image sizes");
  }

  return recs;
}
```

## Testing Requirements

```typescript
describe("Quota Monitoring", () => {
  it("tracks KV operations", async () => {
    await trackKVOperation("write", "test-key");

    const quota = await getKVQuota();
    expect(quota.writes.current).toBeGreaterThan(0);
  });

  it("sends alert at 80% threshold", async () => {
    // Mock quota at 85%
    vi.mock("./kv-quota-monitor", () => ({
      getKVQuota: () => ({
        writes: { current: 850, limit: 1000, percentage: 85 },
      }),
    }));

    await checkAndAlert();

    expect(mockSendAlert).toHaveBeenCalledWith(expect.objectContaining({ severity: "warning" }));
  });

  it("deduplicates alerts within same hour", async () => {
    await sendQuotaAlert({ service: "kv_writes", severity: "warning" });
    await sendQuotaAlert({ service: "kv_writes", severity: "warning" });

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });
});
```

## Performance Notes

- Monitoring overhead: < 5ms per operation
- Quotas cached for 1 minute
- Alerts deduplicated to max 1/hour per service
- Counter increments non-blocking
- KV storage for counters: ~100 bytes per metric per day
- Total monitoring data: ~10KB/day
- Auto-cleanup after 7 days
