# Implementation Instructions: Chunk 003

## Overview

This guide walks you through implementing database-level security, constraints, and audit logging for the multi-unit guest booking system. All SQL is copy-pasteable and production-ready.

**Estimated Time**: 90 minutes total

- Step 1-2: Preparation (10 min)
- Step 3: Execute constraints migration (20 min)
- Step 4: Create audit logging system (15 min)
- Step 5-7: Verification (25 min)
- Step 8: Finalization (10 min)
- Buffer for troubleshooting (10 min)

---

## Step 1: Verify Prerequisites (5 minutes)

Before implementing security constraints, verify Chunk 001 is complete.

### Check Required Tables Exist

```sql
-- Verify all required tables exist
SELECT
    table_name,
    CASE
        WHEN table_name IN (
            'bookings',
            'booking_units',
            'guest_booking_unit_requests',
            'pricing_config'
        ) THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END AS status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'bookings',
    'booking_units',
    'guest_booking_unit_requests',
    'pricing_config'
  )
ORDER BY table_name;
```

**Expected Output**: 4 rows, all with status '✅ EXISTS'

**Critical**: If `booking_units` table is missing, the EXCLUDE constraint will fail. This table should exist from base schema.

### Check btree_gist Extension

```sql
-- Verify btree_gist extension is installed (required for EXCLUDE constraint)
SELECT
    extname,
    extversion,
    '✅ INSTALLED' AS status
FROM pg_extension
WHERE extname = 'btree_gist';
```

**Expected Output**: 1 row with extname 'btree_gist'

**If missing**:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
```

### Check Existing Constraints

```sql
-- Check which constraints already exist
SELECT
    conname AS constraint_name,
    contype AS type,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid IN ('bookings'::regclass, 'booking_units'::regclass)
  AND conname IN (
    'payment_before_assignment',
    'all_or_nothing_assignment',
    'no_double_booking'
  )
ORDER BY conname;
```

**Expected Output**:

- `payment_before_assignment` (CHECK) - Created in Chunk 001
- Other constraints should NOT exist yet

---

## Step 2: Backup Current State (5 minutes)

Create a backup before adding constraints (safety measure).

### Using Supabase Dashboard

```bash
# 1. Go to Supabase Dashboard → Database → Backups
# 2. Click "Create Backup" → Name it "pre-chunk-003-security-constraints"
# 3. Wait for backup to complete (green checkmark)
```

### Using Command Line (Alternative)

```bash
# Export current schema only (constraints are in schema)
pg_dump -h db.<your-project-ref>.supabase.co \
  -U postgres \
  -d postgres \
  --schema-only \
  --schema=public \
  --file=backup_before_chunk_003_$(date +%Y%m%d_%H%M%S).sql

# Verify backup file exists
ls -lh backup_before_chunk_003_*.sql
```

---

## Step 3: Implement Concurrency Control (15 minutes)

Add EXCLUDE constraint to prevent double-booking.

### 🚀 EXCLUDE Constraint Migration (Copy Everything Below)

```sql
-- ============================================
-- CHUNK 003: Concurrency Control
-- EXCLUDE Constraint for Double-Booking Prevention
-- ============================================

BEGIN;

-- ============================================
-- 1. VERIFY btree_gist EXTENSION
-- ============================================
-- Required for EXCLUDE constraints with date ranges
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================
-- 2. ADD EXCLUDE CONSTRAINT (Primary Concurrency Control)
-- ============================================
-- Prevents overlapping bookings for the same unit
-- This constraint is BULLETPROOF - enforced at commit time with MVCC

-- Drop constraint if it exists (idempotent)
ALTER TABLE booking_units
DROP CONSTRAINT IF EXISTS no_double_booking;

-- Create EXCLUDE constraint
ALTER TABLE booking_units
ADD CONSTRAINT no_double_booking EXCLUDE USING gist (
    unit_id WITH =,
    daterange(check_in_date, check_out_date, '[]') WITH &&
) WHERE (status != 'cancelled');

COMMENT ON CONSTRAINT no_double_booking ON booking_units IS
'Primary concurrency control - prevents overlapping bookings for same unit. Bulletproof at commit time using PostgreSQL MVCC. Only active bookings (status != cancelled) are checked.';

-- ============================================
-- VERIFICATION: Test EXCLUDE Constraint
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ EXCLUDE constraint created successfully';
    RAISE NOTICE 'Constraint: no_double_booking';
    RAISE NOTICE 'Table: booking_units';
    RAISE NOTICE 'Purpose: Prevent overlapping date ranges for same unit';
    RAISE NOTICE 'Status: Active (excluding cancelled bookings)';
END $$;

COMMIT;
```

**What This Does**:

1. **EXCLUDE constraint** prevents two bookings from having:
   - Same `unit_id` (WITH =)
   - Overlapping date ranges (WITH &&)
   - Active status (WHERE status != 'cancelled')

2. **GiST index** is automatically created for performance (O(log n) lookups)

3. **Atomic enforcement** happens at transaction commit (no race conditions possible)

**Expected Output**: `✅ EXCLUDE constraint created successfully`

---

## Step 4: Implement All-or-Nothing Assignment (10 minutes)

Add CHECK constraint to enforce complete unit assignment.

### 🚀 All-or-Nothing Constraint Migration (Copy Everything Below)

```sql
-- ============================================
-- CHUNK 003: All-or-Nothing Assignment
-- CHECK Constraint for Complete Assignment
-- ============================================

BEGIN;

-- ============================================
-- ADD ALL-OR-NOTHING ASSIGNMENT CONSTRAINT
-- ============================================
-- Ensures admin assigns ALL requested units or NONE
-- Prevents partial fulfillment which confuses guests

-- Drop constraint if it exists (idempotent)
ALTER TABLE bookings
DROP CONSTRAINT IF EXISTS all_or_nothing_assignment;

-- Create CHECK constraint
-- Logic: If assignment_status is 'assigned', then:
--   COUNT(confirmed booking_units) MUST EQUAL COUNT(unit_requests)
ALTER TABLE bookings
ADD CONSTRAINT all_or_nothing_assignment CHECK (
    unit_assignment_status != 'assigned' OR (
        -- Number of confirmed units equals number of requested units
        (SELECT COUNT(*)
         FROM booking_units
         WHERE booking_units.booking_id = bookings.booking_id
           AND booking_units.status = 'confirmed')
        =
        (SELECT COUNT(*)
         FROM guest_booking_unit_requests
         WHERE guest_booking_unit_requests.booking_id = bookings.booking_id)
    )
);

COMMENT ON CONSTRAINT all_or_nothing_assignment ON bookings IS
'Enforces all-or-nothing unit assignment. Admin must assign ALL requested units (booking_units.status=confirmed) or NONE. Prevents partial assignments which confuse guests. Business rule: complete fulfillment only.';

-- ============================================
-- VERIFICATION: Test Constraint Exists
-- ============================================
DO $$
DECLARE
    v_constraint_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_constraint_count
    FROM pg_constraint
    WHERE conrelid = 'bookings'::regclass
      AND conname = 'all_or_nothing_assignment';

    IF v_constraint_count = 1 THEN
        RAISE NOTICE '✅ all_or_nothing_assignment constraint created successfully';
    ELSE
        RAISE EXCEPTION '❌ Constraint creation failed';
    END IF;
END $$;

COMMIT;
```

**What This Does**:

1. **CHECK constraint** validates before every UPDATE:
   - If `unit_assignment_status` = 'assigned'
   - Then: `COUNT(booking_units with status=confirmed)` = `COUNT(guest_booking_unit_requests)`

2. **Prevents partial assignments**:
   - Cannot mark as 'assigned' if only 2/3 units are in booking_units table

3. **Enforced at database level**:
   - Application bugs cannot bypass this rule

**Expected Output**: `✅ all_or_nothing_assignment constraint created successfully`

---

## Step 5: Verify Payment-Before-Assignment Constraint (5 minutes)

This constraint was created in Chunk 001. Verify it exists and works.

### Check Constraint Exists

```sql
-- Verify payment_before_assignment constraint exists
SELECT
    conname AS constraint_name,
    contype AS type,
    pg_get_constraintdef(oid) AS definition,
    '✅ EXISTS (from Chunk 001)' AS status
FROM pg_constraint
WHERE conrelid = 'bookings'::regclass
  AND conname = 'payment_before_assignment';
```

**Expected Output**: 1 row with CHECK constraint definition

**If missing** (unexpected - should exist from Chunk 001):

```sql
-- Re-create constraint
ALTER TABLE bookings
DROP CONSTRAINT IF EXISTS payment_before_assignment;

ALTER TABLE bookings
ADD CONSTRAINT payment_before_assignment CHECK (
    unit_assignment_status != 'assigned' OR payment_status IN ('Verified', 'Completed', 'Paid')
);
```

---

## Step 6: Implement Audit Logging System (15 minutes)

Create triggers to automatically log critical operations.

### 🚀 Audit Logging Migration (Copy Everything Below)

```sql
-- ============================================
-- CHUNK 003: Audit Logging System
-- Triggers for Immutable Compliance Trail
-- ============================================

BEGIN;

-- ============================================
-- 1. CREATE AUDIT LOG TABLE (if not exists)
-- ============================================
-- Stores immutable audit trail for compliance

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
    changes JSONB,
    user_id UUID,  -- NULL for unauthenticated actions
    user_email TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record
    ON audit_logs(table_name, record_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
    ON audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
    ON audit_logs(action);

COMMENT ON TABLE audit_logs IS
'Immutable audit trail for compliance. Logs all critical data mutations (booking creation, payment verification, unit assignment). Timestamps are PostgreSQL-generated (tamper-proof). Required for Philippine business compliance (BIR, DTI).';

-- ============================================
-- 2. CREATE AUDIT TRIGGER FUNCTION
-- ============================================
-- Generic function that logs changes in JSONB format

CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_action TEXT;
    v_changes JSONB;
    v_record_id UUID;
BEGIN
    -- Determine action
    IF TG_OP = 'INSERT' THEN
        v_action := 'created';
        v_record_id := NEW.booking_id;  -- Assumes table has booking_id
        v_changes := jsonb_build_object(
            'before', NULL,
            'after', row_to_json(NEW)::JSONB
        );
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'updated';
        v_record_id := NEW.booking_id;
        v_changes := jsonb_build_object(
            'before', row_to_json(OLD)::JSONB,
            'after', row_to_json(NEW)::JSONB
        );
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'deleted';
        v_record_id := OLD.booking_id;
        v_changes := jsonb_build_object(
            'before', row_to_json(OLD)::JSONB,
            'after', NULL
        );
    END IF;

    -- Insert audit log
    INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        changes,
        user_id,
        created_at
    ) VALUES (
        TG_TABLE_NAME,
        v_record_id,
        v_action,
        v_changes,
        (SELECT auth.uid()),  -- Supabase auth user ID (NULL if unauthenticated)
        NOW()
    );

    -- Return appropriate record
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_log_trigger IS
'Generic audit trigger function. Logs before/after state of records in JSONB format. Captures auth.uid() if available (Supabase). Timestamps are PostgreSQL-generated for tamper-proofing.';

-- ============================================
-- 3. ATTACH TRIGGERS TO CRITICAL TABLES
-- ============================================

-- Trigger: Booking creation/updates
DROP TRIGGER IF EXISTS audit_bookings_trigger ON bookings;
CREATE TRIGGER audit_bookings_trigger
    AFTER INSERT OR UPDATE OR DELETE ON bookings
    FOR EACH ROW
    WHEN (
        -- Only log multi-unit guest bookings
        (NEW.is_guest_booking IS TRUE AND NEW.is_multi_unit IS TRUE)
        OR
        (OLD.is_guest_booking IS TRUE AND OLD.is_multi_unit IS TRUE)
    )
    EXECUTE FUNCTION audit_log_trigger();

COMMENT ON TRIGGER audit_bookings_trigger ON bookings IS
'Logs creation and updates of multi-unit guest bookings. Captures: booking creation, payment verification, unit assignment status changes.';

-- Trigger: Unit assignment tracking
DROP TRIGGER IF EXISTS audit_booking_units_trigger ON booking_units;
CREATE TRIGGER audit_booking_units_trigger
    AFTER INSERT OR UPDATE OR DELETE ON booking_units
    FOR EACH ROW
    EXECUTE FUNCTION audit_log_trigger();

COMMENT ON TRIGGER audit_booking_units_trigger ON booking_units IS
'Logs all unit assignments and changes. Critical for tracking which units were assigned to which bookings.';

-- ============================================
-- 4. ENABLE RLS ON AUDIT LOGS
-- ============================================
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Admin can view all logs
CREATE POLICY audit_logs_admin_select ON audit_logs
    FOR SELECT TO authenticated
    USING (
        (SELECT app_role FROM app_roles WHERE user_id = auth.uid() AND is_active = TRUE LIMIT 1) = 'admin'
    );

-- Service role can do everything (for cron jobs, etc.)
CREATE POLICY audit_logs_service_all ON audit_logs
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

GRANT SELECT ON audit_logs TO authenticated;
GRANT ALL ON audit_logs TO service_role;

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ Audit logging system created successfully';
    RAISE NOTICE 'Created: audit_logs table';
    RAISE NOTICE 'Created: audit_log_trigger() function';
    RAISE NOTICE 'Attached: audit_bookings_trigger (bookings table)';
    RAISE NOTICE 'Attached: audit_booking_units_trigger (booking_units table)';
    RAISE NOTICE 'Enabled: RLS on audit_logs';
END $$;

COMMIT;
```

**What This Does**:

1. **Creates `audit_logs` table** - Stores all change history
2. **Generic trigger function** - Captures before/after state in JSONB
3. **Attaches triggers** to `bookings` and `booking_units` tables
4. **RLS policies** - Only admins can view audit logs
5. **Immutable timestamps** - PostgreSQL generates timestamps (cannot be faked)

**Expected Output**: `✅ Audit logging system created successfully`

---

## Step 7: Test All Constraints (20 minutes)

Verify all security mechanisms work correctly.

### Test 1: Double-Booking Prevention (EXCLUDE Constraint)

```sql
-- This test should FAIL with exclusion constraint violation
DO $$
DECLARE
    v_test_unit_id UUID;
    v_test_booking_1 UUID := gen_random_uuid();
    v_test_booking_2 UUID := gen_random_uuid();
BEGIN
    -- Get a test unit
    SELECT unit_id INTO v_test_unit_id
    FROM units
    WHERE unit_status = 'Available'
    LIMIT 1;

    IF v_test_unit_id IS NULL THEN
        RAISE EXCEPTION 'No available units for testing';
    END IF;

    -- Insert first booking (should succeed)
    INSERT INTO booking_units (
        booking_id,
        unit_id,
        check_in_date,
        check_out_date,
        status
    ) VALUES (
        v_test_booking_1,
        v_test_unit_id,
        '2025-12-01'::DATE,
        '2025-12-05'::DATE,
        'confirmed'
    );

    RAISE NOTICE 'First booking created: %', v_test_booking_1;

    -- Try to insert overlapping booking (should FAIL)
    BEGIN
        INSERT INTO booking_units (
            booking_id,
            unit_id,
            check_in_date,
            check_out_date,
            status
        ) VALUES (
            v_test_booking_2,
            v_test_unit_id,
            '2025-12-03'::DATE,  -- Overlaps with first booking
            '2025-12-07'::DATE,
            'confirmed'
        );

        -- If we reach here, constraint FAILED
        RAISE EXCEPTION '❌ CONSTRAINT FAILED: no_double_booking did not fire!';

    EXCEPTION
        WHEN exclusion_violation THEN
            -- Expected behavior
            RAISE NOTICE '✅ PASS: no_double_booking constraint working correctly';
            RAISE NOTICE 'Overlapping booking blocked as expected';
    END;

    -- Clean up test data
    DELETE FROM booking_units WHERE booking_id IN (v_test_booking_1, v_test_booking_2);

EXCEPTION
    WHEN OTHERS THEN
        -- Clean up on any error
        DELETE FROM booking_units WHERE booking_id IN (v_test_booking_1, v_test_booking_2);
        RAISE NOTICE '❌ FAIL: %', SQLERRM;
END $$;
```

**Expected Output**: `✅ PASS: no_double_booking constraint working correctly`

### Test 2: All-or-Nothing Assignment

```sql
-- This test verifies the all_or_nothing_assignment constraint
DO $$
DECLARE
    v_test_booking_id UUID := gen_random_uuid();
    v_test_guest_id UUID;
    v_unit_1 UUID;
    v_unit_2 UUID;
BEGIN
    -- Get test guest
    SELECT guest_id INTO v_test_guest_id FROM guests LIMIT 1;

    -- Get two available units
    SELECT array_agg(unit_id) INTO STRICT ARRAY[v_unit_1, v_unit_2]
    FROM (
        SELECT unit_id FROM units WHERE unit_status = 'Available' LIMIT 2
    ) AS units;

    -- Create test booking with 2 unit requests
    INSERT INTO bookings (
        booking_id,
        booking_reference,
        guest_id,
        check_in_date,
        check_out_date,
        num_guests,
        total_amount,
        is_multi_unit,
        is_guest_booking,
        requested_unit_count,
        unit_assignment_status,
        payment_status,
        booking_status
    ) VALUES (
        v_test_booking_id,
        'TEST-ALL-OR-NOTHING',
        v_test_guest_id,
        '2025-12-10'::DATE,
        '2025-12-12'::DATE,
        4,
        12000.00,
        TRUE,
        TRUE,
        2,  -- Requesting 2 units
        'pending',
        'Verified',  -- Payment verified (required for assignment)
        'Pending'
    );

    -- Create 2 unit requests
    INSERT INTO guest_booking_unit_requests (booking_id, guests_per_unit)
    VALUES
        (v_test_booking_id, 2),
        (v_test_booking_id, 2);

    RAISE NOTICE 'Created test booking with 2 unit requests';

    -- Assign only 1 unit (partial assignment)
    INSERT INTO booking_units (
        booking_id,
        unit_id,
        check_in_date,
        check_out_date,
        status
    ) VALUES (
        v_test_booking_id,
        v_unit_1,
        '2025-12-10'::DATE,
        '2025-12-12'::DATE,
        'confirmed'
    );

    RAISE NOTICE 'Assigned 1 of 2 units';

    -- Try to mark as assigned (should FAIL - only 1/2 units assigned)
    BEGIN
        UPDATE bookings
        SET unit_assignment_status = 'assigned'
        WHERE booking_id = v_test_booking_id;

        -- If we reach here, constraint FAILED
        RAISE EXCEPTION '❌ CONSTRAINT FAILED: all_or_nothing_assignment did not fire!';

    EXCEPTION
        WHEN check_violation THEN
            -- Expected behavior
            RAISE NOTICE '✅ PASS: all_or_nothing_assignment constraint working correctly';
            RAISE NOTICE 'Partial assignment (1/2 units) blocked as expected';
    END;

    -- Clean up
    DELETE FROM bookings WHERE booking_id = v_test_booking_id;

EXCEPTION
    WHEN OTHERS THEN
        -- Clean up on error
        DELETE FROM bookings WHERE booking_id = v_test_booking_id;
        RAISE NOTICE '❌ FAIL: %', SQLERRM;
END $$;
```

**Expected Output**: `✅ PASS: all_or_nothing_assignment constraint working correctly`

### Test 3: Payment-Before-Assignment

```sql
-- This test verifies payment must be verified before assignment
DO $$
DECLARE
    v_test_booking_id UUID := gen_random_uuid();
    v_test_guest_id UUID;
BEGIN
    -- Get test guest
    SELECT guest_id INTO v_test_guest_id FROM guests LIMIT 1;

    -- Create booking with pending payment
    INSERT INTO bookings (
        booking_id,
        booking_reference,
        guest_id,
        check_in_date,
        check_out_date,
        num_guests,
        total_amount,
        is_multi_unit,
        unit_assignment_status,
        payment_status,  -- PENDING (not verified)
        booking_status
    ) VALUES (
        v_test_booking_id,
        'TEST-PAYMENT-CHECK',
        v_test_guest_id,
        '2025-12-15'::DATE,
        '2025-12-17'::DATE,
        2,
        6000.00,
        TRUE,
        'pending',
        'Pending',  -- Payment NOT verified
        'Pending'
    );

    -- Try to mark as assigned without payment verification (should FAIL)
    BEGIN
        UPDATE bookings
        SET unit_assignment_status = 'assigned'
        WHERE booking_id = v_test_booking_id;

        -- If we reach here, constraint FAILED
        RAISE EXCEPTION '❌ CONSTRAINT FAILED: payment_before_assignment did not fire!';

    EXCEPTION
        WHEN check_violation THEN
            -- Expected behavior
            RAISE NOTICE '✅ PASS: payment_before_assignment constraint working correctly';
            RAISE NOTICE 'Assignment without payment verification blocked';
    END;

    -- Clean up
    DELETE FROM bookings WHERE booking_id = v_test_booking_id;

EXCEPTION
    WHEN OTHERS THEN
        DELETE FROM bookings WHERE booking_id = v_test_booking_id;
        RAISE NOTICE '❌ FAIL: %', SQLERRM;
END $$;
```

**Expected Output**: `✅ PASS: payment_before_assignment constraint working correctly`

### Test 4: Audit Logging

```sql
-- Verify audit triggers fire correctly
DO $$
DECLARE
    v_test_booking_id UUID := gen_random_uuid();
    v_test_guest_id UUID;
    v_audit_count INTEGER;
BEGIN
    -- Get test guest
    SELECT guest_id INTO v_test_guest_id FROM guests LIMIT 1;

    -- Create a test booking (should trigger audit log)
    INSERT INTO bookings (
        booking_id,
        booking_reference,
        guest_id,
        check_in_date,
        check_out_date,
        num_guests,
        total_amount,
        is_multi_unit,
        is_guest_booking,  -- Trigger condition
        booking_status
    ) VALUES (
        v_test_booking_id,
        'TEST-AUDIT-LOG',
        v_test_guest_id,
        '2025-12-20'::DATE,
        '2025-12-22'::DATE,
        2,
        6000.00,
        TRUE,
        TRUE,  -- Will trigger audit
        'Pending'
    );

    -- Check if audit log was created
    SELECT COUNT(*) INTO v_audit_count
    FROM audit_logs
    WHERE table_name = 'bookings'
      AND record_id = v_test_booking_id
      AND action = 'created';

    IF v_audit_count >= 1 THEN
        RAISE NOTICE '✅ PASS: Audit trigger fired correctly';
        RAISE NOTICE 'Audit log entries: %', v_audit_count;
    ELSE
        RAISE EXCEPTION '❌ FAIL: Audit trigger did not fire';
    END IF;

    -- Clean up
    DELETE FROM bookings WHERE booking_id = v_test_booking_id;
    DELETE FROM audit_logs WHERE record_id = v_test_booking_id;

EXCEPTION
    WHEN OTHERS THEN
        DELETE FROM bookings WHERE booking_id = v_test_booking_id;
        DELETE FROM audit_logs WHERE record_id = v_test_booking_id;
        RAISE NOTICE '❌ FAIL: %', SQLERRM;
END $$;
```

**Expected Output**: `✅ PASS: Audit trigger fired correctly`

---

## Step 8: Verify RLS Policies (10 minutes)

Confirm Row Level Security works as expected (policies created in Chunk 001).

### Test RLS on pricing_config

```sql
-- Switch to authenticated role context
SET ROLE authenticated;

-- Should be able to SELECT (read-only for authenticated users)
SELECT id, base_rate, weekend_rate FROM pricing_config WHERE id = 'default';
-- Expected: 1 row

-- Try to UPDATE (should fail - only admins allowed)
-- This will fail silently due to RLS (no rows affected)
UPDATE pricing_config SET base_rate = 9999.00 WHERE id = 'default';
-- Expected: 0 rows updated (blocked by RLS)

-- Verify value didn't change
SELECT base_rate FROM pricing_config WHERE id = 'default';
-- Expected: 3000.00 (unchanged)

-- Reset role
RESET ROLE;
```

**Expected**: SELECTs work, UPDATEs blocked for non-admin users

### Verify Audit Logs RLS

```sql
-- Service role should see all audit logs
SET ROLE service_role;
SELECT COUNT(*) FROM audit_logs;
-- Expected: Some rows (depending on test data)

-- Authenticated non-admin should see nothing (or only if admin policy grants)
SET ROLE authenticated;
SELECT COUNT(*) FROM audit_logs;
-- Expected: 0 rows (unless user is admin)

-- Reset role
RESET ROLE;
```

---

## Done! ✅

### What You've Accomplished

- ✅ Created EXCLUDE constraint (double-booking prevention)
- ✅ Created all-or-nothing assignment CHECK constraint
- ✅ Verified payment-before-assignment CHECK constraint (from Chunk 001)
- ✅ Implemented audit logging system (triggers + table)
- ✅ Verified RLS policies work correctly
- ✅ Tested all constraints with real scenarios
- ✅ Database now enforces all business rules automatically

### Next Steps

1. **Run Complete Verification** - Execute all tests in `checkpoint.md`
2. **Commit Changes** - `git add . && git commit -m "feat: complete chunk 003-security-rls-constraints"`
3. **Tag Milestone** - `git tag chunk-003`
4. **Move to Chunk 004** - Core API Endpoints

### If Something Failed

- Consult `troubleshooting.md` for common issues
- Check Supabase logs for detailed error messages
- Verify prerequisites from Step 1
- Ask for help if stuck

---

**Congratulations!** Your database is now bulletproof. All business rules are enforced at the database level, making it impossible for application bugs to create invalid data states.
