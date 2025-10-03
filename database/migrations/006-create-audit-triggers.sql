-- ============================================
-- MIGRATION: 006 - Create Audit Triggers
-- ============================================
-- Description: Creates generic trigger function and attaches to all tables
-- Author: Okaeri Resort System - Audit Trail Phase 1
-- Date: 2025-01-02
-- Dependencies: 005-create-audit-logs.sql

\set ON_ERROR_STOP on

-- ============================================
-- AUDIT TRIGGER FUNCTION
-- ============================================
-- Description: Generic function that captures all database changes
-- Usage: Attach to any table with UUID primary key
-- Performance: ~5-15ms overhead per operation

CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    audit_user_id UUID;
    audit_user_email TEXT;
    audit_user_role TEXT;
    changed_fields TEXT[];
    pk_column_name TEXT;
    record_id TEXT;
    -- PII redaction variables
    sensitive_fields TEXT[];
    field_name TEXT;
    redacted_old JSONB;
    redacted_new JSONB;
BEGIN
    -- ============================================
    -- STEP 1: EXTRACT USER CONTEXT FROM AUTH
    -- ============================================
    BEGIN
        -- Get current authenticated user from Supabase Auth
        audit_user_id := auth.uid();

        -- Extract email from JWT claims (auth.email() function doesn't exist)
        audit_user_email := NULLIF(
            current_setting('request.jwt.claims', TRUE)::json->>'email',
            ''
        );

        -- Get user role from JWT claims (if available)
        -- Returns owner/manager/staff or NULL
        audit_user_role := NULLIF(
            current_setting('request.jwt.claims', TRUE)::json->>'role',
            ''
        );

    EXCEPTION WHEN OTHERS THEN
        -- If auth context unavailable (system operations), use NULL
        audit_user_id := NULL;
        audit_user_email := NULL;
        audit_user_role := NULL;
    END;

    -- ============================================
    -- STEP 2: DETERMINE PRIMARY KEY COLUMN
    -- ============================================
    -- Convention: Looks for the primary key column
    -- Works with: unit_id, booking_id, guest_id, etc.
    SELECT a.attname INTO pk_column_name
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid
        AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = TG_RELID
        AND i.indisprimary
    LIMIT 1;

    -- ============================================
    -- STEP 3: EXTRACT RECORD ID (as TEXT)
    -- ============================================
    IF TG_OP = 'DELETE' THEN
        -- For DELETE, get ID from OLD record and cast to TEXT
        EXECUTE format('SELECT ($1).%I::TEXT', pk_column_name)
            INTO record_id
            USING OLD;
    ELSE
        -- For INSERT/UPDATE, get ID from NEW record and cast to TEXT
        EXECUTE format('SELECT ($1).%I::TEXT', pk_column_name)
            INTO record_id
            USING NEW;
    END IF;

    -- ============================================
    -- STEP 3.5: REDACT SENSITIVE FIELDS (PII Protection)
    -- ============================================
    -- Redact sensitive fields based on table name
    -- This ensures PII never enters audit_logs in plain text

    -- Define sensitive fields per table
    sensitive_fields := CASE TG_TABLE_NAME
        WHEN 'guests' THEN ARRAY['phone_number', 'email']
        WHEN 'bookings' THEN ARRAY['contact_number', 'email', 'special_requests', 'internal_notes']
        WHEN 'payments' THEN ARRAY['notes', 'proof_url']
        WHEN 'expenses' THEN ARRAY['notes', 'receipt_url']
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

    -- ============================================
    -- STEP 4: CALCULATE CHANGED FIELDS (UPDATE ONLY)
    -- ============================================
    IF TG_OP = 'UPDATE' THEN
        -- Compare old and new values to find differences
        -- Exclude meta fields that change automatically
        SELECT ARRAY_AGG(key) INTO changed_fields
        FROM jsonb_each(to_jsonb(NEW))
        WHERE to_jsonb(NEW)->key IS DISTINCT FROM to_jsonb(OLD)->key
            AND key NOT IN ('updated_at', 'created_at');
    END IF;

    -- ============================================
    -- STEP 5: INSERT AUDIT LOG ENTRY
    -- ============================================
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
            changed_fields,
            created_at
        ) VALUES (
            TG_TABLE_NAME,                          -- Which table was modified
            record_id,                              -- Which record was modified
            TG_OP,                                  -- INSERT, UPDATE, or DELETE
            'db',                                   -- Source: database trigger (Layer 1)
            audit_user_id,                          -- Who (NULL for system)
            audit_user_email,
            audit_user_role,
            redacted_old,                           -- Before state (PII redacted)
            redacted_new,                           -- After state (PII redacted)
            changed_fields,                         -- What changed
            NOW()                                   -- When
        );

    EXCEPTION WHEN OTHERS THEN
        -- Critical: Don't fail the main operation if audit fails
        -- Just log a warning for investigation
        RAISE WARNING 'Audit logging failed for %.%: %',
            TG_TABLE_NAME, record_id, SQLERRM;
    END;

    -- ============================================
    -- STEP 6: RETURN APPROPRIATE VALUE
    -- ============================================
    -- PostgreSQL requires triggers to return OLD or NEW
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set function ownership to postgres for security
ALTER FUNCTION audit_trigger_func() OWNER TO postgres;

-- Add function comment
COMMENT ON FUNCTION audit_trigger_func() IS
    'Generic audit trigger function that captures all database changes. Automatically extracts user context from Supabase Auth, redacts PII, and stores before/after data in JSONB format.';

-- ============================================
-- HELPER FUNCTION: Attach Audit Trigger
-- ============================================
-- Usage: SELECT attach_audit_trigger('bookings');

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

COMMENT ON FUNCTION attach_audit_trigger(TEXT) IS
    'Convenience function to attach audit trigger to a table. Creates trigger named audit_{table}_trigger.';

-- ============================================
-- HELPER FUNCTION: Detach Audit Trigger
-- ============================================
-- Usage: SELECT detach_audit_trigger('bookings');

CREATE OR REPLACE FUNCTION detach_audit_trigger(target_table TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%I_trigger ON %I',
        target_table, target_table);
    RAISE NOTICE 'Audit trigger detached from table: %', target_table;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION detach_audit_trigger(TEXT) IS
    'Remove audit trigger from a table. Useful for debugging or temporary disablement.';

-- ============================================
-- ATTACH TRIGGERS TO ALL 6 CORE TABLES
-- ============================================

-- Units (3 rooms)
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
-- VERIFICATION QUERIES
-- ============================================

-- List all audit triggers
SELECT
    trigger_name,
    event_object_table as table_name,
    action_timing,
    string_agg(event_manipulation, ', ') as events
FROM information_schema.triggers
WHERE trigger_name LIKE 'audit_%'
GROUP BY trigger_schema, trigger_name, event_object_table, action_timing
ORDER BY event_object_table;

-- Expected: 6 rows (units, guests, bookings, payments, expenses, maintenance_logs)
-- Plus 1 identity enforcement trigger on audit_logs (from migration 005)
SELECT
    'Audit triggers created' AS status,
    COUNT(*) AS trigger_count
FROM information_schema.triggers
WHERE trigger_name LIKE 'audit_%'
  AND event_object_table IN ('units', 'guests', 'bookings', 'payments', 'expenses', 'maintenance_logs');

-- Migration complete
SELECT '✅ Migration 006 complete: 6 table triggers + helper functions created successfully' AS status;
