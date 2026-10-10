-- audit_trigger_func records the signed-in user's email, so trigger rows in
-- the audit viewer name the editor instead of "System". Writes without a
-- user JWT (service role, cron) keep a null user_email.

CREATE OR REPLACE FUNCTION public.audit_trigger_func()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

    -- Record ID: explicit trigger argument first, then the generic guesses
    v_record_id := COALESCE(
        CASE WHEN TG_NARGS > 0 THEN v_record_data ->> TG_ARGV[0] END,
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
        user_email,
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
        auth.jwt() ->> 'email',
        'DATA',
        'INFO',
        'db'
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$function$;
