# Phase 1c: Indexes and Performance Optimization

## Purpose

This document covers the performance optimization strategy for the audit trail system. With automatic triggers capturing every database change, the `audit_logs` table will grow continuously. Proper indexing ensures fast queries even with thousands of logs.

**Target**: Sub-100ms query response times for common audit queries in a 3-room resort (estimated 10,000 logs/year).

## Performance Indexes

### Index Strategy

The audit system requires 8 carefully designed indexes to support common query patterns:

1. **Primary Key** - Fast lookups by audit_id
2. **User Queries** - Filter by who made changes
3. **Table Queries** - Filter by which table was affected
4. **Action Queries** - Filter by operation type
5. **Time Range** - Filter by date ranges
6. **Record History** - Track specific record changes
7. **Composite Index** - Complex multi-filter queries
8. **Keyset Pagination** - Efficient cursor-based pagination for large datasets

### Index Definitions

```sql
-- ============================================
-- AUDIT LOGS PERFORMANCE INDEXES
-- ============================================

-- 1. Primary Key Index (automatic)
-- Already created with audit_id UUID PRIMARY KEY

-- 2. User Context Index
-- Used when filtering by user email or user_id
-- Supports queries like "show all changes by john@resort.com"
CREATE INDEX idx_audit_logs_user_context ON audit_logs (user_email, user_id);

-- 3. Table Name Index
-- Used when filtering by specific tables
-- Supports queries like "show all booking changes"
CREATE INDEX idx_audit_logs_table_name ON audit_logs (table_name);

-- 4. Action Index
-- Used when filtering by operation type
-- Supports queries like "show all deletions"
CREATE INDEX idx_audit_logs_action ON audit_logs (action);

-- 5. Timestamp Index (DESC for recent-first queries)
-- Used for date range queries and "most recent changes"
-- DESC order optimizes the common "latest changes first" pattern
CREATE INDEX idx_audit_logs_timestamp ON audit_logs (created_at DESC);

-- 6. Record Tracking Index
-- Used to get complete history for a specific record
-- Supports queries like "show all changes to booking BK-2024-001"
CREATE INDEX idx_audit_logs_record ON audit_logs (table_name, record_id);

-- 7. Composite Index for Complex Queries
-- Optimizes multi-filter queries (user + table + time range)
-- Most selective columns first: table_name -> user_email -> created_at
CREATE INDEX idx_audit_logs_composite ON audit_logs (table_name, user_email, created_at DESC);

-- 8. Keyset Pagination Index (for large datasets)
-- Optimizes cursor-based pagination (better than OFFSET for 10K+ rows)
-- Composite index on ordering columns: created_at DESC, audit_id DESC
-- Supports efficient "next page" queries without scanning skipped rows
CREATE INDEX idx_audit_logs_keyset ON audit_logs (created_at DESC, audit_id DESC);

-- ============================================
-- INDEX COMMENTS (for documentation)
-- ============================================

COMMENT ON INDEX idx_audit_logs_user_context IS
  'Optimizes queries filtering by user email or user ID';

COMMENT ON INDEX idx_audit_logs_table_name IS
  'Optimizes queries filtering by specific tables (bookings, units, etc)';

COMMENT ON INDEX idx_audit_logs_action IS
  'Optimizes queries filtering by action type (INSERT, UPDATE, DELETE)';

COMMENT ON INDEX idx_audit_logs_timestamp IS
  'Optimizes date range queries and recent-first ordering';

COMMENT ON INDEX idx_audit_logs_record IS
  'Optimizes record history queries (all changes to a specific booking/unit)';

COMMENT ON INDEX idx_audit_logs_composite IS
  'Optimizes complex multi-filter queries (table + user + date range)';

COMMENT ON INDEX idx_audit_logs_keyset IS
  'Optimizes keyset (cursor-based) pagination for large datasets without OFFSET scan penalty';
```

### Index Rationale

#### Why These Indexes?

**idx_audit_logs_user_context**

- Most common query: "What did this user change?"
- Covers both Supabase Auth users (user_id) and manual entries (user_email)
- ~20-50 logs per user per week

**idx_audit_logs_table_name**

- Second most common: "What changed in bookings?"
- Small cardinality (only 6 tables), but high selectivity
- Reduces scan from all logs to specific table logs

**idx_audit_logs_action**

- Security queries: "Show all deletions"
- Very small cardinality (INSERT, UPDATE, DELETE), but important for anomaly detection
- Helps identify unusual patterns (unexpected DELETEs)

**idx_audit_logs_timestamp DESC**

- Most recent changes are most relevant
- DESC order eliminates reverse sorting cost
- Supports efficient pagination with LIMIT/OFFSET

**idx_audit_logs_record**

- Critical for record history: "Show booking lifecycle"
- Composite key (table_name + record_id) ensures uniqueness across tables
- Enables fast "audit trail for this booking" feature

**idx_audit_logs_composite**

- Handles complex admin queries: "Show bookings changed by user X in January"
- Column order follows selectivity: table_name (6 values) → user_email (10-50 values) → timestamp (continuous)
- Postgres can use partial index for simpler queries

**idx_audit_logs_keyset**

- Solves OFFSET pagination performance degradation for large datasets
- OFFSET scans and discards all skipped rows (e.g., OFFSET 10000 scans 10,000 rows)
- Keyset pagination uses WHERE created_at < $cursor - only scans needed rows
- Critical for audit logs that grow continuously (10K+ logs)
- Composite index (created_at, audit_id) ensures stable ordering even with duplicate timestamps
- Used by keysetPage() helper function in application layer

#### What We're NOT Indexing

**ip_address** - Low query frequency, full table scan acceptable
**changed_fields** - Array type, complex to index, query infrequent
**old_data / new_data** - JSONB indexing complex, GIN indexes too expensive for 3-room resort
**metadata** - JSONB field, flexible structure makes indexing impractical

These fields are still queryable, just without index acceleration.

## Query Optimization Patterns

### Common Query Examples

#### 1. Recent Changes (Latest 50)

```sql
-- Optimized with idx_audit_logs_timestamp
SELECT
  audit_id,
  created_at,
  user_email,
  table_name,
  action,
  changed_fields
FROM audit_logs
ORDER BY created_at DESC
LIMIT 50;

-- Expected: < 10ms with index, ~500ms without
```

#### 2. User Activity Log

```sql
-- Optimized with idx_audit_logs_user_context
SELECT
  created_at,
  table_name,
  action,
  record_id,
  changed_fields
FROM audit_logs
WHERE user_email = 'owner@resort.com'
ORDER BY created_at DESC
LIMIT 100;

-- Expected: < 20ms with index
```

#### 3. Booking Change History

```sql
-- Optimized with idx_audit_logs_record
SELECT
  audit_id,
  created_at,
  user_email,
  action,
  changed_fields,
  old_data,
  new_data
FROM audit_logs
WHERE table_name = 'bookings'
  AND record_id = '123e4567-e89b-12d3-a456-426614174000'
ORDER BY created_at ASC;

-- Expected: < 15ms with index
-- ASC order shows change progression (create → updates → maybe delete)
```

#### 4. Security Audit (All Deletions)

```sql
-- Optimized with idx_audit_logs_action + idx_audit_logs_timestamp
SELECT
  created_at,
  user_email,
  table_name,
  record_id,
  old_data
FROM audit_logs
WHERE action = 'DELETE'
ORDER BY created_at DESC
LIMIT 50;

-- Expected: < 30ms with index
```

#### 5. Complex Multi-Filter Query

```sql
-- Optimized with idx_audit_logs_composite
SELECT
  audit_id,
  created_at,
  user_email,
  action,
  record_id,
  changed_fields
FROM audit_logs
WHERE table_name = 'bookings'
  AND user_email = 'manager@resort.com'
  AND created_at >= NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;

-- Expected: < 40ms with composite index
-- Without composite index: ~200-500ms (multiple index scans + merge)
```

#### 6. Keyset Pagination (Cursor-Based)

```sql
-- Optimized with idx_audit_logs_keyset
-- First page (no cursor)
SELECT
  audit_id,
  created_at,
  user_email,
  table_name,
  action,
  changed_fields
FROM audit_logs
ORDER BY created_at DESC, audit_id DESC
LIMIT 50;

-- Next page (using last row's created_at and audit_id as cursor)
SELECT
  audit_id,
  created_at,
  user_email,
  table_name,
  action,
  changed_fields
FROM audit_logs
WHERE (created_at, audit_id) < ($cursor_timestamp, $cursor_id)
ORDER BY created_at DESC, audit_id DESC
LIMIT 50;

-- Expected: < 15ms per page (constant time regardless of page number)
-- Compare to OFFSET: Page 200 with OFFSET 10000 would scan 10,000 rows

-- "Has more" pattern (no count() needed)
-- If result has 50 rows, there's a next page
-- Avoids expensive count(*) query on large tables
```

### EXPLAIN ANALYZE Examples

Use these to verify index usage:

```sql
-- Check if timestamp index is being used
EXPLAIN ANALYZE
SELECT * FROM audit_logs
ORDER BY created_at DESC
LIMIT 50;

-- Look for: "Index Scan using idx_audit_logs_timestamp"
-- Avoid: "Seq Scan on audit_logs" (means no index used)

-- Check composite index usage
EXPLAIN ANALYZE
SELECT * FROM audit_logs
WHERE table_name = 'bookings'
  AND user_email = 'owner@resort.com'
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- Look for: "Index Scan using idx_audit_logs_composite"
```

## Performance Benchmarks

### Expected Query Times (3-Room Resort)

| Query Type                   | Records Scanned | Without Indexes | With Indexes | Improvement            |
| ---------------------------- | --------------- | --------------- | ------------ | ---------------------- |
| Recent 50 logs               | 10,000          | ~500ms          | < 10ms       | 50x faster             |
| User activity (100 logs)     | 10,000          | ~600ms          | < 20ms       | 30x faster             |
| Record history               | 10-50           | ~400ms          | < 15ms       | 27x faster             |
| Table filter                 | 3,000           | ~300ms          | < 25ms       | 12x faster             |
| Multi-filter complex         | 1,000           | ~400ms          | < 40ms       | 10x faster             |
| Keyset pagination (any page) | 50              | ~(page × 50)ms  | < 15ms       | 67x faster at page 100 |

### Storage Impact

```
Index Storage Estimate (10,000 audit logs):
- Primary key: ~200 KB (automatic)
- User context index: ~180 KB
- Table name index: ~120 KB
- Action index: ~120 KB
- Timestamp index: ~150 KB
- Record index: ~220 KB
- Composite index: ~280 KB
- Keyset pagination index: ~200 KB

Total Index Overhead: ~1.5 MB
Total Table Size: ~25 MB (10,000 logs × 2.5KB)
Index Ratio: ~6% of table size

Conclusion: Negligible storage cost, massive query speed benefit
```

## Index Maintenance

### Automatic Maintenance

PostgreSQL automatically maintains indexes, but periodic manual optimization improves performance:

```sql
-- ============================================
-- QUARTERLY MAINTENANCE (every 3 months)
-- ============================================

-- 1. Update table statistics
-- Helps query planner choose optimal indexes
ANALYZE audit_logs;

-- 2. Rebuild indexes (removes bloat)
-- Run during low-traffic hours (midnight-4am)
REINDEX TABLE audit_logs;

-- 3. Check index health
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE tablename = 'audit_logs'
ORDER BY pg_relation_size(indexrelid) DESC;

-- ============================================
-- MONITORING INDEX USAGE
-- ============================================

-- Check which indexes are actually being used
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan AS index_scans,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename = 'audit_logs'
ORDER BY idx_scan DESC;

-- If idx_scan = 0, index is not being used (safe to drop)
```

### When to Rebuild Indexes

Rebuild indexes when:

1. **Table grows significantly** - After 50,000+ new logs (yearly for 3-room resort)
2. **Query performance degrades** - Response times consistently > 100ms
3. **High UPDATE/DELETE activity** - Index bloat from frequent changes
4. **After bulk operations** - After manual archival or data cleanup

### Archival Impact on Indexes

When manually archiving old logs (recommended quarterly):

```sql
-- Archive logs older than 1 year
-- This DELETE will trigger index updates
DELETE FROM audit_logs
WHERE created_at < NOW() - INTERVAL '1 year';

-- After archival, rebuild indexes
VACUUM FULL audit_logs;
REINDEX TABLE audit_logs;
ANALYZE audit_logs;
```

## Migration Integration

### Adding Indexes to Migration

Include these indexes in your migration script (`migrate-audit-system.sh`):

```bash
#!/bin/bash
# ... (existing migration code from 01d-migration-workflow.md)

echo "Creating performance indexes..."
psql $DB_URL -c "
-- User context index
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_context
  ON audit_logs (user_email, user_id);

-- Table name index
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name
  ON audit_logs (table_name);

-- Action index
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON audit_logs (action);

-- Timestamp index (DESC)
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp
  ON audit_logs (created_at DESC);

-- Record tracking index
CREATE INDEX IF NOT EXISTS idx_audit_logs_record
  ON audit_logs (table_name, record_id);

-- Composite index
CREATE INDEX IF NOT EXISTS idx_audit_logs_composite
  ON audit_logs (table_name, user_email, created_at DESC);

-- Keyset pagination index
CREATE INDEX IF NOT EXISTS idx_audit_logs_keyset
  ON audit_logs (created_at DESC, audit_id DESC);

-- Update statistics
ANALYZE audit_logs;
"

if [ $? -eq 0 ]; then
  echo "✅ Performance indexes created successfully"
else
  echo "❌ Index creation failed"
  exit 1
fi
```

### Verification After Migration

```bash
# Run this after migration completes
psql $DB_URL -c "
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'audit_logs'
ORDER BY indexname;
"

# Should show 8 indexes (including primary key)
```

## Troubleshooting Performance Issues

### Problem: Queries Still Slow After Adding Indexes

**Diagnosis:**

```sql
-- Check if indexes are being used
EXPLAIN ANALYZE
SELECT * FROM audit_logs
WHERE user_email = 'test@resort.com'
ORDER BY created_at DESC
LIMIT 50;
```

**Common Causes:**

1. **Missing ANALYZE** - Query planner has outdated statistics
   - **Solution:** Run `ANALYZE audit_logs;`

2. **Wrong index chosen** - Planner picked suboptimal index
   - **Solution:** Add more specific WHERE clauses to force composite index

3. **Index bloat** - Indexes fragmented from many changes
   - **Solution:** Run `REINDEX TABLE audit_logs;`

4. **Too many results** - Query returning thousands of rows
   - **Solution:** Add more filters or reduce LIMIT

### Problem: Index Creation Takes Too Long

**Diagnosis:**

```sql
-- Check table size
SELECT pg_size_pretty(pg_total_relation_size('audit_logs'));
```

**Solutions:**

- Create indexes one at a time during low-traffic hours
- Use `CREATE INDEX CONCURRENTLY` (doesn't lock table, but slower)
- Consider partial indexes if full indexes too large

### Problem: Disk Space Issues

**Diagnosis:**

```sql
-- Check total space used by audit system
SELECT
  pg_size_pretty(pg_total_relation_size('audit_logs')) AS total_size,
  pg_size_pretty(pg_relation_size('audit_logs')) AS table_size,
  pg_size_pretty(pg_total_relation_size('audit_logs') - pg_relation_size('audit_logs')) AS indexes_size;
```

**Solutions:**

- Archive old logs (> 1 year)
- Run `VACUUM FULL` to reclaim space
- Consider dropping least-used indexes

## Next Steps

You've completed Phase 1 (Database Setup)! The foundation is solid:

- ✅ audit_logs table with optimized schema
- ✅ Automatic triggers on all 6 tables
- ✅ Performance indexes for fast queries
- ✅ Migration and rollback scripts

**Next Phase**: [Phase 2a - Types and Constants](../02-application-integration/02a-types-and-constants.md)

Phase 2 will extend your TypeScript application layer to interact with the audit system:

- Type definitions and enums
- Database helper functions
- Audit logging utility
- React hooks and Zustand store

---

**Performance Checklist:**

- [ ] All 8 indexes created (including keyset pagination)
- [ ] ANALYZE run after index creation
- [ ] EXPLAIN ANALYZE shows index usage
- [ ] Query response times < 100ms
- [ ] Index storage < 10% of table size
- [ ] Maintenance schedule documented
- [ ] Keyset pagination pattern implemented in app layer
