# Chunk 007: Payment Summary with Preview

## At a Glance

| Property | Value |
|----------|-------|
| **Estimated Time** | 75 minutes |
| **Milestone** | Real-Time Pricing Preview Complete |
| **Prerequisites** | ✅ Chunk 004 (`/api/guest-booking/preview-pricing` endpoint operational)<br>✅ Chunk 006 (form state: date_range, unit_requests)<br>✅ Chunk 002 (PostgreSQL `calculate_booking_pricing()` function deployed) |
| **Can Skip?** | ❌ No - Critical for pricing transparency and guest trust |
| **Phase** | Phase 2: Guest Booking Flow (2 of 5) |

## What You're Building

This chunk implements the **server-side pricing preview component** that displays real-time booking costs calculated by the authoritative PostgreSQL pricing function. This is NOT a client-side calculator—it's a UX wrapper around the server's pricing authority.

### 1. PaymentSummary Component
- **Server-Calculated Pricing**: Calls `/api/guest-booking/preview-pricing` endpoint
- **Real-Time Updates**: Recalculates when dates or units change
- **Comprehensive Breakdown**: Shows base total, weekend surcharges, extra person fees
- **Discount Display**: Shows applied discount (if any) with rule name and percentage
- **Downpayment Calculation**: Required downpayment (configurable %, default 50%)

### 2. Debounced API Calls
- **500ms Delay**: Prevents excessive API calls while user adjusts inputs
- **Loading States**: Skeleton UI during calculation
- **Error Handling**: Graceful fallback when preview fails

### 3. Transparency Features
- **Preview Warning Banner**: Clearly states "preview only, final pricing at submission"
- **Discount Badge**: Shows which discount rule applied (e.g., "7-Night Discount - 5%")
- **Line Item Breakdown**: Transparent calculation display
- **Admin Assignment Notice**: Explains unit assignment happens after payment

### 4. Type-Safe API Integration
- **PricingPreview Interface**: Complete typing for server response
- **API Client Extension**: Add `previewPricing()` function
- **Error Types**: Structured error handling

## Why This Matters

### Business Impact
- **Transparency Builds Trust**: Guests see exactly how pricing is calculated
- **Reduces Support Queries**: Clear breakdown prevents "why this price?" questions
- **Encourages Longer Stays**: Discount visibility incentivizes qualifying for better rates
- **Sets Expectations**: Downpayment amount shown upfront, no surprises

### Technical Benefits
- **Single Source of Truth**: Preview calls same PostgreSQL function as final booking
- **No Client/Server Drift**: Impossible for preview to show different pricing than actual
- **Audit Trail**: All pricing calculations logged server-side
- **Performance Optimized**: Debouncing reduces database load

### User Experience Principles

**Real-Time Feedback**:
- Guest adds a unit → Preview updates within 500ms
- Guest changes dates → Pricing recalculates automatically
- Discount qualifies → Badge appears with savings amount

**Clarity Over Cleverness**:
- Shows "Calculating..." during API call
- Warning banner: "Preview only"
- Downpayment prominently displayed
- All fees itemized (no hidden costs)

**Error Resilience**:
- Preview fails → Form remains usable
- Network error → Clear error message
- Stale data → Loading state until fresh data arrives

## Before You Start

### Prerequisites Checklist

**API Endpoint (from Chunk 004):**
- [ ] `POST /api/guest-booking/preview-pricing` endpoint deployed
- [ ] Endpoint calls PostgreSQL `calculate_booking_pricing()` function
- [ ] Endpoint returns correct response shape (see 02-api-specification.md lines 676-691)
- [ ] CORS configured for development

**Database (from Chunk 002):**
- [ ] PostgreSQL `calculate_booking_pricing()` function exists
- [ ] Function returns nights, base_total, weekend_surcharge, extra_person_fees, subtotal, discount, total, downpayment_required
- [ ] `pricing_config` table has data (base_rate, weekend_rate, etc.)

**Frontend (from Chunk 006):**
- [ ] `UnitRequest` type defined
- [ ] `GuestBookingFormData` type includes date_range and unit_requests
- [ ] Form state managed by parent component
- [ ] shadcn/ui components available (Card, Alert, Badge, Separator, Skeleton)

**Development Environment:**
- [ ] TypeScript compiling without errors
- [ ] React Hook Form installed
- [ ] API endpoint accessible from frontend (check CORS)

### Verify Prerequisites

```bash
# Test preview endpoint
curl -X POST https://your-domain.com/api/guest-booking/preview-pricing \
  -H "Content-Type: application/json" \
  -d '{
    "unit_requests": [{"guests_per_unit": 2}],
    "check_in": "2025-02-01T00:00:00Z",
    "check_out": "2025-02-08T00:00:00Z"
  }'

# Expected response (example):
# {
#   "success": true,
#   "pricing": {
#     "nights": 7,
#     "total_units": 1,
#     "total_guests": 2,
#     "base_total": 14000,
#     "weekend_surcharge": 1000,
#     "extra_person_fees": 0,
#     "subtotal": 15000,
#     "discount": { "percent": 5, "amount": 750, "rule_name": "7-Night Discount" },
#     "total": 14250,
#     "downpayment_required": 7125,
#     "downpayment_percent": 50
#   }
# }

# Verify PostgreSQL function exists
psql $DATABASE_URL -c "\df calculate_booking_pricing"
# Expected: Function definition shown

# Check pricing_config data
psql $DATABASE_URL -c "SELECT * FROM pricing_config WHERE id = 'default'"
# Expected: Row with base_rate, weekend_rate, etc.
```

## What Happens Next

After completing this chunk successfully:

### Immediate Outcomes
- ✅ **Real-time pricing preview** - Updates automatically when form changes
- ✅ **Server-side calculations** - All pricing computed by PostgreSQL function
- ✅ **Discount visibility** - Shows applied discounts with rule name
- ✅ **Downpayment display** - Required payment amount clear
- ✅ **Debounced API calls** - Optimized performance (500ms delay)
- ✅ **Transparent breakdown** - Line-by-line pricing details

### Next Steps
- **Ready for Chunk 008**: Payment Proof Upload
  - Will use `downpayment_required` amount from this chunk
  - Payment proof submitted alongside booking
- **Ready for Chunk 009**: Form Validation and Submission
  - Final pricing validated server-side at submission
  - Preview helps guests understand what they'll pay

### System State After Completion
```
Phase 1: Database & Backend Core ✅ COMPLETE
├── 001: Database schema ✅
├── 002: PostgreSQL pricing engine ✅
├── 003: Security, RLS, constraints ✅
├── 004: Core API endpoints ✅
└── 005: Idempotency & rate limiting ✅

Phase 2: Guest Booking Flow (In Progress)
├── 006: Date and Unit Selection UI ✅
├── 007: Payment Summary with Preview ✅ (YOU ARE HERE)
├── 008: Payment Proof Upload (NEXT)
├── 009: Form Validation and Submission
└── 010: Booking Confirmation Flow
```

## Key Files Created/Modified

```
okaeri-resort/
├── src/
│   ├── types/
│   │   └── guest-booking-multi-unit.ts    # MODIFIED - Add PricingPreview interface
│   ├── components/
│   │   └── guest-booking/
│   │       └── PaymentSummary.tsx          # NEW - Pricing preview component
│   └── lib/
│       └── api/
│           └── guest-booking-client.ts     # MODIFIED - Add previewPricing()
└── __tests__/
    └── components/
        └── guest-booking/
            └── PaymentSummary.test.tsx     # NEW - Component tests
```

### File Purposes

**`guest-booking-multi-unit.ts`** (MODIFIED):
- Add `PricingPreview` interface matching API response
- Add `PricingPreviewResponse` for API wrapper

**`PaymentSummary.tsx`** (NEW):
- Displays server-calculated pricing breakdown
- Calls `/api/guest-booking/preview-pricing` endpoint
- Debounces API calls (500ms delay)
- Shows loading, error, and success states
- Renders discount badge if applicable
- Displays downpayment requirement
- Warning banner for preview disclaimer

**`guest-booking-client.ts`** (MODIFIED):
- Add `previewPricing()` async function
- Type-safe request/response handling
- Error handling and logging

**`PaymentSummary.test.tsx`** (NEW):
- Test preview fetching on prop changes
- Test debouncing behavior
- Test discount display
- Test loading and error states

## Related Documentation

### Source Documentation
- **CHUNKING-STRATEGY.md lines 237-268**: Chunk 007 specification and scope
- **03-frontend-components.md lines 555-754**: Complete PaymentSummary component specification
- **02-api-specification.md lines 645-737**: Preview endpoint implementation
  - Lines 675-691: Endpoint code example
  - Lines 701-737: Performance and caching considerations (NO caching in Phase 1)
- **09-implementation-decisions.md lines 42-63**: Server-side pricing authority rationale

### Architectural Decisions
- **Server-Side Pricing Authority** (ADR-005): Why PostgreSQL function is sole calculator
- **Preview Endpoint Design** (02-api-specification.md lines 647-649): Preview wraps authoritative function
- **No Client Calculations** (09-implementation-decisions.md lines 58-63): Client displays only
- **Debouncing Strategy**: 500ms chosen to balance responsiveness vs API efficiency

### Integration Points
- **Chunk 002**: Uses PostgreSQL `calculate_booking_pricing()` function
- **Chunk 004**: Requires `/api/guest-booking/preview-pricing` endpoint
- **Chunk 006**: Consumes form state (date_range, unit_requests)
- **Chunk 008** (next): Uses downpayment_required for payment instructions
- **Chunk 009** (future): Final pricing re-validated at submission

## Implementation Notes

### Server-Side Pricing Flow

```
User changes form (date, unit count, guests)
    ↓
500ms debounce delay (prevents excessive calls)
    ↓
Component calls previewPricing() API client
    ↓
API endpoint receives request
    ↓
Endpoint calls PostgreSQL calculate_booking_pricing()
    ↓
PostgreSQL function:
  1. Fetches pricing_config (base_rate, weekend_rate, etc.)
  2. Calculates base total (nights × units × rate)
  3. Adds weekend surcharges (Friday/Saturday nights)
  4. Adds extra person fees (guests > base_occupancy)
  5. Evaluates discount rules (best-of policy)
  6. Computes total and downpayment
    ↓
Returns pricing breakdown to API
    ↓
API returns JSON to component
    ↓
Component displays breakdown in UI
```

**Key Point**: Frontend NEVER calculates pricing. It only displays server results.

### Preview vs Final Pricing

**Preview (this chunk)**:
```typescript
// Called during form editing for UX
const preview = await previewPricing({
  unit_requests: [{ guests_per_unit: 2 }],
  check_in: '2025-02-01',
  check_out: '2025-02-08'
});
// Returns: { pricing: {...}, _note: "PREVIEW ONLY" }
```

**Final (Chunk 009 - future)**:
```typescript
// Called at booking submission (authoritative)
const booking = await createBooking({
  ...allFormData,
  // Same PostgreSQL function called server-side
});
// Returns: { booking: {...}, pricing_breakdown: {...} }
```

**Both call the same PostgreSQL function** - preview just provides early visibility.

### Debouncing Strategy

**Problem**: Guest changes guest count from 2 → 5 (3 keystrokes)
- Without debouncing: 3 API calls in rapid succession
- With debouncing: 1 API call after 500ms of inactivity

**Implementation**:
```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    fetchPricing(); // Only called after 500ms of no changes
  }, 500);

  return () => clearTimeout(timer); // Cancel if props change again
}, [unitRequests, checkIn, checkOut]); // Dependencies trigger debounce
```

### Discount Display Logic

```typescript
// Discount applied by server (best-of policy)
if (pricing.discount) {
  // Show badge: "7-Night Discount - 5%"
  // Show savings: "-₱750"
  // Applied automatically by PostgreSQL function
}

// NO discount
if (!pricing.discount) {
  // Don't show discount section
  // Subtotal = Total
}
```

## Security Considerations

### Input Validation (Server-Side Only)
- **Preview endpoint validates**: unit_requests array, check_in/check_out dates
- **Client does NOT validate**: Trusts server validation
- **Prevents tampering**: Even if client sends malicious data, server rejects

### Data Privacy
- **No sensitive data exposed**: Preview shows pricing only
- **No guest info required**: Only dates and unit requests sent
- **Public endpoint**: No authentication required for preview

### Rate Limiting
- **Applied in Chunk 005**: Preview endpoint rate-limited (20 requests/hour/IP)
- **Prevents abuse**: Protects database from excessive preview calls
- **Debouncing helps**: Client-side debouncing reduces hits to rate limit

## Performance Considerations

### API Call Optimization
- **Debouncing**: 500ms delay reduces calls by ~70% during form editing
- **Conditional fetching**: Only calls API when all required fields present
- **Loading state**: Prevents multiple simultaneous calls

### Expected Metrics
- **API call frequency**: ~1-3 calls per booking (dates selected, units added, final review)
- **Response time**: ~100-200ms (PostgreSQL function + network)
- **Database load**: Negligible (<1000 preview calls/day expected)

### No Caching (Phase 1 Decision)
**Rationale** (02-api-specification.md lines 703-706):
- Expected load too low to justify caching complexity
- Pricing config may change (caching adds invalidation complexity)
- Direct PostgreSQL calls sufficient for current scale

**When to add caching** (lines 707-712):
- Preview requests > 1000/day, OR
- Database CPU > 60%, OR
- p95 latency > 500ms

## Common Questions

**Q: Why not calculate pricing client-side for instant feedback?**
A: Server-side pricing is the SOLE source of truth (ADR-005). Client calculations would create drift risk, audit issues, and maintenance burden.

**Q: What if preview shows different price than final booking?**
A: Preview calls the SAME PostgreSQL function as final booking. Only way prices differ is if pricing_config changes between preview and submission (rare).

**Q: Why 500ms debounce instead of 300ms or 1000ms?**
A: 500ms balances user experience (feels instant) with API efficiency (prevents keystroke-per-call). Tested empirically.

**Q: What if preview endpoint is slow (>1s)?**
A: Loading skeleton displays during call. If consistently slow, investigate database query performance or add caching (see 02-api-specification.md lines 713-730).

**Q: Can guests game the system by manipulating preview calls?**
A: No. Preview is read-only and rate-limited. Final pricing re-calculated at submission with full validation.

**Q: What if discount rules change while guest is filling form?**
A: Preview shows outdated discount. Final booking uses current rules. This is acceptable—discount rules change infrequently.

**Q: Why show downpayment if full payment might be required?**
A: Downpayment is ALWAYS required (50% default). Full payment optional. Showing downpayment sets minimum expectation.

---

**Ready to implement?** Proceed to `instructions.md` for step-by-step implementation guide.
