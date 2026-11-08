-- create_multi_unit_booking looks up or creates the booking's guest in its own
-- transaction, so a failed create leaves no new guest row (issue 379).
BEGIN;

CREATE OR REPLACE FUNCTION public.create_multi_unit_booking(p_booking_data jsonb, p_units jsonb[], p_guest_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_booking_id UUID;
    v_guest_id UUID := p_guest_id;
    v_email TEXT := NULLIF(p_booking_data->>'email', '');
    v_unit JSONB;
    v_total_amount DECIMAL(10,2) := 0;
    v_source TEXT := COALESCE(p_booking_data->>'booking_source', 'Direct');
    v_status TEXT := CASE
        WHEN v_source = 'Airbnb' THEN 'Confirmed'
        ELSE COALESCE(p_booking_data->>'booking_status', 'Pending')
    END;
BEGIN
    IF v_guest_id IS NULL AND v_email IS NOT NULL THEN
        SELECT g.guest_id INTO v_guest_id FROM public.guests g WHERE g.email = v_email LIMIT 1;
    END IF;

    IF v_guest_id IS NULL THEN
        INSERT INTO public.guests (guest_name, email, phone_number)
        VALUES (p_booking_data->>'guest_name', v_email, p_booking_data->>'contact_number')
        RETURNING guest_id INTO v_guest_id;
    END IF;

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
        v_guest_id,
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

COMMIT;
