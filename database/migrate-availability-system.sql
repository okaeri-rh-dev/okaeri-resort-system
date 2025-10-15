-- ============================================
-- AVAILABILITY SYSTEM MIGRATION SCRIPT
-- Safe migration for existing Okaeri Resort System
-- Version: 1.0.0
-- ============================================

-- Start transaction for safe migration
BEGIN;

-- Check if migration is needed
DO $$
BEGIN
    -- Check if availability system is already installed
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'availability_blackouts'
    ) THEN
        RAISE NOTICE 'Availability system already installed. Skipping migration.';
        RETURN;
    END IF;

    RAISE NOTICE 'Starting availability system migration...';
END $$;

-- Enable required extensions (safe to re-run)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ============================================
-- CREATE NEW TABLES
-- ============================================

-- Availability blackouts table
CREATE TABLE IF NOT EXISTS availability_blackouts (
    blackout_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID REFERENCES units(unit_id) ON DELETE CASCADE,
    blackout_type VARCHAR(20) NOT NULL CHECK (blackout_type IN ('Maintenance', 'Renovation', 'Seasonal', 'Manual')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL CHECK (end_date >= start_date),
    reason TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Availability cache table
CREATE TABLE IF NOT EXISTS availability_cache (
    cache_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID REFERENCES units(unit_id) ON DELETE CASCADE,
    date_range_start DATE NOT NULL,
    date_range_end DATE NOT NULL,
    available_dates DATE[] NOT NULL,
    cache_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CREATE OPTIMIZED INDEXES
-- ============================================

-- Drop existing basic indexes if they exist (to be replaced with optimized ones)
DO $$
BEGIN
    -- Check and drop old index if it exists
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_bookings_unit_dates') THEN
        DROP INDEX IF EXISTS idx_bookings_unit_dates;
        RAISE NOTICE 'Dropped old index: idx_bookings_unit_dates';
    END IF;
END $$;

-- Create optimized indexes for availability queries
-- Note: GIST index with daterange removed due to timestamptz incompatibility
-- The combination of idx_bookings_status_dates and idx_bookings_unit_status_range
-- provides sufficient query optimization for availability checks

CREATE INDEX IF NOT EXISTS idx_bookings_status_dates
ON bookings (booking_status, check_in, check_out)
WHERE booking_status NOT IN ('Cancelled');

CREATE INDEX IF NOT EXISTS idx_bookings_unit_status_range
ON bookings (unit_id, booking_status, check_in)
WHERE booking_status NOT IN ('Cancelled');

-- Blackout period indexes
CREATE INDEX IF NOT EXISTS idx_blackouts_unit_dates
ON availability_blackouts USING gist (
    unit_id,
    daterange(start_date, end_date, '[]')
);

CREATE INDEX IF NOT EXISTS idx_blackouts_date_range
ON availability_blackouts (start_date, end_date);

-- Cache table indexes
CREATE INDEX IF NOT EXISTS idx_availability_cache_unit_dates
ON availability_cache (unit_id, date_range_start, date_range_end, cache_expires_at);

CREATE INDEX IF NOT EXISTS idx_availability_cache_expires
ON availability_cache (cache_expires_at);

-- Enhanced units index
CREATE INDEX IF NOT EXISTS idx_units_status_type
ON units (unit_status, unit_type)
WHERE unit_status = 'Available';

-- ============================================
-- CREATE STORED FUNCTIONS
-- ============================================

-- Fast availability check function
CREATE OR REPLACE FUNCTION check_unit_availability_fast(
    p_unit_id UUID,
    p_check_in DATE,
    p_check_out DATE,
    p_exclude_booking_id UUID DEFAULT NULL
)
RETURNS TABLE (
    is_available BOOLEAN,
    conflicting_bookings INT,
    blackout_periods INT,
    unit_status TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH booking_conflicts AS (
        SELECT COUNT(*) as booking_count
        FROM bookings b
        WHERE b.unit_id = p_unit_id
          AND b.booking_status NOT IN ('Cancelled', 'CheckedOut')
          AND (p_exclude_booking_id IS NULL OR b.booking_id != p_exclude_booking_id)
          AND daterange(b.check_in::date, b.check_out::date, '[]') && daterange(p_check_in, p_check_out, '[]')
    ),
    blackout_conflicts AS (
        SELECT COUNT(*) as blackout_count
        FROM availability_blackouts ab
        WHERE ab.unit_id = p_unit_id
          AND daterange(ab.start_date, ab.end_date, '[]') && daterange(p_check_in, p_check_out, '[]')
    ),
    unit_info AS (
        SELECT u.unit_status
        FROM units u
        WHERE u.unit_id = p_unit_id
    )
    SELECT
        (bc.booking_count = 0 AND blc.blackout_count = 0 AND ui.unit_status = 'Available') as is_available,
        bc.booking_count::INT as conflicting_bookings,
        blc.blackout_count::INT as blackout_periods,
        ui.unit_status as unit_status
    FROM booking_conflicts bc, blackout_conflicts blc, unit_info ui;
END;
$$ LANGUAGE plpgsql STABLE;

-- Multi-unit availability check function
CREATE OR REPLACE FUNCTION check_multi_unit_availability(
    p_check_in DATE,
    p_check_out DATE,
    p_unit_types TEXT[] DEFAULT NULL,
    p_min_occupancy INT DEFAULT NULL,
    p_max_rate DECIMAL DEFAULT NULL,
    p_limit INT DEFAULT 50
)
RETURNS TABLE (
    unit_id UUID,
    unit_name VARCHAR(100),
    unit_code VARCHAR(10),
    unit_type VARCHAR(20),
    max_occupancy INT,
    base_rate DECIMAL(10,2),
    weekend_rate DECIMAL(10,2),
    is_available BOOLEAN,
    next_available_date DATE
) AS $$
BEGIN
    RETURN QUERY
    WITH available_units AS (
        SELECT
            u.unit_id,
            u.unit_name,
            u.unit_code,
            u.unit_type,
            u.max_occupancy,
            u.base_rate,
            u.weekend_rate,
            CASE
                WHEN EXISTS (
                    SELECT 1 FROM bookings b
                    WHERE b.unit_id = u.unit_id
                      AND b.booking_status NOT IN ('Cancelled', 'CheckedOut')
                      AND daterange(b.check_in::date, b.check_out::date, '[]') && daterange(p_check_in, p_check_out, '[]')
                ) OR EXISTS (
                    SELECT 1 FROM availability_blackouts ab
                    WHERE ab.unit_id = u.unit_id
                      AND daterange(ab.start_date, ab.end_date, '[]') && daterange(p_check_in, p_check_out, '[]')
                )
                THEN FALSE
                ELSE TRUE
            END as is_available,
            (
                SELECT MIN(b.check_out)
                FROM bookings b
                WHERE b.unit_id = u.unit_id
                  AND b.booking_status NOT IN ('Cancelled', 'CheckedOut')
                  AND b.check_out > p_check_in
            ) as next_available_date
        FROM units u
        WHERE u.unit_status = 'Available'
          AND (p_unit_types IS NULL OR u.unit_type = ANY(p_unit_types))
          AND (p_min_occupancy IS NULL OR u.max_occupancy >= p_min_occupancy)
          AND (p_max_rate IS NULL OR u.base_rate <= p_max_rate)
        ORDER BY
            is_available DESC,
            u.base_rate ASC,
            u.unit_name ASC
        LIMIT p_limit
    )
    SELECT * FROM available_units;
END;
$$ LANGUAGE plpgsql STABLE;

-- Availability calendar function
CREATE OR REPLACE FUNCTION get_unit_availability_calendar(
    p_unit_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    calendar_date DATE,
    status VARCHAR(20),
    booking_id UUID,
    guest_name VARCHAR(100),
    booking_reference VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    WITH date_series AS (
        SELECT generate_series(p_start_date, p_end_date, '1 day'::interval)::date as calendar_date
    ),
    booking_dates AS (
        SELECT
            ds.calendar_date,
            b.booking_id,
            b.guest_name,
            b.booking_reference,
            CASE
                WHEN ds.calendar_date = b.check_in THEN 'CheckIn'
                WHEN ds.calendar_date = b.check_out THEN 'CheckOut'
                WHEN ds.calendar_date > b.check_in AND ds.calendar_date < b.check_out THEN 'Occupied'
                ELSE 'Available'
            END as status
        FROM date_series ds
        LEFT JOIN bookings b ON (
            b.unit_id = p_unit_id
            AND b.booking_status NOT IN ('Cancelled', 'CheckedOut')
            AND ds.calendar_date >= b.check_in
            AND ds.calendar_date <= b.check_out
        )
    ),
    blackout_dates AS (
        SELECT
            bd.calendar_date,
            bd.booking_id,
            bd.guest_name,
            bd.booking_reference,
            CASE
                WHEN EXISTS (
                    SELECT 1 FROM availability_blackouts ab
                    WHERE ab.unit_id = p_unit_id
                      AND bd.calendar_date >= ab.start_date
                      AND bd.calendar_date <= ab.end_date
                ) THEN 'Maintenance'
                ELSE bd.status
            END as final_status
        FROM booking_dates bd
    )
    SELECT
        bd.calendar_date,
        COALESCE(bd.final_status, 'Available') as status,
        bd.booking_id,
        bd.guest_name,
        bd.booking_reference
    FROM blackout_dates bd
    ORDER BY bd.calendar_date;
END;
$$ LANGUAGE plpgsql STABLE;

-- Cache refresh function
CREATE OR REPLACE FUNCTION refresh_availability_cache(
    p_unit_id UUID DEFAULT NULL,
    p_days_ahead INT DEFAULT 90
)
RETURNS INT AS $$
DECLARE
    cache_count INT := 0;
    unit_record RECORD;
BEGIN
    -- Clear expired cache entries
    DELETE FROM availability_cache WHERE cache_expires_at < NOW();

    -- Loop through units (all or specific unit)
    FOR unit_record IN
        SELECT unit_id FROM units
        WHERE (p_unit_id IS NULL OR unit_id = p_unit_id)
          AND unit_status = 'Available'
    LOOP
        -- Delete existing cache for this unit
        DELETE FROM availability_cache
        WHERE unit_id = unit_record.unit_id
          AND date_range_start >= CURRENT_DATE;

        -- Insert new cache entry
        INSERT INTO availability_cache (
            unit_id,
            date_range_start,
            date_range_end,
            available_dates,
            cache_expires_at
        )
        SELECT
            unit_record.unit_id,
            CURRENT_DATE,
            CURRENT_DATE + p_days_ahead,
            ARRAY(
                SELECT d::date
                FROM generate_series(CURRENT_DATE, CURRENT_DATE + p_days_ahead, '1 day'::interval) d
                WHERE NOT EXISTS (
                    SELECT 1 FROM bookings b
                    WHERE b.unit_id = unit_record.unit_id
                      AND b.booking_status NOT IN ('Cancelled', 'CheckedOut')
                      AND d::date >= b.check_in AND d::date <= b.check_out
                )
                AND NOT EXISTS (
                    SELECT 1 FROM availability_blackouts ab
                    WHERE ab.unit_id = unit_record.unit_id
                      AND d::date >= ab.start_date AND d::date <= ab.end_date
                )
            ),
            NOW() + interval '1 hour'
        ;

        cache_count := cache_count + 1;
    END LOOP;

    RETURN cache_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- CREATE TRIGGERS
-- ============================================

-- Cache invalidation trigger function
CREATE OR REPLACE FUNCTION invalidate_availability_cache()
RETURNS TRIGGER AS $$
BEGIN
    -- Invalidate cache for affected unit
    DELETE FROM availability_cache
    WHERE unit_id = COALESCE(NEW.unit_id, OLD.unit_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply cache invalidation triggers
DROP TRIGGER IF EXISTS invalidate_cache_on_booking_change ON bookings;
CREATE TRIGGER invalidate_cache_on_booking_change
    AFTER INSERT OR UPDATE OR DELETE ON bookings
    FOR EACH ROW EXECUTE FUNCTION invalidate_availability_cache();

DROP TRIGGER IF EXISTS invalidate_cache_on_blackout_change ON availability_blackouts;
CREATE TRIGGER invalidate_cache_on_blackout_change
    AFTER INSERT OR UPDATE OR DELETE ON availability_blackouts
    FOR EACH ROW EXECUTE FUNCTION invalidate_availability_cache();

DROP TRIGGER IF EXISTS invalidate_cache_on_unit_change ON units;
CREATE TRIGGER invalidate_cache_on_unit_change
    AFTER UPDATE ON units
    FOR EACH ROW
    WHEN (OLD.unit_status IS DISTINCT FROM NEW.unit_status)
    EXECUTE FUNCTION invalidate_availability_cache();

-- Updated_at triggers for new tables
DROP TRIGGER IF EXISTS update_blackouts_updated_at ON availability_blackouts;
CREATE TRIGGER update_blackouts_updated_at BEFORE UPDATE ON availability_blackouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- CREATE MONITORING VIEWS
-- ============================================

-- Cache performance metrics view
CREATE OR REPLACE VIEW cache_performance_metrics AS
SELECT
    COUNT(*) as total_cache_entries,
    COUNT(*) FILTER (WHERE cache_expires_at > NOW()) as valid_cache_entries,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE cache_expires_at > NOW()) / NULLIF(COUNT(*), 0),
        2
    ) as cache_hit_ratio_percent
FROM availability_cache;

-- ============================================
-- INITIALIZE CACHE
-- ============================================

-- Populate initial cache for all available units
SELECT refresh_availability_cache() as cache_entries_created;

-- ============================================
-- VALIDATION AND CLEANUP
-- ============================================

-- Verify that all objects were created successfully
DO $$
DECLARE
    table_count INTEGER;
    function_count INTEGER;
    index_count INTEGER;
    trigger_count INTEGER;
BEGIN
    -- Count created tables
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_name IN ('availability_blackouts', 'availability_cache');

    -- Count created functions
    SELECT COUNT(*) INTO function_count
    FROM information_schema.routines
    WHERE routine_name IN (
        'check_unit_availability_fast',
        'check_multi_unit_availability',
        'get_unit_availability_calendar',
        'refresh_availability_cache',
        'invalidate_availability_cache'
    );

    -- Count created indexes
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes
    WHERE indexname LIKE 'idx_%availability%' OR indexname LIKE 'idx_%blackout%' OR indexname LIKE 'idx_%cache%';

    -- Count created triggers
    SELECT COUNT(*) INTO trigger_count
    FROM information_schema.triggers
    WHERE trigger_name LIKE '%availability%' OR trigger_name LIKE '%blackout%';

    -- Report migration results
    RAISE NOTICE 'Migration completed successfully:';
    RAISE NOTICE '  - Tables created: %', table_count;
    RAISE NOTICE '  - Functions created: %', function_count;
    RAISE NOTICE '  - Indexes created: %', index_count;
    RAISE NOTICE '  - Triggers created: %', trigger_count;

    -- Verify critical components
    IF table_count < 2 THEN
        RAISE EXCEPTION 'Migration failed: Not all tables were created';
    END IF;

    IF function_count < 4 THEN
        RAISE EXCEPTION 'Migration failed: Not all functions were created';
    END IF;

    RAISE NOTICE 'Availability system migration completed successfully!';
END $$;

-- Commit the transaction
COMMIT;

-- ============================================
-- POST-MIGRATION RECOMMENDATIONS
-- ============================================

-- Update table statistics for optimal query planning
ANALYZE bookings;
ANALYZE availability_blackouts;
ANALYZE availability_cache;
ANALYZE units;

-- Display helpful information
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'MIGRATION COMPLETED SUCCESSFULLY';
    RAISE NOTICE '============================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Update your application code to use the new availability functions';
    RAISE NOTICE '2. Test the new availability checking functionality';
    RAISE NOTICE '3. Monitor cache performance with: SELECT * FROM cache_performance_metrics;';
    RAISE NOTICE '4. Refresh cache as needed with: SELECT refresh_availability_cache();';
    RAISE NOTICE '';
    RAISE NOTICE 'For detailed usage instructions, see: docs/availability-optimization-guide.md';
    RAISE NOTICE '';
END $$;