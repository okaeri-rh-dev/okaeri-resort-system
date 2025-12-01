# Chunk 017: Deployment and Monitoring - Instructions

## Overview

This guide walks you through deploying the multi-unit guest booking system to production and establishing operational monitoring. Follow each step sequentially - do not skip ahead.

**Total Time**: ~90 minutes (hands-on deployment) + 2 hours (admin training session)

---

## Part 1: Pre-Deployment Preparation (15 minutes)

### Step 1.1: Verify Prerequisites (5 min)

```bash
# Confirm all tests passing
npm run test:all
# Expected: All tests pass, zero failures

# Verify no TypeScript errors
npm run type-check
# Expected: No errors found

# Verify no linting issues
npm run lint
# Expected: No warnings or errors

# Confirm performance baseline exists
ls -la performance-baselines/
# Expected: baseline-YYYY-MM-DD.json file present

# Verify cron cleanup functions exist (from chunk 005)
ls -la functions/scheduled/
# Expected: cleanup-idempotency.ts, cleanup-payment-proofs.ts present
```

**Why these checks matter**: Deploying broken code wastes time and requires rollback. These commands ensure code quality before touching production. The cron cleanup functions should exist from chunk 005 implementation.

### Step 1.2: Create Production Backup (5 min)

```bash
# Set production database connection string
export PRODUCTION_DB_URL="postgresql://user:pass@host:5432/dbname"

# Create timestamped backup
BACKUP_FILE="backup-$(date +%Y%m%d_%H%M%S).sql"
pg_dump $PRODUCTION_DB_URL > "$BACKUP_FILE"

# Verify backup integrity (shows table count)
pg_restore --list "$BACKUP_FILE" | head -20

# Upload to secure storage (adjust path as needed)
# aws s3 cp "$BACKUP_FILE" s3://your-backup-bucket/pre-multi-unit/
# OR
# cp "$BACKUP_FILE" /mnt/backups/database/

echo "✅ Backup created: $BACKUP_FILE"
```

**Why backup first**: If migration fails catastrophically, this backup is your safety net. Store it securely off-server.

### Step 1.3: Set Production Environment Variables (5 min)

Create `.env.production` file:

```bash
# Create production environment file
cat > .env.production <<EOF
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_KEY=your-service-role-key-here

# Cloudflare Turnstile
VITE_TURNSTILE_SITE_KEY=your-turnstile-site-key
TURNSTILE_SECRET_KEY=your-turnstile-secret

# Production Domain
VITE_API_BASE_URL=https://your-production-domain.com
ALLOWED_ORIGINS=https://your-production-domain.com

# Feature Flags
VITE_MULTI_UNIT_ENABLED=true
EOF

# Secure the file (owner read/write only)
chmod 600 .env.production

echo "✅ Production environment configured"
```

**Security note**: Never commit `.env.production` to git. Add to `.gitignore` if not already present.

---

## Part 2: Staging Validation (10 minutes)

**Why staging first**: Catch migration issues before production. Staging serves as final validation gate.

### Step 2.1: Deploy to Staging (5 min)

```bash
# Set staging database URL
export STAGING_DB_URL="postgresql://user:pass@staging-host:5432/dbname"

# Run migration on staging
psql $STAGING_DB_URL < database/migrations/020-guest-booking-multi-unit.sql

# Expected output:
# NOTICE: Migration completed successfully
# COMMIT
```

**What this does**: Creates new tables (`pricing_config`, `guest_booking_unit_requests`, `discount_rules`, `idempotency_keys`), adds columns to `bookings`, creates PostgreSQL functions.

### Step 2.2: Validate Staging Migration (5 min)

```bash
# Verify new tables exist
psql $STAGING_DB_URL -c "\dt guest_booking_unit_requests discount_rules idempotency_keys pricing_config"
# Expected: 4 tables listed

# Verify pricing_config has default row
psql $STAGING_DB_URL -c "SELECT id, base_rate, weekend_rate, max_capacity_per_unit FROM pricing_config;"
# Expected: 1 row with id='default', base_rate=3000.00, weekend_rate=3500.00, max_capacity_per_unit=20

# Verify discount rules inserted
psql $STAGING_DB_URL -c "SELECT COUNT(*) as discount_rules FROM discount_rules WHERE is_active = TRUE;"
# Expected: count = 4 (7-night, 14-night, 21-night, 28-night discounts)

# Test pricing function
psql $STAGING_DB_URL <<EOF
SELECT calculate_booking_pricing(
  '[{"guests_per_unit": 2}, {"guests_per_unit": 3}]'::JSONB,
  CURRENT_DATE + INTERVAL '7 days',
  CURRENT_DATE + INTERVAL '14 days'
) AS pricing_result;
EOF
# Expected: JSONB result with nights=7, total_units=2, subtotal, discount, total
```

**Validation checkpoint**: If any query fails, DO NOT proceed to production. Review troubleshooting.md.

---

## Part 3: Production Database Migration (20 minutes)

### Step 3.1: Final Pre-Migration Checks (5 min)

```bash
# Set production database URL
export PRODUCTION_DB_URL="postgresql://user:pass@prod-host:5432/dbname"

# Count existing bookings (for post-migration verification)
psql $PRODUCTION_DB_URL -c "SELECT COUNT(*) as total_bookings FROM bookings;" > pre-migration-count.txt
cat pre-migration-count.txt
# Expected: Some number (e.g., 150 bookings)

# Check for pending bookings that will be marked as single-unit
psql $PRODUCTION_DB_URL -c "SELECT COUNT(*) FROM bookings WHERE booking_status = 'Pending';"
# Note this number - these will remain single-unit bookings

# Verify pricing_config doesn't conflict (should not exist yet)
psql $PRODUCTION_DB_URL -c "SELECT * FROM pricing_config WHERE id = 'default';" 2>&1 | grep "does not exist"
# Expected: Error saying table does not exist (this is good)
```

### Step 3.2: Execute Production Migration (10 min)

```bash
# Run migration with output logging
psql $PRODUCTION_DB_URL < database/migrations/020-guest-booking-multi-unit.sql 2>&1 | tee migration-output.log

# Review output for errors
grep -i "error\|fail" migration-output.log
# Expected: No matches (empty output)

# Confirm success message
grep "Migration completed successfully" migration-output.log
# Expected: "NOTICE: Migration completed successfully"
```

**What just happened**: Production database now supports multi-unit bookings. Existing single-unit bookings remain unchanged (backward compatible).

### Step 3.3: Validate Production Migration (5 min)

```bash
# Verify table creation
psql $PRODUCTION_DB_URL -c "\dt guest_booking_unit_requests discount_rules idempotency_keys pricing_config"
# Expected: 4 tables listed

# Verify NO data loss
psql $PRODUCTION_DB_URL -c "SELECT COUNT(*) as total_bookings FROM bookings;" > post-migration-count.txt
diff pre-migration-count.txt post-migration-count.txt
# Expected: No difference (booking counts match)

# Verify pricing function works
psql $PRODUCTION_DB_URL -c "SELECT calculate_booking_pricing('[{\"guests_per_unit\": 2}]'::JSONB, CURRENT_DATE, CURRENT_DATE + 1) AS test_pricing \g (format=json)"
# Expected: Valid JSON with pricing breakdown

# Verify constraints active
psql $PRODUCTION_DB_URL -c "SELECT conname FROM pg_constraint WHERE conname IN ('payment_before_assignment', 'all_or_nothing_assignment', 'no_double_booking');"
# Expected: 3 constraints listed

echo "✅ Production migration successful - zero data loss verified"
```

---

## Part 4: Cloudflare Workers Deployment (15 minutes)

### Step 4.1: Configure Wrangler Secrets (5 min)

```bash
# Set Supabase credentials
wrangler secret put SUPABASE_URL
# Paste your production Supabase URL when prompted

wrangler secret put SUPABASE_SERVICE_KEY
# Paste your Supabase service role key when prompted

# Set Turnstile secret
wrangler secret put TURNSTILE_SECRET_KEY
# Paste your Turnstile secret key when prompted

# Verify secrets set
wrangler secret list
# Expected: 3 secrets listed (SUPABASE_URL, SUPABASE_SERVICE_KEY, TURNSTILE_SECRET_KEY)
```

**Security**: Secrets are encrypted at rest in Cloudflare. Never log or print these values.

### Step 4.2: Configure Cron Triggers (3 min)

Verify `wrangler.toml` has cron configuration:

```toml
# wrangler.toml
name = "okaeri-resort"
main = "functions/_worker.js"
compatibility_date = "2024-01-01"

[triggers]
crons = [
  "0 2 * * *",   # Daily: Idempotency cleanup at 2:00 AM UTC
  "0 3 * * 0"    # Weekly: Payment proof cleanup Sunday 3:00 AM UTC
]

[vars]
ALLOWED_ORIGINS = "https://your-production-domain.com"
```

**Why these schedules**:

- **2:00 AM UTC**: Low-traffic period for maintenance operations
- **Sunday 3:00 AM UTC**: Weekly cleanup during lowest booking activity

### Step 4.3: Deploy Workers (7 min)

```bash
# Build production bundle
npm run build

# Deploy to Cloudflare Workers
wrangler deploy

# Expected output:
# ✔ Built successfully
# ✔ Uploaded to Cloudflare Workers
# ✔ Deployed to production
# ✔ Cron triggers registered

# Verify deployment
curl https://your-production-domain.com/api/health
# Expected: {"status":"ok","timestamp":"2025-..."}

# Test guest booking endpoint
curl -X POST https://your-production-domain.com/api/guest-booking/rates
# Expected: {"base_rate":3000,"weekend_rate":3500,...}

# Verify cron triggers registered
wrangler deployments list | head -5
# Expected: Shows recent deployment with cron triggers

echo "✅ Cloudflare Workers deployed successfully"
```

**Smoke test**: If health check fails, rollback Workers deployment immediately using `wrangler rollback`.

---

## Part 5: Cloudflare Pages Deployment (10 minutes)

### Step 5.1: Build Production Frontend (5 min)

```bash
# Load production environment variables
export $(cat .env.production | xargs)

# Build production bundle
npm run build

# Verify build output
ls -lh dist/
# Expected: index.html, assets/ directory with JS/CSS bundles

# Check bundle sizes (should be optimized)
du -sh dist/assets/*.js | sort -h
# Expected: Largest bundle <500KB after gzip
```

**Build optimization**: Vite automatically splits vendor code and applies tree-shaking. Large bundle? Review `vite.config.ts` chunk configuration.

### Step 5.2: Deploy to Cloudflare Pages (5 min)

```bash
# Deploy dist directory to Cloudflare Pages
wrangler pages deploy dist --project-name=okaeri-resort

# Expected output:
# ✔ Built successfully
# ✔ Uploading files...
# ✔ Deployed to https://okaeri-resort.pages.dev

# Test production URL
curl -I https://your-production-domain.com
# Expected: HTTP/2 200 OK

# Open in browser for visual check
open https://your-production-domain.com/guest-booking

echo "✅ Frontend deployed to Cloudflare Pages"
```

**DNS propagation**: If using custom domain, allow 5-15 minutes for DNS changes to propagate globally.

---

## Part 6: Monitoring Setup (20 minutes)

### Step 6.1: Create Grafana Cloud Dashboard (10 min)

```bash
# Login to Grafana Cloud (free plan)
# Navigate to: https://grafana.com/auth/sign-in

# Create new dashboard: "Okaeri Resort - Multi-Unit Bookings"
# Use the following panel configurations:
```

**Panel 1: Booking Queue Length** (Stat panel)

```sql
-- Query: Pending multi-unit bookings
SELECT COUNT(*) as queue_length
FROM bookings
WHERE is_multi_unit = TRUE
  AND unit_assignment_status = 'pending'
  AND payment_status = 'Verified';
```

Configuration:

- Visualization: Stat
- Thresholds: Green (<5), Yellow (5-10), Red (>10)
- Refresh: 1 minute

**Panel 2: Average Assignment Time** (Time series)

```sql
-- Query: Assignment time in hours (last 24h)
SELECT
  DATE_TRUNC('hour', updated_at) as time,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) as avg_hours
FROM bookings
WHERE unit_assignment_status = 'assigned'
  AND updated_at > NOW() - INTERVAL '24 hours'
GROUP BY time
ORDER BY time;
```

Configuration:

- Visualization: Time series
- Unit: hours
- Threshold: Warning at 12h, Critical at 24h
- Refresh: 5 minutes

**Panel 3: Booking Success Rate** (Gauge)

```sql
-- Query: Success rate (last 7 days)
SELECT
  ROUND(
    COUNT(*) FILTER (WHERE unit_assignment_status = 'assigned')::DECIMAL /
    NULLIF(COUNT(*), 0) * 100,
    2
  ) as success_rate
FROM bookings
WHERE is_multi_unit = TRUE
  AND created_at > NOW() - INTERVAL '7 days';
```

Configuration:

- Visualization: Gauge
- Unit: percent
- Min: 0, Max: 100
- Thresholds: Red (<80), Yellow (80-95), Green (>95)

**Panel 4: Discount Application Rate** (Pie chart)

```sql
-- Query: Bookings with discounts applied
SELECT
  CASE
    WHEN discount_percent > 0 THEN 'With Discount'
    ELSE 'No Discount'
  END as discount_status,
  COUNT(*) as count
FROM bookings
WHERE is_multi_unit = TRUE
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY discount_status;
```

**Save dashboard** and note the dashboard UID for alert configuration.

**Export Dashboard Configuration**:

```bash
# Create monitoring config directory
mkdir -p monitoring

# Export Grafana dashboard JSON
# Method 1: Via Grafana UI
# - Click dashboard settings (gear icon)
# - Select "JSON Model"
# - Copy JSON content
# - Save to file:

cat > monitoring/grafana-dashboard.json <<'EOF'
{
  "dashboard": {
    "title": "Okaeri Resort - Multi-Unit Bookings",
    "panels": [
      {
        "id": 1,
        "title": "Booking Queue Length",
        "type": "stat",
        "targets": [{
          "rawSql": "SELECT COUNT(*) as queue_length FROM bookings WHERE is_multi_unit = TRUE AND unit_assignment_status = 'pending' AND payment_status = 'Verified';"
        }],
        "fieldConfig": {
          "defaults": {
            "thresholds": {
              "steps": [
                {"value": 0, "color": "green"},
                {"value": 5, "color": "yellow"},
                {"value": 10, "color": "red"}
              ]
            }
          }
        }
      }
      // ... (paste remaining panels from UI export)
    ],
    "refresh": "1m",
    "schemaVersion": 38
  }
}
EOF

echo "✅ Grafana dashboard config exported to: monitoring/grafana-dashboard.json"
echo "   Note: Replace '// ... (paste remaining panels)' with actual exported JSON"
```

**Alternative: Export via Grafana API** (if API key available):

```bash
# Get dashboard JSON via API
GRAFANA_API_KEY="your-grafana-api-key"
GRAFANA_URL="https://your-grafana-instance.com"
DASHBOARD_UID="your-dashboard-uid"

curl -H "Authorization: Bearer $GRAFANA_API_KEY" \
  "$GRAFANA_URL/api/dashboards/uid/$DASHBOARD_UID" \
  | jq '.dashboard' > monitoring/grafana-dashboard.json

echo "✅ Dashboard exported via API"
```

---

### Step 6.2: Configure UptimeRobot Monitors (5 min)

Login to UptimeRobot (free plan: 50 monitors, 5-min intervals)

**Monitor 1: API Health Check**

```
Type: HTTP(s)
URL: https://your-production-domain.com/api/health
Name: Okaeri API Health
Monitoring Interval: 5 minutes
Alert Contacts: your-email@example.com
```

**Monitor 2: Guest Booking Form**

```
Type: HTTP(s)
URL: https://your-production-domain.com/guest-booking
Name: Guest Booking Form
Keyword to Check: "Select your dates" (confirms form loaded)
Monitoring Interval: 5 minutes
Alert Contacts: your-email@example.com
```

**Monitor 3: Pricing Endpoint**

```
Type: HTTP(s)
URL: https://your-production-domain.com/api/guest-booking/rates
Name: Pricing API
Response Time Threshold: 1000ms
Monitoring Interval: 5 minutes
Alert Contacts: your-email@example.com
```

**Export UptimeRobot Configuration**:

```bash
# Document UptimeRobot monitor configuration
# (UptimeRobot free plan doesn't have API export, so manually document)

cat > monitoring/uptime-robot-config.json <<'EOF'
{
  "monitors": [
    {
      "name": "Okaeri API Health",
      "type": "HTTP(s)",
      "url": "https://your-production-domain.com/api/health",
      "interval": 300,
      "alert_contacts": ["your-email@example.com"],
      "expected_status": 200
    },
    {
      "name": "Guest Booking Form",
      "type": "HTTP(s) - Keyword",
      "url": "https://your-production-domain.com/guest-booking",
      "keyword": "Select your dates",
      "interval": 300,
      "alert_contacts": ["your-email@example.com"]
    },
    {
      "name": "Pricing API",
      "type": "HTTP(s)",
      "url": "https://your-production-domain.com/api/guest-booking/rates",
      "interval": 300,
      "response_time_threshold": 1000,
      "alert_contacts": ["your-email@example.com"]
    }
  ],
  "configuration": {
    "free_plan_limits": {
      "max_monitors": 50,
      "interval_seconds": 300,
      "retention_days": 90
    }
  }
}
EOF

echo "✅ UptimeRobot config documented at: monitoring/uptime-robot-config.json"
echo "   Note: This is for documentation/replication. UptimeRobot free plan doesn't support API import."
```

---

### Step 6.3: Configure Alert Rules (5 min)

Create alerts in Grafana Cloud:

**Alert 1: High Queue Length**

```yaml
Name: High Pending Queue
Condition: queue_length > 10
Duration: 10 minutes
Severity: Warning
Notification: Email + Slack
Message: "Pending booking queue exceeds 10. Admin review needed."
```

**Alert 2: Slow Assignment Time**

```yaml
Name: Slow Unit Assignment
Condition: avg_assignment_time > 24 hours
Duration: 1 hour
Severity: Critical
Notification: Email + Slack + SMS
Message: "Average assignment time exceeds 24 hours. Urgent admin action required."
```

**Alert 3: Low Success Rate**

```yaml
Name: Low Booking Success Rate
Condition: success_rate < 80%
Duration: 6 hours
Severity: Warning
Notification: Email
Message: "Booking success rate below 80% over 7 days. Investigate assignment bottlenecks."
```

**Test alerts**: Manually trigger by temporarily lowering thresholds, then restore.

**Export Alert Rules Configuration**:

```bash
# Document alert rules for version control and replication

cat > monitoring/alert-rules.yaml <<'EOF'
# Grafana Cloud Alert Rules for Multi-Unit Booking System
# Last Updated: $(date +%Y-%m-%d)

alerts:
  - name: High Pending Queue
    uid: alert-high-queue
    condition: queue_length > 10
    for: 10m  # Alert fires after condition true for 10 minutes
    severity: warning
    query: |
      SELECT COUNT(*) as queue_length
      FROM bookings
      WHERE is_multi_unit = TRUE
        AND unit_assignment_status = 'pending'
        AND payment_status = 'Verified';
    threshold:
      warning: 10
      critical: 20
    notifications:
      - email
      - slack
    message: "Pending booking queue exceeds 10. Admin review needed."
    runbook: "https://docs.your-company.com/runbooks/high-queue"

  - name: Slow Unit Assignment
    uid: alert-slow-assignment
    condition: avg_assignment_time > 24
    for: 1h  # Alert fires after 1 hour of slow assignments
    severity: critical
    query: |
      SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) as avg_hours
      FROM bookings
      WHERE unit_assignment_status = 'assigned'
        AND updated_at > NOW() - INTERVAL '24 hours';
    threshold:
      warning: 12  # 12 hours average
      critical: 24  # 24 hours average
    notifications:
      - email
      - slack
      - sms  # Critical alerts also via SMS
    message: "Average assignment time exceeds 24 hours. Urgent admin action required."
    runbook: "https://docs.your-company.com/runbooks/slow-assignment"

  - name: Low Booking Success Rate
    uid: alert-low-success
    condition: success_rate < 80
    for: 6h  # Alert fires after 6 hours below threshold
    severity: warning
    query: |
      SELECT
        ROUND(
          COUNT(*) FILTER (WHERE unit_assignment_status = 'assigned')::DECIMAL /
          NULLIF(COUNT(*), 0) * 100,
          2
        ) as success_rate
      FROM bookings
      WHERE is_multi_unit = TRUE
        AND created_at > NOW() - INTERVAL '7 days';
    threshold:
      warning: 80  # 80% success rate
      critical: 60  # 60% success rate
    notifications:
      - email
    message: "Booking success rate below 80% over 7 days. Investigate assignment bottlenecks."
    runbook: "https://docs.your-company.com/runbooks/low-success"

notification_channels:
  email:
    - your-email@example.com
    - admin@example.com
  slack:
    webhook: "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
    channel: "#resort-alerts"
  sms:
    - "+1-XXX-XXX-XXXX"  # On-call developer

evaluation_interval: 1m  # Check alert conditions every 1 minute
EOF

echo "✅ Alert rules documented at: monitoring/alert-rules.yaml"
echo "   Note: Import alert rules into Grafana Cloud via UI (Alerting > Alert Rules > Import)"
```

---

## Part 7: Admin Training Session (2 hours)

**Note**: Schedule this session after technical deployment completes. Admin availability required.

### Step 7.0: Prepare Training Materials (30 min)

**Create these materials BEFORE the training session** to ensure admin has reference documentation.

#### Create Quick Reference Guide (PDF)

```bash
# Create admin training materials directory
mkdir -p docs/implementation/guest-booking-multi-unit/admin-training

# Create quick reference guide (Markdown first, convert to PDF)
cat > docs/implementation/guest-booking-multi-unit/admin-training/quick-reference-guide.md <<'EOF'
# Multi-Unit Booking Admin Quick Reference

## Daily Workflow Checklist
1. [ ] Login to admin dashboard
2. [ ] Review pending bookings queue (sort by urgency)
3. [ ] Process high-urgency bookings first (red badges)
4. [ ] Verify payments (check amount, date, clarity)
5. [ ] Assign units for verified payments
6. [ ] Contact guests via phone/SMS with confirmation
7. [ ] Document contact in booking notes

## Payment Verification Checklist
- [ ] Amount matches downpayment required
- [ ] Payment date within 48 hours
- [ ] Screenshot clear and legible
- [ ] Transaction method visible (GCash/Bank/Cash)

## Unit Assignment Rules
⚠️ **All-or-Nothing**: Must assign ALL requested units (no partial)
⚠️ **Payment First**: Payment must be verified before assignment
⚠️ **No Double-Booking**: System prevents overlapping assignments

## Guest Contact Script Templates

### Confirmation Script (After Assignment)
"Hi [Guest Name], this is [Your Name] from Okaeri Resort. Your booking [BK-XXXXXX] for [X] units from [Check-in] to [Check-out] is confirmed! You've been assigned: [Unit Names]. See you soon!"

### Insufficient Units Script
"Hi [Guest Name], thank you for your booking [BK-XXXXXX]. Unfortunately, we only have [Y] units available for your dates instead of [X] requested. Can we offer you: (1) [Y] units for same dates, or (2) [X] units for [Alternative Dates]?"

### Unclear Payment Proof Script
"Hi [Guest Name], we received your booking [BK-XXXXXX] but the payment proof screenshot is unclear. Could you please upload a clearer photo showing the transaction amount and date? Reply to this message with the new screenshot."

## Urgency Score Guide
- 🔴 **Red (80-100)**: Critical - Process immediately
- 🟡 **Yellow (50-79)**: High - Process within 4 hours
- 🟢 **Green (0-49)**: Normal - Process within 24 hours

## Common Issues & Solutions
| Issue | Solution |
|-------|----------|
| Cannot select enough units | Check availability calendar - units may be booked |
| Payment proof won't load | Click thumbnail again (signed URL may have expired) |
| Assignment fails | Verify payment status is "Verified" first |
| Guest not answering phone | Try SMS, wait 2 hours, try again |

## Emergency Contacts
- **Technical Issues**: Developer on-call (Slack: @dev-channel)
- **Booking Questions**: Product Manager (Email: pm@example.com)

---
Generated: $(date +%Y-%m-%d)
EOF

# Convert Markdown to PDF (requires pandoc or use online converter)
# Option 1: Using pandoc (if installed)
# pandoc docs/implementation/guest-booking-multi-unit/admin-training/quick-reference-guide.md \
#   -o docs/implementation/guest-booking-multi-unit/admin-training/quick-reference-guide.pdf

# Option 2: Manual - Open .md file in browser, print to PDF
echo "📄 Quick reference guide created at: docs/implementation/guest-booking-multi-unit/admin-training/quick-reference-guide.md"
echo "   Convert to PDF using: pandoc or browser print function"
```

#### Create Admin FAQ

```bash
cat > docs/implementation/guest-booking-multi-unit/admin-training/admin-faq.md <<'EOF'
# Multi-Unit Booking Admin FAQ

## Queue Management

**Q1: What does the urgency score mean?**
A: Urgency score (0-100) considers: days until check-in, payment amount, and time since booking. Higher score = more urgent processing needed.

**Q2: Can I change the queue sort order?**
A: Yes. Click column headers to sort by: urgency, date, amount, or status.

**Q3: How often does the queue refresh?**
A: Automatically every 30 seconds. Click refresh icon for manual update.

## Payment Verification

**Q4: What if the payment amount is slightly off?**
A: If within ±100 PHP, accept and document in notes. If >100 PHP difference, contact guest for clarification.

**Q5: What if the payment date is old (>48 hours)?**
A: Acceptable if guest explains delay. Document reason in booking notes.

**Q6: Can I reject a payment proof?**
A: Yes. Click "Reject" button, provide reason (e.g., "Screenshot unclear"), system notifies guest.

## Unit Assignment

**Q7: Why can't I assign just 2 units when guest requested 3?**
A: All-or-nothing rule ensures guest expectations are met. If insufficient units, contact guest with alternatives.

**Q8: What if I accidentally assign wrong units?**
A: Contact developer immediately. Unit reassignment requires database update (not self-service yet).

**Q9: Can I assign units before payment verification?**
A: No. System enforces payment-first rule. Verify payment button must be clicked first.

**Q10: What if two admins try to assign the same unit?**
A: Database prevents double-booking. Second admin will see error: "Unit already assigned for these dates."

## Guest Contact

**Q11: Should I call or SMS first?**
A: Try calling first. If no answer, send SMS with callback request. Document attempts in notes.

**Q12: What if guest requests date change after booking?**
A: Escalate to manager. Date changes require cancellation + new booking (no self-service edit yet).

**Q13: What language should I use with international guests?**
A: English for international guests. Tagalog/English mix OK for Filipino guests if they prefer.

## Technical Issues

**Q14: Dashboard won't load - what do I do?**
A: (1) Check internet connection, (2) Try different browser, (3) Clear cache, (4) Contact developer if persists.

**Q15: I see an error message - should I refresh?**
A: Screenshot error first, then refresh. If error persists after 2 refreshes, contact developer with screenshot.

---
Last Updated: $(date +%Y-%m-%d)
EOF

echo "✅ Admin FAQ created at: docs/implementation/guest-booking-multi-unit/admin-training/admin-faq.md"
```

#### Create Workflow Checklist (Printable)

```bash
cat > docs/implementation/guest-booking-multi-unit/admin-training/workflow-checklist.md <<'EOF'
# Daily Admin Workflow Checklist

**Date**: ____________  **Admin**: ____________

## Morning Routine (9:00 AM)
- [ ] Login to admin dashboard
- [ ] Check overnight bookings (sort queue by urgency)
- [ ] Review any system alerts/notifications
- [ ] Note: _____ pending bookings in queue

## Booking Processing (Ongoing)

### For Each Pending Booking:

**Step 1: Review Booking Details**
- [ ] Booking Reference: BK-______
- [ ] Guest Name: _____________
- [ ] Check-in: ______ Check-out: ______
- [ ] Requested Units: ____ | Total Guests: ____
- [ ] Total Amount: ₱_______ | Downpayment: ₱_______

**Step 2: Verify Payment**
- [ ] Payment proof uploaded and visible
- [ ] Amount matches downpayment: YES / NO
- [ ] Payment date within 48h: YES / NO
- [ ] Screenshot clear: YES / NO
- [ ] Transaction method visible: GCash / Bank / Cash
- [ ] **Action**: Mark as "Verified" ✓

**Step 3: Assign Units**
- [ ] Open availability calendar for dates
- [ ] Available units: ________________
- [ ] Selected units (must match requested count): ________________
- [ ] **Action**: Click "Assign Units" ✓

**Step 4: Contact Guest**
- [ ] Contact method: Phone / SMS / Both
- [ ] Call time: ______  Result: Answered / Voicemail / No Answer
- [ ] SMS sent: YES / NO | Time: ______
- [ ] Confirmation delivered: YES / PENDING
- [ ] **Action**: Document in booking notes ✓

**Step 5: Finalize**
- [ ] Booking status updated to "Confirmed"
- [ ] Notes documented
- [ ] Move to next booking

---

## Special Situations

### Insufficient Units Available
- [ ] Contact guest with alternatives
- [ ] Option 1 offered: _________________
- [ ] Option 2 offered: _________________
- [ ] Guest response: _________________
- [ ] Follow-up scheduled: ______

### Unclear Payment Proof
- [ ] Contacted guest requesting clearer proof
- [ ] Method: Phone / SMS
- [ ] New proof deadline: ______
- [ ] Status: PENDING / RESOLVED

### Guest Unreachable
- [ ] Call attempts: 1 / 2 / 3
- [ ] SMS sent: YES / NO
- [ ] Escalated to manager: YES / NO
- [ ] Follow-up time: ______

---

## End of Day (5:00 PM)
- [ ] Total bookings processed today: _____
- [ ] Remaining pending: _____
- [ ] High-urgency items for tomorrow: _____
- [ ] Issues to escalate: _______________

## Notes/Comments:
_______________________________________
_______________________________________
_______________________________________

---
Generated: $(date +%Y-%m-%d)
EOF

echo "✅ Workflow checklist created at: docs/implementation/guest-booking-multi-unit/admin-training/workflow-checklist.md"
echo "   Convert to PDF for printing using browser print function"
```

#### Video Walkthrough (Optional - Post-Deployment)

```bash
# Note: Creating a video walkthrough is optional and can be done post-deployment
# as admins gain hands-on experience with the system.

cat > docs/implementation/guest-booking-multi-unit/admin-training/video-walkthrough-script.md <<'EOF'
# Video Walkthrough Script (15 minutes)

**Status**: Optional - Can be recorded post-deployment with actual system footage

## Video Outline

**[0:00-1:00] Introduction**
- Welcome to multi-unit booking admin training
- System overview and benefits
- What you'll learn in this video

**[1:00-4:00] Navigating the Queue**
- Login and dashboard overview
- Understanding urgency scores
- Filtering and sorting bookings
- Demo: Finding high-urgency booking

**[4:00-7:00] Payment Verification**
- Opening booking details
- Reviewing payment proof
- Verification checklist
- Demo: Verify payment for sample booking

**[7:00-11:00] Unit Assignment**
- Opening availability calendar
- Selecting units (all-or-nothing rule)
- Confirming assignment
- Demo: Assign 3 units to sample booking

**[11:00-13:00] Guest Contact**
- Finding guest contact information
- Using confirmation script templates
- Documenting contact in notes
- Demo: Document guest contact

**[13:00-14:30] Handling Edge Cases**
- Insufficient units scenario
- Unclear payment proof handling
- Guest unreachable workflow

**[14:30-15:00] Wrap-up**
- Quick reference guide review
- Where to get help
- Q&A resources

## Recording Tips
- Use screen recording software (e.g., Loom, OBS)
- Record with actual production system (after go-live)
- Include voice narration
- Add captions for accessibility
- Upload to internal training portal

**Estimated Effort**: 2-3 hours (recording + editing)
EOF

echo "📹 Video walkthrough script created (optional, record post-deployment)"
echo "   Location: docs/implementation/guest-booking-multi-unit/admin-training/video-walkthrough-script.md"
```

**Summary of Created Materials**:

```bash
# List created files
ls -lh docs/implementation/guest-booking-multi-unit/admin-training/
# Expected output:
# - quick-reference-guide.md (to be converted to PDF)
# - admin-faq.md
# - workflow-checklist.md (to be converted to PDF)
# - video-walkthrough-script.md (optional)

echo "✅ Admin training materials prepared"
echo "📝 Next: Convert .md files to PDF using pandoc or browser print"
```

---

### Step 7.1: Prepare Training Environment (10 min)

```bash
# Create test bookings for training scenarios
psql $PRODUCTION_DB_URL <<EOF
-- Scenario 1: Standard 3-unit booking (all units available)
INSERT INTO bookings (guest_id, booking_reference, check_in_date, check_out_date,
  num_guests, total_amount, is_multi_unit, requested_unit_count,
  unit_assignment_status, payment_status, booking_status)
VALUES (
  (SELECT guest_id FROM guests LIMIT 1),
  'BK-TRAIN001',
  CURRENT_DATE + INTERVAL '30 days',
  CURRENT_DATE + INTERVAL '37 days',
  7,
  63000.00,
  TRUE,
  3,
  'pending',
  'Verified',
  'Pending'
) RETURNING booking_id AS scenario1_id;

-- Insert unit requests for scenario 1
INSERT INTO guest_booking_unit_requests (booking_id, guests_per_unit)
VALUES
  ((SELECT booking_id FROM bookings WHERE booking_reference = 'BK-TRAIN001'), 2),
  ((SELECT booking_id FROM bookings WHERE booking_reference = 'BK-TRAIN001'), 3),
  ((SELECT booking_id FROM bookings WHERE booking_reference = 'BK-TRAIN001'), 2);

-- Scenario 2: Booking with insufficient available units
-- (Requires admin to contact guest with alternatives)

-- Scenario 3: Booking with unclear payment proof
-- (Admin must request clearer proof)
EOF

echo "✅ Training scenarios created"
```

### Step 7.2: Conduct Training Session (1 hour 50 min)

**Training Agenda** (based on 06-migration-guide.md lines 1397-1676):

**[0:00-0:10] Introduction & System Overview**

- Multi-unit booking workflow overview
- Array-based model explanation (one card = one unit)
- Admin responsibilities and SLAs

**[0:10-0:30] Queue Management Demo**

- Navigate to pending bookings queue
- Explain urgency scoring (0-100 scale)
- Show filtering options (by date, status, urgency)
- Color-coded badges walkthrough (red = critical, yellow = high, green = low)

**[0:30-0:50] Payment Verification Walkthrough**

- Open booking with payment proof
- Review verification checklist:
  - [ ] Amount matches downpayment required
  - [ ] Payment date within 48 hours
  - [ ] Screenshot clear and legible
  - [ ] Transaction method visible (GCash/Bank/Cash)
- Mark payment as "Verified" in system
- What to do if proof is unclear (contact guest script)

**[0:50-1:10] Unit Assignment Hands-On**

- Open assignment modal for scenario 1
- Review guest requirements (3 units for 7 guests)
- Demonstrate availability calendar
- Select 3 available units
- Explain all-or-nothing rule (cannot assign 2 of 3)
- Click "Assign Units" and verify status change

**[1:10-1:30] Manual Contact Workflow**

- Show where guest contact info displayed
- Copy confirmation template from quick reference guide
- Personalize message with unit names and dates
- Explain when to call vs. SMS
- Document contact in booking notes field

**[1:30-1:50] Edge Case Scenarios**

- **Scenario 2**: Insufficient units available
  - Contact guest offering alternatives (different dates, fewer units)
- **Scenario 3**: Payment proof unclear
  - Request clearer proof using script template
- **Scenario 4**: Guest requests date change
  - Escalation procedure to manager

**[1:50-2:00] Q&A and Handoff**

- Address admin questions
- Confirm admin has access to:
  - [ ] Quick reference guide (PDF)
  - [ ] Admin FAQ (markdown doc)
  - [ ] Workflow checklist (printable)
  - [ ] Contact templates
- Admin signs training completion form

### Step 7.3: Validate Admin Readiness (10 min after training)

```bash
# Admin completes 3 independent practice scenarios without assistance:
# 1. Standard multi-unit booking (all steps)
# 2. Booking with insufficient units (contact guest)
# 3. Unclear payment proof (request new proof)

# Developer observes but does not intervene
# Admin must demonstrate:
# - Navigating queue by urgency
# - Verifying payment correctly
# - Assigning all requested units (not partial)
# - Documenting contact in notes
# - Using script templates appropriately
```

**Pass criteria**: Admin completes all 3 scenarios with zero critical errors (no partial assignments, no data corruption).

---

## Part 8: Post-Deployment Verification (10 minutes)

### Step 8.1: End-to-End Smoke Test (5 min)

```bash
# Test 1: Guest booking form loads
curl -s https://your-production-domain.com/guest-booking | grep "Select your dates"
# Expected: Match found (confirms form loaded)

# Test 2: Pricing preview endpoint
curl -X POST https://your-production-domain.com/api/guest-booking/preview-pricing \
  -H "Content-Type: application/json" \
  -d '{
    "unit_requests": [{"guests_per_unit": 2}, {"guests_per_unit": 3}],
    "check_in": "'$(date -u -d "+7 days" +%Y-%m-%dT14:00:00Z)'",
    "check_out": "'$(date -u -d "+14 days" +%Y-%m-%dT11:00:00Z)'"
  }'
# Expected: JSON with pricing breakdown and 5% discount (7 nights)

# Test 3: Create real test booking (use test Turnstile token)
# (Manual test in browser with actual form submission)

echo "✅ Smoke tests passed"
```

### Step 8.2: Monitoring Data Flow Validation (5 min)

```bash
# Check Grafana dashboard receiving data
# Navigate to: https://your-grafana-instance.com/d/your-dashboard-uid

# Verify panels updating:
# - Queue length showing current count
# - Assignment time graph showing data points
# - Success rate calculating correctly

# Check UptimeRobot monitors green
# Navigate to: https://uptimerobot.com/dashboard

# Verify all 3 monitors showing "Up" status
# - API Health: Green
# - Guest Booking Form: Green
# - Pricing API: Green

echo "✅ Monitoring operational"
```

---

## Done! 🎉

**Congratulations!** The multi-unit guest booking system is now live in production with operational monitoring.

### Final Checklist

- [x] Database migration successful (zero data loss)
- [x] Cloudflare Workers deployed (API + cron jobs)
- [x] Cloudflare Pages deployed (frontend)
- [x] Grafana Cloud dashboard live
- [x] UptimeRobot monitors active
- [x] Alert rules configured and tested
- [x] Admin training completed and signed off
- [x] Smoke tests passed
- [x] Monitoring ingesting data

### Post-Deployment Actions (Next 24 Hours)

1. **Monitor Grafana Dashboard**: Check every 4 hours for anomalies
2. **Watch Alert Channels**: Ensure email/Slack notifications working
3. **Admin Check-In**: 15-min session tomorrow to address questions
4. **First Real Booking**: Validate end-to-end with actual guest booking
5. **Performance Review**: Compare actual metrics to baseline

### First Week Actions

- [ ] **Day 2**: Admin check-in (15 min)
- [ ] **Day 3**: Review first 24h of metrics
- [ ] **Day 5**: Mid-week admin feedback session
- [ ] **Day 7**: Week 1 retrospective (What went well? What to improve?)

### Rollback Access

If critical issues occur requiring rollback:

**Emergency Rollback Script**: `database/migrations/rollback-020.sql`

**Rollback Decision Authority**:

- Production completely broken → Any senior developer can trigger
- Data corruption detected → Database admin + senior developer required
- Minor bugs → Fix with hotfix (no rollback)

**Target Rollback Time**: <1 hour (as tested in chunk 016)

---

### Support Contacts

- **Technical Issues**: Developer on-call (Slack: @dev-channel)
- **Admin Training Questions**: Product Manager (Email: pm@example.com)
- **Emergency Rollback**: Database Admin (Phone: +1-XXX-XXX-XXXX)

---

**Next Steps**: Proceed to `checkpoint.md` to verify all deployment steps completed successfully.
