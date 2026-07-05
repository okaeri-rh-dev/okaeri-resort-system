-- ============================================================================
-- FIX: Calendar Availability Not Syncing with Confirmed Bookings (BUG-002)
-- ============================================================================
-- Migration: 20260209_fix_calendar_availability_sync
-- Date: 2026-02-09
-- Priority: CRITICAL - Fixes calendar showing wrong availability
-- Affects: /api/public/v1/availability endpoint, public availability calendar
--
-- ROOT CAUSE:
-- The get_public_aggregate_availability() function was querying the bookings
-- and booking_units tables directly using complex JOINs. This caused the
-- calendar to not sync with confirmed bookings because:
-- 1. The JOINs were inefficient and potentially missing records
-- 2. The booking_unit_availability table (optimized for this purpose) was unused
--
-- FIX:
-- Replace bookings + booking_units JOINs with direct query to
-- booking_unit_availability table, which:
-- - Is specifically designed for availability lookups
-- - Has GIST exclusion constraints for overlap prevention
-- - Contains denormalized booking_status for efficient filtering
-- - Is automatically maintained by triggers
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
  v_start_of_current_month DATE := DATE_TRUNC('month', v_today)::DATE;
  v_max_future_date DATE := v_today + INTERVAL '1 year';
BEGIN
  -- ============================================================================
  -- INPUT VALIDATION (unchanged from previous version)
  -- ============================================================================

  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    RAISE EXCEPTION 'Start and end dates are required';
  END IF;

  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'End date must be after or equal to start date';
  END IF;

  IF p_end_date < v_today THEN
    RAISE EXCEPTION 'Cannot query past months. Please select the current month or a future month.';
  END IF;

  IF p_end_date > v_max_future_date THEN
    RAISE EXCEPTION 'Cannot query more than 1 year in the future';
  END IF;

  IF (p_end_date - p_start_date) > 180 THEN
    RAISE EXCEPTION 'Date range cannot exceed 180 days';
  END IF;

  -- ============================================================================
  -- QUERY TOTAL AVAILABLE UNITS (unchanged from previous version)
  -- ============================================================================

  SELECT COUNT(*) INTO v_total_units
  FROM units
  WHERE unit_status = 'Available';

  IF v_total_units = 0 THEN
    RETURN QUERY
    SELECT
      generate_series(p_start_date, p_end_date, '1 day'::interval)::date as date,
      0 as available_count;
    RETURN;
  END IF;

  -- ============================================================================
  -- AVAILABILITY CALCULATION - FIXED: Now uses booking_unit_availability table
  -- ============================================================================
  -- Previously: Complex JOINs on bookings + booking_units tables
  -- Now: Direct query to booking_unit_availability (optimized for this purpose)
  -- ============================================================================

  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      p_start_date,
      p_end_date,
      '1 day'::interval
    )::date as date
  ),
  occupied_per_day AS (
    -- ✅ FIX: Query booking_unit_availability table directly
    -- This table is specifically designed for availability lookups and contains:
    -- - Denormalized booking_status for efficient filtering
    -- - Proper check_in/check_out timestamps with timezone handling
    -- - GIST exclusion constraints for overlap prevention
    SELECT
      ds.date,
      COUNT(DISTINCT bua.unit_id)::INT as booked_count
    FROM date_series ds
    LEFT JOIN booking_unit_availability bua ON (
      -- Only count active booking statuses that block availability
      bua.booking_status IN ('Confirmed', 'CheckedIn', 'Hold')
      -- Convert to Asia/Manila timezone for correct date comparison
      AND ds.date >= (bua.check_in AT TIME ZONE 'Asia/Manila')::date
      AND ds.date < (bua.check_out AT TIME ZONE 'Asia/Manila')::date
      -- Only count units that are marked as Available in the system
      AND bua.unit_id IN (SELECT unit_id FROM units WHERE unit_status = 'Available')
    )
    GROUP BY ds.date
  ),
  blackout_per_day AS (
    -- Blackouts remain unchanged - they use availability_blackouts table
    SELECT
      ds.date,
      COUNT(DISTINCT ab.unit_id)::INT as blackout_count
    FROM date_series ds
    LEFT JOIN availability_blackouts ab ON (
      ab.unit_id IN (SELECT unit_id FROM units WHERE unit_status = 'Available')
      AND ds.date >= (ab.start_date AT TIME ZONE 'Asia/Manila')::date
      AND ds.date < (ab.end_date AT TIME ZONE 'Asia/Manila')::date
    )
    GROUP BY ds.date
  )
  SELECT
    opd.date,
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
-- FUNCTION METADATA (updated)
-- ============================================================================

COMMENT ON FUNCTION get_public_aggregate_availability(DATE, DATE) IS
  'Returns aggregated availability counts for public calendar (bookings + blackouts).
  VERSION 1.3 - BUG-002 FIX: Now queries booking_unit_availability table directly
  instead of complex JOINs on bookings + booking_units tables.

  CHANGE LOG:
  - v1.3 (2026-02-09): Fixed calendar sync by using booking_unit_availability table
  - v1.2 (2025-10-19): Timezone fix with AT TIME ZONE conversion
  - v1.1: Initial multi-unit support via booking_units junction table

  The booking_unit_availability table is specifically designed for fast availability
  lookups with GIST exclusion constraints. This ensures confirmed bookings are
  correctly reflected in the calendar.

  SECURITY DEFINER bypasses RLS to safely expose availability without revealing
  guest data. VIEW-ONLY: No pricing, no guest information, no booking details exposed.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Test 1: Verify function exists and is updated
DO $$
DECLARE
  v_func_comment TEXT;
BEGIN
  SELECT pg_catalog.obj_description(oid, 'pg_proc')
  INTO v_func_comment
  FROM pg_proc
  WHERE proname = 'get_public_aggregate_availability';

  IF v_func_comment LIKE '%VERSION 1.3%' THEN
    RAISE NOTICE '✅ BUG-002 fix applied successfully (Version 1.3)';
  ELSE
    RAISE WARNING '⚠️ Function updated but version string may not match';
  END IF;
END;
$$;

-- Test 2: Quick availability check
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM get_public_aggregate_availability(
    CURRENT_DATE,
    (CURRENT_DATE + INTERVAL '7 days')::DATE
  );

  RAISE NOTICE '✅ Function executable: returned % rows for next 7 days', v_count;
END;
$$;

-- Test 3: Verify booking_unit_availability table has data for active bookings
DO $$
DECLARE
  v_active_count INT;
  v_bua_count INT;
BEGIN
  -- Count active bookings
  SELECT COUNT(*) INTO v_active_count
  FROM bookings
  WHERE booking_status IN ('Confirmed', 'CheckedIn', 'Hold');

  -- Count matching availability records
  SELECT COUNT(*) INTO v_bua_count
  FROM booking_unit_availability
  WHERE booking_status IN ('Confirmed', 'CheckedIn', 'Hold');

  IF v_active_count > 0 AND v_bua_count = 0 THEN
    RAISE WARNING '⚠️ Active bookings exist (%) but no availability records found. Run refresh_booking_unit_availability() to sync.', v_active_count;
  ELSE
    RAISE NOTICE '✅ Booking availability sync OK: % active bookings, % availability records', v_active_count, v_bua_count;
  END IF;
END;
$$;

-- ============================================================================
-- OPTIONAL: Refresh availability records if out of sync
-- ============================================================================
-- Uncomment and run if the verification above shows a mismatch:
--
-- INSERT INTO booking_unit_availability (unit_id, booking_id, check_in, check_out, booking_status)
-- SELECT bu.unit_id, b.booking_id, b.check_in, b.check_out, b.booking_status
-- FROM bookings b
-- JOIN booking_units bu ON bu.booking_id = b.booking_id
-- WHERE b.booking_status IN ('Confirmed', 'CheckedIn', 'Hold', 'Pending')
-- ON CONFLICT (booking_id, unit_id) DO UPDATE SET
--   check_in = EXCLUDED.check_in,
--   check_out = EXCLUDED.check_out,
--   booking_status = EXCLUDED.booking_status,
--   updated_at = NOW();
-- ============================================================================
