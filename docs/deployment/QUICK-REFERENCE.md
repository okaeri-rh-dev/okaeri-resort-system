# Production Migration Quick Reference

**One-Page Guide for View-Edit Routes Deployment**

---

## TL;DR - What You Need to Do

1. **Backup Database** (Supabase Dashboard)
2. **Wipe Test Data** (Run SQL script)
3. **Push to Main** (Git push)
4. **Deploy Frontend** (Vercel/Cloudflare)
5. **Verify & Monitor** (Smoke tests + logs)

---

## Pre-Flight Checklist (5 minutes)

```bash
# Run these locally
npm run verify       # ✅ All tests pass
npm run build        # ✅ Build succeeds
git status           # ✅ Clean working tree
```

---

## Step 1: Backup (10 minutes)

**Supabase Dashboard:**

1. Go to: **Database → Backups**
2. Click: **"Create Manual Backup"**
3. Label: `pre-view-edit-migration-2025-10-07`
4. Wait for completion
5. **Download backup file**

**Verify:**

```sql
-- Check current data
SELECT 'bookings' as table, COUNT(*) FROM bookings
UNION ALL SELECT 'units', COUNT(*) FROM units;
```

---

## Step 2: Wipe Test Data (5 minutes)

**Supabase SQL Editor:**

```sql
-- OPTIONAL: Test compatibility first (safe, read-only)
-- Run: database/migrations/TEST-018-compatibility.sql
-- Expected: ✅ ALL COMPATIBILITY TESTS PASSED

-- Then run the actual wipe:
-- Copy from: database/migrations/018-production-wipe-test-data.sql
-- Paste into SQL Editor
-- Click "Run" (or press RUN button)
-- Expected output: ✅ PRODUCTION WIPE COMPLETE
```

**Quick Manual Wipe (Alternative):**

```sql
BEGIN;
TRUNCATE TABLE payments CASCADE;
TRUNCATE TABLE bookings CASCADE;
TRUNCATE TABLE guests CASCADE;

-- Verify
SELECT COUNT(*) FROM bookings; -- Should be 0
SELECT COUNT(*) FROM units;    -- Should be > 0

COMMIT;
```

---

## Step 3: Deploy Code (2 minutes)

```bash
# Push to GitHub
git push origin main

# Deploy to Vercel
vercel --prod

# Or wait for auto-deploy
```

**Set Environment Variables (Vercel Dashboard):**

- `VITE_SUPABASE_URL` = `https://[project-id].supabase.co`
- `VITE_SUPABASE_ANON_KEY` = `[your-anon-key]`

---

## Step 4: Smoke Tests (10 minutes)

**Test Checklist:**

- [ ] Login works
- [ ] Dashboard loads
- [ ] Create booking
- [ ] View booking detail (`/bookings/[id]`)
- [ ] Edit booking (`/bookings/[id]/edit`)
- [ ] Click guest link → Guest detail loads
- [ ] Click unit link → Unit detail loads
- [ ] Audit trail displays

---

## Step 5: Verify Database (2 minutes)

```sql
-- Run: database/scripts/verify-production-state.sql
-- OR quick check:

SELECT
  (SELECT COUNT(*) FROM bookings) as bookings,
  (SELECT COUNT(*) FROM payments) as payments,
  (SELECT COUNT(*) FROM guests) as guests,
  (SELECT COUNT(*) FROM units) as units,
  (SELECT COUNT(*) FROM audit_logs) as audit_logs;

-- Expected: bookings/payments/guests = 0 (or 1 if test booking created)
-- Expected: units > 0, audit_logs > 0
```

---

## Emergency Rollback (15 minutes)

**If something goes wrong:**

### Option A: Database Restore

1. Supabase Dashboard → **Database → Backups**
2. Find: `pre-view-edit-migration-2025-10-07`
3. Click: **Restore**
4. Wait: 5-10 minutes

### Option B: Frontend Rollback

1. Vercel Dashboard → **Deployments**
2. Find previous deployment
3. Click: **"..." → "Promote to Production"**

### Option C: Git Revert

```bash
git revert HEAD
git push origin main
```

---

## Monitoring Commands

```bash
# Check Vercel logs
vercel logs [deployment-url] --follow

# Check database connection
psql $DATABASE_URL -c "SELECT COUNT(*) FROM bookings;"

# Run emergency diagnostic
psql $DATABASE_URL -f database/scripts/emergency-rollback.sql
```

---

## What Gets Deleted

| Table        | Action       | Reason                |
| ------------ | ------------ | --------------------- |
| `bookings`   | ❌ DELETED   | Test data             |
| `payments`   | ❌ DELETED   | CASCADE from bookings |
| `guests`     | ❌ DELETED   | Test data             |
| `units`      | ✅ PRESERVED | Room configurations   |
| `expenses`   | ✅ PRESERVED | Financial records     |
| `audit_logs` | ✅ PRESERVED | Compliance history    |

---

## Foreign Key Cascade Effects

```
bookings (TRUNCATE)
  ↓ ON DELETE CASCADE
payments (auto-deleted)

bookings → guests
  ↓ ON DELETE SET NULL
guests.guest_id = NULL (but we truncate guests anyway)

bookings → units
  ↓ ON DELETE RESTRICT
units (protected, cannot delete if bookings exist)
```

---

## Success Indicators

**✅ Deployment Successful:**

- Vercel deployment status: "Ready"
- No 500 errors in logs
- Response times < 200ms
- Login works

**✅ Database Healthy:**

- `bookings` table: 0 rows (or 1 after test)
- `units` table: >0 rows
- No orphaned payments
- Audit logs accumulating

**✅ Frontend Working:**

- Detail pages load
- Edit forms save
- Navigation links work
- Breadcrumbs functional
- Mobile responsive

---

## Failure Indicators

**❌ Rollback Immediately If:**

- Cannot create bookings
- Database connection errors
- Missing units table
- Data corruption (orphaned records)
- Security breach detected

**⚠️ Investigate If:**

- Slow page loads (>2s)
- Intermittent errors
- Audit logs not updating
- Edit forms not saving

---

## Key Files Reference

| File                                                    | Purpose                        | When to Use          |
| ------------------------------------------------------- | ------------------------------ | -------------------- |
| `database/migrations/018-production-wipe-test-data.sql` | Wipe test data                 | Before deployment    |
| `database/scripts/verify-production-state.sql`          | Comprehensive validation       | After deployment     |
| `database/scripts/emergency-rollback.sql`               | Diagnostic & rollback guidance | Emergency only       |
| `docs/deployment/PRODUCTION-MIGRATION-CHECKLIST.md`     | Full detailed guide            | Planning & execution |

---

## Common Issues & Fixes

### Issue: 404 on Detail Pages

**Fix:** Clear browser cache, verify routing deployed

### Issue: Audit Logs Not Displaying

**Fix:** Check RLS policies, verify triggers active

### Issue: Cannot Create Bookings

**Fix:** Verify units exist, check RLS permissions

### Issue: Database Timeout

**Fix:** Check connection pool, restart app

---

## Timeline

| Phase     | Duration           | Action                 |
| --------- | ------------------ | ---------------------- |
| Backup    | 10 min             | Create & verify backup |
| Wipe      | 5 min              | Truncate test data     |
| Deploy    | 2 min              | Push code & deploy     |
| Verify    | 10 min             | Smoke tests            |
| Monitor   | 4 hrs              | Watch for errors       |
| **Total** | **~30 min active** | **+ 4 hrs monitoring** |

---

## Contact Information

**Emergency Contacts:**

- Developer On-Call: [Your Phone]
- Team Lead: [Lead Phone]
- Supabase Support: support@supabase.com

**Communication:**

- Slack: #deployments
- Email: team@okaeri.com

---

## Post-Deployment Actions

### Immediate (Day 1)

- [ ] Create first real booking
- [ ] Monitor error rates (every 30 min)
- [ ] Check audit logs
- [ ] Update team

### Week 1

- [ ] Collect user feedback
- [ ] Review performance metrics
- [ ] Document lessons learned

---

## Emergency Commands Cheat Sheet

```bash
# Check deployment status
vercel ls
vercel inspect [url]

# View logs in real-time
vercel logs [url] --follow

# Database quick check
psql $DATABASE_URL -c "SELECT version();"

# Export emergency backup
pg_dump $DATABASE_URL > emergency_backup_$(date +%Y%m%d_%H%M%S).sql

# Count records
psql $DATABASE_URL -c "SELECT 'bookings', COUNT(*) FROM bookings UNION ALL SELECT 'units', COUNT(*) FROM units;"

# Check for errors
psql $DATABASE_URL -c "SELECT * FROM audit_logs WHERE severity IN ('ERROR', 'CRITICAL') ORDER BY created_at DESC LIMIT 10;"
```

---

## Decision Tree

```
Is there an emergency?
│
├─ YES → Run emergency-rollback.sql → Review diagnostics → Decide action
│   ├─ Data corruption? → RESTORE BACKUP IMMEDIATELY
│   ├─ Missing units? → RESTORE BACKUP IMMEDIATELY
│   └─ Frontend issue? → Rollback deployment only
│
└─ NO → Continue monitoring
    ├─ Errors increasing? → Investigate logs
    ├─ Performance slow? → Check database queries
    └─ All good? → Continue normal ops
```

---

## Remember

1. **Backup is your safety net** - Always verify it exists and is downloadable
2. **Test data is expendable** - Production bookings are not
3. **Monitor closely for 48 hours** - First 4 hours are critical
4. **Document everything** - Update audit logs and team
5. **When in doubt, rollback** - Better safe than sorry

---

**Last Updated:** October 7, 2025
**Version:** 1.0
**Next Review:** After deployment completion
