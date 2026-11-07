-- Bookings keep their own guest_name copy, which the bookings and payments lists,
-- the availability timeline and the pending queue read, so a guest rename must
-- reach the guest's bookings (issue 360). Anonymized bookings stay removed.
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

DROP TRIGGER IF EXISTS sync_booking_guest_name ON public.guests;
CREATE TRIGGER sync_booking_guest_name
    AFTER UPDATE OF guest_name ON public.guests
    FOR EACH ROW
    WHEN (OLD.guest_name IS DISTINCT FROM NEW.guest_name)
    EXECUTE FUNCTION public.sync_booking_guest_name();

-- Bookings of guests renamed before this trigger existed
UPDATE public.bookings b
SET guest_name = g.guest_name
FROM public.guests g
WHERE b.guest_id = g.guest_id
  AND b.anonymized_at IS NULL
  AND b.guest_name IS DISTINCT FROM g.guest_name;
