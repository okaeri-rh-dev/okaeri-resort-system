# Query Patterns and Performance Optimization Guide

## Overview

This guide provides optimized query patterns for common operations in the Okaeri
Resort Management System, specifically designed for multi-tenant architecture
with Neon PostgreSQL.

## Table of Contents

1. [Dashboard Queries](#dashboard-queries)
2. [Booking Management](#booking-management)
3. [Financial Reports](#financial-reports)
4. [Search Operations](#search-operations)
5. [Batch Operations](#batch-operations)
6. [Analytics Queries](#analytics-queries)
7. [Performance Tips](#performance-tips)

## Dashboard Queries

### Today's Overview (Optimized)

```sql
-- Single query for all dashboard metrics
WITH project_context AS (
  SELECT current_setting('app.current_project', true)::UUID as project_id
),
today_bookings AS (
  SELECT
    COUNT(*) FILTER (WHERE status = 'checked_in') as checked_in,
    COUNT(*) FILTER (WHERE status = 'checking_in') as checking_in_today,
    COUNT(*) FILTER (WHERE status = 'checking_out') as checking_out_today,
    COUNT(*) FILTER (WHERE status = 'confirmed') as upcoming,
    SUM(total_amount) FILTER (WHERE status != 'cancelled') as expected_revenue,
    SUM(paid_amount) as collected_revenue
  FROM bookings b, project_context pc
  WHERE b.project_id = pc.project_id
    AND (
      (b.check_in_date = CURRENT_DATE) OR
      (b.check_out_date = CURRENT_DATE) OR
      (b.status = 'checked_in' AND b.check_out_date > CURRENT_DATE)
    )
),
today_payments AS (
  SELECT
    COUNT(*) as payment_count,
    SUM(amount) as total_collected,
    SUM(amount) FILTER (WHERE payment_method = 'cash') as cash_collected,
    SUM(amount) FILTER (WHERE payment_method = 'gcash') as gcash_collected
  FROM payments p, project_context pc
  WHERE p.project_id = pc.project_id
    AND DATE(p.created_at) = CURRENT_DATE
    AND p.status = 'completed'
),
occupancy AS (
  SELECT
    COUNT(DISTINCT room_number) as occupied_rooms,
    (SELECT COUNT(DISTINCT room_number) FROM bookings WHERE project_id = pc.project_id) as total_rooms
  FROM bookings b, project_context pc
  WHERE b.project_id = pc.project_id
    AND b.status = 'checked_in'
    AND CURRENT_DATE BETWEEN b.check_in_date AND b.check_out_date
)
SELECT
  tb.*,
  tp.*,
  o.*,
  ROUND((o.occupied_rooms::NUMERIC / NULLIF(o.total_rooms, 0)) * 100, 2) as occupancy_rate
FROM today_bookings tb, today_payments tp, occupancy o;

-- Index support for this query:
CREATE INDEX idx_bookings_dashboard ON bookings(project_id, check_in_date, check_out_date, status)
  WHERE status IN ('checked_in', 'checking_in', 'checking_out', 'confirmed');
```

### Weekly Performance Metrics

```sql
-- Materialized view for weekly metrics (refresh daily)
CREATE MATERIALIZED VIEW mv_weekly_metrics AS
WITH date_series AS (
  SELECT generate_series(
    CURRENT_DATE - INTERVAL '7 days',
    CURRENT_DATE,
    '1 day'::interval
  )::DATE as date
),
daily_metrics AS (
  SELECT
    b.project_id,
    DATE(b.check_in_date) as date,
    COUNT(*) as bookings,
    SUM(total_amount) as revenue,
    AVG(number_of_guests) as avg_guests,
    COUNT(DISTINCT guest_phone) as unique_guests
  FROM bookings b
  WHERE b.check_in_date >= CURRENT_DATE - INTERVAL '7 days'
    AND b.status != 'cancelled'
  GROUP BY project_id, DATE(check_in_date)
)
SELECT
  dm.project_id,
  ds.date,
  COALESCE(dm.bookings, 0) as bookings,
  COALESCE(dm.revenue, 0) as revenue,
  COALESCE(dm.avg_guests, 0) as avg_guests,
  COALESCE(dm.unique_guests, 0) as unique_guests,
  -- Calculate week-over-week change
  LAG(dm.bookings, 7) OVER (PARTITION BY dm.project_id ORDER BY ds.date) as bookings_last_week,
  LAG(dm.revenue, 7) OVER (PARTITION BY dm.project_id ORDER BY ds.date) as revenue_last_week
FROM date_series ds
LEFT JOIN daily_metrics dm ON ds.date = dm.date;

CREATE UNIQUE INDEX ON mv_weekly_metrics(project_id, date);

-- Query the view with RLS
SELECT * FROM mv_weekly_metrics
WHERE project_id = current_setting('app.current_project', true)::UUID
ORDER BY date DESC;
```

## Booking Management

### Search Bookings (Optimized)

```sql
-- Parameterized search with multiple criteria
CREATE OR REPLACE FUNCTION search_bookings(
  p_search_term TEXT DEFAULT NULL,
  p_status TEXT[] DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
) RETURNS TABLE (
  id UUID,
  booking_code VARCHAR,
  guest_name VARCHAR,
  guest_phone VARCHAR,
  check_in_date DATE,
  check_out_date DATE,
  status VARCHAR,
  total_amount DECIMAL,
  paid_amount DECIMAL,
  created_at TIMESTAMP
) AS $$
BEGIN
  -- Validate RLS context is set
  IF current_setting('app.current_project', true) IS NULL THEN
    RAISE EXCEPTION 'RLS context not set: project_id required';
  END IF;
  RETURN QUERY
  SELECT
    b.id,
    b.booking_code,
    b.guest_name,
    b.guest_phone,
    b.check_in_date,
    b.check_out_date,
    b.status,
    b.total_amount,
    b.paid_amount,
    b.created_at
  FROM bookings b
  WHERE b.project_id = current_setting('app.current_project', true)::UUID
    AND (p_search_term IS NULL OR (
      b.booking_code ILIKE '%' || p_search_term || '%' OR
      b.guest_name ILIKE '%' || p_search_term || '%' OR
      b.guest_phone ILIKE '%' || p_search_term || '%'
    ))
    AND (p_status IS NULL OR b.status = ANY(p_status))
    AND (p_date_from IS NULL OR b.check_in_date >= p_date_from)
    AND (p_date_to IS NULL OR b.check_out_date <= p_date_to)
  ORDER BY b.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Supporting indexes
CREATE INDEX idx_bookings_search ON bookings(project_id, guest_name varchar_pattern_ops);
CREATE INDEX idx_bookings_phone ON bookings(project_id, guest_phone varchar_pattern_ops);
CREATE INDEX idx_bookings_code ON bookings(project_id, booking_code);
```

### Availability Check

```sql
-- Check room availability for date range
CREATE OR REPLACE FUNCTION check_availability(
  p_check_in DATE,
  p_check_out DATE,
  p_room_type VARCHAR DEFAULT NULL
) RETURNS TABLE (
  room_type VARCHAR,
  total_rooms INT,
  booked_rooms INT,
  available_rooms INT
) AS $$
BEGIN
  -- Validate RLS context is set
  IF current_setting('app.current_project', true) IS NULL THEN
    RAISE EXCEPTION 'RLS context not set: project_id required';
  END IF;
  RETURN QUERY
  WITH room_inventory AS (
    SELECT
      r.room_type,
      COUNT(*) as total_rooms
    FROM rooms r
    WHERE r.project_id = current_setting('app.current_project', true)::UUID
      AND r.is_active = true
      AND (p_room_type IS NULL OR r.room_type = p_room_type)
    GROUP BY r.room_type
  ),
  booked AS (
    SELECT
      b.room_type,
      COUNT(DISTINCT b.room_number) as booked_rooms
    FROM bookings b
    WHERE b.project_id = current_setting('app.current_project', true)::UUID
      AND b.status NOT IN ('cancelled', 'no_show')
      AND (
        (b.check_in_date, b.check_out_date) OVERLAPS (p_check_in, p_check_out)
      )
      AND (p_room_type IS NULL OR b.room_type = p_room_type)
    GROUP BY b.room_type
  )
  SELECT
    ri.room_type,
    ri.total_rooms,
    COALESCE(b.booked_rooms, 0) as booked_rooms,
    ri.total_rooms - COALESCE(b.booked_rooms, 0) as available_rooms
  FROM room_inventory ri
  LEFT JOIN booked b ON ri.room_type = b.room_type
  WHERE ri.total_rooms - COALESCE(b.booked_rooms, 0) > 0;
END;
$$ LANGUAGE plpgsql STABLE;

-- Index for overlapping date queries
CREATE INDEX idx_bookings_dates_overlap ON bookings(project_id, check_in_date, check_out_date)
  WHERE status NOT IN ('cancelled', 'no_show');
```

## Financial Reports

### Monthly Revenue Report

```sql
-- Comprehensive monthly financial report
CREATE OR REPLACE FUNCTION monthly_financial_report(
  p_year INT,
  p_month INT
) RETURNS TABLE (
  category TEXT,
  amount DECIMAL,
  transaction_count INT,
  percentage DECIMAL
) AS $$
DECLARE
  v_project_id UUID;
  v_start_date DATE;
  v_end_date DATE;
  v_total_revenue DECIMAL;
BEGIN
  -- Validate RLS context is set
  IF current_setting('app.current_project', true) IS NULL THEN
    RAISE EXCEPTION 'RLS context not set: project_id required';
  END IF;

  v_project_id := current_setting('app.current_project', true)::UUID;
  v_start_date := DATE(p_year || '-' || LPAD(p_month::TEXT, 2, '0') || '-01');
  v_end_date := v_start_date + INTERVAL '1 month' - INTERVAL '1 day';

  -- Calculate total revenue for percentages
  SELECT SUM(amount) INTO v_total_revenue
  FROM income
  WHERE project_id = v_project_id
    AND DATE(received_at) BETWEEN v_start_date AND v_end_date;

  RETURN QUERY
  -- Income by source
  SELECT
    'Income - ' || i.source as category,
    SUM(i.amount) as amount,
    COUNT(*)::INT as transaction_count,
    ROUND((SUM(i.amount) / NULLIF(v_total_revenue, 0)) * 100, 2) as percentage
  FROM income i
  WHERE i.project_id = v_project_id
    AND DATE(i.received_at) BETWEEN v_start_date AND v_end_date
  GROUP BY i.source

  UNION ALL

  -- Expenses by category
  SELECT
    'Expense - ' || ec.name as category,
    SUM(e.amount) as amount,
    COUNT(*)::INT as transaction_count,
    NULL as percentage
  FROM expenses e
  JOIN expense_categories ec ON e.category_id = ec.id
  WHERE e.project_id = v_project_id
    AND DATE(e.paid_at) BETWEEN v_start_date AND v_end_date
    AND e.status = 'approved'
  GROUP BY ec.name

  UNION ALL

  -- Net profit
  SELECT
    'Net Profit' as category,
    (
      SELECT SUM(amount) FROM income
      WHERE project_id = v_project_id
        AND DATE(received_at) BETWEEN v_start_date AND v_end_date
    ) - (
      SELECT COALESCE(SUM(amount), 0) FROM expenses
      WHERE project_id = v_project_id
        AND DATE(paid_at) BETWEEN v_start_date AND v_end_date
        AND status = 'approved'
    ) as amount,
    NULL as transaction_count,
    NULL as percentage

  ORDER BY category;
END;
$$ LANGUAGE plpgsql STABLE;

-- Supporting index
CREATE INDEX idx_income_monthly ON income(project_id, received_at, source);
CREATE INDEX idx_expenses_monthly ON expenses(project_id, paid_at, category_id)
  WHERE status = 'approved';
```

### Payment Reconciliation

```sql
-- Reconcile payments with bookings
CREATE OR REPLACE FUNCTION reconcile_payments(
  p_date_from DATE,
  p_date_to DATE
) RETURNS TABLE (
  booking_id UUID,
  booking_code VARCHAR,
  guest_name VARCHAR,
  total_amount DECIMAL,
  paid_amount DECIMAL,
  balance DECIMAL,
  payment_count INT,
  last_payment_date TIMESTAMP,
  status VARCHAR
) AS $$
BEGIN
  -- Validate RLS context is set
  IF current_setting('app.current_project', true) IS NULL THEN
    RAISE EXCEPTION 'RLS context not set: project_id required';
  END IF;
  RETURN QUERY
  WITH booking_payments AS (
    SELECT
      b.id as booking_id,
      b.booking_code,
      b.guest_name,
      b.total_amount,
      COALESCE(SUM(p.amount), 0) as total_paid,
      COUNT(p.id)::INT as payment_count,
      MAX(p.created_at) as last_payment_date
    FROM bookings b
    LEFT JOIN payments p ON b.id = p.booking_id AND p.status = 'completed'
    WHERE b.project_id = current_setting('app.current_project', true)::UUID
      AND b.check_in_date BETWEEN p_date_from AND p_date_to
    GROUP BY b.id, b.booking_code, b.guest_name, b.total_amount
  )
  SELECT
    bp.booking_id,
    bp.booking_code,
    bp.guest_name,
    bp.total_amount,
    bp.total_paid as paid_amount,
    bp.total_amount - bp.total_paid as balance,
    bp.payment_count,
    bp.last_payment_date,
    CASE
      WHEN bp.total_paid >= bp.total_amount THEN 'paid'
      WHEN bp.total_paid > 0 THEN 'partial'
      ELSE 'pending'
    END as status
  FROM booking_payments bp
  WHERE bp.total_amount - bp.total_paid != 0 -- Only show unreconciled
  ORDER BY bp.booking_code;
END;
$$ LANGUAGE plpgsql STABLE;
```

## Search Operations

### Full-Text Search (Philippine Names Optimized)

```sql
-- Create search configuration for Philippine names
CREATE TEXT SEARCH CONFIGURATION filipino (COPY = simple);

-- Add search columns and indexes
ALTER TABLE guests ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('filipino',
      COALESCE(guest_name, '') || ' ' ||
      COALESCE(guest_phone, '') || ' ' ||
      COALESCE(guest_email, '')
    )
  ) STORED;

CREATE INDEX idx_guests_search ON guests USING GIN(search_vector);

-- Search function
CREATE OR REPLACE FUNCTION search_guests(
  p_query TEXT,
  p_limit INT DEFAULT 20
) RETURNS TABLE (
  id UUID,
  name VARCHAR,
  phone VARCHAR,
  email VARCHAR,
  total_bookings INT,
  last_booking DATE,
  rank REAL
) AS $$
BEGIN
  -- Validate RLS context is set
  IF current_setting('app.current_project', true) IS NULL THEN
    RAISE EXCEPTION 'RLS context not set: project_id required';
  END IF;
  RETURN QUERY
  SELECT
    g.id,
    g.guest_name as name,
    g.guest_phone as phone,
    g.guest_email as email,
    COUNT(b.id)::INT as total_bookings,
    MAX(b.check_in_date) as last_booking,
    ts_rank(g.search_vector, plainto_tsquery('filipino', p_query)) as rank
  FROM guests g
  LEFT JOIN bookings b ON g.id = b.guest_id
  WHERE g.project_id = current_setting('app.current_project', true)::UUID
    AND g.search_vector @@ plainto_tsquery('filipino', p_query)
  GROUP BY g.id, g.guest_name, g.guest_phone, g.guest_email, g.search_vector
  ORDER BY rank DESC, total_bookings DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;
```

### Autocomplete Optimization

```sql
-- Fast autocomplete for guest names
CREATE OR REPLACE FUNCTION autocomplete_guests(
  p_prefix TEXT,
  p_limit INT DEFAULT 10
) RETURNS TABLE (
  value TEXT,
  label TEXT,
  meta JSONB
) AS $$
BEGIN
  -- Validate RLS context is set
  IF current_setting('app.current_project', true) IS NULL THEN
    RAISE EXCEPTION 'RLS context not set: project_id required';
  END IF;
  RETURN QUERY
  SELECT
    g.guest_phone as value,
    g.guest_name || ' (' || g.guest_phone || ')' as label,
    jsonb_build_object(
      'id', g.id,
      'email', g.guest_email,
      'last_visit', MAX(b.check_in_date),
      'total_visits', COUNT(b.id)
    ) as meta
  FROM guests g
  LEFT JOIN bookings b ON g.id = b.guest_id
  WHERE g.project_id = current_setting('app.current_project', true)::UUID
    AND (
      g.guest_name ILIKE p_prefix || '%' OR
      g.guest_phone LIKE p_prefix || '%'
    )
  GROUP BY g.id, g.guest_name, g.guest_phone, g.guest_email
  ORDER BY COUNT(b.id) DESC, g.guest_name
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Trigram index for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_guests_name_trgm ON guests USING GIN(guest_name gin_trgm_ops);
```

## Batch Operations

### Batch Insert with Conflict Resolution

```sql
-- Batch insert bookings from CSV import
CREATE OR REPLACE FUNCTION batch_insert_bookings(
  p_bookings JSONB[]
) RETURNS TABLE (
  inserted INT,
  updated INT,
  failed INT,
  errors JSONB[]
) AS $$
DECLARE
  v_project_id UUID;
  v_inserted INT := 0;
  v_updated INT := 0;
  v_failed INT := 0;
  v_errors JSONB[] := '{}';
  v_booking JSONB;
BEGIN
  -- Validate RLS context is set
  IF current_setting('app.current_project', true) IS NULL THEN
    RAISE EXCEPTION 'RLS context not set: project_id required';
  END IF;

  v_project_id := current_setting('app.current_project', true)::UUID;

  FOREACH v_booking IN ARRAY p_bookings
  LOOP
    BEGIN
      INSERT INTO bookings (
        project_id,
        booking_code,
        guest_name,
        guest_phone,
        check_in_date,
        check_out_date,
        total_amount,
        status
      ) VALUES (
        v_project_id,
        v_booking->>'booking_code',
        v_booking->>'guest_name',
        v_booking->>'guest_phone',
        (v_booking->>'check_in_date')::DATE,
        (v_booking->>'check_out_date')::DATE,
        (v_booking->>'total_amount')::DECIMAL,
        COALESCE(v_booking->>'status', 'confirmed')
      )
      ON CONFLICT (project_id, booking_code)
      DO UPDATE SET
        guest_name = EXCLUDED.guest_name,
        guest_phone = EXCLUDED.guest_phone,
        check_in_date = EXCLUDED.check_in_date,
        check_out_date = EXCLUDED.check_out_date,
        total_amount = EXCLUDED.total_amount,
        updated_at = NOW()
      RETURNING (xmax = 0) INTO v_booking; -- xmax = 0 means INSERT, otherwise UPDATE

      IF v_booking THEN
        v_inserted := v_inserted + 1;
      ELSE
        v_updated := v_updated + 1;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_errors := array_append(v_errors, jsonb_build_object(
        'booking_code', v_booking->>'booking_code',
        'error', SQLERRM
      ));
    END;
  END LOOP;

  RETURN QUERY SELECT v_inserted, v_updated, v_failed, v_errors;
END;
$$ LANGUAGE plpgsql;
```

### Batch Update Operations

```sql
-- Batch update booking statuses
CREATE OR REPLACE FUNCTION batch_update_booking_status(
  p_booking_ids UUID[],
  p_new_status VARCHAR,
  p_reason TEXT DEFAULT NULL
) RETURNS INT AS $$
DECLARE
  v_updated_count INT;
  v_project_id UUID;
  v_user_id UUID;
BEGIN
  -- Validate RLS context is set
  IF current_setting('app.current_project', true) IS NULL THEN
    RAISE EXCEPTION 'RLS context not set: project_id required';
  END IF;

  IF current_setting('app.current_user', true) IS NULL THEN
    RAISE EXCEPTION 'RLS context not set: user_id required';
  END IF;

  v_project_id := current_setting('app.current_project', true)::UUID;
  v_user_id := current_setting('app.current_user', true)::UUID;

  -- Update bookings
  WITH updated AS (
    UPDATE bookings
    SET
      status = p_new_status,
      updated_at = NOW(),
      updated_by = v_user_id
    WHERE project_id = v_project_id
      AND id = ANY(p_booking_ids)
      AND status != p_new_status -- Don't update if already in target status
    RETURNING id
  )
  SELECT COUNT(*) INTO v_updated_count FROM updated;

  -- Log batch operation
  INSERT INTO batch_operation_logs (
    project_id,
    operation_type,
    affected_count,
    parameters,
    performed_by,
    created_at
  ) VALUES (
    v_project_id,
    'batch_status_update',
    v_updated_count,
    jsonb_build_object(
      'new_status', p_new_status,
      'reason', p_reason,
      'booking_ids', p_booking_ids
    ),
    v_user_id,
    NOW()
  );

  -- Add timeline entries for each booking
  INSERT INTO booking_timeline (
    booking_id,
    event_type,
    event_title,
    event_description,
    performed_by,
    created_at
  )
  SELECT
    unnest(p_booking_ids),
    'status_changed',
    'Batch Status Update',
    COALESCE(p_reason, 'Status changed to ' || p_new_status),
    v_user_id,
    NOW()
  WHERE EXISTS (
    SELECT 1 FROM bookings
    WHERE id = ANY(p_booking_ids)
      AND project_id = v_project_id
  );

  RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql;
```

## Analytics Queries

### Seasonal Analysis

```sql
-- Analyze seasonal patterns
CREATE MATERIALIZED VIEW mv_seasonal_analysis AS
WITH monthly_data AS (
  SELECT
    project_id,
    EXTRACT(YEAR FROM check_in_date) as year,
    EXTRACT(MONTH FROM check_in_date) as month,
    COUNT(*) as bookings,
    SUM(total_amount) as revenue,
    AVG(number_of_guests) as avg_guests,
    AVG(EXTRACT(DAY FROM check_out_date - check_in_date)) as avg_stay_days
  FROM bookings
  WHERE status NOT IN ('cancelled', 'no_show')
    AND check_in_date >= CURRENT_DATE - INTERVAL '2 years'
  GROUP BY project_id, EXTRACT(YEAR FROM check_in_date), EXTRACT(MONTH FROM check_in_date)
),
seasonal_stats AS (
  SELECT
    project_id,
    month,
    AVG(bookings) as avg_bookings,
    AVG(revenue) as avg_revenue,
    STDDEV(bookings) as booking_stddev,
    STDDEV(revenue) as revenue_stddev,
    -- Identify high/low seasons
    CASE
      WHEN AVG(bookings) > (SELECT AVG(bookings) * 1.2 FROM monthly_data WHERE project_id = md.project_id) THEN 'high'
      WHEN AVG(bookings) < (SELECT AVG(bookings) * 0.8 FROM monthly_data WHERE project_id = md.project_id) THEN 'low'
      ELSE 'normal'
    END as season_type
  FROM monthly_data md
  GROUP BY project_id, month
)
SELECT
  *,
  -- Calculate year-over-year growth
  LAG(avg_revenue, 12) OVER (PARTITION BY project_id ORDER BY month) as revenue_last_year,
  (avg_revenue - LAG(avg_revenue, 12) OVER (PARTITION BY project_id ORDER BY month)) /
    NULLIF(LAG(avg_revenue, 12) OVER (PARTITION BY project_id ORDER BY month), 0) * 100 as yoy_growth
FROM seasonal_stats;

CREATE UNIQUE INDEX ON mv_seasonal_analysis(project_id, month);

-- Refresh monthly (requires UNIQUE index for CONCURRENTLY)
CREATE OR REPLACE FUNCTION refresh_seasonal_analysis() RETURNS void AS $$
BEGIN
  -- CONCURRENTLY allows reads during refresh but requires unique index
  -- The unique index on (project_id, month) supports this
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_seasonal_analysis;
END;
$$ LANGUAGE plpgsql;

-- Schedule refresh via Vercel Cron (see NEON_CONNECTION_POOLING.md for setup)
```

### Guest Lifetime Value

```sql
-- Calculate guest lifetime value
CREATE OR REPLACE FUNCTION calculate_guest_ltv(
  p_months_back INT DEFAULT 12
) RETURNS TABLE (
  guest_id UUID,
  guest_name VARCHAR,
  first_visit DATE,
  last_visit DATE,
  total_visits INT,
  total_spent DECIMAL,
  avg_booking_value DECIMAL,
  days_since_last_visit INT,
  ltv_score DECIMAL
) AS $$
BEGIN
  -- Validate RLS context is set
  IF current_setting('app.current_project', true) IS NULL THEN
    RAISE EXCEPTION 'RLS context not set: project_id required';
  END IF;
  RETURN QUERY
  WITH guest_stats AS (
    SELECT
      g.id as guest_id,
      g.guest_name,
      MIN(b.check_in_date) as first_visit,
      MAX(b.check_in_date) as last_visit,
      COUNT(b.id) as total_visits,
      SUM(b.total_amount) as total_spent,
      AVG(b.total_amount) as avg_booking_value,
      CURRENT_DATE - MAX(b.check_in_date) as days_since_last_visit
    FROM guests g
    JOIN bookings b ON g.id = b.guest_id
    WHERE g.project_id = current_setting('app.current_project', true)::UUID
      AND b.status NOT IN ('cancelled', 'no_show')
      AND b.check_in_date >= CURRENT_DATE - (p_months_back || ' months')::INTERVAL
    GROUP BY g.id, g.guest_name
  )
  SELECT
    gs.*,
    -- Calculate LTV score (weighted by frequency, recency, and monetary value)
    ROUND(
      (gs.total_visits * 0.3 +  -- Frequency weight
       CASE
         WHEN gs.days_since_last_visit < 30 THEN 10
         WHEN gs.days_since_last_visit < 90 THEN 7
         WHEN gs.days_since_last_visit < 180 THEN 5
         ELSE 2
       END * 0.3 +  -- Recency weight
       (gs.total_spent / 1000) * 0.4  -- Monetary weight (normalized)
      ), 2
    ) as ltv_score
  FROM guest_stats gs
  ORDER BY ltv_score DESC;
END;
$$ LANGUAGE plpgsql STABLE;
```

## Performance Tips

### 1. Index Strategy

```sql
-- Analyze index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Find missing indexes
SELECT
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100
  AND correlation < 0.1
ORDER BY n_distinct DESC;

-- Remove unused indexes (idx_scan = 0)
SELECT
  'DROP INDEX ' || indexname || ';' as drop_command
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan = 0
  AND indexname NOT LIKE '%_pkey';
```

### 2. Query Plan Analysis

```sql
-- Enable query plan timing
SET track_io_timing = ON;

-- Analyze slow queries
EXPLAIN (ANALYZE, BUFFERS, TIMING, VERBOSE)
SELECT /* your query here */;

-- Find slow queries in pg_stat_statements
SELECT
  substring(query, 1, 100) as query_preview,
  calls,
  mean_exec_time,
  max_exec_time,
  total_exec_time,
  rows,
  100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0) AS cache_hit_ratio
FROM pg_stat_statements
WHERE query LIKE '%bookings%'
ORDER BY mean_exec_time DESC
LIMIT 20;
```

### 3. Vacuum and Analyze

```sql
-- Check table bloat
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  n_live_tup,
  n_dead_tup,
  round(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_ratio
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_dead_tup DESC;

-- Manual vacuum and analyze
VACUUM (VERBOSE, ANALYZE) bookings;
VACUUM (VERBOSE, ANALYZE) payments;
VACUUM (VERBOSE, ANALYZE) expenses;

-- Reindex for better performance (CONCURRENTLY prevents locking)
REINDEX TABLE CONCURRENTLY bookings;
REINDEX INDEX CONCURRENTLY idx_bookings_project_dates;
```

### 4. Connection Pooling Queries

```sql
-- Monitor active connections
SELECT
  pid,
  usename,
  application_name,
  client_addr,
  state,
  query_start,
  state_change,
  wait_event_type,
  wait_event
FROM pg_stat_activity
WHERE datname = current_database()
  AND state != 'idle'
ORDER BY query_start;

-- Kill long-running queries
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database()
  AND state != 'idle'
  AND query_start < NOW() - INTERVAL '5 minutes';
```

### 5. Caching Strategy

```sql
-- Create function result cache table
CREATE TABLE IF NOT EXISTS function_cache (
  function_name TEXT,
  parameters JSONB,
  result JSONB,
  cached_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  PRIMARY KEY (function_name, parameters)
);

-- Cache wrapper function
CREATE OR REPLACE FUNCTION cached_execute(
  p_function_name TEXT,
  p_parameters JSONB,
  p_ttl_minutes INT DEFAULT 5
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_cached RECORD;
BEGIN
  -- Check cache
  SELECT result, expires_at
  INTO v_cached
  FROM function_cache
  WHERE function_name = p_function_name
    AND parameters = p_parameters
    AND expires_at > NOW();

  IF FOUND THEN
    RETURN v_cached.result;
  END IF;

  -- Execute function dynamically
  EXECUTE format('SELECT to_jsonb(%I(%s))',
    p_function_name,
    (SELECT string_agg(quote_literal(value), ',') FROM jsonb_array_elements_text(p_parameters))
  ) INTO v_result;

  -- Store in cache
  INSERT INTO function_cache (function_name, parameters, result, expires_at)
  VALUES (p_function_name, p_parameters, v_result, NOW() + (p_ttl_minutes || ' minutes')::INTERVAL)
  ON CONFLICT (function_name, parameters)
  DO UPDATE SET
    result = EXCLUDED.result,
    cached_at = NOW(),
    expires_at = EXCLUDED.expires_at;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Clean expired cache entries
CREATE OR REPLACE FUNCTION clean_cache() RETURNS void AS $$
BEGIN
  DELETE FROM function_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
```

## Summary

These query patterns are optimized for:

1. **Multi-tenant isolation**: All queries respect RLS boundaries with context
   validation
2. **Neon PostgreSQL**: Optimized for serverless connection patterns
3. **Philippine business context**: Handles local names, timezone, currency
4. **Performance**: Strategic use of indexes, materialized views, and caching
5. **Scalability**: Ready to grow from family business to enterprise

Key optimization strategies:

- Use composite indexes for tenant + common filters
- Leverage materialized views for complex aggregations (with CONCURRENTLY
  refresh)
- Implement function-based caching for expensive operations
- Monitor and maintain indexes regularly
- Use EXPLAIN ANALYZE to verify query plans
- All stored procedures validate RLS context before execution

## Materialized View Refresh Strategy

### Refresh Timing

- **Dashboard views**: Every 5 minutes via Vercel Cron
- **Analytics views**: Daily at 2 AM Philippine time
- **Seasonal analysis**: Monthly on the 1st

### Performance Implications

- CONCURRENTLY option allows reads during refresh (no downtime)
- Requires unique index (already created on project_id + key columns)
- Refresh duration depends on data volume (typically < 1 second for family
  resort)
- Monitor pg_stat_user_tables for refresh performance

See NEON_CONNECTION_POOLING.md for Vercel Cron job configuration details.
