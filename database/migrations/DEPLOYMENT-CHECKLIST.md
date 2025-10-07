# Production Deployment Checklist

**Deployment Date:** ******\_\_\_******
**Engineer:** ******\_\_\_******
**Commit Range:** `f3da057` → `bdc7547` (HEAD)
**Migrations:** 016, 017

---

## Pre-Deployment (15 minutes)

### Environment Preparation

- [ ] All Phase 1-5 tests passing locally
- [ ] Git branch is up-to-date with main
- [ ] No uncommitted changes
- [ ] Staging environment validated (if applicable)

### Database Backup

- [ ] Navigate to Supabase Dashboard → Database → Backups
- [ ] Create manual backup: `pre-migration-016-017-{date}`
- [ ] Verify backup completion
- [ ] Document backup ID: ******\_\_\_******

### Team Readiness

- [ ] Team member available for monitoring
- [ ] Rollback procedure reviewed
- [ ] Monitoring dashboards open
- [ ] Supabase SQL Editor open

### Documentation Review

- [ ] Read [PRODUCTION-MIGRATION-SUMMARY.md](./PRODUCTION-MIGRATION-SUMMARY.md)
- [ ] Verification queries prepared
- [ ] Rollback commands ready (just in case)

---

## Deployment (5 minutes)

### Step 1: Apply Migration 016

- [ ] Open file: `database/migrations/016-fix-helper-functions-stability.sql`
- [ ] Copy entire file contents
- [ ] Paste into Supabase SQL Editor
- [ ] Click "Run" button
- [ ] Verify success message appears
- [ ] Expected output shows 3 functions updated:
  - [ ] `is_admin_or_owner` → STABLE ✅
  - [ ] `is_manager` → STABLE ✅
  - [ ] `is_admin` → STABLE ✅

**Time Completed:** ******\_\_\_******

### Step 2: Apply Migration 017

- [ ] Open file: `database/migrations/017-grant-authenticated-permissions.sql`
- [ ] Copy entire file contents
- [ ] Paste into Supabase SQL Editor
- [ ] Click "Run" button
- [ ] Verify success message appears
- [ ] Expected output shows grants applied:
  - [ ] `audit_logs` → SELECT, INSERT granted
  - [ ] `audit_logs_archive` → SELECT, INSERT granted
  - [ ] `app_roles` → SELECT granted

**Time Completed:** ******\_\_\_******

---

## Verification (5 minutes)

### Database Verification

#### 1. Check Function Volatility

```sql
SELECT proname,
  CASE provolatile
    WHEN 's' THEN 'STABLE ✅'
    WHEN 'v' THEN 'VOLATILE ❌'
  END as volatility,
  CASE WHEN prosecdef THEN 'SECURITY DEFINER ✅' ELSE 'NORMAL' END as security
FROM pg_proc
WHERE proname IN ('is_admin_or_owner', 'is_manager', 'is_admin')
ORDER BY proname;
```

**Result:**

- [ ] All 3 functions show `STABLE ✅`
- [ ] All 3 functions show `SECURITY DEFINER ✅`

#### 2. Check Table Grants

```sql
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_name IN ('audit_logs', 'audit_logs_archive', 'app_roles')
  AND grantee = 'authenticated'
ORDER BY table_name, privilege_type;
```

**Result:**

- [ ] `audit_logs` has SELECT and INSERT
- [ ] `audit_logs_archive` has SELECT and INSERT
- [ ] `app_roles` has SELECT

#### 3. Test Audit Role Function

```sql
-- Test with authenticated user context
SELECT is_admin_or_owner(auth.uid());
```

**Result:**

- [ ] Returns `true` for admin users
- [ ] No errors

### Application Verification

#### 1. Browser Console Test

Open browser console and run:

```javascript
const { data, error } = await supabase.from("audit_logs").select("*").limit(5);

console.log("✅ Data:", data);
console.log("❌ Error:", error);
```

**Result:**

- [ ] `data` is an array (even if empty)
- [ ] `error` is `null`
- [ ] No "permission denied" messages

#### 2. UI Smoke Tests

- [ ] Navigate to: `/bookings`
- [ ] Click any booking to view detail page
- [ ] Audit logs section is visible
- [ ] No red error messages
- [ ] No console errors (F12 → Console)

#### 3. Edit Page Navigation

- [ ] From booking detail, click "Edit Booking"
- [ ] Edit form loads (not detail page)
- [ ] Can modify fields
- [ ] Cancel button works

---

## Post-Deployment Monitoring (48 hours)

### Hour 1 (Critical)

- [ ] No Sentry critical errors
- [ ] Supabase logs clean (Dashboard → Logs)
- [ ] API endpoints responding < 200ms
- [ ] No "permission denied" in browser console
- [ ] Test booking creation works
- [ ] Test booking edit works
- [ ] Audit logs recording properly

**Status:** ******\_\_\_******

### Hour 6

- [ ] Performance metrics stable
- [ ] No data integrity issues reported
- [ ] Monitoring dashboards green
- [ ] Error rate < 1%

**Status:** ******\_\_\_******

### Hour 24

- [ ] Review error trends in Sentry
- [ ] Check Supabase query performance
- [ ] Validate audit log consistency
- [ ] Review user feedback (if any)

**Status:** ******\_\_\_******

### Hour 48

- [ ] Final comprehensive health check
- [ ] Mark deployment as stable
- [ ] Document any issues encountered
- [ ] Update stakeholders with status

**Status:** ******\_\_\_******

---

## Rollback Procedure (If Needed)

### When to Rollback

- Critical errors preventing core functionality
- Data integrity issues
- Performance degradation > 50%
- Security vulnerabilities discovered

### Rollback Step 1: Revert Migration 017

```sql
BEGIN;

REVOKE SELECT, INSERT ON audit_logs FROM authenticated;
REVOKE SELECT, INSERT ON audit_logs_archive FROM authenticated;
REVOKE SELECT ON app_roles FROM authenticated;

COMMIT;
```

- [ ] Executed
- [ ] Verified grants removed

### Rollback Step 2: Revert Migration 016

```sql
BEGIN;

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
$$ LANGUAGE plpgsql SECURITY DEFINER;  -- No STABLE

CREATE OR REPLACE FUNCTION is_manager(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM app_roles
        WHERE user_id = check_user_id
          AND role = 'manager'
          AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;  -- No STABLE

CREATE OR REPLACE FUNCTION is_admin(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM app_roles
        WHERE user_id = check_user_id
          AND role = 'admin'
          AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;  -- No STABLE

COMMIT;
```

- [ ] Executed
- [ ] Verified functions reverted

### Rollback Step 3: Restore from Backup (Last Resort)

- [ ] Navigate to Supabase Dashboard → Database → Backups
- [ ] Select backup ID: ******\_\_\_******
- [ ] Click "Restore"
- [ ] Confirm restoration
- [ ] Verify database state

**Rollback Time:** ******\_\_\_******

---

## Incident Response

### If Deployment Fails

1. **Stop immediately**
2. **Run rollback procedure above**
3. **Document error messages**
4. **Check Supabase logs**
5. **Notify team**
6. **Schedule post-mortem**

### If Issues Found Post-Deployment

1. **Assess severity** (Critical/High/Medium/Low)
2. **Check if affects core functionality**
3. **Decide: Rollback vs. Hot Fix**
4. **Document issue in Sentry/GitHub**
5. **Update monitoring alerts**

---

## Success Criteria

Mark deployment as successful when ALL of these are true:

✅ Migration 016 applied successfully
✅ Migration 017 applied successfully
✅ All verification queries pass
✅ Browser console test shows data
✅ Booking detail pages show audit logs
✅ Edit navigation works correctly
✅ No "permission denied" errors
✅ Performance metrics stable (48h)
✅ Error rate < 1% (48h)
✅ No data integrity issues

**Deployment Status:** ******\_\_\_******
**Sign-off:** ******\_\_\_****** (Engineer)
**Date/Time:** ******\_\_\_******

---

## Post-Deployment Tasks

- [ ] Update deployment log
- [ ] Mark tickets as deployed
- [ ] Update stakeholders via email/Slack
- [ ] Document any issues encountered
- [ ] Update runbook if procedures changed
- [ ] Schedule retrospective (if issues occurred)

---

## Notes & Observations

```
Use this space to document anything unusual during deployment:




```

---

## Reference Documentation

- **Quick Summary:** [PRODUCTION-MIGRATION-SUMMARY.md](./PRODUCTION-MIGRATION-SUMMARY.md)
- **Full Guide:** [PRODUCTION-DEPLOYMENT.md](./PRODUCTION-DEPLOYMENT.md)
- **Troubleshooting:** [FIX_AUDIT_LOGS_FINAL.md](./FIX_AUDIT_LOGS_FINAL.md)
- **All Docs:** [MIGRATION-INDEX.md](./MIGRATION-INDEX.md)

---

**Version:** 1.0
**Last Updated:** October 7, 2025
**Next Review:** After deployment completion
