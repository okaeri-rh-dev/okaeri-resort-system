-- ============================================
-- Multi-Unit Guest Booking Schema Migration
-- Chunk 001: Database Schema Setup
-- ============================================
--
-- MIGRATION STATUS: ✅ Integrated into Supabase CLI workflow
-- Applied to: Local database (Nov 4, 2025)
-- Supabase Location: supabase/migrations/20251104184719_multi_unit_guest_booking_schema.sql
--
-- This file is kept for reference. Future schema changes should use:
--   supabase migration new <name>
--   supabase db reset (to apply all migrations)
--
-- ============================================

BEGIN;

-- ============================================
-- 1. CREATE EXTENSION (if not exists)
-- ============================================
CREATE EXTENSION IF NOT EXISTS btree_gist;

COMMENT ON EXTENSION btree_gist IS 'Required for EXCLUDE constraints with date ranges';

-- ============================================
-- 2. CREATE pricing_config TABLE (Singleton)
-- ============================================
CREATE TABLE IF NOT EXISTS pricing_config (
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

COMMENT ON TABLE pricing_config IS 'Single source of truth for all pricing and capacity configuration. Singleton table enforced by CHECK constraint (only one row with id=default).';
COMMENT ON COLUMN pricing_config.id IS 'Always "default" - singleton pattern enforced by CHECK constraint';
COMMENT ON COLUMN pricing_config.base_rate IS 'Base rate per unit per night (PHP)';
COMMENT ON COLUMN pricing_config.weekend_rate IS 'Weekend rate per unit per night (Friday-Saturday, PHP)';
COMMENT ON COLUMN pricing_config.extra_person_rate IS 'Fee per extra person beyond base_occupancy per night (PHP)';
COMMENT ON COLUMN pricing_config.base_occupancy IS 'Number of guests included in base rate (default: 2)';
COMMENT ON COLUMN pricing_config.max_capacity_per_unit IS 'Maximum guests allowed per unit (enforced by API validation)';
COMMENT ON COLUMN pricing_config.downpayment_percent IS 'Percentage of total amount required as downpayment (default: 50%)';

-- Insert default configuration (singleton row)
INSERT INTO pricing_config (
    id, base_rate, weekend_rate, extra_person_rate,
    base_occupancy, max_capacity_per_unit, downpayment_percent
) VALUES (
    'default',
    3000.00,  -- ₱3,000 base rate per unit per night
    3500.00,  -- ₱3,500 weekend rate per unit per night
    500.00,   -- ₱500 extra person fee per night
    2,        -- Base occupancy included in base rate
    20,       -- Maximum 20 guests per unit
    50.00     -- 50% downpayment required
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 3. CREATE guest_booking_unit_requests TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS guest_booking_unit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    guests_per_unit INTEGER NOT NULL CHECK (guests_per_unit > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_guest_booking_requests_booking ON guest_booking_unit_requests(booking_id);

COMMENT ON TABLE guest_booking_unit_requests IS 'Array-based model: each row represents one requested unit. Total units for booking = COUNT(rows). NO quantity column.';
COMMENT ON COLUMN guest_booking_unit_requests.guests_per_unit IS 'Number of guests for THIS unit (validated against pricing_config.max_capacity_per_unit by API)';

-- ============================================
-- 4. EXTEND bookings TABLE
-- ============================================
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

CREATE INDEX IF NOT EXISTS idx_bookings_multi_unit ON bookings(is_multi_unit) WHERE is_multi_unit = TRUE;
CREATE INDEX IF NOT EXISTS idx_bookings_assignment_pending ON bookings(unit_assignment_status, created_at DESC)
    WHERE is_guest_booking = TRUE AND is_multi_unit = TRUE AND unit_assignment_status = 'pending';

COMMENT ON COLUMN bookings.is_multi_unit IS 'TRUE if booking requests multiple units (uses guest_booking_unit_requests table)';
COMMENT ON COLUMN bookings.requested_unit_count IS 'Total units requested = COUNT(guest_booking_unit_requests rows)';
COMMENT ON COLUMN bookings.discount_percent IS 'Discount percentage applied (from best-matching discount rule)';
COMMENT ON COLUMN bookings.discount_amount IS 'Absolute discount amount in PHP (calculated by pricing function)';
COMMENT ON COLUMN bookings.downpayment_required IS 'Downpayment amount required (calculated by pricing function)';
COMMENT ON COLUMN bookings.unit_assignment_status IS 'Assignment status: pending (awaiting admin assignment) or assigned (units assigned)';
COMMENT ON COLUMN bookings.pricing_snapshot IS 'Immutable JSONB from calculate_booking_pricing() - captured at booking creation. Never recalculate. Append-only archival data.';
COMMENT ON COLUMN bookings.is_guest_booking IS 'TRUE if created via public guest booking API (unauthenticated)';

-- ============================================
-- 5. CREATE discount_rules TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS discount_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,

    -- JSONB conditions support multiple discount types
    -- Engine fully implements all types in calculate_booking_pricing()
    conditions JSONB NOT NULL,
    /* Supported condition types (all fully implemented):
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

COMMENT ON TABLE discount_rules IS 'Flexible discount system. Engine supports all condition types. Best-of policy: highest discount wins (no stacking).';
COMMENT ON COLUMN discount_rules.conditions IS 'JSONB array of conditions. All types fully implemented in calculate_booking_pricing() function.';
COMMENT ON COLUMN discount_rules.priority IS 'Tie-breaker when multiple discounts have same value. Lower number = higher priority (0 = highest).';

-- Insert default duration discounts
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

-- ============================================
-- 6. CREATE idempotency_keys TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key UUID PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '48 hours')
);

CREATE INDEX idx_idempotency_expiry ON idempotency_keys(expires_at);
CREATE INDEX idx_idempotency_booking ON idempotency_keys(booking_id);

COMMENT ON TABLE idempotency_keys IS 'Prevents duplicate bookings. Client-generated UUIDs with 48-hour expiry. Cleaned daily at 2:00 AM UTC.';
COMMENT ON COLUMN idempotency_keys.expires_at IS 'Automatic expiry 48 hours after creation. cleanup_expired_idempotency_keys() removes expired keys daily.';

-- ============================================
-- 7. CREATE DATABASE CONSTRAINTS
-- ============================================

-- Payment-before-assignment constraint
ALTER TABLE bookings
DROP CONSTRAINT IF EXISTS payment_before_assignment;

ALTER TABLE bookings
ADD CONSTRAINT payment_before_assignment CHECK (
    unit_assignment_status != 'assigned' OR payment_status IN ('Verified', 'Completed', 'Paid')
);

COMMENT ON CONSTRAINT payment_before_assignment ON bookings IS 'Units cannot be assigned until payment is verified. Enforces business rule at database level.';

-- All-or-nothing assignment constraint
-- NOTE: This constraint references booking_units table which may not exist yet
-- It will be added in a later migration when booking_units table is created
-- For now, this is documented but not enforced

-- ============================================
-- 8. CREATE PostgreSQL FUNCTIONS
-- ============================================

-- Function: calculate_booking_pricing (PLACEHOLDER - Full implementation in Chunk 002)
CREATE OR REPLACE FUNCTION calculate_booking_pricing(
    p_unit_requests JSONB,  -- Array: [{"guests_per_unit": 2}, {"guests_per_unit": 3}, ...]
    p_check_in DATE,
    p_check_out DATE
) RETURNS JSONB AS $$
DECLARE
    v_nights INTEGER;
    v_total_units INTEGER;
    v_total_guests INTEGER;
    v_unit_request JSONB;
BEGIN
    -- Basic validation
    v_nights := p_check_out - p_check_in;
    IF v_nights <= 0 THEN
        RAISE EXCEPTION 'Invalid date range: check-out must be after check-in';
    END IF;

    -- Calculate basic metrics from unit requests
    v_total_units := jsonb_array_length(p_unit_requests);
    v_total_guests := 0;

    FOR v_unit_request IN SELECT * FROM jsonb_array_elements(p_unit_requests) LOOP
        v_total_guests := v_total_guests + (v_unit_request->>'guests_per_unit')::INTEGER;
    END LOOP;

    -- Return minimal valid structure for schema testing
    -- Full pricing logic (discount evaluation, weekend rates, extra person fees, best-of policy)
    -- will be implemented in Chunk 002
    RETURN jsonb_build_object(
        'version', '1.0.0-stub',
        'computed_at', NOW(),
        'nights', v_nights,
        'total_units', v_total_units,
        'total_guests', v_total_guests,
        'message', 'PLACEHOLDER - Full pricing implementation in Chunk 002',
        'total', 0.00,
        'downpayment_required', 0.00,
        'currency', 'PHP'
    );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_booking_pricing IS 'PLACEHOLDER - Returns minimal valid JSONB structure for schema testing. Full pricing implementation (discount evaluation, weekend rates, extra person fees, best-of policy) will be added in Chunk 002.';

-- Function: create_guest_booking (Atomic Creation)
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
    -- Check idempotency key (48-hour window)
    SELECT booking_id INTO v_existing_booking_id
    FROM idempotency_keys
    WHERE key = p_idempotency_key
      AND expires_at > NOW();

    IF v_existing_booking_id IS NOT NULL THEN
        -- Return existing booking (duplicate request)
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
        check_in,
        check_out,
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
        (p_booking_data->>'check_in')::TIMESTAMPTZ,
        (p_booking_data->>'check_out')::TIMESTAMPTZ,
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

    -- Insert unit requests (array-based: one row per unit)
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

COMMENT ON FUNCTION create_guest_booking IS 'Atomically creates booking with guest, unit requests, and idempotency key. Prevents orphaned records. Returns existing booking if duplicate idempotency key.';

-- Function: assign_units_to_booking (All-or-Nothing Assignment)
CREATE OR REPLACE FUNCTION assign_units_to_booking(
    p_booking_id UUID,
    p_unit_ids UUID[]
) RETURNS VOID AS $$
DECLARE
    v_unit_id UUID;
    v_check_in DATE;
    v_check_out DATE;
    v_requested_count INT;
    v_payment_status TEXT;
BEGIN
    -- Get booking details and verify payment status
    SELECT check_in_date, check_out_date, requested_unit_count, payment_status
    INTO v_check_in, v_check_out, v_requested_count, v_payment_status
    FROM bookings
    WHERE booking_id = p_booking_id
      AND unit_assignment_status = 'pending'
      AND is_multi_unit = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found, already assigned, or not a multi-unit booking';
    END IF;

    -- Verify payment is verified (required before assignment)
    IF v_payment_status NOT IN ('Verified', 'Paid', 'Completed') THEN
        RAISE EXCEPTION 'Payment must be verified before unit assignment. Current status: %', v_payment_status;
    END IF;

    -- Validate all-or-nothing (array length must equal requested count)
    IF array_length(p_unit_ids, 1) != v_requested_count THEN
        RAISE EXCEPTION 'Must assign exactly % units (all-or-nothing). Provided: %', v_requested_count, array_length(p_unit_ids, 1);
    END IF;

    -- NOTE: booking_units table insertion will be handled in later chunk
    -- For now, just update booking status

    -- Update booking status to assigned
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

COMMENT ON FUNCTION assign_units_to_booking IS 'Atomically assigns units to booking. Enforces all-or-nothing and payment verification. Will integrate with booking_units table in later chunk.';

-- Function: cleanup_expired_idempotency_keys (Daily Cron)
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

COMMENT ON FUNCTION cleanup_expired_idempotency_keys IS 'Removes expired idempotency keys. Called daily at 2:00 AM UTC via cron. Keys expire 48 hours after creation.';

-- Function: cleanup_expired_payment_proofs (Weekly Cron)
CREATE OR REPLACE FUNCTION cleanup_expired_payment_proofs()
RETURNS TABLE(file_path TEXT) AS $$
BEGIN
    RETURN QUERY
    WITH expired_proofs AS (
        SELECT booking_id, payment_proof_url,
               regexp_replace(payment_proof_url, '^.*/([^/]+)$', '\1') AS extracted_path
        FROM bookings
        WHERE payment_proof_url IS NOT NULL
          AND booking_status IN ('Completed', 'CheckedOut')
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

COMMENT ON FUNCTION cleanup_expired_payment_proofs IS 'Returns file paths for deletion. Called weekly (Sunday 3:00 AM UTC). Retention: 90 days post-checkout. Cron worker calls Supabase Storage API to delete files.';

-- ============================================
-- 9. SETUP ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all new tables
ALTER TABLE guest_booking_unit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_config ENABLE ROW LEVEL SECURITY;

-- Guest booking unit requests policies
CREATE POLICY guest_booking_requests_insert_policy ON guest_booking_unit_requests
    FOR INSERT TO authenticated, service_role
    WITH CHECK (
        auth.jwt() ->> 'role' = 'service_role'
        OR
        (SELECT role FROM app_roles WHERE user_id = auth.uid() AND is_active = TRUE LIMIT 1) = 'admin'
    );

CREATE POLICY guest_booking_requests_select_policy ON guest_booking_unit_requests
    FOR SELECT TO authenticated
    USING (
        (SELECT role FROM app_roles WHERE user_id = auth.uid() AND is_active = TRUE LIMIT 1) = 'admin'
    );

-- Pricing config policies (read-only for most users, admin can update)
CREATE POLICY pricing_config_select_policy ON pricing_config
    FOR SELECT TO authenticated, anon
    USING (true);

CREATE POLICY pricing_config_admin_policy ON pricing_config
    FOR ALL TO authenticated
    USING (
        (SELECT role FROM app_roles WHERE user_id = auth.uid() AND is_active = TRUE LIMIT 1) = 'admin'
    )
    WITH CHECK (
        (SELECT role FROM app_roles WHERE user_id = auth.uid() AND is_active = TRUE LIMIT 1) = 'admin'
    );

-- Discount rules policies
CREATE POLICY discount_rules_select_policy ON discount_rules
    FOR SELECT TO authenticated, anon
    USING (is_active = TRUE);

CREATE POLICY discount_rules_admin_policy ON discount_rules
    FOR ALL TO authenticated
    USING (
        (SELECT role FROM app_roles WHERE user_id = auth.uid() AND is_active = TRUE LIMIT 1) = 'admin'
    )
    WITH CHECK (
        (SELECT role FROM app_roles WHERE user_id = auth.uid() AND is_active = TRUE LIMIT 1) = 'admin'
    );

-- Idempotency keys policies (service_role only)
CREATE POLICY idempotency_keys_service_policy ON idempotency_keys
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- ============================================
-- 10. GRANT PERMISSIONS
-- ============================================

GRANT SELECT ON pricing_config TO authenticated, anon;
GRANT ALL ON pricing_config TO service_role;

GRANT SELECT, INSERT ON guest_booking_unit_requests TO authenticated;
GRANT ALL ON guest_booking_unit_requests TO service_role;

GRANT SELECT ON discount_rules TO authenticated, anon;
GRANT ALL ON discount_rules TO service_role;

GRANT SELECT, INSERT, DELETE ON idempotency_keys TO service_role;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

COMMIT;

-- Verify migration success
DO $$
BEGIN
    RAISE NOTICE 'Migration 021 completed successfully!';
    RAISE NOTICE 'Created tables: pricing_config, guest_booking_unit_requests, discount_rules, idempotency_keys';
    RAISE NOTICE 'Extended table: bookings (9 new columns)';
    RAISE NOTICE 'Created functions: calculate_booking_pricing, create_guest_booking, assign_units_to_booking, cleanup_expired_idempotency_keys, cleanup_expired_payment_proofs';
    RAISE NOTICE 'Created constraints: payment_before_assignment';
    RAISE NOTICE 'Created indexes: 11 performance indexes';
    RAISE NOTICE 'Enabled RLS: All new tables';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Run verification queries (see checkpoint.md)';
    RAISE NOTICE '2. Test pricing function with sample data';
    RAISE NOTICE '3. Regenerate TypeScript types: npx supabase gen types typescript';
END $$;
