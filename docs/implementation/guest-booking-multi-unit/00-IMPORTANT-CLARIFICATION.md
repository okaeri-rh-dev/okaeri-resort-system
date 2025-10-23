# IMPORTANT: Simplified Multi-Unit Booking Approach

## Critical Design Decision

**Unit types (Standard, Deluxe, Suite, Villa) are NOT exposed to guest users.**

## What This Means

### For Guests

- Select **NUMBER of units** needed (e.g., "3 units")
- Specify **guests per unit** (e.g., "2 guests per unit")
- NO unit type selection
- NO differentiated pricing per unit type
- Simple, uniform pricing display

### For Admins

- View guest requirements (e.g., "3 units, 2 guests each")
- Manually assign appropriate units based on availability, guest count, business logic
- Full flexibility for upgrades and preferences

## Data Structure

### Array-Based Model

Each array entry represents 1 unit. NO `quantity` field exists.

```typescript
interface GuestUnitRequest {
  guests_per_unit: number; // Guests per unit
  // NO quantity field
  // NO unit_type field
}

// Example: For 3 units with 2 guests each
// Insert 3 rows: [{guests_per_unit: 2}, {guests_per_unit: 2}, {guests_per_unit: 2}]
```

### Database Schema

```sql
CREATE TABLE guest_booking_unit_requests (
    id UUID PRIMARY KEY,
    booking_id UUID REFERENCES bookings(booking_id),
    guests_per_unit INTEGER NOT NULL CHECK (guests_per_unit > 0),
    -- NO quantity column
    -- NO unit_type column
);

-- Note: Maximum capacity validated by API layer against pricing_config.max_capacity_per_unit
-- Database only enforces minimum (> 0) for simplicity and performance

ALTER TABLE bookings ADD COLUMN pricing_snapshot JSONB;  -- Immutable pricing record
```

## Booking Flow

1. **Guest selects dates**
2. **Guest specifies units and guests**
   - "I need 3 units"
   - "2 guests per unit"
3. **System calculates pricing**
   - PostgreSQL `calculate_booking_pricing()` function is authoritative
   - Base rate × units × nights + weekend surcharge + extra person fees
   - Applies best available discount (duration, date-range, or advance booking)
4. **Guest uploads payment proof**
5. **Admin verifies payment**
6. **Admin assigns specific units**

## Pricing Authority

**PostgreSQL `calculate_booking_pricing()` function is the SOLE source of truth.**

- **Server-side ONLY**: All pricing calculated by PostgreSQL function
- No client-side pricing calculations
- Backend API calls PostgreSQL function for all calculations
- Pricing snapshot stored immutably in JSONB column

## Pricing Structure

### Fixed Rates

- Base rate: Fetched from `pricing_config` table (single source of truth)
- Weekend rate: Friday/Saturday premium from `pricing_config`
- Extra person fee: Beyond base occupancy from `pricing_config`

### Discount System (Flexible Conditions)

Discounts defined in `discount_rules` table with JSONB `conditions` field:

**Supported Discount Types:**

- **Duration** (`min_nights`): 7+ days = 5%, 14+ = 10%, 21+ = 15%, 28+ = 20%
- **Date Range** (`date_range`): Seasonal promotions (e.g., Easter, Christmas)
- **Advance Booking** (`advance_booking`): Early bird incentives

**Explicitly Excluded:**

- ❌ Unit-count discounts (quantity-based)

**Policy:** Best-of (single highest discount, no stacking)

## Key Business Rules

### Capacity Validation

**Single Source of Truth:** `pricing_config.max_capacity_per_unit`

All units have identical guest capacity defined by this configuration value. Per-unit capacity variations are not supported.

**Validation Layers:**

- ✅ **API Layer**: Validates `guests_per_unit <= pricing_config.max_capacity_per_unit` with user-friendly error messages
- ✅ **Database Layer**: CHECK constraint enforces `guests_per_unit > 0` (minimum only)
- ❌ **NO**: Do NOT validate unit availability (whether units are already booked)

**Implementation:**

```typescript
// API validation (user-friendly errors, maximum capacity check)
const { data: config } = await supabase
  .from("pricing_config")
  .select("max_capacity_per_unit")
  .eq("id", "default")
  .single();

if (guests_per_unit > config.max_capacity_per_unit) {
  throw new Error(`Maximum ${config.max_capacity_per_unit} guests per unit`);
}

// Database constraint (minimum validation only): CHECK (guests_per_unit > 0)
```

**Key Distinction (ADR-001):**

- **Capacity** = Physical limit (can X guests fit?) → **✅ Validate (API layer)**
- **Availability** = Booking status (is unit booked?) → **❌ Don't validate**

### Assignment Model

**All-or-nothing** - NO partial assignments

- Admin assigns ALL requested units or NONE
- Only 2 statuses exist: `pending` → `assigned`
- NO `partial` or intermediate statuses
- Database CHECK constraint enforces this rule

### Payment Verification

**Units CANNOT be assigned until payment verified**

- Enforced by database CHECK constraint
- `unit_assignment_status != 'assigned' OR payment_status IN ('Verified', 'Completed')`

### Concurrency Control

- **Primary:** PostgreSQL EXCLUDE constraint prevents double-booking
- **Secondary:** Optimistic locking for admin UI updates

### File Uploads (Two-Tier Strategy)

- **Client Optimization:** Frontend compresses images to ~2MB for faster uploads (Canvas API)
- **Server Security Boundary:** 5MB hard maximum enforced by server (files exceeding are REJECTED)
- **Formats:** JPEG, PNG, PDF only (validated via magic number + MIME type)
- **Storage:** Private Supabase bucket with signed URLs
- **Retention:** 90 days post-checkout, 30 days post-cancellation

### Idempotency

- Client-supplied UUID keys prevent duplicate bookings
- 48-hour expiry window (cleaned daily at 2:00 AM UTC)
- Retry allowed for failed/cancelled bookings

### Email Notifications

**NOT IMPLEMENTED** - manual guest contact via phone/SMS

Future integration with Resend/SendGrid planned post-launch.

### Security

- Cloudflare Turnstile required for bot protection
- All user input sanitized with DOMPurify
- JWT verification for admin endpoints

## Benefits

1. **Simpler Guest Experience**
   - No complex unit type decisions
   - Faster booking process
   - Less cognitive load

2. **Admin Flexibility**
   - Assign based on actual availability
   - Upgrade guests when possible
   - Optimize unit utilization

3. **Reduced Complexity**
   - Simpler database schema
   - Fewer validation rules
   - Easier pricing calculation

4. **Better Business Control**
   - Admin controls unit allocation
   - Can implement upgrade strategies
   - Handle edge cases gracefully

## Implementation Example

```tsx
<div className="space-y-4">
  <div>
    <Label>Number of Units Needed</Label>
    <Input
      type="number"
      min="1"
      max="10"
      value={unitCount}
      onChange={(e) => setUnitCount(e.target.value)}
    />
    <p className="text-muted-foreground text-sm">Maximum 10 units per booking</p>
  </div>

  <div>
    <Label>Guests per Unit</Label>
    <Input
      type="number"
      min="1"
      max="20"
      value={guestsPerUnit}
      onChange={(e) => setGuestsPerUnit(e.target.value)}
    />
    <p className="text-muted-foreground text-sm">Maximum 20 guests per unit</p>
  </div>

  <Alert>
    <Info className="h-4 w-4" />
    <AlertDescription>
      Total: {unitCount} units for {unitCount * guestsPerUnit} guests
    </AlertDescription>
  </Alert>
</div>
```

## Migration Notes

- Existing single-unit bookings remain unchanged
- New multi-unit bookings use simplified flow
- Admin training required for unit assignment workflow
- Generate pricing snapshots for existing bookings during migration

---

**This document supersedes any previous documentation showing unit types to guests.**
