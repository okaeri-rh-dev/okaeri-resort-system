-- Audit retention (RA 10173): rows older than the window lose their personal data.
-- Actor columns are cleared on every row; data columns are cleared on every table
-- except a keep-list of tables without personal data, so legacy and future
-- table names are anonymized by default. Kept: who (user_id, user_role), what
-- (action, table_name, record_id, changed_fields) and when. Anonymized rows carry
-- metadata.anonymized_at, which the UI reads and which makes re-runs no-ops.

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
