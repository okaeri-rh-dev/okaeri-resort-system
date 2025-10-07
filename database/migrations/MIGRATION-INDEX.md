# Migration Documentation Index

This directory contains all migration scripts and documentation for deploying database changes to production.

---

## 🚀 Quick Start (For Production Deploy)

**Need to deploy changes from commit `f3da057` onwards?**

1. **Start here:** [PRODUCTION-MIGRATION-SUMMARY.md](./PRODUCTION-MIGRATION-SUMMARY.md) (2-page quick reference)
2. **Full details:** [PRODUCTION-DEPLOYMENT.md](./PRODUCTION-DEPLOYMENT.md) (Comprehensive 379-line guide)
3. **Execute:** Migrations 016 and 017 via Supabase SQL Editor

**Estimated time:** 5 minutes | **Downtime:** None

---

## 📚 Documentation Hierarchy

### Level 1: Executive Summary (Start Here)

- **[PRODUCTION-MIGRATION-SUMMARY.md](./PRODUCTION-MIGRATION-SUMMARY.md)**
  - 2-page quick reference
  - Critical migrations 016 & 017
  - Quick deployment steps
  - Verification commands
  - Rollback procedures

### Level 2: Comprehensive Guide

- **[PRODUCTION-DEPLOYMENT.md](./PRODUCTION-DEPLOYMENT.md)**
  - Complete migration sequence (001-017)
  - PostgreSQL security architecture
  - Detailed verification queries
  - Troubleshooting guide
  - Success criteria checklist

### Level 3: Root Cause & Troubleshooting

- **[FIX_AUDIT_LOGS_FINAL.md](./FIX_AUDIT_LOGS_FINAL.md)**
  - Why STABLE attribute matters
  - PostgreSQL function volatility explained
  - Technical deep dive

- **[APPLY_FIX_README.md](./APPLY_FIX_README.md)**
  - Quick fix walkthrough
  - Browser testing steps
  - Common issues and solutions

### Level 4: Historical Context

- **[README.md](./README.md)**
  - Phase 2 critical fixes (migrations 001-003)
  - Payment status and unit type fixes
  - Guest statistics triggers

- **[README-DEPLOYMENT.md](./README-DEPLOYMENT.md)**
  - Migration 004: Occupancy pricing
  - Business impact and testing checklist

---

## 🔍 Find What You Need

### "I need to deploy to production NOW"

→ [PRODUCTION-MIGRATION-SUMMARY.md](./PRODUCTION-MIGRATION-SUMMARY.md)

### "I want to understand the full migration history"

→ [PRODUCTION-DEPLOYMENT.md](./PRODUCTION-DEPLOYMENT.md)

### "Users are getting permission denied errors"

→ [FIX_AUDIT_LOGS_FINAL.md](./FIX_AUDIT_LOGS_FINAL.md)

### "I need to troubleshoot RLS issues"

→ [APPLY_FIX_README.md](./APPLY_FIX_README.md)

### "I want to understand early migrations"

→ [README.md](./README.md) and [README-DEPLOYMENT.md](./README-DEPLOYMENT.md)

---

## 📁 Migration Files Structure

### Critical Migrations (Commit `f3da057` → `HEAD`)

```
016-fix-helper-functions-stability.sql     # Add STABLE to RLS helpers
017-grant-authenticated-permissions.sql    # Table-level GRANT permissions
```

### Core System Migrations (Already Applied)

```
001-fix-payment-status.sql                 # Payment status enum fix
002-fix-unit-types.sql                     # Unit type constraints
003-add-guest-statistics-triggers.sql      # Guest stats automation
004-add-occupancy-pricing.sql              # Occupancy-based pricing
005-create-audit-logs.sql                  # Audit trail tables
006-create-audit-triggers.sql              # Audit trigger functions
007-create-audit-indexes.sql               # Performance indexes
008-create-audit-archive.sql               # Audit archival system
009-enable-audit-rls.sql                   # RLS policies (initial)
010-bootstrap-admin.sql                    # Bootstrap admin user
011-verify-audit-system.sql                # Verification queries (optional)
012-fix-app-roles-rls-recursion.sql        # Security definer helpers
013-guest-booking-schema.sql               # Guest booking tables
014-guest-booking-exclusion-constraint-with-cleanup.sql  # Booking conflict prevention
015-secure-conflict-backup-table.sql       # Backup table security
```

### Helper Scripts

```
run-migrations.sql                         # Batch migration runner (001-003)
run-audit-migrations.sh                    # Audit system migration runner
rollback-audit-migrations.sh               # Audit system rollback
verify-audit-system.sh                     # Audit verification script
```

### Rollback Scripts

```
rollback/
  ├── rollback-001-payment-status.sql
  ├── rollback-002-unit-types.sql
  └── rollback-003-guest-triggers.sql
```

---

## ✅ Pre-Deployment Checklist

Before running migrations in production:

- [ ] Review [PRODUCTION-MIGRATION-SUMMARY.md](./PRODUCTION-MIGRATION-SUMMARY.md)
- [ ] Backup production database via Supabase Dashboard
- [ ] Verify current migration status in production
- [ ] Schedule maintenance window (if needed)
- [ ] Team available for post-deployment monitoring
- [ ] Rollback procedure understood and tested

---

## 🎯 Success Criteria

After deployment, verify:

✅ Migrations 016 & 017 executed successfully
✅ Helper functions marked as `STABLE`
✅ Table grants visible for `authenticated` role
✅ Booking detail pages display audit logs
✅ No "permission denied" errors in browser
✅ Verification queries return expected results

---

## 🆘 Troubleshooting

### Issue: "Permission denied for table audit_logs"

→ See [FIX_AUDIT_LOGS_FINAL.md](./FIX_AUDIT_LOGS_FINAL.md)

### Issue: "RLS policy returns no rows"

→ Check helper function volatility in [PRODUCTION-DEPLOYMENT.md](./PRODUCTION-DEPLOYMENT.md)

### Issue: "Edit page shows detail page"

→ Application routing issue (not database), check route configuration

### General troubleshooting

→ [PRODUCTION-DEPLOYMENT.md](./PRODUCTION-DEPLOYMENT.md) Section: "Support & Troubleshooting"

---

## 📊 Migration Status Tracking

To check which migrations have been applied:

```sql
-- Check migration history (if tracking table exists)
SELECT * FROM schema_migrations ORDER BY applied_at DESC;

-- Check function volatility (verifies migration 016)
SELECT proname,
  CASE provolatile
    WHEN 's' THEN 'STABLE ✅'
    WHEN 'v' THEN 'VOLATILE ❌'
  END as volatility
FROM pg_proc
WHERE proname IN ('is_admin_or_owner', 'is_manager', 'is_admin');

-- Check table grants (verifies migration 017)
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_name IN ('audit_logs', 'audit_logs_archive', 'app_roles')
  AND grantee = 'authenticated';
```

---

## 🔒 Security Notes

- **SECURITY DEFINER functions** bypass RLS (by design, safe in our use case)
- **Table-level GRANTs** are required in addition to RLS policies
- **STABLE attribute** preserves auth context during policy evaluation
- All audit events are logged with user_id and IP address

---

## 🚨 Emergency Contacts

If deployment issues occur:

1. **Rollback immediately** using commands in [PRODUCTION-MIGRATION-SUMMARY.md](./PRODUCTION-MIGRATION-SUMMARY.md)
2. **Check Supabase logs** in Dashboard → Logs
3. **Run verification queries** to diagnose specific issues
4. **Review error messages** in browser console

---

## 📝 Maintenance

### Adding New Migrations

1. Create migration file: `XXX-descriptive-name.sql`
2. Add to migration sequence in PRODUCTION-DEPLOYMENT.md
3. Test in development environment
4. Document in PRODUCTION-MIGRATION-SUMMARY.md if critical
5. Update this index file

### Documentation Standards

- **Critical migrations**: Update PRODUCTION-MIGRATION-SUMMARY.md
- **Complex changes**: Add dedicated troubleshooting guide
- **Breaking changes**: Document rollback procedure
- **All migrations**: Include verification queries

---

## 📅 Version History

| Date       | Commit   | Migrations | Documentation Added                                                    |
| ---------- | -------- | ---------- | ---------------------------------------------------------------------- |
| 2025-10-07 | 9c30e20  | 016-017    | PRODUCTION-DEPLOYMENT.md, FIX_AUDIT_LOGS_FINAL.md, APPLY_FIX_README.md |
| 2025-10-07 | bdc7547  | -          | PRODUCTION-MIGRATION-SUMMARY.md, README-PRODUCTION.md (this file)      |
| 2025-10-06 | e6b1e48  | -          | Route structure changes (non-database)                                 |
| 2025-10-05 | Previous | 001-015    | README.md, README-DEPLOYMENT.md                                        |

---

**Last Updated:** October 7, 2025
**Maintained By:** Okaeri Resort System Development Team
