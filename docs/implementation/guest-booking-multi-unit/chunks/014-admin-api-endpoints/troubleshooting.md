# Troubleshooting: Chunk 014 - Admin API Endpoints

## Purpose

This guide helps you diagnose and fix common issues when implementing admin API endpoints for multi-unit booking management.

---

## Build and Type Errors

### Issue 1: TypeScript Cannot Find Urgency Scoring Module

**Symptom**:

```
error TS2307: Cannot find module '@/lib/urgency-scoring' or its corresponding type declarations.
```

**Cause**: File not created or incorrect path alias.

**Solution**:

1. **Verify file exists**:

   ```bash
   ls -la src/lib/urgency-scoring.ts
   # Should show the file
   ```

2. **Check path alias in `tsconfig.json`**:

   ```json
   {
     "compilerOptions": {
       "paths": {
         "@/*": ["./src/*"]
       }
     }
   }
   ```

3. **Restart TypeScript server** (VS Code):
   - Command Palette → "TypeScript: Restart TS Server"

4. **Re-run type check**:
   ```bash
   npm run type-check
   ```

---

### Issue 2: Rate Limit Import Error

**Symptom**:

```
Module '"@/lib/rate-limit"' has no exported member 'checkKVRateLimit'.
```

**Cause**: Rate limiting function not implemented or exported.

**Solution**:

1. **Check `src/lib/rate-limit.ts` exports**:

   ```typescript
   export async function checkKVRateLimit(
     kv: KVNamespace,
     clientId: string,
     endpoint: string,
     maxRequests: number,
     windowSeconds: number
   ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
     // ... implementation
   }
   ```

2. **If function doesn't exist**, implement based on existing patterns in `functions/api/guest-booking/guest-booking.ts`.

3. **Verify import statement**:
   ```typescript
   import { checkKVRateLimit } from "@/lib/rate-limit";
   ```

---

### Issue 3: Cloudflare Workers Type Errors

**Symptom**:

```
Property 'KVNamespace' does not exist on type 'Env'.
```

**Cause**: Missing KV namespace type definition.

**Solution**:

1. **Add KV namespace to environment interface**:

   ```typescript
   interface Env {
     SUPABASE_URL: string;
     SUPABASE_SERVICE_KEY: string;
     RATE_LIMIT_KV: KVNamespace; // <-- Add this
   }
   ```

2. **Install Cloudflare Workers types** (if missing):

   ```bash
   npm install --save-dev @cloudflare/workers-types
   ```

3. **Update `tsconfig.json`** to include types:
   ```json
   {
     "compilerOptions": {
       "types": ["@cloudflare/workers-types"]
     }
   }
   ```

---

## JWT Authentication Failures

### Issue 4: "Unauthorized" Error with Valid Admin Token

**Symptom**:

```json
{
  "success": false,
  "error": "Unauthorized",
  "error_code": "UNAUTHORIZED",
  "message": "Invalid or expired token"
}
```

**Cause**: JWT token expired or Supabase client misconfigured.

**Solution**:

1. **Verify token is not expired**:
   - Decode JWT at https://jwt.io
   - Check `exp` claim (expiration timestamp)
   - If expired, get new token:
     ```typescript
     const { data } = await supabase.auth.signInWithPassword({
       email: "admin@example.com",
       password: "password",
     });
     console.log(data.session.access_token); // New token
     ```

2. **Verify Supabase URL and Service Key**:

   ```bash
   # Check environment variables
   echo $SUPABASE_URL
   echo $SUPABASE_SERVICE_KEY
   ```

3. **Test JWT verification manually**:

   ```typescript
   const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
   const {
     data: { user },
     error,
   } = await supabase.auth.getUser(token);
   console.log("User:", user);
   console.log("Error:", error);
   ```

4. **Check Authorization header format**:

   ```bash
   # Correct format (note space after Bearer)
   curl -H "Authorization: Bearer eyJhbGciOi..."

   # Incorrect (missing space)
   curl -H "Authorization: BearereyJhbGciOi..."
   ```

---

### Issue 5: "Forbidden" Error for Admin User

**Symptom**:

```json
{
  "success": false,
  "error": "Forbidden - insufficient permissions",
  "error_code": "FORBIDDEN",
  "message": "Admin role required"
}
```

**Cause**: User does not have `app_role = 'admin'` in `user_profiles` table.

**Solution**:

1. **Check user profile**:

   ```sql
   SELECT user_id, app_role
   FROM user_profiles
   WHERE user_id = 'your-user-uuid';
   ```

2. **If `app_role` is NULL or not 'admin'**, update:

   ```sql
   UPDATE user_profiles
   SET app_role = 'admin'
   WHERE user_id = 'your-user-uuid';
   ```

3. **Verify `user_profiles` table exists**:

   ```sql
   \d user_profiles
   ```

4. **If table doesn't exist**, create it:
   ```sql
   CREATE TABLE user_profiles (
     user_id UUID PRIMARY KEY REFERENCES auth.users(id),
     app_role TEXT NOT NULL DEFAULT 'user',
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

---

### Issue 6: Middleware Not Blocking Requests

**Symptom**: Non-admin users can access admin endpoints.

**Cause**: Middleware not configured correctly or not applied to routes.

**Solution**:

1. **Verify middleware file location**:

   ```bash
   ls -la functions/api/admin/_middleware.ts
   # File must be named EXACTLY "_middleware.ts"
   ```

2. **Check middleware export**:

   ```typescript
   // Must export onRequest function
   export async function onRequest(context) {
     // ... authentication logic
   }
   ```

3. **Verify Cloudflare Pages routing**:
   - Middleware applies to all files in `functions/api/admin/` directory
   - Sub-routes like `functions/api/admin/pending-bookings.ts` automatically use middleware

4. **Test middleware directly**:

   ```bash
   # Should return 401 (blocked by middleware)
   curl -X GET https://your-domain.com/api/admin/pending-bookings

   # Should pass middleware and reach endpoint
   curl -X GET https://your-domain.com/api/admin/pending-bookings \
     -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
   ```

---

## Urgency Scoring Calculation Errors

### Issue 7: Urgency Scores Always Return 100

**Symptom**: All bookings show `urgency_score: 100` regardless of dates.

**Cause**: Check-in date parsing error or date comparison logic error.

**Solution**:

1. **Verify date format**:

   ```typescript
   // booking.check_in_date must be ISO string
   console.log(booking.check_in_date); // Expected: "2025-03-01T14:00:00Z"

   const checkIn = new Date(booking.check_in_date);
   console.log(checkIn.toString()); // Should be valid date, not "Invalid Date"
   ```

2. **Check hours calculation**:

   ```typescript
   const now = new Date();
   const checkIn = new Date(booking.check_in_date);
   const hoursToCheckIn = (checkIn.getTime() - now.getTime()) / (1000 * 60 * 60);

   console.log("Hours to check-in:", hoursToCheckIn);
   // Should be positive number if check-in is in future
   // Should be negative if check-in has passed
   ```

3. **Debug score components**:

   ```typescript
   function calculateUrgencyScore(booking) {
     let score = 0;
     const components = {};

     // ... calculate each component

     components.hoursToCheckIn = hoursToCheckInScore;
     components.daysPending = daysPendingScore;
     components.bookingValue = bookingValueScore;
     components.unitCount = unitCountScore;

     console.log("Score components:", components);
     console.log("Final score:", score);

     return { score, badge, slo_hours };
   }
   ```

4. **Verify early return for past check-in**:
   ```typescript
   if (hoursToCheckIn < 0) {
     // This should only trigger if check-in has ALREADY passed
     return { score: 100, badge: "critical", slo_hours: 1 };
   }
   ```

---

### Issue 8: Badge Thresholds Incorrect

**Symptom**: Score 75 shows "high" badge instead of "critical".

**Cause**: Badge threshold logic error.

**Solution**:

1. **Verify threshold order** (must check highest first):

   ```typescript
   if (finalScore >= 75) {
     return { score: finalScore, badge: "critical", slo_hours: 1 };
   } else if (finalScore >= 50) {
     return { score: finalScore, badge: "high", slo_hours: 4 };
   } else if (finalScore >= 25) {
     return { score: finalScore, badge: "medium", slo_hours: 12 };
   } else {
     return { score: finalScore, badge: "low", slo_hours: 24 };
   }
   ```

2. **Test boundary cases**:
   ```typescript
   // Test exactly at thresholds
   console.log(getBadge(75)); // Should be "critical"
   console.log(getBadge(74)); // Should be "high"
   console.log(getBadge(50)); // Should be "high"
   console.log(getBadge(49)); // Should be "medium"
   ```

---

## Available Units Query Issues

### Issue 9: Available Units API Returns Empty Array

**Symptom**: API returns `{ "units": [], "total": 0 }` even though units exist.

**Cause**: Query filtering too aggressively or date overlap logic incorrect.

**Solution**:

1. **Check units table has data**:

   ```sql
   SELECT unit_id, unit_number, unit_status
   FROM units
   WHERE unit_status = 'Available';
   ```

2. **Verify date overlap query logic**:

   ```sql
   -- Bookings that overlap with check_in=2025-03-01, check_out=2025-03-08
   SELECT unit_id, check_in_date, check_out_date
   FROM booking_units
   WHERE status != 'cancelled'
     AND (
       -- Case 1: Existing booking starts before or on check-in, ends after check-in
       (check_in_date <= '2025-03-01' AND check_out_date >= '2025-03-01')
       OR
       -- Case 2: Existing booking starts before check-out, ends on or after check-out
       (check_in_date <= '2025-03-08' AND check_out_date >= '2025-03-08')
       OR
       -- Case 3: Existing booking is completely within requested range
       (check_in_date >= '2025-03-01' AND check_out_date <= '2025-03-08')
     );
   ```

3. **Debug Supabase query**:

   ```typescript
   // Log booked units
   console.log("Booked units:", bookedUnits);

   // Log all available units
   console.log("All available units:", allUnits);

   // Log filtering
   const bookedUnitIds = new Set(bookedUnits.map((b) => b.unit_id));
   console.log("Booked unit IDs:", Array.from(bookedUnitIds));

   const availableUnits = allUnits.filter((unit) => !bookedUnitIds.has(unit.unit_id));
   console.log("Available units after filtering:", availableUnits);
   ```

4. **Simplify query for debugging**:

   ```typescript
   // Temporarily remove date filtering to see all units
   const { data: allUnits } = await supabase
     .from("units")
     .select("*")
     .eq("unit_status", "Available");

   console.log("Total available units (no date filter):", allUnits.length);
   ```

---

### Issue 10: Units Missing `max_capacity_per_unit`

**Symptom**: Units returned without capacity field.

**Cause**: Pricing config query failing or not joining correctly.

**Solution**:

1. **Check pricing_config table**:

   ```sql
   SELECT id, max_capacity_per_unit
   FROM pricing_config
   WHERE id = 'default';
   ```

2. **Verify query returns config**:

   ```typescript
   const { data: config, error } = await supabase
     .from("pricing_config")
     .select("max_capacity_per_unit")
     .eq("id", "default")
     .single();

   console.log("Config:", config);
   console.log("Error:", error);
   ```

3. **If config missing**, insert default:
   ```sql
   INSERT INTO pricing_config (id, max_capacity_per_unit)
   VALUES ('default', 4)
   ON CONFLICT (id) DO NOTHING;
   ```

---

## Unit Assignment Transaction Failures

### Issue 11: "All-or-nothing violation" Error Despite Correct Count

**Symptom**:

```json
{
  "error": "Must assign exactly 3 units (received 3 units)"
}
```

**Cause**: Array length calculation in PostgreSQL function incorrect.

**Solution**:

1. **Check PostgreSQL function**:

   ```sql
   -- View function definition
   \df assign_units_to_booking
   ```

2. **Debug array length**:

   ```sql
   -- Test array_length function
   SELECT array_length(ARRAY['uuid1', 'uuid2', 'uuid3']::UUID[], 1);
   -- Should return: 3
   ```

3. **Check booking requested count**:

   ```sql
   SELECT booking_id,
          (SELECT COUNT(*) FROM guest_booking_unit_requests WHERE booking_id = b.booking_id) AS requested_count
   FROM bookings b
   WHERE booking_id = 'your-booking-uuid';
   ```

4. **Verify array parameter not null**:
   ```typescript
   console.log("unit_ids array:", unit_ids);
   console.log("Array length:", unit_ids.length);
   console.log("Array is array:", Array.isArray(unit_ids));
   ```

---

### Issue 12: Transaction Timeout After 5 Seconds

**Symptom**: Assignment fails with timeout error.

**Cause**: Slow database query or database connection issues.

**Solution**:

1. **Check database performance**:

   ```sql
   -- View slow queries
   SELECT query, calls, mean_exec_time
   FROM pg_stat_statements
   WHERE mean_exec_time > 1000 -- > 1 second
   ORDER BY mean_exec_time DESC;
   ```

2. **Verify indexes exist**:

   ```sql
   -- booking_units should have indexes on:
   -- - booking_id
   -- - unit_id
   -- - (unit_id, check_in_date, check_out_date) for EXCLUDE constraint
   \d booking_units
   ```

3. **Increase timeout temporarily** (for debugging only):

   ```sql
   ALTER FUNCTION assign_units_to_booking(UUID, UUID[])
     SET statement_timeout = '10s';
   ```

4. **Check connection pool**:
   ```typescript
   // Use connection pooling with Supabase
   const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
     db: {
       schema: "public",
     },
     auth: {
       persistSession: false, // Important for serverless
     },
   });
   ```

---

### Issue 13: EXCLUDE Constraint Fails Silently

**Symptom**: Concurrent assignment succeeds when it should fail.

**Cause**: EXCLUDE constraint not created or `btree_gist` extension missing.

**Solution**:

1. **Verify EXCLUDE constraint exists**:

   ```sql
   SELECT conname, pg_get_constraintdef(oid)
   FROM pg_constraint
   WHERE conrelid = 'booking_units'::regclass
     AND contype = 'x'; -- 'x' = EXCLUDE constraint
   ```

2. **Check `btree_gist` extension**:

   ```sql
   SELECT * FROM pg_extension WHERE extname = 'btree_gist';
   ```

3. **If missing, create extension**:

   ```sql
   CREATE EXTENSION IF NOT EXISTS btree_gist;
   ```

4. **Recreate EXCLUDE constraint**:

   ```sql
   ALTER TABLE booking_units
   ADD CONSTRAINT no_double_booking EXCLUDE USING gist (
     unit_id WITH =,
     daterange(check_in_date, check_out_date, '[]') WITH &&
   ) WHERE (status != 'cancelled');
   ```

5. **Test constraint**:

   ```sql
   -- Insert first booking
   INSERT INTO booking_units (booking_id, unit_id, check_in_date, check_out_date, status)
   VALUES ('booking-1', 'unit-101', '2025-03-01', '2025-03-08', 'confirmed');

   -- Try to insert overlapping booking (should FAIL)
   INSERT INTO booking_units (booking_id, unit_id, check_in_date, check_out_date, status)
   VALUES ('booking-2', 'unit-101', '2025-03-05', '2025-03-10', 'confirmed');
   -- Expected error: "conflicting key value violates exclusion constraint"
   ```

---

## Payment Verification Errors

### Issue 14: Payment Status Not Updating

**Symptom**: API returns success but database `payment_status` remains 'Pending'.

**Cause**: Supabase query targeting wrong booking or RLS policy blocking update.

**Solution**:

1. **Check RLS policies**:

   ```sql
   -- View RLS policies on bookings table
   SELECT * FROM pg_policies
   WHERE tablename = 'bookings';
   ```

2. **Use service key** (bypasses RLS):

   ```typescript
   // Service key should bypass RLS
   const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
   ```

3. **Verify booking exists and is guest booking**:

   ```sql
   SELECT booking_id, is_guest_booking, payment_status
   FROM bookings
   WHERE booking_id = 'your-booking-uuid';
   ```

4. **Test update manually**:

   ```sql
   UPDATE bookings
   SET payment_status = 'Verified',
       payment_verified_at = NOW()
   WHERE booking_id = 'your-booking-uuid'
     AND is_guest_booking = true;

   -- Check affected rows
   -- Should return: UPDATE 1
   ```

5. **Debug Supabase update**:

   ```typescript
   const { data, error, count } = await supabase
     .from("bookings")
     .update({ payment_status: "Verified" })
     .eq("booking_id", booking_id)
     .eq("is_guest_booking", true)
     .select(); // Add .select() to return updated row

   console.log("Updated data:", data);
   console.log("Error:", error);
   console.log("Count:", count);
   ```

---

## Rate Limiting Not Working

### Issue 15: Rate Limit Never Triggers

**Symptom**: Can make >100 requests without getting HTTP 429.

**Cause**: Rate limiting KV namespace not configured or `checkKVRateLimit` not called.

**Solution**:

1. **Verify KV namespace exists**:

   ```bash
   wrangler kv:namespace list
   # Should show RATE_LIMIT_KV
   ```

2. **Create KV namespace if missing**:

   ```bash
   wrangler kv:namespace create RATE_LIMIT_KV
   ```

3. **Check wrangler.toml configuration**:

   ```toml
   [[kv_namespaces]]
   binding = "RATE_LIMIT_KV"
   id = "your-kv-namespace-id"
   ```

4. **Verify rate limit function is called**:

   ```typescript
   // Add debug logging
   export async function onRequest(context) {
     console.log("[RATE LIMIT] Checking rate limit for:", clientIP);

     const { allowed, remaining } = await checkKVRateLimit(/* ... */);

     console.log("[RATE LIMIT] Allowed:", allowed);
     console.log("[RATE LIMIT] Remaining:", remaining);

     if (!allowed) {
       console.log("[RATE LIMIT] BLOCKED - Rate limit exceeded");
       return new Response(/* 429 response */);
     }
   }
   ```

5. **Test with automated script**:
   ```bash
   # Make 101 requests rapidly
   for i in {1..101}; do
     echo "Request $i"
     curl -X GET https://your-domain.com/api/admin/pending-bookings \
       -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
       -w "\nHTTP Status: %{http_code}\n"
   done
   ```

---

### Issue 16: Rate Limit Resets Too Quickly

**Symptom**: Rate limit resets immediately instead of waiting 1 hour.

**Cause**: TTL (time-to-live) not set correctly in KV store.

**Solution**:

1. **Check KV write includes expiration**:

   ```typescript
   await kv.put(
     rateKey,
     JSON.stringify({ count: currentCount + 1, resetTime }),
     { expirationTtl: windowSeconds } // Must be in seconds
   );
   ```

2. **Verify TTL calculation**:

   ```typescript
   const windowSeconds = 3600; // 1 hour
   const resetTime = Math.floor(Date.now() / 1000) + windowSeconds;

   console.log("Window seconds:", windowSeconds);
   console.log("Reset time (unix):", resetTime);
   console.log("Reset time (date):", new Date(resetTime * 1000).toISOString());
   ```

3. **Check KV TTL manually**:
   ```bash
   # View KV key with metadata
   wrangler kv:key get "rate-limit:admin-pending-bookings:YOUR_IP" \
     --namespace-id YOUR_KV_NAMESPACE_ID \
     --preview false
   ```

---

## Audit Logs Not Created

### Issue 17: Audit Log Entries Missing

**Symptom**: No audit logs in `audit_logs` table after admin actions.

**Cause**: `logAuditEvent` function not called or audit logger misconfigured.

**Solution**:

1. **Verify audit_logs table exists**:

   ```sql
   SELECT * FROM audit_logs
   ORDER BY created_at DESC
   LIMIT 10;
   ```

2. **Check audit logger import**:

   ```typescript
   import { logAuditEvent } from "@/lib/audit-logger";
   ```

3. **Verify function is called**:

   ```typescript
   // Add debug logging
   console.log("[AUDIT] Creating audit log entry");

   await logAuditEvent({
     action: "booking.units_assigned",
     entity_type: "booking",
     entity_id: booking_id,
     changes: { before: {}, after: {} },
     user_id: adminContext?.user_id,
   });

   console.log("[AUDIT] Audit log created successfully");
   ```

4. **Check audit logger implementation**:

   ```typescript
   // src/lib/audit-logger.ts should insert into audit_logs table
   export async function logAuditEvent(event: AuditEvent) {
     const { error } = await supabase.from("audit_logs").insert({
       action: event.action,
       entity_type: event.entity_type,
       entity_id: event.entity_id,
       changes: event.changes,
       user_id: event.user_id,
       metadata: event.metadata,
     });

     if (error) {
       console.error("Audit log error:", error);
     }
   }
   ```

5. **Test audit logger manually**:

   ```typescript
   await logAuditEvent({
     action: "test.action",
     entity_type: "test",
     entity_id: "test-uuid",
     changes: { test: true },
     user_id: "test-user-uuid",
   });

   // Check database
   // SELECT * FROM audit_logs WHERE action = 'test.action';
   ```

---

## Still Stuck?

### Debugging Checklist

Before seeking help, verify:

- [ ] All previous chunks (001-013) completed successfully
- [ ] PostgreSQL database accessible
- [ ] Supabase Auth configured correctly
- [ ] Admin user created with `app_role = 'admin'`
- [ ] Valid admin JWT token obtained
- [ ] KV namespace created for rate limiting
- [ ] Environment variables set correctly (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] Browser console shows no CORS errors

### Escalation Path

1. **Check existing documentation**:
   - `docs/implementation/guest-booking-multi-unit/02-api-specification.md` (lines 1247-1764)
   - `docs/implementation/guest-booking-multi-unit/04-admin-interface.md` (lines 1-200)

2. **Search for similar issues**:
   - Check GitHub issues in project repository
   - Search Supabase documentation: https://supabase.com/docs
   - Search Cloudflare Workers docs: https://developers.cloudflare.com/workers/

3. **Gather debugging information**:
   - TypeScript error messages (full output)
   - API error responses (full JSON)
   - Database query results
   - Console logs from Worker
   - curl command used for testing

4. **Contact support**:
   - Open GitHub issue with debugging information
   - Include chunk number (014) and specific issue section
   - Provide minimal reproducible example

5. **Community resources**:
   - Supabase Discord: https://discord.supabase.com
   - Cloudflare Discord: https://discord.gg/cloudflaredev
   - Stack Overflow (tag: supabase, cloudflare-workers)

---

**Remember**: Most issues are caused by misconfigured environment variables, missing database tables/constraints, or incorrect JWT tokens. Double-check these first before diving deeper into debugging.
