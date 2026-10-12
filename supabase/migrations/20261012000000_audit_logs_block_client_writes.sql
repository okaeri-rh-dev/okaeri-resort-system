-- Audit rows are written only by SECURITY DEFINER functions owned by postgres
-- (audit_trigger_func, archive_audit_logs, restore_logs_from_archive) and by the
-- Pages functions' service-role client. Both bypass grants and RLS, so clients
-- need no INSERT path. Before this, any signed-in user could insert forged rows.

revoke insert, update, delete, truncate on public.audit_logs from anon, authenticated;
drop policy if exists "audit_logs_insert_policy" on public.audit_logs;

revoke insert, update, delete, truncate on public.audit_logs_archive from anon, authenticated;
drop policy if exists "audit_logs_archive_insert_policy" on public.audit_logs_archive;
