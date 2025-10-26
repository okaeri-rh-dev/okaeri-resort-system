# Chunk 002: PostgreSQL Pricing Engine

## At a Glance

| Property | Value |
|----------|-------|
| **Chunk Number** | 002 |
| **Chunk Name** | postgresql-pricing-engine |
| **Phase** | Phase 1: Database & Backend Core |
| **Estimated Time** | 120 minutes |
| **Milestone** | Pricing calculation authority established |
| **Can Skip?** | ❌ No - Required for API endpoints (Chunk 004) |
| **Prerequisites** | Chunk 001 completed (placeholder pricing function created) |

## What You're Building

This chunk **replaces the placeholder** `calculate_booking_pricing()` PostgreSQL function with the **complete authoritative pricing calculator** and validates it through comprehensive testing. The function serves as the **SOLE pricing authority** for the entire system. You'll:

### Pricing Function Capabilities (Implemented in This Chunk)

The `calculate_booking_pricing()` function is the **single source of truth** for all pricing calculations. The full implementation supports:

1. **Base Rate Calculation** - Per unit per night pricing from `pricing_config`
2. **Weekend Surcharge** - Friday-Saturday premium rates (configurable)
3. **Extra Person Fees** - Charges beyond base occupancy (e.g., 2 guests included, ₱500/night for each extra)
4. **Multi-Unit Support** - Accurate pricing for 1-10 units in a single booking
5. **Discount Engine** - Best-of policy across 4 discount types:
   - **Duration Discounts** (`min_nights`) - e.g., 10% off for 14+ nights
   - **Date Range Discounts** (`date_range`) - e.g., 15% off for bookings in Dec 20 - Jan 5
   - **Advance Booking Discounts** (`advance_booking`) - e.g., 5% off when booking 30+ days ahead
   - **Unit Count Discounts** (`unit_count`) - e.g., 8% off for 5+ units

### What You'll Do in This Chunk

This chunk replaces Chunk 001's minimal placeholder with the complete implementation, then validates it:

✅ **Replace placeholder function** with full implementation (discount engine, weekend logic, extra person fees)
✅ **Testing single-unit pricing** (base rate, weekend, extra person)
✅ **Testing multi-unit pricing** (2-10 units with varying guest counts)
✅ **Testing all 4 discount types** (duration, date-range, advance-booking, unit-count)
✅ **Verifying best-of discount policy** (highest discount wins, no stacking)
✅ **Testing edge cases** (same-day checkout, max capacity, 0 weekends)
✅ **Creating test documentation** for future regression testing

### Pricing Calculation Flow

```
Input: unit_requests, check_in_date, check_out_date
  ↓
1. Fetch pricing_config (single source of truth)
  ↓
2. Calculate nights and weekend nights (Fri-Sat)
  ↓
3. Calculate base total (units × base_rate × nights)
  ↓
4. Calculate weekend surcharge (units × (weekend_rate - base_rate) × weekend_nights)
  ↓
5. Calculate extra person fees (extra_persons × extra_person_rate × nights)
  ↓
6. Subtotal = base_total + weekend_surcharge + extra_person_fees
  ↓
7. Evaluate ALL active discount rules → Select BEST matching discount
  ↓
8. Apply discount to subtotal
  ↓
9. Calculate downpayment (total × downpayment_percent)
  ↓
Output: JSONB with complete pricing breakdown
```

## Why This Matters

### Business Value

- **Prevents pricing errors** - Server-side calculation eliminates client/server sync bugs
- **Supports auditing** - Immutable pricing snapshots stored in `pricing_snapshot` JSONB column
- **Enables compliance** - Historical pricing data preserved for legal/tax requirements
- **Flexible discounts** - Can add new discount types post-launch without code changes (just database inserts)
- **Performance optimization** - PostgreSQL function is faster than API round-trips for pricing

### Technical Value

- **Single source of truth** - No duplicate pricing logic in client/server
- **Atomic calculations** - All pricing components calculated in one function call
- **Type safety** - JSONB output provides structured, queryable results
- **Immutable snapshots** - Pricing captured at booking creation, never recalculated
- **Extensible architecture** - JSONB conditions support any future discount type

### Architectural Principles Enforced

This chunk validates the **core architectural decision** from `09-implementation-decisions.md`:

✅ **Server-Side Pricing Authority** (lines 40-63)
- PostgreSQL function is SOLE pricing calculator
- Client NEVER calculates pricing
- Client only displays server-calculated results
- Preview endpoint required for real-time display

✅ **Centralized Configuration** (lines 147-167)
- All pricing from `pricing_config` table
- No hardcoded rates in application code
- Admin can update rates without deployment

✅ **Best-Of Discount Policy** (lines 94-143)
- Single highest discount applies (no stacking)
- Evaluation order: discount_value DESC, priority ASC
- Supports all 4 discount condition types

## Before You Start

### Prerequisites Checklist

Verify you have completed:

- [ ] **Chunk 001 completed** - All tables and functions created
- [ ] `pricing_config` table has 1 row with default configuration
- [ ] `discount_rules` table has 4 duration-based discount rules
- [ ] `calculate_booking_pricing()` function exists in database
- [ ] You have database access (Supabase SQL Editor or psql)
- [ ] You have read `docs/implementation/guest-booking-multi-unit/01-database-schema.md` (lines 135-373)

### Knowledge Requirements

You should understand:

- PostgreSQL function execution (SELECT function_name(params))
- JSONB data type and JSON path queries (`->`, `->>`)
- Date arithmetic in SQL (DATE + INTEGER)
- Discount percentage calculations
- Weekend identification (Friday = 5, Saturday = 6 in EXTRACT(DOW))

### Tools Required

- Supabase SQL Editor (web-based) OR
- `psql` command-line client OR
- Database GUI tool (TablePlus, pgAdmin, DBeaver)
- Calculator or spreadsheet for manual verification (optional)

### Time Commitment

- **Preparation**: 10 minutes (verify Chunk 001 completion)
- **Single-unit tests**: 20 minutes (base rates, weekend, extra person)
- **Multi-unit tests**: 20 minutes (2-10 units with varying guests)
- **Discount tests**: 30 minutes (all 4 discount types)
- **Edge case tests**: 20 minutes (boundary conditions)
- **Documentation**: 20 minutes (record test results)

**Total**: ~120 minutes for comprehensive testing and validation

## What Happens Next

### Immediate Outcomes

After completing this chunk:

✅ Pricing function tested with 15+ scenarios
✅ All 4 discount types verified (duration, date-range, advance-booking, unit-count)
✅ Weekend rate calculations confirmed accurate
✅ Extra person fees validated
✅ Best-of discount policy proven (no stacking)
✅ Edge cases documented
✅ Test suite created for regression testing

### What You Can Do

- ✅ Call `calculate_booking_pricing()` from SQL with confidence
- ✅ Understand pricing breakdown for any booking scenario
- ✅ Explain pricing logic to stakeholders
- ✅ Debug pricing discrepancies (if any)
- ✅ Create new discount rules and test them

### What You Cannot Do Yet

- ❌ Accept guest bookings via API (Chunk 004 - API endpoints)
- ❌ Display pricing preview in frontend (Chunk 007 - Payment summary)
- ❌ Create bookings with automated pricing (Chunk 009 - Form submission)

### Next Chunk

**Chunk 003: Security, RLS, and Constraints** - Implements database-level security enforcement including:
- All-or-nothing assignment constraint
- Payment-before-assignment constraint
- Concurrency control (PostgreSQL EXCLUDE constraint for double-booking prevention)
- Row Level Security policies for multi-tenant isolation

**Dependencies for Chunk 003**: Requires tables from Chunk 001. Independent of Chunk 002 (can be done in parallel if needed).

## Key Files Created/Modified

```
database/
└── migrations/
    └── 021-multi-unit-guest-booking-schema.sql   [TESTED - from Chunk 001]
        └── calculate_booking_pricing() function   [VALIDATED IN THIS CHUNK]

docs/
└── implementation/
    └── guest-booking-multi-unit/
        └── chunks/
            └── 002-postgresql-pricing-engine/
                ├── README.md                      [THIS FILE]
                ├── instructions.md                [TEST PROCEDURES]
                ├── checkpoint.md                  [VERIFICATION CHECKLIST]
                └── troubleshooting.md             [COMMON ISSUES]

__tests__/
└── database/
    └── pricing-engine.test.sql   [NEW - will create test suite]
        └── 15+ test scenarios for regression testing
```

## Related Documentation

### Source Documentation

- **Primary**: `docs/implementation/guest-booking-multi-unit/01-database-schema.md` (lines 135-600)
  - Complete `calculate_booking_pricing()` function implementation (lines 240-373)
  - Discount rule evaluation logic (lines 308-338)
  - Pricing component calculations (lines 292-306)
  - JSONB result structure (lines 345-368)
  - Table definitions and indexes (lines 135-184)

- **Secondary**: `docs/implementation/guest-booking-multi-unit/05-simplified-pricing-engine.md`
  - Status: DEPRECATED (client-side pricing rejected)
  - Explains why server-side ONLY approach was chosen
  - Reference ADR-005 for architectural decision

- **Architecture**: `docs/implementation/guest-booking-multi-unit/09-implementation-decisions.md` (lines 40-143)
  - Server-side pricing authority decision (lines 40-63)
  - Discount system architecture (lines 94-143)
  - Best-of policy rationale (lines 100-143)

### Codebase Patterns

- **Database testing**: `CLAUDE.md` (Testing Strategy section)
  - Unit tests for utilities and hooks
  - Integration tests for database operations
  - Performance tests for availability calculations

- **Type safety**: `src/types/database.types.ts`
  - Generated types from Supabase
  - Will include JSONB pricing result types

## Success Criteria

This chunk is complete when:

- [ ] `calculate_booking_pricing()` function executes without errors
- [ ] Single-unit pricing returns correct base_total
- [ ] Multi-unit pricing (5 units) returns correct total
- [ ] Weekend nights counted correctly (Friday-Saturday)
- [ ] Weekend surcharge calculated accurately
- [ ] Extra person fees applied correctly (beyond base_occupancy)
- [ ] Duration discount (14 nights) applies 10% discount
- [ ] Date range discount applies for check-in within range
- [ ] Advance booking discount applies for 30+ days lead time
- [ ] Unit count discount applies for 5+ units
- [ ] Best-of policy verified (only highest discount applied)
- [ ] Downpayment calculated as 50% of total
- [ ] JSONB result structure matches expected schema
- [ ] All checkpoint tests pass (see `checkpoint.md`)
- [ ] Test suite documented for future regression testing

## Quick Start

Ready to begin? Follow these steps:

1. **Read this README completely** (you are here)
2. **Open `instructions.md`** - Follow step-by-step test procedures
3. **Execute test queries** - Verify pricing function behavior
4. **Run checkpoints** - Validate all scenarios (`checkpoint.md`)
5. **Troubleshoot if needed** - Common issues and solutions (`troubleshooting.md`)
6. **Document results** - Record test cases for regression testing
7. **Commit changes** - `git commit -m "feat: complete chunk 002-postgresql-pricing-engine"`
8. **Move to Chunk 003** - Security, RLS, and Constraints

---

**Ready?** Open `instructions.md` to begin testing.
