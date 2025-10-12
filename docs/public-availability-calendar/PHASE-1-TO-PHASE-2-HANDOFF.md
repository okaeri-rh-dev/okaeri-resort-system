# Phase 1 to Phase 2 Handoff Document

**From**: Phase 1 (Backend Implementation)
**To**: Phase 2 (Frontend Implementation)
**Date**: 2025-10-10
**Status**: ✅ Phase 1 Complete, Ready for Phase 2

---

## Phase 1 Summary

Phase 1 backend implementation has been completed successfully. All core infrastructure is in place for the public availability calendar feature.

### What Was Completed

✅ **Database Function**:

- `get_public_aggregate_availability(p_start_date DATE, p_end_date DATE)`
- SECURITY DEFINER to bypass RLS safely
- Returns aggregated availability counts (0-3 units)
- Input validation (dates, ranges, limits)
- Performance optimized (STABLE keyword, indexed queries)

✅ **API Endpoint**:

- `/api/public/v1/availability` (GET only)
- CORS headers (specific origins)
- Date validation (YYYY-MM-DD, ranges, limits)
- CDN cache headers (5-min fresh, 2-min stale)
- Optional Turnstile verification
- Optional audit logging
- Rate limiting (60 req/min per IP)

✅ **Testing Infrastructure**:

- Comprehensive cURL test suite
- Postman collection (importable JSON)
- Automated test script

---

## API Specification for Frontend

### Endpoint

```
GET /api/public/v1/availability
```

### Query Parameters

| Parameter            | Type   | Required                             | Format       | Constraints                          |
| -------------------- | ------ | ------------------------------------ | ------------ | ------------------------------------ |
| `start`              | string | No (defaults to current month start) | YYYY-MM-DD   | Today or later, max 1 year future    |
| `end`                | string | No (defaults to current month end)   | YYYY-MM-DD   | After start, max 180 days from start |
| `cf_turnstile_token` | string | No (optional)                        | Token string | Turnstile invisible mode token       |

### Success Response (200 OK)

```json
{
  "totalUnits": 3,
  "dateRange": {
    "start": "2025-01-01",
    "end": "2025-01-31"
  },
  "availability": [
    {
      "date": "2025-01-01",
      "availableCount": 3,
      "status": "full"
    },
    {
      "date": "2025-01-15",
      "availableCount": 2,
      "status": "moderate"
    },
    {
      "date": "2025-01-20",
      "availableCount": 0,
      "status": "booked"
    }
  ],
  "metadata": {
    "generatedAt": "2025-01-10T10:30:00Z",
    "cacheMaxAge": 300,
    "version": "v1"
  }
}
```

### Status Codes Mapping

```typescript
type AvailabilityStatus = "full" | "moderate" | "limited" | "booked";

function getStatusColor(status: AvailabilityStatus): string {
  switch (status) {
    case "full":
      return "bg-green-500"; // All 3 units available
    case "moderate":
      return "bg-yellow-500"; // 2 units available
    case "limited":
      return "bg-orange-500"; // 1 unit available
    case "booked":
      return "bg-red-500"; // Fully booked (0 available)
  }
}
```

### Error Responses

#### 400 Bad Request (Validation Error)

```json
{
  "error": "Invalid date format. Use YYYY-MM-DD (ISO 8601)"
}
```

#### 403 Forbidden (Turnstile Failed)

```json
{
  "error": "Bot verification failed"
}
```

#### 405 Method Not Allowed

```json
{
  "error": "Method not allowed"
}
```

#### 429 Too Many Requests (Rate Limited)

```json
{
  "error": "Rate limit exceeded. Please try again later.",
  "retryAfter": 45
}
```

Headers:

- `Retry-After: 45` (seconds)
- `X-RateLimit-Limit: 60`
- `X-RateLimit-Remaining: 0`
- `X-RateLimit-Reset: <timestamp>`

### Cache Headers (CDN)

```
Cache-Control: public, s-maxage=300, stale-while-revalidate=120
ETag: "availability-2025-01-01-2025-01-31-..."
Vary: Accept-Encoding
```

**Implication for Frontend**:

- TanStack Query should use `staleTime: 5 * 60 * 1000` (5 minutes)
- CDN will serve cached responses for 5 minutes
- Users can manually refresh by clicking "Today" button or navigating months

---

## Frontend Integration Guide

### 1. TanStack Query Setup

```typescript
// hooks/usePublicAvailability.ts
import { useQuery } from "@tanstack/react-query";

interface AvailabilityDay {
  date: string;
  availableCount: number;
  status: "full" | "moderate" | "limited" | "booked";
}

interface AvailabilityResponse {
  totalUnits: number;
  dateRange: {
    start: string;
    end: string;
  };
  availability: AvailabilityDay[];
  metadata: {
    generatedAt: string;
    cacheMaxAge: number;
    version: string;
  };
}

export function usePublicAvailability(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["publicAvailability", startDate, endDate],
    queryFn: async () => {
      const response = await fetch(`/api/public/v1/availability?start=${startDate}&end=${endDate}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch availability");
      }

      return response.json() as Promise<AvailabilityResponse>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes (matches CDN cache)
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: true,
    refetchOnMount: false,
  });
}
```

### 2. Calendar Component Structure

```typescript
// components/PublicAvailabilityCalendar.tsx
import { usePublicAvailability } from '@/hooks/usePublicAvailability';

export function PublicAvailabilityCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const startDate = formatISO(startOfMonth(currentMonth), { representation: 'date' });
  const endDate = formatISO(endOfMonth(currentMonth), { representation: 'date' });

  const { data, isLoading, error, refetch } = usePublicAvailability(startDate, endDate);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error.message} />;

  return (
    <div className="space-y-6">
      <CalendarHeader
        currentMonth={currentMonth}
        onPreviousMonth={() => setCurrentMonth(subMonths(currentMonth, 1))}
        onNextMonth={() => setCurrentMonth(addMonths(currentMonth, 1))}
        onToday={() => {
          setCurrentMonth(new Date());
          refetch(); // Manual refresh
        }}
      />

      <AvailabilityLegend />

      <CalendarGrid
        days={data.availability}
        currentMonth={currentMonth}
      />
    </div>
  );
}
```

### 3. Timezone Handling (Philippine Time)

```typescript
// utils/timezone.ts
import { zonedTimeToUtc, utcToZonedTime, format } from "date-fns-tz";

const TIMEZONE = "Asia/Manila"; // Philippine Time (UTC+8)

export function toPhilippineTime(date: Date): Date {
  return utcToZonedTime(date, TIMEZONE);
}

export function formatPhilippineDate(date: Date): string {
  const phDate = toPhilippineTime(date);
  return format(phDate, "yyyy-MM-dd", { timeZone: TIMEZONE });
}

// Usage in component:
const today = formatPhilippineDate(new Date());
const { data } = usePublicAvailability(today, endDate);
```

### 4. Error Handling

```typescript
// Handle different error types
if (error) {
  if (error.message.includes('Rate limit exceeded')) {
    return <RateLimitAlert retryAfter={error.retryAfter} />;
  }

  if (error.message.includes('Invalid date')) {
    return <ValidationError message={error.message} />;
  }

  return <GenericError onRetry={() => refetch()} />;
}
```

---

## Scope Changes from Phase 1

### 1. Multi-Unit Support Deferred

**Original Plan**: Support both single-unit (`bookings.unit_id`) and multi-unit (`booking_units` table) patterns via UNION.

**Actual Implementation**: Single-unit pattern only, because `booking_units` table doesn't exist yet.

**Impact on Phase 2**: None. Frontend receives aggregated counts regardless of booking pattern.

**Future Enhancement**: When `booking_units` table is created, update database function to add UNION branch (documented in migration file lines 100-103).

### 2. Audit Logging Simplified

**Original Plan**: Full audit trail with database inserts using `logAuditEventWithIP()`.

**Actual Implementation**: Console logging only (lines 279-291 in API endpoint).

**Impact on Phase 2**: None. Frontend doesn't interact with audit logging.

**Future Enhancement**: Upgrade to database logging if production metrics require detailed tracking.

### 3. Turnstile Remains Optional

**Original Plan**: Optional Turnstile verification for view-only calendar.

**Actual Implementation**: Implemented but optional (lines 208-226 in API endpoint).

**Impact on Phase 2**: Frontend can add Turnstile invisible widget if bot protection is needed, but not required for MVP.

**Recommendation**: Add Turnstile in Phase 3 if abuse patterns emerge.

---

## Known Issues & Workarounds

### Issue 1: booking_units Table Not Created

**Status**: Known limitation
**Workaround**: Database function uses single-unit pattern only
**Resolution**: Update function when booking_units table is created (UNION branch documented in migration)

### Issue 2: Type Generation Pending

**Status**: Manual step required
**Workaround**: Run `npx supabase gen types typescript` after database migration
**Resolution**: Execute command from Phase 1 Verification Report (Step 3)

### Issue 3: Index Verification Pending

**Status**: Manual step required
**Workaround**: Run verification query in Supabase SQL Editor
**Resolution**: Execute query from Phase 1 Verification Report (Step 2)

---

## Phase 2 Requirements

### Frontend Deliverables

1. **Route**: `/calendar` (public, no authentication required)
2. **Component**: `PublicAvailabilityCalendar`
   - Month navigation (< Previous | Today | Next >)
   - Calendar grid with color-coded days
   - Availability legend (green/yellow/orange/red)
   - Loading and error states
3. **State Management**:
   - TanStack Query for server state (availability data)
   - React useState for UI state (current month, hover states)
   - No Zustand needed (ephemeral view-only state)
4. **Styling**:
   - Tailwind CSS v4
   - Mobile responsive (iOS Safari, Android Chrome)
   - Accessibility (ARIA roles, keyboard navigation)
5. **Timezone**:
   - Philippine Time (Asia/Manila, UTC+8) using date-fns-tz
   - Format dates as ISO strings (YYYY-MM-DD) for API calls

### Testing Requirements

1. Unit tests for date utilities
2. Integration tests for TanStack Query hooks
3. E2E tests for calendar interaction
4. Accessibility tests (WCAG 2.1 AA)
5. Mobile device testing (real devices)

### Performance Targets

- Page load time: < 2 seconds
- Time to Interactive: < 3 seconds
- Lighthouse Performance score: > 90
- Mobile Lighthouse score: > 85

---

## Required Dependencies

### Already Installed

- ✅ `@tanstack/react-query` (v5)
- ✅ `@supabase/supabase-js`
- ✅ `tailwindcss` (v4 beta)
- ✅ `@tanstack/react-router` (v1)

### Need to Install

- ⏳ `date-fns` (date manipulation)
- ⏳ `date-fns-tz` (timezone handling)

```bash
npm install date-fns date-fns-tz
```

---

## API Testing Checklist

Before starting Phase 2 frontend, verify API is working:

```bash
# 1. Execute database migration
# (See Phase 1 Verification Report, Step 1)

# 2. Regenerate TypeScript types
npx supabase gen types typescript --local > src/types/database.types.ts

# 3. Run test suite
./docs/public-availability-calendar/test-availability-api.sh

# Expected output:
# 🧪 Testing Public Availability API
# Test 1: Default query... PASS
# Test 2: Specific date range... PASS
# ... (all tests PASS)
```

**All tests must pass before starting Phase 2 frontend work.**

---

## Environment Setup for Phase 2

### Development Environment

```bash
# .env.local (should already exist)
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=your_anon_key

# Optional (for Turnstile)
VITE_TURNSTILE_SITE_KEY=your_site_key
```

### Supabase Local (Recommended)

```bash
# Start Supabase local
supabase start

# Verify database function exists
supabase db dump --schema public | grep get_public_aggregate_availability
```

### Cloudflare Workers Local

```bash
# Start local development server
npm run dev

# API should be accessible at:
# http://localhost:8788/api/public/v1/availability
```

---

## Communication Points

### API Contract Stability

- ✅ API endpoint URL: `/api/public/v1/availability` (stable)
- ✅ Query parameters: `start`, `end`, `cf_turnstile_token` (stable)
- ✅ Response format: `AvailabilityResponse` (stable)
- ✅ Status codes: `full | moderate | limited | booked` (stable)
- ✅ Error responses: Documented and stable

**No breaking changes expected in Phase 2.**

### Backend Support

- Database function: Completed, no changes needed
- API endpoint: Completed, no changes needed
- Rate limiting: Configured, can adjust if needed
- Caching: Configured, monitoring in Phase 3

---

## Success Criteria for Phase 2

### Functional

- ✅ Calendar displays current month by default
- ✅ Users can navigate months (previous, next, today)
- ✅ Days are color-coded by availability (green/yellow/orange/red)
- ✅ Legend explains color coding
- ✅ Loading state shown while fetching data
- ✅ Error states handled gracefully
- ✅ Manual refresh works (Today button)

### Non-Functional

- ✅ Mobile responsive (iOS Safari, Android Chrome)
- ✅ Accessibility compliant (WCAG 2.1 AA)
- ✅ Performance targets met (< 2s page load)
- ✅ No console errors or warnings
- ✅ Lighthouse score > 90

### Testing

- ✅ Unit tests pass
- ✅ Integration tests pass
- ✅ E2E tests pass
- ✅ Accessibility tests pass
- ✅ Cross-browser testing complete

---

## Questions & Support

### For Backend Issues

- Review Phase 1 Verification Report
- Check test suite output
- Verify database migration was executed
- Confirm types were regenerated

### For API Integration

- Review API Specification section above
- Check example TanStack Query setup
- Verify CORS headers in browser dev tools
- Test with Postman collection first

### For Performance Issues

- Verify CDN cache headers present
- Check TanStack Query staleTime configuration
- Monitor network tab for API calls
- Consider prefetching next/previous months

---

## Next Steps

### Immediate (Before Phase 2)

1. ✅ Execute database migration (if not done)
2. ✅ Regenerate TypeScript types (if not done)
3. ✅ Run test suite and verify all PASS
4. ✅ Install required dependencies (`date-fns`, `date-fns-tz`)

### Phase 2 Development

1. Create `/calendar` route (public, no auth)
2. Implement `usePublicAvailability()` hook
3. Build `PublicAvailabilityCalendar` component
4. Add timezone handling (Philippine Time)
5. Style with Tailwind CSS v4
6. Add accessibility features
7. Test on mobile devices

### Phase 3 (Deployment)

1. Cross-browser testing
2. Lighthouse performance audits
3. Production deployment
4. Monitoring setup
5. Analytics integration

---

## Appendix

### Useful Links

- [Phase 1 Verification Report](./PHASE-1-VERIFICATION-REPORT.md)
- [Phase 1 Test Suite](./PHASE-1-TEST-SUITE.md)
- [Phase 2 Implementation Plan](./02-phase-2-frontend.md)
- [Architecture Diagrams](./architecture-diagrams.md)
- [Master Plan](./00-master-plan.md)

### File Locations

- Database Migration: `database/migrations/019-public-availability-function.sql`
- API Endpoint: `functions/api/public/v1/availability.ts`
- Middleware: `functions/api/public/v1/_middleware.ts`
- Test Suite: `docs/public-availability-calendar/PHASE-1-TEST-SUITE.md`
- Postman Collection: `docs/public-availability-calendar/PHASE-1-POSTMAN-COLLECTION.json`

---

**Document Version**: 1.0
**Created**: 2025-10-10
**Phase 1 Status**: ✅ Complete
**Phase 2 Status**: ⏳ Ready to Start
**Estimated Phase 2 Duration**: 3-4 days
