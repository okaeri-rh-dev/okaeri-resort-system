-- =============================================
-- Migration: 005_add_rls_policies.sql
-- Description: Add comprehensive RLS policies for multi-tenant security
-- Author: Security Audit
-- Date: 2025-08-28
-- =============================================

BEGIN;

-- Set timezone for consistent timestamps
SET timezone = 'Asia/Manila';

-- =============================================
-- STEP 1: Enable RLS on All Tenant Tables
-- =============================================

-- Enable RLS on global tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Note: Project-specific tables need RLS enabled when schema is created
-- This will be done in the schema template

-- =============================================
-- STEP 2: Create Security Functions
-- =============================================

-- Function to get current authenticated user ID
CREATE OR REPLACE FUNCTION auth.user_id() 
RETURNS UUID AS $$
DECLARE
    user_id_str TEXT;
BEGIN
    user_id_str := current_setting('app.current_user', true);
    
    IF user_id_str IS NULL OR user_id_str = '' THEN
        RETURN NULL;
    END IF;
    
    RETURN user_id_str::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to get current project context
CREATE OR REPLACE FUNCTION auth.project_id() 
RETURNS UUID AS $$
DECLARE
    project_id_str TEXT;
BEGIN
    project_id_str := current_setting('app.current_project', true);
    
    IF project_id_str IS NULL OR project_id_str = '' THEN
        RETURN NULL;
    END IF;
    
    RETURN project_id_str::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user has project access
CREATE OR REPLACE FUNCTION auth.has_project_access(
    p_project_id UUID DEFAULT NULL,
    p_min_role TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_project_id UUID;
    v_has_access BOOLEAN := FALSE;
    v_user_role TEXT;
BEGIN
    -- Get current user
    v_user_id := auth.user_id();
    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Get project to check (use parameter or current context)
    v_project_id := COALESCE(p_project_id, auth.project_id());
    IF v_project_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check access
    SELECT role INTO v_user_role
    FROM user_projects
    WHERE user_id = v_user_id 
        AND project_id = v_project_id
        AND is_active = true;
    
    IF v_user_role IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check minimum role requirement if specified
    IF p_min_role IS NOT NULL THEN
        CASE p_min_role
            WHEN 'owner' THEN
                RETURN v_user_role = 'owner';
            WHEN 'admin' THEN
                RETURN v_user_role IN ('owner', 'admin');
            WHEN 'manager' THEN
                RETURN v_user_role IN ('owner', 'admin', 'manager');
            WHEN 'staff' THEN
                RETURN v_user_role IN ('owner', 'admin', 'manager', 'staff');
            ELSE
                RETURN TRUE; -- Any role
        END CASE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================
-- STEP 3: Global Table Policies
-- =============================================

-- Users table: Users can only see and update their own profile
DROP POLICY IF EXISTS users_select_policy ON users;
CREATE POLICY users_select_policy ON users
    FOR SELECT
    USING (
        id = auth.user_id() OR 
        id IN (
            SELECT up2.user_id 
            FROM user_projects up1
            JOIN user_projects up2 ON up1.project_id = up2.project_id
            WHERE up1.user_id = auth.user_id()
        )
    );

DROP POLICY IF EXISTS users_update_policy ON users;
CREATE POLICY users_update_policy ON users
    FOR UPDATE
    USING (id = auth.user_id())
    WITH CHECK (id = auth.user_id());

-- Projects table: Users can only see projects they have access to
DROP POLICY IF EXISTS projects_select_policy ON projects;
CREATE POLICY projects_select_policy ON projects
    FOR SELECT
    USING (
        id IN (
            SELECT project_id 
            FROM user_projects 
            WHERE user_id = auth.user_id() 
                AND is_active = true
        )
    );

DROP POLICY IF EXISTS projects_insert_policy ON projects;
CREATE POLICY projects_insert_policy ON projects
    FOR INSERT
    WITH CHECK (
        created_by = auth.user_id()
    );

DROP POLICY IF EXISTS projects_update_policy ON projects;
CREATE POLICY projects_update_policy ON projects
    FOR UPDATE
    USING (
        auth.has_project_access(id, 'admin')
    )
    WITH CHECK (
        auth.has_project_access(id, 'admin')
    );

DROP POLICY IF EXISTS projects_delete_policy ON projects;
CREATE POLICY projects_delete_policy ON projects
    FOR DELETE
    USING (
        auth.has_project_access(id, 'owner')
    );

-- User Projects table: Manage project memberships
DROP POLICY IF EXISTS user_projects_select_policy ON user_projects;
CREATE POLICY user_projects_select_policy ON user_projects
    FOR SELECT
    USING (
        user_id = auth.user_id() OR
        auth.has_project_access(project_id, 'admin')
    );

DROP POLICY IF EXISTS user_projects_insert_policy ON user_projects;
CREATE POLICY user_projects_insert_policy ON user_projects
    FOR INSERT
    WITH CHECK (
        auth.has_project_access(project_id, 'admin')
    );

DROP POLICY IF EXISTS user_projects_update_policy ON user_projects;
CREATE POLICY user_projects_update_policy ON user_projects
    FOR UPDATE
    USING (
        auth.has_project_access(project_id, 'admin')
    )
    WITH CHECK (
        auth.has_project_access(project_id, 'admin')
    );

DROP POLICY IF EXISTS user_projects_delete_policy ON user_projects;
CREATE POLICY user_projects_delete_policy ON user_projects
    FOR DELETE
    USING (
        auth.has_project_access(project_id, 'owner')
    );

-- Sessions table: Users can only see their own sessions
DROP POLICY IF EXISTS sessions_select_policy ON sessions;
CREATE POLICY sessions_select_policy ON sessions
    FOR SELECT
    USING (user_id = auth.user_id());

DROP POLICY IF EXISTS sessions_insert_policy ON sessions;
CREATE POLICY sessions_insert_policy ON sessions
    FOR INSERT
    WITH CHECK (user_id = auth.user_id());

DROP POLICY IF EXISTS sessions_update_policy ON sessions;
CREATE POLICY sessions_update_policy ON sessions
    FOR UPDATE
    USING (user_id = auth.user_id())
    WITH CHECK (user_id = auth.user_id());

DROP POLICY IF EXISTS sessions_delete_policy ON sessions;
CREATE POLICY sessions_delete_policy ON sessions
    FOR DELETE
    USING (user_id = auth.user_id());

-- Audit logs: Read-only for users with project access
DROP POLICY IF EXISTS audit_logs_select_policy ON audit_logs;
CREATE POLICY audit_logs_select_policy ON audit_logs
    FOR SELECT
    USING (
        auth.has_project_access(project_id, 'manager')
    );

DROP POLICY IF EXISTS audit_logs_insert_policy ON audit_logs;
CREATE POLICY audit_logs_insert_policy ON audit_logs
    FOR INSERT
    WITH CHECK (
        user_id = auth.user_id() AND
        auth.has_project_access(project_id)
    );

-- =============================================
-- STEP 4: Template for Project-Specific Policies
-- =============================================

-- This template should be executed for each project schema
-- Replace {SCHEMA_NAME} with actual schema name

/*
-- Enable RLS on project tables
ALTER TABLE {SCHEMA_NAME}.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE {SCHEMA_NAME}.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE {SCHEMA_NAME}.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE {SCHEMA_NAME}.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE {SCHEMA_NAME}.income ENABLE ROW LEVEL SECURITY;
ALTER TABLE {SCHEMA_NAME}.booking_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE {SCHEMA_NAME}.project_settings ENABLE ROW LEVEL SECURITY;

-- Bookings policies
CREATE POLICY bookings_select ON {SCHEMA_NAME}.bookings
    FOR SELECT
    USING (auth.has_project_access(project_id));

CREATE POLICY bookings_insert ON {SCHEMA_NAME}.bookings
    FOR INSERT
    WITH CHECK (
        auth.has_project_access(project_id, 'staff') AND
        project_id = auth.project_id()
    );

CREATE POLICY bookings_update ON {SCHEMA_NAME}.bookings
    FOR UPDATE
    USING (auth.has_project_access(project_id, 'staff'))
    WITH CHECK (auth.has_project_access(project_id, 'staff'));

CREATE POLICY bookings_delete ON {SCHEMA_NAME}.bookings
    FOR DELETE
    USING (auth.has_project_access(project_id, 'admin'));

-- Payments policies
CREATE POLICY payments_select ON {SCHEMA_NAME}.payments
    FOR SELECT
    USING (auth.has_project_access(project_id));

CREATE POLICY payments_insert ON {SCHEMA_NAME}.payments
    FOR INSERT
    WITH CHECK (
        auth.has_project_access(project_id, 'staff') AND
        project_id = auth.project_id()
    );

CREATE POLICY payments_update ON {SCHEMA_NAME}.payments
    FOR UPDATE
    USING (auth.has_project_access(project_id, 'manager'))
    WITH CHECK (auth.has_project_access(project_id, 'manager'));

CREATE POLICY payments_delete ON {SCHEMA_NAME}.payments
    FOR DELETE
    USING (auth.has_project_access(project_id, 'admin'));

-- Expenses policies
CREATE POLICY expenses_select ON {SCHEMA_NAME}.expenses
    FOR SELECT
    USING (auth.has_project_access(project_id));

CREATE POLICY expenses_insert ON {SCHEMA_NAME}.expenses
    FOR INSERT
    WITH CHECK (
        auth.has_project_access(project_id, 'staff') AND
        project_id = auth.project_id()
    );

CREATE POLICY expenses_update ON {SCHEMA_NAME}.expenses
    FOR UPDATE
    USING (auth.has_project_access(project_id, 'manager'))
    WITH CHECK (auth.has_project_access(project_id, 'manager'));

CREATE POLICY expenses_delete ON {SCHEMA_NAME}.expenses
    FOR DELETE
    USING (auth.has_project_access(project_id, 'admin'));

-- Income policies
CREATE POLICY income_select ON {SCHEMA_NAME}.income
    FOR SELECT
    USING (auth.has_project_access(project_id));

CREATE POLICY income_insert ON {SCHEMA_NAME}.income
    FOR INSERT
    WITH CHECK (
        auth.has_project_access(project_id, 'staff') AND
        project_id = auth.project_id()
    );

CREATE POLICY income_update ON {SCHEMA_NAME}.income
    FOR UPDATE
    USING (auth.has_project_access(project_id, 'manager'))
    WITH CHECK (auth.has_project_access(project_id, 'manager'));

CREATE POLICY income_delete ON {SCHEMA_NAME}.income
    FOR DELETE
    USING (auth.has_project_access(project_id, 'admin'));

-- Settings policies (more restrictive)
CREATE POLICY settings_select ON {SCHEMA_NAME}.project_settings
    FOR SELECT
    USING (
        is_public = true OR
        auth.has_project_access(project_id, 'manager')
    );

CREATE POLICY settings_insert ON {SCHEMA_NAME}.project_settings
    FOR INSERT
    WITH CHECK (auth.has_project_access(project_id, 'admin'));

CREATE POLICY settings_update ON {SCHEMA_NAME}.project_settings
    FOR UPDATE
    USING (auth.has_project_access(project_id, 'admin'))
    WITH CHECK (auth.has_project_access(project_id, 'admin'));

CREATE POLICY settings_delete ON {SCHEMA_NAME}.project_settings
    FOR DELETE
    USING (auth.has_project_access(project_id, 'owner'));
*/

-- =============================================
-- STEP 5: Create Helper Views with RLS
-- =============================================

-- View to show current user's accessible projects
CREATE OR REPLACE VIEW my_projects AS
SELECT 
    p.*,
    up.role as my_role,
    up.permissions as my_permissions
FROM projects p
JOIN user_projects up ON p.id = up.project_id
WHERE up.user_id = auth.user_id()
    AND up.is_active = true
    AND p.is_active = true;

-- View to show project team members (for admins)
CREATE OR REPLACE VIEW project_team AS
SELECT 
    up.*,
    u.email,
    u.name,
    u.avatar_url
FROM user_projects up
JOIN users u ON up.user_id = u.id
WHERE auth.has_project_access(up.project_id, 'admin');

-- =============================================
-- STEP 6: Testing Functions
-- =============================================

-- Function to test RLS policies (for development only)
CREATE OR REPLACE FUNCTION test_rls_policies(
    p_user_id UUID,
    p_project_id UUID
) RETURNS TABLE (
    test_name TEXT,
    result BOOLEAN,
    details TEXT
) AS $$
BEGIN
    -- Set the session context
    PERFORM set_config('app.current_user', p_user_id::TEXT, false);
    PERFORM set_config('app.current_project', p_project_id::TEXT, false);
    
    -- Test user access
    RETURN QUERY
    SELECT 
        'User context set'::TEXT,
        auth.user_id() = p_user_id,
        format('User ID: %s', auth.user_id())::TEXT;
    
    -- Test project access
    RETURN QUERY
    SELECT 
        'Project context set'::TEXT,
        auth.project_id() = p_project_id,
        format('Project ID: %s', auth.project_id())::TEXT;
    
    -- Test has_project_access
    RETURN QUERY
    SELECT 
        'Has project access'::TEXT,
        auth.has_project_access(p_project_id),
        format('Access to project %s: %s', p_project_id, auth.has_project_access(p_project_id))::TEXT;
    
    -- Reset context
    PERFORM set_config('app.current_user', '', false);
    PERFORM set_config('app.current_project', '', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- STEP 7: Audit Function for RLS Violations
-- =============================================

-- Function to log RLS policy violations
CREATE OR REPLACE FUNCTION log_rls_violation() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (
        table_name,
        action,
        user_id,
        project_id,
        details,
        ip_address,
        user_agent
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        auth.user_id(),
        auth.project_id(),
        json_build_object(
            'violation', 'RLS policy blocked action',
            'attempted_at', NOW()
        ),
        current_setting('app.client_ip', true),
        current_setting('app.user_agent', true)
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- STEP 8: Grant Permissions
-- =============================================

-- Grant execute permissions on security functions
GRANT EXECUTE ON FUNCTION auth.user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.project_id() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.has_project_access(UUID, TEXT) TO authenticated;

-- Grant access to views
GRANT SELECT ON my_projects TO authenticated;
GRANT SELECT ON project_team TO authenticated;

-- =============================================
-- STEP 9: Add Comments for Documentation
-- =============================================

COMMENT ON FUNCTION auth.user_id() IS 'Returns the current authenticated user ID from session context';
COMMENT ON FUNCTION auth.project_id() IS 'Returns the current project ID from session context';
COMMENT ON FUNCTION auth.has_project_access(UUID, TEXT) IS 'Checks if current user has specified role access to a project';
COMMENT ON VIEW my_projects IS 'Shows all projects accessible to the current user';
COMMENT ON VIEW project_team IS 'Shows team members for projects where current user is admin';

COMMIT;

-- =============================================
-- Verification Queries (Run these to test)
-- =============================================

/*
-- Check if RLS is enabled on all tables
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname IN ('public', 'auth')
ORDER BY schemaname, tablename;

-- Check existing policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
ORDER BY schemaname, tablename, policyname;

-- Test as a specific user
SET app.current_user = 'user-uuid-here';
SET app.current_project = 'project-uuid-here';
SELECT * FROM bookings; -- Should only see allowed data

-- Reset session
RESET app.current_user;
RESET app.current_project;
*/