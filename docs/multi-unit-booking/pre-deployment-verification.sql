-- ============================================================================
-- Multi-Unit Booking Migration - Pre-Deployment Verification Script
-- ============================================================================
-- Version: 2.2
-- Created: 2025-10-17
-- Updated: 2025-10-17 (Fixed: removed non-existent columns from queries)
-- Purpose: Read-only validation queries to run on production BEFORE migration
-- Safety: ALL queries are READ-ONLY and safe to execute on production
-- Usage: Copy/paste into Supabase SQL Editor
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'PRE-DEPLOYMENT VERIFICATION SCRIPT';
  RAISE NOTICE 'Version 2.2 - Fixed Pre-Migration Column Queries';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
END $$;

-- Check 1: Total bookings count
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM bookings;
  RAISE NOTICE '✓ Check 1/7: Total bookings count';
  RAISE NOTICE '  Result: % bookings', v_count;
  RAISE NOTICE '  Action: Document this number: _______';
  RAISE NOTICE '';
END $$;

-- Check 2: Bookings with units assigned
DO $$
DECLARE
  v_with_units INTEGER;
  v_total INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total FROM bookings;
  SELECT COUNT(*) INTO v_with_units FROM bookings WHERE unit_id IS NOT NULL;
  RAISE NOTICE '✓ Check 2/7: Bookings with units assigned';
  RAISE NOTICE '  Result: % bookings with unit_id', v_with_units;
  RAISE NOTICE '  Expected: Should match total (%) ', v_total;
  RAISE NOTICE '  Status: %', CASE WHEN v_with_units = v_total THEN '✅ PASS' ELSE '❌ FAIL' END;
  RAISE NOTICE '';
END $$;

-- Check 3: Verify booking_units table state
DO $$
DECLARE
  v_count INTEGER;
  v_table_exists BOOLEAN;
BEGIN
  -- Check if table exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'booking_units'
  ) INTO v_table_exists;

  IF v_table_exists THEN
    SELECT COUNT(*) INTO v_count FROM booking_units;
    RAISE NOTICE '✓ Check 3/7: booking_units table state';
    RAISE NOTICE '  Result: % existing entries', v_count;
    RAISE NOTICE '  Expected: 0 (table should be empty before migration)';
    RAISE NOTICE '  Status: %', CASE WHEN v_count = 0 THEN '✅ PASS' ELSE '⚠️  WARNING (will be handled by migration)' END;
  ELSE
    RAISE NOTICE '✓ Check 3/7: booking_units table state';
    RAISE NOTICE '  Result: Table does not exist';
    RAISE NOTICE '  Status: ✅ PASS (will be created by migration)';
  END IF;
  RAISE NOTICE '';
END $$;

-- Check 4: Check for orphaned bookings
DO $$
DECLARE
  v_orphaned INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_orphaned
  FROM bookings b
  WHERE unit_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM units u WHERE u.unit_id = b.unit_id);

  RAISE NOTICE '✓ Check 4/7: Orphaned bookings (pointing to deleted units)';
  RAISE NOTICE '  Result: % orphaned bookings', v_orphaned;
  RAISE NOTICE '  Expected: 0';
  RAISE NOTICE '  Status: %', CASE WHEN v_orphaned = 0 THEN '✅ PASS' ELSE '❌ FAIL - Fix before migration!' END;
  RAISE NOTICE '';
END $$;

-- Check 5: Verify data types
DO $$
BEGIN
  RAISE NOTICE '✓ Check 5/7: Column data types';
  RAISE NOTICE '  Existing columns: booking_id=uuid, unit_id=uuid';
  RAISE NOTICE '  Will be added: is_multi_unit=boolean, unit_count=integer';
  RAISE NOTICE '  Review the query result below (should show booking_id and unit_id only):';
END $$;

SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'bookings'
  AND column_name IN ('booking_id', 'unit_id', 'is_multi_unit', 'unit_count')
ORDER BY column_name;

-- Check 6: Recent booking activity
DO $$
DECLARE
  v_recent INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_recent
  FROM bookings
  WHERE created_at > NOW() - INTERVAL '5 minutes';

  RAISE NOTICE '✓ Check 6/7: Recent booking activity';
  RAISE NOTICE '  Result: % bookings in last 5 minutes', v_recent;
  RAISE NOTICE '  Expected: Low or zero (deploy during off-peak hours)';
  RAISE NOTICE '  Status: %', CASE WHEN v_recent <= 2 THEN '✅ PASS (low activity)' ELSE '⚠️  WARNING (consider waiting for off-peak)' END;
  RAISE NOTICE '';
END $$;

-- Check 7: Database size
DO $$
DECLARE
  v_db_name TEXT;
  v_db_size TEXT;
BEGIN
  SELECT current_database() INTO v_db_name;
  SELECT pg_size_pretty(pg_database_size(current_database())) INTO v_db_size;

  RAISE NOTICE '✓ Check 7/7: Database size';
  RAISE NOTICE '  Database: %', v_db_name;
  RAISE NOTICE '  Size: %', v_db_size;
  RAISE NOTICE '  Action: Verify > 30%% free space in Supabase Dashboard';
  RAISE NOTICE '';
END $$;

-- Additional diagnostic information
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'ADDITIONAL DIAGNOSTIC INFORMATION';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Sample bookings (first 5):';
END $$;

SELECT
  booking_id,
  booking_reference,
  guest_name,
  unit_id,
  check_in_date,
  check_out_date,
  total_amount,
  status
FROM bookings
ORDER BY created_at DESC
LIMIT 5;

-- Unit statistics
DO $$
DECLARE
  v_total_units INTEGER;
  v_total_bookings INTEGER;
BEGIN
  SELECT
    COUNT(DISTINCT unit_id),
    COUNT(*)
  INTO v_total_units, v_total_bookings
  FROM bookings
  WHERE unit_id IS NOT NULL;

  RAISE NOTICE 'Unit statistics:';
  RAISE NOTICE '  Total unique units in use: %', v_total_units;
  RAISE NOTICE '  Total bookings: %', v_total_bookings;
  RAISE NOTICE '  Note: Multi-unit flags will be added by migration';
  RAISE NOTICE '';
END $$;

-- Database connections
DO $$
DECLARE
  v_total INTEGER;
  v_active INTEGER;
  v_idle INTEGER;
BEGIN
  SELECT
    count(*),
    count(*) FILTER (WHERE state = 'active'),
    count(*) FILTER (WHERE state = 'idle')
  INTO v_total, v_active, v_idle
  FROM pg_stat_activity
  WHERE datname = current_database();

  RAISE NOTICE 'Current database connections:';
  RAISE NOTICE '  Total: %', v_total;
  RAISE NOTICE '  Active: %', v_active;
  RAISE NOTICE '  Idle: %', v_idle;
  RAISE NOTICE '';
END $$;

-- Check for long-running transactions
DO $$
DECLARE
  v_long_running INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_long_running
  FROM pg_stat_activity
  WHERE state != 'idle'
    AND query_start < NOW() - INTERVAL '1 hour';

  RAISE NOTICE 'Long-running transactions (> 1 hour):';
  RAISE NOTICE '  Count: %', v_long_running;
  RAISE NOTICE '  Expected: 0';
  RAISE NOTICE '  Status: %', CASE WHEN v_long_running = 0 THEN '✅ PASS' ELSE '⚠️  WARNING (review transactions before migration)' END;
  RAISE NOTICE '';
END $$;

-- Final validation summary
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'PRE-DEPLOYMENT VALIDATION SUMMARY';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Review all checks above. ALL must pass before proceeding:';
  RAISE NOTICE '';
  RAISE NOTICE '[ ] Check 1: Total bookings count documented';
  RAISE NOTICE '[ ] Check 2: All bookings have unit_id assigned';
  RAISE NOTICE '[ ] Check 3: booking_units table state acceptable';
  RAISE NOTICE '[ ] Check 4: No orphaned bookings (0 rows)';
  RAISE NOTICE '[ ] Check 5: Data types are correct';
  RAISE NOTICE '[ ] Check 6: Recent activity is low (off-peak hours)';
  RAISE NOTICE '[ ] Check 7: Database has adequate free space';
  RAISE NOTICE '[ ] No long-running transactions found';
  RAISE NOTICE '[ ] Database connections < 80%% of max_connections';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IF ANY CHECK FAILS: DO NOT PROCEED WITH MIGRATION';
  RAISE NOTICE '✅ IF ALL CHECKS PASS: Proceed to Step 2 (Decision Checkpoint)';
  RAISE NOTICE '';
  RAISE NOTICE 'Pre-deployment verification complete!';
  RAISE NOTICE '============================================';
END $$;
