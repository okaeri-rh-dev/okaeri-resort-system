-- Okaeri Resort System Database Schema
-- Version: 1.0.0
-- Description: Complete schema for Phase 1 Foundation

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- UNITS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS units (
    unit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_name VARCHAR(100) NOT NULL UNIQUE,
    unit_code VARCHAR(10) NOT NULL UNIQUE,
    unit_type VARCHAR(20) NOT NULL CHECK (unit_type IN ('Studio', 'One Bedroom', 'Two Bedroom', 'Villa')),
    max_occupancy INTEGER NOT NULL CHECK (max_occupancy > 0),
    base_rate DECIMAL(10,2) NOT NULL CHECK (base_rate >= 0),
    weekend_rate DECIMAL(10,2) NOT NULL CHECK (weekend_rate >= 0),
    unit_status VARCHAR(20) DEFAULT 'Available' CHECK (unit_status IN ('Available', 'Occupied', 'Maintenance', 'Reserved')),
    amenities JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- GUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS guests (
    guest_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guest_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    total_bookings INTEGER DEFAULT 0,
    total_spent DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- BOOKINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS bookings (
    booking_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_reference VARCHAR(20) UNIQUE NOT NULL,
    unit_id UUID NOT NULL REFERENCES units(unit_id) ON DELETE RESTRICT,
    guest_id UUID REFERENCES guests(guest_id) ON DELETE SET NULL,
    guest_name VARCHAR(100) NOT NULL,
    contact_number VARCHAR(20) NOT NULL,
    email VARCHAR(100) NOT NULL,
    num_guests INTEGER NOT NULL CHECK (num_guests > 0),
    check_in DATE NOT NULL,
    check_out DATE NOT NULL CHECK (check_out > check_in),
    total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    booking_status VARCHAR(20) DEFAULT 'Pending' CHECK (
        booking_status IN ('Pending', 'Confirmed', 'CheckedIn', 'CheckedOut', 'Cancelled')
    ),
    payment_status VARCHAR(20) DEFAULT 'Unpaid' CHECK (
        payment_status IN ('Unpaid', 'Partial', 'Paid', 'Refunded')
    ),
    payment_method VARCHAR(20),
    payment_proof_url TEXT,
    special_requests TEXT,
    internal_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PAYMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
    payment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(booking_id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(50),
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    proof_url TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- EXPENSES TABLE (For future use)
-- ============================================
CREATE TABLE IF NOT EXISTS expenses (
    expense_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    expense_date DATE NOT NULL,
    receipt_url TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- MAINTENANCE_LOGS TABLE (For future use)
-- ============================================
CREATE TABLE IF NOT EXISTS maintenance_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID REFERENCES units(unit_id) ON DELETE CASCADE,
    issue_description TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'Pending',
    priority VARCHAR(20) DEFAULT 'Medium',
    reported_date DATE DEFAULT CURRENT_DATE,
    resolved_date DATE,
    cost DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_bookings_unit_dates ON bookings(unit_id, check_in, check_out);
CREATE INDEX idx_bookings_status ON bookings(booking_status);
CREATE INDEX idx_bookings_guest ON bookings(guest_id);
CREATE INDEX idx_bookings_dates ON bookings(check_in, check_out);
CREATE INDEX idx_units_status ON units(unit_status);
CREATE INDEX idx_guests_email ON guests(email);
CREATE INDEX idx_payments_booking ON payments(booking_id);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON units
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_guests_updated_at BEFORE UPDATE ON guests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_maintenance_logs_updated_at BEFORE UPDATE ON maintenance_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- BOOKING REFERENCE GENERATOR FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION generate_booking_reference()
RETURNS TEXT AS $$
DECLARE
    date_part TEXT;
    random_part TEXT;
    reference TEXT;
BEGIN
    date_part := TO_CHAR(NOW(), 'YYYYMMDD');
    random_part := UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 4));
    reference := 'BK-' || date_part || '-' || random_part;
    RETURN reference;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SEED DATA FOR INITIAL UNITS
-- ============================================
INSERT INTO units (unit_name, unit_code, unit_type, max_occupancy, base_rate, weekend_rate, amenities) VALUES
('Unit 1 - Ocean View', 'U1', 'Studio', 2, 2500, 3000, '["WiFi", "Air Conditioning", "Mini Fridge", "Cable TV"]'),
('Unit 2 - Garden View', 'U2', 'One Bedroom', 4, 3500, 4000, '["WiFi", "Air Conditioning", "Kitchen", "Cable TV", "Sofa Bed"]'),
('Unit 3 - Poolside', 'U3', 'Two Bedroom', 6, 5000, 6000, '["WiFi", "Air Conditioning", "Full Kitchen", "Cable TV", "Living Room", "Balcony"]')
ON CONFLICT (unit_code) DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY (RLS) - Disabled for development
-- Enable these in production with proper auth
-- ============================================
-- ALTER TABLE units ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;