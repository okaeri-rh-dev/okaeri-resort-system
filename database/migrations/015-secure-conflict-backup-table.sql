-- ============================================
-- MIGRATION: 015 - Secure Conflict Backup Table
-- ============================================
-- Description: Enable RLS on bookings_conflict_backup table (addresses Supabase linter warning)
-- Author: Okaeri Resort System
-- Date: 2025-10-06
-- Dependencies: 014-guest-booking-exclusion-constraint-with-cleanup.sql
-- Purpose: Protect booking data in conflict backup table with admin-only RLS policy
-- Note: Run in Supabase SQL Editor or via psql

-- ============================================
-- Enable RLS on Conflict Backup Table
-- ============================================

ALTER TABLE bookings_conflict_backup ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE bookings_conflict_backup IS
    'Backup table for booking conflicts resolved during migration 014. Contains audit trail of auto-cancelled duplicate bookings. Admin-only access via RLS.';

-- ============================================
-- Admin-Only Access Policy
-- ============================================

CREATE POLICY "Admin only access to conflict backups"
    ON bookings_conflict_backup FOR ALL
    USING (is_admin_or_owner(auth.uid()));

COMMENT ON POLICY "Admin only access to conflict backups" ON bookings_conflict_backup IS
    'Only admins and owners can view conflict backup data. Uses SECURITY DEFINER helper to avoid RLS recursion.';

-- ============================================
-- Verification
-- ============================================

-- Check RLS is enabled
SELECT
    schemaname,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE tablename = 'bookings_conflict_backup';

-- Check policy exists
SELECT
    schemaname,
    tablename,
    policyname,
    cmd AS command,
    qual AS using_expression
FROM pg_policies
WHERE tablename = 'bookings_conflict_backup';

-- Migration complete
SELECT '✅ Migration 015 complete: RLS enabled on bookings_conflict_backup with admin-only policy' AS status;
