-- ============================================
-- Migration: Fix audit_trigger_func column reference
-- Description: The deployed audit_trigger_func references a non-existent
--              "changes" column in audit_logs. The correct column name
--              is "changed_fields". This caused all INSERT/UPDATE/DELETE
--              operations on audited tables to fail with:
--                ERROR 42703: column "changes" of relation "audit_logs" does not exist
-- Date: 2026-02-21
-- ============================================

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

    -- Extract record ID generically: try <table>_id, then id, then log_id
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
