## Fix Audit Logs Permission Denied - Final Solution

### The Root Cause

The RLS helper functions were missing the `STABLE` attribute:

```sql
-- ❌ WRONG (Migration 012 - missing STABLE)
CREATE FUNCTION is_admin_or_owner(UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER;  -- Defaults to VOLATILE

-- ✅ CORRECT (Migration 016 - with STABLE)
CREATE FUNCTION is_admin_or_owner(UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER STABLE;  -- Explicitly STABLE
```

### Why This Matters

**PostgreSQL Function Volatility Categories:**

| Category    | Behavior                      | RLS Compatible |
| ----------- | ----------------------------- | -------------- |
| `IMMUTABLE` | Never changes for same input  | ✅ Yes         |
| `STABLE`    | Consistent within transaction | ✅ Yes         |
| `VOLATILE`  | Can change anytime (default)  | ❌ No          |

**What Happens Without `STABLE`:**

1. Function defaults to `VOLATILE`
2. RLS policy calls the function during query planning
3. PostgreSQL cannot cache/inline VOLATILE functions
4. Auth context (`auth.uid()`) is lost during policy evaluation
5. Policy fails → "permission denied for table audit_logs"

**Why RPC Calls Worked:**

- `get_current_audit_role()` was correctly marked as `SECURITY DEFINER STABLE`
- Direct RPC calls don't go through RLS evaluation
- That's why `supabase.rpc('get_current_audit_role')` returned "admin"
- But `supabase.from('audit_logs').select()` failed

### The Fix (2 Minutes)

1. **Open Supabase SQL Editor**
   - Go to Supabase Dashboard
   - Click "SQL Editor"

2. **Run Migration 016**
   - Open: `database/migrations/016-fix-helper-functions-stability.sql`
   - Copy entire file
   - Paste into SQL Editor
   - Click "Run"

3. **Verify Success**
   You should see output showing:

   ```
   function_name     | volatility  | security_definer
   is_admin          | STABLE ✅   | Yes ✅
   is_admin_or_owner | STABLE ✅   | Yes ✅
   is_manager        | STABLE ✅   | Yes ✅
   ```

4. **Test in Browser**
   - Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
   - Navigate to any booking detail page
   - Audit logs should now be visible

### Quick Browser Test

Open browser console and run:

```javascript
// Should now work
const { data, error } = await supabase.from("audit_logs").select("*").limit(5);

console.log("Audit logs:", data);
console.log("Error:", error);

// Expected:
// Audit logs: [array of 5 audit log objects]
// Error: null
```

### Why This Is The Proper Fix

This is **NOT a workaround** - it's the correct PostgreSQL pattern:

✅ **Follows PostgreSQL Best Practices**

- RLS helper functions should be marked `STABLE` or `IMMUTABLE`
- Our functions ARE stable (same result per transaction)
- Just needed to explicitly declare it

✅ **Matches Existing Pattern**

- `get_current_audit_role()` in Migration 010: `SECURITY DEFINER STABLE` ✅
- Policy helpers in Migration 012: `SECURITY DEFINER` only ❌
- Migration 016 fixes this inconsistency

✅ **No Logic Changes**

- Only adds function attribute
- No schema changes
- No data changes
- Immediate effect

✅ **PostgreSQL Documentation**
From [PostgreSQL Docs - Function Volatility](https://www.postgresql.org/docs/current/xfunc-volatility.html):

> "STABLE functions are expected to return the same result for the same arguments within a single scan of the table."

Our functions meet this definition - they query a stable table and return consistent results within a transaction.

### Technical Deep Dive

**How RLS Policy Evaluation Works:**

1. **Query Planning Phase**

   ```sql
   SELECT * FROM audit_logs WHERE ... ;
   ```

2. **RLS Policy Injection**

   ```sql
   SELECT * FROM audit_logs
   WHERE (
       -- Policy USING clause inserted here
       is_admin_or_owner(auth.uid()) OR ...
   ) AND ... ;
   ```

3. **Function Inlining (STABLE required)**
   - PostgreSQL tries to evaluate policy once during planning
   - Needs to cache `auth.uid()` value for policy duration
   - `STABLE` allows this caching
   - `VOLATILE` prevents caching → context lost

4. **Query Execution**
   - With `STABLE`: Policy evaluated with correct auth context ✅
   - Without `STABLE`: Policy evaluated with NULL context ❌

### Verification Commands

After running Migration 016:

```sql
-- Check function volatility
SELECT
    proname,
    CASE provolatile
        WHEN 's' THEN 'STABLE'
        WHEN 'v' THEN 'VOLATILE'
        WHEN 'i' THEN 'IMMUTABLE'
    END as volatility
FROM pg_proc
WHERE proname IN ('is_admin_or_owner', 'is_manager', 'is_admin');
-- Expected: All show STABLE

-- Test function directly
SELECT is_admin_or_owner(auth.uid());
-- Expected: true

-- Test audit logs access
SELECT COUNT(*) FROM audit_logs;
-- Expected: A number (not permission error)
```

### Success Criteria

After applying this fix:

✅ Browser console shows no "permission denied" errors
✅ `supabase.from('audit_logs').select()` returns data
✅ Booking detail pages show audit logs section
✅ Audit trail displays booking history
✅ All 3 helper functions marked as `STABLE`

### Related Files

- **The Fix**: `database/migrations/016-fix-helper-functions-stability.sql`
- **Original Issue**: `database/migrations/012-fix-app-roles-rls-recursion.sql` (forgot STABLE)
- **Working Example**: `database/migrations/010-bootstrap-admin.sql` (has STABLE)
- **Frontend Hook**: `src/hooks/entity/useEntityAudit.ts`
- **Route Loader**: `src/routes/_authenticated/bookings/$bookingId.tsx`

### If It Still Doesn't Work

1. **Clear browser cache completely**

   ```javascript
   localStorage.clear();
   sessionStorage.clear();
   location.reload();
   ```

2. **Log out and log back in**
   - Forces JWT token refresh
   - Ensures clean auth state

3. **Check Supabase client version**

   ```bash
   npm list @supabase/supabase-js
   # Should be >= 2.0.0
   ```

4. **Verify functions were updated**
   Run the verification queries above in SQL Editor

---

## Summary

**Problem**: RLS helper functions missing `STABLE` attribute
**Symptom**: Permission denied when querying audit_logs
**Root Cause**: PostgreSQL cannot preserve auth context in VOLATILE functions
**Solution**: Add `STABLE` to function definitions
**Result**: Auth context preserved → RLS policies work correctly

This is a one-word fix per function that solves the fundamental issue!
