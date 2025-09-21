-- ============================================
-- UNIT TYPE ALIGNMENT MIGRATION
-- Fixes mismatch between database and TypeScript code
-- Changes: Studio -> Standard, One/Two Bedroom -> Deluxe/Suite
-- ============================================

BEGIN;

-- Step 1: Update existing unit type values
UPDATE units
SET unit_type = CASE
    WHEN unit_type = 'Studio' THEN 'Standard'
    WHEN unit_type = 'One Bedroom' THEN 'Deluxe'
    WHEN unit_type = 'Two Bedroom' THEN 'Suite'
    WHEN unit_type = 'Villa' THEN 'Villa'
    ELSE unit_type
END
WHERE unit_type IN ('Studio', 'One Bedroom', 'Two Bedroom', 'Villa');

-- Log the changes
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % unit records with new unit type values', updated_count;
END $$;

-- Step 2: Drop the old constraint
ALTER TABLE units
DROP CONSTRAINT IF EXISTS units_unit_type_check;

-- Step 3: Add new constraint with updated values
ALTER TABLE units
ADD CONSTRAINT units_unit_type_check
CHECK (unit_type IN ('Standard', 'Deluxe', 'Suite', 'Villa'));

-- Step 4: Update rates based on new types (optional business logic)
-- Standard rooms might have lower rates than Deluxe
UPDATE units
SET base_rate = CASE
    WHEN unit_type = 'Standard' AND base_rate > 3000 THEN 2500
    WHEN unit_type = 'Deluxe' AND base_rate < 3000 THEN 3500
    WHEN unit_type = 'Suite' AND base_rate < 4500 THEN 5000
    ELSE base_rate
END,
weekend_rate = CASE
    WHEN unit_type = 'Standard' AND weekend_rate > 3500 THEN 3000
    WHEN unit_type = 'Deluxe' AND weekend_rate < 3500 THEN 4000
    WHEN unit_type = 'Suite' AND weekend_rate < 5500 THEN 6000
    ELSE weekend_rate
END
WHERE unit_type IN ('Standard', 'Deluxe', 'Suite');

-- Verify the migration
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO invalid_count
    FROM units
    WHERE unit_type NOT IN ('Standard', 'Deluxe', 'Suite', 'Villa');

    IF invalid_count > 0 THEN
        RAISE EXCEPTION 'Migration failed: % units have invalid unit type', invalid_count;
    ELSE
        RAISE NOTICE 'Unit type migration completed successfully';
    END IF;
END $$;

COMMIT;

-- Post-migration verification query
SELECT
    unit_type,
    COUNT(*) as count,
    AVG(base_rate) as avg_base_rate,
    AVG(weekend_rate) as avg_weekend_rate,
    AVG(max_occupancy) as avg_occupancy
FROM units
GROUP BY unit_type
ORDER BY
    CASE unit_type
        WHEN 'Standard' THEN 1
        WHEN 'Deluxe' THEN 2
        WHEN 'Suite' THEN 3
        WHEN 'Villa' THEN 4
    END;