# Checkpoint: Idempotency and Rate Limiting Verification

**Purpose**: Verify that duplicate prevention, bot protection, and automated cleanup systems are working correctly.

**Estimated Time**: 15-20 minutes

---

## Automated Checks

Run these commands to verify implementation. All checks must pass before proceeding.

### Check 1: Turnstile Configuration

**Verify Turnstile secret is set in Cloudflare Workers:**

```bash
wrangler secret list | grep TURNSTILE_SECRET_KEY
```

**Expected Output:**

```
TURNSTILE_SECRET_KEY
```

**Status**: ⬜ Pass / ⬜ Fail

**If Fails**: Secret not configured. Run:

```bash
wrangler secret put TURNSTILE_SECRET_KEY
# Paste your secret key when prompted
```

---

### Check 2: KV Namespace Exists

**Verify KV namespace for rate limiting:**

```bash
wrangler kv:namespace list
```

**Expected Output:**

```json
[
  {
    "id": "abc123...",
    "title": "okaeri-resort-RATE_LIMIT"
  }
]
```

**Status**: ⬜ Pass / ⬜ Fail

**If Fails**: KV namespace not created. Run:

```bash
wrangler kv:namespace create "RATE_LIMIT"
wrangler kv:namespace create "RATE_LIMIT" --preview
# Update wrangler.toml with returned IDs
```

---

### Check 3: Cron Triggers Configured

**Verify cron triggers in wrangler.toml:**

```bash
grep -A 5 "\[triggers\]" wrangler.toml
```

**Expected Output:**

```toml
[triggers]
crons = [
  "0 2 * * *",   # Daily: Idempotency cleanup
  "0 3 * * 0"    # Weekly: Payment proof cleanup
]
```

**Status**: ⬜ Pass / ⬜ Fail

**If Fails**: Add cron configuration to `wrangler.toml` (see instructions.md Step 6.2)

---

### Check 4: PostgreSQL Cleanup Functions Exist

**Verify cleanup functions are deployed:**

```bash
psql $DATABASE_URL -c "
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('cleanup_expired_idempotency_keys', 'cleanup_expired_payment_proofs')
ORDER BY routine_name;
"
```

**Expected Output:**

```
           routine_name
-----------------------------------
 cleanup_expired_idempotency_keys
 cleanup_expired_payment_proofs
(2 rows)
```

**Status**: ⬜ Pass / ⬜ Fail

**If Fails**: Functions not created. Run SQL from instructions.md Step 5.1

---

### Check 5: Idempotency Prevents Duplicates

**Test duplicate booking prevention:**

```bash
# Generate UUID for test
TEST_KEY=$(uuidgen)

# First request (creates booking)
RESPONSE1=$(curl -s -X POST http://localhost:8787/api/guest-booking \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $TEST_KEY" \
  -d '{
    "guest_name": "Test User",
    "email": "test@example.com",
    "phone_number": "+1234567890",
    "check_in": "2025-06-01T14:00:00Z",
    "check_out": "2025-06-08T11:00:00Z",
    "unit_requests": [{"guests_per_unit": 2}],
    "turnstile_token": "1x0000000000000000000000000000000AA",
    "terms_accepted": true
  }')

# Extract booking ID
BOOKING_ID_1=$(echo "$RESPONSE1" | jq -r '.booking.booking_id')

# Second request with SAME key (should return existing)
RESPONSE2=$(curl -s -X POST http://localhost:8787/api/guest-booking \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $TEST_KEY" \
  -d '{
    "guest_name": "Different Name",
    "email": "different@example.com",
    "unit_requests": [{"guests_per_unit": 5}]
  }')

BOOKING_ID_2=$(echo "$RESPONSE2" | jq -r '.booking.booking_id')

# Compare IDs
if [ "$BOOKING_ID_1" == "$BOOKING_ID_2" ]; then
  echo "✅ PASS: Same booking returned ($BOOKING_ID_1)"
else
  echo "❌ FAIL: Different bookings created"
fi
```

**Expected Output:**

```
✅ PASS: Same booking returned (550e8400-e29b-41d4-a716-446655440000)
```

**Status**: ⬜ Pass / ⬜ Fail

**If Fails**: Check:

1. `create_guest_booking()` function includes idempotency logic (from Chunk 001)
2. `idempotency_keys` table exists
3. API endpoint passes `idempotency_key` to PostgreSQL function

---

### Check 6: Rate Limiting Blocks Excessive Requests

**Test rate limit enforcement (5 requests/hour):**

```bash
# Make 6 rapid requests (5th should succeed, 6th should fail)
for i in {1..6}; do
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:8787/api/guest-booking \
    -H "Content-Type: application/json" \
    -d '{"test": "rate_limit"}')

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | head -n1)

  if [ "$i" -le 5 ]; then
    echo "Request $i: HTTP $HTTP_CODE (should be 200-403)"
  else
    if [ "$HTTP_CODE" == "429" ]; then
      echo "✅ Request $i: HTTP $HTTP_CODE - Rate limit working"
    else
      echo "❌ Request $i: HTTP $HTTP_CODE - Rate limit NOT enforced"
    fi
  fi
done
```

**Expected Output:**

```
Request 1: HTTP 403 (or other code)
Request 2: HTTP 403
Request 3: HTTP 403
Request 4: HTTP 403
Request 5: HTTP 403
✅ Request 6: HTTP 429 - Rate limit working
```

**Status**: ⬜ Pass / ⬜ Fail

**If Fails**: Check:

1. `checkRateLimit()` called in API endpoint
2. KV namespace bound in `wrangler.toml`
3. Environment variable `RATE_LIMIT` accessible in Worker

---

### Check 7: Turnstile Verification Rejects Invalid Tokens

**Test Turnstile token validation:**

```bash
# Request with invalid token (should fail)
curl -s -X POST http://localhost:8787/api/guest-booking \
  -H "Content-Type: application/json" \
  -d '{
    "guest_name": "Test",
    "turnstile_token": "invalid_token_12345"
  }' | jq '.error'
```

**Expected Output:**

```json
"CAPTCHA verification failed"
```

**Status**: ⬜ Pass / ⬜ Fail

**If Fails**: Check:

1. `verifyTurnstile()` function exists in `functions/lib/verify-turnstile.ts`
2. API endpoint calls `verifyTurnstile()` before processing
3. `TURNSTILE_SECRET_KEY` environment variable set

---

### Check 8: Workers Deployed Successfully

**Verify latest deployment includes cron workers:**

```bash
wrangler deployments list
```

**Expected Output:**

```
Created:     2025-01-24 12:34:56
Modified:    2025-01-24 12:34:56
Source:      Upload
```

**Status**: ⬜ Pass / ⬜ Fail

**If Fails**: Deploy Workers:

```bash
wrangler deploy
```

---

## Manual Checks

Perform these visual/behavioral verifications.

### Manual Check 1: Cloudflare Dashboard Shows Cron Triggers

**Steps:**

1. Open Cloudflare dashboard
2. Navigate to: **Workers & Pages** > **Your Worker** > **Triggers**
3. Scroll to **Cron Triggers** section

**Expected:**

- ✅ 2 cron triggers listed:
  - `0 2 * * *` (Daily at 2 AM UTC)
  - `0 3 * * 0` (Weekly Sunday at 3 AM UTC)
- ✅ Triggers show "Active" status

**Status**: ⬜ Pass / ⬜ Fail / ⬜ In Progress (waiting for first execution)

**If Fails**: Check `wrangler.toml` has correct `[triggers]` section

---

### Manual Check 2: KV Namespace Bound to Worker

**Steps:**

1. Cloudflare dashboard: **Workers & Pages** > **Your Worker** > **Settings** > **Bindings**
2. Look for **KV Namespace Bindings** section

**Expected:**

- ✅ Binding name: `RATE_LIMIT`
- ✅ KV Namespace ID matches `wrangler.toml`
- ✅ Preview namespace also bound

**Status**: ⬜ Pass / ⬜ Fail

**If Fails**: Add KV binding in `wrangler.toml` (instructions.md Step 2.2)

---

### Manual Check 3: Idempotency Keys Have TTL Index

**Steps:**

1. Run SQL query to check index:

```bash
psql $DATABASE_URL -c "
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'idempotency_keys'
  AND indexname = 'idx_idempotency_expiry';
"
```

**Expected Output:**

```
        indexname         |                           indexdef
--------------------------+---------------------------------------------------------------
 idx_idempotency_expiry   | CREATE INDEX idx_idempotency_expiry ON public.idempotency_keys USING btree (expires_at)
```

**Status**: ⬜ Pass / ⬜ Fail

**If Fails**: Index missing from Chunk 001 migration. Add manually:

```sql
CREATE INDEX idx_idempotency_expiry ON idempotency_keys(expires_at);
```

---

### Manual Check 4: Cron Execution Logs Appear

**Steps:**

1. Run `wrangler tail --format json | grep CRON`
2. Wait for next scheduled execution (may need to wait up to 24 hours)

**OR** manually trigger cron:

1. Cloudflare dashboard: **Workers & Pages** > **Your Worker** > **Triggers**
2. Click **"Run Cron Trigger"** button next to `0 2 * * *`
3. Check **Logs** tab for output

**Expected Log Output:**

```json
{
  "message": "[CRON] Starting scheduled task: 0 2 * * *",
  "level": "log"
}
{
  "message": "[CRON] Idempotency cleanup: 42 expired keys removed",
  "level": "log"
}
{
  "message": "[CRON] Completed: 0 2 * * *",
  "level": "log"
}
```

**Status**: ⬜ Pass / ⬜ Fail / ⬜ In Progress (waiting for execution)

**If Fails**: See troubleshooting.md "Cron not executing"

---

## Success Criteria

All of the following must be true to consider this chunk complete:

### Core Functionality

- ✅ Duplicate booking with same idempotency key returns existing booking (Check 5)
- ✅ 6th request within hour blocked with HTTP 429 (Check 6)
- ✅ Invalid Turnstile token rejected with CAPTCHA error (Check 7)

### Configuration

- ✅ Turnstile secret configured in Workers (Check 1)
- ✅ KV namespace exists and bound (Check 2, Manual Check 2)
- ✅ Cron triggers configured in wrangler.toml (Check 3)

### Database

- ✅ PostgreSQL cleanup functions deployed (Check 4)
- ✅ Idempotency keys table has TTL index (Manual Check 3)

### Deployment

- ✅ Workers deployed successfully (Check 8)
- ✅ Cron triggers visible in Cloudflare dashboard (Manual Check 1)

### Operational

- ✅ Cron execution logs appear (Manual Check 4) - _Optional: Can verify after 24 hours_

---

## If Any Check Fails

### Step 1: Identify the Failing Check

Note which check(s) failed above and proceed to the relevant troubleshooting section in `troubleshooting.md`.

### Step 2: Common Quick Fixes

**Most common issues:**

1. **Turnstile verification failing** → Check secret key:

```bash
wrangler secret list | grep TURNSTILE_SECRET_KEY
# If missing: wrangler secret put TURNSTILE_SECRET_KEY
```

2. **Rate limit not enforcing** → Check KV binding:

```bash
grep -A 3 "kv_namespaces" wrangler.toml
# Should show RATE_LIMIT binding with ID
```

3. **Idempotency not preventing duplicates** → Check PostgreSQL function:

```bash
psql $DATABASE_URL -c "SELECT * FROM create_guest_booking('{}'::jsonb, '{}'::jsonb, '[]'::jsonb, gen_random_uuid());"
# Should execute without errors
```

4. **Cron not executing** → Check wrangler.toml syntax:

```bash
wrangler whoami
# Validates TOML syntax
```

### Step 3: Full Troubleshooting

If quick fixes don't resolve the issue, see `troubleshooting.md` for:

- Detailed error symptom → solution mappings
- Debugging commands
- Log analysis guides
- Escalation procedures

---

## When All Checks Pass

### Next Steps

1. **Record Results**:

**Checkpoint Status**: ⬜ All Checks Passed ⬜ Some Checks Failed

**Time Taken**: **\_\_** minutes (target: <20 minutes)

**Issues Encountered**:

- [ ] None
- [ ] \***\*\*\*\*\***\*\*\***\*\*\*\*\***\_\_\***\*\*\*\*\***\*\*\***\*\*\*\*\*** (resolved)

**Notes**:

```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

2. **Commit Changes**:

```bash
# Stage all files
git add functions/ wrangler.toml src/lib/api/ database/

# Commit with descriptive message
git commit -m "feat: complete chunk 005-idempotency-rate-limiting

Implemented:
- Turnstile CAPTCHA verification for bot protection
- KV-based rate limiting (5 requests/hour per IP)
- Idempotency system with client-generated UUIDs
- Daily cron (2 AM UTC) for idempotency key cleanup
- Weekly cron (Sun 3 AM UTC) for payment proof cleanup

All automated checks passed.
Phase 1 backend infrastructure complete (chunks 001-005).

Ref: CHUNKING-STRATEGY.md chunk 005"

# Tag milestone
git tag chunk-005
git push origin main --tags
```

3. **Update Progress Tracker**:

```bash
# Mark chunk 005 as complete in project tracking
# (Update your project management tool or spreadsheet)
```

4. **Proceed to Next Chunk**:

**Next**: Chunk 006 - Date and Unit Selection UI
**Phase**: Phase 2: Guest Booking Flow
**Prerequisites**: ✅ All of Phase 1 complete (chunks 001-005)

---

## Monitoring Recommendations

After passing all checks, set up ongoing monitoring:

### Cloudflare Dashboard Alerts

1. **Worker Errors**:
   - Navigate to: **Workers & Pages** > **Your Worker** > **Metrics**
   - Set alert: Error rate > 5%

2. **Cron Failures**:
   - Navigate to: **Workers & Pages** > **Your Worker** > **Triggers**
   - Enable notifications for failed cron executions

### Database Monitoring

```sql
-- Add to your monitoring queries (run weekly)
SELECT
  COUNT(*) as total_idempotency_keys,
  COUNT(*) FILTER (WHERE expires_at < NOW()) as expired_keys,
  MIN(created_at) as oldest_key
FROM idempotency_keys;

-- Alert if:
-- - total_idempotency_keys > 10,000 (cleanup not working)
-- - expired_keys > 1,000 (cleanup delayed)
```

### Rate Limit Monitoring

```bash
# View rate limit KV entries (weekly audit)
wrangler kv:key list --namespace-id=<your-kv-id> --prefix=ratelimit:

# Alert if:
# - >100 unique IPs rate limited per day (possible attack)
# - Same IP rate limited repeatedly (investigate bot)
```

---

**Chunk 005 Complete!** ✅

You now have a production-ready backend with duplicate prevention, bot protection, and automated cleanup. Ready to build the guest-facing UI in Phase 2.
