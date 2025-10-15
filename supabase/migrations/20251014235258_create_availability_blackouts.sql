-- ============================================================================
-- CREATE AVAILABILITY BLACKOUTS TABLE
-- ============================================================================
-- Purpose: Support blackout periods for unit maintenance, renovations, etc.
-- Required by: public availability function
-- Date: 2025-10-14
-- Version: 1.0
-- ============================================================================

-- Enable required extensions (safe to re-run)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ============================================================================
-- CREATE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS availability_blackouts (
    blackout_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID REFERENCES units(unit_id) ON DELETE CASCADE,
    blackout_type VARCHAR(20) NOT NULL CHECK (blackout_type IN ('Maintenance', 'Renovation', 'Seasonal', 'Manual')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL CHECK (end_date >= start_date),
    reason TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CREATE INDEXES
-- ============================================================================

-- GIST index for efficient daterange overlap queries
CREATE INDEX IF NOT EXISTS idx_blackouts_unit_dates
ON availability_blackouts USING gist (
    unit_id,
    daterange(start_date, end_date, '[]')
);

-- B-tree index for date range queries
CREATE INDEX IF NOT EXISTS idx_blackouts_date_range
ON availability_blackouts (start_date, end_date);

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Allow anonymous users to read blackouts (needed by public availability function)
GRANT SELECT ON availability_blackouts TO anon;
GRANT SELECT ON availability_blackouts TO authenticated;

-- ============================================================================
-- METADATA
-- ============================================================================

COMMENT ON TABLE availability_blackouts IS
  'Unit blackout periods for maintenance, renovations, seasonal closures, etc. Used by public availability calendar to block dates.';

COMMENT ON COLUMN availability_blackouts.blackout_type IS
  'Type of blackout: Maintenance, Renovation, Seasonal, or Manual';

COMMENT ON COLUMN availability_blackouts.start_date IS
  'First date of blackout period (inclusive)';

COMMENT ON COLUMN availability_blackouts.end_date IS
  'Last date of blackout period (inclusive)';
