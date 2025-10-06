# 🗄️ Database Architecture & Management

## Overview

The Okaeri Resort System uses **PostgreSQL via Supabase** with a carefully designed schema optimized for multi-tenant resort management. The database implements Row Level Security (RLS) for data isolation, uses advanced PostgreSQL features for performance, and follows enterprise best practices for data integrity.

## 📁 Directory Structure

```
database/
├── README.md                        # This file - database guide
├── SCHEMA.md                        # Complete schema documentation with ERD
├── schema.sql                       # Core database schema (7.7KB)
├── enable-rls.sql                   # Row Level Security policies (6.2KB)
├── storage-policies.sql             # File storage RLS policies (6KB)
├── availability-enhancements.sql    # Availability system optimizations (13KB)
├── migrate-availability-system.sql  # Availability migration (16KB)
├── verify-rls-status.sql           # RLS verification script (4.3KB)
├── RLS_FIX_SUMMARY.md              # RLS implementation summary
└── migrations/                      # Database migrations
    ├── README.md                   # Migration management guide
    ├── README-DEPLOYMENT.md        # Deployment-specific migrations
    ├── rollback/                   # Rollback scripts
    └── backups/                    # Schema backups
```

## 🏗️ Schema Overview

### Core Tables

The database consists of 9 primary tables organized around the multi-tenant architecture:

1. **`projects`** - Multi-tenant project isolation
2. **`properties`** - Resort properties within projects
3. **`units`** - Accommodation units (rooms, cottages)
4. **`guests`** - Guest registry and CRM
5. **`bookings`** - Reservation management
6. **`payments`** - Payment tracking
7. **`expenses`** - Expense management
8. **`audit_logs`** - Comprehensive audit trail
9. **`unit_availability`** - Availability caching

### Database Features

- **Multi-tenant isolation** via `project_id` foreign keys
- **Row Level Security (RLS)** for access control
- **JSONB columns** for flexible metadata
- **Indexes** for query optimization
- **Constraints** for data integrity
- **Functions** for availability calculations
- **Triggers** for audit logging

For the complete schema with ERD diagrams, see [SCHEMA.md](./SCHEMA.md).

## 🔐 Row Level Security (RLS)

### RLS Policy Structure

All tables implement RLS policies to ensure users can only access data within their project scope:

```sql
-- Example RLS policy for bookings
CREATE POLICY "Users can view bookings in their project"
  ON bookings
  FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert bookings in their project"
  ON bookings
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_users
      WHERE user_id = auth.uid()
    )
  );
```

### Enabling RLS

```bash
# Enable RLS on all tables
psql $DATABASE_URL < enable-rls.sql

# Verify RLS status
psql $DATABASE_URL < verify-rls-status.sql
```

### RLS Best Practices

1. **Always include `project_id`** in WHERE clauses
2. **Use the `db` helper** for automatic project scoping
3. **Test RLS policies** before deploying
4. **Verify policies** after each migration
5. **Audit RLS bypasses** in logs

```typescript
// ✅ Good - Uses RLS-aware helper
const { data } = await db.bookings.all(projectId)

// ❌ Bad - Bypasses RLS
const { data } = await supabase.from('bookings').select('*')
```

## 🚀 Database Setup

### Initial Setup

```bash
# 1. Create Supabase project
# Visit: https://supabase.com

# 2. Set environment variables
echo "VITE_SUPABASE_URL=https://xxx.supabase.co" >> .env.local
echo "VITE_SUPABASE_ANON_KEY=eyJxxx..." >> .env.local

# 3. Run schema creation
psql $DATABASE_URL < schema.sql

# 4. Enable RLS
psql $DATABASE_URL < enable-rls.sql

# 5. Set up storage policies
psql $DATABASE_URL < storage-policies.sql

# 6. Run migrations
cd migrations && ./run-all.sh
```

### Local Development

```bash
# Use Supabase CLI for local development
npx supabase init
npx supabase start

# Link to your project
npx supabase link --project-ref your-project-ref

# Pull remote schema
npx supabase db pull

# Run migrations
npx supabase db push
```

## 📊 Migrations Management

### Migration Workflow

```bash
# Create a new migration
cd database/migrations
./create-migration.sh "add_booking_status_index"

# Apply migration
psql $DATABASE_URL < 001_add_booking_status_index.sql

# Create rollback (always!)
./create-rollback.sh 001_add_booking_status_index

# Test rollback
psql $DATABASE_URL < rollback/001_add_booking_status_index.sql
```

### Migration Best Practices

1. **Always create rollbacks** before applying migrations
2. **Test on staging** before production
3. **Backup before migrations**: `./backup-schema.sh`
4. **Use transactions** for atomic changes
5. **Document breaking changes** in migration files

```sql
-- Good migration pattern
BEGIN;

-- Migration logic here
ALTER TABLE bookings ADD COLUMN new_field TEXT;
CREATE INDEX idx_new_field ON bookings(new_field);

-- Verify changes
SELECT column_name FROM information_schema.columns
WHERE table_name = 'bookings' AND column_name = 'new_field';

COMMIT;
```

For detailed migration guide, see [migrations/README.md](./migrations/README.md).

## 🎯 Query Optimization

### Indexed Columns

The schema includes indexes on frequently queried columns:

```sql
-- Booking queries
CREATE INDEX idx_bookings_project ON bookings(project_id);
CREATE INDEX idx_bookings_dates ON bookings(check_in, check_out);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_unit ON bookings(unit_id);

-- Guest queries
CREATE INDEX idx_guests_email ON guests(email);
CREATE INDEX idx_guests_phone ON guests(phone);

-- Audit logs
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
```

### Availability Queries

Optimized availability checking using database functions:

```sql
-- Fast availability check function
CREATE FUNCTION check_unit_availability(
  p_unit_id UUID,
  p_check_in DATE,
  p_check_out DATE
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM bookings
    WHERE unit_id = p_unit_id
      AND status NOT IN ('cancelled', 'no_show')
      AND (
        (check_in, check_out) OVERLAPS (p_check_in, p_check_out)
      )
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Usage from app
const { data } = await supabase.rpc('check_unit_availability', {
  p_unit_id: unitId,
  p_check_in: checkIn,
  p_check_out: checkOut,
})
```

### Query Performance Tips

1. **Use `EXPLAIN ANALYZE`** to profile queries
2. **Limit result sets** with pagination
3. **Use partial indexes** for status-based queries
4. **Avoid N+1 queries** - use joins or `select` with relations
5. **Cache expensive queries** in TanStack Query

```typescript
// ✅ Good - Single query with relations
const { data } = await supabase
  .from('bookings')
  .select('*, unit:units(*), guest:guests(*)')
  .eq('project_id', projectId)

// ❌ Bad - N+1 queries
const bookings = await db.bookings.all(projectId)
for (const booking of bookings) {
  const unit = await db.units.byId(booking.unit_id) // N+1!
}
```

## 💾 Backup & Recovery

### Automated Backups

Supabase provides automatic daily backups. For additional protection:

```bash
# Manual backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Backup with compression
pg_dump $DATABASE_URL | gzip > backup-$(date +%Y%m%d).sql.gz

# Backup specific tables
pg_dump $DATABASE_URL -t bookings -t payments > critical-tables.sql
```

### Recovery

```bash
# Restore from backup
psql $DATABASE_URL < backup-20241206.sql

# Restore specific table
psql $DATABASE_URL < table-backup.sql
```

### Point-in-Time Recovery (PITR)

Supabase Pro offers PITR for production databases:

```sql
-- Restore to specific timestamp
ALTER DATABASE your_db SET recovery_target_time = '2024-12-06 10:00:00';
```

## 🔍 Database Monitoring

### Key Metrics to Monitor

1. **Connection Pool Usage**
   ```sql
   SELECT count(*) FROM pg_stat_activity;
   ```

2. **Slow Queries**
   ```sql
   SELECT query, mean_exec_time, calls
   FROM pg_stat_statements
   ORDER BY mean_exec_time DESC
   LIMIT 10;
   ```

3. **Table Sizes**
   ```sql
   SELECT
     schemaname,
     tablename,
     pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
   FROM pg_tables
   WHERE schemaname = 'public'
   ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
   ```

4. **Index Usage**
   ```sql
   SELECT
     tablename,
     indexname,
     idx_scan,
     idx_tup_read,
     idx_tup_fetch
   FROM pg_stat_user_indexes
   WHERE idx_scan = 0
   ORDER BY tablename;
   ```

### Performance Optimization

```sql
-- Vacuum and analyze
VACUUM ANALYZE bookings;

-- Reindex
REINDEX TABLE bookings;

-- Update statistics
ANALYZE bookings;
```

## 🛠️ Maintenance Tasks

### Regular Maintenance Schedule

| Task | Frequency | Command |
|------|-----------|---------|
| Vacuum | Weekly | `VACUUM ANALYZE;` |
| Reindex | Monthly | `REINDEX DATABASE;` |
| Backup verification | Daily | Restore test backup |
| RLS audit | Monthly | Run `verify-rls-status.sql` |
| Index review | Quarterly | Check unused indexes |
| Audit log cleanup | Weekly | Delete logs > 90 days |

### Cleanup Scripts

```sql
-- Delete old audit logs (> 90 days)
DELETE FROM audit_logs
WHERE created_at < NOW() - INTERVAL '90 days';

-- Archive completed bookings (> 1 year)
INSERT INTO bookings_archive
SELECT * FROM bookings
WHERE status = 'completed'
  AND check_out < NOW() - INTERVAL '1 year';

DELETE FROM bookings
WHERE id IN (SELECT id FROM bookings_archive);
```

## 📚 Related Documentation

- [Complete Schema Documentation](./SCHEMA.md) - ERD diagrams and table definitions
- [Migration Guide](./migrations/README.md) - Database migration management
- [RLS Implementation](./RLS_FIX_SUMMARY.md) - Row Level Security summary
- [Database Helpers](/src/lib/supabase.ts) - Typed database client
- [Availability System](/src/lib/availability.ts) - Availability checking logic

## 🚨 Troubleshooting

### Common Issues

**Issue**: RLS blocking queries
```sql
-- Check RLS status
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Temporarily disable for debugging (dev only!)
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;
```

**Issue**: Slow queries
```sql
-- Enable query logging
ALTER DATABASE postgres SET log_min_duration_statement = 1000;

-- Check pg_stat_statements
SELECT query, mean_exec_time FROM pg_stat_statements
WHERE query LIKE '%bookings%'
ORDER BY mean_exec_time DESC;
```

**Issue**: Connection pool exhausted
```typescript
// Reduce max connections in Supabase client
const supabase = createClient(url, key, {
  db: { schema: 'public' },
  global: { headers: { 'X-Client-Info': 'okaeri-resort' } },
  auth: { persistSession: true },
})
```

## 🎯 Best Practices Summary

1. ✅ **Always use RLS** - Never bypass row-level security
2. ✅ **Use typed helpers** - Prefer `db.bookings.all()` over raw queries
3. ✅ **Include project_id** - All queries must scope to project
4. ✅ **Create indexes** - Index frequently queried columns
5. ✅ **Test migrations** - Always test with rollback before production
6. ✅ **Monitor performance** - Use `EXPLAIN ANALYZE` for optimization
7. ✅ **Regular backups** - Automate and verify backup restoration
8. ✅ **Audit changes** - Log all data mutations to audit trail
9. ✅ **Clean up data** - Archive old records to maintain performance
10. ✅ **Document changes** - Keep migration docs up to date
