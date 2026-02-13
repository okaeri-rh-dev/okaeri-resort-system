-- ============================================
-- Migration: Fix Audit Functions Search Path
-- Description: Qualify app_roles table references in audit functions
--              that have SET search_path = '' but use unqualified table names
-- Date: 2026-02-14
-- Author: Claude Code
-- ============================================
--
-- ROOT CAUSE:
-- The security hardening migration (20260209) added SET search_path = ''
-- to many functions, but 6 older audit functions already had this setting
-- from earlier migrations and were missed. Their unqualified "app_roles"
-- references fail with: "relation app_roles does not exist" (42P01)
-- because the empty search_path means PostgreSQL can't resolve unqualified
-- table names.
--
-- AFFECTED FUNCTIONS:
-- 1. get_current_audit_role()     - Used by sidebar nav role check
-- 2. can_view_all_audit_logs()    - Used by audit trail access
-- 3. is_audit_admin()             - Used by grant_audit_role and RLS policies
-- 4. is_audit_manager()           - Used by RLS policies
-- 5. is_audit_owner()             - Used by audit trail access
-- 6. grant_audit_role()           - Used by role management UI
--
-- FIX: Add "public." prefix to all app_roles references and
--      qualify function calls within function bodies.
-- ============================================

BEGIN;

-- 1. get_current_audit_role - Critical: drives sidebar navigation
CREATE OR REPLACE FUNCTION public.get_current_audit_role()
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM public.app_roles
    WHERE user_id = auth.uid()
      AND is_active = true
    LIMIT 1;

    RETURN COALESCE(user_role, 'none');
END;
$$;

-- 2. can_view_all_audit_logs
CREATE OR REPLACE FUNCTION public.can_view_all_audit_logs()
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.app_roles
        WHERE user_id = auth.uid()
          AND role IN ('admin', 'owner')
          AND is_active = true
    );
END;
$$;

-- 3. is_audit_admin
CREATE OR REPLACE FUNCTION public.is_audit_admin()
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.app_roles
        WHERE user_id = auth.uid()
          AND role = 'admin'
          AND is_active = true
    );
END;
$$;

-- 4. is_audit_manager
CREATE OR REPLACE FUNCTION public.is_audit_manager()
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.app_roles
        WHERE user_id = auth.uid()
          AND role = 'manager'
          AND is_active = true
    );
END;
$$;

-- 5. is_audit_owner
CREATE OR REPLACE FUNCTION public.is_audit_owner()
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.app_roles
        WHERE user_id = auth.uid()
          AND role = 'owner'
          AND is_active = true
    );
END;
$$;

-- 6. grant_audit_role - qualify both table refs and function call
CREATE OR REPLACE FUNCTION public.grant_audit_role(
    target_user_id uuid,
    target_email text,
    target_role text,
    grant_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Security check: Only admins can grant roles
    IF NOT public.is_audit_admin() THEN
        RAISE EXCEPTION 'Permission denied: Only admins can grant roles';
    END IF;

    -- Validate role
    IF target_role NOT IN ('admin', 'owner', 'manager', 'staff') THEN
        RAISE EXCEPTION 'Invalid role: %. Must be admin, owner, manager, or staff', target_role;
    END IF;

    -- Insert or update role
    INSERT INTO public.app_roles (user_id, email, role, granted_by, is_active, notes)
    VALUES (target_user_id, target_email, target_role, auth.uid(), true, grant_notes)
    ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role,
        granted_by = auth.uid(),
        granted_at = NOW(),
        is_active = true,
        notes = EXCLUDED.notes;

    RAISE NOTICE 'Role % granted to % by %', target_role, target_email,
        (SELECT email FROM public.app_roles WHERE user_id = auth.uid());
END;
$$;

-- Verification: log the migration
INSERT INTO public.audit_logs (
    action,
    table_name,
    description,
    category,
    severity,
    source
) VALUES (
    'INSERT',
    'schema_migrations',
    'Fixed 6 audit functions with unqualified app_roles references (42P01 error). Added public. prefix to all table and function references.',
    'SYSTEM',
    'INFO',
    'app'
);

COMMIT;
