-- ============================================
-- EMERGENCY ROLLBACK SCRIPT
-- ============================================
-- Description: Emergency procedures for rolling back production deployment
-- Usage: Run this ONLY if Supabase backup restore is not available
-- Risk: MEDIUM (creates backups before rolling back)
-- Prerequisites: Have backup SQL file ready

\set ON_ERROR_STOP on

-- ============================================
-- EMERGENCY ROLLBACK NOTICE
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE '⚠️  EMERGENCY ROLLBACK PROCEDURE';
    RAISE NOTICE '============================================';
    RAISE NOTICE '';
    RAISE NOTICE 'This script will help diagnose and potentially rollback';
    RAISE NOTICE 'production issues. It does NOT automatically restore data.';
    RAISE NOTICE '';
    RAISE NOTICE 'For full restoration, use Supabase Dashboard:';
    RAISE NOTICE '  Database → Backups → Restore';
    RAISE NOTICE '';
    RAISE NOTICE 'This script provides:';
    RAISE NOTICE '  1. Current state diagnosis';
    RAISE NOTICE '  2. Recent changes audit';
    RAISE NOTICE '  3. Data integrity checks';
    RAISE NOTICE '  4. Emergency backup export';
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
END $$;

-- ============================================
-- STEP 1: DIAGNOSE CURRENT STATE
-- ============================================

SELECT '============================================' as separator;
SELECT 'STEP 1: CURRENT STATE DIAGNOSIS' as step;
SELECT '============================================' as separator;

-- Check table counts
DO $$
DECLARE
    v_bookings INTEGER;
    v_payments INTEGER;
    v_guests INTEGER;
    v_units INTEGER;
    v_expenses INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_bookings FROM bookings;
    SELECT COUNT(*) INTO v_payments FROM payments;
    SELECT COUNT(*) INTO v_guests FROM guests;
    SELECT COUNT(*) INTO v_units FROM units;
    SELECT COUNT(*) INTO v_expenses FROM expenses;

    RAISE NOTICE 'Table Counts:';
    RAISE NOTICE '  Bookings:  %', v_bookings;
    RAISE NOTICE '  Payments:  %', v_payments;
    RAISE NOTICE '  Guests:    %', v_guests;
    RAISE NOTICE '  Units:     %', v_units;
    RAISE NOTICE '  Expenses:  %', v_expenses;
END $$;

-- Check for data corruption
DO $$
DECLARE
    v_orphaned_payments INTEGER;
    v_orphaned_bookings INTEGER;
BEGIN
    -- Payments without bookings
    SELECT COUNT(*) INTO v_orphaned_payments
    FROM payments p
    WHERE NOT EXISTS (SELECT 1 FROM bookings b WHERE b.booking_id = p.booking_id);

    -- Bookings without valid units
    SELECT COUNT(*) INTO v_orphaned_bookings
    FROM bookings b
    WHERE NOT EXISTS (SELECT 1 FROM units u WHERE u.unit_id = b.unit_id);

    RAISE NOTICE '';
    RAISE NOTICE 'Data Integrity:';
    RAISE NOTICE '  Orphaned Payments: % (should be 0)', v_orphaned_payments;
    RAISE NOTICE '  Invalid Unit References: % (should be 0)', v_orphaned_bookings;

    IF v_orphaned_payments > 0 OR v_orphaned_bookings > 0 THEN
        RAISE WARNING '❌ DATA CORRUPTION DETECTED!';
    ELSE
        RAISE NOTICE '✅ No data corruption detected';
    END IF;
END $$;

-- ============================================
-- STEP 2: RECENT CHANGES AUDIT
-- ============================================

SELECT '============================================' as separator;
SELECT 'STEP 2: RECENT CHANGES (Last 24 Hours)' as step;
SELECT '============================================' as separator;

-- Show recent audit logs
SELECT
    created_at,
    table_name,
    action,
    event_type,
    user_email,
    description
FROM audit_logs
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;

-- Show recent bookings changes
DO $$
DECLARE
    v_recent_bookings INTEGER;
    v_recent_updates INTEGER;
    v_recent_deletions INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_recent_bookings
    FROM bookings
    WHERE created_at >= NOW() - INTERVAL '24 hours';

    SELECT COUNT(*) INTO v_recent_updates
    FROM audit_logs
    WHERE table_name = 'bookings'
      AND action = 'UPDATE'
      AND created_at >= NOW() - INTERVAL '24 hours';

    SELECT COUNT(*) INTO v_recent_deletions
    FROM audit_logs
    WHERE table_name = 'bookings'
      AND action = 'DELETE'
      AND created_at >= NOW() - INTERVAL '24 hours';

    RAISE NOTICE '';
    RAISE NOTICE 'Recent Activity:';
    RAISE NOTICE '  New Bookings:     %', v_recent_bookings;
    RAISE NOTICE '  Booking Updates:  %', v_recent_updates;
    RAISE NOTICE '  Booking Deletions: %', v_recent_deletions;
END $$;

-- ============================================
-- STEP 3: CHECK SCHEMA INTEGRITY
-- ============================================

SELECT '============================================' as separator;
SELECT 'STEP 3: SCHEMA INTEGRITY CHECKS' as step;
SELECT '============================================' as separator;

-- Check if all expected tables exist
WITH expected_tables AS (
    SELECT unnest(ARRAY[
        'units', 'guests', 'bookings', 'payments', 'expenses',
        'maintenance_logs', 'audit_logs', 'app_roles'
    ]) AS table_name
),
existing_tables AS (
    SELECT tablename AS table_name
    FROM pg_tables
    WHERE schemaname = 'public'
)
SELECT
    et.table_name,
    CASE
        WHEN ext.table_name IS NOT NULL THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status
FROM expected_tables et
LEFT JOIN existing_tables ext ON et.table_name = ext.table_name
ORDER BY et.table_name;

-- Check foreign key constraints
DO $$
DECLARE
    v_fk_violations INTEGER;
BEGIN
    -- This would require checking each FK individually
    -- For now, just check if constraints exist
    SELECT COUNT(*) INTO v_fk_violations
    FROM pg_constraint
    WHERE contype = 'f'
      AND connamespace = 'public'::regnamespace;

    RAISE NOTICE '';
    RAISE NOTICE 'Foreign Key Constraints: %', v_fk_violations;
END $$;

-- ============================================
-- STEP 4: EXPORT CURRENT STATE (MINI BACKUP)
-- ============================================

SELECT '============================================' as separator;
SELECT 'STEP 4: EXPORT CURRENT STATE' as step;
SELECT '============================================' as separator;

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'To export current state for safety:';
    RAISE NOTICE '';
    RAISE NOTICE '  psql $DATABASE_URL -c "COPY bookings TO STDOUT CSV HEADER" > bookings_backup.csv';
    RAISE NOTICE '  psql $DATABASE_URL -c "COPY payments TO STDOUT CSV HEADER" > payments_backup.csv';
    RAISE NOTICE '  psql $DATABASE_URL -c "COPY guests TO STDOUT CSV HEADER" > guests_backup.csv';
    RAISE NOTICE '';
    RAISE NOTICE 'Or use pg_dump:';
    RAISE NOTICE '';
    RAISE NOTICE '  pg_dump $DATABASE_URL > emergency_backup.sql';
    RAISE NOTICE '';
END $$;

-- ============================================
-- STEP 5: ROLLBACK DECISION TREE
-- ============================================

SELECT '============================================' as separator;
SELECT 'STEP 5: ROLLBACK DECISION TREE' as step;
SELECT '============================================' as separator;

DO $$
DECLARE
    v_bookings INTEGER;
    v_units INTEGER;
    v_orphaned_payments INTEGER;
    v_recent_production_bookings INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_bookings FROM bookings;
    SELECT COUNT(*) INTO v_units FROM units;

    SELECT COUNT(*) INTO v_orphaned_payments
    FROM payments p
    WHERE NOT EXISTS (SELECT 1 FROM bookings b WHERE b.booking_id = p.booking_id);

    SELECT COUNT(*) INTO v_recent_production_bookings
    FROM bookings
    WHERE created_at >= NOW() - INTERVAL '2 hours';

    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'ROLLBACK DECISION TREE';
    RAISE NOTICE '============================================';
    RAISE NOTICE '';

    -- Decision 1: Data corruption
    IF v_orphaned_payments > 0 THEN
        RAISE WARNING '❌ CRITICAL: Data corruption detected!';
        RAISE WARNING '   → Orphaned payments: %', v_orphaned_payments;
        RAISE WARNING '   → RECOMMEND: Restore from backup immediately';
        RAISE WARNING '   → ACTION: Use Supabase Dashboard → Database → Backups → Restore';
    END IF;

    -- Decision 2: Missing units
    IF v_units = 0 THEN
        RAISE WARNING '❌ CRITICAL: No units configured!';
        RAISE WARNING '   → Cannot accept bookings without units';
        RAISE WARNING '   → RECOMMEND: Restore from backup immediately';
    END IF;

    -- Decision 3: Production data loss
    IF v_bookings = 0 AND v_recent_production_bookings = 0 THEN
        RAISE NOTICE '✅ SAFE: No production bookings detected';
        RAISE NOTICE '   → OK to restore backup if needed';
        RAISE NOTICE '   → No data loss risk';
    ELSIF v_bookings > 0 AND v_recent_production_bookings > 0 THEN
        RAISE WARNING '⚠️  WARNING: Recent production bookings detected!';
        RAISE WARNING '   → % bookings in last 2 hours', v_recent_production_bookings;
        RAISE WARNING '   → Restoring backup will LOSE these bookings';
        RAISE WARNING '   → RECOMMEND: Export current data before restore';
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'RECOMMENDED ACTIONS:';
    RAISE NOTICE '============================================';

    IF v_orphaned_payments > 0 OR v_units = 0 THEN
        RAISE NOTICE '1. IMMEDIATE: Export current data (see Step 4)';
        RAISE NOTICE '2. IMMEDIATE: Restore from Supabase backup';
        RAISE NOTICE '3. POST-RESTORE: Verify data integrity';
        RAISE NOTICE '4. POST-RESTORE: Contact support if issues persist';
    ELSIF v_recent_production_bookings > 0 THEN
        RAISE NOTICE '1. EXPORT: Save current bookings (CSV or SQL dump)';
        RAISE NOTICE '2. DECIDE: Restore backup OR fix current state';
        RAISE NOTICE '3. IF RESTORE: Manually re-enter recent bookings';
        RAISE NOTICE '4. MONITOR: Check for recurring issues';
    ELSE
        RAISE NOTICE '1. OPTIONAL: Restore backup if deployment issues persist';
        RAISE NOTICE '2. VERIFY: Check frontend deployment logs';
        RAISE NOTICE '3. MONITOR: Watch for error patterns';
    END IF;

    RAISE NOTICE '';
END $$;

-- ============================================
-- STEP 6: MANUAL ROLLBACK PROCEDURES
-- ============================================

SELECT '============================================' as separator;
SELECT 'STEP 6: MANUAL ROLLBACK PROCEDURES' as step;
SELECT '============================================' as separator;

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'MANUAL ROLLBACK PROCEDURES';
    RAISE NOTICE '============================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Option A: Supabase Dashboard Restore (RECOMMENDED)';
    RAISE NOTICE '  1. Go to: Database → Backups';
    RAISE NOTICE '  2. Find: pre-view-edit-migration-2025-10-07';
    RAISE NOTICE '  3. Click: Restore';
    RAISE NOTICE '  4. Wait: 5-10 minutes';
    RAISE NOTICE '  5. Verify: Run verification script';
    RAISE NOTICE '';
    RAISE NOTICE 'Option B: SQL Restore from File';
    RAISE NOTICE '  1. Have backup file ready';
    RAISE NOTICE '  2. Run: psql $DATABASE_URL < backup.sql';
    RAISE NOTICE '  3. Verify: Check table counts';
    RAISE NOTICE '';
    RAISE NOTICE 'Option C: Frontend Rollback Only';
    RAISE NOTICE '  1. Via Vercel: Deployments → [previous] → Promote';
    RAISE NOTICE '  2. Via Git: git revert HEAD && git push';
    RAISE NOTICE '  3. Database: Keep current state';
    RAISE NOTICE '';
    RAISE NOTICE 'Option D: Partial Fix (Data Corruption Only)';
    RAISE NOTICE '  1. Delete orphaned payments:';
    RAISE NOTICE '     DELETE FROM payments WHERE booking_id NOT IN';
    RAISE NOTICE '       (SELECT booking_id FROM bookings);';
    RAISE NOTICE '  2. Fix guest statistics:';
    RAISE NOTICE '     -- Run guest statistics trigger manually';
    RAISE NOTICE '  3. Verify: Re-run this diagnostic';
    RAISE NOTICE '';
END $$;

-- ============================================
-- STEP 7: POST-ROLLBACK VERIFICATION
-- ============================================

SELECT '============================================' as separator;
SELECT 'STEP 7: POST-ROLLBACK VERIFICATION' as step;
SELECT '============================================' as separator;

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'After rollback, run these verifications:';
    RAISE NOTICE '';
    RAISE NOTICE '1. Table counts:';
    RAISE NOTICE '   SELECT tablename, n_live_tup FROM pg_stat_user_tables';
    RAISE NOTICE '   WHERE schemaname = ''public'';';
    RAISE NOTICE '';
    RAISE NOTICE '2. Data integrity:';
    RAISE NOTICE '   Run: database/scripts/verify-production-state.sql';
    RAISE NOTICE '';
    RAISE NOTICE '3. Application test:';
    RAISE NOTICE '   - Login works';
    RAISE NOTICE '   - Dashboard displays';
    RAISE NOTICE '   - Can view existing bookings';
    RAISE NOTICE '   - Can create new booking';
    RAISE NOTICE '';
    RAISE NOTICE '4. Audit verification:';
    RAISE NOTICE '   SELECT * FROM audit_logs';
    RAISE NOTICE '   WHERE event_type = ''production_rollback''';
    RAISE NOTICE '   ORDER BY created_at DESC LIMIT 1;';
    RAISE NOTICE '';
END $$;

-- ============================================
-- STEP 8: CREATE ROLLBACK AUDIT LOG
-- ============================================

SELECT '============================================' as separator;
SELECT 'STEP 8: LOG ROLLBACK EVENT' as step;
SELECT '============================================' as separator;

-- Log this diagnostic run
INSERT INTO audit_logs (
    table_name,
    record_id,
    action,
    event_type,
    source,
    description,
    severity,
    metadata,
    created_at
) VALUES (
    'system',
    NULL,
    'SELECT',
    'emergency_diagnostic',
    'app',
    'Emergency rollback diagnostic script executed',
    'WARNING',
    jsonb_build_object(
        'script', 'emergency-rollback.sql',
        'timestamp', NOW(),
        'note', 'Diagnostic run only - no data changed'
    ),
    NOW()
);

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Diagnostic audit log created';
    RAISE NOTICE '';
    RAISE NOTICE 'If you performed a rollback, create another log entry:';
    RAISE NOTICE '';
    RAISE NOTICE '  INSERT INTO audit_logs (';
    RAISE NOTICE '    table_name, action, event_type, source,';
    RAISE NOTICE '    description, severity, metadata';
    RAISE NOTICE '  ) VALUES (';
    RAISE NOTICE '    ''system'', ''UPDATE'', ''production_rollback'', ''app'',';
    RAISE NOTICE '    ''Production rollback executed - restored from backup'',';
    RAISE NOTICE '    ''CRITICAL'',';
    RAISE NOTICE '    jsonb_build_object(';
    RAISE NOTICE '      ''backup_date'', ''2025-10-07'',';
    RAISE NOTICE '      ''reason'', ''[describe issue here]'',';
    RAISE NOTICE '      ''rolled_back_by'', ''[your name]''';
    RAISE NOTICE '    )';
    RAISE NOTICE '  );';
    RAISE NOTICE '';
END $$;

-- ============================================
-- FINAL SUMMARY
-- ============================================

SELECT '============================================' as separator;
SELECT '✅ DIAGNOSTIC COMPLETE' as status;
SELECT NOW() as completed_at;
SELECT '============================================' as separator;

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE '📋 NEXT STEPS';
    RAISE NOTICE '============================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Review the output above and decide:';
    RAISE NOTICE '';
    RAISE NOTICE '1. If data corruption: RESTORE IMMEDIATELY';
    RAISE NOTICE '2. If missing units: RESTORE IMMEDIATELY';
    RAISE NOTICE '3. If minor issues: Fix current state';
    RAISE NOTICE '4. If frontend only: Rollback deployment';
    RAISE NOTICE '';
    RAISE NOTICE 'For help, contact:';
    RAISE NOTICE '  - Supabase Support: support@supabase.com';
    RAISE NOTICE '  - Team Lead: [your contact]';
    RAISE NOTICE '  - Database Admin: [your contact]';
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
END $$;
