-- Bookings are created only by create_multi_unit_booking (SECURITY DEFINER) and the
-- guest-booking endpoint (service role), so signed-in users cannot pick a payment
-- status or total on insert. A feature that needs a client insert must re-grant it.
REVOKE INSERT ON TABLE public.bookings FROM authenticated, anon;

DROP POLICY IF EXISTS bookings_insert_staff ON public.bookings;
