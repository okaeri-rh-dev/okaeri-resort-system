-- Five functions had SET search_path TO '' applied on prod outside migrations (found by the
-- prod drift check), but their bodies used unqualified names, so on prod they fail with
-- "does not exist" (get_account_balance probed 2026-10-07). Qualify the references and keep
-- the empty search_path so local and prod end up identical and working.

CREATE OR REPLACE FUNCTION public.get_account_balance(p_account_id uuid, p_as_of_date timestamp with time zone DEFAULT now())
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE
    v_balance DECIMAL(12,2);
BEGIN
    SELECT current_balance INTO v_balance
    FROM public.get_all_account_balances(p_as_of_date)
    WHERE account_id = p_account_id;

    RETURN COALESCE(v_balance, 0);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.archive_audit_logs(cutoff_date timestamp with time zone, dry_run boolean DEFAULT true)
 RETURNS TABLE(archived_count bigint, oldest_archived timestamp with time zone, newest_archived timestamp with time zone, tables_affected text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_archived_count BIGINT;
    v_oldest TIMESTAMPTZ;
    v_newest TIMESTAMPTZ;
    v_tables TEXT[];
BEGIN
    -- ============================================
    -- STEP 1: Validate input date
    -- ============================================

    IF cutoff_date >= NOW() THEN
        RAISE EXCEPTION 'Archive date must be in the past. Provided: %, Now: %',
            cutoff_date, NOW();
    END IF;

    IF cutoff_date > NOW() - INTERVAL '30 days' THEN
        RAISE WARNING 'Archive date is less than 30 days ago. This may archive recent logs.';
    END IF;

    -- ============================================
    -- STEP 2: Preview what will be archived
    -- ============================================

    SELECT
        COUNT(*),
        MIN(created_at),
        MAX(created_at),
        ARRAY_AGG(DISTINCT table_name ORDER BY table_name)
    INTO
        v_archived_count,
        v_oldest,
        v_newest,
        v_tables
    FROM public.audit_logs
    WHERE created_at < cutoff_date;

    -- ============================================
    -- STEP 3: Safety checks
    -- ============================================

    IF v_archived_count = 0 THEN
        RAISE NOTICE 'No logs found before %', cutoff_date;
        RETURN QUERY SELECT 0::BIGINT, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, '{}'::TEXT[];
        RETURN;
    END IF;

    IF v_archived_count > 100000 THEN
        RAISE WARNING 'Attempting to archive % logs. Consider smaller date range.', v_archived_count;
    END IF;

    -- ============================================
    -- STEP 4: Dry run or actual archive
    -- ============================================

    IF dry_run THEN
        -- Preview only
        RAISE NOTICE '=== DRY RUN ===';
        RAISE NOTICE 'Would archive % logs', v_archived_count;
        RAISE NOTICE 'Date range: % to %', v_oldest, v_newest;
        RAISE NOTICE 'Tables affected: %', v_tables;
        RAISE NOTICE 'To execute, call: SELECT * FROM archive_audit_logs(''%''::TIMESTAMPTZ, FALSE)', cutoff_date;

        RETURN QUERY SELECT v_archived_count, v_oldest, v_newest, v_tables;
        RETURN;
    END IF;

    -- ============================================
    -- STEP 5: Move logs to archive (INSERT + DELETE)
    -- ============================================

    -- Insert into archive
    WITH moved_logs AS (
        INSERT INTO public.audit_logs_archive
        SELECT * FROM public.audit_logs
        WHERE created_at < cutoff_date
        RETURNING audit_id
    )
    SELECT COUNT(*) INTO v_archived_count FROM moved_logs;

    -- Delete from active table
    DELETE FROM public.audit_logs WHERE created_at < cutoff_date;

    RAISE NOTICE 'Successfully archived % logs to audit_logs_archive', v_archived_count;

    -- ============================================
    -- STEP 6: Recommend VACUUM
    -- ============================================

    RAISE NOTICE 'Run manually after archival: VACUUM ANALYZE audit_logs;';

    RETURN QUERY SELECT v_archived_count, v_oldest, v_newest, v_tables;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.archive_logs_older_than_months(months_old integer, dry_run boolean DEFAULT true)
 RETURNS TABLE(archived_count bigint, oldest_archived timestamp with time zone, newest_archived timestamp with time zone, tables_affected text[])
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
    RETURN QUERY
    SELECT * FROM public.archive_audit_logs(
        NOW() - (months_old || ' months')::INTERVAL,
        dry_run
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.monthly_archive_until(final_cutoff_date timestamp with time zone, dry_run boolean DEFAULT true)
 RETURNS TABLE(month_archived date, logs_archived bigint)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
    current_month_start DATE;
    next_month_start DATE;
    result RECORD;
BEGIN
    -- Start from the oldest log
    SELECT DATE_TRUNC('month', MIN(created_at))::DATE INTO current_month_start
    FROM public.audit_logs
    WHERE created_at < final_cutoff_date;

    IF current_month_start IS NULL THEN
        RAISE NOTICE 'No logs found before %', final_cutoff_date;
        RETURN;
    END IF;

    -- Loop through months
    WHILE current_month_start < DATE_TRUNC('month', final_cutoff_date)::DATE LOOP
        next_month_start := (DATE_TRUNC('month', current_month_start) + INTERVAL '1 month')::DATE;

        RAISE NOTICE 'Processing month: %', current_month_start;

        -- Archive this month's logs
        SELECT * INTO result FROM public.archive_audit_logs(
            next_month_start::TIMESTAMPTZ,
            dry_run
        );

        RETURN QUERY SELECT current_month_start, result.archived_count;

        -- Move to next month
        current_month_start := next_month_start;

        -- Brief pause between batches (only if not dry run)
        IF NOT dry_run THEN
            PERFORM pg_sleep(0.5);
        END IF;
    END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.restore_logs_from_archive(start_date timestamp with time zone, end_date timestamp with time zone)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    restored_count BIGINT;
BEGIN
    -- Move logs back to active table
    WITH restored AS (
        INSERT INTO public.audit_logs
        SELECT * FROM public.audit_logs_archive
        WHERE created_at BETWEEN start_date AND end_date
        RETURNING audit_id
    )
    SELECT COUNT(*) INTO restored_count FROM restored;

    -- Delete from archive
    DELETE FROM public.audit_logs_archive
    WHERE created_at BETWEEN start_date AND end_date;

    RAISE NOTICE 'Restored % logs from archive', restored_count;
    RAISE NOTICE 'Run manually: VACUUM ANALYZE audit_logs;';

    RETURN restored_count;
END;
$function$
;
