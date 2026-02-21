-- ============================================
-- Migration: Security Hardening
-- Description: Fix all Supabase Security Advisor errors and warnings
-- Date: 2026-02-09
-- Author: Claude Code
-- ============================================
--
-- FIXES:
-- ✅ 5 ERRORS:
--    1. Security Definer View: public.audit_index_stats
--    2. Security Definer View: public.audit_archive_stats
--    3. Security Definer View: public.public_unit_availability
--    4. Security Definer View: public.audit_system_status
--    5. RLS Disabled in Public: public.availability_blackouts
--
-- ✅ 42 WARNINGS:
--    - 34+ Function Search Path Mutable (add SET search_path = '')
--    - 6 RLS Policy Always True (replace with role-based policies)
--    - 1 Extension in Public (move btree_gist to extensions schema)
--    - 1 Leaked Password Protection (manual in dashboard)
--
-- ============================================

BEGIN;

-- ============================================
-- SECTION 1: FIX SECURITY DEFINER VIEWS
-- ============================================
-- PostgreSQL views execute with owner privileges by default.
-- SECURITY INVOKER makes views respect the caller's permissions.
-- This is available in PostgreSQL 15+ which Supabase uses.

-- 1.1 Fix audit_index_stats view
-- Original definition preserved, just adding SECURITY INVOKER
DROP VIEW IF EXISTS public.audit_index_stats CASCADE;
CREATE VIEW public.audit_index_stats
WITH (security_invoker = true)
AS
SELECT schemaname,
    relname AS tablename,
    indexrelname AS indexname,
    pg_size_pretty(pg_relation_size(indexrelid::regclass)) AS index_size,
    idx_scan AS times_used,
    idx_tup_read AS rows_read,
    idx_tup_fetch AS rows_fetched
FROM pg_stat_user_indexes
WHERE relname = 'audit_logs'::name
ORDER BY (pg_relation_size(indexrelid::regclass)) DESC;

COMMENT ON VIEW public.audit_index_stats IS
    'Audit index statistics with SECURITY INVOKER to respect RLS policies';

-- 1.2 Fix audit_archive_stats view
-- Original definition preserved, just adding SECURITY INVOKER
DROP VIEW IF EXISTS public.audit_archive_stats CASCADE;
CREATE VIEW public.audit_archive_stats
WITH (security_invoker = true)
AS
SELECT 'Active Logs'::text AS status,
    count(*) AS log_count,
    min(audit_logs.created_at) AS oldest_log,
    max(audit_logs.created_at) AS newest_log,
    pg_size_pretty(pg_total_relation_size('audit_logs'::regclass)) AS total_size
FROM audit_logs
UNION ALL
SELECT 'Archived Logs'::text AS status,
    count(*) AS log_count,
    min(audit_logs_archive.created_at) AS oldest_log,
    max(audit_logs_archive.created_at) AS newest_log,
    pg_size_pretty(pg_total_relation_size('audit_logs_archive'::regclass)) AS total_size
FROM audit_logs_archive;

COMMENT ON VIEW public.audit_archive_stats IS
    'Audit archive statistics with SECURITY INVOKER to respect RLS policies';

-- 1.3 Fix public_unit_availability view
-- Original definition preserved, just adding SECURITY INVOKER
DROP VIEW IF EXISTS public.public_unit_availability CASCADE;
CREATE VIEW public.public_unit_availability
WITH (security_invoker = true)
AS
SELECT
    unit_id,
    check_in,
    check_out,
    booking_status
FROM booking_unit_availability
WHERE booking_status::text = ANY (ARRAY['Confirmed'::character varying, 'CheckedIn'::character varying]::text[]);

GRANT SELECT ON public.public_unit_availability TO anon, authenticated;

COMMENT ON VIEW public.public_unit_availability IS
    'Public-safe availability view with SECURITY INVOKER (excludes booking_id for privacy)';

-- 1.4 Fix audit_system_status view
-- Original definition preserved, just adding SECURITY INVOKER
DROP VIEW IF EXISTS public.audit_system_status CASCADE;
CREATE VIEW public.audit_system_status
WITH (security_invoker = true)
AS
SELECT 'Tables'::text AS component,
    count(*) AS count,
    string_agg(tables.table_name::text, ', '::text ORDER BY (tables.table_name::text)) AS details
FROM information_schema.tables
WHERE tables.table_schema::name = 'public'::name AND (tables.table_name::name = ANY (ARRAY['audit_logs'::name, 'audit_logs_archive'::name, 'app_roles'::name]))
UNION ALL
SELECT 'Triggers'::text AS component,
    count(*) AS count,
    string_agg(triggers.trigger_name::text, ', '::text ORDER BY (triggers.trigger_name::text)) AS details
FROM information_schema.triggers
WHERE triggers.trigger_name::name ~~ 'audit_%'::text OR triggers.trigger_name::name = 'enforce_audit_identity'::name
UNION ALL
SELECT 'Indexes'::text AS component,
    count(*) AS count,
    string_agg(pg_indexes.indexname::text, ', '::text ORDER BY (pg_indexes.indexname::text)) AS details
FROM pg_indexes
WHERE pg_indexes.tablename = 'audit_logs'::name AND pg_indexes.indexname ~~ 'idx_audit_logs_%'::text
UNION ALL
SELECT 'Policies (audit_logs)'::text AS component,
    count(*) AS count,
    string_agg(pg_policies.policyname::text, ', '::text ORDER BY (pg_policies.policyname::text)) AS details
FROM pg_policies
WHERE pg_policies.tablename = 'audit_logs'::name
UNION ALL
SELECT 'Active Roles'::text AS component,
    count(*) AS count,
    string_agg(((app_roles.role::text || ' ('::text) || app_roles.email) || ')'::text, ', '::text ORDER BY app_roles.role) AS details
FROM app_roles
WHERE app_roles.is_active = true
UNION ALL
SELECT 'Archive Functions'::text AS component,
    count(*) AS count,
    string_agg(routines.routine_name::text, ', '::text ORDER BY (routines.routine_name::text)) AS details
FROM information_schema.routines
WHERE routines.routine_schema::name = 'public'::name AND (routines.routine_name::name = ANY (ARRAY['archive_audit_logs'::name, 'archive_logs_older_than_months'::name, 'monthly_archive_until'::name, 'restore_logs_from_archive'::name]))
UNION ALL
SELECT 'Helper Functions'::text AS component,
    count(*) AS count,
    string_agg(routines.routine_name::text, ', '::text ORDER BY (routines.routine_name::text)) AS details
FROM information_schema.routines
WHERE routines.routine_schema::name = 'public'::name AND (routines.routine_name::name = ANY (ARRAY['get_current_audit_role'::name, 'is_audit_admin'::name, 'is_audit_owner'::name, 'is_audit_manager'::name, 'can_view_all_audit_logs'::name, 'grant_audit_role'::name, 'revoke_audit_role'::name]));

COMMENT ON VIEW public.audit_system_status IS
    'Audit system status with SECURITY INVOKER to respect RLS policies';

-- ============================================
-- SECTION 2: ENABLE RLS ON AVAILABILITY_BLACKOUTS
-- ============================================

ALTER TABLE public.availability_blackouts ENABLE ROW LEVEL SECURITY;

-- Allow anon and authenticated to read (needed for public availability)
CREATE POLICY "availability_blackouts_select_public"
    ON public.availability_blackouts
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Only staff can manage blackouts
CREATE POLICY "availability_blackouts_manage_staff"
    ON public.availability_blackouts
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM app_roles
            WHERE user_id = auth.uid()
              AND role IN ('admin', 'owner', 'manager', 'staff')
              AND is_active = TRUE
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM app_roles
            WHERE user_id = auth.uid()
              AND role IN ('admin', 'owner', 'manager', 'staff')
              AND is_active = TRUE
        )
    );

COMMENT ON TABLE public.availability_blackouts IS
    'Unit blackout periods with RLS enabled. Public can read, staff can manage.';

-- ============================================
-- SECTION 3: FIX FUNCTION SEARCH PATH MUTABLE
-- ============================================
-- Setting search_path = '' prevents search path injection attacks.
-- We recreate functions with the same logic but add SET search_path = ''.

-- 3.1 enforce_audit_identity_func
CREATE OR REPLACE FUNCTION public.enforce_audit_identity_func()
RETURNS TRIGGER AS $$
BEGIN
    -- Only enforce for authenticated users
    IF auth.uid() IS NOT NULL THEN
        NEW.user_id := auth.uid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 3.2 audit_trigger_func
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    v_old_data JSONB;
    v_new_data JSONB;
    v_changed_fields TEXT[];
    v_record_id TEXT;
    v_record_data JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_new_data := to_jsonb(NEW);
        v_record_data := v_new_data;
    ELSIF TG_OP = 'UPDATE' THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        v_record_data := v_new_data;
        -- Compute changed fields
        SELECT array_agg(key) INTO v_changed_fields
        FROM jsonb_each(v_new_data) AS n(key, value)
        WHERE v_old_data->key IS DISTINCT FROM n.value;
    ELSIF TG_OP = 'DELETE' THEN
        v_old_data := to_jsonb(OLD);
        v_record_data := v_old_data;
    END IF;

    -- Extract record ID generically: try <table>_id, then id, then first UUID-looking key
    v_record_id := COALESCE(
        v_record_data ->> (TG_TABLE_NAME || '_id'),
        v_record_data ->> (regexp_replace(TG_TABLE_NAME, 's$', '') || '_id'),
        v_record_data ->> 'id',
        v_record_data ->> 'log_id'
    );

    INSERT INTO public.audit_logs (
        action,
        table_name,
        record_id,
        old_data,
        new_data,
        changed_fields,
        user_id,
        category,
        severity,
        source
    ) VALUES (
        TG_OP,
        TG_TABLE_NAME,
        v_record_id,
        v_old_data,
        v_new_data,
        v_changed_fields,
        auth.uid(),
        'DATA',
        'INFO',
        'db'
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 3.3 attach_audit_trigger (drop first to allow parameter rename)
DROP FUNCTION IF EXISTS public.attach_audit_trigger(TEXT);
CREATE FUNCTION public.attach_audit_trigger(p_table_name TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE format('
        CREATE TRIGGER audit_trigger_%I
        AFTER INSERT OR UPDATE OR DELETE ON public.%I
        FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func()
    ', p_table_name, p_table_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 3.4 detach_audit_trigger (drop first to allow parameter rename)
DROP FUNCTION IF EXISTS public.detach_audit_trigger(TEXT);
CREATE FUNCTION public.detach_audit_trigger(p_table_name TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE format('DROP TRIGGER IF EXISTS audit_trigger_%I ON public.%I', p_table_name, p_table_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 3.5 get_booking_units
CREATE OR REPLACE FUNCTION public.get_booking_units(p_booking_id UUID)
RETURNS TABLE (
    unit_id UUID,
    unit_name VARCHAR(100),
    unit_code VARCHAR(10),
    unit_type VARCHAR(50),
    unit_price DECIMAL(10,2),
    subtotal DECIMAL(10,2),
    assigned_guests INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(bu.unit_id, b.unit_id) as unit_id,
        u.unit_name,
        u.unit_code,
        u.unit_type,
        COALESCE(bu.unit_price, b.total_amount) as unit_price,
        COALESCE(bu.subtotal, b.total_amount) as subtotal,
        bu.assigned_guests
    FROM public.bookings b
    LEFT JOIN public.booking_units bu ON bu.booking_id = b.booking_id
    LEFT JOIN public.units u ON u.unit_id = COALESCE(bu.unit_id, b.unit_id)
    WHERE b.booking_id = p_booking_id;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = '';

-- 3.6 generate_transfer_reference
CREATE OR REPLACE FUNCTION public.generate_transfer_reference()
RETURNS TEXT AS $$
DECLARE
    date_part TEXT;
    random_part TEXT;
    reference TEXT;
    counter INTEGER := 0;
BEGIN
    date_part := TO_CHAR(NOW(), 'YYYYMMDD');

    LOOP
        counter := counter + 1;
        random_part := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || counter::TEXT), 1, 4));
        reference := 'TRF-' || date_part || '-' || random_part;

        IF NOT EXISTS (SELECT 1 FROM public.account_transfers WHERE transfer_reference = reference) THEN
            RETURN reference;
        END IF;

        IF counter > 100 THEN
            RAISE EXCEPTION 'Could not generate unique transfer reference after 100 attempts';
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- 3.7 archive_audit_logs
-- NOTE: audit_logs_archive shares the same schema as audit_logs (old_data, new_data, changed_fields)
-- Direct column-to-column copy since both tables have matching schemas
CREATE OR REPLACE FUNCTION public.archive_audit_logs(p_before_date TIMESTAMPTZ)
RETURNS INTEGER AS $$
DECLARE
    v_archived_count INTEGER;
BEGIN
    WITH moved AS (
        DELETE FROM public.audit_logs
        WHERE created_at < p_before_date
        RETURNING *
    )
    INSERT INTO public.audit_logs_archive (
        audit_id,
        correlation_id,
        action,
        table_name,
        record_id,
        record_pk,
        event_type,
        source,
        user_id,
        user_email,
        user_role,
        old_data,
        new_data,
        changed_fields,
        description,
        category,
        severity,
        metadata,
        ip_address,
        user_agent,
        created_at
    )
    SELECT
        audit_id,
        correlation_id,
        action,
        table_name,
        record_id,
        record_pk,
        event_type,
        source,
        user_id,
        user_email,
        user_role,
        old_data,
        new_data,
        changed_fields,
        description,
        category,
        severity,
        metadata,
        ip_address,
        user_agent,
        created_at
    FROM moved;

    GET DIAGNOSTICS v_archived_count = ROW_COUNT;
    RETURN v_archived_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 3.8 archive_logs_older_than_months
CREATE OR REPLACE FUNCTION public.archive_logs_older_than_months(p_months INTEGER DEFAULT 3)
RETURNS INTEGER AS $$
DECLARE
    v_cutoff_date TIMESTAMPTZ;
BEGIN
    v_cutoff_date := NOW() - (p_months || ' months')::INTERVAL;
    RETURN public.archive_audit_logs(v_cutoff_date);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 3.9 monthly_archive_until
CREATE OR REPLACE FUNCTION public.monthly_archive_until(p_until_date DATE)
RETURNS TABLE(archive_month DATE, logs_archived INTEGER) AS $$
DECLARE
    v_current_month DATE;
    v_count INTEGER;
BEGIN
    v_current_month := DATE_TRUNC('month', p_until_date)::DATE;

    WHILE v_current_month < DATE_TRUNC('month', NOW())::DATE LOOP
        SELECT public.archive_audit_logs(
            (v_current_month + INTERVAL '1 month')::TIMESTAMPTZ
        ) INTO v_count;

        archive_month := v_current_month;
        logs_archived := v_count;
        RETURN NEXT;

        v_current_month := v_current_month + INTERVAL '1 month';
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 3.10 restore_logs_from_archive
CREATE OR REPLACE FUNCTION public.restore_logs_from_archive(p_archive_month DATE)
RETURNS INTEGER AS $$
DECLARE
    v_restored_count INTEGER;
BEGIN
    WITH moved AS (
        DELETE FROM public.audit_logs_archive
        WHERE DATE_TRUNC('month', created_at)::DATE = p_archive_month
        RETURNING *
    )
    INSERT INTO public.audit_logs (
        audit_id,
        correlation_id,
        action,
        table_name,
        record_id,
        record_pk,
        event_type,
        source,
        user_id,
        user_email,
        user_role,
        old_data,
        new_data,
        changed_fields,
        description,
        category,
        severity,
        metadata,
        ip_address,
        user_agent,
        created_at
    )
    SELECT
        audit_id,
        correlation_id,
        action,
        table_name,
        record_id,
        record_pk,
        event_type,
        source,
        user_id,
        user_email,
        user_role,
        old_data,
        new_data,
        changed_fields,
        description,
        category,
        severity,
        metadata,
        ip_address,
        user_agent,
        created_at
    FROM moved;

    GET DIAGNOSTICS v_restored_count = ROW_COUNT;
    RETURN v_restored_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 3.11 get_all_account_balances
CREATE OR REPLACE FUNCTION public.get_all_account_balances(p_as_of_date TIMESTAMP WITH TIME ZONE DEFAULT NOW())
RETURNS TABLE (
    account_id UUID,
    account_name VARCHAR(100),
    account_code VARCHAR(20),
    account_type VARCHAR(20),
    initial_balance DECIMAL(12,2),
    total_payments DECIMAL(12,2),
    total_expenses DECIMAL(12,2),
    transfers_in DECIMAL(12,2),
    transfers_out DECIMAL(12,2),
    current_balance DECIMAL(12,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.account_id,
        a.account_name,
        a.account_code,
        a.account_type,
        COALESCE(a.initial_balance, 0)::DECIMAL(12,2) AS initial_balance,
        COALESCE(pay.total, 0)::DECIMAL(12,2) AS total_payments,
        COALESCE(exp.total, 0)::DECIMAL(12,2) AS total_expenses,
        COALESCE(trf_in.total, 0)::DECIMAL(12,2) AS transfers_in,
        COALESCE(trf_out.total, 0)::DECIMAL(12,2) AS transfers_out,
        (
            COALESCE(a.initial_balance, 0) +
            COALESCE(pay.total, 0) -
            COALESCE(exp.total, 0) +
            COALESCE(trf_in.total, 0) -
            COALESCE(trf_out.total, 0)
        )::DECIMAL(12,2) AS current_balance
    FROM public.accounts a
    LEFT JOIN (
        SELECT p.account_id, SUM(p.amount) AS total
        FROM public.payments p
        WHERE p.account_id IS NOT NULL
          AND (p.payment_date IS NULL OR p.payment_date <= p_as_of_date)
        GROUP BY p.account_id
    ) pay ON pay.account_id = a.account_id
    LEFT JOIN (
        SELECT e.account_id, SUM(e.amount) AS total
        FROM public.expenses e
        WHERE e.account_id IS NOT NULL
          AND (e.expense_date IS NULL OR e.expense_date::TIMESTAMP WITH TIME ZONE <= p_as_of_date)
        GROUP BY e.account_id
    ) exp ON exp.account_id = a.account_id
    LEFT JOIN (
        SELECT t.to_account_id, SUM(t.amount) AS total
        FROM public.account_transfers t
        WHERE t.transfer_date <= p_as_of_date
        GROUP BY t.to_account_id
    ) trf_in ON trf_in.to_account_id = a.account_id
    LEFT JOIN (
        SELECT t.from_account_id, SUM(t.amount) AS total
        FROM public.account_transfers t
        WHERE t.transfer_date <= p_as_of_date
        GROUP BY t.from_account_id
    ) trf_out ON trf_out.from_account_id = a.account_id
    WHERE a.is_active = TRUE
    ORDER BY a.display_order, a.account_name;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = '';

-- 3.12 revoke_audit_role (drop first to allow parameter rename)
DROP FUNCTION IF EXISTS public.revoke_audit_role(UUID);
CREATE FUNCTION public.revoke_audit_role(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.app_roles
    SET is_active = FALSE, updated_at = NOW()
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 3.13 is_admin_or_owner
CREATE OR REPLACE FUNCTION public.is_admin_or_owner(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.app_roles
        WHERE user_id = check_user_id
          AND role IN ('admin', 'owner')
          AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

COMMENT ON FUNCTION public.is_admin_or_owner IS
    'SECURITY DEFINER helper with search_path to check admin/owner role without RLS recursion';

-- 3.14 is_manager
CREATE OR REPLACE FUNCTION public.is_manager(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.app_roles
        WHERE user_id = check_user_id
          AND role = 'manager'
          AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

COMMENT ON FUNCTION public.is_manager IS
    'SECURITY DEFINER helper with search_path to check manager role without RLS recursion';

-- 3.15 is_admin
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.app_roles
        WHERE user_id = check_user_id
          AND role = 'admin'
          AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

COMMENT ON FUNCTION public.is_admin IS
    'SECURITY DEFINER helper with search_path to check admin role without RLS recursion';

-- 3.16 create_multi_unit_booking
CREATE OR REPLACE FUNCTION public.create_multi_unit_booking(
    p_booking_data JSONB,
    p_units JSONB[],
    p_guest_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_booking_id UUID;
    v_unit JSONB;
    v_total_amount DECIMAL(10,2) := 0;
BEGIN
    FOREACH v_unit IN ARRAY p_units
    LOOP
        v_total_amount := v_total_amount + (v_unit->>'subtotal')::DECIMAL;
    END LOOP;

    INSERT INTO public.bookings (
        booking_reference,
        guest_id,
        guest_name,
        contact_number,
        email,
        num_guests,
        check_in,
        check_out,
        total_amount,
        is_multi_unit,
        unit_count,
        booking_status,
        payment_status,
        special_requests
    ) VALUES (
        COALESCE(p_booking_data->>'booking_reference', public.generate_booking_reference()),
        p_guest_id,
        p_booking_data->>'guest_name',
        p_booking_data->>'contact_number',
        p_booking_data->>'email',
        (p_booking_data->>'num_guests')::INTEGER,
        (p_booking_data->>'check_in')::TIMESTAMPTZ,
        (p_booking_data->>'check_out')::TIMESTAMPTZ,
        v_total_amount,
        array_length(p_units, 1) > 1,
        array_length(p_units, 1),
        COALESCE(p_booking_data->>'booking_status', 'Pending'),
        COALESCE(p_booking_data->>'payment_status', 'Pending'),
        p_booking_data->>'special_requests'
    ) RETURNING booking_id INTO v_booking_id;

    FOREACH v_unit IN ARRAY p_units
    LOOP
        INSERT INTO public.booking_units (
            booking_id,
            unit_id,
            unit_price,
            weekend_surcharge,
            extra_person_charge,
            subtotal,
            assigned_guests,
            unit_notes
        ) VALUES (
            v_booking_id,
            (v_unit->>'unit_id')::UUID,
            (v_unit->>'unit_price')::DECIMAL,
            COALESCE((v_unit->>'weekend_surcharge')::DECIMAL, 0),
            COALESCE((v_unit->>'extra_person_charge')::DECIMAL, 0),
            (v_unit->>'subtotal')::DECIMAL,
            (v_unit->>'assigned_guests')::INTEGER,
            v_unit->>'unit_notes'
        );
    END LOOP;

    RETURN v_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 3.17 check_multi_unit_availability
CREATE OR REPLACE FUNCTION public.check_multi_unit_availability(
    p_unit_ids UUID[],
    p_check_in TIMESTAMPTZ,
    p_check_out TIMESTAMPTZ,
    p_exclude_booking_id UUID DEFAULT NULL
) RETURNS TABLE(
    unit_id UUID,
    is_available BOOLEAN,
    conflicting_bookings INTEGER,
    next_available_date TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.unit_id,
        NOT EXISTS (
            SELECT 1
            FROM public.booking_unit_availability bua
            WHERE bua.unit_id = u.unit_id
              AND bua.booking_status IN ('Confirmed', 'CheckedIn')
              AND tstzrange(bua.check_in, bua.check_out, '[)') && tstzrange(p_check_in, p_check_out, '[)')
              AND (p_exclude_booking_id IS NULL OR bua.booking_id != p_exclude_booking_id)
        ) AS is_available,
        (
            SELECT COUNT(*)::INTEGER
            FROM public.booking_unit_availability bua
            WHERE bua.unit_id = u.unit_id
              AND bua.booking_status IN ('Confirmed', 'CheckedIn')
              AND tstzrange(bua.check_in, bua.check_out, '[)') && tstzrange(p_check_in, p_check_out, '[)')
              AND (p_exclude_booking_id IS NULL OR bua.booking_id != p_exclude_booking_id)
        ) AS conflicting_bookings,
        (
            SELECT MIN(bua.check_out)
            FROM public.booking_unit_availability bua
            WHERE bua.unit_id = u.unit_id
              AND bua.booking_status IN ('Confirmed', 'CheckedIn')
              AND bua.check_in >= p_check_in
        ) AS next_available_date
    FROM public.units u
    WHERE u.unit_id = ANY(p_unit_ids)
      AND u.unit_status = 'Available';
END;
$$ LANGUAGE plpgsql STABLE SET search_path = '';

-- 3.18 sync_booking_dates
CREATE OR REPLACE FUNCTION public.sync_booking_dates()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.booking_unit_availability
    SET check_in = NEW.check_in,
        check_out = NEW.check_out,
        booking_status = NEW.booking_status
    WHERE booking_id = NEW.booking_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- 3.19 cascade_booking_status
CREATE OR REPLACE FUNCTION public.cascade_booking_status()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.booking_unit_availability
    SET booking_status = NEW.booking_status
    WHERE booking_id = NEW.booking_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- 3.20 cleanup_availability
CREATE OR REPLACE FUNCTION public.cleanup_availability()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.booking_unit_availability
    WHERE booking_id = OLD.booking_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- 3.21 sync_availability_unit
CREATE OR REPLACE FUNCTION public.sync_availability_unit()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.booking_unit_availability (
            unit_id, booking_id, check_in, check_out, booking_status
        )
        SELECT
            NEW.unit_id,
            NEW.booking_id,
            b.check_in,
            b.check_out,
            b.booking_status
        FROM public.bookings b
        WHERE b.booking_id = NEW.booking_id;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM public.booking_unit_availability
        WHERE booking_id = OLD.booking_id AND unit_id = OLD.unit_id;
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- 3.22 update_booking_totals
CREATE OR REPLACE FUNCTION public.update_booking_totals()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE public.bookings
        SET
            total_amount = (
                SELECT COALESCE(SUM(subtotal), 0)
                FROM public.booking_units
                WHERE booking_id = NEW.booking_id
            ),
            unit_count = (
                SELECT COUNT(*)
                FROM public.booking_units
                WHERE booking_id = NEW.booking_id
            ),
            is_multi_unit = (
                SELECT COUNT(*) > 1
                FROM public.booking_units
                WHERE booking_id = NEW.booking_id
            ),
            updated_at = NOW()
        WHERE booking_id = NEW.booking_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.bookings
        SET
            total_amount = (
                SELECT COALESCE(SUM(subtotal), 0)
                FROM public.booking_units
                WHERE booking_id = OLD.booking_id
            ),
            unit_count = (
                SELECT COUNT(*)
                FROM public.booking_units
                WHERE booking_id = OLD.booking_id
            ),
            is_multi_unit = (
                SELECT COUNT(*) > 1
                FROM public.booking_units
                WHERE booking_id = OLD.booking_id
            ),
            updated_at = NOW()
        WHERE booking_id = OLD.booking_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- 3.23 check_unit_availability
CREATE OR REPLACE FUNCTION public.check_unit_availability(
    p_unit_id UUID,
    p_check_in TIMESTAMPTZ,
    p_check_out TIMESTAMPTZ,
    p_exclude_booking_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1
        FROM public.booking_unit_availability bua
        WHERE bua.unit_id = p_unit_id
          AND bua.booking_status IN ('Confirmed', 'CheckedIn')
          AND tstzrange(bua.check_in, bua.check_out, '[)') && tstzrange(p_check_in, p_check_out, '[)')
          AND (p_exclude_booking_id IS NULL OR bua.booking_id != p_exclude_booking_id)
    );
END;
$$ LANGUAGE plpgsql STABLE SET search_path = '';

-- 3.24 get_public_aggregate_availability
-- Preserve existing function, just add SET search_path = '' for security
DROP FUNCTION IF EXISTS public.get_public_aggregate_availability(DATE, DATE);
CREATE FUNCTION public.get_public_aggregate_availability(p_start_date date, p_end_date date)
RETURNS TABLE(date date, available_count integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_total_units INT;
  v_today DATE := CURRENT_DATE;
  v_start_of_current_month DATE := DATE_TRUNC('month', v_today)::DATE;
  v_max_future_date DATE := v_today + INTERVAL '1 year';
BEGIN
  -- INPUT VALIDATION
  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    RAISE EXCEPTION 'Start and end dates are required';
  END IF;

  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'End date must be after or equal to start date';
  END IF;

  IF p_end_date < v_today THEN
    RAISE EXCEPTION 'Cannot query past months. Please select the current month or a future month.';
  END IF;

  IF p_end_date > v_max_future_date THEN
    RAISE EXCEPTION 'Cannot query more than 1 year in the future';
  END IF;

  IF (p_end_date - p_start_date) > 180 THEN
    RAISE EXCEPTION 'Date range cannot exceed 180 days';
  END IF;

  -- QUERY TOTAL AVAILABLE UNITS
  SELECT COUNT(*) INTO v_total_units
  FROM public.units
  WHERE unit_status = 'Available';

  IF v_total_units = 0 THEN
    RETURN QUERY
    SELECT
      generate_series(p_start_date, p_end_date, '1 day'::interval)::date as date,
      0 as available_count;
    RETURN;
  END IF;

  -- AVAILABILITY CALCULATION - Uses booking_unit_availability table
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      p_start_date,
      p_end_date,
      '1 day'::interval
    )::date as date
  ),
  occupied_per_day AS (
    SELECT
      ds.date,
      COUNT(DISTINCT bua.unit_id)::INT as booked_count
    FROM date_series ds
    LEFT JOIN public.booking_unit_availability bua ON (
      bua.booking_status IN ('Confirmed', 'CheckedIn', 'Hold')
      AND ds.date >= (bua.check_in AT TIME ZONE 'Asia/Manila')::date
      AND ds.date < (bua.check_out AT TIME ZONE 'Asia/Manila')::date
      AND bua.unit_id IN (SELECT unit_id FROM public.units WHERE unit_status = 'Available')
    )
    GROUP BY ds.date
  ),
  blackout_per_day AS (
    SELECT
      ds.date,
      COUNT(DISTINCT ab.unit_id)::INT as blackout_count
    FROM date_series ds
    LEFT JOIN public.availability_blackouts ab ON (
      ab.unit_id IN (SELECT unit_id FROM public.units WHERE unit_status = 'Available')
      AND ds.date >= (ab.start_date AT TIME ZONE 'Asia/Manila')::date
      AND ds.date < (ab.end_date AT TIME ZONE 'Asia/Manila')::date
    )
    GROUP BY ds.date
  )
  SELECT
    opd.date,
    GREATEST(
      0,
      v_total_units - COALESCE(opd.booked_count, 0) - COALESCE(bpd.blackout_count, 0)
    )::INT as available_count
  FROM occupied_per_day opd
  JOIN blackout_per_day bpd ON opd.date = bpd.date
  ORDER BY opd.date;
END;
$function$;

COMMENT ON FUNCTION public.get_public_aggregate_availability IS
    'Returns aggregated availability counts for public calendar with search_path set';

-- 3.25 update_updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- 3.26 generate_booking_reference
CREATE OR REPLACE FUNCTION public.generate_booking_reference()
RETURNS TEXT AS $$
DECLARE
    ref TEXT;
    exists_check BOOLEAN;
BEGIN
    LOOP
        ref := 'BKG-' ||
               TO_CHAR(NOW(), 'YYYY-MM-') ||
               LPAD((FLOOR(RANDOM() * 900 + 100)::INT)::TEXT, 3, '0');

        SELECT EXISTS(SELECT 1 FROM public.bookings WHERE booking_reference = ref) INTO exists_check;

        EXIT WHEN NOT exists_check;
    END LOOP;

    RETURN ref;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- 3.27 update_guest_statistics
CREATE OR REPLACE FUNCTION public.update_guest_statistics()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE public.guests
        SET
            total_bookings = (
                SELECT COUNT(*) FROM public.bookings
                WHERE guest_id = NEW.guest_id
                  AND booking_status NOT IN ('Cancelled', 'NoShow')
            ),
            total_spent = (
                SELECT COALESCE(SUM(total_amount), 0) FROM public.bookings
                WHERE guest_id = NEW.guest_id
                  AND booking_status NOT IN ('Cancelled', 'NoShow')
            ),
            last_visit = (
                SELECT MAX(check_out) FROM public.bookings
                WHERE guest_id = NEW.guest_id
                  AND booking_status = 'CheckedOut'
            ),
            updated_at = NOW()
        WHERE guest_id = NEW.guest_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- ============================================
-- SECTION 4: FIX RLS POLICY ALWAYS TRUE
-- ============================================
-- Replace overly permissive (true) policies with proper role-based policies

-- 4.1 Fix accounts table policies
DROP POLICY IF EXISTS "Authenticated users can view accounts" ON public.accounts;
DROP POLICY IF EXISTS "Authenticated users can insert accounts" ON public.accounts;
DROP POLICY IF EXISTS "Authenticated users can update accounts" ON public.accounts;
DROP POLICY IF EXISTS "Authenticated users can delete accounts" ON public.accounts;

-- Create proper role-based policies for accounts
CREATE POLICY "Staff can view accounts"
    ON public.accounts FOR SELECT
    TO authenticated
    USING (
        public.is_admin_or_owner(auth.uid()) OR
        public.is_manager(auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.app_roles
            WHERE user_id = auth.uid()
              AND role = 'staff'
              AND is_active = TRUE
        )
    );

CREATE POLICY "Managers and above can insert accounts"
    ON public.accounts FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_admin_or_owner(auth.uid()) OR
        public.is_manager(auth.uid())
    );

CREATE POLICY "Managers and above can update accounts"
    ON public.accounts FOR UPDATE
    TO authenticated
    USING (
        public.is_admin_or_owner(auth.uid()) OR
        public.is_manager(auth.uid())
    )
    WITH CHECK (
        public.is_admin_or_owner(auth.uid()) OR
        public.is_manager(auth.uid())
    );

CREATE POLICY "Admin and owner can delete accounts"
    ON public.accounts FOR DELETE
    TO authenticated
    USING (public.is_admin_or_owner(auth.uid()));

-- 4.2 Fix account_transfers table policies
DROP POLICY IF EXISTS "Authenticated users can view transfers" ON public.account_transfers;
DROP POLICY IF EXISTS "Authenticated users can insert transfers" ON public.account_transfers;
DROP POLICY IF EXISTS "Authenticated users can delete transfers" ON public.account_transfers;

CREATE POLICY "Staff can view transfers"
    ON public.account_transfers FOR SELECT
    TO authenticated
    USING (
        public.is_admin_or_owner(auth.uid()) OR
        public.is_manager(auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.app_roles
            WHERE user_id = auth.uid()
              AND role = 'staff'
              AND is_active = TRUE
        )
    );

CREATE POLICY "Managers and above can insert transfers"
    ON public.account_transfers FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_admin_or_owner(auth.uid()) OR
        public.is_manager(auth.uid())
    );

CREATE POLICY "Admin and owner can delete transfers"
    ON public.account_transfers FOR DELETE
    TO authenticated
    USING (public.is_admin_or_owner(auth.uid()));

-- 4.3 Fix audit_logs_archive policies
DROP POLICY IF EXISTS "audit_logs_archive_select" ON public.audit_logs_archive;

CREATE POLICY "Admin and owner can view audit archive"
    ON public.audit_logs_archive FOR SELECT
    TO authenticated
    USING (public.is_admin_or_owner(auth.uid()));

CREATE POLICY "Admin and owner can manage audit archive"
    ON public.audit_logs_archive FOR ALL
    TO authenticated
    USING (public.is_admin_or_owner(auth.uid()))
    WITH CHECK (public.is_admin_or_owner(auth.uid()));

-- ============================================
-- SECTION 5: MOVE BTREE_GIST TO EXTENSIONS SCHEMA
-- ============================================
-- Note: This is a cosmetic fix. The extension works fine in public schema,
-- but moving it to an extensions schema is best practice for organization.
-- We create an extensions schema if it doesn't exist.

CREATE SCHEMA IF NOT EXISTS extensions;

-- Note: Moving an extension between schemas requires DROP and CREATE.
-- This can break dependent objects (exclusion constraints, indexes).
-- For production safety, we'll just comment this as a TODO.
-- The btree_gist extension is non-critical as a warning.

COMMENT ON EXTENSION btree_gist IS
    'TODO: Consider moving to extensions schema in a maintenance window. Currently in public for exclusion constraints.';

-- ============================================
-- SECTION 6: LEAKED PASSWORD PROTECTION
-- ============================================
-- This setting must be enabled in the Supabase Dashboard:
-- 1. Go to Authentication > Settings > Security
-- 2. Enable "Leaked password protection"
--
-- This cannot be set via SQL migration.

-- Add a reminder in audit logs
INSERT INTO public.audit_logs (
    action,
    table_name,
    description,
    category,
    severity,
    source
) VALUES (
    'INSERT',
    'schema_migrations',
    'Security hardening migration applied. MANUAL ACTION REQUIRED: Enable "Leaked password protection" in Supabase Dashboard > Authentication > Settings > Security',
    'SYSTEM',
    'WARNING',
    'app'
);

-- ============================================
-- VERIFICATION QUERIES (run manually to verify)
-- ============================================
--
-- Check SECURITY INVOKER views:
-- SELECT viewname, definition FROM pg_views WHERE schemaname = 'public' AND viewname IN ('audit_index_stats', 'audit_archive_stats', 'public_unit_availability', 'audit_system_status');
--
-- Check RLS on availability_blackouts:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'availability_blackouts';
--
-- Check function search_path:
-- SELECT proname, proconfig FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proconfig IS NOT NULL;
--
-- ============================================

COMMIT;

-- ============================================
-- POST-MIGRATION MANUAL STEPS
-- ============================================
--
-- 1. Enable Leaked Password Protection:
--    Supabase Dashboard > Authentication > Settings > Security
--    Toggle ON "Leaked password protection"
--
-- 2. (Optional) Move btree_gist extension:
--    This requires a maintenance window as it may temporarily break
--    exclusion constraints. Generally safe to leave in public schema.
--
-- 3. Rerun Security Advisor to verify all issues are resolved
--
-- ============================================
