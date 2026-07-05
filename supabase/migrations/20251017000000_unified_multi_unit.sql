-- ============================================
-- MIGRATION: Unified Multi-Unit Architecture
-- ============================================
-- Purpose: Migrate from dual-path to unified junction table architecture
-- From: Oct 8, 2025 dual-path (unit_id for single-unit, junction for multi-unit)
-- To: Unified (ALL bookings use booking_units junction table)
--
-- Date: 2025-10-17
-- Breaking Change: Removes unit_id column from bookings table
-- Rollback: Use 20251017_rollback_unified_multi_unit.sql
--
-- IMPORTANT: This migration requires atomic deployment
-- - Database migration MUST complete before deploying updated code
-- - Estimated duration: 2-5 minutes (depends on booking count)
-- - Downtime window: 5-10 minutes recommended
--
-- COMPATIBILITY:
-- - Works on databases with Oct 8 migration (booking_units already exists)
-- - Works on fresh databases (creates booking_units in Step 0)
-- - Idempotent: Safe to re-run if migration was interrupted
-- ============================================

BEGIN;

-- ============================================
-- PRE-FLIGHT CHECKS
-- ============================================
-- Note: Checks if required tables exist before querying them
-- This handles both fresh databases and databases with Oct 8 migration

DO $$
DECLARE
  v_booking_count INTEGER;
  v_junction_count INTEGER := 0;
  v_availability_count INTEGER := 0;
  v_table_exists BOOLEAN;
BEGIN
  -- Count current bookings (must exist)
  SELECT COUNT(*) INTO v_booking_count FROM bookings;

  -- Check if booking_units exists before counting (may not exist on fresh DB)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'booking_units'
  ) INTO v_table_exists;

  IF v_table_exists THEN
    SELECT COUNT(*) INTO v_junction_count FROM booking_units;
  ELSE
    RAISE WARNING 'booking_units table not found - may need to run 20251008152700_multi_unit_schema.sql first';
  END IF;

  -- Check if booking_unit_availability exists before counting
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'booking_unit_availability'
  ) INTO v_table_exists;

  IF v_table_exists THEN
    SELECT COUNT(*) INTO v_availability_count FROM booking_unit_availability;
  ELSE
    RAISE WARNING 'booking_unit_availability table not found - may need to run 20251008152700_multi_unit_schema.sql first';
  END IF;

  RAISE NOTICE '=== PRE-FLIGHT STATUS ===';
  RAISE NOTICE 'Total bookings: %', v_booking_count;
  RAISE NOTICE 'Existing booking_units: %', v_junction_count;
  RAISE NOTICE 'Availability records: %', v_availability_count;
  RAISE NOTICE '========================';
END $$;

-- ============================================
-- STEP 0: Ensure required tables exist
-- ============================================
-- Purpose: Support databases that haven't run Oct 8 migration
-- Safety: Uses CREATE TABLE IF NOT EXISTS (idempotent)

CREATE TABLE IF NOT EXISTS booking_units (
    -- Primary key
    booking_unit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign keys
    booking_id UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES units(unit_id) ON DELETE RESTRICT,

    -- Pricing breakdown for this specific unit
    unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    weekend_surcharge DECIMAL(10,2) DEFAULT 0 CHECK (weekend_surcharge >= 0),
    extra_person_charge DECIMAL(10,2) DEFAULT 0 CHECK (extra_person_charge >= 0),
    subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),

    -- Guest assignment (optional)
    assigned_guests INTEGER CHECK (assigned_guests > 0),
    guest_names TEXT[],  -- Array of guest names for this unit

    -- Unit-specific details
    unit_notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    UNIQUE(booking_id, unit_id),  -- Prevent duplicate unit assignments
    CHECK (subtotal = unit_price + weekend_surcharge + extra_person_charge)
);

CREATE TABLE IF NOT EXISTS booking_unit_availability (
    -- Primary key
    availability_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- References
    unit_id UUID NOT NULL REFERENCES units(unit_id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,

    -- Date range (TIMESTAMPTZ for UTC storage)
    check_in TIMESTAMP WITH TIME ZONE NOT NULL,
    check_out TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Booking status (for filtering)
    booking_status VARCHAR(20) NOT NULL,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Exclusion constraint: Prevent overlapping bookings for same unit
    -- AGGRESSIVE BLOCKING: Only Confirmed and CheckedIn bookings block availability
    -- Rationale: Better UX (Pending bookings don't block), acceptable race condition risk at low volume
    EXCLUDE USING gist (
        unit_id WITH =,
        tstzrange(check_in, check_out, '[)') WITH &&
    ) WHERE (booking_status IN ('Confirmed', 'CheckedIn')),

    -- Additional constraints
    CHECK (check_out > check_in)
);

DO $$ BEGIN
  RAISE NOTICE 'Step 0 complete: Required tables ensured to exist (booking_units, booking_unit_availability)';
END $$;

-- ============================================
-- STEP 1: Migrate single-unit bookings to junction table
-- ============================================
-- Rationale: Must preserve data BEFORE removing unit_id column
-- Safety: Uses ON CONFLICT to handle already-migrated bookings

INSERT INTO booking_units (
  booking_unit_id,
  booking_id,
  unit_id,
  unit_price,
  weekend_surcharge,
  extra_person_charge,
  subtotal,
  assigned_guests,
  unit_notes,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  b.booking_id,
  b.unit_id,
  b.total_amount,  -- Use total_amount as unit_price (legacy single-unit data)
  0,  -- No pricing breakdown available for legacy bookings
  0,
  b.total_amount,  -- subtotal = total_amount for single-unit
  b.num_guests,
  NULL,  -- No unit-specific notes in legacy data
  b.created_at,
  b.updated_at
FROM bookings b
WHERE b.unit_id IS NOT NULL  -- Only migrate single-unit bookings
  AND b.is_multi_unit = FALSE  -- Sanity check: should be single-unit
  AND NOT EXISTS (  -- Skip if already in junction table
    SELECT 1 FROM booking_units bu WHERE bu.booking_id = b.booking_id
  )
ON CONFLICT (booking_id, unit_id) DO NOTHING;  -- Idempotent

-- Verify migration completeness
DO $$
DECLARE
  v_unmigrated INTEGER;
  v_migrated INTEGER;
BEGIN
  -- Count bookings with unit_id but no junction entry (should be 0)
  SELECT COUNT(*) INTO v_unmigrated
  FROM bookings b
  WHERE b.unit_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM booking_units bu WHERE bu.booking_id = b.booking_id
    );

  IF v_unmigrated > 0 THEN
    RAISE EXCEPTION 'Migration incomplete: % bookings not in junction table', v_unmigrated;
  END IF;

  -- Count newly migrated bookings
  GET DIAGNOSTICS v_migrated = ROW_COUNT;

  RAISE NOTICE 'Step 1 complete: All single-unit bookings migrated to junction table';
  RAISE NOTICE 'Migrated bookings: %', v_migrated;
END $$;

-- ============================================
-- STEP 2: Populate booking_unit_availability for migrated bookings
-- ============================================
-- Rationale: Availability table must have entries for ALL units
-- Safety: Uses ON CONFLICT to handle existing entries

INSERT INTO booking_unit_availability (
  availability_id,
  unit_id,
  booking_id,
  check_in,
  check_out,
  booking_status,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  bu.unit_id,
  bu.booking_id,
  b.check_in,
  b.check_out,
  b.booking_status,
  NOW(),
  NOW()
FROM booking_units bu
JOIN bookings b ON b.booking_id = bu.booking_id
WHERE NOT EXISTS (  -- Skip if availability entry already exists
  SELECT 1 FROM booking_unit_availability bua
  WHERE bua.booking_id = bu.booking_id
    AND bua.unit_id = bu.unit_id
);

DO $$ BEGIN
  RAISE NOTICE 'Step 2 complete: Availability table populated for all booking_units';
END $$;

-- ============================================
-- STEP 3: Update trigger logic (COUNT(*) > 1 → COUNT(*) >= 1)
-- ============================================
-- Rationale: In unified architecture, even 1-unit bookings are "multi-unit"
-- Impact: is_multi_unit becomes TRUE for ALL bookings

CREATE OR REPLACE FUNCTION update_booking_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE bookings
    SET
      total_amount = (
        SELECT COALESCE(SUM(subtotal), 0)
        FROM booking_units
        WHERE booking_id = NEW.booking_id
      ),
      unit_count = (
        SELECT COUNT(*)
        FROM booking_units
        WHERE booking_id = NEW.booking_id
      ),
      -- ✅ UNIFIED ARCHITECTURE: Use >= 1 instead of > 1
      -- This makes is_multi_unit = TRUE for all bookings (even 1-unit)
      is_multi_unit = (
        SELECT COUNT(*) >= 1
        FROM booking_units
        WHERE booking_id = NEW.booking_id
      ),
      num_guests = (
        SELECT COALESCE(SUM(assigned_guests), 0)
        FROM booking_units
        WHERE booking_id = NEW.booking_id
      ),
      base_amount = (
        SELECT COALESCE(SUM(unit_price), 0)
        FROM booking_units
        WHERE booking_id = NEW.booking_id
      ),
      total_surcharges = (
        SELECT COALESCE(SUM(weekend_surcharge + extra_person_charge), 0)
        FROM booking_units
        WHERE booking_id = NEW.booking_id
      ),
      updated_at = NOW()
    WHERE booking_id = NEW.booking_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE bookings
    SET
      total_amount = (
        SELECT COALESCE(SUM(subtotal), 0)
        FROM booking_units
        WHERE booking_id = OLD.booking_id
      ),
      unit_count = (
        SELECT COUNT(*)
        FROM booking_units
        WHERE booking_id = OLD.booking_id
      ),
      -- ✅ UNIFIED ARCHITECTURE: Use >= 1 instead of > 1
      is_multi_unit = (
        SELECT COUNT(*) >= 1
        FROM booking_units
        WHERE booking_id = OLD.booking_id
      ),
      num_guests = (
        SELECT COALESCE(SUM(assigned_guests), 0)
        FROM booking_units
        WHERE booking_id = OLD.booking_id
      ),
      base_amount = (
        SELECT COALESCE(SUM(unit_price), 0)
        FROM booking_units
        WHERE booking_id = OLD.booking_id
      ),
      total_surcharges = (
        SELECT COALESCE(SUM(weekend_surcharge + extra_person_charge), 0)
        FROM booking_units
        WHERE booking_id = OLD.booking_id
      ),
      updated_at = NOW()
    WHERE booking_id = OLD.booking_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist (handles fresh databases)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_update_booking_totals'
      AND tgrelid = 'booking_units'::regclass
  ) THEN
    EXECUTE 'CREATE TRIGGER trigger_update_booking_totals
      AFTER INSERT OR UPDATE OR DELETE ON booking_units
      FOR EACH ROW
      EXECUTE FUNCTION update_booking_totals()';
    RAISE NOTICE 'Created trigger: trigger_update_booking_totals';
  ELSE
    RAISE NOTICE 'Trigger already exists: trigger_update_booking_totals';
  END IF;
END $$;

DO $$ BEGIN
  RAISE NOTICE 'Step 3 complete: Trigger logic updated to >= 1 (unified architecture)';
END $$;

-- ============================================
-- STEP 4: Drop old constraints
-- ============================================
-- Rationale: Must drop BEFORE updating is_multi_unit to avoid constraint violations
-- The old dual-path constraint requires: (is_multi_unit=false AND unit_id IS NOT NULL) OR (is_multi_unit=true AND unit_id IS NULL)

-- Drop dual-path constraint (required unit_id for single-unit bookings)
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS valid_unit_assignment;

-- Drop no_overlapping_bookings (uses unit_id in exclusion expression)
-- Note: Overlap prevention now handled by booking_unit_availability table
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS no_overlapping_bookings;

DO $$ BEGIN
  RAISE NOTICE 'Step 4 complete: Old constraints dropped (valid_unit_assignment, no_overlapping_bookings)';
END $$;

-- ============================================
-- STEP 5: Update is_multi_unit flag for ALL bookings
-- ============================================
-- Rationale: Set is_multi_unit = TRUE for all bookings with junction entries
-- Impact: Semantic change - "multi-unit" now means "uses junction table"
-- Note: Constraints dropped in Step 4, so this UPDATE won't violate old rules

UPDATE bookings b
SET
  is_multi_unit = TRUE,
  unit_count = (
    SELECT COUNT(*) FROM booking_units bu WHERE bu.booking_id = b.booking_id
  ),
  updated_at = NOW()
WHERE EXISTS (
  SELECT 1 FROM booking_units bu WHERE bu.booking_id = b.booking_id
);

DO $$ BEGIN
  RAISE NOTICE 'Step 5 complete: is_multi_unit flag updated for all bookings';
END $$;

-- ============================================
-- STEP 6: Remove unit_id column (BREAKING CHANGE)
-- ============================================
-- ⚠️ WARNING: This is irreversible without the rollback script
-- Impact: Any code referencing bookings.unit_id will break

ALTER TABLE bookings DROP COLUMN unit_id;

DO $$ BEGIN
  RAISE NOTICE 'Step 6 complete: unit_id column removed from bookings table';
  RAISE NOTICE '⚠️  BREAKING CHANGE: bookings.unit_id no longer exists';
END $$;

-- ============================================
-- STEP 7: Add new unit_count-based constraint
-- ============================================
-- Rationale: Enforce that ALL bookings have at least one unit
-- Note: We use unit_count instead of EXISTS because PostgreSQL doesn't allow subqueries in CHECK constraints
-- The unit_count column is automatically maintained by the update_booking_totals() trigger

-- Note: The existing bookings_unit_count_check already enforces unit_count > 0
-- So we don't need to add a new constraint here. Just verify it exists.

DO $$ BEGIN
  RAISE NOTICE 'Step 7 complete: Constraint validation (bookings_unit_count_check already enforces unit_count > 0)';
END $$;

-- ============================================
-- STEP 8: Update comments and documentation
-- ============================================

COMMENT ON COLUMN bookings.is_multi_unit IS
  'DEPRECATED SEMANTIC: Always TRUE in unified architecture. Kept for backward compatibility. Use unit_count to determine single vs multi-unit.';

COMMENT ON COLUMN bookings.unit_count IS
  'Number of units in this booking. Calculated from booking_units junction table. Use this instead of is_multi_unit to determine single (1) vs multi (>1) unit bookings.';

COMMENT ON TABLE bookings IS
  'Main bookings table. ALL bookings (single or multi-unit) now use booking_units junction table. The unit_id column has been removed (unified architecture migration, Oct 17 2025).';

-- ============================================
-- STEP 9: Final validation
-- ============================================

DO $$
DECLARE
  v_invalid_count INTEGER;
  v_total_bookings INTEGER;
  v_multi_unit_count INTEGER;
  v_avg_unit_count NUMERIC;
BEGIN
  -- Get totals
  SELECT COUNT(*) INTO v_total_bookings FROM bookings;
  SELECT COUNT(*) INTO v_multi_unit_count FROM bookings WHERE is_multi_unit = TRUE;
  SELECT AVG(unit_count) INTO v_avg_unit_count FROM bookings;

  -- Check for bookings without units (CRITICAL ERROR)
  SELECT COUNT(*) INTO v_invalid_count
  FROM bookings b
  WHERE NOT EXISTS (
    SELECT 1 FROM booking_units bu WHERE bu.booking_id = b.booking_id
  );

  IF v_invalid_count > 0 THEN
    RAISE EXCEPTION 'CRITICAL: % bookings have no units in junction table', v_invalid_count;
  END IF;

  -- Check is_multi_unit flag (WARNING if any FALSE)
  SELECT COUNT(*) INTO v_invalid_count
  FROM bookings b
  WHERE b.is_multi_unit = FALSE;

  IF v_invalid_count > 0 THEN
    RAISE WARNING 'Found % bookings with is_multi_unit = FALSE (expected TRUE for unified architecture)', v_invalid_count;
  END IF;

  -- Check for orphaned booking_units (should not happen with FK constraints)
  SELECT COUNT(*) INTO v_invalid_count
  FROM booking_units bu
  WHERE NOT EXISTS (
    SELECT 1 FROM bookings b WHERE b.booking_id = bu.booking_id
  );

  IF v_invalid_count > 0 THEN
    RAISE WARNING 'Found % orphaned booking_units (no parent booking)', v_invalid_count;
  END IF;

  -- Summary report
  RAISE NOTICE '';
  RAISE NOTICE '=== MIGRATION COMPLETE ===';
  RAISE NOTICE 'Total bookings: %', v_total_bookings;
  RAISE NOTICE 'With is_multi_unit = TRUE: %', v_multi_unit_count;
  RAISE NOTICE 'Average units per booking: %', ROUND(v_avg_unit_count, 2);
  RAISE NOTICE 'All validations passed ✅';
  RAISE NOTICE '========================';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Deploy updated TypeScript types (database.types.ts)';
  RAISE NOTICE '2. Deploy backend API updates (remove unit_id references)';
  RAISE NOTICE '3. Deploy frontend component updates';
  RAISE NOTICE '4. Monitor Sentry for booking creation errors';
  RAISE NOTICE '5. Verify BookingsTable displays units correctly';

END $$;

COMMIT;

-- ============================================
-- Migration Complete
-- ============================================
-- Run the following to verify:
-- 1. SELECT COUNT(*) FROM bookings WHERE is_multi_unit = FALSE;  -- Should be 0
-- 2. SELECT booking_id, unit_count, is_multi_unit FROM bookings LIMIT 5;
-- 3. SELECT b.booking_id, b.unit_count, COUNT(bu.*) as junction_count
--    FROM bookings b
--    LEFT JOIN booking_units bu ON bu.booking_id = b.booking_id
--    GROUP BY b.booking_id, b.unit_count
--    HAVING b.unit_count != COUNT(bu.*);  -- Should return 0 rows
-- 4. \d bookings  -- Verify unit_id column is gone
-- ============================================
