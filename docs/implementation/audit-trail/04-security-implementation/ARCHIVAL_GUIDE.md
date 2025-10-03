# Audit Trail Archival Guide

## Purpose

This guide documents the manual archival process for audit logs to maintain system performance and manage storage costs while preserving audit trail integrity for a 3-room resort operation.

## Storage Estimates

### Monthly Activity (Conservative)

- 50 bookings × 3 changes = 150 audit logs
- 30 expenses × 2 changes = 60 audit logs
- 10 unit updates = 10 audit logs
- 500 auth events = 500 audit logs
- **Total**: ~720 audit logs/month

### Storage Calculation

- Average audit log size: 3KB (with JSONB old_data + new_data)
- Monthly storage: 720 × 3KB = 2.16MB/month
- Annual storage: 2.16MB × 12 = ~26MB/year
- **Verdict**: Safe within Supabase 500MB free tier for 19+ years ✅

## Archival Strategy

### Why Manual Archival?

- **No scheduled jobs**: Cloudflare Workers (serverless) don't support cron jobs well
- **Low volume**: 3-room resort generates ~10K logs/year (manageable)
- **Owner control**: Resort owners decide when/what to archive
- **Cost-effective**: No additional infrastructure required

### Recommended Schedule

| Quarter | Archival Date | Delete Logs Before | Action                            |
| ------- | ------------- | ------------------ | --------------------------------- |
| Q1      | January 15    | 2 years ago        | Archive old logs, vacuum database |
| Q2      | April 15      | 2 years ago        | Archive old logs, vacuum database |
| Q3      | July 15       | 2 years ago        | Archive old logs, vacuum database |
| Q4      | October 15    | 2 years ago        | Archive old logs, vacuum database |

## Step-by-Step Archival Process

### Prerequisites

- Admin or Owner role in app_roles table
- Supabase CLI installed
- Database access credentials

### 1. Backup Before Archival (Required)

```bash
# Using Supabase CLI
supabase db dump -f audit_logs_backup_$(date +%Y%m%d).sql \
  --table audit_logs

# Or via Supabase Dashboard:
# Database → Backups → Create Manual Backup
```

**Store backup file safely!** This is your insurance policy.

### 2. Check Log Volume

```sql
-- Check total number of logs
SELECT COUNT(*) as total_logs,
       MIN(created_at) as oldest_log,
       MAX(created_at) as newest_log
FROM audit_logs;

-- Check how many logs will be archived (older than 2 years)
SELECT COUNT(*) as logs_to_archive
FROM audit_logs
WHERE created_at < NOW() - INTERVAL '2 years';

-- Size estimate
SELECT
  COUNT(*) as log_count,
  pg_size_pretty(pg_total_relation_size('audit_logs')) as table_size
FROM audit_logs;
```

### 3. Archive to audit_logs_archive Table

```sql
-- Move old logs to archive table (preserves data)
INSERT INTO audit_logs_archive
SELECT * FROM audit_logs
WHERE created_at < NOW() - INTERVAL '2 years';

-- Verify archive success
SELECT COUNT(*) FROM audit_logs_archive
WHERE created_at >= NOW() - INTERVAL '2 years 1 day'
  AND created_at < NOW() - INTERVAL '2 years';
```

### 4. Delete Archived Logs

```sql
-- Delete archived logs from main table
DELETE FROM audit_logs
WHERE created_at < NOW() - INTERVAL '2 years';

-- Verify deletion
SELECT COUNT(*) as remaining_logs
FROM audit_logs;
```

### 5. Vacuum and Optimize

```sql
-- Reclaim disk space (may take a few minutes)
VACUUM FULL audit_logs;

-- Rebuild indexes for optimal performance
REINDEX TABLE audit_logs;

-- Update table statistics
ANALYZE audit_logs;
```

### 6. Verify System Health

```sql
-- Check indexes are working
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'audit_logs';

-- Test query performance
EXPLAIN ANALYZE
SELECT * FROM audit_logs
WHERE created_at >= NOW() - INTERVAL '1 month'
ORDER BY created_at DESC
LIMIT 50;
```

## Alternative: Using TypeScript Helper

```typescript
// Use the archiveOld helper from your application
import { db } from "@/lib/supabase";

async function performArchival() {
  // Archive logs older than 2 years
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  // Move to archive table
  const { data: archived, error: archiveError } = await supabase.rpc("archive_audit_logs", {
    before_date: twoYearsAgo.toISOString(),
  });

  if (archiveError) {
    console.error("Archive failed:", archiveError);
    return;
  }

  console.log(`Archived ${archived} audit logs`);
}
```

## Monitoring and Alerts

### Storage Growth Indicators

Watch for these signs that archival is needed:

1. **Query performance degradation** - Audit page loads slowly
2. **Storage warnings** - Supabase dashboard shows high usage
3. **Time-based trigger** - Quarterly schedule reached

### Quick Health Check Query

```sql
-- Audit system health check
SELECT
  'Total Logs' as metric,
  COUNT(*)::text as value
FROM audit_logs
UNION ALL
SELECT
  'Logs This Month',
  COUNT(*)::text
FROM audit_logs
WHERE created_at >= DATE_TRUNC('month', NOW())
UNION ALL
SELECT
  'Archive Candidates (>2yr)',
  COUNT(*)::text
FROM audit_logs
WHERE created_at < NOW() - INTERVAL '2 years'
UNION ALL
SELECT
  'Table Size',
  pg_size_pretty(pg_total_relation_size('audit_logs'))
FROM audit_logs
LIMIT 1;
```

## Emergency Procedures

### If Archival Fails

1. **Stop immediately** - Don't force operations
2. **Check backup** - Ensure backup file exists
3. **Review error** - Check PostgreSQL logs
4. **Contact support** if needed

### Rollback Process

```bash
# If something goes wrong, restore from backup
psql -d your_database -f audit_logs_backup_YYYYMMDD.sql
```

## Best Practices

### DO ✅

- Always backup before archival
- Archive during low-traffic periods
- Verify data in archive table before deletion
- Keep archival logs for compliance
- Document each archival operation

### DON'T ❌

- Skip the backup step
- Archive logs less than 1 year old
- Delete without verifying archive
- Run during peak business hours
- Ignore error messages

## Retention Policy

### Recommended Retention Periods

- **Active audit_logs table**: 2 years
- **Archive table**: 5-7 years (or per local regulations)
- **Backups**: Keep quarterly backups for 1 year

### Legal Considerations

- Check local business record requirements
- Philippine BIR may require 5-year retention for financial records
- Consult legal advisor for specific requirements

## Automation Options (Future)

While manual archival works well for small resorts, consider automation when:

- Log volume exceeds 100K/year
- Multiple properties managed
- Compliance requirements demand it

Options include:

- Supabase Edge Functions with pg_cron
- External scheduling service
- Vercel cron jobs (if migrating from Workers)

## Support

For questions about archival:

1. Review this guide
2. Check [Troubleshooting Guide](../06-troubleshooting.md)
3. Test in development first
4. Contact Supabase support if database issues arise

---

**Last Updated**: January 2025
**Version**: 1.0.0
**Status**: Active Procedure
