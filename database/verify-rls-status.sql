-- ============================================
-- RLS STATUS VERIFICATION SCRIPT
-- ============================================
-- Run this in Supabase SQL Editor to verify Row Level Security status
-- This script is READ-ONLY and makes no changes

-- ============================================
-- 1. CHECK RLS STATUS ON TABLES
-- ============================================
SELECT
    schemaname,
    tablename,
    CASE
        WHEN rowsecurity = true THEN '✅ ENABLED'
        ELSE '❌ DISABLED - ACTION REQUIRED'
    END as rls_status,
    CASE
        WHEN tablename IN ('units', 'guests', 'bookings', 'payments', 'expenses', 'maintenance_logs')
        THEN 'CRITICAL'
        ELSE 'STANDARD'
    END as priority
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN (
        'units',
        'guests',
        'bookings',
        'payments',
        'expenses',
        'maintenance_logs'
    )
ORDER BY
    CASE
        WHEN rowsecurity = false THEN 0
        ELSE 1
    END,
    tablename;

-- ============================================
-- 2. CHECK EXISTING POLICIES
-- ============================================
SELECT
    tablename,
    policyname,
    cmd as operation,
    permissive,
    CASE
        WHEN roles = '{authenticated}' THEN '✅ Authenticated Users'
        WHEN roles = '{anon}' THEN '⚠️  Anonymous Users'
        ELSE roles::text
    END as applies_to
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN (
        'units',
        'guests',
        'bookings',
        'payments',
        'expenses',
        'maintenance_logs'
    )
ORDER BY tablename, cmd;

-- ============================================
-- 3. CHECK STORAGE BUCKET POLICIES
-- ============================================
SELECT
    name as bucket_name,
    CASE
        WHEN public = true THEN '⚠️  PUBLIC'
        ELSE '✅ PRIVATE'
    END as access_level,
    created_at,
    updated_at
FROM storage.buckets
WHERE name IN ('payment-proofs', 'receipts')
ORDER BY name;

-- ============================================
-- 4. COUNT POLICIES PER TABLE
-- ============================================
SELECT
    tablename,
    COUNT(*) as policy_count,
    CASE
        WHEN COUNT(*) = 0 THEN '❌ NO POLICIES - RLS NOT CONFIGURED'
        WHEN COUNT(*) < 4 THEN '⚠️  PARTIAL POLICIES - CHECK CONFIGURATION'
        ELSE '✅ POLICIES CONFIGURED'
    END as policy_status
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN (
        'units',
        'guests',
        'bookings',
        'payments',
        'expenses',
        'maintenance_logs'
    )
GROUP BY tablename

UNION ALL

SELECT
    tablename,
    0 as policy_count,
    '❌ NO POLICIES - TABLE NOT PROTECTED' as policy_status
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN (
        'units',
        'guests',
        'bookings',
        'payments',
        'expenses',
        'maintenance_logs'
    )
    AND tablename NOT IN (
        SELECT DISTINCT tablename
        FROM pg_policies
        WHERE schemaname = 'public'
    )
ORDER BY
    CASE
        WHEN policy_count = 0 THEN 0
        ELSE 1
    END,
    tablename;

-- ============================================
-- 5. SECURITY SUMMARY
-- ============================================
SELECT
    'RLS SECURITY STATUS' as check_type,
    CASE
        WHEN (
            SELECT COUNT(*)
            FROM pg_tables
            WHERE schemaname = 'public'
                AND rowsecurity = false
                AND tablename IN (
                    'units', 'guests', 'bookings',
                    'payments', 'expenses', 'maintenance_logs'
                )
        ) > 0
        THEN '❌ CRITICAL - RLS NOT ENABLED ON ALL TABLES'
        ELSE '✅ RLS ENABLED ON ALL CRITICAL TABLES'
    END as status,
    CURRENT_TIMESTAMP as checked_at;

-- ============================================
-- ACTION REQUIRED MESSAGE
-- ============================================
SELECT
    E'\n' ||
    '========================================' || E'\n' ||
    'ACTION REQUIRED IF ANY ❌ APPEARS ABOVE:' || E'\n' ||
    '========================================' || E'\n' ||
    '1. Run the file: /database/enable-rls.sql' || E'\n' ||
    '2. Re-run this verification script' || E'\n' ||
    '3. All items should show ✅ before deployment' || E'\n' ||
    '========================================' as instructions;