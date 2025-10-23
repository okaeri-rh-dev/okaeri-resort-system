# Implementation Decisions for Multi-Unit Guest Booking

## Overview

Definitive implementation decisions for the multi-unit guest booking system. This document establishes what will and will not be implemented.

## Core Architectural Decisions

### Data Model: Array-Based

**Decision:** Each `guest_booking_unit_requests` row represents 1 unit. NO `quantity` field.

**Rationale:**

- Simpler UX ("Add Unit" button pattern)
- Easier admin review (see each unit visually)
- Aligns with "no unit types" philosophy
- Straightforward database queries

**Implementation:**

```typescript
// Array-based: 3 units
unit_requests: [
  { guests_per_unit: 2 }, // Unit 1
  { guests_per_unit: 3 }, // Unit 2
  { guests_per_unit: 2 }, // Unit 3
];

// Total units = array.length = 3
// Total guests = 2 + 3 + 2 = 7
```

**What We're NOT Doing:**

- ❌ Quantity-based model (`{ quantity: 2, guests_per_unit: 2 }`)
- ❌ Unit type selection
- ❌ Pre-defined unit groupings

### Pricing Authority: Server-Side Only

**Decision:** PostgreSQL `calculate_booking_pricing()` function is the SOLE pricing calculator. No client-side pricing.

**Rationale:**

- Database-side calculation ensures consistency
- Immutable pricing snapshots for historical accuracy
- No client/server synchronization issues
- Single source of truth for compliance

**Implementation:**

- **Server-side ONLY**: All pricing via PostgreSQL function
- API calls PostgreSQL function for every calculation
- Pricing stored in `pricing_snapshot` JSONB column
- Frontend displays static rates only

**What We're NOT Doing:**

- ❌ Client-side pricing calculations
- ❌ TypeScript pricing engine
- ❌ Multiple pricing calculation paths

### Assignment Model: All-or-Nothing

**Decision:** Admin must assign ALL requested units or NONE. Only 2 statuses: `pending` → `assigned`.

**Rationale:**

- Prevents partial fulfillment confusion
- Simplifies guest communication
- Clear booking state
- Database constraint enforcement

**Implementation:**

```sql
ALTER TABLE bookings
ADD CONSTRAINT all_or_nothing_assignment CHECK (
    unit_assignment_status != 'assigned' OR (
        (SELECT COUNT(*) FROM booking_units WHERE booking_id = bookings.booking_id AND status = 'confirmed') =
        (SELECT COUNT(*) FROM guest_booking_unit_requests WHERE booking_id = bookings.booking_id)
    )
);
```

**What We're NOT Doing:**

- ❌ Partial assignments
- ❌ Intermediate statuses (`assigning`, `partial`)
- ❌ Gradual assignment workflow

### Discount System: Engine vs Configuration

**Decision:** PostgreSQL pricing engine supports multiple discount types, but Phase 1 only configures duration discounts. Additional types can be added post-launch via database inserts (no code changes).

**Rationale:**

- Extensible discount engine without schema changes
- Flexible JSONB conditions support any discount type
- Best-of policy (single highest discount, no stacking)
- Can add new discount types via database configuration alone

**Architecture:**

The discount system has two layers:

1. **Engine Layer** (PostgreSQL `calculate_booking_pricing()` function):
   - ✅ Duration discounts (`min_nights`) - fully implemented
   - ✅ Unit-count discounts (`unit_count`) - fully implemented
   - ✅ Date-range discounts (`date_range`) - fully implemented
   - ✅ Advance booking discounts (`advance_booking`) - fully implemented

2. **Configuration Layer** (rows in `discount_rules` table):
   - **Phase 1**: Duration discounts only (7, 14, 21, 28 nights)
   - **Post-Launch**: Admin can add unit-count, seasonal, or advance booking discounts

**Implementation:**

```sql
-- Engine supports all types
CREATE TABLE discount_rules (
    conditions JSONB NOT NULL,
    discount_value DECIMAL(10, 2) NOT NULL,
    priority INTEGER DEFAULT 0
);

-- Phase 1: Only duration discounts configured
INSERT INTO discount_rules (name, conditions, discount_value)
VALUES
  ('7-Night Discount', '[{"type": "min_nights", "value": 7}]'::JSONB, 5.00),
  ('14-Night Discount', '[{"type": "min_nights", "value": 14}]'::JSONB, 10.00);

-- Post-Launch: Admin can add other types (engine already supports them)
-- INSERT INTO discount_rules (name, conditions, discount_value)
-- VALUES ('5+ Units Discount', '[{"type": "unit_count", "value": 5}]'::JSONB, 8.00);
```

**How to Add New Discounts:**
Simply insert rows into `discount_rules` table - no code changes required. The engine evaluates all active rules and applies the best matching discount.

**Best-Of Policy:**
Only the single highest discount applies (no stacking). See ADR-006 for details.

### Capacity Validation: Three Distinct Types

**Decision:** Implement three separate validation checks with different purposes and data sources.

#### 1. Guest Capacity Validation (Physical Limit)

**What:** Validate that `guests_per_unit` doesn't exceed physical capacity
**Data Source:** `pricing_config.max_capacity_per_unit` (centralized configuration)
**Purpose:** Prevent physically impossible requests (e.g., 20 guests in a 10-person unit)

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

#### 2. Booking Size Validation (Business Rule)

**What:** Validate that total requested units doesn't exceed system capacity
**Data Source:** Dynamic `COUNT(units)` query (not a config value)
**Purpose:** Prevent booking requests larger than total units in system

```typescript
const { count: totalUnits } = await supabase
  .from("units")
  .select("*", { count: "exact", head: true })
  .eq("unit_status", "Available");

if (unit_requests.length > totalUnits) {
  throw new Error(`Maximum ${totalUnits} units available in system`);
}
```

#### 3. Availability Validation (NOT DONE)

**What:** Check if enough units are currently unbooked for requested dates
**Decision:** DO NOT implement - Admin handles this during assignment
**Rationale:** Manual assignment model, admin has full flexibility

**Key Distinctions:**

- **Guest Capacity** = Physical limit per unit (from config)
- **Booking Size** = Total units in system (from database count)
- **Availability** = Current booking status (NOT validated)

### Email Notifications: Manual Contact Only

**Decision:** NO email automation initially. Admin contacts guests manually via phone/SMS.

**Rationale:**

- Faster initial launch
- Avoids email deliverability issues
- Personal touch for resort context
- Email integration planned post-launch

**Current Workflow:**

1. Guest submits booking
2. Admin sees notification in queue
3. Admin verifies payment manually
4. Admin assigns units
5. Admin calls/texts guest with confirmation

**What We're NOT Doing:**

- ❌ Automated booking confirmations
- ❌ Unit assignment emails
- ❌ Payment reminders
- ❌ Admin queue notifications

**Future Integration:** Resend or SendGrid planned for Phase 2

### Idempotency: Client-Supplied UUIDs

**Decision:** Client generates UUID with 48-hour expiry window via daily cleanup.

**Rationale:**

- Prevents accidental duplicate bookings
- Network retry safety
- Simple cleanup strategy
- No distributed lock coordination needed

**Implementation:**

```typescript
const idempotencyKey = crypto.randomUUID(); // Client-side

// API checks key before creating booking
const existing = await checkIdempotencyKey(idempotencyKey);
if (existing) return existing; // Return existing booking
```

**Cleanup:**

- Keys expire 48 hours after creation
- Daily cleanup cron at 2:00 AM UTC
- Simple expiry check: `DELETE FROM idempotency_keys WHERE expires_at < NOW()`

**What We're NOT Doing:**

- ❌ Server-side key generation
- ❌ Indefinite key retention
- ❌ Distributed locking
- ❌ Special handling for failed bookings

### Concurrency Control: PostgreSQL EXCLUDE Constraint

**Decision:** Database-level EXCLUDE constraint as primary concurrency mechanism.

**Rationale:**

- Bulletproof at commit time
- No race conditions possible
- Simple implementation
- Automatic enforcement

**Implementation:**

```sql
CREATE EXTENSION btree_gist;

ALTER TABLE booking_units
ADD CONSTRAINT no_double_booking EXCLUDE USING gist (
    unit_id WITH =,
    daterange(check_in_date, check_out_date, '[]') WITH &&
) WHERE (status != 'cancelled');
```

**Secondary Mechanism:** Optimistic locking for admin UI

**What We're NOT Doing:**

- ❌ Application-level locking as primary mechanism
- ❌ Distributed locks
- ❌ Advisory locks

### File Uploads: Signed URLs

**Decision:** Supabase signed URLs for payment proof uploads with two-tier validation strategy.

**File Upload Policy:**

1. **Server Hard Limit:** 5MB maximum enforced by server (files exceeding this are REJECTED)
2. **Client Optimization:** Frontend automatically compresses images to target ~2MB before upload
3. **Compression Strategy:** Progressive JPEG using browser-native Canvas API with quality adjustment
4. **Formats:** JPEG, PNG, PDF only (validated via magic number inspection and MIME type)
5. **Retention:** 90 days post-checkout for completed bookings
6. **Cleanup:** Weekly cron (Sunday 3:00 AM UTC) deletes expired proofs
7. **Storage:** Private Supabase Storage bucket

**Rationale:**

- Two-tier approach: 5MB is security boundary, 2MB is UX optimization
- Client compression reduces bandwidth costs and improves upload speed
- Server validation prevents malicious oversized uploads
- No file handling in Workers (direct-to-storage)

**What We're NOT Doing:**

- ❌ Files stored in database
- ❌ Video uploads
- ❌ Public file access

## Implementation Approach

### Backward Compatibility

**Decision:** Support both single-unit (legacy) and multi-unit formats in API.

**Detection:**

```typescript
const isMultiUnit = Array.isArray(data.unit_requests) && data.unit_requests.length > 1;
```

### Database Constraints

**Decision:** Enforce business rules at database level with CHECK constraints.

**Benefits:**

- Cannot be bypassed by buggy code
- Atomic enforcement
- Clear error messages
- Auditable

**Constraints Implemented:**

- `payment_before_assignment` (database CHECK constraint)
- `all_or_nothing_assignment` (database CHECK constraint)
- `no_double_booking` (database EXCLUDE constraint)
- `guests_per_unit > 0` (database CHECK constraint)
- Maximum capacity validated by API layer against `pricing_config.max_capacity_per_unit`

### Server-Side Pricing Only

PostgreSQL `calculate_booking_pricing()` function is sole pricing authority.

**For complete details see:** ADR-005 in `10-architecture-decisions-record.md`

## Testing Strategy

### Database Testing

- Constraint violation tests
- Concurrency conflict tests
- Transaction rollback tests
- Idempotency duplicate tests

### API Testing

- Multi-unit booking creation
- Idempotency key collision
- Discount application
- Payment verification workflow

### Frontend Testing

- Unit card add/remove
- Pricing preview updates
- Form validation
- Turnstile verification

### Integration Testing

- End-to-end guest booking flow
- Admin assignment workflow
- Payment verification process
- Concurrent booking attempts

## Security Considerations

### Input Validation

- Zod schema validation
- DOMPurify sanitization
- Turnstile CAPTCHA verification
- JWT claim verification (admin)

### File Security

- Private storage bucket
- Signed URLs (5-minute expiry for upload)
- File type validation
- Size limits enforced

### Database Security

- Row Level Security policies
- Service role for sensitive operations
- Parameterized queries
- Audit logging

## Performance Considerations

### Database Optimization

- Indexes on foreign keys
- GiST index for EXCLUDE constraint
- GIN index for JSONB conditions
- Partial indexes for active bookings

### API Optimization

- Supabase connection pooling
- Pricing function immutability (cacheable)
- Signed URL pre-generation
- Rate limiting on public endpoints

### Frontend Optimization

- Debounced pricing preview
- Optimistic UI updates
- Component code splitting
- Service worker caching

## Monitoring & Alerts

### Key Metrics

- Pending queue length
- Average assignment time
- Idempotency key collisions
- Payment verification time
- Discount application rate

### Alert Thresholds

- Pending queue > 10 bookings
- Assignment time > 24 hours
- Payment unverified > 48 hours
- Constraint violations

## Documentation Standards

**Decision:** All documentation cleaned of version history and bloat.

**Principles:**

- Single source of truth per topic
- No "Last Updated" timestamps
- No change logs in docs
- Clean, authoritative content
- Remove superseded information

## Future Considerations

### Post-Launch Features

- Email notification integration
- Automated unit assignment
- Real-time availability calendar
- Advanced discount rules (unit-count, guest loyalty)
- Multi-currency support
- Seasonal rate automation

### Technical Debt

- None accepted for MVP
- All shortcuts documented
- Upgrade paths planned

## Decision Authority

These decisions are final for Phase 1 implementation. Changes require:

1. Technical justification
2. Impact assessment
3. Documentation update
4. Stakeholder approval
