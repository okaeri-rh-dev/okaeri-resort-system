# Phase 1 Handoff Document

# Public Availability Calendar - Backend Implementation Guide

**From**: Phase 0 (Infrastructure Foundation)
**To**: Phase 1 (Backend Implementation)
**Date**: 2025-10-10
**Status**: ✅ Ready to Start

---

## Phase 0 Summary

Phase 0 successfully verified and configured all infrastructure prerequisites. The system is ready for Phase 1 backend implementation.

### What Was Completed in Phase 0

✅ **Infrastructure Verification**:

- KV namespace `RATE_LIMIT_KV` configured for production and preview
- Turnstile keys verified and properly set
- Supabase configuration verified
- Existing utility libraries documented and ready for reuse

✅ **Optional Enhancements**:

- Added `BLOCKED_IPS_KV` namespace bindings to `wrangler.toml` (pending creation)

✅ **Documentation**:

- Infrastructure Verification Report created
- Phase 1 Handoff Document created (this document)

---

## Phase 1 Scope: Backend Implementation

**Estimated Duration**: 2 days (16 hours)

### Deliverables

1. **Database Function**: `get_public_aggregate_availability(p_start_date DATE, p_end_date DATE)`
   - Returns aggregated availability counts (0-3 units available per date)
   - Uses `SECURITY DEFINER` to bypass RLS safely
   - Supports multi-unit bookings (future-proof)
   - Handles blackout periods
   - File: SQL migration to be executed in Supabase

2. **API Endpoint**: `/functions/api/public/v1/availability.ts`
   - Public GET endpoint (no authentication required)
   - Query params: `?start=YYYY-MM-DD&end=YYYY-MM-DD`
   - Returns JSON with availability data
   - 5-minute CDN caching
   - Rate limiting (30-60 req/min per IP)

3. **Rate Limiting Middleware**: `/functions/api/public/v1/_middleware.ts` (optional)
   - IP-based rate limiting using KV
   - 30-60 requests per minute per IP
   - Retry-After headers

4. **Testing**: Comprehensive API testing
   - Unit tests for database function
   - Integration tests for API endpoint
   - cURL and Postman test collections

---

## Implementation Roadmap

### Step 1: Database Function Creation (4-6 hours)

**Task**: Create `get_public_aggregate_availability()` PostgreSQL function

**Location**: Execute SQL in Supabase SQL Editor

**SQL to Execute**: (from `docs/public-availability-calendar/01-phase-1-backend.md`, lines 164-321)

**Key Requirements**:

- Function must use `SECURITY DEFINER` to bypass RLS
- Return type: `TABLE (date DATE, available_count INT)`
- Support multi-unit bookings via UNION of `bookings.unit_id` and `booking_units` table
- Handle blackout periods from `availability_blackouts` table
- Validate inputs (date format, range limits, past date rejection)
- Optimize with `STABLE` keyword and proper indexing

**Validation**:

```sql
-- Test query
SELECT * FROM get_public_aggregate_availability('2025-01-01', '2025-01-31');

-- Check performance
EXPLAIN ANALYZE SELECT * FROM get_public_aggregate_availability('2025-01-01', '2025-01-31');
```

**Success Criteria**:

- ✅ Function executes without errors
- ✅ Returns expected date range (31 days for January)
- ✅ Available counts are accurate (0-3)
- ✅ Query execution time < 100ms for 31-day range
- ✅ Function appears in TypeScript types after regeneration

**After Creation**:

```bash
# Regenerate TypeScript types
npx supabase gen types typescript --local > src/types/database.types.ts
```

---

### Step 2: API Endpoint Creation (6-8 hours)

**Task**: Create `/functions/api/public/v1/availability.ts`

**Reference Implementation**: `functions/api/guest-booking.ts` (similar patterns)

**File Structure**:

```typescript
// functions/api/public/v1/availability.ts
import { createClient } from "@supabase/supabase-js";

interface Env {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  ENVIRONMENT: "production" | "development";
}

export async function onRequest(context: {
  request: Request;
  env: Env;
  waitUntil: (promise: Promise<any>) => void;
}) {
  // 1. CORS headers
  // 2. Handle OPTIONS preflight
  // 3. Validate date parameters
  // 4. Call database function
  // 5. Transform response
  // 6. Return with cache headers
}
```

**Key Components**:

1. **CORS Headers** (reuse from `_middleware.ts:108-140`):

   ```typescript
   const allowedOrigins = [
     "https://okaeri-resort.com",
     "https://www.okaeri-resort.com",
     env.ENVIRONMENT === "development" ? "http://localhost:5173" : null,
   ].filter(Boolean) as string[];
   ```

2. **Date Validation**:
   - Format: `YYYY-MM-DD` (ISO 8601)
   - Range: Today to 1 year ahead
   - Max span: 180 days
   - Reject past dates

3. **Database Call**:

   ```typescript
   const { data, error } = await supabase.rpc("get_public_aggregate_availability", {
     p_start_date: startDate,
     p_end_date: endDate,
   });
   ```

4. **Response Format**:

   ```json
   {
     "totalUnits": 3,
     "dateRange": { "start": "2025-01-01", "end": "2025-01-31" },
     "availability": [
       { "date": "2025-01-01", "availableCount": 3, "status": "full" },
       { "date": "2025-01-15", "availableCount": 2, "status": "moderate" }
     ],
     "metadata": {
       "generatedAt": "2025-01-10T10:30:00Z",
       "cacheMaxAge": 300,
       "version": "v1"
     }
   }
   ```

5. **Cache Headers**:
   ```typescript
   "Cache-Control": "public, s-maxage=300, stale-while-revalidate=120"
   ```

**Optional Enhancements**:

- Turnstile verification (from `guest-booking.ts:151-168`)
- Audit logging (from `audit-logger-workers.ts`)

**Success Criteria**:

- ✅ GET request returns 200 OK with valid data
- ✅ OPTIONS request returns 204 No Content
- ✅ Invalid dates return 400 Bad Request
- ✅ Past dates return 400 Bad Request
- ✅ Response includes proper CORS headers
- ✅ Response includes cache headers

---

### Step 3: Rate Limiting Middleware (2-3 hours, optional)

**Task**: Create `/functions/api/public/v1/_middleware.ts`

**Reference**: `functions/api/guest-booking.ts:86-108`

**Reusable Utility**: `src/lib/kv-rate-limit.ts`

**Implementation**:

```typescript
import { checkKVRateLimit } from "@/lib/kv-rate-limit";

export async function onRequest(context) {
  const { request, env, next } = context;

  if (request.method === "OPTIONS") return next();

  const clientIp = request.headers.get("cf-connecting-ip") || "unknown";

  const rateLimit = await checkKVRateLimit(env.RATE_LIMIT_KV, clientIp, {
    limit: 60, // 60 requests
    windowSeconds: 60, // per minute
  });

  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded",
        retryAfter: rateLimit.retryAfter,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rateLimit.retryAfter),
        },
      }
    );
  }

  return next();
}
```

**Success Criteria**:

- ✅ 61st request within 60 seconds returns 429 Too Many Requests
- ✅ Response includes `Retry-After` header
- ✅ Rate limit resets after window expires

---

### Step 4: Testing (3-4 hours)

**cURL Tests**:

```bash
# Happy path
curl "http://localhost:8788/api/public/v1/availability?start=2025-01-01&end=2025-01-31"

# Invalid date format
curl "http://localhost:8788/api/public/v1/availability?start=invalid&end=2025-01-31"

# Past date (should reject)
curl "http://localhost:8788/api/public/v1/availability?start=2024-01-01&end=2024-01-31"

# Range too large (should reject)
curl "http://localhost:8788/api/public/v1/availability?start=2025-01-01&end=2026-01-01"

# CORS preflight
curl -X OPTIONS "http://localhost:8788/api/public/v1/availability" \
  -H "Origin: https://okaeri-resort.com" \
  -H "Access-Control-Request-Method: GET"

# Rate limiting (send 61 requests rapidly)
for i in {1..61}; do
  curl "http://localhost:8788/api/public/v1/availability?start=2025-01-01&end=2025-01-31"
done
```

**Postman Collection**: Create collection with:

- GET success case
- GET with invalid dates
- GET with past dates
- GET with large range
- OPTIONS preflight
- Rate limit test

**Success Criteria**:

- ✅ All validation tests pass
- ✅ CORS preflight succeeds
- ✅ Rate limiting works correctly
- ✅ Error responses have proper format

---

## Existing Utilities to Reuse

### 1. Rate Limiting (`src/lib/kv-rate-limit.ts`)

```typescript
import { checkKVRateLimit } from "@/lib/kv-rate-limit";

const rateLimit = await checkKVRateLimit(env.RATE_LIMIT_KV, clientIp, {
  limit: 60,
  windowSeconds: 60,
});
```

### 2. Turnstile Verification (`src/lib/turnstile.ts`)

```typescript
import { getClientIp, verifyTurnstile } from "@/lib/turnstile";

const clientIp = getClientIp(request);
const isValid = await verifyTurnstile(token, env.TURNSTILE_SECRET_KEY, {
  remoteip: clientIp,
  expectedAction: "view-availability",
});
```

### 3. Audit Logging (`src/lib/audit-logger-workers.ts`)

```typescript
import { logAuditEvent } from "@/lib/audit-logger-workers";

waitUntil(
  logAuditEvent({
    action: "public_calendar.viewed",
    entity_type: "calendar",
    entity_id: null,
    user_id: null,
    severity: "INFO",
    ip_address: request.headers.get("cf-connecting-ip"),
    metadata: {
      start_date: startDate,
      end_date: endDate,
      days_queried: daysDiff,
    },
  }).catch(console.error)
);
```

### 4. Supabase Client (`src/lib/supabase.ts`)

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const { data, error } = await supabase.rpc("get_public_aggregate_availability", {
  p_start_date: startDate,
  p_end_date: endDate,
});
```

---

## Implementation Checklist

### Pre-Implementation

- [ ] Review Phase 1 documentation (`docs/public-availability-calendar/01-phase-1-backend.md`)
- [ ] Review master plan (`docs/public-availability-calendar/00-master-plan.md`)
- [ ] Verify infrastructure (see Phase 0 Verification Report)
- [ ] Set up local development environment
- [ ] Review existing patterns in `functions/api/guest-booking.ts`

### Database Implementation

- [ ] Create `get_public_aggregate_availability()` function in Supabase
- [ ] Grant execute permission to `anon` role
- [ ] Test function with sample date ranges
- [ ] Check query performance with `EXPLAIN ANALYZE`
- [ ] Verify index `idx_bookings_status_dates` exists
- [ ] Regenerate TypeScript types

### API Implementation

- [ ] Create `/functions/api/public/v1/availability.ts`
- [ ] Implement CORS headers
- [ ] Implement date validation
- [ ] Implement database call
- [ ] Implement response transformation
- [ ] Add cache headers
- [ ] Handle errors gracefully

### Optional Enhancements

- [ ] Create rate limiting middleware (`_middleware.ts`)
- [ ] Add Turnstile verification (optional for view-only)
- [ ] Add audit logging for calendar views

### Testing

- [ ] Test with cURL (all scenarios)
- [ ] Create Postman collection
- [ ] Test database function performance
- [ ] Test API response format
- [ ] Test CORS headers
- [ ] Test cache headers
- [ ] Test rate limiting
- [ ] Test error handling

### Deployment Preparation

- [ ] Create production Cloudflare Workers secrets:
  ```bash
  npx wrangler secret put VITE_SUPABASE_URL
  npx wrangler secret put VITE_SUPABASE_ANON_KEY
  npx wrangler secret put TURNSTILE_SECRET_KEY  # if used
  ```
- [ ] Test deployment to Cloudflare Pages preview
- [ ] Verify CDN caching behavior

---

## Success Criteria for Phase 1

### Functional Requirements

✅ Database function:

- Returns aggregated availability counts
- Handles date validation
- Supports multi-unit bookings
- Executes in < 100ms

✅ API endpoint:

- Returns valid JSON response
- Validates date parameters
- Handles errors gracefully
- Includes proper CORS headers
- Includes cache headers (5-minute TTL)

✅ Optional features (if implemented):

- Rate limiting works correctly
- Turnstile verification functional
- Audit logging captures views

### Performance Requirements

- Database query: < 100ms for 31-day range
- API response: < 500ms total latency
- CDN cache hit ratio: N/A (not measurable until traffic)

### Security Requirements

- ✅ SECURITY DEFINER function only exposes aggregated data
- ✅ No guest information exposed
- ✅ Input validation prevents SQL injection
- ✅ Rate limiting prevents abuse
- ✅ CORS headers properly configured

---

## Known Limitations & Deferred Items

### Out of Scope for Phase 1

The following items are **intentionally excluded** from Phase 1 and will be addressed in later phases:

❌ **Frontend Implementation** (Phase 2):

- React calendar component
- TanStack Query integration
- Mobile responsive design
- User interface

❌ **SEO & Analytics** (Phase 2):

- Meta tags
- Structured data
- Analytics tracking

❌ **Deployment & Monitoring** (Phase 3):

- Production deployment
- Lighthouse audits
- Monitoring setup
- Performance optimization

### Acceptable Technical Debt

The following items are acceptable technical debt for Phase 1 MVP:

- ⚠️ **CDN cache invalidation**: Manual (no automated invalidation on booking changes)
- ⚠️ **Turnstile**: Optional for view-only calendar
- ⚠️ **Audit logging**: Optional for Phase 1
- ⚠️ **BLOCKED_IPS_KV**: Namespace added but not used until needed

---

## Risk Mitigation

| Risk                            | Probability | Impact | Mitigation                              |
| ------------------------------- | ----------- | ------ | --------------------------------------- |
| Database function slow (>100ms) | Low         | Medium | Index optimization, query profiling     |
| CORS issues in production       | Low         | High   | Test with actual production domain      |
| Rate limit too restrictive      | Medium      | Low    | Adjust limits based on traffic patterns |
| CDN not caching properly        | Low         | Medium | Verify cache headers, test with cURL    |

---

## Next Steps After Phase 1

Once Phase 1 is complete and verified:

1. **Move to Phase 2: Frontend Implementation**
   - Duration: 3-4 days
   - Deliverables: React calendar components, TanStack Query integration, mobile UX

2. **Update Documentation**
   - Create Phase 1 Verification Report
   - Create Phase 2 Handoff Document

3. **Notify Stakeholders**
   - API endpoint available for testing
   - Share API documentation
   - Request feedback

---

## Quick Reference

### File Locations

- **Phase 1 Documentation**: `docs/public-availability-calendar/01-phase-1-backend.md`
- **Database Function**: Execute SQL in Supabase SQL Editor
- **API Endpoint**: `functions/api/public/v1/availability.ts`
- **Rate Limiting Middleware** (optional): `functions/api/public/v1/_middleware.ts`
- **Configuration**: `wrangler.toml`
- **Environment Variables**: `.env.local`

### Key Commands

```bash
# Database types regeneration
npx supabase gen types typescript --local > src/types/database.types.ts

# Local development
npm run dev  # Vite frontend (port 5173)
npx wrangler pages dev dist  # Workers (port 8788)

# Testing
curl "http://localhost:8788/api/public/v1/availability?start=2025-01-01&end=2025-01-31"

# Deployment
npm run build
npx wrangler pages deploy dist
```

### Useful Links

- [Master Plan](./00-master-plan.md)
- [Phase 1 Backend Guide](./01-phase-1-backend.md)
- [Architecture Diagrams](./architecture-diagrams.md)
- [Phase 0 Verification Report](./PHASE-0-VERIFICATION-REPORT.md)

---

**Document Version**: 1.0
**Created**: 2025-10-10
**Phase 1 Ready**: ✅ YES
**Estimated Start Date**: 2025-10-10
**Estimated Completion Date**: 2025-10-12 (2 days)
