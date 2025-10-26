# Chunk 017: Deployment and Monitoring - Troubleshooting

## Common Issues by Deployment Phase

This guide provides solutions to common problems encountered during deployment and monitoring setup, organized by implementation phase.

---

## Phase 1: Database Migration Issues

### Issue 1.1: Migration Script Fails with "table already exists"

**Symptom**:

```
ERROR: relation "pricing_config" already exists
```

**Cause**: Migration was partially executed previously or pricing_config table already exists from testing.

**Solution**:

```bash
# Check if tables exist
psql $PRODUCTION_DB_URL -c "\dt pricing_config guest_booking_unit_requests discount_rules idempotency_keys"

# If pricing_config exists but is empty
psql $PRODUCTION_DB_URL -c "SELECT COUNT(*) FROM pricing_config;"

# If count = 0, the migration INSERT will fail due to ON CONFLICT DO NOTHING
# Manually insert default row:
psql $PRODUCTION_DB_URL <<EOF
INSERT INTO pricing_config (
  id, base_rate, weekend_rate, extra_person_rate,
  base_occupancy, max_capacity_per_unit
) VALUES (
  'default', 3000.00, 3500.00, 500.00, 2, 20
) ON CONFLICT (id) DO UPDATE SET
  base_rate = EXCLUDED.base_rate,
  weekend_rate = EXCLUDED.weekend_rate,
  extra_person_rate = EXCLUDED.extra_person_rate,
  max_capacity_per_unit = EXCLUDED.max_capacity_per_unit;
EOF
```

**Prevention**: Always validate staging migration before production. Use `CREATE TABLE IF NOT EXISTS` patterns.

---

### Issue 1.2: Pricing Function Returns NULL

**Symptom**:

```sql
SELECT calculate_booking_pricing(...) AS pricing;
-- Result: NULL
```

**Cause**: `pricing_config` table has no rows or function cannot find `id='default'`.

**Solution**:

```bash
# Verify pricing_config row exists
psql $PRODUCTION_DB_URL -c "SELECT * FROM pricing_config WHERE id = 'default';"

# If no rows returned, insert default configuration
psql $PRODUCTION_DB_URL <<EOF
INSERT INTO pricing_config (id, base_rate, weekend_rate, extra_person_rate, base_occupancy, max_capacity_per_unit)
VALUES ('default', 3000.00, 3500.00, 500.00, 2, 20);
EOF

# Test function again
psql $PRODUCTION_DB_URL -c "SELECT calculate_booking_pricing('[{\"guests_per_unit\": 2}]'::JSONB, CURRENT_DATE, CURRENT_DATE + 1) AS test;"
```

---

### Issue 1.3: Constraint Violation During Migration

**Symptom**:

```
ERROR: check constraint "payment_before_assignment" is violated by some row
```

**Cause**: Existing booking data violates new constraint (e.g., unit assigned but payment not verified).

**Solution**:

```bash
# Find violating rows
psql $PRODUCTION_DB_URL <<EOF
SELECT booking_id, booking_reference, unit_assignment_status, payment_status
FROM bookings
WHERE unit_assignment_status = 'assigned'
  AND payment_status NOT IN ('Verified', 'Completed');
EOF

# Option 1: Fix data manually (update payment_status)
psql $PRODUCTION_DB_URL -c "UPDATE bookings SET payment_status = 'Verified' WHERE booking_id IN ('...');"

# Option 2: Temporarily disable constraint, fix data, re-enable
psql $PRODUCTION_DB_URL <<EOF
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS payment_before_assignment;
-- Fix data here
ALTER TABLE bookings ADD CONSTRAINT payment_before_assignment CHECK (
  unit_assignment_status != 'assigned' OR payment_status IN ('Verified', 'Completed')
);
EOF
```

**Prevention**: Audit data before migration. Run constraint validation queries on staging first.

---

### Issue 1.4: Data Loss Detected (Booking Count Mismatch)

**Symptom**:

```bash
diff pre-migration-count.txt post-migration-count.txt
# Shows difference in booking counts
```

**Cause**: ⚠️ **CRITICAL** - Migration deleted data or transaction rolled back partially.

**Solution**:

```bash
# IMMEDIATE ACTION: Stop all deployments

# 1. Restore from backup
psql $PRODUCTION_DB_URL < backup-YYYYMMDD_HHMMSS.sql

# 2. Verify restoration
psql $PRODUCTION_DB_URL -c "SELECT COUNT(*) FROM bookings;"
# Compare to pre-migration-count.txt

# 3. Investigate migration script for DELETE or DROP commands
grep -i "delete\|drop\|truncate" database/migrations/020-guest-booking-multi-unit.sql

# 4. Contact database admin immediately
# DO NOT attempt migration again without root cause analysis
```

**Escalation**: Database admin + senior developer required. Post-mortem analysis mandatory.

---

## Phase 2: Cloudflare Workers Deployment Issues

### Issue 2.1: Wrangler Deployment Fails with "Unauthorized"

**Symptom**:

```
✖ ERROR: Authentication failure. Are you logged in?
```

**Cause**: Wrangler not authenticated or credentials expired.

**Solution**:

```bash
# Login to Cloudflare account
wrangler login

# If login fails, use API token
wrangler whoami

# Set API token manually
export CLOUDFLARE_API_TOKEN="your-api-token"

# Verify authentication
wrangler whoami
# Expected: Shows your Cloudflare account email

# Retry deployment
wrangler deploy
```

---

### Issue 2.2: Secrets Not Available in Workers

**Symptom**:

```
[ERROR] SUPABASE_URL is undefined
```

**Cause**: Secrets not configured or not pushed to production environment.

**Solution**:

```bash
# List current secrets
wrangler secret list
# Expected: SUPABASE_URL, SUPABASE_SERVICE_KEY, TURNSTILE_SECRET_KEY

# If missing, add secrets
wrangler secret put SUPABASE_URL
# Paste your Supabase URL when prompted

wrangler secret put SUPABASE_SERVICE_KEY
# Paste your service key when prompted

wrangler secret put TURNSTILE_SECRET_KEY
# Paste your Turnstile secret when prompted

# Redeploy to apply secrets
wrangler deploy

# Test API endpoint
curl https://your-production-domain.com/api/health
```

---

### Issue 2.3: Cron Triggers Not Executing

**Symptom**:

```bash
# No cron logs appear in wrangler tail after scheduled time
wrangler tail --format=json | grep "CRON"
# No output
```

**Cause**: Cron triggers not registered or syntax error in `wrangler.toml`.

**Solution**:

```bash
# Verify wrangler.toml syntax
cat wrangler.toml | grep -A 5 "\[triggers\]"
# Expected:
# [triggers]
# crons = [
#   "0 2 * * *",
#   "0 3 * * 0"
# ]

# If syntax incorrect, fix wrangler.toml
# Common mistakes:
# - Missing quotes around cron expressions
# - Incorrect cron syntax (use https://crontab.guru/ to verify)
# - Typo in [triggers] section name

# Redeploy after fixing
wrangler deploy

# Verify triggers registered in Cloudflare dashboard
# Navigate to: Workers & Pages > Your Worker > Triggers > Cron Triggers
# Expected: 2 cron triggers listed

# Manually trigger cron for testing (local only)
wrangler dev
# In another terminal:
curl -X POST http://localhost:8787/__scheduled \
  -H "Content-Type: application/json" \
  -d '{"cron": "0 2 * * *"}'
```

---

### Issue 2.4: API Health Check Returns 500 Error

**Symptom**:

```bash
curl https://your-production-domain.com/api/health
# Response: {"error":"Internal Server Error"}
# Status: 500
```

**Cause**: Worker runtime error, missing dependencies, or database connection failure.

**Solution**:

```bash
# Check real-time logs
wrangler tail --format=pretty

# Look for error messages like:
# - "Cannot find module '@supabase/supabase-js'"
# - "Connection timeout"
# - "Uncaught TypeError"

# Common fixes:

# 1. Database connection issue
# Verify Supabase URL reachable
curl -I https://your-project.supabase.co/rest/v1/
# Expected: HTTP/2 200 OK

# 2. Missing environment variables
# Check wrangler.toml [vars] section
cat wrangler.toml | grep -A 3 "\[vars\]"
# Expected: ALLOWED_ORIGINS defined

# 3. Code syntax error
# Build locally to catch errors
npm run build
# Fix any compilation errors

# 4. Rollback if unresolvable
wrangler rollback

# Test previous deployment
curl https://your-production-domain.com/api/health
```

---

## Phase 3: Cloudflare Pages Deployment Issues

### Issue 3.1: Frontend Build Fails

**Symptom**:

```bash
npm run build
# Error: "Module not found" or "Type error"
```

**Cause**: Missing dependencies, TypeScript errors, or environment variable issues.

**Solution**:

```bash
# 1. Install missing dependencies
npm install

# 2. Check for TypeScript errors
npm run type-check
# Fix any reported errors

# 3. Verify environment variables loaded
echo $VITE_SUPABASE_URL
# If empty, load .env.production
export $(cat .env.production | xargs)

# 4. Clear cache and retry
rm -rf node_modules/.vite dist/
npm run build

# 5. Test build output locally
npm run preview
# Navigate to http://localhost:4173
```

---

### Issue 3.2: Guest Booking Form Shows Blank Page

**Symptom**:

- Browser shows blank page at `/guest-booking`
- Console shows errors like "Cannot read property of undefined"

**Cause**: JavaScript bundle error, missing assets, or routing issue.

**Solution**:

```bash
# 1. Check browser console (F12)
# Look for specific error messages

# 2. Verify assets deployed
curl -I https://your-production-domain.com/assets/index-[hash].js
# Expected: HTTP/2 200 OK

# 3. Check routing configuration
# Verify TanStack Router routes compiled
ls src/routeTree.gen.ts
# Expected: File exists and is up-to-date

# Regenerate routes
npx tsr generate

# 4. Test locally first
npm run build && npm run preview
# Navigate to /guest-booking locally

# 5. Check for CORS issues (if API calls failing)
# Open browser console Network tab
# Look for CORS errors like "blocked by CORS policy"

# Fix CORS in wrangler.toml
cat wrangler.toml | grep ALLOWED_ORIGINS
# Update to production domain

# 6. Redeploy Pages
wrangler pages deploy dist --project-name=okaeri-resort-system
```

---

### Issue 3.3: JavaScript Console Shows "Uncaught ReferenceError"

**Symptom**:

```
Uncaught ReferenceError: process is not defined
```

**Cause**: Environment variable accessed via `process.env` instead of `import.meta.env`.

**Solution**:

```bash
# Search codebase for process.env usage
grep -r "process\.env" src/

# Replace all instances with import.meta.env
# Example:
# ❌ const apiUrl = process.env.VITE_API_BASE_URL;
# ✅ const apiUrl = import.meta.env.VITE_API_BASE_URL;

# Rebuild
npm run build

# Redeploy
wrangler pages deploy dist
```

---

## Phase 4: Monitoring Setup Issues

### Issue 4.1: Grafana Dashboard Shows "No data"

**Symptom**:

- All panels display "No data" message
- Queries return empty results

**Cause**: Data source not configured, incorrect credentials, or database unreachable.

**Solution**:

1. **Verify Data Source Configuration**:
   - Navigate to Grafana > Configuration > Data Sources
   - Check PostgreSQL data source exists
   - Test connection (click "Test" button)
   - Expected: "Database Connection OK"

2. **Check Database Credentials**:

   ```bash
   # Test connection manually
   psql $PRODUCTION_DB_URL -c "SELECT 1;"
   # Expected: Returns 1
   ```

3. **Verify Firewall Rules**:
   - Grafana Cloud IP ranges need access to database
   - Add Grafana Cloud IPs to database firewall allowlist
   - Supabase: Project Settings > Database > Connection Pooling > Allowed IPs

4. **Test Query Manually**:

   ```sql
   -- Copy query from panel, run in psql
   SELECT COUNT(*) as queue_length
   FROM bookings
   WHERE is_multi_unit = TRUE
     AND unit_assignment_status = 'pending'
     AND payment_status = 'Verified';
   -- Expected: Returns count (may be 0 initially)
   ```

5. **Check Panel Configuration**:
   - Verify query syntax correct
   - Ensure time range appropriate (not filtering out all data)
   - Check panel refresh interval (should be 1-5 minutes)

---

### Issue 4.2: Alerts Not Firing

**Symptom**:

- Threshold breached but no notification received
- Alert shows "Pending" or "No Data" status

**Cause**: Alert query error, notification channel misconfigured, or threshold not met long enough.

**Solution**:

1. **Test Alert Query**:
   - Navigate to Grafana > Explore
   - Paste alert query
   - Execute and verify returns data
   - Check for syntax errors

2. **Verify Alert Rule Configuration**:
   - Navigate to Grafana > Alerting > Alert Rules
   - Check "For" duration (how long condition must be true)
   - Example: "For 10 minutes" means alert fires after 10 min of threshold breach

3. **Check Notification Channels**:
   - Navigate to Grafana > Alerting > Contact Points
   - Send test notification
   - Expected: Test email/Slack message received
   - If not received, verify email address or Slack webhook URL

4. **Review Alert State**:

   ```
   States:
   - Normal: Condition not met (green)
   - Pending: Condition met but duration not reached yet (yellow)
   - Alerting: Condition met for duration (red)
   - No Data: Query returns no data (gray)
   ```

5. **Temporarily Lower Threshold** (for testing):
   - Set queue_length > 1 instead of > 10
   - Wait for duration period
   - Verify alert fires
   - Restore original threshold

---

### Issue 4.3: UptimeRobot Monitors Show "Down"

**Symptom**:

- Monitor status shows red "Down" indicator
- Email alerts received indicating downtime

**Cause**: Endpoint unreachable, DNS issue, timeout, or keyword mismatch.

**Solution**:

1. **Test Endpoint Manually**:

   ```bash
   curl -v https://your-production-domain.com/api/health
   # Check HTTP status code and response time
   ```

2. **Check DNS Resolution**:

   ```bash
   nslookup your-production-domain.com
   dig your-production-domain.com
   # Verify DNS resolves to correct IP
   ```

3. **Verify Keyword Monitor** (if using):

   ```bash
   curl -s https://your-production-domain.com/guest-booking | grep "Select your dates"
   # Keyword must match EXACTLY (case-sensitive)
   ```

4. **Adjust Timeout Settings**:
   - Edit monitor in UptimeRobot
   - Increase timeout from 30s to 60s if slow response
   - Check "Response Time Threshold" setting

5. **Check Monitor Interval**:
   - Free plan: 5-minute intervals
   - Monitor may show brief downtime during deployments (acceptable)
   - Add deployment maintenance window if needed

6. **Verify SSL Certificate**:
   ```bash
   openssl s_client -connect your-production-domain.com:443 -servername your-production-domain.com
   # Check certificate validity dates
   ```

---

## Phase 5: Admin Training Issues

### Issue 5.1: Admin Cannot Login to Dashboard

**Symptom**:

- Login form rejects admin credentials
- "Invalid email or password" error

**Cause**: Admin account not created, incorrect role, or authentication issue.

**Solution**:

```bash
# Verify admin user exists
psql $PRODUCTION_DB_URL -c "SELECT id, email, role FROM auth.users WHERE email = 'admin@example.com';"

# If user doesn't exist, create via Supabase dashboard:
# 1. Navigate to Supabase Dashboard > Authentication > Users
# 2. Click "Add User" > Enter email and password
# 3. Set metadata: {"app_role": "admin"}

# Verify admin role in JWT claims
# Login as admin, copy JWT token from browser localStorage
# Decode JWT at https://jwt.io
# Expected: Payload contains "app_role": "admin"

# If role missing, update user metadata in Supabase dashboard
```

---

### Issue 5.2: Pending Queue Shows No Bookings

**Symptom**:

- Admin sees empty pending bookings queue
- Test bookings created but not visible

**Cause**: RLS policies blocking admin access or query filtering too strict.

**Solution**:

```bash
# Test query directly
psql $PRODUCTION_DB_URL <<EOF
SELECT booking_id, booking_reference, unit_assignment_status, payment_status
FROM bookings
WHERE is_multi_unit = TRUE
  AND unit_assignment_status = 'pending';
EOF

# If results returned, RLS policy issue:
# Verify admin RLS policy exists
psql $PRODUCTION_DB_URL -c "\d+ bookings" | grep "POLICIES"

# Check specific policy
psql $PRODUCTION_DB_URL -c "SELECT policyname, permissive, roles FROM pg_policies WHERE tablename = 'bookings';"

# Admin should have SELECT policy:
# CREATE POLICY admin_select_bookings ON bookings
#   FOR SELECT TO authenticated
#   USING (auth.jwt() ->> 'app_role' = 'admin');

# If policy missing, create it (or review chunk 003)
```

---

### Issue 5.3: Unit Assignment Fails with Constraint Violation

**Symptom**:

```
Error: new row for relation "booking_units" violates check constraint "no_double_booking"
```

**Cause**: Selected unit already assigned for overlapping dates (double-booking).

**Solution**:

```bash
# Check which units are available for booking dates
psql $PRODUCTION_DB_URL <<EOF
SELECT u.unit_id, u.unit_name, u.unit_status
FROM units u
WHERE u.unit_id NOT IN (
  SELECT DISTINCT bu.unit_id
  FROM booking_units bu
  WHERE bu.status != 'cancelled'
    AND daterange(bu.check_in_date, bu.check_out_date, '[]') &&
        daterange('2025-03-01', '2025-03-08', '[]') -- Replace with actual dates
);
EOF

# Select different units from available list
# If insufficient units available, contact guest with alternatives
```

**Admin Training Point**: Emphasize using availability calendar before assignment. Explain double-booking constraint protection.

---

### Issue 5.4: Payment Proof Viewer Doesn't Load

**Symptom**:

- Click payment proof thumbnail, no image displays
- Console shows "Failed to load image" or 403 Forbidden

**Cause**: Signed URL expired, insufficient permissions, or file deleted.

**Solution**:

```bash
# 1. Verify file exists in storage
# Check Supabase Dashboard > Storage > payment-proofs bucket
# Find file by booking_id

# 2. Generate new signed URL
# This should happen automatically in admin UI
# Signed URLs expire after 5 minutes (regenerate on click)

# 3. Check storage bucket permissions
# Supabase Dashboard > Storage > payment-proofs > Policies
# Ensure admin can read:
# Policy: admins_read_payment_proofs
# Definition: (auth.jwt() ->> 'app_role' = 'admin')

# 4. Test signed URL generation locally
# Use Supabase client:
const { data, error } = await supabase.storage
  .from('payment-proofs')
  .createSignedUrl('path/to/file.jpg', 300); // 5 minutes

# 5. Check CORS settings
# Storage bucket must allow requests from admin dashboard domain
```

---

## Phase 6: Post-Deployment Issues

### Issue 6.1: High Queue Length Alert Firing Constantly

**Symptom**:

- Alert fires repeatedly
- Queue length consistently >10 bookings

**Cause**: Admin capacity insufficient, slow assignment process, or alert threshold too low.

**Solution**:

1. **Short-term**:

   ```bash
   # Increase alert threshold temporarily
   # Edit alert in Grafana: queue_length > 20 (instead of 10)
   ```

2. **Medium-term**:
   - Schedule additional admin hours
   - Identify assignment bottlenecks
   - Streamline payment verification process

3. **Long-term**:
   - Implement automated unit assignment
   - Add second admin with training
   - Optimize admin workflow based on feedback

4. **Analysis**:

   ```sql
   -- Check average assignment time
   SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) as avg_hours
   FROM bookings
   WHERE unit_assignment_status = 'assigned'
     AND updated_at > NOW() - INTERVAL '7 days';

   -- Identify slow assignments (>24h)
   SELECT booking_reference, created_at, updated_at,
          EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600 as hours_to_assign
   FROM bookings
   WHERE unit_assignment_status = 'assigned'
     AND (updated_at - created_at) > INTERVAL '24 hours'
   ORDER BY hours_to_assign DESC
   LIMIT 10;
   ```

---

### Issue 6.2: Guest Reports Not Receiving Booking Confirmation

**Symptom**:

- Guest submitted booking successfully
- Booking exists in admin queue
- Guest reports no confirmation received

**Cause**: Manual contact workflow not executed by admin.

**Solution** (Process Issue, not technical):

1. **Verify admin contacted guest**:
   - Check booking notes for contact documentation
   - Review admin workflow checklist compliance

2. **Admin coaching**:
   - Reiterate manual contact requirement
   - Review confirmation script templates
   - Emphasize 2-hour SLA for contact

3. **Temporary measure**:
   - Developer assists with guest contact backlog
   - Admin shadows developer for 1-2 contacts

4. **Long-term fix**:
   - Implement email automation (Phase 2)
   - Add notification tracking in `notification_log` table
   - Set up automated reminders for admin

**Note**: This is expected behavior for Phase 1 (manual contact workflow). Document for Phase 2 email integration requirements.

---

### Issue 6.3: Performance Degradation (Slow Page Loads)

**Symptom**:

- Page load times >5 seconds
- API requests timeout occasionally
- Slow database queries

**Cause**: Database query inefficiency, missing indexes, or connection pool exhaustion.

**Solution**:

1. **Profile Slow Queries**:

   ```sql
   -- Enable query logging
   ALTER DATABASE your_db SET log_min_duration_statement = 1000; -- Log queries >1s

   -- Review slow query log
   SELECT query, total_time, calls, mean_time
   FROM pg_stat_statements
   ORDER BY total_time DESC
   LIMIT 10;
   ```

2. **Check Indexes**:

   ```bash
   psql $PRODUCTION_DB_URL -c "\d+ bookings" | grep "Indexes"
   # Verify these indexes exist:
   # - idx_bookings_multi_unit
   # - idx_bookings_assignment_pending
   # - idx_guest_booking_requests_booking
   ```

3. **Monitor Connection Pool**:

   ```bash
   # Check active connections
   psql $PRODUCTION_DB_URL -c "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database();"

   # Supabase connection limit: Check dashboard for pool utilization
   # If >80%, increase connection pool or optimize queries
   ```

4. **Optimize Pricing Function**:

   ```sql
   -- Add IMMUTABLE or STABLE modifier if appropriate
   CREATE OR REPLACE FUNCTION calculate_booking_pricing(...)
   RETURNS JSONB
   STABLE -- Function result doesn't change for same inputs within transaction
   AS $$ ... $$;
   ```

5. **Compare to Baseline**:
   ```bash
   # Review performance baseline from chunk 016
   cat performance-baselines/baseline-YYYY-MM-DD.json
   # Compare current metrics to baseline
   ```

---

### Issue 6.4: Discount Not Applied Correctly

**Symptom**:

- Guest books 7-night stay
- Pricing snapshot shows no discount or wrong discount percentage

**Cause**: Discount rule inactive, condition mismatch, or pricing function logic error.

**Solution**:

```bash
# 1. Verify discount rules active
psql $PRODUCTION_DB_URL -c "SELECT name, conditions, discount_value, is_active FROM discount_rules ORDER BY discount_value;"

# 2. Test pricing function with specific scenario
psql $PRODUCTION_DB_URL <<EOF
SELECT
  pricing->>'nights' as nights,
  pricing->>'subtotal' as subtotal,
  pricing->'discount'->>'percent' as discount_percent,
  pricing->'discount'->>'rule_name' as discount_rule,
  pricing->>'total' as total
FROM (
  SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 2}]'::JSONB,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '7 days' -- Exactly 7 nights
  ) as pricing
) result;
EOF
# Expected: discount_percent = 5.00, discount_rule = '7-Night Discount' or similar

# 3. Check discount condition matching logic
# Review function in database/migrations/020-guest-booking-multi-unit.sql lines 326-355
# Ensure condition types (min_nights, date_range, etc.) match data

# 4. Verify check-in/check-out date calculation
# Nights = check_out - check_in (date difference, not interval)
psql $PRODUCTION_DB_URL -c "SELECT DATE '2025-03-08' - DATE '2025-03-01' AS nights;"
# Expected: 7

# 5. If issue persists, enable function debugging:
psql $PRODUCTION_DB_URL <<EOF
CREATE OR REPLACE FUNCTION calculate_booking_pricing(...)
RETURNS JSONB AS $$
DECLARE
  ...
BEGIN
  RAISE NOTICE 'Nights calculated: %', v_nights; -- Add debug logging
  ...
END;
$$ LANGUAGE plpgsql;
EOF
```

---

## Emergency Rollback Procedures

### When to Initiate Rollback

**Trigger Rollback Immediately If**:

- ❌ Production completely broken (no bookings possible)
- ❌ Data corruption detected (booking data loss or inconsistent)
- ❌ Critical security vulnerability exposed
- ❌ Database migration causes widespread errors

**DO NOT Rollback If**:

- ✅ Non-critical UI bugs (fix with hotfix)
- ✅ Monitoring issues (fix monitoring, don't rollback system)
- ✅ Performance degradation <50% (optimize post-deployment)
- ✅ Alert tuning needed (adjust thresholds, don't rollback)

### Rollback Execution (from 06-migration-guide.md)

```bash
# Set production database URL
export PRODUCTION_DB_URL="postgresql://user:pass@prod-host:5432/dbname"

# Execute rollback script (lines 712-764 of migration guide)
psql $PRODUCTION_DB_URL < database/migrations/rollback-020.sql

# Verify rollback successful
psql $PRODUCTION_DB_URL -c "SELECT COUNT(*) FROM bookings;"
# Compare to pre-migration backup count

# Rollback Workers
wrangler rollback

# Rollback Pages
wrangler pages deployment list
wrangler pages deployment rollback <previous-deployment-id>

# Verify system operational
curl https://your-production-domain.com/api/health
# Expected: 200 OK
```

**Target Time**: <1 hour total rollback (as tested in chunk 016)

---

## Still Stuck?

### Escalation Path

1. **Check Documentation**:
   - Review relevant chunk documentation (chunks 001-016)
   - Check CLAUDE.md for development patterns
   - Review 06-migration-guide.md for deployment procedures

2. **Search Logs**:

   ```bash
   # Workers logs
   wrangler tail --format=pretty

   # Database logs (Supabase dashboard)
   # Navigate to: Project > Logs > Postgres Logs

   # Frontend console errors (browser F12)
   ```

3. **Community Resources**:
   - Cloudflare Workers Discord: https://discord.gg/cloudflaredev
   - Supabase Discord: https://discord.supabase.com
   - TanStack Discord: https://discord.com/invite/WrRKjPJ

4. **Contact Development Team**:
   - Technical Issues: Slack @dev-channel
   - Database Issues: Database Admin (phone: +1-XXX-XXX-XXXX)
   - Emergency Rollback: Senior Developer + Database Admin

---

**Remember**: Most deployment issues are recoverable. Stay calm, follow troubleshooting steps systematically, and escalate when needed. The rollback procedure is your safety net if critical issues occur.
