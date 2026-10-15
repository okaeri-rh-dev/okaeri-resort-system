-- ============================================
-- Migration: Role-based RLS on core operational tables
-- Date: 2026-07-25
-- ============================================
-- Replaces the coarse "auth.role() = 'authenticated'" policies on the core
-- tables (which let ANY authenticated user do full CRUD directly via the
-- anon-key client, bypassing the functions-layer RBAC) with role-based policies
-- sourced from public.app_roles. Closes audit P0 #2
-- (vault note [[whole-app-audit-2026-07-21]]).
--
-- Levels mirror the frontend route-guards (src/lib/route-guards.ts). SELECT is
-- kept at staff+ where the bookings area (requireStaff) cross-reads a table, so
-- staff booking views do not break.
--
-- Access matrix (authenticated users). Levels reflect the app's ACTUAL
-- per-operation reachability (route guards + useUserRole flags + the direct
-- anon-client writes each flow performs), verified 2026-07-31 — not just page
-- guards. Notably staff can insert payments (payment-proof upload is "always
-- visible") and can delete a booking via the create-error rollback path.
--   table             SELECT    INSERT    UPDATE    DELETE
--   bookings          staff+    staff+    staff+    staff+
--   guests            staff+    staff+    manager+  manager+
--   payments          staff+    staff+    manager+  manager+
--   units             staff+    owner+    owner+    owner+
--   expenses          owner+    owner+    owner+    owner+
--   maintenance_logs  staff+    staff+    staff+    manager+
--
--   staff+   = admin/owner/manager/staff  (is_staff_or_above)
--   manager+ = admin/owner/manager        (is_manager_or_above)
--   owner+   = admin/owner                (is_admin_or_owner, pre-existing)
--
-- Only 'authenticated' policies change. Anon/public read paths (SECURITY DEFINER
-- availability functions, public views, payment_methods) are untouched, and the
-- service-role key (functions API + public guest-booking) bypasses RLS entirely.
-- ============================================

BEGIN;

-- --------------------------------------------
-- Hierarchical role helpers.
-- SECURITY DEFINER so the app_roles read does not recurse into app_roles' own
-- RLS; SET search_path = '' per the security-hardening convention (all object
-- refs schema-qualified). is_admin_or_owner already exists for owner+.
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.is_staff_or_above(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.app_roles
        WHERE user_id = check_user_id
          AND role IN ('admin', 'owner', 'manager', 'staff')
          AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

COMMENT ON FUNCTION public.is_staff_or_above IS
    'True if the user holds an active staff/manager/owner/admin role in app_roles.';

CREATE OR REPLACE FUNCTION public.is_manager_or_above(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.app_roles
        WHERE user_id = check_user_id
          AND role IN ('admin', 'owner', 'manager')
          AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

COMMENT ON FUNCTION public.is_manager_or_above IS
    'True if the user holds an active manager/owner/admin role in app_roles.';

-- ============================================
-- bookings — SELECT/INSERT/UPDATE staff+, DELETE manager+
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view bookings" ON public.bookings;
DROP POLICY IF EXISTS "Authenticated users can insert bookings" ON public.bookings;
DROP POLICY IF EXISTS "Authenticated users can update bookings" ON public.bookings;
DROP POLICY IF EXISTS "Authenticated users can delete bookings" ON public.bookings;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.bookings;

CREATE POLICY "bookings_select_staff" ON public.bookings
    FOR SELECT TO authenticated USING (public.is_staff_or_above());
CREATE POLICY "bookings_insert_staff" ON public.bookings
    FOR INSERT TO authenticated WITH CHECK (public.is_staff_or_above());
CREATE POLICY "bookings_update_staff" ON public.bookings
    FOR UPDATE TO authenticated USING (public.is_staff_or_above()) WITH CHECK (public.is_staff_or_above());
-- staff+: booking creation rolls back with a client-side DELETE on error
-- (useBookingStore create path), so staff must be able to delete. The UI still
-- gates the explicit Delete action to owner+ (useUserRole.canDelete).
CREATE POLICY "bookings_delete_staff" ON public.bookings
    FOR DELETE TO authenticated USING (public.is_staff_or_above());

-- ============================================
-- guests — SELECT/INSERT staff+, UPDATE/DELETE manager+
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view guests" ON public.guests;
DROP POLICY IF EXISTS "Authenticated users can insert guests" ON public.guests;
DROP POLICY IF EXISTS "Authenticated users can update guests" ON public.guests;
DROP POLICY IF EXISTS "Authenticated users can delete guests" ON public.guests;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.guests;

CREATE POLICY "guests_select_staff" ON public.guests
    FOR SELECT TO authenticated USING (public.is_staff_or_above());
CREATE POLICY "guests_insert_staff" ON public.guests
    FOR INSERT TO authenticated WITH CHECK (public.is_staff_or_above());
CREATE POLICY "guests_update_manager" ON public.guests
    FOR UPDATE TO authenticated USING (public.is_manager_or_above()) WITH CHECK (public.is_manager_or_above());
CREATE POLICY "guests_delete_manager" ON public.guests
    FOR DELETE TO authenticated USING (public.is_manager_or_above());

-- ============================================
-- payments — SELECT staff+, INSERT/UPDATE/DELETE manager+
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can update payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can delete payments" ON public.payments;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.payments;

CREATE POLICY "payments_select_staff" ON public.payments
    FOR SELECT TO authenticated USING (public.is_staff_or_above());
-- staff+: the "Upload Payment" action is always visible so staff can attach
-- payment proofs on behalf of guests (useUploadPaymentProof inserts a payment).
CREATE POLICY "payments_insert_staff" ON public.payments
    FOR INSERT TO authenticated WITH CHECK (public.is_staff_or_above());
CREATE POLICY "payments_update_manager" ON public.payments
    FOR UPDATE TO authenticated USING (public.is_manager_or_above()) WITH CHECK (public.is_manager_or_above());
CREATE POLICY "payments_delete_manager" ON public.payments
    FOR DELETE TO authenticated USING (public.is_manager_or_above());

-- ============================================
-- units — SELECT staff+, INSERT/UPDATE/DELETE owner+
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view units" ON public.units;
DROP POLICY IF EXISTS "Authenticated users can insert units" ON public.units;
DROP POLICY IF EXISTS "Authenticated users can update units" ON public.units;
DROP POLICY IF EXISTS "Authenticated users can delete units" ON public.units;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.units;

CREATE POLICY "units_select_staff" ON public.units
    FOR SELECT TO authenticated USING (public.is_staff_or_above());
CREATE POLICY "units_insert_owner" ON public.units
    FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_owner());
CREATE POLICY "units_update_owner" ON public.units
    FOR UPDATE TO authenticated USING (public.is_admin_or_owner()) WITH CHECK (public.is_admin_or_owner());
CREATE POLICY "units_delete_owner" ON public.units
    FOR DELETE TO authenticated USING (public.is_admin_or_owner());

-- ============================================
-- expenses — all operations owner+
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated users can insert expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated users can update expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated users can delete expenses" ON public.expenses;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.expenses;

CREATE POLICY "expenses_select_owner" ON public.expenses
    FOR SELECT TO authenticated USING (public.is_admin_or_owner());
CREATE POLICY "expenses_insert_owner" ON public.expenses
    FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_owner());
CREATE POLICY "expenses_update_owner" ON public.expenses
    FOR UPDATE TO authenticated USING (public.is_admin_or_owner()) WITH CHECK (public.is_admin_or_owner());
CREATE POLICY "expenses_delete_owner" ON public.expenses
    FOR DELETE TO authenticated USING (public.is_admin_or_owner());

-- ============================================
-- maintenance_logs — SELECT/INSERT/UPDATE staff+, DELETE manager+
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view maintenance_logs" ON public.maintenance_logs;
DROP POLICY IF EXISTS "Authenticated users can insert maintenance_logs" ON public.maintenance_logs;
DROP POLICY IF EXISTS "Authenticated users can update maintenance_logs" ON public.maintenance_logs;
DROP POLICY IF EXISTS "Authenticated users can delete maintenance_logs" ON public.maintenance_logs;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.maintenance_logs;

CREATE POLICY "maintenance_logs_select_staff" ON public.maintenance_logs
    FOR SELECT TO authenticated USING (public.is_staff_or_above());
CREATE POLICY "maintenance_logs_insert_staff" ON public.maintenance_logs
    FOR INSERT TO authenticated WITH CHECK (public.is_staff_or_above());
CREATE POLICY "maintenance_logs_update_staff" ON public.maintenance_logs
    FOR UPDATE TO authenticated USING (public.is_staff_or_above()) WITH CHECK (public.is_staff_or_above());
CREATE POLICY "maintenance_logs_delete_manager" ON public.maintenance_logs
    FOR DELETE TO authenticated USING (public.is_manager_or_above());

COMMIT;
