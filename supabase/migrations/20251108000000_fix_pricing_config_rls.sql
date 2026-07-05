-- Fix pricing_config RLS policy to allow admin, manager, and owner roles
-- This aligns the database policy with the API endpoint authorization logic

-- Drop existing restrictive policy
DROP POLICY IF EXISTS pricing_config_admin_policy ON pricing_config;

-- Create new policy that allows admin, manager, and owner roles
CREATE POLICY pricing_config_admin_policy ON pricing_config
    FOR ALL
    TO authenticated
    USING (
        -- Allow users with admin, manager, or owner role in app_roles table
        (SELECT role FROM app_roles
         WHERE user_id = auth.uid()
         AND is_active = TRUE
         AND role IN ('admin', 'manager', 'owner')
         LIMIT 1) IS NOT NULL
    )
    WITH CHECK (
        -- Same check for INSERT/UPDATE operations
        (SELECT role FROM app_roles
         WHERE user_id = auth.uid()
         AND is_active = TRUE
         AND role IN ('admin', 'manager', 'owner')
         LIMIT 1) IS NOT NULL
    );

-- Add comment explaining the policy
COMMENT ON POLICY pricing_config_admin_policy ON pricing_config IS
'Allows authenticated users with admin, manager, or owner roles to manage pricing configuration. This aligns with the API endpoint authorization logic.';
