-- supabase/migrations/20261013000000_online_booking.sql
-- Online booking: a guest requests cabins, staff verify the downpayment, then assign cabins
-- (docs/plans/2026-10-12-online-booking-restore.md). Idempotent: local has most of these
-- objects from 20251028154441 / 20251104184719, prod has none of them.
-- 1. bookings: unit_assignment_status, requested_unit_count, downpayment_required, discount_percent.
-- 2. guest_booking_unit_requests: one row per requested cabin, staff-readable, audited.
-- 3. create_guest_booking: stores the requests, pricing, proof and idempotency key;
--    executable by service_role only (the Worker).
-- 4. assign_units_to_booking: writes booking_units and availability after the downpayment.
-- 5. Drops the unfinished objects nothing calls.

BEGIN;

-- 1. bookings columns (NULL for staff-made bookings)
ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS unit_assignment_status VARCHAR(20),
    ADD COLUMN IF NOT EXISTS requested_unit_count INTEGER,
    ADD COLUMN IF NOT EXISTS downpayment_required NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2);

ALTER TABLE public.bookings
    ALTER COLUMN unit_assignment_status DROP DEFAULT,
    ALTER COLUMN requested_unit_count DROP DEFAULT;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_unit_assignment_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_unit_assignment_status_check
    CHECK (unit_assignment_status IN ('pending', 'assigned'));

-- 2. guest_booking_unit_requests
CREATE TABLE IF NOT EXISTS public.guest_booking_unit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(booking_id) ON DELETE CASCADE,
    guests_per_unit INTEGER NOT NULL CHECK (guests_per_unit > 0),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.guest_booking_unit_requests
    DROP COLUMN IF EXISTS unit_type,
    DROP COLUMN IF EXISTS quantity,
    DROP COLUMN IF EXISTS special_requests;

DROP INDEX IF EXISTS public.idx_guest_booking_requests_booking;
CREATE INDEX IF NOT EXISTS idx_guest_booking_unit_requests_booking_id
    ON public.guest_booking_unit_requests (booking_id);

ALTER TABLE public.guest_booking_unit_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS authenticated_users_read_unit_requests ON public.guest_booking_unit_requests;
DROP POLICY IF EXISTS guest_booking_requests_insert_policy ON public.guest_booking_unit_requests;
DROP POLICY IF EXISTS guest_booking_requests_select_policy ON public.guest_booking_unit_requests;
DROP POLICY IF EXISTS guest_booking_unit_requests_select_staff ON public.guest_booking_unit_requests;
CREATE POLICY guest_booking_unit_requests_select_staff ON public.guest_booking_unit_requests
    FOR SELECT TO authenticated USING (public.is_staff_or_above());

DROP TRIGGER IF EXISTS audit_guest_booking_unit_requests_trigger ON public.guest_booking_unit_requests;
CREATE TRIGGER audit_guest_booking_unit_requests_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.guest_booking_unit_requests
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- 3. create_guest_booking. The Worker verifies the Turnstile token; p_turnstile_token and
-- p_guest_data stay only so the caller's signature does not change.
CREATE OR REPLACE FUNCTION public.create_guest_booking(
    p_turnstile_token TEXT,
    p_booking_data JSONB,
    p_unit_requests JSONB,
    p_guest_data JSONB DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_email TEXT := lower(p_booking_data->>'email');
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
        (p_booking_data->>'check_in')::TIMESTAMPTZ,
        (p_booking_data->>'check_out')::TIMESTAMPTZ,
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
$$ LANGUAGE plpgsql SET search_path = '';

REVOKE ALL ON FUNCTION public.create_guest_booking(TEXT, JSONB, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_guest_booking(TEXT, JSONB, JSONB, JSONB) TO service_role;

-- 4. assign_units_to_booking. Each cabin takes the price the guest was quoted for the
-- request in the same position (pricing_snapshot.unit_breakdown). booking_units triggers
-- recompute total_amount and num_guests from these rows, so the sums must match the quote.
-- Availability rows are written as Confirmed so the exclusion constraint rejects a taken cabin.
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS payment_before_assignment;

CREATE OR REPLACE FUNCTION public.assign_units_to_booking(p_booking_id UUID, p_unit_ids UUID[])
RETURNS VOID AS $$
DECLARE
    v_booking public.bookings%ROWTYPE;
    v_unit_count INTEGER := COALESCE(array_length(p_unit_ids, 1), 0);
    v_quote JSONB;
    v_subtotal NUMERIC(10,2);
    v_extra NUMERIC(10,2);
BEGIN
    SELECT * INTO v_booking
    FROM public.bookings
    WHERE booking_id = p_booking_id
      AND is_guest_booking
      AND unit_assignment_status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % not found or not in pending state', p_booking_id;
    END IF;

    IF v_booking.payment_status NOT IN ('Partial', 'Completed') THEN
        RAISE EXCEPTION 'Payment must be verified before unit assignment (payment status: %)',
            v_booking.payment_status;
    END IF;

    IF v_unit_count <> v_booking.requested_unit_count THEN
        RAISE EXCEPTION 'Must assign exactly % cabins, got %', v_booking.requested_unit_count, v_unit_count;
    END IF;

    FOR v_position IN 1..v_unit_count LOOP
        v_quote := v_booking.pricing_snapshot->'unit_breakdown'->(v_position - 1);
        IF v_quote IS NULL THEN
            RAISE EXCEPTION 'Booking % has no quoted price for cabin %', p_booking_id, v_position;
        END IF;
        v_subtotal := round((v_quote->>'total')::NUMERIC, 2);
        v_extra := round((v_quote->>'extra_person_fees')::NUMERIC, 2);

        INSERT INTO public.booking_units (
            booking_id, unit_id, unit_price, extra_person_charge, subtotal, assigned_guests
        ) VALUES (
            p_booking_id, p_unit_ids[v_position], v_subtotal - v_extra, v_extra, v_subtotal,
            (v_quote->>'guests')::INTEGER
        );

        INSERT INTO public.booking_unit_availability (
            unit_id, booking_id, check_in, check_out, booking_status
        ) VALUES (
            p_unit_ids[v_position], p_booking_id, v_booking.check_in, v_booking.check_out, 'Confirmed'
        );
    END LOOP;

    UPDATE public.bookings
    SET unit_assignment_status = 'assigned', booking_status = 'Confirmed'
    WHERE booking_id = p_booking_id;
END;
$$ LANGUAGE plpgsql SET search_path = '';

REVOKE ALL ON FUNCTION public.assign_units_to_booking(UUID, UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_units_to_booking(UUID, UUID[]) TO service_role;

-- 5. Unfinished objects nothing calls (local only; prod never had them)
DROP FUNCTION IF EXISTS public.create_guest_booking(JSONB, JSONB, JSONB, UUID);
DROP FUNCTION IF EXISTS public.calculate_booking_pricing(JSONB, DATE, DATE);
DROP FUNCTION IF EXISTS public.check_units_available_for_booking(UUID, UUID[]);

-- Let any signed-in user add booking_units to any booking; booking_units_insert_staff covers staff.
DROP POLICY IF EXISTS authenticated_users_insert_booking_units ON public.booking_units;

-- Always NULL; booking_unit_availability is the overlap guard (20261011120000).
DROP INDEX IF EXISTS public.idx_booking_units_dates_status;
ALTER TABLE public.booking_units
    DROP COLUMN IF EXISTS check_in_date,
    DROP COLUMN IF EXISTS check_out_date,
    DROP COLUMN IF EXISTS status;

DROP INDEX IF EXISTS public.idx_bookings_assignment_pending;
DROP INDEX IF EXISTS public.idx_bookings_assignment_status;
DROP INDEX IF EXISTS public.idx_bookings_multi_unit;

COMMIT;
