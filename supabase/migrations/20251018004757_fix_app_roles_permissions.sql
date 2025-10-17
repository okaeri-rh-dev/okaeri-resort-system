-- ============================================
-- FIX APP_ROLES PERMISSIONS AND RLS RECURSION
-- ============================================
-- Purpose: Grant proper permissions on app_roles table and add helper functions
-- Issue: authenticated users cannot SELECT from app_roles, causing permission denied errors
-- Date: 2025-10-18
-- ============================================

BEGIN;

-- ============================================
-- STEP 1: GRANT PERMISSIONS ON APP_ROLES
-- ============================================
-- Grant SELECT permission to authenticated users
-- This allows RLS policies to check user roles
GRANT SELECT ON TABLE public.app_roles TO authenticated;

-- Grant INSERT, UPDATE, DELETE (controlled by RLS policies)
-- These will be restricted by the RLS policies on app_roles
GRANT INSERT, UPDATE, DELETE ON TABLE public.app_roles TO authenticated;

-- Also grant to anon for public endpoints that might check roles
GRANT SELECT ON TABLE public.app_roles TO anon;

-- Ensure service_role has full access
GRANT ALL ON TABLE public.app_roles TO service_role;

-- ============================================
-- STEP 2: CREATE SECURITY DEFINER HELPER FUNCTIONS
-- ============================================
-- These functions bypass RLS to avoid infinite recursion
-- when RLS policies check app_roles

-- Helper function: Check if user has admin or owner role
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

-- Helper function: Check if user has manager role
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

-- Helper function: Check if user has staff role
CREATE OR REPLACE FUNCTION is_staff(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM app_roles
        WHERE user_id = check_user_id
          AND role = 'staff'
          AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_staff(UUID) IS
    'SECURITY DEFINER helper to check staff role without RLS recursion.';

-- Helper function: Check if user has any valid role
CREATE OR REPLACE FUNCTION has_any_role(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM app_roles
        WHERE user_id = check_user_id
          AND role IN ('admin', 'owner', 'manager', 'staff')
          AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION has_any_role(UUID) IS
    'SECURITY DEFINER helper to check if user has any valid role without RLS recursion.';

-- ============================================
-- STEP 3: GRANT PERMISSIONS ON RELATED TABLES
-- ============================================
-- Ensure authenticated users can access booking-related tables
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.booking_units TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.booking_unit_availability TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.guest_assignments TO authenticated;

-- Grant to anon for public availability checks
GRANT SELECT ON TABLE public.booking_unit_availability TO anon;
-- Grant SELECT on the view if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'public_unit_availability') THEN
        EXECUTE 'GRANT SELECT ON public.public_unit_availability TO anon';
    END IF;
END $$;

-- ============================================
-- STEP 4: ENSURE AUDIT TABLES HAVE PERMISSIONS
-- ============================================
-- Grant permissions on audit tables if they exist
DO $$
BEGIN
    -- Check if audit_logs table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
        GRANT SELECT, INSERT ON TABLE public.audit_logs TO authenticated;
        GRANT SELECT ON TABLE public.audit_logs TO anon; -- For public endpoints to log
    END IF;

    -- Check if audit_logs_archive table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs_archive') THEN
        GRANT SELECT ON TABLE public.audit_logs_archive TO authenticated;
    END IF;
END $$;

-- ============================================
-- VERIFICATION
-- ============================================
-- Check that permissions were granted
DO $$
DECLARE
    has_select_permission BOOLEAN;
BEGIN
    -- Check if authenticated role can SELECT from app_roles
    SELECT EXISTS(
        SELECT 1
        FROM information_schema.table_privileges
        WHERE grantee = 'authenticated'
          AND table_schema = 'public'
          AND table_name = 'app_roles'
          AND privilege_type = 'SELECT'
    ) INTO has_select_permission;

    IF has_select_permission THEN
        RAISE NOTICE '✅ SELECT permission granted on app_roles for authenticated users';
    ELSE
        RAISE EXCEPTION '❌ Failed to grant SELECT permission on app_roles';
    END IF;
END $$;

-- ============================================
-- ADD DEFAULT ADMIN USER IF NONE EXISTS
-- ============================================
-- This ensures at least one admin exists for testing
DO $$
BEGIN
    -- Only insert if no admin exists
    IF NOT EXISTS (SELECT 1 FROM app_roles WHERE role = 'admin' AND is_active = true) THEN
        -- Get the first authenticated user from auth.users
        INSERT INTO app_roles (user_id, email, role, is_active, notes)
        SELECT
            id,
            email,
            'admin',
            true,
            'Auto-created admin user for initial setup'
        FROM auth.users
        WHERE email IS NOT NULL
        LIMIT 1
        ON CONFLICT (user_id) DO UPDATE
        SET role = 'admin', is_active = true;

        RAISE NOTICE '✅ Created default admin user';
    END IF;
END $$;

COMMIT;

-- ============================================
-- Migration complete
-- Test with: SELECT * FROM bookings WHERE booking_status = 'Confirmed';
-- ============================================