# Database Schema for Multi-Unit Guest Booking

## Overview

Complete database schema including tables, constraints, indexes, and PostgreSQL functions for the multi-unit guest booking system.

**Key Principles:**

- Array-based model: Each row in `guest_booking_unit_requests` = 1 unit (NO `quantity` column)
- PostgreSQL `calculate_booking_pricing()` function is AUTHORITATIVE for all pricing
- Single source of truth: `pricing_config` table for all pricing and capacity settings
- Flexible discount conditions via JSONB (supports any discount type including unit_count)
- All-or-nothing unit assignment (NO partial assignments)
- Payment verification required before assignment

## Core Tables

### pricing_config (Single Source of Truth)

Centralized configuration for all pricing and capacity settings. Single row table.

```sql
CREATE TABLE pricing_config (
    id TEXT PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),

    -- Base pricing (applies to all units uniformly)
    base_rate DECIMAL(10, 2) NOT NULL CHECK (base_rate > 0),
    weekend_rate DECIMAL(10, 2) NOT NULL CHECK (weekend_rate > 0),
    extra_person_rate DECIMAL(10, 2) NOT NULL DEFAULT 500.00 CHECK (extra_person_rate >= 0),
    base_occupancy INTEGER NOT NULL DEFAULT 2 CHECK (base_occupancy > 0),

    -- Capacity configuration (applies to all units)
    max_capacity_per_unit INTEGER NOT NULL DEFAULT 20 CHECK (max_capacity_per_unit > 0),

    -- Business rules
    downpayment_percent DECIMAL(5, 2) NOT NULL DEFAULT 50.00 CHECK (downpayment_percent BETWEEN 0 AND 100),

    -- Currency and locale
    currency TEXT NOT NULL DEFAULT 'PHP',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default configuration (singleton row enforced by CHECK constraint)
INSERT INTO pricing_config (
    id, base_rate, weekend_rate, extra_person_rate,
    base_occupancy, max_capacity_per_unit
) VALUES (
    'default',
    3000.00,  -- Base rate per unit per night
    3500.00,  -- Weekend rate per unit per night
    500.00,   -- Extra person fee per night
    2,        -- Base occupancy included in base rate
    20        -- Maximum guests per unit
);

COMMENT ON TABLE pricing_config IS 'Single source of truth for all pricing and capacity configuration';
```

### units (Simplified)

Simplified units table without pricing or capacity information. All units share identical capacity defined in `pricing_config.max_capacity_per_unit`.

```sql
CREATE TABLE units (
    unit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_name TEXT NOT NULL,
    unit_number TEXT NOT NULL UNIQUE,
    unit_status TEXT NOT NULL DEFAULT 'Available'
        CHECK (unit_status IN ('Available', 'Maintenance', 'Out of Service')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_units_status ON units(unit_status) WHERE unit_status = 'Available';

COMMENT ON TABLE units IS 'Physical units only. Capacity and pricing defined centrally in pricing_config table.';
```

### guest_booking_unit_requests

Array-based structure where each row represents 1 unit.

```sql
CREATE TABLE guest_booking_unit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    guests_per_unit INTEGER NOT NULL CHECK (guests_per_unit > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_guest_booking_requests_booking ON guest_booking_unit_requests(booking_id);

COMMENT ON TABLE guest_booking_unit_requests IS 'Array-based model: each row represents one requested unit. Total units = row count.';
```

### bookings (Multi-Unit Extensions)

```sql
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS is_multi_unit BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS requested_unit_count INTEGER,
ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5, 2),
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS downpayment_required DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS unit_assignment_status TEXT DEFAULT 'pending'
    CHECK (unit_assignment_status IN ('pending', 'assigned')),
ADD COLUMN IF NOT EXISTS pricing_snapshot JSONB,
ADD COLUMN IF NOT EXISTS is_guest_booking BOOLEAN DEFAULT FALSE;

CREATE INDEX idx_bookings_multi_unit ON bookings(is_multi_unit) WHERE is_multi_unit = TRUE;
CREATE INDEX idx_bookings_assignment_pending ON bookings(unit_assignment_status, created_at DESC)
    WHERE is_guest_booking = TRUE AND is_multi_unit = TRUE AND unit_assignment_status = 'pending';

COMMENT ON COLUMN bookings.pricing_snapshot IS 'Immutable JSONB captured at booking creation via calculate_booking_pricing() - never recalculate. Append-only archival data, not queried, no index needed';
COMMENT ON COLUMN bookings.unit_assignment_status IS 'Only 2 values: pending or assigned';
```

### discount_rules (Flexible Conditions)

```sql
CREATE TABLE discount_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,

    -- JSONB conditions support multiple discount types
    -- All types fully implemented in calculate_booking_pricing() function
    conditions JSONB NOT NULL,
    /* Supported condition types:
       Duration:        [{"type": "min_nights", "value": 7}]
       Date Range:      [{"type": "date_range", "value": ["2025-12-20", "2026-01-05"]}]
       Advance Booking: [{"type": "advance_booking", "value": 30}]  -- days before check-in
       Unit Count:      [{"type": "unit_count", "value": 5}]
    */

    discount_type TEXT NOT NULL DEFAULT 'percentage'
        CHECK (discount_type IN ('percentage', 'fixed', 'per_night')),
    discount_value DECIMAL(10, 2) NOT NULL,
    max_discount DECIMAL(10, 2),

    priority INTEGER DEFAULT 0,  -- Lower number = higher priority (0 = highest)
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_discount_value CHECK (
        discount_value > 0 AND (discount_type != 'percentage' OR discount_value <= 100)
    )
);

CREATE INDEX idx_discount_rules_active ON discount_rules(is_active, priority DESC) WHERE is_active = TRUE;
CREATE INDEX idx_discount_rules_conditions ON discount_rules USING gin(conditions);

-- Default duration discounts (unit_count discounts supported but not configured initially)
INSERT INTO discount_rules (name, description, conditions, discount_type, discount_value, priority)
VALUES
    ('Week Stay Discount', '5% off for 7+ nights',
     '[{"type": "min_nights", "value": 7}]'::JSONB, 'percentage', 5.00, 1),
    ('Two Week Discount', '10% off for 14+ nights',
     '[{"type": "min_nights", "value": 14}]'::JSONB, 'percentage', 10.00, 2),
    ('Three Week Discount', '15% off for 21+ nights',
     '[{"type": "min_nights", "value": 21}]'::JSONB, 'percentage', 15.00, 3),
    ('Monthly Stay Discount', '20% off for 28+ nights',
     '[{"type": "min_nights", "value": 28}]'::JSONB, 'percentage', 20.00, 4)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE discount_rules IS 'Flexible discount system. All condition types fully implemented in calculate_booking_pricing(). Best-of policy (highest discount wins).';
```

### idempotency_keys

```sql
CREATE TABLE idempotency_keys (
    key UUID PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '48 hours')
);

CREATE INDEX idx_idempotency_expiry ON idempotency_keys(expires_at);
CREATE INDEX idx_idempotency_booking ON idempotency_keys(booking_id);

COMMENT ON TABLE idempotency_keys IS 'Prevents duplicate bookings. Keys expire 48 hours after creation (cleaned daily at 2:00 AM UTC).';
```

## Database Constraints

### Concurrency Control

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE booking_units
ADD CONSTRAINT no_double_booking EXCLUDE USING gist (
    unit_id WITH =,
    daterange(check_in_date, check_out_date, '[]') WITH &&
) WHERE (status != 'cancelled');

COMMENT ON CONSTRAINT no_double_booking ON booking_units IS 'Primary concurrency control - bulletproof at commit time';
```

### Payment Before Assignment

```sql
ALTER TABLE bookings
ADD CONSTRAINT payment_before_assignment CHECK (
    unit_assignment_status != 'assigned' OR payment_status IN ('Verified', 'Completed')
);

COMMENT ON CONSTRAINT payment_before_assignment ON bookings IS 'Units cannot be assigned until payment verified';
```

### All-or-Nothing Assignment

```sql
ALTER TABLE bookings
ADD CONSTRAINT all_or_nothing_assignment CHECK (
    unit_assignment_status != 'assigned' OR (
        (SELECT COUNT(*) FROM booking_units WHERE booking_id = bookings.booking_id AND status = 'confirmed') =
        (SELECT COUNT(*) FROM guest_booking_unit_requests WHERE booking_id = bookings.booking_id)
    )
);

COMMENT ON CONSTRAINT all_or_nothing_assignment ON bookings IS 'Admin must assign ALL units or NONE';
```

## PostgreSQL Functions (AUTHORITATIVE)

### calculate_booking_pricing (SINGLE SOURCE OF TRUTH)

This function is the ONLY authoritative pricing calculator. All pricing fetched from pricing_config table.

```sql
CREATE OR REPLACE FUNCTION calculate_booking_pricing(
    p_unit_requests JSONB,  -- Array: [{guests_per_unit: 2}, {guests_per_unit: 3}, ...]
    p_check_in DATE,
    p_check_out DATE
) RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_config RECORD;
    v_nights INTEGER;
    v_total_units INTEGER;
    v_total_guests INTEGER;
    v_base_rate DECIMAL(10, 2);
    v_weekend_rate DECIMAL(10, 2);
    v_extra_person_rate DECIMAL(10, 2);
    v_base_occupancy INTEGER;
    v_base_total DECIMAL(10, 2) := 0;
    v_weekend_surcharge DECIMAL(10, 2) := 0;
    v_extra_person_fees DECIMAL(10, 2) := 0;
    v_subtotal DECIMAL(10, 2);
    v_discount JSONB;
    v_total DECIMAL(10, 2);
    v_downpayment DECIMAL(10, 2);
    v_downpayment_percent DECIMAL(5, 2);
    v_weekend_nights INTEGER := 0;
    v_current_date DATE;
    v_unit_request JSONB;
    v_extra_persons INTEGER;
BEGIN
    -- Calculate nights
    v_nights := p_check_out - p_check_in;
    IF v_nights <= 0 THEN
        RAISE EXCEPTION 'Invalid date range';
    END IF;

    -- Fetch configuration from pricing_config (single source of truth)
    SELECT base_rate, weekend_rate, extra_person_rate, base_occupancy, downpayment_percent
    INTO v_base_rate, v_weekend_rate, v_extra_person_rate, v_base_occupancy, v_downpayment_percent
    FROM pricing_config
    WHERE id = 'default';

    IF v_base_rate IS NULL THEN
        RAISE EXCEPTION 'No pricing configuration found';
    END IF;

    -- Count weekend nights (Friday=5, Saturday=6)
    v_current_date := p_check_in;
    WHILE v_current_date < p_check_out LOOP
        IF EXTRACT(DOW FROM v_current_date) IN (5, 6) THEN
            v_weekend_nights := v_weekend_nights + 1;
        END IF;
        v_current_date := v_current_date + 1;
    END LOOP;

    -- Calculate totals from array
    v_total_units := jsonb_array_length(p_unit_requests);
    v_total_guests := 0;

    FOR v_unit_request IN SELECT * FROM jsonb_array_elements(p_unit_requests) LOOP
        v_total_guests := v_total_guests + (v_unit_request->>'guests_per_unit')::INTEGER;

        v_extra_persons := GREATEST(0, (v_unit_request->>'guests_per_unit')::INTEGER - v_base_occupancy);
        v_extra_person_fees := v_extra_person_fees + (v_extra_persons * v_extra_person_rate * v_nights);
    END LOOP;

    -- Pricing components
    v_base_total := v_total_units * v_base_rate * v_nights;
    v_weekend_surcharge := v_total_units * (v_weekend_rate - v_base_rate) * v_weekend_nights;
    v_subtotal := v_base_total + v_weekend_surcharge + v_extra_person_fees;

    -- Apply best discount (supports all condition types)
    -- Best-of policy: highest value wins, lowest priority number breaks ties
    SELECT jsonb_build_object(
        'percent', discount_value,
        'amount', ROUND(v_subtotal * (discount_value / 100.0), 2),
        'rule_id', id,
        'rule_name', name
    )
    INTO v_discount
    FROM discount_rules
    WHERE is_active = TRUE
      AND (
          -- Duration discount: Check minimum nights
          (conditions @> '[{"type": "min_nights"}]'::jsonb
           AND v_nights >= (conditions->0->>'value')::INTEGER)
          OR
          -- Unit count discount: Check minimum units
          (conditions @> '[{"type": "unit_count"}]'::jsonb
           AND v_total_units >= (conditions->0->>'value')::INTEGER)
          OR
          -- Date range discount: Check if check-in falls within range
          (conditions @> '[{"type": "date_range"}]'::jsonb
           AND p_check_in >= (conditions->0->'value'->>0)::DATE
           AND p_check_in <= (conditions->0->'value'->>1)::DATE)
          OR
          -- Advance booking discount: Check booking lead time (days between now and check-in)
          (conditions @> '[{"type": "advance_booking"}]'::jsonb
           AND (p_check_in - CURRENT_DATE) >= (conditions->0->>'value')::INTEGER)
      )
    ORDER BY discount_value DESC, priority ASC, created_at ASC
    LIMIT 1;

    -- Final calculations
    v_total := v_subtotal - COALESCE((v_discount->>'amount')::DECIMAL, 0);
    v_downpayment := ROUND(v_total * (v_downpayment_percent / 100.0), 2);

    -- Build result
    v_result := jsonb_build_object(
        'version', '1.0.0',
        'computed_at', NOW(),
        'nights', v_nights,
        'total_units', v_total_units,
        'total_guests', v_total_guests,
        'rates', jsonb_build_object(
            'base_rate', v_base_rate,
            'weekend_rate', v_weekend_rate,
            'extra_person_rate', v_extra_person_rate,
            'base_occupancy', v_base_occupancy
        ),
        'base_total', v_base_total,
        'weekend_surcharge', v_weekend_surcharge,
        'extra_person_fees', v_extra_person_fees,
        'subtotal', v_subtotal,
        'discount', COALESCE(v_discount, 'null'::jsonb),
        'total', v_total,
        'downpayment_required', v_downpayment,
        'downpayment_percent', v_downpayment_percent,
        'currency', 'PHP'
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_booking_pricing IS 'Authoritative pricing - fetches from pricing_config (single source of truth)';
```

### create_guest_booking (Atomic Booking Creation)

Creates a complete guest booking atomically with all related records. Prevents orphaned records and handles idempotency.

```sql
CREATE OR REPLACE FUNCTION create_guest_booking(
    p_guest_data JSONB,
    p_booking_data JSONB,
    p_unit_requests JSONB,
    p_idempotency_key UUID
) RETURNS JSONB AS $$
DECLARE
    v_guest_id UUID;
    v_booking_id UUID;
    v_existing_booking_id UUID;
    v_unit_request JSONB;
    v_result JSONB;
BEGIN
    -- Check idempotency key (24-hour window)
    SELECT booking_id INTO v_existing_booking_id
    FROM idempotency_keys
    WHERE key = p_idempotency_key
      AND created_at > NOW() - INTERVAL '24 hours';

    IF v_existing_booking_id IS NOT NULL THEN
        -- Return existing booking
        SELECT jsonb_build_object(
            'is_duplicate', true,
            'booking', row_to_json(b.*)
        ) INTO v_result
        FROM bookings b
        WHERE b.booking_id = v_existing_booking_id;

        RETURN v_result;
    END IF;

    -- Find or create guest
    SELECT guest_id INTO v_guest_id
    FROM guests
    WHERE email = (p_guest_data->>'email')
    LIMIT 1;

    IF v_guest_id IS NULL THEN
        INSERT INTO guests (guest_name, email, phone_number)
        VALUES (
            p_guest_data->>'guest_name',
            p_guest_data->>'email',
            p_guest_data->>'phone_number'
        )
        RETURNING guest_id INTO v_guest_id;
    END IF;

    -- Create booking
    INSERT INTO bookings (
        guest_id,
        booking_reference,
        check_in_date,
        check_out_date,
        num_guests,
        total_amount,
        discount_percent,
        discount_amount,
        downpayment_required,
        pricing_snapshot,
        special_requests,
        is_multi_unit,
        is_guest_booking,
        requested_unit_count,
        unit_assignment_status,
        booking_status,
        payment_status
    ) VALUES (
        v_guest_id,
        p_booking_data->>'booking_reference',
        (p_booking_data->>'check_in_date')::TIMESTAMPTZ,
        (p_booking_data->>'check_out_date')::TIMESTAMPTZ,
        (p_booking_data->>'num_guests')::INTEGER,
        (p_booking_data->>'total_amount')::DECIMAL,
        (p_booking_data->>'discount_percent')::DECIMAL,
        (p_booking_data->>'discount_amount')::DECIMAL,
        (p_booking_data->>'downpayment_required')::DECIMAL,
        (p_booking_data->>'pricing_snapshot')::JSONB,
        p_booking_data->>'special_requests',
        TRUE,
        TRUE,
        jsonb_array_length(p_unit_requests),
        'pending',
        'Pending',
        'Pending'
    )
    RETURNING booking_id INTO v_booking_id;

    -- Insert unit requests
    FOR v_unit_request IN SELECT * FROM jsonb_array_elements(p_unit_requests) LOOP
        INSERT INTO guest_booking_unit_requests (booking_id, guests_per_unit)
        VALUES (
            v_booking_id,
            (v_unit_request->>'guests_per_unit')::INTEGER
        );
    END LOOP;

    -- Store idempotency key
    INSERT INTO idempotency_keys (key, booking_id)
    VALUES (p_idempotency_key, v_booking_id);

    -- Build result
    SELECT jsonb_build_object(
        'is_duplicate', false,
        'booking', row_to_json(b.*)
    ) INTO v_result
    FROM bookings b
    WHERE b.booking_id = v_booking_id;

    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Booking creation failed: % - All changes rolled back', SQLERRM;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_guest_booking IS 'Atomically creates booking with guest, unit requests, and idempotency key. Prevents orphaned records.';
```

## Helper Functions

### assign_units_to_booking (Atomic Unit Assignment)

Assigns specific units to a pending booking. Enforces all-or-nothing assignment and payment verification.

```sql
CREATE OR REPLACE FUNCTION assign_units_to_booking(
  p_booking_id UUID,
  p_unit_ids UUID[]
) RETURNS VOID AS $$
DECLARE
  v_unit_id UUID;
  v_check_in DATE;
  v_check_out DATE;
  v_requested_count INT;
BEGIN
  -- Get booking details
  SELECT check_in_date, check_out_date, requested_unit_count
  INTO v_check_in, v_check_out, v_requested_count
  FROM bookings
  WHERE booking_id = p_booking_id
    AND unit_assignment_status = 'pending'
    AND payment_status = 'Verified';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found or not ready for assignment';
  END IF;

  -- Validate all-or-nothing (array length must equal requested count)
  IF array_length(p_unit_ids, 1) != v_requested_count THEN
    RAISE EXCEPTION 'Must assign exactly % units', v_requested_count;
  END IF;

  -- Insert booking_units for each assigned unit
  FOREACH v_unit_id IN ARRAY p_unit_ids LOOP
    INSERT INTO booking_units (booking_id, unit_id, check_in_date, check_out_date, status)
    VALUES (p_booking_id, v_unit_id, v_check_in, v_check_out, 'confirmed');
  END LOOP;

  -- Update booking status
  UPDATE bookings
  SET unit_assignment_status = 'assigned',
      booking_status = 'Confirmed',
      updated_at = NOW()
  WHERE booking_id = p_booking_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Assignment failed: % - All changes rolled back', SQLERRM;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION assign_units_to_booking(UUID, UUID[]) SET statement_timeout = '5s';

COMMENT ON FUNCTION assign_units_to_booking IS 'Atomically assigns units to booking. Enforces all-or-nothing and payment verification.';
```

### Cleanup Functions (Required for MVP)

```sql
-- Cleanup expired idempotency keys (daily at 2:00 AM UTC)
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM idempotency_keys
    WHERE expires_at < NOW();

    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_idempotency_keys IS 'Removes expired keys. Called daily at 2:00 AM UTC. Keys expire 48 hours after creation.';

-- Cleanup expired payment proofs (weekly Sunday at 3:00 AM UTC)
-- Database only - Supabase Storage deletion handled by cron worker
CREATE OR REPLACE FUNCTION cleanup_expired_payment_proofs()
RETURNS TABLE(file_path TEXT) AS $$
BEGIN
    RETURN QUERY
    WITH expired_proofs AS (
        SELECT booking_id, payment_proof_url,
               regexp_replace(payment_proof_url, '^.*/([^/]+)$', '\1') AS extracted_path
        FROM bookings
        WHERE payment_proof_url IS NOT NULL
          AND booking_status IN ('Completed', 'Checked-Out')
          AND check_out_date < NOW() - INTERVAL '90 days'
    )
    UPDATE bookings b
    SET payment_proof_url = NULL,
        updated_at = NOW()
    FROM expired_proofs ep
    WHERE b.booking_id = ep.booking_id
    RETURNING ep.extracted_path;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_payment_proofs IS 'Returns file paths for deletion. Called weekly (Sunday 3:00 AM UTC). Cron worker calls Supabase Storage API to delete files. Retention: 90 days post-checkout.';
```

## Row Level Security

```sql
-- Enable RLS on all tables
ALTER TABLE guest_booking_unit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_config ENABLE ROW LEVEL SECURITY;

-- Guest booking unit requests policies
CREATE POLICY guest_booking_requests_insert_policy ON guest_booking_unit_requests
    FOR INSERT TO authenticated, service_role
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role' OR auth.jwt() ->> 'app_role' = 'admin');

CREATE POLICY guest_booking_requests_select_policy ON guest_booking_unit_requests
    FOR SELECT TO authenticated
    USING (auth.jwt() ->> 'app_role' = 'admin');

-- Pricing config policies (read-only for most users)
CREATE POLICY pricing_config_select_policy ON pricing_config
    FOR SELECT TO authenticated, anon
    USING (true);

CREATE POLICY pricing_config_admin_policy ON pricing_config
    FOR ALL TO authenticated
    USING (auth.jwt() ->> 'app_role' = 'admin')
    WITH CHECK (auth.jwt() ->> 'app_role' = 'admin');

-- Discount rules policies
CREATE POLICY discount_rules_select_policy ON discount_rules
    FOR SELECT TO authenticated, anon
    USING (is_active = TRUE);

CREATE POLICY discount_rules_admin_policy ON discount_rules
    FOR ALL TO authenticated
    USING (auth.jwt() ->> 'app_role' = 'admin')
    WITH CHECK (auth.jwt() ->> 'app_role' = 'admin');

-- Idempotency keys policies
CREATE POLICY idempotency_keys_service_policy ON idempotency_keys
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON pricing_config TO authenticated, anon;
GRANT ALL ON pricing_config TO service_role;

GRANT SELECT, INSERT ON guest_booking_unit_requests TO authenticated;
GRANT ALL ON guest_booking_unit_requests TO service_role;

GRANT SELECT ON discount_rules TO authenticated, anon;
GRANT ALL ON discount_rules TO service_role;

GRANT SELECT, INSERT, DELETE ON idempotency_keys TO service_role;
```

## Indexes Summary

```sql
-- Performance indexes
CREATE INDEX idx_guest_booking_requests_booking ON guest_booking_unit_requests(booking_id);
CREATE INDEX idx_bookings_multi_unit ON bookings(is_multi_unit) WHERE is_multi_unit = TRUE;
CREATE INDEX idx_bookings_assignment_pending ON bookings(unit_assignment_status, created_at DESC)
    WHERE is_guest_booking = TRUE AND is_multi_unit = TRUE AND unit_assignment_status = 'pending';
CREATE INDEX idx_units_status ON units(unit_status) WHERE unit_status = 'Available';
CREATE INDEX idx_discount_rules_active ON discount_rules(is_active, priority DESC) WHERE is_active = TRUE;
CREATE INDEX idx_discount_rules_conditions ON discount_rules USING gin(conditions);
CREATE INDEX idx_idempotency_expiry ON idempotency_keys(expires_at);
CREATE INDEX idx_idempotency_booking ON idempotency_keys(booking_id);
```

## Migration Order

1. Create extension: `btree_gist`
2. Create `pricing_config` table and insert default row
3. Simplify `units` table (remove pricing columns in migration)
4. Create `guest_booking_unit_requests` table
5. Extend `bookings` table with multi-unit columns
6. Create `discount_rules` table and insert defaults
7. Create `idempotency_keys` table
8. Add all constraints
9. Create all functions:
   - `calculate_booking_pricing()` - Authoritative pricing
   - `create_guest_booking()` - Atomic booking creation
   - `assign_units_to_booking()` - Unit assignment with all-or-nothing enforcement
   - `cleanup_expired_idempotency_keys()` - Daily cleanup (2:00 AM UTC)
   - `cleanup_expired_payment_proofs()` - Weekly cleanup (Sunday 3:00 AM UTC)
10. Setup RLS policies
11. Create indexes
12. Grant permissions

## Key Implementation Notes

- **Centralized Configuration**: All pricing and guest capacity settings in `pricing_config` table (single authoritative source)
- **Array-Based Model**: Each `guest_booking_unit_requests` row represents one unit. Total units = row count.
- **Capacity Validation**: API validates `guests_per_unit` ≤ `pricing_config.max_capacity_per_unit` before insert. Database CHECK constraint validates `guests_per_unit > 0` only.
- **Booking Size Validation**: API validates total requested units ≤ COUNT(available units) dynamically (not a config value)
- **Atomic Booking Creation**: `create_guest_booking()` function prevents orphaned records via transaction
- **Flexible Discounts**: All discount types (duration, date_range, advance_booking, unit_count) fully implemented. Best-of policy: highest value wins, lowest priority number (0 = highest) breaks ties.
- **All-or-Nothing Assignment**: Database constraint enforces complete assignment (no partial assignments)
- **Idempotency**: Keys expire 48 hours after creation. Daily cleanup at 2:00 AM UTC.
- **Concurrency Control**: PostgreSQL EXCLUDE constraint provides bulletproof double-booking prevention
- **Payment Proof Retention**: Automatic cleanup 90 days post-checkout. Weekly cleanup (Sunday 3:00 AM UTC).
