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

-- TEST 3: Single unit with weekend nights
-- Expected: weekend_surcharge = 1000.00, total = 10000.00
SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 2}]'::JSONB,
    '2025-01-09'::DATE,   -- Thursday
    '2025-01-12'::DATE    -- Sunday
);

-- TEST 4: Two units, same guest count
-- Expected: total_units = 2, total_guests = 4, total = 18000.00
SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 2}, {"guests_per_unit": 2}]'::JSONB,
    '2025-01-06'::DATE,
    '2025-01-09'::DATE
);

-- TEST 5: Five units with mixed guest counts
-- Expected: total_units = 5, total_guests = 16, extra_person_fees = 9000.00, total = 54000.00
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
);

-- TEST 6: Duration discount (7 nights = 5%)
-- Expected: discount.percent = 5.00, discount.amount = 1100.00, total = 20900.00
SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 2}]'::JSONB,
    '2025-01-06'::DATE,
    '2025-01-13'::DATE    -- 7 nights
);

-- TEST 7: Best-of policy (14 nights qualifies for 5% and 10%)
-- Expected: discount.percent = 10.00 (only highest applies), total = 39600.00
SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 2}]'::JSONB,
    '2025-01-06'::DATE,
    '2025-01-20'::DATE    -- 14 nights
);

-- TEST 8: Maximum capacity per unit
-- Expected: extra_person_fees = 27000.00 (18 extra × 500 × 3 nights)
SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 20}]'::JSONB,
    '2025-01-06'::DATE,
    '2025-01-09'::DATE
);

-- TEST 9: Weekend nights calculation
-- Expected: weekend_surcharge = 1000.00 (2 weekend nights: Fri, Sat)
SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 2}]'::JSONB,
    '2025-01-10'::DATE,   -- Friday
    '2025-01-13'::DATE    -- Monday
);

-- TEST 10: Zero weekend nights
-- Expected: weekend_surcharge = 0.00
SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 2}]'::JSONB,
    '2025-01-06'::DATE,   -- Monday
    '2025-01-09'::DATE    -- Thursday
);

-- TEST 11: Date range discount (requires custom rule)
-- Note: Must first insert Holiday Season Discount rule
-- Expected with rule: discount.percent = 15.00 for holiday dates

-- TEST 12: Advance booking discount (requires custom rule)
-- Note: Must first insert Early Bird Discount rule
-- Expected with rule: discount.percent = 5.00 for 30+ days lead time

-- TEST 13: Unit count discount (requires custom rule)
-- Note: Must first insert Group Booking Discount rule
-- Expected with rule: discount.percent = 8.00 for 5+ units

-- TEST 14: Downpayment calculation
-- Expected: downpayment_required = 50% of total
SELECT
    pricing->>'total' AS total,
    pricing->>'downpayment_required' AS downpayment,
    CASE
        WHEN (pricing->>'downpayment_required')::DECIMAL =
             ((pricing->>'total')::DECIMAL * 0.5) THEN 'PASS'
        ELSE 'FAIL'
    END AS downpayment_test
FROM (
    SELECT calculate_booking_pricing(
        '[{"guests_per_unit": 2}]'::JSONB,
        '2025-01-06'::DATE,
        '2025-01-09'::DATE
    ) AS pricing
) AS test;

-- TEST 15: Error handling - Same day checkout
-- Expected: RAISES ERROR "Invalid date range"
-- Uncomment to test error (will halt execution):
-- SELECT calculate_booking_pricing(
--     '[{"guests_per_unit": 2}]'::JSONB,
--     '2025-01-06'::DATE,
--     '2025-01-06'::DATE    -- Same day
-- );

-- ============================================
-- Validation Query: Verify All Core Fields
-- ============================================
SELECT
    'VALIDATION' AS test_type,
    pricing ? 'version' AS has_version,
    pricing ? 'nights' AS has_nights,
    pricing ? 'total_units' AS has_units,
    pricing ? 'total_guests' AS has_guests,
    pricing ? 'rates' AS has_rates,
    pricing ? 'base_total' AS has_base_total,
    pricing ? 'weekend_surcharge' AS has_weekend,
    pricing ? 'extra_person_fees' AS has_extra_fees,
    pricing ? 'subtotal' AS has_subtotal,
    pricing ? 'discount' AS has_discount,
    pricing ? 'total' AS has_total,
    pricing ? 'downpayment_required' AS has_downpayment,
    pricing ? 'currency' AS has_currency,
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
         AND pricing ? 'currency' THEN 'PASS - All fields present'
        ELSE 'FAIL - Missing fields'
    END AS structure_test
FROM (
    SELECT calculate_booking_pricing(
        '[{"guests_per_unit": 2}]'::JSONB,
        '2025-01-06'::DATE,
        '2025-01-09'::DATE
    ) AS pricing
) AS test;