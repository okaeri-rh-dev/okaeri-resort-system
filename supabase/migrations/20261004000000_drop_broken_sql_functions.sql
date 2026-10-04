-- ============================================
-- Drop two SQL functions that fail on every call (found by supabase db lint,
-- confirmed on prod 2026-10-04). Neither has an app caller.
--
-- check_unit_availability(uuid, timestamptz, timestamptz):
--   reads bookings.unit_id, dropped by 20251017000000_unified_multi_unit. It also
--   makes 3-argument calls ambiguous (PGRST203) next to the 4-argument overload,
--   whose p_exclude_booking_id defaults to NULL. Dropping it lets 3-argument calls
--   resolve to the working 4-argument version.
--
-- revoke_audit_role(uuid):
--   sets app_roles.updated_at, which does not exist (42703).
--
-- Rollback: supabase/rollbacks/20261004000000_rollback_drop_broken_sql_functions.sql
-- ============================================

DROP FUNCTION IF EXISTS public.check_unit_availability(uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.revoke_audit_role(uuid);
