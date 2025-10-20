# Production Migration Checklist: View-Edit Routes Deployment

**Date**: October 7, 2025
**Migration**: View-Edit Routes + Test Data Wipe
**Risk Level**: MEDIUM (data deletion, but test data only)
**Estimated Time**: 2-3 hours
**Rollback Time**: 15 minutes

---

## Overview

This migration deploys the view-edit routes feature and clears all test bookings data to prepare for production use. The migration is **frontend-focused** with no database schema changes.

### What Changes:

- ✅ Frontend: New detail and edit pages for all entities
- ✅ Routing: TanStack Router with new routes
- ✅ Database: Test data cleared (bookings, payments, guests)

### What Stays the Same:

- ✅ Database schema (no migrations)
- ✅ Units configuration
- ✅ Expenses records
- ✅ Audit logs
- ✅ User roles and permissions

---

## Pre-Deployment Checklist

### Development Environment

- [ ] All tests passing

  ```bash
  npm run verify
  ```

- [ ] Build succeeds

  ```bash
  npm run build
  ```

- [ ] No TypeScript errors

  ```bash
  npm run type-check
  ```

- [ ] No linting errors

  ```bash
  npm run lint
  ```

- [ ] View-edit documentation committed
  ```bash
  git status
  git log --oneline -3
  ```

### Production Environment Setup

- [ ] Production Supabase URL obtained
  - Dashboard: https://supabase.com/dashboard/project/[project-id]/settings/api
  - Copy "Project URL"

- [ ] Production Supabase anon key obtained
  - Dashboard: https://supabase.com/dashboard/project/[project-id]/settings/api
  - Copy "anon public" key

- [ ] `.env.production.local` created (DO NOT COMMIT)

  ```bash
  cat > .env.production.local << 'EOF'
  VITE_SUPABASE_URL=https://[project-id].supabase.co
  VITE_SUPABASE_ANON_KEY=[your-anon-key]
  EOF
  ```

- [ ] Vercel/Cloudflare environment variables configured
  - Add `VITE_SUPABASE_URL`
  - Add `VITE_SUPABASE_ANON_KEY`

### Team Coordination

- [ ] Team notified of deployment window
- [ ] No critical bookings in flight (test data only)
- [ ] Team available for 48h monitoring window

---

## Database Backup (CRITICAL)

### Step 1: Create Manual Backup

**Via Supabase Dashboard:**

1. Navigate to: **Database → Backups**
2. Click **"Create Manual Backup"**
3. Label: `pre-view-edit-migration-2025-10-07`
4. Wait for completion (5-10 minutes)
5. **Download backup file** to local machine

**Verification:**

- [ ] Backup status: "Completed"
- [ ] Backup file size > 0 MB
- [ ] Backup file downloaded successfully

### Step 2: Verify Backup Integrity

**Via Supabase SQL Editor:**

```sql
-- Check current table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Expected Output:**

- [ ] Units table has rows (your room configurations)
- [ ] Bookings table has rows (test data to be deleted)
- [ ] Payments table has rows (will be cascade deleted)
- [ ] Guests table may have rows (will be deleted)

---

## Database Wipe (DESTRUCTIVE)

### ⚠️ CRITICAL WARNING

**YOU ARE ABOUT TO DELETE:**

- ✅ All bookings (test data)
- ✅ All payments (cascade from bookings)
- ✅ All guests (test data, resets statistics)

**YOU ARE PRESERVING:**

- ✅ All units (room configurations)
- ✅ All expenses
- ✅ All audit logs
- ✅ All user roles

### Step 1: Run Wipe Script

**Optional Pre-Test (Recommended):**

1. Open `database/migrations/TEST-018-compatibility.sql`
2. Copy entire contents
3. Paste into Supabase SQL Editor
4. Click "Run"
5. Verify output: `✅ ALL COMPATIBILITY TESTS PASSED`
6. This confirms Supabase SQL Editor compatibility (read-only, safe)

**Via Supabase SQL Editor:**

1. Open `database/migrations/018-production-wipe-test-data.sql`
2. Copy entire contents
3. Paste into Supabase SQL Editor
4. **READ THE SCRIPT WARNINGS**
5. Click "Run" button

**Script Actions:**

- Displays pre-wipe snapshot
- Checks if deleting > 100 bookings (5 second warning)
- Truncates `payments` table
- Truncates `bookings` table
- Truncates `guests` table
- Verifies all target tables empty
- Preserves units, expenses, audit_logs
- Creates audit log entry
- Commits transaction

**Expected Output:**

```
✓ Payments table truncated
✓ Bookings table truncated
✓ Guests table truncated
✓ All validations passed
✓ Audit log entry created
✅ PRODUCTION WIPE COMPLETE
```

### Step 2: Verify Wipe Success

**Via Supabase SQL Editor:**

```sql
-- Quick verification
SELECT
  'bookings' as table_name, COUNT(*) as count FROM bookings
UNION ALL
SELECT 'payments', COUNT(*) FROM payments
UNION ALL
SELECT 'guests', COUNT(*) FROM guests
UNION ALL
SELECT 'units', COUNT(*) FROM units;
```

**Expected Results:**

- [ ] bookings: 0
- [ ] payments: 0
- [ ] guests: 0
- [ ] units: > 0 (your rooms still exist)

### Step 3: Run Comprehensive Validation

**Via Supabase SQL Editor:**

1. Open `database/scripts/verify-production-state.sql`
2. Copy entire contents
3. Paste into Supabase SQL Editor
4. Click "Run"

**Expected Output:**

- [ ] ✅ All expected tables exist
- [ ] ✅ Foreign key constraints valid
- [ ] ✅ RLS enabled on critical tables
- [ ] ✅ Triggers active
- [ ] ✅ Indexes present
- [ ] ✅ Units configuration preserved

---

## Code Deployment

### Step 1: Push to Main Branch

```bash
# Final verification
git status
git log --oneline -3

# Push to main
git push origin main
```

### Step 2: Monitor GitHub Actions (if configured)

**If you have CI/CD workflows:**

- [ ] Check GitHub Actions tab
- [ ] Verify build passes
- [ ] Verify tests pass
- [ ] Verify deployment triggers

### Step 3: Deploy Frontend

**Option A: Vercel**

```bash
# Deploy via CLI
vercel --prod

# Or trigger via Dashboard:
# 1. Go to Vercel Dashboard
# 2. Find your project
# 3. Click "Deploy"
# 4. Confirm production deployment
```

**Option B: Cloudflare Pages**

```bash
# Automatic deployment on git push
# Monitor in Cloudflare Dashboard:
# Workers & Pages → Pages → [your-app] → Deployments
```

**Verification:**

- [ ] Deployment status: Success
- [ ] Environment variables set correctly
- [ ] Build logs show no errors
- [ ] Deployment URL accessible

---

## Post-Deployment Validation

### Step 1: Smoke Tests (Manual)

**Open production app:**

- [ ] **Login works**
  - Navigate to login page
  - Enter credentials
  - Verify successful authentication

- [ ] **Dashboard loads**
  - No console errors
  - No 404s
  - Statistics display (all zeros expected)

- [ ] **Create test booking**
  - Navigate to Bookings → New Booking
  - Fill form with test data
  - Submit successfully
  - Note the booking ID

- [ ] **View booking detail page**
  - Click booking reference in table
  - URL: `/bookings/[booking-id]`
  - All sections display correctly
  - Breadcrumbs work
  - Guest/unit links present

- [ ] **Edit booking**
  - Click "Edit" button on detail page
  - URL: `/bookings/[booking-id]/edit`
  - Form loads with current values
  - Make a change
  - Save successfully
  - Redirects back to detail page

- [ ] **Navigation tests**
  - Click guest name → Guest detail page loads
  - Click unit name → Unit detail page loads
  - Click breadcrumbs → Navigate back
  - Use browser back button → Works correctly

- [ ] **Audit trail**
  - Scroll to audit section on detail page
  - Verify logs appear for booking creation
  - Verify logs appear for booking update
  - Check timestamps are correct

### Step 2: Database Verification

**Via Supabase SQL Editor:**

```sql
-- Check first production booking created
SELECT
  booking_reference,
  guest_name,
  check_in,
  check_out,
  total_amount,
  booking_status,
  created_at
FROM bookings
ORDER BY created_at DESC
LIMIT 1;

-- Check audit logs are being created
SELECT
  table_name,
  action,
  event_type,
  description,
  created_at
FROM audit_logs
WHERE table_name = 'bookings'
ORDER BY created_at DESC
LIMIT 5;

-- Verify units still intact
SELECT
  unit_code,
  unit_name,
  unit_status
FROM units
ORDER BY unit_code;
```

**Expected:**

- [ ] New booking appears
- [ ] Audit logs created for booking actions
- [ ] Units table unchanged

### Step 3: Mobile Testing

**Test on mobile device or browser dev tools:**

- [ ] Responsive layout works (<768px)
- [ ] Detail pages display correctly
- [ ] Edit forms usable on mobile
- [ ] Breadcrumbs readable
- [ ] Navigation smooth
- [ ] Touch targets adequate (44x44px)

### Step 4: Error Monitoring

**Check Vercel/Cloudflare Logs:**

```bash
# Vercel CLI
vercel logs [deployment-url] --follow

# Or via Dashboard:
# Project → Deployments → [latest] → Logs
```

**Expected:**

- [ ] No 500 errors
- [ ] No 404s (except expected)
- [ ] Response times < 200ms
- [ ] No CORS errors

**Check Browser Console:**

- [ ] No TypeScript errors
- [ ] No React errors
- [ ] No network failures
- [ ] No authentication errors

---

## Monitoring Window (48 Hours)

### Immediate Monitoring (First 4 Hours)

**Check every 30 minutes:**

- [ ] Application accessible
- [ ] No error spikes in logs
- [ ] No database connection issues
- [ ] No user reports of issues

**Monitor Metrics:**

- API response times (< 200ms target)
- Database connection pool usage
- Error rate (< 1% target)
- Page load times (< 2s target)

### Extended Monitoring (Next 44 Hours)

**Check every 4 hours:**

- [ ] No accumulated errors
- [ ] No performance degradation
- [ ] Audit logs accumulating normally
- [ ] No data integrity issues

**Database Health Checks:**

```sql
-- Run every 12 hours
SELECT
  COUNT(*) as total_bookings,
  COUNT(DISTINCT guest_id) as unique_guests,
  SUM(total_amount) as total_revenue
FROM bookings
WHERE created_at >= NOW() - INTERVAL '48 hours';

-- Check for any errors in audit logs
SELECT
  severity,
  COUNT(*)
FROM audit_logs
WHERE created_at >= NOW() - INTERVAL '48 hours'
GROUP BY severity;
```

---

## Rollback Procedure (Emergency)

### When to Rollback

**Trigger rollback if:**

- Critical bugs preventing bookings
- Data corruption detected
- Performance degradation > 50%
- Security vulnerability discovered
- Database connection failures

### Rollback Steps

#### Step 1: Database Rollback

**Via Supabase Dashboard:**

1. Go to **Database → Backups**
2. Find backup: `pre-view-edit-migration-2025-10-07`
3. Click **"Restore"**
4. Confirm restoration
5. Wait 5-10 minutes
6. Verify restoration complete

**Verification:**

```sql
-- Check if test bookings are restored
SELECT COUNT(*) FROM bookings;
-- Should match pre-wipe count

-- Verify no data loss
SELECT * FROM units ORDER BY unit_code;
-- All units should be present
```

#### Step 2: Frontend Rollback

**Option A: Via Vercel Dashboard**

1. Go to **Deployments**
2. Find previous working deployment
3. Click **"..."** → **"Promote to Production"**
4. Confirm promotion

**Option B: Via Git Revert**

```bash
# Revert the commit
git revert HEAD
git push origin main

# Or reset to previous commit (DANGEROUS)
git reset --hard HEAD~1
git push origin main --force
```

**Verification:**

- [ ] Old version deployed
- [ ] Application accessible
- [ ] No view-edit routes present
- [ ] Data intact

#### Step 3: Post-Rollback Validation

- [ ] Run smoke tests on old version
- [ ] Verify database consistency
- [ ] Check audit logs
- [ ] Notify team of rollback

#### Step 4: Root Cause Analysis

**Document the issue:**

1. What went wrong?
2. When was it detected?
3. What was the impact?
4. What data was affected?
5. How was it fixed?

**Create GitHub issue:**

- Title: `[PRODUCTION] Rollback: View-Edit Routes`
- Label: `bug`, `production`, `high-priority`
- Assign to team lead
- Include logs and error messages

---

## Success Criteria

### Functionality ✅

- [ ] All view-edit routes accessible
- [ ] Detail pages display correctly
- [ ] Edit pages save successfully
- [ ] Navigation links work
- [ ] Breadcrumbs functional
- [ ] Audit trails visible

### Data Integrity ✅

- [ ] No data loss (units preserved)
- [ ] Test data cleared successfully
- [ ] Audit logs intact
- [ ] Foreign keys valid
- [ ] RLS enforced

### Performance ✅

- [ ] Page loads < 2 seconds
- [ ] API responses < 200ms
- [ ] Database queries < 100ms
- [ ] No connection pool exhaustion

### Security ✅

- [ ] Authentication required
- [ ] RLS policies active
- [ ] No unauthorized access
- [ ] Audit logging working
- [ ] XSS prevention (DOMPurify)

---

## Post-Migration Tasks

### Immediate (Day 1)

- [ ] Create first real booking (test with actual guest)
- [ ] Document any issues encountered
- [ ] Update team on deployment status
- [ ] Monitor error rates closely

### Short-term (Week 1)

- [ ] Collect user feedback
- [ ] Review audit logs for anomalies
- [ ] Optimize slow queries (if any)
- [ ] Update documentation with lessons learned

### Long-term (Month 1)

- [ ] Analyze usage patterns
- [ ] Review performance metrics
- [ ] Plan next feature deployment
- [ ] Conduct security audit

---

## Contact Information

### On-Call Support

**Primary**: [Your Name]
**Secondary**: [Backup Name]

### Escalation Path

1. Developer on-call → Review logs, attempt fix
2. Team Lead → Decide on rollback
3. Database Admin → Handle data issues
4. CTO → Critical production issues

### Communication Channels

- **Slack**: #deployments
- **Email**: team@okaeri.com
- **Phone**: [Emergency contact]

---

## Appendix

### Useful Commands

```bash
# Check deployment status
vercel ls
vercel inspect [deployment-url]

# View logs
vercel logs [deployment-url] --follow

# Check database connection
psql $DATABASE_URL -c "SELECT version();"

# Run verification script
psql $DATABASE_URL -f database/scripts/verify-production-state.sql
```

### Common Issues

**Issue**: 404 on detail pages
**Solution**: Clear browser cache, verify routing config

**Issue**: Audit logs not displaying
**Solution**: Check RLS policies, verify audit triggers

**Issue**: Edit form not saving
**Solution**: Check validation errors, verify API connection

**Issue**: Database connection timeout
**Solution**: Check connection pool, restart Supabase proxy

---

## Sign-Off

### Pre-Deployment Review

- [ ] Migration plan reviewed: **\*\***\_\_\_**\*\***
- [ ] Backup verified: **\*\***\_\_\_**\*\***
- [ ] Team notified: **\*\***\_\_\_**\*\***

**Approved by**: **\*\***\_\_\_**\*\***
**Date**: **\*\***\_\_\_**\*\***

### Post-Deployment Review

- [ ] Deployment successful: **\*\***\_\_\_**\*\***
- [ ] Validation passed: **\*\***\_\_\_**\*\***
- [ ] Monitoring active: **\*\***\_\_\_**\*\***

**Completed by**: **\*\***\_\_\_**\*\***
**Date**: **\*\***\_\_\_**\*\***

---

**Document Version**: 1.0
**Last Updated**: October 7, 2025
**Next Review**: After deployment completion
