# 📦 Phase 1: Database Foundation

**Duration:** Week 1 (8-10 hours)  
**Status:** Not Started  
**Prerequisites:** PostgreSQL access, Supabase CLI

---

## 🎯 Phase Objectives

Build the foundational audit trail infrastructure at the database level using PostgreSQL triggers. This layer provides automatic, failsafe change tracking that cannot be bypassed by application code.

**Key Outcomes:**

- ✅ `audit_logs` table with optimized schema
- ✅ Generic audit trigger function
- ✅ Triggers on all existing tables (units, bookings, guests, expenses, payments, maintenance_logs)
- ✅ Performance indexes for fast querying
- ✅ Helper functions for audit log analysis

---

## 📋 Task Breakdown

### Task 1.1: Create Audit Logs Table (2 hours)

**Priority:** Critical  
**Dependencies:** None

Create the central `audit_logs` table that will store all change history.

**Schema Design Rationale:**

- **JSONB columns** for flexible storage of old/new data
- **Text arrays** for efficient changed field tracking
- **Proper indexes** for query performance
- **Foreign keys** for referential integrity
- **Timestamp with timezone** for accurate time tracking

**File:** `database/migrations/audit-system/001-audit-tables.sql`

```sql
-- ============================================
-- AUDIT LOGS TABLE
-- ============================================
-- Description: Central audit trail for all database changes
-- Layer: Database (Layer 1)
-- Populated by: PostgreSQL triggers

CREATE TABLE IF NOT EXISTS audit_logs (
    -- ============================================
    -- IDENTITY & CORE METADATA
    -- ============================================
    audit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- ============================================
    -- CHANGE TRACKING
    -- ============================================
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),

    -- ============================================
    -- USER CONTEXT
    -- ============================================
    -- Populated from Supabase Auth context
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT,
    user_role TEXT,

    -- ============================================
    -- DATA CHANGES
    -- ============================================
    -- old_data: State before change (NULL for INSERT)
    -- new_data: State after change (NULL for DELETE)
    old_data JSONB,
    new_data JSONB,

    -- Array of field names that changed (UPDATE only)
    changed_fields TEXT[],

    -- ============================================
    -- APPLICATION CONTEXT (Layer 2)
    -- ============================================
    -- These fields are populated by application-level logging
    -- NULL when only database trigger fires
    description TEXT,
    category VARCHAR(50),
    severity VARCHAR(20) CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL', 'DEBUG')),
    metadata JSONB,

    -- ============================================
    -- CLIENT CONTEXT
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
    CONSTRAINT valid_changed_fields CHECK (
        (action != 'UPDATE') OR (changed_fields IS NOT NULL AND array_length(changed_fields, 1) > 0)
    )
);

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE audit_logs IS 'Complete audit trail of all database changes';
COMMENT ON COLUMN audit_logs.audit_id IS 'Unique identifier for this audit entry';
COMMENT ON COLUMN audit_logs.table_name IS 'Name of the table that was modified';
COMMENT ON COLUMN audit_logs.record_id IS 'UUID of the record that was modified';
COMMENT ON COLUMN audit_logs.action IS 'Type of operation: INSERT, UPDATE, or DELETE';
COMMENT ON COLUMN audit_logs.old_data IS 'Complete record state before change (NULL for INSERT)';
COMMENT ON COLUMN audit_logs.new_data IS 'Complete record state after change (NULL for DELETE)';
COMMENT ON COLUMN audit_logs.changed_fields IS 'Array of field names that changed (UPDATE only)';
COMMENT ON COLUMN audit_logs.description IS 'Human-readable description from application layer';
COMMENT ON COLUMN audit_logs.category IS 'Categorization for filtering (e.g., auth:login, booking:create)';
COMMENT ON COLUMN audit_logs.severity IS 'Severity level for monitoring and alerts';
COMMENT ON COLUMN audit_logs.metadata IS 'Additional context from application (flexible JSON)';

-- ============================================
-- AUDIT LOG STATISTICS VIEW
-- ============================================
-- Helpful view for monitoring audit log health
CREATE OR REPLACE VIEW audit_log_stats AS
SELECT
    table_name,
    action,
    COUNT(*) as total_changes,
    COUNT(DISTINCT user_id) as unique_users,
    MIN(created_at) as first_change,
    MAX(created_at) as last_change
FROM audit_logs
GROUP BY table_name, action
ORDER BY total_changes DESC;

COMMENT ON VIEW audit_log_stats IS 'Summary statistics for audit logs by table and action';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run after table creation to verify structure

-- Check table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'audit_logs'
) AS audit_logs_exists;

-- Check columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'audit_logs'
ORDER BY ordinal_position;
```

**Verification Steps:**

1. Run the migration: `psql -f database/migrations/audit-system/001-audit-tables.sql`
2. Verify table creation: `\d audit_logs`
3. Check constraints: `\d+ audit_logs`
4. Test statistics view: `SELECT * FROM audit_log_stats;`

---

### Task 1.2: Create Audit Trigger Function (3 hours)

**Priority:** Critical  
**Dependencies:** Task 1.1

Build a generic trigger function that can be attached to any table.

**Design Decisions:**

- **Generic function** that works for any table
- **Automatic user detection** via `auth.uid()`
- **Smart field comparison** to identify changes
- **Error handling** to prevent main operation failure
- **Performance optimized** with minimal overhead

**File:** `database/migrations/audit-system/002-audit-triggers.sql`

```sql
-- ============================================
-- GENERIC AUDIT TRIGGER FUNCTION
-- ============================================
-- Description: Captures INSERT/UPDATE/DELETE operations
-- Usage: Attach to any table with a UUID primary key
-- Performance: ~5-10ms overhead per operation

CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    audit_user_id UUID;
    audit_user_email TEXT;
    audit_user_role TEXT;
    changed_fields TEXT[];
    pk_column_name TEXT;
    record_id UUID;
BEGIN
    -- ============================================
    -- EXTRACT USER CONTEXT FROM AUTH
    -- ============================================
    BEGIN
        -- Get current authenticated user
        audit_user_id := auth.uid();
        audit_user_email := auth.email();

        -- Get user role from JWT claims (if available)
        audit_user_role := NULLIF(current_setting('request.jwt.claims', TRUE)::json->>'role', '');

    EXCEPTION WHEN OTHERS THEN
        -- If auth context unavailable (system operations), use NULL
        audit_user_id := NULL;
        audit_user_email := NULL;
        audit_user_role := NULL;
    END;

    -- ============================================
    -- DETERMINE PRIMARY KEY COLUMN
    -- ============================================
    -- Convention: Look for column ending in '_id'
    SELECT a.attname INTO pk_column_name
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = TG_RELID AND i.indisprimary
    LIMIT 1;

    -- ============================================
    -- EXTRACT RECORD ID
    -- ============================================
    IF TG_OP = 'DELETE' THEN
        EXECUTE format('SELECT ($1).%I', pk_column_name) INTO record_id USING OLD;
    ELSE
        EXECUTE format('SELECT ($1).%I', pk_column_name) INTO record_id USING NEW;
    END IF;

    -- ============================================
    -- CALCULATE CHANGED FIELDS (UPDATE ONLY)
    -- ============================================
    IF TG_OP = 'UPDATE' THEN
        -- Compare old and new values to find differences
        SELECT ARRAY_AGG(key) INTO changed_fields
        FROM jsonb_each(to_jsonb(NEW))
        WHERE to_jsonb(NEW)->key IS DISTINCT FROM to_jsonb(OLD)->key
            AND key NOT IN ('updated_at', 'created_at'); -- Exclude meta fields
    END IF;

    -- ============================================
    -- INSERT AUDIT LOG ENTRY
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
            TG_TABLE_NAME,
            record_id,
            TG_OP,
            audit_user_id,
            audit_user_email,
            audit_user_role,
            CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
            CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
            changed_fields,
            NOW()
        );

    EXCEPTION WHEN OTHERS THEN
        -- Log error but don't fail the main operation
        RAISE WARNING 'Audit logging failed for %.%: %', TG_TABLE_NAME, record_id, SQLERRM;
    END;

    -- ============================================
    -- RETURN APPROPRIATE VALUE
    -- ============================================
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set function security
ALTER FUNCTION audit_trigger_func() OWNER TO postgres;
COMMENT ON FUNCTION audit_trigger_func() IS 'Generic audit trigger for automatic change tracking';

-- ============================================
-- HELPER FUNCTION: Attach Audit Trigger
-- ============================================
-- Convenience function to attach audit trigger to any table

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

COMMENT ON FUNCTION attach_audit_trigger(TEXT) IS 'Helper to attach audit trigger to a table';

-- ============================================
-- HELPER FUNCTION: Detach Audit Trigger
-- ============================================
CREATE OR REPLACE FUNCTION detach_audit_trigger(target_table TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%I_trigger ON %I', target_table, target_table);
    RAISE NOTICE 'Audit trigger detached from table: %', target_table;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION detach_audit_trigger(TEXT) IS 'Helper to remove audit trigger from a table';

-- ============================================
-- ATTACH TRIGGERS TO ALL CORE TABLES
-- ============================================

-- Units
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
    trigger_schema,
    trigger_name,
    event_object_table as table_name,
    action_timing,
    string_agg(event_manipulation, ', ') as events
FROM information_schema.triggers
WHERE trigger_name LIKE 'audit_%'
GROUP BY trigger_schema, trigger_name, event_object_table, action_timing
ORDER BY event_object_table;

-- Test trigger (run this manually to verify)
-- INSERT INTO units (unit_name, unit_code, unit_type, base_occupancy, max_occupancy, base_rate, weekend_rate, extra_person_rate)
-- VALUES ('Test Unit', 'TEST', 'Studio', 2, 2, 1000, 1200, 300);
--
-- SELECT * FROM audit_logs WHERE table_name = 'units' ORDER BY created_at DESC LIMIT 1;
```

**Testing Plan:**

1. **Create test record:**

   ```sql
   INSERT INTO units (unit_name, unit_code, unit_type, base_occupancy, max_occupancy, base_rate, weekend_rate, extra_person_rate)
   VALUES ('Test Unit', 'TEST', 'Studio', 2, 2, 1000, 1200, 300);
   ```

2. **Verify audit log created:**

   ```sql
   SELECT audit_id, table_name, action, new_data
   FROM audit_logs
   WHERE table_name = 'units'
   ORDER BY created_at DESC LIMIT 1;
   ```

3. **Update test record:**

   ```sql
   UPDATE units SET base_rate = 1500 WHERE unit_code = 'TEST';
   ```

4. **Verify changed_fields captured:**

   ```sql
   SELECT audit_id, action, changed_fields, old_data->'base_rate', new_data->'base_rate'
   FROM audit_logs
   WHERE table_name = 'units' AND action = 'UPDATE'
   ORDER BY created_at DESC LIMIT 1;
   ```

5. **Delete test record:**

   ```sql
   DELETE FROM units WHERE unit_code = 'TEST';
   ```

6. **Verify deletion logged:**
   ```sql
   SELECT audit_id, action, old_data
   FROM audit_logs
   WHERE table_name = 'units' AND action = 'DELETE'
   ORDER BY created_at DESC LIMIT 1;
   ```

---

### Task 1.3: Create Performance Indexes (1 hour)

**Priority:** High  
**Dependencies:** Task 1.1, Task 1.2

Optimize query performance for common audit log access patterns.

**File:** `database/migrations/audit-system/003-audit-indexes.sql`

```sql
-- ============================================
-- AUDIT LOGS PERFORMANCE INDEXES
-- ============================================
-- Description: Optimized indexes for common query patterns
-- Expected Query Types:
--   1. View all changes for a specific record
--   2. View all changes by a specific user
--   3. View changes in date range
--   4. Filter by action type
--   5. Search by category

-- ============================================
-- PRIMARY ACCESS PATTERNS
-- ============================================

-- Index: Find all changes for a specific record
-- Usage: "Show me all changes to booking BK-001"
CREATE INDEX IF NOT EXISTS idx_audit_table_record
    ON audit_logs (table_name, record_id, created_at DESC);

COMMENT ON INDEX idx_audit_table_record IS
    'Optimizes queries for specific record history';

-- Index: Find all changes by a user
-- Usage: "Show me everything Jason modified"
CREATE INDEX IF NOT EXISTS idx_audit_user_time
    ON audit_logs (user_id, created_at DESC)
    WHERE user_id IS NOT NULL;

COMMENT ON INDEX idx_audit_user_time IS
    'Optimizes queries for user activity history';

-- Index: Time-based queries (most common)
-- Usage: "Show me changes in the last 7 days"
CREATE INDEX IF NOT EXISTS idx_audit_created
    ON audit_logs (created_at DESC);

COMMENT ON INDEX idx_audit_created IS
    'Optimizes time-range queries';

-- Index: Filter by action type
-- Usage: "Show me all deletions"
CREATE INDEX IF NOT EXISTS idx_audit_action
    ON audit_logs (action, created_at DESC);

COMMENT ON INDEX idx_audit_action IS
    'Optimizes queries filtered by action type';

-- ============================================
-- APPLICATION-LAYER INDEXES
-- ============================================

-- Index: Category filtering (Phase 2)
-- Usage: "Show me all booking-related changes"
CREATE INDEX IF NOT EXISTS idx_audit_category
    ON audit_logs (category, created_at DESC)
    WHERE category IS NOT NULL;

COMMENT ON INDEX idx_audit_category IS
    'Optimizes application-layer category queries';

-- Index: Severity filtering (Phase 4 - monitoring)
-- Usage: "Show me all critical audit events"
CREATE INDEX IF NOT EXISTS idx_audit_severity
    ON audit_logs (severity, created_at DESC)
    WHERE severity IN ('WARNING', 'CRITICAL');

COMMENT ON INDEX idx_audit_severity IS
    'Optimizes monitoring queries for high-severity events';

-- ============================================
-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- ============================================

-- Index: User activity on specific table
-- Usage: "Show me all bookings Jason modified"
CREATE INDEX IF NOT EXISTS idx_audit_user_table
    ON audit_logs (user_id, table_name, created_at DESC)
    WHERE user_id IS NOT NULL;

COMMENT ON INDEX idx_audit_user_table IS
    'Optimizes queries for user activity on specific tables';

-- ============================================
-- GIN INDEX FOR JSONB SEARCH
-- ============================================

-- Index: Search within old_data and new_data
-- Usage: "Find all changes where booking_status was 'Cancelled'"
CREATE INDEX IF NOT EXISTS idx_audit_data_gin
    ON audit_logs USING GIN (old_data, new_data);

COMMENT ON INDEX idx_audit_data_gin IS
    'Enables JSONB containment queries on audit data';

-- ============================================
-- PARTIAL INDEX FOR RECENT LOGS
-- ============================================

-- Index: Hot data (last 30 days)
-- Usage: Most queries focus on recent changes
CREATE INDEX IF NOT EXISTS idx_audit_recent
    ON audit_logs (created_at DESC, table_name)
    WHERE created_at > NOW() - INTERVAL '30 days';

COMMENT ON INDEX idx_audit_recent IS
    'Optimizes queries for recent audit logs (hot data)';

-- ============================================
-- INDEX STATISTICS & VERIFICATION
-- ============================================

-- View index sizes and usage stats
CREATE OR REPLACE VIEW audit_index_stats AS
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    idx_scan as times_used,
    idx_tup_read as rows_read,
    idx_tup_fetch as rows_fetched
FROM pg_stat_user_indexes
WHERE tablename = 'audit_logs'
ORDER BY pg_relation_size(indexrelid) DESC;

COMMENT ON VIEW audit_index_stats IS
    'Monitor index usage and size for audit_logs table';

-- ============================================
-- ANALYZE TABLE
-- ============================================
-- Update statistics for query planner
ANALYZE audit_logs;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check all indexes on audit_logs
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'audit_logs'
ORDER BY indexname;

-- View index sizes
SELECT * FROM audit_index_stats;

-- Test query performance (run EXPLAIN ANALYZE)
EXPLAIN ANALYZE
SELECT * FROM audit_logs
WHERE table_name = 'bookings'
AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 50;
```

**Performance Benchmarks:**

- Target query time: <100ms for most queries
- Hot data queries (<30 days): <50ms
- Full table scan: <500ms (with indexes)

---

### Task 1.4: Create Helper Functions (2 hours)

**Priority:** Medium  
**Dependencies:** Task 1.1, Task 1.2

Build utility functions for common audit log analysis tasks.

**File:** `database/migrations/audit-system/004-audit-helpers.sql`

```sql
-- ============================================
-- AUDIT LOG HELPER FUNCTIONS
-- ============================================

-- ============================================
-- FUNCTION: Get Full Audit Trail for a Record
-- ============================================
CREATE OR REPLACE FUNCTION get_record_audit_trail(
    p_table_name TEXT,
    p_record_id UUID,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    audit_id UUID,
    action VARCHAR(10),
    changed_by TEXT,
    changed_fields TEXT[],
    old_values JSONB,
    new_values JSONB,
    description TEXT,
    changed_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.audit_id,
        a.action,
        COALESCE(a.user_email, 'System') as changed_by,
        a.changed_fields,
        a.old_data as old_values,
        a.new_data as new_values,
        a.description,
        a.created_at as changed_at
    FROM audit_logs a
    WHERE a.table_name = p_table_name
        AND a.record_id = p_record_id
    ORDER BY a.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_record_audit_trail IS
    'Get complete audit history for a specific record';

-- ============================================
-- FUNCTION: Get User Activity Summary
-- ============================================
CREATE OR REPLACE FUNCTION get_user_activity_summary(
    p_user_id UUID,
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
    table_name TEXT,
    action VARCHAR(10),
    change_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.table_name,
        a.action,
        COUNT(*) as change_count
    FROM audit_logs a
    WHERE a.user_id = p_user_id
        AND a.created_at BETWEEN p_start_date AND p_end_date
    GROUP BY a.table_name, a.action
    ORDER BY change_count DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_user_activity_summary IS
    'Summarize user activity by table and action';

-- ============================================
-- FUNCTION: Find Changes by Field Value
-- ============================================
CREATE OR REPLACE FUNCTION find_changes_by_field(
    p_table_name TEXT,
    p_field_name TEXT,
    p_field_value TEXT,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    audit_id UUID,
    record_id UUID,
    action VARCHAR(10),
    changed_by TEXT,
    changed_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.audit_id,
        a.record_id,
        a.action,
        COALESCE(a.user_email, 'System') as changed_by,
        a.created_at as changed_at
    FROM audit_logs a
    WHERE a.table_name = p_table_name
        AND (
            (a.old_data->>p_field_name = p_field_value) OR
            (a.new_data->>p_field_name = p_field_value)
        )
    ORDER BY a.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION find_changes_by_field IS
    'Find all changes involving a specific field value';

-- ============================================
-- FUNCTION: Get Change Frequency Stats
-- ============================================
CREATE OR REPLACE FUNCTION get_change_frequency_stats(
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '7 days',
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
    date DATE,
    table_name TEXT,
    change_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        DATE(a.created_at) as date,
        a.table_name,
        COUNT(*) as change_count
    FROM audit_logs a
    WHERE a.created_at BETWEEN p_start_date AND p_end_date
    GROUP BY DATE(a.created_at), a.table_name
    ORDER BY date DESC, change_count DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_change_frequency_stats IS
    'Get daily change frequency by table';

-- ============================================
-- FUNCTION: Detect Anomalous Activity
-- ============================================
CREATE OR REPLACE FUNCTION detect_anomalous_activity(
    p_threshold INTEGER DEFAULT 50, -- Changes per hour
    p_lookback_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
    hour_bucket TIMESTAMP WITH TIME ZONE,
    user_id UUID,
    user_email TEXT,
    change_count BIGINT,
    tables_affected TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        date_trunc('hour', a.created_at) as hour_bucket,
        a.user_id,
        a.user_email,
        COUNT(*) as change_count,
        ARRAY_AGG(DISTINCT a.table_name) as tables_affected
    FROM audit_logs a
    WHERE a.created_at > NOW() - (p_lookback_hours || ' hours')::INTERVAL
        AND a.user_id IS NOT NULL
    GROUP BY date_trunc('hour', a.created_at), a.user_id, a.user_email
    HAVING COUNT(*) > p_threshold
    ORDER BY change_count DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION detect_anomalous_activity IS
    'Detect unusually high change activity (potential security concern)';

-- ============================================
-- USAGE EXAMPLES
-- ============================================
/*
-- Get full audit trail for a booking
SELECT * FROM get_record_audit_trail('bookings', 'uuid-here'::UUID);

-- Get user activity summary
SELECT * FROM get_user_activity_summary('user-uuid-here'::UUID);

-- Find all changes to booking_status = 'Cancelled'
SELECT * FROM find_changes_by_field('bookings', 'booking_status', 'Cancelled');

-- Get daily change frequency for last week
SELECT * FROM get_change_frequency_stats(NOW() - INTERVAL '7 days', NOW());

-- Detect anomalous activity (>50 changes/hour)
SELECT * FROM detect_anomalous_activity(50, 24);
*/
```

---

## ✅ Phase 1 Completion Checklist

### Database Setup

- [ ] `audit_logs` table created successfully
- [ ] All constraints and checks working
- [ ] Statistics view accessible

### Triggers

- [ ] Audit trigger function created
- [ ] Triggers attached to all 6 core tables:
  - [ ] units
  - [ ] guests
  - [ ] bookings
  - [ ] payments
  - [ ] expenses
  - [ ] maintenance_logs
- [ ] Helper functions for attach/detach working

### Performance

- [ ] All indexes created
- [ ] Query performance meets targets (<100ms)
- [ ] Index statistics view working

### Helper Functions

- [ ] `get_record_audit_trail()` working
- [ ] `get_user_activity_summary()` working
- [ ] `find_changes_by_field()` working
- [ ] `get_change_frequency_stats()` working
- [ ] `detect_anomalous_activity()` working

### Testing

- [ ] INSERT operation logged correctly
- [ ] UPDATE operation logged with changed_fields
- [ ] DELETE operation logged with old_data
- [ ] User context captured (when available)
- [ ] No performance degradation on main operations

---

## 🧪 Testing Script

Run this comprehensive test after Phase 1 completion:

```sql
-- ============================================
-- PHASE 1 COMPREHENSIVE TEST SCRIPT
-- ============================================

BEGIN;

-- Test 1: Create test records
INSERT INTO units (unit_name, unit_code, unit_type, base_occupancy, max_occupancy, base_rate, weekend_rate, extra_person_rate)
VALUES ('Audit Test Unit', 'AUDIT1', 'Studio', 2, 2, 2000, 2500, 400)
RETURNING unit_id AS test_unit_id \gset

-- Verify INSERT was logged
SELECT
    'Test 1: INSERT logging' as test,
    COUNT(*) = 1 as passed
FROM audit_logs
WHERE table_name = 'units'
    AND record_id = :'test_unit_id'::UUID
    AND action = 'INSERT';

-- Test 2: Update record
UPDATE units
SET base_rate = 2200, weekend_rate = 2700
WHERE unit_id = :'test_unit_id'::UUID;

-- Verify UPDATE was logged with changed_fields
SELECT
    'Test 2: UPDATE logging' as test,
    COUNT(*) = 1 AND
    'base_rate' = ANY(changed_fields) AND
    'weekend_rate' = ANY(changed_fields) as passed
FROM audit_logs
WHERE table_name = 'units'
    AND record_id = :'test_unit_id'::UUID
    AND action = 'UPDATE';

-- Test 3: Delete record
DELETE FROM units WHERE unit_id = :'test_unit_id'::UUID;

-- Verify DELETE was logged
SELECT
    'Test 3: DELETE logging' as test,
    COUNT(*) = 1 as passed
FROM audit_logs
WHERE table_name = 'units'
    AND record_id = :'test_unit_id'::UUID
    AND action = 'DELETE';

-- Test 4: Check helper functions
SELECT
    'Test 4: Helper functions' as test,
    (SELECT COUNT(*) FROM get_record_audit_trail('units', :'test_unit_id'::UUID)) = 3 as passed;

-- Test 5: Performance check
EXPLAIN ANALYZE
SELECT * FROM audit_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 100;

ROLLBACK; -- Clean up test data

-- Display results
SELECT '✅ Phase 1 Testing Complete!' as status;
```

---

## 📊 Expected Outcomes

After Phase 1 completion:

1. **Automatic Audit Trail:** Every database change captured
2. **Performance:** <50ms overhead per operation
3. **Storage:** ~2KB per audit log entry
4. **Query Speed:** <100ms for most audit queries
5. **Zero Maintenance:** Triggers run automatically

---

## 🔗 Next Steps

- ✅ Phase 1 Complete
- ⏭️ Proceed to [Phase 2: Application Layer](./AUDIT_PHASE_2_APPLICATION.md)
- 📚 Review [API Reference](./AUDIT_API_REFERENCE.md)

---

## 🆘 Troubleshooting

### Issue: Trigger not firing

**Solution:** Check trigger exists and is enabled

```sql
SELECT * FROM information_schema.triggers WHERE trigger_name LIKE 'audit_%';
```

### Issue: Performance degradation

**Solution:** Verify indexes and analyze table

```sql
ANALYZE audit_logs;
SELECT * FROM audit_index_stats;
```

### Issue: User context not captured

**Solution:** Ensure Supabase Auth is configured

```sql
-- Test auth context
SELECT auth.uid(), auth.email();
```

---

_Phase 1 establishes the foundation for enterprise-grade audit logging with zero application code changes._
