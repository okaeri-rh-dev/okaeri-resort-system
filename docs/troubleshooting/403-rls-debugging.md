# Troubleshooting 403 Errors After Login

## Symptom

- ✅ Login works successfully
- ❌ All subsequent API requests return `403 Forbidden`
- No data loads in the dashboard/tables

---

## Quick Diagnosis (Do This First!)

### Step 1: Open Browser Console

**First, make supabase client available in console:**

```javascript
// Method 1: Dynamic import (preferred)
import("/src/lib/supabase.js").then((module) => {
  window.supabase = module.supabase;
  console.log("✅ Supabase client ready");
});
```

**Then run diagnostics:**

```javascript
// 1. Check if user is authenticated
const {
  data: { session },
} = await window.supabase.auth.getSession();
console.log("Session:", session);
console.log("User ID:", session?.user?.id);
console.log("Access Token:", session?.access_token?.substring(0, 20) + "...");

// 2. Try a simple query
const { data, error } = await window.supabase.from("units").select("*");
console.log("Data:", data);
console.log("Error:", error);
```

**Can't import? Use this alternative:**

Add this temporarily to your `src/main.tsx` or `src/App.tsx`:

```typescript
import { supabase } from "@/lib/supabase";

// Make available globally for debugging
if (import.meta.env.DEV) {
  (window as any).supabase = supabase;
}
```

Then refresh and try console commands again.

**Expected vs Actual:**

| What to Check     | Expected                              | If You See This                             |
| ----------------- | ------------------------------------- | ------------------------------------------- |
| `session`         | Object with `user` and `access_token` | `null` → Session lost, login again          |
| `session.user.id` | UUID string                           | `undefined` → Auth broken                   |
| `access_token`    | Long JWT string                       | Missing → Token not generated               |
| `error`           | `null`                                | `{code: '42501'}` → **RLS POLICY ISSUE** ✅ |
| `error`           | `null`                                | `{message: 'JWT expired'}` → Token expired  |

---

## Step 2: Test RLS Policies in SQL Editor

Go to **Supabase Dashboard → SQL Editor** and run these diagnostic queries:

### Test 1: Check if RLS is Enabled

```sql
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('units', 'bookings', 'guests', 'payments', 'expenses')
ORDER BY tablename;
```

**Expected Result:**

```
tablename  | rowsecurity
-----------+-------------
bookings   | t  ← TRUE = RLS enabled
expenses   | t
guests     | t
payments   | t
units      | t
```

**If `rowsecurity = f` (FALSE):**

```sql
-- Enable RLS on all tables
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
```

### Test 2: Check Existing Policies

```sql
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('units', 'bookings', 'guests', 'payments', 'expenses')
ORDER BY tablename, cmd;
```

**Look for:**

- ✅ Policies for `SELECT`, `INSERT`, `UPDATE`, `DELETE`
- ✅ `roles = {authenticated}`
- ⚠️ `qual` or `with_check` containing `auth.role()` or `auth.uid()`

### Test 3: Simulate Authenticated User Query

```sql
-- Simulate being an authenticated user
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "00000000-0000-0000-0000-000000000000"}';

-- Try to select from units
SELECT * FROM units LIMIT 1;

-- Reset role
RESET ROLE;
```

**If this works but browser queries don't:**
→ Problem is with **JWT token not being sent** from your app

**If this also returns `new row violates row-level security policy`:**
→ Problem is with the **RLS policy logic**

**Can't run SQL queries?**
→ Just apply the fix in Step 4 directly and test in browser

---

## Step 3: Check Network Requests

Open **Browser DevTools → Network tab**, filter by **Fetch/XHR**, and inspect a failing request:

### Check Request Headers

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Both headers must be present!**

**If `Authorization` header is missing:**

```javascript
// Check in browser console
const {
  data: { session },
} = await supabase.auth.getSession();
if (!session) {
  console.error("No session! User needs to login again");
}
```

---

## Common Issues & Fixes

### Issue 1: RLS Policies Using Wrong Syntax

**Problem:** Policies check `auth.role() = 'authenticated'::text` but this fails

**Symptoms:**

- SQL Editor test (Step 2, Test 3) works
- Browser queries fail with 403

**Fix:**

```sql
-- ❌ OLD (may not work reliably)
CREATE POLICY "Authenticated users can view units"
  ON units FOR SELECT
  USING (auth.role() = 'authenticated');

-- ✅ NEW (more reliable)
CREATE POLICY "Authenticated users can view units"
  ON units FOR SELECT
  USING (auth.uid() IS NOT NULL);
```

**Apply fix to all tables:**

```sql
-- Drop old policies
DROP POLICY IF EXISTS "Authenticated users can view units" ON units;
DROP POLICY IF EXISTS "Authenticated users can insert units" ON units;
DROP POLICY IF EXISTS "Authenticated users can update units" ON units;
DROP POLICY IF EXISTS "Authenticated users can delete units" ON units;

-- Create new policies with auth.uid()
CREATE POLICY "Authenticated users can view units"
  ON units FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert units"
  ON units FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update units"
  ON units FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete units"
  ON units FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Repeat for bookings, guests, payments, expenses, maintenance_logs
```

### Issue 2: Session Not Persisting

**Problem:** User logs in, but session is lost on page refresh

**Symptoms:**

- Login works
- Refresh page → `session` is `null`

**Fix:**

Check `src/lib/supabase.ts`:

```typescript
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true, // ✅ Must be true
    autoRefreshToken: true, // ✅ Must be true
    detectSessionInUrl: true, // ✅ For OAuth redirects
  },
});
```

### Issue 3: JWT Token Expired

**Problem:** Token expired but not refreshed

**Symptoms:**

- Works for ~1 hour after login
- Then all requests return 403

**Fix:**

Ensure session refresh is active in `src/lib/auth.ts`:

```typescript
// Check if this code is being called
async initialize() {
  const session = await this.getSession();
  if (session) {
    this.scheduleSessionRefresh();  // ✅ This must run!
  }
}
```

**Test refresh:**

```javascript
// In browser console
const { data, error } = await supabase.auth.refreshSession();
console.log("Refresh result:", data, error);

// Then try query again
const { data: units } = await supabase.from("units").select("*");
console.log("Units:", units);
```

### Issue 4: CORS / Network Issues

**Problem:** Request blocked by browser

**Symptoms:**

- Console shows `CORS policy` error
- Network tab shows request canceled or failed

**Fix:**

1. **Check Supabase project URL:**

   ```env
   # .env.local
   VITE_SUPABASE_URL=https://xxxxx.supabase.co  # ✅ Must be https://
   ```

2. **Check allowed origins in Supabase Dashboard:**
   - Go to **Authentication → URL Configuration**
   - Add `http://localhost:5173` to **Site URL**
   - Add `http://localhost:5173` to **Redirect URLs**

### Issue 5: Using Service Role Key Instead of Anon Key

**Problem:** Using wrong API key in frontend

**Symptoms:**

- Login works
- Queries work but bypass RLS (security risk!)
- Or queries fail with permission error

**Fix:**

Check `.env.local`:

```env
# ✅ CORRECT - Use anon key for frontend
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...   # Starts with eyJ, role: anon

# ❌ WRONG - Never use service role key in frontend!
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...   # role: service_role
```

**Verify in console:**

```javascript
// Decode JWT to check role
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const payload = JSON.parse(atob(anonKey.split(".")[1]));
console.log("Key role:", payload.role); // Should be "anon"
```

---

## Step 4: Apply the Fix

### Migration Script for RLS Policy Fix

Create file: `database/migrations/fix-rls-403-errors.sql`

```sql
-- ============================================
-- FIX RLS 403 ERRORS
-- Replace auth.role() with auth.uid() for reliability
-- ============================================

BEGIN;

-- ============================================
-- UNITS TABLE
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can view units" ON units;
DROP POLICY IF EXISTS "Authenticated users can insert units" ON units;
DROP POLICY IF EXISTS "Authenticated users can update units" ON units;
DROP POLICY IF EXISTS "Authenticated users can delete units" ON units;

CREATE POLICY "Authenticated users can view units"
  ON units FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert units"
  ON units FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update units"
  ON units FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete units"
  ON units FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ============================================
-- BOOKINGS TABLE
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can view bookings" ON bookings;
DROP POLICY IF EXISTS "Authenticated users can insert bookings" ON bookings;
DROP POLICY IF EXISTS "Authenticated users can update bookings" ON bookings;
DROP POLICY IF EXISTS "Authenticated users can delete bookings" ON bookings;

CREATE POLICY "Authenticated users can view bookings"
  ON bookings FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert bookings"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update bookings"
  ON bookings FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete bookings"
  ON bookings FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ============================================
-- GUESTS TABLE
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can view guests" ON guests;
DROP POLICY IF EXISTS "Authenticated users can insert guests" ON guests;
DROP POLICY IF EXISTS "Authenticated users can update guests" ON guests;
DROP POLICY IF EXISTS "Authenticated users can delete guests" ON guests;

CREATE POLICY "Authenticated users can view guests"
  ON guests FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert guests"
  ON guests FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update guests"
  ON guests FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete guests"
  ON guests FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ============================================
-- PAYMENTS TABLE
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can view payments" ON payments;
DROP POLICY IF EXISTS "Authenticated users can insert payments" ON payments;
DROP POLICY IF EXISTS "Authenticated users can update payments" ON payments;
DROP POLICY IF EXISTS "Authenticated users can delete payments" ON payments;

CREATE POLICY "Authenticated users can view payments"
  ON payments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert payments"
  ON payments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update payments"
  ON payments FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete payments"
  ON payments FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ============================================
-- EXPENSES TABLE
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can view expenses" ON expenses;
DROP POLICY IF EXISTS "Authenticated users can insert expenses" ON expenses;
DROP POLICY IF EXISTS "Authenticated users can update expenses" ON expenses;
DROP POLICY IF EXISTS "Authenticated users can delete expenses" ON expenses;

CREATE POLICY "Authenticated users can view expenses"
  ON expenses FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert expenses"
  ON expenses FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update expenses"
  ON expenses FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete expenses"
  ON expenses FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ============================================
-- MAINTENANCE_LOGS TABLE (if exists)
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can view maintenance_logs" ON maintenance_logs;
DROP POLICY IF EXISTS "Authenticated users can insert maintenance_logs" ON maintenance_logs;
DROP POLICY IF EXISTS "Authenticated users can update maintenance_logs" ON maintenance_logs;
DROP POLICY IF EXISTS "Authenticated users can delete maintenance_logs" ON maintenance_logs;

CREATE POLICY "Authenticated users can view maintenance_logs"
  ON maintenance_logs FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert maintenance_logs"
  ON maintenance_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update maintenance_logs"
  ON maintenance_logs FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete maintenance_logs"
  ON maintenance_logs FOR DELETE
  USING (auth.uid() IS NOT NULL);

COMMIT;

-- ============================================
-- VERIFY FIX
-- ============================================

-- Test as authenticated user
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "test-user-id"}';

SELECT 'Testing units...' AS test;
SELECT COUNT(*) FROM units;

SELECT 'Testing bookings...' AS test;
SELECT COUNT(*) FROM bookings;

SELECT 'Testing guests...' AS test;
SELECT COUNT(*) FROM guests;

-- Reset
RESET ROLE;

SELECT '✅ RLS policies updated successfully!' AS result;
```

### How to Apply the Fix

**Option 1: Via Supabase SQL Editor (Recommended)**

1. Go to **Supabase Dashboard → SQL Editor**
2. Create new query
3. Paste the entire migration script above
4. Click **Run**
5. Verify output shows "✅ RLS policies updated successfully!"

**Option 2: Via Local Supabase CLI**

```bash
# If using local Supabase
npx supabase migration new fix_rls_403_errors
# Copy the SQL above into the new migration file
npx supabase db reset
```

**Option 3: Via psql**

```bash
psql "$DATABASE_URL" < database/migrations/fix-rls-403-errors.sql
```

---

## Step 5: Verify the Fix

### Test in Browser Console

**Make sure supabase is available (see Step 1):**

```javascript
// If not done yet:
import("/src/lib/supabase.js").then((m) => (window.supabase = m.supabase));
```

**Then run tests:**

```javascript
// 1. Refresh session
const { data: refreshData } = await window.supabase.auth.refreshSession();
console.log("✅ Session refreshed:", refreshData.session?.user?.id);

// 2. Test query
const { data: units, error } = await window.supabase.from("units").select("*");
console.log("✅ Units:", units?.length, "records");
console.log("Error:", error); // Should be null

// 3. Test insert
const { data: newUnit, error: insertError } = await window.supabase
  .from("units")
  .insert({
    unit_code: "TEST-1",
    unit_name: "Test Unit",
    unit_type: "Standard",
    base_rate: 1000,
    base_occupancy: 2,
    max_occupancy: 4,
  })
  .select()
  .single();

console.log("✅ Insert:", newUnit);
console.log("Error:", insertError); // Should be null

// 4. Clean up test
await window.supabase.from("units").delete().eq("unit_code", "TEST-1");
```

### Test in SQL Editor

```sql
-- Simulate authenticated user
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "test-user-123"}';

-- All of these should work now
SELECT * FROM units LIMIT 1;
SELECT * FROM bookings LIMIT 1;
SELECT * FROM guests LIMIT 1;
SELECT * FROM payments LIMIT 1;
SELECT * FROM expenses LIMIT 1;

-- Reset
RESET ROLE;
```

---

## Still Having Issues?

### Enable Detailed Logging

Add this to your app to see exactly what's failing:

```typescript
// In src/lib/supabase.ts or your main file
supabase.auth.onAuthStateChange((event, session) => {
  console.log("[Auth Event]", event, session?.user?.id);
});

// Intercept all Supabase queries (for debugging only!)
const originalFrom = supabase.from.bind(supabase);
supabase.from = (table) => {
  const query = originalFrom(table);
  const originalSelect = query.select.bind(query);

  query.select = (...args) => {
    console.log(`[Supabase] SELECT from ${table}`, args);
    const result = originalSelect(...args);
    result.then(({ data, error }) => {
      if (error) console.error(`[Supabase] Error from ${table}:`, error);
      else console.log(`[Supabase] Success from ${table}:`, data?.length, "rows");
    });
    return result;
  };

  return query;
};
```

### Check Supabase Dashboard Logs

1. Go to **Supabase Dashboard → Logs → Postgres Logs**
2. Look for `permission denied` or `policy violation` errors
3. Check the exact policy name that's failing

### Contact Support

If none of the above works, gather this info:

```javascript
// Run in browser console
const diagnostics = {
  session: await supabase.auth.getSession(),
  user: await supabase.auth.getUser(),
  test_query: await supabase.from("units").select("count"),
  environment: {
    url: import.meta.env.VITE_SUPABASE_URL,
    has_key: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
    key_length: import.meta.env.VITE_SUPABASE_ANON_KEY?.length,
  },
};

console.log(JSON.stringify(diagnostics, null, 2));
```

Share this output for faster debugging!

---

## Summary Checklist

- [ ] Verified session exists in browser console
- [ ] Checked RLS is enabled on all tables
- [ ] Tested policies in SQL Editor with `SET ROLE authenticated`
- [ ] Verified `Authorization` header in Network tab
- [ ] Applied migration script to fix policies
- [ ] Tested queries work in browser console
- [ ] Cleared browser cache and reloaded
- [ ] Verified using anon key, not service role key

**Most Common Fix:** Run the migration script in Step 4 to replace `auth.role()` with `auth.uid()`.
