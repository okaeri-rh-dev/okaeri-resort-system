-- Blocks hold (#165): the block model on availability_blackouts and the booking guard.
--
-- A block is one row per cabin; a NULL unit_id is a resort closure. start_date and
-- end_date are the first and last blocked night, both inclusive. A booking's nights
-- run from its Manila check-in day up to, not including, its check-out day (ADR 0002).

-- ============================================================================
-- Block table shape
-- ============================================================================

ALTER TABLE public.availability_blackouts DROP COLUMN IF EXISTS blackout_type;

UPDATE public.availability_blackouts SET reason = 'Blocked' WHERE reason IS NULL OR btrim(reason) = '';
ALTER TABLE public.availability_blackouts ALTER COLUMN reason SET NOT NULL;
ALTER TABLE public.availability_blackouts DROP CONSTRAINT IF EXISTS availability_blackouts_reason_not_blank;
ALTER TABLE public.availability_blackouts
    ADD CONSTRAINT availability_blackouts_reason_not_blank CHECK (btrim(reason) <> '');

COMMENT ON TABLE public.availability_blackouts IS
    'Blocks: nights a cabin (unit_id) or the whole resort (unit_id NULL) cannot be booked.';
COMMENT ON COLUMN public.availability_blackouts.start_date IS 'First blocked night (inclusive)';
COMMENT ON COLUMN public.availability_blackouts.end_date IS 'Last blocked night (inclusive)';

-- ============================================================================
-- Shared rules
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_unit_blocked(p_unit_id uuid, p_first_night date, p_last_night date)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.availability_blackouts b
        WHERE (b.unit_id = p_unit_id OR b.unit_id IS NULL)
          AND b.start_date <= p_last_night
          AND b.end_date >= p_first_night
    );
$$;

COMMENT ON FUNCTION public.is_unit_blocked(uuid, date, date) IS
    'True when a block on the unit, or a resort closure, covers any night from p_first_night to p_last_night (inclusive).';

-- Bookings and blocks both lock the unit rows they touch, in unit-id order, before
-- they check each other. This stops two concurrent writes from both passing.
CREATE OR REPLACE FUNCTION public.lock_units(p_unit_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    PERFORM 1
    FROM public.units
    WHERE unit_id = ANY (p_unit_ids)
    ORDER BY unit_id
    FOR NO KEY UPDATE;
END;
$$;

REVOKE ALL ON FUNCTION public.is_unit_blocked(uuid, date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lock_units(uuid[]) FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- Booking guard
-- ============================================================================

CREATE OR REPLACE FUNCTION public.refuse_booking_on_blocked_nights()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_first_night date := (NEW.check_in AT TIME ZONE 'Asia/Manila')::date;
    v_last_night date := (NEW.check_out AT TIME ZONE 'Asia/Manila')::date - 1;
BEGIN
    IF NEW.booking_status IN ('Cancelled', 'CheckedOut') THEN
        RETURN NEW;
    END IF;

    -- A status change between live statuses adds no nights, so it is not checked.
    IF TG_OP = 'UPDATE'
       AND NEW.unit_id = OLD.unit_id
       AND NEW.check_in = OLD.check_in
       AND NEW.check_out = OLD.check_out
       AND OLD.booking_status NOT IN ('Cancelled', 'CheckedOut') THEN
        RETURN NEW;
    END IF;

    PERFORM public.lock_units(ARRAY(
        SELECT unit_id FROM public.booking_unit_availability WHERE booking_id = NEW.booking_id
        UNION
        SELECT NEW.unit_id
    ));

    IF public.is_unit_blocked(NEW.unit_id, v_first_night, v_last_night) THEN
        RAISE EXCEPTION 'The cabin is blocked on one or more of these nights'
            USING ERRCODE = 'BLOCK', DETAIL = format('unit_id=%s', NEW.unit_id);
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.refuse_booking_on_blocked_nights() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS refuse_booking_on_blocked_nights ON public.booking_unit_availability;
CREATE TRIGGER refuse_booking_on_blocked_nights
    BEFORE INSERT OR UPDATE ON public.booking_unit_availability
    FOR EACH ROW EXECUTE FUNCTION public.refuse_booking_on_blocked_nights();

-- Multi-cabin writes lock every cabin up front so the locks follow unit-id order.

CREATE OR REPLACE FUNCTION public.create_multi_unit_booking(p_booking_data jsonb, p_units jsonb[], p_guest_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_booking_id UUID;
    v_unit JSONB;
    v_total_amount DECIMAL(10,2) := 0;
BEGIN
    PERFORM public.lock_units(ARRAY(SELECT (u->>'unit_id')::UUID FROM unnest(p_units) AS u));

    FOREACH v_unit IN ARRAY p_units
    LOOP
        v_total_amount := v_total_amount + (v_unit->>'subtotal')::DECIMAL;
    END LOOP;

    INSERT INTO public.bookings (
        booking_reference, guest_id, guest_name, contact_number, email, num_guests,
        check_in, check_out, total_amount, is_multi_unit, unit_count,
        booking_status, payment_status, payment_method,
        special_requests, internal_notes, is_walk_in
    ) VALUES (
        COALESCE(p_booking_data->>'booking_reference', public.generate_booking_reference()),
        p_guest_id,
        p_booking_data->>'guest_name',
        p_booking_data->>'contact_number',
        p_booking_data->>'email',
        (p_booking_data->>'num_guests')::INTEGER,
        (p_booking_data->>'check_in')::TIMESTAMPTZ,
        (p_booking_data->>'check_out')::TIMESTAMPTZ,
        v_total_amount,
        array_length(p_units, 1) > 1,
        array_length(p_units, 1),
        COALESCE(p_booking_data->>'booking_status', 'Pending'),
        COALESCE(p_booking_data->>'payment_status', 'Pending'),
        p_booking_data->>'payment_method',
        p_booking_data->>'special_requests',
        p_booking_data->>'internal_notes',
        COALESCE((p_booking_data->>'is_walk_in')::BOOLEAN, false)
    ) RETURNING booking_id INTO v_booking_id;

    FOREACH v_unit IN ARRAY p_units
    LOOP
        INSERT INTO public.booking_units (
            booking_id, unit_id, unit_price, weekend_surcharge, extra_person_charge,
            subtotal, assigned_guests, unit_notes
        ) VALUES (
            v_booking_id,
            (v_unit->>'unit_id')::UUID,
            (v_unit->>'unit_price')::DECIMAL,
            COALESCE((v_unit->>'weekend_surcharge')::DECIMAL, 0),
            COALESCE((v_unit->>'extra_person_charge')::DECIMAL, 0),
            (v_unit->>'subtotal')::DECIMAL,
            (v_unit->>'assigned_guests')::INTEGER,
            v_unit->>'unit_notes'
        );

        INSERT INTO public.booking_unit_availability (
            unit_id, booking_id, check_in, check_out, booking_status
        ) VALUES (
            (v_unit->>'unit_id')::UUID,
            v_booking_id,
            (p_booking_data->>'check_in')::TIMESTAMPTZ,
            (p_booking_data->>'check_out')::TIMESTAMPTZ,
            COALESCE(p_booking_data->>'booking_status', 'Pending')
        );
    END LOOP;

    RETURN v_booking_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.assign_units_to_booking(p_booking_id uuid, p_unit_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
    v_booking public.bookings%ROWTYPE;
    v_unit_count INTEGER := COALESCE(array_length(p_unit_ids, 1), 0);
    v_quote JSONB;
    v_subtotal NUMERIC(10,2);
    v_extra NUMERIC(10,2);
BEGIN
    SELECT * INTO v_booking
    FROM public.bookings
    WHERE booking_id = p_booking_id
      AND is_guest_booking
      AND unit_assignment_status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % not found or not in pending state', p_booking_id;
    END IF;

    IF v_booking.payment_status NOT IN ('Partial', 'Completed') THEN
        RAISE EXCEPTION 'Payment must be verified before unit assignment (payment status: %)',
            v_booking.payment_status;
    END IF;

    IF v_unit_count <> v_booking.requested_unit_count THEN
        RAISE EXCEPTION 'Must assign exactly % cabins, got %', v_booking.requested_unit_count, v_unit_count;
    END IF;

    PERFORM public.lock_units(p_unit_ids);

    FOR v_position IN 1..v_unit_count LOOP
        v_quote := v_booking.pricing_snapshot->'unit_breakdown'->(v_position - 1);
        IF v_quote IS NULL THEN
            RAISE EXCEPTION 'Booking % has no quoted price for cabin %', p_booking_id, v_position;
        END IF;
        v_subtotal := round((v_quote->>'total')::NUMERIC, 2);
        v_extra := round((v_quote->>'extra_person_fees')::NUMERIC, 2);

        INSERT INTO public.booking_units (
            booking_id, unit_id, unit_price, extra_person_charge, subtotal, assigned_guests
        ) VALUES (
            p_booking_id, p_unit_ids[v_position], v_subtotal - v_extra, v_extra, v_subtotal,
            (v_quote->>'guests')::INTEGER
        );

        INSERT INTO public.booking_unit_availability (
            unit_id, booking_id, check_in, check_out, booking_status
        ) VALUES (
            p_unit_ids[v_position], p_booking_id, v_booking.check_in, v_booking.check_out, 'Confirmed'
        );
    END LOOP;

    UPDATE public.bookings
    SET unit_assignment_status = 'assigned', booking_status = 'Confirmed'
    WHERE booking_id = p_booking_id;
END;
$function$;

-- ============================================================================
-- Access: staff read; manager, owner and admin write. Guests read only the
-- public availability counts (get_public_aggregate_availability, SECURITY DEFINER).
-- Roles are listed: the app_roles helpers are exact-match, not hierarchical.
-- ============================================================================

DROP POLICY IF EXISTS "availability_blackouts_select_public" ON public.availability_blackouts;
DROP POLICY IF EXISTS "availability_blackouts_manage_staff" ON public.availability_blackouts;
DROP POLICY IF EXISTS "availability_blackouts_select_staff" ON public.availability_blackouts;
DROP POLICY IF EXISTS "availability_blackouts_insert_manager" ON public.availability_blackouts;
DROP POLICY IF EXISTS "availability_blackouts_update_manager" ON public.availability_blackouts;
DROP POLICY IF EXISTS "availability_blackouts_delete_manager" ON public.availability_blackouts;

REVOKE ALL ON public.availability_blackouts FROM anon;

CREATE POLICY "availability_blackouts_select_staff" ON public.availability_blackouts
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.app_roles
        WHERE user_id = auth.uid() AND is_active AND role IN ('staff', 'manager', 'owner', 'admin')
    ));

CREATE POLICY "availability_blackouts_insert_manager" ON public.availability_blackouts
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.app_roles
        WHERE user_id = auth.uid() AND is_active AND role IN ('manager', 'owner', 'admin')
    ));

CREATE POLICY "availability_blackouts_update_manager" ON public.availability_blackouts
    FOR UPDATE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.app_roles
        WHERE user_id = auth.uid() AND is_active AND role IN ('manager', 'owner', 'admin')
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.app_roles
        WHERE user_id = auth.uid() AND is_active AND role IN ('manager', 'owner', 'admin')
    ));

CREATE POLICY "availability_blackouts_delete_manager" ON public.availability_blackouts
    FOR DELETE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.app_roles
        WHERE user_id = auth.uid() AND is_active AND role IN ('manager', 'owner', 'admin')
    ));

-- created_by stays VARCHAR for old rows; new rows record the signed-in user's id.
CREATE OR REPLACE FUNCTION public.set_block_created_by()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.created_by := COALESCE(auth.uid()::text, NEW.created_by);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_block_created_by ON public.availability_blackouts;
CREATE TRIGGER set_block_created_by
    BEFORE INSERT ON public.availability_blackouts
    FOR EACH ROW EXECUTE FUNCTION public.set_block_created_by();

DROP TRIGGER IF EXISTS update_availability_blackouts_updated_at ON public.availability_blackouts;
CREATE TRIGGER update_availability_blackouts_updated_at
    BEFORE UPDATE ON public.availability_blackouts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================================
-- Locks, by today in Manila. A past block (last night before today) is fixed.
-- A running block (first night on or before today) can change only its last
-- night, not to before today, and cannot be deleted. The cabin never changes.
-- The service role (test cleanup, maintenance) and a cascade from a deleted unit
-- are let through.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_block_locks()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_today date := (now() AT TIME ZONE 'Asia/Manila')::date;
BEGIN
    IF auth.role() = 'service_role' OR pg_trigger_depth() > 1 THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    IF OLD.end_date < v_today THEN
        RAISE EXCEPTION 'This block is over. It cannot be changed.' USING ERRCODE = '55000';
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF OLD.start_date <= v_today THEN
            RAISE EXCEPTION 'A running block cannot be deleted. Change its last night.' USING ERRCODE = '55000';
        END IF;
        RETURN OLD;
    END IF;

    IF NEW.unit_id IS DISTINCT FROM OLD.unit_id THEN
        RAISE EXCEPTION 'The cabin on a block cannot change. Add a new block.' USING ERRCODE = '55000';
    END IF;

    IF OLD.start_date <= v_today THEN
        IF NEW.start_date <> OLD.start_date OR NEW.reason <> OLD.reason THEN
            RAISE EXCEPTION 'A running block can change only its last night.' USING ERRCODE = '55000';
        END IF;
        IF NEW.end_date < v_today THEN
            RAISE EXCEPTION 'The last night of a running block cannot be before today.' USING ERRCODE = '55000';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_block_locks ON public.availability_blackouts;
CREATE TRIGGER enforce_block_locks
    BEFORE UPDATE OR DELETE ON public.availability_blackouts
    FOR EACH ROW EXECUTE FUNCTION public.enforce_block_locks();

-- The realtime hooks already subscribe to this table.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'availability_blackouts'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.availability_blackouts;
    END IF;
END;
$$;
