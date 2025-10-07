# Fix Audit Logs Permission Denied Error

## Quick Start

### Problem

- ❌ Error: "permission denied for table audit_logs"
- ❌ Audit logs not visible on booking detail pages
- ✅ User has admin role in `app_roles` table
- ❌ Migration 012 (RLS fix) was never applied

### Solution (5 minutes)

1. **Open Supabase SQL Editor**
   - Go to your Supabase Dashboard
   - Click "SQL Editor" in left sidebar

2. **Run the Migration**
   - Open file: `database/migrations/apply-012-fix-audit-rls.sql`
   - Copy entire contents
   - Paste into Supabase SQL Editor
   - Click "Run" button

3. **Verify Success**
   The script includes automatic verification tests at the end.
   You should see:

   ```
   ✅ Migration 012 Applied Successfully
   ```

4. **Refresh Your App**
   - Hard refresh browser: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
   - Navigate to any booking detail page
   - Audit logs section should now be visible

---

## What This Fixes

### Root Cause

Migration 009 created RLS policies with **recursive database queries**:

```sql
-- Old policy (infinite recursion)
CREATE POLICY ON audit_logs USING (
    EXISTS (
        SELECT 1 FROM app_roles
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- Problem: app_roles also has RLS that queries app_roles
-- Result: PostgreSQL detects infinite loop → blocks query → permission denied
```

### The Fix (Migration 012)

Creates **SECURITY DEFINER** functions that bypass RLS:

```sql
-- New helper function (no recursion)
CREATE FUNCTION is_admin_or_owner(user_id UUID)
SECURITY DEFINER -- bypasses RLS
AS $$ ... $$;

-- New policy (uses helper)
CREATE POLICY ON audit_logs USING (
    is_admin_or_owner(auth.uid())  -- No recursion!
);
```

**SECURITY DEFINER** = Function runs with creator's privileges, bypassing RLS policies and breaking the recursion chain.

---

## Verification Steps

### 1. Check Functions Were Created

Run in SQL Editor:

```sql
SELECT proname, prosecdef
FROM pg_proc
WHERE proname IN ('is_admin_or_owner', 'is_manager', 'is_admin');
```

Expected: 3 rows with `prosecdef = true`

### 2. Test Your Admin Status

```sql
SELECT is_admin_or_owner(auth.uid());
```

Expected: `true`

### 3. Test Audit Logs Access

```sql
SELECT COUNT(*) FROM audit_logs;
```

Expected: A number (not a permission error)

### 4. Check Policies Updated

```sql
SELECT tablename, policyname
FROM pg_policies
WHERE tablename = 'audit_logs';
```

Expected: Should see policies with updated definitions

---

## Troubleshooting

### Still Getting Permission Denied?

**Check 1: Verify your session**

```sql
SELECT auth.uid(), auth.email();
```

Should return your UUID and email. If NULL, you're not authenticated.

**Check 2: Verify your role exists**

```sql
SELECT * FROM app_roles WHERE user_id = auth.uid();
```

Should return 1 row with `role = 'admin'` and `is_active = true`

**Check 3: Test function directly**

```sql
SELECT is_admin_or_owner('bc8e12ec-da3f-4021-8a34-9ed3c2f8c5d3');
-- Replace with your actual user_id
```

Should return `true`

**Check 4: Browser cache**

- Hard refresh: `Cmd+Shift+R` or `Ctrl+Shift+R`
- Or clear browser cache completely
- Or try incognito/private mode

**Check 5: Application cache**

```javascript
// In browser console
localStorage.clear();
location.reload();
```

### Functions Already Exist Error

If you get "function already exists", that's OK! The script uses `CREATE OR REPLACE` which updates existing functions.

### Migration Fails Midway

The entire migration is wrapped in `BEGIN/COMMIT`, so if any part fails, nothing changes. Check the error message and fix the specific issue.

### Rollback (if needed)

To revert to original policies:

```sql
-- Re-run migration 009
\i database/migrations/009-enable-audit-rls.sql
```

---

## Architecture Deep Dive

### Why RLS Recursion Happens

1. **Query audit_logs** → RLS policy checks if user is admin
2. **RLS queries app_roles** → app_roles RLS policy checks if user is admin
3. **RLS queries app_roles AGAIN** → infinite loop
4. **PostgreSQL safety mechanism** → detects recursion → blocks query → permission denied error

### How SECURITY DEFINER Breaks Recursion

```sql
-- Regular function (subject to RLS)
CREATE FUNCTION check_admin(uid UUID) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM app_roles WHERE user_id = uid);
    -- This query goes through RLS → recursion!
END;
$$;

-- SECURITY DEFINER function (bypasses RLS)
CREATE FUNCTION is_admin(uid UUID) RETURNS BOOLEAN
SECURITY DEFINER  -- <-- Key difference
AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM app_roles WHERE user_id = uid);
    -- This query SKIPS RLS → no recursion!
END;
$$;
```

**Security Consideration**: SECURITY DEFINER is safe here because:

- Function logic is simple and controlled (just checks role)
- No user input is directly passed to SQL (parameterized query)
- Function doesn't expose sensitive data (just returns boolean)
- Only used internally by RLS policies

---

## Related Files

- `database/migrations/009-enable-audit-rls.sql` - Original (broken) policies
- `database/migrations/012-fix-app-roles-rls-recursion.sql` - Full migration
- `database/migrations/apply-012-fix-audit-rls.sql` - This fix (simplified)
- `src/lib/audit-roles.ts` - Frontend audit role helpers
- `src/hooks/entity/useEntityAudit.ts` - Audit log fetching hook
- `src/routes/_authenticated/bookings/$bookingId.tsx` - Booking detail loader

---

## Success Criteria

After applying this fix, you should be able to:

✅ View booking detail pages without permission errors
✅ See audit log section on booking pages
✅ View audit trail showing booking history
✅ No "permission denied" errors in browser console
✅ `getUserAuditRole()` returns `'admin'` instead of `'none'`

---

## Questions?

If this fix doesn't work:

1. Check the verification steps above
2. Look for specific error messages in browser console
3. Run the troubleshooting SQL queries
4. Check Supabase logs in Dashboard → Logs

The most common issue is browser cache - make sure to hard refresh!
