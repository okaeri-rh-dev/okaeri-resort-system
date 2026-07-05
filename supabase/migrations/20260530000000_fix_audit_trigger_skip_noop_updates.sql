-- ============================================
-- Migration: Skip no-op UPDATE audit rows
-- Description: audit_trigger_func() previously inserted an audit_logs row for
--              every UPDATE on every audited table, even when no column changed.
--              That violates valid_changed_fields (which requires non-empty
--              changed_fields for source='db', action='UPDATE'), which in turn
--              aborts the outer statement. The trap fires on cascading stats
--              triggers (trigger_update_guest_statistics,
--              trigger_update_booking_totals) when multiple rows are inserted
--              in one statement and the cascade writes identical values per
--              row (NOW() is the transaction start time, so it's constant
--              across cascades within the same transaction).
--
--              This patch short-circuits the trigger when the computed
--              changed-fields array is null/empty, so no audit row is written
--              and no constraint violation occurs. Real UPDATEs still produce
--              audit rows with non-empty changed_fields.
--
--              No schema changes. No data migration. No constraint change.
-- Date: 2026-05-30
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

        -- Skip no-op UPDATEs: nothing to audit, and writing an empty
        -- changed_fields would violate valid_changed_fields anyway.
        IF v_changed_fields IS NULL OR array_length(v_changed_fields, 1) IS NULL THEN
            RETURN NEW;
        END IF;
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
