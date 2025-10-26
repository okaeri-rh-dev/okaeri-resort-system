# Troubleshooting: Chunk 002

## Common Issues and Solutions

This guide provides solutions to common problems encountered when implementing and testing the PostgreSQL pricing engine.

---

## Issue 0: Still Using Placeholder Function

### Symptom

Checkpoint Check 0 fails with:

- `version` = '1.0.0-stub' (instead of '1.0.0')
- `status` = '❌ FAIL - Still using placeholder from Chunk 001'
- Test queries return incomplete results (missing discount logic, weekend calculations, etc.)

### Cause

The placeholder function from Chunk 001 was not replaced with the full implementation in Step 0 of instructions.md.

### Root Causes

1. **Step 0 was skipped** - User proceeded directly to testing without replacing function
2. **Function replacement failed silently** - SQL syntax error occurred but was not noticed
3. **Wrong database connection** - Executing against development database while testing production
4. **Insufficient permissions** - Database user lacks CREATE OR REPLACE FUNCTION privilege

### Solution

#### Step 1: Verify Current Function Implementation

```sql
-- Check function source code length (placeholder ≈ 20 lines, full ≈ 133 lines)
SELECT
    routine_name,
    LENGTH(prosrc) AS source_code_length,
    CASE
        WHEN LENGTH(prosrc) > 3000 THEN '✅ Full implementation (expected)'
        WHEN LENGTH(prosrc) < 500 THEN '❌ Placeholder stub (needs replacement)'
        ELSE '⚠️ Unknown state'
    END AS implementation_status
FROM information_schema.routines
JOIN pg_proc ON routine_name = proname
WHERE routine_schema = 'public'
  AND routine_name = 'calculate_booking_pricing';
```

**Expected**: `source_code_length` > 3000, `implementation_status` = '✅ Full implementation'

---

#### Step 2: Identify Placeholder Indicators

```sql
-- Check for placeholder-specific version string
SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 2}]'::JSONB,
    '2025-01-06'::DATE,
    '2025-01-09'::DATE
)->>'version' AS current_version;
```

**Placeholder version**: '1.0.0-stub'
**Full version**: '1.0.0'

---

#### Step 3: Replace with Full Implementation

Execute the complete function from instructions.md Step 0.2 or source documentation:

```sql
-- Full implementation source locations:
-- 1. instructions.md (lines 44-183) - Copy-paste ready
-- 2. docs/implementation/guest-booking-multi-unit/01-database-schema.md (lines 240-373)

CREATE OR REPLACE FUNCTION calculate_booking_pricing(
    p_unit_requests JSONB,
    p_check_in DATE,
    p_check_out DATE
) RETURNS JSONB AS $$
-- [Full 133-line implementation here]
-- See instructions.md Step 0.2 for complete code
$$ LANGUAGE plpgsql STABLE;
```

**Important**: Use `CREATE OR REPLACE` (NOT just `CREATE`) to overwrite the placeholder.

---

#### Step 4: Verify Replacement Success

```sql
-- Comprehensive verification query
SELECT
    (pricing->>'version')::TEXT AS version,
    pricing ? 'discount' AS has_discount_engine,
    pricing ? 'weekend_surcharge' AS has_weekend_logic,
    pricing ? 'extra_person_fees' AS has_extra_person_logic,
    jsonb_object_keys(pricing) AS all_keys,
    CASE
        WHEN (pricing->>'version')::TEXT = '1.0.0'
         AND pricing ? 'discount'
         AND pricing ? 'weekend_surcharge' THEN '✅ REPLACEMENT SUCCESSFUL'
        ELSE '❌ REPLACEMENT FAILED'
    END AS status
FROM (
    SELECT calculate_booking_pricing(
        '[{"guests_per_unit": 2}]'::JSONB,
        '2025-01-06'::DATE,
        '2025-01-09'::DATE
    ) AS pricing
) AS test;
```

**Expected**: `status` = '✅ REPLACEMENT SUCCESSFUL'

---

#### Step 5: Test Discount Logic (Ultimate Proof)

The placeholder function cannot calculate discounts. This test proves full implementation is active:

```sql
-- Test 7-night stay (should trigger 5% discount if full function is active)
SELECT
    (pricing->'discount'->>'percent')::DECIMAL AS discount_percent,
    (pricing->'discount'->>'rule_name')::TEXT AS rule_name,
    CASE
        WHEN pricing->'discount' IS NOT NULL
         AND (pricing->'discount'->>'percent')::DECIMAL = 5.00 THEN '✅ FULL FUNCTION CONFIRMED'
        WHEN pricing->'discount' IS NULL THEN '❌ STILL PLACEHOLDER (no discount capability)'
        ELSE '⚠️ UNKNOWN STATE'
    END AS final_status
FROM (
    SELECT calculate_booking_pricing(
        '[{"guests_per_unit": 2}]'::JSONB,
        '2025-01-06'::DATE,
        '2025-01-13'::DATE  -- 7 nights
    ) AS pricing
) AS test;
```

**Expected**: `final_status` = '✅ FULL FUNCTION CONFIRMED', `rule_name` = 'Week Stay Discount'

---

### Common Mistakes

1. **Forgot Step 0** - Jumped directly to testing without replacing placeholder
   - Solution: Read instructions.md from the beginning, don't skip steps

2. **SQL Syntax Error** - Function replacement failed but error was ignored
   - Solution: Check SQL execution log for errors after running CREATE OR REPLACE

3. **Wrong Environment** - Replaced function in dev database, testing in production
   - Solution: Verify `VITE_SUPABASE_URL` in .env.local matches target database

4. **Permissions Issue** - User cannot CREATE OR REPLACE functions
   - Solution: Use service_role key (admin) or grant necessary permissions

---

## Issue 1: Function Not Found

### Symptom

```
ERROR: function calculate_booking_pricing(jsonb, date, date) does not exist
```

### Cause

The function was not created in Chunk 001, or the migration failed.

### Solution

#### Step 1: Verify Function Exists

```sql
SELECT
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'calculate_booking_pricing';
```

**Expected Output**: 1 row with `routine_type` = 'FUNCTION'

#### Step 2: If Function Missing, Re-run Chunk 001

```sql
-- Re-run the calculate_booking_pricing function creation from Chunk 001 migration
-- See: docs/implementation/guest-booking-multi-unit/chunks/001-database-schema-setup/instructions.md
-- Locate the CREATE FUNCTION calculate_booking_pricing section and execute it
```

#### Step 3: Verify Creation

```sql
-- Test basic execution
SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 2}]'::JSONB,
    '2025-01-06'::DATE,
    '2025-01-09'::DATE
);
```

---

## Issue 2: Incorrect Pricing Totals

### Symptom

The `total` field in the JSONB result doesn't match manual calculations.

### Cause

1. Incorrect `pricing_config` values
2. Weekend nights miscounted
3. Extra person fee logic error
4. Discount applied incorrectly

### Solution

#### Step 1: Verify Pricing Config

```sql
-- Check current pricing configuration
SELECT
    base_rate,
    weekend_rate,
    extra_person_rate,
    base_occupancy,
    downpayment_percent
FROM pricing_config
WHERE id = 'default';
```

**Expected Values**:

- `base_rate` = 3000.00
- `weekend_rate` = 3500.00
- `extra_person_rate` = 500.00
- `base_occupancy` = 2
- `downpayment_percent` = 50.00

**If values are wrong**:

```sql
-- Update pricing config
UPDATE pricing_config
SET base_rate = 3000.00,
    weekend_rate = 3500.00,
    extra_person_rate = 500.00,
    base_occupancy = 2,
    downpayment_percent = 50.00
WHERE id = 'default';
```

#### Step 2: Debug Pricing Breakdown

```sql
-- Get detailed pricing breakdown
SELECT
    pricing->'rates' AS configured_rates,
    pricing->>'base_total' AS base_total,
    pricing->>'weekend_surcharge' AS weekend_surcharge,
    pricing->>'extra_person_fees' AS extra_person_fees,
    pricing->>'subtotal' AS subtotal,
    pricing->'discount' AS discount,
    pricing->>'total' AS final_total
FROM (
    SELECT calculate_booking_pricing(
        '[{"guests_per_unit": 2}]'::JSONB,
        '2025-01-06'::DATE,
        '2025-01-09'::DATE
    ) AS pricing
) AS debug;
```

#### Step 3: Manual Recalculation

Use this formula:

```
Base Total = total_units × base_rate × nights
Weekend Surcharge = total_units × (weekend_rate - base_rate) × weekend_nights
Extra Person Fees = SUM(per unit: (guests - base_occupancy) × extra_person_rate × nights)
Subtotal = Base Total + Weekend Surcharge + Extra Person Fees
Discount Amount = Subtotal × (discount_percent / 100)
Total = Subtotal - Discount Amount
Downpayment = Total × (downpayment_percent / 100)
```

---

## Issue 3: Discount Not Applying

### Symptom

Expected discount to apply, but `discount` field is `null` in result.

### Cause

1. Discount rule is inactive (`is_active = FALSE`)
2. Condition not met (e.g., 6 nights when minimum is 7)
3. Discount rule doesn't exist
4. Condition JSONB malformed

### Solution

#### Step 1: Verify Active Discount Rules

```sql
-- List all active discount rules
SELECT
    id,
    name,
    conditions,
    discount_value,
    priority,
    is_active
FROM discount_rules
WHERE is_active = TRUE
ORDER BY priority ASC;
```

**Expected Output**: At least 4 duration-based discount rules

#### Step 2: Check Specific Rule Condition

For **duration discounts**:

```sql
-- Verify 7-night discount rule
SELECT
    name,
    conditions->>0->>'type' AS condition_type,
    conditions->>0->>'value' AS min_nights,
    discount_value
FROM discount_rules
WHERE name = 'Week Stay Discount';
```

**Expected**: `condition_type` = 'min_nights', `min_nights` = 7

#### Step 3: Test Condition Matching

```sql
-- Debug: Check which rules match for a specific booking
WITH test_booking AS (
    SELECT
        7 AS nights,  -- Your test case
        1 AS total_units,
        '2025-01-06'::DATE AS check_in_date
)
SELECT
    dr.name,
    dr.conditions,
    dr.discount_value,
    -- Duration discount check
    CASE
        WHEN dr.conditions @> '[{"type": "min_nights"}]'::jsonb
         AND (SELECT nights FROM test_booking) >= (dr.conditions->0->>'value')::INTEGER
        THEN '✅ MATCHES'
        ELSE '❌ NO MATCH'
    END AS duration_match,
    -- Unit count check
    CASE
        WHEN dr.conditions @> '[{"type": "unit_count"}]'::jsonb
         AND (SELECT total_units FROM test_booking) >= (dr.conditions->0->>'value')::INTEGER
        THEN '✅ MATCHES'
        ELSE '❌ NO MATCH'
    END AS unit_count_match
FROM discount_rules dr
WHERE dr.is_active = TRUE
ORDER BY dr.discount_value DESC, dr.priority ASC;
```

#### Step 4: Activate Inactive Rule (If Needed)

```sql
-- Enable a specific discount rule
UPDATE discount_rules
SET is_active = TRUE
WHERE name = 'Week Stay Discount';
```

---

## Issue 4: Wrong Discount Amount (Stacking Issue)

### Symptom

Discount amount is higher than expected, suggesting multiple discounts are stacking.

### Cause

Best-of policy not working correctly (function bug, unlikely if Chunk 001 migration succeeded).

### Solution

#### Step 1: Verify Best-Of Policy

```sql
-- Test case: 14 nights should get 10% discount (NOT 5% + 10% = 15%)
SELECT
    pricing->'discount'->>'percent' AS discount_percent,
    pricing->'discount'->>'rule_name' AS rule_applied,
    pricing->>'subtotal' AS subtotal,
    pricing->'discount'->>'amount' AS discount_amount,
    pricing->>'total' AS total
FROM (
    SELECT calculate_booking_pricing(
        '[{"guests_per_unit": 2}]'::JSONB,
        '2025-01-06'::DATE,
        '2025-01-20'::DATE    -- 14 nights
    ) AS pricing
) AS test;
```

**Expected**:

- `discount_percent` = 10.00 (NOT 15.00)
- `rule_applied` = 'Two Week Discount'
- `discount_amount` = subtotal × 0.10

#### Step 2: Check Function Logic

```sql
-- View function source code (check ORDER BY clause)
SELECT prosrc
FROM pg_proc
WHERE proname = 'calculate_booking_pricing';
```

**Look for this line** (around line 338 in original function):

```sql
ORDER BY discount_value DESC, priority ASC, created_at ASC
LIMIT 1;
```

**This ensures only the highest discount is selected.**

#### Step 3: Re-create Function (If Logic Broken)

Re-run the `CREATE OR REPLACE FUNCTION calculate_booking_pricing` section from Chunk 001 migration.

---

## Issue 5: Weekend Nights Incorrect

### Symptom

Weekend surcharge is wrong because weekend nights are miscounted.

### Cause

PostgreSQL `EXTRACT(DOW)` returns 0-6 where:

- 0 = Sunday
- 1 = Monday
- ...
- 5 = Friday
- 6 = Saturday

The function only counts Friday (5) and Saturday (6) as weekend nights.

### Solution

#### Step 1: Verify Weekend Logic

```sql
-- Test: Thursday → Sunday should have 2 weekend nights (Fri, Sat)
SELECT
    pricing->>'nights' AS total_nights,
    pricing->>'weekend_surcharge' AS weekend_surcharge,
    -- Expected: 1 unit × ₱500 × 2 weekend nights = ₱1,000
    CASE
        WHEN (pricing->>'weekend_surcharge')::DECIMAL = 1000.00 THEN '✅ CORRECT'
        ELSE '❌ INCORRECT - Expected ₱1,000'
    END AS status
FROM (
    SELECT calculate_booking_pricing(
        '[{"guests_per_unit": 2}]'::JSONB,
        '2025-01-09'::DATE,   -- Thursday
        '2025-01-12'::DATE    -- Sunday
    ) AS pricing
) AS test;
```

#### Step 2: Manual Weekend Count

**Date Range**: Jan 9 (Thu) → Jan 12 (Sun)

**Nights**:

1. Thu → Fri (DOW 4 → 5): **Fri = weekend ✅**
2. Fri → Sat (DOW 5 → 6): **Sat = weekend ✅**
3. Sat → Sun (DOW 6 → 0): **Sun = NOT weekend ❌**

**Weekend nights**: 2 (Fri, Sat only)

#### Step 3: Common Mistake

**Incorrect assumption**: "Fri-Sun = 3 weekend nights"
**Correct logic**: Only Friday (DOW 5) and Saturday (DOW 6) are weekend nights

**Sunday is NOT a weekend night** in the pricing engine (business decision).

---

## Issue 6: Extra Person Fees Not Applied

### Symptom

`extra_person_fees` is 0 when guests exceed `base_occupancy`.

### Cause

1. `base_occupancy` set incorrectly in `pricing_config`
2. Function logic error (unlikely)

### Solution

#### Step 1: Verify Base Occupancy

```sql
SELECT base_occupancy
FROM pricing_config
WHERE id = 'default';
```

**Expected**: 2

**If wrong**:

```sql
UPDATE pricing_config
SET base_occupancy = 2
WHERE id = 'default';
```

#### Step 2: Test Extra Person Logic

```sql
-- Test: 5 guests should have 3 extra persons (5 - 2 base = 3)
SELECT
    pricing->>'total_guests' AS total_guests,
    (pricing->'rates'->>'base_occupancy')::INTEGER AS base_occupancy,
    pricing->>'extra_person_fees' AS extra_person_fees,
    -- Expected: 3 extra × ₱500 × 3 nights = ₱4,500
    CASE
        WHEN (pricing->>'extra_person_fees')::DECIMAL = 4500.00 THEN '✅ CORRECT'
        ELSE '❌ INCORRECT - Expected ₱4,500'
    END AS status
FROM (
    SELECT calculate_booking_pricing(
        '[{"guests_per_unit": 5}]'::JSONB,
        '2025-01-06'::DATE,
        '2025-01-09'::DATE
    ) AS pricing
) AS test;
```

---

## Issue 7: Invalid Date Range Error

### Symptom

```
ERROR: Invalid date range
```

### Cause

`check_in_date >= check_out_date` (same day or past dates).

### Solution

#### Verify Date Order

```sql
-- This SHOULD error (same day)
SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 2}]'::JSONB,
    '2025-01-06'::DATE,
    '2025-01-06'::DATE    -- Same day = invalid
);
```

**Expected**: ERROR message

**Fix**: Ensure `check_out_date > check_in_date` (at least 1 night).

---

## Issue 8: JSONB Field Missing

### Symptom

Expected field like `discount` or `weekend_surcharge` is missing from result.

### Cause

Function returns `null` for optional fields when not applicable.

### Solution

#### Handle Null Fields

```sql
-- Discount can be null when no rules match
SELECT
    COALESCE(pricing->'discount'->>'percent', '0')::DECIMAL AS discount_percent,
    COALESCE(pricing->'discount'->>'amount', '0')::DECIMAL AS discount_amount
FROM (
    SELECT calculate_booking_pricing(
        '[{"guests_per_unit": 2}]'::JSONB,
        '2025-01-06'::DATE,
        '2025-01-09'::DATE    -- 3 nights, no discount
    ) AS pricing
) AS test;
```

**Expected**: `discount_percent` = 0, `discount_amount` = 0 (when no discount applies)

---

## Issue 9: Custom Discount Rule Not Working

### Symptom

Created a new discount rule (e.g., unit_count or date_range), but it's not applying.

### Cause

1. Rule is inactive
2. JSONB condition malformed
3. Priority too low (another rule wins)
4. Condition not met

### Solution

#### Step 1: Verify Rule Creation

```sql
-- Check if rule exists and is active
SELECT
    id,
    name,
    conditions,
    discount_value,
    priority,
    is_active
FROM discount_rules
WHERE name = 'Your Rule Name';
```

#### Step 2: Test Condition Syntax

**Unit Count Discount** (correct format):

```sql
'[{"type": "unit_count", "value": 5}]'::JSONB
```

**Date Range Discount** (correct format):

```sql
'[{"type": "date_range", "value": ["2025-12-20", "2026-01-05"]}]'::JSONB
```

**Advance Booking** (correct format):

```sql
'[{"type": "advance_booking", "value": 30}]'::JSONB
```

#### Step 3: Verify Priority

```sql
-- Check if higher priority rule is winning
SELECT
    name,
    discount_value,
    priority,
    CASE
        WHEN discount_value > (SELECT MAX(discount_value) FROM discount_rules WHERE name != dr.name)
        THEN '✅ HIGHEST DISCOUNT'
        ELSE '⚠️ Lower than another rule'
    END AS best_of_status
FROM discount_rules dr
WHERE is_active = TRUE
ORDER BY discount_value DESC, priority ASC;
```

**Best-of policy**: Rule with highest `discount_value` wins. If tied, lowest `priority` wins.

#### Step 4: Set High Priority (If Needed)

```sql
-- Make your rule highest priority
UPDATE discount_rules
SET priority = 0  -- 0 = highest priority
WHERE name = 'Your Rule Name';
```

---

## Issue 10: Function Execution Slow

### Symptom

Pricing function takes >1 second to execute.

### Cause

1. Missing indexes on `discount_rules`
2. `pricing_config` table has multiple rows (should be singleton)
3. Database connection pooling issues

### Solution

#### Step 1: Verify Indexes

```sql
-- Check discount_rules indexes
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'discount_rules';
```

**Expected Indexes**:

- `idx_discount_rules_active` (on `is_active, priority DESC`)
- `idx_discount_rules_conditions` (GIN index on `conditions`)

**If missing**:

```sql
CREATE INDEX idx_discount_rules_active
ON discount_rules(is_active, priority DESC)
WHERE is_active = TRUE;

CREATE INDEX idx_discount_rules_conditions
ON discount_rules USING gin(conditions);
```

#### Step 2: Verify Singleton Pricing Config

```sql
-- Should return only 1 row
SELECT COUNT(*) AS row_count
FROM pricing_config;
```

**Expected**: `row_count` = 1

**If > 1**:

```sql
-- Delete extra rows (keep only 'default')
DELETE FROM pricing_config
WHERE id != 'default';
```

#### Step 3: Analyze Query Performance

```sql
-- Get execution plan
EXPLAIN ANALYZE
SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 2}]'::JSONB,
    '2025-01-06'::DATE,
    '2025-01-09'::DATE
);
```

---

## Still Stuck?

### Escalation Path

If you've tried all solutions above and the issue persists:

1. **Check Source Documentation**
   - Re-read `docs/implementation/guest-booking-multi-unit/01-database-schema.md` (lines 135-373)
   - Verify function implementation matches specification

2. **Verify Chunk 001 Completion**
   - Open `chunks/001-database-schema-setup/checkpoint.md`
   - Ensure all Chunk 001 tests passed

3. **Database State Audit**

   ```sql
   -- Full database state check
   SELECT 'pricing_config' AS table_name, COUNT(*) AS row_count FROM pricing_config
   UNION ALL
   SELECT 'discount_rules', COUNT(*) FROM discount_rules WHERE is_active = TRUE;
   ```

4. **Function Re-creation**
   - Drop and re-create function from Chunk 001 migration

   ```sql
   DROP FUNCTION IF EXISTS calculate_booking_pricing;
   -- Then re-run CREATE FUNCTION from Chunk 001
   ```

5. **Seek Help**
   - Document the issue: What you expected, what happened, what you tried
   - Share checkpoint test results and error messages
   - Provide `SELECT version()` output (PostgreSQL version)

---

## Debugging Template

Use this template when reporting issues:

````
**Issue Summary**: [Brief description]

**Expected Behavior**: [What should happen]

**Actual Behavior**: [What actually happened]

**Test Query Used**:
```sql
[Copy-paste your SQL query]
````

**Output Received**:

```
[Copy-paste error or unexpected result]
```

**Environment**:

- PostgreSQL Version: [Run SELECT version()]
- Chunk 001 Status: [Completed / Partial / Failed]
- Pricing Config Row Count: [Run SELECT COUNT(*) FROM pricing_config]
- Active Discount Rules: [Run SELECT COUNT(*) FROM discount_rules WHERE is_active = TRUE]

**Steps Tried**:

1. [What you've attempted]
2. [From troubleshooting guide]
3. [...]

**Additional Context**: [Any other relevant information]

```

---

**Return to**: `checkpoint.md` to continue verification after resolving issues.
```
