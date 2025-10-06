alter table "public"."app_roles" drop constraint "app_roles_role_check";

alter table "public"."audit_logs" drop constraint "audit_logs_action_check";

alter table "public"."audit_logs" drop constraint "audit_logs_severity_check";

alter table "public"."audit_logs" drop constraint "audit_logs_source_check";

alter table "public"."audit_logs_archive" drop constraint "audit_logs_action_check";

alter table "public"."audit_logs_archive" drop constraint "audit_logs_severity_check";

alter table "public"."audit_logs_archive" drop constraint "audit_logs_source_check";

alter table "public"."bookings" drop constraint "bookings_booking_status_check";

alter table "public"."bookings" drop constraint "bookings_payment_status_check";

alter table "public"."bookings" drop constraint "no_overlapping_bookings";

alter table "public"."units" drop constraint "units_unit_status_check";

alter table "public"."units" drop constraint "units_unit_type_check";

select 1; -- drop index if exists "public"."no_overlapping_bookings";

alter table "public"."bookings" alter column "booking_id" set default extensions.uuid_generate_v4();

alter table "public"."expenses" alter column "expense_id" set default extensions.uuid_generate_v4();

alter table "public"."guests" alter column "guest_id" set default extensions.uuid_generate_v4();

alter table "public"."maintenance_logs" alter column "log_id" set default extensions.uuid_generate_v4();

alter table "public"."payments" alter column "payment_id" set default extensions.uuid_generate_v4();

alter table "public"."units" alter column "unit_id" set default extensions.uuid_generate_v4();

select 1; -- CREATE INDEX no_overlapping_bookings ON public.bookings USING gist (unit_id, tsrange((check_in)::timestamp without time zone, (check_out)::timestamp without time zone, '[)'::text)) WHERE (((is_guest_booking = false) AND ((booking_status)::text <> 'Cancelled'::text)) OR ((is_guest_booking = true) AND ((booking_status)::text = ANY ((ARRAY['Confirmed'::character varying, 'CheckedIn'::character varying, 'CheckedOut'::character varying])::text[]))));

alter table "public"."app_roles" add constraint "app_roles_role_check" CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'owner'::character varying, 'manager'::character varying, 'staff'::character varying])::text[]))) not valid;

alter table "public"."app_roles" validate constraint "app_roles_role_check";

alter table "public"."audit_logs" add constraint "audit_logs_action_check" CHECK (((action)::text = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::text[]))) not valid;

alter table "public"."audit_logs" validate constraint "audit_logs_action_check";

alter table "public"."audit_logs" add constraint "audit_logs_severity_check" CHECK (((severity)::text = ANY ((ARRAY['INFO'::character varying, 'WARNING'::character varying, 'CRITICAL'::character varying, 'DEBUG'::character varying])::text[]))) not valid;

alter table "public"."audit_logs" validate constraint "audit_logs_severity_check";

alter table "public"."audit_logs" add constraint "audit_logs_source_check" CHECK (((source)::text = ANY ((ARRAY['db'::character varying, 'app'::character varying])::text[]))) not valid;

alter table "public"."audit_logs" validate constraint "audit_logs_source_check";

alter table "public"."audit_logs_archive" add constraint "audit_logs_action_check" CHECK (((action)::text = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::text[]))) not valid;

alter table "public"."audit_logs_archive" validate constraint "audit_logs_action_check";

alter table "public"."audit_logs_archive" add constraint "audit_logs_severity_check" CHECK (((severity)::text = ANY ((ARRAY['INFO'::character varying, 'WARNING'::character varying, 'CRITICAL'::character varying, 'DEBUG'::character varying])::text[]))) not valid;

alter table "public"."audit_logs_archive" validate constraint "audit_logs_severity_check";

alter table "public"."audit_logs_archive" add constraint "audit_logs_source_check" CHECK (((source)::text = ANY ((ARRAY['db'::character varying, 'app'::character varying])::text[]))) not valid;

alter table "public"."audit_logs_archive" validate constraint "audit_logs_source_check";

alter table "public"."bookings" add constraint "bookings_booking_status_check" CHECK (((booking_status)::text = ANY ((ARRAY['Pending'::character varying, 'Confirmed'::character varying, 'CheckedIn'::character varying, 'CheckedOut'::character varying, 'Cancelled'::character varying])::text[]))) not valid;

alter table "public"."bookings" validate constraint "bookings_booking_status_check";

alter table "public"."bookings" add constraint "bookings_payment_status_check" CHECK (((payment_status)::text = ANY ((ARRAY['Pending'::character varying, 'Partial'::character varying, 'Completed'::character varying, 'Refunded'::character varying])::text[]))) not valid;

alter table "public"."bookings" validate constraint "bookings_payment_status_check";

alter table "public"."bookings" add constraint "no_overlapping_bookings" EXCLUDE USING gist (unit_id WITH =, tsrange((check_in)::timestamp without time zone, (check_out)::timestamp without time zone, '[)'::text) WITH &&) WHERE ((((is_guest_booking = false) AND ((booking_status)::text <> 'Cancelled'::text)) OR ((is_guest_booking = true) AND ((booking_status)::text = ANY ((ARRAY['Confirmed'::character varying, 'CheckedIn'::character varying, 'CheckedOut'::character varying])::text[])))));

alter table "public"."units" add constraint "units_unit_status_check" CHECK (((unit_status)::text = ANY ((ARRAY['Available'::character varying, 'Occupied'::character varying, 'Maintenance'::character varying, 'Reserved'::character varying])::text[]))) not valid;

alter table "public"."units" validate constraint "units_unit_status_check";

alter table "public"."units" add constraint "units_unit_type_check" CHECK (((unit_type)::text = ANY ((ARRAY['Standard'::character varying, 'Deluxe'::character varying, 'Suite'::character varying, 'Villa'::character varying])::text[]))) not valid;

alter table "public"."units" validate constraint "units_unit_type_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.archive_audit_logs(cutoff_date timestamp with time zone, dry_run boolean DEFAULT true)
 RETURNS TABLE(archived_count bigint, oldest_archived timestamp with time zone, newest_archived timestamp with time zone, tables_affected text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
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
    FROM audit_logs
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
        INSERT INTO audit_logs_archive
        SELECT * FROM audit_logs
        WHERE created_at < cutoff_date
        RETURNING audit_id
    )
    SELECT COUNT(*) INTO v_archived_count FROM moved_logs;

    -- Delete from active table
    DELETE FROM audit_logs WHERE created_at < cutoff_date;

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
AS $function$
BEGIN
    RETURN QUERY
    SELECT * FROM archive_audit_logs(
        NOW() - (months_old || ' months')::INTERVAL,
        dry_run
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.attach_audit_trigger(target_table text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    EXECUTE format('
        CREATE TRIGGER audit_%I_trigger
        AFTER INSERT OR UPDATE OR DELETE ON %I
        FOR EACH ROW EXECUTE FUNCTION audit_trigger_func()
    ', target_table, target_table);

    RAISE NOTICE 'Audit trigger attached to table: %', target_table;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.audit_trigger_func()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    audit_user_id UUID;
    audit_user_email TEXT;
    audit_user_role TEXT;
    changed_fields TEXT[];
    pk_column_name TEXT;
    record_id TEXT;
    -- PII redaction variables
    sensitive_fields TEXT[];
    field_name TEXT;
    redacted_old JSONB;
    redacted_new JSONB;
BEGIN
    -- ============================================
    -- STEP 1: EXTRACT USER CONTEXT FROM AUTH
    -- ============================================
    BEGIN
        -- Get current authenticated user from Supabase Auth
        audit_user_id := auth.uid();

        -- Extract email from JWT claims (auth.email() function doesn't exist)
        audit_user_email := NULLIF(
            current_setting('request.jwt.claims', TRUE)::json->>'email',
            ''
        );

        -- Get user role from JWT claims (if available)
        -- Returns owner/manager/staff or NULL
        audit_user_role := NULLIF(
            current_setting('request.jwt.claims', TRUE)::json->>'role',
            ''
        );

    EXCEPTION WHEN OTHERS THEN
        -- If auth context unavailable (system operations), use NULL
        audit_user_id := NULL;
        audit_user_email := NULL;
        audit_user_role := NULL;
    END;

    -- ============================================
    -- STEP 2: DETERMINE PRIMARY KEY COLUMN
    -- ============================================
    -- Convention: Looks for the primary key column
    -- Works with: unit_id, booking_id, guest_id, etc.
    SELECT a.attname INTO pk_column_name
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid
        AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = TG_RELID
        AND i.indisprimary
    LIMIT 1;

    -- ============================================
    -- STEP 3: EXTRACT RECORD ID (as TEXT)
    -- ============================================
    IF TG_OP = 'DELETE' THEN
        -- For DELETE, get ID from OLD record and cast to TEXT
        EXECUTE format('SELECT ($1).%I::TEXT', pk_column_name)
            INTO record_id
            USING OLD;
    ELSE
        -- For INSERT/UPDATE, get ID from NEW record and cast to TEXT
        EXECUTE format('SELECT ($1).%I::TEXT', pk_column_name)
            INTO record_id
            USING NEW;
    END IF;

    -- ============================================
    -- STEP 3.5: REDACT SENSITIVE FIELDS (PII Protection)
    -- ============================================
    -- Redact sensitive fields based on table name
    -- This ensures PII never enters audit_logs in plain text

    -- Define sensitive fields per table
    sensitive_fields := CASE TG_TABLE_NAME
        WHEN 'guests' THEN ARRAY['phone_number', 'email']
        WHEN 'bookings' THEN ARRAY['contact_number', 'email', 'special_requests', 'internal_notes']
        WHEN 'payments' THEN ARRAY['notes', 'proof_url']
        WHEN 'expenses' THEN ARRAY['notes', 'receipt_url']
        ELSE ARRAY[]::TEXT[]
    END;

    -- Redact old_data if present
    IF TG_OP IN ('UPDATE', 'DELETE') AND array_length(sensitive_fields, 1) > 0 THEN
        redacted_old := to_jsonb(OLD);
        FOREACH field_name IN ARRAY sensitive_fields
        LOOP
            IF redacted_old ? field_name THEN
                redacted_old := jsonb_set(redacted_old, ARRAY[field_name], '"[REDACTED]"'::jsonb);
            END IF;
        END LOOP;
    ELSE
        redacted_old := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END;
    END IF;

    -- Redact new_data if present
    IF TG_OP IN ('INSERT', 'UPDATE') AND array_length(sensitive_fields, 1) > 0 THEN
        redacted_new := to_jsonb(NEW);
        FOREACH field_name IN ARRAY sensitive_fields
        LOOP
            IF redacted_new ? field_name THEN
                redacted_new := jsonb_set(redacted_new, ARRAY[field_name], '"[REDACTED]"'::jsonb);
            END IF;
        END LOOP;
    ELSE
        redacted_new := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END;
    END IF;

    -- ============================================
    -- STEP 4: CALCULATE CHANGED FIELDS (UPDATE ONLY)
    -- ============================================
    IF TG_OP = 'UPDATE' THEN
        -- Compare old and new values to find differences
        -- Exclude meta fields that change automatically
        SELECT ARRAY_AGG(key) INTO changed_fields
        FROM jsonb_each(to_jsonb(NEW))
        WHERE to_jsonb(NEW)->key IS DISTINCT FROM to_jsonb(OLD)->key
            AND key NOT IN ('updated_at', 'created_at');
    END IF;

    -- ============================================
    -- STEP 5: INSERT AUDIT LOG ENTRY
    -- ============================================
    BEGIN
        INSERT INTO audit_logs (
            table_name,
            record_id,
            action,
            source,
            user_id,
            user_email,
            user_role,
            old_data,
            new_data,
            changed_fields,
            created_at
        ) VALUES (
            TG_TABLE_NAME,                          -- Which table was modified
            record_id,                              -- Which record was modified
            TG_OP,                                  -- INSERT, UPDATE, or DELETE
            'db',                                   -- Source: database trigger (Layer 1)
            audit_user_id,                          -- Who (NULL for system)
            audit_user_email,
            audit_user_role,
            redacted_old,                           -- Before state (PII redacted)
            redacted_new,                           -- After state (PII redacted)
            changed_fields,                         -- What changed
            NOW()                                   -- When
        );

    EXCEPTION WHEN OTHERS THEN
        -- Critical: Don't fail the main operation if audit fails
        -- Just log a warning for investigation
        RAISE WARNING 'Audit logging failed for %.%: %',
            TG_TABLE_NAME, record_id, SQLERRM;
    END;

    -- ============================================
    -- STEP 6: RETURN APPROPRIATE VALUE
    -- ============================================
    -- PostgreSQL requires triggers to return OLD or NEW
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.can_view_all_audit_logs()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM app_roles
        WHERE user_id = auth.uid()
          AND role IN ('admin', 'owner')
          AND is_active = true
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_unit_availability(p_unit_id uuid, p_check_in timestamp with time zone, p_check_out timestamp with time zone)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1
    FROM bookings
    WHERE unit_id = p_unit_id
      AND booking_status != 'Cancelled'
      AND (
        (check_in < p_check_out AND check_out > p_check_in)
      )
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.detach_audit_trigger(target_table text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%I_trigger ON %I',
        target_table, target_table);
    RAISE NOTICE 'Audit trigger detached from table: %', target_table;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_audit_identity_func()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- Only enforce for Layer 2 (app) logs or when source is NULL
    -- Layer 1 (db triggers) bypass this via SECURITY DEFINER context
    IF NEW.source = 'app' OR NEW.source IS NULL THEN
        -- Force user identity from Supabase Auth JWT claims
        NEW.user_id := auth.uid();
        NEW.user_email := NULLIF(
            current_setting('request.jwt.claims', TRUE)::json->>'email',
            ''
        );
        NEW.user_role := NULLIF(
            current_setting('request.jwt.claims', TRUE)::json->>'role',
            ''
        );

        -- Force source to 'app' for client-side inserts
        NEW.source := 'app';
    END IF;

    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_booking_reference()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
    date_part TEXT;
    random_part TEXT;
    reference TEXT;
BEGIN
    date_part := TO_CHAR(NOW(), 'YYYYMMDD');
    random_part := UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 4));
    reference := 'BK-' || date_part || '-' || random_part;
    RETURN reference;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_current_audit_role()
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM app_roles
    WHERE user_id = auth.uid()
      AND is_active = true
    LIMIT 1;

    -- Return 'none' instead of NULL for easier client-side checks
    -- Client code: if (role === 'admin') { ... }
    RETURN COALESCE(user_role, 'none');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.grant_audit_role(target_user_id uuid, target_email text, target_role text, grant_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- Security check: Only admins can grant roles
    IF NOT is_audit_admin() THEN
        RAISE EXCEPTION 'Permission denied: Only admins can grant roles';
    END IF;

    -- Validate role
    IF target_role NOT IN ('admin', 'owner', 'manager', 'staff') THEN
        RAISE EXCEPTION 'Invalid role: %. Must be admin, owner, manager, or staff', target_role;
    END IF;

    -- Insert or update role
    INSERT INTO app_roles (user_id, email, role, granted_by, is_active, notes)
    VALUES (target_user_id, target_email, target_role, auth.uid(), true, grant_notes)
    ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role,
        granted_by = auth.uid(),
        granted_at = NOW(),
        is_active = true,
        notes = EXCLUDED.notes;

    RAISE NOTICE 'Role % granted to % by %', target_role, target_email, (SELECT email FROM app_roles WHERE user_id = auth.uid());
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM app_roles
        WHERE user_id = check_user_id
          AND role = 'admin'
          AND is_active = true
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin_or_owner(check_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- Direct query bypasses RLS recursion
    -- SECURITY DEFINER allows this function to see all app_roles rows
    RETURN EXISTS (
        SELECT 1 FROM app_roles
        WHERE user_id = check_user_id
          AND role IN ('admin', 'owner')
          AND is_active = true
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_audit_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM app_roles
        WHERE user_id = auth.uid()
          AND role = 'admin'
          AND is_active = true
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_audit_manager()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM app_roles
        WHERE user_id = auth.uid()
          AND role = 'manager'
          AND is_active = true
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_audit_owner()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM app_roles
        WHERE user_id = auth.uid()
          AND role = 'owner'
          AND is_active = true
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_manager(check_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM app_roles
        WHERE user_id = check_user_id
          AND role = 'manager'
          AND is_active = true
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.monthly_archive_until(final_cutoff_date timestamp with time zone, dry_run boolean DEFAULT true)
 RETURNS TABLE(month_archived date, logs_archived bigint)
 LANGUAGE plpgsql
AS $function$
DECLARE
    current_month_start DATE;
    next_month_start DATE;
    result RECORD;
BEGIN
    -- Start from the oldest log
    SELECT DATE_TRUNC('month', MIN(created_at))::DATE INTO current_month_start
    FROM audit_logs
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
        SELECT * INTO result FROM archive_audit_logs(
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
AS $function$
DECLARE
    restored_count BIGINT;
BEGIN
    -- Move logs back to active table
    WITH restored AS (
        INSERT INTO audit_logs
        SELECT * FROM audit_logs_archive
        WHERE created_at BETWEEN start_date AND end_date
        RETURNING audit_id
    )
    SELECT COUNT(*) INTO restored_count FROM restored;

    -- Delete from archive
    DELETE FROM audit_logs_archive
    WHERE created_at BETWEEN start_date AND end_date;

    RAISE NOTICE 'Restored % logs from archive', restored_count;
    RAISE NOTICE 'Run manually: VACUUM ANALYZE audit_logs;';

    RETURN restored_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.revoke_audit_role(target_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- Security check: Only admins can revoke roles
    IF NOT is_audit_admin() THEN
        RAISE EXCEPTION 'Permission denied: Only admins can revoke roles';
    END IF;

    -- Prevent self-revocation
    IF target_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Cannot revoke your own admin role. Ask another admin.';
    END IF;

    -- Soft delete: mark as inactive instead of hard delete
    UPDATE app_roles
    SET is_active = false,
        notes = COALESCE(notes || E'\n', '') || 'Revoked by ' || (SELECT email FROM app_roles WHERE user_id = auth.uid()) || ' on ' || NOW()::TEXT
    WHERE user_id = target_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User % does not have an audit role', target_user_id;
    END IF;

    RAISE NOTICE 'Role revoked for user %', target_user_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_guest_statistics()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
  BEGIN
      -- Handle the specific guest affected by this booking change
      IF TG_OP = 'DELETE' THEN
          -- Update statistics for the deleted booking's guest
          IF OLD.guest_id IS NOT NULL THEN
              UPDATE guests
              SET
                  total_bookings = (
                      SELECT COUNT(*)
                      FROM bookings
                      WHERE guest_id = OLD.guest_id
                          AND booking_status NOT IN ('Cancelled')
                  ),
                  total_spent = (
                      SELECT COALESCE(SUM(total_amount), 0)
                      FROM bookings
                      WHERE guest_id = OLD.guest_id
                          AND booking_status = 'CheckedOut'
                          AND payment_status = 'Completed'
                  ),
                  updated_at = NOW()
              WHERE guest_id = OLD.guest_id;
          END IF;
          RETURN OLD;
      ELSE
          -- Handle INSERT or UPDATE
          IF NEW.guest_id IS NOT NULL THEN
              UPDATE guests
              SET
                  total_bookings = (
                      SELECT COUNT(*)
                      FROM bookings
                      WHERE guest_id = NEW.guest_id
                          AND booking_status NOT IN ('Cancelled')
                  ),
                  total_spent = (
                      SELECT COALESCE(SUM(total_amount), 0)
                      FROM bookings
                      WHERE guest_id = NEW.guest_id
                          AND booking_status = 'CheckedOut'
                          AND payment_status = 'Completed'
                  ),
                  updated_at = NOW()
              WHERE guest_id = NEW.guest_id;
          END IF;
          RETURN NEW;
      END IF;
  END;
  $function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;



