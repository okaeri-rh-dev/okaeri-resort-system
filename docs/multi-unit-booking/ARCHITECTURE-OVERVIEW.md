# Multi-Unit Booking: Architecture Overview

**Document Version:** 1.0
**Created:** October 7, 2025
**Status:** Planning Phase

---

## Executive Summary

This document provides a high-level architectural overview of the multi-unit booking system, showing how all components interact across the database, backend, state management, and UI layers.

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │ MultiUnitSelector│  │   UnitCardList   │  │ PricingSummary│ │
│  │   Component      │  │    Component     │  │   Component   │ │
│  └────────┬─────────┘  └────────┬─────────┘  └───────┬───────┘ │
│           │                     │                     │          │
│           └─────────────────────┴─────────────────────┘          │
│                                 ↓                                │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │          Multi-Unit Booking Form (Multi-Step)               │ │
│  │  Step 1: Dates → Step 2: Units → Step 3: Guests → Step 4   │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────┐
│                      STATE MANAGEMENT LAYER                      │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐   │
│  │        useMultiUnitBookingStore (Zustand + Immer)        │   │
│  │  • selectedUnits[]         • optimisticQueue            │   │
│  │  • draftBooking            • offlineQueue               │   │
│  │  • unitPricingCache        • conflictResolution         │   │
│  └──────────────────┬───────────────────────────────────────┘   │
│                     │                                            │
│  ┌──────────────────┴───────────────────────────────────────┐   │
│  │        TanStack Query Hooks (Data Fetching/Caching)      │   │
│  │  • useMultiUnitBookings    • useCreateMultiUnitBooking  │   │
│  │  • useMultiUnitAvailability • useAddUnitToBooking       │   │
│  │  • useRemoveUnitFromBooking                             │   │
│  └──────────────────┬───────────────────────────────────────┘   │
└─────────────────────┼───────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────────┐
│                      API LAYER (Cloudflare Workers)              │
├─────────────────────────────────────────────────────────────────┤
│  POST   /api/bookings/multi-unit          ← Create booking      │
│  POST   /api/bookings/:id/units           ← Add unit            │
│  DELETE /api/bookings/:id/units/:unit_id  ← Remove unit         │
│  GET    /api/availability/multi-unit      ← Check availability  │
│  GET    /api/bookings/:id                 ← Get booking+units   │
│                                                                  │
│  Authentication: JWT via Supabase Auth                          │
│  Validation: Zod schemas                                        │
│  Sanitization: DOMPurify for XSS prevention                     │
│  Rate Limiting: Cloudflare rate limits                          │
└─────────────────────┬───────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────────┐
│                   DATABASE LAYER (PostgreSQL/Neon)               │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────┐        ┌──────────────────┐                  │
│  │   bookings    │◄───┐   │  booking_units   │                  │
│  │               │    │   │  (Junction Table)│                  │
│  │ •unit_id      │    └───┤ •booking_id      │                  │
│  │ •is_multi_unit│        │ •unit_id         │                  │
│  │ •unit_count   │        │ •unit_price      │                  │
│  │ •total_amount │        │ •subtotal        │                  │
│  └───────────────┘        └────────┬─────────┘                  │
│                                    │                             │
│  ┌──────────────────────────┐     │    ┌──────────────────────┐ │
│  │ booking_unit_availability│     │    │       units          │ │
│  │ (Denormalized for perf)  │     └───►│ •unit_id             │ │
│  │ •unit_id                 │          │ •unit_name           │ │
│  │ •booking_id              │          │ •base_rate           │ │
│  │ •check_in                │          │ •max_occupancy       │ │
│  │ •check_out               │          └──────────────────────┘ │
│  │ •EXCLUDE constraint      │                                   │
│  └──────────────────────────┘                                   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  Database Functions                       │   │
│  │  • create_multi_unit_booking(booking_data, units[])      │   │
│  │  • check_multi_unit_availability(unit_ids[], dates)      │   │
│  │  • get_booking_units(booking_id)                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Triggers                              │   │
│  │  • update_booking_totals()  → Auto-calc totals           │   │
│  │  • sync_booking_dates()     → Sync availability table    │   │
│  │  • cascade_booking_status() → Update related records     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  RLS Policies: Row-level security for multi-tenancy             │
│  Indexes: Optimized for Neon serverless (btree_gist)            │
└──────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### 1. Create Multi-Unit Booking Flow

```
User Interface
    │
    │ 1. Select dates & 2+ units
    ↓
React Hook Form
    │
    │ 2. Validate with Zod schema
    ↓
useMultiUnitBookingStore
    │
    │ 3. Optimistic update (add to store)
    ├──────────────────────┐
    │                      │ (Rollback on error)
    ↓                      ↓
useCreateMultiUnitBooking (TanStack Query)
    │
    │ 4. POST /api/bookings/multi-unit
    ↓
Cloudflare Worker
    │
    │ 5. Validate & sanitize inputs
    │ 6. Check availability for all units
    ↓
Supabase (PostgreSQL)
    │
    │ 7. BEGIN TRANSACTION
    │ 8. INSERT INTO bookings
    │ 9. INSERT INTO booking_units (multiple)
    │10. INSERT INTO booking_unit_availability
    │11. COMMIT TRANSACTION
    ↓
Response to Client
    │
    │12. Update cache (TanStack Query)
    │13. Resolve optimistic update
    │14. Show success message
    ↓
User sees confirmation
```

### 2. Check Multi-Unit Availability Flow

```
User enters dates
    ↓
useMultiUnitAvailability hook
    ↓
GET /api/availability/multi-unit?unit_ids=...&check_in=...&check_out=...
    ↓
Database function: check_multi_unit_availability()
    ↓
Query booking_unit_availability with EXCLUSION constraint
    ↓
Return availability status for each unit
    ↓
UI shows green checkmarks (available) or red X (unavailable)
```

### 3. Add Unit to Existing Booking Flow

```
User clicks "Add Another Unit"
    ↓
Select unit from available units
    ↓
useAddUnitToBooking mutation
    │
    │ Optimistic: Add unit to local state
    ↓
POST /api/bookings/:booking_id/units
    ↓
1. Validate unit availability
2. Calculate pricing for new unit
3. INSERT INTO booking_units
4. Trigger auto-updates booking.total_amount
5. INSERT INTO booking_unit_availability
    ↓
Response with updated booking
    ↓
Cache invalidation → Re-fetch booking details
    ↓
UI shows new unit in list with updated total
```

---

## Key Design Patterns

### 1. Junction Table Pattern

**Problem:** One booking needs to link to multiple units (many-to-many relationship)

**Solution:** `booking_units` junction table

```sql
-- Enables 1:N relationship
bookings (1) ←→ (N) booking_units (N) ←→ (1) units

-- Each booking can have multiple booking_units
-- Each unit can be in multiple bookings (different dates)
```

**Benefits:**

- Maintains referential integrity
- Allows per-unit pricing and metadata
- Enables efficient queries

### 2. Denormalization for Performance

**Problem:** Checking availability for multiple units requires complex JOIN queries

**Solution:** `booking_unit_availability` denormalized table with EXCLUDE constraint

```sql
-- Fast availability lookups without JOINs (Aggressive Blocking Strategy)
SELECT * FROM booking_unit_availability
WHERE unit_id = $1
  AND tstzrange(check_in, check_out) && tstzrange($2, $3)
  AND booking_status IN ('Confirmed', 'CheckedIn');

-- Exclusion constraint prevents double-booking at database level
-- Only Confirmed and CheckedIn bookings block availability
EXCLUDE USING gist (
  unit_id WITH =,
  tstzrange(check_in, check_out, '[)') WITH &&
) WHERE (booking_status IN ('Confirmed', 'CheckedIn'))
```

**Trade-off:** Data duplication vs. query performance (worth it for availability checks)

### 3. Optimistic UI Updates

**Problem:** Network latency makes multi-unit booking feel slow

**Solution:** React 19 `useOptimistic` + Zustand store

```typescript
// Immediate UI feedback
const [optimisticBooking, setOptimisticBooking] = useOptimistic(booking, (current, action) => {
  switch (action.type) {
    case "ADD_UNIT":
      return {
        ...current,
        booking_units: [...current.booking_units, action.unit],
        total_amount: current.total_amount + action.unit.subtotal,
      };
    case "REMOVE_UNIT":
    // ... optimistic removal
  }
});

// Server update in background
await mutation.mutateAsync(data);
```

**Benefits:**

- Feels instant to users
- Handles offline scenarios
- Automatic rollback on errors

### 4. Direct Deployment Pattern (Greenfield)

**Problem:** Need to deploy safely without disrupting non-existent users

**Solution:** Clean deployment with backup/restore safety net

```typescript
// Deployment Strategy: Wipe → Migrate → Deploy
// 1. Wipe test data from database
// 2. Run migration script (018-multi-unit-schema.sql)
// 3. Deploy API + Frontend simultaneously
// 4. Run smoke tests
// 5. Monitor for 48 hours

// Rollback: Restore from backup
async function rollback() {
  // 1. Restore database from pre-migration backup
  await restoreDatabaseBackup("pre-multi-unit-migration");

  // 2. Revert Cloudflare Workers to previous version
  await revertCloudflareDeployment();

  // Estimated total time: <15 minutes
}
```

**Benefits:**

- Simplest possible deployment
- No feature flag infrastructure overhead
- Fast rollback via database restore
- No dual-mode code complexity

---

## Security Architecture

### 1. Defense in Depth

```
Layer 1: Client-Side Validation
  • Zod schema validation
  • React Hook Form validation
  • Input sanitization

Layer 2: API Gateway (Cloudflare Workers)
  • JWT authentication
  • Rate limiting
  • CORS policies
  • Request validation

Layer 3: Database (PostgreSQL RLS)
  • Row Level Security policies
  • User/role-based access control
  • Audit logging

Layer 4: Infrastructure (Neon/Cloudflare)
  • DDoS protection
  • SSL/TLS encryption
  • IP whitelisting (optional)
```

### 2. Input Sanitization Pipeline

```typescript
// 1. Client-side: Zod validation
const schema = z.object({
  guest_name: z.string().min(2).max(100),
  email: z.string().email(),
  // ...
});

// 2. Server-side: Re-validate + Sanitize
const sanitized = {
  guest_name: sanitizeInput(data.guest_name), // Remove HTML/scripts
  email: sanitizeInput(data.email),
  special_requests: sanitizeHTML(data.special_requests, {
    ALLOWED_TAGS: ["b", "i", "em", "strong"], // Limited HTML
  }),
};

// 3. Database: Parameterized queries (Supabase client)
await supabase.from("bookings").insert(sanitized); // No SQL injection possible
```

### 3. RLS Policy Example

```sql
-- Users can only see their own bookings
CREATE POLICY "booking_units_select_own"
  ON booking_units FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.booking_id = booking_units.booking_id
        AND (
          b.guest_id IN (SELECT guest_id FROM guests WHERE user_id = auth.uid())
          OR b.booking_reference = current_setting('app.booking_reference', true)
        )
    )
  );

-- Staff can see all bookings
CREATE POLICY "booking_units_select_staff"
  ON booking_units FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'owner', 'manager', 'staff')
        AND is_active = TRUE
    )
  );
```

---

## Performance Optimization Strategies

### 1. Database Level

**Indexes:**

```sql
-- Composite index for common join query
CREATE INDEX idx_booking_units_composite
  ON booking_units(booking_id, unit_id);

-- Covering index for availability checks (matches exclusion constraint)
CREATE INDEX idx_availability_lookup
  ON booking_unit_availability(unit_id, check_in, check_out)
  WHERE booking_status IN ('Confirmed', 'CheckedIn');

-- GIN index for full-text search
CREATE INDEX idx_booking_units_guest_names
  ON booking_units USING gin(guest_names);
```

**Prepared Statements:**

```sql
PREPARE check_availability AS
  SELECT * FROM booking_unit_availability
  WHERE unit_id = $1
    AND tstzrange(check_in, check_out) && tstzrange($2, $3);

EXECUTE check_availability('unit-id', '2025-12-20', '2025-12-22');
```

**Connection Pooling:**

- Neon serverless: Auto-scaling connection pooling
- Supabase client: Built-in pooling
- Worker: Reuse connections across requests

### 2. API Level

**Batch Operations:**

```typescript
// Instead of N requests for N units
for (const unitId of unitIds) {
  await checkAvailability(unitId); // ❌ N queries
}

// Single request for all units
await checkMultiUnitAvailability(unitIds); // ✅ 1 query
```

**Response Caching:**

```typescript
// Cache availability results (5 minutes)
const { data } = await useQuery({
  queryKey: ["availability", unitIds, dates],
  queryFn: () => fetchAvailability(unitIds, dates),
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

### 3. Frontend Level

**Code Splitting:**

```typescript
// Lazy load multi-unit components
const MultiUnitSelector = lazy(() => import('./MultiUnitSelector'));

// Only load when needed
{isMultiUnitMode && <Suspense><MultiUnitSelector /></Suspense>}
```

**Virtualized Lists:**

```typescript
// For rendering many units efficiently
import { useVirtualizer } from "@tanstack/react-virtual";

const rowVirtualizer = useVirtualizer({
  count: units.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 100, // Estimated row height
});
```

**Optimistic Updates:**

- Immediate UI feedback (no waiting for server)
- Background synchronization
- Automatic rollback on errors

---

## Testing Strategy Summary

### Test Pyramid

```
                    /\
                   /  \
                  / E2E \ ────── 10% of tests
                 /------\
                /  Inte- \
               / gration  \ ──── 30% of tests
              /------------\
             /              \
            /   Unit Tests   \ ── 60% of tests
           /------------------\
```

**Coverage Requirements:**

- Unit Tests: ≥95% coverage (functions, components)
- Integration Tests: ≥90% coverage (API, database)
- E2E Tests: 100% of critical user paths

### Testing Tools

| Layer         | Tool                  | Purpose                                  |
| ------------- | --------------------- | ---------------------------------------- |
| Unit          | Vitest                | Fast unit tests for functions/components |
| Component     | React Testing Library | Component behavior testing               |
| Integration   | Supertest / Vitest    | API endpoint testing                     |
| E2E           | Playwright            | Full user flow testing                   |
| Performance   | Artillery             | Load testing                             |
| Security      | OWASP ZAP             | Vulnerability scanning                   |
| Visual        | Percy / Chromatic     | Visual regression testing                |
| Accessibility | axe DevTools          | WCAG compliance testing                  |

---

## Deployment Architecture

### Infrastructure

```
┌────────────────────────────────────────────────────────┐
│                  Cloudflare (Edge Network)              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │    CDN       │  │   Workers    │  │  Rate Limit  │  │
│  │  (Static)    │  │  (Serverless)│  │   (DDoS)     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└────────────────────────┬───────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ↓                               ↓
┌────────────────┐            ┌─────────────────────┐
│ Vercel (Pages) │            │ Neon (PostgreSQL)   │
│                │            │                     │
│  • React App   │            │  • Database         │
│  • Static      │            │  • Auto-scaling     │
│  • SSR (opt)   │            │  • Branching        │
└────────────────┘            └─────────────────────┘
         │
         ↓
┌────────────────────────┐
│ Supabase (BaaS)        │
│  • Auth                │
│  • Storage (R2)        │
│  • Realtime            │
└────────────────────────┘
```

### Environment Strategy

| Environment     | Purpose                | Database                        | Sync Strategy       |
| --------------- | ---------------------- | ------------------------------- | ------------------- |
| **Development** | Local dev              | Local PostgreSQL or Neon branch | Manual              |
| **Staging**     | Pre-production testing | Neon branch (production clone)  | Auto-sync from main |
| **Production**  | Live system            | Neon main database              | Protected           |

### CI/CD Pipeline

```
GitHub Push
    ↓
GitHub Actions
    │
    ├─→ Run Linters (ESLint, Prettier)
    ├─→ Run Type Check (TypeScript)
    ├─→ Run Unit Tests (Vitest)
    ├─→ Run Integration Tests
    ├─→ Run E2E Tests (Playwright)
    ├─→ Run Security Scan (npm audit)
    ├─→ Build Application
    ├─→ Deploy to Staging (Vercel Preview)
    │
    └─→ [Manual Approval]
          ↓
        Deploy to Production (Vercel)
          ↓
        Run Smoke Tests
          ↓
        Monitor Metrics (5 min)
          ↓
        Success / Rollback
```

---

## Scalability Considerations

### Current Capacity

- **Database:** Neon serverless auto-scales
- **API:** Cloudflare Workers auto-scales (no cold starts)
- **Frontend:** Cloudflare CDN (global distribution)

### Growth Projections

| Metric           | Current | 6 Months | 12 Months | Action Required         |
| ---------------- | ------- | -------- | --------- | ----------------------- |
| Bookings/day     | 10      | 50       | 200       | Monitor Neon usage      |
| Multi-unit %     | 0%      | 20%      | 40%       | Consider bulk discounts |
| Concurrent users | 5       | 25       | 100       | No action needed        |
| Database size    | 100MB   | 500MB    | 2GB       | Archiving strategy      |

### Scaling Strategies

1. **Database:**
   - Neon auto-scales connections
   - Add read replicas if needed
   - Archive old bookings (>2 years)

2. **API:**
   - Cloudflare Workers scale automatically
   - Add caching layer (Cloudflare KV) if needed

3. **Frontend:**
   - Code splitting to reduce bundle size
   - Image optimization (WebP, lazy loading)
   - Service worker for offline support

---

## Monitoring & Observability

### Key Metrics

```typescript
// Application Performance
- API response time (p50, p95, p99)
- Database query time
- Page load time (FCP, LCP, TTI)
- JavaScript bundle size

// Business Metrics
- Multi-unit bookings created
- Average units per booking
- Booking completion rate
- Revenue from multi-unit bookings

// Error Metrics
- API error rate
- Database errors
- Client-side errors (Sentry)
- Payment failures
```

### Alert Channels

```
🔴 Critical Alerts
  → PagerDuty (SMS/Phone)
  → Slack #critical-alerts
  → Email to on-call engineer

🟡 Warning Alerts
  → Slack #warnings
  → Email to team

🟢 Info
  → Slack #deployments
  → Dashboard only
```

---

## Disaster Recovery Plan

### Backup Strategy

**Database:**

- Neon automatic backups: Continuous
- Point-in-time recovery: Last 7 days
- Manual backups before major changes

**Recovery Time Objectives (RTO):**

- Critical (booking creation): <5 minutes
- High (availability checks): <15 minutes
- Medium (reports): <1 hour

**Recovery Point Objectives (RPO):**

- Zero data loss for committed transactions
- Maximum 5 minutes for in-flight transactions

### Incident Response

```
1. Detect (Monitoring alert)
    ↓
2. Assess (Check dashboard, logs)
    ↓
3. Communicate (Post in #incidents)
    ↓
4. Mitigate (Immediate rollback via database restore)
    ↓
5. Resolve (Fix issue, deploy)
    ↓
6. Post-Mortem (Document learnings)
```

---

## Conclusion

This architecture provides:

✅ **Scalability**: Auto-scaling at database, API, and CDN layers
✅ **Performance**: <200ms API, <100ms DB queries, optimistic updates
✅ **Security**: Defense in depth, RLS, input validation
✅ **Reliability**: Redundancy, monitoring, rollback procedures
✅ **Maintainability**: Clear separation of concerns, documentation
✅ **Simplicity**: Greenfield deployment with no legacy complexity

---

**For detailed implementation:**

- Phase 1: Database → `01-database-foundation.md`
- Phase 2: Backend API → `02-backend-api.md`
- Phase 3-6: Implementation → `03-06-IMPLEMENTATION-PHASES.md`
- Agent Assignments → `AGENT-ASSIGNMENTS.md`
- Master Plan → `00-MASTER-PLAN.md`
