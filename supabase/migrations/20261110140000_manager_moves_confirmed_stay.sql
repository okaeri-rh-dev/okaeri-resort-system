-- Only a manager can move the dates of a Confirmed booking (docs/adr/0007), so staff
-- cannot pull the check-in day forward and then check the guest in early.
-- Like the status rules, this applies only when auth.role() is 'authenticated'.
BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_confirmed_stay_rules()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF auth.role() = 'authenticated'
       AND OLD.booking_status = 'Confirmed'
       AND ((NEW.check_in AT TIME ZONE 'Asia/Manila')::date
                IS DISTINCT FROM (OLD.check_in AT TIME ZONE 'Asia/Manila')::date
            OR (NEW.check_out AT TIME ZONE 'Asia/Manila')::date
                IS DISTINCT FROM (OLD.check_out AT TIME ZONE 'Asia/Manila')::date)
       AND NOT public.is_manager_or_above() THEN
        RAISE EXCEPTION 'Only a manager can change the dates of a confirmed booking'
            USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_confirmed_stay_rules ON public.bookings;
CREATE TRIGGER enforce_confirmed_stay_rules
    BEFORE UPDATE OF check_in, check_out ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.enforce_confirmed_stay_rules();

COMMIT;
