# Troubleshooting: Chunk 004

## Overview

This document provides solutions for common issues encountered when implementing the Core API Endpoints. Issues are organized by category with symptom → solution format.

---

## Environment & Setup Issues

### Issue 1: Turnstile Keys Not Working

**Symptom:**

```json
{
  "success": false,
  "error": "Security verification failed",
  "error_code": "TURNSTILE_VERIFICATION_FAILED"
}
```

**Causes & Solutions:**

**Cause 1: Using wrong key type**

- **Symptom**: Keys start with different prefixes
- **Solution**:
  - Site Key (client-side): Use `VITE_TURNSTILE_SITE_KEY` (starts with `0x4AAAAAAA`)
  - Secret Key (server-side): Use `TURNSTILE_SECRET_KEY` (starts with `0x4AAAAAAA`)
  - Verify you're not mixing them up

**Cause 2: Using test keys in production**

- **Symptom**: Keys work in development but fail in production
- **Solution**:
  - Development: Use test token `1x00000000000000000000AA` (always passes)
  - Production: Use real Turnstile widget to generate tokens
  - Test tokens don't work in production mode

**Cause 3: Domain mismatch**

- **Symptom**: Turnstile verification fails with "invalid domain"
- **Solution**:
  1. Go to Cloudflare Turnstile dashboard
  2. Edit site settings
  3. Add your domain to allowed domains list (e.g., `localhost`, `your-domain.com`)

**Debugging Command:**

```bash
# Test Turnstile verification directly
curl -X POST https://challenges.cloudflare.com/turnstile/v0/siteverify \
  -d "secret=YOUR_SECRET_KEY&response=1x00000000000000000000AA&remoteip=127.0.0.1"

# Expected response:
# {"success": true}
```

---

### Issue 2: KV Namespace Not Found

**Symptom:**

```
Error: KV namespace binding "RATE_LIMIT_KV" not found
```

**Causes & Solutions:**

**Cause 1: KV namespace not created**

- **Solution**:

  ```bash
  wrangler kv:namespace create RATE_LIMIT_KV

  # Add output to wrangler.toml:
  # kv_namespaces = [
  #   { binding = "RATE_LIMIT_KV", id = "xxxxxxxxxxxxx" }
  # ]
  ```

**Cause 2: Wrong binding name in wrangler.toml**

- **Solution**: Ensure `binding = "RATE_LIMIT_KV"` matches exactly in:
  - `wrangler.toml` configuration
  - TypeScript `Env` interface
  - Function calls: `checkKVRateLimit(env.RATE_LIMIT_KV, ...)`

**Cause 3: Not deployed to Cloudflare**

- **Solution**: KV namespaces only work in deployed Workers
  - Development: Use `wrangler dev` (not `npm run dev`)
  - Production: Deploy with `wrangler deploy`

**Debugging Command:**

```bash
# List all KV namespaces
wrangler kv:namespace list

# Verify namespace ID matches wrangler.toml
```

---

### Issue 3: Supabase Connection Errors

**Symptom:**

```json
{
  "success": false,
  "error": "Configuration not found. Please contact support.",
  "error_code": "INTERNAL_ERROR"
}
```

**Causes & Solutions:**

**Cause 1: Missing environment variables**

- **Solution**:

  ```bash
  # Check .env.local has required keys
  grep SUPABASE .env.local

  # Should output:
  # VITE_SUPABASE_URL=https://...
  # VITE_SUPABASE_ANON_KEY=eyJhbGci...
  ```

**Cause 2: Using anon key instead of service key**

- **Symptom**: RLS policies block API requests
- **Solution**: API endpoints should use `SUPABASE_SERVICE_KEY` (not `VITE_SUPABASE_ANON_KEY`)
  - Service key bypasses RLS policies
  - Check `functions/api/guest-booking.ts` uses `env.SUPABASE_SERVICE_KEY`

**Cause 3: Supabase project not accessible**

- **Solution**:

  ```bash
  # Test Supabase connection
  curl -X GET "https://your-project.supabase.co/rest/v1/pricing_config" \
    -H "apikey: YOUR_ANON_KEY" \
    -H "Authorization: Bearer YOUR_SERVICE_KEY"

  # Should return pricing_config row
  ```

**Debugging Command:**

```bash
# Verify Supabase client initialization
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
supabase.from('pricing_config').select('*').eq('id', 'default').single()
  .then(({ data, error }) => console.log(data || error));
"
```

---

## API Endpoint Issues

### Issue 4: Pricing Calculation Returns Null

**Symptom:**

```json
{
  "success": false,
  "error": "Pricing calculation failed",
  "error_code": "DATABASE_ERROR"
}
```

**Causes & Solutions:**

**Cause 1: pricing_config table is empty**

- **Solution**:

  ```sql
  -- Check if default config exists
  SELECT * FROM pricing_config WHERE id = 'default';

  -- If empty, insert default (from Chunk 001)
  INSERT INTO pricing_config (
    id, base_rate, weekend_rate, extra_person_rate,
    base_occupancy, max_capacity_per_unit, downpayment_percent
  ) VALUES (
    'default', 3000.00, 3500.00, 500.00, 2, 20, 50.00
  );
  ```

**Cause 2: calculate_booking_pricing() function doesn't exist**

- **Solution**: Run Chunk 002 migration (pricing engine PostgreSQL function)

  ```sql
  -- Verify function exists
  SELECT routine_name
  FROM information_schema.routines
  WHERE routine_schema = 'public'
    AND routine_name = 'calculate_booking_pricing';

  -- Should return 1 row
  ```

**Cause 3: Invalid date format**

- **Symptom**: Error mentions "invalid date"
- **Solution**: Use ISO 8601 datetime format
  - ✅ Correct: `"2025-11-01T14:00:00Z"`
  - ❌ Wrong: `"2025-11-01"` (missing time)
  - ❌ Wrong: `"11/01/2025"` (wrong format)

**Debugging Command:**

```bash
# Test pricing function directly in Supabase SQL Editor
SELECT calculate_booking_pricing(
  '[{"guests_per_unit": 2}]'::JSONB,
  '2025-11-01'::DATE,
  '2025-11-04'::DATE
);

# Should return JSONB with pricing breakdown
```

---

### Issue 5: Rate Limiting Not Working

**Symptom:**

- Can send unlimited requests (no 429 errors)
- Rate limit headers missing

**Causes & Solutions:**

**Cause 1: KV writes failing silently**

- **Solution**: Check Cloudflare Workers logs

  ```bash
  # View logs in Cloudflare dashboard
  # Look for "[RATE_LIMIT] KV error:" messages

  # Or use wrangler CLI
  wrangler tail --format=pretty
  ```

**Cause 2: Failing open on errors**

- **Explanation**: `checkKVRateLimit()` fails open (allows requests) if KV is down
- **Solution**: This is intentional for availability
  - Monitor KV errors in logs
  - Alert if KV error rate > 5%

**Cause 3: Using same IP for all requests**

- **Symptom**: localhost requests not rate limited
- **Solution**: CF-Connecting-IP header is "unknown" in local dev
  - Expected behavior (local testing uses same IP)
  - Test rate limiting in production/staging environment

**Debugging Command:**

```bash
# Check KV namespace usage
wrangler kv:key list --namespace-id=YOUR_KV_NAMESPACE_ID

# Should show rate limit keys like:
# ratelimit:guest-booking:192.168.1.1
```

---

### Issue 6: CORS Errors in Browser

**Symptom:**

```
Access to fetch at 'http://localhost:8787/api/guest-booking'
from origin 'http://localhost:5173' has been blocked by CORS policy
```

**Causes & Solutions:**

**Cause 1: Missing CORS headers**

- **Solution**: Verify all endpoints return CORS headers

  ```typescript
  const corsHeaders = {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGINS || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // Return headers in all responses
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
  ```

**Cause 2: OPTIONS preflight not handled**

- **Solution**: Add OPTIONS handler to all POST endpoints
  ```typescript
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  ```

**Cause 3: Wrong ALLOWED_ORIGINS**

- **Solution**: Check `.env.local`
  ```bash
  # Should include your frontend origin
  ALLOWED_ORIGINS=http://localhost:5173,https://your-domain.com
  ```

**Debugging Command:**

```bash
# Test CORS preflight
curl -v -X OPTIONS http://localhost:8787/api/guest-booking \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST"

# Check response headers include:
# Access-Control-Allow-Origin: http://localhost:5173
# Access-Control-Allow-Methods: POST, OPTIONS
```

---

## Data Validation Issues

### Issue 7: Capacity Validation Failing Unexpectedly

**Symptom:**

```json
{
  "success": false,
  "error": "Maximum 20 guests per unit",
  "error_code": "CAPACITY_EXCEEDED"
}
```

But you're requesting fewer than 20 guests.

**Causes & Solutions:**

**Cause 1: Comparing against wrong capacity**

- **Solution**: Verify `pricing_config.max_capacity_per_unit` value

  ```sql
  SELECT max_capacity_per_unit FROM pricing_config WHERE id = 'default';

  -- Should return: 20 (default from Chunk 001)
  -- If different, update:
  UPDATE pricing_config SET max_capacity_per_unit = 20 WHERE id = 'default';
  ```

**Cause 2: Validating total guests instead of per-unit**

- **Wrong**:
  ```typescript
  const totalGuests = unit_requests.reduce((sum, r) => sum + r.guests_per_unit, 0);
  if (totalGuests > maxCapacity) {
    /* ERROR */
  }
  ```
- **Correct**:
  ```typescript
  for (const request of unit_requests) {
    if (request.guests_per_unit > maxCapacity) {
      /* ERROR */
    }
  }
  ```

**Debugging Command:**

```bash
# Test with exact capacity
curl -X POST http://localhost:8787/api/guest-booking \
  -H "Content-Type: application/json" \
  -d '{
    "guest_name": "Test",
    "email": "test@test.com",
    "phone_number": "+1234567890",
    "check_in": "2025-11-01T14:00:00Z",
    "check_out": "2025-11-04T11:00:00Z",
    "unit_requests": [{"guests_per_unit": 20}],
    "turnstile_token": "1x00000000000000000000AA",
    "terms_accepted": true
  }' | jq

# Should succeed (20 is exactly max capacity)
```

---

### Issue 8: Idempotency Key Collision

**Symptom:**

```json
{
  "success": true,
  "is_duplicate": true,
  "booking": {...}
}
```

But you expected a new booking.

**Causes & Solutions:**

**Cause 1: Reusing same UUID**

- **Solution**: Generate new UUID for each request

  ```typescript
  // Client-side
  const idempotencyKey = crypto.randomUUID();

  // Or let server generate
  // Don't send idempotency_key field at all
  ```

**Cause 2: Key hasn't expired yet**

- **Explanation**: Keys expire 48 hours after creation
- **Solution**:
  - Wait 48 hours for key to expire, OR
  - Use different UUID, OR
  - Manually delete key from database:
    ```sql
    DELETE FROM idempotency_keys WHERE key = 'your-uuid-here';
    ```

**Debugging Command:**

```bash
# Check if key exists
psql -c "SELECT * FROM idempotency_keys WHERE key = 'YOUR_UUID';"

# Check when key expires
psql -c "SELECT key, expires_at, NOW() FROM idempotency_keys WHERE key = 'YOUR_UUID';"
```

---

### Issue 9: Discount Not Applied

**Symptom:**
Preview pricing returns `"discount": null` when you expect a discount.

**Causes & Solutions:**

**Cause 1: Duration too short**

- **Solution**: Verify booking qualifies for discount
  - 7-night discount requires ≥7 nights
  - Check `check_in` to `check_out` duration
  ```typescript
  const nights = Math.ceil((new Date(check_out) - new Date(check_in)) / (1000 * 60 * 60 * 24));
  console.log("Nights:", nights); // Must be ≥7 for 7-night discount
  ```

**Cause 2: Discount rule inactive**

- **Solution**: Check `is_active` flag in database

  ```sql
  SELECT name, is_active, conditions
  FROM discount_rules
  ORDER BY priority DESC;

  -- Activate if needed
  UPDATE discount_rules
  SET is_active = TRUE
  WHERE name = 'Week Stay Discount';
  ```

**Cause 3: Best-of policy choosing different discount**

- **Explanation**: Only highest discount applies (no stacking)
- **Solution**: Check all matching discounts
  ```sql
  -- See which discount wins
  SELECT name, discount_value, priority, conditions
  FROM discount_rules
  WHERE is_active = TRUE
    -- For 7-night booking
    AND (
      (conditions @> '[{"type": "min_nights"}]'::jsonb AND 7 >= (conditions->0->>'value')::INTEGER)
      -- Add other condition checks...
    )
  ORDER BY discount_value DESC, priority ASC
  LIMIT 1;
  ```

**Debugging Command:**

```bash
# Test 7-night booking (should get 5% discount)
curl -X POST http://localhost:8787/api/guest-booking/preview-pricing \
  -H "Content-Type: application/json" \
  -d '{
    "unit_requests": [{"guests_per_unit": 2}],
    "check_in": "2025-12-01T14:00:00Z",
    "check_out": "2025-12-08T11:00:00Z"
  }' | jq '.pricing.discount'

# Should return:
# {
#   "percent": 5,
#   "amount": <calculated>,
#   "rule_name": "Week Stay Discount"
# }
```

---

## TypeScript & Build Issues

### Issue 10: TypeScript Errors in API Files

**Symptom:**

```
error TS2307: Cannot find module '@/types/guest-booking-multi-unit'
```

**Causes & Solutions:**

**Cause 1: Path alias not configured**

- **Solution**: Verify `tsconfig.json` has path mapping
  ```json
  {
    "compilerOptions": {
      "baseUrl": ".",
      "paths": {
        "@/*": ["src/*"]
      }
    }
  }
  ```

**Cause 2: Module resolution issue**

- **Solution**: Use relative imports for Cloudflare Workers

  ```typescript
  // Instead of:
  import { ... } from "@/types/guest-booking-multi-unit";

  // Use:
  import { ... } from "../../src/types/guest-booking-multi-unit";
  ```

**Cause 3: Missing type definitions file**

- **Solution**: Ensure file exists
  ```bash
  ls -l src/types/guest-booking-multi-unit.ts
  # If missing, create it (see instructions.md Step 3)
  ```

**Debugging Command:**

```bash
# Check TypeScript compilation
npm run type-check

# Or check specific file
npx tsc --noEmit functions/api/guest-booking.ts
```

---

### Issue 11: Module Not Found at Runtime

**Symptom:**

```
Error: Cannot find module 'isomorphic-dompurify'
```

**Causes & Solutions:**

**Cause 1: Package not installed**

- **Solution**:
  ```bash
  npm install isomorphic-dompurify
  npm install --save-dev @types/dompurify
  ```

**Cause 2: Wrong import path**

- **Solution**: Use correct package name

  ```typescript
  // Correct

  // Wrong
  import DOMPurify from "dompurify"; // Browser-only version
  import DOMPurify from "isomorphic-dompurify";
  ```

**Debugging Command:**

```bash
# Check if package is installed
npm list isomorphic-dompurify

# Reinstall if missing
npm install isomorphic-dompurify
```

---

## Database & Query Issues

### Issue 12: Database Function Call Fails

**Symptom:**

```json
{
  "success": false,
  "error": "Pricing calculation failed",
  "error_code": "DATABASE_ERROR"
}
```

**Causes & Solutions:**

**Cause 1: Function signature mismatch**

- **Solution**: Verify parameter names match exactly
  ```typescript
  // Correct parameter names (from Chunk 002)
  const { data, error } = await supabase.rpc("calculate_booking_pricing", {
    p_unit_requests: unitRequestsJson, // Must be "p_unit_requests"
    p_check_in: check_in, // Must be "p_check_in"
    p_check_out: check_out, // Must be "p_check_out"
  });
  ```

**Cause 2: Wrong parameter types**

- **Solution**: Convert types correctly

  ```typescript
  // Correct
  p_unit_requests: [{ guests_per_unit: 2 }],  // Array of objects
  p_check_in: "2025-11-01",                   // String (DATE)
  p_check_out: "2025-11-04",                  // String (DATE)

  // Wrong
  p_unit_requests: "2",                       // String (should be JSONB)
  p_check_in: new Date(),                     // JavaScript Date object
  ```

**Debugging Command:**

```sql
-- Test function directly in Supabase SQL Editor
SELECT calculate_booking_pricing(
  '[{"guests_per_unit": 2}]'::JSONB,
  '2025-11-01'::DATE,
  '2025-11-04'::DATE
);

-- Check error messages
-- Common errors:
-- - "function does not exist" → Run Chunk 002 migration
-- - "invalid input syntax" → Check JSON format
-- - "division by zero" → Check nights calculation
```

---

## Still Stuck?

### Escalation Path

1. **Check Cloudflare Workers Logs**

   ```bash
   wrangler tail --format=pretty
   # Look for [BOOKING], [PRICING], [TURNSTILE], [RATE_LIMIT] prefixes
   ```

2. **Check Supabase Logs**
   - Go to Supabase Dashboard → Logs → API
   - Filter for "error" level
   - Look for database errors, authentication failures

3. **Enable Detailed Logging**

   ```typescript
   // Add to endpoint handlers
   console.log("[DEBUG] Request body:", JSON.stringify(body, null, 2));
   console.log("[DEBUG] Pricing result:", JSON.stringify(pricing, null, 2));
   console.log("[DEBUG] Environment variables:", {
     SUPABASE_URL: env.SUPABASE_URL ? "✓ Set" : "✗ Missing",
     TURNSTILE_SECRET_KEY: env.TURNSTILE_SECRET_KEY ? "✓ Set" : "✗ Missing",
   });
   ```

4. **Test with Minimal Payload**

   ```bash
   # Simplest possible booking
   curl -X POST http://localhost:8787/api/guest-booking \
     -H "Content-Type: application/json" \
     -d '{
       "guest_name": "Test",
       "email": "test@test.com",
       "phone_number": "+1234567890",
       "check_in": "2025-12-01T14:00:00Z",
       "check_out": "2025-12-02T11:00:00Z",
       "unit_requests": [{"guests_per_unit": 2}],
       "turnstile_token": "1x00000000000000000000AA",
       "terms_accepted": true
     }' | jq

   # If this works, add complexity incrementally
   ```

5. **Compare with Working Example**
   - Review `02-api-specification.md` (lines 1-2076)
   - Check endpoint implementation matches specification exactly
   - Verify request/response contracts

6. **Ask for Help**
   - GitHub Issues: https://github.com/okaeri-dev/okaeri-resort/issues
   - Provide:
     - Error message (full text)
     - Request payload (sanitize sensitive data)
     - Endpoint code snippet
     - Environment (local dev vs production)

---

## Common Error Codes Reference

Quick reference for debugging error responses.

| Error Code                      | HTTP Status | Common Cause                    | Quick Fix                                           |
| ------------------------------- | ----------- | ------------------------------- | --------------------------------------------------- |
| `VALIDATION_ERROR`              | 400         | Invalid request body            | Check Zod schema validation details                 |
| `CAPACITY_EXCEEDED`             | 400         | guests_per_unit > max_capacity  | Reduce guest count or update pricing_config         |
| `UNIT_LIMIT_EXCEEDED`           | 400         | More units requested than exist | Reduce unit count or add more units to system       |
| `TURNSTILE_VERIFICATION_FAILED` | 403         | Invalid CAPTCHA token           | Use test token `1x00000000000000000000AA` in dev    |
| `RATE_LIMIT_EXCEEDED`           | 429         | Too many requests from IP       | Wait for reset time or use different IP             |
| `DATABASE_ERROR`                | 500         | PostgreSQL function error       | Check Supabase logs, verify Chunks 001-002 complete |
| `INTERNAL_ERROR`                | 500         | Unexpected server error         | Check Cloudflare Workers logs for stack trace       |

---

**Need more help?** Consult the source documentation:

- `02-api-specification.md` - Complete API contracts
- `09-implementation-decisions.md` - Architectural decisions
- `CLAUDE.md` - Codebase patterns and conventions
