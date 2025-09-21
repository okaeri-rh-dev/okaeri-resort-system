-- ============================================
-- PHASE 2 CRITICAL FIXES - MIGRATION RUNNER
-- Run this script to apply all critical fixes
-- ============================================

\echo '============================================'
\echo 'Starting Phase 2 Critical Fixes Migration'
\echo '============================================'
\echo ''

-- Run migrations in order
\echo 'Running Migration 1: Fix Payment Status...'
\i 001-fix-payment-status.sql
\echo ''

\echo 'Running Migration 2: Fix Unit Types...'
\i 002-fix-unit-types.sql
\echo ''

\echo 'Running Migration 3: Add Guest Statistics Triggers...'
\i 003-add-guest-statistics-triggers.sql
\echo ''

-- Final verification
\echo '============================================'
\echo 'Migration Summary'
\echo '============================================'

-- Check payment statuses
\echo ''
\echo 'Payment Status Distribution:'
SELECT
    payment_status,
    COUNT(*) as count
FROM bookings
GROUP BY payment_status
ORDER BY payment_status;

-- Check unit types
\echo ''
\echo 'Unit Type Distribution:'
SELECT
    unit_type,
    COUNT(*) as count
FROM units
GROUP BY unit_type
ORDER BY unit_type;

-- Check guest statistics
\echo ''
\echo 'Guest Statistics Summary:'
SELECT
    COUNT(*) as total_guests,
    COUNT(*) FILTER (WHERE total_bookings > 0) as active_guests,
    ROUND(AVG(total_bookings), 2) as avg_bookings,
    ROUND(AVG(total_spent), 2) as avg_spent
FROM guests;

\echo ''
\echo '============================================'
\echo 'All migrations completed successfully!'
\echo '============================================'
\echo ''
\echo 'Next Steps:'
\echo '1. Test the application with new status values'
\echo '2. Verify booking creation and payment updates'
\echo '3. Check guest statistics are updating automatically'
\echo ''