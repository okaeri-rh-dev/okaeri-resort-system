-- ============================================
-- Migration: Add Base Occupancy and Extra Person Rate
-- Version: 004
-- Date: 2025-01-23
-- Description: Adds base_occupancy and extra_person_rate columns to units table
--              to support tiered pricing based on guest count
-- ============================================

-- Add new columns to units table
ALTER TABLE units
ADD COLUMN IF NOT EXISTS base_occupancy INTEGER,
ADD COLUMN IF NOT EXISTS extra_person_rate DECIMAL(10,2);

-- Set default values based on unit type before adding constraints
UPDATE units
SET
    base_occupancy = CASE
        WHEN unit_type IN ('Studio') THEN 2
        WHEN unit_type IN ('One Bedroom') THEN 2
        WHEN unit_type IN ('Two Bedroom') THEN 4
        WHEN unit_type IN ('Villa') THEN 4
        ELSE LEAST(2, max_occupancy)  -- Fallback to 2 or max_occupancy, whichever is smaller
    END,
    extra_person_rate = CASE
        WHEN unit_type IN ('Studio') THEN 500.00
        WHEN unit_type IN ('One Bedroom') THEN 750.00
        WHEN unit_type IN ('Two Bedroom') THEN 1000.00
        WHEN unit_type IN ('Villa') THEN 1500.00
        ELSE 500.00  -- Default extra person rate
    END
WHERE base_occupancy IS NULL OR extra_person_rate IS NULL;

-- Now add the constraints
ALTER TABLE units
ALTER COLUMN base_occupancy SET NOT NULL,
ALTER COLUMN extra_person_rate SET NOT NULL;

-- Add check constraints
ALTER TABLE units
ADD CONSTRAINT chk_base_occupancy
    CHECK (base_occupancy > 0 AND base_occupancy <= max_occupancy),
ADD CONSTRAINT chk_extra_person_rate
    CHECK (extra_person_rate >= 0);

-- Create index for pricing queries
CREATE INDEX IF NOT EXISTS idx_units_occupancy_pricing
ON units(base_occupancy, extra_person_rate);

-- Update seed data with more specific values
UPDATE units SET
    base_occupancy = 2,
    extra_person_rate = 500.00
WHERE unit_code = 'U1' AND unit_type = 'Studio';

UPDATE units SET
    base_occupancy = 2,
    extra_person_rate = 750.00
WHERE unit_code = 'U2' AND unit_type = 'One Bedroom';

UPDATE units SET
    base_occupancy = 4,
    extra_person_rate = 1000.00
WHERE unit_code = 'U3' AND unit_type = 'Two Bedroom';

-- Add comment to document the pricing logic
COMMENT ON COLUMN units.base_occupancy IS 'Number of guests included in the base rate';
COMMENT ON COLUMN units.extra_person_rate IS 'Additional rate per person exceeding base occupancy';

-- Verification query
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Migration 004: Occupancy Pricing Applied';
    RAISE NOTICE '============================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Units with new pricing structure:';
END $$;

SELECT
    unit_name,
    unit_type,
    base_occupancy || '/' || max_occupancy as "Occupancy (Base/Max)",
    '₱' || base_rate as "Base Rate",
    '₱' || weekend_rate as "Weekend Rate",
    '₱' || extra_person_rate as "Extra Person Rate"
FROM units
ORDER BY unit_code;

-- Rollback script (commented out for safety)
-- To rollback this migration, uncomment and run:
/*
ALTER TABLE units
DROP CONSTRAINT IF EXISTS chk_base_occupancy,
DROP CONSTRAINT IF EXISTS chk_extra_person_rate;

ALTER TABLE units
DROP COLUMN IF EXISTS base_occupancy,
DROP COLUMN IF EXISTS extra_person_rate;

DROP INDEX IF EXISTS idx_units_occupancy_pricing;
*/