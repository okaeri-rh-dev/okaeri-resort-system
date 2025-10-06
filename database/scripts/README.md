# Database Scripts

This directory contains utility scripts for database maintenance, diagnostics, and troubleshooting.

## Directory Structure

```
scripts/
├── diagnostics/          # Diagnostic and conflict resolution scripts
│   ├── check-booking-conflicts.sql
│   └── fix-overlapping-bookings.sql
└── README.md            # This file
```

## Diagnostics Scripts

### check-booking-conflicts.sql

**Purpose**: Identify overlapping booking conflicts before applying database constraints.

**Use Cases**:
- Pre-migration validation
- Troubleshooting booking issues
- Data integrity audits

**How to Run**:
```bash
# Using psql (local)
psql -d your_database -f database/scripts/diagnostics/check-booking-conflicts.sql

# Using Supabase SQL Editor
# Copy and paste the script content
```

**Output**:
- List of conflicting booking pairs
- Summary statistics (total conflicts, affected units)
- Recommended actions for resolution

---

### fix-overlapping-bookings.sql

**Purpose**: Resolve existing booking conflicts by canceling newer overlapping bookings.

**⚠️ Warning**: This script modifies data. Always:
1. Create a backup before running
2. Review the conflicts identified by `check-booking-conflicts.sql` first
3. Understand the business impact of cancellations

**Resolution Strategy**:
- Keeps the older booking (first-come, first-served principle)
- Cancels the newer conflicting booking
- Adds audit notes explaining the cancellation
- Creates a backup table of affected bookings

**How to Run**:
```bash
# Step 1: Check for conflicts first
psql -d your_database -f database/scripts/diagnostics/check-booking-conflicts.sql

# Step 2: Review the output and confirm you want to proceed

# Step 3: Run the fix script
psql -d your_database -f database/scripts/diagnostics/fix-overlapping-bookings.sql
```

**Recovery**:
If you need to rollback:
```sql
-- The script creates a backup table: bookings_conflict_backup
SELECT * FROM bookings_conflict_backup;

-- Manually restore specific bookings if needed
UPDATE bookings
SET booking_status = 'Confirmed'
WHERE booking_id IN (SELECT booking_id FROM bookings_conflict_backup WHERE ...);
```

---

## Adding New Scripts

When adding new diagnostic or maintenance scripts:

1. **Naming Convention**: Use kebab-case, descriptive names
   - ✅ `check-booking-conflicts.sql`
   - ✅ `cleanup-expired-sessions.sql`
   - ❌ `script1.sql`

2. **Documentation**: Include at the top of each script:
   ```sql
   -- Script Name: [Descriptive Name]
   -- Purpose: [What problem this solves]
   -- Author: [Your name]
   -- Date: [YYYY-MM-DD]
   --
   -- Usage:
   --   [How to run the script]
   --
   -- Notes:
   --   [Any important warnings or considerations]
   ```

3. **Safety First**:
   - Scripts that modify data should create backups first
   - Include rollback instructions
   - Add confirmation prompts for destructive operations

4. **Update This README**: Add a section documenting your new script

---

## Best Practices

### Before Running Any Script

1. **Backup Your Data**
   ```sql
   -- Create a snapshot of affected tables
   CREATE TABLE table_name_backup_YYYYMMDD AS
   SELECT * FROM table_name;
   ```

2. **Test in Development First**
   - Never run untested scripts in production
   - Verify results match expectations
   - Check for edge cases

3. **Review the Code**
   - Understand what each query does
   - Check WHERE clauses carefully
   - Verify JOINs and filters

### After Running a Script

1. **Verify Results**
   ```sql
   -- Check row counts
   SELECT COUNT(*) FROM affected_table;

   -- Validate data integrity
   SELECT * FROM affected_table WHERE ... LIMIT 10;
   ```

2. **Monitor Application**
   - Check for errors in application logs
   - Verify business processes still work
   - Monitor performance metrics

3. **Document Execution**
   - Record when the script was run
   - Note any issues or unexpected results
   - Save output logs for audit trail

---

## Common Diagnostic Queries

### Check Database Size
```sql
SELECT
  pg_size_pretty(pg_database_size(current_database())) as size;
```

### Find Largest Tables
```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;
```

### Active Connections
```sql
SELECT
  count(*) as active_connections,
  usename,
  state
FROM pg_stat_activity
WHERE state != 'idle'
GROUP BY usename, state;
```

---

## Related Documentation

- [Database Schema](../SCHEMA.md) - Full database schema documentation
- [Migrations](../migrations/README.md) - Migration scripts and procedures
- [RLS Policies](../README.md#row-level-security) - Security policies documentation

---

## Support

If you encounter issues with any script:

1. Check the script's documentation at the top of the file
2. Review the [Database README](../README.md)
3. Examine recent migrations for related changes
4. Open an issue with:
   - Script name and purpose
   - Error message or unexpected behavior
   - Database version and environment
   - Steps to reproduce
