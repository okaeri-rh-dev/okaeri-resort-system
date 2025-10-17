-- ============================================================================
-- PUBLIC AVAILABILITY FUNCTION FOR CALENDAR
-- ============================================================================
-- Purpose: Safely expose aggregated availability counts for public calendar
-- Author: System (Phase 1 Implementation + Month Validation Fix)
-- Date: 2025-10-15
-- Version: 1.1
--
-- SECURITY: Uses SECURITY DEFINER to bypass RLS, only returns aggregate counts
-- PRIVACY: NO guest data, booking details, or pricing information exposed
-- ============================================================================

DROP FUNCTION IF EXISTS get_public_aggregate_availability(DATE, DATE);

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

  -- Prevent querying purely past months (guests can't book the past)
  -- Check end date only - this allows calendar grid overflow dates from previous month
  -- Example: Oct 26 - Nov 30 is valid when today is Nov 15 (Nov is current/future)
  -- Example: Sept 1 - Sept 30 is rejected when today is Nov 15 (purely past)
  IF p_end_date < v_today THEN
    RAISE EXCEPTION 'Cannot query past months. Please select the current month or a future month.';
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
  -- AVAILABILITY CALCULATION
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
    -- Supports unified multi-unit architecture via booking_units junction table
    SELECT
      ds.date,
      COUNT(DISTINCT bu.unit_id)::INT as booked_count
    FROM date_series ds
    LEFT JOIN bookings b ON (
      b.booking_status IN ('Confirmed', 'CheckedIn', 'Hold')
      -- Hold status counts as occupied to prevent overbooking
      -- Guest occupies unit from check-in (inclusive) to check-out (exclusive)
      AND ds.date >= b.check_in::date
      AND ds.date < b.check_out::date  -- Checkout day is available
    )
    LEFT JOIN booking_units bu ON (
      bu.booking_id = b.booking_id
      AND bu.unit_id IN (SELECT unit_id FROM units WHERE unit_status = 'Available')
    )
    GROUP BY ds.date
  ),
  blackout_per_day AS (
    -- Count blackout units per day (only from Available units)
    SELECT
      ds.date,
      COUNT(DISTINCT ab.unit_id)::INT as blackout_count
    FROM date_series ds
    LEFT JOIN availability_blackouts ab ON (
      ab.unit_id IN (SELECT unit_id FROM units WHERE unit_status = 'Available')
      AND ds.date >= ab.start_date::date
      AND ds.date < ab.end_date::date
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
GRANT EXECUTE ON FUNCTION get_public_aggregate_availability(DATE, DATE) TO authenticated;

-- ============================================================================
-- FUNCTION METADATA
-- ============================================================================
COMMENT ON FUNCTION get_public_aggregate_availability(DATE, DATE) IS
  'Returns aggregated availability counts for public calendar (bookings + blackouts). Fixed validation to allow current month queries (v1.1). Uses Option C hybrid model: static unit_status + date-specific blackouts. Supports unified multi-unit architecture via booking_units junction table (compatible with Oct 17, 2025 schema migration). SECURITY DEFINER bypasses RLS to safely expose availability without revealing guest data. VIEW-ONLY: No pricing, no guest information, no booking details exposed.';
