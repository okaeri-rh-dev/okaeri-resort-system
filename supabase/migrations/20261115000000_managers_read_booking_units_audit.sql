-- Managers see cabin changes in a booking's History (issue 458).
BEGIN;

DROP POLICY "audit_logs_select_policy" ON public.audit_logs;
CREATE POLICY "audit_logs_select_policy" ON public.audit_logs FOR SELECT USING (
    public.is_admin_or_owner(auth.uid())
    OR (
        public.is_manager(auth.uid())
        AND table_name = ANY (ARRAY['bookings', 'booking_units', 'payments', 'guests', 'expenses', 'system', 'authentication'])
    )
    OR user_email = ((current_setting('request.jwt.claims', true))::json ->> 'email')
);

DROP POLICY "audit_logs_archive_select_policy" ON public.audit_logs_archive;
CREATE POLICY "audit_logs_archive_select_policy" ON public.audit_logs_archive FOR SELECT USING (
    public.is_admin_or_owner(auth.uid())
    OR (
        public.is_manager(auth.uid())
        AND table_name = ANY (ARRAY['bookings', 'booking_units', 'payments', 'guests', 'expenses', 'system', 'authentication'])
    )
    OR user_email = ((current_setting('request.jwt.claims', true))::json ->> 'email')
);

COMMIT;
