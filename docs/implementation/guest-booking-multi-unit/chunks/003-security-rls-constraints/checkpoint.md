# Checkpoint: Chunk 003 Verification

## Purpose

This document provides comprehensive verification procedures to ensure Chunk 003 (Security, RLS, and Constraints) was implemented correctly. All tests must pass before proceeding to Chunk 004.

---

## Automated Checks

Run these SQL queries in Supabase SQL Editor or psql to verify security mechanisms.

### Check 1: EXCLUDE Constraint Exists (Concurrency Control)

```sql
SELECT
    conname AS constraint_name,
    contype AS type,
    pg_get_constraintdef(oid) AS definition,
    CASE
        WHEN conname = 'no_double_booking'
            AND contype = 'x'  -- 'x' = EXCLUDE constraint
        THEN '✅ EXISTS (EXCLUDE)'
        ELSE '❌ WRONG TYPE'
    END AS status
FROM pg_constraint
WHERE conrelid = 'booking_units'::regclass
  AND conname = 'no_double_booking';
```

**Expected Output**: 1 row with status '✅ EXISTS (EXCLUDE)'

**Constraint Definition Should Include**:

- `EXCLUDE USING gist`
- `unit_id WITH =`
- `daterange(check_in_date, check_out_date, '[]') WITH &&`
- `WHERE (status <> 'cancelled')`

**Status**: [ ] Pass [ ] Fail

---

### Check 2: All-or-Nothing Assignment Constraint Exists

```sql
SELECT
    conname AS constraint_name,
    contype AS type,
    pg_get_constraintdef(oid) AS definition,
    CASE
        WHEN conname = 'all_or_nothing_assignment'
            AND contype = 'c'  -- 'c' = CHECK constraint
        THEN '✅ EXISTS (CHECK)'
        ELSE '❌ WRONG TYPE'
    END AS status
FROM pg_constraint
WHERE conrelid = 'bookings'::regclass
  AND conname = 'all_or_nothing_assignment';
```

**Expected Output**: 1 row with status '✅ EXISTS (CHECK)'

**Constraint Definition Should Include**:

- `unit_assignment_status <> 'assigned'`
- Subquery counting `booking_units` with `status = 'confirmed'`
- Subquery counting `guest_booking_unit_requests`
- Equality check between the two counts

**Status**: [ ] Pass [ ] Fail

---

### Check 3: Payment-Before-Assignment Constraint Exists

```sql
SELECT
    conname AS constraint_name,
    contype AS type,
    pg_get_constraintdef(oid) AS definition,
    CASE
        WHEN conname = 'payment_before_assignment'
            AND contype = 'c'
        THEN '✅ EXISTS (from Chunk 001)'
        ELSE '❌ MISSING'
    END AS status
FROM pg_constraint
WHERE conrelid = 'bookings'::regclass
  AND conname = 'payment_before_assignment';
```

**Expected Output**: 1 row with status '✅ EXISTS (from Chunk 001)'

**Constraint Definition Should Include**:

- `unit_assignment_status <> 'assigned'`
- `payment_status IN ('Verified', 'Completed', 'Paid')`

**Status**: [ ] Pass [ ] Fail

---

### Check 4: All Constraints Summary

```sql
-- View all security constraints together
SELECT
    conrelid::regclass AS table_name,
    conname AS constraint_name,
    contype AS type,
    CASE contype
        WHEN 'c' THEN 'CHECK'
        WHEN 'x' THEN 'EXCLUDE'
        WHEN 'f' THEN 'FOREIGN KEY'
        WHEN 'p' THEN 'PRIMARY KEY'
        WHEN 'u' THEN 'UNIQUE'
        ELSE 'OTHER'
    END AS constraint_type,
    '✅ EXISTS' AS status
FROM pg_constraint
WHERE conrelid IN ('bookings'::regclass, 'booking_units'::regclass)
  AND conname IN (
    'no_double_booking',
    'all_or_nothing_assignment',
    'payment_before_assignment'
  )
ORDER BY table_name, constraint_name;
```

**Expected Output**: 3 rows total

- `booking_units.no_double_booking` (EXCLUDE)
- `bookings.all_or_nothing_assignment` (CHECK)
- `bookings.payment_before_assignment` (CHECK)

**Status**: [ ] Pass [ ] Fail

---

### Check 5: Audit Logs Table Exists

```sql
SELECT
    table_name,
    CASE
        WHEN table_name = 'audit_logs' THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END AS status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'audit_logs';
```

**Expected Output**: 1 row with status '✅ EXISTS'

**Status**: [ ] Pass [ ] Fail

---

### Check 6: Audit Triggers Exist

```sql
SELECT
    event_object_table AS table_name,
    trigger_name,
    event_manipulation AS trigger_event,
    action_statement,
    '✅ EXISTS' AS status
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN (
    'audit_bookings_trigger',
    'audit_booking_units_trigger'
  )
ORDER BY event_object_table, trigger_name;
```

**Expected Output**: 2 rows

- `bookings.audit_bookings_trigger`
- `booking_units.audit_booking_units_trigger`

**Both Should Execute**: `audit_log_trigger()` function

**Status**: [ ] Pass [ ] Fail

---

### Check 7: Audit Trigger Function Exists

```sql
SELECT
    routine_name,
    routine_type,
    CASE
        WHEN routine_name = 'audit_log_trigger'
            AND routine_type = 'FUNCTION'
        THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END AS status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'audit_log_trigger';
```

**Expected Output**: 1 row with status '✅ EXISTS'

**Status**: [ ] Pass [ ] Fail

---

### Check 8: Audit Logs RLS Enabled

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
  AND tablename = 'audit_logs';
```

**Expected Output**: 1 row with status '✅ ENABLED'

**Status**: [ ] Pass [ ] Fail

---

### Check 9: Audit Logs RLS Policies Exist

```sql
SELECT
    schemaname,
    tablename,
    policyname,
    '✅ EXISTS' AS status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'audit_logs'
ORDER BY policyname;
```

**Expected Output**: 2+ policies

- `audit_logs_admin_select` (admin can view all logs)
- `audit_logs_service_all` (service role has full access)

**Status**: [ ] Pass [ ] Fail

---

### Check 10: Indexes for Audit Performance

```sql
SELECT
    tablename,
    indexname,
    indexdef,
    '✅ EXISTS' AS status
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'audit_logs'
  AND indexname IN (
    'idx_audit_logs_table_record',
    'idx_audit_logs_created_at',
    'idx_audit_logs_action'
  )
ORDER BY indexname;
```

**Expected Output**: 3 indexes for audit logs performance

**Status**: [ ] Pass [ ] Fail

---

## Functional Tests

Test actual functionality of security mechanisms.

### Test 1: Double-Booking Prevention (EXCLUDE Constraint)

**Purpose**: Verify EXCLUDE constraint prevents overlapping bookings

```sql
DO $$
DECLARE
    v_test_unit_id UUID;
    v_test_booking_1 UUID := gen_random_uuid();
    v_test_booking_2 UUID := gen_random_uuid();
    v_success BOOLEAN := FALSE;
BEGIN
    -- Get a test unit
    SELECT unit_id INTO v_test_unit_id
    FROM units
    WHERE unit_status = 'Available'
    LIMIT 1;

    IF v_test_unit_id IS NULL THEN
        RAISE EXCEPTION 'No available units for testing. Add units to database first.';
    END IF;

    -- Insert first booking (should succeed)
    INSERT INTO booking_units (
        booking_id, unit_id, check_in_date, check_out_date, status
    ) VALUES (
        v_test_booking_1, v_test_unit_id, '2026-01-01', '2026-01-05', 'confirmed'
    );

    -- Try to insert overlapping booking (should FAIL)
    BEGIN
        INSERT INTO booking_units (
            booking_id, unit_id, check_in_date, check_out_date, status
        ) VALUES (
            v_test_booking_2, v_test_unit_id, '2026-01-03', '2026-01-07', 'confirmed'  -- Overlaps!
        );

        -- If we reach here, test FAILED
        RAISE EXCEPTION '❌ FAIL: EXCLUDE constraint did not fire (double-booking allowed)';

    EXCEPTION
        WHEN exclusion_violation THEN
            -- Expected behavior
            v_success := TRUE;
    END;

    -- Clean up
    DELETE FROM booking_units WHERE booking_id IN (v_test_booking_1, v_test_booking_2);

    IF v_success THEN
        RAISE NOTICE '✅ PASS: Double-booking prevented by EXCLUDE constraint';
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        DELETE FROM booking_units WHERE booking_id IN (v_test_booking_1, v_test_booking_2);
        RAISE;
END $$;
```

**Expected Output**: `✅ PASS: Double-booking prevented by EXCLUDE constraint`

**Status**: [ ] Pass [ ] Fail

---

### Test 2: Cancelled Bookings Allow Same Dates

**Purpose**: Verify EXCLUDE constraint excludes cancelled bookings (WHERE clause works)

```sql
DO $$
DECLARE
    v_test_unit_id UUID;
    v_test_booking_1 UUID := gen_random_uuid();
    v_test_booking_2 UUID := gen_random_uuid();
BEGIN
    SELECT unit_id INTO v_test_unit_id FROM units WHERE unit_status = 'Available' LIMIT 1;

    -- Insert first booking and mark as cancelled
    INSERT INTO booking_units (
        booking_id, unit_id, check_in_date, check_out_date, status
    ) VALUES (
        v_test_booking_1, v_test_unit_id, '2026-02-01', '2026-02-05', 'cancelled'
    );

    -- Insert second booking with same dates (should SUCCEED - first is cancelled)
    INSERT INTO booking_units (
        booking_id, unit_id, check_in_date, check_out_date, status
    ) VALUES (
        v_test_booking_2, v_test_unit_id, '2026-02-01', '2026-02-05', 'confirmed'
    );

    RAISE NOTICE '✅ PASS: Cancelled bookings do not block new bookings';

    -- Clean up
    DELETE FROM booking_units WHERE booking_id IN (v_test_booking_1, v_test_booking_2);

EXCEPTION
    WHEN OTHERS THEN
        DELETE FROM booking_units WHERE booking_id IN (v_test_booking_1, v_test_booking_2);
        RAISE NOTICE '❌ FAIL: %', SQLERRM;
END $$;
```

**Expected Output**: `✅ PASS: Cancelled bookings do not block new bookings`

**Status**: [ ] Pass [ ] Fail

---

### Test 3: All-or-Nothing Assignment (Complete Assignment)

**Purpose**: Verify constraint allows assignment when ALL units are assigned

```sql
DO $$
DECLARE
    v_test_booking_id UUID := gen_random_uuid();
    v_test_guest_id UUID;
    v_units UUID[];
BEGIN
    SELECT guest_id INTO v_test_guest_id FROM guests LIMIT 1;
    SELECT ARRAY(SELECT unit_id FROM units WHERE unit_status = 'Available' LIMIT 2) INTO v_units;

    -- Create booking requesting 2 units
    INSERT INTO bookings (
        booking_id, booking_reference, guest_id, check_in_date, check_out_date,
        num_guests, total_amount, is_multi_unit, is_guest_booking,
        requested_unit_count, unit_assignment_status, payment_status, booking_status
    ) VALUES (
        v_test_booking_id, 'TEST-COMPLETE', v_test_guest_id, '2026-03-01', '2026-03-03',
        4, 12000.00, TRUE, TRUE, 2, 'pending', 'Verified', 'Pending'
    );

    -- Create 2 unit requests
    INSERT INTO guest_booking_unit_requests (booking_id, guests_per_unit)
    VALUES (v_test_booking_id, 2), (v_test_booking_id, 2);

    -- Assign BOTH units (2/2)
    INSERT INTO booking_units (booking_id, unit_id, check_in_date, check_out_date, status)
    VALUES
        (v_test_booking_id, v_units[1], '2026-03-01', '2026-03-03', 'confirmed'),
        (v_test_booking_id, v_units[2], '2026-03-01', '2026-03-03', 'confirmed');

    -- Mark as assigned (should SUCCEED - all units assigned)
    UPDATE bookings SET unit_assignment_status = 'assigned' WHERE booking_id = v_test_booking_id;

    RAISE NOTICE '✅ PASS: Complete assignment (2/2 units) allowed';

    -- Clean up
    DELETE FROM bookings WHERE booking_id = v_test_booking_id;

EXCEPTION
    WHEN OTHERS THEN
        DELETE FROM bookings WHERE booking_id = v_test_booking_id;
        RAISE NOTICE '❌ FAIL: %', SQLERRM;
END $$;
```

**Expected Output**: `✅ PASS: Complete assignment (2/2 units) allowed`

**Status**: [ ] Pass [ ] Fail

---

### Test 4: All-or-Nothing Assignment (Partial Blocked)

**Purpose**: Verify constraint blocks assignment when only some units are assigned

```sql
DO $$
DECLARE
    v_test_booking_id UUID := gen_random_uuid();
    v_test_guest_id UUID;
    v_unit UUID;
    v_success BOOLEAN := FALSE;
BEGIN
    SELECT guest_id INTO v_test_guest_id FROM guests LIMIT 1;
    SELECT unit_id INTO v_unit FROM units WHERE unit_status = 'Available' LIMIT 1;

    -- Create booking requesting 3 units
    INSERT INTO bookings (
        booking_id, booking_reference, guest_id, check_in_date, check_out_date,
        num_guests, total_amount, is_multi_unit, is_guest_booking,
        requested_unit_count, unit_assignment_status, payment_status, booking_status
    ) VALUES (
        v_test_booking_id, 'TEST-PARTIAL', v_test_guest_id, '2026-04-01', '2026-04-03',
        6, 18000.00, TRUE, TRUE, 3, 'pending', 'Verified', 'Pending'
    );

    -- Create 3 unit requests
    INSERT INTO guest_booking_unit_requests (booking_id, guests_per_unit)
    VALUES (v_test_booking_id, 2), (v_test_booking_id, 2), (v_test_booking_id, 2);

    -- Assign ONLY 1 unit (1/3)
    INSERT INTO booking_units (booking_id, unit_id, check_in_date, check_out_date, status)
    VALUES (v_test_booking_id, v_unit, '2026-04-01', '2026-04-03', 'confirmed');

    -- Try to mark as assigned (should FAIL - only 1/3 units)
    BEGIN
        UPDATE bookings SET unit_assignment_status = 'assigned' WHERE booking_id = v_test_booking_id;
        RAISE EXCEPTION '❌ FAIL: Partial assignment allowed (constraint did not fire)';
    EXCEPTION
        WHEN check_violation THEN
            v_success := TRUE;
    END;

    -- Clean up
    DELETE FROM bookings WHERE booking_id = v_test_booking_id;

    IF v_success THEN
        RAISE NOTICE '✅ PASS: Partial assignment (1/3 units) blocked by constraint';
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        DELETE FROM bookings WHERE booking_id = v_test_booking_id;
        RAISE;
END $$;
```

**Expected Output**: `✅ PASS: Partial assignment (1/3 units) blocked by constraint`

**Status**: [ ] Pass [ ] Fail

---

### Test 5: Payment-Before-Assignment Constraint

**Purpose**: Verify payment verification required before assignment

```sql
DO $$
DECLARE
    v_test_booking_id UUID := gen_random_uuid();
    v_test_guest_id UUID;
    v_success BOOLEAN := FALSE;
BEGIN
    SELECT guest_id INTO v_test_guest_id FROM guests LIMIT 1;

    -- Create booking with PENDING payment
    INSERT INTO bookings (
        booking_id, booking_reference, guest_id, check_in_date, check_out_date,
        num_guests, total_amount, is_multi_unit, unit_assignment_status,
        payment_status, booking_status
    ) VALUES (
        v_test_booking_id, 'TEST-PAYMENT', v_test_guest_id, '2026-05-01', '2026-05-03',
        2, 6000.00, TRUE, 'pending', 'Pending', 'Pending'  -- Payment NOT verified
    );

    -- Try to mark as assigned (should FAIL)
    BEGIN
        UPDATE bookings SET unit_assignment_status = 'assigned' WHERE booking_id = v_test_booking_id;
        RAISE EXCEPTION '❌ FAIL: Assignment without payment verification allowed';
    EXCEPTION
        WHEN check_violation THEN
            v_success := TRUE;
    END;

    -- Clean up
    DELETE FROM bookings WHERE booking_id = v_test_booking_id;

    IF v_success THEN
        RAISE NOTICE '✅ PASS: Assignment blocked when payment not verified';
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        DELETE FROM bookings WHERE booking_id = v_test_booking_id;
        RAISE;
END $$;
```

**Expected Output**: `✅ PASS: Assignment blocked when payment not verified`

**Status**: [ ] Pass [ ] Fail

---

### Test 6: Audit Trigger Fires on Booking Creation

**Purpose**: Verify audit log is created when multi-unit guest booking is created

```sql
DO $$
DECLARE
    v_test_booking_id UUID := gen_random_uuid();
    v_test_guest_id UUID;
    v_audit_count INTEGER;
BEGIN
    SELECT guest_id INTO v_test_guest_id FROM guests LIMIT 1;

    -- Create multi-unit guest booking (should trigger audit)
    INSERT INTO bookings (
        booking_id, booking_reference, guest_id, check_in_date, check_out_date,
        num_guests, total_amount, is_multi_unit, is_guest_booking, booking_status
    ) VALUES (
        v_test_booking_id, 'TEST-AUDIT', v_test_guest_id, '2026-06-01', '2026-06-03',
        2, 6000.00, TRUE, TRUE, 'Pending'
    );

    -- Check audit log
    SELECT COUNT(*) INTO v_audit_count
    FROM audit_logs
    WHERE table_name = 'bookings'
      AND record_id = v_test_booking_id
      AND action = 'created';

    -- Clean up
    DELETE FROM bookings WHERE booking_id = v_test_booking_id;
    DELETE FROM audit_logs WHERE record_id = v_test_booking_id;

    IF v_audit_count >= 1 THEN
        RAISE NOTICE '✅ PASS: Audit trigger fired on booking creation (% entries)', v_audit_count;
    ELSE
        RAISE EXCEPTION '❌ FAIL: Audit trigger did not fire';
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        DELETE FROM bookings WHERE booking_id = v_test_booking_id;
        DELETE FROM audit_logs WHERE record_id = v_test_booking_id;
        RAISE;
END $$;
```

**Expected Output**: `✅ PASS: Audit trigger fired on booking creation`

**Status**: [ ] Pass [ ] Fail

---

### Test 7: Audit Trigger Captures Before/After State

**Purpose**: Verify audit log stores complete change history in JSONB

```sql
DO $$
DECLARE
    v_test_booking_id UUID := gen_random_uuid();
    v_test_guest_id UUID;
    v_audit_record RECORD;
BEGIN
    SELECT guest_id INTO v_test_guest_id FROM guests LIMIT 1;

    -- Create booking
    INSERT INTO bookings (
        booking_id, booking_reference, guest_id, check_in_date, check_out_date,
        num_guests, total_amount, is_multi_unit, is_guest_booking,
        payment_status, booking_status
    ) VALUES (
        v_test_booking_id, 'TEST-AUDIT-STATE', v_test_guest_id, '2026-07-01', '2026-07-03',
        2, 6000.00, TRUE, TRUE, 'Pending', 'Pending'
    );

    -- Update payment status (should capture before/after)
    UPDATE bookings SET payment_status = 'Verified' WHERE booking_id = v_test_booking_id;

    -- Get audit log for update
    SELECT * INTO v_audit_record
    FROM audit_logs
    WHERE table_name = 'bookings'
      AND record_id = v_test_booking_id
      AND action = 'updated'
    ORDER BY created_at DESC
    LIMIT 1;

    -- Clean up
    DELETE FROM bookings WHERE booking_id = v_test_booking_id;
    DELETE FROM audit_logs WHERE record_id = v_test_booking_id;

    -- Verify audit captures before/after
    IF v_audit_record.changes IS NOT NULL
       AND v_audit_record.changes ? 'before'
       AND v_audit_record.changes ? 'after'
       AND (v_audit_record.changes->'before'->>'payment_status') = 'Pending'
       AND (v_audit_record.changes->'after'->>'payment_status') = 'Verified'
    THEN
        RAISE NOTICE '✅ PASS: Audit log captures before/after state correctly';
    ELSE
        RAISE EXCEPTION '❌ FAIL: Audit log missing or incorrect before/after state';
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        DELETE FROM bookings WHERE booking_id = v_test_booking_id;
        DELETE FROM audit_logs WHERE record_id = v_test_booking_id;
        RAISE;
END $$;
```

**Expected Output**: `✅ PASS: Audit log captures before/after state correctly`

**Status**: [ ] Pass [ ] Fail

---

## Manual Checks

Verify these manually via Supabase Dashboard.

### Manual Check 1: Constraints Visible in Dashboard

1. Go to Supabase Dashboard → Database → Schema Visualizer
2. Click on `booking_units` table
3. Verify you see **Constraints** section with:
   - [ ] `no_double_booking` (EXCLUDE)
4. Click on `bookings` table
5. Verify you see **Constraints** section with:
   - [ ] `all_or_nothing_assignment` (CHECK)
   - [ ] `payment_before_assignment` (CHECK)

**Status**: [ ] Pass [ ] Fail

---

### Manual Check 2: Audit Logs Table Structure

1. Open Supabase Dashboard → Table Editor
2. Click on `audit_logs` table
3. Verify columns exist:
   - [ ] `id` (uuid, primary key)
   - [ ] `table_name` (text)
   - [ ] `record_id` (uuid)
   - [ ] `action` (text with CHECK constraint: created/updated/deleted)
   - [ ] `changes` (jsonb)
   - [ ] `user_id` (uuid, nullable)
   - [ ] `created_at` (timestamptz)
4. Verify indexes exist (Indexes tab):
   - [ ] `idx_audit_logs_table_record`
   - [ ] `idx_audit_logs_created_at`
   - [ ] `idx_audit_logs_action`

**Status**: [ ] Pass [ ] Fail

---

### Manual Check 3: RLS Policies Active

1. Go to Supabase Dashboard → Authentication → Policies
2. Filter by table: `audit_logs`
3. Verify policies exist:
   - [ ] `audit_logs_admin_select` (SELECT for admins)
   - [ ] `audit_logs_service_all` (ALL for service_role)
4. Verify RLS is **Enabled** (toggle at top)

**Status**: [ ] Pass [ ] Fail

---

### Manual Check 4: Test Constraint in Dashboard

1. Go to Supabase Dashboard → Table Editor → `booking_units`
2. Try to insert overlapping bookings manually:
   - Insert row 1: unit_id=<some-unit>, check_in='2026-08-01', check_out='2026-08-05', status='confirmed'
   - Try to insert row 2: same unit_id, check_in='2026-08-03', check_out='2026-08-07', status='confirmed'
3. Verify error appears:
   - [ ] Error message: "conflicting key value violates exclusion constraint"
4. Delete test row 1

**Status**: [ ] Pass [ ] Fail

---

## Success Criteria Checklist

Mark each item when verified:

### Database Objects

- [ ] EXCLUDE constraint `no_double_booking` exists on `booking_units`
- [ ] CHECK constraint `all_or_nothing_assignment` exists on `bookings`
- [ ] CHECK constraint `payment_before_assignment` exists on `bookings` (from Chunk 001)
- [ ] `audit_logs` table exists
- [ ] `audit_log_trigger()` function exists
- [ ] Trigger `audit_bookings_trigger` attached to `bookings` table
- [ ] Trigger `audit_booking_units_trigger` attached to `booking_units` table
- [ ] RLS enabled on `audit_logs` table
- [ ] RLS policies exist for `audit_logs` (2+ policies)
- [ ] 3 indexes exist on `audit_logs` table

### Functional Tests

- [ ] EXCLUDE constraint prevents double-booking (overlapping dates)
- [ ] EXCLUDE constraint allows cancelled bookings to be replaced
- [ ] All-or-nothing constraint allows complete assignment (all units)
- [ ] All-or-nothing constraint blocks partial assignment (some units)
- [ ] Payment-before-assignment constraint blocks assignment without payment
- [ ] Audit trigger fires on booking creation
- [ ] Audit trigger captures before/after state correctly

### Integration

- [ ] All constraints visible in Supabase Dashboard
- [ ] Audit logs queryable via SQL
- [ ] RLS policies block unauthorized access to audit logs
- [ ] Manual constraint test in dashboard works as expected

---

## If Any Check Fails

### Step 1: Identify the Failure

Note which specific check failed and the error message.

### Step 2: Consult Troubleshooting Guide

Open `troubleshooting.md` and search for:

- "EXCLUDE constraint" → Section on GiST indexes and date ranges
- "CHECK constraint" → Section on subquery performance
- "Audit trigger" → Section on trigger function errors
- "RLS policy" → Section on permission denied errors

### Step 3: Common Quick Fixes

#### EXCLUDE Constraint Missing

- **Cause**: btree_gist extension not installed
- **Fix**: `CREATE EXTENSION IF NOT EXISTS btree_gist;`

#### CHECK Constraint Not Firing

- **Cause**: Constraint was dropped or condition is wrong
- **Fix**: Re-run constraint creation from `instructions.md` Step 4

#### Audit Triggers Not Firing

- **Cause**: Trigger condition not met (booking not multi-unit or not guest_booking)
- **Fix**: Verify `is_multi_unit = TRUE` and `is_guest_booking = TRUE` in test data

#### RLS Blocks Everything

- **Cause**: Using authenticated role without admin app_role
- **Fix**: Use service_role for testing or grant admin role to test user

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
git commit -m "feat: complete chunk 003-security-rls-constraints

- Added EXCLUDE constraint for double-booking prevention (no_double_booking)
- Added CHECK constraint for all-or-nothing assignment (all_or_nothing_assignment)
- Verified payment-before-assignment constraint (from chunk 001)
- Implemented audit logging system (audit_logs table, triggers, RLS)
- Tested all constraints with concurrent scenarios
- Verified RLS policies block unauthorized access

All checkpoint tests passing. Database now enforces all business rules automatically.
"
```

### 3. Tag Milestone (Optional)

```bash
git tag -a chunk-003 -m "Completed Chunk 003: Security, RLS, and Constraints"
git push origin main --tags
```

### 4. Move to Next Chunk

You are now ready for **Chunk 004: Core API Endpoints**.

**Dependencies Met**:

- ✅ EXCLUDE constraint prevents concurrent booking conflicts
- ✅ CHECK constraints enforce business rules (all-or-nothing, payment verification)
- ✅ Audit logging captures all critical operations
- ✅ RLS policies secure multi-tenant data

**Next Implementation**: REST API endpoints for guest bookings with Cloudflare Workers, leveraging database constraints for validation.

---

## Checkpoint Status Summary

| Check Category        | Total  | Passed   | Failed   | Status                      |
| --------------------- | ------ | -------- | -------- | --------------------------- |
| Automated Checks (10) | 10     | \_\_\_\_ | \_\_\_\_ | [ ] Complete                |
| Functional Tests (7)  | 7      | \_\_\_\_ | \_\_\_\_ | [ ] Complete                |
| Manual Checks (4)     | 4      | \_\_\_\_ | \_\_\_\_ | [ ] Complete                |
| **TOTAL**             | **21** | \_\_\_\_ | \_\_\_\_ | [ ] **READY FOR CHUNK 004** |

**Completion Date**: **\*\*\*\***\_**\*\*\*\***

**Verified By**: **\*\*\*\***\_**\*\*\*\***

---

**Congratulations!** All security checkpoints passed. Your database is bulletproof against double-booking, partial assignments, and unauthorized access.
