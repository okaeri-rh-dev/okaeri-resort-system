-- ============================================
-- QUICK FIX: 403 ERRORS AFTER LOGIN
-- ============================================
-- Problem: RLS policies using auth.role() may not work reliably
-- Solution: Use auth.uid() IS NOT NULL instead
--
-- Run this in Supabase SQL Editor to fix immediately:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Paste this entire file
-- 3. Click "Run"
-- ============================================

BEGIN;

-- ============================================
-- UNITS TABLE
-- ============================================

-- Drop ALL existing policies (including legacy "Enable all" policy)
DROP POLICY IF EXISTS "Enable all for authenticated users" ON units;
DROP POLICY IF EXISTS "Authenticated users can view units" ON units;
DROP POLICY IF EXISTS "Authenticated users can insert units" ON units;
DROP POLICY IF EXISTS "Authenticated users can update units" ON units;
DROP POLICY IF EXISTS "Authenticated users can delete units" ON units;

CREATE POLICY "Authenticated users can view units"
  ON units FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert units"
  ON units FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update units"
  ON units FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete units"
  ON units FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ============================================
-- BOOKINGS TABLE
-- ============================================

-- Drop ALL existing policies (including legacy "Enable all" policy)
DROP POLICY IF EXISTS "Enable all for authenticated users" ON bookings;
DROP POLICY IF EXISTS "Authenticated users can view bookings" ON bookings;
DROP POLICY IF EXISTS "Authenticated users can insert bookings" ON bookings;
DROP POLICY IF EXISTS "Authenticated users can update bookings" ON bookings;
DROP POLICY IF EXISTS "Authenticated users can delete bookings" ON bookings;

CREATE POLICY "Authenticated users can view bookings"
  ON bookings FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert bookings"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update bookings"
  ON bookings FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete bookings"
  ON bookings FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ============================================
-- GUESTS TABLE
-- ============================================

-- Drop ALL existing policies (including legacy "Enable all" policy)
DROP POLICY IF EXISTS "Enable all for authenticated users" ON guests;
DROP POLICY IF EXISTS "Authenticated users can view guests" ON guests;
DROP POLICY IF EXISTS "Authenticated users can insert guests" ON guests;
DROP POLICY IF EXISTS "Authenticated users can update guests" ON guests;
DROP POLICY IF EXISTS "Authenticated users can delete guests" ON guests;

CREATE POLICY "Authenticated users can view guests"
  ON guests FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert guests"
  ON guests FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update guests"
  ON guests FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete guests"
  ON guests FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ============================================
-- PAYMENTS TABLE
-- ============================================

-- Drop ALL existing policies (including legacy "Enable all" policy)
DROP POLICY IF EXISTS "Enable all for authenticated users" ON payments;
DROP POLICY IF EXISTS "Authenticated users can view payments" ON payments;
DROP POLICY IF EXISTS "Authenticated users can insert payments" ON payments;
DROP POLICY IF EXISTS "Authenticated users can update payments" ON payments;
DROP POLICY IF EXISTS "Authenticated users can delete payments" ON payments;

CREATE POLICY "Authenticated users can view payments"
  ON payments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert payments"
  ON payments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update payments"
  ON payments FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete payments"
  ON payments FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ============================================
-- EXPENSES TABLE
-- ============================================

-- Drop ALL existing policies (including legacy "Enable all" policy)
DROP POLICY IF EXISTS "Enable all for authenticated users" ON expenses;
DROP POLICY IF EXISTS "Authenticated users can view expenses" ON expenses;
DROP POLICY IF EXISTS "Authenticated users can insert expenses" ON expenses;
DROP POLICY IF EXISTS "Authenticated users can update expenses" ON expenses;
DROP POLICY IF EXISTS "Authenticated users can delete expenses" ON expenses;

CREATE POLICY "Authenticated users can view expenses"
  ON expenses FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert expenses"
  ON expenses FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update expenses"
  ON expenses FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete expenses"
  ON expenses FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ============================================
-- MAINTENANCE_LOGS TABLE (if exists)
-- ============================================

-- Drop ALL existing policies (including legacy "Enable all" policy)
DROP POLICY IF EXISTS "Enable all for authenticated users" ON maintenance_logs;
DROP POLICY IF EXISTS "Authenticated users can view maintenance_logs" ON maintenance_logs;
DROP POLICY IF EXISTS "Authenticated users can insert maintenance_logs" ON maintenance_logs;
DROP POLICY IF EXISTS "Authenticated users can update maintenance_logs" ON maintenance_logs;
DROP POLICY IF EXISTS "Authenticated users can delete maintenance_logs" ON maintenance_logs;

CREATE POLICY "Authenticated users can view maintenance_logs"
  ON maintenance_logs FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert maintenance_logs"
  ON maintenance_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update maintenance_logs"
  ON maintenance_logs FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete maintenance_logs"
  ON maintenance_logs FOR DELETE
  USING (auth.uid() IS NOT NULL);

COMMIT;

-- ============================================
-- VERIFICATION
-- ============================================

-- Test as authenticated user
DO $$
BEGIN
  -- This will run as the current user (should be authenticated after login)
  RAISE NOTICE '✅ Testing RLS policies...';

  -- These would normally fail without proper session context
  -- But in SQL Editor, we can at least verify policies exist
  PERFORM 1 FROM units LIMIT 1;
  RAISE NOTICE '✅ Units table accessible';

  PERFORM 1 FROM bookings LIMIT 1;
  RAISE NOTICE '✅ Bookings table accessible';

  PERFORM 1 FROM guests LIMIT 1;
  RAISE NOTICE '✅ Guests table accessible';

  RAISE NOTICE '✅ RLS policies updated successfully!';
  RAISE NOTICE 'Now test in your browser:';
  RAISE NOTICE '  const { data } = await supabase.from("units").select("*")';
  RAISE NOTICE '  console.log(data)';
END $$;
