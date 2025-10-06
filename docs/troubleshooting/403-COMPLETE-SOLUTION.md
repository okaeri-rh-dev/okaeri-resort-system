# 403 RLS Error - COMPLETE SOLUTION ✅

## Summary

You had **TWO actual issues** that caused 403 errors:

1. ❌ Duplicate RLS policies (legacy + specific policies)
2. ❌ Missing table grants for `authenticated` role ← **This was the root cause!**

~~3. Wrong API key format~~ **MYTH BUSTED**: Both `sb_publishable_` and JWT keys work fine!

All issues have been fixed! ✅

---

## Key Format Clarification: Both Work! ✅

### Discovery

**MYTH BUSTED**: After fixing table grants, **BOTH key formats work** perfectly with local Supabase!

The 403 errors weren't caused by key format - they were caused by **missing table grants**.

### Both Formats Work

| Format           | Example              | Local Dev | Production     | Notes                   |
| ---------------- | -------------------- | --------- | -------------- | ----------------------- |
| **Short Format** | `sb_publishable_...` | ✅ Works  | ✅ Recommended | Cleaner, easier to read |
| **JWT Format**   | `eyJ...` (long)      | ✅ Works  | ⚠️ Legacy      | Verbose but valid       |

### Getting Keys

```bash
# Short format (recommended)
npx supabase status --output json | jq -r '.PUBLISHABLE_KEY, .SECRET_KEY'

# JWT format (also works)
npx supabase status --output json | jq -r '.ANON_KEY, .SERVICE_ROLE_KEY'

# View both
npx supabase status
```

### Current Setup (Works Fine!)

```env
# Your current .env.local uses short format - this is perfect! ✅
VITE_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
SUPABASE_SERVICE_ROLE_KEY=sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz
```

**No need to change** - use whichever format you prefer!

---

## Issue 1: Duplicate RLS Policies ❌ → ✅ FIXED

### Problem

Each table had 5 policies instead of 4:

- Legacy "Enable all for authenticated users" (using `auth.role()`)
- Specific CRUD policies (using `auth.uid()`)

### Solution Applied

Applied migration: `database/migrations/quick-fix-403-rls.sql`

Dropped legacy policies and kept only 4 clean policies per table:

- SELECT, INSERT, UPDATE, DELETE (all using `auth.uid() IS NOT NULL`)

### Verification

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "SELECT tablename, COUNT(*) FROM pg_policies WHERE schemaname = 'public' GROUP BY tablename;"
```

Expected result: **4 policies per table** ✅

---

## Issue 2: Missing Table Grants ❌ → ✅ FIXED (Root Cause!)

### Problem

The `authenticated` role had **NO permissions** on main tables (units, bookings, guests, etc.)

**Error**: `42501: permission denied for table units`

### Root Cause

PostgreSQL access control has **two layers**:

1. **Table permissions** (GRANT statements) ← **This was missing!**
2. **Row Level Security** (RLS policies)

Even with correct RLS policies, you need base table permissions.

### Solution Applied

**Created migration**: `supabase/migrations/20251006161433_ensure_table_grants.sql`

```sql
-- Grant CRUD permissions to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.units TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bookings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.guests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.expenses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.maintenance_logs TO authenticated;

-- Grant sequence usage for auto-incrementing IDs
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant full access to service_role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
```

---

## Will This Problem Come Back?

### When You Restart Local Supabase

**Answer**: **NO** ✅ (now that we created the migration)

The new migration `20251006161433_ensure_table_grants.sql` will automatically apply grants when you run:

```bash
npx supabase db reset
# or
npx supabase start
```

### To Verify After Restart

```bash
# Check migrations are applied
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;"

# Should include:
# 20251006161433 | ensure_table_grants

# Check grants exist
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "SELECT grantee, COUNT(*) FROM information_schema.role_table_grants WHERE grantee = 'authenticated' AND table_name IN ('units', 'bookings', 'guests') GROUP BY grantee;"

# Should return:
# authenticated | 12  (or more)
```

---

## Production Deployment

### Does Production Need This Fix?

**Answer**: **Maybe** - You need to check!

Your production database might already have correct grants (since the remote_schema migration was dumped from there). But you should verify.

### How to Check Production

```bash
# Option 1: Use Supabase SQL Editor
# Go to Dashboard → SQL Editor and run:
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('units', 'bookings', 'guests', 'payments', 'expenses')
  AND grantee = 'authenticated'
ORDER BY table_name, privilege_type;

# Option 2: Use psql with connection string
# Get connection string from Dashboard → Settings → Database
psql "your-production-connection-string" \
  -c "SELECT grantee, table_name FROM information_schema.role_table_grants WHERE grantee = 'authenticated';"
```

### If Production Needs Grants

**Option 1: Apply migration directly**

```bash
# Push all local migrations to production
npx supabase db push --db-url "your-production-connection-string"
```

**Option 2: Run SQL manually in Dashboard**
Copy the contents of `supabase/migrations/20251006161433_ensure_table_grants.sql` and run in SQL Editor.

**Option 3: Use Supabase CLI to link and push**

```bash
# Link to production project
npx supabase link --project-ref your-project-ref

# Push migrations
npx supabase db push
```

### Production API Keys

For production, use the **new format keys**:

```env
# Get from Supabase Dashboard → Settings → API
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...  # Use this in production!
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...     # For backend only
```

---

## Files Created/Modified

### Local Development

1. ✅ `.env.local` - Updated with correct JWT keys
2. ✅ `database/migrations/quick-fix-403-rls.sql` - RLS policy cleanup
3. ✅ `supabase/migrations/20251006161433_ensure_table_grants.sql` - **NEW** migration for grants

### Scripts/Tools

4. ✅ `scripts/show-correct-keys.sh` - Helper to display keys
5. ✅ `scripts/verify-supabase-keys.js` - JWT decoder
6. ✅ `database/migrations/verify-rls-policies.sql` - Verification queries

---

## Testing Checklist

### After Any Supabase Restart

```javascript
// 1. Check environment
await window.debug.checkEnv();
// Expected: ✅ Correct key type (anon)

// 2. Check session
await window.debug.checkSession();
// Expected: Shows your user ID and email

// 3. Test query
await window.debug.testQuery("units");
// Expected: Returns data (no 403 errors)

// 4. Full diagnostic
await window.debug.diagnose();
// Expected: All checks pass ✅
```

### Database Verification

```bash
# 1. Check policy count (should be 4 per table)
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "SELECT tablename, COUNT(*) FROM pg_policies WHERE schemaname = 'public' GROUP BY tablename;"

# 2. Check grants exist
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "SELECT grantee, table_name FROM information_schema.role_table_grants WHERE grantee = 'authenticated' LIMIT 10;"

# 3. Verify no legacy policies
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "SELECT * FROM pg_policies WHERE policyname = 'Enable all for authenticated users';"
# Expected: 0 rows
```

---

## Quick Reference

### Get Correct Keys for Local Dev

```bash
npx supabase status --output json | jq -r '.ANON_KEY, .SERVICE_ROLE_KEY'
```

### Apply All Fixes to Fresh Database

```bash
# 1. Start Supabase
npx supabase start

# 2. Migrations apply automatically
# If not, run:
npx supabase db reset

# 3. Update .env.local with JWT keys

# 4. Restart dev server
npm run dev
```

### Troubleshooting Command

```bash
# Run all verification queries
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -f database/migrations/verify-rls-policies.sql
```

---

## Related Documentation

- `docs/troubleshooting/403-rls-debugging.md` - Original debugging process
- `docs/troubleshooting/403-FIX-APPLIED.md` - RLS policy details
- `docs/troubleshooting/403-QUICK-FIX.md` - Quick reference guide
- `database/CLAUDE.md` - Database schema and RLS guidelines

---

**Status**: ✅ All issues fixed and migrations created
**Date**: 2025-10-06
**Persistence**: ✅ Fixes will persist through restarts
**Production**: ⚠️ Verify grants, apply migration if needed
