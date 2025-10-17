-- ============================================================================
-- Multi-Unit Booking Migration - Post-Migration Verification Script
-- ============================================================================
-- Version: 2.1
-- Created: 2025-10-17
-- Updated: 2025-10-17 (Supabase SQL Editor compatible)
-- Purpose: Validation queries to run AFTER migration completes
-- Safety: All queries are READ-ONLY (SELECT only)
-- Usage: Copy/paste into Supabase SQL Editor immediately after migration
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'POST-MIGRATION VERIFICATION SCRIPT';
  RAISE NOTICE 'Version 2.1 - Supabase SQL Editor Compatible';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
END $$;

-- Validation Query 1: Check all bookings have units in junction table
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM bookings b
  WHERE NOT EXISTS (
    SELECT 1 FROM booking_units bu WHERE bu.booking_id = b.booking_id
  );

  RAISE NOTICE '✓ Validation 1/5: Checking all bookings have junction table entries...';
  RAISE NOTICE '  Result: % bookings without units', v_count;
  RAISE NOTICE '  Expected: 0 (all bookings must have at least one unit)';
  RAISE NOTICE '  Status: %', CASE WHEN v_count = 0 THEN '✅ PASS' ELSE '❌ FAIL' END;
  RAISE NOTICE '';
END $$;

-- Validation Query 2: Check unit_id column is removed
DO $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'unit_id'
  ) INTO v_exists;

  RAISE NOTICE '✓ Validation 2/5: Verifying unit_id column is removed...';
  RAISE NOTICE '  Result: unit_id column %', CASE WHEN v_exists THEN 'still exists' ELSE 'removed' END;
  RAISE NOTICE '  Expected: unit_id column should be dropped';
  RAISE NOTICE '  Status: %', CASE WHEN NOT v_exists THEN '✅ PASS' ELSE '❌ FAIL' END;
  RAISE NOTICE '';
END $$;

-- Validation Query 3: Check is_multi_unit flag
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM bookings
  WHERE is_multi_unit = FALSE;

  RAISE NOTICE '✓ Validation 3/5: Checking is_multi_unit flag...';
  RAISE NOTICE '  Result: % bookings with is_multi_unit = false', v_count;
  RAISE NOTICE '  Expected: 0 (all bookings should be multi_unit = true)';
  RAISE NOTICE '  Status: %', CASE WHEN v_count = 0 THEN '✅ PASS' ELSE '❌ FAIL' END;
  RAISE NOTICE '';
END $$;

-- Validation Query 4: Verify constraint exists
DO $$
DECLARE
  v_exists BOOLEAN;
  v_type TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'bookings'
      AND constraint_name = 'valid_unit_assignment'
  ) INTO v_exists;

  IF v_exists THEN
    SELECT constraint_type INTO v_type
    FROM information_schema.table_constraints
    WHERE table_name = 'bookings'
      AND constraint_name = 'valid_unit_assignment';
  END IF;

  RAISE NOTICE '✓ Validation 4/5: Verifying valid_unit_assignment constraint exists...';
  RAISE NOTICE '  Result: Constraint %', CASE WHEN v_exists THEN 'exists (type: ' || v_type || ')' ELSE 'not found' END;
  RAISE NOTICE '  Expected: Constraint exists with type = CHECK';
  RAISE NOTICE '  Status: %', CASE WHEN v_exists AND v_type = 'CHECK' THEN '✅ PASS' ELSE '❌ FAIL' END;
  RAISE NOTICE '';
END $$;

-- Validation Query 5: Sample booking with units
DO $$
BEGIN
  RAISE NOTICE '✓ Validation 5/5: Sampling bookings with units...';
  RAISE NOTICE 'Expected: 5 bookings with properly formatted units array';
  RAISE NOTICE 'Verify: Each booking shows units array with unit details';
  RAISE NOTICE '';
END $$;

SELECT
  b.booking_id,
  b.booking_reference,
  b.guest_name,
  b.unit_count,
  json_agg(json_build_object(
    'unit_id', bu.unit_id,
    'unit_name', u.unit_name,
    'subtotal', bu.subtotal
  ) ORDER BY bu.unit_id) AS units
FROM bookings b
JOIN booking_units bu ON bu.booking_id = b.booking_id
JOIN units u ON u.unit_id = bu.unit_id
GROUP BY b.booking_id, b.booking_reference, b.guest_name, b.unit_count
ORDER BY b.created_at DESC
LIMIT 5;

-- Additional verification checks
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'ADDITIONAL VERIFICATION CHECKS';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
END $$;

-- Check total counts match pre-migration
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM bookings;

  RAISE NOTICE 'Total booking count (compare with pre-migration count):';
  RAISE NOTICE '  Result: % bookings', v_count;
  RAISE NOTICE '  Expected: Must match pre-migration count documented earlier';
  RAISE NOTICE '';
END $$;

-- Check junction table row count
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM booking_units;

  RAISE NOTICE 'Junction table row count:';
  RAISE NOTICE '  Result: % booking_units rows', v_count;
  RAISE NOTICE '  Expected: Should equal total_bookings (all are single-unit converted to multi-unit)';
  RAISE NOTICE '';
END $$;

-- Check for orphaned junction table entries
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM booking_units bu
  WHERE NOT EXISTS (
    SELECT 1 FROM bookings b WHERE b.booking_id = bu.booking_id
  );

  RAISE NOTICE 'Checking for orphaned junction table entries:';
  RAISE NOTICE '  Result: % orphaned units', v_count;
  RAISE NOTICE '  Expected: 0 (no orphaned entries in junction table)';
  RAISE NOTICE '  Status: %', CASE WHEN v_count = 0 THEN '✅ PASS' ELSE '❌ FAIL' END;
  RAISE NOTICE '';
END $$;

-- Check for orphaned units references
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM booking_units bu
  WHERE NOT EXISTS (
    SELECT 1 FROM units u WHERE u.unit_id = bu.unit_id
  );

  RAISE NOTICE 'Checking for invalid unit references:';
  RAISE NOTICE '  Result: % invalid unit references', v_count;
  RAISE NOTICE '  Expected: 0 (all unit_ids in booking_units must exist in units table)';
  RAISE NOTICE '  Status: %', CASE WHEN v_count = 0 THEN '✅ PASS' ELSE '❌ FAIL' END;
  RAISE NOTICE '';
END $$;

-- Verify unit_count matches junction table entries
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM bookings b
  WHERE b.unit_count != (
    SELECT COUNT(*)
    FROM booking_units bu
    WHERE bu.booking_id = b.booking_id
  );

  RAISE NOTICE 'Verifying unit_count matches junction table entries:';
  RAISE NOTICE '  Result: % mismatched unit counts', v_count;
  RAISE NOTICE '  Expected: 0 (unit_count should match number of junction table entries)';
  RAISE NOTICE '  Status: %', CASE WHEN v_count = 0 THEN '✅ PASS' ELSE '❌ FAIL' END;
  RAISE NOTICE '';
END $$;

-- Check for null values in critical fields
DO $$
DECLARE
  v_null_booking_ids INTEGER;
  v_null_multi_unit INTEGER;
  v_null_unit_counts INTEGER;
  v_invalid_unit_counts INTEGER;
  v_all_pass BOOLEAN;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE booking_id IS NULL),
    COUNT(*) FILTER (WHERE is_multi_unit IS NULL),
    COUNT(*) FILTER (WHERE unit_count IS NULL),
    COUNT(*) FILTER (WHERE unit_count < 1)
  INTO v_null_booking_ids, v_null_multi_unit, v_null_unit_counts, v_invalid_unit_counts
  FROM bookings;

  v_all_pass := (v_null_booking_ids = 0 AND v_null_multi_unit = 0 AND v_null_unit_counts = 0 AND v_invalid_unit_counts = 0);

  RAISE NOTICE 'Checking for null values in critical fields:';
  RAISE NOTICE '  null_booking_ids: %', v_null_booking_ids;
  RAISE NOTICE '  null_multi_unit_flags: %', v_null_multi_unit;
  RAISE NOTICE '  null_unit_counts: %', v_null_unit_counts;
  RAISE NOTICE '  invalid_unit_counts (< 1): %', v_invalid_unit_counts;
  RAISE NOTICE '  Expected: All counts should be 0';
  RAISE NOTICE '  Status: %', CASE WHEN v_all_pass THEN '✅ PASS' ELSE '❌ FAIL' END;
  RAISE NOTICE '';
END $$;

-- Sample booking details with full structure
DO $$
BEGIN
  RAISE NOTICE 'Sample booking with complete structure:';
  RAISE NOTICE '';
END $$;

SELECT
  b.booking_id,
  b.booking_reference,
  b.guest_name,
  b.is_multi_unit,
  b.unit_count,
  b.total_amount,
  b.check_in_date,
  b.check_out_date,
  json_agg(json_build_object(
    'unit_id', bu.unit_id,
    'unit_name', u.unit_name,
    'unit_type', u.unit_type,
    'subtotal', bu.subtotal,
    'unit_order', bu.unit_order
  ) ORDER BY bu.unit_order) AS units
FROM bookings b
JOIN booking_units bu ON bu.booking_id = b.booking_id
JOIN units u ON u.unit_id = bu.unit_id
GROUP BY b.booking_id
ORDER BY b.created_at DESC
LIMIT 1;

-- Performance check: Index verification
DO $$
BEGIN
  RAISE NOTICE 'Verifying indexes exist:';
  RAISE NOTICE 'Expected: Indexes on booking_id, unit_id, and (booking_id, unit_id) should exist';
  RAISE NOTICE '';
END $$;

SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'booking_units'
  AND schemaname = 'public'
ORDER BY indexname;

-- Final validation summary
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'POST-MIGRATION VALIDATION SUMMARY';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'CRITICAL VALIDATIONS (ALL must pass):';
  RAISE NOTICE '';
  RAISE NOTICE '[ ] Validation 1: All bookings have junction table entries (0 without)';
  RAISE NOTICE '[ ] Validation 2: unit_id column removed from bookings table';
  RAISE NOTICE '[ ] Validation 3: All bookings have is_multi_unit = true';
  RAISE NOTICE '[ ] Validation 4: valid_unit_assignment constraint exists';
  RAISE NOTICE '[ ] Validation 5: Sample bookings show correct structure';
  RAISE NOTICE '';
  RAISE NOTICE 'ADDITIONAL CHECKS (ALL must pass):';
  RAISE NOTICE '';
  RAISE NOTICE '[ ] Total booking count matches pre-migration count';
  RAISE NOTICE '[ ] Junction table row count equals total bookings';
  RAISE NOTICE '[ ] No orphaned junction table entries (0 rows)';
  RAISE NOTICE '[ ] No invalid unit references (0 rows)';
  RAISE NOTICE '[ ] unit_count matches junction entries (0 mismatches)';
  RAISE NOTICE '[ ] No null values in critical fields';
  RAISE NOTICE '[ ] All required indexes exist on booking_units';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IF ANY VALIDATION FAILS:';
  RAISE NOTICE '    → STOP IMMEDIATELY';
  RAISE NOTICE '    → DO NOT DEPLOY APPLICATION CODE';
  RAISE NOTICE '    → Proceed to Rollback Procedure in deployment guide';
  RAISE NOTICE '';
  RAISE NOTICE '✅ IF ALL VALIDATIONS PASS:';
  RAISE NOTICE '    → Migration successful!';
  RAISE NOTICE '    → Proceed to Step 6 (Go/No-Go Decision)';
  RAISE NOTICE '    → Ready to deploy application code';
  RAISE NOTICE '';
  RAISE NOTICE 'Post-migration verification complete!';
  RAISE NOTICE '============================================';
END $$;
