-- Migration: 014-guest-booking-exclusion-constraint-with-cleanup.sql
-- Purpose: Fix existing conflicts then add exclusion constraint to prevent double bookings
-- Date: 2025-10-06
-- Critical: This prevents race conditions in concurrent booking requests

-- Enable required extension for GIST indexes if not already enabled
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Step 1: Create backup table for conflict resolution audit trail
CREATE TABLE IF NOT EXISTS bookings_conflict_backup AS
SELECT * FROM bookings WHERE 1=0;

-- Step 2: Backup any conflicting bookings before modification
INSERT INTO bookings_conflict_backup
SELECT b.*
FROM bookings b
WHERE EXISTS (
  SELECT 1
  FROM bookings b2
  WHERE b2.unit_id = b.unit_id
    AND b2.booking_id != b.booking_id
    AND b.check_in < b2.check_out
    AND b.check_out > b2.check_in
    AND ((b.is_guest_booking = false AND b.booking_status NOT IN ('Cancelled', 'NoShow')) OR
         (b.is_guest_booking = true AND b.booking_status IN ('Confirmed', 'CheckedIn', 'CheckedOut')))
    AND ((b2.is_guest_booking = false AND b2.booking_status NOT IN ('Cancelled', 'NoShow')) OR
         (b2.is_guest_booking = true AND b2.booking_status IN ('Confirmed', 'CheckedIn', 'CheckedOut')))
)
ON CONFLICT DO NOTHING; -- Ignore if already backed up

-- Step 3: Cancel duplicate bookings (keep the older one, cancel newer ones)
UPDATE bookings
SET
  booking_status = 'Cancelled',
  notes = COALESCE(notes, '') || ' [AUTO-CANCELLED: Duplicate booking conflict resolved on ' || NOW()::date || ']',
  updated_at = NOW()
WHERE booking_id IN (
  SELECT b2.booking_id
  FROM bookings b1
  JOIN bookings b2 ON b1.unit_id = b2.unit_id
    AND b1.booking_id != b2.booking_id
    AND b1.check_in < b2.check_out
    AND b1.check_out > b2.check_in
    AND b1.created_at < b2.created_at -- Keep older booking, cancel newer
  WHERE
    ((b1.is_guest_booking = false AND b1.booking_status NOT IN ('Cancelled', 'NoShow')) OR
     (b1.is_guest_booking = true AND b1.booking_status IN ('Confirmed', 'CheckedIn', 'CheckedOut')))
    AND
    ((b2.is_guest_booking = false AND b2.booking_status NOT IN ('Cancelled', 'NoShow')) OR
     (b2.is_guest_booking = true AND b2.booking_status IN ('Confirmed', 'CheckedIn', 'CheckedOut')))
);

-- Step 4: Drop existing constraint if it exists (safe for re-running)
ALTER TABLE bookings
DROP CONSTRAINT IF EXISTS no_overlapping_bookings;

-- Step 5: Add exclusion constraint to prevent overlapping bookings
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

-- Step 6: Create index to improve constraint performance
CREATE INDEX IF NOT EXISTS idx_bookings_exclusion_helper
ON bookings (unit_id, check_in, check_out)
WHERE booking_status NOT IN ('Cancelled', 'NoShow');

-- Step 7: Add comment explaining the constraint
COMMENT ON CONSTRAINT no_overlapping_bookings ON bookings IS
'Prevents double bookings by ensuring no overlapping date ranges for the same unit.
Applies to all non-cancelled authenticated bookings and confirmed guest bookings.';

-- Step 8: Verify constraint is working
DO $$
DECLARE
  violation_count INTEGER;
  cancelled_count INTEGER;
BEGIN
  -- Count how many bookings were cancelled to resolve conflicts
  SELECT COUNT(*) INTO cancelled_count
  FROM bookings
  WHERE notes LIKE '%AUTO-CANCELLED: Duplicate booking conflict%';

  IF cancelled_count > 0 THEN
    RAISE NOTICE 'Resolved % conflicting bookings by cancelling duplicates.', cancelled_count;
  END IF;

  -- Verify no violations remain
  SELECT COUNT(*) INTO violation_count
  FROM bookings b1
  JOIN bookings b2 ON b1.unit_id = b2.unit_id
    AND b1.booking_id != b2.booking_id
    AND b1.check_in < b2.check_out
    AND b1.check_out > b2.check_in
  WHERE
    ((b1.is_guest_booking = false AND b1.booking_status NOT IN ('Cancelled', 'NoShow')) OR
     (b1.is_guest_booking = true AND b1.booking_status IN ('Confirmed', 'CheckedIn', 'CheckedOut')))
    AND
    ((b2.is_guest_booking = false AND b2.booking_status NOT IN ('Cancelled', 'NoShow')) OR
     (b2.is_guest_booking = true AND b2.booking_status IN ('Confirmed', 'CheckedIn', 'CheckedOut')));

  IF violation_count > 0 THEN
    RAISE EXCEPTION 'Cannot apply constraint: % overlapping bookings still exist after cleanup.', violation_count;
  ELSE
    RAISE NOTICE 'Constraint applied successfully. No overlapping bookings detected.';
  END IF;
END $$;