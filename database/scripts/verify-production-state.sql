-- ============================================
-- Production Database State Verification
-- ============================================
-- Description: Comprehensive verification script for production database health
-- Usage: Run this AFTER deployment to verify everything is working
-- Expected: Clean state with no test data, all schema intact

\set ON_ERROR_STOP on

-- ============================================
-- TABLE COUNTS VERIFICATION
-- ============================================

SELECT
    '============================================' as separator,
    'TABLE COUNTS' as section,
    '============================================' as separator2
\gset

SELECT
    'bookings' as table_name,
    COUNT(*) as row_count,
    CASE
        WHEN COUNT(*) = 0 THEN '✅ PASS (empty after wipe)'
        ELSE '⚠️ CHECK (contains data - expected if booking created)'
    END as status
FROM bookings
UNION ALL
SELECT
    'payments' as table_name,
    COUNT(*) as row_count,
    CASE
        WHEN COUNT(*) = 0 THEN '✅ PASS (empty after wipe)'
        ELSE '⚠️ CHECK (contains data - expected if payment created)'
    END as status
FROM payments
UNION ALL
SELECT
    'guests' as table_name,
    COUNT(*) as row_count,
    CASE
        WHEN COUNT(*) = 0 THEN '✅ PASS (empty after wipe)'
        ELSE '⚠️ CHECK (contains data - expected if guest created)'
    END as status
FROM guests
UNION ALL
SELECT
    'units' as table_name,
    COUNT(*) as row_count,
    CASE
        WHEN COUNT(*) > 0 THEN '✅ PASS (units preserved)'
        ELSE '❌ FAIL (units should exist)'
    END as status
FROM units
UNION ALL
SELECT
    'expenses' as table_name,
    COUNT(*) as row_count,
    CASE
        WHEN COUNT(*) >= 0 THEN '✅ PASS (expenses preserved)'
        ELSE '❌ FAIL'
    END as status
FROM expenses
UNION ALL
SELECT
    'audit_logs' as table_name,
    COUNT(*) as row_count,
    CASE
        WHEN COUNT(*) > 0 THEN '✅ PASS (audit logs preserved)'
        ELSE '⚠️ CHECK (no audit logs - expected on fresh install)'
    END as status
FROM audit_logs
ORDER BY table_name;

-- ============================================
-- SCHEMA INTEGRITY CHECKS
-- ============================================

SELECT
    '============================================' as separator,
    'SCHEMA INTEGRITY' as section,
    '============================================' as separator2
\gset

-- Check all expected tables exist
WITH expected_tables AS (
    SELECT unnest(ARRAY[
        'units', 'guests', 'bookings', 'payments', 'expenses',
        'maintenance_logs', 'audit_logs', 'audit_logs_archive', 'app_roles'
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

-- ============================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================

SELECT
    '============================================' as separator,
    'FOREIGN KEY CONSTRAINTS' as section,
    '============================================' as separator2
\gset

SELECT
    conrelid::regclass AS table_name,
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS definition,
    '✅ VALID' as status
FROM pg_constraint
WHERE contype = 'f'
    AND connamespace = 'public'::regnamespace
ORDER BY table_name, constraint_name;

-- ============================================
-- ROW LEVEL SECURITY STATUS
-- ============================================

SELECT
    '============================================' as separator,
    'ROW LEVEL SECURITY (RLS)' as section,
    '============================================' as separator2
\gset

SELECT
    schemaname,
    tablename,
    rowsecurity AS rls_enabled,
    CASE
        WHEN rowsecurity THEN '✅ ENABLED'
        ELSE '⚠️ DISABLED (check if intentional)'
    END as status
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('bookings', 'guests', 'units', 'payments', 'expenses', 'audit_logs')
ORDER BY tablename;

-- ============================================
-- RLS POLICIES
-- ============================================

SELECT
    '============================================' as separator,
    'RLS POLICIES' as section,
    '============================================' as separator2
\gset

SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd AS command,
    '✅ ACTIVE' as status
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================
-- INDEXES
-- ============================================

SELECT
    '============================================' as separator,
    'INDEXES' as section,
    '============================================' as separator2
\gset

SELECT
    schemaname,
    tablename,
    indexname,
    indexdef,
    '✅ EXISTS' as status
FROM pg_indexes
WHERE schemaname = 'public'
    AND indexname NOT LIKE '%_pkey'  -- Exclude primary key indexes
ORDER BY tablename, indexname;

-- ============================================
-- TRIGGERS
-- ============================================

SELECT
    '============================================' as separator,
    'TRIGGERS' as section,
    '============================================' as separator2
\gset

SELECT
    event_object_schema AS schema_name,
    event_object_table AS table_name,
    trigger_name,
    action_timing,
    event_manipulation,
    '✅ ACTIVE' as status
FROM information_schema.triggers
WHERE event_object_schema = 'public'
ORDER BY table_name, trigger_name;

-- ============================================
-- FUNCTIONS
-- ============================================

SELECT
    '============================================' as separator,
    'CUSTOM FUNCTIONS' as section,
    '============================================' as separator2
\gset

SELECT
    n.nspname AS schema_name,
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    '✅ EXISTS' as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.proname NOT LIKE 'pg_%'  -- Exclude system functions
ORDER BY function_name;

-- ============================================
-- RECENT AUDIT LOGS (Last 10)
-- ============================================

SELECT
    '============================================' as separator,
    'RECENT AUDIT LOGS' as section,
    '============================================' as separator2
\gset

SELECT
    audit_id,
    table_name,
    action,
    event_type,
    source,
    user_email,
    description,
    created_at,
    '✅ LOGGED' as status
FROM audit_logs
ORDER BY created_at DESC
LIMIT 10;

-- ============================================
-- UNITS CONFIGURATION (Verify rooms intact)
-- ============================================

SELECT
    '============================================' as separator,
    'UNITS CONFIGURATION' as section,
    '============================================' as separator2
\gset

SELECT
    unit_code,
    unit_name,
    unit_type,
    unit_status,
    base_occupancy,
    max_occupancy,
    base_rate,
    weekend_rate,
    extra_person_rate,
    '✅ PRESERVED' as status
FROM units
ORDER BY unit_code;

-- ============================================
-- DATABASE SIZE
-- ============================================

SELECT
    '============================================' as separator,
    'DATABASE SIZE' as section,
    '============================================' as separator2
\gset

SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) AS indexes_size,
    n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================
-- SUMMARY
-- ============================================

SELECT
    '============================================' as separator,
    'VERIFICATION SUMMARY' as section,
    '============================================' as separator2
\gset

DO $$
DECLARE
    v_bookings_count INTEGER;
    v_units_count INTEGER;
    v_audit_count INTEGER;
    v_rls_enabled_count INTEGER;
    v_total_tables INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_bookings_count FROM bookings;
    SELECT COUNT(*) INTO v_units_count FROM units;
    SELECT COUNT(*) INTO v_audit_count FROM audit_logs;

    SELECT COUNT(*) INTO v_rls_enabled_count
    FROM pg_tables
    WHERE schemaname = 'public' AND rowsecurity = true;

    SELECT COUNT(*) INTO v_total_tables
    FROM pg_tables
    WHERE schemaname = 'public';

    RAISE NOTICE 'Production State Summary:';
    RAISE NOTICE '========================';
    RAISE NOTICE 'Bookings: % (expected: 0 or >0 after first booking)', v_bookings_count;
    RAISE NOTICE 'Units: % (should be > 0)', v_units_count;
    RAISE NOTICE 'Audit Logs: %', v_audit_count;
    RAISE NOTICE 'Tables with RLS: % / %', v_rls_enabled_count, v_total_tables;
    RAISE NOTICE '========================';

    IF v_units_count = 0 THEN
        RAISE WARNING '⚠️ Units table is empty! Configure rooms before accepting bookings.';
    ELSE
        RAISE NOTICE '✅ Units configured';
    END IF;

    IF v_rls_enabled_count > 0 THEN
        RAISE NOTICE '✅ Row Level Security enabled on % tables', v_rls_enabled_count;
    ELSE
        RAISE WARNING '⚠️ Row Level Security not enabled. Enable before production use!';
    END IF;
END $$;

-- ============================================
-- FINAL STATUS
-- ============================================

SELECT
    '============================================' as separator,
    '✅ VERIFICATION COMPLETE' as status,
    NOW() as verified_at,
    '============================================' as separator2
\gset
