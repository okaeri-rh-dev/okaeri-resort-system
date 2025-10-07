-- ============================================
-- MIGRATION: 017 - Grant Authenticated Role Permissions
-- ============================================
-- Description: Grant table-level permissions to authenticated role
-- Author: Okaeri Resort System - Audit Trail Final Fix
-- Date: 2025-10-07
-- Dependencies: 005-create-audit-logs.sql, 009-enable-audit-rls.sql
--
-- Root Cause:
--   RLS policies require TWO layers of permissions:
--   1. Table-level GRANT (allows access to table) ← MISSING
--   2. RLS policies (controls which rows can be accessed) ← Already configured
--
--   Without table-level GRANTs, authenticated users are denied access
--   BEFORE RLS policies are even evaluated.
--
-- Solution:
--   Grant SELECT/INSERT permissions to 'authenticated' role on audit tables
-- ============================================

BEGIN;

-- ============================================
-- Grant Permissions on audit_logs
-- ============================================

GRANT SELECT, INSERT ON audit_logs TO authenticated;

COMMENT ON TABLE audit_logs IS
    'Audit trail for all data mutations. RLS policies control row-level access. Table-level grants allow authenticated users to query.';

-- ============================================
-- Grant Permissions on audit_logs_archive
-- ============================================

GRANT SELECT, INSERT ON audit_logs_archive TO authenticated;

COMMENT ON TABLE audit_logs_archive IS
    'Archived audit logs (90+ days old). RLS policies match main audit_logs table.';

-- ============================================
-- Grant Permissions on app_roles
-- ============================================

-- Allow authenticated users to read their own roles
-- RLS policies on app_roles already restrict to:
--   - Own role (user_id = auth.uid())
--   - All roles if admin
GRANT SELECT ON app_roles TO authenticated;

COMMENT ON TABLE app_roles IS
    'Role assignments for audit access control. Users can see own role, admins see all (via RLS).';

-- ============================================
-- Verification
-- ============================================

-- Check what permissions authenticated role now has
SELECT
    'Verification: Authenticated Role Grants' AS check,
    grantee,
    table_name,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_name IN ('audit_logs', 'audit_logs_archive', 'app_roles')
  AND grantee = 'authenticated'
ORDER BY table_name, privilege_type;

-- Expected output:
--   grantee        | table_name          | privilege_type
--   authenticated  | app_roles           | SELECT
--   authenticated  | audit_logs          | INSERT
--   authenticated  | audit_logs          | SELECT
--   authenticated  | audit_logs_archive  | INSERT
--   authenticated  | audit_logs_archive  | SELECT

-- Verify table-level access is now granted
SELECT
    'Verification: Can authenticated SELECT?' AS check,
    tablename,
    pg_catalog.has_table_privilege('authenticated', tablename, 'SELECT') as can_select,
    pg_catalog.has_table_privilege('authenticated', tablename, 'INSERT') as can_insert
FROM pg_tables
WHERE tablename IN ('audit_logs', 'audit_logs_archive', 'app_roles')
ORDER BY tablename;

-- Expected: All should show true for can_select

COMMIT;

-- ============================================
-- Success Message
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Migration 017 Complete';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Granted Permissions:';
    RAISE NOTICE '  • audit_logs: SELECT, INSERT → authenticated';
    RAISE NOTICE '  • audit_logs_archive: SELECT, INSERT → authenticated';
    RAISE NOTICE '  • app_roles: SELECT → authenticated';
    RAISE NOTICE '';
    RAISE NOTICE 'Access Control Layers:';
    RAISE NOTICE '  1️⃣ Table GRANT (just fixed) ✅';
    RAISE NOTICE '  2️⃣ RLS policies (already working) ✅';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '  1. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)';
    RAISE NOTICE '  2. Navigate to booking detail page';
    RAISE NOTICE '  3. Audit logs should now be visible! 🎉';
    RAISE NOTICE '';
    RAISE NOTICE 'Test in Browser Console:';
    RAISE NOTICE '  const { data, error } = await supabase';
    RAISE NOTICE '    .from("audit_logs").select("*").limit(5);';
    RAISE NOTICE '  console.log(data, error);';
    RAISE NOTICE '';
END $$;

-- ============================================
-- Technical Explanation
-- ============================================
-- PostgreSQL Access Control Hierarchy:
--
-- 1. SUPERUSER BYPASS
--    postgres role → Full access, ignores all below
--
-- 2. TABLE-LEVEL GRANTS (just fixed)
--    GRANT SELECT ON table TO role;
--    → Controls which roles can access which tables
--    → Checked FIRST before RLS
--
-- 3. ROW-LEVEL SECURITY (already working)
--    CREATE POLICY ... USING (condition);
--    → Controls which rows within allowed tables
--    → Only checked if table-level GRANT passed
--
-- Why This Was Missed:
--   - SQL Editor runs as 'postgres' (superuser, bypasses GRANTs)
--   - RPC functions use SECURITY DEFINER (run as creator, bypass GRANTs)
--   - Only direct table queries from 'authenticated' hit this issue
--
-- This is NOT a workaround - proper PostgreSQL security requires both layers.
