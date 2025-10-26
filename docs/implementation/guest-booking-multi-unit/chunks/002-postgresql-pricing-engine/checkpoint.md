# Checkpoint: Chunk 002 Verification

## Purpose

This document provides comprehensive verification procedures to ensure the PostgreSQL pricing engine (`calculate_booking_pricing()` function) operates correctly. All tests must pass before proceeding to Chunk 004 (API endpoints that depend on this function).

---

## Automated Checks

Run these SQL queries in Supabase SQL Editor or psql to verify pricing function behavior.

### Check 0: Function Replacement Verified

**Critical First Check**: Verify the full implementation replaced the placeholder from Chunk 001.

```sql
-- Verify full function is active (NOT placeholder)
SELECT
    (pricing->>'version')::TEXT AS version,
    pricing ? 'discount' AS has_discount_support,
    pricing ? 'weekend_surcharge' AS has_weekend_support,
    pricing ? 'extra_person_fees' AS has_extra_person_support,
    CASE
        WHEN (pricing->>'version')::TEXT = '1.0.0'
         AND pricing ? 'discount'
         AND pricing ? 'weekend_surcharge'
         AND pricing ? 'extra_person_fees' THEN '✅ PASS - Full function active'
        WHEN (pricing->>'version')::TEXT LIKE '%stub%' THEN '❌ FAIL - Still using placeholder from Chunk 001'
        ELSE '⚠️ UNKNOWN - Check function implementation'
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
- `status` = '✅ PASS - Full function active'

**Status**: [ ] Pass [ ] Fail

**Critical**: If this check fails, STOP and return to instructions.md Step 0 to replace the placeholder function. Do NOT proceed with remaining checks.

**Time Taken**: **\_\_\_** seconds

---

### Check 1: Function Executes Without Errors

```sql
-- Basic execution test (should return JSONB without errors)
SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 2}]'::JSONB,
    '2025-01-06'::DATE,
    '2025-01-09'::DATE
) AS result;
```

**Expected Output**: JSONB object with pricing breakdown (no errors)

**Status**: [ ] Pass [ ] Fail

**Time Taken**: **\_\_\_** seconds

---

### Check 2: Single-Unit Pricing Accuracy

```sql
-- Test: 1 unit, 2 guests, 3 nights, no weekend
-- Expected total: ₱9,000
SELECT
    (pricing->>'total')::DECIMAL AS total,
    CASE
        WHEN (pricing->>'total')::DECIMAL = 9000.00 THEN '✅ PASS'
        ELSE '❌ FAIL - Expected 9000.00'
    END AS status
FROM (
    SELECT calculate_booking_pricing(
        '[{"guests_per_unit": 2}]'::JSONB,
        '2025-01-06'::DATE,
        '2025-01-09'::DATE
    ) AS pricing
) AS test;
```

**Expected Output**: `status` = '✅ PASS'

**Status**: [ ] Pass [ ] Fail

**Issues (if any)**: ************************\_************************

---

### Check 3: Multi-Unit Pricing Accuracy

```sql
-- Test: 2 units, 2 guests each, 3 nights
-- Expected total: ₱18,000 (double of single unit)
SELECT
    (pricing->>'total_units')::INTEGER AS total_units,
    (pricing->>'total')::DECIMAL AS total,
    CASE
        WHEN (pricing->>'total_units')::INTEGER = 2
         AND (pricing->>'total')::DECIMAL = 18000.00 THEN '✅ PASS'
        ELSE '❌ FAIL - Expected 2 units, ₱18,000 total'
    END AS status
FROM (
    SELECT calculate_booking_pricing(
        '[{"guests_per_unit": 2}, {"guests_per_unit": 2}]'::JSONB,
        '2025-01-06'::DATE,
        '2025-01-09'::DATE
    ) AS pricing
) AS test;
```

**Expected Output**: `status` = '✅ PASS'

**Status**: [ ] Pass [ ] Fail

**Issues (if any)**: ************************\_************************

---

### Check 4: Weekend Night Calculation

```sql
-- Test: Thursday → Sunday (should have 2 weekend nights: Fri, Sat)
-- Expected: weekend_nights not in result, but weekend_surcharge should be > 0
SELECT
    (pricing->>'nights')::INTEGER AS total_nights,
    (pricing->>'weekend_surcharge')::DECIMAL AS weekend_surcharge,
    CASE
        WHEN (pricing->>'nights')::INTEGER = 3
         AND (pricing->>'weekend_surcharge')::DECIMAL = 1000.00 THEN '✅ PASS'
        ELSE '❌ FAIL - Expected 3 nights, ₱1,000 weekend surcharge'
    END AS status
FROM (
    SELECT calculate_booking_pricing(
        '[{"guests_per_unit": 2}]'::JSONB,
        '2025-01-09'::DATE,   -- Thursday
        '2025-01-12'::DATE    -- Sunday
    ) AS pricing
) AS test;
```

**Expected Output**: `status` = '✅ PASS'

**Status**: [ ] Pass [ ] Fail

**Issues (if any)**: ************************\_************************

---

### Check 5: Extra Person Fee Calculation

```sql
-- Test: 1 unit, 5 guests (3 extra beyond base_occupancy of 2)
-- Expected: extra_person_fees = 3 × ₱500 × 3 nights = ₱4,500
SELECT
    (pricing->>'extra_person_fees')::DECIMAL AS extra_person_fees,
    (pricing->>'total')::DECIMAL AS total,
    CASE
        WHEN (pricing->>'extra_person_fees')::DECIMAL = 4500.00
         AND (pricing->>'total')::DECIMAL = 13500.00 THEN '✅ PASS'
        ELSE '❌ FAIL - Expected ₱4,500 extra fees, ₱13,500 total'
    END AS status
FROM (
    SELECT calculate_booking_pricing(
        '[{"guests_per_unit": 5}]'::JSONB,
        '2025-01-06'::DATE,
        '2025-01-09'::DATE
    ) AS pricing
) AS test;
```

**Expected Output**: `status` = '✅ PASS'

**Status**: [ ] Pass [ ] Fail

**Issues (if any)**: ************************\_************************

---

### Check 6: Duration Discount (7 nights = 5%)

```sql
-- Test: 7-night stay should trigger 5% discount
-- Expected: discount.percent = 5.00, total = ₱19,950
SELECT
    (pricing->'discount'->>'percent')::DECIMAL AS discount_percent,
    (pricing->'discount'->>'amount')::DECIMAL AS discount_amount,
    (pricing->>'total')::DECIMAL AS total,
    CASE
        WHEN (pricing->'discount'->>'percent')::DECIMAL = 5.00
         AND (pricing->'discount'->>'amount')::DECIMAL = 1050.00
         AND (pricing->>'total')::DECIMAL = 19950.00 THEN '✅ PASS'
        ELSE '❌ FAIL - Expected 5% discount (₱1,050), total ₱19,950'
    END AS status
FROM (
    SELECT calculate_booking_pricing(
        '[{"guests_per_unit": 2}]'::JSONB,
        '2025-01-06'::DATE,
        '2025-01-13'::DATE    -- 7 nights
    ) AS pricing
) AS test;
```

**Expected Output**: `status` = '✅ PASS'

**Status**: [ ] Pass [ ] Fail

**Issues (if any)**: ************************\_************************

---

### Check 7: Best-Of Discount Policy (14 nights)

```sql
-- Test: 14 nights qualifies for BOTH 5% and 10% discounts
-- Best-of policy: Only 10% (highest) should apply
-- Expected: discount.percent = 10.00 (NOT 5.00 or 15.00)
SELECT
    (pricing->'discount'->>'percent')::DECIMAL AS discount_percent,
    (pricing->'discount'->>'rule_name')::TEXT AS rule_name,
    (pricing->>'total')::DECIMAL AS total,
    CASE
        WHEN (pricing->'discount'->>'percent')::DECIMAL = 10.00
         AND (pricing->'discount'->>'rule_name')::TEXT = 'Two Week Discount'
         AND (pricing->>'total')::DECIMAL = 37800.00 THEN '✅ PASS'
        ELSE '❌ FAIL - Expected 10% discount only (best-of), total ₱37,800'
    END AS status
FROM (
    SELECT calculate_booking_pricing(
        '[{"guests_per_unit": 2}]'::JSONB,
        '2025-01-06'::DATE,
        '2025-01-20'::DATE    -- 14 nights
    ) AS pricing
) AS test;
```

**Expected Output**: `status` = '✅ PASS' (confirms no stacking)

**Status**: [ ] Pass [ ] Fail

**Issues (if any)**: ************************\_************************

---

### Check 8: Downpayment Calculation

```sql
-- Test: Downpayment should be 50% of total
-- Example: ₱9,000 total → ₱4,500 downpayment
SELECT
    (pricing->>'total')::DECIMAL AS total,
    (pricing->>'downpayment_required')::DECIMAL AS downpayment,
    (pricing->>'downpayment_percent')::DECIMAL AS downpayment_percent,
    CASE
        WHEN (pricing->>'downpayment_required')::DECIMAL =
             ((pricing->>'total')::DECIMAL * 0.5) THEN '✅ PASS'
        ELSE '❌ FAIL - Downpayment should be 50% of total'
    END AS status
FROM (
    SELECT calculate_booking_pricing(
        '[{"guests_per_unit": 2}]'::JSONB,
        '2025-01-06'::DATE,
        '2025-01-09'::DATE
    ) AS pricing
) AS test;
```

**Expected Output**: `status` = '✅ PASS'

**Status**: [ ] Pass [ ] Fail

**Issues (if any)**: ************************\_************************

---

### Check 9: JSONB Result Structure

```sql
-- Test: Result contains all required fields
SELECT
    CASE
        WHEN pricing ? 'version'
         AND pricing ? 'nights'
         AND pricing ? 'total_units'
         AND pricing ? 'total_guests'
         AND pricing ? 'rates'
         AND pricing ? 'base_total'
         AND pricing ? 'weekend_surcharge'
         AND pricing ? 'extra_person_fees'
         AND pricing ? 'subtotal'
         AND pricing ? 'total'
         AND pricing ? 'downpayment_required'
         AND pricing ? 'currency' THEN '✅ PASS'
        ELSE '❌ FAIL - Missing required fields'
    END AS status,
    jsonb_object_keys(pricing) AS available_keys
FROM (
    SELECT calculate_booking_pricing(
        '[{"guests_per_unit": 2}]'::JSONB,
        '2025-01-06'::DATE,
        '2025-01-09'::DATE
    ) AS pricing
) AS test;
```

**Expected Output**: `status` = '✅ PASS'

**Status**: [ ] Pass [ ] Fail

**Issues (if any)**: ************************\_************************

---

## Manual Checks

Perform these verification steps to ensure comprehensive pricing validation.

### Manual Check 1: Create and Test Custom Discount Rules

**Steps**:

1. Create a unit_count discount (8% for 5+ units)
2. Test with 5 units - discount should apply
3. Test with 4 units - discount should NOT apply
4. Verify best-of policy if multiple discounts qualify

**Expected Behavior**: Unit count discount applies only when condition is met

**Status**: [ ] Pass [ ] Fail

**Notes**: ************************\_************************

---

### Manual Check 2: Date Range Discount

**Steps**:

1. Create a seasonal discount (e.g., 15% for Dec 20 - Jan 5)
2. Test with check-in WITHIN date range - discount should apply
3. Test with check-in OUTSIDE date range - discount should NOT apply

**Expected Behavior**: Date range discount applies only for check-ins within the specified range

**Status**: [ ] Pass [ ] Fail

**Notes**: ************************\_************************

---

### Manual Check 3: Advance Booking Discount

**Steps**:

1. Create an early-bird discount (5% for 30+ days lead time)
2. Test with check-in 45 days from today - discount should apply
3. Test with check-in 15 days from today - discount should NOT apply

**Expected Behavior**: Advance booking discount applies based on days between CURRENT_DATE and check-in

**Status**: [ ] Pass [ ] Fail

**Notes**: ************************\_************************

---

### Manual Check 4: Edge Cases

**Scenarios to Test**:

- [ ] Same-day checkout (check-in = check-out) → Should raise "Invalid date range" error
- [ ] Maximum capacity (20 guests per unit) → Extra person fees should be 18 × ₱500 × nights
- [ ] All weekend nights (Fri → Mon) → Weekend surcharge for Fri-Sat only (2 nights)
- [ ] Zero weekend nights (Mon → Thu) → Weekend surcharge = ₱0

**Status**: [ ] All edge cases pass [ ] Some failures

**Notes**: ************************\_************************

---

## Success Criteria

Mark each criterion as you verify it:

### Core Pricing Functionality

- [ ] Function executes without errors for valid inputs
- [ ] Single-unit pricing calculates correctly (base rate × nights)
- [ ] Multi-unit pricing scales correctly (units × rate × nights)
- [ ] Weekend nights identified correctly (Friday = 5, Saturday = 6)
- [ ] Weekend surcharge calculated accurately
- [ ] Extra person fees apply correctly (beyond base_occupancy)
- [ ] Downpayment calculated as 50% of total

### Discount Engine

- [ ] Duration discount (7 nights) applies 5% discount
- [ ] Duration discount (14 nights) applies 10% discount (best-of policy)
- [ ] Date range discount applies only for check-ins within range
- [ ] Advance booking discount applies based on lead time
- [ ] Unit count discount applies for 5+ units
- [ ] Best-of policy confirmed (highest discount wins, no stacking)
- [ ] Discount = null when no rules match

### Data Integrity

- [ ] JSONB result contains all required fields
- [ ] `version` field present (indicates schema version)
- [ ] `currency` field = 'PHP'
- [ ] All numeric values rounded to 2 decimal places
- [ ] Rates fetched from `pricing_config` table (not hardcoded)

### Error Handling

- [ ] Invalid date range (check-in ≥ check-out) raises error
- [ ] Missing pricing_config row raises error
- [ ] Negative guest count handled gracefully

---

## If Any Check Fails

### Step 1: Identify the Failure

Record which check failed and what the actual output was:

**Failed Check**: ************************\_************************

**Expected Output**: ************************\_************************

**Actual Output**: ************************\_************************

---

### Step 2: Diagnose the Issue

Common causes:

1. **Pricing config missing or incorrect**

   ```sql
   -- Verify pricing_config
   SELECT * FROM pricing_config WHERE id = 'default';
   ```

2. **Discount rules inactive or incorrectly configured**

   ```sql
   -- Verify active discount rules
   SELECT name, conditions, discount_value, priority, is_active
   FROM discount_rules
   WHERE is_active = TRUE
   ORDER BY priority ASC;
   ```

3. **Function definition outdated**
   ```sql
   -- Check function definition
   SELECT prosrc FROM pg_proc WHERE proname = 'calculate_booking_pricing';
   ```

---

### Step 3: Consult Troubleshooting Guide

Open `troubleshooting.md` for detailed solutions to common issues.

---

## When All Checks Pass

### Commit Your Changes

```bash
# Stage test suite file (if created)
git add __tests__/database/pricing-engine.test.sql

# Commit with descriptive message
git commit -m "feat: complete chunk 002-postgresql-pricing-engine

- Validated calculate_booking_pricing() function with 15+ test scenarios
- Tested all 4 discount types (duration, date-range, advance-booking, unit-count)
- Verified best-of discount policy (highest discount wins, no stacking)
- Confirmed weekend rate and extra person fee calculations
- Created regression test suite for pricing engine

All checkpoint tests passing.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Update Progress Tracker

Mark Chunk 002 as complete:

- [x] Chunk 001: Database Schema Setup
- [x] Chunk 002: PostgreSQL Pricing Engine ← **YOU ARE HERE**
- [ ] Chunk 003: Security, RLS, and Constraints ← **NEXT**
- [ ] Chunk 004: Core API Endpoints

---

### Next Chunk

**Ready for Chunk 003: Security, RLS, and Constraints**

**Prerequisites for Chunk 003**: Chunk 001 completed (tables created). Chunk 002 is independent.

**What Chunk 003 builds**:

- All-or-nothing assignment constraint
- Payment-before-assignment constraint
- Concurrency control (PostgreSQL EXCLUDE constraint)
- Row Level Security policies

---

## Verification Summary

| Check                             | Status            | Time Taken | Notes                                        |
| --------------------------------- | ----------------- | ---------- | -------------------------------------------- |
| **Check 0: Function Replacement** | [ ] Pass [ ] Fail | **\_** sec | **CRITICAL** - Must pass before other checks |
| Function Execution                | [ ] Pass [ ] Fail | **\_** sec |                                              |
| Single-Unit Pricing               | [ ] Pass [ ] Fail | **\_** sec |                                              |
| Multi-Unit Pricing                | [ ] Pass [ ] Fail | **\_** sec |                                              |
| Weekend Calculation               | [ ] Pass [ ] Fail | **\_** sec |                                              |
| Extra Person Fees                 | [ ] Pass [ ] Fail | **\_** sec |                                              |
| Duration Discount                 | [ ] Pass [ ] Fail | **\_** sec |                                              |
| Best-Of Policy                    | [ ] Pass [ ] Fail | **\_** sec |                                              |
| Downpayment Calc                  | [ ] Pass [ ] Fail | **\_** sec |                                              |
| JSONB Structure                   | [ ] Pass [ ] Fail | **\_** sec |                                              |
| Custom Discounts                  | [ ] Pass [ ] Fail | **\_** min |                                              |
| Edge Cases                        | [ ] Pass [ ] Fail | **\_** min |                                              |

**Overall Status**: [ ] All Passed [ ] Some Failures

**Total Time**: **\_\_\_** minutes

**Ready for Chunk 003?** [ ] Yes [ ] No (address failures first)

---

**Questions or Issues?** Check `troubleshooting.md` for solutions to common problems.
