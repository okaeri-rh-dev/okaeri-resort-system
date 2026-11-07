-- The bookings and payments lists read bookings.guest_name, so a guest rename
-- must reach the guest's bookings (issue 360). Anonymized bookings stay removed.
CREATE OR REPLACE FUNCTION public.sync_booking_guest_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.bookings
    SET guest_name = NEW.guest_name
    WHERE guest_id = NEW.guest_id
      AND anonymized_at IS NULL
      AND guest_name IS DISTINCT FROM NEW.guest_name;
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_booking_guest_name() FROM public, anon, authenticated;

CREATE TRIGGER sync_booking_guest_name
    AFTER UPDATE OF guest_name ON public.guests
    FOR EACH ROW
    WHEN (OLD.guest_name IS DISTINCT FROM NEW.guest_name)
    EXECUTE FUNCTION public.sync_booking_guest_name();
