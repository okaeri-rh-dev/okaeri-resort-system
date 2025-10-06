


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "btree_gist" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."archive_audit_logs"("cutoff_date" timestamp with time zone, "dry_run" boolean DEFAULT true) RETURNS TABLE("archived_count" bigint, "oldest_archived" timestamp with time zone, "newest_archived" timestamp with time zone, "tables_affected" "text"[])
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."archive_audit_logs"("cutoff_date" timestamp with time zone, "dry_run" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."archive_audit_logs"("cutoff_date" timestamp with time zone, "dry_run" boolean) IS 'Moves audit logs older than cutoff_date to audit_logs_archive table. Use dry_run=TRUE to preview without executing. Returns count of archived logs. Tamper-evident archive-move pattern instead of direct delete.';



CREATE OR REPLACE FUNCTION "public"."archive_logs_older_than_months"("months_old" integer, "dry_run" boolean DEFAULT true) RETURNS TABLE("archived_count" bigint, "oldest_archived" timestamp with time zone, "newest_archived" timestamp with time zone, "tables_affected" "text"[])
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM archive_audit_logs(
        NOW() - (months_old || ' months')::INTERVAL,
        dry_run
    );
END;
$$;


ALTER FUNCTION "public"."archive_logs_older_than_months"("months_old" integer, "dry_run" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."archive_logs_older_than_months"("months_old" integer, "dry_run" boolean) IS 'Convenience wrapper to archive logs older than specified number of months. Example: archive_logs_older_than_months(12, TRUE) for 1 year dry run.';



CREATE OR REPLACE FUNCTION "public"."attach_audit_trigger"("target_table" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    EXECUTE format('
        CREATE TRIGGER audit_%I_trigger
        AFTER INSERT OR UPDATE OR DELETE ON %I
        FOR EACH ROW EXECUTE FUNCTION audit_trigger_func()
    ', target_table, target_table);

    RAISE NOTICE 'Audit trigger attached to table: %', target_table;
END;
$$;


ALTER FUNCTION "public"."attach_audit_trigger"("target_table" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."attach_audit_trigger"("target_table" "text") IS 'Convenience function to attach audit trigger to a table. Creates trigger named audit_{table}_trigger.';



CREATE OR REPLACE FUNCTION "public"."audit_trigger_func"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
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
$_$;


ALTER FUNCTION "public"."audit_trigger_func"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."audit_trigger_func"() IS 'Generic audit trigger function that captures all database changes. Automatically extracts user context from Supabase Auth, redacts PII, and stores before/after data in JSONB format.';



CREATE OR REPLACE FUNCTION "public"."can_view_all_audit_logs"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM app_roles
        WHERE user_id = auth.uid()
          AND role IN ('admin', 'owner')
          AND is_active = true
    );
END;
$$;


ALTER FUNCTION "public"."can_view_all_audit_logs"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."can_view_all_audit_logs"() IS 'Returns TRUE if current user can view all audit logs (admin or owner role).';



CREATE OR REPLACE FUNCTION "public"."check_unit_availability"("p_unit_id" "uuid", "p_check_in" timestamp with time zone, "p_check_out" timestamp with time zone) RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."check_unit_availability"("p_unit_id" "uuid", "p_check_in" timestamp with time zone, "p_check_out" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."detach_audit_trigger"("target_table" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%I_trigger ON %I',
        target_table, target_table);
    RAISE NOTICE 'Audit trigger detached from table: %', target_table;
END;
$$;


ALTER FUNCTION "public"."detach_audit_trigger"("target_table" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."detach_audit_trigger"("target_table" "text") IS 'Remove audit trigger from a table. Useful for debugging or temporary disablement.';



CREATE OR REPLACE FUNCTION "public"."enforce_audit_identity_func"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."enforce_audit_identity_func"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."enforce_audit_identity_func"() IS 'Enforces server-side user identity for Layer 2 audit logs. Prevents clients from forging user_id, user_email, or source fields.';



CREATE OR REPLACE FUNCTION "public"."generate_booking_reference"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."generate_booking_reference"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_audit_role"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_current_audit_role"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_current_audit_role"() IS 'Returns current user audit role: admin|owner|manager|staff|none. Preferred for UI route guards.';



CREATE OR REPLACE FUNCTION "public"."grant_audit_role"("target_user_id" "uuid", "target_email" "text", "target_role" "text", "grant_notes" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."grant_audit_role"("target_user_id" "uuid", "target_email" "text", "target_role" "text", "grant_notes" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."grant_audit_role"("target_user_id" "uuid", "target_email" "text", "target_role" "text", "grant_notes" "text") IS 'Grants audit role to a user. Only admins can execute. Updates existing role if user already has one.';



CREATE OR REPLACE FUNCTION "public"."is_admin"("check_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM app_roles
        WHERE user_id = check_user_id
          AND role = 'admin'
          AND is_active = true
    );
END;
$$;


ALTER FUNCTION "public"."is_admin"("check_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_admin"("check_user_id" "uuid") IS 'SECURITY DEFINER helper to check admin role without RLS recursion. Used for app_roles management policies.';



CREATE OR REPLACE FUNCTION "public"."is_admin_or_owner"("check_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."is_admin_or_owner"("check_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_admin_or_owner"("check_user_id" "uuid") IS 'SECURITY DEFINER helper to check admin/owner role without RLS recursion. Used by RLS policies to break circular dependencies.';



CREATE OR REPLACE FUNCTION "public"."is_audit_admin"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM app_roles
        WHERE user_id = auth.uid()
          AND role = 'admin'
          AND is_active = true
    );
END;
$$;


ALTER FUNCTION "public"."is_audit_admin"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_audit_admin"() IS 'Returns TRUE if current user has admin role, FALSE otherwise.';



CREATE OR REPLACE FUNCTION "public"."is_audit_manager"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM app_roles
        WHERE user_id = auth.uid()
          AND role = 'manager'
          AND is_active = true
    );
END;
$$;


ALTER FUNCTION "public"."is_audit_manager"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_audit_manager"() IS 'Returns TRUE if current user has manager role, FALSE otherwise.';



CREATE OR REPLACE FUNCTION "public"."is_audit_owner"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM app_roles
        WHERE user_id = auth.uid()
          AND role = 'owner'
          AND is_active = true
    );
END;
$$;


ALTER FUNCTION "public"."is_audit_owner"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_audit_owner"() IS 'Returns TRUE if current user has owner role, FALSE otherwise.';



CREATE OR REPLACE FUNCTION "public"."is_manager"("check_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM app_roles
        WHERE user_id = check_user_id
          AND role = 'manager'
          AND is_active = true
    );
END;
$$;


ALTER FUNCTION "public"."is_manager"("check_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_manager"("check_user_id" "uuid") IS 'SECURITY DEFINER helper to check manager role without RLS recursion.';



CREATE OR REPLACE FUNCTION "public"."monthly_archive_until"("final_cutoff_date" timestamp with time zone, "dry_run" boolean DEFAULT true) RETURNS TABLE("month_archived" "date", "logs_archived" bigint)
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."monthly_archive_until"("final_cutoff_date" timestamp with time zone, "dry_run" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."monthly_archive_until"("final_cutoff_date" timestamp with time zone, "dry_run" boolean) IS 'Archives logs in monthly chunks to avoid long-running transactions. Useful for archiving >100K logs.';



CREATE OR REPLACE FUNCTION "public"."restore_logs_from_archive"("start_date" timestamp with time zone, "end_date" timestamp with time zone) RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."restore_logs_from_archive"("start_date" timestamp with time zone, "end_date" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."restore_logs_from_archive"("start_date" timestamp with time zone, "end_date" timestamp with time zone) IS 'Restores logs from archive table back to active audit_logs table for specified date range.';



CREATE OR REPLACE FUNCTION "public"."revoke_audit_role"("target_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."revoke_audit_role"("target_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."revoke_audit_role"("target_user_id" "uuid") IS 'Revokes audit role from a user (soft delete: marks as inactive). Only admins can execute. Prevents self-revocation.';



CREATE OR REPLACE FUNCTION "public"."update_guest_statistics"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
  $$;


ALTER FUNCTION "public"."update_guest_statistics"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."app_roles" (
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" character varying(20) NOT NULL,
    "granted_by" "uuid",
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "notes" "text",
    CONSTRAINT "app_roles_role_check" CHECK ((("role")::"text" = ANY ((ARRAY['admin'::character varying, 'owner'::character varying, 'manager'::character varying, 'staff'::character varying])::"text"[])))
);


ALTER TABLE "public"."app_roles" OWNER TO "postgres";


COMMENT ON TABLE "public"."app_roles" IS 'User role assignments for audit trail access control. Provides runtime-reconfigurable role management without requiring database admin privileges.';



COMMENT ON COLUMN "public"."app_roles"."user_id" IS 'Foreign key to auth.users. Primary key ensures one role per user.';



COMMENT ON COLUMN "public"."app_roles"."role" IS 'User role: admin (full system access + role management), owner (all audit logs), manager (business operations only), staff (own logs only).';



COMMENT ON COLUMN "public"."app_roles"."granted_by" IS 'User who granted this role. NULL for bootstrap/system grants.';



COMMENT ON COLUMN "public"."app_roles"."granted_at" IS 'Timestamp when role was granted.';



COMMENT ON COLUMN "public"."app_roles"."notes" IS 'Optional notes about why role was granted or any special conditions.';



CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "audit_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "correlation_id" "uuid" DEFAULT "gen_random_uuid"(),
    "table_name" "text" NOT NULL,
    "record_id" "text",
    "record_pk" "jsonb",
    "action" character varying(10) NOT NULL,
    "event_type" character varying(50),
    "source" character varying(10) DEFAULT 'db'::character varying NOT NULL,
    "user_id" "uuid",
    "user_email" "text",
    "user_role" "text",
    "old_data" "jsonb",
    "new_data" "jsonb",
    "changed_fields" "text"[],
    "description" "text",
    "category" character varying(50),
    "severity" character varying(20),
    "metadata" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "audit_logs_action_check" CHECK ((("action")::"text" = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::"text"[]))),
    CONSTRAINT "audit_logs_severity_check" CHECK ((("severity")::"text" = ANY ((ARRAY['INFO'::character varying, 'WARNING'::character varying, 'CRITICAL'::character varying, 'DEBUG'::character varying])::"text"[]))),
    CONSTRAINT "audit_logs_source_check" CHECK ((("source")::"text" = ANY ((ARRAY['db'::character varying, 'app'::character varying])::"text"[]))),
    CONSTRAINT "valid_changed_fields" CHECK (((("source")::"text" = 'app'::"text") OR (("action")::"text" <> 'UPDATE'::"text") OR (("changed_fields" IS NOT NULL) AND ("array_length"("changed_fields", 1) > 0)))),
    CONSTRAINT "valid_event_type" CHECK ((((("source")::"text" = 'db'::"text") AND ("event_type" IS NULL)) OR (("source")::"text" = 'app'::"text")))
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."audit_logs" IS 'Complete audit trail of all database changes. Populated by PostgreSQL triggers (automatic) and application-level logging (selective).';



COMMENT ON COLUMN "public"."audit_logs"."audit_id" IS 'Unique identifier for this audit entry';



COMMENT ON COLUMN "public"."audit_logs"."correlation_id" IS 'UUID for linking related log entries across layers. Defaults to random UUID. App can pass explicit value to correlate trigger logs with business context logs.';



COMMENT ON COLUMN "public"."audit_logs"."table_name" IS 'Name of the table that was modified (e.g., bookings, units, payments)';



COMMENT ON COLUMN "public"."audit_logs"."record_id" IS 'Identifier of the specific record that was modified. TEXT type for flexibility with UUID and non-UUID primary keys.';



COMMENT ON COLUMN "public"."audit_logs"."record_pk" IS 'Full composite primary key as JSONB for tables with multi-column PKs. NULL for simple single-column PKs.';



COMMENT ON COLUMN "public"."audit_logs"."action" IS 'Type of database operation: INSERT, UPDATE, or DELETE';



COMMENT ON COLUMN "public"."audit_logs"."event_type" IS 'Business event type for application-level logs. Examples: login, logout, cancel_booking, refund_payment. NULL for database trigger logs.';



COMMENT ON COLUMN "public"."audit_logs"."source" IS 'Source of audit log: db (database trigger), app (application logging)';



COMMENT ON COLUMN "public"."audit_logs"."user_id" IS 'Foreign key to auth.users. NULL for system operations or unauthenticated actions.';



COMMENT ON COLUMN "public"."audit_logs"."user_email" IS 'Email address of the user who made the change. Denormalized for query performance.';



COMMENT ON COLUMN "public"."audit_logs"."user_role" IS 'User role at time of action (owner, manager, staff). Captured from JWT claims.';



COMMENT ON COLUMN "public"."audit_logs"."old_data" IS 'Complete record state BEFORE the change. NULL for INSERT operations. Stored as JSONB for flexibility.';



COMMENT ON COLUMN "public"."audit_logs"."new_data" IS 'Complete record state AFTER the change. NULL for DELETE operations. Stored as JSONB for flexibility.';



COMMENT ON COLUMN "public"."audit_logs"."changed_fields" IS 'Array of field names that changed during UPDATE. Enables fast filtering (e.g., find all base_rate changes).';



COMMENT ON COLUMN "public"."audit_logs"."description" IS 'Human-readable description from application layer. Example: "Changed booking status from Pending to Confirmed"';



COMMENT ON COLUMN "public"."audit_logs"."category" IS 'Categorization for filtering: auth, booking, payment, unit, guest, expense, maintenance, system';



COMMENT ON COLUMN "public"."audit_logs"."severity" IS 'Severity level for monitoring: INFO (default), WARNING (suspicious), CRITICAL (requires attention), DEBUG (verbose)';



COMMENT ON COLUMN "public"."audit_logs"."metadata" IS 'Additional structured context from application layer. Flexible JSONB for business-specific data.';



COMMENT ON COLUMN "public"."audit_logs"."ip_address" IS 'IP address of client that initiated the change. Captured from application layer when available.';



COMMENT ON COLUMN "public"."audit_logs"."user_agent" IS 'Browser user agent string. Captured from application layer for client identification.';



COMMENT ON COLUMN "public"."audit_logs"."created_at" IS 'Timestamp when audit log was created (UTC with timezone)';



CREATE TABLE IF NOT EXISTS "public"."audit_logs_archive" (
    "audit_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "correlation_id" "uuid" DEFAULT "gen_random_uuid"(),
    "table_name" "text" NOT NULL,
    "record_id" "text",
    "record_pk" "jsonb",
    "action" character varying(10) NOT NULL,
    "event_type" character varying(50),
    "source" character varying(10) DEFAULT 'db'::character varying NOT NULL,
    "user_id" "uuid",
    "user_email" "text",
    "user_role" "text",
    "old_data" "jsonb",
    "new_data" "jsonb",
    "changed_fields" "text"[],
    "description" "text",
    "category" character varying(50),
    "severity" character varying(20),
    "metadata" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "audit_logs_action_check" CHECK ((("action")::"text" = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::"text"[]))),
    CONSTRAINT "audit_logs_severity_check" CHECK ((("severity")::"text" = ANY ((ARRAY['INFO'::character varying, 'WARNING'::character varying, 'CRITICAL'::character varying, 'DEBUG'::character varying])::"text"[]))),
    CONSTRAINT "audit_logs_source_check" CHECK ((("source")::"text" = ANY ((ARRAY['db'::character varying, 'app'::character varying])::"text"[]))),
    CONSTRAINT "valid_changed_fields" CHECK (((("source")::"text" = 'app'::"text") OR (("action")::"text" <> 'UPDATE'::"text") OR (("changed_fields" IS NOT NULL) AND ("array_length"("changed_fields", 1) > 0)))),
    CONSTRAINT "valid_event_type" CHECK ((((("source")::"text" = 'db'::"text") AND ("event_type" IS NULL)) OR (("source")::"text" = 'app'::"text")))
);


ALTER TABLE "public"."audit_logs_archive" OWNER TO "postgres";


COMMENT ON TABLE "public"."audit_logs_archive" IS 'Archive storage for audit logs. Populated by archive_audit_logs() function. Logs are moved (not copied) from audit_logs to reduce active table size while maintaining audit trail.';



CREATE OR REPLACE VIEW "public"."audit_archive_stats" AS
 SELECT 'Active Logs'::"text" AS "status",
    "count"(*) AS "log_count",
    "min"("audit_logs"."created_at") AS "oldest_log",
    "max"("audit_logs"."created_at") AS "newest_log",
    "pg_size_pretty"("pg_total_relation_size"('"public"."audit_logs"'::"regclass")) AS "total_size"
   FROM "public"."audit_logs"
UNION ALL
 SELECT 'Archived Logs'::"text" AS "status",
    "count"(*) AS "log_count",
    "min"("audit_logs_archive"."created_at") AS "oldest_log",
    "max"("audit_logs_archive"."created_at") AS "newest_log",
    "pg_size_pretty"("pg_total_relation_size"('"public"."audit_logs_archive"'::"regclass")) AS "total_size"
   FROM "public"."audit_logs_archive";


ALTER VIEW "public"."audit_archive_stats" OWNER TO "postgres";


COMMENT ON VIEW "public"."audit_archive_stats" IS 'Summary statistics for active and archived audit logs';



CREATE OR REPLACE VIEW "public"."audit_index_stats" AS
 SELECT "schemaname",
    "relname" AS "tablename",
    "indexrelname" AS "indexname",
    "pg_size_pretty"("pg_relation_size"(("indexrelid")::"regclass")) AS "index_size",
    "idx_scan" AS "times_used",
    "idx_tup_read" AS "rows_read",
    "idx_tup_fetch" AS "rows_fetched"
   FROM "pg_stat_user_indexes"
  WHERE ("relname" = 'audit_logs'::"name")
  ORDER BY ("pg_relation_size"(("indexrelid")::"regclass")) DESC;


ALTER VIEW "public"."audit_index_stats" OWNER TO "postgres";


COMMENT ON VIEW "public"."audit_index_stats" IS 'Monitor index usage and size for audit_logs table';



CREATE OR REPLACE VIEW "public"."audit_system_status" AS
 SELECT 'Tables'::"text" AS "component",
    "count"(*) AS "count",
    "string_agg"(("tables"."table_name")::"text", ', '::"text" ORDER BY (("tables"."table_name")::"text")) AS "details"
   FROM "information_schema"."tables"
  WHERE ((("tables"."table_schema")::"name" = 'public'::"name") AND (("tables"."table_name")::"name" = ANY (ARRAY['audit_logs'::"name", 'audit_logs_archive'::"name", 'app_roles'::"name"])))
UNION ALL
 SELECT 'Triggers'::"text" AS "component",
    "count"(*) AS "count",
    "string_agg"(("triggers"."trigger_name")::"text", ', '::"text" ORDER BY (("triggers"."trigger_name")::"text")) AS "details"
   FROM "information_schema"."triggers"
  WHERE ((("triggers"."trigger_name")::"name" ~~ 'audit_%'::"text") OR (("triggers"."trigger_name")::"name" = 'enforce_audit_identity'::"name"))
UNION ALL
 SELECT 'Indexes'::"text" AS "component",
    "count"(*) AS "count",
    "string_agg"(("pg_indexes"."indexname")::"text", ', '::"text" ORDER BY (("pg_indexes"."indexname")::"text")) AS "details"
   FROM "pg_indexes"
  WHERE (("pg_indexes"."tablename" = 'audit_logs'::"name") AND ("pg_indexes"."indexname" ~~ 'idx_audit_logs_%'::"text"))
UNION ALL
 SELECT 'Policies (audit_logs)'::"text" AS "component",
    "count"(*) AS "count",
    "string_agg"(("pg_policies"."policyname")::"text", ', '::"text" ORDER BY (("pg_policies"."policyname")::"text")) AS "details"
   FROM "pg_policies"
  WHERE ("pg_policies"."tablename" = 'audit_logs'::"name")
UNION ALL
 SELECT 'Active Roles'::"text" AS "component",
    "count"(*) AS "count",
    "string_agg"((((("app_roles"."role")::"text" || ' ('::"text") || "app_roles"."email") || ')'::"text"), ', '::"text" ORDER BY "app_roles"."role") AS "details"
   FROM "public"."app_roles"
  WHERE ("app_roles"."is_active" = true)
UNION ALL
 SELECT 'Archive Functions'::"text" AS "component",
    "count"(*) AS "count",
    "string_agg"(("routines"."routine_name")::"text", ', '::"text" ORDER BY (("routines"."routine_name")::"text")) AS "details"
   FROM "information_schema"."routines"
  WHERE ((("routines"."routine_schema")::"name" = 'public'::"name") AND (("routines"."routine_name")::"name" = ANY (ARRAY['archive_audit_logs'::"name", 'archive_logs_older_than_months'::"name", 'monthly_archive_until'::"name", 'restore_logs_from_archive'::"name"])))
UNION ALL
 SELECT 'Helper Functions'::"text" AS "component",
    "count"(*) AS "count",
    "string_agg"(("routines"."routine_name")::"text", ', '::"text" ORDER BY (("routines"."routine_name")::"text")) AS "details"
   FROM "information_schema"."routines"
  WHERE ((("routines"."routine_schema")::"name" = 'public'::"name") AND (("routines"."routine_name")::"name" = ANY (ARRAY['get_current_audit_role'::"name", 'is_audit_admin'::"name", 'is_audit_owner'::"name", 'is_audit_manager'::"name", 'can_view_all_audit_logs'::"name", 'grant_audit_role'::"name", 'revoke_audit_role'::"name"])));


ALTER VIEW "public"."audit_system_status" OWNER TO "postgres";


COMMENT ON VIEW "public"."audit_system_status" IS 'Complete overview of audit system configuration: tables, triggers, indexes, policies, roles, and functions';



CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "booking_id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "booking_reference" character varying(20) NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "guest_id" "uuid",
    "guest_name" character varying(100) NOT NULL,
    "contact_number" character varying(20) NOT NULL,
    "email" character varying(100) NOT NULL,
    "num_guests" integer NOT NULL,
    "check_in" "date" NOT NULL,
    "check_out" "date" NOT NULL,
    "total_amount" numeric(10,2) NOT NULL,
    "booking_status" character varying(20) DEFAULT 'Pending'::character varying,
    "payment_status" character varying(20) DEFAULT 'Pending'::character varying,
    "payment_method" character varying(20),
    "payment_proof_url" "text",
    "special_requests" "text",
    "internal_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_guest_booking" boolean DEFAULT false,
    "upload_status" "text",
    "upload_expires_at" timestamp with time zone,
    CONSTRAINT "bookings_booking_status_check" CHECK ((("booking_status")::"text" = ANY ((ARRAY['Pending'::character varying, 'Confirmed'::character varying, 'CheckedIn'::character varying, 'CheckedOut'::character varying, 'Cancelled'::character varying])::"text"[]))),
    CONSTRAINT "bookings_check" CHECK (("check_out" > "check_in")),
    CONSTRAINT "bookings_num_guests_check" CHECK (("num_guests" > 0)),
    CONSTRAINT "bookings_payment_status_check" CHECK ((("payment_status")::"text" = ANY ((ARRAY['Pending'::character varying, 'Partial'::character varying, 'Completed'::character varying, 'Refunded'::character varying])::"text"[]))),
    CONSTRAINT "bookings_total_amount_check" CHECK (("total_amount" >= (0)::numeric)),
    CONSTRAINT "bookings_upload_status_check" CHECK (("upload_status" = ANY (ARRAY['pending'::"text", 'uploaded'::"text", 'verified'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."bookings"."payment_proof_url" IS 'Storage path for uploaded payment proof (receipts, screenshots)';



COMMENT ON COLUMN "public"."bookings"."is_guest_booking" IS 'True for bookings created via guest portal, requiring admin review';



COMMENT ON COLUMN "public"."bookings"."upload_status" IS 'Status of payment proof upload: pending, uploaded, verified, rejected';



COMMENT ON COLUMN "public"."bookings"."upload_expires_at" IS 'Expiration time for payment proof upload (cleanup after this time)';



CREATE TABLE IF NOT EXISTS "public"."bookings_conflict_backup" (
    "booking_id" "uuid",
    "booking_reference" character varying(20),
    "unit_id" "uuid",
    "guest_id" "uuid",
    "guest_name" character varying(100),
    "contact_number" character varying(20),
    "email" character varying(100),
    "num_guests" integer,
    "check_in" "date",
    "check_out" "date",
    "total_amount" numeric(10,2),
    "booking_status" character varying(20),
    "payment_status" character varying(20),
    "payment_method" character varying(20),
    "payment_proof_url" "text",
    "special_requests" "text",
    "internal_notes" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "is_guest_booking" boolean,
    "upload_status" "text",
    "upload_expires_at" timestamp with time zone
);


ALTER TABLE "public"."bookings_conflict_backup" OWNER TO "postgres";


COMMENT ON TABLE "public"."bookings_conflict_backup" IS 'Backup table for booking conflicts resolved during migration 014. Contains audit trail of auto-cancelled duplicate bookings. Admin-only access via RLS.';



CREATE TABLE IF NOT EXISTS "public"."expenses" (
    "expense_id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "category" character varying(50) NOT NULL,
    "description" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "expense_date" "date" NOT NULL,
    "receipt_url" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "expenses_amount_check" CHECK (("amount" > (0)::numeric))
);


ALTER TABLE "public"."expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guests" (
    "guest_id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "guest_name" character varying(100) NOT NULL,
    "email" character varying(100) NOT NULL,
    "phone_number" character varying(20) NOT NULL,
    "total_bookings" integer DEFAULT 0,
    "total_spent" numeric(12,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."guests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."maintenance_logs" (
    "log_id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "unit_id" "uuid",
    "issue_description" "text" NOT NULL,
    "status" character varying(20) DEFAULT 'Pending'::character varying,
    "priority" character varying(20) DEFAULT 'Medium'::character varying,
    "reported_date" "date" DEFAULT CURRENT_DATE,
    "resolved_date" "date",
    "cost" numeric(10,2),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."maintenance_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "payment_id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "booking_id" "uuid",
    "amount" numeric(10,2) NOT NULL,
    "payment_method" character varying(50),
    "payment_date" timestamp with time zone DEFAULT "now"(),
    "proof_url" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "payments_amount_check" CHECK (("amount" > (0)::numeric))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."units" (
    "unit_id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "unit_name" character varying(100) NOT NULL,
    "unit_code" character varying(10) NOT NULL,
    "unit_type" character varying(20) NOT NULL,
    "max_occupancy" integer NOT NULL,
    "base_rate" numeric(10,2) NOT NULL,
    "weekend_rate" numeric(10,2) NOT NULL,
    "unit_status" character varying(20) DEFAULT 'Available'::character varying,
    "amenities" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "base_occupancy" integer NOT NULL,
    "extra_person_rate" numeric(10,2) NOT NULL,
    CONSTRAINT "chk_base_occupancy" CHECK ((("base_occupancy" > 0) AND ("base_occupancy" <= "max_occupancy"))),
    CONSTRAINT "chk_extra_person_rate" CHECK (("extra_person_rate" >= (0)::numeric)),
    CONSTRAINT "units_base_rate_check" CHECK (("base_rate" >= (0)::numeric)),
    CONSTRAINT "units_max_occupancy_check" CHECK (("max_occupancy" > 0)),
    CONSTRAINT "units_unit_status_check" CHECK ((("unit_status")::"text" = ANY ((ARRAY['Available'::character varying, 'Occupied'::character varying, 'Maintenance'::character varying, 'Reserved'::character varying])::"text"[]))),
    CONSTRAINT "units_unit_type_check" CHECK ((("unit_type")::"text" = ANY ((ARRAY['Standard'::character varying, 'Deluxe'::character varying, 'Suite'::character varying, 'Villa'::character varying])::"text"[]))),
    CONSTRAINT "units_weekend_rate_check" CHECK (("weekend_rate" >= (0)::numeric))
);


ALTER TABLE "public"."units" OWNER TO "postgres";


COMMENT ON COLUMN "public"."units"."base_occupancy" IS 'Number of guests included in the base rate';



COMMENT ON COLUMN "public"."units"."extra_person_rate" IS 'Additional rate per person exceeding base occupancy';



ALTER TABLE ONLY "public"."app_roles"
    ADD CONSTRAINT "app_roles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."audit_logs_archive"
    ADD CONSTRAINT "audit_logs_archive_pkey" PRIMARY KEY ("audit_id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("audit_id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_booking_reference_key" UNIQUE ("booking_reference");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("booking_id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_pkey" PRIMARY KEY ("expense_id");



ALTER TABLE ONLY "public"."guests"
    ADD CONSTRAINT "guests_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."guests"
    ADD CONSTRAINT "guests_pkey" PRIMARY KEY ("guest_id");



ALTER TABLE ONLY "public"."maintenance_logs"
    ADD CONSTRAINT "maintenance_logs_pkey" PRIMARY KEY ("log_id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "no_overlapping_bookings" EXCLUDE USING "gist" ("unit_id" WITH =, "tsrange"(("check_in")::timestamp without time zone, ("check_out")::timestamp without time zone, '[)'::"text") WITH &&) WHERE (((("is_guest_booking" = false) AND (("booking_status")::"text" <> 'Cancelled'::"text")) OR (("is_guest_booking" = true) AND (("booking_status")::"text" = ANY ((ARRAY['Confirmed'::character varying, 'CheckedIn'::character varying, 'CheckedOut'::character varying])::"text"[])))));



COMMENT ON CONSTRAINT "no_overlapping_bookings" ON "public"."bookings" IS 'Prevents double bookings by ensuring no overlapping date ranges for the same unit.
Applies to all non-cancelled authenticated bookings and confirmed guest bookings.';



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("payment_id");



ALTER TABLE ONLY "public"."units"
    ADD CONSTRAINT "units_pkey" PRIMARY KEY ("unit_id");



ALTER TABLE ONLY "public"."units"
    ADD CONSTRAINT "units_unit_code_key" UNIQUE ("unit_code");



ALTER TABLE ONLY "public"."units"
    ADD CONSTRAINT "units_unit_name_key" UNIQUE ("unit_name");



CREATE INDEX "idx_app_roles_active" ON "public"."app_roles" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_app_roles_role" ON "public"."app_roles" USING "btree" ("role");



CREATE INDEX "idx_audit_logs_action" ON "public"."audit_logs" USING "btree" ("action");



COMMENT ON INDEX "public"."idx_audit_logs_action" IS 'Optimizes queries filtering by action type (INSERT, UPDATE, DELETE)';



CREATE INDEX "idx_audit_logs_archive_correlation" ON "public"."audit_logs_archive" USING "btree" ("correlation_id");



CREATE INDEX "idx_audit_logs_archive_record" ON "public"."audit_logs_archive" USING "btree" ("table_name", "record_id");



CREATE INDEX "idx_audit_logs_archive_table_name" ON "public"."audit_logs_archive" USING "btree" ("table_name");



CREATE INDEX "idx_audit_logs_archive_timestamp" ON "public"."audit_logs_archive" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_audit_logs_archive_user_context" ON "public"."audit_logs_archive" USING "btree" ("user_email", "user_id");



CREATE INDEX "idx_audit_logs_category" ON "public"."audit_logs" USING "btree" ("category", "created_at" DESC) WHERE ("category" IS NOT NULL);



COMMENT ON INDEX "public"."idx_audit_logs_category" IS 'Optimizes application-layer category queries (only indexes non-null categories)';



CREATE INDEX "idx_audit_logs_composite" ON "public"."audit_logs" USING "btree" ("table_name", "user_email", "created_at" DESC);



COMMENT ON INDEX "public"."idx_audit_logs_composite" IS 'Optimizes complex multi-filter queries (table + user + date range)';



CREATE INDEX "idx_audit_logs_correlation" ON "public"."audit_logs" USING "btree" ("correlation_id");



COMMENT ON INDEX "public"."idx_audit_logs_correlation" IS 'Optimizes queries that find all logs for a specific correlation_id';



CREATE INDEX "idx_audit_logs_keyset" ON "public"."audit_logs" USING "btree" ("created_at" DESC, "audit_id" DESC);



COMMENT ON INDEX "public"."idx_audit_logs_keyset" IS 'Optimizes keyset (cursor-based) pagination for large datasets without OFFSET scan penalty';



CREATE INDEX "idx_audit_logs_record" ON "public"."audit_logs" USING "btree" ("table_name", "record_id");



COMMENT ON INDEX "public"."idx_audit_logs_record" IS 'Optimizes record history queries (all changes to a specific booking/unit)';



CREATE INDEX "idx_audit_logs_table_name" ON "public"."audit_logs" USING "btree" ("table_name");



COMMENT ON INDEX "public"."idx_audit_logs_table_name" IS 'Optimizes queries filtering by specific tables (bookings, units, etc)';



CREATE INDEX "idx_audit_logs_timestamp" ON "public"."audit_logs" USING "btree" ("created_at" DESC);



COMMENT ON INDEX "public"."idx_audit_logs_timestamp" IS 'Optimizes date range queries and recent-first ordering';



CREATE INDEX "idx_audit_logs_user_context" ON "public"."audit_logs" USING "btree" ("user_email", "user_id");



COMMENT ON INDEX "public"."idx_audit_logs_user_context" IS 'Optimizes queries filtering by user email or user ID';



CREATE INDEX "idx_bookings_dates" ON "public"."bookings" USING "btree" ("check_in", "check_out");



CREATE INDEX "idx_bookings_email" ON "public"."bookings" USING "btree" ("email");



CREATE INDEX "idx_bookings_exclusion_helper" ON "public"."bookings" USING "btree" ("unit_id", "check_in", "check_out") WHERE (("booking_status")::"text" <> 'Cancelled'::"text");



CREATE INDEX "idx_bookings_guest" ON "public"."bookings" USING "btree" ("guest_id");



CREATE INDEX "idx_bookings_is_guest_booking" ON "public"."bookings" USING "btree" ("is_guest_booking");



CREATE INDEX "idx_bookings_reference_email" ON "public"."bookings" USING "btree" ("booking_reference", "email");



CREATE INDEX "idx_bookings_status" ON "public"."bookings" USING "btree" ("booking_status");



CREATE INDEX "idx_bookings_unit_dates" ON "public"."bookings" USING "btree" ("unit_id", "check_in", "check_out");



CREATE INDEX "idx_bookings_upload_status" ON "public"."bookings" USING "btree" ("upload_status");



CREATE INDEX "idx_guests_email" ON "public"."guests" USING "btree" ("email");



CREATE INDEX "idx_payments_booking" ON "public"."payments" USING "btree" ("booking_id");



CREATE INDEX "idx_units_occupancy_pricing" ON "public"."units" USING "btree" ("base_occupancy", "extra_person_rate");



CREATE INDEX "idx_units_status" ON "public"."units" USING "btree" ("unit_status");



CREATE OR REPLACE TRIGGER "audit_bookings_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger_func"();



CREATE OR REPLACE TRIGGER "audit_expenses_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."expenses" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger_func"();



CREATE OR REPLACE TRIGGER "audit_guests_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."guests" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger_func"();



CREATE OR REPLACE TRIGGER "audit_maintenance_logs_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."maintenance_logs" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger_func"();



CREATE OR REPLACE TRIGGER "audit_payments_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger_func"();



CREATE OR REPLACE TRIGGER "audit_units_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."units" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger_func"();



CREATE OR REPLACE TRIGGER "enforce_audit_identity" BEFORE INSERT ON "public"."audit_logs" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_audit_identity_func"();



CREATE OR REPLACE TRIGGER "trigger_update_guest_statistics" AFTER INSERT OR DELETE OR UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."update_guest_statistics"();



CREATE OR REPLACE TRIGGER "update_bookings_updated_at" BEFORE UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_expenses_updated_at" BEFORE UPDATE ON "public"."expenses" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_guests_updated_at" BEFORE UPDATE ON "public"."guests" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_maintenance_logs_updated_at" BEFORE UPDATE ON "public"."maintenance_logs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_units_updated_at" BEFORE UPDATE ON "public"."units" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



ALTER TABLE ONLY "public"."app_roles"
    ADD CONSTRAINT "app_roles_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."app_roles"
    ADD CONSTRAINT "app_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("guest_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("unit_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."maintenance_logs"
    ADD CONSTRAINT "maintenance_logs_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("unit_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("booking_id") ON DELETE CASCADE;



CREATE POLICY "Admin only access to conflict backups" ON "public"."bookings_conflict_backup" USING ("public"."is_admin_or_owner"("auth"."uid"()));



COMMENT ON POLICY "Admin only access to conflict backups" ON "public"."bookings_conflict_backup" IS 'Only admins and owners can view conflict backup data. Uses SECURITY DEFINER helper to avoid RLS recursion.';



CREATE POLICY "Authenticated users can delete bookings" ON "public"."bookings" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can delete expenses" ON "public"."expenses" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can delete guests" ON "public"."guests" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can delete maintenance_logs" ON "public"."maintenance_logs" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can delete payments" ON "public"."payments" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can delete units" ON "public"."units" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert bookings" ON "public"."bookings" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert expenses" ON "public"."expenses" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert guests" ON "public"."guests" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert maintenance_logs" ON "public"."maintenance_logs" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert payments" ON "public"."payments" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert units" ON "public"."units" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update bookings" ON "public"."bookings" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update expenses" ON "public"."expenses" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update guests" ON "public"."guests" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update maintenance_logs" ON "public"."maintenance_logs" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update payments" ON "public"."payments" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update units" ON "public"."units" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view bookings" ON "public"."bookings" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view expenses" ON "public"."expenses" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view guests" ON "public"."guests" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view maintenance_logs" ON "public"."maintenance_logs" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view payments" ON "public"."payments" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view units" ON "public"."units" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable all for authenticated users" ON "public"."bookings" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable all for authenticated users" ON "public"."expenses" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable all for authenticated users" ON "public"."guests" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable all for authenticated users" ON "public"."maintenance_logs" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable all for authenticated users" ON "public"."payments" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable all for authenticated users" ON "public"."units" USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."app_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "app_roles_delete_policy" ON "public"."app_roles" FOR DELETE USING ("public"."is_admin"("auth"."uid"()));



COMMENT ON POLICY "app_roles_delete_policy" ON "public"."app_roles" IS 'Fixed: Uses is_admin() SECURITY DEFINER helper to avoid recursion.';



CREATE POLICY "app_roles_insert_policy" ON "public"."app_roles" FOR INSERT WITH CHECK ("public"."is_admin"("auth"."uid"()));



COMMENT ON POLICY "app_roles_insert_policy" ON "public"."app_roles" IS 'Fixed: Uses is_admin() SECURITY DEFINER helper to avoid recursion.';



CREATE POLICY "app_roles_select_policy" ON "public"."app_roles" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"())));



COMMENT ON POLICY "app_roles_select_policy" ON "public"."app_roles" IS 'Fixed: Uses is_admin() SECURITY DEFINER helper to avoid infinite recursion. Users see own role, admins see all.';



CREATE POLICY "app_roles_update_policy" ON "public"."app_roles" FOR UPDATE USING ("public"."is_admin"("auth"."uid"()));



COMMENT ON POLICY "app_roles_update_policy" ON "public"."app_roles" IS 'Fixed: Uses is_admin() SECURITY DEFINER helper to avoid recursion.';



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs_archive" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_logs_archive_delete_policy" ON "public"."audit_logs_archive" FOR DELETE USING ("public"."is_admin_or_owner"("auth"."uid"()));



COMMENT ON POLICY "audit_logs_archive_delete_policy" ON "public"."audit_logs_archive" IS 'Fixed: Uses is_admin_or_owner() SECURITY DEFINER helper to avoid recursion.';



CREATE POLICY "audit_logs_archive_insert_policy" ON "public"."audit_logs_archive" FOR INSERT WITH CHECK (true);



CREATE POLICY "audit_logs_archive_select_policy" ON "public"."audit_logs_archive" FOR SELECT USING (("public"."is_admin_or_owner"("auth"."uid"()) OR ("public"."is_manager"("auth"."uid"()) AND ("table_name" = ANY (ARRAY['bookings'::"text", 'payments'::"text", 'guests'::"text", 'expenses'::"text", 'system'::"text", 'authentication'::"text"]))) OR ("user_email" = (("current_setting"('request.jwt.claims'::"text", true))::json ->> 'email'::"text"))));



COMMENT ON POLICY "audit_logs_archive_select_policy" ON "public"."audit_logs_archive" IS 'Fixed: Uses SECURITY DEFINER helpers to avoid infinite RLS recursion.';



CREATE POLICY "audit_logs_archive_update_policy" ON "public"."audit_logs_archive" FOR UPDATE USING (false);



CREATE POLICY "audit_logs_delete_policy" ON "public"."audit_logs" FOR DELETE USING ("public"."is_admin_or_owner"("auth"."uid"()));



COMMENT ON POLICY "audit_logs_delete_policy" ON "public"."audit_logs" IS 'Fixed: Uses is_admin_or_owner() SECURITY DEFINER helper to avoid recursion.';



CREATE POLICY "audit_logs_insert_policy" ON "public"."audit_logs" FOR INSERT WITH CHECK ((("auth"."uid"() IS NOT NULL) OR ("user_id" IS NULL)));



COMMENT ON POLICY "audit_logs_insert_policy" ON "public"."audit_logs" IS 'Allows authenticated users to insert logs (Layer 2 app events) and system triggers (Layer 1, user_id=NULL) to log automatically.';



CREATE POLICY "audit_logs_select_policy" ON "public"."audit_logs" FOR SELECT USING (("public"."is_admin_or_owner"("auth"."uid"()) OR ("public"."is_manager"("auth"."uid"()) AND ("table_name" = ANY (ARRAY['bookings'::"text", 'payments'::"text", 'guests'::"text", 'expenses'::"text", 'system'::"text", 'authentication'::"text"]))) OR ("user_email" = (("current_setting"('request.jwt.claims'::"text", true))::json ->> 'email'::"text"))));



COMMENT ON POLICY "audit_logs_select_policy" ON "public"."audit_logs" IS 'Fixed: Uses SECURITY DEFINER helpers (is_admin_or_owner, is_manager) to avoid infinite RLS recursion with app_roles.';



CREATE POLICY "audit_logs_update_policy" ON "public"."audit_logs" FOR UPDATE USING (false);



COMMENT ON POLICY "audit_logs_update_policy" ON "public"."audit_logs" IS 'Blocks all updates. Audit logs are immutable by design.';



ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings_conflict_backup" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."guests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."maintenance_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."units" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."archive_audit_logs"("cutoff_date" timestamp with time zone, "dry_run" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."archive_audit_logs"("cutoff_date" timestamp with time zone, "dry_run" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_audit_logs"("cutoff_date" timestamp with time zone, "dry_run" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."archive_logs_older_than_months"("months_old" integer, "dry_run" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."archive_logs_older_than_months"("months_old" integer, "dry_run" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_logs_older_than_months"("months_old" integer, "dry_run" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."attach_audit_trigger"("target_table" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."attach_audit_trigger"("target_table" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."attach_audit_trigger"("target_table" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_trigger_func"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_trigger_func"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_trigger_func"() TO "service_role";



GRANT ALL ON FUNCTION "public"."can_view_all_audit_logs"() TO "anon";
GRANT ALL ON FUNCTION "public"."can_view_all_audit_logs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_view_all_audit_logs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "postgres";
GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "anon";
GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_unit_availability"("p_unit_id" "uuid", "p_check_in" timestamp with time zone, "p_check_out" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."check_unit_availability"("p_unit_id" "uuid", "p_check_in" timestamp with time zone, "p_check_out" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_unit_availability"("p_unit_id" "uuid", "p_check_in" timestamp with time zone, "p_check_out" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "postgres";
GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "anon";
GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."detach_audit_trigger"("target_table" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."detach_audit_trigger"("target_table" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."detach_audit_trigger"("target_table" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_audit_identity_func"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_audit_identity_func"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_audit_identity_func"() TO "service_role";



GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "postgres";
GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "anon";
GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "service_role";



GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_booking_reference"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_booking_reference"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_booking_reference"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_audit_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_audit_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_audit_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."grant_audit_role"("target_user_id" "uuid", "target_email" "text", "target_role" "text", "grant_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."grant_audit_role"("target_user_id" "uuid", "target_email" "text", "target_role" "text", "grant_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."grant_audit_role"("target_user_id" "uuid", "target_email" "text", "target_role" "text", "grant_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "postgres";
GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "anon";
GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "service_role";



GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "postgres";
GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "postgres";
GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "anon";
GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"("check_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"("check_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"("check_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin_or_owner"("check_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_or_owner"("check_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_or_owner"("check_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_audit_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_audit_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_audit_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_audit_manager"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_audit_manager"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_audit_manager"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_audit_owner"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_audit_owner"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_audit_owner"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_manager"("check_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_manager"("check_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_manager"("check_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."monthly_archive_until"("final_cutoff_date" timestamp with time zone, "dry_run" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."monthly_archive_until"("final_cutoff_date" timestamp with time zone, "dry_run" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."monthly_archive_until"("final_cutoff_date" timestamp with time zone, "dry_run" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "postgres";
GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "anon";
GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "service_role";



GRANT ALL ON FUNCTION "public"."restore_logs_from_archive"("start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."restore_logs_from_archive"("start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."restore_logs_from_archive"("start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."revoke_audit_role"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."revoke_audit_role"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_audit_role"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_guest_statistics"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_guest_statistics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_guest_statistics"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."app_roles" TO "anon";
GRANT ALL ON TABLE "public"."app_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."app_roles" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs_archive" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs_archive" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs_archive" TO "service_role";



GRANT ALL ON TABLE "public"."audit_archive_stats" TO "anon";
GRANT ALL ON TABLE "public"."audit_archive_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_archive_stats" TO "service_role";



GRANT ALL ON TABLE "public"."audit_index_stats" TO "anon";
GRANT ALL ON TABLE "public"."audit_index_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_index_stats" TO "service_role";



GRANT ALL ON TABLE "public"."audit_system_status" TO "anon";
GRANT ALL ON TABLE "public"."audit_system_status" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_system_status" TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."bookings_conflict_backup" TO "anon";
GRANT ALL ON TABLE "public"."bookings_conflict_backup" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings_conflict_backup" TO "service_role";



GRANT ALL ON TABLE "public"."expenses" TO "anon";
GRANT ALL ON TABLE "public"."expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."expenses" TO "service_role";



GRANT ALL ON TABLE "public"."guests" TO "anon";
GRANT ALL ON TABLE "public"."guests" TO "authenticated";
GRANT ALL ON TABLE "public"."guests" TO "service_role";



GRANT ALL ON TABLE "public"."maintenance_logs" TO "anon";
GRANT ALL ON TABLE "public"."maintenance_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."maintenance_logs" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."units" TO "anon";
GRANT ALL ON TABLE "public"."units" TO "authenticated";
GRANT ALL ON TABLE "public"."units" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































RESET ALL;

  create policy "Allow uploads via signed URLs"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'payment-proofs'::text) AND ((auth.uid() IS NOT NULL) OR ((auth.jwt() ->> 'sub'::text) = 'service_role'::text))));



  create policy "Give users authenticated access to folder 1lnm9mj_0"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'receipts'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Give users authenticated access to folder 1lnm9mj_1"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'receipts'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Give users authenticated access to folder 1lnm9mj_2"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'receipts'::text) AND (auth.role() = 'authenticated'::text)))
with check ((bucket_id = 'receipts'::text));



  create policy "Give users authenticated access to folder 1lnm9mj_3"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'receipts'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Give users authenticated access to folder w1pnpy_0"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'payment-proofs'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Give users authenticated access to folder w1pnpy_1"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'payment-proofs'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Give users authenticated access to folder w1pnpy_2"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'payment-proofs'::text) AND (auth.role() = 'authenticated'::text)))
with check ((bucket_id = 'payment-proofs'::text));



  create policy "Give users authenticated access to folder w1pnpy_3"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'payment-proofs'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Service role full access to payment proofs"
  on "storage"."objects"
  as permissive
  for all
  to service_role
using ((bucket_id = 'payment-proofs'::text))
with check ((bucket_id = 'payment-proofs'::text));



  create policy "Service role full access to receipts"
  on "storage"."objects"
  as permissive
  for all
  to service_role
using ((bucket_id = 'receipts'::text))
with check ((bucket_id = 'receipts'::text));



