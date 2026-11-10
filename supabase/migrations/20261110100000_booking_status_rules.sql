-- Booking status moves and their roles live in the database (docs/adr/0007).
-- The rules apply when auth.role(), read from the request JWT, is 'authenticated':
-- signed-in users get only the forward moves below, also inside SECURITY DEFINER
-- functions they call. Service-role requests and sessions with no JWT skip them.
BEGIN;

ALTER TABLE public.bookings
    ADD COLUMN status_changed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    ADD COLUMN status_changed_at timestamptz;

COMMENT ON COLUMN public.bookings.status_changed_by IS
    'The user who made the last status change; null for server changes.';
COMMENT ON COLUMN public.bookings.status_changed_at IS
    'When the last status change happened.';

CREATE OR REPLACE FUNCTION public.enforce_booking_status_rules()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_move text := OLD.booking_status || ' → ' || NEW.booking_status;
BEGIN
    IF NEW.booking_status IS NOT DISTINCT FROM OLD.booking_status THEN
        RETURN NEW;
    END IF;

    IF auth.role() = 'authenticated' THEN
        CASE
            WHEN v_move IN ('Pending → Confirmed', 'Pending → Cancelled', 'Confirmed → Cancelled') THEN
                IF NOT public.is_manager_or_above() THEN
                    RAISE EXCEPTION 'Only a manager can make the move %', v_move
                        USING ERRCODE = '42501';
                END IF;
            WHEN v_move = 'Confirmed → CheckedIn' THEN
                IF (now() AT TIME ZONE 'Asia/Manila')::date
                   < (NEW.check_in AT TIME ZONE 'Asia/Manila')::date THEN
                    RAISE EXCEPTION 'A booking can be checked in only from its check-in day'
                        USING ERRCODE = '42501';
                END IF;
            WHEN v_move = 'CheckedIn → CheckedOut' THEN
                NULL;
            ELSE
                RAISE EXCEPTION 'A booking cannot move %', v_move USING ERRCODE = '42501';
        END CASE;
    END IF;

    NEW.status_changed_by := auth.uid();
    NEW.status_changed_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_booking_status_rules ON public.bookings;
CREATE TRIGGER enforce_booking_status_rules
    BEFORE UPDATE OF booking_status ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.enforce_booking_status_rules();

COMMIT;
