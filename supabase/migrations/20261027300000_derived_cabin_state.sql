-- Derived cabin state (#171, ADR 0005).
--
-- A cabin's state on a date comes only from blocks and bookings, never from
-- units.unit_status. The column stays, with its default, until release 2 drops it.

BEGIN;

-- Per unit on one night: Blocked (with the reasons), Booked or Free. Blocked wins over
-- Booked only in display; the guards keep a night from being both. Booked uses the same
-- statuses as the admin availability check. Night D of a stay runs from the Manila
-- check-in day up to, not including, the check-out day (ADR 0002).
CREATE FUNCTION public.get_cabin_states(p_date date)
RETURNS TABLE (unit_id uuid, state text, block_reason text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT public.is_staff_or_above() THEN
        RAISE EXCEPTION 'Only staff can see cabin states' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        u.unit_id,
        CASE
            WHEN blocks.reasons IS NOT NULL THEN 'Blocked'
            WHEN EXISTS (
                SELECT 1
                FROM public.booking_unit_availability bua
                WHERE bua.unit_id = u.unit_id
                  AND bua.booking_status IN ('Confirmed', 'CheckedIn')
                  AND p_date >= (bua.check_in AT TIME ZONE 'Asia/Manila')::date
                  AND p_date < (bua.check_out AT TIME ZONE 'Asia/Manila')::date
            ) THEN 'Booked'
            ELSE 'Free'
        END,
        blocks.reasons
    FROM public.units u
    LEFT JOIN LATERAL (
        SELECT string_agg(DISTINCT b.reason, '; ' ORDER BY b.reason) AS reasons
        FROM public.availability_blackouts b
        WHERE (b.unit_id = u.unit_id OR b.unit_id IS NULL)
          AND p_date BETWEEN b.start_date AND b.end_date
    ) blocks ON true
    ORDER BY u.unit_code;
END;
$$;

COMMENT ON FUNCTION public.get_cabin_states(date) IS
    'Per unit on night p_date: Blocked (a block or resort closure, with the reasons), Booked (a Confirmed or CheckedIn stay) or Free. Staff and above.';

REVOKE ALL ON FUNCTION public.get_cabin_states(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_cabin_states(date) TO authenticated;

COMMIT;
