# Troubleshooting: Chunk 013

## Overview

This document provides solutions to common issues encountered during implementation of the Unit Assignment System. Issues are organized by symptom with clear solutions.

---

## Prerequisites Issues

### Issue 0: Prerequisites Not Met

**Symptom**: Implementation fails early with errors like:

- `ERROR: relation "booking_units" does not exist`
- `ERROR: column "unit_assignment_status" does not exist`
- `ERROR: extension "btree_gist" does not exist`
- `Component not found` errors in UI
- PostgreSQL function creation fails

**Root Cause**: Prerequisites from chunks 001-012 not completed or not properly verified

**Solution**: Run prerequisites verification from README.md lines 149-314

---

#### Sub-Issue 0.1: Database Tables Missing (Check 1 Fails)

**Symptom**:

```
ERROR: relation "booking_units" does not exist
ERROR: relation "guest_booking_unit_requests" does not exist
```

**Diagnosis**:

```bash
npx supabase db execute "
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('booking_units', 'guest_booking_unit_requests', 'pricing_config')
ORDER BY table_name;
"
```

**Expected**: 3 rows (all tables exist)
**Actual**: 0-2 rows (some tables missing)

**Solution**: Complete **Chunk 001: Database Schema Setup**

- Navigate to `chunks/001-database-schema-setup/`
- Follow `instructions.md` to create all tables
- Re-run Check 1 to verify

**Prevention**: Always verify prerequisites before starting a chunk

---

#### Sub-Issue 0.2: EXCLUDE Constraint Missing (Check 2 Fails)

**Symptom**:

- System allows double-booking of same unit for overlapping dates
- No concurrency protection
- Multiple bookings created for same unit/dates

**Diagnosis**:

```bash
npx supabase db execute "
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'booking_units'::regclass AND contype = 'x';
"
```

**Expected**: 1 row with EXCLUDE constraint containing `daterange` and `&&` operator
**Actual**: 0 rows (constraint doesn't exist)

**Solution**: Complete **Chunk 003: Security, RLS, and Constraints**

- Navigate to `chunks/003-security-rls-constraints/`
- Follow instructions to create EXCLUDE constraint
- Requires `btree_gist` extension (see Sub-Issue 0.3)

**Impact**: **CRITICAL** - Without this constraint, the system will allow double-booking

---

#### Sub-Issue 0.3: btree_gist Extension Not Enabled (Check 3 Fails)

**Symptom**:

```
ERROR: data type daterange has no default operator class for access method "gist"
HINT: You must specify an operator class or define a default operator class for the data type.
```

**Diagnosis**:

```bash
npx supabase db execute "
SELECT extname, extversion FROM pg_extension WHERE extname = 'btree_gist';
"
```

**Expected**: 1 row (extension enabled)
**Actual**: 0 rows (extension not installed)

**Solution**: Enable the extension (one-time setup)

```bash
npx supabase db execute "CREATE EXTENSION IF NOT EXISTS btree_gist;"
```

**Verification**:

```bash
# Re-check that extension is now enabled
npx supabase db execute "SELECT extname FROM pg_extension WHERE extname = 'btree_gist';"
```

**Why This Matters**: The EXCLUDE constraint requires `btree_gist` to support daterange overlap detection (`&&` operator). Without it, the constraint cannot be created.

---

#### Sub-Issue 0.4: unit_assignment_status Column Missing (Check 4 Fails)

**Symptom**:

```
ERROR: column "unit_assignment_status" does not exist
LINE 3:   unit_assignment_status,
          ^
```

**Diagnosis**:

```bash
npx supabase db execute "
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'bookings' AND column_name = 'unit_assignment_status';
"
```

**Expected**: 1 row (column exists)
**Actual**: 0 rows (column missing)

**Solution**: Complete **Chunk 001: Database Schema Setup**

- The `unit_assignment_status` column should have been added in chunk 001
- If chunk 001 is marked complete but column missing, re-run the migration:

```bash
# Check migration history
npx supabase migration list

# If migration exists but not applied, apply it
npx supabase db push
```

**Alternative**: Add column manually (testing only)

```sql
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS unit_assignment_status VARCHAR(50) DEFAULT 'pending';
```

---

#### Sub-Issue 0.5: Payment Verification Component Missing (Check 5 Fails)

**Symptom**:

- Cannot navigate to `/admin/verify-payment/{bookingId}`
- Component not found errors
- TypeScript import errors

**Diagnosis**:

```bash
# Check if payment verification component exists
ls src/components/admin/*Payment*.tsx

# Alternative: search entire codebase
find src -name "*payment*" -o -name "*Payment*" 2>/dev/null
```

**Expected**: File exists (e.g., `PaymentVerificationUI.tsx`)
**Actual**: No files found

**Solution**: Complete **Chunk 012: Payment Verification UI**

- Navigate to `chunks/012-payment-verification-ui/`
- Follow instructions to create payment verification component
- Re-run Check 5 to verify

**Impact**: Cannot verify payments before assigning units (workflow incomplete)

---

#### Sub-Issue 0.6: Audit Logging System Not Set Up (Check 6 Fails)

**Symptom**:

```
ERROR: relation "audit_logs" does not exist
```

**Diagnosis**:

```bash
npx supabase db execute "
SELECT table_name FROM information_schema.tables WHERE table_name = 'audit_logs';
"
```

**Expected**: 1 row (table exists)
**Actual**: 0 rows (table doesn't exist)

**Solution Option 1**: Implement audit logging (recommended for production)

- Create `audit_logs` table with required columns
- See `docs/implementation/guest-booking-multi-unit/01-database-schema.md` for schema

**Solution Option 2**: Proceed without audit logging (acceptable for development)

- Mark Check 6 as "OPTIONAL - Add TODO"
- Comment out audit logging code in implementation
- Add TODO to implement audit logging before production launch

**Impact**: **LOW** for development - No audit trail for unit assignments, but system is functional

---

### Prerequisites Verification One-Liner

Run this command to check all prerequisites at once:

```bash
# Quick prerequisites verification (copy-paste this entire block)
echo "=== Prerequisites Verification ===" && \
echo "Check 1: Tables" && npx supabase db execute "SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('booking_units', 'guest_booking_unit_requests');" && \
echo "Check 2: EXCLUDE constraint" && npx supabase db execute "SELECT COUNT(*) FROM pg_constraint WHERE conrelid = 'booking_units'::regclass AND contype = 'x';" && \
echo "Check 3: btree_gist" && npx supabase db execute "SELECT COUNT(*) FROM pg_extension WHERE extname = 'btree_gist';" && \
echo "Check 4: Column" && npx supabase db execute "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'unit_assignment_status';" && \
echo "Check 5: Component" && ls src/components/admin/*Payment*.tsx 2>/dev/null && \
echo "Check 6: Audit logs (optional)" && npx supabase db execute "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'audit_logs';" && \
echo "=== All Checks Complete ==="
```

**Expected Output**: Each check returns count > 0

---

## PostgreSQL Function Issues

### Issue 1: Function Creation Fails with Syntax Error

**Symptom**:

```
ERROR: syntax error at or near "DECLARE"
LINE 10: DECLARE
```

**Solution**:

```sql
-- Ensure you have the correct function wrapper
-- Must use $$ delimiter for function body

CREATE OR REPLACE FUNCTION assign_units_to_booking(
  p_booking_id UUID,
  p_unit_ids UUID[]
) RETURNS VOID AS $$  -- <-- $$ delimiter required
DECLARE
  -- declarations here
BEGIN
  -- function body
END;
$$ LANGUAGE plpgsql;  -- <-- Closing $$ and LANGUAGE required
```

**Verification**:

```bash
npx supabase db execute "SELECT proname FROM pg_proc WHERE proname = 'assign_units_to_booking';"
```

---

### Issue 2: "Extension btree_gist Does Not Exist"

**Symptom**:

```
ERROR: extension "btree_gist" does not exist
HINT: Use CREATE EXTENSION to load it into the database.
```

**Solution**:

```sql
-- Run this first (before creating EXCLUDE constraint)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Then verify extension enabled
SELECT * FROM pg_extension WHERE extname = 'btree_gist';
```

**Context**: The EXCLUDE constraint on `booking_units` requires `btree_gist` extension for `daterange` comparison.

---

### Issue 3: "All-or-Nothing Violation" When Counts Match

**Symptom**:

```
ERROR: All-or-nothing violation: Must assign exactly 2 units (received 2 units)
```

**Cause**: `array_length()` returns NULL for empty arrays

**Solution**:

```sql
-- Change this:
IF array_length(p_unit_ids, 1) != v_requested_count THEN

-- To this (handles NULL case):
IF COALESCE(array_length(p_unit_ids, 1), 0) != v_requested_count THEN
  RAISE EXCEPTION 'All-or-nothing violation: Must assign exactly % units (received % units)',
    v_requested_count,
    COALESCE(array_length(p_unit_ids, 1), 0);
END IF;
```

---

### Issue 4: Function Times Out After 5 Seconds

**Symptom**:

```
ERROR: canceling statement due to statement timeout
```

**Diagnosis**:

```sql
-- Check current timeout setting
SELECT proname, proconfig
FROM pg_proc
WHERE proname = 'assign_units_to_booking';
```

**Solution**:

```sql
-- Increase timeout if needed (use sparingly)
ALTER FUNCTION assign_units_to_booking(UUID, UUID[])
  SET statement_timeout = '10s';

-- Or remove timeout entirely (not recommended)
ALTER FUNCTION assign_units_to_booking(UUID, UUID[])
  RESET statement_timeout;
```

**Root Cause Investigation**:

```sql
-- Check if indexes exist on foreign keys
SELECT indexname FROM pg_indexes WHERE tablename = 'booking_units';

-- If missing, create indexes:
CREATE INDEX IF NOT EXISTS idx_booking_units_booking ON booking_units(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_units_unit ON booking_units(unit_id);
```

---

### Issue 5: "Payment Must Be Verified" Even Though Status is Verified

**Symptom**:

```
ERROR: Payment must be verified before unit assignment. Current status: Pending
```

**Diagnosis**:

```sql
-- Check actual payment status
SELECT booking_id, payment_status, unit_assignment_status
FROM bookings
WHERE booking_id = 'YOUR_BOOKING_ID';
```

**Solution**:

- If status is 'Pending': Verify payment first using chunk 012's UI
- If status shows 'Verified' but error occurs: Cache issue, refresh query
- Check for case sensitivity: 'Verified' vs 'verified'

```sql
-- Update payment status manually (testing only)
UPDATE bookings
SET payment_status = 'Verified'
WHERE booking_id = 'YOUR_BOOKING_ID';
```

---

## API Endpoint Issues

### Issue 6: Available Units API Returns 401 Unauthorized

**Symptom**:

```json
{
  "success": false,
  "error": "Unauthorized - No token provided"
}
```

**Solution**:

```typescript
// Check JWT token is being sent
const token = localStorage.getItem("supabase.auth.token"); // Or from auth context
const response = await fetch("/api/admin/available-units?...", {
  headers: {
    Authorization: `Bearer ${token}`, // <-- Must have Bearer prefix
  },
});
```

**Verification**:

```bash
# Test with cURL (replace with actual token)
curl "http://localhost:5173/api/admin/available-units?check_in_date=2025-12-01&check_out_date=2025-12-05" \
  -H "Authorization: Bearer eyJhbGc..." \
  -v  # <-- Verbose mode shows headers
```

**Check Token**:

```javascript
// In browser console
const token = localStorage.getItem("supabase.auth.token");
console.log("Token:", token);

// Decode JWT to check expiry (use jwt.io)
```

---

### Issue 7: Available Units Returns Empty Array When Units Exist

**Symptom**:

```json
{
  "success": true,
  "available_units": [],
  "count": 0
}
```

**Diagnosis**:

```sql
-- Check if units exist
SELECT unit_id, unit_number, unit_status FROM units;

-- Check if any units have status = 'Available'
SELECT COUNT(*) FROM units WHERE unit_status = 'Available';
```

**Solution**:

```sql
-- Update unit status if needed
UPDATE units
SET unit_status = 'Available'
WHERE unit_status != 'Available';

-- Or check for case sensitivity
UPDATE units
SET unit_status = 'Available'
WHERE unit_status = 'available';  -- lowercase
```

---

### Issue 8: Assign Units API Returns 500 Internal Server Error

**Symptom**:

```json
{
  "success": false,
  "error": "Internal server error"
}
```

**Debugging**:

```bash
# Check server console logs
npm run dev
# Look for [ASSIGN_UNITS_ERROR] or [ASSIGN_UNITS_RPC_ERROR] logs
```

**Common Causes**:

1. **Supabase URL/Key Missing**:

```typescript
// Check env vars in Cloudflare Workers
console.log("SUPABASE_URL:", env.SUPABASE_URL);
console.log("SUPABASE_KEY:", env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20));
```

2. **RPC Function Name Mismatch**:

```typescript
// Ensure function name matches database
const { error } = await supabase.rpc("assign_units_to_booking", {
  // <-- Must match exactly
  p_booking_id: booking_id,
  p_unit_ids: unit_ids,
});
```

3. **Parameter Name Mismatch**:

```typescript
// Parameter names must match function signature
// Function: assign_units_to_booking(p_booking_id UUID, p_unit_ids UUID[])
// RPC call must use: p_booking_id, p_unit_ids (with p_ prefix)
```

---

### Issue 9: Double-Booking Conflict Not Detected

**Symptom**: Can assign same unit to overlapping bookings

**Diagnosis**:

```sql
-- Check if EXCLUDE constraint exists
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'booking_units'::regclass
  AND contype = 'x';  -- 'x' = exclusion constraint

-- Expected result: constraint with daterange overlap operator (&&)
```

**Solution**:

```sql
-- If constraint missing, create it (from chunk 003)
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE booking_units
ADD CONSTRAINT no_double_booking EXCLUDE USING gist (
    unit_id WITH =,
    daterange(check_in_date, check_out_date, '[]') WITH &&
) WHERE (status != 'cancelled');
```

**Verification**:

```sql
-- Try to create conflicting booking (should fail)
INSERT INTO booking_units (booking_id, unit_id, check_in_date, check_out_date, status)
VALUES (gen_random_uuid(), 'EXISTING_UNIT_ID', '2025-12-01', '2025-12-05', 'confirmed');

-- Then try again with overlapping dates (should fail)
INSERT INTO booking_units (booking_id, unit_id, check_in_date, check_out_date, status)
VALUES (gen_random_uuid(), 'EXISTING_UNIT_ID', '2025-12-03', '2025-12-07', 'confirmed');

-- Expected: ERROR: conflicting key value violates exclusion constraint
```

---

## UI Component Issues

### Issue 10: Unit Selection Doesn't Toggle

**Symptom**: Clicking unit card doesn't select/deselect

**Diagnosis**:

```typescript
// Check state update in toggleUnit function
const toggleUnit = (unitId: string) => {
  console.log("Before:", selectedUnits);
  setSelectedUnits((prev) =>
    prev.includes(unitId) ? prev.filter((id) => id !== unitId) : [...prev, unitId]
  );
  console.log("After:", selectedUnits); // This will show OLD state (async)
};
```

**Solution**:

```typescript
// Use useEffect to log state changes
useEffect(() => {
  console.log('Selected units updated:', selectedUnits);
}, [selectedUnits]);

// Ensure onClick is on Card, not on Checkbox
<Card
  onClick={() => toggleUnit(unit.unit_id)}  // <-- Correct
  className="cursor-pointer"
>
  <CardContent>
    <Checkbox checked={selectedUnits.includes(unit.unit_id)} readOnly />  {/* <-- readOnly */}
  </CardContent>
</Card>
```

---

### Issue 11: All-or-Nothing Alert Always Shows Error

**Symptom**: Alert shows red even when correct count selected

**Diagnosis**:

```typescript
// Check calculation
const isAllOrNothing = selectedUnits.length === unitRequests.length;
console.log("Selected:", selectedUnits.length);
console.log("Requested:", unitRequests.length);
console.log("Is All or Nothing:", isAllOrNothing);
```

**Solution**:

```typescript
// Ensure unitRequests is an array, not undefined
const unitRequests = booking.unit_requests || []; // <-- Default to empty array

// Check for strict equality
const isAllOrNothing = selectedUnits.length === unitRequests.length;

// Not this (will fail for 0 === 0):
const isAllOrNothing = selectedUnits.length >= unitRequests.length;
```

---

### Issue 12: Assign Button Always Disabled

**Symptom**: Cannot click button even when selection complete

**Diagnosis**:

```typescript
// Check disabled condition
console.log("isAllOrNothing:", isAllOrNothing);
console.log("isPending:", assignMutation.isPending);
console.log("Disabled:", !isAllOrNothing || assignMutation.isPending);
```

**Solution**:

```typescript
// Ensure boolean logic is correct
<Button
  onClick={handleAssign}
  disabled={!isAllOrNothing || assignMutation.isPending}  // <-- Both conditions
  className="w-full"
>
  {assignMutation.isPending ? 'Assigning...' : `Assign ${unitRequests.length} Units`}
</Button>

// Check if button has pointer-events CSS blocking clicks
// Remove any global CSS that disables buttons
```

---

### Issue 13: TanStack Query Not Refetching After Assignment

**Symptom**: Queue still shows assigned booking after successful assignment

**Solution**:

```typescript
// Ensure invalidateQueries is called in mutation onSuccess
const assignMutation = useMutation({
  mutationFn: async () => {
    /* ... */
  },
  onSuccess: () => {
    // Invalidate all relevant queries
    queryClient.invalidateQueries({ queryKey: ["pending-multi-unit-bookings"] });
    queryClient.invalidateQueries({ queryKey: ["booking", bookingId] });
    queryClient.invalidateQueries({ queryKey: ["available-units"] }); // <-- Don't forget this

    // Then navigate or show success
    onAssignmentSuccess();
  },
});
```

---

### Issue 14: Route Guard Not Working (Payment Not Verified)

**Symptom**: Assignment page loads even when payment not verified

**Solution**:

```typescript
// Ensure guard check happens BEFORE rendering component
function AssignUnitsPage() {
  const { bookingId } = Route.useParams();
  const { data: booking, isLoading } = useQuery({ /* ... */ });

  // Show loading first
  if (isLoading) {
    return <div>Loading...</div>;
  }

  // Check payment status BEFORE rendering assignment interface
  if (booking?.payment_status !== 'Verified') {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Payment must be verified before assigning units.
        </AlertDescription>
      </Alert>
    );
  }

  // Only render assignment interface if all guards pass
  return <UnitAssignmentInterface {...props} />;
}
```

---

## Database Transaction Issues

### Issue 15: Partial Assignment Created (Transaction Not Rolling Back)

**Symptom**: Some `booking_units` entries created, others missing

**Diagnosis**:

```sql
-- Check booking_units entries
SELECT booking_id, unit_id, status
FROM booking_units
WHERE booking_id = 'PROBLEM_BOOKING_ID';

-- Check if count matches requested
SELECT
  (SELECT COUNT(*) FROM booking_units WHERE booking_id = 'PROBLEM_BOOKING_ID') AS assigned,
  (SELECT COUNT(*) FROM guest_booking_unit_requests WHERE booking_id = 'PROBLEM_BOOKING_ID') AS requested;
```

**Root Cause**: Function not using transaction properly

**Solution**:

```sql
-- Ensure function has proper EXCEPTION block
CREATE OR REPLACE FUNCTION assign_units_to_booking(...)
RETURNS VOID AS $$
BEGIN
  -- All operations here are in implicit transaction

  -- If ANY error occurs, jump to EXCEPTION block
  -- PostgreSQL automatically rolls back transaction

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Assignment failed: % - All changes rolled back', SQLERRM;
    -- All INSERTs and UPDATEs are undone automatically
END;
$$ LANGUAGE plpgsql;
```

**Manual Cleanup** (if partial state exists):

```sql
-- Delete orphaned booking_units
DELETE FROM booking_units
WHERE booking_id = 'PROBLEM_BOOKING_ID';

-- Reset booking status
UPDATE bookings
SET unit_assignment_status = 'pending',
    booking_status = 'Pending'
WHERE booking_id = 'PROBLEM_BOOKING_ID';
```

---

### Issue 16: "Deadlock Detected" Error

**Symptom**:

```
ERROR: deadlock detected
DETAIL: Process 1234 waits for ShareLock on transaction 5678
```

**Cause**: Two admins assigning overlapping units simultaneously

**Solution**: This is actually **expected behavior** - one transaction will succeed, the other will fail and roll back.

**Handling in UI**:

```typescript
// Show helpful error message
if (error.message.includes('deadlock')) {
  return (
    <Alert variant="destructive">
      <AlertDescription>
        Another admin is currently assigning units. Please wait and try again.
      </AlertDescription>
    </Alert>
  );
}
```

**Prevention**: Not needed - EXCLUDE constraint is the correct mechanism.

---

## Network and CORS Issues

### Issue 17: CORS Error in Browser Console

**Symptom**:

```
Access to fetch at 'http://localhost:5173/api/admin/available-units' from origin 'http://localhost:5173' has been blocked by CORS policy
```

**Solution**:

```typescript
// Ensure corsHeaders are set on ALL responses (including errors)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Or specific origin
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function onRequest(context) {
  // Handle OPTIONS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders }); // <-- Must include headers
  }

  try {
    // ... your logic

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }, // <-- Include corsHeaders
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }, // <-- Include on errors too
    });
  }
}
```

---

## Performance Issues

### Issue 18: Available Units Query Slow

**Symptom**: Takes >3 seconds to load available units

**Diagnosis**:

```sql
-- Check query performance
EXPLAIN ANALYZE
SELECT unit_id FROM booking_units
WHERE status = 'confirmed'
  AND check_out_date >= '2025-12-01'
  AND check_in_date <= '2025-12-05';
```

**Solution**:

```sql
-- Create indexes on date columns
CREATE INDEX IF NOT EXISTS idx_booking_units_dates
ON booking_units(check_in_date, check_out_date)
WHERE status = 'confirmed';

-- Create partial index for active bookings
CREATE INDEX IF NOT EXISTS idx_booking_units_active
ON booking_units(unit_id, check_in_date, check_out_date)
WHERE status = 'confirmed';
```

**Optimization**:

```typescript
// Cache available units query
const { data: availableUnits, isLoading } = useQuery({
  queryKey: ["available-units", checkInDate, checkOutDate],
  queryFn: fetchAvailableUnits,
  staleTime: 5 * 60 * 1000, // <-- Cache for 5 minutes
  cacheTime: 10 * 60 * 1000,
});
```

---

## Still Stuck?

If your issue isn't covered here:

### 1. Check Logs

**Browser Console**:

```
Right-click → Inspect → Console tab
Look for red errors or warnings
```

**Server Console**:

```bash
npm run dev
# Watch for error logs with [ASSIGN_UNITS_ERROR] prefix
```

**Database Logs** (Supabase Dashboard):

```
Supabase Dashboard → Logs → Postgres Logs
Filter by error level
```

### 2. Verify Prerequisites

```bash
# Check chunks 001-012 completed
git log --oneline | grep "chunk-01"
# Should see: chunk-001, chunk-002, ..., chunk-012

# Check database state
npx supabase db execute "SELECT * FROM bookings LIMIT 1;"
npx supabase db execute "SELECT * FROM booking_units LIMIT 1;"
```

### 3. Reset and Retry

```bash
# Clear Vite cache
rm -rf node_modules/.vite

# Reinstall dependencies
npm install

# Restart dev server
npm run dev
```

### 4. Rollback and Redo

```sql
-- Drop function and recreate
DROP FUNCTION IF EXISTS assign_units_to_booking(UUID, UUID[]);

-- Then re-run migration from instructions.md
```

### 5. Get Help

**Community Resources**:

- Check `docs/implementation/guest-booking-multi-unit/04-admin-interface.md` lines 351-600
- Review `docs/implementation/guest-booking-multi-unit/CHUNKING-STRATEGY.md` lines 447-478
- Search existing issues in project repository

**Debug Information to Provide**:

- Error message (full text)
- Browser console logs
- Server console logs
- Database query results
- Steps to reproduce
- Chunk completion status (which chunks completed)

---

**Remember**: Most issues are due to:

1. Missing prerequisites (chunks 001-012)
2. Environment variables not set
3. Database constraints not created
4. PostgreSQL extension not enabled
5. Authentication token issues

Work through the checklist systematically and you'll find the issue!
