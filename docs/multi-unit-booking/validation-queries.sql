-- ============================================
-- POST-MIGRATION VALIDATION QUERIES
-- ============================================
-- Purpose: Comprehensive validation after unified multi-unit migration
-- Usage: psql $DATABASE_URL -f docs/multi-unit-booking/validation-queries.sql
-- Expected: All checks should pass (see comments for expected results)
-- ============================================

\echo '=========================================='
\echo 'UNIFIED MULTI-UNIT MIGRATION VALIDATION'
\echo '=========================================='
\echo ''

-- ============================================
-- CHECK 1: All bookings have junction entries
-- ============================================
\echo 'CHECK 1: Verifying all bookings have booking_units entries...'

SELECT
  CASE
    WHEN bookings_without_units = 0 AND count_mismatch = 0 THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status,
  total_bookings,
  bookings_without_units,
  count_mismatch
FROM (
  SELECT
    COUNT(*) as total_bookings,
    SUM(CASE WHEN junction_count = 0 THEN 1 ELSE 0 END) as bookings_without_units,
    SUM(CASE WHEN junction_count != unit_count THEN 1 ELSE 0 END) as count_mismatch
  FROM (
    SELECT
      b.booking_id,
      b.unit_count,
      COUNT(bu.*) as junction_count
    FROM bookings b
    LEFT JOIN booking_units bu ON bu.booking_id = b.booking_id
    GROUP BY b.booking_id, b.unit_count
  ) AS validation
) AS final;

\echo ''

-- ============================================
-- CHECK 2: unit_id column removed
-- ============================================
\echo 'CHECK 2: Verifying unit_id column removed from bookings table...'

SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✅ PASS - unit_id column removed'
    ELSE '❌ FAIL - unit_id column still exists'
  END as status
FROM information_schema.columns
WHERE table_name = 'bookings' AND column_name = 'unit_id';

\echo ''

-- ============================================
-- CHECK 3: is_multi_unit flag correctness
-- ============================================
\echo 'CHECK 3: Verifying is_multi_unit flag (should be TRUE for all bookings)...'

SELECT
  is_multi_unit,
  COUNT(*) as count,
  CASE
    WHEN is_multi_unit = TRUE THEN '✅ Expected'
    ELSE '⚠️  Unexpected (should be TRUE in unified architecture)'
  END as status
FROM bookings
GROUP BY is_multi_unit
ORDER BY is_multi_unit;

\echo ''

-- ============================================
-- CHECK 4: valid_unit_assignment constraint
-- ============================================
\echo 'CHECK 4: Verifying valid_unit_assignment constraint exists with EXISTS clause...'

SELECT
  constraint_name,
  CASE
    WHEN check_clause LIKE '%EXISTS%booking_units%' THEN '✅ PASS - Correct EXISTS-based constraint'
    ELSE '❌ FAIL - Constraint does not use EXISTS pattern'
  END as status,
  check_clause
FROM information_schema.check_constraints
WHERE constraint_schema = 'public'
  AND table_name = 'bookings'
  AND constraint_name = 'valid_unit_assignment';

\echo ''

-- ============================================
-- CHECK 5: no_overlapping_bookings constraint removed
-- ============================================
\echo 'CHECK 5: Verifying no_overlapping_bookings constraint removed...'

SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✅ PASS - Constraint removed'
    ELSE '❌ FAIL - Constraint still exists'
  END as status
FROM information_schema.table_constraints
WHERE table_name = 'bookings'
  AND constraint_name = 'no_overlapping_bookings';

\echo ''

-- ============================================
-- CHECK 6: Booking counts comparison
-- ============================================
\echo 'CHECK 6: Booking statistics after migration...'

SELECT
  COUNT(*) as total_bookings,
  COUNT(CASE WHEN unit_count = 1 THEN 1 END) as single_unit_bookings,
  COUNT(CASE WHEN unit_count > 1 THEN 1 END) as multi_unit_bookings,
  AVG(unit_count) as avg_units_per_booking,
  SUM(unit_count) as total_units_booked
FROM bookings;

\echo ''

-- ============================================
-- CHECK 7: booking_unit_availability population
-- ============================================
\echo 'CHECK 7: Verifying booking_unit_availability table populated...'

SELECT
  COUNT(DISTINCT bua.booking_id) as bookings_in_availability,
  COUNT(DISTINCT b.booking_id) as total_bookings,
  CASE
    WHEN COUNT(DISTINCT bua.booking_id) = COUNT(DISTINCT b.booking_id)
      THEN '✅ PASS - All bookings have availability records'
    ELSE '⚠️  WARNING - Some bookings missing availability records'
  END as status
FROM bookings b
FULL OUTER JOIN booking_unit_availability bua ON bua.booking_id = b.booking_id;

\echo ''

-- ============================================
-- CHECK 8: Data integrity - unit counts match
-- ============================================
\echo 'CHECK 8: Checking unit_count integrity (unit_count should equal junction entries)...'

WITH mismatches AS (
  SELECT
    b.booking_id,
    b.booking_reference,
    b.unit_count as declared_count,
    COUNT(bu.*) as actual_count
  FROM bookings b
  LEFT JOIN booking_units bu ON bu.booking_id = b.booking_id
  GROUP BY b.booking_id, b.booking_reference, b.unit_count
  HAVING b.unit_count != COUNT(bu.*)
)
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✅ PASS - All unit counts match'
    ELSE '❌ FAIL - ' || COUNT(*) || ' bookings have mismatched unit counts'
  END as status,
  COALESCE(json_agg(json_build_object(
    'booking_id', booking_id,
    'booking_reference', booking_reference,
    'declared_count', declared_count,
    'actual_count', actual_count
  )), '[]'::json) as mismatches
FROM mismatches;

\echo ''

-- ============================================
-- CHECK 9: Sample booking verification
-- ============================================
\echo 'CHECK 9: Sample booking verification (first 3 bookings)...'

SELECT
  b.booking_id,
  b.booking_reference,
  b.is_multi_unit,
  b.unit_count,
  b.total_amount,
  json_agg(json_build_object(
    'unit_id', bu.unit_id,
    'unit_code', u.unit_code,
    'unit_name', u.unit_name,
    'unit_price', bu.unit_price,
    'subtotal', bu.subtotal,
    'assigned_guests', bu.assigned_guests
  ) ORDER BY u.unit_code) as units
FROM bookings b
JOIN booking_units bu ON bu.booking_id = b.booking_id
JOIN units u ON u.unit_id = bu.unit_id
GROUP BY b.booking_id, b.booking_reference, b.is_multi_unit, b.unit_count, b.total_amount
ORDER BY b.created_at DESC
LIMIT 3;

\echo ''

-- ============================================
-- CHECK 10: Trigger verification
-- ============================================
\echo 'CHECK 10: Verifying update_booking_totals trigger function uses >= 1 logic...'

SELECT
  pg_get_functiondef(oid) LIKE '%COUNT(*) >= 1%' as has_correct_logic,
  CASE
    WHEN pg_get_functiondef(oid) LIKE '%COUNT(*) >= 1%' THEN '✅ PASS - Trigger uses >= 1 logic'
    ELSE '❌ FAIL - Trigger still uses > 1 logic'
  END as status
FROM pg_proc
WHERE proname = 'update_booking_totals';

\echo ''

-- ============================================
-- CHECK 11: Orphaned records check
-- ============================================
\echo 'CHECK 11: Checking for orphaned booking_units (should be 0)...'

SELECT
  COUNT(*) as orphaned_booking_units,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ PASS - No orphaned booking_units'
    ELSE '⚠️  WARNING - ' || COUNT(*) || ' orphaned booking_units found'
  END as status
FROM booking_units bu
WHERE NOT EXISTS (
  SELECT 1 FROM bookings b WHERE b.booking_id = bu.booking_id
);

\echo ''

-- ============================================
-- CHECK 12: Foreign key integrity
-- ============================================
\echo 'CHECK 12: Verifying foreign key constraints...'

SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  '✅ EXISTS' as status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('bookings', 'booking_units', 'booking_unit_availability')
ORDER BY tc.table_name, tc.constraint_name;

\echo ''

-- ============================================
-- CHECK 13: Performance check - query execution time
-- ============================================
\echo 'CHECK 13: Testing query performance (should be < 100ms)...'

\timing on

EXPLAIN ANALYZE
SELECT
  b.booking_id,
  b.booking_reference,
  b.guest_name,
  b.check_in,
  b.check_out,
  b.total_amount,
  json_agg(json_build_object(
    'unit_code', u.unit_code,
    'unit_name', u.unit_name
  )) as units
FROM bookings b
JOIN booking_units bu ON bu.booking_id = b.booking_id
JOIN units u ON u.unit_id = bu.unit_id
WHERE b.check_in >= CURRENT_DATE
GROUP BY b.booking_id, b.booking_reference, b.guest_name, b.check_in, b.check_out, b.total_amount
ORDER BY b.check_in
LIMIT 50;

\timing off

\echo ''

-- ============================================
-- SUMMARY REPORT
-- ============================================
\echo '=========================================='
\echo 'VALIDATION SUMMARY'
\echo '=========================================='

WITH validation_summary AS (
  SELECT
    'Total Bookings' as metric,
    COUNT(*)::text as value
  FROM bookings

  UNION ALL

  SELECT
    'Bookings with junction entries',
    COUNT(DISTINCT bu.booking_id)::text
  FROM booking_units bu

  UNION ALL

  SELECT
    'Average units per booking',
    ROUND(AVG(unit_count), 2)::text
  FROM bookings

  UNION ALL

  SELECT
    'Bookings with is_multi_unit = TRUE',
    COUNT(*)::text
  FROM bookings
  WHERE is_multi_unit = TRUE

  UNION ALL

  SELECT
    'Unit_id column exists',
    CASE
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'bookings' AND column_name = 'unit_id'
      ) THEN 'YES ❌'
      ELSE 'NO ✅'
    END

  UNION ALL

  SELECT
    'valid_unit_assignment constraint type',
    CASE
      WHEN EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'valid_unit_assignment'
          AND check_clause LIKE '%EXISTS%'
      ) THEN 'EXISTS-based ✅'
      ELSE 'Dual-path ❌'
    END
)
SELECT * FROM validation_summary;

\echo ''
\echo '=========================================='
\echo 'VALIDATION COMPLETE'
\echo '=========================================='
\echo ''
\echo 'If all checks passed:'
\echo '  - Migration is successful ✅'
\echo '  - Safe to deploy code updates'
\echo '  - Monitor for 24 hours post-deployment'
\echo ''
\echo 'If any checks failed:'
\echo '  - Review failure details above'
\echo '  - Consider rolling back migration'
\echo '  - Contact database team for assistance'
\echo ''
