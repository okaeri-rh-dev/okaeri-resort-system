# Production Migration Guide - Okaeri Resort System

**Date:** October 7, 2025
**Version:** 1.0
**Critical Fixes:** Audit Trail RLS Authentication

---

## 📋 Migration Sequence

### Required Migrations (In Order)

| Migration | File                                                      | Purpose                     | Status          |
| --------- | --------------------------------------------------------- | --------------------------- | --------------- |
| 001       | `001-fix-payment-status.sql`                              | Fix payment status enum     | ✅ Required     |
| 002       | `002-fix-unit-types.sql`                                  | Fix unit type constraints   | ✅ Required     |
| 003       | `003-add-guest-statistics-triggers.sql`                   | Guest statistics automation | ✅ Required     |
| 004       | `004-add-occupancy-pricing.sql`                           | Occupancy-based pricing     | ✅ Required     |
| 005       | `005-create-audit-logs.sql`                               | **Audit trail tables**      | ✅ Required     |
| 006       | `006-create-audit-triggers.sql`                           | Audit trigger functions     | ✅ Required     |
| 007       | `007-create-audit-indexes.sql`                            | Performance indexes         | ✅ Required     |
| 008       | `008-create-audit-archive.sql`                            | Audit archival system       | ✅ Required     |
| 009       | `009-enable-audit-rls.sql`                                | RLS policies (initial)      | ✅ Required     |
| 010       | `010-bootstrap-admin.sql`                                 | Bootstrap admin user        | ✅ Required     |
| 011       | `011-verify-audit-system.sql`                             | Verification queries        | ⚠️ Optional     |
| 012       | `012-fix-app-roles-rls-recursion.sql`                     | Security definer helpers    | ✅ Required     |
| 013       | `013-guest-booking-schema.sql`                            | Guest booking tables        | ✅ Required     |
| 014       | `014-guest-booking-exclusion-constraint-with-cleanup.sql` | Booking conflict prevention | ✅ Required     |
| 015       | `015-secure-conflict-backup-table.sql`                    | Backup table security       | ✅ Required     |
| **016**   | **`016-fix-helper-functions-stability.sql`**              | **Add STABLE attribute**    | 🔥 **CRITICAL** |
| **017**   | **`017-grant-authenticated-permissions.sql`**             | **Table-level GRANTs**      | 🔥 **CRITICAL** |

---

## 🔥 Critical Production Fixes (016 & 017)

### Issue Summary

**Problem:** Authenticated users received `permission denied` (PostgreSQL 42501) when querying `audit_logs` table, despite having proper roles configured in `app_roles` table.

**Root Cause:** PostgreSQL requires **TWO layers** of security:

1. **Table-level GRANT** (missing ❌)
2. **Row-level Security policies** (working ✅)

Without table-level GRANTs, access is denied **BEFORE** RLS policies are evaluated.

### Migration 016: Fix Helper Function Stability

**File:** `016-fix-helper-functions-stability.sql`

**Purpose:** Add `STABLE` attribute to SECURITY DEFINER helper functions to preserve `auth.uid()` context during RLS policy evaluation.

**Affected Functions:**

- `is_admin_or_owner(UUID)`
- `is_manager(UUID)`
- `is_admin(UUID)`

**Why STABLE Matters:**

- `VOLATILE` functions (default) lose authentication context in RLS checks
- `STABLE` functions cache results per transaction, preserving JWT claims
- This allows RLS policies to correctly evaluate user roles

**Deployment:**

```sql
-- Run in Supabase SQL Editor
\i database/migrations/016-fix-helper-functions-stability.sql
```

### Migration 017: Grant Authenticated Permissions (CRITICAL)

**File:** `017-grant-authenticated-permissions.sql`

**Purpose:** Grant table-level `SELECT` and `INSERT` permissions to `authenticated` role on audit tables.

**Permissions Granted:**

```sql
GRANT SELECT, INSERT ON audit_logs TO authenticated;
GRANT SELECT, INSERT ON audit_logs_archive TO authenticated;
GRANT SELECT ON app_roles TO authenticated;
```

**Why This Was Missed:**

- SQL Editor runs as `postgres` (superuser, bypasses GRANTs)
- RPC functions use `SECURITY DEFINER` (run as creator, bypass GRANTs)
- Only direct table queries from `authenticated` role hit this issue
- This is NOT a workaround - proper PostgreSQL security requires both layers

**Deployment:**

```sql
-- Run in Supabase SQL Editor
\i database/migrations/017-grant-authenticated-permissions.sql
```

**Verification:**

```sql
-- Should return 'true' for all tables
SELECT
    tablename,
    pg_catalog.has_table_privilege('authenticated', tablename, 'SELECT') as can_select
FROM pg_tables
WHERE tablename IN ('audit_logs', 'audit_logs_archive', 'app_roles');
```

---

## 🚀 Production Deployment Steps

### 1. Pre-Deployment Checklist

- [ ] Backup production database
- [ ] Review current migration status: `SELECT * FROM schema_migrations;`
- [ ] Verify no pending application deployments
- [ ] Schedule maintenance window (< 5 minutes downtime)

### 2. Run Migrations

**Option A: Using Supabase Dashboard (Recommended)**

1. Navigate to SQL Editor
2. Run migrations 001-017 in sequence
3. Verify each completes successfully before proceeding

**Option B: Using psql CLI**

```bash
# Connect to production database
psql "postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres"

# Run migrations
\i database/migrations/001-fix-payment-status.sql
\i database/migrations/002-fix-unit-types.sql
# ... (continue through 017)
```

### 3. Post-Deployment Verification

**Test Audit Trail Access:**

```sql
-- Switch to authenticated role context
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "your-user-id-here"}';

-- Should return audit logs without 42501 error
SELECT * FROM audit_logs LIMIT 5;

-- Reset role
RESET ROLE;
```

**Verify Helper Functions:**

```sql
-- Should show STABLE volatility
SELECT
    proname AS function_name,
    CASE provolatile
        WHEN 's' THEN 'STABLE ✅'
        WHEN 'v' THEN 'VOLATILE ❌'
        WHEN 'i' THEN 'IMMUTABLE'
    END as volatility,
    CASE WHEN prosecdef THEN 'SECURITY DEFINER ✅' ELSE 'NORMAL ❌' END AS security
FROM pg_proc
WHERE proname IN ('is_admin_or_owner', 'is_manager', 'is_admin');
```

**Check Table Privileges:**

```sql
-- Should return rows with SELECT and INSERT privileges
SELECT
    grantee,
    table_name,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_name IN ('audit_logs', 'audit_logs_archive', 'app_roles')
  AND grantee = 'authenticated'
ORDER BY table_name, privilege_type;
```

### 4. Application Deployment

After database migrations succeed:

1. **Deploy application code** with routing fixes:
   - Layout route pattern for `/bookings`
   - Child routes: `/bookings/$bookingId` (detail) and `/bookings/$bookingId/edit`

2. **Clear browser caches** for all users:
   - Hard refresh required: `Cmd+Shift+R` (Mac) / `Ctrl+Shift+R` (Windows)

3. **Test critical paths:**
   - Navigate to booking detail page
   - Verify audit logs section displays
   - Click "Edit Booking" → Should show form, not detail view
   - Verify save/cancel buttons work

---

## 📚 Technical Architecture Reference

### PostgreSQL Security Hierarchy

```
┌─────────────────────────────────────┐
│ 1. SUPERUSER BYPASS                 │
│    postgres role → Full access      │
│    (ignores all checks below)       │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ 2. TABLE-LEVEL GRANTS ← FIXED 017  │
│    GRANT SELECT ON table TO role;   │
│    Controls which roles access      │
│    Checked FIRST before RLS         │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ 3. ROW-LEVEL SECURITY (RLS)         │
│    CREATE POLICY ... USING (...);   │
│    Controls which rows within       │
│    Only checked if GRANT passed     │
└─────────────────────────────────────┘
```

### Audit Trail RLS Flow

```sql
-- User queries audit logs
SELECT * FROM audit_logs WHERE table_name = 'bookings';

-- PostgreSQL checks:
1. Does 'authenticated' role have SELECT on audit_logs?
   → YES (after migration 017) ✅

2. Apply RLS policy: audit_logs_select_policy
   → USING (is_admin_or_owner(auth.uid()))
   → Function has STABLE (after migration 016) ✅
   → auth.uid() preserved in function context
   → Returns true for admin users

3. Return filtered rows based on role
```

---

## 🔧 Rollback Procedures

### If Migration 017 Causes Issues

```sql
BEGIN;

-- Revoke permissions
REVOKE SELECT, INSERT ON audit_logs FROM authenticated;
REVOKE SELECT, INSERT ON audit_logs_archive FROM authenticated;
REVOKE SELECT ON app_roles FROM authenticated;

-- Verify rollback
SELECT
    pg_catalog.has_table_privilege('authenticated', 'audit_logs', 'SELECT') as can_select;
-- Should return: false

COMMIT;
```

### If Migration 016 Causes Issues

```sql
BEGIN;

-- Revert to VOLATILE (original state)
CREATE OR REPLACE FUNCTION is_admin_or_owner(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM app_roles
        WHERE user_id = check_user_id
          AND role IN ('admin', 'owner')
          AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;  -- Removed STABLE

-- Repeat for is_manager() and is_admin()

COMMIT;
```

---

## 📞 Support & Troubleshooting

### Common Issues

**Issue 1: "permission denied for table audit_logs"**

- **Cause:** Migration 017 not applied
- **Fix:** Run migration 017
- **Verify:** Check table privileges query above

**Issue 2: "RLS policy returns no rows for admin users"**

- **Cause:** Migration 016 not applied (STABLE missing)
- **Fix:** Run migration 016
- **Verify:** Check function volatility query above

**Issue 3: "Edit page shows detail page content"**

- **Cause:** Route structure issue (already fixed in codebase)
- **Fix:** Deploy latest application code with correct route structure
- **Verify:** Check browser console for correct component rendering

### Verification Checklist

- [ ] All migrations 001-017 completed
- [ ] Helper functions show `STABLE` volatility
- [ ] Table privileges granted to `authenticated`
- [ ] Audit logs accessible in browser
- [ ] Edit page shows form (not detail view)
- [ ] No console errors on booking detail page

---

## 📝 Change Log

### Version 1.0 - October 7, 2025

**Critical Fixes:**

- Added STABLE attribute to RLS helper functions (Migration 016)
- Granted table-level permissions to authenticated role (Migration 017)
- Fixed booking detail/edit routing structure

**Files Removed:**

- Debug SQL files (11 files)
- Test browser scripts (1 file)
- Duplicate migration 014 file

**Documentation:**

- Created production deployment guide
- Added PostgreSQL security architecture reference
- Documented rollback procedures

---

## ✅ Success Criteria

Deployment is successful when:

1. ✅ Booking detail page displays audit logs without errors
2. ✅ Edit page shows editable form (not readonly detail)
3. ✅ No PostgreSQL 42501 errors in browser console
4. ✅ All RLS helper functions have STABLE volatility
5. ✅ Authenticated role has SELECT/INSERT on audit tables

---

**Next Steps After Deployment:**

1. Monitor Supabase logs for RLS-related errors
2. Test with multiple user roles (admin, manager, staff)
3. Verify audit trail captures all booking mutations
4. Document any edge cases discovered in production

---

**Contact:** Development Team
**Last Updated:** October 7, 2025
