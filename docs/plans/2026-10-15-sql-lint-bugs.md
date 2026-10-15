# SQL lint bugs (guardrails deferred list #3)

Source: `docs/plans/2026-10-03-guardrails-design.md`, Deferred list item 3. Branch `fix/sql-lint-bugs`.

## Findings (2026-10-15)

`supabase db lint --local` reports five errors:

| Function                                                              | Error                                                                                                                                                                                                                                                                                     | Prod                                                            |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `cleanup_expired_payment_proofs()`                                    | reads `check_out_date` (column is `check_out`); `'Completed'` is not a booking status; ignores `Cancelled`; keeps only the last path segment, so `bookings/<id>/<file>` paths are wrong; returns `SETOF file_path`, but the cron reads `{deleted_count, storage_freed_bytes, file_paths}` | absent (baseline: local-only), so the weekly cron fails on prod |
| `attach_audit_trigger` / `detach_audit_trigger`                       | `audit_trigger_%I` produces `audit_trigger_"T"` (a syntax error) only for names that need quoting; plain lowercase names work, and the lint error comes from static analysis                                                                                                              | same                                                            |
| `archive_logs_older_than_months(int)` / `monthly_archive_until(date)` | call `archive_audit_logs(timestamptz)`, which is ambiguous between the 1-arg version and the 2-arg version with `dry_run DEFAULT true`                                                                                                                                                    | same                                                            |

New: **anon and authenticated hold EXECUTE on all of them**, on local and on prod (read via `pg_proc.proacl` on 2026-10-15). Most are `SECURITY DEFINER`, so anyone with the public anon key can call `rpc/archive_audit_logs` with `dry_run=false` and move audit rows out of `audit_logs`, or call `rpc/restore_logs_from_archive`. `detach_audit_trigger` is only safe because of its format bug. Fixing it without a revoke would let anyone remove audit triggers.

Also: prod's 1-arg `archive_audit_logs` / `restore_logs_from_archive` have different bodies (baseline lines 5–10). Prod's version inserts into `original_audit_id`/`changes`, columns that don't exist on either side, so it fails there too.

Callers: `db.auditLogs.archiveOld` (`src/lib/supabase.ts:769`, named arg `cutoff_date` → the 2-arg version) has no callers. The cron (`functions/scheduled/cleanup-payment-proofs.ts`) calls `cleanup_expired_payment_proofs` with the service role.

## Tasks

- [x] 1. Migration `20261015000000_fix_sql_lint_functions.sql` + DB test `src/__tests__/database/sql-maintenance-functions.test.ts` (red first):
  - revoke EXECUTE from `public, anon, authenticated` on the archive / restore / attach / detach / cleanup functions; service_role only
  - drop the 1-arg overloads `archive_audit_logs(timestamptz)`, `archive_logs_older_than_months(int)`, `monthly_archive_until(date)`, `restore_logs_from_archive(date)`; the 2-arg family stays (named-arg callers, dry-run default)
  - 2-arg `archive_audit_logs`: explicit column list instead of `SELECT *`
  - `attach_audit_trigger` / `detach_audit_trigger`: `format('%I', 'audit_trigger_' || name)`
  - `cleanup_expired_payment_proofs`: `CheckedOut` + 90 days after `check_out`, `Cancelled` + 30 days after `updated_at`; returns the storage path inside the `payment-proofs` bucket (public URL prefix and query string stripped); also clears `payments.proof_url` that points at the same file; `SET search_path = ''`
- [x] 2. Cron reads `SETOF file_path` (typed client, `deleted_count = rows.length`), and the byte-based alert is removed (SQL cannot know file sizes); unit test.
- [ ] 3. `npm run gen:types`; `supabase db lint --local` clean of errors; drift baseline lines for dropped/changed objects updated; `npm run verify`; `npm run test:db`; PR. Done 2026-10-15 except the PR: lint shows 0 errors (4 pre-existing warnings), verify 1467 passed / 20 skipped, test:db 121 passed. Unused `db.auditLogs.archiveOld` removed (browser client, now denied). Baseline edited by hand (agent prod reads are blocked), so it is unconfirmed until the drift check after the push.
- [ ] 4. User: `supabase db push`; drift check.

## Decisions & Deferrals

- **Test fixtures use the database clock (2026-10-15).** Why: `src/test/setup.ts` pins `Date.now()` to 2025-09-25 for every suite, while retention SQL compares with `now()`. Revisit: if the global fake time is removed.

- **#3 before #2; #2 goes the retention route (2026-10-15, user: recommended defaults).** Why: retention needs a working archive function, which is what this fixes. Revisit: after this merges, as the next deferred-list item.
- **Revoke EXECUTE from anon/authenticated in this migration (2026-10-15).** Why: found during #3; fixing `detach_audit_trigger` without it would open a hole. No browser caller depends on it. Revisit: n/a.
- **Keep the 2-arg archive family, drop the 1-arg one (2-arg on 2026-10-15).** Why: it removes the ambiguity and the prod body drift together; the 2-arg family has the dry-run guard and the app helper's arg names. Revisit: n/a.
- **Storage files are removed after the DB references are cleared (ordering unchanged).** Why: if a storage delete fails, the file is orphaned, and the cron comment's "next cycle retries" is false. A low-volume resort makes this rare; fixing the order would need a two-step SQL API. Revisit: if storage-usage alerts fire.
