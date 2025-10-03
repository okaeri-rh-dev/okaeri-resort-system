-- ============================================
-- MIGRATION: 012 - Fix app_roles RLS Infinite Recursion
-- ============================================
-- Description: Fixes infinite recursion in app_roles RLS policies by using SECURITY DEFINER helpers
-- Author: Okaeri Resort System - Audit Trail Phase 2E Hotfix
-- Date: 2025-10-02
-- Dependencies: 009-enable-audit-rls.sql
-- Issue: app_roles SELECT policy recursively queries app_roles, causing infinite recursion
--        when audit_logs INSERT trigger checks permissions via app_roles lookup

-- ============================================
-- TRANSACTION WRAPPER (Supabase SQL Editor Compatible)
-- ============================================
-- Provides same atomic rollback behavior as \set ON_ERROR_STOP on
-- If any command fails, entire migration rolls back

BEGIN;

-- ============================================
-- ROOT CAUSE ANALYSIS
-- ============================================
-- Problem: Circular RLS dependency
--   1. audit_logs INSERT → BEFORE INSERT trigger
--   2. Trigger checks RLS SELECT policy on audit_logs
--   3. audit_logs SELECT policy queries app_roles (EXISTS check)
--   4. app_roles SELECT policy queries app_roles AGAIN (admin check)
--   5. Infinite recursion detected by PostgreSQL → 42P17 error
--
-- Solution: Use SECURITY DEFINER functions to bypass RLS recursion
--   - Functions marked SECURITY DEFINER run with creator privileges
--   - They bypass RLS policies entirely, breaking the recursion chain
--   - Safe because logic is encapsulated in controlled functions

-- ============================================
-- HELPER FUNCTION: Check Admin/Owner Role
-- ============================================
-- Purpose: Check if a user has admin or owner role WITHOUT triggering RLS recursion
-- Security: SECURITY DEFINER bypasses RLS policies on app_roles table
--           This is safe because the function logic is controlled and auditable

CREATE OR REPLACE FUNCTION is_admin_or_owner(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Direct query bypasses RLS recursion
    -- SECURITY DEFINER allows this function to see all app_roles rows
    RETURN EXISTS (
        SELECT 1 FROM app_roles
        WHERE user_id = check_user_id
          AND role IN ('admin', 'owner')
          AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_admin_or_owner(UUID) IS
    'SECURITY DEFINER helper to check admin/owner role without RLS recursion. Used by RLS policies to break circular dependencies.';

-- ============================================
-- HELPER FUNCTION: Check Manager Role
-- ============================================

CREATE OR REPLACE FUNCTION is_manager(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM app_roles
        WHERE user_id = check_user_id
          AND role = 'manager'
          AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_manager(UUID) IS
    'SECURITY DEFINER helper to check manager role without RLS recursion.';

-- ============================================
-- HELPER FUNCTION: Check Admin Role (for app_roles management)
-- ============================================

CREATE OR REPLACE FUNCTION is_admin(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM app_roles
        WHERE user_id = check_user_id
          AND role = 'admin'
          AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_admin(UUID) IS
    'SECURITY DEFINER helper to check admin role without RLS recursion. Used for app_roles management policies.';

-- ============================================
-- FIX: app_roles SELECT POLICY
-- ============================================
-- Remove recursive EXISTS check that caused infinite recursion

DROP POLICY IF EXISTS "app_roles_select_policy" ON app_roles;

CREATE POLICY "app_roles_select_policy"
ON app_roles
FOR SELECT
USING (
    -- Users can see their own role (no recursion, direct column check)
    user_id = auth.uid()
    OR
    -- Admins can see all roles (uses SECURITY DEFINER helper to avoid recursion)
    is_admin(auth.uid())
);

COMMENT ON POLICY "app_roles_select_policy" ON app_roles IS
    'Fixed: Uses is_admin() SECURITY DEFINER helper to avoid infinite recursion. Users see own role, admins see all.';

-- ============================================
-- FIX: audit_logs SELECT POLICY
-- ============================================
-- Use SECURITY DEFINER helpers instead of direct EXISTS checks

DROP POLICY IF EXISTS "audit_logs_select_policy" ON audit_logs;

CREATE POLICY "audit_logs_select_policy"
ON audit_logs
FOR SELECT
USING (
    -- ============================================
    -- ADMIN & OWNER: Full Access
    -- ============================================
    -- Uses SECURITY DEFINER helper to avoid recursion
    is_admin_or_owner(auth.uid())
    OR
    -- ============================================
    -- MANAGER: Business Operations Only
    -- ============================================
    -- Uses SECURITY DEFINER helper to avoid recursion
    (
        is_manager(auth.uid())
        AND table_name IN (
            'bookings',      -- Booking management
            'payments',      -- Payment records
            'guests',        -- Guest information
            'expenses',      -- Business expenses
            'system',        -- System events (app logs)
            'authentication' -- Auth events (app logs)
        )
    )
    OR
    -- ============================================
    -- STAFF: Own Logs Only
    -- ============================================
    -- Direct column check (no recursion, no app_roles lookup)
    (
        user_email = (current_setting('request.jwt.claims', TRUE)::json->>'email')
    )
);

COMMENT ON POLICY "audit_logs_select_policy" ON audit_logs IS
    'Fixed: Uses SECURITY DEFINER helpers (is_admin_or_owner, is_manager) to avoid infinite RLS recursion with app_roles.';

-- ============================================
-- FIX: audit_logs_archive SELECT POLICY
-- ============================================
-- Same fix for archive table

DROP POLICY IF EXISTS "audit_logs_archive_select_policy" ON audit_logs_archive;

CREATE POLICY "audit_logs_archive_select_policy"
ON audit_logs_archive
FOR SELECT
USING (
    -- Admin/Owner: Full access (SECURITY DEFINER helper)
    is_admin_or_owner(auth.uid())
    OR
    -- Manager: Business operations only (SECURITY DEFINER helper)
    (
        is_manager(auth.uid())
        AND table_name IN ('bookings', 'payments', 'guests', 'expenses', 'system', 'authentication')
    )
    OR
    -- Staff: Own logs only (direct column check)
    (
        user_email = (current_setting('request.jwt.claims', TRUE)::json->>'email')
    )
);

COMMENT ON POLICY "audit_logs_archive_select_policy" ON audit_logs_archive IS
    'Fixed: Uses SECURITY DEFINER helpers to avoid infinite RLS recursion.';

-- ============================================
-- FIX: audit_logs DELETE POLICY
-- ============================================

DROP POLICY IF EXISTS "audit_logs_delete_policy" ON audit_logs;

CREATE POLICY "audit_logs_delete_policy"
ON audit_logs
FOR DELETE
USING (
    -- Only admins and owners can delete logs (uses SECURITY DEFINER helper)
    is_admin_or_owner(auth.uid())
);

COMMENT ON POLICY "audit_logs_delete_policy" ON audit_logs IS
    'Fixed: Uses is_admin_or_owner() SECURITY DEFINER helper to avoid recursion.';

-- ============================================
-- FIX: audit_logs_archive DELETE POLICY
-- ============================================

DROP POLICY IF EXISTS "audit_logs_archive_delete_policy" ON audit_logs_archive;

CREATE POLICY "audit_logs_archive_delete_policy"
ON audit_logs_archive
FOR DELETE
USING (
    -- Only admins and owners can delete archived logs (uses SECURITY DEFINER helper)
    is_admin_or_owner(auth.uid())
);

COMMENT ON POLICY "audit_logs_archive_delete_policy" ON audit_logs_archive IS
    'Fixed: Uses is_admin_or_owner() SECURITY DEFINER helper to avoid recursion.';

-- ============================================
-- FIX: app_roles INSERT POLICY
-- ============================================

DROP POLICY IF EXISTS "app_roles_insert_policy" ON app_roles;

CREATE POLICY "app_roles_insert_policy"
ON app_roles
FOR INSERT
WITH CHECK (
    -- Only admins can grant roles (uses SECURITY DEFINER helper)
    is_admin(auth.uid())
);

COMMENT ON POLICY "app_roles_insert_policy" ON app_roles IS
    'Fixed: Uses is_admin() SECURITY DEFINER helper to avoid recursion.';

-- ============================================
-- FIX: app_roles UPDATE POLICY
-- ============================================

DROP POLICY IF EXISTS "app_roles_update_policy" ON app_roles;

CREATE POLICY "app_roles_update_policy"
ON app_roles
FOR UPDATE
USING (
    -- Only admins can modify roles (uses SECURITY DEFINER helper)
    is_admin(auth.uid())
);

COMMENT ON POLICY "app_roles_update_policy" ON app_roles IS
    'Fixed: Uses is_admin() SECURITY DEFINER helper to avoid recursion.';

-- ============================================
-- FIX: app_roles DELETE POLICY
-- ============================================

DROP POLICY IF EXISTS "app_roles_delete_policy" ON app_roles;

CREATE POLICY "app_roles_delete_policy"
ON app_roles
FOR DELETE
USING (
    -- Only admins can revoke roles (uses SECURITY DEFINER helper)
    is_admin(auth.uid())
);

COMMENT ON POLICY "app_roles_delete_policy" ON app_roles IS
    'Fixed: Uses is_admin() SECURITY DEFINER helper to avoid recursion.';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify helper functions exist
SELECT
    proname AS function_name,
    prosecdef AS is_security_definer
FROM pg_proc
WHERE proname IN ('is_admin_or_owner', 'is_manager', 'is_admin')
ORDER BY proname;

-- Expected: 3 rows, all with is_security_definer = true

-- Verify policies were updated
SELECT
    tablename,
    policyname,
    cmd,
    CASE
        WHEN tablename = 'app_roles' AND policyname = 'app_roles_select_policy'
            THEN 'Should use is_admin(auth.uid())'
        WHEN tablename = 'audit_logs' AND policyname = 'audit_logs_select_policy'
            THEN 'Should use is_admin_or_owner() and is_manager()'
        ELSE 'Check policy definition'
    END AS expected_fix
FROM pg_policies
WHERE tablename IN ('audit_logs', 'audit_logs_archive', 'app_roles')
ORDER BY tablename, policyname;

-- Test that policies don't cause recursion (requires an admin user to exist)
-- If no admin user exists yet, skip this test
DO $$
DECLARE
    admin_exists BOOLEAN;
BEGIN
    SELECT EXISTS(SELECT 1 FROM app_roles WHERE role = 'admin' AND is_active = true) INTO admin_exists;

    IF admin_exists THEN
        RAISE NOTICE 'Testing RLS policies (requires admin user to exist)...';
        -- This would previously cause infinite recursion
        PERFORM * FROM audit_logs LIMIT 1;
        RAISE NOTICE '✅ No recursion detected - policies working correctly';
    ELSE
        RAISE NOTICE '⚠️  No admin user found - skipping RLS recursion test';
        RAISE NOTICE 'To complete testing: INSERT INTO app_roles (user_id, email, role) VALUES (''<uuid>'', ''<email>'', ''admin'')';
    END IF;
END $$;

-- Migration complete
SELECT '✅ Migration 012 complete: Fixed app_roles RLS infinite recursion using SECURITY DEFINER helpers' AS status;

-- ============================================
-- COMMIT TRANSACTION
-- ============================================
-- All commands succeeded - commit changes atomically

COMMIT;
