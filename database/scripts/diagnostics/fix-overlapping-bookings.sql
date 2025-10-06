-- Fix Overlapping Bookings Before Applying Constraint
-- This script identifies and resolves conflicting bookings

-- Step 1: Identify all overlapping bookings
WITH overlapping_bookings AS (
  SELECT
    b1.booking_id as booking1_id,
    b1.booking_reference as booking1_ref,
    b1.created_at as booking1_created,
    b1.booking_status as booking1_status,
    b1.is_guest_booking as booking1_is_guest,
    b2.booking_id as booking2_id,
    b2.booking_reference as booking2_ref,
    b2.created_at as booking2_created,
    b2.booking_status as booking2_status,
    b2.is_guest_booking as booking2_is_guest,
    b1.unit_id,
    b1.check_in,
    b1.check_out
  FROM bookings b1
  JOIN bookings b2 ON b1.unit_id = b2.unit_id
    AND b1.booking_id != b2.booking_id
    AND b1.check_in < b2.check_out
    AND b1.check_out > b2.check_in
  WHERE
    -- Apply same conditions as the constraint
    ((b1.is_guest_booking = false AND b1.booking_status NOT IN ('Cancelled', 'NoShow')) OR
     (b1.is_guest_booking = true AND b1.booking_status IN ('Confirmed', 'CheckedIn', 'CheckedOut')))
    AND
    ((b2.is_guest_booking = false AND b2.booking_status NOT IN ('Cancelled', 'NoShow')) OR
     (b2.is_guest_booking = true AND b2.booking_status IN ('Confirmed', 'CheckedIn', 'CheckedOut')))
    AND b1.booking_id < b2.booking_id -- Avoid duplicates in the result
)
SELECT * FROM overlapping_bookings;

-- Step 2: Show summary of conflicts
SELECT
  COUNT(*) as conflict_count,
  COUNT(DISTINCT unit_id) as affected_units
FROM (
  SELECT DISTINCT b1.booking_id, b1.unit_id
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
     (b2.is_guest_booking = true AND b2.booking_status IN ('Confirmed', 'CheckedIn', 'CheckedOut')))
) conflicts;

-- Step 3: Resolution Strategy
-- For each pair of overlapping bookings, we'll keep the older one and cancel the newer one
-- This preserves the first booking made (fairness principle)

-- Create a backup table first
CREATE TABLE IF NOT EXISTS bookings_conflict_backup AS
SELECT * FROM bookings WHERE 1=0; -- Create structure only

-- Backup conflicting bookings before modification
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
);

-- Step 4: Cancel newer conflicting bookings
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

-- Step 5: Verify no conflicts remain
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN 'SUCCESS: All conflicts resolved. Ready to apply constraint.'
    ELSE 'ERROR: ' || COUNT(*) || ' conflicts still remain.'
  END as status
FROM (
  SELECT b1.booking_id
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
     (b2.is_guest_booking = true AND b2.booking_status IN ('Confirmed', 'CheckedIn', 'CheckedOut')))
) remaining_conflicts;

-- Step 6: Now apply the constraint (run the original migration after this)
-- The constraint should now apply successfully