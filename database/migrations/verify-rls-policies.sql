-- ============================================
-- VERIFICATION SCRIPT: RLS POLICIES
-- ============================================
-- Run this AFTER applying quick-fix-403-rls.sql
-- to verify the policies are correctly configured
-- ============================================

-- Query 1: Check all policies (should be exactly 4 per table)
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('units', 'bookings', 'guests', 'payments', 'expenses', 'maintenance_logs')
ORDER BY tablename, cmd;

-- Query 2: Count policies per table (should be 4)
SELECT
  tablename,
  COUNT(*) as policy_count,
  CASE
    WHEN COUNT(*) = 4 THEN '✅ CORRECT'
    WHEN COUNT(*) = 5 THEN '❌ DUPLICATE DETECTED'
    ELSE '⚠️ UNEXPECTED COUNT'
  END as status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('units', 'bookings', 'guests', 'payments', 'expenses', 'maintenance_logs')
GROUP BY tablename
ORDER BY tablename;

-- Query 3: Check for legacy policies (should return 0 rows)
SELECT
  tablename,
  policyname,
  '❌ LEGACY POLICY FOUND' as issue
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname = 'Enable all for authenticated users';

-- Query 4: Verify all policies use auth.uid()
SELECT
  tablename,
  policyname,
  cmd,
  CASE
    WHEN qual LIKE '%auth.uid()%' OR qual IS NULL THEN '✅ Uses auth.uid()'
    WHEN qual LIKE '%auth.role()%' THEN '❌ Uses auth.role()'
    ELSE '⚠️ Unknown condition'
  END as qual_check,
  CASE
    WHEN with_check LIKE '%auth.uid()%' OR with_check IS NULL THEN '✅ Uses auth.uid()'
    WHEN with_check LIKE '%auth.role()%' THEN '❌ Uses auth.role()'
    ELSE '⚠️ Unknown condition'
  END as with_check_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('units', 'bookings', 'guests', 'payments', 'expenses', 'maintenance_logs')
ORDER BY tablename, cmd;

-- ============================================
-- EXPECTED RESULTS
-- ============================================
-- Query 1: Should show 24 rows (4 policies × 6 tables)
--   - Each table should have: SELECT, INSERT, UPDATE, DELETE
--   - All should use auth.uid() IS NOT NULL
--
-- Query 2: Should show:
--   bookings      | 4 | ✅ CORRECT
--   expenses      | 4 | ✅ CORRECT
--   guests        | 4 | ✅ CORRECT
--   maintenance_logs | 4 | ✅ CORRECT
--   payments      | 4 | ✅ CORRECT
--   units         | 4 | ✅ CORRECT
--
-- Query 3: Should return 0 rows (no legacy policies)
--
-- Query 4: All rows should show ✅ in both columns
-- ============================================

-- ============================================
-- TEST RLS WITH AUTHENTICATED SESSION
-- ============================================
-- These queries test actual RLS behavior
-- Run these in your Supabase SQL Editor AFTER logging in

-- Test 1: SELECT (should work)
-- SELECT * FROM units LIMIT 1;

-- Test 2: INSERT (should work)
-- INSERT INTO units (unit_code, unit_name, unit_type, base_occupancy, max_occupancy, base_rate)
-- VALUES ('TEST-1', 'Test Unit', 'Standard', 2, 4, 1000.00);

-- Test 3: UPDATE (should work)
-- UPDATE units SET unit_status = 'Maintenance' WHERE unit_code = 'TEST-1';

-- Test 4: DELETE (should work)
-- DELETE FROM units WHERE unit_code = 'TEST-1';

-- If all 4 operations work, your RLS is correctly configured! ✅
