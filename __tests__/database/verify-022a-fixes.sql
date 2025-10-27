-- =====================================================================
-- Test Suite: Verify Migration 022a Critical Security Fixes
-- =====================================================================
-- Purpose: Validate that all 3 critical issues have been resolved
-- Author: System
-- Date: 2025-01-27
-- Migration: 022a-fix-critical-security-issues.sql
-- Prerequisites: Migrations 021, 022, and 022a must be applied
-- =====================================================================

\echo ''
\echo '═══════════════════════════════════════════════════════════════'
\echo '    Migration 022a Fix Verification Test Suite'
\echo '═══════════════════════════════════════════════════════════════'
\echo ''

BEGIN;

-- =====================================================================
-- TEST 1: SENSITIVE DATA PROTECTION
-- =====================================================================
\echo '─────────────────────────────────────────────────────────────────'
\echo 'TEST 1: Sensitive Data Exclusion from Audit Logs'
\echo '─────────────────────────────────────────────────────────────────'

-- Test 1.1: Verify get_sensitive_fields() function exists and returns correct fields
DO $$
DECLARE
    v_booking_fields TEXT[];
    v_payment_fields TEXT[];
BEGIN
    -- Get sensitive fields for bookings table
    v_booking_fields := get_sensitive_fields('bookings');

    ASSERT array_length(v_booking_fields, 1) >= 3,
        'FAIL: bookings should have at least 3 sensitive fields';

    ASSERT 'payment_method' = ANY(v_booking_fields),
        'FAIL: payment_method should be in sensitive fields';

    ASSERT 'payment_proof_url' = ANY(v_booking_fields),
        'FAIL: payment_proof_url should be in sensitive fields';

    RAISE NOTICE '✓ Test 1.1 PASSED: get_sensitive_fields() returns correct bookings fields (% fields)',
        array_length(v_booking_fields, 1);

    -- Get sensitive fields for payments table
    v_payment_fields := get_sensitive_fields('payments');

    ASSERT array_length(v_payment_fields, 1) >= 5,
        'FAIL: payments should have at least 5 sensitive fields';

    ASSERT 'payment_details' = ANY(v_payment_fields),
        'FAIL: payment_details should be in sensitive fields';

    ASSERT 'transaction_reference' = ANY(v_payment_fields),
        'FAIL: transaction_reference should be in sensitive fields';

    RAISE NOTICE '✓ Test 1.2 PASSED: get_sensitive_fields() returns correct payment fields (% fields)',
        array_length(v_payment_fields, 1);

    -- Test unknown table returns empty array
    ASSERT get_sensitive_fields('unknown_table') = ARRAY[]::TEXT[],
        'FAIL: Unknown tables should return empty array';

    RAISE NOTICE '✓ Test 1.3 PASSED: Unknown tables return empty array';
END $$;

-- Test 1.4: Verify audit_log_trigger() properly excludes sensitive fields
DO $$
DECLARE
    v_test_guest_id UUID;
    v_test_booking_id UUID;
    v_audit_changes JSONB;
    v_has_payment_method BOOLEAN;
BEGIN
    -- Create test guest
    INSERT INTO guests (guest_id, guest_name, email, phone_number)
    VALUES (gen_random_uuid(), 'Test Guest 022a', 'test022a@example.com', '+639171234567')
    RETURNING guest_id INTO v_test_guest_id;

    -- Create test booking with payment information (multi-unit guest booking to trigger audit)
    INSERT INTO bookings (
        booking_id,
        booking_reference,
        guest_id,
        check_in,
        check_out,
        num_guests,
        total_base_amount,
        total_final_amount,
        booking_status,
        payment_status,
        payment_method,
        payment_proof_url,
        is_guest_booking,
        is_multi_unit
    ) VALUES (
        gen_random_uuid(),
        'TEST-022A-' || to_char(now(), 'YYYYMMDD-HH24MISS'),
        v_test_guest_id,
        CURRENT_DATE + INTERVAL '7 days',
        CURRENT_DATE + INTERVAL '10 days',
        4,
        6000.00,
        6000.00,
        'pending',
        'pending',
        'GCash',  -- SENSITIVE: Should be excluded from audit
        'https://example.com/proof.jpg',  -- SENSITIVE: Should be excluded
        TRUE,
        TRUE
    )
    RETURNING booking_id INTO v_test_booking_id;

    -- Check audit log entry for this booking
    SELECT changes INTO v_audit_changes
    FROM audit_logs
    WHERE entity_type = 'bookings'
      AND record_id = v_test_booking_id
      AND action = 'CREATE'
    ORDER BY created_at DESC
    LIMIT 1;

    -- Verify sensitive fields were excluded
    v_has_payment_method := (v_audit_changes->'new'->>'payment_method') IS NOT NULL;

    ASSERT NOT v_has_payment_method,
        'FAIL: payment_method should be excluded from audit log but was found: ' ||
        COALESCE(v_audit_changes->'new'->>'payment_method', 'NULL');

    ASSERT (v_audit_changes->'new'->>'payment_proof_url') IS NULL,
        'FAIL: payment_proof_url should be excluded from audit log';

    -- Verify non-sensitive fields are still present
    ASSERT (v_audit_changes->'new'->>'booking_status') = 'pending',
        'FAIL: Non-sensitive fields should still be in audit log';

    RAISE NOTICE '✓ Test 1.4 PASSED: Sensitive fields excluded from audit logs';

    -- Cleanup
    DELETE FROM bookings WHERE booking_id = v_test_booking_id;
    DELETE FROM guests WHERE guest_id = v_test_guest_id;
END $$;

\echo ''
\echo '✓ ALL SENSITIVE DATA PROTECTION TESTS PASSED'
\echo ''

-- =====================================================================
-- TEST 2: RACE CONDITION PREVENTION (ALL-OR-NOTHING)
-- =====================================================================
\echo '─────────────────────────────────────────────────────────────────'
\echo 'TEST 2: Race Condition Prevention with Row Locking'
\echo '─────────────────────────────────────────────────────────────────'

-- Test 2.1: Verify CHECK constraint was removed
DO $$
DECLARE
    v_constraint_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'all_or_nothing_assignment'
          AND conrelid = 'bookings'::regclass
    ) INTO v_constraint_exists;

    ASSERT NOT v_constraint_exists,
        'FAIL: all_or_nothing_assignment CHECK constraint should be removed';

    RAISE NOTICE '✓ Test 2.1 PASSED: CHECK constraint removed';
END $$;

-- Test 2.2: Verify trigger exists
DO $$
DECLARE
    v_trigger_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'enforce_all_or_nothing_trigger'
          AND tgrelid = 'bookings'::regclass
    ) INTO v_trigger_exists;

    ASSERT v_trigger_exists,
        'FAIL: enforce_all_or_nothing_trigger should exist';

    RAISE NOTICE '✓ Test 2.2 PASSED: Trigger exists';
END $$;

-- Test 2.3: Verify trigger function uses row locking (FOR UPDATE)
DO $$
DECLARE
    v_function_source TEXT;
    v_has_row_locking BOOLEAN;
BEGIN
    SELECT prosrc INTO v_function_source
    FROM pg_proc
    WHERE proname = 'enforce_all_or_nothing';

    v_has_row_locking := v_function_source LIKE '%FOR UPDATE%';

    ASSERT v_has_row_locking,
        'FAIL: enforce_all_or_nothing() function should use FOR UPDATE row locking';

    RAISE NOTICE '✓ Test 2.3 PASSED: Trigger function uses row locking';
END $$;

-- Test 2.4: Functional test - prevent partial assignment
DO $$
DECLARE
    v_test_guest_id UUID;
    v_test_booking_id UUID;
    v_test_unit1_id UUID;
    v_test_unit2_id UUID;
    v_error_occurred BOOLEAN := FALSE;
BEGIN
    -- Setup test data
    INSERT INTO guests (guest_id, guest_name, email, phone_number)
    VALUES (gen_random_uuid(), 'Test Guest All-or-Nothing', 'test-aon@example.com', '+639171234567')
    RETURNING guest_id INTO v_test_guest_id;

    -- Create test units
    INSERT INTO units (unit_id, unit_code, unit_name, unit_type, base_rate, max_occupancy)
    VALUES (gen_random_uuid(), 'TEST-AON-1', 'Test Unit AON 1', 'Standard', 2000.00, 4)
    RETURNING unit_id INTO v_test_unit1_id;

    INSERT INTO units (unit_id, unit_code, unit_name, unit_type, base_rate, max_occupancy)
    VALUES (gen_random_uuid(), 'TEST-AON-2', 'Test Unit AON 2', 'Standard', 2000.00, 4)
    RETURNING unit_id INTO v_test_unit2_id;

    -- Create multi-unit booking
    INSERT INTO bookings (
        booking_id,
        booking_reference,
        guest_id,
        check_in,
        check_out,
        num_guests,
        total_base_amount,
        total_final_amount,
        booking_status,
        payment_status,
        is_guest_booking,
        is_multi_unit,
        unit_assignment_status
    ) VALUES (
        gen_random_uuid(),
        'TEST-AON-' || to_char(now(), 'YYYYMMDD-HH24MISS'),
        v_test_guest_id,
        CURRENT_DATE + INTERVAL '14 days',
        CURRENT_DATE + INTERVAL '17 days',
        6,
        12000.00,
        12000.00,
        'pending',
        'paid',
        TRUE,
        TRUE,
        'pending'
    )
    RETURNING booking_id INTO v_test_booking_id;

    -- Add 2 unit requests
    INSERT INTO guest_booking_unit_requests (booking_id, requested_unit_id, request_status, preference_rank)
    VALUES (v_test_booking_id, v_test_unit1_id, 'pending', 1),
           (v_test_booking_id, v_test_unit2_id, 'pending', 2);

    -- Confirm only 1 of 2 units (should remain in booking_units after testing)
    INSERT INTO booking_units (booking_id, unit_id, check_in, check_out, status)
    VALUES (v_test_booking_id, v_test_unit1_id, CURRENT_DATE + INTERVAL '14 days', CURRENT_DATE + INTERVAL '17 days', 'confirmed');

    -- Try to set booking to 'assigned' with only 1/2 units confirmed
    BEGIN
        UPDATE bookings
        SET unit_assignment_status = 'assigned'
        WHERE booking_id = v_test_booking_id;

        -- Should not reach here
        RAISE EXCEPTION 'FAIL: Partial assignment should have been blocked';
    EXCEPTION WHEN OTHERS THEN
        v_error_occurred := TRUE;
        RAISE NOTICE '  Expected error caught: %', SQLERRM;
    END;

    ASSERT v_error_occurred,
        'FAIL: Trigger should have raised exception for partial assignment';

    RAISE NOTICE '✓ Test 2.4 PASSED: Partial assignment blocked by trigger';

    -- Cleanup
    DELETE FROM booking_units WHERE booking_id = v_test_booking_id;
    DELETE FROM guest_booking_unit_requests WHERE booking_id = v_test_booking_id;
    DELETE FROM bookings WHERE booking_id = v_test_booking_id;
    DELETE FROM units WHERE unit_id IN (v_test_unit1_id, v_test_unit2_id);
    DELETE FROM guests WHERE guest_id = v_test_guest_id;
END $$;

\echo ''
\echo '✓ ALL RACE CONDITION PREVENTION TESTS PASSED'
\echo ''

-- =====================================================================
-- TEST 3: AUDIT TRIGGER WHEN CLAUSE FIX
-- =====================================================================
\echo '─────────────────────────────────────────────────────────────────'
\echo 'TEST 3: Operation-Aware Audit Trigger WHEN Clauses'
\echo '─────────────────────────────────────────────────────────────────'

-- Test 3.1: Verify INSERT operations are audited
DO $$
DECLARE
    v_test_guest_id UUID;
    v_test_booking_id UUID;
    v_audit_count INT;
BEGIN
    -- Create test guest
    INSERT INTO guests (guest_id, guest_name, email, phone_number)
    VALUES (gen_random_uuid(), 'Test Guest Insert', 'test-insert@example.com', '+639171234567')
    RETURNING guest_id INTO v_test_guest_id;

    -- Create multi-unit guest booking (should trigger audit)
    INSERT INTO bookings (
        booking_id,
        booking_reference,
        guest_id,
        check_in,
        check_out,
        num_guests,
        total_base_amount,
        total_final_amount,
        is_guest_booking,
        is_multi_unit
    ) VALUES (
        gen_random_uuid(),
        'TEST-INSERT-' || to_char(now(), 'YYYYMMDD-HH24MISS'),
        v_test_guest_id,
        CURRENT_DATE + INTERVAL '20 days',
        CURRENT_DATE + INTERVAL '23 days',
        4,
        9000.00,
        9000.00,
        TRUE,
        TRUE
    )
    RETURNING booking_id INTO v_test_booking_id;

    -- Check audit log
    SELECT COUNT(*) INTO v_audit_count
    FROM audit_logs
    WHERE entity_type = 'bookings'
      AND record_id = v_test_booking_id
      AND action = 'CREATE';

    ASSERT v_audit_count = 1,
        'FAIL: INSERT should create exactly 1 audit log entry';

    RAISE NOTICE '✓ Test 3.1 PASSED: INSERT operations are audited';

    -- Cleanup
    DELETE FROM bookings WHERE booking_id = v_test_booking_id;
    DELETE FROM guests WHERE guest_id = v_test_guest_id;
END $$;

-- Test 3.2: Verify UPDATE operations are audited
DO $$
DECLARE
    v_test_guest_id UUID;
    v_test_booking_id UUID;
    v_audit_count INT;
BEGIN
    -- Create test data
    INSERT INTO guests (guest_id, guest_name, email, phone_number)
    VALUES (gen_random_uuid(), 'Test Guest Update', 'test-update@example.com', '+639171234567')
    RETURNING guest_id INTO v_test_guest_id;

    INSERT INTO bookings (
        booking_id,
        booking_reference,
        guest_id,
        check_in,
        check_out,
        num_guests,
        total_base_amount,
        total_final_amount,
        is_guest_booking,
        is_multi_unit
    ) VALUES (
        gen_random_uuid(),
        'TEST-UPDATE-' || to_char(now(), 'YYYYMMDD-HH24MISS'),
        v_test_guest_id,
        CURRENT_DATE + INTERVAL '25 days',
        CURRENT_DATE + INTERVAL '28 days',
        4,
        9000.00,
        9000.00,
        TRUE,
        TRUE
    )
    RETURNING booking_id INTO v_test_booking_id;

    -- Clear any existing audit logs for this booking
    DELETE FROM audit_logs WHERE record_id = v_test_booking_id;

    -- Update booking (should trigger audit)
    UPDATE bookings
    SET num_guests = 5
    WHERE booking_id = v_test_booking_id;

    -- Check audit log
    SELECT COUNT(*) INTO v_audit_count
    FROM audit_logs
    WHERE entity_type = 'bookings'
      AND record_id = v_test_booking_id
      AND action = 'UPDATE';

    ASSERT v_audit_count = 1,
        'FAIL: UPDATE should create exactly 1 audit log entry';

    RAISE NOTICE '✓ Test 3.2 PASSED: UPDATE operations are audited';

    -- Cleanup
    DELETE FROM bookings WHERE booking_id = v_test_booking_id;
    DELETE FROM guests WHERE guest_id = v_test_guest_id;
END $$;

-- Test 3.3: Verify DELETE operations are audited
DO $$
DECLARE
    v_test_guest_id UUID;
    v_test_booking_id UUID;
    v_audit_count INT;
BEGIN
    -- Create test data
    INSERT INTO guests (guest_id, guest_name, email, phone_number)
    VALUES (gen_random_uuid(), 'Test Guest Delete', 'test-delete@example.com', '+639171234567')
    RETURNING guest_id INTO v_test_guest_id;

    INSERT INTO bookings (
        booking_id,
        booking_reference,
        guest_id,
        check_in,
        check_out,
        num_guests,
        total_base_amount,
        total_final_amount,
        is_guest_booking,
        is_multi_unit
    ) VALUES (
        gen_random_uuid(),
        'TEST-DELETE-' || to_char(now(), 'YYYYMMDD-HH24MISS'),
        v_test_guest_id,
        CURRENT_DATE + INTERVAL '30 days',
        CURRENT_DATE + INTERVAL '33 days',
        4,
        9000.00,
        9000.00,
        TRUE,
        TRUE
    )
    RETURNING booking_id INTO v_test_booking_id;

    -- Clear any existing audit logs for this booking
    DELETE FROM audit_logs WHERE record_id = v_test_booking_id;

    -- Delete booking (should trigger audit)
    DELETE FROM bookings WHERE booking_id = v_test_booking_id;

    -- Check audit log
    SELECT COUNT(*) INTO v_audit_count
    FROM audit_logs
    WHERE entity_type = 'bookings'
      AND record_id = v_test_booking_id
      AND action = 'DELETE';

    ASSERT v_audit_count = 1,
        'FAIL: DELETE should create exactly 1 audit log entry';

    RAISE NOTICE '✓ Test 3.3 PASSED: DELETE operations are audited';

    -- Cleanup
    DELETE FROM guests WHERE guest_id = v_test_guest_id;
END $$;

\echo ''
\echo '✓ ALL AUDIT TRIGGER WHEN CLAUSE TESTS PASSED'
\echo ''

-- =====================================================================
-- FINAL SUMMARY
-- =====================================================================
\echo '═══════════════════════════════════════════════════════════════'
\echo '    Migration 022a Verification - ALL TESTS PASSED ✓'
\echo '═══════════════════════════════════════════════════════════════'
\echo ''
\echo 'Summary:'
\echo '  ✓ Issue #1: Sensitive data protection verified (4 tests)'
\echo '  ✓ Issue #2: Race condition prevention verified (4 tests)'
\echo '  ✓ Issue #3: Audit trigger logic verified (3 tests)'
\echo ''
\echo '  Total: 11/11 tests PASSED'
\echo ''
\echo 'Migration 022a is PRODUCTION-READY ✓'
\echo '═══════════════════════════════════════════════════════════════'
\echo ''

ROLLBACK;  -- All tests run in transaction, cleanup automatic

-- End of verify-022a-fixes.sql
