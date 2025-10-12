# Database Schema Documentation

## Overview

This document describes the database schema changes required to implement the two-phase booking system where guests request unit quantities and managers assign specific units.

## Schema Changes Summary

### Modified Tables

- `bookings` - Add assignment tracking fields
- `booking_units` - Update to support post-booking assignment

### New Tables

- `booking_assignment_history` - Audit trail for assignments
- `booking_assignment_queue` - Priority queue for pending assignments

### New Indexes

- Performance indexes for assignment queries
- Composite indexes for availability checks

## Table Definitions

### 1. bookings (Modified)

Main bookings table with added assignment tracking.

```sql
-- Table: public.bookings
CREATE TABLE public.bookings (
    -- Existing columns
    booking_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_reference VARCHAR(20) UNIQUE NOT NULL,
    guest_id UUID NOT NULL REFERENCES guests(guest_id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Booking dates
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,

    -- NEW: Assignment tracking columns
    requested_unit_count INTEGER NOT NULL CHECK (requested_unit_count > 0 AND requested_unit_count <= 10),
    guests_per_unit INTEGER[] NOT NULL, -- Array of guest counts per unit
    assignment_status VARCHAR(50) NOT NULL DEFAULT 'pending_assignment',
    assigned_by UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMPTZ,

    -- NEW: Estimated pricing (before assignment)
    estimated_price_min DECIMAL(10,2),
    estimated_price_max DECIMAL(10,2),

    -- Modified: Status now includes PendingAssignment
    booking_status VARCHAR(50) NOT NULL DEFAULT 'PendingAssignment',

    -- Payment tracking (unchanged)
    payment_status VARCHAR(50) DEFAULT 'pending',
    total_amount DECIMAL(10,2),
    paid_amount DECIMAL(10,2) DEFAULT 0,

    -- Guest preferences
    special_requests TEXT,

    -- Metadata
    source VARCHAR(50) DEFAULT 'website', -- website, phone, walk-in, etc.
    is_guest_booking BOOLEAN DEFAULT FALSE,

    CONSTRAINT check_dates CHECK (check_out_date > check_in_date),
    CONSTRAINT check_assignment_status CHECK (
        assignment_status IN ('pending_assignment', 'partially_assigned', 'fully_assigned', 'reassigned')
    ),
    CONSTRAINT check_booking_status CHECK (
        booking_status IN ('PendingAssignment', 'Pending', 'Confirmed', 'CheckedIn', 'CheckedOut', 'Cancelled', 'NoShow')
    ),
    CONSTRAINT check_guests_array_length CHECK (
        array_length(guests_per_unit, 1) = requested_unit_count
    )
);

-- Indexes for performance
CREATE INDEX idx_bookings_assignment_status ON bookings(assignment_status)
    WHERE assignment_status = 'pending_assignment';
CREATE INDEX idx_bookings_dates ON bookings(check_in_date, check_out_date);
CREATE INDEX idx_bookings_status_compound ON bookings(booking_status, assignment_status);
CREATE INDEX idx_bookings_assigned_by ON bookings(assigned_by) WHERE assigned_by IS NOT NULL;
```

### 2. booking_units (Modified)

Junction table for assigned units (populated after manager assignment).

```sql
-- Table: public.booking_units
CREATE TABLE public.booking_units (
    booking_unit_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES units(unit_id),

    -- Assignment tracking
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID REFERENCES auth.users(id),
    assignment_order INTEGER NOT NULL DEFAULT 1, -- Order of assignment (1st unit, 2nd unit, etc.)

    -- Guest allocation
    assigned_guests INTEGER NOT NULL CHECK (assigned_guests > 0),

    -- Pricing at time of assignment
    unit_price DECIMAL(10,2) NOT NULL,
    nights INTEGER NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,

    -- Assignment notes
    assignment_notes TEXT,

    -- Status
    status VARCHAR(50) DEFAULT 'active',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_booking_unit UNIQUE (booking_id, unit_id),
    CONSTRAINT check_status CHECK (status IN ('active', 'cancelled', 'reassigned'))
);

-- Indexes
CREATE INDEX idx_booking_units_booking ON booking_units(booking_id);
CREATE INDEX idx_booking_units_unit ON booking_units(unit_id);
CREATE INDEX idx_booking_units_status ON booking_units(status);
```

### 3. booking_assignment_history (New)

Audit trail for all assignment actions.

```sql
-- Table: public.booking_assignment_history
CREATE TABLE public.booking_assignment_history (
    history_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES bookings(booking_id),
    action VARCHAR(50) NOT NULL,

    -- Unit details
    unit_id UUID REFERENCES units(unit_id),
    unit_code VARCHAR(20),

    -- Action details
    performed_by UUID NOT NULL REFERENCES auth.users(id),
    performed_at TIMESTAMPTZ DEFAULT NOW(),

    -- Assignment details
    guest_count INTEGER,
    unit_price DECIMAL(10,2),

    -- Change tracking
    previous_unit_id UUID,
    new_unit_id UUID,

    -- Metadata
    notes TEXT,
    metadata JSONB DEFAULT '{}',

    -- Request tracking
    ip_address INET,
    user_agent TEXT,

    CONSTRAINT check_action CHECK (
        action IN ('assigned', 'reassigned', 'unassigned', 'auto_assigned', 'cancelled')
    )
);

-- Indexes
CREATE INDEX idx_assignment_history_booking ON booking_assignment_history(booking_id);
CREATE INDEX idx_assignment_history_user ON booking_assignment_history(performed_by);
CREATE INDEX idx_assignment_history_date ON booking_assignment_history(performed_at DESC);
CREATE INDEX idx_assignment_history_action ON booking_assignment_history(action);
```

### 4. booking_assignment_queue (New)

Priority queue for pending assignments.

```sql
-- Table: public.booking_assignment_queue
CREATE TABLE public.booking_assignment_queue (
    queue_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,

    -- Priority calculation
    priority_score INTEGER NOT NULL DEFAULT 0,
    priority_reason VARCHAR(100),

    -- Queue management
    queued_at TIMESTAMPTZ DEFAULT NOW(),
    estimated_assignment_time TIMESTAMPTZ,

    -- Assignment attempts
    assignment_attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    last_attempt_by UUID REFERENCES auth.users(id),
    last_attempt_result TEXT,

    -- Status
    queue_status VARCHAR(50) DEFAULT 'pending',

    -- Notification tracking
    notifications_sent INTEGER DEFAULT 0,
    last_notification_at TIMESTAMPTZ,

    CONSTRAINT unique_booking_queue UNIQUE (booking_id),
    CONSTRAINT check_queue_status CHECK (
        queue_status IN ('pending', 'in_progress', 'assigned', 'failed', 'expired')
    )
);

-- Indexes for queue processing
CREATE INDEX idx_queue_priority ON booking_assignment_queue(priority_score DESC, queued_at ASC)
    WHERE queue_status = 'pending';
CREATE INDEX idx_queue_status ON booking_assignment_queue(queue_status);
CREATE INDEX idx_queue_booking ON booking_assignment_queue(booking_id);
```

### 5. units (Reference - No Changes)

Reference table structure for units.

```sql
-- Table: public.units (existing, for reference)
CREATE TABLE public.units (
    unit_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    unit_code VARCHAR(20) UNIQUE NOT NULL,
    unit_name VARCHAR(100) NOT NULL,
    unit_type VARCHAR(50),

    -- Capacity
    min_capacity INTEGER DEFAULT 1,
    max_capacity INTEGER NOT NULL,
    optimal_capacity INTEGER,

    -- Pricing
    base_price DECIMAL(10,2) NOT NULL,
    weekend_price DECIMAL(10,2),
    peak_season_price DECIMAL(10,2),

    -- Features
    features JSONB DEFAULT '{}',
    amenities TEXT[],

    -- Location
    building VARCHAR(50),
    floor VARCHAR(20),
    view_type VARCHAR(50),

    -- Status
    status VARCHAR(50) DEFAULT 'available',
    maintenance_status VARCHAR(50) DEFAULT 'operational',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Database Functions

### 1. Check Available Unit Count

Function to check how many units are available for a date range.

```sql
CREATE OR REPLACE FUNCTION check_available_unit_count(
    p_check_in DATE,
    p_check_out DATE
) RETURNS INTEGER AS $$
DECLARE
    v_total_units INTEGER;
    v_booked_units INTEGER;
BEGIN
    -- Get total active units
    SELECT COUNT(*) INTO v_total_units
    FROM units
    WHERE status = 'available'
    AND maintenance_status = 'operational';

    -- Get booked units for the period
    SELECT COUNT(DISTINCT bu.unit_id) INTO v_booked_units
    FROM booking_units bu
    JOIN bookings b ON bu.booking_id = b.booking_id
    WHERE b.booking_status NOT IN ('Cancelled', 'NoShow')
    AND bu.status = 'active'
    AND (
        (b.check_in_date <= p_check_in AND b.check_out_date > p_check_in)
        OR (b.check_in_date < p_check_out AND b.check_out_date >= p_check_out)
        OR (b.check_in_date >= p_check_in AND b.check_out_date <= p_check_out)
    );

    RETURN COALESCE(v_total_units - v_booked_units, 0);
END;
$$ LANGUAGE plpgsql;
```

### 2. Calculate Priority Score

Function to calculate assignment priority for queue.

```sql
CREATE OR REPLACE FUNCTION calculate_assignment_priority(
    p_booking_id UUID
) RETURNS INTEGER AS $$
DECLARE
    v_priority INTEGER := 0;
    v_hours_waiting NUMERIC;
    v_check_in_days INTEGER;
    v_is_repeat_guest BOOLEAN;
    v_unit_count INTEGER;
BEGIN
    -- Get booking details
    SELECT
        EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600,
        check_in_date - CURRENT_DATE,
        requested_unit_count
    INTO v_hours_waiting, v_check_in_days, v_unit_count
    FROM bookings
    WHERE booking_id = p_booking_id;

    -- Base priority on wait time (1 point per hour, max 100)
    v_priority := LEAST(v_hours_waiting::INTEGER, 100);

    -- Urgent if check-in within 7 days (+50 points)
    IF v_check_in_days <= 7 THEN
        v_priority := v_priority + 50;
    END IF;

    -- Very urgent if check-in within 2 days (+100 points)
    IF v_check_in_days <= 2 THEN
        v_priority := v_priority + 100;
    END IF;

    -- Check if repeat guest (+20 points)
    SELECT EXISTS (
        SELECT 1 FROM bookings b2
        WHERE b2.guest_id = (SELECT guest_id FROM bookings WHERE booking_id = p_booking_id)
        AND b2.booking_id != p_booking_id
        AND b2.booking_status IN ('CheckedOut', 'Confirmed')
    ) INTO v_is_repeat_guest;

    IF v_is_repeat_guest THEN
        v_priority := v_priority + 20;
    END IF;

    -- Larger bookings get slight priority (5 points per unit)
    v_priority := v_priority + (v_unit_count * 5);

    RETURN v_priority;
END;
$$ LANGUAGE plpgsql;
```

### 3. Auto-Assign Units

Function for automatic unit assignment (future enhancement).

```sql
CREATE OR REPLACE FUNCTION auto_assign_units(
    p_booking_id UUID
) RETURNS TABLE(unit_id UUID, unit_code VARCHAR, assigned_guests INTEGER) AS $$
DECLARE
    v_check_in DATE;
    v_check_out DATE;
    v_requested_units INTEGER;
    v_guests_per_unit INTEGER[];
    v_assigned_count INTEGER := 0;
BEGIN
    -- Get booking details
    SELECT check_in_date, check_out_date, requested_unit_count, guests_per_unit
    INTO v_check_in, v_check_out, v_requested_units, v_guests_per_unit
    FROM bookings
    WHERE booking_id = p_booking_id;

    -- Find available units with best fit
    RETURN QUERY
    WITH available_units AS (
        SELECT u.unit_id, u.unit_code, u.max_capacity, u.base_price
        FROM units u
        WHERE u.status = 'available'
        AND u.unit_id NOT IN (
            SELECT bu.unit_id
            FROM booking_units bu
            JOIN bookings b ON bu.booking_id = b.booking_id
            WHERE b.booking_status NOT IN ('Cancelled', 'NoShow')
            AND bu.status = 'active'
            AND (
                (b.check_in_date <= v_check_in AND b.check_out_date > v_check_in)
                OR (b.check_in_date < v_check_out AND b.check_out_date >= v_check_out)
                OR (b.check_in_date >= v_check_in AND b.check_out_date <= v_check_out)
            )
        )
        ORDER BY u.base_price, u.unit_code
    ),
    assignments AS (
        SELECT
            au.unit_id,
            au.unit_code,
            v_guests_per_unit[ROW_NUMBER() OVER (ORDER BY au.base_price, au.unit_code)]::INTEGER as guest_count,
            ROW_NUMBER() OVER (ORDER BY au.base_price, au.unit_code) as rn
        FROM available_units au
        WHERE au.max_capacity >= v_guests_per_unit[ROW_NUMBER() OVER (ORDER BY au.base_price, au.unit_code)]
    )
    SELECT a.unit_id, a.unit_code, a.guest_count
    FROM assignments a
    WHERE a.rn <= v_requested_units
    LIMIT v_requested_units;
END;
$$ LANGUAGE plpgsql;
```

## Triggers

### 1. Update Assignment Queue on Booking Creation

```sql
CREATE OR REPLACE FUNCTION trigger_add_to_assignment_queue()
RETURNS TRIGGER AS $$
BEGIN
    -- Add to queue if assignment needed
    IF NEW.assignment_status = 'pending_assignment' THEN
        INSERT INTO booking_assignment_queue (
            booking_id,
            priority_score,
            priority_reason
        ) VALUES (
            NEW.booking_id,
            calculate_assignment_priority(NEW.booking_id),
            CASE
                WHEN NEW.check_in_date - CURRENT_DATE <= 2 THEN 'Urgent: Check-in soon'
                WHEN NEW.check_in_date - CURRENT_DATE <= 7 THEN 'Priority: Within week'
                ELSE 'Normal'
            END
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER booking_assignment_queue_trigger
    AFTER INSERT ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION trigger_add_to_assignment_queue();
```

### 2. Update Booking Status After Assignment

```sql
CREATE OR REPLACE FUNCTION trigger_update_booking_after_assignment()
RETURNS TRIGGER AS $$
DECLARE
    v_requested_count INTEGER;
    v_assigned_count INTEGER;
    v_total_amount DECIMAL(10,2);
BEGIN
    -- Get requested unit count
    SELECT requested_unit_count INTO v_requested_count
    FROM bookings
    WHERE booking_id = NEW.booking_id;

    -- Count assigned units
    SELECT COUNT(*), SUM(subtotal) INTO v_assigned_count, v_total_amount
    FROM booking_units
    WHERE booking_id = NEW.booking_id
    AND status = 'active';

    -- Update booking based on assignment
    UPDATE bookings
    SET
        assignment_status = CASE
            WHEN v_assigned_count = 0 THEN 'pending_assignment'
            WHEN v_assigned_count < v_requested_count THEN 'partially_assigned'
            ELSE 'fully_assigned'
        END,
        booking_status = CASE
            WHEN v_assigned_count = v_requested_count THEN 'Pending'
            ELSE booking_status
        END,
        total_amount = v_total_amount,
        assigned_at = COALESCE(assigned_at, NOW()),
        assigned_by = COALESCE(assigned_by, NEW.assigned_by),
        updated_at = NOW()
    WHERE booking_id = NEW.booking_id;

    -- Update queue status
    UPDATE booking_assignment_queue
    SET
        queue_status = CASE
            WHEN v_assigned_count = v_requested_count THEN 'assigned'
            ELSE queue_status
        END
    WHERE booking_id = NEW.booking_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER booking_units_assignment_trigger
    AFTER INSERT OR UPDATE ON booking_units
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_booking_after_assignment();
```

### 3. Log Assignment History

```sql
CREATE OR REPLACE FUNCTION trigger_log_assignment_history()
RETURNS TRIGGER AS $$
BEGIN
    -- Log the assignment action
    INSERT INTO booking_assignment_history (
        booking_id,
        action,
        unit_id,
        unit_code,
        performed_by,
        guest_count,
        unit_price,
        notes
    ) VALUES (
        NEW.booking_id,
        CASE
            WHEN TG_OP = 'INSERT' THEN 'assigned'
            WHEN OLD.unit_id != NEW.unit_id THEN 'reassigned'
            ELSE 'updated'
        END,
        NEW.unit_id,
        (SELECT unit_code FROM units WHERE unit_id = NEW.unit_id),
        NEW.assigned_by,
        NEW.assigned_guests,
        NEW.unit_price,
        NEW.assignment_notes
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assignment_history_trigger
    AFTER INSERT OR UPDATE ON booking_units
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_assignment_history();
```

## Migration Scripts

### Step 1: Add New Columns to Existing Tables

```sql
-- Add new columns to bookings table
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS requested_unit_count INTEGER,
ADD COLUMN IF NOT EXISTS guests_per_unit INTEGER[],
ADD COLUMN IF NOT EXISTS assignment_status VARCHAR(50) DEFAULT 'pending_assignment',
ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS estimated_price_min DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS estimated_price_max DECIMAL(10,2);

-- Add constraints
ALTER TABLE bookings
ADD CONSTRAINT check_requested_count CHECK (requested_unit_count > 0 AND requested_unit_count <= 10),
ADD CONSTRAINT check_guests_array_length CHECK (
    array_length(guests_per_unit, 1) = requested_unit_count
);

-- Add assignment columns to booking_units
ALTER TABLE booking_units
ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS assignment_order INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS assignment_notes TEXT;
```

### Step 2: Migrate Existing Data

```sql
-- Update existing bookings with assignment data
UPDATE bookings b
SET
    requested_unit_count = COALESCE(
        (SELECT COUNT(*) FROM booking_units WHERE booking_id = b.booking_id),
        1
    ),
    guests_per_unit = ARRAY(
        SELECT COALESCE(assigned_guests, 2)
        FROM booking_units
        WHERE booking_id = b.booking_id
        ORDER BY booking_unit_id
    ),
    assignment_status = CASE
        WHEN EXISTS (SELECT 1 FROM booking_units WHERE booking_id = b.booking_id)
        THEN 'fully_assigned'
        ELSE 'pending_assignment'
    END,
    assigned_at = COALESCE(
        (SELECT MIN(created_at) FROM booking_units WHERE booking_id = b.booking_id),
        b.created_at
    )
WHERE requested_unit_count IS NULL;
```

### Step 3: Create New Tables

```sql
-- Execute CREATE TABLE statements for:
-- 1. booking_assignment_history
-- 2. booking_assignment_queue
```

### Step 4: Create Functions and Triggers

```sql
-- Execute CREATE FUNCTION statements
-- Execute CREATE TRIGGER statements
```

### Step 5: Create Indexes

```sql
-- Execute all CREATE INDEX statements
```

### Step 6: Populate Assignment Queue

```sql
-- Add pending bookings to queue
INSERT INTO booking_assignment_queue (booking_id, priority_score, priority_reason)
SELECT
    booking_id,
    calculate_assignment_priority(booking_id),
    'Migration: Existing booking'
FROM bookings
WHERE assignment_status = 'pending_assignment'
AND booking_status NOT IN ('Cancelled', 'CheckedOut');
```

## Row Level Security (RLS)

### Policies for booking_assignment_history

```sql
-- Enable RLS
ALTER TABLE booking_assignment_history ENABLE ROW LEVEL SECURITY;

-- Managers can view all history
CREATE POLICY "Managers can view assignment history"
ON booking_assignment_history
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.uid() = id
        AND raw_user_meta_data->>'role' IN ('manager', 'admin')
    )
);

-- Managers can insert history
CREATE POLICY "Managers can create assignment history"
ON booking_assignment_history
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.uid() = id
        AND raw_user_meta_data->>'role' IN ('manager', 'admin')
    )
    AND performed_by = auth.uid()
);
```

### Policies for booking_assignment_queue

```sql
-- Enable RLS
ALTER TABLE booking_assignment_queue ENABLE ROW LEVEL SECURITY;

-- Managers can view and modify queue
CREATE POLICY "Managers can manage assignment queue"
ON booking_assignment_queue
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.uid() = id
        AND raw_user_meta_data->>'role' IN ('manager', 'admin')
    )
);
```

## Performance Considerations

### Recommended Indexes Summary

```sql
-- Critical performance indexes
CREATE INDEX CONCURRENTLY idx_bookings_pending_assignment
    ON bookings(created_at)
    WHERE assignment_status = 'pending_assignment';

CREATE INDEX CONCURRENTLY idx_bookings_date_range
    ON bookings USING GIST (daterange(check_in_date, check_out_date));

CREATE INDEX CONCURRENTLY idx_booking_units_availability
    ON booking_units(unit_id, booking_id)
    WHERE status = 'active';

CREATE INDEX CONCURRENTLY idx_queue_processing
    ON booking_assignment_queue(priority_score DESC, queued_at ASC)
    WHERE queue_status = 'pending';
```

### Query Optimization Tips

1. **Use Partial Indexes**: For pending assignments, use partial indexes with WHERE clauses
2. **Batch Operations**: Process assignments in batches to reduce lock contention
3. **Connection Pooling**: Use PgBouncer for connection pooling
4. **Vacuum Strategy**: Regular VACUUM ANALYZE on high-churn tables
5. **Monitor Slow Queries**: Use pg_stat_statements to identify bottlenecks

## Backup and Recovery

### Backup Strategy

```bash
# Daily backup of critical tables
pg_dump -t bookings -t booking_units -t booking_assignment_history \
    -Fc -f booking_backup_$(date +%Y%m%d).dump $DATABASE_URL

# Point-in-time recovery setup
archive_mode = on
archive_command = 'cp %p /backup/archive/%f'
```

### Recovery Procedures

1. **Assignment Rollback**: Use booking_assignment_history to rollback assignments
2. **Queue Recovery**: Rebuild queue from bookings with pending_assignment status
3. **Audit Trail**: All assignments logged for compliance and recovery
