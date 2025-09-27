# MVP Database Schema

## Okaeri Resort Management System

### 🎯 Simplified Schema Strategy

**Goal**: Start with 3 core tables, essential fields only. Avoid
over-engineering.

---

## 📊 Core Entity Architecture

### Phase 1 Tables (MVP)

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│    UNITS    │────│   BOOKINGS   │────│   GUESTS    │
│ (3 records) │ 1:N│ (~50/month)  │N:1 │ (growing)   │
└─────────────┘    └──────────────┘    └─────────────┘
```

### 1. UNITS Table (Property Management)

```sql
CREATE TABLE units (
  unit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_name VARCHAR(100) NOT NULL UNIQUE,     -- "Unit 1 - Ocean View"
  unit_code VARCHAR(10) NOT NULL UNIQUE,      -- "U1", "U2", "U3"
  max_occupancy INTEGER NOT NULL,             -- 2, 4, 6
  base_rate DECIMAL(10,2) NOT NULL,          -- 2000.00, 2500.00, 3000.00
  unit_status VARCHAR(20) DEFAULT 'Available', -- Available, Occupied, Maintenance
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Essential indexes
CREATE INDEX idx_units_status ON units(unit_status);
```

**Design Decisions**:

- ✅ UUID primary keys (scalable, secure)
- ✅ Single rate field (complex pricing later)
- ✅ Simple status enum (expandable)
- ❌ Skip amenities, photos, complex rates for now

### 2. BOOKINGS Table (Core Business Logic)

```sql
CREATE TABLE bookings (
  booking_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_reference VARCHAR(20) UNIQUE NOT NULL, -- "BK-20241125-A1B2"
  unit_id UUID NOT NULL REFERENCES units(unit_id),

  -- Guest info (denormalized for simplicity)
  guest_name VARCHAR(100) NOT NULL,
  contact_number VARCHAR(20) NOT NULL,
  email VARCHAR(100) NOT NULL,

  -- Booking details
  num_guests INTEGER NOT NULL CHECK(num_guests > 0),
  check_in DATE NOT NULL,
  check_out DATE NOT NULL CHECK(check_out > check_in),
  total_amount DECIMAL(10,2) NOT NULL CHECK(total_amount >= 0),

  -- Status tracking
  booking_status VARCHAR(20) DEFAULT 'Inquiry',  -- Inquiry → Confirmed → Completed

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Critical indexes for availability checking
CREATE INDEX idx_bookings_unit_dates ON bookings(unit_id, check_in, check_out);
CREATE INDEX idx_bookings_status ON bookings(booking_status);
CREATE UNIQUE INDEX idx_booking_reference ON bookings(booking_reference);
```

**Design Decisions**:

- ✅ Denormalized guest info (faster queries, simpler joins)
- ✅ Auto-generated booking references
- ✅ Date constraints at DB level
- ✅ Status transitions handled by application
- ❌ Skip payment proofs, complex workflows for now

### 3. GUESTS Table (Simple CRM)

```sql
CREATE TABLE guests (
  guest_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,     -- Unique identifier for guest matching
  phone_number VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Guest lookup optimization
CREATE UNIQUE INDEX idx_guests_email ON guests(email);
```

**Design Decisions**:

- ✅ Email as natural unique key
- ✅ Minimal fields for MVP
- ✅ Can be populated from booking data
- ❌ Skip address, birthday, preferences for now

---

## 🔄 Core Business Logic

### Availability Check Algorithm

```sql
-- Check if unit is available for date range
SELECT COUNT(*) as conflicts
FROM bookings
WHERE unit_id = ?
  AND booking_status NOT IN ('Cancelled')
  AND NOT (check_out <= ? OR check_in >= ?);
-- Returns 0 = available, >0 = conflicts
```

### Auto-Generate Booking Reference

```sql
-- Format: BK-YYYYMMDD-XXXX
-- Example: BK-20241125-A1B2
CONCAT('BK-',
       TO_CHAR(NOW(), 'YYYYMMDD'), '-',
       UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 4)))
```

### Guest Matching/Creation

```sql
-- Insert or update guest record
INSERT INTO guests (guest_name, email, phone_number)
VALUES (?, ?, ?)
ON CONFLICT (email)
DO UPDATE SET
  guest_name = EXCLUDED.guest_name,
  phone_number = EXCLUDED.phone_number,
  updated_at = NOW()
RETURNING guest_id;
```

---

## 📈 Scalability Considerations

### Storage Estimates

- **Units**: 3 records (~1KB total)
- **Bookings**: 50/month × 12 months = 600/year (~300KB)
- **Guests**: ~300 unique guests/year (~150KB)
- **Total**: <1MB/year (well within free tiers)

### Index Strategy

```sql
-- Required for performance
CREATE INDEX idx_bookings_unit_dates ON bookings(unit_id, check_in, check_out);
CREATE INDEX idx_bookings_status ON bookings(booking_status);
CREATE INDEX idx_guests_email ON guests(email);

-- Optional for reporting (Phase 2+)
CREATE INDEX idx_bookings_check_in ON bookings(check_in);
CREATE INDEX idx_bookings_created_at ON bookings(created_at);
```

### Database Constraints

```sql
-- Business rule constraints
ALTER TABLE bookings ADD CONSTRAINT check_dates
CHECK (check_out > check_in);

ALTER TABLE bookings ADD CONSTRAINT check_guests
CHECK (num_guests > 0 AND num_guests <= 10);

ALTER TABLE bookings ADD CONSTRAINT check_amount
CHECK (total_amount >= 0);

-- Referential integrity
ALTER TABLE bookings ADD CONSTRAINT fk_bookings_unit_id
FOREIGN KEY (unit_id) REFERENCES units(unit_id) ON DELETE RESTRICT;
```

---

## 🚀 Phase 2 Evolution Path

### Tables to Add Later

```sql
-- Phase 2: File Management
CREATE TABLE files (
  file_id UUID PRIMARY KEY,
  booking_id UUID REFERENCES bookings(booking_id),
  file_type VARCHAR(20), -- 'payment_proof', 'receipt', 'id_scan'
  file_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Phase 3: Maintenance Tracking
CREATE TABLE maintenance (
  task_id UUID PRIMARY KEY,
  unit_id UUID REFERENCES units(unit_id),
  task_description VARCHAR(200),
  scheduled_date DATE,
  completed_date DATE,
  cost DECIMAL(10,2)
);

-- Phase 4: Financial Analytics
CREATE TABLE financial_periods (
  period_id UUID PRIMARY KEY,
  period_month DATE UNIQUE,
  total_bookings INTEGER,
  gross_revenue DECIMAL(12,2),
  -- ... other aggregated metrics
);
```

### Schema Migration Strategy

```sql
-- Example: Adding payment tracking to bookings
ALTER TABLE bookings
ADD COLUMN payment_method VARCHAR(20),
ADD COLUMN payment_date DATE,
ADD COLUMN payment_status VARCHAR(20) DEFAULT 'Pending';

-- Index for new payment queries
CREATE INDEX idx_bookings_payment_status ON bookings(payment_status);
```

---

## 🛡️ Data Integrity Rules

### Critical Business Rules

```sql
-- Prevent overlapping bookings
CREATE OR REPLACE FUNCTION prevent_booking_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM bookings
    WHERE unit_id = NEW.unit_id
      AND booking_status NOT IN ('Cancelled')
      AND booking_id != COALESCE(NEW.booking_id, '00000000-0000-0000-0000-000000000000')
      AND NOT (check_out <= NEW.check_in OR check_in >= NEW.check_out)
  ) THEN
    RAISE EXCEPTION 'Booking dates overlap with existing reservation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_booking_overlap
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION prevent_booking_overlap();
```

### Soft Delete Strategy (Phase 2+)

```sql
-- Add deleted_at column instead of hard deletes
ALTER TABLE bookings ADD COLUMN deleted_at TIMESTAMP NULL;

-- Create view for active records
CREATE VIEW active_bookings AS
SELECT * FROM bookings WHERE deleted_at IS NULL;
```

---

## 📊 Monitoring & Analytics Queries

### Essential Queries for Operations

```sql
-- Today's check-ins/check-outs
SELECT b.booking_reference, b.guest_name, u.unit_name, 'CHECK_IN' as action
FROM bookings b JOIN units u ON b.unit_id = u.unit_id
WHERE b.check_in = CURRENT_DATE AND b.booking_status = 'Confirmed'
UNION ALL
SELECT b.booking_reference, b.guest_name, u.unit_name, 'CHECK_OUT' as action
FROM bookings b JOIN units u ON b.unit_id = u.unit_id
WHERE b.check_out = CURRENT_DATE AND b.booking_status IN ('Confirmed', 'In Progress');

-- Unit availability for next 30 days
SELECT u.unit_name, COUNT(b.booking_id) as booked_nights
FROM units u
LEFT JOIN bookings b ON u.unit_id = b.unit_id
  AND b.booking_status NOT IN ('Cancelled')
  AND b.check_in <= CURRENT_DATE + INTERVAL '30 days'
  AND b.check_out >= CURRENT_DATE
GROUP BY u.unit_id, u.unit_name;

-- Monthly revenue summary
SELECT
  DATE_TRUNC('month', check_in) as month,
  COUNT(*) as total_bookings,
  SUM(total_amount) as revenue,
  AVG(total_amount) as avg_booking_value
FROM bookings
WHERE booking_status IN ('Confirmed', 'Completed')
  AND check_in >= DATE_TRUNC('year', CURRENT_DATE)
GROUP BY DATE_TRUNC('month', check_in)
ORDER BY month;
```

---

_MVP Database Schema v1.0 - Simple, Scalable, Production-Ready_
