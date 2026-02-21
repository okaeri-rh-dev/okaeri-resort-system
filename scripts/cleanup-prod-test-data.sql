-- ============================================================
-- PRODUCTION TEST DATA CLEANUP + AUDIT TRIGGER FIX
-- Generated: 2026-02-21
-- ============================================================
--
-- PART A: Fix broken audit_trigger_func
--   The deployed function references a "changes" column that
--   doesn't exist in audit_logs (correct column: "changed_fields").
--   This causes all DELETE/INSERT/UPDATE operations to fail with:
--     ERROR 42703: column "changes" of relation "audit_logs" does not exist
--
-- PART B: Clean test/transactional data
--   Deletes 8 rows: payments (1), bookings (2), guests (2), expenses (3)
--   Preserves: units, accounts, app_roles, pricing_config, payment_methods,
--              audit_logs (73 entries kept as history)
--
-- ============================================================

BEGIN;

-- ============================================================
-- PART A: Fix audit_trigger_func
-- Deploys the corrected version that uses "changed_fields" column
-- and has SET search_path = '' for security hardening.
-- ============================================================

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

-- ============================================================
-- PART B: Clean test data
-- ============================================================

-- B.0: Pre-flight checks
DO $$
DECLARE
  v_payments   INT;
  v_bookings   INT;
  v_guests     INT;
  v_expenses   INT;
BEGIN
  SELECT count(*) INTO v_payments FROM public.payments;
  SELECT count(*) INTO v_bookings FROM public.bookings;
  SELECT count(*) INTO v_guests   FROM public.guests;
  SELECT count(*) INTO v_expenses FROM public.expenses;

  RAISE NOTICE '=== PRE-FLIGHT CHECK ===';
  RAISE NOTICE 'Payments to delete: %', v_payments;
  RAISE NOTICE 'Bookings to delete: % (cascades to booking_units)', v_bookings;
  RAISE NOTICE 'Guests to delete:   %', v_guests;
  RAISE NOTICE 'Expenses to delete: %', v_expenses;

  -- Safety: abort if counts are higher than expected (real data may exist)
  IF v_payments > 5 OR v_bookings > 5 OR v_guests > 5 OR v_expenses > 10 THEN
    RAISE EXCEPTION 'ABORT: Row counts higher than expected. New real data may exist. Review manually.';
  END IF;
END $$;

-- B.1: Disable user-defined audit triggers during cleanup
--      (avoids logging deletion of test data into audit_logs)
--      Uses USER instead of ALL to avoid touching system FK triggers
ALTER TABLE public.payments      DISABLE TRIGGER USER;
ALTER TABLE public.bookings      DISABLE TRIGGER USER;
ALTER TABLE public.booking_units DISABLE TRIGGER USER;
ALTER TABLE public.guests        DISABLE TRIGGER USER;
ALTER TABLE public.expenses      DISABLE TRIGGER USER;

-- B.2: Delete in foreign-key-safe order
DELETE FROM public.payments;
DELETE FROM public.bookings;
DELETE FROM public.guests;
DELETE FROM public.expenses;

-- B.3: Re-enable audit triggers (now using the fixed function)
ALTER TABLE public.payments      ENABLE TRIGGER USER;
ALTER TABLE public.bookings      ENABLE TRIGGER USER;
ALTER TABLE public.booking_units ENABLE TRIGGER USER;
ALTER TABLE public.guests        ENABLE TRIGGER USER;
ALTER TABLE public.expenses      ENABLE TRIGGER USER;

-- B.4: Post-flight verification
DO $$
DECLARE
  v_payments   INT;
  v_bookings   INT;
  v_book_units INT;
  v_guests     INT;
  v_expenses   INT;
  v_units      INT;
  v_accounts   INT;
  v_roles      INT;
  v_audits     INT;
BEGIN
  SELECT count(*) INTO v_payments   FROM public.payments;
  SELECT count(*) INTO v_bookings   FROM public.bookings;
  SELECT count(*) INTO v_book_units FROM public.booking_units;
  SELECT count(*) INTO v_guests     FROM public.guests;
  SELECT count(*) INTO v_expenses   FROM public.expenses;
  SELECT count(*) INTO v_units      FROM public.units;
  SELECT count(*) INTO v_accounts   FROM public.accounts;
  SELECT count(*) INTO v_roles      FROM public.app_roles;
  SELECT count(*) INTO v_audits     FROM public.audit_logs;

  RAISE NOTICE '=== POST-CLEANUP VERIFICATION ===';
  RAISE NOTICE 'payments:      % (expected 0)', v_payments;
  RAISE NOTICE 'bookings:      % (expected 0)', v_bookings;
  RAISE NOTICE 'booking_units: % (expected 0)', v_book_units;
  RAISE NOTICE 'guests:        % (expected 0)', v_guests;
  RAISE NOTICE 'expenses:      % (expected 0)', v_expenses;
  RAISE NOTICE '---';
  RAISE NOTICE 'units:         % (preserved)', v_units;
  RAISE NOTICE 'accounts:      % (preserved)', v_accounts;
  RAISE NOTICE 'app_roles:     % (preserved)', v_roles;
  RAISE NOTICE 'audit_logs:    % (preserved)', v_audits;

  IF v_payments > 0 OR v_bookings > 0 OR v_guests > 0 OR v_expenses > 0 THEN
    RAISE EXCEPTION 'CLEANUP INCOMPLETE: Some rows remain. Check foreign key constraints.';
  END IF;

  RAISE NOTICE '=== ALL DONE: Data cleaned + audit trigger fixed ===';
END $$;

COMMIT;
