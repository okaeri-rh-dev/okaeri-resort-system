-- Block conflicts (#169): a block never sits on a live booking.
--
-- A cabin block conflicts with Pending, Confirmed and CheckedIn bookings on that cabin
-- on a blocked night. A resort closure (no units) conflicts with those on any cabin,
-- and also with unassigned Pending guest requests. Booking nights run from the Manila
-- check-in day up to, not including, the check-out day (ADR 0002).

BEGIN;

-- ============================================================================
-- Shared conflict check
-- ============================================================================

-- p_kept_first_night/p_kept_last_night are the nights the block already covers when it
-- is edited. Only nights outside them can conflict, so shortening never conflicts.
CREATE OR REPLACE FUNCTION public.find_block_conflicts(
    p_unit_ids uuid[],
    p_first_night date,
    p_last_night date,
    p_kept_first_night date DEFAULT NULL,
    p_kept_last_night date DEFAULT NULL
)
RETURNS TABLE (
    booking_id uuid,
    booking_reference text,
    guest_name text,
    unit_names text[],
    check_in timestamptz,
    check_out timestamptz,
    booking_status text,
    is_partial boolean,
    partial_reason text,
    is_checked_in boolean
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    WITH stays AS (
        SELECT
            b.booking_id,
            b.booking_reference,
            b.guest_name,
            b.check_in,
            b.check_out,
            b.booking_status,
            b.is_guest_booking,
            b.unit_assignment_status,
            (b.check_in AT TIME ZONE 'Asia/Manila')::date AS first_night,
            GREATEST(
                (b.check_in AT TIME ZONE 'Asia/Manila')::date,
                (b.check_out AT TIME ZONE 'Asia/Manila')::date - 1
            ) AS last_night
        FROM public.bookings b
        WHERE b.booking_status IN ('Pending', 'Confirmed', 'CheckedIn')
    ),
    hits AS (
        SELECT s.*
        FROM stays s
        WHERE s.first_night <= p_last_night
          AND s.last_night >= p_first_night
          AND NOT COALESCE(
              p_kept_first_night <= GREATEST(s.first_night, p_first_night)
              AND LEAST(s.last_night, p_last_night) <= p_kept_last_night,
              false
          )
          AND (
              EXISTS (
                  SELECT 1
                  FROM public.booking_unit_availability a
                  WHERE a.booking_id = s.booking_id
                    AND (p_unit_ids IS NULL OR a.unit_id = ANY (p_unit_ids))
              )
              OR (
                  p_unit_ids IS NULL
                  AND s.is_guest_booking
                  AND s.unit_assignment_status = 'pending'
                  AND s.booking_status = 'Pending'
              )
          )
    )
    SELECT
        h.booking_id,
        h.booking_reference::text,
        h.guest_name::text,
        ARRAY(
            SELECT u.unit_name::text
            FROM public.booking_unit_availability a
            JOIN public.units u ON u.unit_id = a.unit_id
            WHERE a.booking_id = h.booking_id
            ORDER BY u.unit_name
        ),
        h.check_in,
        h.check_out,
        h.booking_status::text,
        partial.reason IS NOT NULL,
        partial.reason,
        h.booking_status = 'CheckedIn'
    FROM hits h
    CROSS JOIN LATERAL (
        SELECT NULLIF(concat_ws('; ',
            (
                SELECT 'also uses ' || string_agg(u.unit_name::text, ', ' ORDER BY u.unit_name)
                FROM public.booking_unit_availability a
                JOIN public.units u ON u.unit_id = a.unit_id
                WHERE a.booking_id = h.booking_id
                  AND p_unit_ids IS NOT NULL
                  AND NOT (a.unit_id = ANY (p_unit_ids))
            ),
            CASE WHEN h.first_night < p_first_night THEN 'starts before the block' END,
            CASE WHEN h.last_night > p_last_night THEN 'stays past the block' END
        ), '') AS reason
    ) partial
    ORDER BY h.check_in, h.booking_reference;
$$;

COMMENT ON FUNCTION public.find_block_conflicts(uuid[], date, date, date, date) IS
    'Live bookings on the nights of a block (NULL units = resort closure). Shared by the block save guard, get_block_conflicts and cancel_bookings_and_save_block.';

REVOKE ALL ON FUNCTION public.find_block_conflicts(uuid[], date, date, date, date) FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- Block save guard
-- ============================================================================

-- The units a block locks: its cabin, or every cabin for a resort closure.
CREATE OR REPLACE FUNCTION public.lock_block_units(p_unit_ids uuid[])
RETURNS void
LANGUAGE sql
SET search_path = ''
AS $$
    SELECT public.lock_units(COALESCE(p_unit_ids, ARRAY(SELECT unit_id FROM public.units)));
$$;

REVOKE ALL ON FUNCTION public.lock_block_units(uuid[]) FROM PUBLIC, anon, authenticated;

-- Takes the same unit-row lock as refuse_booking_on_blocked_nights before it reads
-- bookings, so a booking and a block on the same night cannot both commit.
CREATE OR REPLACE FUNCTION public.refuse_block_over_bookings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_unit_ids uuid[] := CASE WHEN NEW.unit_id IS NULL THEN NULL ELSE ARRAY[NEW.unit_id] END;
    v_kept_first_night date;
    v_kept_last_night date;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.unit_id IS NOT DISTINCT FROM OLD.unit_id
           AND NEW.start_date >= OLD.start_date
           AND NEW.end_date <= OLD.end_date THEN
            RETURN NEW;
        END IF;
        v_kept_first_night := OLD.start_date;
        v_kept_last_night := OLD.end_date;
    END IF;

    PERFORM public.lock_block_units(v_unit_ids);

    IF EXISTS (
        SELECT 1
        FROM public.find_block_conflicts(v_unit_ids, NEW.start_date, NEW.end_date, v_kept_first_night, v_kept_last_night)
    ) THEN
        RAISE EXCEPTION 'Bookings use these nights. Cancel them or change the block dates.'
            USING ERRCODE = 'CNFLT';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.refuse_block_over_bookings() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS refuse_block_over_bookings ON public.availability_blackouts;
CREATE TRIGGER refuse_block_over_bookings
    BEFORE INSERT OR UPDATE OF unit_id, start_date, end_date ON public.availability_blackouts
    FOR EACH ROW EXECUTE FUNCTION public.refuse_block_over_bookings();

-- ============================================================================
-- Conflict query (staff and above)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_block_conflicts(
    p_first_night date,
    p_last_night date,
    p_unit_ids uuid[] DEFAULT NULL,
    p_block_id uuid DEFAULT NULL
)
RETURNS TABLE (
    booking_id uuid,
    booking_reference text,
    guest_name text,
    unit_names text[],
    check_in timestamptz,
    check_out timestamptz,
    booking_status text,
    is_partial boolean,
    partial_reason text,
    is_checked_in boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_block public.availability_blackouts%ROWTYPE;
    v_unit_ids uuid[] := p_unit_ids;
BEGIN
    IF NOT public.is_staff_or_above() THEN
        RAISE EXCEPTION 'Only staff can see block conflicts' USING ERRCODE = '42501';
    END IF;

    IF p_block_id IS NOT NULL THEN
        SELECT * INTO v_block FROM public.availability_blackouts WHERE blackout_id = p_block_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Block % not found', p_block_id USING ERRCODE = 'P0002';
        END IF;
        v_unit_ids := CASE WHEN v_block.unit_id IS NULL THEN NULL ELSE ARRAY[v_block.unit_id] END;
    END IF;

    RETURN QUERY
    SELECT *
    FROM public.find_block_conflicts(v_unit_ids, p_first_night, p_last_night, v_block.start_date, v_block.end_date);
END;
$$;

COMMENT ON FUNCTION public.get_block_conflicts(date, date, uuid[], uuid) IS
    'Bookings that conflict with a block on these nights. NULL p_unit_ids = resort closure. With p_block_id, the units come from that block and only nights it does not already cover count.';

REVOKE ALL ON FUNCTION public.get_block_conflicts(date, date, uuid[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_block_conflicts(date, date, uuid[], uuid) TO authenticated;

-- ============================================================================
-- Cancel and save (manager and above, one transaction)
-- ============================================================================

-- p_block is a new block {unit_ids (null = resort closure), start_date, end_date, reason}
-- or an edit {blackout_id, start_date?, end_date?, reason?}. p_booking_ids are the
-- conflicts the manager saw. Returns {status, conflicts, blocks}:
--   saved             the bookings are cancelled and the block rows are written
--   conflicts_changed nothing saved; conflicts is the new list
--   checked_in        nothing saved; a conflicting guest is checked in
-- Payment status is not changed.
CREATE OR REPLACE FUNCTION public.cancel_bookings_and_save_block(p_block jsonb, p_booking_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_block_id uuid := (p_block->>'blackout_id')::uuid;
    v_existing public.availability_blackouts%ROWTYPE;
    v_unit_ids uuid[];
    v_first_night date;
    v_last_night date;
    v_conflicts jsonb;
    v_conflict_ids uuid[];
    v_blocks jsonb;
BEGIN
    IF NOT public.is_manager_or_above() THEN
        RAISE EXCEPTION 'Only a manager can cancel bookings to save a block' USING ERRCODE = '42501';
    END IF;

    IF v_block_id IS NOT NULL THEN
        SELECT * INTO v_existing
        FROM public.availability_blackouts
        WHERE blackout_id = v_block_id
        FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Block % not found', v_block_id USING ERRCODE = 'P0002';
        END IF;
        v_unit_ids := CASE WHEN v_existing.unit_id IS NULL THEN NULL ELSE ARRAY[v_existing.unit_id] END;
        v_first_night := COALESCE((p_block->>'start_date')::date, v_existing.start_date);
        v_last_night := COALESCE((p_block->>'end_date')::date, v_existing.end_date);
    ELSE
        IF jsonb_typeof(p_block->'unit_ids') = 'array' THEN
            v_unit_ids := ARRAY(SELECT jsonb_array_elements_text(p_block->'unit_ids')::uuid);
            IF cardinality(v_unit_ids) = 0
               OR cardinality(v_unit_ids) <> (SELECT count(DISTINCT id) FROM unnest(v_unit_ids) AS id) THEN
                RAISE EXCEPTION 'unit_ids must name each cabin once, or be null for a resort closure'
                    USING ERRCODE = '22023';
            END IF;
        END IF;
        v_first_night := (p_block->>'start_date')::date;
        v_last_night := (p_block->>'end_date')::date;
    END IF;

    -- Bookings first, then units: the same order as a booking edit takes them.
    PERFORM 1
    FROM public.bookings
    WHERE booking_id = ANY (p_booking_ids)
    ORDER BY booking_id
    FOR UPDATE;

    PERFORM public.lock_block_units(v_unit_ids);

    SELECT
        COALESCE(jsonb_agg(to_jsonb(c)), '[]'::jsonb),
        COALESCE(array_agg(c.booking_id), '{}'::uuid[])
    INTO v_conflicts, v_conflict_ids
    FROM public.find_block_conflicts(
        v_unit_ids, v_first_night, v_last_night, v_existing.start_date, v_existing.end_date
    ) c;

    IF NOT (v_conflict_ids @> COALESCE(p_booking_ids, '{}') AND COALESCE(p_booking_ids, '{}') @> v_conflict_ids) THEN
        RETURN jsonb_build_object('status', 'conflicts_changed', 'conflicts', v_conflicts, 'blocks', '[]'::jsonb);
    END IF;

    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_conflicts) c WHERE (c->>'is_checked_in')::boolean) THEN
        RETURN jsonb_build_object('status', 'checked_in', 'conflicts', v_conflicts, 'blocks', '[]'::jsonb);
    END IF;

    UPDATE public.bookings
    SET booking_status = 'Cancelled'
    WHERE booking_id = ANY (v_conflict_ids);

    IF v_block_id IS NOT NULL THEN
        WITH saved AS (
            UPDATE public.availability_blackouts
            SET start_date = v_first_night,
                end_date = v_last_night,
                reason = COALESCE(p_block->>'reason', reason)
            WHERE blackout_id = v_block_id
            RETURNING *
        )
        SELECT jsonb_agg(to_jsonb(saved)) INTO v_blocks FROM saved;
    ELSE
        WITH saved AS (
            INSERT INTO public.availability_blackouts (unit_id, start_date, end_date, reason)
            SELECT unit_id, v_first_night, v_last_night, p_block->>'reason'
            FROM unnest(COALESCE(v_unit_ids, ARRAY[NULL::uuid])) AS unit_id
            RETURNING *
        )
        SELECT jsonb_agg(to_jsonb(saved)) INTO v_blocks FROM saved;
    END IF;

    RETURN jsonb_build_object('status', 'saved', 'conflicts', '[]'::jsonb, 'blocks', v_blocks);
END;
$$;

COMMENT ON FUNCTION public.cancel_bookings_and_save_block(jsonb, uuid[]) IS
    'Cancels the conflicting bookings the manager saw and saves the block in one transaction. Refuses all if the conflicts changed or a guest is checked in.';

REVOKE ALL ON FUNCTION public.cancel_bookings_and_save_block(jsonb, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_bookings_and_save_block(jsonb, uuid[]) TO authenticated;

COMMIT;
