-- ============================================
-- Migration: Restore get_booking_units to post-multi-unit shape
-- Description: get_booking_units regressed during 20260209120000_security_hardening.sql.
--              That migration retrofitted SET search_path = '' onto every Postgres
--              function in the repo, and for this function it took the original
--              20251008152700_multi_unit_schema.sql body as its starting point
--              instead of the corrected 20251018_fix_get_booking_units.sql body.
--              The result re-introduced COALESCE(bu.unit_id, b.unit_id) and a JOIN
--              on the same expression -- but bookings.unit_id was dropped in
--              20251017_unified_multi_unit.sql, so every call now errors with
--              42703 "column b.unit_id does not exist".
--
--              This patch restores the 2025-10-18 fix while preserving the
--              hardening conventions introduced 2026-02-09 (public. prefixes on
--              all tables, SET search_path = '' on the function).
--
--              No schema changes. No data migration. No constraint change.
-- Date: 2026-06-05
-- ============================================

CREATE OR REPLACE FUNCTION public.get_booking_units(p_booking_id UUID)
RETURNS TABLE (
    unit_id UUID,
    unit_name VARCHAR(100),
    unit_code VARCHAR(10),
    unit_type VARCHAR(50),
    unit_price DECIMAL(10,2),
    subtotal DECIMAL(10,2),
    assigned_guests INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        bu.unit_id,
        u.unit_name,
        u.unit_code,
        u.unit_type,
        bu.unit_price,
        bu.subtotal,
        bu.assigned_guests
    FROM public.booking_units bu
    INNER JOIN public.units u ON u.unit_id = bu.unit_id
    WHERE bu.booking_id = p_booking_id;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = '';

COMMENT ON FUNCTION public.get_booking_units IS
  'Get units for a booking (unified architecture - all bookings use booking_units junction table). Restored 2026-06-05 after the 2026-02-09 security-hardening pass re-introduced removed bookings.unit_id references.';
