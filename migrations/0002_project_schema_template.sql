-- Migration: 0002_project_schema_template
-- Description: Template for creating project-specific schemas in Okaeri Resort Management System
-- Created: 2025-08-26
-- Author: Okaeri Development Team
-- Note: This template should be executed for each new project with the schema name replaced

-- Replace {SCHEMA_NAME} with the actual project schema name
-- Example: project_resort_xyz

-- Create project-specific enum types
DO $$ BEGIN
    CREATE TYPE {SCHEMA_NAME}.booking_status AS ENUM ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE {SCHEMA_NAME}.payment_status AS ENUM ('pending', 'partial', 'paid', 'refunded', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE {SCHEMA_NAME}.payment_method AS ENUM ('cash', 'gcash', 'bank_transfer', 'credit_card', 'debit_card', 'check', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE {SCHEMA_NAME}.expense_status AS ENUM ('draft', 'pending_approval', 'approved', 'rejected', 'paid');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE {SCHEMA_NAME}.income_source AS ENUM ('booking', 'restaurant', 'amenity', 'rental', 'event', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Bookings table: Core booking management
CREATE TABLE IF NOT EXISTS {SCHEMA_NAME}.bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_code VARCHAR(20) NOT NULL UNIQUE,
    
    -- Guest Information
    guest_name VARCHAR(255) NOT NULL,
    guest_email VARCHAR(255),
    guest_phone VARCHAR(20) NOT NULL,
    guest_address TEXT,
    number_of_guests INTEGER NOT NULL DEFAULT 1 CHECK (number_of_guests > 0),
    number_of_children INTEGER DEFAULT 0 CHECK (number_of_children >= 0),
    
    -- Booking Details
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    check_in_time TIME,
    check_out_time TIME,
    room_type VARCHAR(100),
    room_number VARCHAR(50),
    
    -- Pricing (all amounts in Philippine Peso)
    base_price DECIMAL(12, 2) NOT NULL CHECK (base_price >= 0),
    additional_charges DECIMAL(12, 2) DEFAULT 0 CHECK (additional_charges >= 0),
    discount_amount DECIMAL(12, 2) DEFAULT 0 CHECK (discount_amount >= 0),
    tax_amount DECIMAL(12, 2) DEFAULT 0 CHECK (tax_amount >= 0),
    total_amount DECIMAL(12, 2) NOT NULL CHECK (total_amount >= 0),
    deposit_amount DECIMAL(12, 2) DEFAULT 0 CHECK (deposit_amount >= 0),
    paid_amount DECIMAL(12, 2) DEFAULT 0 CHECK (paid_amount >= 0),
    balance_amount DECIMAL(12, 2) NOT NULL,
    
    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    payment_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    
    -- Special Requests
    special_requests TEXT,
    internal_notes TEXT,
    
    -- Cancellation
    cancellation_reason TEXT,
    cancelled_at TIMESTAMP,
    cancelled_by UUID,
    
    -- Metadata
    source VARCHAR(50) DEFAULT 'direct',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
    
    CONSTRAINT valid_dates CHECK (check_out_date > check_in_date),
    CONSTRAINT valid_balance CHECK (balance_amount = total_amount - paid_amount),
    CONSTRAINT valid_email CHECK (guest_email IS NULL OR guest_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Create indexes for bookings table
CREATE UNIQUE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_bookings_code ON {SCHEMA_NAME}.bookings(booking_code);
CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_bookings_check_in ON {SCHEMA_NAME}.bookings(check_in_date);
CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_bookings_check_out ON {SCHEMA_NAME}.bookings(check_out_date);
CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_bookings_status ON {SCHEMA_NAME}.bookings(status);
CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_bookings_payment_status ON {SCHEMA_NAME}.bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_bookings_guest_phone ON {SCHEMA_NAME}.bookings(guest_phone);
CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_bookings_created_at ON {SCHEMA_NAME}.bookings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_bookings_date_range ON {SCHEMA_NAME}.bookings(check_in_date, check_out_date);

-- Payments table: Payment transaction tracking
CREATE TABLE IF NOT EXISTS {SCHEMA_NAME}.payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID REFERENCES {SCHEMA_NAME}.bookings(id) ON DELETE CASCADE,
    payment_code VARCHAR(20) NOT NULL UNIQUE,
    
    -- Payment Details
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(50) NOT NULL,
    payment_type VARCHAR(50) NOT NULL,
    
    -- Transaction Details
    transaction_id VARCHAR(100),
    reference_number VARCHAR(100),
    
    -- GCash specific fields
    gcash_reference_number VARCHAR(50),
    gcash_account_name VARCHAR(255),
    gcash_account_number VARCHAR(20),
    
    -- Bank Transfer specific fields
    bank_name VARCHAR(100),
    bank_account_number VARCHAR(50),
    bank_account_name VARCHAR(255),
    
    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    verified_at TIMESTAMP,
    verified_by UUID,
    
    -- Receipt
    receipt_number VARCHAR(50),
    receipt_url TEXT,
    
    -- Notes
    notes TEXT,
    failure_reason TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    processed_by UUID,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for payments table
CREATE UNIQUE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_payments_code ON {SCHEMA_NAME}.payments(payment_code);
CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_payments_booking ON {SCHEMA_NAME}.payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_payments_method ON {SCHEMA_NAME}.payments(payment_method);
CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_payments_status ON {SCHEMA_NAME}.payments(status);
CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_payments_reference ON {SCHEMA_NAME}.payments(reference_number) WHERE reference_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_payments_created_at ON {SCHEMA_NAME}.payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_payments_gcash ON {SCHEMA_NAME}.payments(gcash_reference_number) WHERE gcash_reference_number IS NOT NULL;

-- Expense categories table: Categorization for expenses
CREATE TABLE IF NOT EXISTS {SCHEMA_NAME}.expense_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    parent_id UUID REFERENCES {SCHEMA_NAME}.expense_categories(id) ON DELETE CASCADE,
    icon VARCHAR(50),
    color VARCHAR(7),
    is_active BOOLEAN DEFAULT true NOT NULL,
    sort_order INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
    
    CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9-]+$'),
    CONSTRAINT valid_color CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$')
);

-- Create indexes for expense_categories table
CREATE UNIQUE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_expense_categories_slug ON {SCHEMA_NAME}.expense_categories(slug);
CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_expense_categories_parent ON {SCHEMA_NAME}.expense_categories(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_expense_categories_active ON {SCHEMA_NAME}.expense_categories(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_expense_categories_sort ON {SCHEMA_NAME}.expense_categories(sort_order, name);

-- Expenses table: Business expense tracking
CREATE TABLE IF NOT EXISTS {SCHEMA_NAME}.expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    expense_code VARCHAR(20) NOT NULL UNIQUE,
    category_id UUID NOT NULL REFERENCES {SCHEMA_NAME}.expense_categories(id),
    
    -- Expense Details
    description TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    quantity DECIMAL(10, 2) DEFAULT 1 CHECK (quantity > 0),
    unit_price DECIMAL(12, 2),
    
    -- Payment Information
    payment_method VARCHAR(50),
    payment_status VARCHAR(50) NOT NULL DEFAULT 'paid',
    paid_at TIMESTAMP,
    
    -- Vendor Information
    vendor_name VARCHAR(255),
    vendor_contact VARCHAR(255),
    invoice_number VARCHAR(100),
    invoice_date DATE,
    due_date DATE,
    
    -- Approval Workflow
    status VARCHAR(50) NOT NULL DEFAULT 'approved',
    approved_by UUID,
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    
    -- Documentation
    receipt_url TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    
    -- Recurring Expense
    is_recurring BOOLEAN DEFAULT false,
    recurring_frequency VARCHAR(20),
    next_recurring_date DATE,
    
    -- Notes and Tags
    notes TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
    
    CONSTRAINT valid_unit_calculation CHECK (unit_price IS NULL OR amount = quantity * unit_price),
    CONSTRAINT valid_recurring CHECK (NOT is_recurring OR (recurring_frequency IS NOT NULL AND next_recurring_date IS NOT NULL))
);

-- Create indexes for expenses table
CREATE UNIQUE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_expenses_code ON {SCHEMA_NAME}.expenses(expense_code);
CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_expenses_category ON {SCHEMA_NAME}.expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_expenses_payment_status ON {SCHEMA_NAME}.expenses(payment_status);
CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_expenses_status ON {SCHEMA_NAME}.expenses(status);
CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_expenses_paid_at ON {SCHEMA_NAME}.expenses(paid_at DESC) WHERE paid_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_expenses_recurring ON {SCHEMA_NAME}.expenses(is_recurring, next_recurring_date) WHERE is_recurring = true;
CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_expenses_created_at ON {SCHEMA_NAME}.expenses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_expenses_vendor ON {SCHEMA_NAME}.expenses(vendor_name) WHERE vendor_name IS NOT NULL;

-- Income table: Revenue tracking beyond bookings
CREATE TABLE IF NOT EXISTS {SCHEMA_NAME}.income (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    income_code VARCHAR(20) NOT NULL UNIQUE,
    
    -- Income Source
    source VARCHAR(100) NOT NULL,
    booking_id UUID REFERENCES {SCHEMA_NAME}.bookings(id) ON DELETE SET NULL,
    
    -- Income Details
    description TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    quantity DECIMAL(10, 2) DEFAULT 1 CHECK (quantity > 0),
    unit_price DECIMAL(12, 2),
    
    -- Payment Information
    payment_method VARCHAR(50),
    payment_status VARCHAR(50) NOT NULL DEFAULT 'received',
    received_at TIMESTAMP DEFAULT NOW(),
    
    -- Customer Information
    customer_name VARCHAR(255),
    customer_contact VARCHAR(255),
    
    -- Documentation
    receipt_number VARCHAR(50),
    receipt_url TEXT,
    
    -- Category and Tags
    category VARCHAR(100),
    tags JSONB DEFAULT '[]'::jsonb,
    
    -- Notes
    notes TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    recorded_by UUID,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
    
    CONSTRAINT valid_unit_calculation CHECK (unit_price IS NULL OR amount = quantity * unit_price)
);

-- Create indexes for income table
CREATE UNIQUE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_income_code ON {SCHEMA_NAME}.income(income_code);
CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_income_source ON {SCHEMA_NAME}.income(source);
CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_income_booking ON {SCHEMA_NAME}.income(booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_income_payment_status ON {SCHEMA_NAME}.income(payment_status);
CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_income_received_at ON {SCHEMA_NAME}.income(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_income_category ON {SCHEMA_NAME}.income(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_income_created_at ON {SCHEMA_NAME}.income(created_at DESC);

-- Booking timeline table: Event tracking for bookings
CREATE TABLE IF NOT EXISTS {SCHEMA_NAME}.booking_timeline (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES {SCHEMA_NAME}.bookings(id) ON DELETE CASCADE,
    
    -- Event Details
    event_type VARCHAR(50) NOT NULL,
    event_title VARCHAR(255) NOT NULL,
    event_description TEXT,
    
    -- Change Tracking
    old_values JSONB DEFAULT '{}'::jsonb,
    new_values JSONB DEFAULT '{}'::jsonb,
    
    -- User Tracking
    performed_by UUID,
    performed_by_name VARCHAR(255),
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for booking_timeline table
CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_timeline_booking ON {SCHEMA_NAME}.booking_timeline(booking_id);
CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_timeline_event_type ON {SCHEMA_NAME}.booking_timeline(event_type);
CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_timeline_created_at ON {SCHEMA_NAME}.booking_timeline(created_at DESC);

-- Project settings table: Configuration storage
CREATE TABLE IF NOT EXISTS {SCHEMA_NAME}.project_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key VARCHAR(100) NOT NULL UNIQUE,
    value JSONB NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    is_editable BOOLEAN DEFAULT true,
    validation_rules JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    updated_by UUID,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
    
    CONSTRAINT valid_key CHECK (key ~ '^[a-z][a-z0-9_]*$')
);

-- Create indexes for project_settings table
CREATE UNIQUE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_settings_key ON {SCHEMA_NAME}.project_settings(key);
CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_settings_category ON {SCHEMA_NAME}.project_settings(category);
CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_settings_public ON {SCHEMA_NAME}.project_settings(is_public) WHERE is_public = true;

-- Create updated_at triggers for project-specific tables
CREATE TRIGGER update_{SCHEMA_NAME}_bookings_updated_at
    BEFORE UPDATE ON {SCHEMA_NAME}.bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_{SCHEMA_NAME}_payments_updated_at
    BEFORE UPDATE ON {SCHEMA_NAME}.payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_{SCHEMA_NAME}_expense_categories_updated_at
    BEFORE UPDATE ON {SCHEMA_NAME}.expense_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_{SCHEMA_NAME}_expenses_updated_at
    BEFORE UPDATE ON {SCHEMA_NAME}.expenses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_{SCHEMA_NAME}_income_updated_at
    BEFORE UPDATE ON {SCHEMA_NAME}.income
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_{SCHEMA_NAME}_project_settings_updated_at
    BEFORE UPDATE ON {SCHEMA_NAME}.project_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create views for common queries
CREATE OR REPLACE VIEW {SCHEMA_NAME}.booking_summary AS
SELECT 
    b.id,
    b.booking_code,
    b.guest_name,
    b.check_in_date,
    b.check_out_date,
    b.status,
    b.payment_status,
    b.total_amount,
    b.paid_amount,
    b.balance_amount,
    COUNT(p.id) as payment_count,
    MAX(p.created_at) as last_payment_date
FROM {SCHEMA_NAME}.bookings b
LEFT JOIN {SCHEMA_NAME}.payments p ON b.id = p.booking_id
GROUP BY b.id;

CREATE OR REPLACE VIEW {SCHEMA_NAME}.monthly_financial_summary AS
SELECT 
    DATE_TRUNC('month', COALESCE(i.received_at, e.paid_at)) as month,
    COALESCE(SUM(i.amount), 0) as total_income,
    COALESCE(SUM(e.amount), 0) as total_expenses,
    COALESCE(SUM(i.amount), 0) - COALESCE(SUM(e.amount), 0) as net_profit
FROM (
    SELECT received_at, amount FROM {SCHEMA_NAME}.income WHERE payment_status = 'received'
) i
FULL OUTER JOIN (
    SELECT paid_at, amount FROM {SCHEMA_NAME}.expenses WHERE payment_status = 'paid'
) e ON DATE_TRUNC('month', i.received_at) = DATE_TRUNC('month', e.paid_at)
GROUP BY DATE_TRUNC('month', COALESCE(i.received_at, e.paid_at))
ORDER BY month DESC;

-- Add comments for documentation
COMMENT ON SCHEMA {SCHEMA_NAME} IS 'Project-specific schema for resort management data';
COMMENT ON TABLE {SCHEMA_NAME}.bookings IS 'Guest bookings and reservations';
COMMENT ON TABLE {SCHEMA_NAME}.payments IS 'Payment transactions for bookings and other services';
COMMENT ON TABLE {SCHEMA_NAME}.expense_categories IS 'Categorization structure for business expenses';
COMMENT ON TABLE {SCHEMA_NAME}.expenses IS 'Business operational expenses';
COMMENT ON TABLE {SCHEMA_NAME}.income IS 'Revenue streams beyond booking payments';
COMMENT ON TABLE {SCHEMA_NAME}.booking_timeline IS 'Event history and audit trail for bookings';
COMMENT ON TABLE {SCHEMA_NAME}.project_settings IS 'Project-specific configuration and settings';

-- Grant permissions (adjust based on your database user)
-- GRANT USAGE ON SCHEMA {SCHEMA_NAME} TO your_app_user;
-- GRANT ALL ON ALL TABLES IN SCHEMA {SCHEMA_NAME} TO your_app_user;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA {SCHEMA_NAME} TO your_app_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA {SCHEMA_NAME} TO your_app_user;