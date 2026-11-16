-- Edit the stay: dates and cabins in one save (issue 460, docs/adr/0007).
-- 1. enforce_booking_edit_rules also guards the stay: a CheckedIn stay is manager-only
--    with the check-in day locked, a CheckedOut booking allows no stay change, and a
--    Cancelled or anonymized booking also refuses payment method, walk-in, guest count
--    and date changes.
-- 2. enforce_booking_unit_edit_rules applies the same stay rules to the cabin rows.
-- 3. cleanup_availability deletes only the removed cabin's availability row.
-- 4. split_booking_total holds the split from set_booking_total, so the stay change can
--    keep the total without the manager check.
-- 5. update_booking_stay saves the dates and replaces the cabins in one transaction.
-- Like the status rules, the rules apply only when auth.role() is 'authenticated'.
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

    IF OLD.booking_status = 'CheckedOut' AND v_dates_changed THEN
        RAISE EXCEPTION 'A checked-out booking allows no stay change' USING ERRCODE = '42501';
    END IF;

    IF OLD.booking_status = 'CheckedIn' AND v_dates_changed THEN
        IF (NEW.check_in AT TIME ZONE 'Asia/Manila')::date
               IS DISTINCT FROM (OLD.check_in AT TIME ZONE 'Asia/Manila')::date THEN
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

DROP TRIGGER IF EXISTS enforce_booking_edit_rules ON public.bookings;
CREATE TRIGGER enforce_booking_edit_rules
    BEFORE UPDATE OF guest_id, guest_name, email, contact_number, booking_source,
        airbnb_confirmation_code, special_requests, internal_notes, total_amount,
        check_in, check_out, num_guests, payment_method, is_walk_in
    ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.enforce_booking_edit_rules();

CREATE OR REPLACE FUNCTION public.enforce_booking_unit_edit_rules()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_status text;
    v_anonymized_at timestamptz;
BEGIN
    IF auth.role() IS DISTINCT FROM 'authenticated'
       OR (TG_OP = 'UPDATE'
           AND (NEW.unit_id, NEW.assigned_guests)
               IS NOT DISTINCT FROM (OLD.unit_id, OLD.assigned_guests)) THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    SELECT b.booking_status, b.anonymized_at INTO v_status, v_anonymized_at
    FROM public.bookings b
    WHERE b.booking_id = COALESCE(NEW.booking_id, OLD.booking_id);
    -- A booking delete cascades to its cabins after the booking row is gone
    IF NOT FOUND THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    IF v_anonymized_at IS NOT NULL OR v_status IN ('CheckedOut', 'Cancelled') THEN
        RAISE EXCEPTION 'A % booking allows no cabin change',
            CASE WHEN v_anonymized_at IS NOT NULL THEN 'anonymized' ELSE v_status END
            USING ERRCODE = '42501';
    END IF;

    IF v_status = 'CheckedIn' AND NOT public.is_manager_or_above() THEN
        RAISE EXCEPTION 'Only a manager can change the cabins of a checked-in booking'
            USING ERRCODE = '42501';
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS enforce_booking_unit_edit_rules ON public.booking_units;
CREATE TRIGGER enforce_booking_unit_edit_rules
    BEFORE INSERT OR DELETE OR UPDATE OF unit_id, assigned_guests ON public.booking_units
    FOR EACH ROW EXECUTE FUNCTION public.enforce_booking_unit_edit_rules();

CREATE OR REPLACE FUNCTION public.cleanup_availability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    DELETE FROM public.booking_unit_availability
    WHERE booking_id = OLD.booking_id AND unit_id = OLD.unit_id;
    RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.split_booking_total(p_booking_id uuid, p_total numeric)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    WITH cabins AS (
        SELECT
            booking_unit_id,
            subtotal,
            weekend_surcharge,
            extra_person_charge,
            -- Cabins with no price yet share the total equally.
            CASE WHEN SUM(subtotal) OVER () = 0 THEN 1 ELSE subtotal END AS weight,
            row_number() OVER (ORDER BY subtotal, booking_unit_id) AS position,
            count(*) OVER () AS cabin_count
        FROM public.booking_units
        WHERE booking_id = p_booking_id
    ),
    floored AS (
        SELECT *, floor(p_total * weight / SUM(weight) OVER () * 100) / 100 AS share
        FROM cabins
    ),
    shares AS (
        SELECT
            booking_unit_id,
            subtotal,
            weekend_surcharge,
            extra_person_charge,
            CASE WHEN position = cabin_count
                THEN p_total - (SUM(share) OVER () - share)
                ELSE share
            END AS new_subtotal
        FROM floored
    ),
    scaled AS (
        SELECT
            booking_unit_id,
            new_subtotal,
            CASE WHEN subtotal = 0 THEN 0
                ELSE floor(weekend_surcharge * new_subtotal / subtotal * 100) / 100 END AS new_weekend,
            CASE WHEN subtotal = 0 THEN 0
                ELSE floor(extra_person_charge * new_subtotal / subtotal * 100) / 100 END AS new_extra
        FROM shares
    )
    UPDATE public.booking_units bu
    SET subtotal = s.new_subtotal,
        weekend_surcharge = s.new_weekend,
        extra_person_charge = s.new_extra,
        unit_price = s.new_subtotal - s.new_weekend - s.new_extra
    FROM scaled s
    WHERE bu.booking_unit_id = s.booking_unit_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % has no cabins', p_booking_id USING ERRCODE = '22023';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.split_booking_total(uuid, numeric) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_booking_total(p_booking_id uuid, p_total numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT public.is_manager_or_above() THEN
        RAISE EXCEPTION 'Only a manager can change a booking''s total' USING ERRCODE = '42501';
    END IF;

    IF p_total IS NULL OR p_total < 0 OR p_total <> round(p_total, 2) THEN
        RAISE EXCEPTION 'The total must be zero or more, in centavos' USING ERRCODE = '22023';
    END IF;

    PERFORM 1 FROM public.bookings WHERE booking_id = p_booking_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % not found', p_booking_id USING ERRCODE = 'P0002';
    END IF;

    PERFORM public.split_booking_total(p_booking_id, p_total);

    -- payments.amount must be positive, so a zero total keeps the old amount.
    UPDATE public.payments p
    SET amount = CASE WHEN p_total > 0 THEN p_total ELSE p.amount END,
        status = CASE WHEN p_total > 0 THEN 'Active' ELSE 'Deleted' END
    WHERE p.payment_id = public.airbnb_payout_id(p_booking_id)
      AND EXISTS (
          SELECT 1 FROM public.bookings b
          WHERE b.booking_id = p_booking_id AND b.booking_source = 'Airbnb'
      );
END;
$$;

-- SECURITY DEFINER because staff may change the cabins of a Pending or Confirmed booking,
-- while booking_units writes are manager-only. The triggers above still judge the caller.
CREATE OR REPLACE FUNCTION public.update_booking_stay(
    p_booking_id uuid,
    p_check_in timestamptz,
    p_check_out timestamptz,
    p_units jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_total numeric;
BEGIN
    IF NOT public.is_staff_or_above() THEN
        RAISE EXCEPTION 'Only staff can change a stay' USING ERRCODE = '42501';
    END IF;

    IF jsonb_typeof(p_units) IS DISTINCT FROM 'array' OR jsonb_array_length(p_units) = 0 THEN
        RAISE EXCEPTION 'A booking needs at least one cabin' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_units) u
        WHERE COALESCE((u->>'assigned_guests')::integer, 0) < 1
    ) THEN
        RAISE EXCEPTION 'Each cabin needs at least one guest' USING ERRCODE = '22023';
    END IF;

    IF (SELECT count(DISTINCT u->>'unit_id') FROM jsonb_array_elements(p_units) u)
           <> jsonb_array_length(p_units) THEN
        RAISE EXCEPTION 'A cabin is listed more than once' USING ERRCODE = '22023';
    END IF;

    SELECT b.total_amount INTO v_total
    FROM public.bookings b WHERE b.booking_id = p_booking_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % not found', p_booking_id USING ERRCODE = 'P0002';
    END IF;

    -- The removed cabins' nights go first, so they cannot clash on the new dates
    DELETE FROM public.booking_unit_availability bua
    WHERE bua.booking_id = p_booking_id
      AND bua.unit_id NOT IN (SELECT (u->>'unit_id')::uuid FROM jsonb_array_elements(p_units) u);

    -- Added cabins go in before the removed ones go out, so the booking always has a cabin
    INSERT INTO public.booking_units (booking_id, unit_id, unit_price, subtotal, assigned_guests)
    SELECT p_booking_id, (u->>'unit_id')::uuid, 0, 0, (u->>'assigned_guests')::integer
    FROM jsonb_array_elements(p_units) u
    WHERE NOT EXISTS (
        SELECT 1 FROM public.booking_units bu
        WHERE bu.booking_id = p_booking_id AND bu.unit_id = (u->>'unit_id')::uuid
    );

    DELETE FROM public.booking_units bu
    WHERE bu.booking_id = p_booking_id
      AND bu.unit_id NOT IN (SELECT (u->>'unit_id')::uuid FROM jsonb_array_elements(p_units) u);

    UPDATE public.booking_units bu
    SET assigned_guests = (u->>'assigned_guests')::integer
    FROM jsonb_array_elements(p_units) u
    WHERE bu.booking_id = p_booking_id
      AND bu.unit_id = (u->>'unit_id')::uuid
      AND bu.assigned_guests IS DISTINCT FROM (u->>'assigned_guests')::integer;

    -- sync_booking_dates moves the kept cabins' availability rows
    UPDATE public.bookings
    SET check_in = p_check_in, check_out = p_check_out
    WHERE booking_id = p_booking_id
      AND (check_in, check_out) IS DISTINCT FROM (p_check_in, p_check_out);

    INSERT INTO public.booking_unit_availability (unit_id, booking_id, check_in, check_out, booking_status)
    SELECT bu.unit_id, b.booking_id, b.check_in, b.check_out, b.booking_status
    FROM public.booking_units bu
    JOIN public.bookings b ON b.booking_id = bu.booking_id
    WHERE bu.booking_id = p_booking_id
      AND NOT EXISTS (
          SELECT 1 FROM public.booking_unit_availability bua
          WHERE bua.booking_id = p_booking_id AND bua.unit_id = bu.unit_id
      );

    -- Removing a priced cabin lowers the summed total; the stay change keeps it
    IF (SELECT b.total_amount FROM public.bookings b WHERE b.booking_id = p_booking_id)
           IS DISTINCT FROM v_total THEN
        PERFORM public.split_booking_total(p_booking_id, v_total);
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_booking_stay(uuid, timestamptz, timestamptz, jsonb)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_booking_stay(uuid, timestamptz, timestamptz, jsonb)
    TO authenticated;

COMMIT;
