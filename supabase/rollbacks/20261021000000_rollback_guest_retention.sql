-- ============================================
-- ROLLBACK for 20261021000000_guest_retention.sql
-- ============================================
-- Drops the retention functions and the anonymized_at markers, restores anonymize_audit_logs
-- to its 20261018000000 body and the guests delete policy, and recreates
-- bookings_conflict_backup EMPTY (its 2 test rows are not restored).
-- Anonymized rows stay anonymized: their personal data is gone.
-- Local: use `supabase db reset` instead.
-- ============================================

BEGIN;

DROP FUNCTION IF EXISTS public.delete_guest(uuid);
DROP FUNCTION IF EXISTS public.anonymize_expired_guests(interval);
CREATE POLICY "guests_delete_manager" ON public.guests
    FOR DELETE TO authenticated USING (public.is_manager_or_above());

DROP FUNCTION IF EXISTS public.anonymize_guest(uuid);
DROP FUNCTION IF EXISTS public.anonymize_booking(uuid);
DROP FUNCTION IF EXISTS public._payment_proof_path(text);
DROP FUNCTION IF EXISTS public._audit_ids_for_records(text[]);

-- 20261018000000 body (it must not call _anonymize_audit_rows, which is dropped next)
CREATE OR REPLACE FUNCTION public.anonymize_audit_logs(p_older_than interval DEFAULT interval '24 months')
RETURNS TABLE(anonymized_count bigint, audit_logs_bytes bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_cutoff timestamptz := now() - p_older_than;
    v_keep_tables text[] := ARRAY['units', 'pricing_config', 'schema_migrations', 'maintenance_logs'];
    v_marker jsonb := jsonb_build_object('anonymized_at', now());
    v_live_count bigint;
    v_archived_count bigint;
BEGIN
    UPDATE public.audit_logs a
    SET user_email = NULL,
        ip_address = NULL,
        user_agent = NULL,
        old_data = CASE WHEN a.table_name = ANY (v_keep_tables) THEN a.old_data END,
        new_data = CASE WHEN a.table_name = ANY (v_keep_tables) THEN a.new_data END,
        description = CASE WHEN a.table_name = ANY (v_keep_tables) THEN a.description END,
        metadata = CASE
            WHEN a.table_name = ANY (v_keep_tables) THEN COALESCE(a.metadata, '{}'::jsonb) || v_marker
            ELSE v_marker
        END
    WHERE a.created_at < v_cutoff
      AND NOT COALESCE(a.metadata ? 'anonymized_at', false);
    GET DIAGNOSTICS v_live_count = ROW_COUNT;

    UPDATE public.audit_logs_archive a
    SET user_email = NULL,
        ip_address = NULL,
        user_agent = NULL,
        old_data = CASE WHEN a.table_name = ANY (v_keep_tables) THEN a.old_data END,
        new_data = CASE WHEN a.table_name = ANY (v_keep_tables) THEN a.new_data END,
        description = CASE WHEN a.table_name = ANY (v_keep_tables) THEN a.description END,
        metadata = CASE
            WHEN a.table_name = ANY (v_keep_tables) THEN COALESCE(a.metadata, '{}'::jsonb) || v_marker
            ELSE v_marker
        END
    WHERE a.created_at < v_cutoff
      AND NOT COALESCE(a.metadata ? 'anonymized_at', false);
    GET DIAGNOSTICS v_archived_count = ROW_COUNT;

    RETURN QUERY SELECT v_live_count + v_archived_count, pg_total_relation_size('public.audit_logs');
END;
$$;
REVOKE ALL ON FUNCTION public.anonymize_audit_logs(interval) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anonymize_audit_logs(interval) TO service_role;

DROP FUNCTION IF EXISTS public._anonymize_audit_rows(uuid[]);

ALTER TABLE public.guests DROP COLUMN IF EXISTS anonymized_at;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS anonymized_at;

CREATE TABLE IF NOT EXISTS public.bookings_conflict_backup (
    booking_id uuid,
    booking_reference character varying(20),
    unit_id uuid,
    guest_id uuid,
    guest_name character varying(100),
    contact_number character varying(20),
    email character varying(100),
    num_guests integer,
    check_in date,
    check_out date,
    total_amount numeric(10,2),
    booking_status character varying(20),
    payment_status character varying(20),
    payment_method character varying(20),
    payment_proof_url text,
    special_requests text,
    internal_notes text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    is_guest_booking boolean,
    upload_status text,
    upload_expires_at timestamp with time zone
);
ALTER TABLE public.bookings_conflict_backup ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin only access to conflict backups" ON public.bookings_conflict_backup
    USING (public.is_admin_or_owner(auth.uid()));

COMMIT;
