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

COMMIT;
