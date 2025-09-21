-- ============================================
-- ROLLBACK: Guest Statistics Triggers
-- Removes automatic update triggers
-- ============================================

BEGIN;

-- Remove trigger
DROP TRIGGER IF EXISTS update_guest_stats_on_booking_change ON bookings;

-- Remove functions
DROP FUNCTION IF EXISTS update_guest_statistics();
DROP FUNCTION IF EXISTS recalculate_all_guest_statistics();

-- Remove optimization index
DROP INDEX IF EXISTS idx_bookings_guest_stats;

-- Reset guest statistics to NULL (original state)
UPDATE guests
SET
    total_bookings = NULL,
    total_spent = NULL,
    updated_at = NOW();

RAISE NOTICE 'Guest statistics triggers rollback completed';

COMMIT;