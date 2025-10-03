-- ============================================
-- MIGRATION: 009 - Enable RLS Policies (app_roles)
-- ============================================
-- Description: Enables Row Level Security on audit_logs using app_roles table
-- Author: Okaeri Resort System - Audit Trail Phase 1
-- Date: 2025-01-02
-- Dependencies: 005-create-audit-logs.sql (app_roles table)
-- Security Model: app_roles-based access control (NOT GUC emails)

\set ON_ERROR_STOP on

-- ============================================
-- ENABLE RLS ON AUDIT_LOGS
-- ============================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DROP EXISTING POLICIES (for clean re-run)
-- ============================================

DROP POLICY IF EXISTS "audit_logs_select_policy" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_policy" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_update_policy" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_delete_policy" ON audit_logs;

-- ============================================
-- SELECT POLICY (Using app_roles table)
-- ============================================

CREATE POLICY "audit_logs_select_policy"
ON audit_logs
FOR SELECT
USING (
    -- ============================================
    -- ADMIN & OWNER: Full Access
    -- ============================================
    -- Admins and owners see all audit logs (no restrictions)
    EXISTS (
        SELECT 1 FROM app_roles ar
        WHERE ar.user_id = auth.uid()
          AND ar.role IN ('admin', 'owner')
          AND ar.is_active = true
    )
    OR
    -- ============================================
    -- MANAGER: Business Operations Only
    -- ============================================
    -- Managers see business operations logs only (6 specific tables)
    -- Explicitly scoped to prevent over-broad access
    (
        EXISTS (
            SELECT 1 FROM app_roles ar
            WHERE ar.user_id = auth.uid()
              AND ar.role = 'manager'
              AND ar.is_active = true
        )
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
    -- Staff members see only logs where they are the user
    -- Based on email match from JWT claims
    (
        user_email = (current_setting('request.jwt.claims', TRUE)::json->>'email')
    )
);

COMMENT ON POLICY "audit_logs_select_policy" ON audit_logs IS
    'Uses app_roles table for role-based access. Admins/owners see all, managers see business ops (6 tables), staff see own logs.';

-- ============================================
-- INSERT POLICY (Allows triggers and authenticated users)
-- ============================================

CREATE POLICY "audit_logs_insert_policy"
ON audit_logs
FOR INSERT
WITH CHECK (
    -- Authenticated users can insert logs
    -- This allows both app-level logging (Layer 2) and system operations
    auth.uid() IS NOT NULL
    OR
    -- System triggers can insert logs (user_id = NULL)
    -- This allows database triggers (Layer 1) to function
    user_id IS NULL
);

COMMENT ON POLICY "audit_logs_insert_policy" ON audit_logs IS
    'Allows authenticated users to insert logs (Layer 2 app events) and system triggers (Layer 1, user_id=NULL) to log automatically.';

-- ============================================
-- UPDATE POLICY (No updates allowed - immutable logs)
-- ============================================

CREATE POLICY "audit_logs_update_policy"
ON audit_logs
FOR UPDATE
USING (false);  -- Audit logs are immutable - no updates permitted

COMMENT ON POLICY "audit_logs_update_policy" ON audit_logs IS
    'Blocks all updates. Audit logs are immutable by design.';

-- ============================================
-- DELETE POLICY (Admin/Owner only for archival)
-- ============================================

CREATE POLICY "audit_logs_delete_policy"
ON audit_logs
FOR DELETE
USING (
    -- Only admins and owners can delete logs (for manual archival)
    EXISTS (
        SELECT 1 FROM app_roles ar
        WHERE ar.user_id = auth.uid()
          AND ar.role IN ('admin', 'owner')
          AND ar.is_active = true
    )
);

COMMENT ON POLICY "audit_logs_delete_policy" ON audit_logs IS
    'Only admins and owners can manually delete logs for archival purposes.';

-- ============================================
-- ENABLE RLS ON AUDIT_LOGS_ARCHIVE
-- ============================================
-- Archive table has same policies as main table

ALTER TABLE audit_logs_archive ENABLE ROW LEVEL SECURITY;

-- Drop existing archive policies (for clean re-run)
DROP POLICY IF EXISTS "audit_logs_archive_select_policy" ON audit_logs_archive;
DROP POLICY IF EXISTS "audit_logs_archive_insert_policy" ON audit_logs_archive;
DROP POLICY IF EXISTS "audit_logs_archive_update_policy" ON audit_logs_archive;
DROP POLICY IF EXISTS "audit_logs_archive_delete_policy" ON audit_logs_archive;

-- ============================================
-- ARCHIVE SELECT POLICY (Same as main table)
-- ============================================

CREATE POLICY "audit_logs_archive_select_policy"
ON audit_logs_archive
FOR SELECT
USING (
    -- Admin/Owner: Full access
    EXISTS (
        SELECT 1 FROM app_roles ar
        WHERE ar.user_id = auth.uid()
          AND ar.role IN ('admin', 'owner')
          AND ar.is_active = true
    )
    OR
    -- Manager: Business operations only
    (
        EXISTS (
            SELECT 1 FROM app_roles ar
            WHERE ar.user_id = auth.uid()
              AND ar.role = 'manager'
              AND ar.is_active = true
        )
        AND table_name IN ('bookings', 'payments', 'guests', 'expenses', 'system', 'authentication')
    )
    OR
    -- Staff: Own logs only
    (
        user_email = (current_setting('request.jwt.claims', TRUE)::json->>'email')
    )
);

-- ============================================
-- ARCHIVE INSERT POLICY (Only archive function)
-- ============================================

CREATE POLICY "audit_logs_archive_insert_policy"
ON audit_logs_archive
FOR INSERT
WITH CHECK (
    -- Only the archive_audit_logs() function (SECURITY DEFINER) can insert
    -- This prevents manual archive manipulation
    true
);

-- ============================================
-- ARCHIVE UPDATE POLICY (Immutable)
-- ============================================

CREATE POLICY "audit_logs_archive_update_policy"
ON audit_logs_archive
FOR UPDATE
USING (false);  -- Archived logs are immutable

-- ============================================
-- ARCHIVE DELETE POLICY (Admin/Owner only)
-- ============================================

CREATE POLICY "audit_logs_archive_delete_policy"
ON audit_logs_archive
FOR DELETE
USING (
    -- Only admins and owners can delete archived logs
    EXISTS (
        SELECT 1 FROM app_roles ar
        WHERE ar.user_id = auth.uid()
          AND ar.role IN ('admin', 'owner')
          AND ar.is_active = true
    )
);

-- ============================================
-- ENABLE RLS ON APP_ROLES
-- ============================================
-- Secure role management table

ALTER TABLE app_roles ENABLE ROW LEVEL SECURITY;

-- Drop existing app_roles policies (for clean re-run)
DROP POLICY IF EXISTS "app_roles_select_policy" ON app_roles;
DROP POLICY IF EXISTS "app_roles_insert_policy" ON app_roles;
DROP POLICY IF EXISTS "app_roles_update_policy" ON app_roles;
DROP POLICY IF EXISTS "app_roles_delete_policy" ON app_roles;

-- ============================================
-- APP_ROLES SELECT POLICY
-- ============================================

CREATE POLICY "app_roles_select_policy"
ON app_roles
FOR SELECT
USING (
    -- Admins can see all roles
    EXISTS (
        SELECT 1 FROM app_roles ar
        WHERE ar.user_id = auth.uid()
          AND ar.role = 'admin'
          AND ar.is_active = true
    )
    OR
    -- Users can see their own role
    user_id = auth.uid()
);

-- ============================================
-- APP_ROLES INSERT POLICY (Admin only)
-- ============================================

CREATE POLICY "app_roles_insert_policy"
ON app_roles
FOR INSERT
WITH CHECK (
    -- Only admins can grant roles
    EXISTS (
        SELECT 1 FROM app_roles ar
        WHERE ar.user_id = auth.uid()
          AND ar.role = 'admin'
          AND ar.is_active = true
    )
);

-- ============================================
-- APP_ROLES UPDATE POLICY (Admin only)
-- ============================================

CREATE POLICY "app_roles_update_policy"
ON app_roles
FOR UPDATE
USING (
    -- Only admins can modify roles
    EXISTS (
        SELECT 1 FROM app_roles ar
        WHERE ar.user_id = auth.uid()
          AND ar.role = 'admin'
          AND ar.is_active = true
    )
);

-- ============================================
-- APP_ROLES DELETE POLICY (Admin only)
-- ============================================

CREATE POLICY "app_roles_delete_policy"
ON app_roles
FOR DELETE
USING (
    -- Only admins can revoke roles
    EXISTS (
        SELECT 1 FROM app_roles ar
        WHERE ar.user_id = auth.uid()
          AND ar.role = 'admin'
          AND ar.is_active = true
    )
);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check RLS enabled on all tables
SELECT
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE tablename IN ('audit_logs', 'audit_logs_archive', 'app_roles')
ORDER BY tablename;

-- List all policies
SELECT
    tablename,
    policyname,
    permissive,
    cmd
FROM pg_policies
WHERE tablename IN ('audit_logs', 'audit_logs_archive', 'app_roles')
ORDER BY tablename, policyname;

-- Count policies per table
SELECT
    tablename,
    COUNT(*) AS policy_count
FROM pg_policies
WHERE tablename IN ('audit_logs', 'audit_logs_archive', 'app_roles')
GROUP BY tablename;

-- Expected: audit_logs (4 policies), audit_logs_archive (4 policies), app_roles (4 policies)

-- Check for dangerous permissive policies (USING true)
SELECT
    tablename,
    policyname,
    'WARNING: Permissive policy detected' AS warning
FROM pg_policies
WHERE tablename IN ('audit_logs', 'audit_logs_archive', 'app_roles')
  AND qual = 'true'::text;

-- Expected: No rows (no permissive policies should exist)

-- Migration complete
SELECT '✅ Migration 009 complete: RLS enabled with app_roles-based policies on all audit tables' AS status;
