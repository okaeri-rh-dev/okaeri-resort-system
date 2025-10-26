# Chunk 014: Admin API Endpoints

## At a Glance

| Property | Value |
|----------|-------|
| **Chunk Number** | 014 |
| **Chunk Name** | admin-api-endpoints |
| **Phase** | Phase 3: Admin Interface |
| **Estimated Time** | 90 minutes |
| **Milestone** | Complete admin backend API for multi-unit booking management |
| **Can Skip?** | ❌ No - Critical backend support for admin workflows (chunks 011-013) |
| **Prerequisites** | Chunks 001-013 completed (esp. 001 for schema, 003 for constraints, 011-013 for admin UI) |

## What You're Building

This chunk implements the **complete admin backend API layer** that powers the multi-unit booking management interface. These endpoints provide queue management, availability checking, unit assignment, and payment verification capabilities.

### New API Endpoints (4)

1. **`GET /api/admin/pending-bookings`** (`functions/api/admin/pending-bookings.ts`)
   - Fetches all pending multi-unit bookings
   - Calculates urgency scores server-side (0-100 scale)
   - Sorts by urgency (highest first)
   - Returns booking details + unit requests
   - Includes guest contact information
   - JWT authentication + admin role required
   - Rate limited: 100 requests/hour

2. **`GET /api/admin/available-units`** (`functions/api/admin/available-units.ts`)
   - Accepts date range query parameters (`check_in`, `check_out`)
   - Returns units available for specified dates
   - Excludes units with overlapping bookings
   - Filters by `unit_status = 'Available'`
   - Includes capacity from `pricing_config` (uniform across all units)
   - JWT authentication + admin role required
   - Rate limited: 100 requests/hour

3. **`POST /api/admin/assign-units`** (`functions/api/admin/assign-units.ts`)
   - Accepts `{ booking_id, unit_ids: UUID[] }`
   - Calls PostgreSQL `assign_units_to_booking()` function
   - Validates all-or-nothing (array length = requested count)
   - Enforces payment verification (via DB constraint)
   - Creates audit log entry for assignment
   - Returns success/failure with detailed error mapping
   - JWT authentication + admin role required
   - Rate limited: 100 requests/hour

4. **`POST /api/admin/verify-payment`** (`functions/api/admin/verify-payment.ts`)
   - Accepts `{ booking_id, verified: boolean, notes?: string }`
   - Updates `payment_status` to 'Verified' or 'Rejected'
   - Stores admin notes (optional)
   - Creates audit log entry
   - Blocks unit assignment until verified (DB constraint)
   - JWT authentication + admin role required
   - Rate limited: 100 requests/hour

### New Utilities (2)

5. **Urgency Scoring** (`src/lib/urgency-scoring.ts`)
   - TypeScript implementation (application layer)
   - Calculates urgency score (0-100) based on:
     - Hours to check-in (max 50 points)
     - Days pending (max 20 points)
     - Booking value (max 15 points)
     - Unit count (max 15 points)
   - Badge thresholds: Critical (75+), High (50-74), Medium (25-49), Low (<25)
   - Optimized for <100 pending bookings
   - Migration to PostgreSQL function if latency >100ms

6. **Admin Authentication Middleware** (`functions/api/admin/_middleware.ts`)
   - JWT token extraction from Authorization header
   - Supabase Auth user verification
   - Admin role checking (`app_role = 'admin'`)
   - Returns 401 for missing/invalid token
   - Returns 403 for insufficient permissions
   - Reusable across all admin endpoints

## Why This Matters

### Business Value

- **Queue Management** - Admins see all pending bookings prioritized by urgency
- **Operational Efficiency** - High-urgency bookings surfaced immediately (e.g., check-in <24 hours)
- **Assignment Workflow** - Backend supports smooth unit assignment process
- **Payment Control** - Admins can verify/reject payments before unit assignment
- **Audit Trail** - All admin actions logged (who, what, when)
- **Security** - JWT authentication prevents unauthorized access
- **Scalability** - Rate limiting prevents API abuse while allowing normal operations

### Operational Value

- **Urgency-Based Prioritization** - Critical bookings (75+ score) escalated for immediate action
- **SLO Tracking** - Badge thresholds map to assignment service level objectives:
  - Critical (75+): 1 hour
  - High (50-74): 4 hours
  - Medium (25-49): 12 hours
  - Low (<25): 24 hours
- **Real-Time Availability** - Accurate unit availability checking prevents assignment conflicts
- **Error Prevention** - Server-side validation catches issues before transaction
- **Conflict Detection** - Database constraints prevent double-booking
- **Mobile Accessible** - API supports responsive admin interfaces on tablets/phones

### Technical Value

- **Server-Side Authority** - All business logic on backend (client is thin presentation layer)
- **Type Safety** - TypeScript + Zod validation for all request/response payloads
- **Performance** - Urgency scoring in TypeScript (faster than SQL for <100 bookings)
- **Idempotency** - Assignment and verification operations are idempotent
- **Transaction Safety** - Atomic operations via PostgreSQL functions
- **Observability** - Audit logs provide complete admin action history
- **Rate Limiting** - Cloudflare KV-based rate limiting (100 req/hour)
- **CORS Configured** - Proper headers for frontend integration

### Admin Workflow (End-to-End)

**Step 1: View Queue**
- Admin navigates to `/admin/pending-bookings`
- Frontend calls `GET /api/admin/pending-bookings`
- Backend calculates urgency scores
- Returns sorted queue (highest urgency first)
- UI displays color-coded badges (Critical/High/Medium/Low)

**Step 2: Review Booking**
- Admin clicks booking to view details
- Frontend displays unit requests, guest info, payment proof
- Admin reviews payment screenshot/PDF
- Admin decides: Verify or Reject

**Step 3: Verify Payment**
- Admin clicks "Verify Payment"
- Frontend calls `POST /api/admin/verify-payment`
- Backend updates `payment_status = 'Verified'`
- Audit log created
- Payment verification unlocks unit assignment

**Step 4: Check Availability**
- Admin clicks "Assign Units"
- Frontend calls `GET /api/admin/available-units?check_in=...&check_out=...`
- Backend queries units NOT in `booking_units` for date range
- Returns available units list
- UI displays unit selection interface

**Step 5: Assign Units**
- Admin selects specific units (e.g., Unit 101, 102, 103)
- Frontend calls `POST /api/admin/assign-units`
- Backend calls `assign_units_to_booking()` PostgreSQL function
- All-or-nothing transaction executes
- Booking status → 'Confirmed', assignment status → 'assigned'
- Audit log created
- Admin returns to queue (booking removed from pending list)

**Step 6: Guest Contact**
- Admin manually contacts guest via phone/SMS
- Confirms booking, provides check-in details
- Manual workflow (no email automation initially)

## Before You Start

### Prerequisites Checklist

Verify you have completed:

- [ ] **Chunk 001**: Database schema with `bookings`, `guest_booking_unit_requests`, `booking_units` tables
- [ ] **Chunk 003**: EXCLUDE constraint on `booking_units`, CHECK constraints (payment-before-assignment, all-or-nothing)
- [ ] **Chunk 011**: Pending bookings queue UI component (will consume this API)
- [ ] **Chunk 012**: Payment verification UI component (will consume this API)
- [ ] **Chunk 013**: Unit assignment UI component (will consume this API)
- [ ] PostgreSQL `btree_gist` extension enabled
- [ ] Supabase Auth configured with JWT
- [ ] `user_profiles` table with `app_role` column
- [ ] Cloudflare Workers environment configured
- [ ] You have read `docs/implementation/guest-booking-multi-unit/02-api-specification.md` (lines 1247-1764)
- [ ] You have read `docs/implementation/guest-booking-multi-unit/04-admin-interface.md` (lines 1-200)

### Knowledge Requirements

You should understand:

- Cloudflare Workers API patterns
- Supabase Auth JWT verification
- TypeScript + Zod validation
- PostgreSQL RPC calls via Supabase client
- Rate limiting with Cloudflare KV
- CORS configuration
- Audit logging patterns
- Urgency scoring algorithms
- Admin role-based access control (RBAC)

### Tools Required

- Code editor (VS Code recommended)
- PostgreSQL client (psql or Supabase SQL editor)
- API testing tool (curl, Postman, or Bruno)
- Browser DevTools for network inspection
- Supabase dashboard access
- Test admin JWT token
- Test bookings with various states (pending, verified, etc.)

### Time Commitment

- **Urgency scoring utility**: 15 minutes
- **Admin auth middleware**: 10 minutes
- **Pending bookings API**: 20 minutes
- **Available units API**: 15 minutes
- **Assign units API**: 15 minutes
- **Verify payment API**: 10 minutes
- **Verification + testing**: 15 minutes

**Total**: ~90 minutes for complete implementation and verification

## What Happens Next

### Immediate Outcomes

After completing this chunk:

✅ Admin can fetch pending bookings queue with urgency scores
✅ Bookings sorted by urgency (critical bookings appear first)
✅ Admin can check unit availability for specific date range
✅ Admin can assign units to bookings via API
✅ Admin can verify/reject payments via API
✅ All admin endpoints require JWT authentication
✅ Non-admin users blocked (403 Forbidden)
✅ Rate limiting prevents API abuse (100 req/hour)
✅ Audit logs capture all admin actions
✅ Error responses include detailed error codes
✅ CORS configured for frontend integration

### What You Can Do

- ✅ Fetch pending bookings queue: `GET /api/admin/pending-bookings`
- ✅ See urgency scores calculated correctly
- ✅ Check available units: `GET /api/admin/available-units?check_in=...&check_out=...`
- ✅ Assign units atomically: `POST /api/admin/assign-units`
- ✅ Verify payments: `POST /api/admin/verify-payment`
- ✅ Reject payments: `POST /api/admin/verify-payment` with `verified: false`
- ✅ View audit logs for admin actions
- ✅ Test with admin JWT token
- ✅ Test rate limiting (>100 requests/hour blocked)

### What You Cannot Do Yet

- ❌ Run comprehensive unit tests (Chunk 015 - Unit and Integration Tests)
- ❌ Run E2E tests for admin workflow (Chunk 016 - E2E and Performance Tests)
- ❌ Deploy to production (Chunk 017 - Deployment and Monitoring)
- ❌ Manage discount rules via API (Phase 3 feature, deferred)
- ❌ View assignment history analytics (Post-launch feature)

### Next Chunk

**Chunk 015: Unit and Integration Tests** - Creates comprehensive test suite for pricing calculations, discount rules, idempotency, constraints, and API endpoints. Ensures system reliability before deployment.

**Dependencies for Chunk 015**: Requires completed admin API (this chunk) to test end-to-end workflows.

## Key Files Created/Modified

```
functions/
└── api/
    └── admin/
        ├── _middleware.ts                          [NEW - ~120 lines]
        │   ├── JWT token extraction
        │   ├── Supabase Auth user verification
        │   ├── Admin role checking
        │   ├── 401/403 error responses
        │   └── Context enrichment (user_id, email)
        │
        ├── pending-bookings.ts                     [NEW - ~150 lines]
        │   ├── GET endpoint handler
        │   ├── Fetch pending multi-unit bookings
        │   ├── Calculate urgency scores (call utility)
        │   ├── Sort by urgency descending
        │   ├── Include unit requests + guest info
        │   ├── JWT authentication via middleware
        │   ├── Rate limiting (100 req/hour)
        │   └── CORS headers
        │
        ├── available-units.ts                      [NEW - ~130 lines]
        │   ├── GET endpoint handler
        │   ├── Parse check_in/check_out query params
        │   ├── Validate date range
        │   ├── Query units NOT in booking_units for dates
        │   ├── Filter by unit_status = 'Available'
        │   ├── Include capacity from pricing_config
        │   ├── JWT authentication via middleware
        │   ├── Rate limiting (100 req/hour)
        │   └── CORS headers
        │
        ├── assign-units.ts                         [NEW - ~200 lines]
        │   ├── POST endpoint handler
        │   ├── Parse { booking_id, unit_ids } body
        │   ├── Validate array length (all-or-nothing)
        │   ├── Call assign_units_to_booking() RPC
        │   ├── Map database errors to HTTP codes
        │   ├── Create audit log entry
        │   ├── JWT authentication via middleware
        │   ├── Rate limiting (100 req/hour)
        │   └── CORS headers
        │
        └── verify-payment.ts                       [NEW - ~150 lines]
            ├── POST endpoint handler
            ├── Parse { booking_id, verified, notes } body
            ├── Update payment_status to 'Verified' or 'Rejected'
            ├── Store admin notes (optional)
            ├── Create audit log entry
            ├── JWT authentication via middleware
            ├── Rate limiting (100 req/hour)
            └── CORS headers

src/
└── lib/
    ├── urgency-scoring.ts                          [NEW - ~150 lines]
    │   ├── calculateUrgencyScore() function
    │   ├── Hours to check-in scoring (max 50 points)
    │   ├── Days pending scoring (max 20 points)
    │   ├── Booking value scoring (max 15 points)
    │   ├── Unit count scoring (max 15 points)
    │   ├── getUrgencyBadge() helper
    │   ├── Badge thresholds mapping
    │   └── TypeScript types (Booking, UrgencyScore)
    │
    └── rate-limit.ts                               [MODIFIED - add admin endpoint config]
        └── Add 'admin-*' endpoint configurations (100 req/hour)
```

## Related Documentation

### Source Documentation

- **Primary**: `docs/implementation/guest-booking-multi-unit/02-api-specification.md` (lines 1247-1764)
  - Admin endpoints specification (pending-bookings, available-units, assign-units, verify-payment)
  - JWT authentication flow (lines 1337-1467)
  - Transaction handling (lines 1468-1509)
  - Error response format (lines 1130-1208)

- **Admin Interface**: `docs/implementation/guest-booking-multi-unit/04-admin-interface.md` (lines 1-200)
  - Urgency scoring system specification (lines 24-168)
  - Score calculation algorithm
  - Badge thresholds and SLO mapping
  - TypeScript implementation rationale

- **Security**: `docs/implementation/guest-booking-multi-unit/02-api-specification.md` (lines 889-1021)
  - Rate limiting configuration (lines 890-956)
  - Turnstile CAPTCHA (not needed for admin endpoints)
  - JWT authentication patterns

- **Chunking Strategy**: `docs/implementation/guest-booking-multi-unit/CHUNKING-STRATEGY.md` (lines 481-511)
  - Chunk 014 specification
  - Dependencies: 011, 012, 013 (admin UI components)
  - Admin API scope and purpose

- **Implementation Decisions**: `docs/implementation/guest-booking-multi-unit/09-implementation-decisions.md`
  - All-or-nothing assignment decision
  - Payment-before-assignment decision
  - Manual contact workflow decision

### Codebase Patterns

- **Cloudflare Workers**: `functions/api/guest-booking/guest-booking.ts`
  - Worker request handling pattern
  - CORS configuration
  - Error response format

- **Supabase RPC**: `src/lib/supabase.ts`
  - Calling PostgreSQL functions via `.rpc()`
  - Error handling for database operations

- **Audit Logging**: `src/lib/audit-logger.ts`
  - `logAuditEvent()` function usage
  - Audit event structure
  - Entity types and actions

- **Rate Limiting**: `src/lib/rate-limit.ts`
  - `checkKVRateLimit()` function
  - Cloudflare KV integration
  - Rate limit configuration

- **Authentication**: Existing admin endpoint patterns (if any from earlier chunks)
  - JWT token verification
  - Admin role checking
  - Error response format

## Success Criteria

This chunk is complete when:

- [ ] `src/lib/urgency-scoring.ts` created with `calculateUrgencyScore()` function
- [ ] `functions/api/admin/_middleware.ts` created with JWT authentication
- [ ] `functions/api/admin/pending-bookings.ts` created
- [ ] `functions/api/admin/available-units.ts` created
- [ ] `functions/api/admin/assign-units.ts` created
- [ ] `functions/api/admin/verify-payment.ts` created
- [ ] `npm run type-check` passes (no TypeScript errors)
- [ ] `npm run lint` passes (no ESLint warnings)
- [ ] Urgency scoring calculates correctly (tested with sample bookings)
- [ ] Pending bookings API returns sorted queue
- [ ] Available units API filters by date range correctly
- [ ] Assign units API calls PostgreSQL function
- [ ] Verify payment API updates payment_status
- [ ] All endpoints require valid admin JWT token
- [ ] Non-admin users receive 403 Forbidden
- [ ] Missing/invalid JWT receives 401 Unauthorized
- [ ] Rate limiting enforces 100 req/hour limit
- [ ] CORS headers present in all responses
- [ ] Audit logs created for assign/verify actions
- [ ] Error responses include proper error codes
- [ ] Database constraint errors mapped to HTTP errors
- [ ] All checkpoint tests pass (see `checkpoint.md`)

## Quick Start

Ready to begin? Follow these steps:

1. **Read this README completely** (you are here)
2. **Verify prerequisites** - Chunks 001-013 must be complete
3. **Open `instructions.md`** - Follow step-by-step implementation guide
4. **Create urgency scoring utility** - TypeScript application layer implementation
5. **Create admin auth middleware** - JWT verification and role checking
6. **Create pending bookings API** - Queue with urgency scores
7. **Create available units API** - Date range availability checker
8. **Create assign units API** - Calls PostgreSQL function
9. **Create verify payment API** - Payment status updater
10. **Test with curl** - Verify authentication, responses, rate limiting
11. **Run checkpoints** - Verify everything works (`checkpoint.md`)
12. **Troubleshoot if needed** - Common issues and solutions (`troubleshooting.md`)
13. **Commit changes** - `git commit -m "feat: complete chunk 014-admin-api-endpoints"`
14. **Move to Chunk 015** - Unit and Integration Tests

---

**Ready?** Open `instructions.md` to begin implementation.
