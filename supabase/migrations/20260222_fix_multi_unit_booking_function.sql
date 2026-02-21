-- ============================================
-- Migration: Fix Multi-Unit Booking Function Regressions
-- Description: Fix regressions introduced by security hardening migration (20260209)
-- Date: 2026-02-22
-- Author: Claude Code
-- ============================================
--
-- FIXES:
-- 1. create_multi_unit_booking: Restore booking_unit_availability INSERT
--    (removed during security hardening, causing missing availability records)
-- 2. create_multi_unit_booking: Add internal_notes to bookings INSERT
--    (data was silently dropped)
-- 3. update_booking_totals: Restore >= 1 logic and aggregate columns
--    (reverted to > 1 and lost num_guests, base_amount, total_surcharges)
-- 4. Backfill any missing booking_unit_availability records
--
-- ============================================

BEGIN;

-- ============================================
-- FIX 1 & 2: Recreate create_multi_unit_booking
-- ============================================
-- Restores:
--   - booking_unit_availability INSERT (prevents double-bookings)
--   - internal_notes column in bookings INSERT

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
        internal_notes
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
        p_booking_data->>'internal_notes'
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

        -- Restore availability record creation (missing since security hardening)
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

-- ============================================
-- FIX 3: Recreate update_booking_totals
-- ============================================
-- Restores:
--   - COUNT(*) >= 1 (unified architecture: even 1-unit bookings are "multi-unit")
--   - num_guests aggregate from assigned_guests
--   - base_amount aggregate from unit_price
--   - total_surcharges aggregate from weekend_surcharge + extra_person_charge

CREATE OR REPLACE FUNCTION public.update_booking_totals()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE public.bookings
        SET
            total_amount = (
                SELECT COALESCE(SUM(subtotal), 0)
                FROM public.booking_units
                WHERE booking_id = NEW.booking_id
            ),
            unit_count = (
                SELECT COUNT(*)
                FROM public.booking_units
                WHERE booking_id = NEW.booking_id
            ),
            is_multi_unit = (
                SELECT COUNT(*) >= 1
                FROM public.booking_units
                WHERE booking_id = NEW.booking_id
            ),
            num_guests = (
                SELECT COALESCE(SUM(assigned_guests), 0)
                FROM public.booking_units
                WHERE booking_id = NEW.booking_id
            ),
            base_amount = (
                SELECT COALESCE(SUM(unit_price), 0)
                FROM public.booking_units
                WHERE booking_id = NEW.booking_id
            ),
            total_surcharges = (
                SELECT COALESCE(SUM(weekend_surcharge + extra_person_charge), 0)
                FROM public.booking_units
                WHERE booking_id = NEW.booking_id
            ),
            updated_at = NOW()
        WHERE booking_id = NEW.booking_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.bookings
        SET
            total_amount = (
                SELECT COALESCE(SUM(subtotal), 0)
                FROM public.booking_units
                WHERE booking_id = OLD.booking_id
            ),
            unit_count = (
                SELECT COUNT(*)
                FROM public.booking_units
                WHERE booking_id = OLD.booking_id
            ),
            is_multi_unit = (
                SELECT COUNT(*) >= 1
                FROM public.booking_units
                WHERE booking_id = OLD.booking_id
            ),
            num_guests = (
                SELECT COALESCE(SUM(assigned_guests), 0)
                FROM public.booking_units
                WHERE booking_id = OLD.booking_id
            ),
            base_amount = (
                SELECT COALESCE(SUM(unit_price), 0)
                FROM public.booking_units
                WHERE booking_id = OLD.booking_id
            ),
            total_surcharges = (
                SELECT COALESCE(SUM(weekend_surcharge + extra_person_charge), 0)
                FROM public.booking_units
                WHERE booking_id = OLD.booking_id
            ),
            updated_at = NOW()
        WHERE booking_id = OLD.booking_id;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- ============================================
-- FIX 4: Backfill missing booking_unit_availability records
-- ============================================
-- Any bookings created after the security hardening migration
-- may be missing availability records

INSERT INTO public.booking_unit_availability (
    unit_id,
    booking_id,
    check_in,
    check_out,
    booking_status
)
SELECT
    bu.unit_id,
    bu.booking_id,
    b.check_in,
    b.check_out,
    b.booking_status
FROM public.booking_units bu
JOIN public.bookings b ON b.booking_id = bu.booking_id
WHERE NOT EXISTS (
    SELECT 1 FROM public.booking_unit_availability bua
    WHERE bua.booking_id = bu.booking_id
      AND bua.unit_id = bu.unit_id
);

COMMIT;
