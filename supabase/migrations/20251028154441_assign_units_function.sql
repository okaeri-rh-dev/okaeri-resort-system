-- Migration: Create assign_units_to_booking function
-- Description: Atomically assigns units to a booking after payment verification
-- Author: System
-- Date: 2025-10-28

-- First ensure the guest_booking_unit_requests table exists
CREATE TABLE IF NOT EXISTS public.guest_booking_unit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    unit_type VARCHAR(50) NOT NULL,
    guests_per_unit INTEGER NOT NULL CHECK (guests_per_unit > 0),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    special_requests TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_guest_booking_unit_requests_booking_id
    ON guest_booking_unit_requests(booking_id);

-- Enable btree_gist extension for exclusion constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Ensure bookings table has required columns for multi-unit support
DO $$
BEGIN
    -- Add unit_assignment_status if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'bookings'
                   AND column_name = 'unit_assignment_status') THEN
        ALTER TABLE bookings ADD COLUMN unit_assignment_status VARCHAR(20) DEFAULT 'pending';
    END IF;

    -- Add is_multi_unit if not exists (already exists in migration but check for safety)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'bookings'
                   AND column_name = 'is_multi_unit') THEN
        ALTER TABLE bookings ADD COLUMN is_multi_unit BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add requested_unit_count if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'bookings'
                   AND column_name = 'requested_unit_count') THEN
        ALTER TABLE bookings ADD COLUMN requested_unit_count INTEGER DEFAULT 1;
    END IF;
END $$;

-- Ensure booking_units table has required columns for dates and status
DO $$
BEGIN
    -- Add check_in_date if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'booking_units'
                   AND column_name = 'check_in_date') THEN
        ALTER TABLE booking_units ADD COLUMN check_in_date DATE;
    END IF;

    -- Add check_out_date if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'booking_units'
                   AND column_name = 'check_out_date') THEN
        ALTER TABLE booking_units ADD COLUMN check_out_date DATE;
    END IF;

    -- Add status if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'booking_units'
                   AND column_name = 'status') THEN
        ALTER TABLE booking_units ADD COLUMN status VARCHAR(20) DEFAULT 'confirmed';
    END IF;

    -- Add exclusion constraint if not exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'booking_units_no_double_booking'
    ) THEN
        ALTER TABLE booking_units
        ADD CONSTRAINT booking_units_no_double_booking
        EXCLUDE USING gist (
            unit_id WITH =,
            daterange(check_in_date, check_out_date, '[)') WITH &&
        ) WHERE (status IN ('confirmed', 'checked_in'));
    END IF;
END $$;

-- Drop function if exists (for idempotency)
DROP FUNCTION IF EXISTS public.assign_units_to_booking(UUID, UUID[]);

-- Create the function with all requirements
CREATE OR REPLACE FUNCTION public.assign_units_to_booking(
    p_booking_id UUID,
    p_unit_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_booking_record RECORD;
    v_requested_count INTEGER;
    v_unit_id UUID;
    v_check_in DATE;
    v_check_out DATE;
BEGIN
    -- Set statement timeout for serverless optimization
    SET LOCAL statement_timeout = '5s';

    -- Start exception block for automatic rollback
    BEGIN
        -- 1. Fetch and validate booking exists with required fields
        SELECT
            b.booking_id,
            b.payment_status,
            b.unit_assignment_status,
            b.booking_status,
            b.check_in::DATE as check_in_date,
            b.check_out::DATE as check_out_date
        INTO v_booking_record
        FROM bookings b
        WHERE b.booking_id = p_booking_id
        FOR UPDATE; -- Lock the booking row

        -- Check if booking exists
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Booking % not found', p_booking_id;
        END IF;

        -- Store dates for later use
        v_check_in := v_booking_record.check_in_date;
        v_check_out := v_booking_record.check_out_date;

        -- 2. Verify payment status (Completed means payment is verified)
        IF v_booking_record.payment_status NOT IN ('Completed', 'Verified') THEN
            RAISE EXCEPTION 'Cannot assign units: Payment not verified (current status: %)',
                v_booking_record.payment_status;
        END IF;

        -- 3. Check idempotency - prevent re-assignment
        IF v_booking_record.unit_assignment_status = 'assigned' THEN
            RAISE EXCEPTION 'Units already assigned to booking %', p_booking_id;
        END IF;

        -- 4. Verify unit assignment status is pending
        IF v_booking_record.unit_assignment_status != 'pending' THEN
            RAISE EXCEPTION 'Invalid unit assignment status: % (must be pending)',
                v_booking_record.unit_assignment_status;
        END IF;

        -- 5. Validate array length matches requested count
        SELECT COUNT(*)
        INTO v_requested_count
        FROM guest_booking_unit_requests
        WHERE booking_id = p_booking_id;

        IF array_length(p_unit_ids, 1) IS NULL THEN
            RAISE EXCEPTION 'No units provided for assignment';
        END IF;

        IF array_length(p_unit_ids, 1) != v_requested_count THEN
            RAISE EXCEPTION 'Unit count mismatch: provided % units but % were requested',
                array_length(p_unit_ids, 1), v_requested_count;
        END IF;

        -- 6. Verify all provided unit IDs exist and are available
        IF EXISTS (
            SELECT 1
            FROM unnest(p_unit_ids) AS unit_id
            WHERE unit_id NOT IN (SELECT unit_id FROM units WHERE unit_status = 'Available')
        ) THEN
            RAISE EXCEPTION 'One or more provided units do not exist or are not available';
        END IF;

        -- 7. Atomic assignment - Insert units into booking_units
        FOREACH v_unit_id IN ARRAY p_unit_ids
        LOOP
            -- Insert will fail if exclusion constraint is violated (double booking)
            -- This will automatically rollback the entire transaction
            INSERT INTO booking_units (
                booking_id,
                unit_id,
                unit_price,
                weekend_surcharge,
                extra_person_charge,
                subtotal,
                assigned_guests,
                check_in_date,
                check_out_date,
                status,
                created_at,
                updated_at
            )
            SELECT
                p_booking_id,
                v_unit_id,
                u.base_rate * (v_check_out - v_check_in),  -- Total price for the stay
                0::DECIMAL,  -- No weekend surcharge for now
                0::DECIMAL,  -- No extra person charge for now
                u.base_rate * (v_check_out - v_check_in),  -- Subtotal = unit_price + surcharges
                u.base_occupancy,  -- Use base occupancy as default assigned guests
                v_check_in,
                v_check_out,
                'confirmed',
                NOW(),
                NOW()
            FROM units u
            WHERE u.unit_id = v_unit_id;
        END LOOP;

        -- 8. Update booking status
        UPDATE bookings
        SET
            unit_assignment_status = 'assigned',
            booking_status = 'Confirmed',
            updated_at = NOW()
        WHERE booking_id = p_booking_id;

        -- 9. Log successful assignment in audit trail
        INSERT INTO audit_logs (
            action,
            table_name,
            record_id,
            new_data,
            changed_fields,
            user_id,
            created_at,
            source,
            event_type,
            description
        ) VALUES (
            'UPDATE',
            'bookings',
            p_booking_id::TEXT,
            jsonb_build_object(
                'unit_ids_assigned', p_unit_ids,
                'count', array_length(p_unit_ids, 1),
                'unit_assignment_status', 'assigned',
                'booking_status', 'Confirmed'
            ),
            ARRAY['unit_assignment_status', 'booking_status'],  -- Required for UPDATE action
            auth.uid(),
            NOW(),
            'db',
            NULL,  -- event_type must be NULL for source='db'
            format('Assigned %s units to booking %s', array_length(p_unit_ids, 1), p_booking_id)
        );

    EXCEPTION
        WHEN SQLSTATE '23P01' THEN
            -- Handle specific case of double booking (EXCLUDE constraint violation)
            RAISE EXCEPTION 'Cannot assign units: One or more units are already booked for the selected dates';
        WHEN OTHERS THEN
            -- Re-raise any other exception (automatic rollback)
            RAISE;
    END;
END;
$$;

-- Set function configuration for serverless optimization
ALTER FUNCTION public.assign_units_to_booking(UUID, UUID[])
    SET statement_timeout = '5s';

-- Add function documentation
COMMENT ON FUNCTION public.assign_units_to_booking(UUID, UUID[]) IS
'Atomically assigns multiple units to a guest booking after payment verification.
Ensures all-or-nothing assignment with automatic rollback on any error.
Prerequisites:
- Booking must exist with payment_status = "Completed" or "Verified"
- unit_assignment_status must be "pending"
- Number of units must match guest_booking_unit_requests count
Returns: VOID on success, raises exception on any failure';

-- Grant execution permission to authenticated users
GRANT EXECUTE ON FUNCTION public.assign_units_to_booking(UUID, UUID[])
    TO authenticated;

-- Create helper function to check unit availability before assignment (optional but useful)
CREATE OR REPLACE FUNCTION public.check_units_available_for_booking(
    p_booking_id UUID,
    p_unit_ids UUID[]
)
RETURNS TABLE (
    unit_id UUID,
    is_available BOOLEAN,
    conflict_booking_id UUID
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_check_in DATE;
    v_check_out DATE;
BEGIN
    -- Get booking dates
    SELECT check_in::DATE, check_out::DATE
    INTO v_check_in, v_check_out
    FROM bookings
    WHERE booking_id = p_booking_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % not found', p_booking_id;
    END IF;

    -- Check availability for each unit
    RETURN QUERY
    WITH unit_checks AS (
        SELECT
            u.unit_id,
            CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM booking_units bu
                    JOIN bookings b ON b.booking_id = bu.booking_id
                    WHERE bu.unit_id = u.unit_id
                    AND bu.status IN ('confirmed', 'checked_in')
                    AND b.booking_status NOT IN ('Cancelled', 'No Show')
                    AND daterange(bu.check_in_date, bu.check_out_date, '[)') &&
                        daterange(v_check_in, v_check_out, '[)')
                ) THEN false
                ELSE true
            END AS is_available,
            (
                SELECT bu.booking_id
                FROM booking_units bu
                JOIN bookings b ON b.booking_id = bu.booking_id
                WHERE bu.unit_id = u.unit_id
                AND bu.status IN ('confirmed', 'checked_in')
                AND b.booking_status NOT IN ('Cancelled', 'No Show')
                AND daterange(bu.check_in_date, bu.check_out_date, '[)') &&
                    daterange(v_check_in, v_check_out, '[)')
                LIMIT 1
            ) AS conflict_booking_id
        FROM unnest(p_unit_ids) AS u(unit_id)
    )
    SELECT * FROM unit_checks;
END;
$$;

-- Grant execution permission for helper function
GRANT EXECUTE ON FUNCTION public.check_units_available_for_booking(UUID, UUID[])
    TO authenticated;

-- Add comment for helper function
COMMENT ON FUNCTION public.check_units_available_for_booking(UUID, UUID[]) IS
'Helper function to check availability of units before assignment.
Returns availability status and conflicting booking ID if any.
Use this before calling assign_units_to_booking to provide better error messages.';

-- Create indexes to optimize the assignment queries (if not exists)
DO $$
BEGIN
    -- Index for booking_units if columns exist
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'booking_units'
               AND column_name IN ('check_in_date', 'check_out_date', 'status')) THEN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes
                       WHERE indexname = 'idx_booking_units_dates_status') THEN
            CREATE INDEX idx_booking_units_dates_status
                ON booking_units(unit_id, check_in_date, check_out_date, status)
                WHERE status IN ('confirmed', 'checked_in');
        END IF;
    END IF;

    -- Index for bookings assignment status if column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'bookings'
               AND column_name = 'unit_assignment_status') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes
                       WHERE indexname = 'idx_bookings_assignment_status') THEN
            CREATE INDEX idx_bookings_assignment_status
                ON bookings(unit_assignment_status, payment_status)
                WHERE unit_assignment_status = 'pending';
        END IF;
    END IF;
END $$;

-- Add RLS policies for the function execution context
ALTER TABLE booking_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_booking_unit_requests ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to insert booking_units through the function
CREATE POLICY "authenticated_users_insert_booking_units"
    ON booking_units
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM bookings
            WHERE bookings.booking_id = booking_units.booking_id
        )
    );

-- Create policy for reading guest_booking_unit_requests
CREATE POLICY "authenticated_users_read_unit_requests"
    ON guest_booking_unit_requests
    FOR SELECT
    TO authenticated
    USING (true);

-- Verification query to test the function exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_proc
        WHERE proname = 'assign_units_to_booking'
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        RAISE EXCEPTION 'Function assign_units_to_booking was not created successfully';
    END IF;

    RAISE NOTICE 'Function assign_units_to_booking created successfully';
END;
$$;