-- ============================================
-- MIGRATION: 005 - Create Audit Logs Tables
-- ============================================
-- Description: Creates audit_logs, audit_logs_archive, and app_roles tables
-- Author: Okaeri Resort System - Audit Trail Phase 1
-- Date: 2025-01-02
-- Dependencies: None (foundation migration)

\set ON_ERROR_STOP on

-- ============================================
-- AUDIT LOGS TABLE
-- ============================================
-- Description: Central audit trail for all database changes
-- Populated by: PostgreSQL triggers (Layer 1) + Application logging (Layer 2)
-- Retention: Manual archival recommended quarterly

CREATE TABLE IF NOT EXISTS audit_logs (
    -- ============================================
    -- IDENTITY
    -- ============================================
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Correlation ID for linking related log entries
    -- Allows connecting trigger logs with corresponding app logs for the same business operation
    -- Example: booking update triggers audit_trigger_func (correlation_id=X)
    --          AND app logs business context (same correlation_id=X)
    -- Defaults to random UUID; app can pass explicit value to correlate events
    correlation_id UUID DEFAULT gen_random_uuid(),

    -- ============================================
    -- WHAT CHANGED (Layer 1: Database Triggers)
    -- ============================================
    table_name TEXT NOT NULL,
    record_id TEXT,  -- Nullable to support app events without specific records. TEXT type for flexibility with non-UUID PKs.
    record_pk JSONB,  -- Full composite primary key as JSON (for tables with multi-column PKs)
    action VARCHAR(10) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),

    -- Business event type for application-level logs (Layer 2 only)
    -- Examples: 'login', 'logout', 'cancel_booking', 'refund_payment', 'system_migration'
    -- NULL for database trigger logs (Layer 1)
    event_type VARCHAR(50),

    -- ============================================
    -- SOURCE TRACKING (Dual-Layer Design)
    -- ============================================
    -- Distinguishes between database triggers and application logging
    -- 'db' = Layer 1 (automatic database triggers)
    -- 'app' = Layer 2 (manual application logging with business context)
    source VARCHAR(10) NOT NULL DEFAULT 'db' CHECK (source IN ('db', 'app')),

    -- ============================================
    -- WHO MADE THE CHANGE (Layer 1: From auth.uid())
    -- ============================================
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT,
    user_role TEXT,

    -- ============================================
    -- DATA CHANGES (Layer 1: Automatic Capture)
    -- ============================================
    -- old_data: Complete record state BEFORE change (NULL for INSERT)
    -- new_data: Complete record state AFTER change (NULL for DELETE)
    old_data JSONB,
    new_data JSONB,

    -- Array of field names that changed (UPDATE only for DB triggers)
    -- Example: ['base_rate', 'weekend_rate']
    -- NULL for Layer 2 app events
    changed_fields TEXT[],

    -- ============================================
    -- APPLICATION CONTEXT (Layer 2: Required for app events)
    -- ============================================
    -- These fields populated by application-level logging
    -- NULL when only database trigger fires (Layer 1)

    -- Human-readable description of the action
    -- Example: "Changed booking status from Pending to Confirmed"
    description TEXT,

    -- Categorization for filtering
    -- Examples: 'authentication', 'booking', 'payment', 'unit', 'guest', 'expense', 'maintenance', 'system'
    category VARCHAR(50),

    -- Severity level for monitoring (UPPERCASE)
    severity VARCHAR(20) CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL', 'DEBUG')),

    -- Additional machine-readable context (flexible JSON)
    -- Example: {"booking_reference": "BK-20250101-ABC123", "previous_status": "Pending"}
    -- NOTE: Do NOT duplicate description/category/severity here - use dedicated columns above
    metadata JSONB,

    -- ============================================
    -- CLIENT CONTEXT (Layer 2: Optional)
    -- ============================================
    -- Captured from application layer when available
    ip_address INET,
    user_agent TEXT,

    -- ============================================
    -- TIMING
    -- ============================================
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- ============================================
    -- CONSTRAINTS
    -- ============================================
    -- Layer 1 (DB triggers): UPDATE operations MUST have changed_fields
    -- Layer 2 (app events): changed_fields is NULL (app events use action='INSERT' by convention)
    CONSTRAINT valid_changed_fields CHECK (
        (source = 'app') OR  -- App events exempt from this constraint
        (action != 'UPDATE') OR
        (changed_fields IS NOT NULL AND array_length(changed_fields, 1) > 0)
    ),

    -- Event type validation: Only app events can have event_type
    CONSTRAINT valid_event_type CHECK (
        (source = 'db' AND event_type IS NULL) OR  -- DB triggers don't use event_type
        (source = 'app')  -- App events can optionally specify event_type
    )
);

-- ============================================
-- IDENTITY ENFORCEMENT TRIGGER (Security)
-- ============================================
-- Purpose: Prevent clients from forging user identity or source in Layer 2 logs
-- This trigger forces server-side identity extraction from JWT claims

CREATE OR REPLACE FUNCTION enforce_audit_identity_func()
RETURNS TRIGGER AS $$
BEGIN
    -- Only enforce for Layer 2 (app) logs or when source is NULL
    -- Layer 1 (db triggers) bypass this via SECURITY DEFINER context
    IF NEW.source = 'app' OR NEW.source IS NULL THEN
        -- Force user identity from Supabase Auth JWT claims
        NEW.user_id := auth.uid();
        NEW.user_email := NULLIF(
            current_setting('request.jwt.claims', TRUE)::json->>'email',
            ''
        );
        NEW.user_role := NULLIF(
            current_setting('request.jwt.claims', TRUE)::json->>'role',
            ''
        );

        -- Force source to 'app' for client-side inserts
        NEW.source := 'app';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER enforce_audit_identity
BEFORE INSERT ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION enforce_audit_identity_func();

COMMENT ON FUNCTION enforce_audit_identity_func() IS
    'Enforces server-side user identity for Layer 2 audit logs. Prevents clients from forging user_id, user_email, or source fields.';

-- ============================================
-- AUDIT LOGS ARCHIVE TABLE
-- ============================================
-- Purpose: Long-term storage for archived audit logs
-- Populated by: Manual archival via archive_audit_logs() function
-- Retention: Permanent or per compliance requirements

CREATE TABLE IF NOT EXISTS audit_logs_archive (
    LIKE audit_logs INCLUDING ALL
);

-- Add table comment
COMMENT ON TABLE audit_logs_archive IS
    'Archive storage for audit logs. Populated by archive_audit_logs() function. Logs are moved (not copied) from audit_logs to reduce active table size while maintaining audit trail.';

-- Indexes (same as main table for consistent query performance)
CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_user_context
    ON audit_logs_archive (user_email, user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_table_name
    ON audit_logs_archive (table_name);

CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_timestamp
    ON audit_logs_archive (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_record
    ON audit_logs_archive (table_name, record_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_correlation
    ON audit_logs_archive (correlation_id);

-- ============================================
-- APP ROLES TABLE (Role Management)
-- ============================================
-- Purpose: Store user role assignments for audit trail access control
-- Supports: admin, owner, manager, and staff roles
-- Alternative to GUC-based email lists (more portable and auditable)

CREATE TABLE IF NOT EXISTS app_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,  -- Denormalized for easier queries
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'owner', 'manager', 'staff')),
    granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT  -- Optional notes about why role was granted
);

-- Index for role-based queries
CREATE INDEX IF NOT EXISTS idx_app_roles_role ON app_roles(role);
CREATE INDEX IF NOT EXISTS idx_app_roles_active ON app_roles(is_active) WHERE is_active = TRUE;

-- Table comment
COMMENT ON TABLE app_roles IS
    'User role assignments for audit trail access control. Provides runtime-reconfigurable role management without requiring database admin privileges.';

COMMENT ON COLUMN app_roles.user_id IS
    'Foreign key to auth.users. Primary key ensures one role per user.';

COMMENT ON COLUMN app_roles.role IS
    'User role: admin (full system access + role management), owner (all audit logs), manager (business operations only), staff (own logs only).';

COMMENT ON COLUMN app_roles.granted_by IS
    'User who granted this role. NULL for bootstrap/system grants.';

COMMENT ON COLUMN app_roles.granted_at IS
    'Timestamp when role was granted.';

COMMENT ON COLUMN app_roles.notes IS
    'Optional notes about why role was granted or any special conditions.';

-- ============================================
-- TABLE AND COLUMN COMMENTS
-- ============================================

COMMENT ON TABLE audit_logs IS
    'Complete audit trail of all database changes. Populated by PostgreSQL triggers (automatic) and application-level logging (selective).';

COMMENT ON COLUMN audit_logs.audit_id IS
    'Unique identifier for this audit entry';

COMMENT ON COLUMN audit_logs.correlation_id IS
    'UUID for linking related log entries across layers. Defaults to random UUID. App can pass explicit value to correlate trigger logs with business context logs.';

COMMENT ON COLUMN audit_logs.table_name IS
    'Name of the table that was modified (e.g., bookings, units, payments)';

COMMENT ON COLUMN audit_logs.record_id IS
    'Identifier of the specific record that was modified. TEXT type for flexibility with UUID and non-UUID primary keys.';

COMMENT ON COLUMN audit_logs.record_pk IS
    'Full composite primary key as JSONB for tables with multi-column PKs. NULL for simple single-column PKs.';

COMMENT ON COLUMN audit_logs.action IS
    'Type of database operation: INSERT, UPDATE, or DELETE';

COMMENT ON COLUMN audit_logs.event_type IS
    'Business event type for application-level logs. Examples: login, logout, cancel_booking, refund_payment. NULL for database trigger logs.';

COMMENT ON COLUMN audit_logs.source IS
    'Source of audit log: db (database trigger), app (application logging)';

COMMENT ON COLUMN audit_logs.user_id IS
    'Foreign key to auth.users. NULL for system operations or unauthenticated actions.';

COMMENT ON COLUMN audit_logs.user_email IS
    'Email address of the user who made the change. Denormalized for query performance.';

COMMENT ON COLUMN audit_logs.user_role IS
    'User role at time of action (owner, manager, staff). Captured from JWT claims.';

COMMENT ON COLUMN audit_logs.old_data IS
    'Complete record state BEFORE the change. NULL for INSERT operations. Stored as JSONB for flexibility.';

COMMENT ON COLUMN audit_logs.new_data IS
    'Complete record state AFTER the change. NULL for DELETE operations. Stored as JSONB for flexibility.';

COMMENT ON COLUMN audit_logs.changed_fields IS
    'Array of field names that changed during UPDATE. Enables fast filtering (e.g., find all base_rate changes).';

COMMENT ON COLUMN audit_logs.description IS
    'Human-readable description from application layer. Example: "Changed booking status from Pending to Confirmed"';

COMMENT ON COLUMN audit_logs.category IS
    'Categorization for filtering: auth, booking, payment, unit, guest, expense, maintenance, system';

COMMENT ON COLUMN audit_logs.severity IS
    'Severity level for monitoring: INFO (default), WARNING (suspicious), CRITICAL (requires attention), DEBUG (verbose)';

COMMENT ON COLUMN audit_logs.metadata IS
    'Additional structured context from application layer. Flexible JSONB for business-specific data.';

COMMENT ON COLUMN audit_logs.ip_address IS
    'IP address of client that initiated the change. Captured from application layer when available.';

COMMENT ON COLUMN audit_logs.user_agent IS
    'Browser user agent string. Captured from application layer for client identification.';

COMMENT ON COLUMN audit_logs.created_at IS
    'Timestamp when audit log was created (UTC with timezone)';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check audit_logs table exists
SELECT 'audit_logs table created' AS status,
       COUNT(*) AS column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'audit_logs';

-- Check app_roles table exists
SELECT 'app_roles table created' AS status,
       COUNT(*) AS column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'app_roles';

-- Check audit_logs_archive table exists
SELECT 'audit_logs_archive table created' AS status,
       COUNT(*) AS column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'audit_logs_archive';

-- List all constraints
SELECT
    constraint_name,
    constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name = 'audit_logs'
ORDER BY constraint_type, constraint_name;

-- Verify identity enforcement trigger exists
SELECT
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers
WHERE trigger_name = 'enforce_audit_identity';

-- Migration complete
SELECT '✅ Migration 005 complete: audit_logs, app_roles, and archive tables created successfully' AS status;
