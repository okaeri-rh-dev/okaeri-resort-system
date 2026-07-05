-- ============================================
-- Migration: Add is_walk_in flag to bookings
-- Description: Captures whether a guest arrived on-site without a prior reservation.
--              Orthogonal to is_guest_booking (which marks public portal submissions).
--              Pure reporting flag: does not affect pricing, payment, or notifications.
-- Date: 2026-05-21
-- ============================================

BEGIN;

-- 1. Add the column with a safe default for existing rows
ALTER TABLE public.bookings
  ADD COLUMN is_walk_in boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.bookings.is_walk_in IS
  'True when the guest arrived on-site without a prior reservation. Reporting flag only.';

-- 2. Recreate create_multi_unit_booking so the RPC can persist is_walk_in
--    Body is identical to 20260222_fix_multi_unit_booking_function.sql except for
--    the added is_walk_in column in the INSERT.
CREATE OR REPLACE FUNCTION public.create_multi_unit_booking(
    p_booking_data JSONB,
    p_units JSONB[],
    p_guest_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_booking_id UUID;
    v_unit JSONB;
    v_total_amount DECIMAL(10,2) := 0;
BEGIN
    FOREACH v_unit IN ARRAY p_units
    LOOP
        v_total_amount := v_total_amount + (v_unit->>'subtotal')::DECIMAL;
    END LOOP;

    INSERT INTO public.bookings (
        booking_reference,
        guest_id,
        guest_name,
        contact_number,
        email,
        num_guests,
        check_in,
        check_out,
        total_amount,
        is_multi_unit,
        unit_count,
        booking_status,
        payment_status,
        special_requests,
        internal_notes,
        is_walk_in
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
        p_booking_data->>'special_requests',
        p_booking_data->>'internal_notes',
        COALESCE((p_booking_data->>'is_walk_in')::BOOLEAN, false)
    ) RETURNING booking_id INTO v_booking_id;

    FOREACH v_unit IN ARRAY p_units
    LOOP
        INSERT INTO public.booking_units (
            booking_id,
            unit_id,
            unit_price,
            weekend_surcharge,
            extra_person_charge,
            subtotal,
            assigned_guests,
            unit_notes
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
            unit_id,
            booking_id,
            check_in,
            check_out,
            booking_status
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

COMMIT;
