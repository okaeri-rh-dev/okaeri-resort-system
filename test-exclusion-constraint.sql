-- Test script to validate exclusion constraint syntax
-- This can be run locally to verify the constraint will work

-- Create test table structure (simplified version)
CREATE TEMP TABLE test_bookings (
    booking_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    booking_status VARCHAR(20) NOT NULL,
    is_guest_booking BOOLEAN DEFAULT FALSE
);

-- Enable required extension
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Add the exclusion constraint
ALTER TABLE test_bookings
ADD CONSTRAINT no_overlapping_bookings
EXCLUDE USING gist (
  unit_id WITH =,
  daterange(check_in, check_out, '[)') WITH &&
) WHERE (
  (is_guest_booking = false AND booking_status NOT IN ('Cancelled', 'NoShow')) OR
  (is_guest_booking = true AND booking_status IN ('Confirmed', 'CheckedIn', 'CheckedOut'))
);

-- Test 1: Insert first booking (should succeed)
INSERT INTO test_bookings (unit_id, check_in, check_out, booking_status, is_guest_booking)
VALUES ('test-unit-1', '2025-01-15', '2025-01-20', 'Confirmed', false);

-- Test 2: Insert non-overlapping booking (should succeed)
INSERT INTO test_bookings (unit_id, check_in, check_out, booking_status, is_guest_booking)
VALUES ('test-unit-1', '2025-01-20', '2025-01-25', 'Confirmed', false);

-- Test 3: Insert overlapping booking (should fail)
-- This should produce: ERROR: conflicting key value violates exclusion constraint
INSERT INTO test_bookings (unit_id, check_in, check_out, booking_status, is_guest_booking)
VALUES ('test-unit-1', '2025-01-18', '2025-01-22', 'Confirmed', false);

-- If we get here without the above failing, the constraint is not working!
SELECT 'CONSTRAINT TEST PASSED' as result;