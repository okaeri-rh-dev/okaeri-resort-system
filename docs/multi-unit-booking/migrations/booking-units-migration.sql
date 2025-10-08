-- ============================================================================
-- Multi-Unit Booking Migration Script
-- ============================================================================
-- Purpose: Migrate from single-unit bookings to multi-unit booking system
-- Author: System Admin
-- Date: 2025-10-08
-- Version: 1.0
--
-- IMPORTANT: Test on development database first!
-- Backup database before running: https://supabase.com/dashboard/backups
-- ============================================================================

BEGIN;

-- ============================================================================
-- PHASE 1: Modify Existing Tables
-- ============================================================================

-- Add multi-unit flag to bookings table
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS is_multi_unit BOOLEAN DEFAULT FALSE NOT NULL;

-- Make unit_id nullable (will be NULL for new multi-unit bookings)
ALTER TABLE bookings
  ALTER COLUMN unit_id DROP NOT NULL;

COMMENT ON COLUMN bookings.unit_id IS 'Legacy single-unit booking field. NULL for multi-unit bookings created after 2025-01-01. Use booking_units junction table for all new bookings.';
COMMENT ON COLUMN bookings.is_multi_unit IS 'TRUE if booking uses booking_units junction table. FALSE for legacy single-unit bookings.';

-- ============================================================================
-- PHASE 2: Create New Tables
-- ============================================================================

-- Junction table: booking_units
CREATE TABLE IF NOT EXISTS booking_units (
  booking_unit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  booking_id UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(unit_id) ON DELETE RESTRICT,

  -- Unit-specific details
  guest_name VARCHAR(100) NOT NULL,
  rate_per_night DECIMAL(10,2) NOT NULL CHECK (rate_per_night >= 0),
  num_nights INTEGER NOT NULL CHECK (num_nights > 0),
  subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),

  -- Denormalized fields (for query performance)
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  booking_status VARCHAR(20) NOT NULL,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  UNIQUE(booking_id, unit_id),  -- Prevent duplicate units in same booking
  CHECK (check_out > check_in),
  CHECK (subtotal = rate_per_night * num_nights)
);

COMMENT ON TABLE booking_units IS 'Junction table for multi-unit bookings. One booking can have multiple units.';
COMMENT ON COLUMN booking_units.guest_name IS 'Guest assigned to this specific unit (may differ from main booking guest)';
COMMENT ON COLUMN booking_units.check_in IS 'Denormalized from bookings table for query performance';
COMMENT ON COLUMN booking_units.booking_status IS 'Denormalized from bookings table; synced via trigger';

-- Denormalized availability table
CREATE TABLE IF NOT EXISTS booking_unit_availability (
  availability_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  booking_id UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(unit_id) ON DELETE RESTRICT,

  -- Single date (for atomic checking)
  date DATE NOT NULL,

  -- Status tracking
  booking_status VARCHAR(20) NOT NULL,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE booking_unit_availability IS 'Denormalized availability cache. One row per unit per date per booking. Used for fast availability queries.';
COMMENT ON COLUMN booking_unit_availability.date IS 'Single date for this availability block. Allows GIST index with exclusion constraint.';
COMMENT ON COLUMN booking_unit_availability.booking_status IS 'Denormalized status. Only Confirmed/CheckedIn block availability.';

-- ============================================================================
-- PHASE 3: Create Indexes
-- ============================================================================

-- booking_units indexes
CREATE INDEX IF NOT EXISTS idx_booking_units_booking_id ON booking_units(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_units_unit_id ON booking_units(unit_id);
CREATE INDEX IF NOT EXISTS idx_booking_units_dates ON booking_units(check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_booking_units_status ON booking_units(booking_status);

-- booking_unit_availability indexes (CRITICAL for performance)
CREATE INDEX IF NOT EXISTS idx_availability_unit_date
  ON booking_unit_availability(unit_id, date, booking_status);

CREATE INDEX IF NOT EXISTS idx_availability_date_range
  ON booking_unit_availability(date, booking_status);

CREATE INDEX IF NOT EXISTS idx_availability_booking_id
  ON booking_unit_availability(booking_id);

-- ============================================================================
-- PHASE 4: Create Exclusion Constraint (Prevents Double Booking)
-- ============================================================================

-- Enable btree_gist extension (required for exclusion constraint)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Exclusion constraint: No overlapping confirmed/checked-in bookings for same unit
ALTER TABLE booking_unit_availability
  ADD CONSTRAINT exclude_overlapping_bookings
  EXCLUDE USING GIST (
    unit_id WITH =,
    daterange(date, date + INTERVAL '1 day') WITH &&
  )
  WHERE (booking_status IN ('Confirmed', 'CheckedIn'));

COMMENT ON CONSTRAINT exclude_overlapping_bookings ON booking_unit_availability IS 'Prevents overlapping Confirmed/CheckedIn bookings for same unit. Pending bookings do NOT block (aggressive availability policy).';

-- ============================================================================
-- PHASE 5: Migrate Legacy Data
-- ============================================================================

-- Migrate existing single-unit bookings to junction table
INSERT INTO booking_units (
  booking_id,
  unit_id,
  guest_name,
  rate_per_night,
  num_nights,
  subtotal,
  check_in,
  check_out,
  booking_status,
  created_at
)
SELECT
  b.booking_id,
  b.unit_id,
  b.guest_name,
  -- Calculate rate_per_night (total / nights)
  CASE
    WHEN EXTRACT(DAY FROM (b.check_out - b.check_in)) > 0
    THEN b.total_amount / EXTRACT(DAY FROM (b.check_out - b.check_in))
    ELSE b.total_amount  -- Fallback for same-day bookings
  END,
  EXTRACT(DAY FROM (b.check_out - b.check_in)),
  b.total_amount,
  b.check_in,
  b.check_out,
  COALESCE(b.booking_status, 'Pending'),
  b.created_at
FROM bookings b
WHERE b.unit_id IS NOT NULL  -- Only migrate bookings with unit_id
  AND NOT EXISTS (
    -- Skip if already migrated
    SELECT 1 FROM booking_units bu
    WHERE bu.booking_id = b.booking_id
  );

-- Populate availability table from junction table
INSERT INTO booking_unit_availability (
  booking_id,
  unit_id,
  date,
  booking_status,
  check_in,
  check_out,
  created_at
)
SELECT
  bu.booking_id,
  bu.unit_id,
  gs.date,
  bu.booking_status,
  bu.check_in,
  bu.check_out,
  NOW()
FROM booking_units bu
CROSS JOIN LATERAL generate_series(
  bu.check_in,
  bu.check_out - INTERVAL '1 day',
  INTERVAL '1 day'
)::DATE AS gs(date)
WHERE NOT EXISTS (
  -- Skip if already populated
  SELECT 1 FROM booking_unit_availability bua
  WHERE bua.booking_id = bu.booking_id
    AND bua.unit_id = bu.unit_id
    AND bua.date = gs.date
);

-- ============================================================================
-- PHASE 6: Add Constraints
-- ============================================================================

-- Enforce new booking mode: created_at >= 2025-01-01 => unit_id = NULL
ALTER TABLE bookings
  ADD CONSTRAINT check_new_bookings_use_junction
  CHECK (
    (created_at >= '2025-01-01' AND unit_id IS NULL) OR
    (created_at < '2025-01-01')
  );

COMMENT ON CONSTRAINT check_new_bookings_use_junction ON bookings IS 'All bookings created after 2025-01-01 must use booking_units junction table (unit_id = NULL). Legacy bookings can have unit_id populated.';

-- ============================================================================
-- PHASE 7: Create Triggers (Status Synchronization)
-- ============================================================================

-- Function: Sync booking_status changes to junction and availability tables
CREATE OR REPLACE FUNCTION sync_booking_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Update booking_units
  UPDATE booking_units
  SET booking_status = NEW.booking_status
  WHERE booking_id = NEW.booking_id;

  -- Update booking_unit_availability
  UPDATE booking_unit_availability
  SET booking_status = NEW.booking_status
  WHERE booking_id = NEW.booking_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_booking_status() IS 'Synchronizes booking_status from bookings table to booking_units and booking_unit_availability tables.';

-- Trigger: After booking status update
CREATE TRIGGER trigger_sync_booking_status
AFTER UPDATE OF booking_status ON bookings
FOR EACH ROW
WHEN (OLD.booking_status IS DISTINCT FROM NEW.booking_status)
EXECUTE FUNCTION sync_booking_status();

COMMENT ON TRIGGER trigger_sync_booking_status ON bookings IS 'Automatically syncs booking_status changes to dependent tables.';

-- Function: Populate availability when units added to booking
CREATE OR REPLACE FUNCTION populate_availability_on_unit_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO booking_unit_availability (
    booking_id,
    unit_id,
    date,
    booking_status,
    check_in,
    check_out
  )
  SELECT
    NEW.booking_id,
    NEW.unit_id,
    gs.date,
    NEW.booking_status,
    NEW.check_in,
    NEW.check_out
  FROM generate_series(
    NEW.check_in,
    NEW.check_out - INTERVAL '1 day',
    INTERVAL '1 day'
  )::DATE AS gs(date);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION populate_availability_on_unit_insert() IS 'Automatically populates booking_unit_availability when a unit is added to a booking.';

-- Trigger: After unit inserted into booking
CREATE TRIGGER trigger_populate_availability
AFTER INSERT ON booking_units
FOR EACH ROW
EXECUTE FUNCTION populate_availability_on_unit_insert();

-- Function: Clean up availability when unit removed
CREATE OR REPLACE FUNCTION cleanup_availability_on_unit_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM booking_unit_availability
  WHERE booking_id = OLD.booking_id
    AND unit_id = OLD.unit_id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_availability_on_unit_delete() IS 'Automatically removes availability rows when a unit is removed from a booking.';

-- Trigger: Before unit deleted from booking
CREATE TRIGGER trigger_cleanup_availability
BEFORE DELETE ON booking_units
FOR EACH ROW
EXECUTE FUNCTION cleanup_availability_on_unit_delete();

-- ============================================================================
-- PHASE 8: Verify Migration
-- ============================================================================

-- Check 1: All new bookings have unit_id = NULL
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM bookings
  WHERE created_at >= '2025-01-01'
    AND unit_id IS NOT NULL;

  IF v_count > 0 THEN
    RAISE WARNING 'Found % bookings after 2025-01-01 with unit_id still set', v_count;
  ELSE
    RAISE NOTICE 'Check 1 passed: All new bookings use junction table';
  END IF;
END $$;

-- Check 2: Total amounts match subtotals
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM bookings b
  LEFT JOIN (
    SELECT booking_id, SUM(subtotal) as calculated_total
    FROM booking_units
    GROUP BY booking_id
  ) bu ON b.booking_id = bu.booking_id
  WHERE bu.calculated_total IS NOT NULL
    AND ABS(b.total_amount - bu.calculated_total) > 0.01;  -- Allow 1 cent rounding

  IF v_count > 0 THEN
    RAISE WARNING 'Found % bookings with total_amount mismatch', v_count;
  ELSE
    RAISE NOTICE 'Check 2 passed: All totals match subtotals';
  END IF;
END $$;

-- Check 3: Availability rows match junction rows
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM booking_units bu
  LEFT JOIN (
    SELECT booking_id, unit_id, COUNT(*) as avail_days
    FROM booking_unit_availability
    GROUP BY booking_id, unit_id
  ) bua ON bu.booking_id = bua.booking_id AND bu.unit_id = bua.unit_id
  WHERE bua.avail_days IS NULL
    OR bua.avail_days != bu.num_nights;

  IF v_count > 0 THEN
    RAISE WARNING 'Found % booking units with mismatched availability rows', v_count;
  ELSE
    RAISE NOTICE 'Check 3 passed: All availability rows populated correctly';
  END IF;
END $$;

-- ============================================================================
-- PHASE 9: Grant Permissions
-- ============================================================================

-- Grant read access to authenticated users
GRANT SELECT ON booking_units TO authenticated;
GRANT SELECT ON booking_unit_availability TO authenticated;

-- Grant full access to service role (for admin operations)
GRANT ALL ON booking_units TO service_role;
GRANT ALL ON booking_unit_availability TO service_role;

-- ============================================================================
-- PHASE 10: Create RLS Policies (Row Level Security)
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE booking_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_unit_availability ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can view all booking units
CREATE POLICY booking_units_staff_select
  ON booking_units
  FOR SELECT
  USING (
    is_admin_or_owner(auth.uid())
    OR is_manager(auth.uid())
    OR is_staff(auth.uid())
  );

-- Policy: Staff can modify booking units
CREATE POLICY booking_units_staff_modify
  ON booking_units
  FOR ALL
  USING (
    is_admin_or_owner(auth.uid())
    OR is_manager(auth.uid())
  );

-- Policy: Staff can view availability
CREATE POLICY availability_staff_select
  ON booking_unit_availability
  FOR SELECT
  USING (
    is_admin_or_owner(auth.uid())
    OR is_manager(auth.uid())
    OR is_staff(auth.uid())
  );

-- Policy: System can modify availability (via triggers)
CREATE POLICY availability_system_modify
  ON booking_unit_availability
  FOR ALL
  USING (true);  -- Triggers run as system

-- ============================================================================
-- FINAL COMMIT
-- ============================================================================

COMMIT;

-- ============================================================================
-- Post-Migration Tasks (Run Manually)
-- ============================================================================

-- 1. Verify data integrity
SELECT 'Migration completed successfully!' as status;

-- 2. Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename IN ('bookings', 'booking_units', 'booking_unit_availability')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 3. Test availability query performance
EXPLAIN ANALYZE
SELECT unit_id
FROM booking_unit_availability
WHERE unit_id = ANY(ARRAY['unit-1', 'unit-2'])
  AND date >= CURRENT_DATE
  AND date < CURRENT_DATE + INTERVAL '30 days'
  AND booking_status IN ('Confirmed', 'CheckedIn');

-- ============================================================================
-- Rollback Script (If Needed)
-- ============================================================================

-- Save this as booking-units-rollback.sql
/*
BEGIN;

-- Drop triggers
DROP TRIGGER IF EXISTS trigger_sync_booking_status ON bookings;
DROP TRIGGER IF EXISTS trigger_populate_availability ON booking_units;
DROP TRIGGER IF EXISTS trigger_cleanup_availability ON booking_units;

-- Drop functions
DROP FUNCTION IF EXISTS sync_booking_status();
DROP FUNCTION IF EXISTS populate_availability_on_unit_insert();
DROP FUNCTION IF EXISTS cleanup_availability_on_unit_delete();

-- Drop constraints
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS check_new_bookings_use_junction;
ALTER TABLE booking_unit_availability DROP CONSTRAINT IF EXISTS exclude_overlapping_bookings;

-- Drop tables
DROP TABLE IF EXISTS booking_unit_availability CASCADE;
DROP TABLE IF EXISTS booking_units CASCADE;

-- Restore unit_id NOT NULL constraint
ALTER TABLE bookings ALTER COLUMN unit_id SET NOT NULL;

-- Remove multi-unit flag
ALTER TABLE bookings DROP COLUMN IF EXISTS is_multi_unit;

COMMIT;
*/
