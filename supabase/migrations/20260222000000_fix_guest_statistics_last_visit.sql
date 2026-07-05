-- Fix: Remove `last_visit` reference from update_guest_statistics()
--
-- The security hardening migration (20260209120000) overwrote this trigger
-- function to set a `last_visit` column that was never added to the `guests`
-- table, causing error 42703 on every booking INSERT/UPDATE/DELETE.
--
-- This restores proper DELETE handling and NULL guest_id guards from the
-- original function while keeping the security hardening improvements
-- (SET search_path, NoShow exclusion).

CREATE OR REPLACE FUNCTION public.update_guest_statistics()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        -- Update statistics for the deleted booking's guest
        IF OLD.guest_id IS NOT NULL THEN
            UPDATE public.guests
            SET
                total_bookings = (
                    SELECT COUNT(*) FROM public.bookings
                    WHERE guest_id = OLD.guest_id
                      AND booking_status NOT IN ('Cancelled', 'NoShow')
                ),
                total_spent = (
                    SELECT COALESCE(SUM(total_amount), 0) FROM public.bookings
                    WHERE guest_id = OLD.guest_id
                      AND booking_status NOT IN ('Cancelled', 'NoShow')
                ),
                updated_at = NOW()
            WHERE guest_id = OLD.guest_id;
        END IF;
        RETURN OLD;
    ELSE
        -- Handle INSERT or UPDATE
        IF NEW.guest_id IS NOT NULL THEN
            UPDATE public.guests
            SET
                total_bookings = (
                    SELECT COUNT(*) FROM public.bookings
                    WHERE guest_id = NEW.guest_id
                      AND booking_status NOT IN ('Cancelled', 'NoShow')
                ),
                total_spent = (
                    SELECT COALESCE(SUM(total_amount), 0) FROM public.bookings
                    WHERE guest_id = NEW.guest_id
                      AND booking_status NOT IN ('Cancelled', 'NoShow')
                ),
                updated_at = NOW()
            WHERE guest_id = NEW.guest_id;
        END IF;
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SET search_path = '';
