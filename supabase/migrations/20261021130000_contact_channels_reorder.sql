-- Contact channels: new channels go to the end of the list, and manager+ can
-- move a channel up or down. A move renumbers the list 0..n-1 and swaps the
-- channel with its neighbour in one transaction, so both rows change or neither.

BEGIN;

CREATE OR REPLACE FUNCTION public.next_contact_channel_order()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT COALESCE(MAX(display_order) + 1, 0) FROM public.contact_channels;
$$;

ALTER TABLE public.contact_channels
    ALTER COLUMN display_order SET DEFAULT public.next_contact_channel_order();

-- SECURITY INVOKER keeps the table's RLS in force; the explicit check turns a
-- non-manager call into an error instead of a silent no-op.
CREATE OR REPLACE FUNCTION public.reorder_contact_channel(p_id UUID, p_direction TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_position INTEGER;
    v_neighbour INTEGER;
BEGIN
    IF NOT public.is_manager_or_above() THEN
        RAISE EXCEPTION 'Only managers can reorder contact channels' USING ERRCODE = '42501';
    END IF;

    IF p_direction IS NULL OR p_direction NOT IN ('up', 'down') THEN
        RAISE EXCEPTION 'Direction must be up or down' USING ERRCODE = '22023';
    END IF;

    PERFORM 1 FROM public.contact_channels FOR UPDATE;

    WITH ranked AS (
        SELECT id, (ROW_NUMBER() OVER (ORDER BY display_order, created_at, id) - 1)::INTEGER AS position
        FROM public.contact_channels
    )
    UPDATE public.contact_channels c
    SET display_order = ranked.position
    FROM ranked
    WHERE c.id = ranked.id AND c.display_order <> ranked.position;

    SELECT display_order INTO v_position FROM public.contact_channels WHERE id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Contact channel not found' USING ERRCODE = 'P0002';
    END IF;

    v_neighbour := v_position + CASE p_direction WHEN 'up' THEN -1 ELSE 1 END;

    IF NOT EXISTS (SELECT 1 FROM public.contact_channels WHERE display_order = v_neighbour) THEN
        RETURN;
    END IF;

    UPDATE public.contact_channels
    SET display_order = CASE WHEN id = p_id THEN v_neighbour ELSE v_position END
    WHERE id = p_id OR display_order = v_neighbour;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_contact_channel(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_contact_channel(UUID, TEXT) TO authenticated;

COMMIT;
