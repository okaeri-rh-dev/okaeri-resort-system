-- An Airbnb booking may carry Airbnb's confirmation code. A code is unique, so the
-- same Airbnb booking cannot be entered twice; many bookings have none.
BEGIN;

ALTER TABLE public.bookings
    ADD COLUMN airbnb_confirmation_code TEXT
    CONSTRAINT bookings_airbnb_confirmation_code_key UNIQUE;

GRANT UPDATE (airbnb_confirmation_code) ON TABLE public.bookings TO authenticated;

CREATE OR REPLACE FUNCTION public.create_multi_unit_booking(p_booking_data jsonb, p_units jsonb[], p_guest_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_booking_id UUID;
    v_unit JSONB;
    v_total_amount DECIMAL(10,2) := 0;
    v_source TEXT := COALESCE(p_booking_data->>'booking_source', 'Direct');
    v_status TEXT := CASE
        WHEN v_source = 'Airbnb' THEN 'Confirmed'
        ELSE COALESCE(p_booking_data->>'booking_status', 'Pending')
    END;
BEGIN
    PERFORM public.lock_units(ARRAY(SELECT (u->>'unit_id')::UUID FROM unnest(p_units) AS u));

    FOREACH v_unit IN ARRAY p_units
    LOOP
        v_total_amount := v_total_amount + (v_unit->>'subtotal')::DECIMAL;
    END LOOP;

    INSERT INTO public.bookings (
        booking_reference, guest_id, guest_name, contact_number, email, num_guests,
        check_in, check_out, total_amount, is_multi_unit, unit_count,
        booking_status, payment_status, payment_method,
        special_requests, internal_notes, is_walk_in, booking_source,
        airbnb_confirmation_code
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
        v_status,
        COALESCE(p_booking_data->>'payment_status', 'Pending'),
        p_booking_data->>'payment_method',
        p_booking_data->>'special_requests',
        p_booking_data->>'internal_notes',
        COALESCE((p_booking_data->>'is_walk_in')::BOOLEAN, false),
        v_source,
        p_booking_data->>'airbnb_confirmation_code'
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
            v_status
        );
    END LOOP;

    IF v_source = 'Airbnb' THEN
        INSERT INTO public.payments (booking_id, amount, payment_method)
        VALUES (v_booking_id, v_total_amount, 'Airbnb payout');
    END IF;

    RETURN v_booking_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_booking(
    p_booking_id uuid,
    p_changes jsonb,
    p_total numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.bookings b
    SET (guest_id, guest_name, email, contact_number, num_guests, check_in, check_out,
         payment_method, special_requests, booking_source, airbnb_confirmation_code)
      = (SELECT c.guest_id, c.guest_name, c.email, c.contact_number, c.num_guests, c.check_in,
                c.check_out, c.payment_method, c.special_requests, c.booking_source,
                c.airbnb_confirmation_code
         FROM jsonb_populate_record(b, p_changes) c)
    WHERE b.booking_id = p_booking_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % not found', p_booking_id USING ERRCODE = 'P0002';
    END IF;

    IF p_total IS NOT NULL THEN
        PERFORM public.set_booking_total(p_booking_id, p_total);
    END IF;
END;
$$;

COMMIT;
