# Phase 6: Troubleshooting Guide

## Overview

This document provides diagnostic procedures, common issues, solutions, and debugging techniques for the audit trail system.

---

## Common Issues and Solutions

### Database Issues

#### Problem: audit_logs table doesn't exist

**Symptoms:**

- Error: `relation "audit_logs" does not exist`
- Database queries fail

**Diagnosis:**

```sql
-- Check if table exists
SELECT tablename FROM pg_tables WHERE tablename = 'audit_logs';
```

**Solution:**
Run the migration script:

```bash
./migrate-audit-system.sh
```

Or manually create the table (see `01a-schema-and-tables.md`).

---

#### Problem: Triggers not firing (no audit logs created)

**Symptoms:**

- Manual database changes not logged
- Trigger functions missing

**Diagnosis:**

```sql
-- Check if triggers exist
SELECT tgname, tgrelid::regclass
FROM pg_trigger
WHERE tgname LIKE '%audit%';

-- Check if trigger function exists
SELECT proname FROM pg_proc WHERE proname = 'audit_trigger_func';
```

**Solution:**

```sql
-- Create trigger function (see 01b-triggers-and-functions.md)
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
-- ... (see full implementation in 01b)
$$ LANGUAGE plpgsql;

-- Attach trigger to bookings table (example)
CREATE TRIGGER bookings_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON bookings
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
```

---

#### Problem: Slow audit log queries

**Symptoms:**

- Queries take > 500ms
- UI feels sluggish

**Diagnosis:**

```sql
-- Check if indexes exist
SELECT indexname FROM pg_indexes WHERE tablename = 'audit_logs';

-- Test query performance
EXPLAIN ANALYZE
SELECT * FROM audit_logs
WHERE table_name = 'bookings'
ORDER BY created_at DESC
LIMIT 50;
```

Look for "Seq Scan" (bad) vs "Index Scan" (good).

**Solution:**

```sql
-- Create missing indexes (see 01c-indexes-and-performance.md)
CREATE INDEX idx_audit_logs_timestamp ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_table_name ON audit_logs (table_name);
-- ... (see full list in 01c)

-- Rebuild existing indexes
REINDEX TABLE audit_logs;
ANALYZE audit_logs;
```

---

### Access Control Issues

#### Problem: Owner can't see any audit logs

**Symptoms:**

- Audit logs page shows "No logs found"
- Owner should see all logs but doesn't

**Diagnosis:**

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'audit_logs';

-- Check owner emails configuration
SHOW app.owner_emails;

-- Check current user email
SELECT auth.email();
```

**Solution:**

```sql
-- Set owner emails
ALTER DATABASE postgres SET app.owner_emails = 'owner@resort.com,admin@resort.com';
SELECT pg_reload_conf();

-- Verify policy exists
SELECT policyname FROM pg_policies WHERE tablename = 'audit_logs';

-- If policy missing, create it (see 04-security-policies.md)
CREATE POLICY "audit_logs_select_policy" ON audit_logs FOR SELECT USING (...);
```

---

#### Problem: "Unauthorized" error even as owner

**Symptoms:**

- Redirected from /audit-logs page
- Access denied message

**Diagnosis:**

```typescript
// Check in browser console
console.log("Owner emails:", import.meta.env.VITE_OWNER_EMAILS);
console.log("Current user:", await getCurrentUserContext());
```

**Solution:**

1. **Environment variable not set**:

   ```bash
   # .env.local
   VITE_OWNER_EMAILS="owner@resort.com,admin@resort.com"

   # Restart dev server
   npm run dev
   ```

2. **Email mismatch**:
   - Ensure logged-in email matches owner email exactly
   - Check for typos or extra spaces

3. **Database config not synced**:
   ```sql
   -- Sync database config with environment
   ALTER DATABASE postgres SET app.owner_emails = 'owner@resort.com';
   SELECT pg_reload_conf();
   ```

---

### Application Layer Issues

#### Problem: Audit logs not being created from application

**Symptoms:**

- Database triggers work (manual SQL changes logged)
- Application actions NOT logged (bookings, payments)

**Diagnosis:**

```typescript
// Enable debug logging in .env.local
VITE_AUDIT_DEBUG = true;

// Check browser console for audit messages
// Look for: [AUDIT DEBUG] Audit log created
```

**Solution:**

1. **Check if logAuditEvent is called**:

   ```typescript
   // Add to action handlers
   console.log('About to log audit event...');
   const result = await logAuditEvent({...});
   console.log('Log result:', result);
   ```

2. **User not authenticated**:

   ```typescript
   // Verify user is logged in
   const {
     data: { user },
   } = await supabase.auth.getUser();
   console.log("Current user:", user?.email);
   ```

3. **Import errors**:
   ```typescript
   // Verify imports are correct
   import { logAuditEvent } from "@/lib/audit-logger"; // ✅ Correct
   import { logAuditEvent } from "./audit-logger"; // ❌ Wrong path
   ```

---

#### Problem: Sensitive data appearing in audit logs

**Symptoms:**

- Phone numbers, emails visible in logs
- PII not redacted

**Diagnosis:**

```typescript
// Check if field is in SENSITIVE_FIELDS
import { isSensitiveField } from "@/lib/audit-constants";
console.log("Is guest_phone sensitive?", isSensitiveField("guests", "guest_phone"));
```

**Solution:**
Add missing fields to `SENSITIVE_FIELDS`:

```typescript
// src/lib/audit-constants.ts
export const SENSITIVE_FIELDS: Record<string, string[]> = {
  guests: [
    "guest_phone",
    "guest_email",
    "guest_address",
    "new_sensitive_field", // Add missing field here
  ],
};
```

---

### UI Issues

#### Problem: Audit logs table not loading

**Symptoms:**

- Infinite spinner
- "Loading..." never completes

**Diagnosis:**

```typescript
// Check React Query DevTools (install if needed)
npm install @tanstack/react-query-devtools

// Add to main app component
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
<ReactQueryDevtools initialIsOpen={false} />
```

Look for failed queries in DevTools.

**Solution:**

1. **Network error**:
   - Check browser Network tab
   - Verify Supabase connection
   - Check CORS settings

2. **Query key mismatch**:

   ```typescript
   // Ensure query keys match in hooks and store
   const { data } = useAuditLogs(filters); // Uses auditKeys.list(filters)
   ```

3. **RLS blocking query**:
   - User may not have access to audit logs
   - Check RLS policies (see Access Control Issues)

---

#### Problem: Filters not working

**Symptoms:**

- Changing filters doesn't update table
- All logs shown regardless of filters

**Diagnosis:**

```typescript
// Check if filters update triggers re-render
const filters = useAuditStore((state) => state.filters);
console.log("Current filters:", filters);

// Check if query receives filters
const { data } = useAuditLogs(filters);
console.log("Query filters:", filters);
```

**Solution:**

1. **Store not persisting**:

   ```typescript
   // Check localStorage
   console.log("Stored state:", localStorage.getItem("audit-store"));
   ```

2. **Filter not resetting pagination**:
   ```typescript
   // Ensure offset resets when filters change
   setFilters({
     ...filters,
     tableName: newTable,
     offset: 0, // Must reset to 0
   });
   ```

---

#### Problem: Diff viewer shows "No data changes"

**Symptoms:**

- Click "View" button shows no changes
- old_data and new_data are null

**Diagnosis:**

```typescript
// Check if log has data
console.log("old_data:", log.old_data);
console.log("new_data:", log.new_data);
console.log("changed_fields:", log.changed_fields);
```

**Solution:**
This is **expected behavior** for Layer 2 logs (application-level). Only database triggers capture old_data/new_data.

**Workaround**: Manually include old/new data when logging:

```typescript
await logAuditEvent({
  tableName: "bookings",
  action: "UPDATE",
  description: "Booking cancelled",
  category: AuditCategory.BOOKING,
  oldData: { booking_status: "Confirmed" }, // Add this
  newData: { booking_status: "Cancelled" }, // Add this
});
```

---

### Migration Issues

#### Problem: Migration script fails

**Symptoms:**

- `migrate-audit-system.sh` exits with error
- Tables not created

**Diagnosis:**

```bash
# Run migration with verbose output
bash -x ./migrate-audit-system.sh
```

**Solution:**

1. **Database connection error**:

   ```bash
   # Check connection string
   echo $SUPABASE_DB_URL
   # Or use Supabase CLI
   supabase db remote set <connection-string>
   ```

2. **Permission denied**:

   ```bash
   # Make script executable
   chmod +x migrate-audit-system.sh
   ```

3. **SQL syntax error**:
   - Run SQL manually in Supabase SQL Editor
   - Check for copy-paste errors
   - Verify PostgreSQL version compatibility

---

#### Problem: Rollback script fails

**Symptoms:**

- `rollback-audit-system.sh` can't restore backup
- Backup file not found

**Diagnosis:**

```bash
# Check if backup exists
ls -lh audit_logs_backup_*.sql

# Check backup file integrity
head -n 20 audit_logs_backup_20240115.sql
```

**Solution:**

1. **Backup file missing**:
   - Create manual backup before rollback
   - Use Supabase dashboard: Database → Backups

2. **Backup corrupted**:
   ```bash
   # Verify SQL syntax
   psql $SUPABASE_DB_URL -f audit_logs_backup_20240115.sql --dry-run
   ```

---

## Diagnostic SQL Queries

### Health Check Queries

```sql
-- Overall system health
SELECT
  (SELECT COUNT(*) FROM audit_logs) AS total_logs,
  (SELECT COUNT(*) FROM pg_trigger WHERE tgname LIKE '%audit%') AS triggers_count,
  (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'audit_logs') AS indexes_count,
  (SELECT pg_size_pretty(pg_total_relation_size('audit_logs'))) AS total_size;

-- Recent activity (last 24 hours)
SELECT
  table_name,
  action,
  COUNT(*) AS count
FROM audit_logs
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY table_name, action
ORDER BY count DESC;

-- Top users (last 7 days)
SELECT
  user_email,
  COUNT(*) AS actions
FROM audit_logs
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY user_email
ORDER BY actions DESC
LIMIT 10;
```

### Performance Queries

```sql
-- Slow queries (if pg_stat_statements enabled)
SELECT
  query,
  calls,
  mean_exec_time,
  total_exec_time
FROM pg_stat_statements
WHERE query LIKE '%audit_logs%'
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Index usage statistics
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan AS scans,
  idx_tup_read AS tuples_read
FROM pg_stat_user_indexes
WHERE tablename = 'audit_logs'
ORDER BY idx_scan DESC;

-- Table bloat check
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) -
                 pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE tablename = 'audit_logs';
```

### Data Integrity Queries

```sql
-- Check for orphaned audit logs (record_id doesn't exist)
SELECT al.audit_id, al.table_name, al.record_id
FROM audit_logs al
WHERE al.record_id IS NOT NULL
  AND al.table_name = 'bookings'
  AND NOT EXISTS (
    SELECT 1 FROM bookings b WHERE b.booking_id = al.record_id
  )
LIMIT 10;

-- Check for missing user context
SELECT COUNT(*) AS logs_without_user
FROM audit_logs
WHERE user_id IS NULL AND user_email IS NULL;

-- Check for logs with redacted data
SELECT COUNT(*) AS redacted_logs
FROM audit_logs
WHERE old_data::text LIKE '%[REDACTED]%'
   OR new_data::text LIKE '%[REDACTED]%';
```

---

## Debugging Procedures

### Enable Debug Logging

```bash
# .env.local
VITE_AUDIT_DEBUG=true

# Restart dev server
npm run dev
```

Check browser console for `[AUDIT DEBUG]` messages.

### React Query DevTools

```typescript
// src/main.tsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

function App() {
  return (
    <>
      {/* Your app */}
      <ReactQueryDevtools initialIsOpen={false} />
    </>
  );
}
```

Access DevTools in browser (bottom-right icon).

### Zustand DevTools

Zustand already uses Redux DevTools middleware:

```typescript
// Open Redux DevTools in browser
// Chrome: F12 → Redux tab
// Look for "audit-store" actions
```

### Database Query Logging

```sql
-- Enable query logging (temporarily)
ALTER DATABASE postgres SET log_statement = 'all';
ALTER DATABASE postgres SET log_duration = on;

-- Check logs
SELECT * FROM pg_stat_statements WHERE query LIKE '%audit_logs%';

-- Disable after debugging
ALTER DATABASE postgres RESET log_statement;
ALTER DATABASE postgres RESET log_duration;
```

---

## Performance Troubleshooting

### Problem: Queries taking > 1 second

**Solution:**

```sql
-- Rebuild indexes
REINDEX TABLE audit_logs;

-- Update statistics
ANALYZE audit_logs;

-- Vacuum full (during low traffic)
VACUUM FULL audit_logs;
```

### Problem: Database size growing too fast

**Diagnosis:**

```sql
-- Check table size growth
SELECT
  date_trunc('day', timestamp) AS day,
  COUNT(*) AS logs_per_day,
  pg_size_pretty(COUNT(*) * 2500) AS estimated_size
FROM audit_logs
GROUP BY day
ORDER BY day DESC
LIMIT 30;
```

**Solution:**

- Run manual archival more frequently
- Reduce retention period (e.g., 1 year instead of 2)
- Consider external log storage for long-term retention

---

## FAQ

### Q: Do I need to log every database change?

**A:** No. Use Layer 2 (application) logging selectively for critical operations. Database triggers (Layer 1) automatically capture all changes as a safety net.

---

### Q: Can I disable audit logging temporarily?

**A:** Yes, for maintenance:

```sql
-- Disable triggers temporarily
ALTER TABLE bookings DISABLE TRIGGER bookings_audit_trigger;

-- Perform maintenance...

-- Re-enable triggers
ALTER TABLE bookings ENABLE TRIGGER bookings_audit_trigger;
```

---

### Q: How do I export logs for external analysis?

**A:** Use CSV export in UI or SQL:

```sql
-- Export to CSV
COPY (
  SELECT * FROM audit_logs
  WHERE created_at >= '2024-01-01'
) TO '/tmp/audit_logs_2024.csv' CSV HEADER;
```

---

### Q: Can I restore deleted records from audit logs?

**A:** Partially. `old_data` contains the record state before deletion, but restoring requires manual reconstruction:

```sql
-- Find deleted booking
SELECT old_data FROM audit_logs
WHERE table_name = 'bookings'
  AND action = 'DELETE'
  AND record_id = '123e4567-...';

-- Manually reconstruct record from old_data
```

---

### Q: What if I accidentally delete all audit logs?

**A:** Restore from backup:

```bash
# Using rollback script
./rollback-audit-system.sh

# Or manually
psql $SUPABASE_DB_URL -f audit_logs_backup_20240115.sql
```

---

### Q: How do I add audit logging to a new table?

**A:** Attach the trigger:

```sql
-- Add trigger to new table
CREATE TRIGGER new_table_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON new_table
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Add table to AUDITED_TABLES constant
// src/lib/audit-constants.ts
export const AUDITED_TABLES = [
  'units', 'guests', 'bookings', 'payments', 'expenses', 'maintenance_logs',
  'new_table'  // Add here
] as const;
```

---

## Getting Help

If you encounter issues not covered here:

1. **Check database logs** - Supabase Dashboard → Logs
2. **Check browser console** - Look for errors and warnings
3. **Enable debug mode** - See audit debug messages
4. **Review migration logs** - Check if migration completed successfully
5. **Verify RLS policies** - Ensure access control is configured correctly

---

**Troubleshooting Checklist:**

- [ ] Database health check queries run successfully
- [ ] All indexes exist and being used
- [ ] RLS policies configured correctly
- [ ] Owner emails set in environment and database
- [ ] Triggers attached to all tables
- [ ] Debug logging enabled for testing
- [ ] Performance benchmarks meet expectations
- [ ] Backup and rollback procedures tested
