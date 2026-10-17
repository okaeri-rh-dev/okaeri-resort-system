-- Fixes the maintenance functions flagged by `supabase db lint` and makes them
-- service-role only. Before this, anon and authenticated could execute all of
-- them (most SECURITY DEFINER), so anyone with the public anon key could move
-- audit rows into the archive or, once the format bug was fixed, drop audit triggers.

-- The 1-arg archive family made archive_audit_logs(timestamptz) ambiguous against
-- the 2-arg version (dry_run has a default). Prod's 1-arg bodies also differ and
-- write columns that do not exist. The 2-arg family stays.
DROP FUNCTION IF EXISTS public.archive_logs_older_than_months(integer);
DROP FUNCTION IF EXISTS public.monthly_archive_until(date);
DROP FUNCTION IF EXISTS public.archive_audit_logs(timestamptz);
DROP FUNCTION IF EXISTS public.restore_logs_from_archive(date);

CREATE OR REPLACE FUNCTION public.archive_audit_logs(cutoff_date timestamptz, dry_run boolean DEFAULT true)
RETURNS TABLE(archived_count bigint, oldest_archived timestamptz, newest_archived timestamptz, tables_affected text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_archived_count BIGINT;
    v_oldest TIMESTAMPTZ;
    v_newest TIMESTAMPTZ;
    v_tables TEXT[];
BEGIN
    IF cutoff_date >= NOW() THEN
        RAISE EXCEPTION 'Archive date must be in the past. Provided: %, Now: %', cutoff_date, NOW();
    END IF;

    SELECT COUNT(*), MIN(created_at), MAX(created_at), ARRAY_AGG(DISTINCT table_name ORDER BY table_name)
    INTO v_archived_count, v_oldest, v_newest, v_tables
    FROM public.audit_logs
    WHERE created_at < cutoff_date;

    IF v_archived_count = 0 OR dry_run THEN
        RETURN QUERY SELECT v_archived_count, v_oldest, v_newest, COALESCE(v_tables, '{}'::TEXT[]);
        RETURN;
    END IF;

    WITH moved AS (
        DELETE FROM public.audit_logs
        WHERE created_at < cutoff_date
        RETURNING *
    )
    INSERT INTO public.audit_logs_archive (
        audit_id, correlation_id, action, table_name, record_id, record_pk, event_type, source,
        user_id, user_email, user_role, old_data, new_data, changed_fields, description,
        category, severity, metadata, ip_address, user_agent, created_at
    )
    SELECT
        audit_id, correlation_id, action, table_name, record_id, record_pk, event_type, source,
        user_id, user_email, user_role, old_data, new_data, changed_fields, description,
        category, severity, metadata, ip_address, user_agent, created_at
    FROM moved;

    GET DIAGNOSTICS v_archived_count = ROW_COUNT;
    RETURN QUERY SELECT v_archived_count, v_oldest, v_newest, v_tables;
END;
$$;

CREATE OR REPLACE FUNCTION public.attach_audit_trigger(p_table_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    EXECUTE format(
        'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func()',
        'audit_trigger_' || p_table_name,
        p_table_name
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.detach_audit_trigger(p_table_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'audit_trigger_' || p_table_name, p_table_name);
END;
$$;

-- Retention: checked-out bookings 90 days after check_out, cancelled bookings
-- 30 days after their last update. Returns each file's path inside the
-- payment-proofs bucket; the cron deletes the files from storage.
CREATE OR REPLACE FUNCTION public.cleanup_expired_payment_proofs()
RETURNS TABLE(file_path text)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    WITH expired AS (
        SELECT b.booking_id, b.payment_proof_url
        FROM public.bookings b
        WHERE b.payment_proof_url IS NOT NULL
          AND (
              (b.booking_status = 'CheckedOut' AND b.check_out < NOW() - INTERVAL '90 days')
              OR (b.booking_status = 'Cancelled' AND b.updated_at < NOW() - INTERVAL '30 days')
          )
    ),
    cleared_payments AS (
        UPDATE public.payments p
        SET proof_url = NULL
        FROM expired e
        WHERE p.booking_id = e.booking_id
          AND p.proof_url = e.payment_proof_url
    ),
    cleared_bookings AS (
        UPDATE public.bookings b
        SET payment_proof_url = NULL
        FROM expired e
        WHERE b.booking_id = e.booking_id
        RETURNING e.payment_proof_url
    )
    SELECT regexp_replace(
        split_part(payment_proof_url, '?', 1),
        '^.*/storage/v1/object/(public|sign|authenticated)/payment-proofs/',
        ''
    )
    FROM cleared_bookings;
END;
$$;

REVOKE ALL ON FUNCTION
    public.archive_audit_logs(timestamptz, boolean),
    public.archive_logs_older_than_months(integer, boolean),
    public.monthly_archive_until(timestamptz, boolean),
    public.restore_logs_from_archive(timestamptz, timestamptz),
    public.attach_audit_trigger(text),
    public.detach_audit_trigger(text),
    public.cleanup_expired_payment_proofs()
FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION
    public.archive_audit_logs(timestamptz, boolean),
    public.archive_logs_older_than_months(integer, boolean),
    public.monthly_archive_until(timestamptz, boolean),
    public.restore_logs_from_archive(timestamptz, timestamptz),
    public.attach_audit_trigger(text),
    public.detach_audit_trigger(text),
    public.cleanup_expired_payment_proofs()
TO service_role;
