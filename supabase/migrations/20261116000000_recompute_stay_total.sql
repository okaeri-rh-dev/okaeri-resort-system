-- Opt-in total recompute after a stay change (issue 461).
-- update_booking_stay takes p_recompute. When true, each cabin in p_units carries its
-- price from current rates and the summed total follows. Only a manager can ask, and
-- never on an Airbnb booking, whose total is the payout (docs/adr/0006).
BEGIN;

DROP FUNCTION IF EXISTS public.update_booking_stay(uuid, timestamptz, timestamptz, jsonb);

-- SECURITY DEFINER because staff may change the cabins of a Pending or Confirmed booking,
-- while booking_units writes are manager-only. The triggers still judge the caller.
CREATE OR REPLACE FUNCTION public.update_booking_stay(
    p_booking_id uuid,
    p_check_in timestamptz,
    p_check_out timestamptz,
    p_units jsonb,
    p_recompute boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_total numeric;
    v_source text;
BEGIN
    IF NOT public.is_staff_or_above() THEN
        RAISE EXCEPTION 'Only staff can change a stay' USING ERRCODE = '42501';
    END IF;

    IF p_recompute AND NOT public.is_manager_or_above() THEN
        RAISE EXCEPTION 'Only a manager can change a booking''s total' USING ERRCODE = '42501';
    END IF;

    IF jsonb_typeof(p_units) IS DISTINCT FROM 'array' OR jsonb_array_length(p_units) = 0 THEN
        RAISE EXCEPTION 'A booking needs at least one cabin' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_units) u
        WHERE COALESCE((u->>'assigned_guests')::integer, 0) < 1
    ) THEN
        RAISE EXCEPTION 'Each cabin needs at least one guest' USING ERRCODE = '22023';
    END IF;

    IF (SELECT count(DISTINCT u->>'unit_id') FROM jsonb_array_elements(p_units) u)
           <> jsonb_array_length(p_units) THEN
        RAISE EXCEPTION 'A cabin is listed more than once' USING ERRCODE = '22023';
    END IF;

    IF p_recompute AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_units) u
        WHERE NOT ((u->>'subtotal')::numeric >= 0
               AND (u->>'unit_price')::numeric >= 0
               AND (u->>'weekend_surcharge')::numeric >= 0
               AND (u->>'extra_person_charge')::numeric >= 0)
           IS TRUE
    ) THEN
        RAISE EXCEPTION 'A recompute needs a price for each cabin' USING ERRCODE = '22023';
    END IF;

    SELECT b.total_amount, b.booking_source INTO v_total, v_source
    FROM public.bookings b WHERE b.booking_id = p_booking_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % not found', p_booking_id USING ERRCODE = 'P0002';
    END IF;

    IF p_recompute AND v_source = 'Airbnb' THEN
        RAISE EXCEPTION 'An Airbnb booking''s total is the payout, so it is not recomputed'
            USING ERRCODE = '42501';
    END IF;

    -- The removed cabins' nights go first, so they cannot clash on the new dates
    DELETE FROM public.booking_unit_availability bua
    WHERE bua.booking_id = p_booking_id
      AND bua.unit_id NOT IN (SELECT (u->>'unit_id')::uuid FROM jsonb_array_elements(p_units) u);

    -- Added cabins go in before the removed ones go out, so the booking always has a cabin
    INSERT INTO public.booking_units (booking_id, unit_id, unit_price, subtotal, assigned_guests)
    SELECT p_booking_id, (u->>'unit_id')::uuid, 0, 0, (u->>'assigned_guests')::integer
    FROM jsonb_array_elements(p_units) u
    WHERE NOT EXISTS (
        SELECT 1 FROM public.booking_units bu
        WHERE bu.booking_id = p_booking_id AND bu.unit_id = (u->>'unit_id')::uuid
    );

    DELETE FROM public.booking_units bu
    WHERE bu.booking_id = p_booking_id
      AND bu.unit_id NOT IN (SELECT (u->>'unit_id')::uuid FROM jsonb_array_elements(p_units) u);

    UPDATE public.booking_units bu
    SET assigned_guests = (u->>'assigned_guests')::integer
    FROM jsonb_array_elements(p_units) u
    WHERE bu.booking_id = p_booking_id
      AND bu.unit_id = (u->>'unit_id')::uuid
      AND bu.assigned_guests IS DISTINCT FROM (u->>'assigned_guests')::integer;

    -- sync_booking_dates moves the kept cabins' availability rows
    UPDATE public.bookings
    SET check_in = p_check_in, check_out = p_check_out
    WHERE booking_id = p_booking_id
      AND (check_in, check_out) IS DISTINCT FROM (p_check_in, p_check_out);

    INSERT INTO public.booking_unit_availability (unit_id, booking_id, check_in, check_out, booking_status)
    SELECT bu.unit_id, b.booking_id, b.check_in, b.check_out, b.booking_status
    FROM public.booking_units bu
    JOIN public.bookings b ON b.booking_id = bu.booking_id
    WHERE bu.booking_id = p_booking_id
      AND NOT EXISTS (
          SELECT 1 FROM public.booking_unit_availability bua
          WHERE bua.booking_id = p_booking_id AND bua.unit_id = bu.unit_id
      );

    IF p_recompute THEN
        -- update_booking_totals sums the new subtotals into the total
        UPDATE public.booking_units bu
        SET unit_price = (u->>'unit_price')::numeric,
            weekend_surcharge = (u->>'weekend_surcharge')::numeric,
            extra_person_charge = (u->>'extra_person_charge')::numeric,
            subtotal = (u->>'subtotal')::numeric
        FROM jsonb_array_elements(p_units) u
        WHERE bu.booking_id = p_booking_id AND bu.unit_id = (u->>'unit_id')::uuid;
    -- Removing a priced cabin lowers the summed total; the stay change keeps it
    ELSIF (SELECT b.total_amount FROM public.bookings b WHERE b.booking_id = p_booking_id)
           IS DISTINCT FROM v_total THEN
        PERFORM public.split_booking_total(p_booking_id, v_total);
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_booking_stay(uuid, timestamptz, timestamptz, jsonb, boolean)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_booking_stay(uuid, timestamptz, timestamptz, jsonb, boolean)
    TO authenticated;

COMMIT;
