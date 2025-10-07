# Production Migration Summary - Quick Reference

**Last Updated:** October 7, 2025
**Commit Range:** `f3da057` → `HEAD` (bdc7547)
**Critical Migrations:** 2 (016, 017)

---

## Executive Summary

Changes since commit `f3da057` require **2 critical database migrations** to fix audit trail permission issues in production. These migrations add proper PostgreSQL function attributes and table-level permissions.

**Estimated Deployment Time:** 5 minutes
**Downtime Required:** None
**Rollback Risk:** Low (simple REVOKE commands)

---

## Required Migrations

### 🔥 Migration 016: Fix Helper Functions Stability

**File:** `database/migrations/016-fix-helper-functions-stability.sql`

**Problem Fixed:**

- RLS helper functions missing `STABLE` attribute
- Auth context (`auth.uid()`) lost during policy evaluation
- Result: "permission denied" errors for authenticated users

**Changes:**

```sql
-- Add STABLE to 3 helper functions
CREATE OR REPLACE FUNCTION is_admin_or_owner(UUID)
RETURNS BOOLEAN AS $$ ... $$
LANGUAGE plpgsql SECURITY DEFINER STABLE;  -- ← Added STABLE

CREATE OR REPLACE FUNCTION is_manager(UUID)
RETURNS BOOLEAN AS $$ ... $$
LANGUAGE plpgsql SECURITY DEFINER STABLE;  -- ← Added STABLE

CREATE OR REPLACE FUNCTION is_admin(UUID)
RETURNS BOOLEAN AS $$ ... $$
LANGUAGE plpgsql SECURITY DEFINER STABLE;  -- ← Added STABLE
```

**Verification:**

```sql
SELECT proname,
  CASE provolatile
    WHEN 's' THEN 'STABLE ✅'
    WHEN 'v' THEN 'VOLATILE ❌'
  END as volatility
FROM pg_proc
WHERE proname IN ('is_admin_or_owner', 'is_manager', 'is_admin');
```

---

### 🔥 Migration 017: Grant Authenticated Permissions

**File:** `database/migrations/017-grant-authenticated-permissions.sql`

**Problem Fixed:**

- Missing table-level GRANT permissions
- PostgreSQL requires BOTH table grants AND RLS policies
- Without grants, access denied before RLS evaluation

**Changes:**

```sql
-- Grant table-level permissions
GRANT SELECT, INSERT ON audit_logs TO authenticated;
GRANT SELECT, INSERT ON audit_logs_archive TO authenticated;
GRANT SELECT ON app_roles TO authenticated;
```

**Verification:**

```sql
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_name IN ('audit_logs', 'audit_logs_archive', 'app_roles')
  AND grantee = 'authenticated'
ORDER BY table_name, privilege_type;
```

---

## Quick Deployment (Supabase Dashboard)

1. **Navigate to SQL Editor**
   - Open Supabase Dashboard
   - Click "SQL Editor" in sidebar

2. **Run Migration 016**
   - Copy entire contents of `database/migrations/016-fix-helper-functions-stability.sql`
   - Paste into SQL Editor
   - Click "Run" button
   - Verify success message shows all 3 functions updated

3. **Run Migration 017**
   - Copy entire contents of `database/migrations/017-grant-authenticated-permissions.sql`
   - Paste into SQL Editor
   - Click "Run" button
   - Verify grants appear in output

4. **Test in Browser Console**

   ```javascript
   const { data, error } = await supabase.from("audit_logs").select("*").limit(5);

   console.log("Data:", data, "Error:", error);
   // Expected: data array, error null
   ```

---

## Success Criteria

✅ Functions show `STABLE` volatility (not VOLATILE)
✅ Table grants visible for `authenticated` role
✅ Booking detail pages display audit logs
✅ No "permission denied" errors in browser console
✅ Browser test returns data (not error)

---

## Rollback Commands

**If Migration 017 causes issues:**

```sql
BEGIN;
REVOKE SELECT, INSERT ON audit_logs FROM authenticated;
REVOKE SELECT, INSERT ON audit_logs_archive FROM authenticated;
REVOKE SELECT ON app_roles FROM authenticated;
COMMIT;
```

**If Migration 016 causes issues:**

```sql
-- Revert functions to VOLATILE by removing STABLE keyword
CREATE OR REPLACE FUNCTION is_admin_or_owner(check_user_id UUID)
RETURNS BOOLEAN AS $$
  -- same function body
$$
LANGUAGE plpgsql SECURITY DEFINER;  -- No STABLE
```

---

## Additional Documentation

For comprehensive details, see:

- **Full Guide:** `database/migrations/PRODUCTION-DEPLOYMENT.md` (379 lines)
  - Complete migration sequence (001-017)
  - PostgreSQL security architecture
  - Troubleshooting guide
  - Success criteria checklist

- **Root Cause Analysis:** `database/migrations/FIX_AUDIT_LOGS_FINAL.md`
- **Quick Fix Guide:** `database/migrations/APPLY_FIX_README.md`

---

## Migration History (All Migrations)

| #       | File                                                      | Status          | Purpose                     |
| ------- | --------------------------------------------------------- | --------------- | --------------------------- |
| 001     | `001-fix-payment-status.sql`                              | ✅ Applied      | Fix payment status enum     |
| 002     | `002-fix-unit-types.sql`                                  | ✅ Applied      | Fix unit type constraints   |
| 003     | `003-add-guest-statistics-triggers.sql`                   | ✅ Applied      | Guest statistics automation |
| 004     | `004-add-occupancy-pricing.sql`                           | ✅ Applied      | Occupancy-based pricing     |
| 005     | `005-create-audit-logs.sql`                               | ✅ Applied      | Audit trail tables          |
| 006     | `006-create-audit-triggers.sql`                           | ✅ Applied      | Audit trigger functions     |
| 007     | `007-create-audit-indexes.sql`                            | ✅ Applied      | Performance indexes         |
| 008     | `008-create-audit-archive.sql`                            | ✅ Applied      | Audit archival system       |
| 009     | `009-enable-audit-rls.sql`                                | ✅ Applied      | RLS policies (initial)      |
| 010     | `010-bootstrap-admin.sql`                                 | ✅ Applied      | Bootstrap admin user        |
| 011     | `011-verify-audit-system.sql`                             | ⚠️ Optional     | Verification queries        |
| 012     | `012-fix-app-roles-rls-recursion.sql`                     | ✅ Applied      | Security definer helpers    |
| 013     | `013-guest-booking-schema.sql`                            | ✅ Applied      | Guest booking tables        |
| 014     | `014-guest-booking-exclusion-constraint-with-cleanup.sql` | ✅ Applied      | Booking conflict prevention |
| 015     | `015-secure-conflict-backup-table.sql`                    | ✅ Applied      | Backup table security       |
| **016** | **`016-fix-helper-functions-stability.sql`**              | 🔥 **CRITICAL** | **Add STABLE attribute**    |
| **017** | **`017-grant-authenticated-permissions.sql`**             | 🔥 **CRITICAL** | **Table-level GRANTs**      |

---

## Questions or Issues?

1. Check browser console for specific error messages
2. Review `database/migrations/PRODUCTION-DEPLOYMENT.md` for troubleshooting
3. Run verification queries to diagnose issues
4. Check Supabase logs in Dashboard → Logs

---

**Note:** Migrations 001-015 should already be applied in production. Only migrations 016 and 017 are new since commit `f3da057`.
