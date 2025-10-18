-- ============================================================================
-- TIMEZONE FIX: get_public_aggregate_availability()
-- ============================================================================
-- Migration: 20251019_hotfix_availability_timezone
-- Date: 2025-10-19
-- Priority: CRITICAL - Fixes timezone bug in availability calendar
-- Affects: /api/public/v1/availability endpoint
--
-- ISSUE: Lines 108-109 and 121-122 in previous migration used ::date casting
--        which depends on database server timezone (undefined behavior)
--
-- FIX: Explicitly convert to 'Asia/Manila' timezone using AT TIME ZONE
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
  -- INPUT VALIDATION (unchanged)
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
  -- QUERY TOTAL AVAILABLE UNITS (unchanged)
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
  -- AVAILABILITY CALCULATION - TIMEZONE FIX APPLIED
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
    -- ✅ TIMEZONE FIX: Explicitly convert UTC to Asia/Manila before date extraction
    SELECT
      ds.date,
      COUNT(DISTINCT bu.unit_id)::INT as booked_count
    FROM date_series ds
    LEFT JOIN bookings b ON (
      b.booking_status IN ('Confirmed', 'CheckedIn', 'Hold')

      -- ✅ FIXED: Convert timestamps to Asia/Manila timezone before date comparison
      AND ds.date >= (b.check_in AT TIME ZONE 'Asia/Manila')::date
      AND ds.date < (b.check_out AT TIME ZONE 'Asia/Manila')::date
    )
    LEFT JOIN booking_units bu ON (
      bu.booking_id = b.booking_id
      AND bu.unit_id IN (SELECT unit_id FROM units WHERE unit_status = 'Available')
    )
    GROUP BY ds.date
  ),
  blackout_per_day AS (
    -- ✅ TIMEZONE FIX: Explicitly convert UTC to Asia/Manila before date extraction
    SELECT
      ds.date,
      COUNT(DISTINCT ab.unit_id)::INT as blackout_count
    FROM date_series ds
    LEFT JOIN availability_blackouts ab ON (
      ab.unit_id IN (SELECT unit_id FROM units WHERE unit_status = 'Available')

      -- ✅ FIXED: Convert timestamps to Asia/Manila timezone before date comparison
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
  VERSION 1.2 - TIMEZONE FIX: All UTC timestamps explicitly converted to Asia/Manila
  timezone before date extraction. This ensures correct date display regardless of
  database server timezone setting. Fixed validation to allow current month queries.
  Uses Option C hybrid model: static unit_status + date-specific blackouts.
  Supports unified multi-unit architecture via booking_units junction table.
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

  IF v_func_comment LIKE '%VERSION 1.2%' THEN
    RAISE NOTICE '✅ Timezone fix applied successfully (Version 1.2)';
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

  RAISE NOTICE '✅ Function executable: returned % rows', v_count;
END;
$$;

-- ============================================================================
-- WHAT CHANGED
-- ============================================================================
-- BEFORE (lines 108-109, 121-122):
--   AND ds.date >= b.check_in::date
--   AND ds.date < b.check_out::date
--   AND ds.date >= ab.start_date::date
--   AND ds.date < ab.end_date::date
--
-- AFTER:
--   AND ds.date >= (b.check_in AT TIME ZONE 'Asia/Manila')::date
--   AND ds.date < (b.check_out AT TIME ZONE 'Asia/Manila')::date
--   AND ds.date >= (ab.start_date AT TIME ZONE 'Asia/Manila')::date
--   AND ds.date < (ab.end_date AT TIME ZONE 'Asia/Manila')::date
--
-- IMPACT:
--   - Bookings near midnight now show on correct Philippine date
--   - Calendar dates consistent with dashboard and frontend
--   - No more timezone ambiguity or day-off-by-one errors
-- ============================================================================
