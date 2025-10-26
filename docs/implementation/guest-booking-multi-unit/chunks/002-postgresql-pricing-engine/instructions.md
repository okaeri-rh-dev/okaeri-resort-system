# Implementation Instructions: Chunk 002

## Overview

This guide walks you through **replacing the placeholder pricing function** with the complete authoritative implementation, then **testing and validating** it across multiple scenarios to ensure accuracy before API endpoints depend on this function.

**Estimated Time**: 140 minutes total

- Step 0: Replace placeholder function (20 min)
- Step 1: Preparation (10 min)
- Step 2: Single-unit tests (20 min)
- Step 3: Multi-unit tests (20 min)
- Step 4: Discount tests (30 min)
- Step 5: Weekend/extra person tests (20 min)
- Step 6: Edge case tests (20 min)

---

## Step 0: Replace Placeholder Function (20 minutes)

Before testing, you must replace the minimal placeholder function created in Chunk 001 with the full authoritative pricing calculator.

### 0.1: Verify Placeholder Exists

```sql
-- Check current function returns placeholder version
SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 2}]'::JSONB,
    '2025-01-06'::DATE,
    '2025-01-09'::DATE
)->>'version' AS current_version;
```

**Expected Output**: `"1.0.0-stub"` (placeholder from Chunk 001)

**Status**: [ ] Placeholder verified

---

### 0.2: Execute Full Function Replacement

Copy the complete function implementation from the source documentation and execute it.

```sql
-- ============================================
-- Full Implementation: calculate_booking_pricing()
-- Source: docs/implementation/guest-booking-multi-unit/01-database-schema.md (lines 240-373)
-- ============================================

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

COMMENT ON FUNCTION calculate_booking_pricing IS 'Authoritative pricing calculator - supports all 4 discount types, weekend rates, extra person fees. Single source of truth for pricing.';
```

**Status**: [ ] Function replaced successfully

---

### 0.3: Verify Replacement Success

```sql
-- Test that full function is active (version should be "1.0.0", not "1.0.0-stub")
SELECT
    pricing->>'version' AS version,
    pricing ? 'discount' AS has_discount_engine,
    pricing ? 'weekend_surcharge' AS has_weekend_logic,
    CASE
        WHEN (pricing->>'version')::TEXT = '1.0.0'
         AND pricing ? 'discount'
         AND pricing ? 'weekend_surcharge' THEN '✅ FULL FUNCTION ACTIVE'
        WHEN (pricing->>'version')::TEXT LIKE '%stub%' THEN '❌ STILL USING PLACEHOLDER'
        ELSE '⚠️ UNKNOWN STATE'
    END AS status
FROM (
    SELECT calculate_booking_pricing(
        '[{"guests_per_unit": 2}]'::JSONB,
        '2025-01-06'::DATE,
        '2025-01-09'::DATE
    ) AS pricing
) AS test;
```

**Expected Output**:

- `version` = '1.0.0' (NOT '1.0.0-stub')
- `status` = '✅ FULL FUNCTION ACTIVE'

**Status**: [ ] Verification passed

**⚠️ If verification fails**: Check troubleshooting.md Issue 0 for solutions

---

## Step 1: Verify Chunk 001 Completion (10 minutes)

Before testing the pricing function, ensure Chunk 001 was completed successfully.

### 1.1: Verify Pricing Config Table

```sql
-- Verify pricing_config table has default configuration
SELECT
    id,
    base_rate,
    weekend_rate,
    extra_person_rate,
    base_occupancy,
    max_capacity_per_unit,
    downpayment_percent
FROM pricing_config
WHERE id = 'default';
```

**Expected Output**: 1 row with:

- `base_rate` = 3000.00
- `weekend_rate` = 3500.00
- `extra_person_rate` = 500.00
- `base_occupancy` = 2
- `max_capacity_per_unit` = 20
- `downpayment_percent` = 50.00

**Status**: [ ] Pass [ ] Fail

---

### 1.2: Verify Discount Rules Table

```sql
-- Verify discount_rules table has default duration discounts
SELECT
    name,
    conditions,
    discount_value,
    priority,
    is_active
FROM discount_rules
WHERE is_active = TRUE
ORDER BY priority ASC;
```

**Expected Output**: 4 rows (duration discounts for 7, 14, 21, 28 nights)

**Status**: [ ] Pass [ ] Fail

---

### 1.3: Verify Pricing Function Exists

```sql
-- Verify calculate_booking_pricing function exists
SELECT
    routine_name,
    routine_type,
    data_type AS return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'calculate_booking_pricing';
```

**Expected Output**: 1 row with `routine_type` = 'FUNCTION', `return_type` = 'jsonb'

**Status**: [ ] Pass [ ] Fail

---

## Step 2: Test Single-Unit Pricing (20 minutes)

Test basic pricing for a single unit with varying guest counts.

### 2.1: Single Unit, Base Occupancy (2 guests)

**Scenario**: 1 unit, 2 guests, 3 weekday nights (no weekend)

```sql
-- Test case: Mon Jan 6, 2025 → Thu Jan 9, 2025 (3 nights, no weekends)
SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 2}]'::JSONB,  -- 1 unit, 2 guests
    '2025-01-06'::DATE,                  -- Monday
    '2025-01-09'::DATE                   -- Thursday
) AS pricing_result;
```

**Manual Calculation**:

```
Nights: 3
Units: 1
Guests: 2 (base occupancy, no extra person fees)
Weekend nights: 0

Base total: 1 unit × ₱3,000 × 3 nights = ₱9,000
Weekend surcharge: 0 (no weekend nights)
Extra person fees: 0 (2 guests = base occupancy)
Subtotal: ₱9,000
Discount: 0% (3 nights < 7 nights minimum)
Total: ₱9,000
Downpayment (50%): ₱4,500
```

**Expected JSONB Result** (prettified for readability):

```json
{
  "version": "1.0.0",
  "nights": 3,
  "total_units": 1,
  "total_guests": 2,
  "rates": {
    "base_rate": 3000.0,
    "weekend_rate": 3500.0,
    "extra_person_rate": 500.0,
    "base_occupancy": 2
  },
  "base_total": 9000.0,
  "weekend_surcharge": 0.0,
  "extra_person_fees": 0.0,
  "subtotal": 9000.0,
  "discount": null,
  "total": 9000.0,
  "downpayment_required": 4500.0,
  "downpayment_percent": 50.0,
  "currency": "PHP"
}
```

**Verification**: Compare `total` (should be 9000.00)

**Status**: [ ] Pass [ ] Fail

---

### 2.2: Single Unit, Extra Guests (5 guests)

**Scenario**: 1 unit, 5 guests, 3 weekday nights (extra person fees apply)

```sql
-- Test case: 1 unit, 5 guests (3 extra beyond base_occupancy of 2)
SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 5}]'::JSONB,
    '2025-01-06'::DATE,
    '2025-01-09'::DATE
) AS pricing_result;
```

**Manual Calculation**:

```
Nights: 3
Units: 1
Guests: 5 (base: 2, extra: 3)
Extra person fees: 3 extra persons × ₱500 × 3 nights = ₱4,500

Base total: ₱9,000
Extra person fees: ₱4,500
Subtotal: ₱13,500
Total: ₱13,500
Downpayment (50%): ₱6,750
```

**Verification**: Compare `extra_person_fees` (should be 4500.00) and `total` (should be 13500.00)

**Status**: [ ] Pass [ ] Fail

---

### 2.3: Single Unit, With Weekend

**Scenario**: 1 unit, 2 guests, 3 nights including 1 weekend night (Friday)

```sql
-- Test case: Thu Jan 9, 2025 → Sun Jan 12, 2025 (3 nights, includes Fri-Sat)
SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 2}]'::JSONB,
    '2025-01-09'::DATE,   -- Thursday
    '2025-01-12'::DATE    -- Sunday
) AS pricing_result;
```

**Manual Calculation**:

```
Nights: 3 (Thu→Fri, Fri→Sat, Sat→Sun)
Weekend nights: 2 (Friday=5, Saturday=6)
Weekday nights: 1 (Thursday=4)

Base total: 1 unit × ₱3,000 × 3 nights = ₱9,000
Weekend surcharge: 1 unit × (₱3,500 - ₱3,000) × 2 weekend nights = ₱1,000
Subtotal: ₱10,000
Total: ₱10,000
Downpayment (50%): ₱5,000
```

**Verification**: Compare `weekend_surcharge` (should be 1000.00) and `total` (should be 10000.00)

**Status**: [ ] Pass [ ] Fail

---

## Step 3: Test Multi-Unit Pricing (20 minutes)

Test pricing for multiple units with varying guest counts.

### 3.1: Two Units, Same Guest Count

**Scenario**: 2 units, each with 2 guests, 3 weekday nights

```sql
-- Test case: 2 units × 2 guests each
SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 2}, {"guests_per_unit": 2}]'::JSONB,
    '2025-01-06'::DATE,
    '2025-01-09'::DATE
) AS pricing_result;
```

**Manual Calculation**:

```
Nights: 3
Units: 2
Total guests: 4 (2 per unit)

Base total: 2 units × ₱3,000 × 3 nights = ₱18,000
Extra person fees: 0 (each unit has base occupancy)
Subtotal: ₱18,000
Total: ₱18,000
Downpayment (50%): ₱9,000
```

**Verification**: Compare `total_units` (should be 2), `total_guests` (should be 4), `total` (should be 18000.00)

**Status**: [ ] Pass [ ] Fail

---

### 3.2: Five Units, Mixed Guest Counts

**Scenario**: 5 units with varying guest counts (tests unit_count discount eligibility)

```sql
-- Test case: 5 units (triggers potential unit_count discount if configured)
SELECT calculate_booking_pricing(
    '[
        {"guests_per_unit": 2},
        {"guests_per_unit": 3},
        {"guests_per_unit": 4},
        {"guests_per_unit": 2},
        {"guests_per_unit": 5}
    ]'::JSONB,
    '2025-01-06'::DATE,
    '2025-01-09'::DATE
) AS pricing_result;
```

**Manual Calculation**:

```
Nights: 3
Units: 5
Total guests: 16 (2+3+4+2+5)

Base total: 5 units × ₱3,000 × 3 nights = ₱45,000

Extra person fees:
  Unit 1: 0 extra persons (2 guests = base)
  Unit 2: 1 extra person × ₱500 × 3 nights = ₱1,500
  Unit 3: 2 extra persons × ₱500 × 3 nights = ₱3,000
  Unit 4: 0 extra persons
  Unit 5: 3 extra persons × ₱500 × 3 nights = ₱4,500
  Total extra person fees: ₱9,000

Subtotal: ₱45,000 + ₱9,000 = ₱54,000
Discount: 0% (no unit_count discount configured by default)
Total: ₱54,000
Downpayment (50%): ₱27,000
```

**Verification**: Compare `total_units` (5), `total_guests` (16), `extra_person_fees` (9000.00), `total` (54000.00)

**Status**: [ ] Pass [ ] Fail

---

## Step 4: Test Discount Rules (30 minutes)

Test all 4 discount types supported by the pricing engine.

### 4.1: Duration Discount (7 nights)

**Scenario**: 7-night stay triggers 5% discount

```sql
-- Test case: 7 nights (qualifies for "Week Stay Discount" - 5%)
SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 2}]'::JSONB,
    '2025-01-06'::DATE,
    '2025-01-13'::DATE    -- 7 nights later
) AS pricing_result;
```

**Manual Calculation**:

```
Nights: 7
Units: 1
Guests: 2

Base total: 1 × ₱3,000 × 7 = ₱21,000
Subtotal: ₱21,000

Discount: 5% (7-night minimum met)
Discount amount: ₱21,000 × 0.05 = ₱1,050
Total: ₱21,000 - ₱1,050 = ₱19,950
Downpayment (50%): ₱9,975
```

**Verification**:

- `discount.percent` should be 5.00
- `discount.amount` should be 1050.00
- `discount.rule_name` should be "Week Stay Discount"
- `total` should be 19950.00

**Status**: [ ] Pass [ ] Fail

---

### 4.2: Duration Discount (14 nights - Best-Of Policy Test)

**Scenario**: 14-night stay qualifies for BOTH 7-night (5%) and 14-night (10%) discounts. Only highest (10%) should apply.

```sql
-- Test case: 14 nights (qualifies for 5% AND 10%, should get 10%)
SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 2}]'::JSONB,
    '2025-01-06'::DATE,
    '2025-01-20'::DATE    -- 14 nights later
) AS pricing_result;
```

**Manual Calculation**:

```
Nights: 14
Units: 1
Guests: 2

Base total: 1 × ₱3,000 × 14 = ₱42,000
Subtotal: ₱42,000

Eligible discounts:
  - 7-night: 5% = ₱2,100
  - 14-night: 10% = ₱4,200  ← BEST (highest)

Discount applied: 10% (best-of policy)
Discount amount: ₱4,200
Total: ₱42,000 - ₱4,200 = ₱37,800
Downpayment (50%): ₱18,900
```

**Verification**:

- `discount.percent` should be 10.00 (NOT 5.00 or 15.00 stacked)
- `discount.rule_name` should be "Two Week Discount"
- `total` should be 37800.00

**Status**: [ ] Pass [ ] Fail

---

### 4.3: Date Range Discount (Create Test Rule)

**Scenario**: Create a seasonal discount for holiday season, then test it.

```sql
-- Step 1: Create a date range discount (15% for Dec 20 - Jan 5 check-ins)
INSERT INTO discount_rules (name, description, conditions, discount_type, discount_value, priority)
VALUES (
    'Holiday Season Discount',
    '15% off for check-ins during Dec 20 - Jan 5 holiday period',
    '[{"type": "date_range", "value": ["2025-12-20", "2026-01-05"]}]'::JSONB,
    'percentage',
    15.00,
    0  -- Highest priority
)
RETURNING id, name, conditions, discount_value;
```

**Expected Output**: 1 row inserted

```sql
-- Step 2: Test pricing with check-in during date range
SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 2}]'::JSONB,
    '2025-12-25'::DATE,   -- Christmas (within date range)
    '2025-12-28'::DATE    -- 3 nights
) AS pricing_result;
```

**Manual Calculation**:

```
Check-in: Dec 25, 2025 (within Dec 20 - Jan 5 range)
Nights: 3
Units: 1
Guests: 2

Base total: 1 × ₱3,000 × 3 = ₱9,000
Subtotal: ₱9,000

Discount: 15% (date range condition met)
Discount amount: ₱9,000 × 0.15 = ₱1,350
Total: ₱9,000 - ₱1,350 = ₱7,650
Downpayment (50%): ₱3,825
```

**Verification**:

- `discount.percent` should be 15.00
- `discount.rule_name` should be "Holiday Season Discount"
- `total` should be 7650.00

**Status**: [ ] Pass [ ] Fail

```sql
-- Step 3: Test check-in OUTSIDE date range (should get 0% discount)
SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 2}]'::JSONB,
    '2025-11-25'::DATE,   -- November (outside range)
    '2025-11-28'::DATE
) AS pricing_result;
```

**Expected**: `discount` should be `null` (no discount applied)

**Status**: [ ] Pass [ ] Fail

---

### 4.4: Advance Booking Discount (Create Test Rule)

**Scenario**: Create an early-bird discount for bookings made 30+ days in advance.

```sql
-- Step 1: Create advance booking discount (5% for 30+ days lead time)
INSERT INTO discount_rules (name, description, conditions, discount_type, discount_value, priority)
VALUES (
    'Early Bird Discount',
    '5% off when booking 30+ days in advance',
    '[{"type": "advance_booking", "value": 30}]'::JSONB,
    'percentage',
    5.00,
    1  -- Lower priority than holiday discount
)
RETURNING id, name, conditions, discount_value;
```

```sql
-- Step 2: Test with check-in 45 days from today
-- Calculate date 45 days from now
SELECT CURRENT_DATE + INTERVAL '45 days' AS check_in_date;
```

**Copy the returned date and use it in the test below.**

```sql
-- Step 3: Test pricing with 45-day lead time (should qualify)
-- REPLACE '2025-XX-XX' with the date from Step 2
SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 2}]'::JSONB,
    '2025-XX-XX'::DATE,  -- REPLACE with check_in_date from Step 2
    ('2025-XX-XX'::DATE + INTERVAL '3 days')::DATE  -- 3 nights
) AS pricing_result;
```

**Manual Calculation**:

```
Lead time: 45 days (≥ 30 days, qualifies)
Nights: 3
Units: 1
Guests: 2

Base total: 1 × ₱3,000 × 3 = ₱9,000
Subtotal: ₱9,000

Discount: 5% (advance booking condition met)
Discount amount: ₱9,000 × 0.05 = ₱450
Total: ₱9,000 - ₱450 = ₱8,550
Downpayment (50%): ₱4,275
```

**Verification**:

- `discount.percent` should be 5.00
- `discount.rule_name` should be "Early Bird Discount"
- `total` should be 8550.00

**Status**: [ ] Pass [ ] Fail

```sql
-- Step 4: Test with check-in 15 days from now (should NOT qualify)
SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 2}]'::JSONB,
    (CURRENT_DATE + INTERVAL '15 days')::DATE,
    (CURRENT_DATE + INTERVAL '18 days')::DATE
) AS pricing_result;
```

**Expected**: `discount` should be `null` (15 days < 30 days minimum)

**Status**: [ ] Pass [ ] Fail

---

### 4.5: Unit Count Discount (Create Test Rule)

**Scenario**: Create a bulk booking discount for 5+ units.

```sql
-- Step 1: Create unit count discount (8% for 5+ units)
INSERT INTO discount_rules (name, description, conditions, discount_type, discount_value, priority)
VALUES (
    'Group Booking Discount',
    '8% off when booking 5 or more units',
    '[{"type": "unit_count", "value": 5}]'::JSONB,
    'percentage',
    8.00,
    2  -- Lower priority than early bird
)
RETURNING id, name, conditions, discount_value;
```

```sql
-- Step 2: Test with 5 units (should qualify)
SELECT calculate_booking_pricing(
    '[
        {"guests_per_unit": 2},
        {"guests_per_unit": 2},
        {"guests_per_unit": 2},
        {"guests_per_unit": 2},
        {"guests_per_unit": 2}
    ]'::JSONB,
    '2025-01-06'::DATE,
    '2025-01-09'::DATE
) AS pricing_result;
```

**Manual Calculation**:

```
Nights: 3
Units: 5 (qualifies for 8% discount)
Guests: 10

Base total: 5 × ₱3,000 × 3 = ₱45,000
Subtotal: ₱45,000

Discount: 8% (unit count ≥ 5)
Discount amount: ₱45,000 × 0.08 = ₱3,600
Total: ₱45,000 - ₱3,600 = ₱41,400
Downpayment (50%): ₱20,700
```

**Verification**:

- `discount.percent` should be 8.00
- `discount.rule_name` should be "Group Booking Discount"
- `total` should be 41400.00

**Status**: [ ] Pass [ ] Fail

```sql
-- Step 3: Test with 4 units (should NOT qualify)
SELECT calculate_booking_pricing(
    '[
        {"guests_per_unit": 2},
        {"guests_per_unit": 2},
        {"guests_per_unit": 2},
        {"guests_per_unit": 2}
    ]'::JSONB,
    '2025-01-06'::DATE,
    '2025-01-09'::DATE
) AS pricing_result;
```

**Expected**: `discount` should be `null` (4 units < 5 minimum)

**Status**: [ ] Pass [ ] Fail

---

## Step 5: Test Edge Cases (20 minutes)

Test boundary conditions and unusual scenarios.

### 5.1: Same-Day Checkout (Invalid)

```sql
-- Test case: Check-in = Check-out (should error)
SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 2}]'::JSONB,
    '2025-01-06'::DATE,
    '2025-01-06'::DATE    -- Same day
) AS pricing_result;
```

**Expected**: ERROR: "Invalid date range"

**Status**: [ ] Pass (error raised) [ ] Fail (no error)

---

### 5.2: Maximum Capacity Per Unit

```sql
-- Test case: 20 guests (max_capacity_per_unit limit)
SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 20}]'::JSONB,
    '2025-01-06'::DATE,
    '2025-01-09'::DATE
) AS pricing_result;
```

**Manual Calculation**:

```
Guests: 20 (base: 2, extra: 18)
Extra person fees: 18 × ₱500 × 3 nights = ₱27,000

Base total: ₱9,000
Extra person fees: ₱27,000
Subtotal: ₱36,000
Total: ₱36,000
```

**Verification**: `extra_person_fees` should be 27000.00

**Status**: [ ] Pass [ ] Fail

---

### 5.3: All Weekend Nights

```sql
-- Test case: Friday → Monday (100% weekend nights)
SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 2}]'::JSONB,
    '2025-01-10'::DATE,   -- Friday
    '2025-01-13'::DATE    -- Monday
) AS pricing_result;
```

**Manual Calculation**:

```
Nights: 3 (Fri→Sat, Sat→Sun, Sun→Mon)
Weekend nights: 2 (Friday, Saturday only)
Note: Sunday is NOT a weekend night (DOW = 0)

Base total: 1 × ₱3,000 × 3 = ₱9,000
Weekend surcharge: 1 × ₱500 × 2 = ₱1,000
Total: ₱10,000
```

**Verification**: `weekend_nights` should be 2 (NOT 3)

**Status**: [ ] Pass [ ] Fail

---

### 5.4: Zero Weekend Nights

```sql
-- Test case: Monday → Thursday (0 weekend nights)
SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 2}]'::JSONB,
    '2025-01-06'::DATE,   -- Monday
    '2025-01-09'::DATE    -- Thursday
) AS pricing_result;
```

**Verification**: `weekend_surcharge` should be 0.00

**Status**: [ ] Pass [ ] Fail

---

## Step 6: Document Test Results (20 minutes)

Create a test suite file for future regression testing.

### 6.1: Create Test Suite File

```bash
# Create test file
touch /Users/jasonacido/repos/okaeri-dev/okaeri-resort-system/__tests__/database/pricing-engine.test.sql
```

### 6.2: Copy Successful Test Cases

Copy all test queries from Steps 2-5 that passed into the test suite file. Add comments documenting expected results.

**Template**:

```sql
-- ============================================
-- PostgreSQL Pricing Engine Test Suite
-- Chunk 002: Pricing Function Validation
-- ============================================

-- TEST 1: Single unit, base occupancy, no weekend
-- Expected: total = 9000.00, discount = null
SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 2}]'::JSONB,
    '2025-01-06'::DATE,
    '2025-01-09'::DATE
);

-- TEST 2: Single unit, extra guests
-- Expected: extra_person_fees = 4500.00, total = 13500.00
SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 5}]'::JSONB,
    '2025-01-06'::DATE,
    '2025-01-09'::DATE
);

-- ... (add all passing tests)
```

**Status**: [ ] Test suite created

---

## Done! ✅

You've successfully validated the PostgreSQL pricing engine.

### What You Accomplished

✅ Tested single-unit and multi-unit pricing calculations
✅ Verified all 4 discount types (duration, date-range, advance-booking, unit-count)
✅ Confirmed best-of discount policy (no stacking)
✅ Validated weekend rate and extra person fee calculations
✅ Tested edge cases and boundary conditions
✅ Created regression test suite for future validation

### Next Steps

1. **Run checkpoint verification** - Open `checkpoint.md` and verify all tests pass
2. **Review troubleshooting guide** - Familiarize yourself with common issues
3. **Commit changes** - Document test results:

   ```bash
   git add __tests__/database/pricing-engine.test.sql
   git commit -m "feat: complete chunk 002-postgresql-pricing-engine

   - Validated calculate_booking_pricing() function with 15+ scenarios
   - Tested all 4 discount types (duration, date-range, advance-booking, unit-count)
   - Verified best-of discount policy (highest discount wins)
   - Created regression test suite for pricing engine

   All checkpoint tests passing.

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude <noreply@anthropic.com>"
   ```

4. **Move to Chunk 003** - Security, RLS, and Constraints

---

**Questions or Issues?** Check `troubleshooting.md` for common problems and solutions.
