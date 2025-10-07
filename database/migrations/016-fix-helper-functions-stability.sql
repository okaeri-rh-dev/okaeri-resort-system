-- ============================================
-- MIGRATION: 016 - Fix Helper Functions Stability
-- ============================================
-- Description: Add STABLE attribute to RLS helper functions
-- Author: Okaeri Resort System - Audit Trail Phase 2 Hotfix
-- Date: 2025-10-07
-- Dependencies: 012-fix-app-roles-rls-recursion.sql
-- Issue: Helper functions missing STABLE attribute causes RLS policy evaluation to lose auth context
--
-- Root Cause:
--   - is_admin_or_owner(), is_manager(), is_admin() were created as VOLATILE (default)
--   - RLS policies require STABLE or IMMUTABLE functions for proper auth context
--   - Without STABLE, auth.uid() context is lost during policy evaluation
--   - This is why RPC calls work (get_current_audit_role is STABLE) but table queries fail
--
-- Solution:
--   - Add STABLE attribute to all three helper functions
--   - Functions ARE stable (same result per transaction for same input)
--   - No logic changes - just marking what was already true
-- ============================================

BEGIN;

-- ============================================
-- Fix is_admin_or_owner() Function
-- ============================================
-- Add STABLE attribute to preserve auth context in RLS policies

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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;  -- ✅ Added STABLE

COMMENT ON FUNCTION is_admin_or_owner(UUID) IS
    'SECURITY DEFINER STABLE helper to check admin/owner role without RLS recursion. STABLE ensures auth context is preserved in RLS policy evaluation.';

-- ============================================
-- Fix is_manager() Function
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;  -- ✅ Added STABLE

COMMENT ON FUNCTION is_manager(UUID) IS
    'SECURITY DEFINER STABLE helper to check manager role without RLS recursion. STABLE ensures auth context is preserved.';

-- ============================================
-- Fix is_admin() Function
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;  -- ✅ Added STABLE

COMMENT ON FUNCTION is_admin(UUID) IS
    'SECURITY DEFINER STABLE helper to check admin role without RLS recursion. STABLE ensures auth context is preserved in RLS policies.';

-- ============================================
-- Verification
-- ============================================

-- Verify functions have STABLE attribute
SELECT
    proname AS function_name,
    CASE provolatile
        WHEN 'i' THEN 'IMMUTABLE'
        WHEN 's' THEN 'STABLE ✅'
        WHEN 'v' THEN 'VOLATILE ❌'
    END AS volatility,
    CASE WHEN prosecdef THEN 'Yes ✅' ELSE 'No ❌' END AS security_definer
FROM pg_proc
WHERE proname IN ('is_admin_or_owner', 'is_manager', 'is_admin')
ORDER BY proname;

-- Expected output:
--   function_name     | volatility  | security_definer
--   is_admin          | STABLE ✅   | Yes ✅
--   is_admin_or_owner | STABLE ✅   | Yes ✅
--   is_manager        | STABLE ✅   | Yes ✅

COMMIT;

-- ============================================
-- Success Message
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Migration 016 Complete';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Fixed Functions:';
    RAISE NOTICE '  • is_admin_or_owner() - Added STABLE';
    RAISE NOTICE '  • is_manager() - Added STABLE';
    RAISE NOTICE '  • is_admin() - Added STABLE';
    RAISE NOTICE '';
    RAISE NOTICE 'What Changed:';
    RAISE NOTICE '  Functions now marked as STABLE instead of VOLATILE';
    RAISE NOTICE '  This preserves auth context during RLS policy evaluation';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '  1. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)';
    RAISE NOTICE '  2. Navigate to booking detail page';
    RAISE NOTICE '  3. Audit logs should now be visible';
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
-- PostgreSQL Function Volatility:
--
-- IMMUTABLE: Output never changes for same input (e.g., sqrt(4) always = 2)
-- STABLE:    Output consistent within single transaction (e.g., current_timestamp)
-- VOLATILE:  Output can change anytime (e.g., random(), triggers)
--
-- Why This Fix Works:
-- 1. RLS policies are evaluated once per query during planning
-- 2. STABLE functions can be cached/inlined during query planning
-- 3. This preserves the auth.uid() context throughout evaluation
-- 4. VOLATILE functions cannot be cached, losing auth context
--
-- Our Functions Are STABLE Because:
-- - They query app_roles table (no side effects)
-- - Result is consistent within a transaction
-- - Same user_id always returns same role within transaction
-- - No random elements or external dependencies
--
-- This is the correct PostgreSQL pattern for RLS helper functions.
