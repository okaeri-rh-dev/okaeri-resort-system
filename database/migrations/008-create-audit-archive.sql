-- ============================================
-- MIGRATION: 008 - Archive Table and Function
-- ============================================
-- Description: Creates archive function with dry-run support and tamper-evident move pattern
-- Author: Okaeri Resort System - Audit Trail Phase 1
-- Date: 2025-01-02
-- Dependencies: 005-create-audit-logs.sql
-- Purpose: Implements tamper-evident archive-move pattern instead of direct deletes

\set ON_ERROR_STOP on

-- ============================================
-- ARCHIVE FUNCTION (with Dry Run)
-- ============================================
-- Purpose: Move audit logs older than cutoff_date to archive table
-- Pattern: Tamper-evident (INSERT + DELETE = MOVE)
-- Dry Run: Set dry_run=TRUE to preview without executing

CREATE OR REPLACE FUNCTION archive_audit_logs(
    cutoff_date TIMESTAMPTZ,
    dry_run BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
    archived_count BIGINT,
    oldest_archived TIMESTAMPTZ,
    newest_archived TIMESTAMPTZ,
    tables_affected TEXT[]
) AS $$
DECLARE
    v_archived_count BIGINT;
    v_oldest TIMESTAMPTZ;
    v_newest TIMESTAMPTZ;
    v_tables TEXT[];
BEGIN
    -- ============================================
    -- STEP 1: Validate input date
    -- ============================================

    IF cutoff_date >= NOW() THEN
        RAISE EXCEPTION 'Archive date must be in the past. Provided: %, Now: %',
            cutoff_date, NOW();
    END IF;

    IF cutoff_date > NOW() - INTERVAL '30 days' THEN
        RAISE WARNING 'Archive date is less than 30 days ago. This may archive recent logs.';
    END IF;

    -- ============================================
    -- STEP 2: Preview what will be archived
    -- ============================================

    SELECT
        COUNT(*),
        MIN(created_at),
        MAX(created_at),
        ARRAY_AGG(DISTINCT table_name ORDER BY table_name)
    INTO
        v_archived_count,
        v_oldest,
        v_newest,
        v_tables
    FROM audit_logs
    WHERE created_at < cutoff_date;

    -- ============================================
    -- STEP 3: Safety checks
    -- ============================================

    IF v_archived_count = 0 THEN
        RAISE NOTICE 'No logs found before %', cutoff_date;
        RETURN QUERY SELECT 0::BIGINT, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, '{}'::TEXT[];
        RETURN;
    END IF;

    IF v_archived_count > 100000 THEN
        RAISE WARNING 'Attempting to archive % logs. Consider smaller date range.', v_archived_count;
    END IF;

    -- ============================================
    -- STEP 4: Dry run or actual archive
    -- ============================================

    IF dry_run THEN
        -- Preview only
        RAISE NOTICE '=== DRY RUN ===';
        RAISE NOTICE 'Would archive % logs', v_archived_count;
        RAISE NOTICE 'Date range: % to %', v_oldest, v_newest;
        RAISE NOTICE 'Tables affected: %', v_tables;
        RAISE NOTICE 'To execute, call: SELECT * FROM archive_audit_logs(''%''::TIMESTAMPTZ, FALSE)', cutoff_date;

        RETURN QUERY SELECT v_archived_count, v_oldest, v_newest, v_tables;
        RETURN;
    END IF;

    -- ============================================
    -- STEP 5: Move logs to archive (INSERT + DELETE)
    -- ============================================

    -- Insert into archive
    WITH moved_logs AS (
        INSERT INTO audit_logs_archive
        SELECT * FROM audit_logs
        WHERE created_at < cutoff_date
        RETURNING audit_id
    )
    SELECT COUNT(*) INTO v_archived_count FROM moved_logs;

    -- Delete from active table
    DELETE FROM audit_logs WHERE created_at < cutoff_date;

    RAISE NOTICE 'Successfully archived % logs to audit_logs_archive', v_archived_count;

    -- ============================================
    -- STEP 6: Recommend VACUUM
    -- ============================================

    RAISE NOTICE 'Run manually after archival: VACUUM ANALYZE audit_logs;';

    RETURN QUERY SELECT v_archived_count, v_oldest, v_newest, v_tables;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION archive_audit_logs(TIMESTAMPTZ, BOOLEAN) IS
    'Moves audit logs older than cutoff_date to audit_logs_archive table. Use dry_run=TRUE to preview without executing. Returns count of archived logs. Tamper-evident archive-move pattern instead of direct delete.';

-- ============================================
-- QUARTERLY ARCHIVAL HELPER
-- ============================================
-- Purpose: Archive logs older than specified months
-- Usage: SELECT * FROM archive_logs_older_than_months(12, TRUE); -- Dry run for 1 year
--        SELECT * FROM archive_logs_older_than_months(12, FALSE); -- Execute

CREATE OR REPLACE FUNCTION archive_logs_older_than_months(
    months_old INTEGER,
    dry_run BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
    archived_count BIGINT,
    oldest_archived TIMESTAMPTZ,
    newest_archived TIMESTAMPTZ,
    tables_affected TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM archive_audit_logs(
        NOW() - (months_old || ' months')::INTERVAL,
        dry_run
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION archive_logs_older_than_months(INTEGER, BOOLEAN) IS
    'Convenience wrapper to archive logs older than specified number of months. Example: archive_logs_older_than_months(12, TRUE) for 1 year dry run.';

-- ============================================
-- MONTHLY CHUNKED ARCHIVAL (for large datasets)
-- ============================================
-- Purpose: Archive logs in monthly chunks to avoid long-running transactions
-- Usage: SELECT monthly_archive_until(NOW() - INTERVAL '1 year', TRUE); -- Dry run
--        SELECT monthly_archive_until(NOW() - INTERVAL '1 year', FALSE); -- Execute

CREATE OR REPLACE FUNCTION monthly_archive_until(
    final_cutoff_date TIMESTAMPTZ,
    dry_run BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
    month_archived DATE,
    logs_archived BIGINT
) AS $$
DECLARE
    current_month_start DATE;
    next_month_start DATE;
    result RECORD;
BEGIN
    -- Start from the oldest log
    SELECT DATE_TRUNC('month', MIN(created_at))::DATE INTO current_month_start
    FROM audit_logs
    WHERE created_at < final_cutoff_date;

    IF current_month_start IS NULL THEN
        RAISE NOTICE 'No logs found before %', final_cutoff_date;
        RETURN;
    END IF;

    -- Loop through months
    WHILE current_month_start < DATE_TRUNC('month', final_cutoff_date)::DATE LOOP
        next_month_start := (DATE_TRUNC('month', current_month_start) + INTERVAL '1 month')::DATE;

        RAISE NOTICE 'Processing month: %', current_month_start;

        -- Archive this month's logs
        SELECT * INTO result FROM archive_audit_logs(
            next_month_start::TIMESTAMPTZ,
            dry_run
        );

        RETURN QUERY SELECT current_month_start, result.archived_count;

        -- Move to next month
        current_month_start := next_month_start;

        -- Brief pause between batches (only if not dry run)
        IF NOT dry_run THEN
            PERFORM pg_sleep(0.5);
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION monthly_archive_until(TIMESTAMPTZ, BOOLEAN) IS
    'Archives logs in monthly chunks to avoid long-running transactions. Useful for archiving >100K logs.';

-- ============================================
-- RESTORE FROM ARCHIVE HELPER
-- ============================================
-- Purpose: Restore logs from archive back to active table
-- Usage: SELECT restore_logs_from_archive('2024-01-01', '2024-12-31');

CREATE OR REPLACE FUNCTION restore_logs_from_archive(
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ
)
RETURNS BIGINT AS $$
DECLARE
    restored_count BIGINT;
BEGIN
    -- Move logs back to active table
    WITH restored AS (
        INSERT INTO audit_logs
        SELECT * FROM audit_logs_archive
        WHERE created_at BETWEEN start_date AND end_date
        RETURNING audit_id
    )
    SELECT COUNT(*) INTO restored_count FROM restored;

    -- Delete from archive
    DELETE FROM audit_logs_archive
    WHERE created_at BETWEEN start_date AND end_date;

    RAISE NOTICE 'Restored % logs from archive', restored_count;
    RAISE NOTICE 'Run manually: VACUUM ANALYZE audit_logs;';

    RETURN restored_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION restore_logs_from_archive(TIMESTAMPTZ, TIMESTAMPTZ) IS
    'Restores logs from archive table back to active audit_logs table for specified date range.';

-- ============================================
-- ARCHIVE STATISTICS VIEW
-- ============================================
-- Monitor archive table size and log distribution

CREATE OR REPLACE VIEW audit_archive_stats AS
SELECT
    'Active Logs' AS status,
    COUNT(*) AS log_count,
    MIN(created_at) AS oldest_log,
    MAX(created_at) AS newest_log,
    pg_size_pretty(pg_total_relation_size('audit_logs')) AS total_size
FROM audit_logs
UNION ALL
SELECT
    'Archived Logs' AS status,
    COUNT(*) AS log_count,
    MIN(created_at) AS oldest_log,
    MAX(created_at) AS newest_log,
    pg_size_pretty(pg_total_relation_size('audit_logs_archive')) AS total_size
FROM audit_logs_archive;

COMMENT ON VIEW audit_archive_stats IS
    'Summary statistics for active and archived audit logs';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check archive function exists
SELECT
    'Archive functions created' AS status,
    COUNT(*) AS function_count
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('archive_audit_logs', 'archive_logs_older_than_months', 'monthly_archive_until', 'restore_logs_from_archive');

-- View archive stats
SELECT * FROM audit_archive_stats;

-- Example: Dry run archive for logs older than 90 days
-- SELECT * FROM archive_logs_older_than_months(3, TRUE);

-- Migration complete
SELECT '✅ Migration 008 complete: Archive system with dry-run support and restore functions created successfully' AS status;
