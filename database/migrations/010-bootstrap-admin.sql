-- ============================================
-- MIGRATION: 010 - Bootstrap Initial Admin
-- ============================================
-- Description: Creates the first admin user for the system
-- Author: Okaeri Resort System - Audit Trail Phase 1
-- Date: 2025-01-02
-- Dependencies: 005-create-audit-logs.sql (app_roles table), 009-enable-audit-rls.sql

\set ON_ERROR_STOP on

-- ============================================
-- INSTRUCTIONS FOR SETUP
-- ============================================
-- IMPORTANT: Replace placeholder UUIDs with actual user ID after first authentication
--
-- STEPS:
-- 1. Have your admin user sign up through Supabase Auth first
-- 2. Find their user_id in auth.users table or Supabase Dashboard:
--    SELECT id, email FROM auth.users WHERE email = 'admin@your-resort.com';
-- 3. Replace 'REPLACE_WITH_FIRST_ADMIN_UUID' below with their actual UUID
-- 4. Replace 'admin@your-resort.com' with their actual email
-- 5. Run this migration
--
-- SECURITY NOTE: The first admin grants themselves the role (self-granted).
-- After this, all subsequent role grants are tracked with granted_by.

-- ============================================
-- BOOTSTRAP INITIAL ADMIN USER
-- ============================================
-- This INSERT will be updated by you before running the migration

INSERT INTO app_roles (user_id, email, role, granted_by, is_active, notes)
VALUES (
    'bc8e12ec-da3f-4021-8a34-9ed3c2f8c5d3'::UUID,  -- Replace with actual user UUID from auth.users
    'jasonacido@gmail.com',                -- Replace with actual admin email
    'admin',                                -- Role: admin (full system access)
    'bc8e12ec-da3f-4021-8a34-9ed3c2f8c5d3'::UUID,  -- Self-granted for initial admin (same as user_id)
    true,                                   -- Active by default
    'Initial system administrator - created during migration'
)
ON CONFLICT (user_id) DO NOTHING;  -- Idempotent: won't fail if admin already exists

-- ============================================
-- CREATE ROLE HELPER FUNCTIONS
-- ============================================

-- ============================================
-- get_current_audit_role() - UI Route Guard Helper
-- ============================================
-- Returns TEXT (never NULL) for cleaner client-side checks
-- Preferred for UI route guards and role-based rendering

CREATE OR REPLACE FUNCTION get_current_audit_role()
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM app_roles
    WHERE user_id = auth.uid()
      AND is_active = true
    LIMIT 1;

    -- Return 'none' instead of NULL for easier client-side checks
    -- Client code: if (role === 'admin') { ... }
    RETURN COALESCE(user_role, 'none');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_current_audit_role() IS
    'Returns current user audit role: admin|owner|manager|staff|none. Preferred for UI route guards.';

-- ============================================
-- is_audit_admin() - Boolean Check Helper
-- ============================================
-- Convenience function for admin-only operations

CREATE OR REPLACE FUNCTION is_audit_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM app_roles
        WHERE user_id = auth.uid()
          AND role = 'admin'
          AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION is_audit_admin() IS
    'Returns TRUE if current user has admin role, FALSE otherwise.';

-- ============================================
-- is_audit_owner() - Boolean Check Helper
-- ============================================

CREATE OR REPLACE FUNCTION is_audit_owner()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM app_roles
        WHERE user_id = auth.uid()
          AND role = 'owner'
          AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION is_audit_owner() IS
    'Returns TRUE if current user has owner role, FALSE otherwise.';

-- ============================================
-- is_audit_manager() - Boolean Check Helper
-- ============================================

CREATE OR REPLACE FUNCTION is_audit_manager()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM app_roles
        WHERE user_id = auth.uid()
          AND role = 'manager'
          AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION is_audit_manager() IS
    'Returns TRUE if current user has manager role, FALSE otherwise.';

-- ============================================
-- can_view_all_audit_logs() - Composite Check
-- ============================================
-- Returns TRUE if user can view all audit logs (admin or owner)

CREATE OR REPLACE FUNCTION can_view_all_audit_logs()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM app_roles
        WHERE user_id = auth.uid()
          AND role IN ('admin', 'owner')
          AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION can_view_all_audit_logs() IS
    'Returns TRUE if current user can view all audit logs (admin or owner role).';

-- ============================================
-- grant_audit_role() - Admin Function to Grant Roles
-- ============================================
-- Allows admins to grant roles to other users via TypeScript

CREATE OR REPLACE FUNCTION grant_audit_role(
    target_user_id UUID,
    target_email TEXT,
    target_role TEXT,
    grant_notes TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    -- Security check: Only admins can grant roles
    IF NOT is_audit_admin() THEN
        RAISE EXCEPTION 'Permission denied: Only admins can grant roles';
    END IF;

    -- Validate role
    IF target_role NOT IN ('admin', 'owner', 'manager', 'staff') THEN
        RAISE EXCEPTION 'Invalid role: %. Must be admin, owner, manager, or staff', target_role;
    END IF;

    -- Insert or update role
    INSERT INTO app_roles (user_id, email, role, granted_by, is_active, notes)
    VALUES (target_user_id, target_email, target_role, auth.uid(), true, grant_notes)
    ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role,
        granted_by = auth.uid(),
        granted_at = NOW(),
        is_active = true,
        notes = EXCLUDED.notes;

    RAISE NOTICE 'Role % granted to % by %', target_role, target_email, (SELECT email FROM app_roles WHERE user_id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION grant_audit_role(UUID, TEXT, TEXT, TEXT) IS
    'Grants audit role to a user. Only admins can execute. Updates existing role if user already has one.';

-- ============================================
-- revoke_audit_role() - Admin Function to Revoke Roles
-- ============================================

CREATE OR REPLACE FUNCTION revoke_audit_role(
    target_user_id UUID
)
RETURNS VOID AS $$
BEGIN
    -- Security check: Only admins can revoke roles
    IF NOT is_audit_admin() THEN
        RAISE EXCEPTION 'Permission denied: Only admins can revoke roles';
    END IF;

    -- Prevent self-revocation
    IF target_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Cannot revoke your own admin role. Ask another admin.';
    END IF;

    -- Soft delete: mark as inactive instead of hard delete
    UPDATE app_roles
    SET is_active = false,
        notes = COALESCE(notes || E'\n', '') || 'Revoked by ' || (SELECT email FROM app_roles WHERE user_id = auth.uid()) || ' on ' || NOW()::TEXT
    WHERE user_id = target_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User % does not have an audit role', target_user_id;
    END IF;

    RAISE NOTICE 'Role revoked for user %', target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION revoke_audit_role(UUID) IS
    'Revokes audit role from a user (soft delete: marks as inactive). Only admins can execute. Prevents self-revocation.';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check admin count
SELECT
    'Admin bootstrap status' AS status,
    COUNT(*) AS admin_count,
    STRING_AGG(email, ', ') AS admin_emails
FROM app_roles
WHERE role = 'admin' AND is_active = true;

-- List all helper functions created
SELECT
    'Helper functions created' AS status,
    COUNT(*) AS function_count
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

-- ============================================
-- SETUP INSTRUCTIONS (Displayed after migration)
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'IMPORTANT: Bootstrap Admin Setup';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Have your admin user sign up through Supabase Auth';
    RAISE NOTICE '2. Find their UUID: SELECT id, email FROM auth.users WHERE email = ''admin@your-resort.com'';';
    RAISE NOTICE '3. Update this migration file: Replace ''REPLACE_WITH_FIRST_ADMIN_UUID'' with the actual UUID';
    RAISE NOTICE '4. Re-run this migration: \i 010-bootstrap-admin.sql';
    RAISE NOTICE '';
    RAISE NOTICE 'After initial admin is set up:';
    RAISE NOTICE '  • Test login with admin credentials';
    RAISE NOTICE '  • Use TypeScript helpers to grant additional roles:';
    RAISE NOTICE '    await grantRole(userId, AuditRole.OWNER, "notes here");';
    RAISE NOTICE '';
    RAISE NOTICE 'Available helper functions:';
    RAISE NOTICE '  • get_current_audit_role() - Get current user role (TEXT)';
    RAISE NOTICE '  • is_audit_admin() - Check if user is admin (BOOLEAN)';
    RAISE NOTICE '  • can_view_all_audit_logs() - Check full access (BOOLEAN)';
    RAISE NOTICE '  • grant_audit_role(uuid, email, role, notes) - Grant role (admin only)';
    RAISE NOTICE '  • revoke_audit_role(uuid) - Revoke role (admin only)';
    RAISE NOTICE '';
END $$;

-- Migration complete
SELECT '✅ Migration 010 complete: Admin bootstrap and helper functions created successfully' AS status;
SELECT 'NOTE: Update REPLACE_WITH_FIRST_ADMIN_UUID with actual user UUID before production use' AS reminder;
