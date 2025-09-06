-- =============================================
-- Migration: 007_booking_system_tables.sql
-- Description: Create booking system tables with application-level tenant isolation
-- Author: System
-- Date: 2025-01-08
-- Note: Uses application-level filtering, NOT RLS
-- =============================================

BEGIN;

-- Set timezone for consistent timestamps
SET timezone = 'Asia/Manila';

-- =============================================
-- Enable required extensions
-- =============================================
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- =============================================
-- STEP 1: Create Rooms Table
-- =============================================
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  room_number VARCHAR(50) NOT NULL,
  room_type VARCHAR(100) NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 2,
  base_price DECIMAL(12,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  amenities JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Business constraints
  CONSTRAINT rooms_capacity_positive CHECK (capacity > 0),
  CONSTRAINT rooms_base_price_positive CHECK (base_price >= 0),
  -- Unique room number per project
  CONSTRAINT rooms_project_room_number_unique UNIQUE(project_id, room_number)
);

-- Add foreign key constraint to projects table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects') THEN
        ALTER TABLE rooms 
        ADD CONSTRAINT fk_rooms_project 
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
    END IF;
END $$;

-- =============================================
-- STEP 2: Create Bookings Table
-- =============================================
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  booking_code VARCHAR(20) NOT NULL,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  guest_name VARCHAR(255) NOT NULL,
  guest_email VARCHAR(255),
  guest_phone VARCHAR(20) NOT NULL,
  guest_count INTEGER NOT NULL DEFAULT 1,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  paid_amount DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  payment_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Business constraints
  CONSTRAINT bookings_check_out_after_check_in CHECK (check_out_date > check_in_date),
  CONSTRAINT bookings_guest_count_positive CHECK (guest_count > 0),
  CONSTRAINT bookings_total_amount_positive CHECK (total_amount >= 0),
  CONSTRAINT bookings_paid_amount_positive CHECK (paid_amount >= 0),
  CONSTRAINT bookings_paid_not_exceed_total CHECK (paid_amount <= total_amount),
  -- Unique booking code per project
  CONSTRAINT bookings_project_booking_code_unique UNIQUE(project_id, booking_code)
);

-- Add foreign key constraint to projects table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects') THEN
        ALTER TABLE bookings 
        ADD CONSTRAINT fk_bookings_project 
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
    END IF;
END $$;

-- =============================================
-- STEP 3: Prevent Double Bookings with Exclusion Constraint
-- =============================================
-- This prevents the same room from being double-booked for overlapping dates
-- within the same project, excluding cancelled bookings
ALTER TABLE bookings ADD CONSTRAINT no_double_booking_per_project
EXCLUDE USING GIST (
  project_id WITH =,
  room_id WITH =,
  daterange(check_in_date, check_out_date, '[)') WITH &&
) WHERE (status != 'cancelled');

-- =============================================
-- STEP 4: Create Performance Indexes
-- =============================================

-- Rooms table indexes
CREATE INDEX IF NOT EXISTS idx_rooms_project_id ON rooms(project_id);
CREATE INDEX IF NOT EXISTS idx_rooms_project_active ON rooms(project_id, is_active);
CREATE INDEX IF NOT EXISTS idx_rooms_project_type ON rooms(project_id, room_type);

-- Bookings table indexes for availability queries
CREATE INDEX IF NOT EXISTS idx_bookings_project_id ON bookings(project_id);
CREATE INDEX IF NOT EXISTS idx_bookings_availability ON bookings(
  project_id,
  room_id,
  check_in_date,
  check_out_date
) WHERE status != 'cancelled';

-- Calendar view index  
CREATE INDEX IF NOT EXISTS idx_bookings_calendar ON bookings(
  project_id,
  check_in_date
) INCLUDE (room_id, guest_name, status)
WHERE status != 'cancelled';

-- Status and timeline indexes
CREATE INDEX IF NOT EXISTS idx_bookings_project_status ON bookings(project_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_project_created ON bookings(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_project_dates ON bookings(project_id, check_in_date, check_out_date);

-- Room lookup index
CREATE INDEX IF NOT EXISTS idx_bookings_room_dates ON bookings(
  room_id, 
  check_in_date, 
  check_out_date
) WHERE status != 'cancelled';

-- =============================================
-- STEP 5: Add Audit Trail Triggers
-- =============================================

-- Trigger to update updated_at timestamp for rooms
CREATE OR REPLACE FUNCTION update_rooms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_rooms_updated_at
    BEFORE UPDATE ON rooms
    FOR EACH ROW EXECUTE FUNCTION update_rooms_updated_at();

-- Trigger to update updated_at timestamp for bookings
CREATE OR REPLACE FUNCTION update_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_bookings_updated_at
    BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_bookings_updated_at();

-- =============================================
-- STEP 6: Add Table Comments for Documentation
-- =============================================

COMMENT ON TABLE rooms IS 'Resort rooms/properties - filtered by project_id in application layer';
COMMENT ON TABLE bookings IS 'Booking reservations - filtered by project_id in application layer with conflict prevention';

COMMENT ON COLUMN rooms.project_id IS 'Links room to specific project for multi-tenant isolation';
COMMENT ON COLUMN rooms.amenities IS 'JSON array of amenity names/codes';
COMMENT ON COLUMN bookings.project_id IS 'Links booking to specific project for multi-tenant isolation';
COMMENT ON COLUMN bookings.booking_code IS 'Human-readable booking reference (unique per project)';

COMMENT ON CONSTRAINT no_double_booking_per_project ON bookings IS 'Prevents overlapping bookings for same room within project (excludes cancelled bookings)';

-- =============================================
-- NOTICE: Application-Level Security Required
-- =============================================
-- IMPORTANT: This database has NO Row-Level Security (RLS).
-- The application MUST enforce project isolation by:
-- 1. Including WHERE project_id = ? in ALL queries
-- 2. Validating user access to projects before queries
-- 3. Using the availability service patterns defined in tests
-- 4. Logging all access to audit_logs table
-- =============================================

COMMIT;

-- =============================================
-- Post-Migration Verification Queries
-- =============================================
-- Run these queries to verify the migration:

-- Check tables were created with project_id:
-- SELECT table_name, column_name 
-- FROM information_schema.columns 
-- WHERE table_name IN ('rooms', 'bookings') AND column_name = 'project_id';

-- Check exclusion constraint exists:
-- SELECT conname, contype 
-- FROM pg_constraint 
-- WHERE conname = 'no_double_booking_per_project';

-- Check indexes were created:
-- SELECT tablename, indexname 
-- FROM pg_indexes 
-- WHERE indexname LIKE 'idx_%booking%' OR indexname LIKE 'idx_%room%'
-- ORDER BY tablename, indexname;