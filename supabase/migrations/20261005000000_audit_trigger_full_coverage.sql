-- Attach audit_trigger_func to every app-written table that lacked it.
-- Tables left without the trigger are allowlisted, with reasons, in
-- src/__tests__/database/audit-trigger-coverage.test.ts.
--
-- audit_trigger_func now accepts an optional trigger argument naming the
-- record-id column, for tables whose primary key the generic lookup
-- (<table>_id, <table minus s>_id, id, log_id) cannot find:
-- app_roles.user_id, account_transfers.transfer_id,
-- availability_blackouts.blackout_id. Existing triggers pass no argument
-- and behave as before.

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
$function$;

-- Prod has known schema drift, so skip any table that is absent there.
DO $$
DECLARE
    v_target RECORD;
BEGIN
    FOR v_target IN
        SELECT * FROM (VALUES
            ('app_roles', 'user_id'),
            ('accounts', NULL),
            ('account_transfers', 'transfer_id'),
            ('availability_blackouts', 'blackout_id'),
            ('booking_units', NULL),
            ('discount_rules', NULL),
            ('expense_categories', NULL),
            ('payment_methods', NULL),
            ('pricing_config', NULL),
            ('seasonal_rates', NULL)
        ) AS t(table_name, record_id_column)
    LOOP
        IF to_regclass('public.' || v_target.table_name) IS NULL THEN
            RAISE NOTICE 'audit trigger: public.% not found, skipped', v_target.table_name;
            CONTINUE;
        END IF;

        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I',
            'audit_' || v_target.table_name || '_trigger', v_target.table_name);

        EXECUTE format(
            'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I '
            'FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func(%s)',
            'audit_' || v_target.table_name || '_trigger',
            v_target.table_name,
            COALESCE(quote_literal(v_target.record_id_column), '')
        );
    END LOOP;
END;
$$;
