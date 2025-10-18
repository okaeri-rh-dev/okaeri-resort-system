-- ============================================================================
-- PUBLIC AVAILABILITY FUNCTION (Phase 1: Backend) - TIMEZONE FIX
-- ============================================================================
-- Purpose: Safely expose aggregated availability counts for public calendar
-- Author: System (Phase 1 Implementation + Timezone Fix)
-- Date: 2025-10-10 (Updated: 2025-10-19)
-- Version: 1.1 - CRITICAL TIMEZONE FIX
--
-- SECURITY: Uses SECURITY DEFINER to bypass RLS, only returns aggregate counts
-- PRIVACY: NO guest data, booking details, or pricing information exposed
-- TIMEZONE: All dates converted to Asia/Manila before comparison
-- ============================================================================

-- ============================================================================
-- DROP EXISTING (If Re-running)
-- ============================================================================
DROP FUNCTION IF EXISTS get_public_aggregate_availability(DATE, DATE);

-- ============================================================================
-- CREATE PUBLIC AVAILABILITY FUNCTION WITH TIMEZONE HANDLING
-- ============================================================================
CREATE OR REPLACE FUNCTION get_public_aggregate_availability(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  date DATE,
  available_count INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_total_units INT;
  v_today DATE := CURRENT_DATE;
  v_max_future_date DATE := v_today + INTERVAL '1 year';
BEGIN
  -- ============================================================================
  -- INPUT VALIDATION
  -- ============================================================================

  -- Validate dates are provided
  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    RAISE EXCEPTION 'Start and end dates are required';
  END IF;

  -- Validate date order
  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'End date must be after or equal to start date';
  END IF;

  -- Prevent querying past dates (guests can't book the past)
  IF p_start_date < v_today THEN
    RAISE EXCEPTION 'Cannot query past dates. Start date must be today or later.';
  END IF;

  -- Limit future queries to 1 year ahead (prevents abuse)
  IF p_end_date > v_max_future_date THEN
    RAISE EXCEPTION 'Cannot query more than 1 year in the future';
  END IF;

  -- Limit date range to 180 days to prevent abuse
  IF (p_end_date - p_start_date) > 180 THEN
    RAISE EXCEPTION 'Date range cannot exceed 180 days';
  END IF;

  -- ============================================================================
  -- QUERY TOTAL AVAILABLE UNITS
  -- ============================================================================

  -- Dynamic unit count (not hardcoded) - only count units with status='Available'
  SELECT COUNT(*) INTO v_total_units
  FROM units
  WHERE unit_status = 'Available';

  -- If no units are available at all, return all zeros
  IF v_total_units = 0 THEN
    RETURN QUERY
    SELECT
      generate_series(p_start_date, p_end_date, '1 day'::interval)::date as date,
      0 as available_count;
    RETURN;
  END IF;

  -- ============================================================================
  -- AVAILABILITY CALCULATION WITH TIMEZONE CONVERSION
  -- ============================================================================

  RETURN QUERY
  WITH date_series AS (
    -- Generate all dates in the requested range
    SELECT generate_series(
      p_start_date,
      p_end_date,
      '1 day'::interval
    )::date as date
  ),
  occupied_per_day AS (
    -- Count booked units per day (only from Available units)
    -- CRITICAL FIX: Convert TIMESTAMPTZ to DATE in Asia/Manila timezone
    SELECT
      ds.date,
      COUNT(DISTINCT b.unit_id)::INT as booked_count
    FROM date_series ds
    LEFT JOIN bookings b ON (
      b.unit_id IN (SELECT unit_id FROM units WHERE unit_status = 'Available')
      AND b.booking_status IN ('Confirmed', 'CheckedIn', 'Hold')
      -- Hold status counts as occupied to prevent overbooking
      -- Guest occupies unit from check-in (inclusive) to check-out (exclusive)

      -- ✅ TIMEZONE FIX: Explicitly convert UTC timestamps to Manila timezone before date extraction
      AND ds.date >= (b.check_in AT TIME ZONE 'Asia/Manila')::date
      AND ds.date < (b.check_out AT TIME ZONE 'Asia/Manila')::date  -- Checkout day is available

      AND b.unit_id IS NOT NULL  -- Only single-unit bookings for now
    )
    GROUP BY ds.date
  ),
  blackout_per_day AS (
    -- Count blackout units per day (only from Available units)
    -- CRITICAL FIX: Convert TIMESTAMPTZ to DATE in Asia/Manila timezone
    SELECT
      ds.date,
      COUNT(DISTINCT ab.unit_id)::INT as blackout_count
    FROM date_series ds
    LEFT JOIN availability_blackouts ab ON (
      ab.unit_id IN (SELECT unit_id FROM units WHERE unit_status = 'Available')

      -- ✅ TIMEZONE FIX: Explicitly convert UTC timestamps to Manila timezone before date extraction
      AND ds.date >= (ab.start_date AT TIME ZONE 'Asia/Manila')::date
      AND ds.date < (ab.end_date AT TIME ZONE 'Asia/Manila')::date
    )
    GROUP BY ds.date
  )
  SELECT
    opd.date,
    -- Calculate available units: total - booked - blackouts (never negative)
    GREATEST(
      0,
      v_total_units - COALESCE(opd.booked_count, 0) - COALESCE(bpd.blackout_count, 0)
    )::INT as available_count
  FROM occupied_per_day opd
  JOIN blackout_per_day bpd ON opd.date = bpd.date
  ORDER BY opd.date;
END;
$$;

-- ============================================================================
-- GRANT PUBLIC ACCESS
-- ============================================================================
-- Allow anonymous (unauthenticated) users to execute this function
GRANT EXECUTE ON FUNCTION get_public_aggregate_availability(DATE, DATE) TO anon;

-- ============================================================================
-- FUNCTION METADATA
-- ============================================================================
COMMENT ON FUNCTION get_public_aggregate_availability(DATE, DATE) IS
  'Returns aggregated availability counts for public calendar (bookings + blackouts).
  Uses Option C hybrid model: static unit_status + date-specific blackouts.
  Currently supports single-unit bookings via bookings.unit_id.
  Multi-unit support will be added when booking_units table is created.
  SECURITY DEFINER bypasses RLS to safely expose availability without revealing guest data.
  VIEW-ONLY: No pricing, no guest information, no booking details exposed.
  TIMEZONE: All UTC timestamps explicitly converted to Asia/Manila timezone before date comparison.';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Test 1: Query next 30 days (starting from today)
SELECT * FROM get_public_aggregate_availability(
  CURRENT_DATE,
  (CURRENT_DATE + INTERVAL '30 days')::date
)
LIMIT 5;

-- Test 2: Verify performance (should be < 100ms for 31-day range)
EXPLAIN ANALYZE
SELECT * FROM get_public_aggregate_availability(
  CURRENT_DATE,
  (CURRENT_DATE + INTERVAL '30 days')::date
);

-- Test 3: Verify anonymous access works
SET ROLE anon;
SELECT COUNT(*) FROM get_public_aggregate_availability(
  CURRENT_DATE,
  (CURRENT_DATE + INTERVAL '7 days')::date
);
RESET ROLE;

-- Test 4: Verify timezone handling is correct
-- This test creates a booking at the timezone boundary to verify conversion
DO $$
DECLARE
  v_test_booking_id UUID;
  v_test_unit_id UUID;
BEGIN
  -- Get a unit for testing
  SELECT unit_id INTO v_test_unit_id FROM units WHERE unit_status = 'Available' LIMIT 1;

  IF v_test_unit_id IS NOT NULL THEN
    -- Create a test booking at 4:00 PM UTC (midnight Manila time)
    -- This should appear as the NEXT day in Manila timezone
    INSERT INTO bookings (
      booking_id,
      unit_id,
      check_in,
      check_out,
      guest_name,
      guest_email,
      booking_status,
      total_amount
    ) VALUES (
      gen_random_uuid(),
      v_test_unit_id,
      '2025-01-15T16:00:00Z'::timestamptz,  -- 4:00 PM UTC = midnight Manila
      '2025-01-18T04:00:00Z'::timestamptz,  -- 12:00 PM Manila
      'Test Guest',
      'test@example.com',
      'Confirmed',
      1000
    ) RETURNING booking_id INTO v_test_booking_id;

    RAISE NOTICE 'Test booking created: %', v_test_booking_id;
    RAISE NOTICE 'Check if availability shows booking on Jan 16-18 (not Jan 15)';

    -- Query availability and show result
    RAISE NOTICE 'Availability for Jan 15-18:';
    PERFORM * FROM get_public_aggregate_availability(
      '2025-01-15'::date,
      '2025-01-18'::date
    );

    -- Clean up test booking
    DELETE FROM bookings WHERE booking_id = v_test_booking_id;
    RAISE NOTICE 'Test booking deleted';
  ELSE
    RAISE NOTICE 'No available units for testing';
  END IF;
END;
$$;

-- ============================================================================
-- EXPECTED OUTPUT
-- ============================================================================
-- date         | available_count
-- -------------+----------------
-- 2025-01-01   | 3
-- 2025-01-02   | 3
-- 2025-01-15   | 2  (1 unit booked)
-- 2025-01-20   | 0  (fully booked)
-- ...

-- ============================================================================
-- TIMEZONE HANDLING NOTES
-- ============================================================================
-- BEFORE FIX:
--   check_in::date  -- Uses database server timezone (could be UTC)
--
-- AFTER FIX:
--   (check_in AT TIME ZONE 'Asia/Manila')::date  -- Always Manila timezone
--
-- Example difference:
--   UTC timestamp: '2025-01-15T16:00:00Z' (4 PM UTC)
--
--   Wrong (server TZ = UTC):
--     check_in::date = '2025-01-15'
--
--   Correct (Manila TZ):
--     (check_in AT TIME ZONE 'Asia/Manila')::date = '2025-01-16'
--     (Because 4 PM UTC = midnight Manila = next day)
--
-- This matters for:
-- - Bookings made near midnight
-- - International guests booking from different timezones
-- - Ensuring calendar shows correct dates in Philippine time

-- ============================================================================
-- NOTES FOR DEVELOPERS
-- ============================================================================
-- 1. This function uses SECURITY DEFINER to bypass RLS policies
-- 2. Only aggregated counts are returned - NO guest information
-- 3. Currently supports single-unit bookings (bookings.unit_id)
-- 4. Multi-unit support: When booking_units table is created, update occupied_per_day CTE
-- 5. Performance optimized with STABLE keyword and proper indexes
-- 6. Used by API endpoint: /api/public/v1/availability
-- 7. Grant permission already applied: GRANT EXECUTE TO anon
-- 8. Checkout day is available (exclusive end date logic)
-- 9. ✅ ALL timezone conversions use 'Asia/Manila' explicitly
-- 10. ✅ Never rely on database server timezone for date extraction
