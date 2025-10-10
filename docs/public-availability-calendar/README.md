# Public Availability Calendar - Documentation

> **View-only public calendar** showing real-time availability for Okaeri Resort's 3 beachfront units.

## 📋 Quick Navigation

| Document | Purpose | Est. Time |
|----------|---------|-----------|
| [Master Plan](./00-master-plan.md) | Comprehensive overview, strategy, and business context | 15 min read |
| [Phase 1: Backend](./01-phase-1-backend.md) | Database function + API endpoint implementation | 2 days |
| [Phase 2: Frontend](./02-phase-2-frontend.md) | React components + UI implementation | 3-4 days |
| [Phase 3: Deployment](./03-phase-3-deployment.md) | Testing, deployment, and monitoring | 2 days |
| [Architecture Diagrams](./architecture-diagrams.md) | System architecture with Mermaid diagrams | Reference |

## 🎯 Project Overview

### Business Value
- **Reduce inquiry overhead**: Guests check availability themselves instead of asking via WhatsApp
- **Improve conversion**: Instant availability visibility reduces booking friction
- **Enhance SEO**: Public calendar page indexed by Google for "Okaeri Resort availability"
- **Professional image**: Modern, real-time availability display

### Booking Flow (Manager-Mediated)

> **📌 IMPORTANT: This is a VIEW-ONLY calendar**

The calendar displays availability information only. The actual booking process is manager-mediated:

1. **Guest views calendar** → Checks available dates (no booking action possible)
2. **Guest contacts manager** → Via WhatsApp or phone from calendar page
3. **Manager discusses details** → Dates, unit preferences, pricing, special requests
4. **Manager sends booking link** → After confirming availability and details
5. **Manager approves booking** → Manually creates and confirms reservation

**Why this matters:**
- ✅ No race conditions (manager controls all approvals)
- ✅ No pricing confusion (discussed directly with guest)
- ✅ No automated bookings (manager verifies each reservation)
- ✅ Personal service (builds guest relationships)

### Technical Summary
- **Type**: View-only public calendar (no booking forms, no pricing display)
- **Authentication**: None required (public endpoint)
- **Data**: Aggregated availability counts only (3 units total)
- **Privacy**: No guest information exposed
- **Performance**: Aggressive CDN caching (5-minute edge cache)
- **Stack**: Supabase PostgreSQL + Cloudflare Workers + Cloudflare Pages + React 19 + TanStack Query

## 🚀 Quick Start (for Developers)

### Prerequisites
- Node.js 20+
- Access to Supabase project
- Cloudflare Workers deployment access
- Familiarity with existing codebase structure

### Implementation Phases

#### Phase 1: Backend (2 days)
1. Create `get_public_aggregate_availability()` database function
2. Build `/api/public/v1/availability` endpoint
3. Configure CDN caching and rate limiting
4. Test with cURL and Postman

#### Phase 2: Frontend (3-4 days)
1. Create `/calendar` public route
2. Build `PublicAvailabilityCalendar` component
3. Implement TanStack Query data fetching
4. Style with Tailwind CSS v4
5. Mobile responsive testing
6. Add accessibility features (ARIA, keyboard nav)

#### Phase 3: Deployment (2 days)
1. Cross-browser and mobile device testing
2. Lighthouse performance optimization
3. Production deployment
4. Monitoring and analytics setup
5. Marketing material updates

**Total Timeline**: 7-9 days (1-2 developer weeks)

## 🏗️ System Architecture (High-Level)

```
┌─────────────┐
│   Guest     │
│  (Public)   │
└──────┬──────┘
       │
       │ HTTPS Request
       ▼
┌─────────────┐
│  Cloudflare │  ← 5-min CDN cache
│     CDN     │
└──────┬──────┘
       │
       │ Cache miss
       ▼
┌─────────────────────────────┐
│  Cloudflare Workers API     │
│  /api/public/v1/availability│
└──────┬──────────────────────┘
       │
       │ RPC call
       ▼
┌─────────────────────────────────────┐
│   Supabase PostgreSQL               │
│  get_public_aggregate_availability()│
│  (SECURITY DEFINER)                 │
└─────────────────────────────────────┘
       │
       │ Queries
       ▼
┌─────────────────────────────┐
│   bookings table            │
│   (aggregates unit_id)      │
└─────────────────────────────┘
```

## 📊 Key Decisions

### Architectural Choices

| Decision | Rationale |
|----------|-----------|
| **View-only (no forms, no pricing, no CTAs)** | Reduces complexity by 60%, keeps users on manager-mediated booking flow |
| **Client-side rendering** | Fast page loads with strong meta tags; SSR/SSG upgrade post-MVP if SEO metrics require |
| **5-minute CDN cache** | Balances freshness with performance; availability rarely changes minute-to-minute |
| **SECURITY DEFINER function** | Safely bypasses RLS to expose aggregated data without revealing guest info |
| **Invisible Turnstile** | Consistent bot protection with guest booking endpoint (invisible mode, no user friction) |
| **Manager-mediated bookings** | No race conditions; manager approves all bookings after direct communication with guest |

### Data Privacy
✅ **Only aggregated counts exposed** (e.g., "2 units available")
✅ **No guest names, booking references, or contact information**
✅ **No unit-specific details** (just total availability)
✅ **No guest- or booking-level details** (only per-day aggregate unit availability counts)
✅ **No pricing information** (discussed directly with manager during booking)

## 🔗 Integration with Existing System

### Leverages Existing Infrastructure
- ✅ **Units table**: Already has 3 units configured
- ✅ **Bookings table**: Queries `booking_status` and date ranges
- ✅ **Multi-unit system**: Compatible with `booking_units` junction table (future-proof)
- ✅ **Availability logic**: Follows same date overlap rules as internal system
- ✅ **Audit trail**: Can optionally log public calendar views

### No Breaking Changes
- ❌ **No schema modifications** required
- ❌ **No migrations** needed
- ❌ **No changes to existing bookings flow**
- ✅ **Purely additive** feature

## 📈 Success Metrics

### Primary KPIs
1. **Reduction in "Is it available?" WhatsApp messages** (Target: 30% reduction)
2. **Increase in qualified booking inquiries** (Target: 20% increase)
3. **Calendar page views per month** (Baseline: TBD)
4. **Conversion rate: calendar view → contact** (Target: >15%)

### Technical Metrics
- Page load time < 2 seconds
- Time to Interactive < 3 seconds
- API response time < 200ms
- CDN cache hit ratio > 80%
- Lighthouse Performance score > 90
- Mobile Lighthouse score > 85

## 🛡️ Security Considerations

### Public Endpoint Safety
- **Rate limiting**: 30-60 requests/minute per IP (Cloudflare) - CDN caching handles normal traffic
- **RLS bypass**: `SECURITY DEFINER` safely aggregates data
- **No authentication**: Public access by design
- **Input validation**: Date parameters only (ISO 8601 format), max 62-93 day range
- **CORS headers**: Specific origins only (`okaeri-resort.com`, `www.okaeri-resort.com`)

### Data Exposure Audit
- ✅ Availability counts: **SAFE TO EXPOSE**
- ❌ Guest names: **NEVER EXPOSED**
- ❌ Booking references: **NEVER EXPOSED**
- ❌ Contact information: **NEVER EXPOSED**
- ❌ Payment data: **NEVER EXPOSED**
- ❌ Pricing information: **NEVER EXPOSED** (discussed with manager only)

## 🧪 Testing Strategy

### Automated Tests
- Unit tests for availability calculation logic
- Integration tests for API endpoint
- E2E tests for calendar interaction flow

### Manual Testing
- Cross-browser (Chrome, Safari, Firefox, Edge)
- Mobile devices (iOS Safari, Android Chrome)
- Accessibility (WCAG 2.1 AA compliance)
- Performance (Lighthouse audits)

## 📚 Related Documentation

- [Project CLAUDE.md](../../CLAUDE.md) - Overall project guidelines
- [Database Schema](../../database/CLAUDE.md) - Database architecture
- [Multi-Unit Booking Migration](../multi-unit-booking/) - Related system
- [Availability System Guide](../initial/02-development/implementation-guides/calendar-system.md) - Internal availability logic

## 🆘 Support & Questions

### Common Issues
- **Calendar not loading**: Check API endpoint response, verify database function exists
- **Incorrect availability**: Validate booking_status filtering, check date overlap logic
- **Slow performance**: Verify CDN cache headers, check database query plan
- **Mobile layout issues**: Test with actual devices, check Tailwind responsive classes

### Getting Help
1. Review phase-specific implementation docs
2. Check architecture diagrams for system flow
3. Consult existing `src/components/ui/calendar.tsx` and `src/components/dashboard/DashboardCalendar.tsx` for patterns
4. Review master plan for business context

## 📝 Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-01-10 | Initial documentation created |

---

**Next Steps**: Start with [Master Plan](./00-master-plan.md) for comprehensive overview, then proceed to [Phase 1: Backend](./01-phase-1-backend.md) for implementation.
