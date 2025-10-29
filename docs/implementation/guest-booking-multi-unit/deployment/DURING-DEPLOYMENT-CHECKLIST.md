# Multi-Unit Guest Booking System - During Deployment Checklist

**Last Updated**: 2025-10-29
**Covers**: Chunks 001-013 (Phase 1-3 Complete)
**Estimated Time**: 60-90 minutes (full deployment)
**Purpose**: Step-by-step deployment execution

---

## Overview

This checklist provides sequential deployment steps for the multi-unit guest booking system. Execute phases in order. Do NOT skip steps.

**Critical**: Create database backup before starting (see PRE-DEPLOYMENT-CHECKLIST.md)

---

## Deployment Workflow

```
Phase 1: Database (30 min) → Phase 2: Backend API (20 min) → Phase 3: Frontend (15 min) → Phase 4: Admin (15 min)
```

---

## 🗄️ Phase 1: Database Deployment (30 minutes)

**Chunks**: 001, 002, 003, 013

### Step 1.1: Apply Database Migrations (15 min)

**⚠️ CRITICAL**: Apply migrations in chronological order

#### Migration 1: Multi-Unit Schema (Chunk 001)

**File**: `supabase/migrations/20251008152700_multi_unit_schema.sql` (or equivalent)

**Method A: Supabase Dashboard** (RECOMMENDED)

1. Navigate to: `https://supabase.com/dashboard/project/[PROJECT_ID]/sql/new`
2. Copy migration SQL:
   ```bash
   cat supabase/migrations/20251008152700_multi_unit_schema.sql
   ```
3. Paste into SQL Editor
4. Click "Run"
5. **Verify**: Success message appears, no errors

**Method B: Supabase CLI**

```bash
# Authenticate (if not already)
npx supabase login

# Link project (if not already)
npx supabase link --project-ref [PROJECT_REF]

# Apply migration
npx supabase db push --include-all
```

**Tables Created** (Chunk 001):

- `pricing_config` (singleton)
- `guest_booking_unit_requests`
- `discount_rules` (with 4 default rules)
- `idempotency_keys`
- Extended `bookings` table (9 new columns)

**Functions Created** (Chunk 001):

- `calculate_booking_pricing()` (placeholder, replaced in chunk 002)
- `create_guest_booking()`
- `assign_units_to_booking()` (placeholder, replaced in chunk 013)

**Verification**:

```sql
-- Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('pricing_config', 'guest_booking_unit_requests', 'discount_rules', 'idempotency_keys');
-- Expected: 4 rows

-- Check pricing_config has default config
SELECT * FROM pricing_config WHERE id = 'default';
-- Expected: 1 row with base rates

-- Check discount_rules populated
SELECT COUNT(*) FROM discount_rules;
-- Expected: 4 (or more) rows
```

---

#### Migration 2: Security, RLS, Constraints (Chunk 003)

**File**: `supabase/migrations/[DATE]_security_rls_constraints.sql`

**Execute**:

```bash
# Copy SQL from migration file
cat supabase/migrations/*security*.sql
# Paste in Supabase Dashboard SQL Editor → Run
```

**Features Added**:

- `audit_logs` table
- `audit_log_trigger()` function (SECURITY DEFINER)
- Triggers on bookings, booking_units, payments
- RLS policies for audit_logs
- EXCLUDE constraint `no_double_booking` on `booking_units`
- CHECK constraints: `all_or_nothing_assignment`, `payment_before_assignment`

**Verification**:

```sql
-- Check audit_logs table exists
SELECT table_name FROM information_schema.tables WHERE table_name = 'audit_logs';
-- Expected: 1 row

-- Check EXCLUDE constraint exists
SELECT conname, contype
FROM pg_constraint
WHERE conname = 'no_double_booking' AND conrelid = 'booking_units'::regclass;
-- Expected: 1 row, contype = 'x' (EXCLUDE)

-- Check btree_gist extension enabled
SELECT * FROM pg_extension WHERE extname = 'btree_gist';
-- Expected: 1 row

-- Check audit trigger attached to bookings
SELECT tgname, tgrelid::regclass
FROM pg_trigger
WHERE tgname LIKE 'audit%' AND tgrelid = 'bookings'::regclass;
-- Expected: At least 1 row
```

---

#### Migration 3: Updated Pricing Engine (Chunk 002)

**File**: Database migration embedded in chunk 001 (function replacement)

**Note**: `calculate_booking_pricing()` function was replaced in-place during chunk 002 implementation.

**Verification**:

```sql
-- Check pricing function exists with full implementation
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'calculate_booking_pricing';
-- Expected: Function definition includes discount logic, weekend surcharge, extra person fees

-- Test pricing function (single unit, 3 nights, 4 guests)
SELECT calculate_booking_pricing(
  check_in_date := '2025-12-10',
  check_out_date := '2025-12-13',
  requested_units := ARRAY[ROW(4)::guest_booking_unit_request_type]
);
-- Expected: JSON with breakdown showing base_rate, weekend_surcharge, total_amount, etc.
```

---

#### Migration 4: Unit Assignment Function (Chunk 013)

**File**: `supabase/migrations/20251028154441_assign_units_function.sql`

**Execute**:

```bash
cat supabase/migrations/20251028154441_assign_units_function.sql
# Paste in Supabase Dashboard SQL Editor → Run
```

**Features Added**:

- Replaced `assign_units_to_booking()` function (full implementation)
- Added `check_units_available_for_booking()` helper function
- Created performance indexes:
  - `idx_booking_units_dates_status`
  - `idx_bookings_assignment_status`
  - `idx_guest_booking_unit_requests_booking_id`

**Verification**:

```sql
-- Check assign_units_to_booking function exists
SELECT proname, pg_get_function_arguments(oid)
FROM pg_proc
WHERE proname = 'assign_units_to_booking';
-- Expected: 1 row, arguments = p_booking_id uuid, p_unit_ids uuid[]

-- Check helper function exists
SELECT proname FROM pg_proc WHERE proname = 'check_units_available_for_booking';
-- Expected: 1 row

-- Check indexes created
SELECT indexname FROM pg_indexes
WHERE indexname IN (
  'idx_booking_units_dates_status',
  'idx_bookings_assignment_status',
  'idx_guest_booking_unit_requests_booking_id'
);
-- Expected: 3 rows
```

---

### Step 1.2: Verify RLS Policies (5 min)

```sql
-- Check RLS enabled on critical tables
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('bookings', 'booking_units', 'audit_logs', 'payments')
  AND schemaname = 'public';
-- Expected: All rows have rowsecurity = true

-- Check audit_logs RLS policies
SELECT policyname, roles, cmd
FROM pg_policies
WHERE tablename = 'audit_logs';
-- Expected: Policies for admin, service_role, and public (SELECT only)
```

---

### Step 1.3: Test PostgreSQL Functions (10 min)

#### Test Pricing Engine (Chunk 002)

```sql
-- Test single-unit pricing
SELECT calculate_booking_pricing(
  check_in_date := '2025-12-15',
  check_out_date := '2025-12-18',
  requested_units := ARRAY[ROW(2)::guest_booking_unit_request_type]
);
-- Expected: JSON with total_amount > 0

-- Test multi-unit pricing
SELECT calculate_booking_pricing(
  check_in_date := '2025-12-20',
  check_out_date := '2025-12-23',
  requested_units := ARRAY[
    ROW(4)::guest_booking_unit_request_type,
    ROW(4)::guest_booking_unit_request_type,
    ROW(2)::guest_booking_unit_request_type
  ]
);
-- Expected: JSON with 3 units, total_amount = sum of all units
```

#### Test Unit Assignment (Chunk 013)

```sql
-- Test with dummy data (will fail gracefully with "booking not found")
SELECT assign_units_to_booking(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  ARRAY['bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid]
);
-- Expected: ERROR "Booking aaaaaaaa-... not found" (confirms function works)
```

---

## 🔌 Phase 2: Backend API Deployment (20 minutes)

**Chunks**: 004, 005, 008, 011, 012, 013

### Step 2.1: Configure Cloudflare Workers (5 min)

**Update `wrangler.toml`**:

```toml
name = "okaeri-resort-api"
main = "functions/_worker.ts"
compatibility_date = "2024-01-01"

[vars]
SUPABASE_URL = "https://[PROJECT_REF].supabase.co"
# Do NOT put sensitive keys here - use secrets

[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "[YOUR_KV_NAMESPACE_ID]"  # From Cloudflare dashboard

[[r2_buckets]]
binding = "PAYMENT_PROOFS"
bucket_name = "payment-proofs"  # Created in PRE-DEPLOYMENT
```

**Set Secrets**:

```bash
# Supabase service role key (for admin operations)
wrangler secret put SUPABASE_SERVICE_KEY
# Paste your Supabase service role key when prompted

# R2 access credentials
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
```

---

### Step 2.2: Deploy Cloudflare Workers (5 min)

```bash
# Deploy Workers
wrangler deploy

# Expected output:
# ✨ Built successfully
# ✨ Uploaded successfully
# ✨ Deployment complete
# 📡 https://okaeri-resort-api.your-subdomain.workers.dev
```

**Verify Deployment**:

```bash
# Test health endpoint (if implemented)
curl https://okaeri-resort-api.your-subdomain.workers.dev/api/health

# Expected: {"status": "ok"} or similar
```

---

### Step 2.3: Test API Endpoints (10 min)

**Set environment variable for testing**:

```bash
export API_URL="https://okaeri-resort-api.your-subdomain.workers.dev"
export ADMIN_JWT="your-admin-jwt-token"  # From PRE-DEPLOYMENT
```

#### Test Guest Booking API (Chunk 004)

```bash
# Test guest booking creation
curl -X POST "$API_URL/api/guest-booking" \
  -H "Content-Type: application/json" \
  -d '{
    "check_in_date": "2025-12-10",
    "check_out_date": "2025-12-13",
    "guest_name": "Test Guest",
    "email": "test@example.com",
    "phone_number": "+639171234567",
    "requested_units": [{"guests_per_unit": 4}]
  }'

# Expected: 201 Created, JSON with booking_id and booking_reference
```

#### Test Admin Pending Bookings (Chunk 011)

```bash
# Test admin queue API
curl -X GET "$API_URL/api/admin/pending-bookings" \
  -H "Authorization: Bearer $ADMIN_JWT"

# Expected: 200 OK, JSON with bookings array (or empty array)
```

#### Test Available Units (Chunk 013)

```bash
# Test available units API
curl -X GET "$API_URL/api/admin/available-units?check_in=2025-12-01&check_out=2025-12-08" \
  -H "Authorization: Bearer $ADMIN_JWT"

# Expected: 200 OK, JSON with units array
```

#### Test Rate Limiting (Chunk 005)

```bash
# Make 101 rapid requests to trigger rate limit
for i in {1..101}; do
  curl -s "$API_URL/api/admin/pending-bookings" \
    -H "Authorization: Bearer $ADMIN_JWT" \
    -o /dev/null -w "%{http_code}\n"
done

# Expected: First 100 return 200, 101st returns 429 (Rate Limit Exceeded)
```

---

## 🎨 Phase 3: Frontend Deployment (15 minutes)

**Chunks**: 006, 007, 008, 009, 010

### Step 3.1: Build Production Bundle (5 min)

```bash
# Set production environment variables
export VITE_SUPABASE_URL="https://[PROJECT_REF].supabase.co"
export VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"

# Build for production
npm run build

# Expected: Build completes, dist/ folder created
```

**Verify Build**:

```bash
# Check bundle sizes
ls -lh dist/assets/*.js | head -5

# Preview production build locally
npm run preview
# Navigate to http://localhost:4173
```

---

### Step 3.2: Deploy to Hosting Platform (10 min)

**Option A: Cloudflare Pages**

```bash
# Install Wrangler (if not already)
npm install -g wrangler

# Deploy to Cloudflare Pages
wrangler pages deploy dist --project-name okaeri-resort

# Expected: Deployment URL provided
```

**Option B: Vercel**

```bash
# Install Vercel CLI (if not already)
npm install -g vercel

# Deploy to Vercel
vercel --prod

# Follow prompts to configure project
```

**Verify Deployment**:

- Navigate to deployment URL
- Verify homepage loads
- Check console for errors (should be none)

---

## 👨‍💼 Phase 4: Admin Interface Deployment (15 minutes)

**Chunks**: 011, 012, 013

### Step 4.1: Verify Admin Authentication (5 min)

```bash
# Test admin login via API
curl -X POST "$API_URL/api/admin/pending-bookings" \
  -H "Authorization: Bearer $ADMIN_JWT"

# Expected: 200 OK (not 401 or 403)
```

**Test in Browser**:

1. Navigate to your deployed app
2. Log in as admin user
3. Navigate to `/admin/queue`
4. **Expected**: Admin queue loads, no 403 errors

---

### Step 4.2: Test Admin Queue (Chunk 011) (5 min)

**In Browser**:

1. Navigate to `/admin/queue`
2. **Expected**: Pending bookings list displays (or empty state if no bookings)
3. Check urgency badges display (Critical/High/Medium/Low)
4. Verify "Assign Units" or "Verify Payment" buttons show

---

### Step 4.3: Test Payment Verification (Chunk 012) (3 min)

**Prerequisites**: At least 1 booking with payment_status = 'Pending'

**Steps**:

1. Click "Verify Payment" on pending booking
2. Review payment proof (image/PDF)
3. Click "Verify" or "Reject"
4. **Expected**: Payment status updates, booking moves to verified state

---

### Step 4.4: Test Unit Assignment (Chunk 013) (7 min)

**Prerequisites**: At least 1 booking with payment_status = 'Verified', unit_assignment_status = 'pending'

**Steps**:

1. Click "Assign Units" on verified booking
2. Navigate to `/admin/assign-units/[bookingId]`
3. **Expected**: Available units grid displays
4. Select exact number of units required
5. **Expected**: All-or-nothing alert shows GREEN when correct count selected
6. Click "Assign Units" button
7. **Expected**: Success message, returns to queue

**Verify in Database**:

```sql
-- Check booking confirmed
SELECT booking_status, unit_assignment_status
FROM bookings
WHERE booking_reference = '[TEST_BOOKING_REFERENCE]';
-- Expected: booking_status = 'Confirmed', unit_assignment_status = 'assigned'

-- Check units assigned
SELECT COUNT(*) FROM booking_units WHERE booking_id = '[TEST_BOOKING_ID]';
-- Expected: COUNT = requested unit count
```

---

## 🔄 Rollback Procedures

**If deployment fails**, execute rollback in **reverse order**:

### Rollback Phase 4: Admin Interface

```bash
# No rollback needed (frontend-only changes)
# If admin routes broken, redeploy previous frontend version
```

### Rollback Phase 3: Frontend

```bash
# Cloudflare Pages: Rollback to previous deployment via dashboard
# Vercel: Rollback via Vercel dashboard (Deployments → Previous → Promote to Production)
```

### Rollback Phase 2: Backend API

```bash
# Rollback Cloudflare Workers deployment
wrangler rollback [DEPLOYMENT_ID]

# Or redeploy previous version from git
git checkout [PREVIOUS_COMMIT_SHA]
wrangler deploy
```

### Rollback Phase 1: Database ⚠️ CRITICAL

**⚠️ WARNING**: Database rollback requires careful execution

**Step 1: Drop Functions**

```sql
-- Drop chunk 013 functions
DROP FUNCTION IF EXISTS public.assign_units_to_booking(UUID, UUID[]);
DROP FUNCTION IF EXISTS public.check_units_available_for_booking(UUID, UUID[]);

-- Drop indexes (chunk 013)
DROP INDEX IF EXISTS idx_booking_units_dates_status;
DROP INDEX IF EXISTS idx_bookings_assignment_status;
DROP INDEX IF EXISTS idx_guest_booking_unit_requests_booking_id;
```

**Step 2: Drop Constraints (Chunk 003)**

```sql
-- Drop EXCLUDE constraint
ALTER TABLE booking_units DROP CONSTRAINT IF EXISTS no_double_booking;

-- Drop CHECK constraints
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS all_or_nothing_assignment;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS payment_before_assignment;
```

**Step 3: Drop Audit System (Chunk 003)**

```sql
-- Drop triggers
DROP TRIGGER IF EXISTS audit_bookings_trigger ON bookings;
DROP TRIGGER IF EXISTS audit_booking_units_trigger ON booking_units;
DROP TRIGGER IF EXISTS audit_payments_trigger ON payments;

-- Drop audit function
DROP FUNCTION IF EXISTS public.audit_log_trigger();

-- Drop audit table (⚠️ WILL DELETE ALL AUDIT LOGS)
DROP TABLE IF EXISTS audit_logs;
```

**Step 4: Restore from Backup**

```bash
# Restore full database backup (created in PRE-DEPLOYMENT)
psql -h [HOST] -U [USER] -d [DATABASE] -f backup_[DATE].sql
```

---

## ✅ Deployment Verification Summary

After completing all phases, verify:

### Database (Phase 1)

- [ ] All migrations applied successfully
- [ ] All functions exist and callable
- [ ] All constraints active (EXCLUDE, CHECK)
- [ ] RLS policies enabled
- [ ] Indexes created

### Backend API (Phase 2)

- [ ] Cloudflare Workers deployed
- [ ] API endpoints respond (200 OK)
- [ ] Rate limiting works (429 after 100 req/hour)
- [ ] Authentication enforced (401 without JWT)
- [ ] R2 bucket accessible

### Frontend (Phase 3)

- [ ] Production build deployed
- [ ] Homepage loads without errors
- [ ] Guest booking form accessible
- [ ] No console errors

### Admin Interface (Phase 4)

- [ ] Admin login works
- [ ] Admin queue displays
- [ ] Payment verification works
- [ ] Unit assignment works

---

## ⏭️ Next Steps

**If deployment successful** ✅:

1. **Proceed to POST-DEPLOYMENT-CHECKLIST.md**
2. Run comprehensive validation tests
3. Configure monitoring and alerts
4. Document deployment notes

**If deployment failed** ⚠️:

1. **Execute rollback procedures** (see above)
2. Document failure reason
3. Fix issue
4. Re-run PRE-DEPLOYMENT-CHECKLIST.md
5. Retry deployment

---

**Deployment Time Estimate**:

- **Phase 1**: 30 minutes
- **Phase 2**: 20 minutes
- **Phase 3**: 15 minutes
- **Phase 4**: 15 minutes
- **Total**: 80 minutes

**Last Updated**: 2025-10-29
**Next Checklist**: POST-DEPLOYMENT-CHECKLIST.md
