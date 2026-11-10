-- Undo check-in (CheckedIn → Confirmed) and undo check-out (CheckedOut → CheckedIn):
-- the user who made the change within 2 minutes, or a manager at any time (docs/adr/0007).
-- Undo check-out needs no overlap check here: the status cascade into
-- booking_unit_availability hits its exclusion constraint and the block trigger.
BEGIN;

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
                   < (OLD.check_in AT TIME ZONE 'Asia/Manila')::date THEN
                    RAISE EXCEPTION 'A booking can be checked in only from its check-in day'
                        USING ERRCODE = '42501';
                END IF;
            WHEN v_move = 'CheckedIn → CheckedOut' THEN
                NULL;
            WHEN v_move IN ('CheckedIn → Confirmed', 'CheckedOut → CheckedIn') THEN
                IF NOT (
                    public.is_manager_or_above()
                    OR (OLD.status_changed_by = auth.uid()
                        AND OLD.status_changed_at > now() - interval '2 minutes')
                ) THEN
                    RAISE EXCEPTION 'Only the person who made the change can undo it, within 2 minutes; after that ask a manager'
                        USING ERRCODE = '42501';
                END IF;
            ELSE
                RAISE EXCEPTION 'A booking cannot move %', v_move USING ERRCODE = '42501';
        END CASE;
    END IF;

    NEW.status_changed_by := auth.uid();
    NEW.status_changed_at := now();
    RETURN NEW;
END;
$$;

COMMIT;
