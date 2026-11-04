-- Every booking records where it came from (GLOSSARY.md: Booking source).
-- is_walk_in and is_guest_booking stay for backwards compatibility and follow
-- the source. Website is set only by the public site: signed-in users cannot
-- set it or change it away.
ALTER TABLE public.bookings
    ADD COLUMN booking_source TEXT
    CHECK (booking_source IN ('Website', 'Walk-in', 'Direct', 'Airbnb'));

UPDATE public.bookings
SET booking_source = CASE
    WHEN is_guest_booking THEN 'Website'
    WHEN is_walk_in THEN 'Walk-in'
    ELSE 'Direct'
END;

ALTER TABLE public.bookings
    ALTER COLUMN booking_source SET DEFAULT 'Direct',
    ALTER COLUMN booking_source SET NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_booking_source()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    -- Writers from before booking_source set only a flag and get the default,
    -- so on insert a set flag wins over Direct.
    IF TG_OP = 'INSERT' AND NEW.booking_source = 'Direct' THEN
        NEW.booking_source := CASE
            WHEN NEW.is_guest_booking THEN 'Website'
            WHEN NEW.is_walk_in THEN 'Walk-in'
            ELSE 'Direct'
        END;
    END IF;

    IF auth.role() = 'authenticated'
       AND (NEW.booking_source = 'Website') IS DISTINCT FROM
           (COALESCE(OLD.booking_source, '') = 'Website') THEN
        RAISE EXCEPTION 'Only the public site can set the Website booking source'
            USING ERRCODE = '42501';
    END IF;

    NEW.is_walk_in := NEW.booking_source = 'Walk-in';
    NEW.is_guest_booking := NEW.booking_source = 'Website';
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_booking_source ON public.bookings;
CREATE TRIGGER sync_booking_source
    BEFORE INSERT OR UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.sync_booking_source();

-- Staff edit the source; the flags follow it.
REVOKE UPDATE (is_walk_in) ON TABLE public.bookings FROM authenticated;
GRANT UPDATE (booking_source) ON TABLE public.bookings TO authenticated;

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
        special_requests, internal_notes, is_walk_in, booking_source
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
        COALESCE((p_booking_data->>'is_walk_in')::BOOLEAN, false),
        COALESCE(p_booking_data->>'booking_source', 'Direct')
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
