-- Signed-in users update only the booking columns the app edits (updateBooking,
-- setBookingStatus). Payment status, totals and the price snapshot change only
-- through the service role and SECURITY DEFINER functions/triggers.
REVOKE UPDATE ON TABLE public.bookings FROM authenticated, anon;

GRANT UPDATE (
  guest_id,
  guest_name,
  email,
  contact_number,
  num_guests,
  check_in,
  check_out,
  payment_method,
  special_requests,
  is_walk_in,
  booking_status
) ON TABLE public.bookings TO authenticated;

-- Fires on booking_units writes, including the cascade of a booking delete.
ALTER FUNCTION public.update_booking_totals() SECURITY DEFINER;
