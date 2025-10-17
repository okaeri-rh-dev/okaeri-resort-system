-- ============================================================================
-- Multi-Unit Booking Migration - Pre-Deployment Verification Script
-- ============================================================================
-- Version: 2.0
-- Created: 2025-10-17
-- Purpose: Read-only validation queries to run on production BEFORE migration
-- Safety: ALL queries are READ-ONLY and safe to execute on production
-- ============================================================================

\echo '============================================'
\echo 'PRE-DEPLOYMENT VERIFICATION SCRIPT'
\echo 'Version 2.0 - Direct-to-Production'
\echo '============================================'
\echo ''

-- Check 1: Total bookings count
\echo '✓ Check 1/7: Counting total bookings...'
SELECT COUNT(*) AS total_bookings FROM bookings;
\echo 'Document this count: _____________'
\echo ''

-- Check 2: Bookings with units assigned
\echo '✓ Check 2/7: Counting bookings with units...'
SELECT COUNT(*) AS bookings_with_units
FROM bookings
WHERE unit_id IS NOT NULL;
\echo 'Expected: Should match total_bookings count'
\echo 'Actual: (see result above)'
\echo ''

-- Check 3: Verify booking_units table is empty
\echo '✓ Check 3/7: Checking booking_units table is empty...'
SELECT COUNT(*) AS booking_units_count FROM booking_units;
\echo 'Expected: 0 (table should be empty before migration)'
\echo 'Actual: (see result above)'
\echo ''

-- Check 4: Check for orphaned bookings
\echo '✓ Check 4/7: Checking for orphaned bookings...'
SELECT COUNT(*) AS orphaned_bookings
FROM bookings b
WHERE unit_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM units u WHERE u.unit_id = b.unit_id
  );
\echo 'Expected: 0 (no bookings pointing to deleted units)'
\echo 'Actual: (see result above)'
\echo ''

-- Check 5: Verify data types
\echo '✓ Check 5/7: Verifying data types...'
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'bookings'
  AND column_name IN ('booking_id', 'unit_id', 'is_multi_unit', 'unit_count')
ORDER BY column_name;
\echo 'Expected:'
\echo '  - booking_id: uuid, NOT NULL'
\echo '  - unit_id: uuid, NULL allowed'
\echo '  - is_multi_unit: boolean, NOT NULL'
\echo '  - unit_count: integer, NOT NULL'
\echo ''

-- Check 6: Recent booking activity
\echo '✓ Check 6/7: Checking recent booking activity...'
SELECT COUNT(*) AS recent_bookings
FROM bookings
WHERE created_at > NOW() - INTERVAL '5 minutes';
\echo 'Expected: Low or zero (should deploy during off-peak hours)'
\echo 'Actual: (see result above)'
\echo ''

-- Check 7: Database size and free space
\echo '✓ Check 7/7: Checking database size and free space...'
SELECT
  pg_database.datname as database_name,
  pg_size_pretty(pg_database_size(pg_database.datname)) AS database_size
FROM pg_database
WHERE datname = current_database();
\echo 'Note: Verify > 30% free space available on database server'
\echo ''

-- Additional diagnostic information
\echo '============================================'
\echo 'ADDITIONAL DIAGNOSTIC INFORMATION'
\echo '============================================'
\echo ''

-- Sample bookings to verify structure
\echo 'Sample of existing bookings (first 5):'
SELECT
  booking_id,
  booking_reference,
  guest_name,
  unit_id,
  is_multi_unit,
  unit_count,
  check_in_date,
  check_out_date,
  total_amount
FROM bookings
ORDER BY created_at DESC
LIMIT 5;
\echo ''

-- Unit statistics
\echo 'Unit statistics:'
SELECT
  COUNT(DISTINCT unit_id) AS total_units,
  COUNT(*) AS total_bookings,
  COUNT(DISTINCT CASE WHEN is_multi_unit = true THEN booking_id END) AS multi_unit_bookings,
  COUNT(DISTINCT CASE WHEN is_multi_unit = false THEN booking_id END) AS single_unit_bookings
FROM bookings
WHERE unit_id IS NOT NULL;
\echo ''

-- Database connections
\echo 'Current database connections:'
SELECT
  count(*) AS total_connections,
  count(*) FILTER (WHERE state = 'active') AS active_connections,
  count(*) FILTER (WHERE state = 'idle') AS idle_connections
FROM pg_stat_activity
WHERE datname = current_database();
\echo ''

-- Check for long-running transactions
\echo 'Long-running transactions (> 1 hour):'
SELECT
  pid,
  usename,
  application_name,
  state,
  query_start,
  age(clock_timestamp(), query_start) AS query_age,
  left(query, 100) AS query_preview
FROM pg_stat_activity
WHERE state != 'idle'
  AND query_start < NOW() - INTERVAL '1 hour'
ORDER BY query_start;
\echo 'Expected: 0 rows (no long-running transactions)'
\echo ''

-- Final validation summary
\echo '============================================'
\echo 'PRE-DEPLOYMENT VALIDATION SUMMARY'
\echo '============================================'
\echo ''
\echo 'ALL checks must pass before proceeding:'
\echo ''
\echo '[ ] Check 1: Total bookings count documented'
\echo '[ ] Check 2: All bookings have unit_id assigned'
\echo '[ ] Check 3: booking_units table is empty (0 rows)'
\echo '[ ] Check 4: No orphaned bookings (0 rows)'
\echo '[ ] Check 5: Data types are correct'
\echo '[ ] Check 6: Recent activity is low (off-peak hours)'
\echo '[ ] Check 7: Database has > 30% free space'
\echo '[ ] No long-running transactions found'
\echo '[ ] Database connections < 80% of max_connections'
\echo ''
\echo '⚠️  IF ANY CHECK FAILS: DO NOT PROCEED WITH MIGRATION'
\echo '✅ IF ALL CHECKS PASS: Proceed to Step 2 (Decision Checkpoint)'
\echo ''
\echo 'Pre-deployment verification complete!'
\echo '============================================'
