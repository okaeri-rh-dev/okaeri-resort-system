-- =============================================
-- Migration: 006_simple_resort_setup.sql
-- Description: Simple setup for internal resort app (1-3 properties)
-- Author: System
-- Date: 2025-08-29
-- Note: This migration uses application-level filtering, NOT RLS
-- =============================================

BEGIN;

-- Set timezone for consistent timestamps
SET timezone = 'Asia/Manila';

-- =============================================
-- NOTICE: Internal App - No RLS
-- =============================================
-- This database setup is for an INTERNAL resort management application.
-- Security is handled at the application layer through:
-- 1. All queries include WHERE project_id filtering
-- 2. Service layer validates user access to projects
-- 3. Audit logging tracks all data access
-- =============================================

-- =============================================
-- STEP 1: Ensure Core Tables Have project_id
-- =============================================

-- Add project_id to all tenant-scoped tables if not present
DO $$ 
BEGIN
    -- Bookings table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'bookings' AND column_name = 'project_id') THEN
        ALTER TABLE bookings ADD COLUMN project_id UUID NOT NULL;
    END IF;

    -- Payments table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'payments' AND column_name = 'project_id') THEN
        ALTER TABLE payments ADD COLUMN project_id UUID NOT NULL;
    END IF;

    -- Expenses table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'expenses' AND column_name = 'project_id') THEN
        ALTER TABLE expenses ADD COLUMN project_id UUID NOT NULL;
    END IF;

    -- Income table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'income' AND column_name = 'project_id') THEN
        ALTER TABLE income ADD COLUMN project_id UUID NOT NULL;
    END IF;

    -- Guests table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'guests' AND column_name = 'project_id') THEN
        ALTER TABLE guests ADD COLUMN project_id UUID NOT NULL;
    END IF;

    -- Rooms/Units table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'units' AND column_name = 'project_id') THEN
        ALTER TABLE units ADD COLUMN project_id UUID NOT NULL;
    END IF;
END $$;

-- =============================================
-- STEP 2: Create Simple B-tree Indexes
-- =============================================

-- Bookings indexes for common queries
CREATE INDEX IF NOT EXISTS idx_bookings_project_id 
    ON bookings(project_id);
CREATE INDEX IF NOT EXISTS idx_bookings_project_status 
    ON bookings(project_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_project_dates 
    ON bookings(project_id, check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_bookings_project_created 
    ON bookings(project_id, created_at DESC);

-- Payments indexes
CREATE INDEX IF NOT EXISTS idx_payments_project_id 
    ON payments(project_id);
CREATE INDEX IF NOT EXISTS idx_payments_project_booking 
    ON payments(project_id, booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_project_status 
    ON payments(project_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_payments_project_date 
    ON payments(project_id, payment_date DESC);

-- Expenses indexes
CREATE INDEX IF NOT EXISTS idx_expenses_project_id 
    ON expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_expenses_project_category 
    ON expenses(project_id, category);
CREATE INDEX IF NOT EXISTS idx_expenses_project_date 
    ON expenses(project_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_project_status 
    ON expenses(project_id, approval_status);

-- Income indexes
CREATE INDEX IF NOT EXISTS idx_income_project_id 
    ON income(project_id);
CREATE INDEX IF NOT EXISTS idx_income_project_source 
    ON income(project_id, source_type);
CREATE INDEX IF NOT EXISTS idx_income_project_date 
    ON income(project_id, income_date DESC);

-- Guests indexes
CREATE INDEX IF NOT EXISTS idx_guests_project_id 
    ON guests(project_id);
CREATE INDEX IF NOT EXISTS idx_guests_project_email 
    ON guests(project_id, email);
CREATE INDEX IF NOT EXISTS idx_guests_project_phone 
    ON guests(project_id, phone);

-- Units indexes
CREATE INDEX IF NOT EXISTS idx_units_project_id 
    ON units(project_id);
CREATE INDEX IF NOT EXISTS idx_units_project_status 
    ON units(project_id, status);
CREATE INDEX IF NOT EXISTS idx_units_project_type 
    ON units(project_id, unit_type);

-- =============================================
-- STEP 3: Add Unique Constraints for Business Logic
-- =============================================

-- Ensure unique booking codes per project
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_project_booking_code_unique;
ALTER TABLE bookings ADD CONSTRAINT bookings_project_booking_code_unique 
    UNIQUE(project_id, booking_code);

-- Ensure unique unit codes per project
ALTER TABLE units DROP CONSTRAINT IF EXISTS units_project_unit_code_unique;
ALTER TABLE units ADD CONSTRAINT units_project_unit_code_unique 
    UNIQUE(project_id, unit_code);

-- Ensure unique payment references per project
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_project_reference_unique;
ALTER TABLE payments ADD CONSTRAINT payments_project_reference_unique 
    UNIQUE(project_id, payment_reference) 
    WHERE payment_reference IS NOT NULL;

-- =============================================
-- STEP 4: Add Foreign Key Constraints
-- =============================================

-- Ensure all project_id columns reference the projects table
DO $$
BEGIN
    -- Only add if projects table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects') THEN
        
        -- Bookings -> Projects
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                      WHERE constraint_name = 'fk_bookings_project') THEN
            ALTER TABLE bookings 
                ADD CONSTRAINT fk_bookings_project 
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
        END IF;

        -- Payments -> Projects
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                      WHERE constraint_name = 'fk_payments_project') THEN
            ALTER TABLE payments 
                ADD CONSTRAINT fk_payments_project 
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
        END IF;

        -- Expenses -> Projects
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                      WHERE constraint_name = 'fk_expenses_project') THEN
            ALTER TABLE expenses 
                ADD CONSTRAINT fk_expenses_project 
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
        END IF;

        -- Income -> Projects
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                      WHERE constraint_name = 'fk_income_project') THEN
            ALTER TABLE income 
                ADD CONSTRAINT fk_income_project 
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
        END IF;

        -- Guests -> Projects
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                      WHERE constraint_name = 'fk_guests_project') THEN
            ALTER TABLE guests 
                ADD CONSTRAINT fk_guests_project 
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
        END IF;

        -- Units -> Projects
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                      WHERE constraint_name = 'fk_units_project') THEN
            ALTER TABLE units 
                ADD CONSTRAINT fk_units_project 
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- =============================================
-- STEP 5: Create Audit Log Table (Simple)
-- =============================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    user_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'SELECT', 'INSERT', 'UPDATE', 'DELETE'
    table_name VARCHAR(100) NOT NULL,
    record_id UUID,
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index for audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_project_user 
    ON audit_logs(project_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_project_action 
    ON audit_logs(project_id, action, created_at DESC);

-- =============================================
-- STEP 6: Add Helper Comments
-- =============================================

COMMENT ON TABLE bookings IS 'Resort bookings - filtered by project_id in application layer';
COMMENT ON TABLE payments IS 'Payment records - filtered by project_id in application layer';
COMMENT ON TABLE expenses IS 'Business expenses - filtered by project_id in application layer';
COMMENT ON TABLE income IS 'Income records - filtered by project_id in application layer';
COMMENT ON TABLE guests IS 'Guest information - filtered by project_id in application layer';
COMMENT ON TABLE units IS 'Resort units/rooms - filtered by project_id in application layer';
COMMENT ON TABLE audit_logs IS 'Security audit trail for all data access';

-- =============================================
-- NOTICE: Application-Level Security Required
-- =============================================
-- IMPORTANT: This database has NO Row-Level Security (RLS).
-- The application MUST enforce project isolation by:
-- 1. Including WHERE project_id = ? in ALL queries
-- 2. Validating user access to projects before queries
-- 3. Using the secure base service pattern
-- 4. Logging all access to audit_logs table
-- =============================================

COMMIT;

-- =============================================
-- Post-Migration Verification
-- =============================================
-- Run these queries to verify the migration:

-- Check all tables have project_id column:
-- SELECT table_name, column_name 
-- FROM information_schema.columns 
-- WHERE column_name = 'project_id' 
-- ORDER BY table_name;

-- Check indexes were created:
-- SELECT tablename, indexname 
-- FROM pg_indexes 
-- WHERE indexname LIKE 'idx_%project%' 
-- ORDER BY tablename, indexname;

-- Verify NO RLS policies exist:
-- SELECT schemaname, tablename, policyname 
-- FROM pg_policies;
-- Expected: 0 rows (no RLS policies)