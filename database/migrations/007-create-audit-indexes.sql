-- ============================================
-- MIGRATION: 007 - Create Performance Indexes
-- ============================================
-- Description: Creates 8 optimized indexes for audit log queries
-- Author: Okaeri Resort System - Audit Trail Phase 1
-- Date: 2025-01-02
-- Dependencies: 005-create-audit-logs.sql
-- Performance Target: <100ms query response for common patterns

\set ON_ERROR_STOP on

-- ============================================
-- AUDIT LOGS PERFORMANCE INDEXES
-- ============================================
-- Strategy: Support common query patterns with minimal storage overhead
-- Index Ratio: ~6% of table size (acceptable for query speed gains)

-- ============================================
-- 1. PRIMARY KEY INDEX (Automatic)
-- ============================================
-- Already created with audit_id UUID PRIMARY KEY
-- No action needed here

-- ============================================
-- 2. USER CONTEXT INDEX
-- ============================================
-- Used when filtering by user email or user_id
-- Supports queries like "show all changes by john@resort.com"
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_context
    ON audit_logs (user_email, user_id);

COMMENT ON INDEX idx_audit_logs_user_context IS
    'Optimizes queries filtering by user email or user ID';

-- ============================================
-- 3. TABLE NAME INDEX
-- ============================================
-- Used when filtering by specific tables
-- Supports queries like "show all booking changes"
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name
    ON audit_logs (table_name);

COMMENT ON INDEX idx_audit_logs_table_name IS
    'Optimizes queries filtering by specific tables (bookings, units, etc)';

-- ============================================
-- 4. ACTION INDEX
-- ============================================
-- Used when filtering by operation type
-- Supports queries like "show all deletions"
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
    ON audit_logs (action);

COMMENT ON INDEX idx_audit_logs_action IS
    'Optimizes queries filtering by action type (INSERT, UPDATE, DELETE)';

-- ============================================
-- 5. TIMESTAMP INDEX (DESC for recent-first queries)
-- ============================================
-- Used for date range queries and "most recent changes"
-- DESC order optimizes the common "latest changes first" pattern
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp
    ON audit_logs (created_at DESC);

COMMENT ON INDEX idx_audit_logs_timestamp IS
    'Optimizes date range queries and recent-first ordering';

-- ============================================
-- 6. RECORD TRACKING INDEX
-- ============================================
-- Used to get complete history for a specific record
-- Supports queries like "show all changes to booking BK-2024-001"
CREATE INDEX IF NOT EXISTS idx_audit_logs_record
    ON audit_logs (table_name, record_id);

COMMENT ON INDEX idx_audit_logs_record IS
    'Optimizes record history queries (all changes to a specific booking/unit)';

-- ============================================
-- 7. COMPOSITE INDEX FOR COMPLEX QUERIES
-- ============================================
-- Optimizes multi-filter queries (user + table + time range)
-- Most selective columns first: table_name -> user_email -> created_at
CREATE INDEX IF NOT EXISTS idx_audit_logs_composite
    ON audit_logs (table_name, user_email, created_at DESC);

COMMENT ON INDEX idx_audit_logs_composite IS
    'Optimizes complex multi-filter queries (table + user + date range)';

-- ============================================
-- 8. KEYSET PAGINATION INDEX (for large datasets)
-- ============================================
-- Optimizes cursor-based pagination (better than OFFSET for 10K+ rows)
-- Composite index on ordering columns: created_at DESC, audit_id DESC
-- Supports efficient "next page" queries without scanning skipped rows
CREATE INDEX IF NOT EXISTS idx_audit_logs_keyset
    ON audit_logs (created_at DESC, audit_id DESC);

COMMENT ON INDEX idx_audit_logs_keyset IS
    'Optimizes keyset (cursor-based) pagination for large datasets without OFFSET scan penalty';

-- ============================================
-- 9. CATEGORY INDEX (Optional - Partial Index)
-- ============================================
-- Used when filtering by category (only for Layer 2 app events)
-- Partial index (WHERE category IS NOT NULL) for smaller size
CREATE INDEX IF NOT EXISTS idx_audit_logs_category
    ON audit_logs (category, created_at DESC)
    WHERE category IS NOT NULL;

COMMENT ON INDEX idx_audit_logs_category IS
    'Optimizes application-layer category queries (only indexes non-null categories)';

-- ============================================
-- 10. CORRELATION ID INDEX
-- ============================================
-- Used to find all related logs for a specific operation
-- Supports queries like "show all logs for correlation_id X"
CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation
    ON audit_logs (correlation_id);

COMMENT ON INDEX idx_audit_logs_correlation IS
    'Optimizes queries that find all logs for a specific correlation_id';

-- ============================================
-- UPDATE TABLE STATISTICS
-- ============================================
-- Update statistics for query planner to choose optimal indexes
ANALYZE audit_logs;

-- ============================================
-- INDEX STATISTICS VIEW
-- ============================================
-- Create view for monitoring index usage and size
CREATE OR REPLACE VIEW audit_index_stats AS
SELECT
    schemaname,
    relname AS tablename,
    indexrelname AS indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    idx_scan AS times_used,
    idx_tup_read AS rows_read,
    idx_tup_fetch AS rows_fetched
FROM pg_stat_user_indexes
WHERE relname = 'audit_logs'
ORDER BY pg_relation_size(indexrelid) DESC;

COMMENT ON VIEW audit_index_stats IS
    'Monitor index usage and size for audit_logs table';

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

-- Count total indexes (should be 8-10 including primary key and trigger-created indexes)
SELECT
    'Audit indexes created' AS status,
    COUNT(*) AS index_count
FROM pg_indexes
WHERE tablename = 'audit_logs';

-- Expected output: 10-11 indexes total
-- - 1 primary key (audit_id)
-- - 8 core indexes (user_context, table_name, action, timestamp, record, composite, keyset, correlation)
-- - 1 optional category index
-- - Any trigger-created indexes

-- Migration complete
SELECT '✅ Migration 007 complete: 8 performance indexes + statistics view created successfully' AS status;
