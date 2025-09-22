-- ============================================
-- ENABLE ROW LEVEL SECURITY FOR PHASE 1
-- ============================================
-- Run this script in Supabase SQL Editor after creating tables

-- Enable RLS on all tables
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CREATE POLICIES FOR PHASE 1
-- ============================================
-- Phase 1: Simple admin-only access (all authenticated users)
-- Phase 2: Will add role-based policies

-- Units table policies
CREATE POLICY "Authenticated users can view units"
  ON units FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert units"
  ON units FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update units"
  ON units FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete units"
  ON units FOR DELETE
  USING (auth.role() = 'authenticated');

-- Guests table policies
CREATE POLICY "Authenticated users can view guests"
  ON guests FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert guests"
  ON guests FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update guests"
  ON guests FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete guests"
  ON guests FOR DELETE
  USING (auth.role() = 'authenticated');

-- Bookings table policies
CREATE POLICY "Authenticated users can view bookings"
  ON bookings FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert bookings"
  ON bookings FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update bookings"
  ON bookings FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete bookings"
  ON bookings FOR DELETE
  USING (auth.role() = 'authenticated');

-- Payments table policies
CREATE POLICY "Authenticated users can view payments"
  ON payments FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert payments"
  ON payments FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update payments"
  ON payments FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete payments"
  ON payments FOR DELETE
  USING (auth.role() = 'authenticated');

-- Expenses table policies
CREATE POLICY "Authenticated users can view expenses"
  ON expenses FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert expenses"
  ON expenses FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update expenses"
  ON expenses FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete expenses"
  ON expenses FOR DELETE
  USING (auth.role() = 'authenticated');

-- Maintenance logs table policies
CREATE POLICY "Authenticated users can view maintenance_logs"
  ON maintenance_logs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert maintenance_logs"
  ON maintenance_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update maintenance_logs"
  ON maintenance_logs FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete maintenance_logs"
  ON maintenance_logs FOR DELETE
  USING (auth.role() = 'authenticated');

-- ============================================
-- STORAGE BUCKET CONFIGURATION
-- ============================================
-- Storage buckets and policies CANNOT be configured via SQL
-- You must configure them through the Supabase Dashboard
--
-- INSTRUCTIONS FOR STORAGE SETUP:
--
-- 1. Go to Supabase Dashboard > Storage
-- 2. Create buckets:
--    a. Click "New bucket"
--    b. Name: "payment-proofs"
--    c. Public bucket: OFF (keep it private)
--    d. Click "Create bucket"
--    e. Repeat for "receipts" bucket
--
-- 3. Configure bucket policies:
--    a. Click on the bucket name
--    b. Click "Policies" tab
--    c. Click "New policy"
--    d. Use "For authenticated users only" template
--    e. Enable all operations (SELECT, INSERT, UPDATE, DELETE)
--    f. Save policy
--
-- 4. The buckets will automatically have RLS enabled
--
-- Note: Storage policies through the Dashboard are more secure
-- than SQL policies as they're managed by Supabase's system.

-- Create storage buckets (this part still works via SQL)
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT DO NOTHING;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify RLS is enabled:

-- Check RLS status on tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- Check policies
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public';

-- ============================================
-- IMPORTANT NOTES
-- ============================================
-- 1. After running this script, all database access requires authentication
-- 2. Make sure to create at least one admin user in Supabase Auth
-- 3. Test all operations after enabling RLS
-- 4. Monitor for any access issues in your application logs