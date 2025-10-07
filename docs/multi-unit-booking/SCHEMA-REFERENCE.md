# Multi-Unit Booking: Canonical Schema Reference

**Document Version:** 1.0
**Created:** October 7, 2025
**Purpose:** Single source of truth for all schema names, conventions, and data types

---

## Important Notice

⚠️ **This document is the CANONICAL reference.** All code, migrations, API documentation, and implementation plans MUST use exactly these names and types. Any drift from this reference is a bug.

---

## Core Principles

1. **No Legacy Compatibility:** Clean slate implementation (no existing users)
2. **Any Junction = Multi-Unit:** If `booking_units` table has rows → `is_multi_unit = TRUE`
3. **UTC Storage, Manila Display:** All timestamps stored as UTC, displayed as Asia/Manila
4. **Server-Side Pricing:** Single source of truth in `/api/pricing/quote`
5. **Guest Record Always Created:** Both authenticated and anonymous bookings create guest records

---

## Table Schemas

### bookings

**Core Columns:**

| Column Name         | Data Type     | Constraints                | Description                                                  |
| ------------------- | ------------- | -------------------------- | ------------------------------------------------------------ |
| `booking_id`        | UUID          | PRIMARY KEY                | Unique booking identifier                                    |
| `booking_reference` | VARCHAR(20)   | UNIQUE NOT NULL            | Human-readable reference (BK-YYYYMMDD-XXXX)                  |
| `guest_id`          | UUID          | NULL, FK → guests          | Link to guest record (NULL for anonymous bookings initially) |
| `guest_name`        | VARCHAR(100)  | NOT NULL                   | Primary guest full name                                      |
| `contact_number`    | VARCHAR(20)   | NOT NULL                   | Primary contact phone                                        |
| `email`             | VARCHAR(100)  | NOT NULL                   | Guest email address                                          |
| `num_guests`        | INTEGER       | NOT NULL, CHECK > 0        | Total number of guests across all units                      |
| `unit_id`           | UUID          | NULL, FK → units           | **LEGACY ONLY:** Single unit reference (NULL for multi-unit) |
| `check_in`          | TIMESTAMPTZ   | NOT NULL                   | Check-in date/time (**NOT** `check_in_date`)                 |
| `check_out`         | TIMESTAMPTZ   | NOT NULL, CHECK > check_in | Check-out date/time (**NOT** `check_out_date`)               |
| `total_amount`      | DECIMAL(10,2) | NOT NULL, CHECK >= 0       | Total booking amount (all units combined)                    |
| `booking_status`    | VARCHAR(20)   | NOT NULL                   | Booking status (**NOT** `status`)                            |
| `payment_status`    | VARCHAR(20)   | NOT NULL                   | Payment status (**NOT** `payment_state`)                     |
| `payment_method`    | VARCHAR(20)   | NULL                       | Payment method used                                          |
| `payment_proof_url` | TEXT          | NULL                       | Screenshot/proof of payment                                  |
| `special_requests`  | TEXT          | NULL                       | Guest special requests                                       |
| `internal_notes`    | TEXT          | NULL                       | Staff notes (not visible to guest)                           |
| `is_guest_booking`  | BOOLEAN       | DEFAULT FALSE              | TRUE if booked via public portal                             |
| `created_at`        | TIMESTAMPTZ   | DEFAULT NOW()              | Record creation timestamp                                    |
| `updated_at`        | TIMESTAMPTZ   | DEFAULT NOW()              | Last update timestamp                                        |

**Multi-Unit Columns:**

| Column Name        | Data Type     | Constraints          | Description                         |
| ------------------ | ------------- | -------------------- | ----------------------------------- |
| `is_multi_unit`    | BOOLEAN       | DEFAULT FALSE        | TRUE if booking uses junction table |
| `unit_count`       | INTEGER       | DEFAULT 1, CHECK > 0 | Number of units in booking          |
| `base_amount`      | DECIMAL(10,2) | NULL                 | Base amount before surcharges       |
| `total_surcharges` | DECIMAL(10,2) | DEFAULT 0            | Sum of all surcharges               |
| `discount_amount`  | DECIMAL(10,2) | DEFAULT 0            | Discount applied                    |

**Enums:**

```sql
booking_status: 'Pending' | 'Confirmed' | 'CheckedIn' | 'CheckedOut' | 'Cancelled'
payment_status: 'Unpaid' | 'Partial' | 'Paid' | 'Refunded'
```

---

### booking_units (NEW)

**Purpose:** Junction table for many-to-many booking-unit relationships

| Column Name           | Data Type     | Constraints                               | Description                              |
| --------------------- | ------------- | ----------------------------------------- | ---------------------------------------- |
| `booking_unit_id`     | UUID          | PRIMARY KEY                               | Unique junction record ID                |
| `booking_id`          | UUID          | NOT NULL, FK → bookings ON DELETE CASCADE | Parent booking                           |
| `unit_id`             | UUID          | NOT NULL, FK → units ON DELETE RESTRICT   | Associated unit                          |
| `unit_price`          | DECIMAL(10,2) | NOT NULL, CHECK >= 0                      | Price for this specific unit             |
| `weekend_surcharge`   | DECIMAL(10,2) | DEFAULT 0, CHECK >= 0                     | Weekend price premium                    |
| `extra_person_charge` | DECIMAL(10,2) | DEFAULT 0, CHECK >= 0                     | Charge for extra guests                  |
| `subtotal`            | DECIMAL(10,2) | NOT NULL, CHECK >= 0                      | Total for this unit (price + surcharges) |
| `assigned_guests`     | INTEGER       | NULL, CHECK > 0                           | Number of guests assigned to this unit   |
| `guest_names`         | TEXT[]        | NULL                                      | Array of guest names for this unit       |
| `unit_notes`          | TEXT          | NULL                                      | Unit-specific notes                      |
| `created_at`          | TIMESTAMPTZ   | DEFAULT NOW()                             | Record creation                          |
| `updated_at`          | TIMESTAMPTZ   | DEFAULT NOW()                             | Last update                              |

**Constraints:**

```sql
UNIQUE(booking_id, unit_id)  -- Prevent duplicate unit assignments
```

---

### booking_unit_availability (NEW)

**Purpose:** Denormalized table for fast availability queries with exclusion constraints

| Column Name       | Data Type   | Constraints                               | Description                   |
| ----------------- | ----------- | ----------------------------------------- | ----------------------------- |
| `availability_id` | UUID        | PRIMARY KEY                               | Unique availability record ID |
| `unit_id`         | UUID        | NOT NULL, FK → units ON DELETE CASCADE    | Unit being blocked            |
| `booking_id`      | UUID        | NOT NULL, FK → bookings ON DELETE CASCADE | Blocking booking              |
| `check_in`        | TIMESTAMPTZ | NOT NULL                                  | Block start date/time         |
| `check_out`       | TIMESTAMPTZ | NOT NULL, CHECK > check_in                | Block end date/time           |
| `booking_status`  | VARCHAR(20) | NOT NULL                                  | Current booking status        |
| `created_at`      | TIMESTAMPTZ | DEFAULT NOW()                             | Record creation               |

**Exclusion Constraint:**

```sql
EXCLUDE USING gist (
    unit_id WITH =,
    tstzrange(check_in, check_out, '[)') WITH &&
) WHERE (booking_status NOT IN ('Cancelled', 'NoShow'))
```

This prevents overlapping bookings for the same unit.

---

### guests

**Core Columns:**

| Column Name      | Data Type     | Constraints     | Description                                |
| ---------------- | ------------- | --------------- | ------------------------------------------ |
| `guest_id`       | UUID          | PRIMARY KEY     | Unique guest identifier                    |
| `guest_name`     | VARCHAR(100)  | NOT NULL        | Guest full name                            |
| `email`          | VARCHAR(100)  | UNIQUE NOT NULL | Guest email (unique identifier)            |
| `phone_number`   | VARCHAR(20)   | NOT NULL        | Primary phone number                       |
| `user_id`        | UUID          | NULL            | Supabase auth user ID (NULL for anonymous) |
| `total_bookings` | INTEGER       | DEFAULT 0       | Cached count of bookings                   |
| `total_spent`    | DECIMAL(12,2) | DEFAULT 0       | Lifetime revenue from this guest           |
| `created_at`     | TIMESTAMPTZ   | DEFAULT NOW()   | First booking date                         |
| `updated_at`     | TIMESTAMPTZ   | DEFAULT NOW()   | Last update                                |

**Key Behavior:**

- **Authenticated bookings:** `user_id` is set, links to Supabase auth
- **Anonymous bookings:** `user_id` is NULL, guest can claim later by registering with same email

---

### payments

**Core Columns:**

| Column Name       | Data Type     | Constraints                               | Description                        |
| ----------------- | ------------- | ----------------------------------------- | ---------------------------------- |
| `payment_id`      | UUID          | PRIMARY KEY                               | Unique payment identifier          |
| `booking_id`      | UUID          | NOT NULL, FK → bookings ON DELETE CASCADE | Associated booking                 |
| `amount`          | DECIMAL(10,2) | NOT NULL, CHECK > 0                       | Payment amount                     |
| `refunded_amount` | DECIMAL(10,2) | DEFAULT 0, CHECK >= 0                     | **NEW:** Amount refunded           |
| `payment_method`  | VARCHAR(50)   | NOT NULL                                  | Payment method (GCash, Bank, Cash) |
| `payment_date`    | TIMESTAMPTZ   | DEFAULT NOW()                             | When payment was made              |
| `proof_url`       | TEXT          | NULL                                      | Payment proof screenshot           |
| `notes`           | TEXT          | NULL                                      | Payment notes                      |
| `created_at`      | TIMESTAMPTZ   | DEFAULT NOW()                             | Record creation                    |

---

### payment_adjustments (NEW)

**Purpose:** Track payment changes when units are added/removed

| Column Name     | Data Type     | Constraints             | Description                          |
| --------------- | ------------- | ----------------------- | ------------------------------------ |
| `adjustment_id` | UUID          | PRIMARY KEY             | Unique adjustment ID                 |
| `payment_id`    | UUID          | NOT NULL, FK → payments | Parent payment                       |
| `reason`        | TEXT          | NOT NULL                | Reason for adjustment                |
| `amount_change` | DECIMAL(10,2) | NOT NULL                | Change amount (negative for refunds) |
| `created_at`    | TIMESTAMPTZ   | DEFAULT NOW()           | When adjustment was made             |

---

### units

**No changes to units table.** Existing schema is correct.

---

## Invariants and Constraints

### Booking-Unit Relationship

```sql
-- Invariant: EITHER direct unit_id OR booking_units junction
ALTER TABLE bookings
  ADD CONSTRAINT valid_unit_assignment CHECK (
    -- Legacy single-unit: unit_id NOT NULL, no booking_units rows
    (unit_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM booking_units WHERE booking_id = bookings.booking_id
    ))
    OR
    -- Multi-unit: unit_id IS NULL, has booking_units rows
    (unit_id IS NULL AND EXISTS(
      SELECT 1 FROM booking_units WHERE booking_id = bookings.booking_id
    ))
  );
```

**Simplified Logic:**

- If `booking_units` has ANY rows → `unit_id = NULL`, `is_multi_unit = TRUE`
- If `booking_units` is empty → `unit_id NOT NULL`, `is_multi_unit = FALSE`

---

## Timezone Conventions

### Storage Format

**Database:** All timestamps stored as **TIMESTAMPTZ in UTC**

```sql
-- Example stored value
check_in: '2025-03-15T06:00:00.000Z'  -- UTC
check_out: '2025-03-18T04:00:00.000Z'  -- UTC
```

### Standard Check-In/Out Times

- **Check-in:** 2:00 PM Asia/Manila (14:00 PHT)
- **Check-out:** 12:00 PM Asia/Manila (12:00 PHT)

### Conversion Pattern

```typescript
// UI: User selects date (no time)
const selectedDate = new Date("2025-03-15");

// Convert to UTC for storage
const checkInUTC = DateTime.fromObject(
  { year: 2025, month: 3, day: 15, hour: 14 },
  { zone: "Asia/Manila" }
)
  .toUTC()
  .toISO();
// Result: "2025-03-15T06:00:00.000Z"

// Display: Convert from UTC to Manila
const displayDate = DateTime.fromISO("2025-03-15T06:00:00.000Z")
  .setZone("Asia/Manila")
  .toFormat("MMM dd, yyyy h:mm a");
// Result: "Mar 15, 2025 2:00 PM"
```

---

## API Response Formats

### Booking Response (Multi-Unit)

```typescript
interface BookingResponse {
  booking_id: string;
  booking_reference: string;
  guest_id: string | null;
  guest_name: string;
  contact_number: string;
  email: string;
  num_guests: number;

  // Timestamps (ISO 8601 UTC strings)
  check_in: string; // "2025-03-15T06:00:00.000Z"
  check_out: string; // "2025-03-18T04:00:00.000Z"

  // Financial
  total_amount: number;
  base_amount: number;
  total_surcharges: number;
  discount_amount: number;

  // Status
  booking_status: "Pending" | "Confirmed" | "CheckedIn" | "CheckedOut" | "Cancelled";
  payment_status: "Unpaid" | "Partial" | "Paid" | "Refunded";

  // Multi-unit specific
  is_multi_unit: boolean;
  unit_count: number;
  booking_units: Array<{
    booking_unit_id: string;
    unit_id: string;
    unit_price: number;
    weekend_surcharge: number;
    extra_person_charge: number;
    subtotal: number;
    assigned_guests: number;
    guest_names: string[];
    unit_notes: string;
  }>;

  // Metadata
  created_at: string;
  updated_at: string;
}
```

### Availability Response

```typescript
interface AvailabilityResponse {
  unit_id: string;
  is_available: boolean;
  conflicting_bookings: number;
  next_available_date: string | null; // ISO 8601 UTC string
}
```

### Pricing Quote Response

```typescript
interface PricingQuoteResponse {
  total_amount: number;
  nights: number;
  units: Array<{
    unit_id: string;
    base_amount: number;
    extra_person_charge: number;
    weekend_surcharge: number;
    subtotal: number;
  }>;
}
```

---

## Database Functions Signatures

### create_multi_unit_booking

```sql
CREATE OR REPLACE FUNCTION create_multi_unit_booking(
    p_booking_data JSONB,
    p_units JSONB[],
    p_guest_id UUID DEFAULT NULL
) RETURNS UUID;
```

**Parameters:**

- `p_booking_data`: Booking details (guest info, dates, status)
- `p_units`: Array of unit details (unit_id, pricing, guests)
- `p_guest_id`: Optional guest record ID (NULL for anonymous bookings)

**Returns:** `booking_id` (UUID)

---

### check_multi_unit_availability

```sql
CREATE OR REPLACE FUNCTION check_multi_unit_availability(
    p_unit_ids UUID[],
    p_check_in TIMESTAMPTZ,
    p_check_out TIMESTAMPTZ,
    p_exclude_booking_id UUID DEFAULT NULL
) RETURNS TABLE(
    unit_id UUID,
    is_available BOOLEAN,
    conflicting_bookings INTEGER,
    next_available_date TIMESTAMPTZ
);
```

**Parameters:**

- `p_unit_ids`: Array of unit IDs to check
- `p_check_in`: Start of date range (UTC)
- `p_check_out`: End of date range (UTC)
- `p_exclude_booking_id`: Optional booking to exclude (for edits)

**Returns:** Table with availability status for each unit

---

## Column Name Migration Map

**For reference when updating existing code:**

| Old Name (if used) | Correct Name     | Type        |
| ------------------ | ---------------- | ----------- |
| `check_in_date`    | `check_in`       | TIMESTAMPTZ |
| `check_out_date`   | `check_out`      | TIMESTAMPTZ |
| `status`           | `booking_status` | VARCHAR(20) |
| `payment_state`    | `payment_status` | VARCHAR(20) |

---

## Indexes

**Critical indexes for performance:**

```sql
-- bookings
CREATE INDEX idx_bookings_unit_dates ON bookings(unit_id, check_in, check_out);
CREATE INDEX idx_bookings_status ON bookings(booking_status);
CREATE INDEX idx_bookings_guest ON bookings(guest_id);
CREATE INDEX idx_bookings_dates ON bookings(check_in, check_out);

-- booking_units
CREATE INDEX idx_booking_units_booking_id ON booking_units(booking_id);
CREATE INDEX idx_booking_units_unit_id ON booking_units(unit_id);

-- booking_unit_availability
CREATE INDEX idx_availability_lookup ON booking_unit_availability(unit_id, check_in, check_out)
  WHERE booking_status NOT IN ('Cancelled', 'NoShow');
CREATE INDEX idx_availability_booking_id ON booking_unit_availability(booking_id);

-- guests
CREATE INDEX idx_guests_email ON guests(email);
CREATE INDEX idx_guests_user_id ON guests(user_id) WHERE user_id IS NOT NULL;
```

---

## Version History

| Version | Date        | Changes                     |
| ------- | ----------- | --------------------------- |
| 1.0     | Oct 7, 2025 | Initial canonical reference |

---

**End of Canonical Schema Reference**

**Remember:** This document is the SINGLE SOURCE OF TRUTH. All code, migrations, and documentation must align with these definitions.
