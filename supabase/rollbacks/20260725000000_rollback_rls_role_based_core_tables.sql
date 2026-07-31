-- ============================================
-- ROLLBACK for 20260725000000_rls_role_based_core_tables.sql
-- ============================================
-- Restores the original coarse "auth.role() = 'authenticated'" policies on the
-- core tables and removes the role-based policies + helpers added by the forward
-- migration. Use only to revert the RLS hardening (reopens the P0 #2 hole).
-- ============================================

BEGIN;

-- --------------------------------------------
-- Drop the role-based policies (must precede dropping the helpers they call)
-- --------------------------------------------
DROP POLICY IF EXISTS "bookings_select_staff" ON public.bookings;
DROP POLICY IF EXISTS "bookings_insert_staff" ON public.bookings;
DROP POLICY IF EXISTS "bookings_update_staff" ON public.bookings;
DROP POLICY IF EXISTS "bookings_delete_staff" ON public.bookings;

DROP POLICY IF EXISTS "guests_select_staff" ON public.guests;
DROP POLICY IF EXISTS "guests_insert_staff" ON public.guests;
DROP POLICY IF EXISTS "guests_update_manager" ON public.guests;
DROP POLICY IF EXISTS "guests_delete_manager" ON public.guests;

DROP POLICY IF EXISTS "payments_select_staff" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_staff" ON public.payments;
DROP POLICY IF EXISTS "payments_update_manager" ON public.payments;
DROP POLICY IF EXISTS "payments_delete_manager" ON public.payments;

DROP POLICY IF EXISTS "units_select_staff" ON public.units;
DROP POLICY IF EXISTS "units_insert_owner" ON public.units;
DROP POLICY IF EXISTS "units_update_owner" ON public.units;
DROP POLICY IF EXISTS "units_delete_owner" ON public.units;

DROP POLICY IF EXISTS "expenses_select_owner" ON public.expenses;
DROP POLICY IF EXISTS "expenses_insert_owner" ON public.expenses;
DROP POLICY IF EXISTS "expenses_update_owner" ON public.expenses;
DROP POLICY IF EXISTS "expenses_delete_owner" ON public.expenses;

DROP POLICY IF EXISTS "maintenance_logs_select_staff" ON public.maintenance_logs;
DROP POLICY IF EXISTS "maintenance_logs_insert_staff" ON public.maintenance_logs;
DROP POLICY IF EXISTS "maintenance_logs_update_staff" ON public.maintenance_logs;
DROP POLICY IF EXISTS "maintenance_logs_delete_manager" ON public.maintenance_logs;

DROP FUNCTION IF EXISTS public.is_staff_or_above(UUID);
DROP FUNCTION IF EXISTS public.is_manager_or_above(UUID);

-- --------------------------------------------
-- Recreate the original coarse policies (any authenticated user, full CRUD)
-- --------------------------------------------
DO $$
DECLARE
    t TEXT;
    -- Tables that also had a redundant "Enable all for authenticated users"
    with_enable_all TEXT[] := ARRAY['bookings', 'guests', 'payments', 'units', 'expenses'];
BEGIN
    FOREACH t IN ARRAY ARRAY['bookings', 'guests', 'payments', 'units', 'expenses', 'maintenance_logs']
    LOOP
        EXECUTE format(
            'CREATE POLICY "Authenticated users can view %1$s" ON public.%1$s FOR SELECT USING (auth.role() = ''authenticated'')', t);
        EXECUTE format(
            'CREATE POLICY "Authenticated users can insert %1$s" ON public.%1$s FOR INSERT WITH CHECK (auth.role() = ''authenticated'')', t);
        EXECUTE format(
            'CREATE POLICY "Authenticated users can update %1$s" ON public.%1$s FOR UPDATE USING (auth.role() = ''authenticated'') WITH CHECK (auth.role() = ''authenticated'')', t);
        EXECUTE format(
            'CREATE POLICY "Authenticated users can delete %1$s" ON public.%1$s FOR DELETE USING (auth.role() = ''authenticated'')', t);
        IF t = ANY(with_enable_all) THEN
            EXECUTE format(
                'CREATE POLICY "Enable all for authenticated users" ON public.%1$s USING (auth.role() = ''authenticated'')', t);
        END IF;
    END LOOP;
END $$;

COMMIT;
