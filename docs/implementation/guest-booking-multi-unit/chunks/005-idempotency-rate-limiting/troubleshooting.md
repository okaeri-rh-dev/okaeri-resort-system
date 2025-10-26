# Troubleshooting: Idempotency and Rate Limiting

Common issues encountered during Chunk 005 implementation and their solutions.

---

## Issue 1: Turnstile Verification Always Fails

### Symptoms

- Guest booking submissions return `403 Forbidden`
- Error message: `"CAPTCHA verification failed"`
- Occurs even with valid Turnstile tokens
- Browser console shows no Turnstile widget errors

### Possible Causes & Solutions

#### Cause 1A: Secret Key Not Set

**Check:**

```bash
wrangler secret list | grep TURNSTILE_SECRET_KEY
```

**Expected**: `TURNSTILE_SECRET_KEY` appears in list

**Solution if missing:**

```bash
# Add Turnstile secret to Workers
wrangler secret put TURNSTILE_SECRET_KEY
# Paste your secret key when prompted (from Cloudflare dashboard)

# Redeploy
wrangler deploy
```

#### Cause 1B: Wrong Secret Key

**Symptoms**: Secret exists but verification still fails

**Check Cloudflare dashboard:**

1. Navigate to: **Turnstile** > **Your Site** > **Settings**
2. Compare secret key with what you set in Workers

**Solution:**

```bash
# Update with correct secret
wrangler secret put TURNSTILE_SECRET_KEY
# Paste correct secret key

# Redeploy
wrangler deploy
```

#### Cause 1C: Domain Mismatch

**Symptoms**: Works on localhost but fails in production

**Check Turnstile site configuration:**

- Localhost site should use domain: `localhost`
- Production site should use domain: `your-domain.com` (no `https://`)

**Solution:**

```bash
# Use different site keys for different environments
# .env.local (development):
VITE_TURNSTILE_SITE_KEY=<localhost-site-key>

# Production environment variables:
VITE_TURNSTILE_SITE_KEY=<production-site-key>
```

#### Cause 1D: Testing with Dummy Tokens

**Symptoms**: Using test token `1x0000000000000000000000000000000AA` fails in production

**Explanation**: Test tokens only work with **visible mode** Turnstile widgets, not managed/invisible mode.

**Solution:**

1. Use **real Turnstile tokens** from widget in production
2. For automated testing, switch to **visible mode** in Cloudflare dashboard temporarily

**OR** bypass Turnstile in development:

```typescript
// functions/lib/verify-turnstile.ts
export async function verifyTurnstile(token: string, secret: string) {
  // ONLY FOR DEVELOPMENT - REMOVE IN PRODUCTION
  if (process.env.NODE_ENV === "development") {
    console.warn("[DEV] Bypassing Turnstile verification");
    return { success: true };
  }

  // ... normal verification ...
}
```

---

## Issue 2: Rate Limiting Not Enforcing

### Symptoms

- Can submit 10+ booking requests within an hour
- No `429 Too Many Requests` errors
- KV reads not incrementing in Cloudflare dashboard

### Possible Causes & Solutions

#### Cause 2A: KV Namespace Not Bound

**Check wrangler.toml:**

```bash
grep -A 3 "kv_namespaces" wrangler.toml
```

**Expected:**

```toml
[[kv_namespaces]]
binding = "RATE_LIMIT"
id = "abc123..."
preview_id = "def456..."
```

**Solution if missing:**

```bash
# Create KV namespace if doesn't exist
wrangler kv:namespace create "RATE_LIMIT"
wrangler kv:namespace create "RATE_LIMIT" --preview

# Add to wrangler.toml (use IDs from output above)
[[kv_namespaces]]
binding = "RATE_LIMIT"
id = "<production-id>"
preview_id = "<preview-id>"

# Redeploy
wrangler deploy
```

#### Cause 2B: Rate Limit Check Not Called

**Check `functions/api/guest-booking.ts`:**

```typescript
// Should have this BEFORE other processing
const rateLimitResult = await checkRateLimit(env.RATE_LIMIT, clientIP, 5);

if (!rateLimitResult.allowed) {
  return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
    status: 429,
    headers: { "Retry-After": "3600" },
  });
}
```

**Solution**: Add rate limit check to API endpoint (see instructions.md Step 4.2)

#### Cause 2C: Different IPs on Each Request

**Symptoms**: Rate limiting seems random, works sometimes

**Explanation**: IP address changes between requests (e.g., mobile network switching, VPN)

**Debug:**

```typescript
// Add logging to see IP addresses
const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
console.log(`[RATE_LIMIT] Client IP: ${clientIP}`);
```

**Expected**: Same IP for same client across requests

**Solution**: This is expected behavior for mobile/VPN users. Rate limiting is **per-IP**, so changing IPs resets the limit.

#### Cause 2D: KV Writes Failing Silently

**Check Worker logs:**

```bash
wrangler tail --format json | grep RATE_LIMIT
```

**Look for errors** like:

```
[ERROR] KV error: <error message>
```

**Common KV errors:**

- `Namespace not found` → KV binding incorrect
- `Quota exceeded` → Exceeded free tier limit (unlikely with 5 req/hour)
- `Network error` → Temporary Cloudflare issue (retry)

**Solution for quota exceeded:**

```bash
# Check KV usage
wrangler kv:key list --namespace-id=<your-kv-id> | wc -l

# If >100k keys (free tier limit), cleanup old keys manually:
wrangler kv:key delete --namespace-id=<your-kv-id> "ratelimit:<old-key>"
```

---

## Issue 3: Idempotency Not Preventing Duplicates

### Symptoms

- Submitting same booking twice creates 2 separate bookings
- Both have different `booking_id`
- `idempotency_keys` table empty or not being checked

### Possible Causes & Solutions

#### Cause 3A: Client Not Sending Idempotency Key

**Check request headers/body:**

```bash
# Add logging to API endpoint
console.log('[DEBUG] Idempotency key:', data.idempotency_key);
```

**Expected**: UUID like `550e8400-e29b-41d4-a716-446655440000`

**Solution**: Ensure client generates and sends UUID:

```typescript
// Frontend code
const idempotencyKey = crypto.randomUUID();
await fetch("/api/guest-booking", {
  method: "POST",
  body: JSON.stringify({
    ...bookingData,
    idempotency_key: idempotencyKey,
  }),
});
```

#### Cause 3B: PostgreSQL Function Not Checking Idempotency

**Verify function logic:**

```sql
-- Check function source
\sf create_guest_booking

-- Should contain:
-- SELECT booking_id INTO v_existing_booking_id
-- FROM idempotency_keys
-- WHERE key = p_idempotency_key
```

**Solution**: Function created in Chunk 001 should already include this logic. If missing, see `06-migration-guide.md` lines 389-504 for complete function definition.

#### Cause 3C: Idempotency Keys Expiring Too Quickly

**Check expires_at column:**

```sql
SELECT key, created_at, expires_at, (expires_at - created_at) as ttl
FROM idempotency_keys
ORDER BY created_at DESC
LIMIT 5;
```

**Expected TTL**: ~48 hours (2 days)

**Solution if TTL incorrect:**

```sql
-- Fix default expiry in table definition
ALTER TABLE idempotency_keys
ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '48 hours');
```

#### Cause 3D: Race Condition with Concurrent Requests

**Symptoms**: Very rare duplicates (1 in 1000) when requests arrive simultaneously

**Explanation**: Two requests with same UUID arrive at exact same microsecond, both check idempotency key, both see "not exists", both create booking.

**Solution**: Database-level uniqueness constraint (should already exist from Chunk 001):

```sql
-- Verify constraint exists
\d idempotency_keys

-- Should show:
-- Indexes:
--     "idempotency_keys_pkey" PRIMARY KEY, btree (key)

-- Add if missing:
ALTER TABLE idempotency_keys
ADD CONSTRAINT idempotency_keys_pkey PRIMARY KEY (key);
```

This ensures duplicate `key` inserts fail atomically.

---

## Issue 4: Cron Jobs Not Executing

### Symptoms

- No cron execution logs in Cloudflare dashboard
- `wrangler tail` shows no `[CRON]` messages
- Idempotency keys not being cleaned up

### Possible Causes & Solutions

#### Cause 4A: Cron Triggers Not Configured

**Check wrangler.toml:**

```bash
grep -A 5 "\[triggers\]" wrangler.toml
```

**Expected:**

```toml
[triggers]
crons = [
  "0 2 * * *",
  "0 3 * * 0"
]
```

**Solution if missing:**

```toml
# Add to wrangler.toml
[triggers]
crons = [
  "0 2 * * *",   # Daily 2 AM UTC
  "0 3 * * 0"    # Sunday 3 AM UTC
]

# Redeploy
wrangler deploy
```

#### Cause 4B: Invalid Cron Syntax

**Common mistakes:**

- `0 2 * * *` ✅ Correct (no quotes in array)
- `"0 2 * * *"` ✅ Also correct (quotes OK)
- `0 2 * * * *` ❌ Wrong (6 fields, should be 5)
- `@daily` ❌ Wrong (Cloudflare uses standard cron syntax, not shortcuts)

**Validation:**

```bash
# Validate TOML syntax
wrangler whoami
# If errors, check cron syntax
```

**Solution**: Use standard 5-field cron syntax (minute hour day month weekday)

#### Cause 4C: Worker Not Deployed with Cron Handler

**Check `_worker.ts` has scheduled handler:**

```typescript
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Should have switch statement routing to cleanup functions
    switch (event.cron) {
      case "0 2 * * *":
        await cleanupIdempotency(env);
        break;
      // ...
    }
  },
};
```

**Solution**: Add scheduled handler (see instructions.md Step 6.1)

#### Cause 4D: Waiting for First Execution

**Explanation**: Cron triggers run at scheduled time, not immediately after deployment.

**Example**: Deployed at 10:00 AM UTC, daily cron (2 AM UTC) won't run until next day at 2 AM.

**Solution**: Manually trigger cron to test immediately:

1. Cloudflare dashboard: **Workers & Pages** > **Your Worker** > **Triggers**
2. Find cron trigger, click **"Run Cron Trigger"** button
3. Check logs for execution

**OR** use `wrangler dev` with manual trigger:

```bash
wrangler dev

# In another terminal:
curl -X POST http://localhost:8787/__scheduled \
  -H "Content-Type: application/json" \
  -d '{"cron": "0 2 * * *"}'
```

---

## Issue 5: High Cleanup Volume Alerts

### Symptoms

- Cron logs show: `[ALERT] High idempotency key cleanup: 1500 keys deleted`
- OR: `[ALERT] High payment proof cleanup: 75 files deleted`
- Normal operations affected

### Possible Causes & Solutions

#### Cause 5A: Cron Missed Several Executions

**Check Cloudflare dashboard:** Workers > Metrics > Cron Triggers

- Look for failed executions or gaps

**Explanation**: If daily cleanup missed 3 days, 3 days of keys cleaned at once (3x normal volume)

**Solution**: This is expected behavior - cleanup catches up. Monitor for:

- Continued high volume (indicates ongoing issue)
- Single spike (normal catch-up)

#### Cause 5B: Unusual Booking Volume

**Check booking creation rate:**

```sql
SELECT DATE(created_at), COUNT(*) as bookings
FROM bookings
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY DATE(created_at) DESC;
```

**Expected**: ~10-50 bookings/day (adjust for your resort size)

**Alert if**: Sudden 10x spike (possible bot attack or marketing campaign)

**Solution**:

- If legitimate traffic: Increase alert threshold
- If bot attack: Investigate rate limiting effectiveness

#### Cause 5C: Duplicate Booking Attempts

**Check idempotency key collision rate:**

```sql
SELECT COUNT(*) as total_bookings,
       COUNT(DISTINCT idempotency_key) as unique_keys,
       COUNT(*) - COUNT(DISTINCT idempotency_key) as duplicates
FROM (
  SELECT booking_id, (SELECT key FROM idempotency_keys WHERE booking_id = bookings.booking_id) as idempotency_key
  FROM bookings
  WHERE created_at > NOW() - INTERVAL '7 days'
) subquery;
```

**Expected**: `duplicates` should be low (<5% of total)

**Alert if**: >20% duplicates (indicates UX issue causing excessive retries)

**Solution**: Investigate frontend UX for causes of duplicate submissions:

- Button disabled after click?
- Loading state shown?
- Network timeout handling?

---

## Issue 6: Excessive KV Storage Usage

### Symptoms

- Approaching 1 GB free tier limit
- Cloudflare dashboard shows warning
- Rate limiting slows down

### Possible Causes & Solutions

#### Cause 6A: Rate Limit Keys Not Expiring

**Check KV keys:**

```bash
wrangler kv:key list --namespace-id=<your-kv-id> --prefix=ratelimit:
```

**Expected**: ~100-500 keys (varies with traffic)

**Alert if**: >10,000 keys (TTL not working)

**Solution**: Verify TTL set on KV writes:

```typescript
await kv.put(key, value, {
  expirationTtl: 3600, // 1 hour in seconds
});
```

**Manual cleanup if needed:**

```bash
# List all keys
wrangler kv:key list --namespace-id=<your-kv-id> > keys.json

# Delete old keys (use script or manual)
# WARNING: This will reset all rate limits
wrangler kv:bulk delete --namespace-id=<your-kv-id> keys.json
```

---

## Issue 7: Frontend UUID Generation Not Working

### Symptoms

- Browser console error: `crypto.randomUUID is not a function`
- Idempotency keys are `undefined` in requests
- Works on localhost but fails in production

### Possible Causes & Solutions

#### Cause 7A: Insecure Context (HTTP not HTTPS)

**Explanation**: `crypto.randomUUID()` only works in secure contexts (HTTPS or localhost)

**Check**: Open site in browser, check URL bar:

- ✅ `https://your-domain.com` (secure)
- ✅ `http://localhost:5173` (localhost exception)
- ❌ `http://your-domain.com` (insecure)

**Solution**: Ensure production uses HTTPS (Cloudflare Pages default is HTTPS)

#### Cause 7B: Browser Compatibility

**Check browser support:** [caniuse.com/mdn-api_crypto_randomuuid](https://caniuse.com/mdn-api_crypto_randomuuid)

**Supported**: Chrome 92+, Firefox 95+, Safari 15.4+

**Solution for older browsers**: Fallback implementation:

```typescript
export function generateUUID(): string {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for older browsers
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
```

---

## Debugging Commands

### Check Entire System Health

```bash
# Run all checks at once
echo "=== Turnstile ===" && wrangler secret list | grep TURNSTILE_SECRET_KEY
echo "=== KV Namespace ===" && wrangler kv:namespace list
echo "=== Cron Triggers ===" && grep -A 5 "\[triggers\]" wrangler.toml
echo "=== PostgreSQL Functions ===" && psql $DATABASE_URL -c "SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name LIKE 'cleanup%'"
echo "=== Recent Deployments ===" && wrangler deployments list | head -5
```

### Live Tail Worker Logs

```bash
# All logs
wrangler tail

# Only errors
wrangler tail --format json | grep -i error

# Only cron logs
wrangler tail --format json | grep CRON

# Only rate limit logs
wrangler tail --format json | grep RATE_LIMIT
```

### Database Diagnostic Queries

```sql
-- Check idempotency key status
SELECT
  COUNT(*) as total_keys,
  COUNT(*) FILTER (WHERE expires_at > NOW()) as active_keys,
  COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired_keys,
  MIN(created_at) as oldest_key,
  MAX(created_at) as newest_key
FROM idempotency_keys;

-- Check for orphaned bookings (no idempotency key)
SELECT booking_id, created_at
FROM bookings
WHERE booking_id NOT IN (SELECT booking_id FROM idempotency_keys)
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

---

## Still Stuck?

### Escalation Path

1. **Re-read relevant documentation:**
   - `instructions.md` step that's failing
   - `checkpoint.md` verification commands
   - Source docs: `06-migration-guide.md` lines 936-1315 (cron workers)

2. **Check Cloudflare status:**
   - [status.cloudflare.com](https://www.cloudflare.com/application-services/products/status/) - Platform issues?
   - [community.cloudflare.com](https://community.cloudflare.com/) - Search for similar issues

3. **Verify prerequisites:**
   - Chunk 001 completed successfully? (idempotency_keys table exists)
   - Chunk 004 completed successfully? (API endpoints working)
   - Cloudflare account has Workers enabled?

4. **Enable verbose logging:**

```typescript
// Temporarily add to all functions
console.log("[DEBUG] Function called with:", JSON.stringify(arguments));
```

5. **Test in isolation:**
   - Create minimal test case reproducing issue
   - Test single component at a time
   - Use `wrangler dev` for local debugging

6. **Community Support:**
   - GitHub Issues: [anthropics/claude-code/issues](https://github.com/anthropics/claude-code/issues)
   - Stack Overflow: Tag `cloudflare-workers` + `idempotency`

### Contact Information

**For production issues:**

- Cloudflare Support: [support.cloudflare.com](https://support.cloudflare.com/)
- Supabase Support: [supabase.com/support](https://supabase.com/support)

**For this implementation:**

- Check project `CLAUDE.md` for team contacts
- Escalate to senior developer if chunk blocked >4 hours

---

**Remember**: Most issues are configuration-related. Double-check environment variables, wrangler.toml syntax, and deployment status before deep debugging.
