-- ============================================
-- MIGRATION: 018 - Production Test Data Wipe
-- ============================================
-- Description: Clears all test bookings, payments, and guests before production launch
-- Author: Okaeri Resort System - Production Preparation
-- Date: 2025-10-07
-- Dependencies: All previous migrations (001-017)
--
-- ⚠️ WARNING: DESTRUCTIVE OPERATION
-- This script will permanently delete all bookings, payments, and guest data.
-- Only run this in production AFTER confirming you have a verified backup.
--
-- Safe to run: YES (preserves units, expenses, audit_logs, app_roles)
-- Rollback: Restore from Supabase backup created before running this script

-- Note: Supabase SQL Editor automatically stops on errors (no \set needed)

-- ============================================
-- PRE-WIPE SNAPSHOT
-- ============================================
-- Capture current counts before deletion for verification

DO $$
DECLARE
    v_bookings_count INTEGER;
    v_payments_count INTEGER;
    v_guests_count INTEGER;
    v_units_count INTEGER;
    v_expenses_count INTEGER;
    v_audit_count INTEGER;
BEGIN
    -- Get current counts
    SELECT COUNT(*) INTO v_bookings_count FROM bookings;
    SELECT COUNT(*) INTO v_payments_count FROM payments;
    SELECT COUNT(*) INTO v_guests_count FROM guests;
    SELECT COUNT(*) INTO v_units_count FROM units;
    SELECT COUNT(*) INTO v_expenses_count FROM expenses;
    SELECT COUNT(*) INTO v_audit_count FROM audit_logs;

    -- Log snapshot
    RAISE NOTICE '============================================';
    RAISE NOTICE 'PRE-WIPE SNAPSHOT (% UTC)', NOW();
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Bookings:     % records', v_bookings_count;
    RAISE NOTICE 'Payments:     % records', v_payments_count;
    RAISE NOTICE 'Guests:       % records', v_guests_count;
    RAISE NOTICE 'Units:        % records (WILL BE PRESERVED)', v_units_count;
    RAISE NOTICE 'Expenses:     % records (WILL BE PRESERVED)', v_expenses_count;
    RAISE NOTICE 'Audit Logs:   % records (WILL BE PRESERVED)', v_audit_count;
    RAISE NOTICE '============================================';
END $$;

-- ============================================
-- SAFETY CHECKS
-- ============================================
-- Verify we're not accidentally wiping production data with real guests

DO $$
DECLARE
    v_bookings_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_bookings_count FROM bookings;

    -- Safety check: Warn if deleting more than 100 bookings
    IF v_bookings_count > 100 THEN
        RAISE WARNING 'About to delete % bookings. If this is unexpected, ROLLBACK now!', v_bookings_count;
        RAISE NOTICE 'Waiting 5 seconds before proceeding...';
        PERFORM pg_sleep(5);
    END IF;
END $$;

-- ============================================
-- TRUNCATE TABLES (CASCADE DELETES)
-- ============================================
-- Order matters: Delete dependent tables first, then parent tables

BEGIN;

-- Step 1: Delete payments (child of bookings)
-- CASCADE not needed since bookings will be deleted next
TRUNCATE TABLE payments CASCADE;

DO $$ BEGIN
    RAISE NOTICE '✓ Payments table truncated';
END $$;

-- Step 2: Delete bookings (CASCADE will handle any orphaned references)
-- Note: bookings.guest_id has ON DELETE SET NULL, but we're truncating guests next anyway
TRUNCATE TABLE bookings CASCADE;

DO $$ BEGIN
    RAISE NOTICE '✓ Bookings table truncated';
END $$;

-- Step 3: Delete guests (reset statistics, remove test data)
TRUNCATE TABLE guests CASCADE;

DO $$ BEGIN
    RAISE NOTICE '✓ Guests table truncated';
END $$;

-- ============================================
-- POST-WIPE VERIFICATION
-- ============================================
-- Verify all target tables are empty

DO $$
DECLARE
    v_bookings_count INTEGER;
    v_payments_count INTEGER;
    v_guests_count INTEGER;
    v_units_count INTEGER;
    v_expenses_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_bookings_count FROM bookings;
    SELECT COUNT(*) INTO v_payments_count FROM payments;
    SELECT COUNT(*) INTO v_guests_count FROM guests;
    SELECT COUNT(*) INTO v_units_count FROM units;
    SELECT COUNT(*) INTO v_expenses_count FROM expenses;

    RAISE NOTICE '============================================';
    RAISE NOTICE 'POST-WIPE VERIFICATION (% UTC)', NOW();
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Bookings:     % (expected: 0)', v_bookings_count;
    RAISE NOTICE 'Payments:     % (expected: 0)', v_payments_count;
    RAISE NOTICE 'Guests:       % (expected: 0)', v_guests_count;
    RAISE NOTICE 'Units:        % (preserved)', v_units_count;
    RAISE NOTICE 'Expenses:     % (preserved)', v_expenses_count;
    RAISE NOTICE '============================================';

    -- Validation: Ensure critical tables are empty
    IF v_bookings_count > 0 OR v_payments_count > 0 OR v_guests_count > 0 THEN
        RAISE EXCEPTION 'Wipe verification FAILED! Tables not empty. Rolling back...';
    END IF;

    -- Validation: Ensure preserved tables are intact
    IF v_units_count = 0 THEN
        RAISE EXCEPTION 'Units table is empty! This should not happen. Rolling back...';
    END IF;

    RAISE NOTICE '✓ All validations passed';
END $$;

-- ============================================
-- RESET SEQUENCES (Optional)
-- ============================================
-- Not needed for UUID primary keys, but included for completeness

DO $$ BEGIN
    -- No sequences to reset (all tables use UUID defaults)
    RAISE NOTICE '✓ No sequences to reset (UUID primary keys)';
END $$;

-- ============================================
-- LOG MIGRATION TO AUDIT TRAIL
-- ============================================
-- Record this operation in audit_logs for compliance

INSERT INTO audit_logs (
    table_name,
    record_id,
    action,
    event_type,
    source,
    user_id,
    description,
    severity,
    metadata,
    created_at
) VALUES (
    'multiple_tables',
    NULL,
    'DELETE',
    'production_data_wipe',
    'app',
    NULL, -- System operation (no user)
    'Production test data wipe: Truncated bookings, payments, and guests tables',
    'WARNING',
    jsonb_build_object(
        'migration', '018-production-wipe-test-data.sql',
        'tables_affected', ARRAY['bookings', 'payments', 'guests'],
        'tables_preserved', ARRAY['units', 'expenses', 'audit_logs', 'app_roles'],
        'timestamp', NOW()
    ),
    NOW()
);

DO $$ BEGIN
    RAISE NOTICE '✓ Audit log entry created';
END $$;

-- ============================================
-- COMMIT TRANSACTION
-- ============================================
-- If you've made it here without errors, it's safe to commit

COMMIT;

DO $$ BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE '✅ PRODUCTION WIPE COMPLETE';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Verify units table still has your room configurations';
    RAISE NOTICE '2. Deploy frontend with view-edit routes';
    RAISE NOTICE '3. Create a test booking to verify everything works';
    RAISE NOTICE '4. Monitor audit_logs for the next 48 hours';
    RAISE NOTICE '============================================';
END $$;
