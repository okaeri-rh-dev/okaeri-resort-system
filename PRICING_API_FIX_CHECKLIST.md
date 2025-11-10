# Pricing API Fix - Implementation Checklist

## ✅ Completed

### 1. Enhanced Error Logging

**File**: `functions/api/pricing/update-config.ts` (line 223-239)

Added comprehensive error logging that includes:

- Error code
- Error message
- Error details
- Error hint
- Debug information in response (for development)

**What this helps with**: You'll now see the exact Supabase error in the console and response, making it easy to diagnose the issue.

### 2. RLS Policy Fix

**File**: `supabase/migrations/20251107_fix_pricing_config_rls.sql`

Updated the pricing_config RLS policy to allow:

- `admin` role (was already allowed)
- `manager` role (NEW - now allowed)
- `owner` role (NEW - now allowed)

**What this fixes**: Aligns the database permission with the API endpoint logic which checks for all three roles.

## 🔍 To Verify

### 3. Service Role Key Configuration

The endpoint uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS. You need to verify this is properly configured:

#### For Local Development (.dev.vars):

```bash
# Check if .dev.vars exists and contains the key
cat .dev.vars | grep SUPABASE_SERVICE_ROLE_KEY
```

Expected format in `.dev.vars`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**To get your service role key:**

1. Go to Supabase Dashboard → Project Settings → API
2. Copy the `service_role` key (secret, not anon)
3. Add it to `.dev.vars`

#### For Production (Cloudflare Pages):

```bash
# Check via Cloudflare CLI (if installed)
wrangler pages deployment list okaeri-resort-system
```

Or manually verify:

1. Go to Cloudflare Dashboard
2. Pages → okaeri-resort-system → Settings → Environment Variables
3. Check for `SUPABASE_SERVICE_ROLE_KEY`

If missing, add it:

- Variable name: `SUPABASE_SERVICE_ROLE_KEY`
- Value: Your Supabase service role key (from Supabase dashboard)
- Environment: Production (and Preview if needed)

### 4. Apply Database Migration

Run the new migration to update the RLS policy:

```bash
# If using Supabase CLI
supabase db push

# Or apply manually via Supabase dashboard:
# Dashboard → SQL Editor → New Query → Paste migration content → Run
```

## 🧪 Testing

After applying the fixes, test the endpoint:

```bash
# 1. Try updating pricing from the UI
# Navigate to /units/pricing and make a change

# 2. Check the browser console for detailed error if it still fails
# You should now see the exact Supabase error message

# 3. Check Cloudflare Workers logs
# Cloudflare Dashboard → Pages → okaeri-resort-system → Functions → Logs

# 4. Verify your role in app_roles table
# Run this in Supabase SQL Editor:
SELECT role, is_active FROM app_roles WHERE user_id = auth.uid();
```

## 🐛 Debugging Guide

### If you still get INTERNAL_ERROR:

**Check the error details** in the API response (now includes `debug` field):

```json
{
  "error": "UPDATE_FAILED",
  "message": "Failed to update pricing configuration",
  "debug": "new row violates row-level security policy"
}
```

**Common issues and solutions:**

| Error Message                                | Cause                                                     | Solution                                        |
| -------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------- |
| "new row violates row-level security policy" | RLS policy not updated OR service role key not configured | Apply RLS migration AND verify service role key |
| "permission denied for table pricing_config" | Service role key missing or incorrect                     | Add correct service role key to environment     |
| "no rows returned"                           | Row with id='default' doesn't exist                       | Insert default row (see below)                  |
| "JWT expired"                                | User session expired                                      | User needs to sign in again                     |

### If pricing_config row doesn't exist:

```sql
-- Run in Supabase SQL Editor
INSERT INTO pricing_config (id, base_rate, weekend_rate, extra_person_rate, base_occupancy, max_capacity_per_unit, downpayment_percent, currency)
VALUES ('default', 3000, 3500, 500, 2, 10, 50, 'PHP')
ON CONFLICT (id) DO NOTHING;
```

### If service role key is invalid:

1. Get a fresh service role key from Supabase Dashboard
2. Update in both `.dev.vars` (local) and Cloudflare Pages (production)
3. Redeploy (for production changes to take effect)

## ✨ Expected Behavior After Fix

1. **Authentication**: ✅ Should work (already fixed in previous step)
2. **Authorization**: ✅ Should work for admin/manager/owner roles (after RLS fix)
3. **Error Messages**: ✅ Should show detailed errors (after logging enhancement)
4. **Update Operation**: ✅ Should successfully update pricing config

**Success response:**

```json
{
  "success": true,
  "config": {
    "id": "default",
    "base_rate": 3000,
    "weekend_rate": 3500,
    // ... other fields
    "updated_at": "2024-12-06T12:30:00Z"
  }
}
```

## 📝 Notes

- The service role key should be kept secret and never committed to git
- RLS policies are important for security - we're allowing manager/owner because they need pricing access
- The endpoint properly validates user roles before allowing updates
- Error logging helps debug issues quickly without exposing sensitive info to users
