-- Hard delete of a booking is admin only (guardrails follow-up (a), 2026-10-21).
-- Cancel keeps the history for everyone else. bookings_delete_staff was staff+
-- for a client-side rollback DELETE in the create path that no longer exists;
-- the multi-unit and guest-booking create paths use the service-role client,
-- which bypasses RLS.

drop policy if exists "bookings_delete_staff" on public.bookings;

create policy "bookings_delete_admin" on public.bookings
    for delete to authenticated using (public.is_admin());
