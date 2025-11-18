# Checkpoint: Chunk 001 Verification

## Purpose

This document provides comprehensive verification procedures to ensure Chunk 001 (Database Schema Setup) was implemented correctly. All tests must pass before proceeding to Chunk 002.

---

## Automated Checks

Run these SQL queries in Supabase SQL Editor or psql to verify database state.

### Check 1: All Tables Exist (4 new tables)

```sql
SELECT
    table_name,
    CASE
        WHEN table_name IN ('pricing_config', 'guest_booking_unit_requests', 'discount_rules', 'idempotency_keys')
        THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END AS status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'pricing_config',
    'guest_booking_unit_requests',
    'discount_rules',
    'idempotency_keys'
  )
ORDER BY table_name;
```

**Expected Output**: 4 rows, all with status '✅ EXISTS'

**Status**: [ ] Pass [ ] Fail

---

### Check 2: Bookings Table Extended (9 new columns)

```sql
SELECT
    column_name,
    data_type,
    '✅ EXISTS' AS status
FROM information_schema.columns
WHERE table_name = 'bookings'
  AND column_name IN (
    'is_multi_unit',
    'requested_unit_count',
    'discount_percent',
    'discount_amount',
    'downpayment_required',
    'unit_assignment_status',
    'pricing_snapshot',
    'is_guest_booking'
  )
ORDER BY column_name;
```

**Expected Output**: 8-9 rows (depending on existing schema)

**Required Columns**:

- `is_multi_unit` (boolean)
- `requested_unit_count` (integer)
- `discount_percent` (numeric)
- `discount_amount` (numeric)
- `downpayment_required` (numeric)
- `unit_assignment_status` (text)
- `pricing_snapshot` (jsonb)
- `is_guest_booking` (boolean)

**Status**: [ ] Pass [ ] Fail

---

### Check 3: All Functions Created (5 functions)

```sql
SELECT
    routine_name,
    routine_type,
    '✅ EXISTS' AS status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'calculate_booking_pricing',
    'create_guest_booking',
    'assign_units_to_booking',
    'cleanup_expired_idempotency_keys',
    'cleanup_expired_payment_proofs'
  )
ORDER BY routine_name;
```

**Expected Output**: 5 rows, all FUNCTION type

**Status**: [ ] Pass [ ] Fail

---

### Check 4: Default Pricing Config Exists (Singleton Row)

```sql
SELECT
    id,
    base_rate,
    weekend_rate,
    extra_person_rate,
    base_occupancy,
    max_capacity_per_unit,
    downpayment_percent,
    currency,
    CASE
        WHEN id = 'default'
            AND base_rate = 3000.00
            AND weekend_rate = 3500.00
            AND extra_person_rate = 500.00
            AND base_occupancy = 2
            AND max_capacity_per_unit = 20
            AND downpayment_percent = 50.00
            AND currency = 'PHP'
        THEN '✅ CORRECT'
        ELSE '❌ WRONG VALUES'
    END AS status
FROM pricing_config
WHERE id = 'default';
```

**Expected Output**: 1 row with status '✅ CORRECT'

**Status**: [ ] Pass [ ] Fail

---

### Check 5: Default Discount Rules Exist (4 rules)

```sql
SELECT
    name,
    discount_value,
    priority,
    is_active,
    conditions,
    CASE
        WHEN is_active = TRUE THEN '✅ ACTIVE'
        ELSE '❌ INACTIVE'
    END AS status
FROM discount_rules
ORDER BY priority;
```

**Expected Output**: 4 rows, all with status '✅ ACTIVE'

**Expected Rules**:

1. Week Stay Discount (7 nights, 5%)
2. Two Week Discount (14 nights, 10%)
3. Three Week Discount (21 nights, 15%)
4. Monthly Stay Discount (28 nights, 20%)

**Status**: [ ] Pass [ ] Fail

---

### Check 6: All Indexes Created (11 indexes)

```sql
SELECT
    tablename,
    indexname,
    '✅ EXISTS' AS status
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_guest_booking_requests_booking',
    'idx_bookings_multi_unit',
    'idx_bookings_assignment_pending',
    'idx_discount_rules_active',
    'idx_discount_rules_conditions',
    'idx_idempotency_expiry',
    'idx_idempotency_booking'
  )
ORDER BY tablename, indexname;
```

**Expected Output**: 7+ indexes (some may already exist from previous schema)

**Status**: [ ] Pass [ ] Fail

---

### Check 7: Constraints Exist

```sql
SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS definition,
    '✅ EXISTS' AS status
FROM pg_constraint
WHERE conrelid = 'bookings'::regclass
  AND conname IN (
    'payment_before_assignment'
  );
```

**Expected Output**: 1 row for payment_before_assignment (CHECK constraint)

**Status**: [ ] Pass [ ] Fail

---

### Check 8: RLS Enabled on All New Tables

```sql
SELECT
    schemaname,
    tablename,
    rowsecurity AS rls_enabled,
    CASE
        WHEN rowsecurity = TRUE THEN '✅ ENABLED'
        ELSE '❌ DISABLED'
    END AS status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'pricing_config',
    'guest_booking_unit_requests',
    'discount_rules',
    'idempotency_keys'
  )
ORDER BY tablename;
```

**Expected Output**: 4 rows, all with status '✅ ENABLED'

**Status**: [ ] Pass [ ] Fail

---

### Check 9: RLS Policies Exist

```sql
SELECT
    schemaname,
    tablename,
    policyname,
    '✅ EXISTS' AS status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'pricing_config',
    'guest_booking_unit_requests',
    'discount_rules',
    'idempotency_keys'
  )
ORDER BY tablename, policyname;
```

**Expected Output**: 7+ policies across the 4 tables

**Required Policies**:

- `pricing_config`: pricing_config_select_policy, pricing_config_admin_policy
- `guest_booking_unit_requests`: guest_booking_requests_insert_policy, guest_booking_requests_select_policy
- `discount_rules`: discount_rules_select_policy, discount_rules_admin_policy
- `idempotency_keys`: idempotency_keys_service_policy

**Status**: [ ] Pass [ ] Fail

---

## Functional Tests

Test actual functionality of the schema.

### Test 1: Pricing Function Placeholder - Valid Structure

⚠️ **Note**: This test verifies the **placeholder function** created in Chunk 001. Full pricing tests will be in Chunk 002.

```sql
WITH result AS (
    SELECT calculate_booking_pricing(
        '[{"guests_per_unit": 2}]'::JSONB,
        '2025-11-01'::DATE,
        '2025-11-04'::DATE  -- 3 nights
    ) AS pricing
)
SELECT
    pricing->>'version' AS version,
    pricing->>'nights' AS nights,
    pricing->>'total_units' AS total_units,
    pricing->>'total_guests' AS total_guests,
    pricing->>'message' AS message,
    pricing->>'total' AS total,
    CASE
        WHEN pricing->>'version' = '1.0.0-stub'
            AND (pricing->>'nights')::INTEGER = 3
            AND (pricing->>'total_units')::INTEGER = 1
            AND (pricing->>'total_guests')::INTEGER = 2
            AND pricing->>'message' LIKE '%Chunk 002%'
            AND (pricing->>'total')::DECIMAL = 0.00
        THEN '✅ PASS - Placeholder working'
        ELSE '❌ FAIL - Expected placeholder response'
    END AS status
FROM result;
```

**Expected**:

- `version`: "1.0.0-stub"
- `nights`: 3
- `total_units`: 1
- `total_guests`: 2
- `message`: Contains "Chunk 002"
- `total`: 0.00 (pricing not calculated in placeholder)

**Status**: [ ] Pass [ ] Fail

---

### Test 2: Pricing Function Placeholder - Multiple Units

```sql
WITH result AS (
    SELECT calculate_booking_pricing(
        '[{"guests_per_unit": 4}, {"guests_per_unit": 3}]'::JSONB,  -- 2 units
        '2025-11-01'::DATE,
        '2025-11-06'::DATE  -- 5 nights
    ) AS pricing
)
SELECT
    pricing->>'version' AS version,
    pricing->>'nights' AS nights,
    pricing->>'total_units' AS total_units,
    pricing->>'total_guests' AS total_guests,
    CASE
        WHEN pricing->>'version' = '1.0.0-stub'
            AND (pricing->>'total_units')::INTEGER = 2
            AND (pricing->>'total_guests')::INTEGER = 7  -- 4 + 3
            AND (pricing->>'nights')::INTEGER = 5
        THEN '✅ PASS - Placeholder calculating basic metrics'
        ELSE '❌ FAIL'
    END AS status
FROM result;
```

**Expected**:

- `total_units`: 2
- `total_guests`: 7 (4 + 3 guests summed correctly)
- `nights`: 5
- `version`: "1.0.0-stub"

**Status**: [ ] Pass [ ] Fail

---

### Test 3: Pricing Function Placeholder - Date Validation

```sql
DO $$
BEGIN
    -- This should raise an exception (invalid date range)
    PERFORM calculate_booking_pricing(
        '[{"guests_per_unit": 2}]'::JSONB,
        '2025-11-08'::DATE,  -- Check-in
        '2025-11-01'::DATE   -- Check-out BEFORE check-in
    );

    RAISE EXCEPTION '❌ FAIL: Date validation did not work';
EXCEPTION
    WHEN OTHERS THEN
        IF SQLERRM LIKE '%Invalid date range%' THEN
            RAISE NOTICE '✅ PASS: Date validation working correctly';
        ELSE
            RAISE NOTICE '❌ FAIL: Unexpected error: %', SQLERRM;
        END IF;
END $$;
```

**Expected**: Exception with message "Invalid date range: check-out must be after check-in"

**Status**: [ ] Pass [ ] Fail

---

### ⚠️ Comprehensive Pricing Tests in Chunk 002

The following pricing functionality will be tested in **Chunk 002** after full implementation:

- ❌ Discount evaluation (duration, date-range, advance-booking, unit-count)
- ❌ Weekend rate calculations (Friday-Saturday premium)
- ❌ Extra person fees (beyond base occupancy)
- ❌ Best-of discount policy (highest discount wins)
- ❌ Edge cases (0 nights, max discounts, boundary conditions)

---

### Test 4: Payment-Before-Assignment Constraint

This test should **FAIL** (constraint blocks the update).

```sql
-- Attempt to assign units without payment verification
DO $$
DECLARE
    v_test_booking_id UUID;
BEGIN
    -- Create a test booking with pending payment
    INSERT INTO bookings (
        booking_reference,
        unit_id,
        guest_id,
        guest_name,
        contact_number,
        email,
        num_guests,
        check_in,
        check_out,
        total_amount,
        booking_status,
        payment_status,
        is_multi_unit,
        unit_assignment_status
    )
    SELECT
        'TEST-CONSTRAINT-' || gen_random_uuid()::TEXT,
        unit_id,
        guest_id,
        'Test Guest',
        '09123456789',
        'test@example.com',
        2,
        '2025-12-01'::DATE,
        '2025-12-03'::DATE,
        6000.00,
        'Pending',
        'Pending',  -- Payment pending
        TRUE,
        'pending'
    FROM units LIMIT 1, guests LIMIT 1
    RETURNING booking_id INTO v_test_booking_id;

    -- Try to assign units (should fail)
    UPDATE bookings
    SET unit_assignment_status = 'assigned'
    WHERE booking_id = v_test_booking_id;

    -- Clean up test booking
    DELETE FROM bookings WHERE booking_id = v_test_booking_id;

    RAISE EXCEPTION 'Constraint did not fire! Test FAILED.';

EXCEPTION
    WHEN check_violation THEN
        -- Clean up test booking
        DELETE FROM bookings WHERE booking_id = v_test_booking_id;
        RAISE NOTICE '✅ PASS: payment_before_assignment constraint working correctly';
    WHEN OTHERS THEN
        RAISE NOTICE '❌ FAIL: Unexpected error: %', SQLERRM;
END $$;
```

**Expected**: `✅ PASS: payment_before_assignment constraint working correctly`

**Status**: [ ] Pass [ ] Fail

---

### Test 5: Pricing Config Singleton Constraint

This test should **FAIL** (constraint blocks the insert).

```sql
DO $$
BEGIN
    -- Try to insert a second row (should fail)
    INSERT INTO pricing_config (id, base_rate, weekend_rate, max_capacity_per_unit)
    VALUES ('another', 5000.00, 6000.00, 25);

    RAISE EXCEPTION 'Singleton constraint did not fire! Test FAILED.';

EXCEPTION
    WHEN check_violation THEN
        RAISE NOTICE '✅ PASS: pricing_config singleton constraint working correctly';
    WHEN OTHERS THEN
        RAISE NOTICE '❌ FAIL: Unexpected error: %', SQLERRM;
END $$;
```

**Expected**: `✅ PASS: pricing_config singleton constraint working correctly`

**Status**: [ ] Pass [ ] Fail

---

### Test 6: Idempotency Key Duplicate Detection

```sql
DO $$
DECLARE
    v_key UUID := gen_random_uuid();
    v_booking_id UUID;
    v_result1 JSONB;
    v_result2 JSONB;
BEGIN
    -- First booking creation
    v_result1 := create_guest_booking(
        '{"guest_name": "Test Guest", "email": "test@example.com", "phone_number": "09123456789"}'::JSONB,
        jsonb_build_object(
            'booking_reference', 'TEST-IDEM-001',
            'check_in_date', '2025-12-01',
            'check_out_date', '2025-12-03',
            'num_guests', 2,
            'total_amount', 6000.00,
            'discount_percent', 0,
            'discount_amount', 0,
            'downpayment_required', 3000.00,
            'pricing_snapshot', '{}'::JSONB,
            'special_requests', NULL
        ),
        '[{"guests_per_unit": 2}]'::JSONB,
        v_key
    );

    -- Second booking creation with same key (should return existing)
    v_result2 := create_guest_booking(
        '{"guest_name": "Test Guest", "email": "test@example.com", "phone_number": "09123456789"}'::JSONB,
        jsonb_build_object(
            'booking_reference', 'TEST-IDEM-002',  -- Different reference
            'check_in_date', '2025-12-01',
            'check_out_date', '2025-12-03',
            'num_guests', 2,
            'total_amount', 6000.00,
            'discount_percent', 0,
            'discount_amount', 0,
            'downpayment_required', 3000.00,
            'pricing_snapshot', '{}'::JSONB,
            'special_requests', NULL
        ),
        '[{"guests_per_unit": 2}]'::JSONB,
        v_key  -- Same key
    );

    -- Extract booking IDs
    v_booking_id := (v_result1->'booking'->>'booking_id')::UUID;

    -- Clean up
    DELETE FROM bookings WHERE booking_id = v_booking_id;
    DELETE FROM idempotency_keys WHERE key = v_key;

    -- Verify results
    IF (v_result1->>'is_duplicate')::BOOLEAN = FALSE
        AND (v_result2->>'is_duplicate')::BOOLEAN = TRUE
        AND (v_result1->'booking'->>'booking_id') = (v_result2->'booking'->>'booking_id')
    THEN
        RAISE NOTICE '✅ PASS: Idempotency working correctly (duplicate detected)';
    ELSE
        RAISE EXCEPTION '❌ FAIL: Idempotency not working';
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ FAIL: %', SQLERRM;
        -- Clean up on error
        DELETE FROM bookings WHERE booking_reference LIKE 'TEST-IDEM-%';
        DELETE FROM idempotency_keys WHERE key = v_key;
END $$;
```

**Expected**: `✅ PASS: Idempotency working correctly`

**Status**: [ ] Pass [ ] Fail

---

## Manual Checks

Verify these manually via Supabase Dashboard.

### Manual Check 1: Supabase Table Browser

1. Go to Supabase Dashboard → Table Editor
2. Verify you see these NEW tables:
   - [ ] `pricing_config`
   - [ ] `guest_booking_unit_requests`
   - [ ] `discount_rules`
   - [ ] `idempotency_keys`
3. Click on `bookings` table
4. Verify you see these NEW columns:
   - [ ] `is_multi_unit`
   - [ ] `requested_unit_count`
   - [ ] `discount_percent`
   - [ ] `unit_assignment_status`
   - [ ] `pricing_snapshot`

**Status**: [ ] Pass [ ] Fail

---

### Manual Check 2: Query `pricing_config` Table

1. Open Supabase Dashboard → SQL Editor
2. Run: `SELECT * FROM pricing_config;`
3. Verify exactly 1 row exists with:
   - [ ] `id = 'default'`
   - [ ] `base_rate = 3000.00`
   - [ ] `weekend_rate = 3500.00`
   - [ ] `max_capacity_per_unit = 20`

**Status**: [ ] Pass [ ] Fail

---

### Manual Check 3: Query `discount_rules` Table

1. Run: `SELECT name, discount_value, conditions FROM discount_rules ORDER BY priority;`
2. Verify 4 rows exist:
   - [ ] Week Stay Discount (5%, min_nights: 7)
   - [ ] Two Week Discount (10%, min_nights: 14)
   - [ ] Three Week Discount (15%, min_nights: 21)
   - [ ] Monthly Stay Discount (20%, min_nights: 28)

**Status**: [ ] Pass [ ] Fail

---

### Manual Check 4: TypeScript Types Regenerated

1. Open `src/types/database.types.ts`
2. Search for `pricing_config`:
   - [ ] Type definition exists for `pricing_config` table
3. Search for `guest_booking_unit_requests`:
   - [ ] Type definition exists
4. Search for `discount_rules`:
   - [ ] Type definition exists
5. Check `bookings` type has new properties:
   - [ ] `is_multi_unit?: boolean`
   - [ ] `requested_unit_count?: number`
   - [ ] `pricing_snapshot?: Json`

**Status**: [ ] Pass [ ] Fail

---

### Manual Check 5: No TypeScript Errors

1. Run: `npm run type-check`
2. Verify output shows **0 errors**
3. If errors exist, they should be unrelated to database schema

**Status**: [ ] Pass [ ] Fail

---

## Success Criteria Checklist

Mark each item when verified:

### Database Objects

- [ ] All 4 new tables exist
- [ ] `bookings` table has 9 new columns
- [ ] All 5 PostgreSQL functions exist
- [ ] `pricing_config` has exactly 1 row
- [ ] `discount_rules` has exactly 4 active rules
- [ ] All 11 indexes created
- [ ] `payment_before_assignment` constraint exists
- [ ] RLS enabled on all 4 new tables
- [ ] RLS policies exist (7+ policies)

### Functional Tests

- [ ] Pricing function works (single unit, no discount)
- [ ] Pricing function works (multiple units, extra guests)
- [ ] Pricing function applies discounts correctly
- [ ] Payment-before-assignment constraint fires
- [ ] Pricing config singleton constraint fires
- [ ] Idempotency key prevents duplicates

### Integration

- [ ] TypeScript types regenerated
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] All Supabase tables visible in dashboard
- [ ] Can query all new tables without errors

---

## If Any Check Fails

### Step 1: Identify the Failure

Note which specific check failed and the error message.

### Step 2: Consult Troubleshooting Guide

Open `troubleshooting.md` and search for:

- "Table not found" → Section on missing tables
- "Function does not exist" → Section on function creation
- "Constraint violation" → Section on constraint errors
- "Type errors" → Section on TypeScript type generation

### Step 3: Common Quick Fixes

#### All Objects Missing

- **Cause**: Migration didn't run or rolled back
- **Fix**: Re-run migration SQL from `instructions.md` Step 3

#### Functions Don't Exist

- **Cause**: Function creation failed silently
- **Fix**: Run functions individually from migration SQL

#### Constraints Don't Fire

- **Cause**: Constraint was dropped or not created
- **Fix**: Re-run constraint creation section from migration

#### TypeScript Types Missing

- **Cause**: Type generation failed or wasn't run
- **Fix**: Re-run `npx supabase gen types typescript`

### Step 4: Re-run Verification

After applying fixes, re-run ALL checkpoint tests from the beginning.

---

## When All Checks Pass

### 1. Document Results

Record completion:

- **Date/Time**: **\*\*\*\***\_**\*\*\*\***
- **Total Time Taken**: \***\*\_\*\*** minutes
- **Issues Encountered**: (list any)
- **Notes**: (any observations)

### 2. Commit Changes

```bash
git add .
git commit -m "feat: complete chunk 001-database-schema-setup

- Created pricing_config, guest_booking_unit_requests, discount_rules, idempotency_keys tables
- Extended bookings table with 9 multi-unit columns
- Implemented calculate_booking_pricing() authoritative pricing function
- Implemented create_guest_booking() atomic creation function
- Implemented assign_units_to_booking() all-or-nothing assignment
- Implemented cleanup functions for idempotency keys and payment proofs
- Added payment-before-assignment constraint
- Created 11 performance indexes
- Enabled RLS on all new tables
- Regenerated TypeScript types

All checkpoint tests passing.
"
```

### 3. Tag Milestone (Optional)

```bash
git tag -a chunk-001 -m "Completed Chunk 001: Database Schema Setup"
git push origin main --tags
```

### 4. Move to Next Chunk

You are now ready for **Chunk 002: PostgreSQL Pricing Engine**.

**Dependencies Met**:

- ✅ `pricing_config` table exists
- ✅ `discount_rules` table exists
- ✅ `guest_booking_unit_requests` table exists
- ✅ `calculate_booking_pricing()` function exists

**Next Implementation**: Advanced pricing logic with all 4 discount types and edge cases.

---

## Checkpoint Status Summary

| Check Category       | Total  | Passed   | Failed   | Status                      |
| -------------------- | ------ | -------- | -------- | --------------------------- |
| Automated Checks (9) | 9      | \_\_\_\_ | \_\_\_\_ | [ ] Complete                |
| Functional Tests (6) | 6      | \_\_\_\_ | \_\_\_\_ | [ ] Complete                |
| Manual Checks (5)    | 5      | \_\_\_\_ | \_\_\_\_ | [ ] Complete                |
| **TOTAL**            | **20** | \_\_\_\_ | \_\_\_\_ | [ ] **READY FOR CHUNK 002** |

**Completion Date**: **\*\*\*\***\_**\*\*\*\***

**Verified By**: **\*\*\*\***\_**\*\*\*\***

---

**Congratulations!** All checkpoints passed. Your database foundation is solid and ready for the next phase.
