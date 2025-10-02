-- ============================================
-- MIGRATION: 011 - Verify Audit System Setup
-- ============================================
-- Description: Safety checks to ensure critical audit components are configured correctly
-- Author: Okaeri Resort System - Audit Trail Phase 1
-- Date: 2025-01-02
-- Dependencies: All previous migrations (005-010)
-- Purpose: This migration will FAIL if any required security component is missing

\set ON_ERROR_STOP on

DO $$
DECLARE
    v_identity_trigger_exists BOOLEAN;
    v_audit_triggers_count INT;
    v_rls_enabled_audit_logs BOOLEAN;
    v_rls_enabled_archive BOOLEAN;
    v_rls_enabled_app_roles BOOLEAN;
    v_permissive_policies INT;
    v_app_roles_count INT;
    v_index_count INT;
    v_archive_functions_count INT;
    v_helper_functions_count INT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Audit System Verification';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    -- ============================================
    -- Check 1: Identity enforcement trigger exists
    -- ============================================
    SELECT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE trigger_name = 'enforce_audit_identity'
        AND event_object_table = 'audit_logs'
    ) INTO v_identity_trigger_exists;

    IF NOT v_identity_trigger_exists THEN
        RAISE EXCEPTION '❌ CRITICAL: Identity enforcement trigger missing! This allows forged user_id/email in app logs.';
    ELSE
        RAISE NOTICE '✓ Identity enforcement trigger exists (enforce_audit_identity)';
    END IF;

    -- ============================================
    -- Check 2: All 6 table audit triggers exist
    -- ============================================
    -- Note: Each trigger handles INSERT OR UPDATE OR DELETE, so PostgreSQL creates 3 entries per table
    -- We count distinct trigger names (6) or distinct tables (6), not total entries (18)
    SELECT COUNT(DISTINCT trigger_name) INTO v_audit_triggers_count
    FROM information_schema.triggers
    WHERE trigger_name LIKE 'audit_%_trigger'
      AND event_object_table IN ('units', 'guests', 'bookings', 'payments', 'expenses', 'maintenance_logs');

    IF v_audit_triggers_count != 6 THEN
        RAISE EXCEPTION '❌ CRITICAL: Expected 6 table audit triggers, found %!', v_audit_triggers_count;
    ELSE
        RAISE NOTICE '✓ All 6 table audit triggers exist';
    END IF;

    -- ============================================
    -- Check 3: RLS enabled on audit_logs
    -- ============================================
    SELECT relrowsecurity INTO v_rls_enabled_audit_logs
    FROM pg_class
    WHERE relname = 'audit_logs';

    IF NOT v_rls_enabled_audit_logs THEN
        RAISE EXCEPTION '❌ CRITICAL: RLS not enabled on audit_logs! All users can see all logs.';
    ELSE
        RAISE NOTICE '✓ RLS enabled on audit_logs';
    END IF;

    -- ============================================
    -- Check 4: RLS enabled on audit_logs_archive
    -- ============================================
    SELECT relrowsecurity INTO v_rls_enabled_archive
    FROM pg_class
    WHERE relname = 'audit_logs_archive';

    IF NOT v_rls_enabled_archive THEN
        RAISE EXCEPTION '❌ CRITICAL: RLS not enabled on audit_logs_archive!';
    ELSE
        RAISE NOTICE '✓ RLS enabled on audit_logs_archive';
    END IF;

    -- ============================================
    -- Check 5: RLS enabled on app_roles
    -- ============================================
    SELECT relrowsecurity INTO v_rls_enabled_app_roles
    FROM pg_class
    WHERE relname = 'app_roles';

    IF NOT v_rls_enabled_app_roles THEN
        RAISE EXCEPTION '❌ CRITICAL: RLS not enabled on app_roles!';
    ELSE
        RAISE NOTICE '✓ RLS enabled on app_roles';
    END IF;

    -- ============================================
    -- Check 6: No permissive policies (USING true)
    -- ============================================
    SELECT COUNT(*) INTO v_permissive_policies
    FROM pg_policies
    WHERE tablename IN ('audit_logs', 'audit_logs_archive', 'app_roles')
    AND qual = 'true'::text;

    IF v_permissive_policies > 0 THEN
        RAISE EXCEPTION '❌ CRITICAL: Permissive policies detected (% policies with USING true)! Replace with app_roles policies.', v_permissive_policies;
    ELSE
        RAISE NOTICE '✓ No permissive policies (all policies use proper access control)';
    END IF;

    -- ============================================
    -- Check 7: app_roles table has data (or warns if empty)
    -- ============================================
    SELECT COUNT(*) INTO v_app_roles_count
    FROM app_roles
    WHERE is_active = true;

    IF v_app_roles_count = 0 THEN
        RAISE WARNING '⚠ WARNING: No active roles in app_roles table. Run migration 010 to bootstrap admin.';
        RAISE NOTICE '  To fix: Update 010-bootstrap-admin.sql with actual user UUID and re-run';
    ELSE
        RAISE NOTICE '✓ app_roles table has % active role(s)', v_app_roles_count;
    END IF;

    -- ============================================
    -- Check 8: Performance indexes exist (at least 8)
    -- ============================================
    SELECT COUNT(*) INTO v_index_count
    FROM pg_indexes
    WHERE tablename = 'audit_logs'
      AND indexname LIKE 'idx_audit_logs_%';

    IF v_index_count < 8 THEN
        RAISE WARNING '⚠ WARNING: Expected at least 8 performance indexes, found %', v_index_count;
    ELSE
        RAISE NOTICE '✓ Performance indexes created (% indexes)', v_index_count;
    END IF;

    -- ============================================
    -- Check 9: Archive functions exist
    -- ============================================
    SELECT COUNT(*) INTO v_archive_functions_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name IN ('archive_audit_logs', 'archive_logs_older_than_months', 'monthly_archive_until', 'restore_logs_from_archive');

    IF v_archive_functions_count < 4 THEN
        RAISE EXCEPTION '❌ CRITICAL: Missing archive functions! Expected 4, found %', v_archive_functions_count;
    ELSE
        RAISE NOTICE '✓ Archive functions exist (% functions)', v_archive_functions_count;
    END IF;

    -- ============================================
    -- Check 10: Helper functions exist
    -- ============================================
    SELECT COUNT(*) INTO v_helper_functions_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name IN (
          'get_current_audit_role',
          'is_audit_admin',
          'is_audit_owner',
          'is_audit_manager',
          'can_view_all_audit_logs',
          'grant_audit_role',
          'revoke_audit_role'
      );

    IF v_helper_functions_count < 7 THEN
        RAISE WARNING '⚠ WARNING: Missing helper functions! Expected 7, found %', v_helper_functions_count;
    ELSE
        RAISE NOTICE '✓ Helper functions exist (% functions)', v_helper_functions_count;
    END IF;

    -- ============================================
    -- Final Summary
    -- ============================================
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ All critical security checks passed';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Audit system is properly configured:';
    RAISE NOTICE '  • Identity enforcement: ENABLED (prevents forged identity)';
    RAISE NOTICE '  • Table triggers: 6 triggers (units, guests, bookings, payments, expenses, maintenance_logs)';
    RAISE NOTICE '  • Row Level Security: ENABLED (audit_logs, archive, app_roles)';
    RAISE NOTICE '  • Access control: app_roles-based (no permissive policies)';
    RAISE NOTICE '  • Active roles: % (% if none)', v_app_roles_count, CASE WHEN v_app_roles_count = 0 THEN 'bootstrap admin needed' ELSE 'configured' END;
    RAISE NOTICE '  • Performance indexes: % created', v_index_count;
    RAISE NOTICE '  • Archive system: % functions ready', v_archive_functions_count;
    RAISE NOTICE '  • Helper functions: % available', v_helper_functions_count;
    RAISE NOTICE '';

    IF v_app_roles_count = 0 THEN
        RAISE NOTICE '⚠ NEXT STEP: Bootstrap initial admin';
        RAISE NOTICE '  1. Update 010-bootstrap-admin.sql with actual user UUID';
        RAISE NOTICE '  2. Re-run: \i 010-bootstrap-admin.sql';
        RAISE NOTICE '';
    END IF;
END $$;

-- ============================================
-- SYSTEM OVERVIEW QUERY
-- ============================================
-- Provides a complete overview of the audit system configuration

CREATE OR REPLACE VIEW audit_system_status AS
SELECT
    'Tables' AS component,
    COUNT(*) AS count,
    STRING_AGG(table_name, ', ' ORDER BY table_name) AS details
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('audit_logs', 'audit_logs_archive', 'app_roles')

UNION ALL

SELECT
    'Triggers' AS component,
    COUNT(*) AS count,
    STRING_AGG(trigger_name, ', ' ORDER BY trigger_name) AS details
FROM information_schema.triggers
WHERE (trigger_name LIKE 'audit_%' OR trigger_name = 'enforce_audit_identity')

UNION ALL

SELECT
    'Indexes' AS component,
    COUNT(*) AS count,
    STRING_AGG(indexname, ', ' ORDER BY indexname) AS details
FROM pg_indexes
WHERE tablename = 'audit_logs'
  AND indexname LIKE 'idx_audit_logs_%'

UNION ALL

SELECT
    'Policies (audit_logs)' AS component,
    COUNT(*) AS count,
    STRING_AGG(policyname, ', ' ORDER BY policyname) AS details
FROM pg_policies
WHERE tablename = 'audit_logs'

UNION ALL

SELECT
    'Active Roles' AS component,
    COUNT(*) AS count,
    STRING_AGG(role || ' (' || email || ')', ', ' ORDER BY role) AS details
FROM app_roles
WHERE is_active = true

UNION ALL

SELECT
    'Archive Functions' AS component,
    COUNT(*) AS count,
    STRING_AGG(routine_name, ', ' ORDER BY routine_name) AS details
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('archive_audit_logs', 'archive_logs_older_than_months', 'monthly_archive_until', 'restore_logs_from_archive')

UNION ALL

SELECT
    'Helper Functions' AS component,
    COUNT(*) AS count,
    STRING_AGG(routine_name, ', ' ORDER BY routine_name) AS details
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
      'get_current_audit_role', 'is_audit_admin', 'is_audit_owner', 'is_audit_manager',
      'can_view_all_audit_logs', 'grant_audit_role', 'revoke_audit_role'
  );

COMMENT ON VIEW audit_system_status IS
    'Complete overview of audit system configuration: tables, triggers, indexes, policies, roles, and functions';

-- ============================================
-- FINAL VERIFICATION QUERIES
-- ============================================

-- Show audit system status
SELECT * FROM audit_system_status;

-- Check for any potential security issues
SELECT
    'Security Check' AS check_type,
    CASE
        WHEN EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND qual = 'true'::text)
        THEN '❌ FAIL: Permissive policy detected'
        ELSE '✅ PASS: No permissive policies'
    END AS result;

-- Migration complete
SELECT '✅ Migration 011 complete: Audit system verification successful' AS status;
