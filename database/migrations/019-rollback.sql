-- ============================================
-- Migration 019 Rollback: Multi-Unit Booking Schema
-- ============================================
-- Purpose: Revert all changes from 019-multi-unit-schema.sql
-- Date: 2025-10-08
-- Author: postgres-serverless-architect
--
-- WARNING: This will:
-- - Drop all multi-unit booking tables
-- - Revert bookings table to original schema
-- - Drop all multi-unit functions and triggers
-- - Remove RLS policies for multi-unit tables
--
-- USE WITH CAUTION - Ensure database backup exists before running
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

-- Revoke grants first
REVOKE SELECT ON public_unit_availability FROM anon, authenticated;

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

-- Drop added constraint
ALTER TABLE bookings
    DROP CONSTRAINT IF EXISTS valid_unit_assignment;

-- Drop added columns
ALTER TABLE bookings
    DROP COLUMN IF EXISTS tax_amount,
    DROP COLUMN IF EXISTS discount_amount,
    DROP COLUMN IF EXISTS total_surcharges,
    DROP COLUMN IF EXISTS base_amount,
    DROP COLUMN IF EXISTS unit_count,
    DROP COLUMN IF EXISTS is_multi_unit;

-- Restore unit_id NOT NULL constraint
-- WARNING: This will fail if any bookings have NULL unit_id
-- Ensure all bookings have a unit_id before running this
ALTER TABLE bookings
    ALTER COLUMN unit_id SET NOT NULL;

-- Revert date columns from TIMESTAMPTZ to DATE
-- WARNING: This loses time-of-day information
-- Only run if you're sure you want to discard time data
ALTER TABLE bookings
    ALTER COLUMN check_in TYPE DATE USING check_in::date,
    ALTER COLUMN check_out TYPE DATE USING check_out::date;

-- ============================================
-- STEP 7: Validation
-- ============================================

-- Verify rollback success
DO $$
DECLARE
    v_bookings_with_null_unit INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_bookings_with_null_unit FROM bookings WHERE unit_id IS NULL;

    IF v_bookings_with_null_unit > 0 THEN
        RAISE WARNING 'Rollback incomplete: % bookings have NULL unit_id. These bookings may be orphaned.', v_bookings_with_null_unit;
    END IF;

    RAISE NOTICE 'Rollback completed. Verify schema with \dt and \df';
END $$;

COMMIT;

-- ============================================
-- Rollback Complete
-- ============================================
-- Run the following to verify rollback:
-- 1. \dt - Verify tables dropped (no booking_units, booking_unit_availability, guest_assignments)
-- 2. \d bookings - Verify columns removed
-- 3. \df - Verify functions dropped (no create_multi_unit_booking, etc.)
-- 4. SELECT * FROM bookings WHERE unit_id IS NULL; - Should return 0 rows
-- ============================================
