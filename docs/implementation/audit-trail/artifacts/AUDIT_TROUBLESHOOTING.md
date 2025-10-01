# 🆘 Audit System Troubleshooting Guide

**Version:** 1.0.0  
**Last Updated:** October 1, 2025

---

## 📋 Quick Diagnostics

### Health Check SQL

Run this query to verify audit system health:

```sql
-- Audit System Health Check
SELECT
    'Audit System Health Check' as check_name,
    NOW() as check_time;

-- 1. Check if audit_logs table exists
SELECT
    'audit_logs table exists' as check,
    EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'audit_logs'
    ) as status;

-- 2. Check if triggers are enabled
SELECT
    'Total active triggers' as check,
    COUNT(*) as status
FROM information_schema.triggers
WHERE trigger_name LIKE 'audit_%';

-- 3. Check recent audit log activity
SELECT
    'Logs in last 24 hours' as check,
    COUNT(*) as status
FROM audit_logs
WHERE created_at > NOW() - INTERVAL '24 hours';

-- 4. Check if RLS is enabled
SELECT
    'RLS enabled on audit_logs' as check,
    rowsecurity as status
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'audit_logs';

-- 5. Check index health
SELECT
    'Total indexes on audit_logs' as check,
    COUNT(*) as status
FROM pg_indexes
WHERE tablename = 'audit_logs';

-- 6. Check storage size
SELECT
    'audit_logs storage size' as check,
    pg_size_pretty(pg_total_relation_size('audit_logs')) as status;
```

---

## 🔧 Common Issues & Solutions

### Issue 1: Audit Logs Not Being Created

**Symptoms:**

- No audit logs appearing after database operations
- Empty audit_logs table

**Diagnostic Steps:**

```sql
-- Check if triggers exist
SELECT
    trigger_name,
    event_object_table,
    action_timing,
    event_manipulation
FROM information_schema.triggers
WHERE trigger_name LIKE 'audit_%'
ORDER BY event_object_table;

-- Should return at least 6 triggers (one per table)
```

**Solutions:**

1. **Verify triggers are attached:**

   ```sql
   -- Re-attach triggers
   SELECT attach_audit_trigger('bookings');
   SELECT attach_audit_trigger('units');
   SELECT attach_audit_trigger('guests');
   SELECT attach_audit_trigger('payments');
   SELECT attach_audit_trigger('expenses');
   SELECT attach_audit_trigger('maintenance_logs');
   ```

2. **Check trigger function exists:**

   ```sql
   SELECT routine_name
   FROM information_schema.routines
   WHERE routine_name = 'audit_trigger_func';

   -- If not found, re-run migration 002
   ```

3. **Test trigger manually:**

   ```sql
   -- Insert test record
   INSERT INTO units (unit_name, unit_code, unit_type, base_occupancy, max_occupancy, base_rate, weekend_rate, extra_person_rate)
   VALUES ('Test Unit', 'TEST99', 'Studio', 2, 2, 1000, 1200, 300);

   -- Check if audit log was created
   SELECT * FROM audit_logs
   WHERE table_name = 'units'
   ORDER BY created_at DESC
   LIMIT 1;

   -- Clean up
   DELETE FROM units WHERE unit_code = 'TEST99';
   ```

---

### Issue 2: User Context Not Captured

**Symptoms:**

- `user_id` and `user_email` are NULL in audit logs
- All logs show "System" as the user

**Diagnostic Steps:**

```sql
-- Check current auth context
SELECT auth.uid() as user_id, auth.email() as user_email;

-- Check recent logs with missing user context
SELECT
    audit_id,
    table_name,
    action,
    user_id,
    user_email,
    created_at
FROM audit_logs
WHERE user_id IS NULL
ORDER BY created_at DESC
LIMIT 10;
```

**Solutions:**

1. **Verify Supabase Auth is configured:**
   - Check that user is logged in
   - Verify JWT token is being sent with requests

2. **Test auth context from application:**

   ```typescript
   // In your React component
   const {
     data: { session },
   } = await supabase.auth.getSession();
   console.log("User ID:", session?.user?.id);
   console.log("Email:", session?.user?.email);
   ```

3. **Check RLS policies aren't blocking context:**

   ```sql
   -- Temporarily disable RLS for testing
   ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;

   -- Perform an operation
   -- Check if user context is captured

   -- Re-enable RLS
   ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
   ```

---

### Issue 3: RLS Blocking Access to Audit Logs

**Symptoms:**

- Audit logs page shows "No audit logs found"
- Query returns 0 results even though logs exist
- Access denied errors

**Diagnostic Steps:**

```sql
-- Check your current role
SELECT get_user_role();

-- Check RLS policies
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'audit_logs';

-- Count total logs (bypass RLS as superuser)
SELECT COUNT(*) FROM audit_logs;
```

**Solutions:**

1. **Verify user role is set correctly:**

   ```sql
   -- Check JWT claims
   SELECT current_setting('request.jwt.claims', TRUE);

   -- Should include: {"role": "owner"} or similar
   ```

2. **Test with different roles:**

   ```sql
   -- Test as owner
   SET request.jwt.claims = '{"role": "owner"}';
   SELECT COUNT(*) FROM audit_logs;

   -- Test as manager
   SET request.jwt.claims = '{"role": "manager"}';
   SELECT COUNT(*) FROM audit_logs;

   -- Reset
   RESET request.jwt.claims;
   ```

3. **Fix role assignment in application:**
   ```typescript
   // Ensure user_metadata includes role
   const { data: user } = await supabase.auth.getUser();
   console.log("User role:", user?.user_metadata?.role);
   ```

---

### Issue 4: Poor Query Performance

**Symptoms:**

- Audit logs page loads slowly (>2 seconds)
- Database queries timing out
- High CPU usage on database

**Diagnostic Steps:**

```sql
-- Check query performance
EXPLAIN ANALYZE
SELECT * FROM audit_logs
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 50;

-- Check index usage
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as times_used,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE tablename = 'audit_logs'
ORDER BY idx_scan DESC;

-- Check table bloat
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    ROUND(100 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) as dead_percentage
FROM pg_stat_user_tables
WHERE tablename = 'audit_logs';
```

**Solutions:**

1. **Rebuild indexes:**

   ```sql
   REINDEX TABLE audit_logs;
   ANALYZE audit_logs;
   ```

2. **Vacuum table:**

   ```sql
   VACUUM ANALYZE audit_logs;
   ```

3. **Archive old logs:**

   ```sql
   SELECT * FROM archive_old_audit_logs(30);
   ```

4. **Check missing indexes:**
   ```sql
   -- Re-run migration 003 to ensure all indexes exist
   \i database/migrations/audit-system/003-audit-indexes.sql
   ```

---

### Issue 5: Application Audit Logs Not Working

**Symptoms:**

- Database triggers work, but `logAuditEvent()` calls fail
- No application-level context in audit logs
- TypeScript errors when calling audit functions

**Diagnostic Steps:**

```typescript
// Test audit logger directly
import { logAuditEvent } from "@/lib/audit/logger";
import { AuditAction } from "@/lib/audit/types";

try {
  const auditId = await logAuditEvent({
    action: AuditAction.SYSTEM_CONFIG_CHANGE,
    description: "Test audit log",
  });
  console.log("Audit log created:", auditId);
} catch (error) {
  console.error("Failed to create audit log:", error);
}
```

**Solutions:**

1. **Check Supabase client connection:**

   ```typescript
   import { supabase } from "@/lib/supabase";

   const { data, error } = await supabase.from("audit_logs").select("count");

   console.log("Connection test:", { data, error });
   ```

2. **Verify types are up to date:**

   ```bash
   # Regenerate Supabase types
   npx supabase gen types typescript --local > database.types.ts
   ```

3. **Check for TypeScript errors:**

   ```bash
   npm run type-check
   ```

4. **Review error logs:**
   - Check browser console for errors
   - Check Supabase logs for API errors

---

### Issue 6: Retention Policy Not Running

**Symptoms:**

- Old logs not being archived
- audit_logs table growing too large
- Archive table is empty

**Diagnostic Steps:**

```sql
-- Check if archive table exists
SELECT COUNT(*) FROM audit_logs_archive;

-- Check age of oldest logs
SELECT
    'Main Table' as location,
    MIN(created_at) as oldest_log,
    MAX(created_at) as newest_log,
    COUNT(*) as total_logs
FROM audit_logs
UNION ALL
SELECT
    'Archive' as location,
    MIN(created_at) as oldest_log,
    MAX(created_at) as newest_log,
    COUNT(*) as total_logs
FROM audit_logs_archive;
```

**Solutions:**

1. **Manually run archival:**

   ```sql
   SELECT * FROM archive_old_audit_logs(30);
   ```

2. **Set up cron job (if not already configured):**

   ```bash
   # Add to crontab
   0 2 * * * psql -h your-host -U postgres -d your-db -c "SELECT archive_old_audit_logs(30);"
   ```

3. **Use Supabase Edge Functions for scheduling:**
   ```typescript
   // Create edge function for periodic archival
   // Deploy with: supabase functions deploy audit-archival
   ```

---

### Issue 7: Anomaly Detection Not Working

**Symptoms:**

- No alerts being generated
- Security events not detected
- Suspicious activity going unnoticed

**Diagnostic Steps:**

```typescript
// Test anomaly detection manually
import { detectAnomalies } from "@/lib/audit/monitoring";

const alerts = await detectAnomalies();
console.log("Found alerts:", alerts);
```

**Solutions:**

1. **Verify thresholds are reasonable:**

   ```typescript
   // Check if thresholds are too high
   const ANOMALY_THRESHOLDS = {
     MAX_FAILED_LOGINS_PER_HOUR: 5, // Try lowering this
     MAX_CHANGES_PER_HOUR: 100,
   };
   ```

2. **Test with deliberate anomaly:**

   ```typescript
   // Create multiple failed login attempts
   for (let i = 0; i < 6; i++) {
     await logAuthEvent(AuditAction.AUTH_LOGIN_FAILED, "Failed login attempt", { attempt: i });
   }

   // Run detection
   const alerts = await detectAnomalies();
   console.log("Should detect failed logins:", alerts);
   ```

3. **Set up monitoring cron job:**
   ```bash
   # Run monitoring every 15 minutes
   */15 * * * * node -e "require('./dist/monitoring.js').runMonitoring()"
   ```

---

## 🔍 Debugging Tools

### Enable Debug Logging

```typescript
// src/lib/audit/logger.ts

// Add at the top of file
const DEBUG = process.env.NODE_ENV === "development";

function debugLog(message: string, data?: unknown) {
  if (DEBUG) {
    console.log(`[AUDIT DEBUG] ${message}`, data);
  }
}

// Use throughout logger.ts
debugLog("Creating audit log", context);
debugLog("User context", userContext);
debugLog("Audit log created", data);
```

### SQL Query Profiler

```sql
-- Enable query timing
\timing on

-- Explain query plan
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT * FROM audit_logs
WHERE table_name = 'bookings'
AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 50;
```

### React Query DevTools

```typescript
// Add to App.tsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

export function App() {
  return (
    <>
      {/* Your app */}
      <ReactQueryDevtools initialIsOpen={false} />
    </>
  );
}
```

---

## 📊 Monitoring Queries

### Daily Audit Summary

```sql
SELECT
    DATE(created_at) as date,
    table_name,
    action,
    COUNT(*) as change_count
FROM audit_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at), table_name, action
ORDER BY date DESC, change_count DESC;
```

### User Activity Report

```sql
SELECT
    user_email,
    COUNT(*) as total_actions,
    COUNT(DISTINCT table_name) as tables_modified,
    MIN(created_at) as first_action,
    MAX(created_at) as last_action
FROM audit_logs
WHERE created_at > NOW() - INTERVAL '30 days'
    AND user_email IS NOT NULL
GROUP BY user_email
ORDER BY total_actions DESC;
```

### Most Modified Records

```sql
SELECT
    table_name,
    record_id,
    COUNT(*) as modification_count,
    MIN(created_at) as first_modified,
    MAX(created_at) as last_modified
FROM audit_logs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY table_name, record_id
HAVING COUNT(*) > 5
ORDER BY modification_count DESC
LIMIT 20;
```

---

## 🚨 Emergency Procedures

### Disable Audit System (Emergency)

```sql
-- Disable all audit triggers
SELECT detach_audit_trigger('bookings');
SELECT detach_audit_trigger('units');
SELECT detach_audit_trigger('guests');
SELECT detach_audit_trigger('payments');
SELECT detach_audit_trigger('expenses');
SELECT detach_audit_trigger('maintenance_logs');

-- Disable RLS (if blocking operations)
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
```

### Re-enable Audit System

```sql
-- Re-enable triggers
SELECT attach_audit_trigger('bookings');
SELECT attach_audit_trigger('units');
SELECT attach_audit_trigger('guests');
SELECT attach_audit_trigger('payments');
SELECT attach_audit_trigger('expenses');
SELECT attach_audit_trigger('maintenance_logs');

-- Re-enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Verify
SELECT * FROM information_schema.triggers WHERE trigger_name LIKE 'audit_%';
```

### Restore from Backup

```bash
# Backup audit_logs table
pg_dump -h your-host -U postgres -d your-db -t audit_logs > audit_logs_backup.sql

# Restore if needed
psql -h your-host -U postgres -d your-db < audit_logs_backup.sql
```

---

## 📞 Getting Help

### Information to Gather

When reporting issues, include:

1. **Error messages** (full text)
2. **Database version:** `SELECT version();`
3. **Audit logs count:** `SELECT COUNT(*) FROM audit_logs;`
4. **Recent logs:** `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 5;`
5. **Trigger status:** Check if triggers are enabled
6. **Browser console errors** (if UI issue)

### Useful Commands

```bash
# Check TypeScript compilation
npm run type-check

# Run tests
npm run test

# Check database connection
psql -h your-host -U postgres -d your-db -c "SELECT 1"

# View Supabase logs
supabase logs --project-ref your-project-ref
```

---

## ✅ System Verification Checklist

Run through this checklist to verify system health:

- [ ] All migrations applied successfully
- [ ] All triggers exist and are enabled
- [ ] Audit logs being created for database operations
- [ ] User context being captured correctly
- [ ] RLS policies working as expected
- [ ] Query performance acceptable (<100ms)
- [ ] Application audit logging working
- [ ] Retention policies configured
- [ ] Monitoring/alerting functional
- [ ] No error logs in last 24 hours

---

## 📚 Additional Resources

- [Phase 1: Database Foundation](./AUDIT_PHASE_1_DATABASE.md)
- [Phase 2: Application Layer](./AUDIT_PHASE_2_APPLICATION.md)
- [Phase 3: UI & Visualization](./AUDIT_PHASE_3_UI.md)
- [Phase 4: Security & Optimization](./AUDIT_PHASE_4_SECURITY.md)
- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Trigger Documentation](https://www.postgresql.org/docs/current/sql-createtrigger.html)

---

_This guide covers the most common issues. If you encounter a problem not listed here, please document it and update this guide._
