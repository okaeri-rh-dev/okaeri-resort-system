# Phase 1e: Table Partitioning Strategy

## Purpose

This document explains how to implement monthly partitioning for the `audit_logs` table to improve query performance and simplify archival as the audit trail grows beyond 100,000 logs. Partitioning is **optional for 3-room resorts** but becomes critical for larger operations or multi-year retention policies.

**When to Implement**: When audit logs exceed 50,000 records or archival workflows become complex.

## Why Partition Audit Logs?

### Performance Benefits

1. **Faster Queries** - PostgreSQL scans only relevant partitions (e.g., January partition for January queries)
2. **Efficient Archival** - Drop entire partitions instead of DELETE operations (instant vs hours)
3. **Index Maintenance** - Smaller per-partition indexes rebuild faster
4. **Parallel Queries** - PostgreSQL can scan multiple partitions concurrently

### Monthly Partitioning Rationale

- **Aligns with business cycles** - Monthly reports, monthly archival decisions
- **Manageable partition sizes** - 3-room resort: ~800 logs/month → optimal partition size
- **Retention flexibility** - Keep 12 months, drop older partitions
- **Minimal complexity** - Automatic partition creation with triggers

## Partitioning Architecture

### Partition Strategy

```
audit_logs (parent table, declarative partitioning)
├── audit_logs_2024_01 (January 2024)
├── audit_logs_2024_02 (February 2024)
├── audit_logs_2024_03 (March 2024)
└── ... (one partition per month)
```

### Partition Key

- **Partition Column**: `created_at` (timestamp with time zone)
- **Partition Method**: RANGE partitioning
- **Partition Interval**: Monthly (1st of month to last day of month)

## Implementation

### Step 1: Convert Existing Table to Partitioned Table

**⚠️ Warning**: This requires downtime. Perform during maintenance window.

```sql
-- ============================================
-- CONVERT AUDIT_LOGS TO PARTITIONED TABLE
-- ============================================

-- 1. Rename existing table (backup)
ALTER TABLE audit_logs RENAME TO audit_logs_backup;

-- 2. Create new partitioned table with same schema
CREATE TABLE audit_logs (
  audit_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- User context
  user_id UUID,
  user_email VARCHAR(255),
  user_role VARCHAR(50),
  source VARCHAR(10) DEFAULT 'db' CHECK (source IN ('db', 'app')),

  -- Operation details
  table_name VARCHAR(100) NOT NULL,
  record_id TEXT,
  record_pk JSONB,
  action VARCHAR(10) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),

  -- Data capture
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],

  -- Business context (Layer 2)
  description TEXT,
  category VARCHAR(50),
  severity VARCHAR(20),

  -- Additional context
  metadata JSONB,
  ip_address INET,
  user_agent TEXT
) PARTITION BY RANGE (created_at);

-- 3. Create initial partitions (current month + next 2 months)
-- This ensures writes don't fail while partition creation is automated

-- Current month partition
CREATE TABLE audit_logs_2024_10 PARTITION OF audit_logs
  FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');

-- Next month partition
CREATE TABLE audit_logs_2024_11 PARTITION OF audit_logs
  FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');

-- Month after next
CREATE TABLE audit_logs_2024_12 PARTITION OF audit_logs
  FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');

-- 4. Copy data from backup to partitioned table
INSERT INTO audit_logs SELECT * FROM audit_logs_backup;

-- 5. Verify data integrity
SELECT
  COUNT(*) AS backup_count,
  (SELECT COUNT(*) FROM audit_logs) AS partitioned_count,
  (SELECT COUNT(*) FROM audit_logs) = COUNT(*) AS data_intact
FROM audit_logs_backup;

-- 6. Recreate indexes on partitioned table
-- (Indexes from Phase 1c - adjusted for partitions)

CREATE INDEX idx_audit_logs_user_context ON audit_logs (user_email, user_id);
CREATE INDEX idx_audit_logs_table_name ON audit_logs (table_name);
CREATE INDEX idx_audit_logs_action ON audit_logs (action);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_record ON audit_logs (table_name, record_id);
CREATE INDEX idx_audit_logs_composite ON audit_logs (table_name, user_email, created_at DESC);
CREATE INDEX idx_audit_logs_keyset ON audit_logs (created_at DESC, audit_id DESC);

-- 7. Recreate triggers on partitioned table
-- (Triggers from Phase 1a and 1b)

-- Identity enforcement trigger
CREATE TRIGGER enforce_audit_identity
  BEFORE INSERT ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION enforce_audit_identity_func();

-- Update triggers on monitored tables (bookings, units, etc.)
-- (These already point to audit_logs table, no changes needed)

-- 8. Drop backup table after verification (only if data intact!)
-- DROP TABLE audit_logs_backup;
```

### Step 2: Automatic Partition Creation

Create a function to automatically create partitions before they're needed:

```sql
-- ============================================
-- AUTOMATIC PARTITION CREATION FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION create_monthly_audit_partitions()
RETURNS void AS $$
DECLARE
  partition_date DATE;
  partition_name TEXT;
  start_date TEXT;
  end_date TEXT;
BEGIN
  -- Create partitions for next 3 months
  FOR i IN 0..2 LOOP
    partition_date := DATE_TRUNC('month', NOW() + (i || ' months')::INTERVAL)::DATE;
    partition_name := 'audit_logs_' || TO_CHAR(partition_date, 'YYYY_MM');
    start_date := TO_CHAR(partition_date, 'YYYY-MM-DD');
    end_date := TO_CHAR(partition_date + INTERVAL '1 month', 'YYYY-MM-DD');

    -- Check if partition already exists
    IF NOT EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = partition_name
        AND n.nspname = 'public'
    ) THEN
      -- Create partition
      EXECUTE FORMAT(
        'CREATE TABLE %I PARTITION OF audit_logs FOR VALUES FROM (%L) TO (%L)',
        partition_name,
        start_date,
        end_date
      );

      RAISE NOTICE 'Created partition: % (% to %)', partition_name, start_date, end_date;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SCHEDULE AUTOMATIC PARTITION CREATION
-- ============================================

-- Option A: pg_cron (if available on your PostgreSQL instance)
SELECT cron.schedule(
  'create-audit-partitions',
  '0 0 1 * *', -- Run at midnight on 1st of every month
  'SELECT create_monthly_audit_partitions();'
);

-- Option B: Manual execution (recommended for Supabase free tier)
-- Run this SQL monthly via Supabase dashboard or cron job:
SELECT create_monthly_audit_partitions();
```

### Step 3: Partition Management Helpers

```sql
-- ============================================
-- PARTITION MANAGEMENT UTILITIES
-- ============================================

-- View all partitions with row counts
CREATE OR REPLACE VIEW audit_partitions AS
SELECT
  schemaname,
  tablename AS partition_name,
  SUBSTRING(tablename FROM 'audit_logs_(\d{4}_\d{2})') AS month_key,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS partition_size,
  (
    SELECT COUNT(*)
    FROM (SELECT 1 FROM ONLY pg_catalog.pg_class WHERE relname = tablename LIMIT 1) x
  ) AS estimated_rows
FROM pg_tables
WHERE tablename LIKE 'audit_logs_%'
  AND schemaname = 'public'
ORDER BY tablename DESC;

-- List partitions with metadata
SELECT * FROM audit_partitions;

-- Drop old partition (manual archival)
-- CAUTION: This deletes data permanently!
-- Example: Drop January 2023 partition
-- DROP TABLE audit_logs_2023_01;
```

## Query Patterns with Partitions

### Partition Pruning (Automatic Optimization)

PostgreSQL automatically excludes irrelevant partitions when queries include `created_at` filters:

```sql
-- ✅ Efficient: Scans only October 2024 partition
SELECT * FROM audit_logs
WHERE created_at >= '2024-10-01'
  AND created_at < '2024-11-01'
ORDER BY created_at DESC;

-- ✅ Efficient: Scans only 3 partitions (Oct, Nov, Dec 2024)
SELECT * FROM audit_logs
WHERE created_at >= '2024-10-01'
  AND created_at < '2025-01-01'
  AND table_name = 'bookings';

-- ❌ Inefficient: Scans ALL partitions (no created_at filter)
SELECT * FROM audit_logs
WHERE table_name = 'bookings'
ORDER BY created_at DESC
LIMIT 50;
-- Solution: Add created_at filter, even if broad:
-- WHERE created_at >= NOW() - INTERVAL '1 year'
```

### Verify Partition Pruning with EXPLAIN

```sql
-- Check which partitions are scanned
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM audit_logs
WHERE created_at >= '2024-10-01'
  AND created_at < '2024-11-01';

-- Look for "Partitions: audit_logs_2024_10" in output
-- If you see "Partitions: (ALL)", partition pruning failed!
```

## Archival Strategy with Partitions

### Monthly Archival Workflow

Instead of slow DELETE operations, drop entire partitions:

```sql
-- ============================================
-- ARCHIVAL: DROP OLD PARTITIONS
-- ============================================

-- 1. Identify partitions older than 1 year
SELECT
  partition_name,
  month_key,
  partition_size
FROM audit_partitions
WHERE TO_DATE(SUBSTRING(partition_name FROM 'audit_logs_(\d{4}_\d{2})'), 'YYYY_MM')
      < DATE_TRUNC('month', NOW() - INTERVAL '1 year');

-- 2. Export partition to backup (optional)
-- Use pg_dump for specific partition:
-- pg_dump -t audit_logs_2023_01 > audit_logs_2023_01_backup.sql

-- 3. Drop old partition (instant, no table lock!)
DROP TABLE IF EXISTS audit_logs_2023_01;

-- Compare performance:
-- DELETE approach: Hours for 10K rows, locks table
-- DROP TABLE approach: Milliseconds, no locks
```

### Archival Automation (Optional)

```sql
-- Auto-drop partitions older than 12 months
CREATE OR REPLACE FUNCTION drop_old_audit_partitions()
RETURNS void AS $$
DECLARE
  partition_record RECORD;
  cutoff_date DATE;
BEGIN
  cutoff_date := DATE_TRUNC('month', NOW() - INTERVAL '12 months')::DATE;

  FOR partition_record IN
    SELECT tablename
    FROM pg_tables
    WHERE tablename LIKE 'audit_logs_%'
      AND schemaname = 'public'
      AND TO_DATE(SUBSTRING(tablename FROM 'audit_logs_(\d{4}_\d{2})'), 'YYYY_MM') < cutoff_date
  LOOP
    EXECUTE FORMAT('DROP TABLE %I', partition_record.tablename);
    RAISE NOTICE 'Dropped old partition: %', partition_record.tablename;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Schedule monthly (if using pg_cron)
SELECT cron.schedule(
  'drop-old-audit-partitions',
  '0 2 1 * *', -- Run at 2am on 1st of every month
  'SELECT drop_old_audit_partitions();'
);
```

## Migration Workflow (Zero-Downtime Approach)

For production systems requiring zero downtime:

```sql
-- ============================================
-- ZERO-DOWNTIME PARTITIONING MIGRATION
-- ============================================

-- 1. Create partitioned table alongside existing table
CREATE TABLE audit_logs_partitioned (
  -- Same schema as audit_logs
) PARTITION BY RANGE (created_at);

-- 2. Create partitions for historical + future months
-- (same as Step 1 above)

-- 3. Setup bidirectional replication
-- Option A: Logical replication (PostgreSQL 10+)
-- Option B: Trigger-based sync (copy INSERT to both tables)

CREATE OR REPLACE FUNCTION sync_to_partitioned_table()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs_partitioned VALUES (NEW.*);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_audit_logs
  AFTER INSERT ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION sync_to_partitioned_table();

-- 4. Backfill historical data (in batches to avoid locks)
DO $$
DECLARE
  batch_size INT := 10000;
  offset_val INT := 0;
  rows_inserted INT;
BEGIN
  LOOP
    INSERT INTO audit_logs_partitioned
    SELECT * FROM audit_logs
    ORDER BY created_at
    LIMIT batch_size OFFSET offset_val;

    GET DIAGNOSTICS rows_inserted = ROW_COUNT;
    EXIT WHEN rows_inserted = 0;

    offset_val := offset_val + batch_size;
    RAISE NOTICE 'Migrated % rows...', offset_val;
    PERFORM pg_sleep(1); -- Pause to reduce load
  END LOOP;
END $$;

-- 5. Verify data integrity
SELECT
  (SELECT COUNT(*) FROM audit_logs) AS original_count,
  (SELECT COUNT(*) FROM audit_logs_partitioned) AS partitioned_count;

-- 6. Switch application to use audit_logs_partitioned
-- Update app code: db.from('audit_logs_partitioned')

-- 7. After verification, rename tables
BEGIN;
  ALTER TABLE audit_logs RENAME TO audit_logs_old;
  ALTER TABLE audit_logs_partitioned RENAME TO audit_logs;
COMMIT;

-- 8. Drop old table after monitoring period
-- DROP TABLE audit_logs_old;
```

## Performance Impact

### Query Performance Comparison

| Query Type            | Unpartitioned (100K logs) | Partitioned (100K logs, 12 partitions) | Improvement   |
| --------------------- | ------------------------- | -------------------------------------- | ------------- |
| Recent month filter   | ~200ms (full scan)        | ~20ms (1 partition)                    | 10x faster    |
| Date range (3 months) | ~180ms (full scan)        | ~50ms (3 partitions)                   | 3.6x faster   |
| Full table scan       | ~500ms                    | ~500ms                                 | No change     |
| Archival DELETE       | Hours (10K rows)          | Milliseconds (DROP TABLE)              | 1000x+ faster |

### Storage Efficiency

```
Unpartitioned table:
- Indexes: 8 indexes × ~2MB each = ~16MB
- Total overhead: ~16MB

Partitioned table (12 monthly partitions):
- Indexes: 8 indexes × 12 partitions × ~200KB = ~19MB
- Total overhead: ~19MB

Conclusion: ~20% more storage, but massive archival speed improvement
```

## Troubleshooting

### Problem: "No partition of relation for row" error

**Cause**: Writing to month without corresponding partition.

**Solution**: Create missing partition manually:

```sql
-- Check current date
SELECT NOW();

-- Create partition for current month
CREATE TABLE audit_logs_2024_10 PARTITION OF audit_logs
  FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');
```

### Problem: Queries still slow after partitioning

**Diagnosis**: Check if partition pruning is active:

```sql
EXPLAIN SELECT * FROM audit_logs
WHERE created_at >= '2024-10-01';

-- Should show: Partitions: audit_logs_2024_10
-- If shows: Partitions: (ALL), pruning failed
```

**Solution**: Always include `created_at` filter in WHERE clause.

### Problem: Partition creation automation fails

**Workaround for Supabase free tier** (no pg_cron access):

```bash
#!/bin/bash
# create-partitions-cron.sh
# Run monthly via external cron (Vercel cron, GitHub Actions, etc.)

curl -X POST 'https://your-project.supabase.co/rest/v1/rpc/create_monthly_audit_partitions' \
  -H "apikey: YOUR_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

Schedule via Vercel cron (`vercel.json`):

```json
{
  "crons": [
    {
      "path": "/api/cron/create-audit-partitions",
      "schedule": "0 0 1 * *"
    }
  ]
}
```

API handler (`/api/cron/create-audit-partitions.ts`):

```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase.rpc("create_monthly_audit_partitions");

  if (error) {
    console.error("Partition creation failed:", error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true, message: "Partitions created" });
}
```

## Next Steps

**Previous**: [Phase 1d - Migration Workflow](./01d-migration-workflow.md)
**Next**: [Phase 2a - Types and Constants](../02-application-integration/02a-types-and-constants.md)

Partitioning is now configured for long-term scalability!

---

**Partitioning Checklist:**

- [ ] Existing table backed up
- [ ] Partitioned table created with RANGE on `created_at`
- [ ] Initial 3-month partitions created
- [ ] Data migrated and verified
- [ ] Indexes recreated on partitioned table
- [ ] Triggers recreated on partitioned table
- [ ] Automatic partition creation function deployed
- [ ] Monthly automation scheduled (pg_cron or Vercel cron)
- [ ] Query performance verified (partition pruning active)
- [ ] Archival workflow tested (DROP TABLE)
- [ ] Monitoring added for partition count
- [ ] Documentation updated with partition management procedures
