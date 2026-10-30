-- No duplicate writes (TASK-7).
-- 1. One active online-booking downpayment per booking: two verifies at the same
--    time made the status trigger sum both rows. verify-payment maps 23505 to 409.
-- 2. create_guest_booking claims the idempotency key before it inserts the booking,
--    so a double submit waits for the first and returns its booking. The key's FK
--    is deferred because the key row now comes before its booking row.

BEGIN;

CREATE UNIQUE INDEX payments_one_online_downpayment
    ON public.payments (booking_id)
    WHERE status = 'Active' AND notes = 'Online booking downpayment';

ALTER TABLE public.idempotency_keys
    ALTER CONSTRAINT idempotency_keys_booking_id_fkey DEFERRABLE INITIALLY DEFERRED;

CREATE OR REPLACE FUNCTION public.create_guest_booking(
    p_turnstile_token text,
    p_booking_data jsonb,
    p_unit_requests jsonb,
    p_guest_data jsonb DEFAULT NULL::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
    v_email TEXT := lower(p_booking_data->>'email');
    v_check_in TIMESTAMPTZ := (p_booking_data->>'check_in')::TIMESTAMPTZ;
    v_check_out TIMESTAMPTZ := (p_booking_data->>'check_out')::TIMESTAMPTZ;
    v_first_night DATE;
    v_last_night DATE;
    v_unit_count INTEGER;
    v_guest_id UUID;
    v_booking_id UUID := gen_random_uuid();
    v_booking_reference TEXT;
BEGIN
    IF jsonb_typeof(p_unit_requests) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'unit_requests must be an array';
    END IF;

    v_unit_count := jsonb_array_length(p_unit_requests);
    IF v_unit_count NOT BETWEEN 1 AND 10 THEN
        RAISE EXCEPTION 'Book between 1 and 10 cabins';
    END IF;

    -- A live key held by another submit returns that booking; an expired key is reclaimed.
    IF p_booking_data ? 'idempotency_key' THEN
        INSERT INTO public.idempotency_keys (key, booking_id)
        VALUES ((p_booking_data->>'idempotency_key')::UUID, v_booking_id)
        ON CONFLICT (key) DO UPDATE
        SET booking_id = EXCLUDED.booking_id, created_at = now(), expires_at = now() + INTERVAL '48 hours'
        WHERE public.idempotency_keys.expires_at <= now()
        RETURNING booking_id INTO v_booking_id;

        IF v_booking_id IS NULL THEN
            SELECT b.booking_id, b.booking_reference INTO v_booking_id, v_booking_reference
            FROM public.idempotency_keys k
            JOIN public.bookings b ON b.booking_id = k.booking_id
            WHERE k.key = (p_booking_data->>'idempotency_key')::UUID;

            RETURN jsonb_build_object(
                'success', true,
                'is_duplicate', true,
                'booking', jsonb_build_object('booking_id', v_booking_id, 'booking_reference', v_booking_reference)
            );
        END IF;
    END IF;

    v_first_night := (v_check_in AT TIME ZONE 'Asia/Manila')::date;
    v_last_night := GREATEST(v_first_night, (v_check_out AT TIME ZONE 'Asia/Manila')::date - 1);

    PERFORM public.lock_block_units(NULL);

    IF EXISTS (
        SELECT 1
        FROM generate_series(v_first_night, v_last_night, INTERVAL '1 day') AS night
        WHERE (
            SELECT count(*)
            FROM public.units u
            WHERE NOT public.is_unit_blocked(u.unit_id, night::date, night::date)
        ) < v_unit_count
    ) THEN
        RAISE EXCEPTION 'Not enough cabins are free on one or more of these nights'
            USING ERRCODE = 'BLOCK';
    END IF;

    INSERT INTO public.guests (guest_name, email, phone_number)
    VALUES (p_booking_data->>'guest_name', v_email, p_booking_data->>'phone_number')
    ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
    RETURNING guest_id INTO v_guest_id;

    INSERT INTO public.bookings (
        booking_id, booking_reference, guest_id, guest_name, contact_number, email,
        check_in, check_out, num_guests, special_requests,
        total_amount, downpayment_required, discount_percent, discount_amount, pricing_snapshot,
        payment_proof_url, booking_status,
        is_guest_booking, is_multi_unit, unit_count, requested_unit_count, unit_assignment_status
    ) VALUES (
        v_booking_id,
        p_booking_data->>'booking_reference',
        v_guest_id,
        p_booking_data->>'guest_name',
        p_booking_data->>'phone_number',
        v_email,
        v_check_in,
        v_check_out,
        (SELECT SUM((request->>'guests_per_unit')::INTEGER) FROM jsonb_array_elements(p_unit_requests) AS request),
        p_booking_data->>'special_requests',
        (p_booking_data->>'total_amount')::NUMERIC,
        (p_booking_data->>'downpayment_required')::NUMERIC,
        (p_booking_data->>'discount_percent')::NUMERIC,
        (p_booking_data->>'discount_amount')::NUMERIC,
        p_booking_data->'pricing_snapshot',
        p_booking_data->>'payment_proof_url',
        'Pending',
        TRUE,
        v_unit_count > 1,
        v_unit_count,
        v_unit_count,
        'pending'
    ) RETURNING booking_reference INTO v_booking_reference;

    INSERT INTO public.guest_booking_unit_requests (booking_id, guests_per_unit)
    SELECT v_booking_id, (request->>'guests_per_unit')::INTEGER
    FROM jsonb_array_elements(p_unit_requests) AS request;

    RETURN jsonb_build_object(
        'success', true,
        'booking', jsonb_build_object('booking_id', v_booking_id, 'booking_reference', v_booking_reference)
    );
END;
$function$;

COMMIT;
