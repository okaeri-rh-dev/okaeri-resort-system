-- Recompute guest totals once. Before 20261102000000 a staff cancel or
-- check-out, or a booking moved to another guest, left them stale.
-- Only changed rows are written, so the audit log gets no no-op entries.

UPDATE public.guests g
SET
    total_bookings = counted.total_bookings,
    total_spent = counted.total_spent,
    updated_at = NOW()
FROM (
    SELECT
        guests.guest_id,
        COUNT(b.booking_id) FILTER (WHERE b.booking_status NOT IN ('Cancelled', 'NoShow')) AS total_bookings,
        COALESCE(SUM(b.total_amount) FILTER (WHERE b.booking_status NOT IN ('Cancelled', 'NoShow')), 0) AS total_spent
    FROM public.guests
    LEFT JOIN public.bookings b ON b.guest_id = guests.guest_id
    GROUP BY guests.guest_id
) counted
WHERE g.guest_id = counted.guest_id
  AND (g.total_bookings, g.total_spent) IS DISTINCT FROM (counted.total_bookings, counted.total_spent);
