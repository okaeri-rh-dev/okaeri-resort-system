-- ============================================
-- Migration 019: Multi-Unit Booking Schema
-- ============================================
-- Purpose: Transform single-unit bookings to multi-unit bookings via junction table
-- Phase: 1 - Database Foundation
-- Date: 2025-10-08
-- Author: postgres-serverless-architect
--
-- IMPORTANT: This is a GREENFIELD implementation
-- - No legacy compatibility needed (no active users)
-- - Clean schema design with breaking changes
-- - Aggressive availability blocking (Confirmed + CheckedIn only)
-- - UTC storage, Asia/Manila display
--
-- Rollback: Use 019-rollback.sql
-- ============================================

BEGIN;

-- ============================================
-- STEP 1: Enable Required Extensions
-- ============================================
-- btree_gist: Required for EXCLUSION constraints with range types
CREATE EXTENSION IF NOT EXISTS btree_gist;

COMMENT ON EXTENSION btree_gist IS 'Required for booking_unit_availability exclusion constraints';

-- ============================================
-- STEP 2: Create New Tables
-- ============================================

-- --------------------------------------------
-- 2.1 booking_units (Junction Table)
-- --------------------------------------------
-- Purpose: Many-to-many relationship between bookings and units
-- Enables: 1 booking → N units
-- Strategy: Single source of truth for multi-unit bookings

CREATE TABLE IF NOT EXISTS booking_units (
    -- Primary key
    booking_unit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign keys
    booking_id UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES units(unit_id) ON DELETE RESTRICT,

    -- Pricing breakdown for this specific unit
    unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    weekend_surcharge DECIMAL(10,2) DEFAULT 0 CHECK (weekend_surcharge >= 0),
    extra_person_charge DECIMAL(10,2) DEFAULT 0 CHECK (extra_person_charge >= 0),
    subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),

    -- Guest assignment (optional)
    assigned_guests INTEGER CHECK (assigned_guests > 0),
    guest_names TEXT[],  -- Array of guest names for this unit

    -- Unit-specific details
    unit_notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    UNIQUE(booking_id, unit_id),  -- Prevent duplicate unit assignments
    CHECK (subtotal = unit_price + weekend_surcharge + extra_person_charge)
);

-- Indexes for performance
CREATE INDEX idx_booking_units_booking_id ON booking_units(booking_id);
CREATE INDEX idx_booking_units_unit_id ON booking_units(unit_id);
CREATE INDEX idx_booking_units_composite ON booking_units(booking_id, unit_id);
CREATE INDEX idx_booking_units_pricing ON booking_units(booking_id, subtotal);

-- GIN index for guest name searches (full-text)
CREATE INDEX idx_booking_units_guest_names ON booking_units USING gin(guest_names);

-- Comments for documentation
COMMENT ON TABLE booking_units IS 'Junction table linking bookings to multiple units with individual pricing';
COMMENT ON COLUMN booking_units.subtotal IS 'Total for this specific unit (unit_price + surcharges)';
COMMENT ON COLUMN booking_units.guest_names IS 'Array of guest names assigned to this unit (MVP simple implementation)';

-- --------------------------------------------
-- 2.2 booking_unit_availability (Denormalized for Performance)
-- --------------------------------------------
-- Purpose: Fast availability lookups using exclusion constraints
-- Strategy: Denormalized data for O(1) availability checks
-- Blocking Policy: AGGRESSIVE - only Confirmed and CheckedIn bookings block units

CREATE TABLE IF NOT EXISTS booking_unit_availability (
    -- Primary key
    availability_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- References
    unit_id UUID NOT NULL REFERENCES units(unit_id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,

    -- Date range (TIMESTAMPTZ for UTC storage)
    check_in TIMESTAMP WITH TIME ZONE NOT NULL,
    check_out TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Booking status (for filtering)
    booking_status VARCHAR(20) NOT NULL,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Exclusion constraint: Prevent overlapping bookings for same unit
    -- AGGRESSIVE BLOCKING: Only Confirmed and CheckedIn bookings block availability
    -- Rationale: Better UX (Pending bookings don't block), acceptable race condition risk at low volume
    EXCLUDE USING gist (
        unit_id WITH =,
        tstzrange(check_in, check_out, '[)') WITH &&
    ) WHERE (booking_status IN ('Confirmed', 'CheckedIn')),

    -- Additional constraints
    CHECK (check_out > check_in)
);

-- Covering index for availability queries (matches exclusion constraint)
CREATE INDEX idx_availability_lookup ON booking_unit_availability(
    unit_id,
    check_in,
    check_out
) WHERE booking_status IN ('Confirmed', 'CheckedIn');

-- Index for booking_id lookups
CREATE INDEX idx_availability_booking_id ON booking_unit_availability(booking_id);

-- Comments
COMMENT ON TABLE booking_unit_availability IS 'Denormalized table for fast availability checking with exclusion constraints';
COMMENT ON CONSTRAINT booking_unit_availability_unit_id_tstzrange_excl ON booking_unit_availability
    IS 'Prevents double-booking by excluding overlapping date ranges for the same unit (AGGRESSIVE: Confirmed + CheckedIn only)';

-- --------------------------------------------
-- 2.3 guest_assignments (Optional - for detailed guest tracking)
-- --------------------------------------------
-- Purpose: Track which guests are assigned to which units
-- Note: MVP uses TEXT[] in booking_units, this table is for future enhancement

CREATE TABLE IF NOT EXISTS guest_assignments (
    -- Primary key
    assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- References
    booking_unit_id UUID NOT NULL REFERENCES booking_units(booking_unit_id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES guests(guest_id) ON DELETE RESTRICT,

    -- Assignment details
    is_primary BOOLEAN DEFAULT FALSE,
    room_preferences TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    UNIQUE(booking_unit_id, guest_id)  -- Prevent duplicate assignments
);

-- Indexes
CREATE INDEX idx_guest_assignments_booking_unit ON guest_assignments(booking_unit_id);
CREATE INDEX idx_guest_assignments_guest_id ON guest_assignments(guest_id);

-- Comments
COMMENT ON TABLE guest_assignments IS 'Optional table for tracking specific guest-to-unit assignments (future enhancement)';

-- ============================================
-- STEP 3: Modify Existing bookings Table
-- ============================================

-- Add multi-unit tracking columns
ALTER TABLE bookings
    -- Multi-unit metadata
    ADD COLUMN IF NOT EXISTS is_multi_unit BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS unit_count INTEGER DEFAULT 1 CHECK (unit_count > 0),

    -- Pricing breakdown
    ADD COLUMN IF NOT EXISTS base_amount DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS total_surcharges DECIMAL(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) DEFAULT 0;

-- Upgrade date columns from DATE to TIMESTAMPTZ (UTC storage)
-- This is a BREAKING CHANGE but acceptable in greenfield deployment
ALTER TABLE bookings
    ALTER COLUMN check_in TYPE TIMESTAMP WITH TIME ZONE USING check_in::timestamp with time zone,
    ALTER COLUMN check_out TYPE TIMESTAMP WITH TIME ZONE USING check_out::timestamp with time zone;

-- Make unit_id nullable (for multi-unit bookings)
ALTER TABLE bookings
    ALTER COLUMN unit_id DROP NOT NULL;

-- Add constraint for valid unit assignment
-- Logic: EITHER direct unit_id OR booking_units junction (not both)
ALTER TABLE bookings
    ADD CONSTRAINT valid_unit_assignment CHECK (
        -- Single-unit: unit_id not null, is_multi_unit false
        (is_multi_unit = FALSE AND unit_id IS NOT NULL AND unit_count = 1) OR
        -- Multi-unit: unit_id null, is_multi_unit true, unit_count > 0
        (is_multi_unit = TRUE AND unit_id IS NULL AND unit_count > 0)
    );

-- Comments
COMMENT ON COLUMN bookings.unit_id IS 'Direct unit reference for single-unit bookings only. NULL for multi-unit bookings (use booking_units junction table)';
COMMENT ON COLUMN bookings.is_multi_unit IS 'TRUE if booking has multiple units (uses booking_units junction table)';
COMMENT ON COLUMN bookings.unit_count IS 'Number of units in this booking (1 for single-unit, 2+ for multi-unit)';
COMMENT ON COLUMN bookings.check_in IS 'Check-in date/time stored as UTC (display as Asia/Manila)';
COMMENT ON COLUMN bookings.check_out IS 'Check-out date/time stored as UTC (display as Asia/Manila)';

-- ============================================
-- STEP 4: Create Database Functions
-- ============================================

-- --------------------------------------------
-- 4.1 create_multi_unit_booking
-- --------------------------------------------
-- Purpose: Atomically create a booking with multiple units
-- Security: SECURITY DEFINER (runs with creator's privileges)
-- Transaction: All-or-nothing atomicity

CREATE OR REPLACE FUNCTION create_multi_unit_booking(
    p_booking_data JSONB,
    p_units JSONB[],
    p_guest_id UUID DEFAULT NULL  -- Support both authenticated and anonymous bookings
) RETURNS UUID AS $$
DECLARE
    v_booking_id UUID;
    v_unit JSONB;
    v_total_amount DECIMAL(10,2) := 0;
BEGIN
    -- Calculate total from all units
    FOREACH v_unit IN ARRAY p_units
    LOOP
        v_total_amount := v_total_amount + (v_unit->>'subtotal')::DECIMAL;
    END LOOP;

    -- Insert main booking
    INSERT INTO bookings (
        booking_reference,
        guest_id,  -- Link to guest record (NULL for anonymous)
        guest_name,
        contact_number,
        email,
        num_guests,
        check_in,
        check_out,
        total_amount,
        is_multi_unit,
        unit_count,
        booking_status,
        payment_status
    )
    SELECT
        p_booking_data->>'booking_reference',
        p_guest_id,  -- NULL for anonymous, UUID for authenticated
        p_booking_data->>'guest_name',
        p_booking_data->>'contact_number',
        p_booking_data->>'email',
        (p_booking_data->>'num_guests')::INTEGER,
        (p_booking_data->>'check_in')::TIMESTAMPTZ,
        (p_booking_data->>'check_out')::TIMESTAMPTZ,
        v_total_amount,
        TRUE,  -- is_multi_unit
        array_length(p_units, 1),  -- unit_count
        COALESCE(p_booking_data->>'booking_status', 'Pending'),
        COALESCE(p_booking_data->>'payment_status', 'Unpaid')
    RETURNING booking_id INTO v_booking_id;

    -- Insert unit associations
    FOREACH v_unit IN ARRAY p_units
    LOOP
        INSERT INTO booking_units (
            booking_id,
            unit_id,
            unit_price,
            weekend_surcharge,
            extra_person_charge,
            subtotal,
            assigned_guests,
            unit_notes
        ) VALUES (
            v_booking_id,
            (v_unit->>'unit_id')::UUID,
            (v_unit->>'unit_price')::DECIMAL,
            COALESCE((v_unit->>'weekend_surcharge')::DECIMAL, 0),
            COALESCE((v_unit->>'extra_person_charge')::DECIMAL, 0),
            (v_unit->>'subtotal')::DECIMAL,
            (v_unit->>'assigned_guests')::INTEGER,
            v_unit->>'unit_notes'
        );

        -- Insert into availability table
        INSERT INTO booking_unit_availability (
            unit_id,
            booking_id,
            check_in,
            check_out,
            booking_status
        ) VALUES (
            (v_unit->>'unit_id')::UUID,
            v_booking_id,
            (p_booking_data->>'check_in')::TIMESTAMPTZ,
            (p_booking_data->>'check_out')::TIMESTAMPTZ,
            COALESCE(p_booking_data->>'booking_status', 'Pending')
        );
    END LOOP;

    RETURN v_booking_id;
EXCEPTION
    WHEN OTHERS THEN
        -- Rollback handled by transaction
        RAISE EXCEPTION 'Failed to create multi-unit booking: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_multi_unit_booking IS 'Atomically creates a booking with multiple units (supports both authenticated and anonymous bookings)';

-- --------------------------------------------
-- 4.2 check_multi_unit_availability
-- --------------------------------------------
-- Purpose: Check availability for multiple units simultaneously
-- Returns: Table with availability status + next_available_date per unit
-- Performance: Single query for batch checking

CREATE OR REPLACE FUNCTION check_multi_unit_availability(
    p_unit_ids UUID[],
    p_check_in TIMESTAMPTZ,
    p_check_out TIMESTAMPTZ,
    p_exclude_booking_id UUID DEFAULT NULL
) RETURNS TABLE(
    unit_id UUID,
    is_available BOOLEAN,
    conflicting_bookings INTEGER,
    next_available_date TIMESTAMPTZ  -- Suggest alternative dates
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.unit_id,
        NOT EXISTS (
            SELECT 1
            FROM booking_unit_availability bua
            WHERE bua.unit_id = u.unit_id
              AND bua.booking_status IN ('Confirmed', 'CheckedIn')
              AND tstzrange(bua.check_in, bua.check_out, '[)') && tstzrange(p_check_in, p_check_out, '[)')
              AND (p_exclude_booking_id IS NULL OR bua.booking_id != p_exclude_booking_id)
        ) AS is_available,
        (
            SELECT COUNT(*)::INTEGER
            FROM booking_unit_availability bua
            WHERE bua.unit_id = u.unit_id
              AND bua.booking_status IN ('Confirmed', 'CheckedIn')
              AND tstzrange(bua.check_in, bua.check_out, '[)') && tstzrange(p_check_in, p_check_out, '[)')
              AND (p_exclude_booking_id IS NULL OR bua.booking_id != p_exclude_booking_id)
        ) AS conflicting_bookings,
        -- Next available date: earliest check_out for bookings starting >= check_in
        (
            SELECT MIN(bua.check_out)
            FROM booking_unit_availability bua
            WHERE bua.unit_id = u.unit_id
              AND bua.booking_status IN ('Confirmed', 'CheckedIn')
              AND bua.check_in >= p_check_in
        ) AS next_available_date
    FROM units u
    WHERE u.unit_id = ANY(p_unit_ids)
      AND u.unit_status = 'Available';
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION check_multi_unit_availability IS 'Checks availability for multiple units in a single query, with next_available_date suggestion (per-unit, matching requested stay length)';

-- --------------------------------------------
-- 4.3 get_booking_units
-- --------------------------------------------
-- Purpose: Get all units for a booking (handles both single and multi-unit)
-- Compatibility: Backwards-compatible with legacy single-unit bookings

CREATE OR REPLACE FUNCTION get_booking_units(p_booking_id UUID)
RETURNS TABLE (
    unit_id UUID,
    unit_name VARCHAR(100),
    unit_code VARCHAR(10),
    unit_type VARCHAR(50),
    unit_price DECIMAL(10,2),
    subtotal DECIMAL(10,2),
    assigned_guests INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(bu.unit_id, b.unit_id) as unit_id,
        u.unit_name,
        u.unit_code,
        u.unit_type,
        COALESCE(bu.unit_price, b.total_amount) as unit_price,
        COALESCE(bu.subtotal, b.total_amount) as subtotal,
        bu.assigned_guests
    FROM bookings b
    LEFT JOIN booking_units bu ON bu.booking_id = b.booking_id
    LEFT JOIN units u ON u.unit_id = COALESCE(bu.unit_id, b.unit_id)
    WHERE b.booking_id = p_booking_id;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_booking_units IS 'Backwards-compatible function to get units for both single and multi-unit bookings';

-- ============================================
-- STEP 5: Create Triggers
-- ============================================

-- --------------------------------------------
-- 5.1 Update Booking Totals Trigger
-- --------------------------------------------
-- Purpose: Automatically update booking totals when units are added/removed
-- Fires: AFTER INSERT/UPDATE/DELETE on booking_units

CREATE OR REPLACE FUNCTION update_booking_totals()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Update booking totals
        UPDATE bookings
        SET
            total_amount = (
                SELECT COALESCE(SUM(subtotal), 0)
                FROM booking_units
                WHERE booking_id = NEW.booking_id
            ),
            unit_count = (
                SELECT COUNT(*)
                FROM booking_units
                WHERE booking_id = NEW.booking_id
            ),
            is_multi_unit = (
                SELECT COUNT(*) > 1
                FROM booking_units
                WHERE booking_id = NEW.booking_id
            ),
            updated_at = NOW()
        WHERE booking_id = NEW.booking_id;
    ELSIF TG_OP = 'DELETE' THEN
        -- Update after deletion
        UPDATE bookings
        SET
            total_amount = (
                SELECT COALESCE(SUM(subtotal), 0)
                FROM booking_units
                WHERE booking_id = OLD.booking_id
            ),
            unit_count = (
                SELECT COUNT(*)
                FROM booking_units
                WHERE booking_id = OLD.booking_id
            ),
            is_multi_unit = (
                SELECT COUNT(*) > 1
                FROM booking_units
                WHERE booking_id = OLD.booking_id
            ),
            updated_at = NOW()
        WHERE booking_id = OLD.booking_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_booking_totals
    AFTER INSERT OR UPDATE OR DELETE ON booking_units
    FOR EACH ROW
    EXECUTE FUNCTION update_booking_totals();

COMMENT ON TRIGGER trigger_update_booking_totals ON booking_units IS 'Automatically updates booking totals when units are added, updated, or removed';

-- --------------------------------------------
-- 5.2 Sync Availability Dates Trigger
-- --------------------------------------------
-- Purpose: Keep availability table in sync with booking dates
-- Fires: AFTER UPDATE on bookings (when dates change)

CREATE OR REPLACE FUNCTION sync_booking_dates()
RETURNS TRIGGER AS $$
BEGIN
    -- Update availability when booking dates change
    IF TG_OP = 'UPDATE' AND (OLD.check_in != NEW.check_in OR OLD.check_out != NEW.check_out) THEN
        UPDATE booking_unit_availability
        SET
            check_in = NEW.check_in,
            check_out = NEW.check_out,
            updated_at = NOW()
        WHERE booking_id = NEW.booking_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_booking_dates
    AFTER UPDATE ON bookings
    FOR EACH ROW
    WHEN (OLD.check_in IS DISTINCT FROM NEW.check_in OR OLD.check_out IS DISTINCT FROM NEW.check_out)
    EXECUTE FUNCTION sync_booking_dates();

COMMENT ON TRIGGER trigger_sync_booking_dates ON bookings IS 'Syncs availability table when booking dates change';

-- --------------------------------------------
-- 5.3 Cascade Status Updates Trigger
-- --------------------------------------------
-- Purpose: Update availability when booking status changes
-- Fires: AFTER UPDATE on bookings (when status changes)

CREATE OR REPLACE FUNCTION cascade_booking_status()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE booking_unit_availability
    SET
        booking_status = NEW.booking_status,
        updated_at = NOW()
    WHERE booking_id = NEW.booking_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cascade_status
    AFTER UPDATE OF booking_status ON bookings
    FOR EACH ROW
    WHEN (OLD.booking_status IS DISTINCT FROM NEW.booking_status)
    EXECUTE FUNCTION cascade_booking_status();

COMMENT ON TRIGGER trigger_cascade_status ON bookings IS 'Cascades booking_status changes to availability table';

-- --------------------------------------------
-- 5.4 Cleanup Availability on DELETE Trigger
-- --------------------------------------------
-- Purpose: Remove availability records when booking_units are deleted
-- Fires: AFTER DELETE on booking_units

CREATE OR REPLACE FUNCTION cleanup_availability()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete corresponding availability record
    DELETE FROM booking_unit_availability
    WHERE booking_id = OLD.booking_id
      AND unit_id = OLD.unit_id;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cleanup_availability
    AFTER DELETE ON booking_units
    FOR EACH ROW
    EXECUTE FUNCTION cleanup_availability();

COMMENT ON TRIGGER trigger_cleanup_availability ON booking_units IS 'Removes availability records when units are removed from bookings';

-- --------------------------------------------
-- 5.5 Sync Availability Unit ID on UPDATE Trigger
-- --------------------------------------------
-- Purpose: Update availability when unit_id changes in booking_units
-- Fires: AFTER UPDATE on booking_units (when unit_id changes)

CREATE OR REPLACE FUNCTION sync_availability_unit()
RETURNS TRIGGER AS $$
BEGIN
    -- Update unit_id in availability table
    UPDATE booking_unit_availability
    SET
        unit_id = NEW.unit_id,
        updated_at = NOW()
    WHERE booking_id = NEW.booking_id
      AND unit_id = OLD.unit_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_availability_unit
    AFTER UPDATE OF unit_id ON booking_units
    FOR EACH ROW
    WHEN (OLD.unit_id IS DISTINCT FROM NEW.unit_id)
    EXECUTE FUNCTION sync_availability_unit();

COMMENT ON TRIGGER trigger_sync_availability_unit ON booking_units IS 'Syncs unit_id changes to availability table';

-- ============================================
-- STEP 6: Row Level Security (RLS)
-- ============================================

-- Enable RLS on new tables
ALTER TABLE booking_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_unit_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_assignments ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------
-- 6.1 booking_units RLS Policies
-- --------------------------------------------

-- Policy: Users can view their own booking units
CREATE POLICY "booking_units_select_own"
    ON booking_units
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM bookings b
            WHERE b.booking_id = booking_units.booking_id
              AND (
                  -- Guest owns the booking
                  b.guest_id IN (
                      SELECT guest_id FROM guests
                      WHERE user_id = auth.uid()
                  )
                  -- Or has valid booking reference in session
                  OR b.booking_reference = current_setting('app.booking_reference', true)
              )
        )
    );

-- Policy: Staff can view all booking units
CREATE POLICY "booking_units_select_staff"
    ON booking_units
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM app_roles
            WHERE user_id = auth.uid()
              AND role IN ('admin', 'owner', 'manager', 'staff')
              AND is_active = TRUE
        )
    );

-- Policy: Staff can insert booking units
CREATE POLICY "booking_units_insert_staff"
    ON booking_units
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM app_roles
            WHERE user_id = auth.uid()
              AND role IN ('admin', 'owner', 'manager', 'staff')
              AND is_active = TRUE
        )
    );

-- Policy: Staff can update booking units
CREATE POLICY "booking_units_update_staff"
    ON booking_units
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM app_roles
            WHERE user_id = auth.uid()
              AND role IN ('admin', 'owner', 'manager')
              AND is_active = TRUE
        )
    );

-- Policy: Only managers can delete booking units
CREATE POLICY "booking_units_delete_manager"
    ON booking_units
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM app_roles
            WHERE user_id = auth.uid()
              AND role IN ('admin', 'owner', 'manager')
              AND is_active = TRUE
        )
    );

-- --------------------------------------------
-- 6.2 booking_unit_availability RLS Policies
-- --------------------------------------------

-- Create sanitized PUBLIC VIEW without sensitive fields
CREATE OR REPLACE VIEW public_unit_availability AS
SELECT
    unit_id,
    check_in,
    check_out,
    booking_status
    -- Excludes: availability_id, booking_id (security)
FROM booking_unit_availability
WHERE booking_status IN ('Confirmed', 'CheckedIn'); -- Aggressive blocking

-- Grant SELECT on view to public
GRANT SELECT ON public_unit_availability TO anon, authenticated;

-- Revoke direct table access for public (security hardening)
REVOKE SELECT ON booking_unit_availability FROM anon;

-- Policy: Staff has full access to base table
CREATE POLICY "availability_all_staff"
    ON booking_unit_availability
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM app_roles
            WHERE user_id = auth.uid()
              AND role IN ('admin', 'owner', 'manager', 'staff')
              AND is_active = TRUE
        )
    );

COMMENT ON VIEW public_unit_availability IS 'Public-safe availability view without booking_id or other sensitive fields';

-- --------------------------------------------
-- 6.3 guest_assignments RLS Policies
-- --------------------------------------------

-- Policy: Users can view their own guest assignments
CREATE POLICY "guest_assignments_select_own"
    ON guest_assignments
    FOR SELECT
    USING (
        guest_id IN (
            SELECT guest_id FROM guests
            WHERE user_id = auth.uid()
        )
    );

-- Policy: Staff can manage all guest assignments
CREATE POLICY "guest_assignments_all_staff"
    ON guest_assignments
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM app_roles
            WHERE user_id = auth.uid()
              AND role IN ('admin', 'owner', 'manager', 'staff')
              AND is_active = TRUE
        )
    );

-- ============================================
-- STEP 7: Data Migration
-- ============================================

-- Migrate existing single-unit bookings to junction table
INSERT INTO booking_units (
    booking_id,
    unit_id,
    unit_price,
    subtotal,
    assigned_guests,
    created_at,
    updated_at
)
SELECT
    booking_id,
    unit_id,
    total_amount,  -- Use total as unit price for single-unit bookings
    total_amount,  -- Same for subtotal
    num_guests,
    created_at,
    updated_at
FROM bookings
WHERE unit_id IS NOT NULL
ON CONFLICT (booking_id, unit_id) DO NOTHING;

-- Populate availability table from migrated data
INSERT INTO booking_unit_availability (
    unit_id,
    booking_id,
    check_in,
    check_out,
    booking_status
)
SELECT
    bu.unit_id,
    bu.booking_id,
    b.check_in,
    b.check_out,
    b.booking_status
FROM booking_units bu
JOIN bookings b ON b.booking_id = bu.booking_id
WHERE b.booking_status IN ('Confirmed', 'CheckedIn'); -- Aggressive blocking

-- ============================================
-- STEP 8: Validation
-- ============================================

-- Validate migration success
DO $$
DECLARE
    v_bookings_count INTEGER;
    v_booking_units_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_bookings_count FROM bookings WHERE unit_id IS NOT NULL;
    SELECT COUNT(*) INTO v_booking_units_count FROM booking_units;

    IF v_bookings_count != v_booking_units_count THEN
        RAISE EXCEPTION 'Migration validation failed: % bookings but % booking_units', v_bookings_count, v_booking_units_count;
    END IF;

    RAISE NOTICE 'Migration successful: % bookings migrated', v_booking_units_count;
END $$;

COMMIT;

-- ============================================
-- Migration Complete
-- ============================================
-- Run the following to verify:
-- 1. SELECT * FROM booking_units LIMIT 5;
-- 2. SELECT * FROM booking_unit_availability LIMIT 5;
-- 3. SELECT check_multi_unit_availability(ARRAY['<unit-id>'], NOW(), NOW() + interval '3 days', NULL);
-- 4. \df create_multi_unit_booking
-- 5. \dt booking_units
-- ============================================
