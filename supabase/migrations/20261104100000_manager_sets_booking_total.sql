-- Managers and above change a booking's total. The new total is split across the
-- cabins in proportion to their current subtotals, rounded down to centavos; the
-- largest cabin takes the remainder so the subtotals sum exactly to the new total.
-- update_booking_totals recomputes total_amount, which re-derives payment_status.
BEGIN;

CREATE OR REPLACE FUNCTION public.set_booking_total(p_booking_id uuid, p_total numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT public.is_manager_or_above() THEN
        RAISE EXCEPTION 'Only a manager can change a booking''s total' USING ERRCODE = '42501';
    END IF;

    IF p_total IS NULL OR p_total < 0 OR p_total <> round(p_total, 2) THEN
        RAISE EXCEPTION 'The total must be zero or more, in centavos' USING ERRCODE = '22023';
    END IF;

    PERFORM 1 FROM public.bookings WHERE booking_id = p_booking_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % not found', p_booking_id USING ERRCODE = 'P0002';
    END IF;

    WITH cabins AS (
        SELECT
            booking_unit_id,
            subtotal,
            weekend_surcharge,
            extra_person_charge,
            -- Cabins with no price yet share the total equally.
            CASE WHEN SUM(subtotal) OVER () = 0 THEN 1 ELSE subtotal END AS weight,
            row_number() OVER (ORDER BY subtotal, booking_unit_id) AS position,
            count(*) OVER () AS cabin_count
        FROM public.booking_units
        WHERE booking_id = p_booking_id
    ),
    floored AS (
        SELECT *, floor(p_total * weight / SUM(weight) OVER () * 100) / 100 AS share
        FROM cabins
    ),
    shares AS (
        SELECT
            booking_unit_id,
            subtotal,
            weekend_surcharge,
            extra_person_charge,
            CASE WHEN position = cabin_count
                THEN p_total - (SUM(share) OVER () - share)
                ELSE share
            END AS new_subtotal
        FROM floored
    ),
    scaled AS (
        SELECT
            booking_unit_id,
            new_subtotal,
            CASE WHEN subtotal = 0 THEN 0
                ELSE floor(weekend_surcharge * new_subtotal / subtotal * 100) / 100 END AS new_weekend,
            CASE WHEN subtotal = 0 THEN 0
                ELSE floor(extra_person_charge * new_subtotal / subtotal * 100) / 100 END AS new_extra
        FROM shares
    )
    UPDATE public.booking_units bu
    SET subtotal = s.new_subtotal,
        weekend_surcharge = s.new_weekend,
        extra_person_charge = s.new_extra,
        unit_price = s.new_subtotal - s.new_weekend - s.new_extra
    FROM scaled s
    WHERE bu.booking_unit_id = s.booking_unit_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % has no cabins', p_booking_id USING ERRCODE = '22023';
    END IF;
END;
$$;

COMMENT ON FUNCTION public.set_booking_total(uuid, numeric) IS
    'Manager-only: sets a booking''s total by scaling its cabin subtotals in proportion.';

REVOKE ALL ON FUNCTION public.set_booking_total(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_booking_total(uuid, numeric) TO authenticated;

COMMIT;
