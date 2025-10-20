# Master Plan: Public Availability Calendar

> **Comprehensive strategy and implementation overview for view-only public availability calendar**

## Executive Summary

### Vision

Create a public-facing availability calendar that allows potential guests to instantly check unit availability at Okaeri Resort without authentication, reducing inquiry overhead and improving booking conversion rates.

### Scope

- **Feature Type**: View-only public calendar (no booking forms or submissions)
- **Target Audience**: Anonymous website visitors, potential guests
- **Business Model**: Drive inquiries to WhatsApp/Phone (existing booking flow)
- **Timeline**: 7-9 days implementation (1-2 developer weeks)
- **Team**: 1 full-stack developer
- **Budget**: Minimal (leverages existing infrastructure)

### Success Criteria

1. **30% reduction** in "Is it available?" WhatsApp messages within 3 months
2. **20% increase** in qualified booking inquiries within 3 months
3. **>90 Lighthouse Performance** score on desktop and mobile
4. **<2 second page load** time on 4G mobile networks
5. **>80% CDN cache hit** ratio after first week

---

## Business Context

### Current State

**Resort Configuration**:

- **Total Units**: 3 identical beachfront units
- **Unit Assignment**: Manager manually assigns bookings to specific units
- **Booking Flow**: WhatsApp/Phone → Manager creates booking in system → Unit assigned
- **Pain Point**: Guests frequently ask "Is it available?" before contacting

**Technical Infrastructure**:

- **Database**: Supabase PostgreSQL (Neon serverless)
- **Backend**: Cloudflare Workers (serverless functions)
- **Frontend**: React 19 + TanStack Router + TanStack Query
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Deployment**: Cloudflare Pages (frontend + workers)

### Problem Statement

**Guest Experience Issues**:

1. **Friction**: Guests must WhatsApp/call just to check if dates are available
2. **Timezone barriers**: Philippine timezone (UTC+8) limits real-time responses
3. **Trust gap**: No visible availability calendar reduces booking confidence
4. **SEO gap**: No indexed availability page for "Okaeri Resort availability" searches

**Business Impact**:

- **High inquiry volume**: 50-70% of WhatsApp messages are availability checks
- **Low conversion**: Some guests abandon after not getting instant response
- **Opportunity cost**: Staff time spent answering repetitive availability questions

### Solution Overview

> **📌 CRITICAL CONTEXT: Manager-Mediated Booking Flow**
>
> This calendar is **view-only**. The booking process is controlled by the manager:
>
> 1. **Guest views calendar** → Checks available dates (no booking action)
> 2. **Guest contacts manager** → Via WhatsApp or phone
> 3. **Manager communicates with guest** → Discusses dates, requirements, pricing
> 4. **Manager sends booking link** → After confirming details
> 5. **Manager approves booking** → Manually creates reservation in system
>
> **Why this eliminates race conditions:**
>
> - ✅ Manager controls all booking approvals
> - ✅ No automated bookings from calendar
> - ✅ Guest receives link only after manager communication
> - ✅ Personal service builds trust and relationships

**What We're Building**:
A **view-only public calendar** showing aggregated availability counts for all 3 units, with color-coded visual indicators (green/yellow/orange/red). Guests can quickly check which dates have availability without contacting the resort.

**What We're NOT Building**:

- ❌ Booking forms or submission flows
- ❌ Guest account creation
- ❌ Payment processing
- ❌ Unit-specific availability (just aggregate counts)
- ❌ Real-time notifications or alerts
- ❌ **Pricing display** (discussed directly with manager)
- ❌ **CTA buttons or contact prompts** (link shared privately to interested guests only)

**User Flow**:

```
Guest lands on /calendar page
↓
Views calendar with color-coded availability
↓
Checks desired dates (visual feedback only)
↓
Returns to main site or contacts resort directly
```

---

## Technical Architecture

### System Components

```
┌───────────────────────────────────────────────────────────┐
│                     PUBLIC INTERNET                        │
└───────────────────────┬───────────────────────────────────┘
                        │
                        │ HTTPS Request
                        │ GET /calendar
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                   CLOUDFLARE CDN                             │
│  • Edge caching (5 minutes)                                  │
│  • DDoS protection                                           │
│  • Rate limiting (30-60 req/min per IP)                      │
│  • Gzip compression                                          │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ Cache miss
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              REACT APP (Cloudflare Pages)                    │
│  Route: /calendar (VIEW-ONLY, NO PRICING, NO CTAs)          │
│  Note: Standalone public route (no auth redirect)           │
│  Components:                                                 │
│    - PublicAvailabilityCalendar                             │
│    - CalendarGrid (color-coded days)                        │
│    - AvailabilityLegend                                     │
│    - MonthNavigation                                        │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ Fetch availability data
                        │ GET /api/public/v1/availability?start=...&end=...
                        ▼
┌─────────────────────────────────────────────────────────────┐
│           CLOUDFLARE WORKER API ENDPOINT                     │
│  /functions/api/public/v1/availability.ts                   │
│  • Parse query params (start/end dates)                      │
│  • Call Supabase RPC function                               │
│  • Transform response to API format                          │
│  • Add cache headers                                         │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ RPC: get_public_aggregate_availability()
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              SUPABASE POSTGRESQL (Neon)                      │
│  Function: get_public_aggregate_availability(dates)         │
│  • SECURITY DEFINER (bypasses RLS safely)                   │
│  • Generates date series                                     │
│  • Counts occupied units + blackout units per day           │
│  • Uses Option C hybrid model (static unit_status +         │
│    date-specific blackouts)                                  │
│  • Returns: { date, available_count }[]                     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ Queries
                        ▼
┌─────────────────────────────────────────────────────────────┐
│             BOOKINGS + BLACKOUTS TABLES                      │
│  • Filters: booking_status IN ('Confirmed', 'CheckedIn')    │
│  • Filters: unit_status = 'Available' (static per unit)     │
│  • Date overlap check: date >= check_in AND date < check_out│
│  • Blackout check: date in [start_date, end_date)           │
│  • Aggregates: COUNT(DISTINCT unit_id) per date             │
│  • Formula: total_units - (occupied + blackouts)            │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

**Request Flow** (cold start):

1. Guest requests `/calendar` → Cloudflare CDN (miss)
2. CDN forwards to React app (SSR/static)
3. React app renders shell, fetches data from API
4. API calls PostgreSQL function
5. Function queries bookings + blackouts tables
6. Results flow back up the chain
7. CDN caches response for 5 minutes

**Request Flow** (cached):

1. Guest requests `/calendar` → Cloudflare CDN (hit)
2. CDN returns cached HTML (< 50ms)
3. React hydrates, checks local TanStack Query cache
4. If cache valid (< 5 min), no API call needed
5. If stale, refetch in background (stale-while-revalidate)
6. User can manually refresh by clicking "Today" button

**Total Latency**:

- **Cached**: < 100ms (CDN edge)
- **Uncached**: < 500ms (API + DB)
- **Target**: < 2 seconds (P95)

**Cache Freshness**: Data is at most 5 minutes old. For a view-only calendar, this is acceptable as availability doesn't change every minute.

### Route Architecture

This system adds a **PUBLIC route** that complements the existing **PRIVATE route**:

| Route                          | Access               | Purpose                     | Data Shown                                          |
| ------------------------------ | -------------------- | --------------------------- | --------------------------------------------------- |
| `/calendar`                    | Public (no auth)     | Guest inquiry tool          | Aggregate availability counts (0-3 units available) |
| `/_authenticated/availability` | Private (staff only) | Internal booking management | Unit-specific details, guest names, booking IDs     |

**No route conflicts** - these serve completely different purposes:

- **Public calendar** (`/calendar`): Helps guests discover available dates (view-only, aggregate data)
- **Private calendar** (`/_authenticated/availability`): Helps staff manage bookings (full CRUD operations, detailed data)

### Database Design

**No New Tables Required** ✅

**Unit Status Model** (Option C Hybrid):

- `units.unit_status`: Static per unit ('Available', 'Maintenance', 'Retired')
- `availability_blackouts`: Date-specific unavailability per unit
- Formula: `total_available_units - (booked_units + blackout_units) = available_count`

**Multi-Unit Booking Compatibility**: The database function queries both:

- `bookings.unit_id` (current single-unit bookings)
- `booking_units` junction table (future multi-unit bookings via UNION)

This design automatically supports the multi-unit booking feature being developed on another branch. No migration needed when that feature merges.

**New Database Function**:

```sql
CREATE OR REPLACE FUNCTION get_public_aggregate_availability(
  p_start_date DATE,
  p_end_date DATE
) RETURNS TABLE (
  date DATE,
  available_count INT
) AS $$
DECLARE
  v_total_units INT;
BEGIN
  -- Query total available units dynamically (not hardcoded)
  SELECT COUNT(*) INTO v_total_units
  FROM units
  WHERE unit_status = 'Available';

  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(p_start_date, p_end_date, '1 day'::interval)::date as date
  ),
  occupied_per_day AS (
    SELECT
      ds.date,
      COUNT(DISTINCT b.unit_id) as booked_count
    FROM date_series ds
    LEFT JOIN bookings b ON (
      b.unit_id IN (SELECT unit_id FROM units WHERE unit_status = 'Available')
      AND b.booking_status IN ('Confirmed', 'CheckedIn', 'Hold')
      -- Hold status counts as occupied to prevent overbooking
      AND ds.date >= b.check_in::date
      AND ds.date < b.check_out::date  -- Checkout day is available
    )
    GROUP BY ds.date
  ),
  blackout_per_day AS (
    SELECT
      ds.date,
      COUNT(DISTINCT ab.unit_id) as blackout_count
    FROM date_series ds
    LEFT JOIN availability_blackouts ab ON (
      ab.unit_id IN (SELECT unit_id FROM units WHERE unit_status = 'Available')
      AND ds.date >= ab.start_date::date
      AND ds.date < ab.end_date::date
    )
    GROUP BY ds.date
  )
  SELECT
    opd.date,
    GREATEST(
      0,
      v_total_units - COALESCE(opd.booked_count, 0) - COALESCE(bpd.blackout_count, 0)
    ) as available_count
  FROM occupied_per_day opd
  JOIN blackout_per_day bpd ON opd.date = bpd.date
  ORDER BY opd.date;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant public access
GRANT EXECUTE ON FUNCTION get_public_aggregate_availability(DATE, DATE) TO anon;
```

**Why SECURITY DEFINER?**

- Anonymous users (role: `anon`) have Row Level Security (RLS) policies that prevent direct access to `bookings` table
- `SECURITY DEFINER` runs the function with **owner privileges**, bypassing RLS
- **Safe** because function only exposes aggregated counts, never guest information
- Alternative would be to add RLS policy allowing `SELECT` on bookings where `booking_id IS NOT NULL`, but that's overly permissive

### API Design

**Endpoint**: `GET /api/public/v1/availability`

**Request**:

```http
GET /api/public/v1/availability?start=2025-01-01&end=2025-01-31 HTTP/1.1
Host: okaeri-resort.com
Accept: application/json
```

**Response** (200 OK):

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
    "cacheMaxAge": 300
  }
}
```

**Status Codes**:

- `200 OK`: Successful response
- `400 Bad Request`: Invalid date parameters
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Database or API error

**Cache Headers**:

```http
Cache-Control: public, max-age=300, stale-while-revalidate=600
Vary: Accept-Encoding
ETag: "availability-2025-01-01-31-v1"
```

**Rate Limiting**:

- **Limit**: 30-60 requests per minute per IP (CDN caching handles normal traffic)
- **Window**: Sliding window (Cloudflare Workers KV)
- **Response**: 429 with `Retry-After` header

### Frontend Architecture

**Route**: `/calendar` (public, no authentication, standalone - no redirect)

**Timezone**: Philippine Time (Asia/Manila, UTC+8) using date-fns-tz

**Component Hierarchy**:

```
AvailabilityPage
├── Header
│   ├── Title: "Okaeri Availability Calendar"
│   └── Description: "Check availability for your dates"
├── PublicAvailabilityCalendar
│   ├── AvailabilityLegend (green/yellow/orange/red)
│   ├── MonthNavigation (< January 2025 >)
│   └── CalendarGrid
│       └── DayCell[] (color-coded, shows count on hover)
```

**State Management**:

- **TanStack Query**: Server state (availability data)
- **React useState**: UI state (current month, hover states)
- **No Zustand needed**: Ephemeral view-only state

**Data Fetching** (TanStack Query with CDN caching):

```typescript
// Data fetching with stale-while-revalidate pattern
const { data, isLoading, error } = useQuery({
  queryKey: ["publicAvailability", currentMonth.toISOString()],
  queryFn: () => fetchAvailability(currentMonth),
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  refetchOnWindowFocus: true,
  refetchOnMount: false,
});

// Manual refresh function (triggered by "Today" button)
const { refetch } = useQuery({
  queryKey: ["publicAvailability", currentMonth.toISOString()],
});
```

**Cache Strategy**: CDN-only (no WebSocket). Data refreshes automatically after 5 minutes or on window focus. Users can manually refresh by clicking navigation buttons.

**Color Coding Logic**:

```typescript
function getStatusColor(availableCount: number): string {
  if (availableCount === 3) return "bg-green-500"; // All available
  if (availableCount === 2) return "bg-yellow-500"; // Moderate
  if (availableCount === 1) return "bg-orange-500"; // Limited
  return "bg-red-500"; // Fully booked
}

function getStatusLabel(availableCount: number): string {
  if (availableCount === 3) return "3 units available";
  if (availableCount === 2) return "2 units available";
  if (availableCount === 1) return "1 unit available";
  return "Fully booked";
}
```

---

## Security & Privacy

### Threat Model

**Potential Threats**:

1. **DDoS attacks**: High-volume requests overwhelming API
2. **Bot scraping**: Competitors/scrapers harvesting availability data
3. **Cache poisoning**: Malicious actors injecting bad data
4. **Information leakage**: Accidentally exposing guest data

**Mitigations**:

1. **Cloudflare DDoS protection** + rate limiting (30-60 req/min per IP)
2. **Turnstile invisible mode**: Bot detection without user friction (consistent with `/api/guest-booking` endpoint)
3. **Acceptable risk**: Availability is public information by design
4. **CDN validation**: ETag verification, immutable cache keys
5. **SECURITY DEFINER function**: Only exposes aggregated counts, never raw booking data
6. **Middleware integration**: Reuses existing patterns from `functions/_middleware.ts` and `guest-booking.ts`

### Data Privacy Compliance

**What's Exposed** (✅ Safe):

- Availability counts per date (0-3)
- Date ranges (public calendar dates)
- Total unit count (3)

**What's Never Exposed** (✅ Protected):

- Guest names, emails, phone numbers
- Booking references or IDs
- Payment information
- Pricing information (discussed with manager only)
- Special requests or notes
- Internal booking status details (only aggregate counts: Confirmed + CheckedIn + Hold)
- Unit-specific assignments

**GDPR/Privacy Considerations**:

- **No personal data**: Aggregated counts only, no PII
- **No cookies**: View-only page, no tracking
- **No user accounts**: Anonymous access
- **Audit trail**: Optional logging of calendar views (no user identification)

---

## Performance Optimization

### Caching Strategy

**Three-Layer Cache**:

1. **CDN Edge Cache** (Cloudflare):
   - Duration: 5 minutes
   - Scope: Global edge network
   - Hit rate target: >80%
   - Invalidation: TTL expiry only (no manual invalidation needed)

2. **Client-Side Cache** (TanStack Query):
   - Duration: 5 minutes stale time, 10 minutes cache time
   - Scope: Browser memory
   - Refetch triggers: Window focus, mount, manual refresh
   - Background updates: stale-while-revalidate pattern

3. **Database Query Cache** (PostgreSQL):
   - Duration: Automatic (Neon serverless connection pooling)
   - Scope: Database server
   - Benefits: Sub-100ms query execution

**Cache Invalidation**: TTL-based expiry only (no real-time updates)

- **CDN edge**: Expires after 5 minutes, refetches from Workers
- **Client-side**: Expires after 5 minutes, refetches from CDN
- **Manual refresh**: Users can click "Today" button or navigate months to force refetch
- **Acceptable staleness**: For a view-only calendar, 5-minute delay is acceptable (availability doesn't change second-by-second)

### Performance Targets

| Metric                             | Target  | Measurement          |
| ---------------------------------- | ------- | -------------------- |
| **TTFB** (Time to First Byte)      | < 200ms | Cloudflare Analytics |
| **FCP** (First Contentful Paint)   | < 1.5s  | Lighthouse           |
| **LCP** (Largest Contentful Paint) | < 2.5s  | Lighthouse           |
| **TTI** (Time to Interactive)      | < 3s    | Lighthouse           |
| **CLS** (Cumulative Layout Shift)  | < 0.1   | Lighthouse           |
| **Lighthouse Performance Score**   | > 90    | Lighthouse CI        |

**Optimization Techniques**:

- **Code splitting**: Lazy load calendar component
- **Image optimization**: Use WebP format, lazy load any decorative images
- **CSS optimization**: Inline critical CSS, defer non-critical
- **Font optimization**: Preload fonts, use font-display: swap
- **Bundle size**: Keep JavaScript bundle < 100KB gzipped

---

## Business Requirements & Decisions

### Answered Questions

#### 1. Check-in/Check-out Date Logic

**Question**: Should checkout dates be available for new bookings?

**Decision**: **Checkout date is available for new bookings** ✅

**Rationale**:

- Simplifies calendar logic (exclusive end date)
- Matches internal booking system behavior
- No time-of-day complexity needed

**Implementation**:

```sql
-- Checkout day is available (exclusive end date)
WHERE ds.date >= b.check_in::date
  AND ds.date < b.check_out::date  -- < not <=
```

#### 2. Minimum Stay Requirements

**Question**: Should the calendar indicate minimum stay requirements (e.g., 2-night minimum on weekends)?

**Decision**: **Display as informational text only, no enforcement** ✅

**Rationale**:

- View-only calendar doesn't enforce booking rules
- Guests will discuss requirements via WhatsApp/Phone
- Reduces UI complexity significantly
- Can be added later without breaking changes

**Implementation**:

```tsx
<div className="mb-4 text-sm text-gray-600">
  Note: 2-night minimum stay required for weekends and holidays
</div>
```

#### 3. Peak Season Indicators

**Question**: Should the calendar highlight peak seasons (Christmas, Holy Week, Summer)?

**Decision**: **Optional visual indicator (Phase 2 enhancement)** ⏳

**Rationale**:

- Doesn't affect availability logic
- Adds visual clutter if not done well
- Can be A/B tested after launch
- Low priority for MVP

**Future Implementation**:

```tsx
{
  isPeakSeason(date) && (
    <Badge variant="secondary" className="text-xs">
      🎄 Holiday Season
    </Badge>
  );
}
```

#### 4. Cache Refresh Strategy

**Question**: Should the calendar update in real-time when bookings change?

**Decision**: **No real-time updates - CDN caching only (5-minute TTL)** ✅

**Rationale**:

- Simpler architecture (no WebSocket connections)
- View-only calendar doesn't need second-by-second accuracy
- 5-minute staleness is acceptable for availability checking
- Users can manually refresh by navigating months or clicking "Today"
- Reduces frontend complexity by ~40%
- Manager-mediated booking flow eliminates race condition concerns

**Implementation**:

- CDN edge cache: 5-minute TTL
- TanStack Query client cache: 5-minute stale time
- Manual refresh available via navigation buttons
- Data freshness acceptable for guest inquiry use case

#### 5. Analytics & Monitoring

**Question**: What analytics should we track for the public calendar?

**Decision**: **Track page views and date interaction patterns** ✅

**Metrics to Track**:

```typescript
// Page analytics (Cloudflare Web Analytics - FREE)
- Calendar page views (total, unique)
- Date range queries (most-viewed months)
- User engagement (time on page, bounce rate)
- Device breakdown (mobile vs desktop)

// Interaction analytics (Custom events - FREE)
- Date clicks (which dates users are interested in)
- Month navigation (forward/backward patterns)
- Bounce rate after viewing calendar
```

**Implementation**:

- Cloudflare Web Analytics (free tier: unlimited events)
- Custom event tracking for date clicks and month navigation
- No additional infrastructure needed

---

## Risk Management

### Identified Risks

| Risk                                                | Probability | Impact | Mitigation                                                                                                                                                       |
| --------------------------------------------------- | ----------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **High API traffic overwhelming database**          | Low         | High   | Aggressive CDN caching (5 min), connection pooling, rate limiting. **Free tier verified**: 500 views/month = ~10 DB queries/day (well below 60 connection limit) |
| **Data inconsistency (stale cache)**                | Very Low    | Low    | 5-minute TTL acceptable for view-only calendar; "Updated X min ago" timestamp + manual refresh button                                                            |
| **Bot scraping driving up costs**                   | Low         | Low    | Rate limiting (30-60 req/min), Turnstile invisible mode, Cloudflare bot detection. **Free tier safe**: 50 views/day = well below 100K Workers requests/day       |
| **Mobile performance issues**                       | Low         | Medium | Lighthouse CI, performance budget, lazy loading                                                                                                                  |
| **SEO not indexing calendar page**                  | Low         | High   | Static HTML shell, meta tags, sitemap.xml entry                                                                                                                  |
| **Guests confused by "view-only" (expect booking)** | Medium      | Low    | Clear messaging: "View availability" (calendar returns to main site for contact info)                                                                            |

**Free Tier Assurance**:

- **Expected traffic**: 500 calendar views/month (~16/day, peak 50/day)
- **Supabase**: ~10 DB queries/day (CDN cached)
- **Cloudflare**: 50 requests/day peak, 20 KV writes/day for rate limiting
- **All metrics well within free tier limits**

### Rollback Plan

**If Launch Fails**:

1. **Immediate**: Remove `/calendar` route from production build
2. **Database**: Run DOWN migration to drop `get_public_aggregate_availability()` function
3. **API**: Disable endpoint via middleware feature flag (no code deployment needed)
4. **Communication**: Add "Under maintenance" message on marketing materials

**Criteria for Rollback**:

- Lighthouse Performance score < 70
- API error rate > 5%
- CDN cache hit ratio < 50%
- User feedback overwhelmingly negative

---

## Success Metrics & KPIs

### Primary Business Metrics

| Metric                              | Baseline | Target (3 months) | Measurement                         |
| ----------------------------------- | -------- | ----------------- | ----------------------------------- |
| **WhatsApp Availability Inquiries** | 100%     | -30%              | Manual count from WhatsApp Business |
| **Qualified Booking Inquiries**     | 100%     | +20%              | CRM tracking (inquiries → bookings) |
| **Calendar Page Views**             | 0        | 500+/month        | Google Analytics                    |
| **Engagement Rate (time on page)**  | N/A      | >30s average      | Google Analytics                    |

### Technical Performance Metrics

| Metric                      | Target  | Measurement Tool                |
| --------------------------- | ------- | ------------------------------- |
| **Page Load Time (P95)**    | < 2s    | Lighthouse, Vercel Analytics    |
| **API Response Time (P95)** | < 500ms | Cloudflare Workers Analytics    |
| **CDN Cache Hit Ratio**     | > 80%   | Cloudflare Analytics            |
| **Lighthouse Performance**  | > 90    | Lighthouse CI (automated)       |
| **Mobile Lighthouse Score** | > 85    | Lighthouse CI                   |
| **Uptime**                  | 99.9%   | Uptime Robot, Vercel monitoring |

### User Experience Metrics

| Metric                    | Target      | Measurement                             |
| ------------------------- | ----------- | --------------------------------------- |
| **Bounce Rate**           | < 40%       | Google Analytics                        |
| **Time on Page**          | > 30s       | Google Analytics                        |
| **Mobile vs Desktop**     | 60/40 split | Google Analytics                        |
| **Date Interaction Rate** | > 15%       | Custom event tracking (clicks on dates) |

---

## Implementation Timeline

### Week 1: Backend Development (2 days)

**Day 1: Database Function**

- Create `get_public_availability()` function
- Write unit tests (test various date ranges)
- Verify SECURITY DEFINER grants
- Test performance with `EXPLAIN ANALYZE`

**Day 2: API Endpoint**

- Build `/api/public/v1/availability.ts` worker
- Add Turnstile invisible mode verification (consistent with guest booking)
- Add input validation (date parameters, max 62-93 day range)
- Configure cache headers (`s-maxage=300, stale-while-revalidate=120`)
- Add rate limiting logic (30-60 req/min per IP)
- Configure CORS with specific origins only
- Integrate with existing middleware patterns
- Test with cURL and Postman

### Week 1-2: Frontend Development (3-4 days)

**Day 3-4: Core Components**

- Create `/calendar` route (standalone, no auth redirect)
- Build `PublicAvailabilityCalendar` component
- Implement TanStack Query data fetching with 5-minute caching
- Configure date-fns-tz for Philippine Time (UTC+8)
- Add loading and error states
- Create `CalendarGrid` with day cells

**Day 5-6: UI Polish**

- Add color coding logic (green/yellow/orange/red)
- Build `AvailabilityLegend` component
- Implement month navigation with manual refresh capability
- Add "Updated X min ago" timestamp for data freshness
- Add accessibility features (ARIA roles, keyboard navigation, color-blind indicators)
- Style with Tailwind CSS v4 (responsive design)
- Implement Cloudflare Web Analytics tracking (date clicks, month navigation)

**Day 7: Mobile Optimization**

- Test on iOS Safari and Android Chrome
- Fix responsive layout issues
- Optimize touch targets (min 44x44px)
- Add swipe gestures for month navigation

### Week 2: Testing & Deployment (2 days)

**Day 8: Testing**

- Cross-browser testing (Chrome, Firefox, Safari, Edge)
- Mobile device testing (real devices)
- Lighthouse audits (desktop and mobile)
- Accessibility testing (WCAG 2.1 AA)
- Load testing API endpoint

**Day 9: Launch**

- Deploy to production
- Verify CDN caching behavior
- Set up monitoring (Vercel Analytics, Sentry)
- Update marketing materials
- Announce on social media
- Monitor for first 24 hours

**Total**: 7-9 days (1-2 developer weeks)

---

## Post-Launch Plan

### Monitoring (First Week)

**Daily Checks**:

- CDN cache hit ratio (target: >80%)
- API error rate (target: <1%)
- Page load times (target: <2s P95)
- User feedback (WhatsApp, email)

**Weekly Review**:

- Lighthouse scores (automated CI)
- Analytics review (views, conversions)
- Cost analysis (Cloudflare, Supabase)
- User behavior analysis (most-viewed dates)

### Iteration Plan (Months 2-3)

**Phase 2 Enhancements**:

- Peak season indicators (badges for holidays)
- Embeddable calendar widget (for Facebook page)
- Analytics dashboard (internal tool)
- Review date interaction patterns from analytics data

**Phase 3 Enhancements** (if demand warrants):

- Unit-type filtering (if you expand beyond 3 identical units)
- Pricing display per date (if you implement dynamic pricing)
- iCal feed subscription (for regular guests)
- Real-time updates via WebSocket (if high booking volume)

---

## Appendix

### Related Documentation

- [Phase 1: Backend Implementation](./01-phase-1-backend.md)
- [Phase 2: Frontend Implementation](./02-phase-2-frontend.md)
- [Phase 3: Deployment & Testing](./03-phase-3-deployment.md)
- [Architecture Diagrams](./architecture-diagrams.md)

### Technical References

- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Cloudflare Workers Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)
- [TanStack Query Caching](https://tanstack.com/query/latest/docs/react/guides/caching)
- [Lighthouse Performance](https://web.dev/performance-scoring/)

### Contact & Support

- **Technical Lead**: [Your Name]
- **Product Owner**: [Resort Manager]
- **Deployment Support**: DevOps team
- **User Feedback**: feedback@okaeri-resort.com

---

**Document Version**: 1.0
**Last Updated**: 2025-01-10
**Next Review**: After Phase 1 completion
**Status**: Approved for implementation
