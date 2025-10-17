-- ============================================================================
-- Multi-Unit Booking Migration - Post-Migration Verification Script
-- ============================================================================
-- Version: 2.0
-- Created: 2025-10-17
-- Purpose: Validation queries to run AFTER migration completes
-- Safety: All queries are READ-ONLY (SELECT only)
-- Usage: Run immediately after migration to verify success
-- ============================================================================

\echo '============================================'
\echo 'POST-MIGRATION VERIFICATION SCRIPT'
\echo 'Version 2.0 - Direct-to-Production'
\echo '============================================'
\echo ''

-- Validation Query 1: Check all bookings have units in junction table
\echo '✓ Validation 1/5: Checking all bookings have junction table entries...'
SELECT COUNT(*) AS bookings_without_units
FROM bookings b
WHERE NOT EXISTS (
  SELECT 1 FROM booking_units bu WHERE bu.booking_id = b.booking_id
);
\echo 'Expected: 0 (all bookings must have at least one unit)'
\echo 'Actual: (see result above)'
\echo ''

-- Validation Query 2: Check unit_id column is removed
\echo '✓ Validation 2/5: Verifying unit_id column is removed...'
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'bookings' AND column_name = 'unit_id';
\echo 'Expected: 0 rows (unit_id column should be dropped)'
\echo 'Actual: (see result above)'
\echo ''

-- Validation Query 3: Check is_multi_unit flag
\echo '✓ Validation 3/5: Checking is_multi_unit flag...'
SELECT COUNT(*) AS non_multi_unit
FROM bookings
WHERE is_multi_unit = FALSE;
\echo 'Expected: 0 (all bookings should be multi_unit = true)'
\echo 'Actual: (see result above)'
\echo ''

-- Validation Query 4: Verify constraint exists
\echo '✓ Validation 4/5: Verifying valid_unit_assignment constraint exists...'
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'bookings'
  AND constraint_name = 'valid_unit_assignment';
\echo 'Expected: 1 row with constraint_type = CHECK'
\echo 'Actual: (see result above)'
\echo ''

-- Validation Query 5: Sample booking with units
\echo '✓ Validation 5/5: Sampling bookings with units...'
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
\echo 'Expected: 5 bookings with properly formatted units array'
\echo 'Verify: Each booking shows units array with unit details'
\echo ''

-- Additional verification checks
\echo '============================================'
\echo 'ADDITIONAL VERIFICATION CHECKS'
\echo '============================================'
\echo ''

-- Check total counts match pre-migration
\echo 'Total booking count (compare with pre-migration count):'
SELECT COUNT(*) AS total_bookings_after_migration
FROM bookings;
\echo 'Expected: Must match pre-migration count documented earlier'
\echo ''

-- Check junction table row count
\echo 'Junction table row count:'
SELECT COUNT(*) AS total_booking_units
FROM booking_units;
\echo 'Expected: Should equal total_bookings (all are single-unit converted to multi-unit)'
\echo ''

-- Check for orphaned junction table entries
\echo 'Checking for orphaned junction table entries:'
SELECT COUNT(*) AS orphaned_units
FROM booking_units bu
WHERE NOT EXISTS (
  SELECT 1 FROM bookings b WHERE b.booking_id = bu.booking_id
);
\echo 'Expected: 0 (no orphaned entries in junction table)'
\echo ''

-- Check for orphaned units references
\echo 'Checking for invalid unit references:'
SELECT COUNT(*) AS invalid_unit_references
FROM booking_units bu
WHERE NOT EXISTS (
  SELECT 1 FROM units u WHERE u.unit_id = bu.unit_id
);
\echo 'Expected: 0 (all unit_ids in booking_units must exist in units table)'
\echo ''

-- Verify unit_count matches junction table entries
\echo 'Verifying unit_count matches junction table entries:'
SELECT
  COUNT(*) AS mismatched_unit_counts
FROM bookings b
WHERE b.unit_count != (
  SELECT COUNT(*)
  FROM booking_units bu
  WHERE bu.booking_id = b.booking_id
);
\echo 'Expected: 0 (unit_count should match number of junction table entries)'
\echo ''

-- Check for null values in critical fields
\echo 'Checking for null values in critical fields:'
SELECT
  COUNT(*) FILTER (WHERE booking_id IS NULL) AS null_booking_ids,
  COUNT(*) FILTER (WHERE is_multi_unit IS NULL) AS null_multi_unit_flags,
  COUNT(*) FILTER (WHERE unit_count IS NULL) AS null_unit_counts,
  COUNT(*) FILTER (WHERE unit_count < 1) AS invalid_unit_counts
FROM bookings;
\echo 'Expected: All counts should be 0'
\echo ''

-- Sample booking details with full structure
\echo 'Sample booking with complete structure:'
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
\echo ''

-- Performance check: Index verification
\echo 'Verifying indexes exist:'
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'booking_units'
  AND schemaname = 'public'
ORDER BY indexname;
\echo 'Expected: Indexes on booking_id, unit_id, and (booking_id, unit_id) should exist'
\echo ''

-- Final validation summary
\echo '============================================'
\echo 'POST-MIGRATION VALIDATION SUMMARY'
\echo '============================================'
\echo ''
\echo 'CRITICAL VALIDATIONS (ALL must pass):'
\echo ''
\echo '[ ] Validation 1: All bookings have junction table entries (0 without)'
\echo '[ ] Validation 2: unit_id column removed from bookings table'
\echo '[ ] Validation 3: All bookings have is_multi_unit = true'
\echo '[ ] Validation 4: valid_unit_assignment constraint exists'
\echo '[ ] Validation 5: Sample bookings show correct structure'
\echo ''
\echo 'ADDITIONAL CHECKS (ALL must pass):'
\echo ''
\echo '[ ] Total booking count matches pre-migration count'
\echo '[ ] Junction table row count equals total bookings'
\echo '[ ] No orphaned junction table entries (0 rows)'
\echo '[ ] No invalid unit references (0 rows)'
\echo '[ ] unit_count matches junction entries (0 mismatches)'
\echo '[ ] No null values in critical fields'
\echo '[ ] All required indexes exist on booking_units'
\echo ''
\echo '⚠️  IF ANY VALIDATION FAILS:'
\echo '    → STOP IMMEDIATELY'
\echo '    → DO NOT DEPLOY APPLICATION CODE'
\echo '    → Proceed to Rollback Procedure in deployment guide'
\echo ''
\echo '✅ IF ALL VALIDATIONS PASS:'
\echo '    → Migration successful!'
\echo '    → Proceed to Step 6 (Go/No-Go Decision)'
\echo '    → Ready to deploy application code'
\echo ''
\echo 'Post-migration verification complete!'
\echo '============================================'
