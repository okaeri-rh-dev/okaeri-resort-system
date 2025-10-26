# Chunk 011: Admin Queue with Urgency Scoring

## At a Glance

| Property | Value |
|----------|-------|
| **Chunk Number** | 011 |
| **Chunk Name** | admin-queue-urgency-scoring |
| **Phase** | Phase 3: Admin Interface |
| **Estimated Time** | 90 minutes |
| **Milestone** | Admin can view and prioritize pending multi-unit bookings |
| **Can Skip?** | ❌ No - Required for all admin workflow chunks (012-014) |
| **Prerequisites** | Chunks 001-010 completed (database, API, guest booking flow) |

## What You're Building

This chunk creates the **admin booking queue dashboard** - the central interface for managing pending multi-unit bookings with intelligent prioritization.

### New Components (2)

1. **`PendingBookingsQueue`** (`src/components/admin/PendingBookingsQueue.tsx`)
   - Responsive table displaying all pending multi-unit bookings
   - Real-time updates every 30 seconds via TanStack Query
   - Color-coded urgency badges (Critical/High/Medium/Low)
   - Filter controls (date range, urgency level, search)
   - Mobile-optimized responsive design
   - Click-through to assignment interface

2. **Urgency Scoring Utility** (`src/lib/urgency-scoring.ts`)
   - `calculateUrgencyScore()` function (0-100 scoring algorithm)
   - `getUrgencyBadge()` helper (badge variant selection)
   - TypeScript types for scoring parameters
   - SLO threshold definitions (Critical ≥75, High 50-74, Medium 25-49, Low <25)

### New API Endpoint (1)

3. **`GET /api/admin/pending-bookings`** (`functions/api/admin/pending-bookings.ts`)
   - Fetches multi-unit bookings with `unit_assignment_status = 'pending'`
   - Joins with `guest_booking_unit_requests` to count requested units
   - Applies urgency scoring to each booking
   - Returns sorted array (highest urgency first)
   - JWT authentication required
   - Admin role verification

### New Route (1)

4. **Admin Queue Route** (`src/routes/admin/queue.tsx`)
   - TanStack Router route definition at `/admin/queue`
   - Authentication guard (redirects if not admin)
   - Layout integration with existing admin UI
   - Meta tags for SEO

### Updated Navigation (1)

5. **Admin Sidebar/Header** - Add "Booking Queue" navigation link

## Why This Matters

### Business Value

- **Prevents lost bookings** - High-urgency bookings flagged immediately (check-in <24h = Critical)
- **Improves guest satisfaction** - SLO tracking ensures timely responses (Critical = 1 hour, High = 4 hours)
- **Increases revenue** - Large bookings (>₱50,000) prioritized automatically
- **Reduces admin cognitive load** - System calculates priority, admin focuses on assignment

### Operational Value

- **Clear prioritization** - 0-100 urgency score removes guesswork
- **Real-time visibility** - Queue updates every 30s, no manual refresh needed
- **Mobile accessibility** - Admin can check queue on phone
- **Audit trail foundation** - Queue timestamps enable SLO reporting later

### Technical Value

- **TypeScript implementation** - Fast iteration on scoring algorithm based on feedback
- **Performance optimized** - Assumes <50 bookings/day, no pagination needed initially
- **Migration path** - If API >100ms, scoring moves to PostgreSQL function (architectural decision documented)
- **Extensible filters** - Easy to add new filter dimensions (payment status, unit count, etc.)

### Urgency Scoring Algorithm

**4 factors contribute to urgency score (max 100 points):**

1. **Hours to check-in** (max 50 points)
   - Already past check-in: **100 points** (override max - critical!)
   - <24 hours: 50 points
   - 24-48 hours: 35 points
   - 48-72 hours: 20 points
   - >72 hours: 10 points

2. **Days pending** (max 20 points)
   - >3 days: 20 points
   - 2-3 days: 15 points
   - 1-2 days: 10 points
   - <1 day: 5 points

3. **Booking value** (max 15 points)
   - >₱50,000: 15 points
   - ₱30,000-50,000: 10 points
   - ₱15,000-30,000: 5 points
   - <₱15,000: 2 points

4. **Unit count** (max 15 points)
   - >5 units: 15 points
   - 3-5 units: 10 points
   - 2 units: 5 points
   - 1 unit: 2 points

**SLO Thresholds:**

| Badge | Score | Assignment Target | Color |
|-------|-------|------------------|-------|
| 🔴 Critical | ≥75 | Within 1 hour | Red |
| 🟠 High | 50-74 | Within 4 hours | Orange |
| 🟡 Medium | 25-49 | Within 12 hours | Yellow |
| ⚪ Low | <25 | Within 24 hours | Gray |

## Before You Start

### Prerequisites Checklist

Verify you have completed:

- [ ] **Chunk 001**: Database schema with `bookings`, `guest_booking_unit_requests` tables
- [ ] **Chunk 002**: PostgreSQL pricing engine (for `total_amount` calculation)
- [ ] **Chunk 003**: RLS policies (admin JWT authentication)
- [ ] **Chunk 004**: Core API endpoints (booking creation working)
- [ ] **Chunk 006-010**: Guest booking flow (test bookings exist or can be created)
- [ ] Admin authentication working (JWT tokens, role claims)
- [ ] Supabase service_role key configured in `.env.local`
- [ ] You have read `docs/implementation/guest-booking-multi-unit/04-admin-interface.md` lines 1-200

### Knowledge Requirements

You should understand:

- React 19 with TypeScript
- TanStack Query v5 (useQuery, refetchInterval)
- TanStack Router (route definitions, authentication guards)
- shadcn/ui components (Table, Badge, Card)
- Cloudflare Workers (API endpoint patterns)
- JWT authentication flow

### Tools Required

- Code editor (VS Code recommended)
- Browser with React DevTools
- Supabase dashboard access (to seed test bookings if needed)

### Time Commitment

- **Urgency scoring utility**: 15 minutes (copy-paste with types)
- **Queue component**: 30 minutes (React component with TanStack Query)
- **API endpoint**: 20 minutes (Cloudflare Worker with Supabase queries)
- **Routes and navigation**: 10 minutes (TanStack Router setup)
- **Verification**: 15 minutes (run all checkpoints, test filters)

**Total**: ~90 minutes for complete implementation and verification

## What Happens Next

### Immediate Outcomes

After completing this chunk:

✅ Admin can view all pending multi-unit bookings
✅ Bookings sorted by urgency (highest priority first)
✅ Visual urgency badges (color-coded for quick scanning)
✅ Queue auto-refreshes every 30 seconds
✅ Can filter by date range, urgency level, search
✅ Mobile responsive (works on phone/tablet)
✅ Authentication enforced (admin role required)

### What You Can Do

- ✅ View pending bookings queue at `/admin/queue`
- ✅ See urgency scores calculated correctly
- ✅ Filter bookings by urgency level
- ✅ Search by booking reference or guest name
- ✅ Click "Assign Units" to navigate to assignment (placeholder until chunk 013)
- ✅ Monitor queue on mobile device

### What You Cannot Do Yet

- ❌ Verify payment proofs (Chunk 012 - Payment Verification UI)
- ❌ Assign specific units (Chunk 013 - Unit Assignment System)
- ❌ View assignment history (Chunk 014 - Admin API endpoints)
- ❌ Send confirmation emails (Manual contact workflow, email deferred post-launch)

### Next Chunk

**Chunk 012: Payment Verification UI** - Implements payment proof viewer with signed URLs, zoom controls, PDF viewer, and verify/reject actions. Requires this chunk to select bookings from queue.

**Dependencies for Chunk 012**: Requires `PendingBookingsQueue` to navigate to payment verification screen.

## Key Files Created/Modified

```
src/
├── components/
│   └── admin/
│       └── PendingBookingsQueue.tsx         [NEW - ~200 lines]
│           ├── TanStack Query integration
│           ├── Responsive table component
│           ├── Urgency badge rendering
│           ├── Filter controls (date, urgency, search)
│           └── Mobile-responsive design
│
├── lib/
│   └── urgency-scoring.ts                   [NEW - ~120 lines]
│       ├── calculateUrgencyScore() function
│       ├── getUrgencyBadge() helper
│       ├── UrgencyLevel type
│       ├── UrgencyScoreParams interface
│       └── SLO threshold constants
│
├── routes/
│   └── admin/
│       └── queue.tsx                        [NEW - ~60 lines]
│           ├── TanStack Router route
│           ├── Authentication guard
│           └── Layout integration
│
└── components/
    └── navigation/
        └── AdminSidebar.tsx                 [MODIFIED - add queue link]

functions/
└── api/
    └── admin/
        └── pending-bookings.ts              [NEW - ~150 lines]
            ├── GET endpoint handler
            ├── Supabase query with joins
            ├── Urgency scoring application
            ├── JWT authentication middleware
            └── Admin role verification
```

## Related Documentation

### Source Documentation

- **Primary**: `docs/implementation/guest-booking-multi-unit/04-admin-interface.md` (lines 1-200)
  - Urgency scoring system specification
  - Badge thresholds and SLO targets
  - TypeScript implementation approach
  - Migration trigger criteria (>100ms API response)

- **Secondary**: `docs/implementation/guest-booking-multi-unit/02-api-specification.md` (admin section)
  - API endpoint contracts
  - Request/response schemas
  - Authentication requirements
  - Error handling patterns

- **Architecture**: `docs/implementation/guest-booking-multi-unit/CHUNKING-STRATEGY.md` (lines 376-409)
  - Chunk 011 specification
  - Dependencies graph
  - Architectural principles (TypeScript vs PostgreSQL decision)

- **Implementation Decisions**: `docs/implementation/guest-booking-multi-unit/09-implementation-decisions.md`
  - Manual contact workflow (no email notifications)
  - Security-first approach (JWT, RLS)
  - Real-time update patterns

### Codebase Patterns

- **State Management**: `CLAUDE.md` (State Management Architecture section)
  - TanStack Query patterns
  - Real-time subscriptions
  - Optimistic updates

- **Component Structure**: `src/components/bookings/BookingsTable/`
  - Existing table component patterns
  - Filter implementation
  - Responsive design

- **Authentication**: `src/lib/auth.ts`
  - JWT token verification
  - Admin role checking
  - Authentication guards

- **API Patterns**: `functions/api/guest-booking/`
  - Cloudflare Workers structure
  - Supabase client usage
  - Error response formatting

## Success Criteria

This chunk is complete when:

- [ ] `src/lib/urgency-scoring.ts` created with all functions and types
- [ ] `src/components/admin/PendingBookingsQueue.tsx` created with table and filters
- [ ] `functions/api/admin/pending-bookings.ts` created with authentication
- [ ] `src/routes/admin/queue.tsx` created with route definition
- [ ] Admin navigation includes "Booking Queue" link
- [ ] `npm run type-check` passes (no TypeScript errors)
- [ ] `npm run lint` passes (no ESLint warnings)
- [ ] Unit tests for urgency scoring pass (`npm test`)
- [ ] API endpoint returns correct JSON structure
- [ ] Queue displays bookings sorted by urgency (highest first)
- [ ] Urgency badges color-coded correctly (red/orange/yellow/gray)
- [ ] Filters work (date range, urgency level, search)
- [ ] Queue auto-refreshes every 30 seconds
- [ ] Mobile responsive (tested at 375px viewport width)
- [ ] Admin authentication enforced (non-admin blocked)
- [ ] All checkpoint tests pass (see `checkpoint.md`)

## Quick Start

Ready to begin? Follow these steps:

1. **Read this README completely** (you are here)
2. **Open `instructions.md`** - Follow step-by-step implementation guide
3. **Create files** - Urgency scoring, queue component, API endpoint, routes
4. **Test manually** - View queue, test filters, verify scoring
5. **Run checkpoints** - Verify everything works (`checkpoint.md`)
6. **Troubleshoot if needed** - Common issues and solutions (`troubleshooting.md`)
7. **Commit changes** - `git commit -m "feat: complete chunk 011-admin-queue-urgency-scoring"`
8. **Move to Chunk 012** - Payment Verification UI (requires this chunk)

---

**Ready?** Open `instructions.md` to begin implementation.
