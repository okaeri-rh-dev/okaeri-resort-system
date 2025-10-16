-- ============================================
-- ROLLBACK: Unified Multi-Unit Architecture
-- ============================================
-- Purpose: Restore dual-path architecture (Oct 8, 2025 state)
-- From: Unified (ALL bookings use junction table)
-- To: Dual-path (unit_id for single-unit, junction for multi-unit)
--
-- Date: 2025-10-17
-- Use Case: Emergency rollback if unified migration causes issues
-- Estimated Duration: 3-7 minutes
--
-- ⚠️  WARNING: This rollback will:
-- - Re-add unit_id column to bookings table
-- - Restore dual-path constraint logic
-- - Delete junction entries for single-unit bookings
-- - Restore original trigger logic (COUNT(*) > 1)
-- ============================================

BEGIN;

-- ============================================
-- PRE-ROLLBACK CHECKS
-- ============================================

DO $$
DECLARE
  v_booking_count INTEGER;
  v_junction_count INTEGER;
  v_column_exists BOOLEAN;
BEGIN
  -- Check if unit_id column still exists (should not)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'unit_id'
  ) INTO v_column_exists;

  IF v_column_exists THEN
    RAISE EXCEPTION 'Rollback aborted: unit_id column still exists (migration may not have run)';
  END IF;

  -- Count current state
  SELECT COUNT(*) INTO v_booking_count FROM bookings;
  SELECT COUNT(*) INTO v_junction_count FROM booking_units;

  RAISE NOTICE '=== PRE-ROLLBACK STATUS ===';
  RAISE NOTICE 'Total bookings: %', v_booking_count;
  RAISE NOTICE 'Booking units (junction): %', v_junction_count;
  RAISE NOTICE 'unit_id column exists: %', v_column_exists;
  RAISE NOTICE '===========================';
END $$;

-- ============================================
-- STEP 1: Re-add unit_id column
-- ============================================
-- Rationale: Restore column for single-unit bookings
-- Impact: Column will be NULL initially, populated in Step 2

ALTER TABLE bookings ADD COLUMN unit_id UUID;

-- Add foreign key constraint
ALTER TABLE bookings
  ADD CONSTRAINT bookings_unit_id_fkey
  FOREIGN KEY (unit_id) REFERENCES units(unit_id);

-- Add index for performance
CREATE INDEX idx_bookings_unit_id ON bookings(unit_id) WHERE unit_id IS NOT NULL;

RAISE NOTICE 'Step 1 complete: unit_id column re-added to bookings table';

-- ============================================
-- STEP 2: Restore unit_id for single-unit bookings
-- ============================================
-- ⚠️  CRITICAL: Must happen BEFORE deleting from booking_units
-- Rationale: Preserve unit association for single-unit bookings

UPDATE bookings b
SET unit_id = (
  SELECT bu.unit_id
  FROM booking_units bu
  WHERE bu.booking_id = b.booking_id
  LIMIT 1  -- For single-unit bookings, there's only 1 row
),
updated_at = NOW()
WHERE (
  SELECT COUNT(*)
  FROM booking_units bu
  WHERE bu.booking_id = b.booking_id
) = 1;  -- Only single-unit bookings

-- Verify unit_id restoration
DO $$
DECLARE
  v_single_unit_count INTEGER;
  v_restored_count INTEGER;
BEGIN
  -- Count single-unit bookings
  SELECT COUNT(*) INTO v_single_unit_count
  FROM bookings b
  WHERE (
    SELECT COUNT(*) FROM booking_units bu WHERE bu.booking_id = b.booking_id
  ) = 1;

  -- Count bookings with unit_id restored
  SELECT COUNT(*) INTO v_restored_count
  FROM bookings b
  WHERE b.unit_id IS NOT NULL;

  IF v_single_unit_count != v_restored_count THEN
    RAISE WARNING 'Unit ID restoration mismatch: % single-unit but % with unit_id', v_single_unit_count, v_restored_count;
  END IF;

  RAISE NOTICE 'Step 2 complete: unit_id restored for % single-unit bookings', v_restored_count;
END $$;

-- ============================================
-- STEP 3: Restore is_multi_unit flag (> 1 logic)
-- ============================================
-- Rationale: Revert to dual-path semantics
-- Impact: is_multi_unit = FALSE for 1-unit bookings

UPDATE bookings b
SET
  is_multi_unit = (
    SELECT COUNT(*) > 1  -- Old logic: > 1 (not >= 1)
    FROM booking_units bu
    WHERE bu.booking_id = b.booking_id
  ),
  updated_at = NOW();

RAISE NOTICE 'Step 3 complete: is_multi_unit flag restored (> 1 logic)';

-- ============================================
-- STEP 4: Delete junction entries for single-unit bookings
-- ============================================
-- ⚠️  CRITICAL: Only happens AFTER unit_id is restored (Step 2)
-- Rationale: Remove redundant junction table entries for single-unit bookings

-- First, clean up availability records for single-unit bookings
DELETE FROM booking_unit_availability bua
WHERE EXISTS (
  SELECT 1 FROM bookings b
  WHERE b.booking_id = bua.booking_id
    AND b.unit_id IS NOT NULL  -- Single-unit booking
    AND b.is_multi_unit = FALSE
);

-- Then, delete booking_units entries for single-unit bookings
DELETE FROM booking_units bu
WHERE EXISTS (
  SELECT 1 FROM bookings b
  WHERE b.booking_id = bu.booking_id
    AND b.unit_id IS NOT NULL  -- Single-unit booking
    AND b.is_multi_unit = FALSE
);

RAISE NOTICE 'Step 4 complete: Junction entries removed for single-unit bookings';

-- ============================================
-- STEP 5: Drop unified constraint
-- ============================================
-- Rationale: Remove EXISTS-based constraint before adding dual-path constraint

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS valid_unit_assignment;

RAISE NOTICE 'Step 5 complete: Unified constraint dropped';

-- ============================================
-- STEP 6: Restore dual-path constraint
-- ============================================
-- Rationale: Enforce dual-path logic (unit_id XOR booking_units)

ALTER TABLE bookings ADD CONSTRAINT valid_unit_assignment CHECK (
  -- Single-unit path: unit_id not null, is_multi_unit false, unit_count = 1
  (is_multi_unit = FALSE AND unit_id IS NOT NULL AND unit_count = 1)
  OR
  -- Multi-unit path: unit_id null, is_multi_unit true, unit_count > 0
  (is_multi_unit = TRUE AND unit_id IS NULL AND unit_count > 0)
);

COMMENT ON CONSTRAINT valid_unit_assignment ON bookings IS
  'Dual-path architecture: Single-unit bookings use unit_id directly (is_multi_unit = FALSE), multi-unit bookings use booking_units junction table (is_multi_unit = TRUE, unit_id = NULL).';

RAISE NOTICE 'Step 6 complete: Dual-path constraint restored';

-- ============================================
-- STEP 7: Restore old trigger logic (> 1)
-- ============================================
-- Rationale: Revert is_multi_unit calculation to dual-path semantics

CREATE OR REPLACE FUNCTION update_booking_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE bookings
    SET
      -- ✅ DUAL-PATH: Use > 1 (not >= 1)
      is_multi_unit = (
        SELECT COUNT(*) > 1
        FROM booking_units
        WHERE booking_id = NEW.booking_id
      ),
      unit_count = (
        SELECT COUNT(*)
        FROM booking_units
        WHERE booking_id = NEW.booking_id
      ),
      total_amount = (
        SELECT COALESCE(SUM(subtotal), 0)
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
      -- ✅ DUAL-PATH: Use > 1 (not >= 1)
      is_multi_unit = (
        SELECT COUNT(*) > 1
        FROM booking_units
        WHERE booking_id = OLD.booking_id
      ),
      unit_count = (
        SELECT COUNT(*)
        FROM booking_units
        WHERE booking_id = OLD.booking_id
      ),
      total_amount = (
        SELECT COALESCE(SUM(subtotal), 0)
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

-- Trigger already exists, no need to recreate

RAISE NOTICE 'Step 7 complete: Trigger logic restored to > 1 (dual-path)';

-- ============================================
-- STEP 8: Restore no_overlapping_bookings constraint
-- ============================================
-- Rationale: Prevent double-booking using unit_id exclusion

ALTER TABLE bookings ADD CONSTRAINT no_overlapping_bookings
EXCLUDE USING gist (
  unit_id WITH =,
  tstzrange(check_in, check_out, '[)') WITH &&
) WHERE (
  -- Non-guest bookings: exclude non-cancelled
  (is_guest_booking = FALSE AND booking_status != 'Cancelled')
  OR
  -- Guest bookings: exclude confirmed and checked-in
  (is_guest_booking = TRUE AND booking_status IN ('Confirmed', 'CheckedIn', 'CheckedOut'))
);

COMMENT ON CONSTRAINT no_overlapping_bookings ON bookings IS
  'Prevents double bookings for single-unit bookings using unit_id. Multi-unit bookings use booking_unit_availability table for overlap prevention.';

RAISE NOTICE 'Step 8 complete: no_overlapping_bookings constraint restored';

-- ============================================
-- STEP 9: Update column comments
-- ============================================

COMMENT ON COLUMN bookings.unit_id IS
  'Direct unit reference for single-unit bookings only (is_multi_unit = FALSE). NULL for multi-unit bookings (use booking_units junction table).';

COMMENT ON COLUMN bookings.is_multi_unit IS
  'TRUE if booking has multiple units (uses booking_units junction table, unit_id = NULL). FALSE for single-unit bookings (uses unit_id directly).';

COMMENT ON COLUMN bookings.unit_count IS
  'Number of units in this booking. Single-unit bookings: 1, Multi-unit bookings: 2+. Calculated from booking_units junction table.';

COMMENT ON TABLE bookings IS
  'Main bookings table. Uses dual-path architecture: single-unit bookings use unit_id directly, multi-unit bookings use booking_units junction table.';

-- ============================================
-- STEP 10: Final validation
-- ============================================

DO $$
DECLARE
  v_total_bookings INTEGER;
  v_single_unit INTEGER;
  v_multi_unit INTEGER;
  v_invalid_single INTEGER;
  v_invalid_multi INTEGER;
BEGIN
  -- Get counts
  SELECT COUNT(*) INTO v_total_bookings FROM bookings;
  SELECT COUNT(*) INTO v_single_unit FROM bookings WHERE is_multi_unit = FALSE;
  SELECT COUNT(*) INTO v_multi_unit FROM bookings WHERE is_multi_unit = TRUE;

  -- Validate single-unit bookings (should have unit_id, no junction entries)
  SELECT COUNT(*) INTO v_invalid_single
  FROM bookings b
  WHERE b.is_multi_unit = FALSE
    AND (
      b.unit_id IS NULL  -- INVALID: Missing unit_id
      OR EXISTS (  -- INVALID: Has junction entries
        SELECT 1 FROM booking_units bu WHERE bu.booking_id = b.booking_id
      )
    );

  IF v_invalid_single > 0 THEN
    RAISE WARNING 'Found % invalid single-unit bookings', v_invalid_single;
  END IF;

  -- Validate multi-unit bookings (should NOT have unit_id, must have junction entries)
  SELECT COUNT(*) INTO v_invalid_multi
  FROM bookings b
  WHERE b.is_multi_unit = TRUE
    AND (
      b.unit_id IS NOT NULL  -- INVALID: Has unit_id
      OR NOT EXISTS (  -- INVALID: Missing junction entries
        SELECT 1 FROM booking_units bu WHERE bu.booking_id = b.booking_id
      )
    );

  IF v_invalid_multi > 0 THEN
    RAISE WARNING 'Found % invalid multi-unit bookings', v_invalid_multi;
  END IF;

  -- Summary report
  RAISE NOTICE '';
  RAISE NOTICE '=== ROLLBACK COMPLETE ===';
  RAISE NOTICE 'Total bookings: %', v_total_bookings;
  RAISE NOTICE 'Single-unit (unit_id): %', v_single_unit;
  RAISE NOTICE 'Multi-unit (junction): %', v_multi_unit;
  RAISE NOTICE 'Invalid single-unit: %', v_invalid_single;
  RAISE NOTICE 'Invalid multi-unit: %', v_invalid_multi;

  IF v_invalid_single = 0 AND v_invalid_multi = 0 THEN
    RAISE NOTICE 'All validations passed ✅';
  ELSE
    RAISE WARNING 'Validation errors detected - review above warnings';
  END IF;

  RAISE NOTICE '========================';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Revert TypeScript types (restore unit_id in database.types.ts)';
  RAISE NOTICE '2. Revert backend API changes (restore unit_id queries)';
  RAISE NOTICE '3. Revert frontend component changes';
  RAISE NOTICE '4. Monitor for booking creation errors';
  RAISE NOTICE '5. Verify BookingsTable displays correctly';

END $$;

COMMIT;

-- ============================================
-- Rollback Complete
-- ============================================
-- Run the following to verify dual-path restoration:
-- 1. SELECT COUNT(*) FROM bookings WHERE is_multi_unit = FALSE AND unit_id IS NOT NULL;  -- Should be > 0
-- 2. SELECT COUNT(*) FROM bookings WHERE is_multi_unit = TRUE AND unit_id IS NULL;  -- Should be > 0
-- 3. SELECT b.booking_id, b.is_multi_unit, b.unit_id, COUNT(bu.*) as junction_count
--    FROM bookings b
--    LEFT JOIN booking_units bu ON bu.booking_id = b.booking_id
--    GROUP BY b.booking_id, b.is_multi_unit, b.unit_id;
-- 4. \d bookings  -- Verify unit_id column exists
-- ============================================
