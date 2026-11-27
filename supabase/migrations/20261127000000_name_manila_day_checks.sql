-- Name the Manila-day comparisons in enforce_booking_edit_rules (issue 480).
-- No rule, error code or message changes.
BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_booking_edit_rules()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_guest_changed boolean;
    v_note_changed boolean := NEW.special_requests IS DISTINCT FROM OLD.special_requests;
    v_internal_changed boolean := NEW.internal_notes IS DISTINCT FROM OLD.internal_notes;
    v_total_changed boolean := NEW.total_amount IS DISTINCT FROM OLD.total_amount;
    v_dates_changed boolean :=
        (NEW.check_in, NEW.check_out) IS DISTINCT FROM (OLD.check_in, OLD.check_out);
    v_check_in_day_changed boolean :=
        (NEW.check_in AT TIME ZONE 'Asia/Manila')::date
            IS DISTINCT FROM (OLD.check_in AT TIME ZONE 'Asia/Manila')::date;
    v_stay_days_changed boolean := v_check_in_day_changed
        OR (NEW.check_out AT TIME ZONE 'Asia/Manila')::date
            IS DISTINCT FROM (OLD.check_out AT TIME ZONE 'Asia/Manila')::date;
    v_booking_changed boolean :=
        (NEW.payment_method, NEW.is_walk_in, NEW.num_guests)
            IS DISTINCT FROM (OLD.payment_method, OLD.is_walk_in, OLD.num_guests);
BEGIN
    IF auth.role() IS DISTINCT FROM 'authenticated' THEN
        RETURN NEW;
    END IF;

    v_guest_changed :=
        (NEW.guest_id, NEW.email, NEW.contact_number, NEW.booking_source,
         NEW.airbnb_confirmation_code)
            IS DISTINCT FROM
        (OLD.guest_id, OLD.email, OLD.contact_number, OLD.booking_source,
         OLD.airbnb_confirmation_code)
        -- sync_booking_guest_name copies a rename of the booking's own guest
        OR (NEW.guest_name IS DISTINCT FROM OLD.guest_name
            AND NEW.guest_name IS DISTINCT FROM
                (SELECT g.guest_name FROM public.guests g WHERE g.guest_id = OLD.guest_id));

    IF OLD.anonymized_at IS NOT NULL
       AND (v_guest_changed OR v_note_changed OR v_internal_changed OR v_total_changed
            OR v_dates_changed OR v_booking_changed) THEN
        RAISE EXCEPTION 'An anonymized booking cannot be edited' USING ERRCODE = '42501';
    END IF;

    IF OLD.booking_status = 'Cancelled'
       AND (v_guest_changed OR v_note_changed OR v_total_changed
            OR v_dates_changed OR v_booking_changed) THEN
        RAISE EXCEPTION 'A cancelled booking allows only its internal note to change'
            USING ERRCODE = '42501';
    END IF;

    -- Staff cannot pull the check-in day forward and then check the guest in early
    IF OLD.booking_status = 'Confirmed'
       AND v_stay_days_changed
       AND NOT public.is_manager_or_above() THEN
        RAISE EXCEPTION 'Only a manager can change the dates of a confirmed booking'
            USING ERRCODE = '42501';
    END IF;

    IF OLD.booking_status = 'CheckedOut' AND v_dates_changed THEN
        RAISE EXCEPTION 'A checked-out booking allows no stay change' USING ERRCODE = '42501';
    END IF;

    IF OLD.booking_status = 'CheckedIn' AND v_dates_changed THEN
        IF v_check_in_day_changed THEN
            RAISE EXCEPTION 'The check-in day of a checked-in booking cannot change'
                USING ERRCODE = '42501';
        END IF;
        IF NOT public.is_manager_or_above() THEN
            RAISE EXCEPTION 'Only a manager can change the stay of a checked-in booking'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

COMMIT;
