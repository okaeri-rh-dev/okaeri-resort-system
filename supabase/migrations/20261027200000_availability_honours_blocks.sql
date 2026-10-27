-- Availability reads honour blocks (#170).
--
-- Every availability check sees blocks before submit, and none reads units.unit_status.
-- Booking nights run from the Manila check-in day up to, not including, the check-out
-- day (ADR 0002). A block covers start_date to end_date, both inclusive.

BEGIN;

-- ============================================================================
-- Admin availability check (booking form, booking edit, create Worker pre-check)
-- ============================================================================

-- The result gains a reason column, so the function is dropped and created again.
DROP FUNCTION IF EXISTS public.check_multi_unit_availability(uuid[], timestamptz, timestamptz, uuid);

-- SECURITY DEFINER: callers cannot read blocks, and only flags come back, never a reason text.
CREATE FUNCTION public.check_multi_unit_availability(
    p_unit_ids uuid[],
    p_check_in timestamptz,
    p_check_out timestamptz,
    p_exclude_booking_id uuid DEFAULT NULL
)
RETURNS TABLE (
    unit_id uuid,
    is_available boolean,
    reason text,
    conflicting_bookings integer,
    next_available_date timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    WITH nights AS (
        SELECT
            (p_check_in AT TIME ZONE 'Asia/Manila')::date AS first_night,
            GREATEST(
                (p_check_in AT TIME ZONE 'Asia/Manila')::date,
                (p_check_out AT TIME ZONE 'Asia/Manila')::date - 1
            ) AS last_night
    ),
    checked AS (
        SELECT
            u.unit_id,
            public.is_unit_blocked(u.unit_id, n.first_night, n.last_night) AS is_blocked,
            count(bua.availability_id)::integer AS bookings,
            max(bua.check_out) AS booked_until
        FROM public.units u
        CROSS JOIN nights n
        LEFT JOIN public.booking_unit_availability bua
          ON bua.unit_id = u.unit_id
         AND bua.booking_status IN ('Confirmed', 'CheckedIn')
         AND tstzrange(bua.check_in, bua.check_out, '[)') && tstzrange(p_check_in, p_check_out, '[)')
         AND (p_exclude_booking_id IS NULL OR bua.booking_id <> p_exclude_booking_id)
        WHERE u.unit_id = ANY (p_unit_ids)
        GROUP BY u.unit_id, n.first_night, n.last_night
    )
    SELECT
        c.unit_id,
        NOT c.is_blocked AND c.bookings = 0,
        CASE WHEN c.is_blocked THEN 'Blocked' WHEN c.bookings > 0 THEN 'Booked' END,
        c.bookings,
        c.booked_until
    FROM checked c;
$$;

COMMENT ON FUNCTION public.check_multi_unit_availability(uuid[], timestamptz, timestamptz, uuid) IS
    'Per unit: free, or unavailable with reason Blocked (a block or resort closure on a night) or Booked (a Confirmed or CheckedIn stay overlaps).';

REVOKE ALL ON FUNCTION public.check_multi_unit_availability(uuid[], timestamptz, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_multi_unit_availability(uuid[], timestamptz, timestamptz, uuid)
    TO anon, authenticated, service_role;

-- ============================================================================
-- Guest calendar counts
-- ============================================================================

-- Per night: units that are neither booked nor blocked. A resort closure blocks every
-- unit, so the night gives 0. total_units lets the public endpoint drop its fixed count.
-- Guests never see a block reason.
DROP FUNCTION IF EXISTS public.get_public_aggregate_availability(date, date);

CREATE FUNCTION public.get_public_aggregate_availability(p_start_date date, p_end_date date)
RETURNS TABLE (date date, available_count integer, total_units integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_today date := CURRENT_DATE;
BEGIN
    IF p_start_date IS NULL OR p_end_date IS NULL THEN
        RAISE EXCEPTION 'Start and end dates are required';
    END IF;

    IF p_end_date < p_start_date THEN
        RAISE EXCEPTION 'End date must be after or equal to start date';
    END IF;

    IF p_end_date < v_today THEN
        RAISE EXCEPTION 'Cannot query past months. Please select the current month or a future month.';
    END IF;

    IF p_end_date > v_today + INTERVAL '1 year' THEN
        RAISE EXCEPTION 'Cannot query more than 1 year in the future';
    END IF;

    IF (p_end_date - p_start_date) > 180 THEN
        RAISE EXCEPTION 'Date range cannot exceed 180 days';
    END IF;

    RETURN QUERY
    SELECT
        night.date,
        count(u.unit_id) FILTER (
            WHERE NOT EXISTS (
                SELECT 1
                FROM public.availability_blackouts b
                WHERE (b.unit_id = u.unit_id OR b.unit_id IS NULL)
                  AND night.date BETWEEN b.start_date AND b.end_date
            )
            AND NOT EXISTS (
                SELECT 1
                FROM public.booking_unit_availability bua
                WHERE bua.unit_id = u.unit_id
                  AND bua.booking_status IN ('Confirmed', 'CheckedIn', 'Hold')
                  AND night.date >= (bua.check_in AT TIME ZONE 'Asia/Manila')::date
                  AND night.date < (bua.check_out AT TIME ZONE 'Asia/Manila')::date
            )
        )::integer,
        count(u.unit_id)::integer
    FROM generate_series(p_start_date, p_end_date, INTERVAL '1 day') AS night_start
    CROSS JOIN LATERAL (SELECT night_start::date AS date) night
    LEFT JOIN public.units u ON true
    GROUP BY night.date
    ORDER BY night.date;
END;
$$;

COMMENT ON FUNCTION public.get_public_aggregate_availability(date, date) IS
    'Guest calendar: per night, units neither booked nor blocked (0 on a resort closure), and the total unit count.';

REVOKE ALL ON FUNCTION public.get_public_aggregate_availability(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_aggregate_availability(date, date)
    TO anon, authenticated, service_role;

-- ============================================================================
-- Guest request step
-- ============================================================================

-- Refuses when any night has fewer unblocked units than requested. The test is
-- unblocked capacity, not bookings: staff assign cabins later. It takes every unit
-- lock first, like a resort closure does, so a closure and a request on the same
-- night cannot both commit.
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
    v_booking_id UUID;
    v_booking_reference TEXT;
BEGIN
    IF jsonb_typeof(p_unit_requests) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'unit_requests must be an array';
    END IF;

    v_unit_count := jsonb_array_length(p_unit_requests);
    IF v_unit_count NOT BETWEEN 1 AND 10 THEN
        RAISE EXCEPTION 'Book between 1 and 10 cabins';
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
        booking_reference, guest_id, guest_name, contact_number, email,
        check_in, check_out, num_guests, special_requests,
        total_amount, downpayment_required, discount_percent, discount_amount, pricing_snapshot,
        payment_proof_url, booking_status,
        is_guest_booking, is_multi_unit, unit_count, requested_unit_count, unit_assignment_status
    ) VALUES (
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
    ) RETURNING booking_id, booking_reference INTO v_booking_id, v_booking_reference;

    INSERT INTO public.guest_booking_unit_requests (booking_id, guests_per_unit)
    SELECT v_booking_id, (request->>'guests_per_unit')::INTEGER
    FROM jsonb_array_elements(p_unit_requests) AS request;

    IF p_booking_data ? 'idempotency_key' THEN
        INSERT INTO public.idempotency_keys (key, booking_id)
        VALUES ((p_booking_data->>'idempotency_key')::UUID, v_booking_id)
        ON CONFLICT (key) DO UPDATE
        SET booking_id = EXCLUDED.booking_id, created_at = now(), expires_at = now() + INTERVAL '48 hours';
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'booking', jsonb_build_object('booking_id', v_booking_id, 'booking_reference', v_booking_reference)
    );
END;
$function$;

COMMIT;
