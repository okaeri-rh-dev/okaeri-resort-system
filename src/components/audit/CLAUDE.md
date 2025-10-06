# Audit Trail System - AI Assistant Guide

## Module Purpose

The Audit Trail System logs all critical data mutations, security events, and user actions for compliance, debugging, and security monitoring. This module is **mandatory** for all state-changing operations.

## Key Files

```
audit/
├── AuditLogViewer.tsx (459 lines)    # Main component with real-time display
├── AuditFilters.tsx (230 lines)      # Advanced filtering interface
└── README.md                          # Full documentation
```

Related files:

- `src/lib/audit-logger.ts` - Core logging functions
- `src/lib/audit-logger-workers.ts` - Background processing
- `database/migrations/*_audit_logs.sql` - Database schema

## Common Tasks

### 1. Log a Data Mutation

```typescript
import { logAuditEvent } from "@/lib/audit-logger";

await logAuditEvent({
  action: "booking.created", // Use dot notation: entity.action
  entity_type: "booking", // Entity being modified
  entity_id: booking.booking_id, // UUID of entity
  user_id: session.user.id, // From Supabase auth
  changes: {
    before: null, // null for creates
    after: sanitizeForAudit(booking), // Remove sensitive data
  },
  metadata: {
    ip_address: request.headers.get("cf-connecting-ip"),
    user_agent: request.headers.get("user-agent"),
    // Any additional context
  },
});
```

### 2. Log a Security Event

```typescript
await logAuditEvent({
  action: "security.rate_limit.exceeded",
  entity_type: "security",
  severity: "WARNING", // INFO | WARNING | ERROR | CRITICAL
  description: "Rate limit exceeded for guest booking",
  metadata: {
    ip_address: clientIp,
    endpoint: "/api/guest-booking",
    limit: 5,
    attempts: 6,
  },
});
```

### 3. Log with IP Address (Server-Side)

```typescript
// In Cloudflare Workers
import { logAuditEventWithIP } from "@/lib/audit-logger-workers";

await logAuditEventWithIP({
  action: "guest_booking.created",
  entity_type: "booking",
  entity_id: booking.booking_id,
  ip_address: request.headers.get("cf-connecting-ip"),
  user_agent: request.headers.get("user-agent"),
  changes: { before: null, after: booking },
});
```

## Critical Patterns

### Action Naming Convention

```typescript
// Format: entity.action.modifier
"booking.created";
"booking.updated";
"booking.deleted";
"booking.status.changed";
"payment.verified";
"payment.failed";
"auth.login.success";
"auth.login.failed";
"security.rate_limit.exceeded";
"security.suspicious.detected";
"guest_booking.created"; // Public endpoint
```

### Sanitization for Audit Logs

```typescript
function sanitizeForAudit(data: any) {
  const { password, credit_card, ssn, ...safe } = data
  return safe
}

// Always sanitize before logging
changes: {
  before: before ? sanitizeForAudit(before) : null,
  after: after ? sanitizeForAudit(after) : null,
}
```

### Severity Levels

```typescript
export type AuditSeverity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";

// INFO: Normal operations (default)
// WARNING: Unusual but handled (failed login, rate limit)
// ERROR: Recoverable errors (validation failure, network error)
// CRITICAL: Security threats (SQL injection attempt, XSS attempt)
```

## Integration Points

### With State Mutations

```typescript
// In Zustand store or mutation
const createBooking = useMutation({
  mutationFn: async (data) => {
    const booking = await db.bookings.create(data);

    // REQUIRED: Log after successful mutation
    await logAuditEvent({
      action: "booking.created",
      entity_type: "booking",
      entity_id: booking.booking_id,
      changes: { before: null, after: booking },
    });

    return booking;
  },
});
```

### With Serverless Functions

```typescript
// functions/api/guest-booking.ts
export async function onRequest(context) {
  const { request, env } = context;

  try {
    const booking = await createGuestBooking(data);

    // Log with IP address
    await logAuditEventWithIP({
      action: "guest_booking.created",
      entity_type: "booking",
      entity_id: booking.booking_id,
      ip_address: request.headers.get("cf-connecting-ip"),
      changes: { before: null, after: booking },
    });

    return Response.json(booking);
  } catch (error) {
    // Log errors too
    await logAuditEvent({
      action: "guest_booking.failed",
      entity_type: "booking",
      severity: "ERROR",
      description: error.message,
    });

    throw error;
  }
}
```

### With Security Monitoring

```typescript
// Audit logs feed the security monitoring dashboard
const { data: securityLogs } = useQuery({
  queryKey: ["security-logs"],
  queryFn: () =>
    supabase
      .from("audit_logs")
      .select("*")
      .in("severity", ["WARNING", "ERROR", "CRITICAL"])
      .order("created_at", { ascending: false }),
});
```

## Common Gotchas

1. **Don't log passwords or sensitive data**

   ```typescript
   // ❌ BAD
   changes: {
     after: user;
   } // Contains password hash

   // ✅ GOOD
   changes: {
     after: sanitizeForAudit(user);
   }
   ```

2. **Don't forget to log deletions**

   ```typescript
   // ✅ GOOD
   const deleted = await db.bookings.delete(id);
   await logAuditEvent({
     action: "booking.deleted",
     entity_id: id,
     changes: { before: deleted, after: null }, // before = deleted data
   });
   ```

3. **Use correct severity levels**

   ```typescript
   // ❌ BAD - Failed login is WARNING, not ERROR
   severity: "ERROR";

   // ✅ GOOD
   severity: "WARNING"; // User typo is expected, not a system error
   ```

4. **Don't block on audit logging**

   ```typescript
   // ✅ GOOD - Fire and forget
   logAuditEvent({...}).catch(console.error)  // Don't await

   // ❌ BAD - Blocks user action
   await logAuditEvent({...})  // Only await if critical
   ```

5. **Include IP address for security events**
   ```typescript
   // ✅ GOOD
   metadata: {
     ip_address: request.headers.get('cf-connecting-ip'),
     user_agent: request.headers.get('user-agent'),
   }
   ```

## Testing Requirements

### Unit Tests

```typescript
describe("Audit Logging", () => {
  it("logs booking creation", async () => {
    const mockLog = vi.fn();
    vi.mock("@/lib/audit-logger", () => ({ logAuditEvent: mockLog }));

    await createBooking(data);

    expect(mockLog).toHaveBeenCalledWith({
      action: "booking.created",
      entity_type: "booking",
      entity_id: expect.any(String),
      changes: {
        before: null,
        after: expect.objectContaining({ booking_reference: expect.any(String) }),
      },
    });
  });
});
```

### Integration Tests

```typescript
it("creates audit log entry in database", async () => {
  await createBooking(data);

  const { data: logs } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("action", "booking.created")
    .order("created_at", { ascending: false })
    .limit(1);

  expect(logs[0]).toMatchObject({
    action: "booking.created",
    entity_type: "booking",
  });
});
```

## Quick Reference

### Mandatory Audit Logging

✅ **Always log these actions**:

- Data creation (bookings, guests, payments)
- Data updates (status changes, edits)
- Data deletions
- Authentication events
- Payment operations
- Security events (rate limiting, suspicious activity)

❌ **Don't log these**:

- Read operations (queries, views)
- UI state changes
- Navigation events
- Form interactions

### Environment Variables

```env
# None required - uses Supabase client
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### Database Schema

```sql
-- audit_logs table
audit_id uuid PRIMARY KEY
action text NOT NULL              -- 'entity.action'
entity_type text                  -- 'booking', 'payment', etc.
entity_id uuid                    -- UUID of affected entity
user_id uuid                      -- Supabase auth user (null for public)
severity text DEFAULT 'INFO'     -- 'INFO', 'WARNING', 'ERROR', 'CRITICAL'
changes jsonb                     -- { before, after }
metadata jsonb                    -- { ip_address, user_agent, ... }
created_at timestamptz            -- Auto-generated
```

## Performance Notes

- Audit logging is **non-blocking** by default
- Uses background workers for batch processing
- Retention: 90 days (configured in cleanup cron)
- Index on `created_at`, `action`, `severity` for fast filtering
- Average log size: ~2KB per entry
- Max 10,000 logs per day (typical usage: 500-1000)
