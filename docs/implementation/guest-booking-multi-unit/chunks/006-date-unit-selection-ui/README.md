# Chunk 006: Date and Unit Selection UI

## At a Glance

| Property | Value |
|----------|-------|
| **Estimated Time** | 90 minutes |
| **Milestone** | Guest-Facing Booking UI Foundation Complete |
| **Prerequisites** | ✅ Chunk 004 (API endpoints operational)<br>✅ `/api/guest-booking/rates` endpoint returns config<br>✅ shadcn/ui components installed<br>✅ React Hook Form + Zod configured |
| **Can Skip?** | ❌ No - First UI component for guest booking flow |
| **Phase** | Phase 2: Guest Booking Flow (1 of 5) |

## What You're Building

This chunk implements the **first guest-facing interface** for the multi-unit booking system. You'll create the core form components that allow guests to select dates and specify their unit requests using the **array-based model** (one card per unit).

### 1. Date Range Picker
- **Check-in/Check-out Selection**: Date picker component with validation
- **Date Constraints**: Prevent past dates, enforce minimum stay (if configured)
- **Visual Feedback**: Clear display of selected date range and number of nights
- **Integration**: Connects to React Hook Form for state management

### 2. Unit Request Selector (Array-Based)
- **Dynamic Unit Cards**: Add/remove unit cards (NOT quantity input)
- **One Card = One Unit**: Visual representation matching the data model
- **Guest Count per Unit**: Input for each unit's guest count
- **Capacity Validation**: Client-side check against `max_capacity_per_unit`
- **Total Display**: Shows aggregate units and guests across all cards

### 3. Unit Request Card Component
- **Individual Unit UI**: Single card representing one requested unit
- **Guest Count Input**: Number input with min/max validation
- **Remove Button**: Delete card (when > 1 unit)
- **Extra Person Indicator**: Visual feedback when guests exceed base occupancy
- **Numbered Display**: Shows "Unit #1", "Unit #2", etc.

### 4. Static Rate Display
- **Fetch from API**: Call `/api/guest-booking/rates` for current pricing
- **Display Only**: Show base rate, weekend rate, extra person fee
- **NO Client Calculations**: Rates displayed for reference only
- **Server Authority**: All actual pricing calculated by PostgreSQL function

## Why This Matters

### Business Impact
- **First Impression**: This is the guest's first interaction with the booking system
- **Clear Intent**: Array-based UI makes "multiple units" concept obvious
- **Reduces Confusion**: No complex unit type selection or availability calendars
- **Foundation for Revenue**: Sets up the data structure for server-side pricing

### Technical Benefits
- **Array-Based Validation**: Client validates simple rules (capacity only)
- **Server-Side Authority**: No pricing logic in frontend to maintain/debug
- **Extensible Design**: Easy to add more unit request fields in future
- **Type Safety**: TypeScript types ensure data consistency with API

### User Experience Principles

**Simple Selection Pattern**:
- Guest clicks "Add Unit" button → New card appears
- Guest sets guest count for that unit
- Guest clicks X to remove unit (if > 1)
- NO quantity dropdowns, NO unit type selection

**Visual Clarity**:
- Each unit request is a distinct visual card
- Total units and guests displayed prominently
- Extra person fees shown inline when applicable
- Static rates visible for reference

**Validation Feedback**:
- Real-time capacity validation (e.g., max 10 guests per unit)
- Clear error messages for invalid inputs
- Disable "Add Unit" when max reached (10 units)

## Before You Start

### Prerequisites Checklist

**API Endpoints (from Chunk 004):**
- [ ] `GET /api/guest-booking/rates` endpoint deployed
- [ ] Endpoint returns pricing_config data (base_rate, weekend_rate, etc.)
- [ ] CORS configured for local development
- [ ] Endpoint tested with curl/Postman

**Frontend Dependencies:**
- [ ] shadcn/ui installed (`npx shadcn@latest init`)
- [ ] Core components available: Card, Button, Input, Label, Alert, Skeleton
- [ ] Tailwind CSS v4 configured
- [ ] React Hook Form (will be installed in Step 1, or verify: `npm list react-hook-form`)
- [ ] Zod (will be installed in Step 1, or verify: `npm list zod`)
- [ ] react-day-picker (will be installed in Step 1)

**TypeScript Setup:**
- [ ] TypeScript compiler running without errors (`npm run type-check`)
- [ ] Existing types directory: `src/types/`
- [ ] Database types available (if using Supabase: `database.types.ts`)

**Component Directory Structure:**
- [ ] `src/components/` directory exists
- [ ] `src/components/ui/` contains shadcn/ui components
- [ ] Ready to create `src/components/guest-booking/` directory

### Verify Prerequisites

```bash
# Check API endpoint responds
curl https://your-domain.com/api/guest-booking/rates
# Expected: JSON with base_rate, weekend_rate, max_capacity_per_unit, etc.

# Verify shadcn/ui components exist
ls src/components/ui/
# Expected: card.tsx, button.tsx, input.tsx, label.tsx, alert.tsx

# Check React Hook Form installed
npm list react-hook-form
# Expected: react-hook-form@7.x.x

# Verify TypeScript compilation
npm run type-check
# Expected: No errors
```

## What Happens Next

After completing this chunk successfully:

### Immediate Outcomes
- ✅ **Date picker functional** - Guests can select check-in/check-out dates
- ✅ **Unit cards working** - Dynamic add/remove with guest count inputs
- ✅ **Capacity validation active** - Client validates guest count per unit
- ✅ **Static rates displayed** - Pricing information visible for reference
- ✅ **Form state managed** - React Hook Form tracking all inputs
- ✅ **Types defined** - TypeScript interfaces for multi-unit booking data

### Next Steps
- **Ready for Chunk 007**: Payment Summary with Preview
  - Will use form state from this chunk
  - Will call `/api/guest-booking/preview-pricing` with unit requests
  - Will display server-calculated pricing breakdown
- **Foundation for entire guest flow**: Chunks 008-010 build on this UI
- **Data structure established**: Array-based model flows through entire system

### System State After Completion
```
Phase 1: Database & Backend Core ✅ COMPLETE
├── 001: Database schema ✅
├── 002: PostgreSQL pricing engine ✅
├── 003: Security, RLS, constraints ✅
├── 004: Core API endpoints ✅
└── 005: Idempotency & rate limiting ✅

Phase 2: Guest Booking Flow (In Progress)
├── 006: Date and Unit Selection UI ✅ (YOU ARE HERE)
├── 007: Payment Summary with Preview (NEXT)
├── 008: Payment Proof Upload
├── 009: Form Validation and Submission
└── 010: Booking Confirmation Flow
```

## Key Files Created/Modified

```
okaeri-resort/
├── src/
│   ├── types/
│   │   └── guest-booking-multi-unit.ts        # NEW - TypeScript types
│   ├── components/
│   │   └── guest-booking/                      # NEW - Directory
│   │       ├── __tests__/                      # NEW - Test directory (co-located)
│   │       │   ├── UnitRequestCard.test.tsx    # NEW - Component tests
│   │       │   └── UnitRequestSelector.test.tsx # NEW - Component tests
│   │       ├── UnitRequestCard.tsx             # NEW - Single unit card component
│   │       ├── UnitRequestSelector.tsx         # NEW - Container for unit cards
│   │       └── DateRangePicker.tsx             # NEW - Date selection component
│   └── lib/
│       └── api/
│           └── guest-booking-client.ts         # NEW - API client helpers
```

### File Purposes

**`guest-booking-multi-unit.ts`** (NEW):
- TypeScript interfaces for multi-unit booking
- `UnitRequest` type: `{ guests_per_unit: number }`
- `StandardUnitRates` type: API response shape
- `GuestBookingFormData` type: Complete form schema

**`UnitRequestCard.tsx`** (NEW):
- Displays single unit request card
- Guest count input with capacity validation
- Remove button (when canRemove=true)
- Extra person fee indicator
- Props: index, guestsPerUnit, onGuestsChange, onRemove, maxCapacityPerUnit

**`UnitRequestSelector.tsx`** (NEW):
- Container component managing array of unit cards
- Add/remove unit logic (up to 10 units max)
- Fetches static rates from `/api/guest-booking/rates`
- Displays total units and guests
- Static rate display card
- Props: value (UnitRequest[]), onChange, disabled, maxTotalUnits

**`DateRangePicker.tsx`** (NEW):
- Date range selection component
- Check-in/check-out date inputs
- Validation: no past dates, check-out after check-in
- Displays number of nights
- Integrates with React Hook Form

**`guest-booking-client.ts`** (NEW):
- API client wrapper for `/api/guest-booking/*` endpoints
- `fetchRates()`: GET /rates
- Type-safe request/response handling
- Error handling utilities

## Related Documentation

### Source Documentation
- **CHUNKING-STRATEGY.md lines 206-235**: Chunk 006 specification and scope
- **03-frontend-components.md lines 1-550**: Complete component specifications
  - Lines 46-137: `UnitRequestCard` implementation
  - Lines 381-553: `UnitRequestSelector` implementation
- **09-implementation-decisions.md lines 9-38**: Array-based model rationale
- **README.md lines 54-74**: Array-based data model overview

### Architectural Decisions
- **Array-Based Model** (ADR-002): Why each row = 1 unit, not quantity-based
- **Server-Side Pricing** (ADR-005): Why client displays static rates only
- **Capacity Validation Types** (09-implementation-decisions.md lines 145-197):
  - Guest capacity validation (this chunk)
  - Booking size validation (server-side, not this chunk)
  - Availability validation (NOT DONE - admin handles)

### Integration Points
- **Chunk 004**: Requires `/api/guest-booking/rates` endpoint operational
- **Chunk 007** (next): Will consume form state from this chunk
- **React Hook Form**: Standard pattern for multi-step forms in codebase

## Implementation Notes

### Array-Based UI Pattern

```typescript
// Data structure (matches database model)
const unitRequests: UnitRequest[] = [
  { guests_per_unit: 2 }, // Unit 1
  { guests_per_unit: 3 }, // Unit 2
  { guests_per_unit: 2 }, // Unit 3
];

// Total units = array.length = 3
// Total guests = 2 + 3 + 2 = 7

// UI renders 3 separate UnitRequestCard components
// NOT a single input with "quantity: 3"
```

### Static vs Dynamic Pricing

**Static Rates (This Chunk)**:
```typescript
// Fetch once, display for reference
const rates = await fetch('/api/guest-booking/rates').json();
// {
//   base_rate: 2000,
//   weekend_rate: 2500,
//   extra_person_rate: 300,
//   base_occupancy: 2,
//   max_capacity_per_unit: 10
// }
```

**Dynamic Pricing (Chunk 007 - Next)**:
```typescript
// Preview endpoint calculates actual pricing
const preview = await fetch('/api/guest-booking/preview-pricing', {
  method: 'POST',
  body: JSON.stringify({ check_in, check_out, unit_requests })
}).json();
// {
//   base_total: 12000,
//   weekend_surcharge: 2500,
//   extra_person_fees: 900,
//   discount: { percent: 5, amount: 750 },
//   total: 14650
// }
```

**Key Distinction**: Chunk 006 shows **what the rates are**. Chunk 007 shows **what you'll actually pay**.

### Capacity Validation Flow

```
User enters guest count
    ↓
UnitRequestCard validates locally
    ↓
Is guests_per_unit <= max_capacity_per_unit?
    ↓
YES: Accept input, show extra person fee (if applicable)
NO: Show error, prevent input
    ↓
Total across all units calculated
    ↓
Display total units and total guests
    ↓
NO availability checking (admin assigns later)
```

## Security Considerations

### Input Validation (Client-Side)
- **Guest count**: Min 1, max `max_capacity_per_unit` (from API)
- **Total units**: Max 10 per booking (configurable)
- **Date range**: No past dates, check-out after check-in
- **Form sanitization**: React Hook Form + Zod schema validation

**Note**: Client validation is for UX only. Server validates all inputs in Chunk 009.

### Data Fetching Security
- **Static rates endpoint**: Public (no auth required)
- **CORS**: Configured for allowed origins only
- **Rate limiting**: Applied in Chunk 005 (Turnstile + KV)
- **No sensitive data**: Rates are publicly visible

### XSS Prevention
- **No user input rendering**: This chunk only displays static rates
- **Form inputs sanitized**: React Hook Form prevents script injection
- **API responses validated**: Zod schemas enforce type safety

## Performance Considerations

### Component Rendering
- **Optimized re-renders**: React Hook Form minimizes unnecessary updates
- **Memoization**: Consider `useMemo` for total calculations if > 5 units
- **Lazy loading**: Date picker library may benefit from code splitting

### API Calls
- **Static rates fetched once**: On component mount, cached in state
- **No polling**: Rates don't change frequently
- **Debouncing**: NOT needed for this chunk (no real-time pricing yet)

### Expected Metrics
- **Initial load**: ~200-300ms (including rate fetch)
- **Add unit card**: <50ms (local state update)
- **Guest count change**: <10ms (controlled input)
- **Form validation**: <20ms (Zod schema)

**Acceptable for guest booking flow** - Users expect deliberate interactions, not instant responsiveness.

## Common Questions

**Q: Why not show available units count?**
A: Admin assigns units manually after booking. No availability checking prevents overbooking risk and keeps guest flow simple.

**Q: Why array-based instead of quantity input?**
A: Visual clarity - guests see exactly what they're requesting. Also aligns with database model (one row per unit).

**Q: Why fetch rates separately instead of calculating on-the-fly?**
A: Server-side pricing authority (ADR-005). Client displays static rates for reference; server calculates actual pricing in Chunk 007.

**Q: Can guests request different guest counts per unit?**
A: YES - That's the point of the array model. Unit 1 might have 2 guests, Unit 2 might have 5 guests.

**Q: What if pricing_config changes while guest is filling form?**
A: Static rates are stale, but actual pricing is calculated server-side at submission time. Preview endpoint (Chunk 007) will show correct pricing.

**Q: Why limit to 10 units?**
A: Business constraint (resort has ~10 units total). Prevents abuse and simplifies admin workflow. Configurable via `maxTotalUnits` prop.

---

**Ready to implement?** Proceed to `instructions.md` for step-by-step implementation guide.
