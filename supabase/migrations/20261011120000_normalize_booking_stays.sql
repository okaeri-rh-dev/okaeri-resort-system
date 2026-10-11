-- supabase/migrations/20261011120000_normalize_booking_stays.sql
-- Stays: Manila check-in day at 14:00, check-out day at 12:00 (docs/adr/0002).
-- 1. booking_units_no_double_booking exists only on local databases (prod drift #2,
--    migration 20251028154441): booking_units rows have NULL dates, so it blocks any
--    second booking of a unit. booking_unit_availability is the overlap guard.
-- 2. create_multi_unit_booking stores payment_method.
-- 3. check_multi_unit_availability.next_available_date = when the conflicting stays end.
-- 4. create_multi_unit_booking is executable by service_role only (the Worker); it was open to anon.
-- 5. normalize_booking_stays(): normalize stay times, sync and backfill availability rows.

BEGIN;

ALTER TABLE public.booking_units DROP CONSTRAINT IF EXISTS booking_units_no_double_booking;

CREATE OR REPLACE FUNCTION public.create_multi_unit_booking(
    p_booking_data JSONB,
    p_units JSONB[],
    p_guest_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_booking_id UUID;
    v_unit JSONB;
    v_total_amount DECIMAL(10,2) := 0;
BEGIN
    FOREACH v_unit IN ARRAY p_units
    LOOP
        v_total_amount := v_total_amount + (v_unit->>'subtotal')::DECIMAL;
    END LOOP;

    INSERT INTO public.bookings (
        booking_reference, guest_id, guest_name, contact_number, email, num_guests,
        check_in, check_out, total_amount, is_multi_unit, unit_count,
        booking_status, payment_status, payment_method,
        special_requests, internal_notes, is_walk_in
    ) VALUES (
        COALESCE(p_booking_data->>'booking_reference', public.generate_booking_reference()),
        p_guest_id,
        p_booking_data->>'guest_name',
        p_booking_data->>'contact_number',
        p_booking_data->>'email',
        (p_booking_data->>'num_guests')::INTEGER,
        (p_booking_data->>'check_in')::TIMESTAMPTZ,
        (p_booking_data->>'check_out')::TIMESTAMPTZ,
        v_total_amount,
        array_length(p_units, 1) > 1,
        array_length(p_units, 1),
        COALESCE(p_booking_data->>'booking_status', 'Pending'),
        COALESCE(p_booking_data->>'payment_status', 'Pending'),
        p_booking_data->>'payment_method',
        p_booking_data->>'special_requests',
        p_booking_data->>'internal_notes',
        COALESCE((p_booking_data->>'is_walk_in')::BOOLEAN, false)
    ) RETURNING booking_id INTO v_booking_id;

    FOREACH v_unit IN ARRAY p_units
    LOOP
        INSERT INTO public.booking_units (
            booking_id, unit_id, unit_price, weekend_surcharge, extra_person_charge,
            subtotal, assigned_guests, unit_notes
        ) VALUES (
            v_booking_id,
            (v_unit->>'unit_id')::UUID,
            (v_unit->>'unit_price')::DECIMAL,
            COALESCE((v_unit->>'weekend_surcharge')::DECIMAL, 0),
            COALESCE((v_unit->>'extra_person_charge')::DECIMAL, 0),
            (v_unit->>'subtotal')::DECIMAL,
            (v_unit->>'assigned_guests')::INTEGER,
            v_unit->>'unit_notes'
        );

        INSERT INTO public.booking_unit_availability (
            unit_id, booking_id, check_in, check_out, booking_status
        ) VALUES (
            (v_unit->>'unit_id')::UUID,
            v_booking_id,
            (p_booking_data->>'check_in')::TIMESTAMPTZ,
            (p_booking_data->>'check_out')::TIMESTAMPTZ,
            COALESCE(p_booking_data->>'booking_status', 'Pending')
        );
    END LOOP;

    RETURN v_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.create_multi_unit_booking(JSONB, JSONB[], UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_multi_unit_booking(JSONB, JSONB[], UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.check_multi_unit_availability(
    p_unit_ids UUID[],
    p_check_in TIMESTAMPTZ,
    p_check_out TIMESTAMPTZ,
    p_exclude_booking_id UUID DEFAULT NULL
) RETURNS TABLE(
    unit_id UUID,
    is_available BOOLEAN,
    conflicting_bookings INTEGER,
    next_available_date TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.unit_id,
        COUNT(bua.availability_id) = 0,
        COUNT(bua.availability_id)::INTEGER,
        MAX(bua.check_out)
    FROM public.units u
    LEFT JOIN public.booking_unit_availability bua
      ON bua.unit_id = u.unit_id
     AND bua.booking_status IN ('Confirmed', 'CheckedIn')
     AND tstzrange(bua.check_in, bua.check_out, '[)') && tstzrange(p_check_in, p_check_out, '[)')
     AND (p_exclude_booking_id IS NULL OR bua.booking_id != p_exclude_booking_id)
    WHERE u.unit_id = ANY(p_unit_ids)
      AND u.unit_status = 'Available'
    GROUP BY u.unit_id;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = '';

CREATE OR REPLACE FUNCTION public.at_manila_time(p_instant TIMESTAMPTZ, p_time TIME)
RETURNS TIMESTAMPTZ AS $$
    SELECT ((p_instant AT TIME ZONE 'Asia/Manila')::DATE + p_time) AT TIME ZONE 'Asia/Manila';
$$ LANGUAGE sql STABLE SET search_path = '';

CREATE OR REPLACE FUNCTION public.normalize_booking_stays(
    p_check_in_time TIME DEFAULT '14:00',
    p_check_out_time TIME DEFAULT '12:00'
) RETURNS TABLE(normalized_bookings INTEGER, backfilled_availability INTEGER) AS $$
DECLARE
    v_overlaps TEXT;
    v_check_ins INTEGER;
    v_check_outs INTEGER;
    v_backfilled INTEGER;
BEGIN
    SELECT string_agg(DISTINCT a.booking_reference || ' & ' || b.booking_reference, ', ')
    INTO v_overlaps
    FROM public.booking_units au
    JOIN public.bookings a ON a.booking_id = au.booking_id
    JOIN public.booking_units bu ON bu.unit_id = au.unit_id AND bu.booking_id > au.booking_id
    JOIN public.bookings b ON b.booking_id = bu.booking_id
    WHERE a.booking_status IN ('Confirmed', 'CheckedIn')
      AND b.booking_status IN ('Confirmed', 'CheckedIn')
      AND tstzrange(public.at_manila_time(a.check_in, p_check_in_time),
                    public.at_manila_time(a.check_out, p_check_out_time), '[)')
       && tstzrange(public.at_manila_time(b.check_in, p_check_in_time),
                    public.at_manila_time(b.check_out, p_check_out_time), '[)');

    IF v_overlaps IS NOT NULL THEN
        RAISE EXCEPTION 'Confirmed bookings overlap: %', v_overlaps;
    END IF;

    -- Check-ins first: with every check-in at p_check_in_time, moving a check-out to
    -- the earlier p_check_out_time cannot reach the next stay.
    UPDATE public.bookings
    SET check_in = public.at_manila_time(check_in, p_check_in_time)
    WHERE check_in IS DISTINCT FROM public.at_manila_time(check_in, p_check_in_time);
    GET DIAGNOSTICS v_check_ins = ROW_COUNT;

    UPDATE public.bookings
    SET check_out = public.at_manila_time(check_out, p_check_out_time)
    WHERE check_out IS DISTINCT FROM public.at_manila_time(check_out, p_check_out_time);
    GET DIAGNOSTICS v_check_outs = ROW_COUNT;

    UPDATE public.booking_unit_availability bua
    SET check_in = b.check_in, check_out = b.check_out, booking_status = b.booking_status
    FROM public.bookings b
    WHERE b.booking_id = bua.booking_id
      AND (bua.check_in, bua.check_out, bua.booking_status)
          IS DISTINCT FROM (b.check_in, b.check_out, b.booking_status);

    INSERT INTO public.booking_unit_availability (unit_id, booking_id, check_in, check_out, booking_status)
    SELECT bu.unit_id, bu.booking_id, b.check_in, b.check_out, b.booking_status
    FROM public.booking_units bu
    JOIN public.bookings b ON b.booking_id = bu.booking_id
    WHERE NOT EXISTS (
        SELECT 1 FROM public.booking_unit_availability bua
        WHERE bua.booking_id = bu.booking_id AND bua.unit_id = bu.unit_id
    );
    GET DIAGNOSTICS v_backfilled = ROW_COUNT;

    RETURN QUERY SELECT GREATEST(v_check_ins, v_check_outs), v_backfilled;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.normalize_booking_stays(TIME, TIME) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_booking_stays(TIME, TIME) TO service_role;

SELECT * FROM public.normalize_booking_stays();

COMMIT;
