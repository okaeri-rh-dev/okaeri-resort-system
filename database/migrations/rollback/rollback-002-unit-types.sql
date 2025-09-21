-- ============================================
-- ROLLBACK: Unit Type Migration
-- Returns to original values: Studio, One Bedroom, Two Bedroom, Villa
-- ============================================

BEGIN;

-- Revert unit type values
UPDATE units
SET unit_type = CASE
    WHEN unit_type = 'Standard' THEN 'Studio'
    WHEN unit_type = 'Deluxe' THEN 'One Bedroom'
    WHEN unit_type = 'Suite' THEN 'Two Bedroom'
    WHEN unit_type = 'Villa' THEN 'Villa'
    ELSE unit_type
END
WHERE unit_type IN ('Standard', 'Deluxe', 'Suite', 'Villa');

-- Drop new constraint
ALTER TABLE units
DROP CONSTRAINT IF EXISTS units_unit_type_check;

-- Add original constraint
ALTER TABLE units
ADD CONSTRAINT units_unit_type_check
CHECK (unit_type IN ('Studio', 'One Bedroom', 'Two Bedroom', 'Villa'));

RAISE NOTICE 'Unit type rollback completed';

COMMIT;