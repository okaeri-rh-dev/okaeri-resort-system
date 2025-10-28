# Deployment Procedure

**Last Updated**: 2025-10-28
**Chunks Covered**: 001-012 (Phases 1-3 partial complete)
**Estimated Time**: 90-120 minutes
**Difficulty**: Intermediate

---

## Overview

This document provides step-by-step instructions for deploying the multi-unit guest booking system to production. Follow each phase sequentially.

**Prerequisites**: Complete ALL items in `pre-deployment.md` before proceeding.

---

## Deployment Phases

1. **Phase 1**: Database Migration (20-30 minutes)
2. **Phase 2**: Supabase Storage Setup (10-15 minutes)
3. **Phase 3**: Cloudflare Configuration (15-20 minutes)
4. **Phase 4**: Frontend & Workers Deployment (20-25 minutes)
5. **Phase 5**: Smoke Tests (25-30 minutes)

**Total Estimated Time**: 90-120 minutes

---

## Phase 1: Database Migration

### Step 1.1: Create Database Backup

**Purpose**: Safety net for rollback if migration fails

```bash
# Set connection string (replace with your production values)
export DATABASE_URL="postgresql://postgres:[PASSWORD]@db.YOUR_PROJECT.supabase.co:5432/postgres"

# Create backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql

# Verify backup created
ls -lh backup-*.sql
```

**Expected Output**:

```
-rw-r--r-- 1 user staff 2.3M Jan 27 14:30 backup-20250127-143045.sql
```

**Checkpoint**: ✅ Backup file exists and has non-zero size

---

### Step 1.2: Run Migration 021 (Multi-Unit Schema)

**Purpose**: Create new tables and extend bookings table

```bash
# Navigate to project root
cd /path/to/okaeri-resort-system

# Run migration
psql $DATABASE_URL -f database/migrations/021-multi-unit-guest-booking-schema.sql
```

**Expected Output** (truncated):

```
BEGIN
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
ALTER TABLE
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
...
COMMIT
```

**Verify Migration Success**:

```bash
psql $DATABASE_URL -c "
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('pricing_config', 'guest_booking_unit_requests', 'discount_rules', 'idempotency_keys');
"
```

**Expected Output**:

```
          table_name
-------------------------------
 discount_rules
 guest_booking_unit_requests
 idempotency_keys
 pricing_config
(4 rows)
```

**Checkpoint**: ✅ All 4 new tables exist

---

### Step 1.3: Run Migration 022 (Security & Audit)

**Purpose**: Add security constraints and audit logging

```bash
psql $DATABASE_URL -f database/migrations/022-security-constraints-audit.sql
```

**Expected Output**:

```
BEGIN
ALTER TABLE
CREATE FUNCTION
CREATE TRIGGER
CREATE TABLE
CREATE POLICY
...
COMMIT
```

**Verify Constraints**:

```bash
psql $DATABASE_URL -c "
  SELECT conname FROM pg_constraint
  WHERE conrelid = 'booking_units'::regclass
    AND conname = 'no_double_booking';
"
```

**Expected Output**:

```
     conname
------------------
 no_double_booking
(1 row)
```

**Checkpoint**: ✅ EXCLUDE constraint exists

---

### Step 1.4: Run Migration 022a (Security Fixes)

**Purpose**: Fix critical security issues identified in code review

```bash
psql $DATABASE_URL -f database/migrations/022a-fix-critical-security-issues.sql
```

**Expected Output**:

```
BEGIN
CREATE FUNCTION (get_sensitive_fields)
ALTER TABLE
DROP TRIGGER
CREATE TRIGGER
...
COMMIT
```

**Verify Fixes**:

```bash
psql $DATABASE_URL -c "
  SELECT routine_name FROM information_schema.routines
  WHERE routine_schema = 'public'
    AND routine_name = 'get_sensitive_fields';
"
```

**Expected Output**:

```
      routine_name
-----------------------
 get_sensitive_fields
(1 row)
```

**Checkpoint**: ✅ Security fix functions deployed

---

### Step 1.5: Run Migration 023 (Cleanup Functions)

**Purpose**: Add automated cleanup for idempotency keys and payment proofs

```bash
psql $DATABASE_URL -f database/migrations/023-cleanup-functions.sql
```

**Expected Output**:

```
BEGIN
CREATE FUNCTION (cleanup_expired_idempotency_keys)
COMMENT
CREATE FUNCTION (cleanup_expired_payment_proofs)
COMMENT
CREATE INDEX (idx_idempotency_expiry)
COMMENT
DO (Verification: Both cleanup functions created successfully)
DO (Verification: cleanup_expired_idempotency_keys() returned 0)
DO (Verification: cleanup_expired_payment_proofs() returned ...)
DO (Verification: Index idx_idempotency_expiry exists)
COMMIT
```

**Verify Functions**:

```bash
psql $DATABASE_URL -c "
  SELECT routine_name, routine_type
  FROM information_schema.routines
  WHERE routine_schema = 'public'
    AND routine_name IN ('cleanup_expired_idempotency_keys', 'cleanup_expired_payment_proofs')
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

**Test Function Execution**:

```bash
# Test idempotency cleanup (should return 0 if no expired keys)
psql $DATABASE_URL -c "SELECT cleanup_expired_idempotency_keys();"

# Test payment proof cleanup (should return JSONB)
psql $DATABASE_URL -c "SELECT cleanup_expired_payment_proofs();"
```

**Checkpoint**: ✅ Both functions execute without errors

---

### Step 1.6: Seed Default Data (Optional but Recommended)

**Purpose**: Populate pricing_config and discount_rules with default values

```bash
# Create seed file (if not exists)
cat > database/seeds/001-default-pricing.sql << 'EOF'
-- Seed default pricing configuration
INSERT INTO pricing_config (
  base_rate_per_night,
  weekend_rate_per_night,
  extra_person_fee_per_night,
  max_capacity_per_unit,
  max_units_per_booking,
  created_at,
  updated_at
) VALUES (
  2000.00,  -- ₱2,000 base rate
  2500.00,  -- ₱2,500 weekend rate (Friday-Saturday)
  500.00,   -- ₱500 per extra person
  4,        -- Max 4 people per unit
  10,       -- Max 10 units per booking
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- Seed default discount rules
INSERT INTO discount_rules (rule_name, discount_type, discount_percent, conditions, is_active, priority)
VALUES
  ('7-Night Stay', 'duration', 10, '{"min_nights": 7}', true, 100),
  ('14-Night Stay', 'duration', 15, '{"min_nights": 14}', true, 90),
  ('Early Bird (30 days)', 'advance_booking', 12, '{"lead_days": 30}', true, 80),
  ('Group Booking (5+ units)', 'unit_count', 8, '{"min_units": 5}', true, 70)
ON CONFLICT (rule_name) DO NOTHING;
EOF

# Run seed
psql $DATABASE_URL -f database/seeds/001-default-pricing.sql
```

**Verify Seed**:

```bash
psql $DATABASE_URL -c "SELECT * FROM pricing_config;"
psql $DATABASE_URL -c "SELECT rule_name, discount_percent, is_active FROM discount_rules;"
```

**Checkpoint**: ✅ Default pricing and 4 discount rules exist

---

## Phase 2: Supabase Storage Setup (Chunk 008)

### Step 2.1: Create Storage Bucket

**Purpose**: Set up private bucket for payment proof uploads

```bash
# Open Supabase Dashboard
# Navigate to: Storage > Create a new bucket

# Or via SQL Editor:
psql $DATABASE_URL -c "
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('booking-files', 'booking-files', false)
  ON CONFLICT (id) DO NOTHING;
"
```

**Verify Bucket Creation**:

```bash
psql $DATABASE_URL -c "
  SELECT id, name, public FROM storage.buckets WHERE id = 'booking-files';
"
```

**Expected Output**:

```
     id      |     name      | public
-------------+---------------+--------
 booking-files | booking-files | f
(1 row)
```

**Checkpoint**: ✅ Bucket exists and is private (public = false)

---

### Step 2.2: Configure RLS Policies

**Purpose**: Allow signed uploads from API, authenticated reads for admin

```bash
psql $DATABASE_URL << 'EOF'
-- Policy 1: Allow signed uploads (from upload-url API)
CREATE POLICY "Allow signed uploads"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'booking-files' AND
    (storage.foldername(name))[1] = 'payment-proofs'
  );

-- Policy 2: Allow authenticated reads (admin dashboard)
CREATE POLICY "Allow authenticated reads"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'booking-files');

-- Policy 3: Block direct deletion (cleanup cron only)
CREATE POLICY "Block direct deletion"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (false);
EOF
```

**Verify Policies**:

```bash
psql $DATABASE_URL -c "
  SELECT policyname, cmd, qual
  FROM pg_policies
  WHERE tablename = 'objects'
    AND policyname LIKE '%signed%' OR policyname LIKE '%authenticated%';
"
```

**Checkpoint**: ✅ 3 RLS policies created

---

### Step 2.3: Configure CORS

**Via Supabase Dashboard**:

1. Open Supabase Dashboard
2. Navigate to: **Storage** > **Configuration** > **CORS**
3. Add allowed origins:
   - `http://localhost:5173` (development)
   - `https://okaeri-resort-system.pages.dev` (production)
4. Allowed methods: `GET, POST, PUT, DELETE, HEAD, OPTIONS`
5. Allowed headers: `*`
6. Max age: `3600`

**Checkpoint**: ✅ CORS configured for frontend domains

---

## Phase 3: Cloudflare Configuration

### Step 3.1: Create KV Namespace

**Skip if already created in pre-deployment**

```bash
# Create production namespace
npx wrangler kv:namespace create "RATE_LIMIT_KV" --env production

# Expected output:
# 🌀 Creating namespace with title "okaeri-resort-system-RATE_LIMIT_KV"
# ✨ Success! Add the following to your wrangler.toml:
# [[env.production.kv_namespaces]]
# binding = "RATE_LIMIT_KV"
# id = "98171af1c3bd4f718ff86c1f966c64a5"
```

**Update wrangler.toml** with the returned ID:

```toml
[[env.production.kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "YOUR_ACTUAL_ID_FROM_OUTPUT"  # Replace with actual ID
```

**Checkpoint**: ✅ KV namespace ID in wrangler.toml

---

### Step 3.2: Set Environment Variables

**Set Cloudflare Pages environment variables** via dashboard:

1. Open Cloudflare dashboard
2. Navigate to: **Workers & Pages** > **okaeri-resort-system** > **Settings** > **Environment Variables**
3. Click **"Add variables"**
4. Add the following **Production** variables:

| Variable Name             | Value                                    | Type       |
| ------------------------- | ---------------------------------------- | ---------- |
| `VITE_SUPABASE_URL`       | `https://YOUR_PROJECT.supabase.co`       | Plain text |
| `VITE_SUPABASE_ANON_KEY`  | `sb_publishable_...`                     | Plain text |
| `VITE_APP_ENV`            | `production`                             | Plain text |
| `VITE_APP_URL`            | `https://okaeri-resort-system.pages.dev` | Plain text |
| `VITE_TURNSTILE_SITE_KEY` | `0x4AAAAAAB...`                          | Plain text |
| `VITE_OWNER_EMAILS`       | `your-email@example.com`                 | Plain text |

**Checkpoint**: ✅ 6 environment variables set in dashboard

---

### Step 3.3: Set Secrets (via Wrangler CLI)

**Set sensitive secrets** (never commit these):

```bash
# Set Supabase service role key
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production
# Paste key when prompted: sb_secret_...

# Set Turnstile secret key
npx wrangler secret put TURNSTILE_SECRET_KEY --env production
# Paste key when prompted: 0x4AAAAAAB...

# Set Resend API key
npx wrangler secret put RESEND_API_KEY --env production
# Paste key when prompted: re_...
```

**Verify Secrets**:

```bash
npx wrangler secret list --env production
```

**Expected Output**:

```
{
  "SUPABASE_SERVICE_ROLE_KEY": "••••••••",
  "TURNSTILE_SECRET_KEY": "••••••••",
  "RESEND_API_KEY": "••••••••"
}
```

**Checkpoint**: ✅ All 3 secrets set and listed

---

### Step 3.4: Configure Cron Triggers

**Verify wrangler.toml** has cron triggers:

```toml
[triggers]
crons = [
  "0 2 * * *",   # Daily 2:00 AM UTC: Cleanup expired idempotency keys
  "0 3 * * 0"    # Weekly Sunday 3:00 AM UTC: Cleanup expired payment proofs
]
```

**Note**: Cron triggers are deployed with the next Workers deployment (Step 3.2)

**Checkpoint**: ✅ Cron triggers in wrangler.toml

---

## Phase 4: Frontend & Workers Deployment

### Step 4.1: Build Project

**Build both frontend (with chunks 006-012 components) and Workers**

```bash
# Clean previous build
npm run clean

# Install dependencies (if not already)
npm install

# Run full build
npm run build:full
```

**Expected Output**:

```
> vite build

vite v7.0.0 building for production...
✓ 1234 modules transformed.
dist/index.html                   0.45 kB │ gzip:  0.30 kB
dist/assets/index-a1b2c3d4.js  123.45 kB │ gzip: 45.67 kB
✓ built in 12.34s

> rm -rf dist/functions && cp -r functions dist/functions

Build complete!
```

**Verify Build Output**:

```bash
ls -la dist/
ls -la dist/functions/
```

**Expected Files**:

- `dist/index.html`
- `dist/assets/` (CSS and JS bundles)
- `dist/functions/_worker.ts`
- `dist/functions/api/guest-booking/` (API endpoints)
- `dist/functions/api/admin/` (Admin API endpoints - chunks 012)
- `dist/functions/scheduled/` (Cron workers)
- `dist/public/pdf.worker.js` (PDF viewer worker - chunk 012)

**Checkpoint**: ✅ Build succeeds, dist/ populated

---

### Step 4.2: Deploy to Cloudflare Pages

**Deploy to production**:

```bash
npx wrangler pages deploy dist --env production
```

**Expected Output**:

```
🌎 Uploading... (123/123)

✨ Success! Uploaded 123 files (4.56 seconds)

✨ Deployment complete! Take a peek over at https://abc12345.okaeri-resort-system.pages.dev
```

**Get Production URL**:

```bash
npx wrangler pages deployment list
```

**Expected Output**:

```
Created:     2025-01-27 14:45:23
Environment: production
Deployment:  abc12345-def67890
URL:         https://okaeri-resort-system.pages.dev
```

**Checkpoint**: ✅ Deployment URL accessible

---

### Step 4.3: Verify Cron Triggers in Dashboard

1. Open Cloudflare dashboard
2. Navigate to: **Workers & Pages** > **okaeri-resort-system** > **Triggers**
3. Scroll to **"Cron Triggers"** section

**Expected**:

- ✅ 2 cron triggers listed:
  - `0 2 * * *` (Daily at 2 AM UTC)
  - `0 3 * * 0` (Weekly Sunday at 3 AM UTC)
- ✅ Both show "Active" status
- ✅ Last run: "Never" or timestamp if manually triggered

**Checkpoint**: ✅ Cron triggers visible and active

---

### Step 4.4: Bind KV Namespace to Worker (Dashboard)

**Verify KV binding** via dashboard:

1. Open Cloudflare dashboard
2. Navigate to: **Workers & Pages** > **okaeri-resort-system** > **Settings** > **Bindings**
3. Look for **"KV Namespace Bindings"**

**Expected**:

- Binding name: `RATE_LIMIT_KV`
- KV Namespace: `okaeri-resort-system-RATE_LIMIT_KV`
- Environment: Production

**If missing**, add manually:

1. Click **"Add binding"**
2. Type: KV Namespace
3. Variable name: `RATE_LIMIT_KV`
4. Select namespace from dropdown
5. Click **"Save"**

**Checkpoint**: ✅ KV namespace bound to Worker

---

## Phase 5: Smoke Tests

### Step 5.1: Test Health Endpoint

**Verify Workers are running**:

```bash
curl -I https://okaeri-resort-system.pages.dev/health
```

**Expected Output**:

```
HTTP/2 200
content-type: application/json
...
```

**Checkpoint**: ✅ Health endpoint returns 200 OK

---

### Step 5.2: Test Rates Endpoint

**Get pricing configuration**:

```bash
curl -s https://okaeri-resort-system.pages.dev/api/guest-booking/rates | jq
```

**Expected Output**:

```json
{
  "base_rate_per_night": 2000,
  "weekend_rate_per_night": 2500,
  "extra_person_fee_per_night": 500,
  "max_capacity_per_unit": 4,
  "max_units_per_booking": 10
}
```

**Checkpoint**: ✅ Rates endpoint returns pricing data

---

### Step 5.3: Test Discount Rules Endpoint

**Get active discounts**:

```bash
curl -s https://okaeri-resort-system.pages.dev/api/guest-booking/discount-rules | jq
```

**Expected Output**:

```json
[
  {
    "rule_id": "...",
    "rule_name": "7-Night Stay",
    "discount_type": "duration",
    "discount_percent": 10,
    "conditions": {"min_nights": 7},
    "is_active": true,
    "priority": 100
  },
  ...
]
```

**Checkpoint**: ✅ Discount rules endpoint returns 4 rules

---

### Step 5.4: Test Pricing Preview Endpoint

**Calculate pricing for sample booking**:

```bash
curl -X POST https://okaeri-resort-system.pages.dev/api/guest-booking/preview-pricing \
  -H "Content-Type: application/json" \
  -d '{
    "check_in": "2025-06-01",
    "check_out": "2025-06-08",
    "unit_requests": [
      {"guests_per_unit": 2},
      {"guests_per_unit": 4}
    ]
  }' | jq
```

**Expected Output**:

```json
{
  "base_total": 28000,
  "weekend_surcharge": 2000,
  "extra_person_fees": 7000,
  "subtotal": 37000,
  "discount_percent": 10,
  "discount_amount": 3700,
  "final_total": 33300,
  "applied_discount": {
    "rule_name": "7-Night Stay",
    "discount_percent": 10
  }
}
```

**Checkpoint**: ✅ Pricing preview calculates correctly

---

### Step 5.5: Test Rate Limiting

**Verify rate limiting blocks 6th request**:

```bash
# Make 6 rapid requests
for i in {1..6}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    https://okaeri-resort-system.pages.dev/api/guest-booking/multi-unit \
    -H "Content-Type: application/json" \
    -d '{"test": "rate_limit"}')

  echo "Request $i: HTTP $STATUS"
done
```

**Expected Output**:

```
Request 1: HTTP 403 (Turnstile missing)
Request 2: HTTP 403
Request 3: HTTP 403
Request 4: HTTP 403
Request 5: HTTP 403
Request 6: HTTP 429 (Rate limit exceeded)
```

**Checkpoint**: ✅ 6th request returns 429 status

---

### Step 5.6: Test Turnstile Verification

**Verify invalid token is rejected**:

```bash
curl -X POST https://okaeri-resort-system.pages.dev/api/guest-booking/multi-unit \
  -H "Content-Type: application/json" \
  -d '{
    "guest_name": "Test",
    "turnstile_token": "invalid_token_12345"
  }' | jq '.error'
```

**Expected Output**:

```json
"CAPTCHA verification failed"
```

**Checkpoint**: ✅ Invalid Turnstile token rejected

---

### Step 5.7: Test Frontend Routes (Chunks 006-012)

**Test guest booking flow UI**:

```bash
# Open browser to production URL
open https://okaeri-resort-system.pages.dev/guest-booking

# Manual checklist:
# 1. DateRangePicker loads and calendar opens
# 2. UnitRequestSelector allows adding/removing units (max 10)
# 3. PaymentSummary displays pricing preview
# 4. PaymentProofUpload shows drop zone
# 5. FormStepIndicator shows 5 steps
# 6. BookingReviewStep shows Turnstile CAPTCHA
# 7. Form submission creates booking
# 8. Redirects to /booking-confirmation/$bookingReference
# 9. Confirmation page displays booking details
# 10. Print button triggers @media print styles
```

**Checkpoint**: ✅ All 10 frontend UI elements functional

---

### Step 5.8: Test Storage Upload (Chunk 008)

**Test payment proof upload**:

```bash
# Test upload URL generation
curl -X POST https://okaeri-resort-system.pages.dev/api/guest-booking/upload-url \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "payment-proof-test.jpg",
    "contentType": "image/jpeg",
    "fileSizeBytes": 1048576
  }'

# Expected response:
# {
#   "uploadUrl": "https://YOUR_PROJECT.supabase.co/storage/v1/object/upload/sign/...",
#   "fileUrl": "payment-proofs/BK-TEMP-..."
# }
```

**Verify file uploaded**:

```bash
psql $DATABASE_URL -c "
  SELECT name, bucket_id, created_at
  FROM storage.objects
  WHERE bucket_id = 'booking-files'
  ORDER BY created_at DESC
  LIMIT 5;
"
```

**Checkpoint**: ✅ Upload URL generated, file uploaded to storage

---

### Step 5.9: Test Admin Payment Verification (Chunk 012)

**Test admin endpoints** (requires JWT authentication):

```bash
# Get pending booking details
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://okaeri-resort-system.pages.dev/api/admin/bookings/BOOKING_ID

# Verify payment
curl -X POST -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://okaeri-resort-system.pages.dev/api/admin/verify-payment \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": "BOOKING_ID",
    "action": "verify",
    "admin_notes": "Payment verified via test"
  }'
```

**Verify in database**:

```bash
psql $DATABASE_URL -c "
  SELECT booking_reference, payment_status, updated_at
  FROM bookings
  WHERE id = 'BOOKING_ID';
"
```

**Checkpoint**: ✅ Admin can verify/reject payments

---

### Step 5.10: Manually Trigger Cron (Optional)

**Test cron execution** via dashboard:

1. Open Cloudflare dashboard
2. Navigate to: **Workers & Pages** > **okaeri-resort-system** > **Triggers**
3. Click **"Run Cron Trigger"** next to `0 2 * * *`
4. Check **Logs** tab for output

**Expected Log Output**:

```
[CRON] Starting scheduled task: 0 2 * * *
[CRON] Idempotency cleanup completed: 0 expired keys removed
[CRON] Completed: 0 2 * * *
```

**Checkpoint**: ✅ Cron executes without errors

---

## Rollback Procedures

### Rollback Scenario 1: Database Migration Failed

**Symptoms**: Migration script errors, database in inconsistent state

**Solution**:

```bash
# Restore from backup
psql $DATABASE_URL < backup-20250127-143045.sql

# Verify restoration
psql $DATABASE_URL -c "SELECT COUNT(*) FROM bookings;"
```

---

### Rollback Scenario 2: Workers Deployment Failed

**Symptoms**: 500 errors, Workers not responding

**Solution**:

```bash
# List recent deployments
npx wrangler pages deployment list

# Rollback to previous deployment
npx wrangler pages deployment rollback <DEPLOYMENT_ID>
```

---

### Rollback Scenario 3: Cron Not Executing

**Symptoms**: Cron triggers show "Failed" status

**Solution**:

1. Check Wrangler secrets are set: `npx wrangler secret list --env production`
2. Verify `_worker.ts` exports `scheduled()` function
3. Check Supabase credentials in secrets
4. Review cron execution logs for specific error

**Temporary Mitigation**:

```bash
# Manually run cleanup functions
psql $DATABASE_URL -c "SELECT cleanup_expired_idempotency_keys();"
psql $DATABASE_URL -c "SELECT cleanup_expired_payment_proofs();"
```

---

## Deployment Completion Checklist

Before considering deployment complete:

- [ ] All 4 database migrations applied successfully
- [ ] PostgreSQL functions execute without errors
- [ ] Cloudflare Pages deployment URL accessible
- [ ] KV namespace bound to Worker
- [ ] All 3 Wrangler secrets set
- [ ] Cron triggers visible in dashboard
- [ ] Health endpoint returns 200 OK
- [ ] Rates endpoint returns pricing data
- [ ] Discount rules endpoint returns 4 rules
- [ ] Pricing preview calculates correctly
- [ ] Rate limiting blocks 6th request (429)
- [ ] Invalid Turnstile token rejected (403)
- [ ] Cron manually triggered without errors (optional)

**If all checked**: ✅ **Deployment Successful!**

**Next Step**: Proceed to `post-deployment.md` for monitoring and ongoing maintenance.

---

## Troubleshooting Common Deployment Issues

### Issue: "Migration fails with duplicate table error"

**Solution**: Tables already exist from previous migration attempt

```bash
# Check existing tables
psql $DATABASE_URL -c "\dt"

# If tables exist, skip migration or use DROP TABLE first (dangerous)
```

### Issue: "Wrangler secret put fails"

**Solution**: Not authenticated to Cloudflare

```bash
# Login to Wrangler
npx wrangler login

# Retry setting secrets
```

### Issue: "Cron triggers not appearing"

**Solution**: Triggers deploy with Workers, not immediately

```bash
# Re-deploy Workers
npx wrangler pages deploy dist --env production

# Check dashboard after 2-3 minutes
```

### Issue: "Rate limiting not working"

**Solution**: KV namespace not bound or wrong ID

```bash
# Verify KV ID in wrangler.toml matches dashboard
npx wrangler kv:namespace list

# Update wrangler.toml if IDs don't match
```

---

**Document Status**: Living document, updated with each chunk completion
**Current Coverage**: Chunks 001-012 (Phases 1-2 complete, Phase 3 partial)
**Next Update**: Chunk 013 will add unit assignment deployment steps
