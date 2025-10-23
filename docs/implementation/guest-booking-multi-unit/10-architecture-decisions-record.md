# Architecture Decisions Record (ADR)

## Overview

Key architectural decisions for the multi-unit guest booking system, including context, rationale, consequences, and alternatives.

**Format**: Decision → Context → Rationale → Alternatives → Consequences

---

## ADR-001: Three-Tier Validation Strategy

**Status**: Accepted

### Decision

Implement three separate, distinct validation checks: (1) Guest capacity per unit, (2) Booking size vs system capacity, (3) NO availability checking.

### Context

When a guest submits a multi-unit booking request, three validation questions arise:

1. **Guest Capacity**: Can the requested guest count physically fit in a unit?
2. **Booking Size**: Is the booking requesting more units than exist in the system?
3. **Availability**: Are enough units currently unbooked for the requested dates?

These are three distinct concerns that are often conflated.

### Rationale

**Validation 1: Guest Capacity (Physical Limit)**

- **Data Source**: `pricing_config.max_capacity_per_unit`
- **Why**: Prevents physically impossible requests (20 guests in 10-person unit)
- **Implementation**: Single source of truth, simple lookup
- **Example**: If `max_capacity_per_unit = 10`, reject `guests_per_unit = 15`

```typescript
const { data: config } = await supabase
  .from("pricing_config")
  .select("max_capacity_per_unit")
  .eq("id", "default")
  .single();

for (const request of unit_requests) {
  if (request.guests_per_unit > config.max_capacity_per_unit) {
    throw new Error(`Maximum ${config.max_capacity_per_unit} guests per unit`);
  }
}
```

**Validation 2: Booking Size (System Capacity)**

- **Data Source**: Dynamic `COUNT(units)` where `status='Available'`
- **Why**: Prevents requesting more units than exist in system
- **Implementation**: Real-time database count (not a config value)
- **Example**: If system has 15 units, reject request for 20 units

```typescript
const { count: totalUnits } = await supabase
  .from("units")
  .select("*", { count: "exact", head: true })
  .eq("unit_status", "Available");

if (unit_requests.length > totalUnits) {
  throw new Error(`Maximum ${totalUnits} units available in system`);
}
```

**Validation 3: Availability (NOT IMPLEMENTED)**

- **Decision**: DO NOT validate whether units are currently booked
- **Why**: Manual assignment model - admin handles availability during assignment
- **Benefit**: Admin flexibility to optimize, upgrade, handle special cases

**Key Distinctions:**

- **Guest Capacity** = Physical limit per unit (from static config)
- **Booking Size** = Total units in system (from dynamic count)
- **Availability** = Current booking status (NOT validated)

### Alternatives Considered

**Option A: Single Static Config Value for Both (Rejected)**

- **Approach**: Use `max_units_per_booking` in `pricing_config` for both capacity and size limits
- **Pros**: Simplest - one config value
- **Cons**: Doesn't reflect reality (system might have 15 units but config says 10)
- **Rejected**: Static config doesn't adapt to actual system state

**Option B: Full Availability Checking (Rejected)**

- **Approach**: Check unbooked units for requested dates
- **Pros**: Prevents all unfulfillable bookings
- **Cons**: Complex caching, race conditions, performance overhead, reduces admin flexibility
- **Rejected**: Over-engineered for manual assignment model

### Consequences

**Positive:**

- ✅ Clear separation of concerns (physical capacity vs system size vs availability)
- ✅ Dynamic booking size limit adapts to actual system state
- ✅ Simple implementation (one config lookup + one count query)
- ✅ Good user experience (immediate feedback on impossible requests)
- ✅ Admin retains full assignment control
- ✅ No race conditions or caching complexity

**Negative:**

- ❌ Guest might request 5 units when only 3 are currently available (admin handles this)
- ❌ Admin must contact guest if availability insufficient
- ❌ Two database queries instead of one (config + count)

**Mitigations:**

- Clear messaging: "Request pending admin assignment based on availability"
- Fast admin response: <4 hour SLO
- Manual contact: Phone/SMS for urgent cases
- Count query is fast (indexed, single table)

### Implementation Example

```typescript
// Validation 1: Guest capacity per unit
const { data: config } = await supabase
  .from("pricing_config")
  .select("max_capacity_per_unit")
  .eq("id", "default")
  .single();

for (const request of unit_requests) {
  if (request.guests_per_unit > config.max_capacity_per_unit) {
    return {
      error: `Maximum ${config.max_capacity_per_unit} guests per unit`,
    };
  }
}

// Validation 2: Booking size vs system capacity
const { count: totalUnits } = await supabase
  .from("units")
  .select("*", { count: "exact", head: true })
  .eq("unit_status", "Available");

if (unit_requests.length > totalUnits) {
  return {
    error: `Maximum ${totalUnits} units available in system`,
  };
}
```

### Status

**Active**: Three-tier validation balances UX (prevents impossible requests) with simplicity (minimal queries).

**Review Trigger**: If capacity restriction complaints exceed 3/month, reconsider validation approach.

---

## ADR-002: Manual Admin Assignment Only

**Status**: Accepted

### Decision

All unit assignments performed manually by administrators. No auto-assignment algorithms.

### Context

After guest creates booking, specific units must be assigned. Options include auto-assignment, AI optimization, or manual selection.

### Rationale

**Why manual assignment:**

1. **Business Flexibility**: Admin upgrades guests, handles special requests, optimizes revenue
2. **Simple Implementation**: No complex assignment algorithms
3. **Better Guest Service**: Personalized selection based on history/preferences
4. **Edge Case Handling**: Admin handles unusual situations easily
5. **Trust**: Family-run business values personal touch

**Admin Workflow:**

1. View pending booking queue (sorted by urgency)
2. Review guest requirements
3. Check available units
4. Select appropriate units
5. Assign all units in single transaction

### Alternatives Considered

**Option A: Auto-Assignment with Override**

- **Pros**: Faster for simple cases, reduces workload
- **Cons**: Algorithm might make poor choices, admin verifies anyway
- **Rejected**: Adds complexity without time savings

**Option B: ML-Based Optimization**

- **Pros**: Maximizes occupancy, revenue optimization
- **Cons**: Requires training data, complex maintenance, black box decisions
- **Rejected**: Over-engineered for <50 unit resort

**Option C: Suggested Units Only**

- **Pros**: Guides admin, speeds selection
- **Cons**: Still requires algorithm, admin might ignore suggestions
- **Deferred**: Could add later if needed

### Consequences

**Positive:**

- ✅ Simple, maintainable code
- ✅ Admin full control
- ✅ Handles special requests easily
- ✅ Personal service for guests

**Negative:**

- ❌ Requires admin time per booking
- ❌ Potential bottleneck if volume increases
- ❌ Assignment delays if admin unavailable

**Mitigations:**

- Urgency scoring prioritizes critical bookings
- Mobile-friendly admin interface
- SLO: < 4 hours normal, < 1 hour urgent

### Status

**Active**: Works well for current volume (< 20 bookings/day).

**Review Trigger**: If volume exceeds 50/day or assignment time consistently exceeds SLOs, consider auto-assignment.

---

## ADR-003: Payment Verification Before Assignment

**Status**: Accepted

### Decision

Units CANNOT be assigned until payment proof verified by admin. Enforced at database level with CHECK constraint.

### Context

Should unit assignment happen before or after payment verification?

### Rationale

**Why payment-first:**

1. **Risk Reduction**: Prevents allocating inventory without financial commitment
2. **Clear Workflow**: Simple, linear process (Payment → Verify → Assign)
3. **Reduced Cancellations**: Guests less likely to abandon after payment
4. **Admin Efficiency**: No unit release if payment fails
5. **Business Protection**: Units don't sit blocked for non-paying guests

**Workflow:**

```
Guest creates booking → uploads payment proof → Admin verifies payment → Admin assigns units
```

### Alternatives Considered

**Option A: Assign Before Payment**

- **Pros**: Faster guest confirmation, better UX
- **Cons**: Units blocked without payment, recovery complexity
- **Rejected**: Too risky for small business cash flow

**Option B: Admin Discretion (Case-by-Case)**

- **Pros**: Flexibility for VIP guests
- **Cons**: Inconsistent policy, potential errors
- **Rejected**: Adds confusion, harder to enforce

**Option C: Conditional Assignment**

- **Pros**: Guest gets confirmation, units soft-held
- **Cons**: Complex state machine, cleanup logic
- **Rejected**: Over-complicated

### Consequences

**Positive:**

- ✅ Clear, enforceable policy
- ✅ Reduced financial risk
- ✅ Database constraint prevents violations
- ✅ Simple admin workflow

**Negative:**

- ❌ Longer confirmation time for guests
- ❌ No "instant booking" experience
- ❌ Requires admin availability to verify payments

**Mitigations:**

- Clear messaging: "Awaiting payment verification"
- Fast verification SLO: < 2 hours during business hours
- Manual override: Use authenticated booking for urgent VIP cases

### Database Enforcement

```sql
ALTER TABLE bookings
ADD CONSTRAINT payment_before_assignment CHECK (
  unit_assignment_status != 'assigned' OR
  payment_status IN ('Verified', 'Completed')
);
```

### Status

**Active**: Policy enforced at database level.

**No Overrides**: If urgent confirmation needed without payment, use authenticated admin booking flow instead.

---

## ADR-004: Client-Supplied Idempotency Keys

**Status**: Accepted

### Decision

Require client to generate and supply UUID idempotency keys to prevent duplicate bookings from network retries.

### Context

Network retries, double-clicks, and browser refreshes can create duplicate bookings.

### Rationale

**Why client-supplied:**

1. **Standard Practice**: Industry best practice for payment/booking APIs
2. **Guaranteed Uniqueness**: Client controls key generation
3. **Better UX**: Shows "duplicate detected" immediately
4. **Simpler Server Logic**: No need to hash/derive keys
5. **Offline Support**: Client generates UUID offline before submission

**Implementation:**

- Client generates UUID: `crypto.randomUUID()`
- Optional field (server generates if missing for backward compatibility)
- Stored in `idempotency_keys` table with 48-hour expiry
- Returns existing booking if duplicate key detected

### Alternatives Considered

**Option A: Server-Side Hash Derivation**

- **Pros**: Client doesn't need to generate keys
- **Cons**: Hash collisions possible, harder to debug
- **Rejected**: Less reliable than explicit UUID

**Option B: No Idempotency Protection**

- **Pros**: Simpler implementation
- **Cons**: Duplicate bookings possible, poor UX
- **Rejected**: Creates real problems for users

**Option C: Database Unique Constraint Only**

- **Pros**: Database enforces uniqueness
- **Cons**: Which fields to constrain? Guest+dates allows legitimate duplicates
- **Rejected**: Doesn't solve retry problem

### Consequences

**Positive:**

- ✅ Prevents duplicate bookings reliably
- ✅ Industry-standard approach
- ✅ Simple client implementation
- ✅ Works with retries, offline, mobile

**Negative:**

- ❌ Requires client code changes
- ❌ Extra database table/queries
- ❌ Need cleanup job for expired keys

**Mitigations:**

- Optional field (backward compatible)
- Server generates UUID if missing
- Daily cleanup job deletes expired keys (> 24h old)
- Index on expiry timestamp for efficient cleanup

### Database Schema

```sql
CREATE TABLE idempotency_keys (
  key UUID PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '48 hours')
);

CREATE INDEX idx_idempotency_expiry ON idempotency_keys(expires_at);
```

### Status

**Active**: Implemented in API, optional for backward compatibility.

**Expiry**: 48 hours (balances safety vs. storage costs).

---

## ADR-005: Simplified Pricing (No Unit Types to Guests)

**Status**: Accepted

### Decision

Guests do NOT see unit types during booking. They select:

- Number of units needed
- Number of guests per unit

Admin assigns specific unit types after booking.

### Context

Original design showed unit types (Standard, Deluxe, Suite, Villa) with different pricing. Revised design eliminates unit types from guest view.

### Rationale

**Why simplified:**

1. **Reduced Cognitive Load**: Guests don't need to understand unit differences
2. **Faster Booking**: Fewer decisions = faster checkout
3. **Admin Flexibility**: Can upgrade guests or optimize unit allocation
4. **Simpler Pricing**: Single rate, no complex type-specific calculations
5. **Better Mobile UX**: Less form complexity on small screens

**How it works:**

- Guest enters: "2 units, 3 guests per unit"
- System shows: Total price based on fixed rates
- Admin assigns: Specific unit types after booking

### Alternatives Considered

**Option A: Show Unit Types to Guests**

- **Pros**: Guest controls specific accommodations
- **Cons**: Complex pricing, slower booking, reduces admin flexibility
- **Rejected**: Original design

**Option B: Capacity Bands (2-person, 4-person, 6-person)**

- **Pros**: Some guest control without full type complexity
- **Cons**: Adds decision points, pricing permutations
- **Rejected**: Halfway solution adds complexity

**Option C: "Standard Booking" + "Specify Type" Toggle**

- **Pros**: Both options available
- **Cons**: Two booking flows to maintain
- **Rejected**: Confusing UX

### Consequences

**Positive:**

- ✅ Simpler guest experience
- ✅ Faster booking completion
- ✅ Admin optimizes unit allocation
- ✅ Easier pricing (single rate)
- ✅ Better mobile UX

**Negative:**

- ❌ Guests don't know exact unit type upfront
- ❌ No unit-specific features marketed
- ❌ Potential disappointment if upgraded expectations

**Mitigations:**

- Clear messaging: "Manager will assign specific units"
- All units similar quality (small resort)
- Admin upgrades based on availability (positive surprise)

### Current State

**Fixed Rates** (all units):

- Base rate: Fetched from `pricing_config` table
- Weekend rate: Friday/Saturday premium from `pricing_config`
- Extra person fee: Beyond base occupancy from `pricing_config`

**Pricing calculated by**: PostgreSQL `calculate_booking_pricing()` function

### Status

**Active**: Documented as core design decision.

**No Changes Planned**: This simplification is fundamental to design philosophy.

---

## ADR-006: Best-Of Discount Policy (No Stacking)

**Status**: Accepted

### Decision

Only the **single highest** discount applies to any booking. No stacking multiple discounts.

### Context

Discount system supports flexible conditions (duration-based, date-range, advance booking). Should multiple discounts stack or apply best-of?

### Rationale

**Why best-of:**

1. **Predictable Pricing**: Guest knows maximum discount upfront
2. **Simpler Calculations**: No complex stacking rules
3. **Prevents Over-Discounting**: Business protects profit margins
4. **Easier Admin**: No need to configure discount combinations
5. **Clear Messaging**: "Best available discount applied automatically"

**How it works:**

```typescript
// All applicable discounts evaluated
const applicableDiscounts = discounts.filter((d) => conditionsMet(d));

// Highest priority discount wins
const bestDiscount = applicableDiscounts.sort((a, b) => b.priority - a.priority)[0];
```

### Alternatives Considered

**Option A: Stack All Discounts**

- **Pros**: Maximum savings for guests
- **Cons**: Complex math, potential 100%+ discounts, margin erosion
- **Rejected**: Too risky for business

**Option B: Stacking with Caps**

- **Pros**: Limited stacking (e.g., max 25% total)
- **Cons**: Complex rules, hard to communicate
- **Rejected**: Adds unnecessary complexity

**Option C: Category-Based Stacking**

- **Pros**: One discount per category (e.g., duration + seasonal)
- **Cons**: Need to define categories, still complex
- **Deferred**: Could add later if needed

### Consequences

**Positive:**

- ✅ Simple, predictable pricing
- ✅ Easy for guests to understand
- ✅ Protects business margins
- ✅ Fast calculation

**Negative:**

- ❌ Guests miss out on "stacking" deals
- ❌ Less competitive vs. hotels with complex promotions
- ❌ Marketing can't offer "double discounts"

**Mitigations:**

- Clear messaging: "Best available discount automatically applied"
- High-value single discounts (up to 20% for 28+ days)
- Transparent pricing breakdown shows applied discount

### Priority System

**Primary Sort**: Discount value (highest wins)
**Secondary Tiebreaker**: Priority number (lowest number = highest priority, 0 = highest)
**Final Tiebreaker**: Creation date (oldest wins if both value and priority equal)

**SQL Implementation:**

```sql
ORDER BY discount_value DESC, priority ASC, created_at ASC
LIMIT 1
```

**Examples:**

1. **Most Common Case** (90%+ of scenarios):
   - Summer promotion (10% off, priority 5)
   - 14-day duration discount (15% off, priority 2)
   - **Result**: 14-day discount wins (15% > 10%, priority ignored)
   - **Note**: Second and third tiebreakers never evaluated

2. **Priority Tiebreaker** (rare, <5% of cases):
   - Summer promotion (10% off, priority 5, created 2025-01-15)
   - 14-day duration discount (10% off, priority 2, created 2025-01-10)
   - **Result**: 14-day duration discount wins (values equal, priority 2 < 5, lower number = higher priority)
   - **Note**: Third tiebreaker never evaluated

3. **Creation Date Tiebreaker** (very rare, <1% of cases):
   - Summer promotion (10% off, priority 2, created 2025-01-15)
   - Holiday special (10% off, priority 2, created 2025-01-10)
   - **Result**: Holiday special wins (value and priority equal, older rule wins)

**Implementation Notes:**

The three-level tiebreaker system provides complete deterministic behavior but secondary/tertiary levels rarely trigger in practice.

**Monitoring Recommendation**: Track how often tiebreakers are used. If after 3 months of operation the priority and creation date tiebreakers have not triggered (query `discount_rules` for equal `discount_value`), consider simplifying to value-only sorting.

### Status

**Active**: Implemented in `calculate_booking_pricing()` database function.

**Review**: Monitor guest feedback. If "stacking" requests exceed 10%, reconsider.

---

## ADR-007: Two Assignment Statuses Only

**Status**: Accepted

### Decision

Only 2 assignment statuses exist: `pending` and `assigned`. No intermediate statuses.

### Context

Should the system support intermediate assignment statuses like `assigning`, `partial`, or `reviewing`?

### Rationale

**Why 2 statuses only:**

1. **Simplicity**: Clear state machine (pending → assigned)
2. **All-or-Nothing Enforcement**: No partial assignment confusion
3. **Clear Guest Communication**: Either "waiting" or "confirmed"
4. **Database Constraints**: Easy to enforce with CHECK constraints
5. **Reduced Complexity**: No need to handle intermediate state transitions

**Status Flow:**

```
pending → assigned (when ALL units assigned)
```

**What we DON'T allow:**

- ❌ `assigning` status
- ❌ `partial` status
- ❌ `reviewing` status

### Alternatives Considered

**Option A: Intermediate `assigning` Status**

- **Pros**: Shows admin is working on it
- **Cons**: Adds state complexity, no clear benefit
- **Rejected**: Unnecessary complexity

**Option B: `partial` Status for Partial Assignments**

- **Pros**: Allows gradual assignment
- **Cons**: Violates all-or-nothing rule, confusing for guests
- **Rejected**: Conflicts with ADR-002

**Option C: Multiple Sub-Statuses**

- **Pros**: Fine-grained status tracking
- **Cons**: Complex state machine, maintenance burden
- **Rejected**: Over-engineered

### Consequences

**Positive:**

- ✅ Simple state machine
- ✅ Clear guest messaging
- ✅ Easy database constraints
- ✅ All-or-nothing enforcement

**Negative:**

- ❌ No visibility into "admin working on it" state
- ❌ Can't show partial progress

**Mitigations:**

- Urgency scoring shows admin which bookings need attention
- SLO: < 4 hours for assignment
- Manual contact for urgent cases

### Database Enforcement

```sql
ALTER TABLE bookings
ADD COLUMN unit_assignment_status TEXT DEFAULT 'pending'
  CHECK (unit_assignment_status IN ('pending', 'assigned'));
```

### Status

**Active**: Enforced at database level.

**No Changes Planned**: 2-status model is core design principle.

---

## Summary Matrix

| ADR | Decision                                 | Status | Review Trigger (Quantified)                                                                                    |
| --- | ---------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| 001 | Capacity Validation (Centralized Config) | Active | Capacity restriction complaints >3/month                                                                       |
| 002 | Manual Admin Assignment                  | Active | Booking volume >50/day OR avg assignment time >8 hours for 3 consecutive days                                  |
| 003 | Payment Before Assignment                | Active | No review planned                                                                                              |
| 004 | Client Idempotency Keys                  | Active | No review planned                                                                                              |
| 005 | No Unit Types to Guests                  | Active | No changes planned                                                                                             |
| 006 | Best-Of Discount Policy                  | Active | Guest feedback requests stacking in >10% of bookings/month OR support tickets about discount stacking >5/month |
| 007 | Two Assignment Statuses Only             | Active | No changes planned                                                                                             |

---

## Usage

Consult this ADR document when:

- Implementing related features
- Reviewing architecture
- Responding to feedback requesting alternatives
- Training new team members
- Explaining design decisions to stakeholders
