-- Migration: 014-guest-booking-exclusion-constraint.sql
-- Purpose: Add exclusion constraint to prevent double bookings
-- Date: 2025-10-05
-- Critical: This prevents race conditions in concurrent booking requests

-- Enable required extension for GIST indexes if not already enabled
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Drop existing constraint if it exists (safe for re-running)
ALTER TABLE bookings
DROP CONSTRAINT IF EXISTS no_overlapping_bookings;

-- Add exclusion constraint to prevent overlapping bookings
-- This ensures database-level atomicity for booking conflicts
ALTER TABLE bookings
ADD CONSTRAINT no_overlapping_bookings
EXCLUDE USING gist (
  unit_id WITH =,
  tsrange(check_in, check_out, '[)') WITH &&
) WHERE (
  -- Apply constraint to:
  -- 1. All authenticated user bookings (is_guest_booking = false)
  -- 2. Guest bookings that are confirmed/active
  (is_guest_booking = false AND booking_status NOT IN ('Cancelled', 'NoShow')) OR
  (is_guest_booking = true AND booking_status IN ('Confirmed', 'CheckedIn', 'CheckedOut'))
);

-- Create index to improve constraint performance
CREATE INDEX IF NOT EXISTS idx_bookings_exclusion_helper
ON bookings (unit_id, check_in, check_out)
WHERE booking_status NOT IN ('Cancelled', 'NoShow');

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT no_overlapping_bookings ON bookings IS
'Prevents double bookings by ensuring no overlapping date ranges for the same unit.
Applies to all non-cancelled authenticated bookings and confirmed guest bookings.';

-- Verify constraint is working by checking for any existing violations
-- This will fail if there are existing overlapping bookings
DO $$
DECLARE
  violation_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO violation_count
  FROM bookings b1
  JOIN bookings b2 ON b1.unit_id = b2.unit_id
    AND b1.booking_id != b2.booking_id
    AND b1.check_in < b2.check_out
    AND b1.check_out > b2.check_in
  WHERE
    -- Check for violations based on constraint conditions
    ((b1.is_guest_booking = false AND b1.booking_status NOT IN ('Cancelled', 'NoShow')) OR
     (b1.is_guest_booking = true AND b1.booking_status IN ('Confirmed', 'CheckedIn', 'CheckedOut')))
    AND
    ((b2.is_guest_booking = false AND b2.booking_status NOT IN ('Cancelled', 'NoShow')) OR
     (b2.is_guest_booking = true AND b2.booking_status IN ('Confirmed', 'CheckedIn', 'CheckedOut')));

  IF violation_count > 0 THEN
    RAISE EXCEPTION 'Cannot apply constraint: % existing overlapping bookings found. Please resolve conflicts first.', violation_count;
  ELSE
    RAISE NOTICE 'Constraint applied successfully. No overlapping bookings detected.';
  END IF;
END $$;

-- Test the constraint (commented out for production, uncomment for testing)
-- BEGIN;
-- INSERT INTO bookings (unit_id, check_in, check_out, booking_status, is_guest_booking, ...)
-- VALUES ('test-unit-id', '2025-01-15', '2025-01-20', 'Confirmed', false, ...);
-- INSERT INTO bookings (unit_id, check_in, check_out, booking_status, is_guest_booking, ...)
-- VALUES ('test-unit-id', '2025-01-18', '2025-01-22', 'Confirmed', false, ...);
-- -- This should fail with: ERROR: conflicting key value violates exclusion constraint "no_overlapping_bookings"
-- ROLLBACK;