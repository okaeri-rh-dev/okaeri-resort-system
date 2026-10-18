# Audit retention design (guardrails deferred list #2)

Source: `docs/plans/2026-10-03-guardrails-design.md`, Deferred list item 2. Audit rows keep personal data in `old_data`/`new_data` and the actor columns forever, including after the source row is deleted. Goal: align audit retention with the Data Privacy Act of 2012 (RA 10173) proportionality principle by anonymizing old audit rows in place.

## Context (2026-10-18)

- Prod `audit_logs`: 1740 rows, 3352 kB with indexes, oldest 2025-10-02 (about 140 rows a month). `audit_logs_archive`: 0 rows; archiving has never run.
- `table_name` values on prod include trigger names (`bookings`, `guests`, `payments`, `booking_units`, `expenses`, `app_roles`, `units`, `pricing_config`) and legacy app-logged names (`booking`, `authentication`, `auth_events`, `multiple_tables`, `schema_migrations`).
- `enforce_audit_identity` is `BEFORE INSERT` only; client writes to both audit tables were revoked in `20261012000000`, so only service-role code can update rows.
- Scheduled jobs run from `.github/workflows/scheduled-cleanup.yml`, which calls `CRON_SECRET`-protected `/api/cron/*` endpoints. The weekly payment-proof schedule is still disabled (removed while the SQL function was absent on prod; fixed in PR #25).

## Rules

A row qualifies when `created_at < now() - interval '24 months'` [CONFIRM: business/legal call; a lawyer or NPC guidance should confirm the period] and it still holds a value the rules clear.

| Columns                                                                                                                                                                                | Rule                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `user_email`, `ip_address`, `user_agent`                                                                                                                                               | Set to NULL on every row.                                            |
| `old_data`, `new_data`, `metadata`, `description`                                                                                                                                      | Set to NULL on every row whose `table_name` is not on the keep-list. |
| `action`, `table_name`, `record_id`, `record_pk`, `user_id`, `user_role`, `changed_fields`, `category`, `severity`, `created_at`, `audit_id`, `correlation_id`, `event_type`, `source` | Kept.                                                                |

Keep-list (tables without personal data): `units`, `pricing_config`, `schema_migrations`, `maintenance_logs`. Any other `table_name`, including legacy and future names, is anonymized, so a missed entry over-anonymizes rather than leaks.

Kept rows are pseudonymized, not anonymous: `record_id` can point at a guest who still exists, and `user_id` identifies a staff member. Both serve accountability ("staff Y changed booking X's `phone_number` on date Z"), which `changed_fields` preserves without values.

## Components

```text
.github/workflows/scheduled-cleanup.yml   weekly, Sun 03:00 UTC ("0 3 * * 0")
  ├─ POST /api/cron/cleanup-payment-proofs        schedule restored
  └─ POST /api/cron/anonymize-audit               new
       verifyCronAuth(request, env)               functions/lib/cron-auth.ts (new)
       anonymizeAuditLogs(env)                    functions/scheduled/anonymize-audit.ts (new)
         rpc("anonymize_audit_logs")
           → { anonymized_count, audit_logs_bytes }
         log both; warn when audit_logs_bytes > 50 MB
```

1. Migration: `public.anonymize_audit_logs(p_older_than interval DEFAULT '24 months') RETURNS TABLE(anonymized_count bigint, audit_logs_bytes bigint)`. `SECURITY DEFINER`, `SET search_path = ''`, EXECUTE revoked from `public, anon, authenticated` and granted to `service_role`. Applies the rules to `audit_logs` and `audit_logs_archive` (one `UPDATE` each), so archiving cannot bypass the clock. The keep-list is a constant in the function; `audit_logs_bytes` is `pg_total_relation_size('public.audit_logs')`.
2. `functions/lib/cron-auth.ts`: the `verifyAuth` that `functions/api/cron/cleanup-idempotency.ts` and `cleanup-payment-proofs.ts` each duplicate, extracted; both import it.
3. `functions/api/cron/anonymize-audit.ts` (auth, response) and `functions/scheduled/anonymize-audit.ts` (RPC, logging), mirroring `cleanup-idempotency`.
4. `scheduled-cleanup.yml`: restore the weekly schedule; it runs payment-proof cleanup and audit anonymization. `workflow_dispatch` gains an `anonymize-audit` task.

## UI

`src/components/entity-detail/DetailAuditSection.tsx` and `src/components/audit/AuditLogViewer.tsx` render `log.user_email || "System"`, which would label anonymized staff edits as System. New label: `user_email`, else `user_id` → "Staff (details removed)", else "System". `user_id` is not resolved back to a current email: that would re-identify the row, and managers cannot read `app_roles`.

`AuditDiffViewer` shows "Details removed after the retention period" when an `UPDATE` row has both `old_data` and `new_data` NULL. Check how it renders nulls today before changing it.

## Error handling

Each table is one `UPDATE`, so a failure leaves no partly anonymized row. An RPC error returns 500, which fails the workflow step; GitHub's failed-run email is the alert. No retries: the job is idempotent and next week's run catches up.

## Testing

- DB test `src/__tests__/database/audit-anonymization.test.ts` (red first), with dates taken from the database clock (`src/test/setup.ts` pins `Date.now()` to 2025): a 25-month-old `guests` row is cleared and a 23-month-old one is untouched; a `units` row keeps `old_data`/`new_data` but loses `user_email`/`ip_address`; a legacy `auth_events` row is cleared; an `audit_logs_archive` row is cleared; a second run returns 0; only `service_role` can execute.
- Unit tests: `cron-auth` (missing header, wrong token, valid token); `anonymize-audit` (logs the count, warns above 50 MB); the audit actor label (email, user_id only, neither).
- Prod (user): `supabase db push`, drift check, one manual `workflow_dispatch` run with `anonymize-audit`; its log shows the count and table size.

## Decisions & Deferrals

- **Two clocks wanted, aligned with RA 10173 (2026-10-17, user).** Why: privacy (forget personal data) and volume are separate goals. Revisit: n/a.
- **Anonymize in place; no export-then-purge (2026-10-17, user).** Why: anonymized rows hold no guest personal data, so moving them out adds a storage system and a two-phase job for no privacy gain; at about 200 bytes a row, volume does not force it. Revisit: when `audit_logs` passes 50 MB (the weekly job logs the size).
- **Volume clock (archiving job) deferred (2026-10-18).** Why: 3.3 MB after a year against a 500 MB free tier; archiving would also hide history from detail pages. Revisit: when `audit_logs` passes 50 MB.
- **Actor columns cleared everywhere; data columns cleared outside a keep-list (2026-10-17, user).** Why: staff are data subjects too; accountability keeps `user_id`/`user_role`; a keep-list fails safe against legacy and future table names. Revisit: when a new table without personal data should keep its diffs.
- **One clock for all rows, including security events (2026-10-18, user).** Why: low event volume today. Revisit: when the public guest booking form is live on prod (non-staff failed logins and rate-limit events start), consider a shorter clock (for example 90 days) for security events.
- **Window: 24 months (2026-10-18, user) [CONFIRM].** Why: covers repeat seasons and disputes. Revisit: when counsel or NPC guidance gives a period; the change is a one-line migration (parameter default).
- **GitHub Actions + endpoint, not pg_cron (2026-10-18, user).** Why: failures surface in Actions and the size log makes the 50 MB trigger measurable; pg_cron failures are silent and outside the drift check. Revisit: n/a.
- **Out of scope: retention of the source tables (2026-10-18).** `guests` and `bookings` keep personal data indefinitely; audit retention alone does not make the system RA 10173-aligned. Revisit: as its own deferred-list item (anonymizing past guests' records).
