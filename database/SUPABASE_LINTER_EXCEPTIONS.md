# Supabase Linter Exceptions

This document explains intentional exceptions to Supabase database linter rules.

## Security Definer Views (3 views)

### Suppressed Warnings

- `security_definer_view` for `audit_index_stats` (created in migration 007)
- `security_definer_view` for `audit_archive_stats` (created in migration 008)
- `security_definer_view` for `audit_system_status` (created in migration 011)

### Justification

These views are **admin-only diagnostic tools** that require SECURITY DEFINER to access PostgreSQL system catalogs:

- **Read-only**: No data modification capability
- **No sensitive data**: Only expose database metadata (indexes, table sizes, policies)
- **Not exposed to app**: Not queried by application code, manual DBA use only
- **Supabase auto-creation**: May have been created with SECURITY DEFINER automatically by Supabase to access system catalogs

### What These Views Access

1. **`audit_index_stats`** (migration 007)
   - Accesses: `pg_stat_user_indexes`, `pg_relation_size()`
   - Purpose: Monitor index usage and performance for audit_logs table
   - Returns: Index names, sizes, usage statistics

2. **`audit_archive_stats`** (migration 008)
   - Accesses: `pg_total_relation_size()` for audit_logs and audit_logs_archive
   - Purpose: Monitor active vs archived log distribution and table sizes
   - Returns: Log counts, date ranges, table sizes

3. **`audit_system_status`** (migration 011)
   - Accesses: `information_schema.tables`, `information_schema.triggers`, `pg_indexes`, `pg_policies`, `information_schema.routines`
   - Purpose: Complete audit system verification - tables, triggers, indexes, policies, functions
   - Returns: Component counts and configuration overview

### Risk Assessment: LOW

These views pose minimal security risk:

- ✅ No user data exposed (only database structure/metadata)
- ✅ No modification capability (read-only views)
- ✅ Not accessible via application (manual DBA queries only)
- ✅ Standard PostgreSQL patterns for admin monitoring

### Resolution: ACCEPTED ✅

The SECURITY DEFINER warnings for these views are **intentionally accepted** as they are essential admin diagnostic tools.

---

## Fixed Warnings

### ✅ RLS Disabled on `bookings_conflict_backup` (FIXED in migration 015)

**Issue**: Table contained booking data but had no Row Level Security enabled.

**Fix**:

- Enabled RLS on table
- Added admin-only access policy using `is_admin_or_owner()` helper
- Table now protected from unauthorized access

**Migration**: `015-secure-conflict-backup-table.sql`

---

## Linter Status Summary

| Warning Type             | Object                     | Status   | Mitigation                   |
| ------------------------ | -------------------------- | -------- | ---------------------------- |
| `security_definer_view`  | `audit_index_stats`        | ACCEPTED | Admin-only diagnostic tool   |
| `security_definer_view`  | `audit_archive_stats`      | ACCEPTED | Admin-only diagnostic tool   |
| `security_definer_view`  | `audit_system_status`      | ACCEPTED | Admin-only diagnostic tool   |
| `rls_disabled_in_public` | `bookings_conflict_backup` | ✅ FIXED | RLS enabled in migration 015 |

---

## Best Practices

When creating new admin diagnostic views:

1. **Document purpose** in migration comments
2. **Mark as admin-only** in view comments
3. **Ensure read-only** - no INSERT/UPDATE/DELETE capabilities
4. **Avoid user data** - only access metadata and system catalogs
5. **Add to this document** if Supabase linter flags them

---

## References

- [Supabase Database Linter Docs](https://supabase.com/docs/guides/database/database-linter)
- [PostgreSQL SECURITY DEFINER](https://www.postgresql.org/docs/current/sql-createfunction.html)
- Migration 007: `database/migrations/007-create-audit-indexes.sql`
- Migration 008: `database/migrations/008-create-audit-archive.sql`
- Migration 011: `database/migrations/011-verify-audit-system.sql`
- Migration 015: `database/migrations/015-secure-conflict-backup-table.sql`
