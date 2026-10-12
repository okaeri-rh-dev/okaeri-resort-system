-- ============================================
-- ROLLBACK for 20261013000000_online_booking.sql
-- ============================================
-- Returns prod's schema to its state before the migration (prod had none of these objects).
-- Drops guest_booking_unit_requests and the four bookings columns, with their data. It does
-- NOT delete guest bookings: their bookings rows, assigned booking_units, availability rows
-- and idempotency_keys stay as ordinary bookings. Before running it, export
-- guest_booking_unit_requests and the four columns, and cancel or delete any guest booking
-- that should not survive. payment_before_assignment is not restored (prod never had it).
-- Local: use `supabase db reset` instead.
-- ============================================

BEGIN;

DROP FUNCTION IF EXISTS public.assign_units_to_booking(UUID, UUID[]);
DROP FUNCTION IF EXISTS public.create_guest_booking(TEXT, JSONB, JSONB, JSONB);
DROP TABLE IF EXISTS public.guest_booking_unit_requests;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_unit_assignment_status_check;
ALTER TABLE public.bookings
    DROP COLUMN IF EXISTS unit_assignment_status,
    DROP COLUMN IF EXISTS requested_unit_count,
    DROP COLUMN IF EXISTS downpayment_required,
    DROP COLUMN IF EXISTS discount_percent;

COMMIT;
