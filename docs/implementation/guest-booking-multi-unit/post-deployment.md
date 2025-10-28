# Post-Deployment Verification & Monitoring

**Last Updated**: 2025-01-27
**Chunks Covered**: 001-005 (Phase 1 complete)
**Recommended Review**: Weekly for first month, then monthly

---

## Overview

This document covers verification, monitoring, and ongoing maintenance after deploying the multi-unit guest booking system to production.

**Deployment Status**: Phase 1 backend infrastructure deployed
**Current Features**: Database schema, API endpoints, idempotency, rate limiting, automated cleanup

---

## Immediate Post-Deployment Verification (First 24 Hours)

### Step 1: API Endpoint Health Check

**Verify all endpoints are accessible and responding correctly**.

```bash
# Set your production URL
export PROD_URL="https://okaeri-resort-system.pages.dev"

# Test health endpoint
curl -I $PROD_URL/health
# Expected: HTTP/2 200

# Test rates endpoint
curl -s $PROD_URL/api/guest-booking/rates | jq '.base_rate_per_night'
# Expected: 2000

# Test discount rules endpoint
curl -s $PROD_URL/api/guest-booking/discount-rules | jq 'length'
# Expected: 4

# Test pricing preview
curl -X POST $PROD_URL/api/guest-booking/preview-pricing \
  -H "Content-Type: application/json" \
  -d '{
    "check_in": "2025-06-01",
    "check_out": "2025-06-08",
    "unit_requests": [{"guests_per_unit": 2}]
  }' | jq '.final_total'
# Expected: Numeric value (e.g., 13300)
```

**Status**: ⬜ All endpoints return expected data

---

### Step 2: Database Connection Verification

**Confirm Workers can connect to Supabase**:

```bash
# Check if database functions are accessible
psql $DATABASE_URL -c "
  SELECT
    routine_name,
    routine_type
  FROM information_schema.routines
  WHERE routine_schema = 'public'
    AND routine_name LIKE 'cleanup%'
  ORDER BY routine_name;
"
```

**Expected Output**:

```
           routine_name            | routine_type
-----------------------------------+--------------
 cleanup_expired_idempotency_keys | FUNCTION
 cleanup_expired_payment_proofs   | FUNCTION
(2 rows)
```

**Status**: ⬜ Database accessible from Workers

---

### Step 3: KV Namespace Accessibility

**Verify rate limiting is using KV storage**:

```bash
# Make 2 requests to same endpoint
curl -s -o /dev/null -w "%{http_code}" $PROD_URL/api/guest-booking/rates
# Expected: 200

curl -s -o /dev/null -w "%{http_code}" $PROD_URL/api/guest-booking/rates
# Expected: 200

# Check KV keys (via Wrangler)
npx wrangler kv:key list --namespace-id=YOUR_KV_ID --prefix=ratelimit
```

**Expected Output**:

```json
[
  {
    "name": "ratelimit:IP_ADDRESS:endpoint",
    "expiration": 1706371200
  }
]
```

**Status**: ⬜ KV namespace operational

---

### Step 4: Cron Triggers Registered

**Verify cron triggers are active in Cloudflare dashboard**:

1. Open Cloudflare dashboard
2. Navigate to: **Workers & Pages** > **okaeri-resort-system** > **Triggers**
3. Check **Cron Triggers** section

**Expected**:

- ✅ `0 2 * * *` (Daily idempotency cleanup)
- ✅ `0 3 * * 0` (Weekly payment proof cleanup)
- Status: "Active" for both

**Optional**: Manually trigger one cron to verify execution:

1. Click **"Run Cron Trigger"** next to `0 2 * * *`
2. Go to **Logs** tab
3. Look for: `[CRON] Starting scheduled task...`

**Status**: ⬜ Cron triggers active and executable

---

### Step 5: Audit Logging Verification

**Confirm audit trail is capturing database mutations**:

```bash
# Make a test mutation (e.g., update discount rule)
psql $DATABASE_URL -c "
  UPDATE discount_rules
  SET priority = 99
  WHERE rule_name = '7-Night Stay';
"

# Check audit logs
psql $DATABASE_URL -c "
  SELECT
    action,
    entity_type,
    entity_id,
    created_at
  FROM audit_logs
  WHERE action LIKE 'discount_rules%'
  ORDER BY created_at DESC
  LIMIT 5;
"
```

**Expected Output**:

```
        action         | entity_type |  entity_id  |         created_at
-----------------------+-------------+-------------+---------------------------
 discount_rules.update | discount_rules | uuid-here | 2025-01-27 15:23:45+00
```

**Status**: ⬜ Audit logging operational

---

### Step 6: Security Layers Verification

**Test each security layer**:

#### Rate Limiting Test

```bash
# Make 6 rapid requests (5th succeeds, 6th blocked)
for i in {1..6}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST $PROD_URL/api/guest-booking/preview-pricing \
    -H "Content-Type: application/json" \
    -d '{"check_in": "2025-06-01", "check_out": "2025-06-02", "unit_requests": [{"guests_per_unit": 2}]}')
  echo "Request $i: $STATUS"
  sleep 1
done
# Expected: Last request returns 429
```

#### Turnstile Verification Test

```bash
# Invalid token should be rejected
curl -X POST $PROD_URL/api/guest-booking/multi-unit \
  -H "Content-Type: application/json" \
  -d '{"turnstile_token": "invalid"}' | jq '.error'
# Expected: "CAPTCHA verification failed" or similar
```

**Status**: ⬜ Rate limiting and Turnstile working

---

## Monitoring Setup (Ongoing)

### Cloudflare Worker Metrics

**Set up Worker analytics tracking**:

1. Open Cloudflare dashboard
2. Navigate to: **Workers & Pages** > **okaeri-resort-system** > **Metrics**
3. Monitor:
   - **Requests/minute**: Should be < 100 for typical resort traffic
   - **Error rate**: Should be < 5%
   - **CPU time**: Should be < 10ms per request
   - **Duration**: Average response time < 200ms

**Recommended Alerts**:

- Error rate > 5% → Investigate immediately
- CPU time > 50ms → Optimize slow functions
- Requests suddenly spike → Possible bot attack

---

### Database Performance Monitoring

**Weekly query performance check**:

```bash
# Check slow queries
psql $DATABASE_URL -c "
  SELECT
    query,
    calls,
    total_time,
    mean_time,
    max_time
  FROM pg_stat_statements
  WHERE mean_time > 100  -- Queries averaging >100ms
  ORDER BY mean_time DESC
  LIMIT 10;
"
```

**Recommended Alerts**:

- Cleanup functions taking >5 seconds
- Pricing function calls >500ms average
- Connection pool exhaustion (check Supabase dashboard)

---

### KV Storage Usage Tracking

**Monthly KV storage audit**:

```bash
# Check total keys in rate limit namespace
npx wrangler kv:key list --namespace-id=YOUR_KV_ID | jq 'length'

# Check oldest keys (should auto-expire)
npx wrangler kv:key list --namespace-id=YOUR_KV_ID --prefix=ratelimit | jq '.[0]'
```

**Recommended Alerts**:

- Total keys > 1000 → Rate limiting may not be expiring correctly
- KV storage > 500MB → Investigate unusual data growth

---

### Cron Execution Logs

**Weekly cron health check**:

```bash
# Tail cron logs (requires Wrangler)
npx wrangler pages deployment tail --env production | grep CRON
```

**Expected Output** (daily):

```
[CRON] Starting scheduled task: 0 2 * * *
[CRON] Idempotency cleanup completed: 12 expired keys removed
[CRON] Completed: 0 2 * * *
```

**Expected Output** (weekly):

```
[CRON] Starting scheduled task: 0 3 * * 0
[STORAGE] Deleting 3 files from Supabase Storage...
[STORAGE] Successfully deleted 3 files from storage
[CRON] Payment proof cleanup completed: 3 files deleted, 6.00 MB freed
[CRON] Completed: 0 3 * * 0
```

**Recommended Alerts**:

- Cron fails 2 consecutive executions → Investigate ASAP
- Idempotency cleanup >1000 keys/day → Possible double-booking attack
- Payment proof cleanup >50 files/week → Unusual cancellation volume

---

## Alert Thresholds & Actions

### Critical Alerts (Immediate Action Required)

| Metric                       | Threshold              | Action                                           |
| ---------------------------- | ---------------------- | ------------------------------------------------ |
| Worker error rate            | >10%                   | Check logs, rollback if needed                   |
| Database connection failures | >5%                    | Check Supabase status, verify service role key   |
| Cron execution failure       | 2 consecutive failures | Manually run cleanup functions, check secrets    |
| Rate limit bypass            | >100 requests/IP/hour  | Investigate potential attack, block IP if needed |

### Warning Alerts (Investigate Within 24 Hours)

| Metric                | Threshold      | Action                                       |
| --------------------- | -------------- | -------------------------------------------- |
| Idempotency cleanup   | >1000 keys/day | Review booking patterns, check for bots      |
| Payment proof cleanup | >50 files/week | Investigate cancellation spike, contact team |
| KV storage usage      | >500MB         | Audit KV keys, verify expiration working     |
| Worker CPU time       | >50ms average  | Profile slow endpoints, optimize queries     |

### Informational (Monthly Review)

| Metric             | Threshold   | Action                                         |
| ------------------ | ----------- | ---------------------------------------------- |
| Database size      | >300MB      | Plan for Supabase upgrade if approaching 500MB |
| Total API requests | >50,000/day | Consider Cloudflare plan upgrade for analytics |
| Audit log size     | >100MB      | Implement archival strategy                    |

---

## Ongoing Maintenance Tasks

### Daily (Automated via Cron)

- ✅ Cleanup expired idempotency keys (2 AM UTC)
- ✅ Monitor cron execution logs

### Weekly

- [ ] Review cron execution logs for errors
- [ ] Check KV storage usage via dashboard
- [ ] Review Worker metrics (requests, errors, latency)
- [ ] Verify payment proof cleanup ran successfully (Sunday 3 AM UTC)
- [ ] Audit rate limiting patterns (blocked IPs)

### Monthly

- [ ] Review database query performance
- [ ] Analyze booking patterns (peak times, discount usage)
- [ ] Check Supabase storage usage (database + files)
- [ ] Review audit logs for suspicious activity
- [ ] Update discount rules based on business needs
- [ ] Verify pricing configuration still accurate

### Quarterly

- [ ] Full security audit (RLS policies, API permissions)
- [ ] Load testing (simulate peak booking traffic)
- [ ] Review and update monitoring thresholds
- [ ] Backup database and store long-term archive
- [ ] Review free tier usage across all services
- [ ] Plan for infrastructure upgrades if needed

---

## Health Check Automation

### Create Weekly Health Check Script

**Save as `scripts/health-check.sh`**:

```bash
#!/bin/bash
# Weekly health check for Okaeri Resort System
# Run: npm run health-check

PROD_URL="https://okaeri-resort-system.pages.dev"
DATABASE_URL="postgresql://postgres:..."

echo "=== Okaeri Resort System Health Check ==="
echo "Date: $(date)"
echo

# Test API endpoints
echo "1. Testing API endpoints..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $PROD_URL/health)
if [ "$STATUS" = "200" ]; then
  echo "  ✅ Health endpoint: OK"
else
  echo "  ❌ Health endpoint: FAIL ($STATUS)"
fi

STATUS=$(curl -s -o /dev/null -w "%{http_code}" $PROD_URL/api/guest-booking/rates)
if [ "$STATUS" = "200" ]; then
  echo "  ✅ Rates endpoint: OK"
else
  echo "  ❌ Rates endpoint: FAIL ($STATUS)"
fi

# Check database functions
echo
echo "2. Testing database functions..."
RESULT=$(psql $DATABASE_URL -t -c "SELECT cleanup_expired_idempotency_keys();" 2>&1)
if [ $? -eq 0 ]; then
  echo "  ✅ Idempotency cleanup: OK (deleted $RESULT keys)"
else
  echo "  ❌ Idempotency cleanup: FAIL"
fi

# Check cron execution
echo
echo "3. Checking cron execution logs..."
echo "  (Run: npx wrangler pages deployment tail | grep CRON)"

# Check KV usage
echo
echo "4. KV Namespace usage..."
KV_KEYS=$(npx wrangler kv:key list --namespace-id=YOUR_KV_ID 2>&1 | jq 'length' 2>/dev/null || echo "0")
echo "  Total KV keys: $KV_KEYS"
if [ "$KV_KEYS" -lt 1000 ]; then
  echo "  ✅ KV usage normal"
else
  echo "  ⚠️  KV usage high (>1000 keys)"
fi

echo
echo "=== Health Check Complete ==="
```

**Add to package.json**:

```json
{
  "scripts": {
    "health-check": "bash scripts/health-check.sh"
  }
}
```

---

## Troubleshooting Production Issues

### Issue: High Error Rate (>5%)

**Diagnosis**:

```bash
# Check Worker logs
npx wrangler pages deployment tail --env production | grep ERROR

# Check database connection errors
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity WHERE state = 'idle in transaction';"
```

**Common Causes**:

1. Database connection pool exhausted
2. Supabase service role key expired/invalid
3. Turnstile secret key misconfigured
4. Rate limiting too aggressive

**Solution**:

```bash
# Verify secrets are set
npx wrangler secret list --env production

# Check Supabase status
curl https://status.supabase.com/api/v2/status.json
```

---

### Issue: Cron Not Executing

**Diagnosis**:

```bash
# Check cron configuration
grep -A 5 "\[triggers\]" wrangler.toml

# Check Worker logs for cron attempts
npx wrangler pages deployment tail | grep -i cron
```

**Common Causes**:

1. `_worker.ts` doesn't export `scheduled()` function
2. Cron triggers not deployed (need to re-deploy Workers)
3. Supabase credentials missing/invalid in secrets

**Solution**:

```bash
# Verify _worker.ts exports scheduled
grep "export default" functions/_worker.ts

# Re-deploy Workers
npm run build:full && npx wrangler pages deploy dist --env production

# Manually trigger cron to test
# (via Cloudflare dashboard > Triggers > Run Cron Trigger)
```

---

### Issue: Rate Limiting Not Working

**Diagnosis**:

```bash
# Make 10 rapid requests, should get 429 after 5th
for i in {1..10}; do
  curl -s -o /dev/null -w "Request $i: %{http_code}\n" \
    $PROD_URL/api/guest-booking/rates
done
```

**Common Causes**:

1. KV namespace not bound to Worker
2. Wrong KV namespace ID in wrangler.toml
3. Rate limit middleware not applied

**Solution**:

```bash
# Verify KV binding in dashboard
# Workers & Pages > Settings > Bindings > KV Namespace Bindings

# Check wrangler.toml has correct ID
npx wrangler kv:namespace list

# Verify middleware applies rate limits
grep -r "checkRateLimit" functions/_middleware.ts
```

---

### Issue: Database Functions Failing

**Diagnosis**:

```bash
# Test functions directly
psql $DATABASE_URL -c "SELECT cleanup_expired_idempotency_keys();"
psql $DATABASE_URL -c "SELECT cleanup_expired_payment_proofs();"

# Check function definitions
psql $DATABASE_URL -c "
  SELECT routine_name, routine_definition
  FROM information_schema.routines
  WHERE routine_name LIKE 'cleanup%';
"
```

**Common Causes**:

1. Schema mismatch (column names changed)
2. Missing indexes (slow queries timeout)
3. Permissions issue (service role can't execute functions)

**Solution**:

```bash
# Re-run migration 023 to fix function definitions
psql $DATABASE_URL -f database/migrations/023-cleanup-functions.sql

# Verify indexes exist
psql $DATABASE_URL -c "SELECT indexname FROM pg_indexes WHERE tablename = 'idempotency_keys';"
```

---

## Performance Optimization Tips

### Optimize Database Queries

**If pricing preview is slow (>500ms)**:

```bash
# Add index on commonly queried columns
psql $DATABASE_URL -c "
  CREATE INDEX IF NOT EXISTS idx_pricing_config_active
    ON pricing_config(id)
    WHERE id = 1;  -- Singleton table optimization
"

# Analyze query plan
psql $DATABASE_URL -c "
  EXPLAIN ANALYZE
  SELECT * FROM calculate_booking_pricing(
    '2025-06-01'::date,
    '2025-06-08'::date,
    '[{\"guests_per_unit\": 2}]'::jsonb
  );
"
```

### Optimize KV Storage

**If KV usage is growing unexpectedly**:

```bash
# Audit all keys with prefix
npx wrangler kv:key list --namespace-id=YOUR_KV_ID --prefix=ratelimit

# Delete old keys manually (if cleanup not working)
npx wrangler kv:key delete "ratelimit:OLD_KEY" --namespace-id=YOUR_KV_ID
```

### Optimize Worker CPU Time

**If CPU time >50ms**:

1. **Profile slow endpoints**: Check Worker logs for timing
2. **Cache pricing config**: Store in KV for 1 hour
3. **Batch database queries**: Reduce round trips
4. **Use database functions**: Let PostgreSQL do the heavy lifting

---

## Disaster Recovery

### Full System Failure

**If entire system is down**:

1. **Check Cloudflare status**: https://www.cloudflarestatus.com
2. **Check Supabase status**: https://status.supabase.com
3. **Verify DNS**: Ensure domain points to Cloudflare Pages
4. **Rollback deployment**: Use previous deployment ID
   ```bash
   npx wrangler pages deployment rollback PREVIOUS_ID
   ```

### Database Corruption

**If database has inconsistent data**:

1. **Stop accepting new bookings** (disable Workers)
2. **Restore from latest backup**:
   ```bash
   psql $DATABASE_URL < backup-YYYYMMDD-HHMMSS.sql
   ```
3. **Re-run migrations** 021, 022, 022a, 023
4. **Verify data integrity**:
   ```bash
   psql $DATABASE_URL -f database/tests/verify-data-integrity.sql
   ```

### Lost Secrets

**If Wrangler secrets are deleted**:

1. **Re-set all secrets**:
   ```bash
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production
   npx wrangler secret put TURNSTILE_SECRET_KEY --env production
   npx wrangler secret put RESEND_API_KEY --env production
   ```
2. **Verify secrets**:
   ```bash
   npx wrangler secret list --env production
   ```
3. **Test endpoints** to confirm secrets work

---

## Next Steps

### When to Upgrade Infrastructure

**Consider upgrading when**:

- Database size >400MB (approaching 500MB free tier limit)
- Worker requests >80,000/day (approaching 100k free tier limit)
- KV storage >800MB (approaching 1GB free tier limit)
- Need more than 3 cron triggers
- Require faster database query performance

### Recommended Upgrades (in order of priority)

1. **Supabase Pro** ($25/month) - If database >400MB
   - 8GB database storage
   - Point-in-time recovery
   - Daily backups

2. **Cloudflare Workers Paid** ($5/month) - If workers >80k requests/day
   - 10M requests/month
   - Unlimited cron triggers
   - Advanced analytics

3. **Resend Team Plan** ($20/month) - If sending >3000 emails/month
   - 10,000 emails/month
   - Custom domain email

---

## Deployment Status

**Phase 1 (Chunks 001-005)**: ✅ **DEPLOYED**

- Database schema complete
- API endpoints operational
- Security layers active
- Automated cleanup running

**Phase 2 (Chunks 006-010)**: ⏸️ **PENDING**

- Frontend components (coming soon)
- Booking flow UI
- Admin assignment workflow

**Phase 3 (Chunks 011-017)**: ⏸️ **PLANNED**

- Advanced features
- E2E testing
- Performance optimization

---

**Document Status**: Living document, updated with each chunk completion
**Current Coverage**: Chunks 001-005 (Phase 1 complete)
**Next Update**: Chunk 006 will add frontend monitoring guidance
