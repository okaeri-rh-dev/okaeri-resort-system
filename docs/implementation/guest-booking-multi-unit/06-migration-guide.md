# Migration Guide for Multi-Unit Guest Booking

## Overview

Complete migration from single-unit to multi-unit guest booking system with database migrations, API deployment, and rollback procedures.

**Key Points:**

- Array-based model (NO `quantity` column)
- PostgreSQL pricing function is authoritative
- Idempotency tables included
- NO email notifications (manual contact workflow)

## Migration Timeline

| Phase               | Duration | Risk Level | Rollback Time |
| ------------------- | -------- | ---------- | ------------- |
| Pre-Migration Prep  | 2 days   | Low        | N/A           |
| Database Migration  | 4 hours  | Medium     | 30 minutes    |
| API Deployment      | 2 hours  | Medium     | 15 minutes    |
| Frontend Deployment | 2 hours  | Low        | 15 minutes    |
| Admin Training      | 1 day    | Low        | N/A           |
| Monitoring          | Ongoing  | Low        | N/A           |

## Pre-Migration Preparation

### Create Full Backup

```bash
# Database backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup integrity
pg_restore --list backup_*.sql | head -20

# Store securely
aws s3 cp backup_*.sql s3://backups/pre-multi-unit/
```

### Pre-Migration Validation

Run these checks BEFORE executing the migration to catch edge cases:

```bash
# 1. Check for pending bookings that need is_multi_unit flag
psql $DATABASE_URL -c "SELECT COUNT(*) FROM bookings WHERE booking_status = 'Pending';"

# 2. Verify pricing_config doesn't already exist with conflicting values
psql $DATABASE_URL -c "SELECT * FROM pricing_config WHERE id = 'default';"
# If row exists, compare values with migration script defaults (lines 87-94)
# Manually reconcile differences before proceeding

# 3. Check for orphaned booking data
psql $DATABASE_URL -c "SELECT COUNT(*) FROM bookings WHERE guest_id NOT IN (SELECT guest_id FROM guests);"
# Expected: 0 (no orphans)

# 4. Verify no incomplete multi-unit data from previous attempts
psql $DATABASE_URL -c "SELECT COUNT(*) FROM guest_booking_unit_requests;"
# Expected: 0 (table should not exist yet)
```

### Environment Variables

```env
# Add to .env.local
VITE_TURNSTILE_SITE_KEY=your_turnstile_site_key
TURNSTILE_SECRET_KEY=your_turnstile_secret

# Backend
SUPABASE_SERVICE_KEY=your_service_key
```

### Admin Training Materials

**Manual Contact Workflow** (NO email automation):

- Guest submits booking via form
- Admin receives notification in queue
- Admin verifies payment proof manually
- Admin assigns units via interface
- Admin contacts guest via phone/SMS with confirmation

## Database Migration

### Complete Migration Script

**File:** `database/migrations/020-guest-booking-multi-unit.sql`

```sql
BEGIN;

-- Pre-flight validation
DO $$
BEGIN
    -- Check if pricing_config already exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pricing_config') THEN
        IF EXISTS (SELECT 1 FROM pricing_config WHERE id = 'default') THEN
            RAISE WARNING 'pricing_config default row already exists - migration will use ON CONFLICT DO NOTHING';
            RAISE WARNING 'Verify existing values match expected configuration';
        END IF;
    END IF;

    -- Warn about existing pending bookings
    IF EXISTS (SELECT 1 FROM bookings WHERE booking_status = 'Pending') THEN
        RAISE NOTICE 'Existing pending bookings will be marked as single-unit (is_multi_unit = FALSE by default)';
    END IF;
END;
$$;

-- 1. Create pricing_config table (single source of truth for pricing and capacity)
CREATE TABLE IF NOT EXISTS pricing_config (
    id TEXT PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
    base_rate DECIMAL(10, 2) NOT NULL CHECK (base_rate > 0),
    weekend_rate DECIMAL(10, 2) NOT NULL CHECK (weekend_rate > 0),
    extra_person_rate DECIMAL(10, 2) NOT NULL DEFAULT 500.00 CHECK (extra_person_rate >= 0),
    base_occupancy INTEGER NOT NULL DEFAULT 2 CHECK (base_occupancy > 0),
    max_capacity_per_unit INTEGER NOT NULL DEFAULT 20 CHECK (max_capacity_per_unit > 0),
    downpayment_percent DECIMAL(5, 2) NOT NULL DEFAULT 50.00 CHECK (downpayment_percent BETWEEN 0 AND 100),
    currency TEXT NOT NULL DEFAULT 'PHP',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default configuration (singleton row enforced by CHECK constraint)
INSERT INTO pricing_config (
    id, base_rate, weekend_rate, extra_person_rate,
    base_occupancy, max_capacity_per_unit
) VALUES (
    'default',
    3000.00,  -- Base rate per unit per night
    3500.00,  -- Weekend rate per unit per night
    500.00,   -- Extra person fee per night
    2,        -- Base occupancy included in base rate
    20        -- Maximum guests per unit
) ON CONFLICT (id) DO NOTHING;

-- 2. Create guest_booking_unit_requests (array-based, NO quantity)
CREATE TABLE IF NOT EXISTS guest_booking_unit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    guests_per_unit INTEGER NOT NULL CHECK (
        guests_per_unit > 0
        AND guests_per_unit <= (
            SELECT max_capacity_per_unit
            FROM pricing_config
            WHERE id = 'default'
        )
    ),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_guest_booking_requests_booking ON guest_booking_unit_requests(booking_id);

-- 3. Extend bookings table
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS is_multi_unit BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS requested_unit_count INTEGER,
ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5, 2),
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS downpayment_required DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS unit_assignment_status TEXT DEFAULT 'pending'
    CHECK (unit_assignment_status IN ('pending', 'assigned')),
ADD COLUMN IF NOT EXISTS pricing_snapshot JSONB,
ADD COLUMN IF NOT EXISTS is_guest_booking BOOLEAN DEFAULT FALSE;

CREATE INDEX idx_bookings_multi_unit ON bookings(is_multi_unit) WHERE is_multi_unit = TRUE;
CREATE INDEX idx_bookings_assignment_pending ON bookings(unit_assignment_status, created_at DESC)
    WHERE is_guest_booking = TRUE AND is_multi_unit = TRUE AND unit_assignment_status = 'pending';

-- 4. Concurrency constraint
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE booking_units
ADD CONSTRAINT no_double_booking EXCLUDE USING gist (
    unit_id WITH =,
    daterange(check_in_date, check_out_date, '[]') WITH &&
) WHERE (status != 'cancelled');

-- 5. Business rule constraints
ALTER TABLE bookings
ADD CONSTRAINT payment_before_assignment CHECK (
    unit_assignment_status != 'assigned' OR payment_status IN ('Verified', 'Completed')
);

ALTER TABLE bookings
ADD CONSTRAINT all_or_nothing_assignment CHECK (
    unit_assignment_status != 'assigned' OR (
        (SELECT COUNT(*) FROM booking_units WHERE booking_id = bookings.booking_id AND status = 'confirmed') =
        (SELECT COUNT(*) FROM guest_booking_unit_requests WHERE booking_id = bookings.booking_id)
    )
);

-- 6. Discount rules
CREATE TABLE IF NOT EXISTS discount_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    conditions JSONB NOT NULL,
    discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed', 'per_night')),
    discount_value DECIMAL(10, 2) NOT NULL,
    max_discount DECIMAL(10, 2),
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_discount_value CHECK (
        discount_value > 0 AND (discount_type != 'percentage' OR discount_value <= 100)
    )
);

CREATE INDEX idx_discount_rules_active ON discount_rules(is_active, priority DESC) WHERE is_active = TRUE;
CREATE INDEX idx_discount_rules_conditions ON discount_rules USING gin(conditions);

-- Insert default duration discounts
INSERT INTO discount_rules (name, description, conditions, discount_type, discount_value, priority)
VALUES
    ('Week Stay Discount', '5% off for 7+ nights', '[{"type": "min_nights", "value": 7}]'::JSONB, 'percentage', 5.00, 1),
    ('Two Week Discount', '10% off for 14+ nights', '[{"type": "min_nights", "value": 14}]'::JSONB, 'percentage', 10.00, 2),
    ('Three Week Discount', '15% off for 21+ nights', '[{"type": "min_nights", "value": 21}]'::JSONB, 'percentage', 15.00, 3),
    ('Monthly Stay Discount', '20% off for 28+ nights', '[{"type": "min_nights", "value": 28}]'::JSONB, 'percentage', 20.00, 4)
ON CONFLICT DO NOTHING;

-- Example seasonal discount (optional - commented out by default)
-- INSERT INTO discount_rules (name, description, conditions, discount_type, discount_value, priority)
-- VALUES (
--     'Holiday Season Special',
--     '10% off during Christmas/New Year period',
--     '[{"type": "date_range", "value": ["2025-12-20", "2026-01-05"]}]'::JSONB,
--     'percentage',
--     10.00,
--     5
-- ) ON CONFLICT DO NOTHING;

-- Example advance booking discount (optional - commented out by default)
-- INSERT INTO discount_rules (name, description, conditions, discount_type, discount_value, priority)
-- VALUES (
--     'Early Bird Discount',
--     '5% off for bookings made 30+ days in advance',
--     '[{"type": "advance_booking", "value": 30}]'::JSONB,
--     'percentage',
--     5.00,
--     6
-- ) ON CONFLICT DO NOTHING;

-- 7. Idempotency keys
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key UUID PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX idx_idempotency_expiry ON idempotency_keys(expires_at);
CREATE INDEX idx_idempotency_booking ON idempotency_keys(booking_id);

-- 8. Create authoritative pricing function
CREATE OR REPLACE FUNCTION calculate_booking_pricing(
    p_unit_requests JSONB,  -- Array: [{guests_per_unit: 2}, {guests_per_unit: 3}, ...]
    p_check_in DATE,
    p_check_out DATE
) RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_nights INTEGER;
    v_total_units INTEGER;
    v_total_guests INTEGER;
    v_base_rate DECIMAL(10, 2);
    v_weekend_rate DECIMAL(10, 2);
    v_extra_person_rate DECIMAL(10, 2);
    v_base_occupancy INTEGER;
    v_downpayment_percent DECIMAL(5, 2);
    v_base_total DECIMAL(10, 2) := 0;
    v_weekend_surcharge DECIMAL(10, 2) := 0;
    v_extra_person_fees DECIMAL(10, 2) := 0;
    v_subtotal DECIMAL(10, 2);
    v_discount JSONB;
    v_total DECIMAL(10, 2);
    v_downpayment DECIMAL(10, 2);
    v_weekend_nights INTEGER := 0;
    v_current_date DATE;
    v_unit_request JSONB;
    v_extra_persons INTEGER;
BEGIN
    -- Calculate nights
    v_nights := p_check_out - p_check_in;
    IF v_nights <= 0 THEN
        RAISE EXCEPTION 'Invalid date range';
    END IF;

    -- Fetch base rates from pricing_config table (single source of truth)
    SELECT base_rate, weekend_rate, extra_person_rate, base_occupancy, downpayment_percent
    INTO v_base_rate, v_weekend_rate, v_extra_person_rate, v_base_occupancy, v_downpayment_percent
    FROM pricing_config
    WHERE id = 'default';

    IF v_base_rate IS NULL THEN
        RAISE EXCEPTION 'No unit rates configured';
    END IF;

    -- Count weekend nights (Friday=5, Saturday=6)
    v_current_date := p_check_in;
    WHILE v_current_date < p_check_out LOOP
        IF EXTRACT(DOW FROM v_current_date) IN (5, 6) THEN
            v_weekend_nights := v_weekend_nights + 1;
        END IF;
        v_current_date := v_current_date + 1;
    END LOOP;

    -- Calculate totals from array
    v_total_units := jsonb_array_length(p_unit_requests);
    v_total_guests := 0;

    FOR v_unit_request IN SELECT * FROM jsonb_array_elements(p_unit_requests) LOOP
        v_total_guests := v_total_guests + (v_unit_request->>'guests_per_unit')::INTEGER;

        v_extra_persons := GREATEST(0, (v_unit_request->>'guests_per_unit')::INTEGER - v_base_occupancy);
        v_extra_person_fees := v_extra_person_fees + (v_extra_persons * v_extra_person_rate * v_nights);
    END LOOP;

    -- Pricing components
    v_base_total := v_total_units * v_base_rate * v_nights;
    v_weekend_surcharge := v_total_units * (v_weekend_rate - v_base_rate) * v_weekend_nights;
    v_subtotal := v_base_total + v_weekend_surcharge + v_extra_person_fees;

    -- Apply best discount
    SELECT jsonb_build_object(
        'percent', discount_value,
        'amount', ROUND(v_subtotal * (discount_value / 100.0), 2),
        'rule_id', id,
        'rule_name', name
    )
    INTO v_discount
    FROM discount_rules
    WHERE is_active = TRUE
      AND (
          -- Duration discount: Check minimum nights
          (conditions @> '[{"type": "min_nights"}]'::jsonb
           AND v_nights >= (conditions->0->>'value')::INTEGER)
          OR
          -- Unit count discount: Check minimum units
          (conditions @> '[{"type": "unit_count"}]'::jsonb
           AND v_total_units >= (conditions->0->>'value')::INTEGER)
          OR
          -- Date range discount: Check if check-in falls within range
          (conditions @> '[{"type": "date_range"}]'::jsonb
           AND p_check_in >= (conditions->0->'value'->>0)::DATE
           AND p_check_in <= (conditions->0->'value'->>1)::DATE)
          OR
          -- Advance booking discount: Check booking lead time
          (conditions @> '[{"type": "advance_booking"}]'::jsonb
           AND (p_check_in - CURRENT_DATE) >= (conditions->0->>'value')::INTEGER)
      )
    ORDER BY discount_value DESC, priority DESC
    LIMIT 1;

    -- Final calculations
    v_total := v_subtotal - COALESCE((v_discount->>'amount')::DECIMAL, 0);
    v_downpayment := ROUND(v_total * (v_downpayment_percent / 100.0), 2);

    -- Build result
    v_result := jsonb_build_object(
        'version', '1.0.0',
        'computed_at', NOW(),
        'nights', v_nights,
        'total_units', v_total_units,
        'total_guests', v_total_guests,
        'rates', jsonb_build_object(
            'base_rate', v_base_rate,
            'weekend_rate', v_weekend_rate,
            'extra_person_rate', v_extra_person_rate,
            'base_occupancy', v_base_occupancy
        ),
        'base_total', v_base_total,
        'weekend_surcharge', v_weekend_surcharge,
        'extra_person_fees', v_extra_person_fees,
        'subtotal', v_subtotal,
        'discount', COALESCE(v_discount, 'null'::jsonb),
        'total', v_total,
        'downpayment_required', v_downpayment,
        'downpayment_percent', v_downpayment_percent,
        'currency', 'PHP'
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- 9. Create atomic booking creation function
CREATE OR REPLACE FUNCTION create_guest_booking(
    p_guest_data JSONB,
    p_booking_data JSONB,
    p_unit_requests JSONB,
    p_idempotency_key UUID
) RETURNS JSONB AS $$
DECLARE
    v_guest_id UUID;
    v_booking_id UUID;
    v_existing_booking_id UUID;
    v_unit_request JSONB;
    v_result JSONB;
BEGIN
    -- Check idempotency key (24-hour window)
    SELECT booking_id INTO v_existing_booking_id
    FROM idempotency_keys
    WHERE key = p_idempotency_key
      AND created_at > NOW() - INTERVAL '24 hours';

    IF v_existing_booking_id IS NOT NULL THEN
        -- Return existing booking
        SELECT jsonb_build_object(
            'is_duplicate', true,
            'booking', row_to_json(b.*)
        ) INTO v_result
        FROM bookings b
        WHERE b.booking_id = v_existing_booking_id;

        RETURN v_result;
    END IF;

    -- Find or create guest
    SELECT guest_id INTO v_guest_id
    FROM guests
    WHERE email = (p_guest_data->>'email')
    LIMIT 1;

    IF v_guest_id IS NULL THEN
        INSERT INTO guests (guest_name, email, phone_number)
        VALUES (
            p_guest_data->>'guest_name',
            p_guest_data->>'email',
            p_guest_data->>'phone_number'
        )
        RETURNING guest_id INTO v_guest_id;
    END IF;

    -- Create booking
    INSERT INTO bookings (
        guest_id,
        booking_reference,
        check_in_date,
        check_out_date,
        num_guests,
        total_amount,
        discount_percent,
        discount_amount,
        downpayment_required,
        pricing_snapshot,
        special_requests,
        is_multi_unit,
        is_guest_booking,
        requested_unit_count,
        unit_assignment_status,
        booking_status,
        payment_status
    ) VALUES (
        v_guest_id,
        p_booking_data->>'booking_reference',
        (p_booking_data->>'check_in_date')::TIMESTAMPTZ,
        (p_booking_data->>'check_out_date')::TIMESTAMPTZ,
        (p_booking_data->>'num_guests')::INTEGER,
        (p_booking_data->>'total_amount')::DECIMAL,
        (p_booking_data->>'discount_percent')::DECIMAL,
        (p_booking_data->>'discount_amount')::DECIMAL,
        (p_booking_data->>'downpayment_required')::DECIMAL,
        (p_booking_data->>'pricing_snapshot')::JSONB,
        p_booking_data->>'special_requests',
        TRUE,
        TRUE,
        jsonb_array_length(p_unit_requests),
        'pending',
        'Pending',
        'Pending'
    )
    RETURNING booking_id INTO v_booking_id;

    -- Insert unit requests
    FOR v_unit_request IN SELECT * FROM jsonb_array_elements(p_unit_requests) LOOP
        INSERT INTO guest_booking_unit_requests (booking_id, guests_per_unit)
        VALUES (
            v_booking_id,
            (v_unit_request->>'guests_per_unit')::INTEGER
        );
    END LOOP;

    -- Store idempotency key
    INSERT INTO idempotency_keys (key, booking_id)
    VALUES (p_idempotency_key, v_booking_id);

    -- Build result
    SELECT jsonb_build_object(
        'is_duplicate', false,
        'booking', row_to_json(b.*)
    ) INTO v_result
    FROM bookings b
    WHERE b.booking_id = v_booking_id;

    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Booking creation failed: % - All changes rolled back', SQLERRM;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_guest_booking IS 'Atomically creates booking with guest, unit requests, and idempotency key. Prevents orphaned records.';

-- 11. Row Level Security
ALTER TABLE guest_booking_unit_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY guest_booking_requests_insert_policy ON guest_booking_unit_requests
    FOR INSERT TO authenticated, service_role
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role' OR auth.jwt() ->> 'app_role' = 'admin');

CREATE POLICY guest_booking_requests_select_policy ON guest_booking_unit_requests
    FOR SELECT TO authenticated
    USING (auth.jwt() ->> 'app_role' = 'admin');

GRANT SELECT, INSERT ON guest_booking_unit_requests TO authenticated;
GRANT ALL ON guest_booking_unit_requests TO service_role;

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY idempotency_keys_service_policy ON idempotency_keys
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, DELETE ON idempotency_keys TO service_role;

-- 12. Verify migration
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'guest_booking_unit_requests') THEN
        RAISE EXCEPTION 'guest_booking_unit_requests table not created';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'discount_rules') THEN
        RAISE EXCEPTION 'discount_rules table not created';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'idempotency_keys') THEN
        RAISE EXCEPTION 'idempotency_keys table not created';
    END IF;

    RAISE NOTICE 'Migration completed successfully';
END;
$$;

COMMIT;
```

### Run Migration

```bash
# Test migration on staging
psql $STAGING_DATABASE_URL < database/migrations/020-guest-booking-multi-unit.sql

# Verify tables
psql $STAGING_DATABASE_URL -c "\dt guest_booking_unit_requests"
psql $STAGING_DATABASE_URL -c "\dt discount_rules"
psql $STAGING_DATABASE_URL -c "\dt idempotency_keys"

# Run on production
psql $PRODUCTION_DATABASE_URL < database/migrations/020-guest-booking-multi-unit.sql
```

## API Deployment

### Deploy Cloudflare Workers

```bash
# Build production
npm run build

# Deploy functions
wrangler deploy

# Verify endpoints
curl https://your-domain.com/api/guest-booking/rates
curl https://your-domain.com/api/guest-booking/discount-rules
```

### Smoke Tests

```bash
# Test guest booking endpoint
curl -X POST https://your-domain.com/api/guest-booking \
  -H "Content-Type: application/json" \
  -d '{
    "guest_name": "Test User",
    "email": "test@example.com",
    "phone_number": "+1234567890",
    "check_in": "2025-03-01T14:00:00Z",
    "check_out": "2025-03-08T11:00:00Z",
    "unit_requests": [
      {"guests_per_unit": 2},
      {"guests_per_unit": 3}
    ],
    "turnstile_token": "test-token",
    "terms_accepted": true
  }'

# Test admin pending queue
curl https://your-domain.com/api/admin/pending-bookings \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Frontend Deployment

### Deploy to Cloudflare Pages

```bash
# Build production
npm run build

# Deploy
wrangler pages deploy dist

# Verify
curl https://your-pages-domain.com/guest-booking
```

### Post-Deployment Checks

- [ ] Guest booking form loads
- [ ] Unit request cards add/remove correctly
- [ ] Pricing preview displays
- [ ] Turnstile CAPTCHA renders
- [ ] Form submission works
- [ ] Admin queue displays
- [ ] Unit assignment interface loads

## Rollback Procedures

### Rollback Decision Tree

**When to Roll Back:**

```
START
  ↓
Is production completely broken? → YES → IMMEDIATE ROLLBACK
  ↓ NO
Are critical booking functions failing? → YES → IMMEDIATE ROLLBACK
  ↓ NO
Is data being corrupted? → YES → IMMEDIATE ROLLBACK
  ↓ NO
Can issues be fixed with hotfix in <2 hours? → YES → ATTEMPT HOTFIX
  ↓ NO
Are issues affecting >50% of bookings? → YES → SCHEDULE ROLLBACK
  ↓ NO
CONTINUE MONITORING (fix in next deployment)
```

**Rollback Authority:**

- Production down: Any senior developer
- Data corruption: Database admin + senior developer
- Feature bugs: Product owner + development lead

### Rollback Success Criteria

**Before declaring rollback successful, verify:**

1. ✅ All new tables dropped (verified via SQL queries)
2. ✅ All new columns removed from bookings table
3. ✅ All new constraints removed
4. ✅ All new functions dropped
5. ✅ API responds with 200 for health check
6. ✅ Frontend loads without errors
7. ✅ Single-unit bookings work end-to-end
8. ✅ **Zero data loss** - all existing bookings preserved

**Data Preservation Verification:**

```sql
-- Count bookings before rollback
SELECT COUNT(*) as total_bookings_before FROM bookings;

-- PERFORM ROLLBACK

-- Count bookings after rollback (MUST MATCH)
SELECT COUNT(*) as total_bookings_after FROM bookings;

-- Verify critical booking data intact
SELECT
  booking_id,
  booking_reference,
  check_in_date,
  check_out_date,
  total_amount,
  payment_status
FROM bookings
WHERE created_at < NOW() - INTERVAL '1 day'
ORDER BY created_at DESC
LIMIT 10;
-- Manual spot check: booking details unchanged
```

### Database Rollback Script

**Execution Time:** 5-10 minutes

**Prerequisites:**

- Database backup completed and verified
- All active connections closed (coordinate with team)
- Maintenance window scheduled

**Rollback SQL:**

```sql
-- SAVE booking count BEFORE rollback
CREATE TEMP TABLE rollback_verification AS
SELECT COUNT(*) as count_before FROM bookings;

BEGIN;

-- Drop new tables (CASCADE removes dependencies)
DROP TABLE IF EXISTS pricing_config CASCADE;
DROP TABLE IF EXISTS guest_booking_unit_requests CASCADE;
DROP TABLE IF EXISTS discount_rules CASCADE;
DROP TABLE IF EXISTS idempotency_keys CASCADE;

-- Remove constraints from existing tables
ALTER TABLE booking_units DROP CONSTRAINT IF EXISTS no_double_booking;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS payment_before_assignment;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS all_or_nothing_assignment;

-- Remove new columns from bookings (data in these columns will be lost)
ALTER TABLE bookings
DROP COLUMN IF EXISTS is_multi_unit,
DROP COLUMN IF EXISTS requested_unit_count,
DROP COLUMN IF EXISTS discount_percent,
DROP COLUMN IF EXISTS discount_amount,
DROP COLUMN IF EXISTS downpayment_required,
DROP COLUMN IF EXISTS unit_assignment_status,
DROP COLUMN IF EXISTS pricing_snapshot,
DROP COLUMN IF EXISTS is_guest_booking;

-- Drop new functions
DROP FUNCTION IF EXISTS calculate_booking_pricing CASCADE;
DROP FUNCTION IF EXISTS create_guest_booking CASCADE;
DROP FUNCTION IF EXISTS assign_units_to_booking CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_idempotency_keys CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_payment_proofs CASCADE;

-- VERIFY booking count unchanged
DO $$
DECLARE
  count_before INTEGER;
  count_after INTEGER;
BEGIN
  SELECT count_before INTO count_before FROM rollback_verification;
  SELECT COUNT(*) INTO count_after FROM bookings;

  IF count_before != count_after THEN
    RAISE EXCEPTION 'ROLLBACK FAILED: Booking count changed from % to %', count_before, count_after;
  END IF;

  RAISE NOTICE 'SUCCESS: Booking count unchanged (%)', count_before;
END $$;

COMMIT;

-- Cleanup temp table
DROP TABLE rollback_verification;
```

### Rollback Validation Checks

**Execute immediately after rollback:**

```sql
-- CHECK 1: Verify tables removed
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('pricing_config', 'guest_booking_unit_requests',
                     'discount_rules', 'idempotency_keys');
-- Expected: 0 rows

-- CHECK 2: Verify columns removed from bookings
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'bookings'
  AND column_name IN ('is_multi_unit', 'unit_assignment_status', 'pricing_snapshot',
                      'requested_unit_count', 'discount_percent', 'discount_amount',
                      'downpayment_required', 'is_guest_booking');
-- Expected: 0 rows

-- CHECK 3: Verify constraints removed
SELECT constraint_name
FROM information_schema.table_constraints
WHERE table_name IN ('bookings', 'booking_units')
  AND constraint_name IN ('no_double_booking', 'payment_before_assignment',
                          'all_or_nothing_assignment');
-- Expected: 0 rows

-- CHECK 4: Verify functions removed
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('calculate_booking_pricing', 'create_guest_booking',
                       'assign_units_to_booking', 'cleanup_expired_idempotency_keys',
                       'cleanup_expired_payment_proofs');
-- Expected: 0 rows

-- CHECK 5: Verify data integrity
SELECT
  COUNT(*) as total_bookings,
  COUNT(DISTINCT booking_reference) as unique_references,
  MIN(created_at) as oldest_booking,
  MAX(created_at) as newest_booking
FROM bookings;
-- Verify counts match pre-rollback snapshot
```

### API Rollback

**Execution Time:** 2-5 minutes

```bash
# Method 1: Wrangler rollback (recommended)
wrangler rollback

# Method 2: Redeploy previous version
git log --oneline -n 10  # Find pre-migration commit
git checkout <previous-commit-hash>
wrangler deploy

# Verify API health
curl https://your-domain.com/api/health
# Expected: {"status": "healthy"}

# Test single-unit booking endpoint
curl -X POST https://your-domain.com/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"guest_name": "Test", "unit_id": "uuid", ...}'
# Expected: 201 Created
```

### Frontend Rollback

**Execution Time:** 2-5 minutes

```bash
# Get deployment history
wrangler pages deployment list

# Identify pre-migration deployment
# Look for deployment before multi-unit feature

# Rollback to specific deployment
wrangler pages deployment rollback <deployment-id>

# Verify frontend loads
curl -I https://your-domain.com
# Expected: 200 OK

# Check for console errors (manual browser test)
# Navigate to booking form
# Verify single-unit booking flow works
```

### Cron Workers Cleanup

**If cron workers were deployed:**

```bash
# Edit wrangler.toml - remove cron triggers
[triggers]
# crons = [
#   "0 2 * * *",  # REMOVED
#   "0 3 * * 0"   # REMOVED
# ]

# Redeploy without cron triggers
wrangler deploy
```

### Post-Rollback Actions

**Immediate (Within 1 Hour):**

1. ✅ Verify all checks passed
2. ✅ Test single-unit booking end-to-end
3. ✅ Confirm admin can manage existing bookings
4. ✅ Check payment processing still works
5. ✅ Notify team rollback complete
6. ✅ Update status page (if applicable)

**Within 24 Hours:**

1. ✅ Root cause analysis of why rollback needed
2. ✅ Document lessons learned
3. ✅ Update migration plan based on findings
4. ✅ Schedule post-mortem meeting
5. ✅ Plan fixes for next deployment attempt

**Data Preservation Note:**

Multi-unit bookings created between migration and rollback will lose multi-unit metadata but core booking data remains intact. Admin must manually process these bookings:

```sql
-- Identify affected bookings (if any)
SELECT booking_id, booking_reference, created_at
FROM bookings
WHERE created_at BETWEEN '<migration-time>' AND '<rollback-time>'
ORDER BY created_at DESC;

-- Admin action: Contact these guests manually to confirm booking details
```

### Rollback Testing Procedure

**Execute on staging BEFORE production migration:**

1. Deploy multi-unit system to staging
2. Create test multi-unit bookings
3. Execute rollback script
4. Verify all checks pass
5. Test single-unit booking flow
6. Document timing and any issues

**Expected Rollback Timings:**

| Step              | Duration      | Notes                              |
| ----------------- | ------------- | ---------------------------------- |
| Database rollback | 5-10 min      | Includes validation                |
| API rollback      | 2-5 min       | DNS propagation time               |
| Frontend rollback | 2-5 min       | CDN cache clear                    |
| **Total**         | **10-20 min** | From decision to fully rolled back |

## Cloudflare Scheduled Workers

### Overview

Cloudflare Scheduled Workers execute on a cron schedule without requiring HTTP endpoints. This provides better security (no public endpoints) and simpler configuration.

**Free Tier Limits**: 3 cron triggers/day (we use 2)

### Configuration

**File**: `wrangler.toml`

```toml
name = "okaeri-resort-system"
main = "functions/_worker.js"
compatibility_date = "2024-01-01"

# NOTE: See "Main Worker Handler" section (lines 663-699) for cron schedule to handler mapping
[triggers]
crons = [
  "0 2 * * *",   # Daily: Idempotency cleanup at 2:00 AM UTC
  "0 3 * * 0"    # Weekly: Payment proof cleanup Sunday 3:00 AM UTC
]

[vars]
# Public variables
ALLOWED_ORIGINS = "https://your-domain.com"

# Secrets (set via wrangler secret put)
# - SUPABASE_URL
# - SUPABASE_SERVICE_KEY
# - TURNSTILE_SECRET_KEY
```

### Idempotency Key Cleanup

**Schedule**: Daily at 2:00 AM UTC
**Purpose**: Delete expired idempotency keys (>24 hours old)

**File**: `functions/scheduled/cleanup-idempotency.ts`

```typescript
import { createClient } from "@supabase/supabase-js";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

export async function cleanupIdempotency(env: Env) {
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 60000; // 1 minute

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

      // Call PostgreSQL cleanup function
      const { data, error } = await supabase.rpc("cleanup_expired_idempotency_keys");

      if (error) throw error;

      const deletedCount = data || 0;

      // Alert if unusual cleanup volume (>1000 keys suggests issue)
      if (deletedCount > 1000) {
        console.warn(`[ALERT] High idempotency key cleanup: ${deletedCount} keys deleted`);
        // Admin should investigate: possible double-booking attempts or system issues
      }

      console.log(`[CRON] Idempotency cleanup: ${deletedCount} expired keys removed`);
      return; // Success - exit retry loop
    } catch (error) {
      console.error(
        `[ERROR] Idempotency cleanup failed (attempt ${attempt}/${MAX_RETRIES}):`,
        error
      );

      if (attempt === MAX_RETRIES) {
        // Final failure after all retries - log critical error
        console.error("[CRITICAL] Idempotency cleanup failed after all retries");
        // Admin should check: database connectivity, permissions, function exists
        throw error;
      }

      // Wait before retry with exponential backoff
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
    }
  }
}
```

### Payment Proof Cleanup

**Schedule**: Weekly Sunday at 3:00 AM UTC
**Retention**: 90 days post-checkout, 30 days post-cancellation

**File**: `functions/scheduled/cleanup-payment-proofs.ts`

```typescript
import { createClient } from "@supabase/supabase-js";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

export async function cleanupPaymentProofs(env: Env) {
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 60000; // 1 minute

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

      // Call PostgreSQL cleanup function
      const { data, error } = await supabase.rpc("cleanup_expired_payment_proofs");

      if (error) throw error;

      const { deleted_count, storage_freed_bytes } = data || {
        deleted_count: 0,
        storage_freed_bytes: 0,
      };

      // Alert if unusual cleanup volume
      if (deleted_count > 50) {
        console.warn(`[ALERT] High payment proof cleanup: ${deleted_count} files deleted`);
        // Admin should verify: retention policy changes, bulk cancellations, or data issues
      }

      console.log(
        `[CRON] Payment proof cleanup: ${deleted_count} files deleted, ` +
          `${(storage_freed_bytes / 1024 / 1024).toFixed(2)} MB freed`
      );
      return; // Success - exit retry loop
    } catch (error) {
      console.error(
        `[ERROR] Payment proof cleanup failed (attempt ${attempt}/${MAX_RETRIES}):`,
        error
      );

      if (attempt === MAX_RETRIES) {
        // Final failure after all retries - log critical error
        console.error("[CRITICAL] Payment proof cleanup failed after all retries");
        // Admin should check: database connectivity, storage permissions, function exists
        throw error;
      }

      // Wait before retry with exponential backoff
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
    }
  }
}
```

### Main Worker Handler

**File**: `functions/_worker.ts`

```typescript
import { cleanupIdempotency } from "./scheduled/cleanup-idempotency";
import { cleanupPaymentProofs } from "./scheduled/cleanup-payment-proofs";

interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
}

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  ALLOWED_ORIGINS: string;
}

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * Cron Schedule to Handler Mapping:
 *
 * Schedule        | Handler                  | Frequency | Description
 * ----------------|--------------------------|-----------|------------------------------------
 * "0 2 * * *"     | cleanupIdempotency()     | Daily     | Delete expired idempotency keys (>24h)
 * "0 3 * * 0"     | cleanupPaymentProofs()   | Weekly    | Delete old payment proofs (retention policy)
 *
 * Total: 2/3 free tier cron triggers used
 */
export default {
  // Handle scheduled events
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log(`[CRON] Starting scheduled task: ${event.cron}`);

    try {
      switch (event.cron) {
        case "0 2 * * *":
          await cleanupIdempotency(env);
          break;
        case "0 3 * * 0":
          await cleanupPaymentProofs(env);
          break;
        default:
          console.warn(`[WARN] Unknown cron schedule: ${event.cron}`);
      }

      console.log(`[CRON] Completed: ${event.cron}`);
    } catch (error) {
      console.error(`[CRON ERROR] Failed: ${event.cron}`, error);
      // TODO: Send alert to admin (email/SMS)
    }
  },

  // Handle HTTP requests
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Route to API handlers
      if (url.pathname.startsWith("/api/guest-booking/preview-pricing")) {
        const { default: handler } = await import("./api/guest-booking/preview-pricing");
        return await handler.onRequest({ request, env, params: {}, data: {} });
      }

      if (url.pathname.startsWith("/api/guest-booking/rates")) {
        const { default: handler } = await import("./api/guest-booking/rates");
        return await handler.onRequest({ request, env, params: {}, data: {} });
      }

      if (url.pathname.startsWith("/api/guest-booking/discount-rules")) {
        const { default: handler } = await import("./api/guest-booking/discount-rules");
        return await handler.onRequest({ request, env, params: {}, data: {} });
      }

      if (url.pathname.startsWith("/api/guest-booking/upload-url")) {
        const { default: handler } = await import("./api/guest-booking/upload-url");
        return await handler.onRequest({ request, env, params: {}, data: {} });
      }

      if (url.pathname.startsWith("/api/guest-booking/status")) {
        const { default: handler } = await import("./api/guest-booking/status");
        return await handler.onRequest({ request, env, params: {}, data: {} });
      }

      if (url.pathname === "/api/guest-booking") {
        const { default: handler } = await import("./api/guest-booking");
        return await handler.onRequest({ request, env, params: {}, data: {} });
      }

      if (url.pathname.startsWith("/api/admin/")) {
        // Admin endpoints (require authentication)
        const authHeader = request.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Route to admin handlers
        if (url.pathname === "/api/admin/pending-bookings") {
          const { default: handler } = await import("./api/admin/pending-bookings");
          return await handler.onRequest({ request, env, params: {}, data: {} });
        }

        if (url.pathname === "/api/admin/available-units") {
          const { default: handler } = await import("./api/admin/available-units");
          return await handler.onRequest({ request, env, params: {}, data: {} });
        }

        if (url.pathname === "/api/admin/assign-units") {
          const { default: handler } = await import("./api/admin/assign-units");
          return await handler.onRequest({ request, env, params: {}, data: {} });
        }

        if (url.pathname === "/api/admin/verify-payment") {
          const { default: handler } = await import("./api/admin/verify-payment");
          return await handler.onRequest({ request, env, params: {}, data: {} });
        }
      }

      // Health check endpoint
      if (url.pathname === "/api/health") {
        return new Response(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Not found
      return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("[WORKER ERROR]", error);
      return new Response(JSON.stringify({ error: "Internal Server Error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};
```

### Deployment

```bash
# Set required secrets for scheduled workers
wrangler secret put SUPABASE_URL
# Enter your Supabase project URL when prompted

wrangler secret put SUPABASE_SERVICE_KEY
# Enter your Supabase service role key when prompted

wrangler secret put TURNSTILE_SECRET_KEY
# Enter your Cloudflare Turnstile secret key when prompted

# Verify secrets are set
wrangler secret list

# Deploy scheduled workers
wrangler deploy

# Verify cron triggers are registered
wrangler deployments list

# View cron execution logs
wrangler tail --format json
```

### Monitoring

**Key Metrics**:

- Daily cleanup counts (idempotency keys)
- Weekly cleanup counts (payment proofs)
- Execution duration
- Error rates

**Alerts**:

- ⚠️ >1000 idempotency keys deleted (indicates problem)
- ⚠️ >50 payment proofs deleted weekly (verify retention policy)
- 🔴 Cron execution failure

**Cloudflare Dashboard**:

- Workers > Analytics > Scheduled
- View execution count, duration, errors
- Filter by cron trigger

### Testing

```bash
# Test scheduled function locally
wrangler dev

# Trigger scheduled event manually (for testing)
curl -X POST http://localhost:8787/__scheduled \
  -H "Content-Type: application/json" \
  -d '{"cron": "0 2 * * *"}'
```

### Troubleshooting

| Issue                         | Solution                              |
| ----------------------------- | ------------------------------------- |
| Cron not executing            | Check `wrangler.toml` triggers syntax |
| Execution errors              | View logs with `wrangler tail`        |
| Missing environment variables | Add to `wrangler.toml` under `[vars]` |
| High cleanup volume           | Investigate booking creation issues   |

### Free Tier Usage

- **Limit**: 3 cron triggers/day
- **Current**: 2 triggers (daily + weekly)
- **Remaining**: 1 trigger available for future use

## Monitoring

### Key Metrics

```sql
-- Multi-unit booking adoption
SELECT
  COUNT(*) FILTER (WHERE is_multi_unit = TRUE) as multi_unit_bookings,
  COUNT(*) FILTER (WHERE is_multi_unit = FALSE) as single_unit_bookings,
  ROUND(COUNT(*) FILTER (WHERE is_multi_unit = TRUE)::DECIMAL / COUNT(*) * 100, 2) as adoption_rate
FROM bookings
WHERE created_at > NOW() - INTERVAL '7 days';

-- Pending assignment queue
SELECT COUNT(*) as pending_assignments
FROM bookings
WHERE unit_assignment_status = 'pending'
  AND payment_status = 'Verified';

-- Average assignment time
SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) as avg_hours
FROM bookings
WHERE unit_assignment_status = 'assigned'
  AND updated_at > NOW() - INTERVAL '7 days';
```

### Alerts

- Pending queue > 10 bookings
- Assignment time > 24 hours
- Payment verification errors
- Idempotency key collisions

## Phase 2 Pre-Email Integration

**Note**: Email integration is not planned for initial launch. This section documents future requirements when email notifications are implemented.

### 1. Notification Tracking Table

Before implementing email notifications, add this table for delivery tracking and fallback support:

```sql
CREATE TABLE notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'booking_confirmation', 'unit_assignment',
    'payment_verification', 'pre_arrival_reminder'
  )),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notification_log_booking ON notification_log(booking_id);
CREATE INDEX idx_notification_failed ON notification_log(status) WHERE status = 'failed';
```

**Purpose**: Tracks all notification attempts and supports fallback to manual contact when email delivery fails.

### 2. Fallback Strategy

When email delivery fails:

1. System logs failure in `notification_log` table
2. Admin sees "failed notification" alert in dashboard
3. Admin falls back to manual phone/SMS contact
4. Admin marks notification as completed manually

**Key Benefit**: Ensures guests are always contacted even if automated email fails.

## Post-Migration Tasks

### Admin Training

**Timeline**: Week 3 (before Phase 4 testing begins)

**Ownership & Responsibilities**:

- **Product Manager**: Create training materials, conduct training session
- **Developer**: Provide technical Q&A, create screenshots for documentation
- **Admin (Trainee)**: Complete training, provide feedback

**Training Materials Location**: `docs/implementation/guest-booking-multi-unit/admin-training/`

**Deliverables & Owners**:

| Material              | Format             | Owner                      | Deadline      | Status |
| --------------------- | ------------------ | -------------------------- | ------------- | ------ |
| Quick Reference Guide | 1-page PDF         | PM writes, Dev screenshots | End of Week 3 | [ ]    |
| Video Walkthrough     | 10-15min recording | PM records, Dev Q&A        | End of Week 3 | [ ]    |
| Admin FAQ             | Markdown doc       | PM drafts, Dev reviews     | End of Week 3 | [ ]    |
| Workflow Checklist    | Printable PDF      | Dev creates, PM validates  | End of Week 3 | [ ]    |

#### Quick Reference Guide Content Outline (1-page PDF)

**Header Section**:

- Title: "Multi-Unit Booking Management - Quick Reference"
- Version and date
- Emergency contact info

**Section 1: Queue Urgency Badges** (1/4 page):

- 🔴 Critical (75-100): Check-in <24h or >3 days pending
- 🟠 High (50-74): Check-in <48h or >2 days pending
- 🟡 Medium (25-49): Check-in <72h or 1-2 days pending
- ⚪ Low (<25): Check-in >72h, recently created

**Section 2: Payment Verification Checklist** (1/4 page):

- [ ] Receipt shows correct amount (matches downpayment required)
- [ ] Payment method visible (GCash/Bank Transfer/Cash)
- [ ] Transaction date within 48 hours of booking
- [ ] Screenshot clear and legible
- [ ] Booking reference matches system

**Section 3: Unit Assignment Workflow** (1/4 page):

1. Open assignment modal from pending queue
2. Review guest requirements (units + guests/unit)
3. Select available units (use availability calendar)
4. **Important**: Must assign ALL requested units (no partial)
5. Click "Assign Units" button
6. System marks as "Assigned" + Manual contact guest

**Section 4: Manual Contact Script Templates** (1/4 page):

**Confirmation (units assigned)**:

```
Hi [Guest Name], your booking BK-[REF] is confirmed!
You've been assigned [Unit Names]. Check-in: [Date] at 2 PM.
Need anything? Reply here. See you soon!
```

**Insufficient Units**:

```
Hi [Guest Name], your booking BK-[REF] needs adjustment.
Only [X] of [Y] units available for your dates.
Can we offer: [Alternative dates/units]?
Let's find a solution!
```

**Payment Issue**:

```
Hi [Guest Name], we need clearer payment proof for BK-[REF].
Please resend showing: amount, date, reference.
Thanks!
```

**Footer**: Common errors and quick fixes (tiny font, 1-2 lines each)

---

#### Video Walkthrough Script Outline (10-15 min)

**[0:00-2:00] Introduction & Login**:

- Navigate to admin dashboard
- Explain queue layout and urgency indicators
- Show filter options (pending, assigned, payment status)

**[2:00-5:00] Payment Verification Demo**:

- Open booking #1 (test data)
- Click payment proof thumbnail
- Review verification checklist step-by-step
- Mark as "Verified" in system
- Explain what to do if proof unclear

**[5:00-9:00] Unit Assignment Walkthrough**:

- Open assignment modal for booking #2 (3 units requested)
- Explain availability calendar view
- Show unit selection process
- Demonstrate ALL-OR-NOTHING rule (try assigning only 2 units - fails)
- Successfully assign all 3 units
- System transition: pending → assigned

**[9:00-12:00] Manual Contact Workflow**:

- Show where guest contact info is displayed
- Demonstrate copying contact template
- Explain when to call vs SMS
- Show how to document contact in notes field

**[12:00-14:00] Edge Case Handling**:

- **Case 1**: Booking requests 5 units but only 3 available
  - Solution: Contact guest with alternatives
- **Case 2**: Payment proof shows wrong amount
  - Solution: Request corrected proof
- **Case 3**: Guest wants to change dates
  - Solution: Escalation to manager

**[14:00-15:00] Wrap-up & Resources**:

- Where to find Quick Reference Guide
- Admin FAQ location
- Who to contact for help
- Practice scenarios for next training session

---

#### Admin FAQ Content (15 questions)

**Payment Verification**:

1. **Q**: What if payment proof is unclear or blurry?
   **A**: Contact guest via phone/SMS requesting clearer photo. Use script: "Hi [Name], we need clearer payment proof for BK-[REF]..."

2. **Q**: What if the amount doesn't match the downpayment required?
   **A**: DO NOT verify. Contact guest to clarify. If overpayment, note for manager. If underpayment, request remainder.

3. **Q**: How long do I have to verify payments?
   **A**: SLO is 2 hours during business hours (9 AM - 6 PM). System highlights overdue verifications in red.

**Unit Assignment**: 4. **Q**: Can I assign only some units if not all are available?
**A**: NO. System enforces all-or-nothing. You must either: (1) Assign ALL requested units, or (2) Contact guest to modify booking.

5. **Q**: What if guest wants specific unit types (deluxe, standard, etc.)?
   **A**: Current system doesn't expose unit types to guests. Use your judgment to assign best-fit units based on notes.

6. **Q**: Can I reassign units after initial assignment?
   **A**: Yes, but ONLY before guest checks in. Use "Edit Assignment" button in booking details.

**Contact & Communication**: 7. **Q**: When should I call vs. SMS?
**A**: Call for urgent issues (check-in <24h, payment problems). SMS for routine confirmations.

8. **Q**: What if guest doesn't answer phone?
   **A**: Try SMS, wait 2 hours, escalate to manager if urgent. Document all attempts in notes.

9. **Q**: Do I send email confirmations?
   **A**: NO. Manual contact only (phone/SMS). Email not implemented in Phase 1.

**Edge Cases**: 10. **Q**: Guest requests more units than available for their dates?
**A**: Contact guest ASAP. Offer: (1) Different dates, (2) Fewer units, (3) Wait-list if cancellations occur.

11. **Q**: Payment was made but guest can't provide proof?
    **A**: Ask for: bank statement screenshot, transaction ID, or visit in person with receipt. Escalate if suspicious.

12. **Q**: Guest wants to cancel after payment verified but before unit assignment?
    **A**: Escalate to manager immediately. Cancellation policy applies. DO NOT mark as assigned.

**System & Technical**: 13. **Q**: What if the system shows an error when assigning units?
**A**: Most common: Double-booking (unit already assigned to someone else). Check availability calendar. If persists, contact developer.

14. **Q**: How do I know which bookings are most urgent?
    **A**: Urgency score (0-100). Red badges (75+) are critical - handle first.

15. **Q**: What if urgency scoring seems wrong?
    **A**: Scoring is automatic based on: check-in proximity, days pending, booking value, unit count. Contact developer if consistently inaccurate.

---

#### Workflow Checklist (Printable PDF)

**Daily Opening Checklist**:

- [ ] Log into admin dashboard
- [ ] Check pending bookings count
- [ ] Review critical (red) urgency items first
- [ ] Set daily target: Process all critical + 5 high priority

**Per-Booking Workflow**:

- [ ] Open booking from queue
- [ ] Review guest info (name, contact, dates, units requested)
- [ ] **STEP 1**: Verify payment proof
  - [ ] Amount matches downpayment
  - [ ] Date within 48 hours
  - [ ] Screenshot clear
  - [ ] Mark as "Verified" in system
- [ ] **STEP 2**: Assign units
  - [ ] Check availability calendar
  - [ ] Select appropriate units
  - [ ] Confirm all requested units selected
  - [ ] Click "Assign Units"
  - [ ] Verify status changes to "Assigned"
- [ ] **STEP 3**: Contact guest
  - [ ] Copy confirmation template
  - [ ] Personalize with unit names and dates
  - [ ] Send via SMS (preferred) or call
  - [ ] Document contact in booking notes
- [ ] Move to next booking

**End-of-Day Checklist**:

- [ ] All critical (red) bookings processed
- [ ] No pending verifications >2 hours old
- [ ] Notes documented for problematic bookings
- [ ] Tomorrow's critical bookings identified

**Edge Case Decision Tree**:

```
Insufficient Units Available?
├─ YES → Contact guest (offer alternatives) → Document outcome
└─ NO → Continue to assignment

Payment Proof Unclear?
├─ YES → Request new proof → Set follow-up reminder
└─ NO → Continue to verification

Guest Not Responding?
├─ Urgent (<24h) → Escalate to manager + Try multiple methods
└─ Not Urgent → Try again in 4 hours → Document attempts
```

---

**Training Materials Storage**:

- Create directory: `docs/implementation/guest-booking-multi-unit/admin-training/`
- Files:
  - `quick-reference-guide.pdf`
  - `video-walkthrough.mp4`
  - `admin-faq.md`
  - `workflow-checklist.pdf`
  - `screenshots/` (subdirectory for UI screenshots)

**Core Topics**:

1. Queue prioritization by urgency (0-100 scoring)
2. Payment proof verification workflow (GCash/Bank/Cash)
3. Unit assignment interface usage (all-or-nothing rule)
4. Manual guest contact procedures (phone/SMS templates)
5. Edge case handling (insufficient units, payment mismatches)

**Training Session Schedule**:

- **Duration**: 2 hours
- **When**: End of Week 3 (after materials complete)
- **Format**: Live booking simulation with test data
- **Participants**: Admin, Developer, Product Manager

**Success Criteria**:
Admin independently processes 3 test bookings without assistance covering:

- Standard multi-unit booking
- Booking with insufficient units available
- Booking with payment verification issue

**Post-Training Support**:

- **Week 1**: Daily 15-min check-ins with developer
- **Ongoing**: Admin support channel (Slack/Messenger)
- **Optional**: Monthly refresher sessions

### Documentation

- Update admin manual
- Create guest FAQ
- Document manual contact workflow
- NO email notification procedures (not implemented)

### Monitoring Setup

- Queue length alerts
- Assignment time tracking
- Payment verification metrics
- Idempotency key cleanup cron job

## Testing Checklist

- [ ] Database migration successful
- [ ] All constraints active
- [ ] Idempotency prevents duplicates
- [ ] Pricing function returns correct values
- [ ] Discount rules apply correctly
- [ ] Guest booking form submits
- [ ] Admin queue displays urgency scores
- [ ] Unit assignment validates all-or-nothing
- [ ] Payment verification blocks assignment
- [ ] Concurrency prevents double-booking
- [ ] Rollback procedure tested on staging

## Key Implementation Notes

**Array-Based Model:**

- Each `guest_booking_unit_requests` row = 1 unit
- NO `quantity` column exists anywhere

**Pricing Authority:**

- PostgreSQL `calculate_booking_pricing()` is authoritative
- TypeScript engine is client preview only

**Manual Contact Workflow:**

- NO email notifications implemented
- Admin contacts guests via phone/SMS
- Future: Resend/SendGrid integration planned

**Idempotency:**

- 24-hour key expiry
- Cleanup via cron job
- Retry allowed for failed bookings

**All-or-Nothing Assignment:**

- Database constraint enforces
- NO partial assignments possible
- Only 2 statuses: `pending`, `assigned`
