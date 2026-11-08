-- A new email on a booking edit links or creates its guest inside update_booking,
-- so a failed edit leaves no new guest row (issue 314).
BEGIN;

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
DECLARE
    v_email text := NULLIF(p_changes->>'email', '');
    v_guest_id uuid;
BEGIN
    IF v_email IS NOT NULL THEN
        SELECT g.guest_id INTO v_guest_id FROM public.guests g WHERE g.email = v_email LIMIT 1;

        IF v_guest_id IS NULL THEN
            INSERT INTO public.guests (guest_name, email, phone_number)
            VALUES (COALESCE(p_changes->>'guest_name', v_email), v_email, p_changes->>'contact_number')
            RETURNING guest_id INTO v_guest_id;
        END IF;

        p_changes := p_changes || jsonb_build_object('guest_id', v_guest_id);
    END IF;

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
