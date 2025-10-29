-- Test file for assign_units_to_booking function
-- Run with: psql 'postgresql://postgres:postgres@localhost:54322/postgres' -f supabase/tests/assign_units_function_test.sql

BEGIN;

-- Setup test data
INSERT INTO units (unit_id, unit_name, unit_code, unit_type, base_rate, weekend_rate, max_occupancy, base_occupancy, extra_person_rate)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'Test Unit 1', 'TU1', 'Standard', 100, 120, 4, 2, 25),
    ('22222222-2222-2222-2222-222222222222', 'Test Unit 2', 'TU2', 'Deluxe', 150, 180, 6, 4, 30),
    ('33333333-3333-3333-3333-333333333333', 'Test Unit 3', 'TU3', 'Standard', 100, 120, 4, 2, 25);

INSERT INTO guests (guest_id, guest_name, phone_number, email)
VALUES ('99999999-9999-9999-9999-999999999999', 'Test Guest', '09171234567', 'test@example.com');

-- Create a multi-unit booking with payment pending
INSERT INTO bookings (
    booking_id,
    guest_id,
    booking_reference,
    check_in,
    check_out,
    num_guests,
    total_amount,
    booking_status,
    payment_status,
    unit_assignment_status,
    is_multi_unit,
    requested_unit_count,
    guest_name,
    email,
    contact_number
) VALUES (
    '88888888-8888-8888-8888-888888888888',
    '99999999-9999-9999-9999-999999999999',
    'TEST-001',
    '2025-12-01'::DATE,
    '2025-12-05'::DATE,
    4,
    1200.00,
    'Pending',
    'Pending',  -- Will fail assignment
    'pending',
    true,
    2,
    'Test Guest',
    'test@example.com',
    '09171234567'
);

-- Insert unit requests
INSERT INTO guest_booking_unit_requests (
    booking_id,
    unit_type,
    guests_per_unit,
    quantity
) VALUES
    ('88888888-8888-8888-8888-888888888888', 'Standard', 2, 1),
    ('88888888-8888-8888-8888-888888888888', 'Deluxe', 2, 1);

-- TEST 1: Should fail - payment not verified
DO $$
BEGIN
    RAISE NOTICE '=== TEST 1: Payment not verified ===';
    BEGIN
        PERFORM assign_units_to_booking(
            '88888888-8888-8888-8888-888888888888',
            ARRAY['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222']::UUID[]
        );
        RAISE EXCEPTION 'TEST FAILED: Should have raised exception for unverified payment';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%Payment not verified%' THEN
                RAISE NOTICE '✓ TEST PASSED: Correctly rejected unverified payment';
            ELSE
                RAISE EXCEPTION 'TEST FAILED: Wrong error - %', SQLERRM;
            END IF;
    END;
END $$;

-- Update payment status to Completed (acts as "Verified" for our function)
UPDATE bookings
SET payment_status = 'Completed'
WHERE booking_id = '88888888-8888-8888-8888-888888888888';

-- TEST 2: Should fail - wrong number of units
DO $$
BEGIN
    RAISE NOTICE '=== TEST 2: Wrong unit count ===';
    BEGIN
        PERFORM assign_units_to_booking(
            '88888888-8888-8888-8888-888888888888',
            ARRAY['11111111-1111-1111-1111-111111111111']::UUID[]  -- Only 1 unit, need 2
        );
        RAISE EXCEPTION 'TEST FAILED: Should have raised exception for wrong unit count';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%Unit count mismatch%' THEN
                RAISE NOTICE '✓ TEST PASSED: Correctly rejected wrong unit count';
            ELSE
                RAISE EXCEPTION 'TEST FAILED: Wrong error - %', SQLERRM;
            END IF;
    END;
END $$;

-- TEST 3: Should succeed - correct assignment
DO $$
DECLARE
    v_status VARCHAR;
    v_assignment_status VARCHAR;
    v_unit_count INTEGER;
BEGIN
    RAISE NOTICE '=== TEST 3: Successful assignment ===';

    -- Perform assignment
    PERFORM assign_units_to_booking(
        '88888888-8888-8888-8888-888888888888',
        ARRAY['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222']::UUID[]
    );

    -- Verify booking status updated
    SELECT booking_status, unit_assignment_status
    INTO v_status, v_assignment_status
    FROM bookings
    WHERE booking_id = '88888888-8888-8888-8888-888888888888';

    IF v_status = 'Confirmed' AND v_assignment_status = 'assigned' THEN
        RAISE NOTICE '✓ TEST PASSED: Booking status correctly updated to Confirmed';
    ELSE
        RAISE EXCEPTION 'TEST FAILED: Status not updated correctly - %, %', v_status, v_assignment_status;
    END IF;

    -- Verify units inserted into booking_units
    SELECT COUNT(*) INTO v_unit_count
    FROM booking_units
    WHERE booking_id = '88888888-8888-8888-8888-888888888888';

    IF v_unit_count = 2 THEN
        RAISE NOTICE '✓ TEST PASSED: 2 units correctly assigned';
    ELSE
        RAISE EXCEPTION 'TEST FAILED: Wrong number of units assigned - %', v_unit_count;
    END IF;
END $$;

-- TEST 4: Should fail - already assigned (idempotency check)
DO $$
BEGIN
    RAISE NOTICE '=== TEST 4: Idempotency check ===';
    BEGIN
        PERFORM assign_units_to_booking(
            '88888888-8888-8888-8888-888888888888',
            ARRAY['33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222']::UUID[]
        );
        RAISE EXCEPTION 'TEST FAILED: Should have raised exception for already assigned booking';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%already assigned%' THEN
                RAISE NOTICE '✓ TEST PASSED: Correctly rejected re-assignment';
            ELSE
                RAISE EXCEPTION 'TEST FAILED: Wrong error - %', SQLERRM;
            END IF;
    END;
END $$;

-- TEST 5: Test exclusion constraint - double booking prevention
DO $$
BEGIN
    RAISE NOTICE '=== TEST 5: Double booking prevention ===';

    -- Create another booking for same dates
    INSERT INTO bookings (
        booking_id,
        guest_id,
        booking_reference,
        check_in,
        check_out,
        num_guests,
        total_amount,
        booking_status,
        payment_status,
        unit_assignment_status,
        is_multi_unit,
        requested_unit_count,
        guest_name,
        email,
        contact_number
    ) VALUES (
        '77777777-7777-7777-7777-777777777777',
        '99999999-9999-9999-9999-999999999999',
        'TEST-002',
        '2025-12-03'::DATE,  -- Overlaps with first booking
        '2025-12-07'::DATE,
        2,
        600.00,
        'Pending',
        'Completed',
        'pending',
        true,
        1,
        'Test Guest 2',
        'test2@example.com',
        '09181234567'
    );

    -- Add unit request
    INSERT INTO guest_booking_unit_requests (
        booking_id,
        unit_type,
        guests_per_unit,
        quantity
    ) VALUES ('77777777-7777-7777-7777-777777777777', 'Standard', 2, 1);

    BEGIN
        -- Try to assign same unit that's already booked
        PERFORM assign_units_to_booking(
            '77777777-7777-7777-7777-777777777777',
            ARRAY['11111111-1111-1111-1111-111111111111']::UUID[]  -- Already booked
        );
        RAISE EXCEPTION 'TEST FAILED: Should have prevented double booking';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%already booked%' THEN
                RAISE NOTICE '✓ TEST PASSED: Exclusion constraint prevented double booking';
            ELSE
                RAISE EXCEPTION 'TEST FAILED: Wrong error - %', SQLERRM;
            END IF;
    END;
END $$;

-- TEST 6: Test availability check function
DO $$
DECLARE
    v_result RECORD;
BEGIN
    RAISE NOTICE '=== TEST 6: Availability check function ===';

    -- Check availability for the overlapping booking
    FOR v_result IN
        SELECT * FROM check_units_available_for_booking(
            '77777777-7777-7777-7777-777777777777',
            ARRAY['11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333']::UUID[]
        )
    LOOP
        IF v_result.unit_id = '11111111-1111-1111-1111-111111111111' THEN
            IF NOT v_result.is_available AND v_result.conflict_booking_id IS NOT NULL THEN
                RAISE NOTICE '✓ Unit 1 correctly shows as unavailable';
            ELSE
                RAISE EXCEPTION 'TEST FAILED: Unit 1 should be unavailable';
            END IF;
        ELSIF v_result.unit_id = '33333333-3333-3333-3333-333333333333' THEN
            IF v_result.is_available THEN
                RAISE NOTICE '✓ Unit 3 correctly shows as available';
            ELSE
                RAISE EXCEPTION 'TEST FAILED: Unit 3 should be available';
            END IF;
        END IF;
    END LOOP;
END $$;

-- Cleanup
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== ALL TESTS PASSED ===';
    RAISE NOTICE '';
END $$;

ROLLBACK;  -- Clean up test data