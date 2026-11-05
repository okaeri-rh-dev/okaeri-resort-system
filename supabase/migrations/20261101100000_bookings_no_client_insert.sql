-- Bookings are created only by the service role (the guest-booking and multi-unit
-- endpoints), so signed-in users cannot pick a payment status or total on insert.
REVOKE INSERT ON TABLE public.bookings FROM authenticated, anon;

DROP POLICY IF EXISTS bookings_insert_staff ON public.bookings;
