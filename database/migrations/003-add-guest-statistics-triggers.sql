-- ============================================
-- GUEST STATISTICS AUTOMATIC UPDATE TRIGGERS
-- Maintains accurate total_bookings and total_spent
-- for guest records automatically
-- ============================================

BEGIN;

-- Step 1: Create function to update guest statistics
CREATE OR REPLACE FUNCTION update_guest_statistics()
RETURNS TRIGGER AS $$
DECLARE
    target_guest_id UUID;
    old_guest_id UUID;
BEGIN
    -- Determine which guest IDs to update based on operation
    IF TG_OP = 'DELETE' THEN
        target_guest_id := OLD.guest_id;
        old_guest_id := NULL;
    ELSIF TG_OP = 'UPDATE' THEN
        target_guest_id := NEW.guest_id;
        old_guest_id := OLD.guest_id;
    ELSE -- INSERT
        target_guest_id := NEW.guest_id;
        old_guest_id := NULL;
    END IF;

    -- Update statistics for NEW guest_id
    IF target_guest_id IS NOT NULL THEN
        UPDATE guests
        SET
            total_bookings = (
                SELECT COUNT(*)
                FROM bookings
                WHERE guest_id = target_guest_id
                    AND booking_status NOT IN ('Cancelled')
            ),
            total_spent = (
                SELECT COALESCE(SUM(total_amount), 0)
                FROM bookings
                WHERE guest_id = target_guest_id
                    AND booking_status IN ('CheckedOut', 'Completed')
                    AND payment_status IN ('Completed', 'Partial')
            ),
            updated_at = NOW()
        WHERE guest_id = target_guest_id;
    END IF;

    -- Update statistics for OLD guest_id if it changed
    IF old_guest_id IS NOT NULL AND old_guest_id IS DISTINCT FROM target_guest_id THEN
        UPDATE guests
        SET
            total_bookings = (
                SELECT COUNT(*)
                FROM bookings
                WHERE guest_id = old_guest_id
                    AND booking_status NOT IN ('Cancelled')
            ),
            total_spent = (
                SELECT COALESCE(SUM(total_amount), 0)
                FROM bookings
                WHERE guest_id = old_guest_id
                    AND booking_status IN ('CheckedOut', 'Completed')
                    AND payment_status IN ('Completed', 'Partial')
            ),
            updated_at = NOW()
        WHERE guest_id = old_guest_id;
    END IF;

    -- Return appropriate value based on operation
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create trigger for booking changes
DROP TRIGGER IF EXISTS update_guest_stats_on_booking_change ON bookings;

CREATE TRIGGER update_guest_stats_on_booking_change
AFTER INSERT OR UPDATE OR DELETE ON bookings
FOR EACH ROW
EXECUTE FUNCTION update_guest_statistics();

-- Step 3: Create function to recalculate all guest statistics (for initial sync)
CREATE OR REPLACE FUNCTION recalculate_all_guest_statistics()
RETURNS TABLE(guests_updated INTEGER) AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE guests g
    SET
        total_bookings = stats.booking_count,
        total_spent = stats.total_spent,
        updated_at = NOW()
    FROM (
        SELECT
            guest_id,
            COUNT(*) FILTER (WHERE booking_status NOT IN ('Cancelled')) as booking_count,
            COALESCE(
                SUM(total_amount) FILTER (
                    WHERE booking_status IN ('CheckedOut', 'Completed')
                    AND payment_status IN ('Completed', 'Partial')
                ),
                0
            ) as total_spent
        FROM bookings
        WHERE guest_id IS NOT NULL
        GROUP BY guest_id
    ) stats
    WHERE g.guest_id = stats.guest_id;

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    -- Also reset statistics for guests with no bookings
    UPDATE guests
    SET
        total_bookings = 0,
        total_spent = 0,
        updated_at = NOW()
    WHERE guest_id NOT IN (
        SELECT DISTINCT guest_id
        FROM bookings
        WHERE guest_id IS NOT NULL
    );

    GET DIAGNOSTICS updated_count = updated_count + ROW_COUNT;

    RETURN QUERY SELECT updated_count;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Run initial statistics calculation
SELECT * FROM recalculate_all_guest_statistics();

-- Step 5: Verify trigger is working
DO $$
DECLARE
    trigger_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.triggers
        WHERE trigger_name = 'update_guest_stats_on_booking_change'
    ) INTO trigger_exists;

    IF trigger_exists THEN
        RAISE NOTICE 'Guest statistics trigger installed successfully';
    ELSE
        RAISE EXCEPTION 'Failed to create guest statistics trigger';
    END IF;
END $$;

-- Step 6: Create index to optimize guest statistics queries
CREATE INDEX IF NOT EXISTS idx_bookings_guest_stats
ON bookings(guest_id, booking_status, payment_status)
WHERE guest_id IS NOT NULL;

COMMIT;

-- Post-migration verification
SELECT
    COUNT(*) as total_guests,
    COUNT(*) FILTER (WHERE total_bookings > 0) as guests_with_bookings,
    AVG(total_bookings) as avg_bookings_per_guest,
    AVG(total_spent) FILTER (WHERE total_spent > 0) as avg_spent_per_guest,
    MAX(total_spent) as highest_spending_guest,
    SUM(total_spent) as total_revenue_from_guests
FROM guests;