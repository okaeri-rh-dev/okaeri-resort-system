-- =====================================================================================
-- Chunk 003: Checkpoint Verification Tests
-- File: __tests__/database/chunk-003-checkpoint-tests.sql
-- Purpose: Comprehensive verification of security constraints, audit logging, and RLS
-- Expected: All 21 tests should PASS
-- =====================================================================================

\set ON_ERROR_STOP on
\timing on

BEGIN;

-- =====================================================================================
-- SETUP: Create test data fixtures
-- =====================================================================================

DO $$
DECLARE
    v_test_guest_id UUID;
    v_test_unit_1 UUID;
    v_test_unit_2 UUID;
BEGIN
    -- Create test guest
    INSERT INTO guests (guest_id, guest_name, email, phone_number)
    VALUES (
        '00000000-0000-0000-0000-000000000001'::UUID,
        'Test Guest Chunk003',
        'test-chunk003@example.com',
        '+63-917-123-4567'
    )
    ON CONFLICT (email) DO UPDATE SET guest_name = EXCLUDED.guest_name
    RETURNING guest_id INTO v_test_guest_id;

    -- Create test units (if not exist)
    INSERT INTO units (unit_id, unit_code, unit_name, unit_type, unit_status)
    VALUES
        ('11111111-0000-0000-0000-000000000001'::UUID, 'TEST-UNIT-1', 'Test Unit 1', 'Standard', 'Available'),
        ('22222222-0000-0000-0000-000000000001'::UUID, 'TEST-UNIT-2', 'Test Unit 2', 'Standard', 'Available')
    ON CONFLICT (unit_code) DO NOTHING;

    RAISE NOTICE 'Test fixtures created successfully';
END $$;

-- =====================================================================================
-- AUTOMATED CHECKS (10 tests)
-- =====================================================================================

\echo ''
\echo '================================================'
\echo 'AUTOMATED CHECKS (10 tests)'
\echo '================================================'

-- Check 1: EXCLUDE Constraint Exists
\echo ''
\echo 'Check 1: EXCLUDE Constraint Exists'
DO $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'no_double_booking'
        AND conrelid = 'booking_units'::regclass
        AND contype = 'x'  -- 'x' = EXCLUDE constraint
    ) INTO v_exists;

    IF v_exists THEN
        RAISE NOTICE '✅ PASS: no_double_booking EXCLUDE constraint exists';
    ELSE
        RAISE EXCEPTION '❌ FAIL: no_double_booking constraint missing or wrong type';
    END IF;
END $$;

-- Check 2: All-or-Nothing Assignment Constraint Exists
\echo ''
\echo 'Check 2: All-or-Nothing Assignment Constraint'
DO $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'all_or_nothing_assignment'
        AND conrelid = 'bookings'::regclass
        AND contype = 'c'  -- 'c' = CHECK constraint
    ) INTO v_exists;

    IF v_exists THEN
        RAISE NOTICE '✅ PASS: all_or_nothing_assignment CHECK constraint exists';
    ELSE
        RAISE EXCEPTION '❌ FAIL: all_or_nothing_assignment constraint missing';
    END IF;
END $$;

-- Check 3: Payment-Before-Assignment Constraint Exists
\echo ''
\echo 'Check 3: Payment-Before-Assignment Constraint'
DO $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'payment_before_assignment'
        AND conrelid = 'bookings'::regclass
        AND contype = 'c'
    ) INTO v_exists;

    IF v_exists THEN
        RAISE NOTICE '✅ PASS: payment_before_assignment CHECK constraint exists';
    ELSE
        RAISE EXCEPTION '❌ FAIL: payment_before_assignment constraint missing';
    END IF;
END $$;

-- Check 4: All Constraints Summary
\echo ''
\echo 'Check 4: All Constraints Summary'
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM pg_constraint
    WHERE conrelid IN ('bookings'::regclass, 'booking_units'::regclass)
    AND conname IN (
        'no_double_booking',
        'all_or_nothing_assignment',
        'payment_before_assignment'
    );

    IF v_count = 3 THEN
        RAISE NOTICE '✅ PASS: All 3 security constraints exist';
    ELSE
        RAISE EXCEPTION '❌ FAIL: Expected 3 constraints, found %', v_count;
    END IF;
END $$;

-- Check 5: Audit Logs Table Exists
\echo ''
\echo 'Check 5: Audit Logs Table'
DO $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'audit_logs'
    ) INTO v_exists;

    IF v_exists THEN
        RAISE NOTICE '✅ PASS: audit_logs table exists';
    ELSE
        RAISE EXCEPTION '❌ FAIL: audit_logs table missing';
    END IF;
END $$;

-- Check 6: Audit Triggers Exist
\echo ''
\echo 'Check 6: Audit Triggers'
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
    AND trigger_name IN (
        'audit_bookings_trigger',
        'audit_booking_units_trigger'
    );

    IF v_count >= 2 THEN
        RAISE NOTICE '✅ PASS: Audit triggers exist (% triggers)', v_count;
    ELSE
        RAISE EXCEPTION '❌ FAIL: Expected at least 2 audit triggers, found %', v_count;
    END IF;
END $$;

-- Check 7: Audit Trigger Function Exists
\echo ''
\echo 'Check 7: Audit Trigger Function'
DO $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.routines
        WHERE routine_schema = 'public'
        AND routine_name = 'audit_log_trigger'
        AND routine_type = 'FUNCTION'
    ) INTO v_exists;

    IF v_exists THEN
        RAISE NOTICE '✅ PASS: audit_log_trigger() function exists';
    ELSE
        RAISE EXCEPTION '❌ FAIL: audit_log_trigger() function missing';
    END IF;
END $$;

-- Check 8: Audit Logs RLS Enabled
\echo ''
\echo 'Check 8: Audit Logs RLS'
DO $$
DECLARE
    v_enabled BOOLEAN;
BEGIN
    SELECT rowsecurity INTO v_enabled
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'audit_logs';

    IF v_enabled THEN
        RAISE NOTICE '✅ PASS: RLS enabled on audit_logs';
    ELSE
        RAISE EXCEPTION '❌ FAIL: RLS not enabled on audit_logs';
    END IF;
END $$;

-- Check 9: Audit Logs RLS Policies Exist
\echo ''
\echo 'Check 9: Audit Logs RLS Policies'
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'audit_logs';

    IF v_count >= 2 THEN
        RAISE NOTICE '✅ PASS: RLS policies exist on audit_logs (% policies)', v_count;
    ELSE
        RAISE EXCEPTION '❌ FAIL: Expected at least 2 RLS policies, found %', v_count;
    END IF;
END $$;

-- Check 10: Indexes for Audit Performance
\echo ''
\echo 'Check 10: Audit Log Indexes'
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND tablename = 'audit_logs'
    AND indexname IN (
        'idx_audit_logs_table_record',
        'idx_audit_logs_created_at',
        'idx_audit_logs_action'
    );

    IF v_count >= 3 THEN
        RAISE NOTICE '✅ PASS: Audit log indexes exist (% indexes)', v_count;
    ELSE
        RAISE EXCEPTION '❌ FAIL: Expected at least 3 indexes, found %', v_count;
    END IF;
END $$;

-- =====================================================================================
-- FUNCTIONAL TESTS (7 tests)
-- =====================================================================================

\echo ''
\echo '================================================'
\echo 'FUNCTIONAL TESTS (7 tests)'
\echo '================================================'

-- Test 1: Double-Booking Prevention (EXCLUDE Constraint)
\echo ''
\echo 'Test 1: Double-Booking Prevention'
DO $$
DECLARE
    v_test_unit UUID := '11111111-0000-0000-0000-000000000001'::UUID;
    v_booking_1 UUID := gen_random_uuid();
    v_booking_2 UUID := gen_random_uuid();
    v_success BOOLEAN := FALSE;
BEGIN
    -- Insert first booking (should succeed)
    INSERT INTO booking_units (
        booking_unit_id, booking_id, unit_id, check_in_date, check_out_date, status
    ) VALUES (
        gen_random_uuid(), v_booking_1, v_test_unit,
        '2026-01-01'::DATE, '2026-01-05'::DATE, 'confirmed'
    );

    -- Try overlapping booking (should FAIL)
    BEGIN
        INSERT INTO booking_units (
            booking_unit_id, booking_id, unit_id, check_in_date, check_out_date, status
        ) VALUES (
            gen_random_uuid(), v_booking_2, v_test_unit,
            '2026-01-03'::DATE, '2026-01-07'::DATE, 'confirmed'
        );

        RAISE EXCEPTION 'Test failed: EXCLUDE constraint did not fire';
    EXCEPTION
        WHEN exclusion_violation THEN
            v_success := TRUE;
    END;

    -- Cleanup
    DELETE FROM booking_units WHERE booking_id IN (v_booking_1, v_booking_2);

    IF v_success THEN
        RAISE NOTICE '✅ PASS: Double-booking prevented by EXCLUDE constraint';
    ELSE
        RAISE EXCEPTION '❌ FAIL: EXCLUDE constraint not working';
    END IF;
END $$;

-- Test 2: Cancelled Bookings Allow Same Dates
\echo ''
\echo 'Test 2: Cancelled Bookings Do Not Block'
DO $$
DECLARE
    v_test_unit UUID := '11111111-0000-0000-0000-000000000001'::UUID;
    v_booking_1 UUID := gen_random_uuid();
    v_booking_2 UUID := gen_random_uuid();
BEGIN
    -- Insert cancelled booking
    INSERT INTO booking_units (
        booking_unit_id, booking_id, unit_id, check_in_date, check_out_date, status
    ) VALUES (
        gen_random_uuid(), v_booking_1, v_test_unit,
        '2026-02-01'::DATE, '2026-02-05'::DATE, 'cancelled'
    );

    -- Insert overlapping confirmed booking (should SUCCEED)
    INSERT INTO booking_units (
        booking_unit_id, booking_id, unit_id, check_in_date, check_out_date, status
    ) VALUES (
        gen_random_uuid(), v_booking_2, v_test_unit,
        '2026-02-01'::DATE, '2026-02-05'::DATE, 'confirmed'
    );

    -- Cleanup
    DELETE FROM booking_units WHERE booking_id IN (v_booking_1, v_booking_2);

    RAISE NOTICE '✅ PASS: Cancelled bookings do not block new bookings';
EXCEPTION
    WHEN OTHERS THEN
        DELETE FROM booking_units WHERE booking_id IN (v_booking_1, v_booking_2);
        RAISE EXCEPTION '❌ FAIL: %', SQLERRM;
END $$;

-- Test 3: All-or-Nothing Assignment (Complete Assignment Allowed)
\echo ''
\echo 'Test 3: Complete Assignment Allowed'
DO $$
DECLARE
    v_booking_id UUID := gen_random_uuid();
    v_guest_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
    v_unit_1 UUID := '11111111-0000-0000-0000-000000000001'::UUID;
    v_unit_2 UUID := '22222222-0000-0000-0000-000000000001'::UUID;
BEGIN
    -- Create booking requesting 2 units
    INSERT INTO bookings (
        booking_id, booking_reference, guest_id, check_in_date, check_out_date,
        num_guests, total_amount, is_multi_unit, is_guest_booking,
        requested_unit_count, unit_assignment_status, payment_status, booking_status
    ) VALUES (
        v_booking_id, 'TEST-COMPLETE-001', v_guest_id, '2026-03-01'::DATE, '2026-03-03'::DATE,
        4, 12000.00, TRUE, TRUE, 2, 'pending', 'Verified', 'Pending'
    );

    -- Create 2 unit requests
    INSERT INTO guest_booking_unit_requests (booking_id, guests_per_unit)
    VALUES (v_booking_id, 2), (v_booking_id, 2);

    -- Assign BOTH units
    INSERT INTO booking_units (booking_unit_id, booking_id, unit_id, check_in_date, check_out_date, status)
    VALUES
        (gen_random_uuid(), v_booking_id, v_unit_1, '2026-03-01'::DATE, '2026-03-03'::DATE, 'confirmed'),
        (gen_random_uuid(), v_booking_id, v_unit_2, '2026-03-01'::DATE, '2026-03-03'::DATE, 'confirmed');

    -- Mark as assigned (should SUCCEED)
    UPDATE bookings
    SET unit_assignment_status = 'assigned'
    WHERE booking_id = v_booking_id;

    -- Cleanup
    DELETE FROM bookings WHERE booking_id = v_booking_id;

    RAISE NOTICE '✅ PASS: Complete assignment (2/2 units) allowed';
EXCEPTION
    WHEN OTHERS THEN
        DELETE FROM bookings WHERE booking_id = v_booking_id;
        RAISE EXCEPTION '❌ FAIL: %', SQLERRM;
END $$;

-- Test 4: All-or-Nothing Assignment (Partial Blocked)
\echo ''
\echo 'Test 4: Partial Assignment Blocked'
DO $$
DECLARE
    v_booking_id UUID := gen_random_uuid();
    v_guest_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
    v_unit UUID := '11111111-0000-0000-0000-000000000001'::UUID;
    v_success BOOLEAN := FALSE;
BEGIN
    -- Create booking requesting 3 units
    INSERT INTO bookings (
        booking_id, booking_reference, guest_id, check_in_date, check_out_date,
        num_guests, total_amount, is_multi_unit, is_guest_booking,
        requested_unit_count, unit_assignment_status, payment_status, booking_status
    ) VALUES (
        v_booking_id, 'TEST-PARTIAL-001', v_guest_id, '2026-04-01'::DATE, '2026-04-03'::DATE,
        6, 18000.00, TRUE, TRUE, 3, 'pending', 'Verified', 'Pending'
    );

    -- Create 3 unit requests
    INSERT INTO guest_booking_unit_requests (booking_id, guests_per_unit)
    VALUES (v_booking_id, 2), (v_booking_id, 2), (v_booking_id, 2);

    -- Assign ONLY 1 unit (partial)
    INSERT INTO booking_units (booking_unit_id, booking_id, unit_id, check_in_date, check_out_date, status)
    VALUES (gen_random_uuid(), v_booking_id, v_unit, '2026-04-01'::DATE, '2026-04-03'::DATE, 'confirmed');

    -- Try to mark as assigned (should FAIL)
    BEGIN
        UPDATE bookings
        SET unit_assignment_status = 'assigned'
        WHERE booking_id = v_booking_id;

        RAISE EXCEPTION 'Test failed: all_or_nothing constraint did not fire';
    EXCEPTION
        WHEN check_violation THEN
            v_success := TRUE;
    END;

    -- Cleanup
    DELETE FROM bookings WHERE booking_id = v_booking_id;

    IF v_success THEN
        RAISE NOTICE '✅ PASS: Partial assignment (1/3 units) blocked';
    ELSE
        RAISE EXCEPTION '❌ FAIL: Partial assignment was allowed';
    END IF;
END $$;

-- Test 5: Payment-Before-Assignment Constraint
\echo ''
\echo 'Test 5: Payment Verification Required'
DO $$
DECLARE
    v_booking_id UUID := gen_random_uuid();
    v_guest_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
    v_success BOOLEAN := FALSE;
BEGIN
    -- Create booking with PENDING payment
    INSERT INTO bookings (
        booking_id, booking_reference, guest_id, check_in_date, check_out_date,
        num_guests, total_amount, is_multi_unit, unit_assignment_status,
        payment_status, booking_status
    ) VALUES (
        v_booking_id, 'TEST-PAYMENT-001', v_guest_id, '2026-05-01'::DATE, '2026-05-03'::DATE,
        2, 6000.00, TRUE, 'pending', 'Pending', 'Pending'
    );

    -- Try to mark as assigned without payment (should FAIL)
    BEGIN
        UPDATE bookings
        SET unit_assignment_status = 'assigned'
        WHERE booking_id = v_booking_id;

        RAISE EXCEPTION 'Test failed: payment_before_assignment did not fire';
    EXCEPTION
        WHEN check_violation THEN
            v_success := TRUE;
    END;

    -- Cleanup
    DELETE FROM bookings WHERE booking_id = v_booking_id;

    IF v_success THEN
        RAISE NOTICE '✅ PASS: Assignment blocked when payment not verified';
    ELSE
        RAISE EXCEPTION '❌ FAIL: Assignment without payment was allowed';
    END IF;
END $$;

-- Test 6: Audit Trigger Fires on Booking Creation
\echo ''
\echo 'Test 6: Audit Trigger on Booking Creation'
DO $$
DECLARE
    v_booking_id UUID := gen_random_uuid();
    v_guest_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
    v_audit_count INTEGER;
BEGIN
    -- Create multi-unit guest booking (should trigger audit)
    INSERT INTO bookings (
        booking_id, booking_reference, guest_id, check_in_date, check_out_date,
        num_guests, total_amount, is_multi_unit, is_guest_booking, booking_status
    ) VALUES (
        v_booking_id, 'TEST-AUDIT-001', v_guest_id, '2026-06-01'::DATE, '2026-06-03'::DATE,
        2, 6000.00, TRUE, TRUE, 'Pending'
    );

    -- Check audit log (may need slight delay for trigger)
    PERFORM pg_sleep(0.1);

    SELECT COUNT(*) INTO v_audit_count
    FROM audit_logs
    WHERE table_name = 'bookings'
    AND record_id = v_booking_id
    AND action = 'created';

    -- Cleanup
    DELETE FROM bookings WHERE booking_id = v_booking_id;
    DELETE FROM audit_logs WHERE record_id = v_booking_id;

    IF v_audit_count >= 1 THEN
        RAISE NOTICE '✅ PASS: Audit trigger fired (% entries)', v_audit_count;
    ELSE
        RAISE EXCEPTION '❌ FAIL: Audit trigger did not fire';
    END IF;
END $$;

-- Test 7: Audit Trigger Captures Before/After State
\echo ''
\echo 'Test 7: Audit Captures Before/After State'
DO $$
DECLARE
    v_booking_id UUID := gen_random_uuid();
    v_guest_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
    v_audit_record RECORD;
BEGIN
    -- Create booking
    INSERT INTO bookings (
        booking_id, booking_reference, guest_id, check_in_date, check_out_date,
        num_guests, total_amount, is_multi_unit, is_guest_booking,
        payment_status, booking_status
    ) VALUES (
        v_booking_id, 'TEST-AUDIT-STATE-001', v_guest_id, '2026-07-01'::DATE, '2026-07-03'::DATE,
        2, 6000.00, TRUE, TRUE, 'Pending', 'Pending'
    );

    -- Update payment status (should capture before/after)
    UPDATE bookings SET payment_status = 'Verified' WHERE booking_id = v_booking_id;

    PERFORM pg_sleep(0.1);

    -- Get audit log for update
    SELECT * INTO v_audit_record
    FROM audit_logs
    WHERE table_name = 'bookings'
    AND record_id = v_booking_id
    AND action = 'updated'
    ORDER BY created_at DESC
    LIMIT 1;

    -- Cleanup
    DELETE FROM bookings WHERE booking_id = v_booking_id;
    DELETE FROM audit_logs WHERE record_id = v_booking_id;

    -- Verify audit captures before/after
    IF v_audit_record.changes IS NOT NULL
       AND v_audit_record.changes ? 'before'
       AND v_audit_record.changes ? 'after'
       AND (v_audit_record.changes->'before'->>'payment_status') = 'Pending'
       AND (v_audit_record.changes->'after'->>'payment_status') = 'Verified'
    THEN
        RAISE NOTICE '✅ PASS: Audit log captures before/after state correctly';
    ELSE
        RAISE EXCEPTION '❌ FAIL: Audit log missing or incorrect state';
    END IF;
END $$;

-- =====================================================================================
-- CLEANUP: Remove test fixtures
-- =====================================================================================

DO $$
BEGIN
    -- Cleanup any remaining test data
    DELETE FROM bookings WHERE booking_reference LIKE 'TEST-%';
    DELETE FROM booking_units WHERE booking_id IN (
        SELECT booking_id FROM bookings WHERE booking_reference LIKE 'TEST-%'
    );
    DELETE FROM audit_logs WHERE table_name = 'bookings'
        AND (changes->'after'->>'booking_reference') LIKE 'TEST-%';

    RAISE NOTICE '';
    RAISE NOTICE 'Test fixtures cleaned up successfully';
END $$;

ROLLBACK;  -- Rollback all test changes

-- =====================================================================================
-- SUMMARY
-- =====================================================================================

\echo ''
\echo '================================================'
\echo 'CHECKPOINT TEST SUMMARY'
\echo '================================================'
\echo 'Automated Checks: 10 tests'
\echo 'Functional Tests: 7 tests'
\echo 'Total: 17 SQL tests (21 total with 4 manual checks)'
\echo ''
\echo 'All SQL tests executed successfully!'
\echo 'Complete manual checks in Supabase Dashboard:'
\echo '  - Manual Check 1: Constraints visible in dashboard'
\echo '  - Manual Check 2: Audit logs table structure'
\echo '  - Manual Check 3: RLS policies active'
\echo '  - Manual Check 4: Test constraint in dashboard'
\echo '================================================'
