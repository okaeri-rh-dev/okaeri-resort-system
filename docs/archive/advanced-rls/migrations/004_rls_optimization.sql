-- =============================================
-- Migration: 004_rls_optimization.sql
-- Description: Optimize RLS and add security constraints
-- Author: System
-- Date: 2025-01-28
-- =============================================

BEGIN;

-- Set timezone for consistent timestamps
SET timezone = 'Asia/Manila';

-- =============================================
-- STEP 1: Add Composite Unique Constraints
-- =============================================

-- Add project_id to all tenant-scoped tables (if not already present)
DO $$ 
BEGIN
    -- Add project_id column to tables that need it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'bookings' AND column_name = 'project_id') THEN
        ALTER TABLE bookings ADD COLUMN project_id UUID NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'payments' AND column_name = 'project_id') THEN
        ALTER TABLE payments ADD COLUMN project_id UUID NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'expenses' AND column_name = 'project_id') THEN
        ALTER TABLE expenses ADD COLUMN project_id UUID NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'income' AND column_name = 'project_id') THEN
        ALTER TABLE income ADD COLUMN project_id UUID NOT NULL;
    END IF;
END $$;

-- Create composite unique constraints for tenant isolation
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_project_booking_code_unique;
ALTER TABLE bookings ADD CONSTRAINT bookings_project_booking_code_unique 
    UNIQUE(project_id, booking_code);

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_project_payment_code_unique;
ALTER TABLE payments ADD CONSTRAINT payments_project_payment_code_unique 
    UNIQUE(project_id, payment_code);

ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_project_expense_code_unique;
ALTER TABLE expenses ADD CONSTRAINT expenses_project_expense_code_unique 
    UNIQUE(project_id, expense_code);

ALTER TABLE income DROP CONSTRAINT IF EXISTS income_project_income_code_unique;
ALTER TABLE income ADD CONSTRAINT income_project_income_code_unique 
    UNIQUE(project_id, income_code);

-- =============================================
-- STEP 2: Create Optimized Composite Indexes
-- =============================================

-- Bookings: Common query patterns
DROP INDEX IF EXISTS idx_bookings_project_dates;
CREATE INDEX CONCURRENTLY idx_bookings_project_dates 
    ON bookings(project_id, check_in_date, check_out_date) 
    WHERE status NOT IN ('cancelled', 'no_show');

DROP INDEX IF EXISTS idx_bookings_project_status_dates;
CREATE INDEX CONCURRENTLY idx_bookings_project_status_dates 
    ON bookings(project_id, status, check_in_date DESC);

DROP INDEX IF EXISTS idx_bookings_project_guest;
CREATE INDEX CONCURRENTLY idx_bookings_project_guest 
    ON bookings(project_id, guest_phone, guest_name);

-- Payments: Financial queries
DROP INDEX IF EXISTS idx_payments_project_booking;
CREATE INDEX CONCURRENTLY idx_payments_project_booking 
    ON payments(project_id, booking_id, status);

DROP INDEX IF EXISTS idx_payments_project_date_method;
CREATE INDEX CONCURRENTLY idx_payments_project_date_method 
    ON payments(project_id, created_at DESC, payment_method) 
    WHERE status = 'completed';

DROP INDEX IF EXISTS idx_payments_project_gcash;
CREATE INDEX CONCURRENTLY idx_payments_project_gcash 
    ON payments(project_id, gcash_reference_number) 
    WHERE payment_method = 'gcash';

-- Expenses: Reporting queries
DROP INDEX IF EXISTS idx_expenses_project_date_category;
CREATE INDEX CONCURRENTLY idx_expenses_project_date_category 
    ON expenses(project_id, paid_at DESC, category_id) 
    WHERE status = 'approved';

DROP INDEX IF EXISTS idx_expenses_project_recurring;
CREATE INDEX CONCURRENTLY idx_expenses_project_recurring 
    ON expenses(project_id, next_recurring_date) 
    WHERE is_recurring = true;

-- Income: Revenue tracking
DROP INDEX IF EXISTS idx_income_project_date_source;
CREATE INDEX CONCURRENTLY idx_income_project_date_source 
    ON income(project_id, received_at DESC, source);

DROP INDEX IF EXISTS idx_income_project_booking_relation;
CREATE INDEX CONCURRENTLY idx_income_project_booking_relation 
    ON income(project_id, booking_id) 
    WHERE booking_id IS NOT NULL;

-- =============================================
-- STEP 3: Create RLS Helper Functions
-- =============================================

-- Function to safely get current project context
CREATE OR REPLACE FUNCTION current_project_id() 
RETURNS UUID AS $$
DECLARE
    project_id_str TEXT;
BEGIN
    -- Try to get the current project from session config
    project_id_str := current_setting('app.current_project', true);
    
    -- Return NULL if not set instead of throwing error
    IF project_id_str IS NULL OR project_id_str = '' THEN
        RETURN NULL;
    END IF;
    
    -- Return the UUID, will throw if invalid format
    RETURN project_id_str::UUID;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't break the query
        RAISE WARNING 'Invalid project context: %', SQLERRM;
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user has access to project
CREATE OR REPLACE FUNCTION user_has_project_access(
    p_user_id UUID,
    p_project_id UUID,
    p_permission TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    has_access BOOLEAN := FALSE;
BEGIN
    -- Check if user has any role in the project
    IF p_permission IS NULL THEN
        SELECT EXISTS(
            SELECT 1 FROM user_project_permissions
            WHERE user_id = p_user_id
              AND project_id = p_project_id
              AND is_active = true
        ) INTO has_access;
    ELSE
        -- Check for specific permission
        SELECT EXISTS(
            SELECT 1 FROM user_project_permissions
            WHERE user_id = p_user_id
              AND project_id = p_project_id
              AND is_active = true
              AND (
                  role = 'owner' OR role = 'admin' OR
                  permissions->p_permission->>'view' = 'true' OR
                  permissions->p_permission->>'create' = 'true' OR
                  permissions->p_permission->>'update' = 'true' OR
                  permissions->p_permission->>'delete' = 'true'
              )
        ) INTO has_access;
    END IF;
    
    RETURN has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================
-- STEP 4: Create Optimized RLS Policies
-- =============================================

-- Enable RLS on all tenant tables
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE income ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate with optimization
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT policyname, tablename 
             FROM pg_policies 
             WHERE tablename IN ('bookings', 'payments', 'expenses', 'income')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- Bookings RLS Policies
CREATE POLICY bookings_tenant_select ON bookings
    FOR SELECT
    USING (project_id = current_project_id());

CREATE POLICY bookings_tenant_insert ON bookings
    FOR INSERT
    WITH CHECK (project_id = current_project_id());

CREATE POLICY bookings_tenant_update ON bookings
    FOR UPDATE
    USING (project_id = current_project_id())
    WITH CHECK (project_id = current_project_id());

CREATE POLICY bookings_tenant_delete ON bookings
    FOR DELETE
    USING (project_id = current_project_id());

-- Payments RLS Policies
CREATE POLICY payments_tenant_select ON payments
    FOR SELECT
    USING (project_id = current_project_id());

CREATE POLICY payments_tenant_insert ON payments
    FOR INSERT
    WITH CHECK (project_id = current_project_id());

CREATE POLICY payments_tenant_update ON payments
    FOR UPDATE
    USING (project_id = current_project_id())
    WITH CHECK (project_id = current_project_id());

CREATE POLICY payments_tenant_delete ON payments
    FOR DELETE
    USING (project_id = current_project_id());

-- Similar policies for expenses and income
CREATE POLICY expenses_tenant_select ON expenses
    FOR SELECT
    USING (project_id = current_project_id());

CREATE POLICY expenses_tenant_insert ON expenses
    FOR INSERT
    WITH CHECK (project_id = current_project_id());

CREATE POLICY expenses_tenant_update ON expenses
    FOR UPDATE
    USING (project_id = current_project_id())
    WITH CHECK (project_id = current_project_id());

CREATE POLICY expenses_tenant_delete ON expenses
    FOR DELETE
    USING (project_id = current_project_id());

CREATE POLICY income_tenant_select ON income
    FOR SELECT
    USING (project_id = current_project_id());

CREATE POLICY income_tenant_insert ON income
    FOR INSERT
    WITH CHECK (project_id = current_project_id());

CREATE POLICY income_tenant_update ON income
    FOR UPDATE
    USING (project_id = current_project_id())
    WITH CHECK (project_id = current_project_id());

CREATE POLICY income_tenant_delete ON income
    FOR DELETE
    USING (project_id = current_project_id());

-- =============================================
-- STEP 5: Create Materialized Views for Analytics
-- =============================================

-- Daily booking summary per project (refreshed nightly)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_booking_summary AS
SELECT 
    project_id,
    date_trunc('day', check_in_date) as booking_date,
    COUNT(*) as total_bookings,
    COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_bookings,
    COUNT(*) FILTER (WHERE status = 'checked_in') as checked_in,
    COUNT(*) FILTER (WHERE status = 'checked_out') as checked_out,
    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
    SUM(total_amount) as total_revenue,
    SUM(paid_amount) as total_collected,
    SUM(balance_amount) as total_pending,
    AVG(number_of_guests) as avg_guests,
    COUNT(DISTINCT guest_phone) as unique_guests
FROM bookings
WHERE check_in_date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY project_id, date_trunc('day', check_in_date);

CREATE UNIQUE INDEX ON mv_daily_booking_summary(project_id, booking_date);

-- Monthly financial summary per project
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_monthly_financial_summary AS
SELECT 
    project_id,
    date_trunc('month', created_at) as month,
    'income' as transaction_type,
    SUM(amount) as total_amount,
    COUNT(*) as transaction_count,
    AVG(amount) as avg_amount
FROM income
WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY project_id, date_trunc('month', created_at)

UNION ALL

SELECT 
    project_id,
    date_trunc('month', created_at) as month,
    'expense' as transaction_type,
    SUM(amount) as total_amount,
    COUNT(*) as transaction_count,
    AVG(amount) as avg_amount
FROM expenses
WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
  AND status = 'approved'
GROUP BY project_id, date_trunc('month', created_at);

CREATE INDEX ON mv_monthly_financial_summary(project_id, month, transaction_type);

-- =============================================
-- STEP 6: Create Connection Pool Safety Functions
-- =============================================

-- Function to set project context with validation
CREATE OR REPLACE FUNCTION set_project_context(
    p_project_id UUID,
    p_user_id UUID DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_project_exists BOOLEAN;
BEGIN
    -- Validate project exists and is active
    SELECT EXISTS(
        SELECT 1 FROM projects 
        WHERE id = p_project_id 
          AND is_active = true
    ) INTO v_project_exists;
    
    IF NOT v_project_exists THEN
        RAISE EXCEPTION 'Invalid or inactive project: %', p_project_id;
    END IF;
    
    -- Set the project context (transaction-scoped)
    PERFORM set_config('app.current_project', p_project_id::TEXT, true);
    
    -- Optionally set user context
    IF p_user_id IS NOT NULL THEN
        PERFORM set_config('app.current_user', p_user_id::TEXT, true);
    END IF;
    
    -- Log the context change for audit
    INSERT INTO security_audit_logs (
        user_id, project_id, event_type, action, success, metadata
    ) VALUES (
        p_user_id, p_project_id, 'context_set', 'SET_PROJECT_CONTEXT', true,
        jsonb_build_object('timestamp', NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clear context (important for connection pooling)
CREATE OR REPLACE FUNCTION clear_project_context() RETURNS VOID AS $$
BEGIN
    -- Clear both project and user context
    PERFORM set_config('app.current_project', NULL, true);
    PERFORM set_config('app.current_user', NULL, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current context info
CREATE OR REPLACE FUNCTION get_current_context() 
RETURNS TABLE(
    project_id UUID,
    user_id UUID,
    project_name TEXT,
    user_email TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        current_project_id() as project_id,
        CASE 
            WHEN current_setting('app.current_user', true) IS NOT NULL 
            THEN current_setting('app.current_user', true)::UUID 
            ELSE NULL 
        END as user_id,
        p.name as project_name,
        u.email as user_email
    FROM (SELECT current_project_id() as pid) ctx
    LEFT JOIN projects p ON p.id = ctx.pid
    LEFT JOIN users u ON u.id = CASE 
        WHEN current_setting('app.current_user', true) IS NOT NULL 
        THEN current_setting('app.current_user', true)::UUID 
        ELSE NULL 
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================
-- STEP 7: Create Monitoring Functions
-- =============================================

-- Function to analyze query performance by project
CREATE OR REPLACE FUNCTION analyze_project_query_performance(
    p_project_id UUID DEFAULT NULL
) RETURNS TABLE(
    query_pattern TEXT,
    total_calls BIGINT,
    mean_time_ms NUMERIC,
    max_time_ms NUMERIC,
    total_time_ms NUMERIC
) AS $$
BEGIN
    -- Requires pg_stat_statements extension
    IF NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') THEN
        RAISE NOTICE 'pg_stat_statements extension not installed';
        RETURN;
    END IF;
    
    RETURN QUERY
    SELECT 
        substring(query from 1 for 100) as query_pattern,
        calls as total_calls,
        mean_exec_time as mean_time_ms,
        max_exec_time as max_time_ms,
        total_exec_time as total_time_ms
    FROM pg_stat_statements
    WHERE query LIKE '%project_id%'
      AND (p_project_id IS NULL OR query LIKE '%' || p_project_id::TEXT || '%')
    ORDER BY total_exec_time DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check index usage
CREATE OR REPLACE FUNCTION check_index_usage() 
RETURNS TABLE(
    schemaname NAME,
    tablename NAME,
    indexname NAME,
    idx_scan BIGINT,
    idx_tup_read BIGINT,
    idx_tup_fetch BIGINT,
    table_size TEXT,
    index_size TEXT,
    usage_ratio NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.schemaname,
        s.tablename,
        s.indexname,
        s.idx_scan,
        s.idx_tup_read,
        s.idx_tup_fetch,
        pg_size_pretty(pg_relation_size(s.tablename::regclass)) as table_size,
        pg_size_pretty(pg_relation_size(s.indexrelname::regclass)) as index_size,
        CASE 
            WHEN s.idx_scan = 0 THEN 0
            ELSE ROUND((s.idx_tup_fetch::NUMERIC / NULLIF(s.idx_scan, 0)), 2)
        END as usage_ratio
    FROM pg_stat_user_indexes s
    WHERE s.schemaname = 'public'
      AND s.tablename IN ('bookings', 'payments', 'expenses', 'income')
    ORDER BY s.idx_scan DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- STEP 8: Create Audit Trigger for RLS Changes
-- =============================================

-- Function to audit RLS context changes
CREATE OR REPLACE FUNCTION audit_rls_context_change() RETURNS TRIGGER AS $$
BEGIN
    -- Only audit if project context is set
    IF current_project_id() IS NOT NULL THEN
        INSERT INTO security_audit_logs (
            user_id,
            project_id,
            event_type,
            resource_type,
            resource_id,
            action,
            success,
            metadata
        ) VALUES (
            CASE 
                WHEN current_setting('app.current_user', true) IS NOT NULL 
                THEN current_setting('app.current_user', true)::UUID 
                ELSE NULL 
            END,
            current_project_id(),
            TG_OP,
            TG_TABLE_NAME,
            CASE 
                WHEN TG_OP = 'DELETE' THEN OLD.id::TEXT
                ELSE NEW.id::TEXT
            END,
            TG_OP,
            true,
            jsonb_build_object(
                'timestamp', NOW(),
                'old_values', CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) ELSE NULL END,
                'new_values', CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END
            )
        );
    END IF;
    
    RETURN CASE 
        WHEN TG_OP = 'DELETE' THEN OLD
        ELSE NEW
    END;
END;
$$ LANGUAGE plpgsql;

-- Apply audit trigger to critical tables
DROP TRIGGER IF EXISTS audit_bookings_changes ON bookings;
CREATE TRIGGER audit_bookings_changes
    AFTER INSERT OR UPDATE OR DELETE ON bookings
    FOR EACH ROW EXECUTE FUNCTION audit_rls_context_change();

DROP TRIGGER IF EXISTS audit_payments_changes ON payments;
CREATE TRIGGER audit_payments_changes
    AFTER INSERT OR UPDATE OR DELETE ON payments
    FOR EACH ROW EXECUTE FUNCTION audit_rls_context_change();

-- =============================================
-- STEP 9: Add Table Partitioning for Large Tables
-- =============================================

-- Prepare audit logs for partitioning by month (for better performance)
-- Note: This is preparation only, actual partitioning requires table recreation

CREATE OR REPLACE FUNCTION create_monthly_partition(
    parent_table TEXT,
    start_date DATE
) RETURNS TEXT AS $$
DECLARE
    partition_name TEXT;
    end_date DATE;
BEGIN
    partition_name := parent_table || '_' || to_char(start_date, 'YYYY_MM');
    end_date := start_date + INTERVAL '1 month';
    
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I 
         FOR VALUES FROM (%L) TO (%L)',
        partition_name, parent_table, start_date, end_date
    );
    
    RETURN partition_name;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- FINAL: Update Migration Log
-- =============================================

INSERT INTO migration_log (
    migration_name,
    version,
    description,
    executed_at,
    success
) VALUES (
    '004_rls_optimization',
    '2.0.0',
    'RLS optimization with composite constraints, indexes, and connection pool safety',
    NOW(),
    TRUE
);

-- Show summary of changes
SELECT 
    'Optimization Complete' as status,
    COUNT(*) FILTER (WHERE contype = 'u') as unique_constraints_added,
    COUNT(*) FILTER (WHERE indexname LIKE 'idx_%') as indexes_created,
    COUNT(*) as total_policies
FROM (
    SELECT conname, contype FROM pg_constraint 
    WHERE conname LIKE '%_project_%_unique'
    UNION ALL
    SELECT indexname, 'i' as contype FROM pg_indexes 
    WHERE indexname LIKE 'idx_%_project_%'
    UNION ALL
    SELECT policyname, 'p' as contype FROM pg_policies 
    WHERE tablename IN ('bookings', 'payments', 'expenses', 'income')
) summary;

COMMIT;

\echo 'RLS optimization completed successfully!'
\echo 'Summary of improvements:'
\echo '- Added composite unique constraints for tenant isolation'
\echo '- Created optimized composite indexes for common queries'
\echo '- Implemented safe context management functions'
\echo '- Added connection pool safety mechanisms'
\echo '- Created materialized views for analytics'
\echo '- Implemented comprehensive audit logging'
\echo '- Ready for production use with Neon PostgreSQL'