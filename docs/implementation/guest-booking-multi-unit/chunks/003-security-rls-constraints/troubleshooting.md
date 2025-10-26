# Troubleshooting: Chunk 003

## Purpose

Common issues encountered during Chunk 003 implementation and their solutions. Organized by symptom for quick reference.

---

## Table of Contents

1. [EXCLUDE Constraint Issues](#exclude-constraint-issues)
2. [CHECK Constraint Problems](#check-constraint-problems)
3. [Audit Trigger Errors](#audit-trigger-errors)
4. [RLS Policy Issues](#rls-policy-issues)
5. [Performance Problems](#performance-problems)
6. [Testing and Verification](#testing-and-verification)

---

## EXCLUDE Constraint Issues

### Symptom: "Extension btree_gist does not exist"

**Cause**: btree_gist extension required for EXCLUDE constraints is not installed.

**Solution**:

```sql
-- Install extension (requires superuser)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Verify it's installed
SELECT extname, extversion FROM pg_extension WHERE extname = 'btree_gist';
-- Expected: 1 row with extname 'btree_gist'

-- If you don't have superuser access:
-- - Contact Supabase support (extension should be available by default)
-- - Or use different concurrency strategy (application-level locking)
```

**Prevention**: Always verify prerequisites before running migrations.

---

### Symptom: "Operator class gist_range_ops does not exist"

**Cause**: PostgreSQL version too old or btree_gist extension not properly loaded.

**Solution**:

```sql
-- Check PostgreSQL version (must be 9.2+)
SELECT version();

-- Reload extension
DROP EXTENSION IF EXISTS btree_gist CASCADE;
CREATE EXTENSION btree_gist;

-- Recreate EXCLUDE constraint
ALTER TABLE booking_units
ADD CONSTRAINT no_double_booking EXCLUDE USING gist (
    unit_id WITH =,
    daterange(check_in_date, check_out_date, '[]') WITH &&
) WHERE (status != 'cancelled');
```

---

### Symptom: "EXCLUDE constraint allows overlapping bookings"

**Cause**: WHERE clause excludes the test bookings or date range format is wrong.

**Debug**:

```sql
-- Check constraint definition
SELECT pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'no_double_booking';

-- Should include:
-- - unit_id WITH =
-- - daterange(...) WITH &&
-- - WHERE (status <> 'cancelled')

-- Test with simple data
DO $$
DECLARE
    v_unit UUID;
    v_booking_1 UUID := gen_random_uuid();
    v_booking_2 UUID := gen_random_uuid();
BEGIN
    SELECT unit_id INTO v_unit FROM units LIMIT 1;

    -- Insert first booking
    INSERT INTO booking_units VALUES (
        v_booking_1, v_unit, '2026-01-01', '2026-01-05', 'confirmed', NOW(), NOW()
    );

    RAISE NOTICE 'First booking: % - % to %', v_booking_1, '2026-01-01', '2026-01-05';

    -- Try overlapping (should fail)
    INSERT INTO booking_units VALUES (
        v_booking_2, v_unit, '2026-01-03', '2026-01-07', 'confirmed', NOW(), NOW()
    );

    RAISE EXCEPTION 'Constraint did not fire!';

EXCEPTION
    WHEN exclusion_violation THEN
        RAISE NOTICE '✅ Constraint working';
        DELETE FROM booking_units WHERE booking_id IN (v_booking_1, v_booking_2);
    WHEN OTHERS THEN
        RAISE NOTICE '❌ Unexpected error: %', SQLERRM;
        DELETE FROM booking_units WHERE booking_id IN (v_booking_1, v_booking_2);
END $$;
```

**Common Issues**:

1. **Wrong status**: If test bookings have `status = 'cancelled'`, constraint won't fire (WHERE clause)
2. **Wrong date type**: Ensure dates are `DATE` type, not `TIMESTAMPTZ`
3. **Inclusive vs exclusive range**: Migration uses `'[]'` (inclusive both ends) - verify with your business logic

**Solution**:

```sql
-- Fix: Ensure test data has active status
INSERT INTO booking_units (..., status) VALUES (..., 'confirmed');  -- NOT 'cancelled'

-- Fix: Verify date types
SELECT
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'booking_units'
  AND column_name IN ('check_in_date', 'check_out_date');
-- Expected: date (not timestamp)

-- Fix: Update constraint if range logic is wrong
ALTER TABLE booking_units DROP CONSTRAINT no_double_booking;
ALTER TABLE booking_units ADD CONSTRAINT no_double_booking EXCLUDE USING gist (
    unit_id WITH =,
    daterange(check_in_date, check_out_date, '[)') WITH &&  -- '[)' = inclusive start, exclusive end
) WHERE (status != 'cancelled');
```

---

### Symptom: "Performance degraded after adding EXCLUDE constraint"

**Cause**: GiST index not created or table scan happening for every insert.

**Solution**:

```sql
-- Check if GiST index exists (should be automatic)
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'booking_units'
  AND indexdef LIKE '%gist%';

-- If missing, constraint creation failed
-- Drop and recreate constraint (index created automatically)
ALTER TABLE booking_units DROP CONSTRAINT IF EXISTS no_double_booking;
ALTER TABLE booking_units ADD CONSTRAINT no_double_booking EXCLUDE USING gist (
    unit_id WITH =,
    daterange(check_in_date, check_out_date, '[]') WITH &&
) WHERE (status != 'cancelled');

-- Verify index is used
EXPLAIN (ANALYZE, BUFFERS)
INSERT INTO booking_units (booking_id, unit_id, check_in_date, check_out_date, status)
VALUES (gen_random_uuid(), '<some-unit-id>', '2026-01-01', '2026-01-05', 'confirmed');

-- Look for "Index Scan using ... on booking_units" in EXPLAIN output
```

**Expected**: Constraint check should use GiST index (not sequential scan).

---

## CHECK Constraint Problems

### Symptom: "All-or-nothing constraint blocks valid assignments"

**Cause**: Subquery logic is wrong or table join is missing data.

**Debug**:

```sql
-- Test the constraint logic manually
DO $$
DECLARE
    v_test_booking UUID := '<your-test-booking-id>';
    v_confirmed_count INTEGER;
    v_requested_count INTEGER;
BEGIN
    -- Count confirmed booking_units
    SELECT COUNT(*) INTO v_confirmed_count
    FROM booking_units
    WHERE booking_id = v_test_booking
      AND status = 'confirmed';

    -- Count requested units
    SELECT COUNT(*) INTO v_requested_count
    FROM guest_booking_unit_requests
    WHERE booking_id = v_test_booking;

    RAISE NOTICE 'Booking: %', v_test_booking;
    RAISE NOTICE 'Confirmed units: %', v_confirmed_count;
    RAISE NOTICE 'Requested units: %', v_requested_count;
    RAISE NOTICE 'Match: %', v_confirmed_count = v_requested_count;

    -- If counts are equal but constraint fires, constraint is wrong
    -- If counts are NOT equal and constraint doesn't fire, constraint is missing
END $$;
```

**Common Issues**:

1. **Wrong status**: booking_units must have `status = 'confirmed'` (not 'pending' or 'cancelled')
2. **Missing rows**: Not all units are in `booking_units` table yet
3. **Orphaned requests**: `guest_booking_unit_requests` has extra rows from previous tests

**Solution**:

```sql
-- Verify booking data
SELECT
    b.booking_id,
    b.requested_unit_count,
    COUNT(DISTINCT gbur.id) AS request_count,
    COUNT(bu.booking_unit_id) FILTER (WHERE bu.status = 'confirmed') AS confirmed_count
FROM bookings b
LEFT JOIN guest_booking_unit_requests gbur ON gbur.booking_id = b.booking_id
LEFT JOIN booking_units bu ON bu.booking_id = b.booking_id
WHERE b.booking_id = '<test-booking-id>'
GROUP BY b.booking_id, b.requested_unit_count;

-- If numbers don't match, clean up orphans
DELETE FROM guest_booking_unit_requests
WHERE booking_id NOT IN (SELECT booking_id FROM bookings);

DELETE FROM booking_units
WHERE booking_id NOT IN (SELECT booking_id FROM bookings);
```

---

### Symptom: "Constraint has severe performance impact"

**Cause**: Subqueries run on every UPDATE, causing full table scans.

**Solution**:

This is expected behavior for CHECK constraints with subqueries. Optimize by:

1. **Add indexes** on foreign keys:

   ```sql
   CREATE INDEX IF NOT EXISTS idx_booking_units_booking_status
       ON booking_units(booking_id, status)
       WHERE status = 'confirmed';

   CREATE INDEX IF NOT EXISTS idx_guest_booking_requests_booking
       ON guest_booking_unit_requests(booking_id);
   ```

2. **Limit updates** to only when needed:

   ```sql
   -- ❌ BAD: Updates entire table
   UPDATE bookings SET updated_at = NOW();

   -- ✅ GOOD: Only updates specific booking
   UPDATE bookings
   SET unit_assignment_status = 'assigned', updated_at = NOW()
   WHERE booking_id = '<specific-id>';
   ```

3. **Use transactions** to batch updates:
   ```sql
   BEGIN;
   -- Multiple updates
   UPDATE bookings SET ... WHERE booking_id = 'x';
   UPDATE bookings SET ... WHERE booking_id = 'y';
   COMMIT;
   -- Constraint checked once at commit
   ```

**Expected Performance**:

- Single booking update: <10ms
- Batch update (10 bookings): <50ms

If slower, check `EXPLAIN ANALYZE` output for sequential scans.

---

### Symptom: "Payment-before-assignment allows assignment without payment"

**Cause**: payment_status column has unexpected values not covered by constraint.

**Debug**:

```sql
-- Check distinct payment statuses
SELECT DISTINCT payment_status, COUNT(*)
FROM bookings
GROUP BY payment_status;

-- Constraint allows: 'Verified', 'Completed', 'Paid'
-- If you see 'verified' (lowercase) or 'VERIFIED' (uppercase), constraint won't match

-- Check constraint definition
SELECT pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'payment_before_assignment';

-- Should be:
-- payment_status IN ('Verified', 'Completed', 'Paid')
```

**Solution**:

```sql
-- Option 1: Update constraint to be case-insensitive
ALTER TABLE bookings DROP CONSTRAINT payment_before_assignment;
ALTER TABLE bookings ADD CONSTRAINT payment_before_assignment CHECK (
    unit_assignment_status != 'assigned' OR UPPER(payment_status) IN ('VERIFIED', 'COMPLETED', 'PAID')
);

-- Option 2: Standardize existing data
UPDATE bookings SET payment_status = 'Verified' WHERE UPPER(payment_status) = 'VERIFIED';
UPDATE bookings SET payment_status = 'Completed' WHERE UPPER(payment_status) = 'COMPLETED';
UPDATE bookings SET payment_status = 'Paid' WHERE UPPER(payment_status) = 'PAID';
```

---

## Audit Trigger Errors

### Symptom: "Audit trigger does not fire"

**Cause**: Trigger condition not met or trigger not attached correctly.

**Debug**:

```sql
-- Check if trigger exists
SELECT
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE trigger_name = 'audit_bookings_trigger';

-- Check trigger definition
SELECT
    tgname AS trigger_name,
    tgrelid::regclass AS table_name,
    pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgname = 'audit_bookings_trigger';

-- Test manually
INSERT INTO bookings (
    booking_reference, guest_id, check_in_date, check_out_date,
    num_guests, total_amount,
    is_multi_unit, is_guest_booking,  -- BOTH must be TRUE
    booking_status
) VALUES (
    'TEST-AUDIT-MANUAL',
    (SELECT guest_id FROM guests LIMIT 1),
    '2026-01-01', '2026-01-03',
    2, 6000.00,
    TRUE, TRUE,  -- Trigger condition
    'Pending'
) RETURNING booking_id;

-- Check audit log
SELECT * FROM audit_logs WHERE table_name = 'bookings' ORDER BY created_at DESC LIMIT 5;
```

**Common Issues**:

1. **Trigger condition**: WHEN clause requires `is_multi_unit = TRUE` AND `is_guest_booking = TRUE`
2. **Wrong operation**: Trigger is `AFTER INSERT OR UPDATE` - deletes may not log if condition isn't met
3. **RLS blocking**: service_role needed to insert audit logs

**Solution**:

```sql
-- Recreate trigger without WHEN clause (logs everything)
DROP TRIGGER IF EXISTS audit_bookings_trigger ON bookings;
CREATE TRIGGER audit_bookings_trigger
    AFTER INSERT OR UPDATE OR DELETE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION audit_log_trigger();

-- Or fix condition to match your data
DROP TRIGGER IF EXISTS audit_bookings_trigger ON bookings;
CREATE TRIGGER audit_bookings_trigger
    AFTER INSERT OR UPDATE OR DELETE ON bookings
    FOR EACH ROW
    WHEN (
        (NEW.is_guest_booking IS TRUE AND NEW.is_multi_unit IS TRUE)
        OR
        (OLD.is_guest_booking IS TRUE AND OLD.is_multi_unit IS TRUE)
    )
    EXECUTE FUNCTION audit_log_trigger();
```

---

### Symptom: "audit_log_trigger function error: column does not exist"

**Cause**: Function assumes `booking_id` column exists on all tables, but table has different primary key.

**Solution**:

```sql
-- Make function generic (works with any primary key)
CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_action TEXT;
    v_changes JSONB;
    v_record_id UUID;
    v_pk_column TEXT;
BEGIN
    -- Dynamically find primary key column
    SELECT a.attname INTO v_pk_column
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = TG_RELID AND i.indisprimary
    LIMIT 1;

    IF TG_OP = 'INSERT' THEN
        v_action := 'created';
        EXECUTE format('SELECT $1.%I', v_pk_column) USING NEW INTO v_record_id;
        v_changes := jsonb_build_object('before', NULL, 'after', row_to_json(NEW)::JSONB);
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'updated';
        EXECUTE format('SELECT $1.%I', v_pk_column) USING NEW INTO v_record_id;
        v_changes := jsonb_build_object('before', row_to_json(OLD)::JSONB, 'after', row_to_json(NEW)::JSONB);
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'deleted';
        EXECUTE format('SELECT $1.%I', v_pk_column) USING OLD INTO v_record_id;
        v_changes := jsonb_build_object('before', row_to_json(OLD)::JSONB, 'after', NULL);
    END IF;

    INSERT INTO audit_logs (table_name, record_id, action, changes, user_id, created_at)
    VALUES (TG_TABLE_NAME, v_record_id, v_action, v_changes, (SELECT auth.uid()), NOW());

    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### Symptom: "Audit logs table is growing too large"

**Cause**: No retention policy or cleanup cron job.

**Solution**:

```sql
-- Add retention policy (keep 90 days for compliance)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM audit_logs
    WHERE created_at < NOW() - INTERVAL '90 days';

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- Schedule as cron job (weekly Sunday 4:00 AM UTC)
-- Configure in Supabase Dashboard → Database → Cron Jobs
-- Or using pg_cron extension:
-- SELECT cron.schedule('cleanup-audit-logs', '0 4 * * 0', 'SELECT cleanup_old_audit_logs()');

-- Manually run cleanup
SELECT cleanup_old_audit_logs();
```

**Monitoring**:

```sql
-- Check audit log size
SELECT
    pg_size_pretty(pg_total_relation_size('audit_logs')) AS total_size,
    COUNT(*) AS row_count,
    MIN(created_at) AS oldest_entry,
    MAX(created_at) AS newest_entry
FROM audit_logs;

-- Check growth rate (logs per day)
SELECT
    DATE(created_at) AS log_date,
    COUNT(*) AS logs_per_day,
    pg_size_pretty(SUM(octet_length(changes::TEXT))) AS data_per_day
FROM audit_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY log_date DESC;
```

---

## RLS Policy Issues

### Symptom: "Permission denied for table audit_logs"

**Cause**: RLS enabled but user doesn't have matching policy or using wrong role.

**Solution**:

```sql
-- Check which role you're using
SELECT current_user, session_user;

-- Check RLS status
SELECT
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE tablename = 'audit_logs';

-- Check policies
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'audit_logs';

-- Temporarily disable RLS for debugging (CAUTION: Development only!)
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;

-- Test query
SELECT COUNT(*) FROM audit_logs;

-- Re-enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- If testing as authenticated user, verify admin role
SELECT
    user_id,
    app_role,
    is_active
FROM app_roles
WHERE user_id = auth.uid();
-- Must have app_role = 'admin' and is_active = TRUE
```

**Fix for non-admin users**:

```sql
-- Grant admin role to test user
INSERT INTO app_roles (user_id, app_role, is_active)
VALUES (auth.uid(), 'admin', TRUE)
ON CONFLICT (user_id) DO UPDATE SET app_role = 'admin', is_active = TRUE;
```

**Fix for service_role**:

```sql
-- Verify service_role policy exists
CREATE POLICY IF NOT EXISTS audit_logs_service_all ON audit_logs
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON audit_logs TO service_role;
```

---

### Symptom: "RLS policies block trigger inserts"

**Cause**: Audit trigger runs as authenticated user who doesn't have INSERT permission.

**Solution**:

Trigger function should be `SECURITY DEFINER` (runs as function owner):

```sql
-- Verify function security
SELECT
    routine_name,
    security_type
FROM information_schema.routines
WHERE routine_name = 'audit_log_trigger';
-- Must be 'DEFINER' (not 'INVOKER')

-- Fix: Recreate function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS TRIGGER AS $$
-- ... function body ...
$$ LANGUAGE plpgsql SECURITY DEFINER;  -- ← Key flag

-- Test trigger
INSERT INTO bookings (...) VALUES (...);  -- Should succeed and create audit log
```

---

## Performance Problems

### Symptom: "Slow inserts into booking_units table"

**Cause**: EXCLUDE constraint checks entire table on every insert (GiST index scan).

**Expected Performance**:

- Single insert: 5-50ms (depends on table size)
- Batch insert (100 rows): 500ms-5s

**Optimization**:

```sql
-- 1. Verify GiST index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'booking_units'
  AND indexdef LIKE '%gist%';

-- 2. Analyze table statistics
ANALYZE booking_units;

-- 3. Check index bloat
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE tablename = 'booking_units';

-- 4. Reindex if bloated (>100MB)
REINDEX INDEX CONCURRENTLY <index-name>;

-- 5. Partition table if very large (>1M rows)
-- See PostgreSQL partitioning docs
```

**Benchmarking**:

```sql
-- Test insert performance
EXPLAIN (ANALYZE, BUFFERS)
INSERT INTO booking_units (booking_id, unit_id, check_in_date, check_out_date, status)
VALUES (gen_random_uuid(), '<unit-id>', '2026-01-01', '2026-01-05', 'confirmed');

-- Look for:
-- - "Index Scan using ... on booking_units" (good)
-- - "Seq Scan on booking_units" (bad - missing index)
-- - Execution Time: <50ms (good), >500ms (investigate)
```

---

### Symptom: "CHECK constraint causes slow updates"

**Cause**: Subqueries in all_or_nothing_assignment run on every UPDATE.

**Solution**:

```sql
-- Add partial index on bookings (only pending assignments)
CREATE INDEX IF NOT EXISTS idx_bookings_pending_assignment
    ON bookings(booking_id)
    WHERE unit_assignment_status = 'pending';

-- Add covering indexes for subqueries
CREATE INDEX IF NOT EXISTS idx_booking_units_booking_status
    ON booking_units(booking_id, status);

CREATE INDEX IF NOT EXISTS idx_guest_requests_booking
    ON guest_booking_unit_requests(booking_id);

-- Analyze tables
ANALYZE bookings;
ANALYZE booking_units;
ANALYZE guest_booking_unit_requests;

-- Test update performance
EXPLAIN (ANALYZE, BUFFERS)
UPDATE bookings
SET unit_assignment_status = 'assigned'
WHERE booking_id = '<test-id>';

-- Expected: <20ms for single booking
```

---

## Testing and Verification

### Symptom: "Test data cleanup leaves orphaned records"

**Cause**: Foreign keys with ON DELETE CASCADE not working or manual deletes incomplete.

**Solution**:

```sql
-- Check foreign key constraints
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc
    ON rc.constraint_name = tc.constraint_name
WHERE tc.table_name IN ('guest_booking_unit_requests', 'booking_units', 'audit_logs')
  AND tc.constraint_type = 'FOREIGN KEY';

-- delete_rule should be 'CASCADE'

-- Clean up all test data
DELETE FROM bookings WHERE booking_reference LIKE 'TEST-%';
DELETE FROM audit_logs WHERE table_name = 'bookings' AND (changes->'after'->>'booking_reference') LIKE 'TEST-%';

-- Verify no orphans
SELECT 'guest_booking_unit_requests' AS table_name, COUNT(*) AS orphan_count
FROM guest_booking_unit_requests gbur
LEFT JOIN bookings b ON b.booking_id = gbur.booking_id
WHERE b.booking_id IS NULL
UNION ALL
SELECT 'booking_units', COUNT(*)
FROM booking_units bu
LEFT JOIN bookings b ON b.booking_id = bu.booking_id
WHERE b.booking_id IS NULL;
-- Expected: 0 orphans
```

---

### Symptom: "Constraint tests pass when they should fail"

**Cause**: Test data doesn't meet constraint conditions or constraint is missing.

**Solution**:

```sql
-- Verify constraint exists and is active
SELECT
    conname,
    convalidated,  -- Should be TRUE
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname IN (
    'no_double_booking',
    'all_or_nothing_assignment',
    'payment_before_assignment'
);

-- If convalidated = FALSE, constraint exists but isn't enforced
-- Re-create constraint:
ALTER TABLE bookings DROP CONSTRAINT <constraint-name>;
ALTER TABLE bookings ADD CONSTRAINT <constraint-name> CHECK (...);

-- Test with known-bad data
-- Example: Assignment without payment
BEGIN;
    INSERT INTO bookings (..., payment_status, unit_assignment_status)
    VALUES (..., 'Pending', 'assigned');  -- Should FAIL
    RAISE EXCEPTION 'Constraint did not fire!';
EXCEPTION
    WHEN check_violation THEN
        RAISE NOTICE 'Constraint working correctly';
END;
```

---

## Still Stuck?

### Escalation Path

1. **Check PostgreSQL Logs**:
   - Supabase Dashboard → Logs → Postgres
   - Look for ERROR or WARNING messages during constraint/trigger creation

2. **Enable Verbose Logging**:

   ```sql
   SET client_min_messages TO DEBUG1;
   -- Run failing query
   -- Check output for detailed debug info
   ```

3. **Test in Isolation**:
   - Create test database with minimal schema
   - Add one constraint at a time
   - Identify exactly which step fails

4. **Search Common Errors**:
   - "exclusion violation" → EXCLUDE constraint working (expected in tests)
   - "check violation" → CHECK constraint working (expected in tests)
   - "permission denied" → RLS or GRANT issue
   - "function does not exist" → Trigger function creation failed

5. **Ask for Help** (provide these details):
   - Exact error message (full text)
   - PostgreSQL version: `SELECT version();`
   - Constraint definition: `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = '<name>';`
   - Which checkpoint test failed
   - Steps already tried from this guide

### Emergency Rollback

If chunk is completely broken and you need to start over:

```sql
-- ⚠️ DESTRUCTIVE: Only in development
BEGIN;

-- Drop audit system
DROP TRIGGER IF EXISTS audit_bookings_trigger ON bookings;
DROP TRIGGER IF EXISTS audit_booking_units_trigger ON booking_units;
DROP FUNCTION IF EXISTS audit_log_trigger();
DROP TABLE IF EXISTS audit_logs CASCADE;

-- Drop constraints
ALTER TABLE booking_units DROP CONSTRAINT IF EXISTS no_double_booking;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS all_or_nothing_assignment;
-- Keep payment_before_assignment (from Chunk 001)

COMMIT;

-- Restore from backup (see instructions.md Step 2)
```

---

**Remember**: Security constraints are critical for data integrity. Take time to understand errors before bypassing them. A working constraint that blocks bad data is success, not failure! 🔒
