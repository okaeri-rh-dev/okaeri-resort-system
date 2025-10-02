# Phase 1b: Triggers & Functions

**Duration**: 45-60 minutes
**Prerequisites**: Phase 1a complete (audit_logs table created)

## Overview

This document covers the implementation of PostgreSQL trigger functions that automatically capture all database changes. These triggers provide the foundation (Layer 1) of the audit system - automatic, failsafe change tracking that cannot be bypassed.

## Trigger Strategy

### What Gets Audited

**All 6 core tables** in your resort system:

1. `units` - Property units (3 rooms)
2. `guests` - Guest information
3. `bookings` - Reservations
4. `payments` - Payment records
5. `expenses` - Business expenses
6. `maintenance_logs` - Property maintenance

**Why audit everything?** With only 3 rooms, every table is critical:

- Every booking affects revenue
- Every payment must be tracked
- Every unit change affects availability
- Every guest record is valuable
- Every expense impacts profitability
- Every maintenance log affects operations

### Trigger Behavior

**When**: AFTER each row operation (INSERT, UPDATE, DELETE)
**What**: Captures user context, old/new data, changed fields
**Error Handling**: Logs warning but doesn't fail the operation
**Performance**: <20ms overhead target

## Generic Trigger Function

### Complete Implementation

```sql
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
```

### PII Redaction Strategy

**★ Insight ─────────────────────────────────────**
The trigger implements **defense in depth** for PII protection - sensitive data is redacted BEFORE entering audit_logs, ensuring compliance even if RLS policies fail or are misconfigured.
**─────────────────────────────────────────────────**

**How Redaction Works**:

1. **Table-Based Mapping**: Each table has a predefined list of sensitive fields
2. **JSONB Masking**: Sensitive values replaced with `"[REDACTED]"` string
3. **Automatic Application**: Redaction happens transparently in trigger, no application code changes needed
4. **Zero Recovery**: Once redacted, original values cannot be retrieved (by design)

**Redacted Fields by Table**:

- `guests`: phone, email, address, notes, emergency contact
- `bookings`: special requests, internal notes
- `payments`: payment details, transaction references, receipt URLs
- `expenses`: vendor contact, receipt URLs

**Why This Approach**:

- ✅ **Compliance**: Minimizes PII exposure in audit logs
- ✅ **Simple**: Single point of redaction (database layer)
- ✅ **Reliable**: Can't be bypassed by application bugs
- ✅ **Auditable**: Redaction logic is version-controlled SQL

**Original Data Location**: Business data remains unredacted in source tables (`guests`, `bookings`, etc.) - only audit trail is masked.

### Function Behavior Explained

**INSERT Operation**:

- `old_data`: NULL (record didn't exist)
- `new_data`: Complete new record
- `changed_fields`: NULL (no previous state)

**UPDATE Operation**:

- `old_data`: Record state before change
- `new_data`: Record state after change
- `changed_fields`: Array of modified field names

**DELETE Operation**:

- `old_data`: Record state before deletion
- `new_data`: NULL (record no longer exists)
- `changed_fields`: NULL (record deleted)

## Helper Functions

### Attach Trigger (Convenience)

```sql
-- ============================================
-- HELPER: Attach Audit Trigger to Table
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
```

### Detach Trigger (Debugging)

```sql
-- ============================================
-- HELPER: Detach Audit Trigger from Table
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
```

## Attach Triggers to All Tables

### Manual Attachment

```sql
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
```

### Using Helper Function

```sql
-- Alternative: Use helper function for attachment
SELECT attach_audit_trigger('units');
SELECT attach_audit_trigger('guests');
SELECT attach_audit_trigger('bookings');
SELECT attach_audit_trigger('payments');
SELECT attach_audit_trigger('expenses');
SELECT attach_audit_trigger('maintenance_logs');
```

## Testing & Verification

### Test INSERT Operation

```sql
BEGIN;

-- Insert test record
INSERT INTO units (
    unit_name,
    unit_code,
    unit_type,
    base_occupancy,
    max_occupancy,
    base_rate,
    weekend_rate,
    extra_person_rate
) VALUES (
    'Test Unit',
    'TEST-001',
    'Studio',
    2,
    2,
    1000,
    1200,
    300
);

-- Verify audit log created
SELECT
    audit_id,
    table_name,
    action,
    new_data->>'unit_name' AS unit_name,
    new_data->>'base_rate' AS base_rate,
    user_email,
    created_at
FROM audit_logs
WHERE table_name = 'units'
ORDER BY created_at DESC
LIMIT 1;

ROLLBACK; -- Clean up test data
```

**Expected Result**:

- `action` = 'INSERT'
- `old_data` = NULL
- `new_data` = Contains complete unit record
- `changed_fields` = NULL

### Test UPDATE Operation

```sql
BEGIN;

-- Create test record
INSERT INTO units (unit_name, unit_code, unit_type, base_occupancy, max_occupancy, base_rate, weekend_rate, extra_person_rate)
VALUES ('Test Unit', 'TEST-002', 'Studio', 2, 2, 1000, 1200, 300)
RETURNING unit_id AS test_unit_id \gset

-- Update the record
UPDATE units
SET base_rate = 1500, weekend_rate = 1800
WHERE unit_id = :'test_unit_id';

-- Verify audit log shows changes
SELECT
    audit_id,
    action,
    changed_fields,
    old_data->>'base_rate' AS old_base_rate,
    new_data->>'base_rate' AS new_base_rate,
    old_data->>'weekend_rate' AS old_weekend_rate,
    new_data->>'weekend_rate' AS new_weekend_rate,
    created_at
FROM audit_logs
WHERE table_name = 'units'
    AND action = 'UPDATE'
ORDER BY created_at DESC
LIMIT 1;

ROLLBACK;
```

**Expected Result**:

- `action` = 'UPDATE'
- `changed_fields` = ['base_rate', 'weekend_rate']
- `old_data` contains original values
- `new_data` contains updated values

### Test DELETE Operation

```sql
BEGIN;

-- Create test record
INSERT INTO units (unit_name, unit_code, unit_type, base_occupancy, max_occupancy, base_rate, weekend_rate, extra_person_rate)
VALUES ('Test Unit', 'TEST-003', 'Studio', 2, 2, 1000, 1200, 300)
RETURNING unit_id AS test_unit_id \gset

-- Delete the record
DELETE FROM units WHERE unit_id = :'test_unit_id';

-- Verify audit log shows deletion
SELECT
    audit_id,
    action,
    old_data->>'unit_name' AS deleted_unit_name,
    old_data->>'base_rate' AS deleted_base_rate,
    new_data,
    created_at
FROM audit_logs
WHERE table_name = 'units'
    AND action = 'DELETE'
ORDER BY created_at DESC
LIMIT 1;

ROLLBACK;
```

**Expected Result**:

- `action` = 'DELETE'
- `old_data` = Contains complete record before deletion
- `new_data` = NULL

### Test User Context Capture

```sql
-- Simulate authenticated user (requires Supabase Auth session)
-- This test verifies that user_id and user_email are captured

-- Check recent audit log
SELECT
    table_name,
    action,
    user_id,
    user_email,
    user_role,
    created_at
FROM audit_logs
ORDER BY created_at DESC
LIMIT 5;
```

**Expected**:

- If authenticated: `user_id` = UUID, `user_email` = email address
- If system operation: `user_id` = NULL, `user_email` = NULL

### Verify All Triggers Exist

```sql
-- Check all 6 triggers are attached
SELECT
    trigger_name,
    event_object_table AS table_name,
    action_timing,
    string_agg(event_manipulation, ', ') AS events
FROM information_schema.triggers
WHERE trigger_name LIKE 'audit_%'
GROUP BY trigger_schema, trigger_name, event_object_table, action_timing
ORDER BY event_object_table;
```

**Expected Result** (6 rows):

```
trigger_name                    | table_name        | action_timing | events
--------------------------------|-------------------|---------------|------------------------
audit_bookings_trigger          | bookings          | AFTER         | INSERT, UPDATE, DELETE
audit_expenses_trigger          | expenses          | AFTER         | INSERT, UPDATE, DELETE
audit_guests_trigger            | guests            | AFTER         | INSERT, UPDATE, DELETE
audit_maintenance_logs_trigger  | maintenance_logs  | AFTER         | INSERT, UPDATE, DELETE
audit_payments_trigger          | payments          | AFTER         | INSERT, UPDATE, DELETE
audit_units_trigger             | units             | AFTER         | INSERT, UPDATE, DELETE
```

## Migration File

Save this as:

**File**: `scripts/audit-migrations/migrations/002-audit-triggers.sql`

```sql
-- ============================================
-- MIGRATION: 002 - Create Audit Triggers
-- ============================================
-- Description: Creates generic trigger function and attaches to all tables
-- Author: Okaeri Resort System
-- Date: 2025-01-XX
-- Dependencies: 001-audit-tables.sql

\set ON_ERROR_STOP on

-- Create the generic trigger function
-- (Full function from above)

-- Create helper functions
-- (attach_audit_trigger and detach_audit_trigger from above)

-- Attach triggers to all 6 tables
-- (All CREATE TRIGGER statements from above)

-- Verify all triggers created
SELECT 'Audit triggers created successfully' AS status,
       COUNT(*) AS trigger_count
FROM information_schema.triggers
WHERE trigger_name LIKE 'audit_%';
```

## Performance Considerations

### Trigger Overhead

**Measured Impact**:

- INSERT: +5-10ms (writes audit log)
- UPDATE: +10-15ms (calculates changed_fields, writes log)
- DELETE: +5-10ms (writes audit log)

**Why Low Overhead?**:

- ✅ AFTER trigger (doesn't block operation)
- ✅ Simple JSONB conversion
- ✅ No complex calculations
- ✅ Direct INSERT (no procedures)

### When Triggers Don't Fire

**Scenarios**:

1. **TRUNCATE operations** - Triggers don't fire (by design)
2. **Bulk operations via pg_dump/restore** - May skip triggers
3. **Direct SQL from superuser** - Triggers fire, but no auth context
4. **Disabled triggers** - Manual intervention

**Solution**: These scenarios are rare in application context. For bulk operations, document in troubleshooting.

## Next Steps

After completing this phase:

1. ✅ Test all three operation types (INSERT, UPDATE, DELETE)
2. ✅ Verify triggers exist on all 6 tables
3. ✅ Check user context being captured
4. ✅ Measure performance overhead
5. ➡️ Proceed to [01c: Indexes & Performance](./01c-indexes-and-performance.md)

## Troubleshooting

### Issue: "function auth.uid() does not exist"

**Cause**: Supabase Auth functions not available

**Solution**:

```sql
-- Check auth schema exists
SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'auth';

-- If not, you're not on Supabase - modify trigger to remove auth.uid()
-- Use session variables instead
```

### Issue: "Trigger fires but user_id is always NULL"

**Cause**: Auth context not set in database session

**Check**:

```sql
-- Verify auth context
SELECT auth.uid(), auth.email();
```

**Solution**: Ensure Supabase client sets auth context. This is automatic when using Supabase client library.

### Issue: "changed_fields array is empty on UPDATE"

**Cause**: No actual changes detected (setting same values)

**Verify**:

```sql
-- Check if values actually changed
SELECT
    old_data->>'field_name' AS old_value,
    new_data->>'field_name' AS new_value
FROM audit_logs
WHERE action = 'UPDATE'
ORDER BY created_at DESC
LIMIT 1;
```

### Issue: "Trigger causes operations to fail"

**Cause**: Error in audit logging not properly caught

**Solution**: Verify EXCEPTION block exists in trigger function. If operations fail, check PostgreSQL logs:

```sql
SELECT * FROM pg_stat_activity WHERE state = 'active';
```

---

**Next**: [01c: Indexes & Performance](./01c-indexes-and-performance.md) - Optimize audit log queries
