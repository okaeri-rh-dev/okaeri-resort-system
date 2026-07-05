-- ============================================
-- MIGRATION: Fix get_booking_units for Unified Architecture
-- ============================================
-- Purpose: Update get_booking_units to work without bookings.unit_id column
-- Date: 2025-10-18
-- Context: After unified migration, b.unit_id no longer exists
-- ============================================

BEGIN;

-- Drop and recreate the function for unified architecture
DROP FUNCTION IF EXISTS get_booking_units(UUID);

CREATE OR REPLACE FUNCTION get_booking_units(p_booking_id UUID)
RETURNS TABLE (
    unit_id UUID,
    unit_name VARCHAR(100),
    unit_code VARCHAR(10),
    unit_type VARCHAR(50),
    unit_price DECIMAL(10,2),
    subtotal DECIMAL(10,2),
    assigned_guests INTEGER
) AS $$
BEGIN
    -- Simplified for unified architecture: ALL bookings use booking_units
    RETURN QUERY
    SELECT
        bu.unit_id,
        u.unit_name,
        u.unit_code,
        u.unit_type,
        bu.unit_price,
        bu.subtotal,
        bu.assigned_guests
    FROM booking_units bu
    INNER JOIN units u ON u.unit_id = bu.unit_id
    WHERE bu.booking_id = p_booking_id;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_booking_units IS
  'Get units for a booking (unified architecture - all bookings use booking_units junction table)';

COMMIT;
