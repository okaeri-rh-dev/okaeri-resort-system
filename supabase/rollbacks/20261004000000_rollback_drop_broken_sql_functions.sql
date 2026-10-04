-- ============================================
-- ROLLBACK for 20261004000000_drop_broken_sql_functions.sql
-- ============================================
-- Recreates both functions exactly as they were (both fail when called).
-- ============================================

BEGIN;

CREATE OR REPLACE FUNCTION public.check_unit_availability(p_unit_id uuid, p_check_in timestamp with time zone, p_check_out timestamp with time zone)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.revoke_audit_role(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    UPDATE public.app_roles
    SET is_active = FALSE, updated_at = NOW()
    WHERE user_id = p_user_id;
END;
$function$;

COMMIT;
