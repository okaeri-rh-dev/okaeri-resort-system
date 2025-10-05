-- ============================================
-- AUDIT TRAIL SYSTEM MIGRATION
-- Version: 1.0.0
-- Date: 2025-01-03
-- Description: Complete audit trail system with automatic triggers,
--              role-based access control, and performance optimization
-- ============================================

-- ============================================
-- AUDIT LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    -- Identity
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correlation_id UUID DEFAULT gen_random_uuid(),

    -- What changed (Layer 1: Database Triggers)
    table_name TEXT NOT NULL,
    record_id TEXT,  -- TEXT for flexibility with non-UUID PKs
    record_pk JSONB,  -- Full composite primary key as JSON
    action VARCHAR(10) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    event_type VARCHAR(50),  -- Business event type for Layer 2

    -- Source tracking (Dual-Layer Design)
    source VARCHAR(10) NOT NULL DEFAULT 'db' CHECK (source IN ('db', 'app')),

    -- Who made the change
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT,
    user_role TEXT,

    -- Data changes
    old_data JSONB,
    new_data JSONB,
    changed_fields TEXT[],

    -- Application context (Layer 2)
    description TEXT,
    category VARCHAR(50),
    severity VARCHAR(20) CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL', 'DEBUG')),
    metadata JSONB,

    -- Client context
    ip_address INET,
    user_agent TEXT,

    -- Timing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_changed_fields CHECK (
        (source = 'app') OR
        (action != 'UPDATE') OR
        (changed_fields IS NOT NULL AND array_length(changed_fields, 1) > 0)
    ),
    CONSTRAINT valid_event_type CHECK (
        (source = 'db' AND event_type IS NULL) OR
        (source = 'app')
    )
);

-- Add table comment
COMMENT ON TABLE audit_logs IS
    'Central audit trail for all database changes. Populated by PostgreSQL triggers (Layer 1) and application logging (Layer 2)';

-- ============================================
-- APP ROLES TABLE (Role Management)
-- ============================================
CREATE TABLE IF NOT EXISTS app_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'owner', 'manager', 'staff')),
    granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT
);

-- Add indexes for app_roles
CREATE INDEX IF NOT EXISTS idx_app_roles_role ON app_roles(role);
CREATE INDEX IF NOT EXISTS idx_app_roles_email ON app_roles(email);
CREATE INDEX IF NOT EXISTS idx_app_roles_active ON app_roles(is_active) WHERE is_active = TRUE;

-- Add table comment
COMMENT ON TABLE app_roles IS
    'User role assignments for audit trail access control. Provides runtime-reconfigurable role management';

-- ============================================
-- AUDIT TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    audit_user_id UUID;
    audit_user_email TEXT;
    audit_user_role TEXT;
    changed_fields TEXT[];
    pk_column_name TEXT;
    record_id TEXT;
    sensitive_fields TEXT[];
    field_name TEXT;
    redacted_old JSONB;
    redacted_new JSONB;
BEGIN
    -- Extract user context from auth
    BEGIN
        audit_user_id := auth.uid();
        audit_user_email := NULLIF(
            current_setting('request.jwt.claims', TRUE)::json->>'email',
            ''
        );
        audit_user_role := NULLIF(
            current_setting('request.jwt.claims', TRUE)::json->>'role',
            ''
        );
    EXCEPTION WHEN OTHERS THEN
        audit_user_id := NULL;
        audit_user_email := NULL;
        audit_user_role := NULL;
    END;

    -- Determine primary key column
    SELECT a.attname INTO pk_column_name
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid
        AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = TG_RELID
        AND i.indisprimary
    LIMIT 1;

    -- Extract record ID
    IF TG_OP = 'DELETE' THEN
        EXECUTE format('SELECT ($1).%I::TEXT', pk_column_name)
            INTO record_id
            USING OLD;
    ELSE
        EXECUTE format('SELECT ($1).%I::TEXT', pk_column_name)
            INTO record_id
            USING NEW;
    END IF;

    -- Define sensitive fields per table
    sensitive_fields := CASE TG_TABLE_NAME
        WHEN 'guests' THEN ARRAY['guest_phone', 'guest_email', 'guest_address', 'guest_notes', 'emergency_contact_phone']
        WHEN 'bookings' THEN ARRAY['special_requests', 'internal_notes']
        WHEN 'payments' THEN ARRAY['payment_method_details', 'transaction_reference', 'receipt_url']
        WHEN 'expenses' THEN ARRAY['vendor_contact', 'receipt_url']
        ELSE ARRAY[]::TEXT[]
    END;

    -- Redact old_data if present
    IF TG_OP IN ('UPDATE', 'DELETE') AND array_length(sensitive_fields, 1) > 0 THEN
        redacted_old := to_jsonb(OLD);
        FOREACH field_name IN ARRAY sensitive_fields
        LOOP
            IF redacted_old ? field_name THEN
                redacted_old := jsonb_set(redacted_old, ARRAY[field_name], '"[REDACTED]"'::jsonb);
            END IF;
        END LOOP;
    ELSE
        redacted_old := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END;
    END IF;

    -- Redact new_data if present
    IF TG_OP IN ('INSERT', 'UPDATE') AND array_length(sensitive_fields, 1) > 0 THEN
        redacted_new := to_jsonb(NEW);
        FOREACH field_name IN ARRAY sensitive_fields
        LOOP
            IF redacted_new ? field_name THEN
                redacted_new := jsonb_set(redacted_new, ARRAY[field_name], '"[REDACTED]"'::jsonb);
            END IF;
        END LOOP;
    ELSE
        redacted_new := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END;
    END IF;

    -- Calculate changed fields for UPDATE
    IF TG_OP = 'UPDATE' THEN
        changed_fields := ARRAY(
            SELECT jsonb_object_keys(redacted_old) AS key
            WHERE redacted_old->key IS DISTINCT FROM redacted_new->key
        );
    END IF;

    -- Insert audit log
    BEGIN
        INSERT INTO audit_logs (
            table_name,
            record_id,
            action,
            source,
            user_id,
            user_email,
            user_role,
            old_data,
            new_data,
            changed_fields
        ) VALUES (
            TG_TABLE_NAME,
            record_id,
            TG_OP,
            'db',
            audit_user_id,
            audit_user_email,
            audit_user_role,
            redacted_old,
            redacted_new,
            changed_fields
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to create audit log: %', SQLERRM;
    END;

    -- Return appropriate value
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_trigger_func() IS
    'Generic audit trigger function that captures all database changes with PII redaction';

-- ============================================
-- IDENTITY ENFORCEMENT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION enforce_audit_identity_func()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.source = 'app' OR NEW.source IS NULL THEN
        NEW.user_id := auth.uid();
        NEW.user_email := NULLIF(
            current_setting('request.jwt.claims', TRUE)::json->>'email',
            ''
        );
        NEW.user_role := NULLIF(
            current_setting('request.jwt.claims', TRUE)::json->>'role',
            ''
        );
        NEW.source := 'app';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER enforce_audit_identity
BEFORE INSERT ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION enforce_audit_identity_func();

-- ============================================
-- ATTACH TRIGGERS TO ALL TABLES
-- ============================================

-- Units (property rooms)
CREATE TRIGGER audit_units_trigger
    AFTER INSERT OR UPDATE OR DELETE ON units
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Guests
CREATE TRIGGER audit_guests_trigger
    AFTER INSERT OR UPDATE OR DELETE ON guests
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Bookings
CREATE TRIGGER audit_bookings_trigger
    AFTER INSERT OR UPDATE OR DELETE ON bookings
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Payments
CREATE TRIGGER audit_payments_trigger
    AFTER INSERT OR UPDATE OR DELETE ON payments
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Expenses
CREATE TRIGGER audit_expenses_trigger
    AFTER INSERT OR UPDATE OR DELETE ON expenses
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Maintenance Logs
CREATE TRIGGER audit_maintenance_logs_trigger
    AFTER INSERT OR UPDATE OR DELETE ON maintenance_logs
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- ============================================
-- PERFORMANCE INDEXES
-- ============================================

-- User context index
CREATE INDEX idx_audit_logs_user_context ON audit_logs (user_email, user_id);

-- Table name index
CREATE INDEX idx_audit_logs_table_name ON audit_logs (table_name);

-- Action index
CREATE INDEX idx_audit_logs_action ON audit_logs (action);

-- Timestamp index (DESC for recent-first queries)
CREATE INDEX idx_audit_logs_timestamp ON audit_logs (created_at DESC);

-- Record tracking index
CREATE INDEX idx_audit_logs_record ON audit_logs (table_name, record_id);

-- Composite index for complex queries
CREATE INDEX idx_audit_logs_composite ON audit_logs (table_name, user_email, created_at DESC);

-- Keyset pagination index
CREATE INDEX idx_audit_logs_keyset ON audit_logs (created_at DESC, audit_id DESC);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get user role function
CREATE OR REPLACE FUNCTION get_user_role(p_user_id UUID)
RETURNS TEXT AS $$
BEGIN
    RETURN (
        SELECT role
        FROM app_roles
        WHERE user_id = p_user_id
          AND is_active = TRUE
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user has role
CREATE OR REPLACE FUNCTION has_role(p_user_id UUID, p_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM app_roles
        WHERE user_id = p_user_id
          AND role = p_role
          AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- SELECT policy
CREATE POLICY "audit_logs_select_policy"
ON audit_logs
FOR SELECT
USING (
    -- Admins and owners see all
    EXISTS (
        SELECT 1 FROM app_roles ar
        WHERE ar.user_id = auth.uid()
          AND ar.role IN ('admin', 'owner')
          AND ar.is_active = TRUE
    )
    OR
    -- Managers see business operations only
    (
        EXISTS (
            SELECT 1 FROM app_roles ar
            WHERE ar.user_id = auth.uid()
              AND ar.role = 'manager'
              AND ar.is_active = TRUE
        )
        AND table_name IN ('bookings', 'payments', 'guests', 'expenses', 'system', 'authentication')
    )
    OR
    -- Staff see only their own logs
    (
        user_email = (current_setting('request.jwt.claims', TRUE)::json->>'email')
    )
);

-- INSERT policy
CREATE POLICY "audit_logs_insert_policy"
ON audit_logs
FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL OR user_id IS NULL
);

-- DELETE policy (for archival)
CREATE POLICY "audit_logs_delete_policy"
ON audit_logs
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM app_roles ar
        WHERE ar.user_id = auth.uid()
          AND ar.role IN ('admin', 'owner')
          AND ar.is_active = TRUE
    )
);

-- Enable RLS on app_roles
ALTER TABLE app_roles ENABLE ROW LEVEL SECURITY;

-- app_roles SELECT policy
CREATE POLICY "app_roles_select_policy"
ON app_roles
FOR SELECT
USING (
    -- Admins see all
    EXISTS (
        SELECT 1 FROM app_roles ar
        WHERE ar.user_id = auth.uid()
          AND ar.role = 'admin'
          AND ar.is_active = TRUE
    )
    OR
    -- Users see their own role
    user_id = auth.uid()
);

-- app_roles INSERT policy
CREATE POLICY "app_roles_insert_policy"
ON app_roles
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM app_roles ar
        WHERE ar.user_id = auth.uid()
          AND ar.role = 'admin'
          AND ar.is_active = TRUE
    )
);

-- app_roles UPDATE policy
CREATE POLICY "app_roles_update_policy"
ON app_roles
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM app_roles ar
        WHERE ar.user_id = auth.uid()
          AND ar.role = 'admin'
          AND ar.is_active = TRUE
    )
);

-- app_roles DELETE policy
CREATE POLICY "app_roles_delete_policy"
ON app_roles
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM app_roles ar
        WHERE ar.user_id = auth.uid()
          AND ar.role = 'admin'
          AND ar.is_active = TRUE
    )
    AND user_id != auth.uid()  -- Cannot delete own role
);

-- ============================================
-- HELPER FUNCTIONS FOR APPLICATION
-- ============================================

-- Attach audit trigger helper
CREATE OR REPLACE FUNCTION attach_audit_trigger(target_table TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE format('
        CREATE TRIGGER audit_%I_trigger
        AFTER INSERT OR UPDATE OR DELETE ON %I
        FOR EACH ROW EXECUTE FUNCTION audit_trigger_func()
    ', target_table, target_table);
    RAISE NOTICE 'Audit trigger attached to table: %', target_table;
END;
$$ LANGUAGE plpgsql;

-- Detach audit trigger helper
CREATE OR REPLACE FUNCTION detach_audit_trigger(target_table TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%I_trigger ON %I',
        target_table, target_table);
    RAISE NOTICE 'Audit trigger detached from table: %', target_table;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INITIAL SEED DATA
-- ============================================

-- Seed initial admin role (replace with actual user ID and email)
-- This should be uncommented and modified during deployment
-- INSERT INTO app_roles (user_id, email, role, granted_by, notes)
-- VALUES (
--     'YOUR-ADMIN-USER-UUID',
--     'admin@yourdomain.com',
--     'admin',
--     NULL,
--     'Bootstrap admin - initial system setup'
-- ) ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================