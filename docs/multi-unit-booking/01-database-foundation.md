# Phase 1: Database Foundation

**Phase Duration:** October 7-11, 2025 (Week 1 - 5 days)
**Lead Agent:** `postgres-serverless-architect`
**Status:** Not Started

---

## Phase Overview

### Objectives

Design and implement the database schema changes required to support multi-unit bookings while maintaining backwards compatibility with existing single-unit bookings.

### Success Criteria

- [ ] Migration runs successfully on staging without errors
- [ ] All existing bookings migrated to new booking_units structure
- [ ] Performance tests show <100ms query time for availability checks
- [ ] RLS policies prevent unauthorized access to booking units
- [ ] Rollback script tested and verified working
- [ ] Zero data loss during migration
- [ ] All database constraints functioning correctly

### Key Deliverables

1. Database schema DDL for new tables
2. Migration script (`018-multi-unit-schema.sql`)
3. Rollback script (`018-rollback.sql`)
4. RLS policy specifications
5. Database functions for multi-unit operations
6. Performance benchmark report
7. Data validation scripts

---

## Agent Assignments

### Lead: `postgres-serverless-architect`

**Primary Responsibilities:**

- Design junction table schema (booking_units, guest_assignments)
- Create PostgreSQL migration scripts with transaction safety
- Implement database functions for batch operations
- Optimize indexes for Neon PostgreSQL serverless architecture
- Design and implement RLS policies for security
- Create triggers for data integrity
- Performance testing and optimization

**Deliverables:**

- `database/migrations/018-multi-unit-schema.sql`
- `database/migrations/018-rollback.sql`
- `docs/multi-unit-booking/architecture/database-schema.md`
- Performance benchmark report

### Supporting: `serverless-saas-architect`

**Responsibilities:**

- Review multi-tenancy implications
- Validate schema design for scalability
- Approve architecture decisions

**Deliverables:**

- Architecture review sign-off

### Supporting: `security-compliance-auditor`

**Responsibilities:**

- Security review of RLS policies
- Validate data access controls
- Audit trail implementation review

**Deliverables:**

- Security audit report for database layer

---

## Technical Specifications

### New Tables

#### 1. booking_units (Junction Table)

**Purpose:** Creates many-to-many relationship between bookings and units

```sql
CREATE TABLE booking_units (
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

-- GIN index for guest name searches
CREATE INDEX idx_booking_units_guest_names ON booking_units USING gin(guest_names);

-- Comments for documentation
COMMENT ON TABLE booking_units IS 'Junction table linking bookings to multiple units with individual pricing';
COMMENT ON COLUMN booking_units.subtotal IS 'Total for this specific unit (unit_price + surcharges)';
```

#### 2. booking_unit_availability (Denormalized for Performance)

**Purpose:** Fast availability lookups using exclusion constraints

```sql
-- Enable btree_gist extension for exclusion constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE booking_unit_availability (
    -- Primary key
    availability_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- References
    unit_id UUID NOT NULL REFERENCES units(unit_id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,

    -- Date range
    check_in TIMESTAMP WITH TIME ZONE NOT NULL,
    check_out TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Booking status (for filtering)
    booking_status VARCHAR(20) NOT NULL,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Exclusion constraint: Prevent overlapping bookings for same unit
    EXCLUDE USING gist (
        unit_id WITH =,
        tstzrange(check_in, check_out, '[)') WITH &&
    ) WHERE (booking_status NOT IN ('Cancelled', 'NoShow')),

    -- Additional constraints
    CHECK (check_out > check_in)
);

-- Covering index for availability queries
CREATE INDEX idx_availability_lookup ON booking_unit_availability(
    unit_id,
    check_in,
    check_out
) WHERE booking_status NOT IN ('Cancelled', 'NoShow');

-- Index for booking_id lookups
CREATE INDEX idx_availability_booking_id ON booking_unit_availability(booking_id);

-- Comments
COMMENT ON TABLE booking_unit_availability IS 'Denormalized table for fast availability checking with exclusion constraints';
COMMENT ON CONSTRAINT booking_unit_availability_unit_id_tstzrange_excl IS 'Prevents double-booking by excluding overlapping date ranges for the same unit';
```

#### 3. guest_assignments (Optional - for detailed guest tracking)

**Purpose:** Track which guests are assigned to which units

```sql
CREATE TABLE guest_assignments (
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
COMMENT ON TABLE guest_assignments IS 'Optional table for tracking specific guest-to-unit assignments';
```

### Modified Tables

#### bookings Table Modifications

```sql
-- Add columns for multi-unit support
ALTER TABLE bookings
    -- Make unit_id nullable (for multi-unit bookings)
    ALTER COLUMN unit_id DROP NOT NULL,

    -- Add multi-unit tracking
    ADD COLUMN IF NOT EXISTS is_multi_unit BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS unit_count INTEGER DEFAULT 1 CHECK (unit_count > 0),

    -- Add pricing breakdown
    ADD COLUMN IF NOT EXISTS base_amount DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS total_surcharges DECIMAL(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) DEFAULT 0,

    -- Add constraint for valid unit assignment
    ADD CONSTRAINT valid_unit_assignment CHECK (
        -- Single-unit: unit_id not null, is_multi_unit false
        (is_multi_unit = FALSE AND unit_id IS NOT NULL AND unit_count = 1) OR
        -- Multi-unit: unit_id null, is_multi_unit true, unit_count > 0
        (is_multi_unit = TRUE AND unit_id IS NULL AND unit_count > 0)
    );

-- Comments
COMMENT ON COLUMN bookings.unit_id IS 'LEGACY: Direct unit reference for single-unit bookings. NULL for multi-unit bookings (use booking_units table instead)';
COMMENT ON COLUMN bookings.is_multi_unit IS 'TRUE if booking has multiple units (uses booking_units junction table)';
COMMENT ON COLUMN bookings.unit_count IS 'Number of units in this booking (1 for single-unit, 2+ for multi-unit)';
```

---

## Database Functions

### 1. create_multi_unit_booking

**Purpose:** Atomically create a booking with multiple units

```sql
CREATE OR REPLACE FUNCTION create_multi_unit_booking(
    p_booking_data JSONB,
    p_units JSONB[]
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
        COALESCE(p_booking_data->>'payment_status', 'Pending')
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

COMMENT ON FUNCTION create_multi_unit_booking IS 'Atomically creates a booking with multiple units';
```

### 2. check_multi_unit_availability

**Purpose:** Check availability for multiple units simultaneously

```sql
CREATE OR REPLACE FUNCTION check_multi_unit_availability(
    p_unit_ids UUID[],
    p_check_in TIMESTAMPTZ,
    p_check_out TIMESTAMPTZ,
    p_exclude_booking_id UUID DEFAULT NULL
) RETURNS TABLE(
    unit_id UUID,
    is_available BOOLEAN,
    conflicting_bookings INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.unit_id,
        NOT EXISTS (
            SELECT 1
            FROM booking_unit_availability bua
            WHERE bua.unit_id = u.unit_id
              AND bua.booking_status NOT IN ('Cancelled', 'NoShow')
              AND tstzrange(bua.check_in, bua.check_out, '[)') && tstzrange(p_check_in, p_check_out, '[)')
              AND (p_exclude_booking_id IS NULL OR bua.booking_id != p_exclude_booking_id)
        ) AS is_available,
        (
            SELECT COUNT(*)::INTEGER
            FROM booking_unit_availability bua
            WHERE bua.unit_id = u.unit_id
              AND bua.booking_status NOT IN ('Cancelled', 'NoShow')
              AND tstzrange(bua.check_in, bua.check_out, '[)') && tstzrange(p_check_in, p_check_out, '[)')
              AND (p_exclude_booking_id IS NULL OR bua.booking_id != p_exclude_booking_id)
        ) AS conflicting_bookings
    FROM units u
    WHERE u.unit_id = ANY(p_unit_ids)
      AND u.unit_status = 'Available';
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION check_multi_unit_availability IS 'Checks availability for multiple units in a single query';
```

### 3. get_booking_units

**Purpose:** Get all units for a booking (handles both single and multi-unit)

```sql
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
```

---

## Triggers

### 1. Update Booking Totals Trigger

**Purpose:** Automatically update booking totals when units are added/removed

```sql
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
```

### 2. Sync Availability Dates Trigger

**Purpose:** Keep availability table in sync with booking dates

```sql
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
```

### 3. Cascade Status Updates Trigger

**Purpose:** Update availability when booking status changes

```sql
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
```

---

## Row Level Security (RLS)

### booking_units Table

```sql
-- Enable RLS
ALTER TABLE booking_units ENABLE ROW LEVEL SECURITY;

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
```

### booking_unit_availability Table

```sql
-- Enable RLS
ALTER TABLE booking_unit_availability ENABLE ROW LEVEL SECURITY;

-- Policy: Public can check availability (read-only)
CREATE POLICY "availability_select_public"
    ON booking_unit_availability
    FOR SELECT
    USING (true);

-- Policy: Staff can manage availability
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
```

---

## Data Migration Strategy

### Migration Script Structure

```sql
-- database/migrations/018-multi-unit-schema.sql

BEGIN;

-- Step 1: Create extension (if not exists)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Step 2: Create new tables
-- [booking_units, booking_unit_availability, guest_assignments]

-- Step 3: Modify bookings table
-- [Add columns, constraints]

-- Step 4: Migrate existing data
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

-- Step 5: Populate availability table
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
WHERE b.booking_status NOT IN ('Cancelled', 'NoShow');

-- Step 6: Create functions and triggers
-- [All functions and triggers from above]

-- Step 7: Create RLS policies
-- [All RLS policies from above]

-- Step 8: Validate migration
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
```

### Rollback Script

```sql
-- database/migrations/018-rollback.sql

BEGIN;

-- Drop RLS policies
DROP POLICY IF EXISTS "booking_units_select_own" ON booking_units;
DROP POLICY IF EXISTS "booking_units_select_staff" ON booking_units;
DROP POLICY IF EXISTS "booking_units_insert_staff" ON booking_units;
DROP POLICY IF EXISTS "booking_units_update_staff" ON booking_units;
DROP POLICY IF EXISTS "booking_units_delete_manager" ON booking_units;
DROP POLICY IF EXISTS "availability_select_public" ON booking_unit_availability;
DROP POLICY IF EXISTS "availability_all_staff" ON booking_unit_availability;

-- Drop triggers
DROP TRIGGER IF EXISTS trigger_update_booking_totals ON booking_units;
DROP TRIGGER IF EXISTS trigger_sync_booking_dates ON bookings;
DROP TRIGGER IF EXISTS trigger_cascade_status ON bookings;

-- Drop functions
DROP FUNCTION IF EXISTS update_booking_totals();
DROP FUNCTION IF EXISTS sync_booking_dates();
DROP FUNCTION IF EXISTS cascade_booking_status();
DROP FUNCTION IF EXISTS create_multi_unit_booking(JSONB, JSONB[]);
DROP FUNCTION IF EXISTS check_multi_unit_availability(UUID[], TIMESTAMPTZ, TIMESTAMPTZ, UUID);
DROP FUNCTION IF EXISTS get_booking_units(UUID);

-- Drop tables
DROP TABLE IF EXISTS guest_assignments CASCADE;
DROP TABLE IF EXISTS booking_unit_availability CASCADE;
DROP TABLE IF EXISTS booking_units CASCADE;

-- Revert bookings table modifications
ALTER TABLE bookings
    DROP CONSTRAINT IF EXISTS valid_unit_assignment,
    DROP COLUMN IF EXISTS tax_amount,
    DROP COLUMN IF EXISTS discount_amount,
    DROP COLUMN IF EXISTS total_surcharges,
    DROP COLUMN IF EXISTS base_amount,
    DROP COLUMN IF EXISTS unit_count,
    DROP COLUMN IF EXISTS is_multi_unit,
    ALTER COLUMN unit_id SET NOT NULL;

COMMIT;
```

---

## Testing Requirements

### Unit Tests

1. **Table Creation Tests**
   - [ ] booking_units table created with correct schema
   - [ ] All indexes created successfully
   - [ ] Constraints function as expected

2. **Migration Tests**
   - [ ] All existing bookings migrated correctly
   - [ ] Data integrity maintained (no data loss)
   - [ ] Rollback script works correctly

3. **Function Tests**
   - [ ] create_multi_unit_booking handles edge cases
   - [ ] check_multi_unit_availability returns accurate results
   - [ ] get_booking_units handles both single and multi-unit

4. **Trigger Tests**
   - [ ] Booking totals update automatically
   - [ ] Availability dates sync correctly
   - [ ] Status cascades to availability table

5. **RLS Tests**
   - [ ] Users can only see their own booking units
   - [ ] Staff can see all booking units
   - [ ] Public can check availability

### Integration Tests

1. **Multi-Unit Booking Creation**
   - Create booking with 2 units → verify both in booking_units
   - Create booking with 5 units → verify totals calculated correctly

2. **Availability Checking**
   - Overlapping date ranges correctly detected
   - Exclusion constraint prevents double-booking

3. **Backwards Compatibility**
   - Existing single-unit bookings still accessible
   - get_booking_units function returns correct data for legacy bookings

### Performance Tests

1. **Query Performance**
   - Availability check for 10 units < 100ms
   - Booking creation with 5 units < 200ms
   - get_booking_units query < 50ms

2. **Concurrent Operations**
   - Multiple bookings for different units don't conflict
   - Concurrent updates handled correctly

---

## Performance Optimization

### Indexes

All critical indexes created:

- `idx_booking_units_booking_id` - Fast lookups by booking
- `idx_booking_units_unit_id` - Fast lookups by unit
- `idx_booking_units_composite` - Composite index for joins
- `idx_availability_lookup` - Covering index for availability checks
- `idx_booking_units_guest_names` - GIN index for full-text search

### Query Optimization

- Use prepared statements for repeated queries
- Utilize covering indexes to avoid table scans
- Denormalized availability table for fast lookups
- Batch operations to minimize round-trips

### Neon PostgreSQL Specific

- Connection pooling configuration
- Query caching strategies
- Read replicas for heavy queries (if needed)

---

## Risks & Mitigation

### High Risk: Data Loss During Migration

**Mitigation:**

- Full database backup before migration
- Test migration on staging with production clone
- Validation checks after migration
- Rollback script ready and tested

### Medium Risk: Performance Degradation

**Mitigation:**

- Comprehensive index strategy
- Denormalized availability table
- Performance benchmarks before rollout
- Query optimization

### Medium Risk: RLS Policy Errors

**Mitigation:**

- Thorough testing of RLS policies
- Security audit before deployment
- Monitoring for unauthorized access attempts

---

## Acceptance Criteria

### Phase Completion Checklist

- [ ] All tables created successfully
- [ ] Migration script tested on staging
- [ ] All existing bookings migrated (100%)
- [ ] Rollback script verified working
- [ ] All functions created and tested
- [ ] All triggers functioning correctly
- [ ] RLS policies implemented and tested
- [ ] Performance benchmarks achieved
- [ ] Security audit passed
- [ ] Documentation complete

### Sign-Off Requirements

- [ ] `postgres-serverless-architect` - Technical implementation
- [ ] `serverless-saas-architect` - Architecture review
- [ ] `security-compliance-auditor` - Security approval
- [ ] Project Manager - Timeline and deliverables

---

## Next Phase Dependencies

**Phase 2 (Backend API) depends on:**

- [ ] booking_units table available
- [ ] create_multi_unit_booking function ready
- [ ] check_multi_unit_availability function ready
- [ ] RLS policies active

---

## References

- PostgreSQL Exclusion Constraints: https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-EXCLUSION
- btree_gist Extension: https://www.postgresql.org/docs/current/btree-gist.html
- Neon PostgreSQL Best Practices: https://neon.tech/docs/guides/postgresql-best-practices
- Supabase RLS Guide: https://supabase.com/docs/guides/auth/row-level-security
