# Troubleshooting: Chunk 011

## Common Issues and Solutions

This document provides solutions to common issues encountered during chunk 011 implementation.

---

## Issue 1: Queue Shows No Bookings

**Symptom**:

- Queue page loads successfully
- Table shows "No pending bookings found"
- API returns `{ "bookings": [], "count": 0 }`

**Possible Causes**:

### Cause A: No Test Bookings Created

**Solution**: Create test bookings using SQL

```sql
-- Insert test booking with urgency
INSERT INTO bookings (
  booking_reference,
  guest_name,
  guest_contact,
  check_in_date,
  check_out_date,
  total_amount,
  payment_status,
  is_multi_unit,
  is_guest_booking,
  requested_unit_count,
  unit_assignment_status,
  created_at
) VALUES (
  'TEST-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8)),
  'Test Guest - High Urgency',
  '+63 917 123 4567',
  CURRENT_DATE + INTERVAL '1 day', -- Tomorrow (high urgency)
  CURRENT_DATE + INTERVAL '4 days',
  45000,
  'Pending',
  TRUE,
  TRUE,
  3,
  'pending',
  CURRENT_TIMESTAMP - INTERVAL '2 days' -- Created 2 days ago
) RETURNING booking_id;

-- Copy the returned booking_id, then insert unit requests
INSERT INTO guest_booking_unit_requests (booking_id, guests_per_unit)
VALUES
  ('PASTE_BOOKING_ID_HERE', 2),
  ('PASTE_BOOKING_ID_HERE', 3),
  ('PASTE_BOOKING_ID_HERE', 2);
```

Refresh the queue - should see test booking.

### Cause B: Bookings Not Filtered Correctly

**Debugging Commands**:

```sql
-- Check if any multi-unit bookings exist
SELECT COUNT(*) FROM bookings WHERE is_multi_unit = TRUE;

-- Check if any have pending status
SELECT COUNT(*) FROM bookings
WHERE is_multi_unit = TRUE
  AND unit_assignment_status = 'pending';

-- Check is_guest_booking flag
SELECT COUNT(*) FROM bookings
WHERE is_multi_unit = TRUE
  AND is_guest_booking = TRUE
  AND unit_assignment_status = 'pending';
```

**Solution**: Ensure bookings have all required flags:

- `is_multi_unit = TRUE`
- `is_guest_booking = TRUE`
- `unit_assignment_status = 'pending'`

### Cause C: Missing Unit Requests

**Symptom**: API returns bookings but `requested_unit_count = 0`

**Debugging**:

```sql
-- Check if unit requests exist
SELECT
  b.booking_reference,
  COUNT(u.id) as unit_count
FROM bookings b
LEFT JOIN guest_booking_unit_requests u ON u.booking_id = b.booking_id
WHERE b.is_multi_unit = TRUE
GROUP BY b.booking_id, b.booking_reference;
```

**Solution**: Insert missing unit requests:

```sql
INSERT INTO guest_booking_unit_requests (booking_id, guests_per_unit)
VALUES ('booking_id_here', 2);
```

---

## Issue 2: Urgency Scores All Showing 0

**Symptom**:

- Queue displays bookings
- All urgency scores show `0`
- All urgency badges show "Low"

**Possible Causes**:

### Cause A: Missing Date Columns

**Debugging**:

```sql
-- Check for NULL dates
SELECT
  booking_reference,
  check_in_date,
  created_at
FROM bookings
WHERE is_multi_unit = TRUE
  AND (check_in_date IS NULL OR created_at IS NULL);
```

**Solution**: Update NULL dates:

```sql
UPDATE bookings
SET
  check_in_date = CURRENT_DATE + INTERVAL '7 days',
  created_at = CURRENT_TIMESTAMP
WHERE check_in_date IS NULL OR created_at IS NULL;
```

### Cause B: Urgency Scoring Import Error

**Symptom**: Console error: `Cannot find module 'urgency-scoring'`

**Solution**:

```bash
# Verify file exists
ls -la src/lib/urgency-scoring.ts

# Check TypeScript compilation
npm run type-check

# Restart dev server
npm run dev
```

If file missing, re-create using instructions.md Step 1.

### Cause C: Date Format Issues

**Symptom**: Urgency score calculation returns `NaN`

**Debugging**: Add console.log in `calculateUrgencyScore()`:

```typescript
export function calculateUrgencyScore(params: UrgencyScoreParams): number {
  console.log("Scoring params:", params);

  const checkIn = new Date(params.check_in_date);
  console.log("Check-in date parsed:", checkIn, "Valid:", !isNaN(checkIn.getTime()));

  // ... rest of function
}
```

**Solution**: Ensure dates are ISO 8601 strings:

```typescript
// Fix API endpoint to return ISO dates
check_in_date: new Date(booking.check_in_date).toISOString(),
created_at: new Date(booking.created_at).toISOString(),
```

---

## Issue 3: API Returns 401 Unauthorized

**Symptom**:

- Browser console error: `Failed to fetch pending bookings`
- API response: `{ "error": "Unauthorized - Missing or invalid token" }`
- Status code: 401

**Possible Causes**:

### Cause A: Missing JWT Token

**Debugging**:

```javascript
// Browser console
console.log(localStorage.getItem("auth_token"));
// Should return a JWT string, not null
```

**Solution**: Log in as admin user

```bash
# Ensure you're authenticated
# Navigate to your login page and log in with admin credentials
```

### Cause B: Expired JWT Token

**Solution**: Refresh authentication

```javascript
// Browser console - clear old token
localStorage.removeItem("auth_token");

// Log in again
```

### Cause C: Incorrect Authorization Header

**Debugging**: Check browser DevTools → Network tab → `/api/admin/pending-bookings` request → Headers

Expected:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Solution**: Verify `PendingBookingsQueue.tsx` sends correct header:

```typescript
headers: {
  'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
}
```

---

## Issue 4: API Returns 403 Forbidden

**Symptom**:

- API response: `{ "error": "Forbidden - Admin access required" }`
- Status code: 403

**Possible Causes**:

### Cause A: User Not Admin Role

**Debugging**:

```sql
-- Check user's role in Supabase
SELECT
  id,
  email,
  raw_user_meta_data->>'role' as role,
  raw_app_meta_data->>'role' as app_role
FROM auth.users
WHERE email = 'your_email@example.com';
```

**Solution**: Update user role:

```sql
-- Set admin role in user_metadata
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'your_email@example.com';

-- OR set in app_metadata
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'your_email@example.com';
```

After updating, log out and log in again.

### Cause B: Role Check Logic Incorrect

**Debugging**: Add console.log in `pending-bookings.ts`:

```typescript
const userRole = user.user_metadata?.role || user.app_metadata?.role;
console.log("User role:", userRole);

if (userRole !== "admin") {
  console.log("Access denied - role is not admin");
  // ...
}
```

**Solution**: Verify JWT contains role claim:

```javascript
// Browser console - decode JWT
const token = localStorage.getItem("auth_token");
const payload = JSON.parse(atob(token.split(".")[1]));
console.log("JWT payload:", payload);
// Check user_metadata.role or app_metadata.role
```

---

## Issue 5: Auto-Refresh Not Working

**Symptom**:

- Queue doesn't update automatically
- Manual refresh required to see new bookings
- No network requests after initial load

**Possible Causes**:

### Cause A: TanStack Query Not Configured

**Debugging**: Check React Query DevTools (install if needed):

```bash
npm install @tanstack/react-query-devtools
```

Add to app:

```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// In app component
<ReactQueryDevtools initialIsOpen={false} />
```

Open DevTools, check `pending-multi-unit-bookings` query:

- `refetchInterval` should be `30000`
- `staleTime` should be `25000`

**Solution**: Verify `useQuery` configuration in `PendingBookingsQueue.tsx`:

```typescript
const { data, isLoading } = useQuery({
  queryKey: ["pending-multi-unit-bookings"],
  queryFn: async () => {
    /* ... */
  },
  refetchInterval: 30000, // ← Must be present
  staleTime: 25000,
});
```

### Cause B: Component Unmounted

**Symptom**: Auto-refresh stops when navigating away and back

**Solution**: This is expected behavior. TanStack Query pauses refetch when component unmounts. Re-mounts trigger fresh fetch.

### Cause C: Browser Tab Not Active

**Symptom**: Auto-refresh pauses when tab in background

**Solution**: This is expected browser behavior. TanStack Query respects `document.visibilityState`. Switch to tab to resume.

---

## Issue 6: TypeScript Errors on Urgency Types

**Symptom**:

- `npm run type-check` fails
- Error: `Cannot find name 'UrgencyLevel'`
- Error: `Property 'urgency_score' does not exist on type 'PendingBooking'`

**Possible Causes**:

### Cause A: Types Not Exported

**Solution**: Verify `src/lib/urgency-scoring.ts` exports types:

```typescript
export type UrgencyLevel = "critical" | "high" | "medium" | "low";
export interface UrgencyScoreParams {
  /* ... */
}
export interface UrgencyResult {
  /* ... */
}
```

### Cause B: Import Path Incorrect

**Solution**: Fix import in `PendingBookingsQueue.tsx`:

```typescript
import { formatUrgencyLevel, type UrgencyLevel } from "@/lib/urgency-scoring";
```

Verify `@/` path alias configured in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Cause C: Database Types Not Regenerated

**Solution**: Regenerate Supabase types:

```bash
# Generate types from Supabase schema
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.types.ts
```

---

## Issue 7: Filters Not Working

**Symptom**:

- Search input doesn't filter results
- Urgency/date filters don't change displayed bookings

**Possible Causes**:

### Cause A: State Not Updating

**Debugging**: Add console.log in filter handlers:

```typescript
const [filters, setFilters] = useState({ /* ... */ });

// In search input
onChange={(e) => {
  console.log('Search value:', e.target.value);
  setFilters({ ...filters, searchQuery: e.target.value });
}}
```

Check browser console when typing.

**Solution**: Verify state updates and component re-renders.

### Cause B: Filtering Logic Incorrect

**Debugging**: Log filtered results:

```typescript
const filteredBookings = bookings?.filter((booking) => {
  console.log("Filtering booking:", booking.booking_reference);
  // ... filter logic
});

console.log("Filtered count:", filteredBookings?.length);
```

**Solution**: Review filter logic in `PendingBookingsQueue.tsx`, ensure all conditions correct.

### Cause C: Case-Sensitive Comparison

**Solution**: Ensure `.toLowerCase()` used for search:

```typescript
const query = filters.searchQuery.toLowerCase();
const matchesSearch =
  booking.booking_reference.toLowerCase().includes(query) ||
  booking.guest_name.toLowerCase().includes(query);
```

---

## Issue 8: Mobile Layout Broken

**Symptom**:

- Horizontal scroll on mobile
- Filter controls overlap
- Table columns too narrow

**Possible Causes**:

### Cause A: Missing Responsive Classes

**Solution**: Verify filter controls use responsive classes:

```typescript
<div className="flex flex-col sm:flex-row gap-4">
  {/* Filters */}
</div>
```

### Cause B: Table Not Responsive

**Solution**: Wrap table in responsive container:

```typescript
<div className="rounded-md border overflow-x-auto">
  <Table>
    {/* ... */}
  </Table>
</div>
```

### Cause C: Fixed Width Elements

**Solution**: Use responsive width utilities:

```typescript
<Select>
  <SelectTrigger className="w-full sm:w-[180px]">
    {/* ... */}
  </SelectTrigger>
</Select>
```

---

## Issue 9: "Assign Units" Button Does Nothing

**Symptom**:

- Clicking "Assign Units" doesn't navigate
- Console error: Navigation failed

**Possible Causes**:

### Cause A: Route Not Created (Expected Until Chunk 013)

**Solution**: This is EXPECTED behavior until chunk 013. Clicking button will show 404 or error.

Verify navigation attempt works:

```typescript
<Button
  size="sm"
  onClick={() => {
    console.log('Navigating to:', `/admin/assign-units/${booking.booking_id}`);
    window.location.href = `/admin/assign-units/${booking.booking_id}`;
  }}
>
  Assign Units
</Button>
```

Console should log navigation URL. Receiving 404 is OK for now.

### Cause B: Booking ID Undefined

**Debugging**:

```typescript
onClick={() => {
  console.log('Booking ID:', booking.booking_id);
  if (!booking.booking_id) {
    console.error('Missing booking_id');
    return;
  }
  window.location.href = `/admin/assign-units/${booking.booking_id}`;
}}
```

**Solution**: Ensure API returns `booking_id` field.

---

## Issue 10: Build Fails

**Symptom**:

- `npm run build` fails
- Error: Module not found

**Possible Causes**:

### Cause A: Missing Dependencies

**Solution**:

```bash
# Install missing dependencies
npm install

# Verify all imports exist
npm run type-check
```

### Cause B: Import Path Issues

**Solution**: Check import paths match file locations:

```typescript
// Correct
import { PendingBookingsQueue } from "@/components/admin/PendingBookingsQueue";
// Incorrect (missing .tsx extension in import)
import { PendingBookingsQueue } from "@/components/admin/PendingBookingsQueue.tsx";
```

### Cause C: Vite Cache Corruption

**Solution**:

```bash
# Clear Vite cache
rm -rf node_modules/.vite

# Rebuild
npm run build
```

---

## General Debugging Steps

If none of the above solutions work:

### 1. Check Browser Console

```
F12 → Console tab
```

Look for:

- Red error messages
- Network errors (failed API calls)
- React warnings

### 2. Check Network Tab

```
F12 → Network tab → Filter: Fetch/XHR
```

Verify:

- API request sent to `/api/admin/pending-bookings`
- Response status (200 = success)
- Response body (JSON structure)

### 3. Check React Query DevTools

```javascript
// Install if needed
npm install @tanstack/react-query-devtools

// Add to app
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
<ReactQueryDevtools initialIsOpen={false} />
```

Check:

- Query status (success/loading/error)
- Query data structure
- Refetch interval active

### 4. Verify Environment Variables

```bash
# Check .env.local exists
cat .env.local

# Verify Supabase variables set
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_ANON_KEY
```

### 5. Check Dependencies Installed

```bash
npm list @tanstack/react-query
npm list @supabase/supabase-js
npm list lucide-react
```

All should show installed versions.

### 6. Restart Dev Server

```bash
# Stop dev server (Ctrl+C)
# Clear cache
rm -rf node_modules/.vite

# Restart
npm run dev
```

---

## Still Stuck?

### Escalation Path

1. **Review checkpoint.md** - Ensure all checks completed
2. **Review instructions.md** - Re-read step-by-step guide
3. **Check source documentation**:
   - `docs/implementation/guest-booking-multi-unit/04-admin-interface.md` (lines 1-200)
   - `docs/implementation/guest-booking-multi-unit/CHUNKING-STRATEGY.md` (lines 376-409)
4. **Compare with existing patterns**:
   - `src/components/bookings/BookingsTable/` (similar table component)
   - `functions/api/guest-booking/` (similar API pattern)
5. **Check GitHub issues** (if project has public repo)
6. **Seek help**:
   - Project maintainer
   - Team lead
   - Developer forum

### Information to Provide When Asking for Help

```
**Issue Summary**: [One-sentence description]

**Chunk**: 011 - Admin Queue with Urgency Scoring

**Step**: [Which step in instructions.md]

**Error Message**:
```

[Exact error text from console/terminal]

```

**What I've Tried**:
- [List troubleshooting steps attempted]

**Environment**:
- Node version: [Run: node --version]
- npm version: [Run: npm --version]
- OS: [macOS/Windows/Linux]

**Screenshots**: [Attach if visual issue]
```

---

**Remember**: Most issues are typos, missing files, or incorrect configuration. Triple-check file paths, imports, and environment variables first.
