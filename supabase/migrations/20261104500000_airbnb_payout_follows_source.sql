-- An Airbnb booking's automatic "Airbnb payout" payment follows a change of source:
-- to Airbnb creates or reactivates it at the total, from Airbnb soft-deletes it
-- (docs/adr/0006). The payments trigger re-derives payment_status (ADR 0001).
BEGIN;

-- The payout a booking's automatic payment lives in: the active one first, then the
-- oldest. Refunded payouts are never touched.
CREATE OR REPLACE FUNCTION public.airbnb_payout_id(p_booking_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    SELECT payment_id
    FROM public.payments
    WHERE booking_id = p_booking_id
      AND payment_method = 'Airbnb payout'
      AND status <> 'Refunded'
    ORDER BY status = 'Active' DESC, created_at, payment_id
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.airbnb_payout_id(uuid) FROM PUBLIC, anon, authenticated;

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

CREATE OR REPLACE FUNCTION public.airbnb_payout_follows_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_payout_id uuid;
BEGIN
    IF NEW.booking_source = 'Airbnb' THEN
        -- payments.amount must be positive, so a zero total gets no payout.
        IF NEW.total_amount <= 0 THEN
            RETURN NULL;
        END IF;

        v_payout_id := public.airbnb_payout_id(NEW.booking_id);
        IF v_payout_id IS NULL THEN
            INSERT INTO public.payments (booking_id, amount, payment_method)
            VALUES (NEW.booking_id, NEW.total_amount, 'Airbnb payout');
        ELSE
            UPDATE public.payments
            SET amount = NEW.total_amount, status = 'Active', payment_date = now()
            WHERE payment_id = v_payout_id;
        END IF;
    ELSIF OLD.booking_source = 'Airbnb' THEN
        UPDATE public.payments
        SET status = 'Deleted'
        WHERE booking_id = NEW.booking_id
          AND payment_method = 'Airbnb payout'
          AND status = 'Active';
    END IF;

    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.airbnb_payout_follows_source() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS airbnb_payout_follows_source ON public.bookings;
CREATE TRIGGER airbnb_payout_follows_source
    AFTER UPDATE OF booking_source ON public.bookings
    FOR EACH ROW
    WHEN (OLD.booking_source IS DISTINCT FROM NEW.booking_source)
    EXECUTE FUNCTION public.airbnb_payout_follows_source();

COMMIT;
