-- What a booking's status allows to change (docs/adr/0007, issue 459): Pending to
-- CheckedOut allow guest details and notes, a Cancelled booking only its internal
-- note, and an anonymized booking nothing. The total stays manager-only through
-- set_booking_total. Like the status rules, this applies only when auth.role() is
-- 'authenticated'.
BEGIN;

GRANT UPDATE (internal_notes) ON TABLE public.bookings TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_booking_edit_rules()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_guest_changed boolean :=
        (NEW.email, NEW.contact_number, NEW.booking_source, NEW.airbnb_confirmation_code)
            IS DISTINCT FROM
        (OLD.email, OLD.contact_number, OLD.booking_source, OLD.airbnb_confirmation_code)
        -- sync_booking_guest_name copies a guest rename to every booking of the guest
        OR (NEW.guest_name IS DISTINCT FROM OLD.guest_name
            AND NEW.guest_name IS DISTINCT FROM
                (SELECT g.guest_name FROM public.guests g WHERE g.guest_id = NEW.guest_id));
    v_request_changed boolean := NEW.special_requests IS DISTINCT FROM OLD.special_requests;
    v_internal_changed boolean := NEW.internal_notes IS DISTINCT FROM OLD.internal_notes;
    v_total_changed boolean := NEW.total_amount IS DISTINCT FROM OLD.total_amount;
BEGIN
    IF auth.role() IS DISTINCT FROM 'authenticated' THEN
        RETURN NEW;
    END IF;

    IF OLD.anonymized_at IS NOT NULL
       AND (v_guest_changed OR v_request_changed OR v_internal_changed OR v_total_changed) THEN
        RAISE EXCEPTION 'An anonymized booking cannot be edited' USING ERRCODE = '42501';
    END IF;

    IF OLD.booking_status = 'Cancelled'
       AND (v_guest_changed OR v_request_changed OR v_total_changed) THEN
        RAISE EXCEPTION 'A cancelled booking allows only its internal note to change'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_booking_edit_rules ON public.bookings;
CREATE TRIGGER enforce_booking_edit_rules
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.enforce_booking_edit_rules();

-- The Notes sheet saves the internal note through the same path as the other edits
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
         payment_method, special_requests, internal_notes, booking_source,
         airbnb_confirmation_code)
      = (SELECT c.guest_id, c.guest_name, c.email, c.contact_number, c.num_guests, c.check_in,
                c.check_out, c.payment_method, c.special_requests, c.internal_notes,
                c.booking_source, c.airbnb_confirmation_code
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
