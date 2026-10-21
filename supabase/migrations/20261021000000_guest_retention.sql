-- Guest retention (RA 10173): personal data of past guests is anonymized in place.
-- anonymize_booking / anonymize_guest hold every rule: they clear the personal columns,
-- keep money, dates and statuses for the family's internal summaries, and scrub the
-- guest's audit rows in the same transaction (the audit trigger copies the old values
-- into a new row on every UPDATE). Proof-file paths are returned for the caller to
-- delete from storage. See docs/plans/2026-10-21-guest-retention-design.md.

ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS anonymized_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS anonymized_at timestamptz;

-- One-off snapshot from database/migrations/014; prod held 2 test rows (user, 2026-10-21).
DROP TABLE IF EXISTS public.bookings_conflict_backup;

-- The anonymize_audit_logs rules (20261018000000), shared with guest anonymization.
CREATE OR REPLACE FUNCTION public._anonymize_audit_rows(p_audit_ids uuid[])
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
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
    WHERE a.audit_id = ANY (p_audit_ids)
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
    WHERE a.audit_id = ANY (p_audit_ids)
      AND NOT COALESCE(a.metadata ? 'anonymized_at', false);
    GET DIAGNOSTICS v_archived_count = ROW_COUNT;

    RETURN v_live_count + v_archived_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.anonymize_audit_logs(p_older_than interval DEFAULT interval '24 months')
RETURNS TABLE(anonymized_count bigint, audit_logs_bytes bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_cutoff timestamptz := now() - p_older_than;
BEGIN
    RETURN QUERY SELECT
        public._anonymize_audit_rows(ARRAY(
            SELECT a.audit_id FROM public.audit_logs a WHERE a.created_at < v_cutoff
            UNION ALL
            SELECT a.audit_id FROM public.audit_logs_archive a WHERE a.created_at < v_cutoff
        )),
        pg_total_relation_size('public.audit_logs');
END;
$$;

-- Audit rows about these records: by record_id, or by a booking_id / guest_id in the row data
-- (child tables, and legacy app-logged rows such as table_name 'booking').
CREATE OR REPLACE FUNCTION public._audit_ids_for_records(p_record_ids text[])
RETURNS uuid[]
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    SELECT COALESCE(array_agg(s.audit_id), '{}')
    FROM (
        SELECT a.audit_id FROM public.audit_logs a
        WHERE a.record_id = ANY (p_record_ids)
           OR COALESCE(a.old_data, a.new_data) ->> 'booking_id' = ANY (p_record_ids)
           OR COALESCE(a.old_data, a.new_data) ->> 'guest_id' = ANY (p_record_ids)
        UNION ALL
        SELECT a.audit_id FROM public.audit_logs_archive a
        WHERE a.record_id = ANY (p_record_ids)
           OR COALESCE(a.old_data, a.new_data) ->> 'booking_id' = ANY (p_record_ids)
           OR COALESCE(a.old_data, a.new_data) ->> 'guest_id' = ANY (p_record_ids)
    ) s;
$$;

-- Same path rule as cleanup_expired_payment_proofs: a bucket path, or a storage URL stripped to one.
CREATE OR REPLACE FUNCTION public._payment_proof_path(p_url text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT regexp_replace(
        split_part(p_url, '?', 1),
        '^.*/storage/v1/object/(public|sign|authenticated)/payment-proofs/',
        ''
    );
$$;

CREATE OR REPLACE FUNCTION public.anonymize_booking(p_booking_id uuid)
RETURNS TABLE(proof_path text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_paths text[];
    v_record_ids text[];
BEGIN
    SELECT COALESCE(array_agg(DISTINCT public._payment_proof_path(s.url)), '{}')
    INTO v_paths
    FROM (
        SELECT b.payment_proof_url AS url FROM public.bookings b
        WHERE b.booking_id = p_booking_id AND b.anonymized_at IS NULL
        UNION ALL
        SELECT p.proof_url FROM public.payments p
        JOIN public.bookings b ON b.booking_id = p.booking_id
        WHERE p.booking_id = p_booking_id AND b.anonymized_at IS NULL
    ) s
    WHERE s.url IS NOT NULL;

    v_record_ids := ARRAY[p_booking_id::text]
        || ARRAY(SELECT p.payment_id::text FROM public.payments p WHERE p.booking_id = p_booking_id)
        || ARRAY(SELECT u.booking_unit_id::text FROM public.booking_units u WHERE u.booking_id = p_booking_id)
        || ARRAY(SELECT r.id::text FROM public.guest_booking_unit_requests r WHERE r.booking_id = p_booking_id);

    UPDATE public.bookings
    SET guest_name = 'Removed guest',
        email = NULL,
        contact_number = NULL,
        special_requests = NULL,
        internal_notes = NULL,
        payment_proof_url = NULL,
        anonymized_at = now()
    WHERE booking_id = p_booking_id AND anonymized_at IS NULL;
    IF NOT FOUND THEN
        RETURN;
    END IF;

    UPDATE public.booking_units SET guest_names = NULL, unit_notes = NULL
    WHERE booking_id = p_booking_id;
    UPDATE public.payments SET notes = NULL, proof_url = NULL
    WHERE booking_id = p_booking_id;
    UPDATE public.guest_assignments ga SET room_preferences = NULL
    FROM public.booking_units u
    WHERE ga.booking_unit_id = u.booking_unit_id AND u.booking_id = p_booking_id;

    PERFORM public._anonymize_audit_rows(public._audit_ids_for_records(v_record_ids));

    RETURN QUERY SELECT unnest(v_paths);
END;
$$;

CREATE OR REPLACE FUNCTION public.anonymize_guest(p_guest_id uuid)
RETURNS TABLE(proof_path text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_booking_id uuid;
    v_paths text[] := '{}';
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.guests g WHERE g.guest_id = p_guest_id) THEN
        RAISE EXCEPTION 'Guest % not found', p_guest_id USING ERRCODE = 'PT404';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.guest_id = p_guest_id
          AND b.check_out > now()
          AND b.booking_status IS DISTINCT FROM 'Cancelled'
    ) THEN
        RAISE EXCEPTION 'Guest % has a current or future booking', p_guest_id USING ERRCODE = 'PT409';
    END IF;

    FOR v_booking_id IN SELECT b.booking_id FROM public.bookings b WHERE b.guest_id = p_guest_id LOOP
        v_paths := v_paths || ARRAY(SELECT a.proof_path FROM public.anonymize_booking(v_booking_id) a);
    END LOOP;

    UPDATE public.guests
    SET guest_name = 'Removed guest', email = NULL, phone_number = NULL, anonymized_at = now()
    WHERE guest_id = p_guest_id AND anonymized_at IS NULL;
    UPDATE public.guest_assignments SET room_preferences = NULL WHERE guest_id = p_guest_id;

    PERFORM public._anonymize_audit_rows(public._audit_ids_for_records(ARRAY[p_guest_id::text]));

    RETURN QUERY SELECT unnest(v_paths);
END;
$$;

REVOKE ALL ON FUNCTION public._anonymize_audit_rows(uuid[]) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public._audit_ids_for_records(text[]) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public._payment_proof_path(text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.anonymize_booking(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.anonymize_guest(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anonymize_booking(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.anonymize_guest(uuid) TO service_role;

-- Weekly job: guests whose last check-out (or creation, with no bookings) is past the window
-- and who have no open balance; then bookings with no guest row, on their own check-out.
-- Each guest runs in its own subtransaction, so one failure does not stop the rest.
CREATE OR REPLACE FUNCTION public.anonymize_expired_guests(p_older_than interval DEFAULT interval '24 months')
RETURNS TABLE(guests_count bigint, bookings_count bigint, failed_count bigint, proof_paths text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_cutoff timestamptz := now() - p_older_than;
    v_id uuid;
    v_guests bigint := 0;
    v_bookings bigint := 0;
    v_failed bigint := 0;
    v_paths text[] := '{}';
BEGIN
    FOR v_id IN
        SELECT g.guest_id FROM public.guests g
        WHERE g.anonymized_at IS NULL
          AND COALESCE(
                (SELECT max(b.check_out) FROM public.bookings b WHERE b.guest_id = g.guest_id),
                g.created_at
              ) < v_cutoff
          AND NOT EXISTS (
                SELECT 1 FROM public.bookings b
                WHERE b.guest_id = g.guest_id
                  AND COALESCE(b.payment_status, '') IN ('Pending', 'Partial')
                  AND b.booking_status IS DISTINCT FROM 'Cancelled')
    LOOP
        BEGIN
            v_paths := v_paths || ARRAY(SELECT a.proof_path FROM public.anonymize_guest(v_id) a);
            v_guests := v_guests + 1;
        EXCEPTION WHEN OTHERS THEN
            v_failed := v_failed + 1;
            RAISE WARNING 'anonymize_guest(%) failed: %', v_id, SQLERRM;
        END;
    END LOOP;

    FOR v_id IN
        SELECT b.booking_id FROM public.bookings b
        WHERE b.guest_id IS NULL
          AND b.anonymized_at IS NULL
          AND b.check_out < v_cutoff
          AND NOT (COALESCE(b.payment_status, '') IN ('Pending', 'Partial')
                   AND b.booking_status IS DISTINCT FROM 'Cancelled')
    LOOP
        BEGIN
            v_paths := v_paths || ARRAY(SELECT a.proof_path FROM public.anonymize_booking(v_id) a);
            v_bookings := v_bookings + 1;
        EXCEPTION WHEN OTHERS THEN
            v_failed := v_failed + 1;
            RAISE WARNING 'anonymize_booking(%) failed: %', v_id, SQLERRM;
        END;
    END LOOP;

    RETURN QUERY SELECT v_guests, v_bookings, v_failed, v_paths;
END;
$$;

-- Guest delete always scrubs first: a bare DELETE left the name and contact on the
-- bookings (guest_id is ON DELETE SET NULL) and in the audit trail.
CREATE OR REPLACE FUNCTION public.delete_guest(p_guest_id uuid)
RETURNS TABLE(proof_path text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_paths text[];
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.guest_id = p_guest_id AND b.booking_status IN ('Confirmed', 'CheckedIn')
    ) THEN
        RAISE EXCEPTION 'Guest % has active bookings', p_guest_id USING ERRCODE = 'PT409';
    END IF;

    v_paths := ARRAY(SELECT a.proof_path FROM public.anonymize_guest(p_guest_id) a);

    -- guest_assignments.guest_id is ON DELETE RESTRICT
    DELETE FROM public.guest_assignments WHERE guest_id = p_guest_id;
    DELETE FROM public.guests WHERE guest_id = p_guest_id;

    RETURN QUERY SELECT unnest(v_paths);
END;
$$;

-- Deletes go through delete_guest (service role) so they cannot skip the scrub.
DROP POLICY IF EXISTS "guests_delete_manager" ON public.guests;

REVOKE ALL ON FUNCTION public.anonymize_expired_guests(interval) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_guest(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anonymize_expired_guests(interval) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_guest(uuid) TO service_role;
