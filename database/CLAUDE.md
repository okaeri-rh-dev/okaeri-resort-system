# Database Schema - AI Assistant Guide

## Module Purpose

PostgreSQL database schema for the Okaeri Resort System using Supabase with Row Level Security (RLS), foreign key constraints, check constraints, indexes for performance, and trigger-based audit logging. Optimized for serverless Neon PostgreSQL with connection pooling.

## Architecture

```
database/
├── schema.sql                      # Complete schema definition
├── migrations/
│   ├── 001_initial_schema.sql     # Initial tables
│   ├── 002_add_audit_logs.sql     # Audit logging
│   ├── 003_add_rls_policies.sql   # Row Level Security
│   ├── 004_add_indexes.sql        # Performance indexes
│   └── 005_add_constraints.sql    # Business logic constraints
└── README.md                       # Full documentation
```

## Core Tables

### 1. units

```sql
CREATE TABLE units (
  unit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_code text UNIQUE NOT NULL,           -- BCH-1, DEL-1
  unit_name text NOT NULL,
  unit_type text NOT NULL,                  -- Standard, Deluxe, Suite, Villa
  unit_status text DEFAULT 'Available',     -- Available, Occupied, Maintenance, Reserved
  base_occupancy int NOT NULL DEFAULT 2,
  max_occupancy int NOT NULL DEFAULT 4,
  base_rate decimal(10,2) NOT NULL,        -- ₱2,000.00
  extra_person_rate decimal(10,2),         -- ₱500.00 per extra person
  weekend_rate decimal(10,2),              -- ₱2,500.00 (optional)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT valid_unit_type CHECK (unit_type IN ('Standard', 'Deluxe', 'Suite', 'Villa')),
  CONSTRAINT valid_unit_status CHECK (unit_status IN ('Available', 'Occupied', 'Maintenance', 'Reserved')),
  CONSTRAINT valid_occupancy CHECK (base_occupancy > 0 AND max_occupancy >= base_occupancy),
  CONSTRAINT valid_rates CHECK (base_rate > 0)
);

CREATE INDEX idx_units_status ON units(unit_status);
CREATE INDEX idx_units_type ON units(unit_type);
```

### 2. guests

```sql
CREATE TABLE guests (
  guest_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone_number text NOT NULL,
  address text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

CREATE INDEX idx_guests_email ON guests(email);
CREATE INDEX idx_guests_name ON guests USING gin(name gin_trgm_ops);  -- Full-text search
```

### 3. bookings

```sql
CREATE TABLE bookings (
  booking_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_reference text UNIQUE NOT NULL,  -- BKG-2024-12-001
  guest_id uuid NOT NULL REFERENCES guests(guest_id),
  unit_id uuid NOT NULL REFERENCES units(unit_id),
  check_in timestamptz NOT NULL,
  check_out timestamptz NOT NULL,
  num_guests int NOT NULL,
  total_amount decimal(10,2) NOT NULL,
  booking_status text DEFAULT 'pending',   -- pending, confirmed, checked_in, checked_out, cancelled, no_show
  payment_status text DEFAULT 'pending',   -- pending, partial, paid, refunded
  payment_method text,                     -- Cash, GCash, Bank Transfer, Credit Card
  payment_proof_url text,
  special_requests text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT valid_booking_status CHECK (booking_status IN ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show')),
  CONSTRAINT valid_payment_status CHECK (payment_status IN ('pending', 'partial', 'paid', 'refunded')),
  CONSTRAINT valid_dates CHECK (check_out > check_in),
  CONSTRAINT valid_guests CHECK (num_guests > 0),
  CONSTRAINT valid_amount CHECK (total_amount > 0),

  -- Exclusion constraint: prevent overlapping bookings for same unit
  EXCLUDE USING gist (
    unit_id WITH =,
    tstzrange(check_in, check_out) WITH &&
  ) WHERE (booking_status NOT IN ('cancelled', 'no_show'))
);

CREATE INDEX idx_bookings_guest ON bookings(guest_id);
CREATE INDEX idx_bookings_unit ON bookings(unit_id);
CREATE INDEX idx_bookings_dates ON bookings(check_in, check_out);
CREATE INDEX idx_bookings_reference ON bookings(booking_reference);
CREATE INDEX idx_bookings_status ON bookings(booking_status);
```

### 4. payments

```sql
CREATE TABLE payments (
  payment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(booking_id),
  payment_date timestamptz DEFAULT now(),
  amount decimal(10,2) NOT NULL,
  payment_method text NOT NULL,
  payment_status text DEFAULT 'pending',
  transaction_reference text,
  notes text,
  created_at timestamptz DEFAULT now(),

  CONSTRAINT valid_payment_amount CHECK (amount > 0),
  CONSTRAINT valid_payment_status CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded'))
);

CREATE INDEX idx_payments_booking ON payments(booking_id);
CREATE INDEX idx_payments_date ON payments(payment_date);
```

### 5. audit_logs

```sql
CREATE TABLE audit_logs (
  audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,                    -- 'booking.created', 'booking.updated'
  entity_type text NOT NULL,               -- 'booking', 'payment', 'user'
  entity_id uuid,
  user_id uuid,                            -- Supabase auth user (null for public)
  severity text DEFAULT 'INFO',            -- INFO, WARNING, ERROR, CRITICAL
  ip_address inet,
  user_agent text,
  changes jsonb,                           -- { before: {...}, after: {...} }
  metadata jsonb,
  created_at timestamptz DEFAULT now(),

  CONSTRAINT valid_severity CHECK (severity IN ('INFO', 'WARNING', 'ERROR', 'CRITICAL'))
);

CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_severity ON audit_logs(severity) WHERE severity IN ('WARNING', 'ERROR', 'CRITICAL');
CREATE INDEX idx_audit_user ON audit_logs(user_id);
```

## Common Queries

### Check Unit Availability

```sql
-- Check if unit is available for date range
SELECT NOT EXISTS (
  SELECT 1 FROM bookings
  WHERE unit_id = $1
    AND booking_status NOT IN ('cancelled', 'no_show')
    AND (
      (check_in, check_out) OVERLAPS ($2::timestamptz, $3::timestamptz)
    )
) AS is_available;

-- With exclusion of current booking (for edits)
SELECT NOT EXISTS (
  SELECT 1 FROM bookings
  WHERE unit_id = $1
    AND booking_id != $4  -- Exclude current booking
    AND booking_status NOT IN ('cancelled', 'no_show')
    AND (
      (check_in, check_out) OVERLAPS ($2::timestamptz, $3::timestamptz)
    )
) AS is_available;
```

### Get Available Units for Dates

```sql
SELECT u.*
FROM units u
WHERE u.unit_status = 'Available'
  AND NOT EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.unit_id = u.unit_id
      AND b.booking_status NOT IN ('cancelled', 'no_show')
      AND (b.check_in, b.check_out) OVERLAPS ($1::timestamptz, $2::timestamptz)
  )
ORDER BY u.base_rate;
```

### Generate Booking Reference

```sql
-- Function to generate unique booking reference
CREATE OR REPLACE FUNCTION generate_booking_reference()
RETURNS text AS $$
DECLARE
  ref text;
  exists boolean;
BEGIN
  LOOP
    -- Format: BKG-YYYY-MM-NNN
    ref := 'BKG-' ||
           to_char(now(), 'YYYY-MM-') ||
           lpad((floor(random() * 900 + 100)::int)::text, 3, '0');

    -- Check if exists
    SELECT EXISTS(SELECT 1 FROM bookings WHERE booking_reference = ref) INTO exists;

    -- Exit if unique
    EXIT WHEN NOT exists;
  END LOOP;

  RETURN ref;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate booking reference
CREATE TRIGGER set_booking_reference
  BEFORE INSERT ON bookings
  FOR EACH ROW
  WHEN (NEW.booking_reference IS NULL)
  EXECUTE FUNCTION generate_booking_reference();
```

### Revenue by Date Range

```sql
SELECT
  date_trunc('day', check_in) as date,
  COUNT(*) as bookings_count,
  SUM(total_amount) as total_revenue,
  SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END) as collected_revenue
FROM bookings
WHERE check_in >= $1 AND check_in < $2
  AND booking_status NOT IN ('cancelled', 'no_show')
GROUP BY date_trunc('day', check_in)
ORDER BY date;
```

### Occupancy Rate

```sql
SELECT
  date,
  total_units,
  occupied_units,
  round((occupied_units::decimal / total_units * 100), 2) as occupancy_rate
FROM (
  SELECT
    generate_series(
      $1::date,
      $2::date,
      '1 day'::interval
    )::date as date,
    (SELECT COUNT(*) FROM units WHERE unit_status != 'Maintenance') as total_units,
    (
      SELECT COUNT(DISTINCT unit_id)
      FROM bookings
      WHERE booking_status = 'checked_in'
        AND generate_series BETWEEN check_in::date AND check_out::date
    ) as occupied_units
) AS occupancy_data
ORDER BY date;
```

## Common Gotchas

1. **Overlapping Bookings**

   ```sql
   -- ✅ GOOD - Use exclusion constraint
   EXCLUDE USING gist (
     unit_id WITH =,
     tstzrange(check_in, check_out) WITH &&
   ) WHERE (booking_status NOT IN ('cancelled', 'no_show'))

   -- Database automatically prevents conflicts
   ```

2. **Timezone Handling**

   ```sql
   -- ✅ GOOD - Always use timestamptz
   check_in timestamptz NOT NULL

   -- ✅ GOOD - Store in UTC, convert in application
   SELECT check_in AT TIME ZONE 'Asia/Manila' FROM bookings

   -- ❌ BAD - Don't use timestamp without time zone
   check_in timestamp
   ```

3. **Connection Pooling**

   ```typescript
   // ✅ GOOD - Use Supabase client (built-in pooling)
   const { data, error } = await supabase
     .from('bookings')
     .select('*')

   // ⚠️ ACCEPTABLE - Direct connection with pooling
   const pool = new Pool({ max: 10 })

   // ❌ BAD - New connection per request (serverless)
   const client = new Client({...})
   await client.connect()
   ```

4. **Cascade Deletes**

   ```sql
   -- ⚠️ CAREFUL - Consider soft deletes instead
   ALTER TABLE bookings
     ADD CONSTRAINT fk_guest
     FOREIGN KEY (guest_id) REFERENCES guests(guest_id)
     ON DELETE CASCADE  -- Deleting guest deletes all bookings!

   -- ✅ BETTER - Prevent deletion if bookings exist
   ON DELETE RESTRICT

   -- ✅ BEST - Soft delete pattern
   deleted_at timestamptz
   ```

5. **Index Usage**

   ```sql
   -- ✅ GOOD - Use indexes for frequently queried columns
   CREATE INDEX idx_bookings_dates ON bookings(check_in, check_out)

   -- ❌ BAD - Too many indexes slow down writes
   -- Don't index every column
   ```

## Row Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Public can read their own bookings (via booking_reference)
CREATE POLICY "Public can view own bookings"
  ON bookings FOR SELECT
  USING (booking_reference = current_setting('app.booking_reference', true));

-- Authenticated users (staff) can do anything
CREATE POLICY "Staff can manage all bookings"
  ON bookings FOR ALL
  USING (auth.role() = 'authenticated');

-- Service role bypasses RLS (used in Cloudflare Workers)
```

## Migrations

```sql
-- Always use migrations for schema changes
-- migrations/006_add_weekend_rate.sql

BEGIN;

-- Add column
ALTER TABLE units
  ADD COLUMN weekend_rate decimal(10,2);

-- Add constraint
ALTER TABLE units
  ADD CONSTRAINT valid_weekend_rate
  CHECK (weekend_rate IS NULL OR weekend_rate > 0);

-- Create index if needed
CREATE INDEX idx_units_weekend_rate ON units(weekend_rate)
  WHERE weekend_rate IS NOT NULL;

-- Update audit log
INSERT INTO audit_logs (action, entity_type, description)
VALUES ('schema.migration', 'database', 'Added weekend_rate column to units table');

COMMIT;
```

## Performance Tips

- Use connection pooling (Supabase default)
- Add indexes on foreign keys
- Use partial indexes for filtered queries
- Analyze query plans with `EXPLAIN ANALYZE`
- Vacuum regularly (automatic in managed Postgres)
- Use materialized views for complex reports
- Limit result sets with `LIMIT` and pagination
- Use `SELECT specific_columns` instead of `SELECT *`
- Batch inserts when possible
- Use prepared statements (Supabase handles this)

## Backup & Recovery

```bash
# Automatic backups (Supabase)
# - Point-in-time recovery: Last 7 days
# - Daily snapshots: Retained for 30 days

# Manual backup
pg_dump -h db.xxx.supabase.co -U postgres -d postgres > backup.sql

# Restore
psql -h db.xxx.supabase.co -U postgres -d postgres < backup.sql
```
