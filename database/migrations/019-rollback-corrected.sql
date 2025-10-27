-- ============================================
-- Migration 019 Rollback: Multi-Unit Booking Schema (CORRECTED)
-- ============================================
-- Purpose: Revert all changes from 019-multi-unit-schema.sql
-- Date: 2025-10-27
-- Corrections: Handles missing unit_id column (migration 019 removed it)
--
-- WARNING: This will:
-- - Drop all multi-unit booking tables
-- - Revert bookings table to original schema
-- - Drop all multi-unit functions and triggers
-- - Remove RLS policies for multi-unit tables
-- - RECREATE unit_id column (migration 019 removed it)
--
-- SAFE TO RUN: Zero bookings in database (verified 2025-10-27)
-- ============================================

BEGIN;

-- ============================================
-- STEP 1: Drop RLS Policies
-- ============================================

-- booking_units policies
DROP POLICY IF EXISTS "booking_units_select_own" ON booking_units;
DROP POLICY IF EXISTS "booking_units_select_staff" ON booking_units;
DROP POLICY IF EXISTS "booking_units_insert_staff" ON booking_units;
DROP POLICY IF EXISTS "booking_units_update_staff" ON booking_units;
DROP POLICY IF EXISTS "booking_units_delete_manager" ON booking_units;

-- booking_unit_availability policies
DROP POLICY IF EXISTS "availability_all_staff" ON booking_unit_availability;

-- guest_assignments policies
DROP POLICY IF EXISTS "guest_assignments_select_own" ON guest_assignments;
DROP POLICY IF EXISTS "guest_assignments_all_staff" ON guest_assignments;

-- ============================================
-- STEP 2: Drop Views
-- ============================================

-- Revoke grants first (ignore errors if doesn't exist)
DO $$
BEGIN
    EXECUTE 'REVOKE SELECT ON public_unit_availability FROM anon, authenticated';
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

-- Drop view
DROP VIEW IF EXISTS public_unit_availability CASCADE;

-- ============================================
-- STEP 3: Drop Triggers
-- ============================================

DROP TRIGGER IF EXISTS trigger_update_booking_totals ON booking_units;
DROP TRIGGER IF EXISTS trigger_sync_booking_dates ON bookings;
DROP TRIGGER IF EXISTS trigger_cascade_status ON bookings;
DROP TRIGGER IF EXISTS trigger_cleanup_availability ON booking_units;
DROP TRIGGER IF EXISTS trigger_sync_availability_unit ON booking_units;

-- ============================================
-- STEP 4: Drop Functions
-- ============================================

DROP FUNCTION IF EXISTS update_booking_totals();
DROP FUNCTION IF EXISTS sync_booking_dates();
DROP FUNCTION IF EXISTS cascade_booking_status();
DROP FUNCTION IF EXISTS cleanup_availability();
DROP FUNCTION IF EXISTS sync_availability_unit();

DROP FUNCTION IF EXISTS create_multi_unit_booking(JSONB, JSONB[], UUID);
DROP FUNCTION IF EXISTS check_multi_unit_availability(UUID[], TIMESTAMPTZ, TIMESTAMPTZ, UUID);
DROP FUNCTION IF EXISTS get_booking_units(UUID);

-- ============================================
-- STEP 5: Drop Tables (in reverse dependency order)
-- ============================================

DROP TABLE IF EXISTS guest_assignments CASCADE;
DROP TABLE IF EXISTS booking_unit_availability CASCADE;
DROP TABLE IF EXISTS booking_units CASCADE;

-- ============================================
-- STEP 6: Revert bookings Table Modifications
-- ============================================

-- Drop exclusion constraint first (uses check_in/check_out)
ALTER TABLE bookings
    DROP CONSTRAINT IF EXISTS no_overlapping_bookings;

-- Drop added constraint
ALTER TABLE bookings
    DROP CONSTRAINT IF EXISTS valid_unit_assignment;

-- Drop added columns from migration 019
ALTER TABLE bookings
    DROP COLUMN IF EXISTS tax_amount,
    DROP COLUMN IF EXISTS discount_amount,
    DROP COLUMN IF EXISTS total_surcharges,
    DROP COLUMN IF EXISTS base_amount,
    DROP COLUMN IF EXISTS unit_count,
    DROP COLUMN IF EXISTS is_multi_unit;

-- ============================================
-- STEP 7: RECREATE unit_id column (migration 019 removed it)
-- ============================================

-- Check if unit_id exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'bookings' AND column_name = 'unit_id'
    ) THEN
        -- Add unit_id column back
        ALTER TABLE bookings
            ADD COLUMN unit_id UUID REFERENCES units(unit_id);

        RAISE NOTICE 'Recreated unit_id column on bookings table';
    ELSE
        RAISE NOTICE 'unit_id column already exists';
    END IF;
END $$;

-- Make unit_id NOT NULL (safe since zero bookings)
ALTER TABLE bookings
    ALTER COLUMN unit_id SET NOT NULL;

-- ============================================
-- STEP 8: Revert date columns from TIMESTAMPTZ to DATE
-- ============================================
-- WARNING: This loses time-of-day information
-- SAFE TO RUN: Zero bookings in database

ALTER TABLE bookings
    ALTER COLUMN check_in TYPE DATE USING check_in::date,
    ALTER COLUMN check_out TYPE DATE USING check_out::date;

-- ============================================
-- STEP 9: Recreate original exclusion constraint
-- ============================================
-- Recreate with DATE type (original schema)

ALTER TABLE bookings
    ADD CONSTRAINT no_overlapping_bookings
    EXCLUDE USING gist (
        unit_id WITH =,
        daterange(check_in, check_out, '[)') WITH &&
    ) WHERE (booking_status != 'Cancelled');

-- ============================================
-- STEP 10: Validation
-- ============================================

-- Verify rollback success
DO $$
DECLARE
    v_bookings_with_null_unit INTEGER;
    v_multi_unit_tables INTEGER;
BEGIN
    -- Check for NULL unit_id (should be 0)
    SELECT COUNT(*) INTO v_bookings_with_null_unit FROM bookings WHERE unit_id IS NULL;

    IF v_bookings_with_null_unit > 0 THEN
        RAISE WARNING 'Rollback incomplete: % bookings have NULL unit_id', v_bookings_with_null_unit;
    ELSE
        RAISE NOTICE '✅ All bookings have valid unit_id';
    END IF;

    -- Check for remaining migration 019 tables (should be 0)
    SELECT COUNT(*) INTO v_multi_unit_tables
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('booking_units', 'booking_unit_availability', 'guest_assignments');

    IF v_multi_unit_tables > 0 THEN
        RAISE WARNING 'Rollback incomplete: % migration 019 tables still exist', v_multi_unit_tables;
    ELSE
        RAISE NOTICE '✅ All migration 019 tables dropped';
    END IF;

    -- Verify unit_id column exists and is NOT NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'bookings'
          AND column_name = 'unit_id'
          AND is_nullable = 'NO'
    ) THEN
        RAISE NOTICE '✅ unit_id column exists and is NOT NULL';
    ELSE
        RAISE WARNING 'unit_id column missing or nullable';
    END IF;

    -- Verify date types
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'bookings'
          AND column_name IN ('check_in', 'check_out')
          AND data_type = 'date'
    ) THEN
        RAISE NOTICE '✅ check_in and check_out are DATE type';
    ELSE
        RAISE WARNING 'check_in/check_out are not DATE type';
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Migration 019 Rollback COMPLETE';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Verify with:';
    RAISE NOTICE '1. \dt - Should not show booking_units, booking_unit_availability, guest_assignments';
    RAISE NOTICE '2. \d bookings - Should show unit_id column (NOT NULL)';
    RAISE NOTICE '3. \df - Should not show create_multi_unit_booking, etc.';
    RAISE NOTICE '================================================';
END $$;

COMMIT;

-- ============================================
-- Rollback Complete
-- ============================================
