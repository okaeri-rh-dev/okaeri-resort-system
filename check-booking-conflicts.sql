-- Check for Existing Booking Conflicts
-- Run this query first to see what bookings would be affected by the constraint

-- Step 1: Show all conflicting booking pairs with details
WITH conflicting_pairs AS (
  SELECT
    b1.booking_id as booking1_id,
    b1.booking_reference as booking1_ref,
    b1.guest_name as guest1_name,
    b1.created_at as booking1_created,
    b1.booking_status as booking1_status,
    b1.is_guest_booking as booking1_is_guest,
    b2.booking_id as booking2_id,
    b2.booking_reference as booking2_ref,
    b2.guest_name as guest2_name,
    b2.created_at as booking2_created,
    b2.booking_status as booking2_status,
    b2.is_guest_booking as booking2_is_guest,
    b1.unit_id,
    b1.check_in as check_in_1,
    b1.check_out as check_out_1,
    b2.check_in as check_in_2,
    b2.check_out as check_out_2,
    CASE
      WHEN b1.created_at < b2.created_at THEN 'Keep booking 1, cancel booking 2'
      ELSE 'Keep booking 2, cancel booking 1'
    END as recommended_action
  FROM bookings b1
  JOIN bookings b2 ON b1.unit_id = b2.unit_id
    AND b1.booking_id < b2.booking_id -- Avoid duplicate pairs
    AND b1.check_in < b2.check_out
    AND b1.check_out > b2.check_in
  WHERE
    -- Apply same conditions as the constraint
    ((b1.is_guest_booking = false AND b1.booking_status != 'Cancelled') OR
     (b1.is_guest_booking = true AND b1.booking_status IN ('Confirmed', 'CheckedIn', 'CheckedOut')))
    AND
    ((b2.is_guest_booking = false AND b2.booking_status != 'Cancelled') OR
     (b2.is_guest_booking = true AND b2.booking_status IN ('Confirmed', 'CheckedIn', 'CheckedOut')))
  ORDER BY b1.created_at, b2.created_at
)
SELECT * FROM conflicting_pairs;

-- Step 2: Summary of conflicts
SELECT
  COUNT(*) as total_conflicts,
  COUNT(DISTINCT unit_id) as affected_units,
  COUNT(CASE WHEN booking1_is_guest OR booking2_is_guest THEN 1 END) as conflicts_with_guest_bookings
FROM (
  SELECT DISTINCT
    b1.booking_id as booking1_id,
    b1.unit_id,
    b1.is_guest_booking as booking1_is_guest,
    b2.is_guest_booking as booking2_is_guest
  FROM bookings b1
  JOIN bookings b2 ON b1.unit_id = b2.unit_id
    AND b1.booking_id < b2.booking_id
    AND b1.check_in < b2.check_out
    AND b1.check_out > b2.check_in
  WHERE
    ((b1.is_guest_booking = false AND b1.booking_status != 'Cancelled') OR
     (b1.is_guest_booking = true AND b1.booking_status IN ('Confirmed', 'CheckedIn', 'CheckedOut')))
    AND
    ((b2.is_guest_booking = false AND b2.booking_status != 'Cancelled') OR
     (b2.is_guest_booking = true AND b2.booking_status IN ('Confirmed', 'CheckedIn', 'CheckedOut')))
) conflict_summary;

-- Step 3: Bookings that would be cancelled (newer bookings in each conflict pair)
SELECT
  'Would cancel:' as action,
  b2.booking_id,
  b2.booking_reference,
  b2.guest_name,
  b2.check_in,
  b2.check_out,
  b2.total_amount,
  b2.booking_status,
  b2.created_at,
  'Conflicts with ' || b1.booking_reference || ' (created ' || b1.created_at || ')' as reason
FROM bookings b1
JOIN bookings b2 ON b1.unit_id = b2.unit_id
  AND b1.booking_id != b2.booking_id
  AND b1.check_in < b2.check_out
  AND b1.check_out > b2.check_in
  AND b1.created_at < b2.created_at -- b2 would be cancelled (newer)
WHERE
  ((b1.is_guest_booking = false AND b1.booking_status != 'Cancelled') OR
   (b1.is_guest_booking = true AND b1.booking_status IN ('Confirmed', 'CheckedIn', 'CheckedOut')))
  AND
  ((b2.is_guest_booking = false AND b2.booking_status != 'Cancelled') OR
   (b2.is_guest_booking = true AND b2.booking_status IN ('Confirmed', 'CheckedIn', 'CheckedOut')))
ORDER BY b2.created_at DESC;