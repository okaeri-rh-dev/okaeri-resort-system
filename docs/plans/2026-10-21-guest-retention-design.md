# Guest retention design (guardrails deferred list #8)

Source: `docs/plans/2026-10-03-guardrails-design.md`, Deferred list item 8. `guests` and `bookings` keep personal data indefinitely. Goal: align source-table retention with the Data Privacy Act of 2012 (RA 10173) proportionality principle by anonymizing past guests in place. Precedent: `docs/plans/2026-10-18-audit-retention-design.md` (#2). No period in this design is presented as legally compliant; the window is the user's call.

## Context (2026-10-21)

- Prod data starts 2025-10 (oldest audit row 2025-10-02), so the weekly job anonymizes nothing until about 2027-10. Until then the manual path and the tests are the only evidence.
- `audit_trigger_func` audits every changed `UPDATE` with full `old_data` and has no skip flag. Anonymizing a guest writes their old contact details into a new audit row.
- `cleanup_expired_payment_proofs` finds files through `bookings.payment_proof_url`. Clearing the URL without deleting the file orphans it in storage.
- Guest delete runs in the browser (`useDeleteGuest`, `src/stores/useGuestStore.ts`), allowed by RLS policy `guests_delete_manager`. A delete sets `bookings.guest_id` to NULL (`ON DELETE SET NULL`) and leaves the name and contact on the bookings and in audit `old_data`.
- `guest_assignments.guest_id` is `ON DELETE RESTRICT`; its `room_preferences` is free text.
- `bookings_conflict_backup`: a one-off snapshot from `database/migrations/014-guest-booking-exclusion-constraint-with-cleanup.sql`, no readers or writers. Prod has 2 rows from 2025-10-04, neither in `bookings`; the user checked them and confirmed they are test data.

## Rules

### Trigger

- **Weekly:** a guest qualifies when `anonymized_at IS NULL`, `max(check_out)` over all their bookings (any status) is older than `now() - p_older_than` (default `24 months`), and no booking has an open balance (`payment_status IN ('Pending', 'Partial')` and `booking_status <> 'Cancelled'`).
- **Orphan bookings** (`guest_id IS NULL`): the same rule on the booking's own `check_out` and balance.
- **Manual (erasure request):** owner/admin, any time. Ignores the clock and the open-balance rule. Refused when any of the guest's bookings has `check_out > current_date`.

### Columns

| Table                              | Cleared                                                                                | Value                                      |
| ---------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------ |
| `guests`                           | `guest_name`                                                                           | `'Removed guest'` (column is NOT NULL)     |
|                                    | `email`, `phone_number`                                                                | NULL (`guests_email_key` allows many NULL) |
| `bookings`                         | `guest_name`                                                                           | `'Removed guest'`                          |
|                                    | `email`, `contact_number`, `special_requests`, `internal_notes`, `payment_proof_url`   | NULL                                       |
| `booking_units`                    | `guest_names`, `unit_notes`                                                            | NULL                                       |
| `payments`                         | `notes`, `proof_url`                                                                   | NULL                                       |
| `guest_assignments`                | `room_preferences`                                                                     | NULL                                       |
| `audit_logs`, `audit_logs_archive` | #2 rules on every row whose `(table_name, record_id)` belongs to the guest, at any age | see #2 design                              |

Every other column is kept: money, dates, status, units, counts, `total_spent`, `total_bookings`, `booking_reference`, `pricing_metadata`, `pricing_snapshot`. Kept for the family's internal revenue summaries only (no tax/BIR scope).

The guest's records are: the guest row, their bookings, those bookings' `booking_units`, `payments`, `guest_booking_unit_requests`, and the guest's `guest_assignments`.

**Fail-safe:** the clear-list and an explicit keep-list together must cover every column of `guests`, `bookings`, `booking_units`, `payments` and `guest_assignments`. A DB test reads `information_schema.columns` and fails on an unclassified column, so a new column (for example `guests.nationality` from the online-booking restore) cannot merge unclassified.

**Marker:** new column `anonymized_at timestamptz` on `guests` and `bookings`. Marked rows are skipped, which makes every path idempotent; the UI reads it.

## Components

```text
Migration (one file, with rollback in supabase/rollbacks/)
  ├─ ALTER guests, bookings ADD anonymized_at timestamptz
  ├─ DROP TABLE bookings_conflict_backup        (rollback recreates it empty)
  ├─ DROP POLICY guests_delete_manager ON guests
  ├─ anonymize_guest(p_guest_id uuid)            → TABLE(proof_path text)
  ├─ anonymize_booking(p_booking_id uuid)        → TABLE(proof_path text)   orphan bookings
  ├─ delete_guest(p_guest_id uuid)               → TABLE(proof_path text)   anonymize_guest, delete the guest's
  │                                                guest_assignments (FK is RESTRICT), then DELETE the guest
  └─ anonymize_expired_guests(p_older_than interval DEFAULT '24 months')
        → TABLE(guests_count bigint, bookings_count bigint, failed_count bigint, proof_paths text[])
        loops eligible guests → anonymize_guest; eligible orphans → anonymize_booking

All four: SECURITY DEFINER, SET search_path = '', EXECUTE revoked from public, anon,
authenticated and granted to service_role.

Weekly: .github/workflows/scheduled-cleanup.yml (Sun 03:00 UTC); workflow_dispatch gains anonymize-guests
  └─ POST /api/cron/anonymize-guests             functions/api/cron/anonymize-guests.ts
       verifyCronAuth                            functions/lib/cron-auth.ts (exists)
       anonymizeExpiredGuests(env)               functions/scheduled/anonymize-guests.ts
         rpc → delete proof files → { guests_count, bookings_count, failed_count, deleted_files, failed_files }

Manual:  POST   /api/admin/guests/:id/anonymize  requireRole(OWNER_OR_ABOVE)
Delete:  DELETE /api/admin/guests/:id            requireRole(MANAGER_OR_ABOVE), keeps the existing
                                                 "no Confirmed/CheckedIn bookings" check
         both: rpc → delete proof files → { deleted_files, failed_files }
```

1. **Audit scrub:** `anonymize_guest` applies the #2 `SET` list to the guest's audit rows after its own `UPDATE`s, in the same transaction, so the row the trigger just wrote is scrubbed too. Extract the `SET` list from `anonymize_audit_logs` into an internal helper both functions call; if that is awkward in PL/pgSQL, duplicate it and add a test that both produce the same row.
2. **Proof files:** the storage-delete step in `functions/scheduled/cleanup-payment-proofs.ts` moves to a shared helper used by the cleanup job and the three new paths. `/api/cron/cleanup-payment-proofs` then returns `deleted_count` (open follow-up from the 2026-10-18 Resume state).
3. **Future-booking check** lives in `anonymize_guest` (raises a custom SQLSTATE), not only in the endpoint.
4. `useDeleteGuest` calls `DELETE /api/admin/guests/:id` instead of the browser client.

## UI

- **Guest detail** (`src/components/guests/GuestDetail/index.tsx`): "Anonymize guest" action for owner/admin, `AlertDialog` as in `GuestsTable.tsx`. The dialog states the action cannot be undone; the confirm button stays disabled until the guest's name is typed. Open balances show as a warning with the amount. A future booking disables the action with the reason; the 409 is the backstop. On success: refetch and a toast with the deleted file count.
- **Anonymized guest:** title "Removed guest", badge "Anonymized on <date>", contact fields show "Removed", Edit and Anonymize hidden. Stats and booking history unchanged.
- **Bookings:** lists show "Removed guest" with no change. Booking detail shows the same badge when `bookings.anonymized_at` is set and hides Edit.
- **Audit views:** the #2 labels already read `metadata.anonymized_at`. Change "Details removed after the retention period" to "Details removed", since a manual erasure is not a retention expiry.

## Error handling

- Each guest in the batch runs in a `BEGIN … EXCEPTION` block (a savepoint). A failing guest rolls back alone, raises a `WARNING` with its id and adds to `failed_count`; the batch continues. `failed_count > 0` makes the cron endpoint return 500, which fails the workflow step; GitHub's failed-run email is the alert.
- Manual and delete: custom SQLSTATE for a future booking → 409; unknown guest → 404; already anonymized → 200, no change.
- Storage deletion runs after the commit. A failed file delete is logged with its path and listed in `failed_files`; the response still reports the rows as done. No retries: the URL is gone, so the log is the only pointer (same trade-off as `cleanup_expired_payment_proofs`).
- A missed weekly run is caught up the next week.

## Testing

DB tests, red first, dates from the database clock (`src/test/setup.ts` pins `Date.now()` to 2025):

- `src/__tests__/database/guest-anonymization.test.ts`
  - Guest with last check-out 25 months ago: cleared columns are `'Removed guest'`/NULL, kept columns unchanged, `anonymized_at` set, proof paths returned.
  - Guest at 23 months, or with a newer booking: unchanged.
  - Open balance (`Partial`, not Cancelled): skipped. `Cancelled` + `Pending`: anonymized.
  - Orphan booking at 25 months: anonymized.
  - Audit scrub: no `audit_logs` or `audit_logs_archive` row for the guest's records holds the old email or phone, including the trigger's new row and a 1-month-old row. Other guests' audit rows unchanged.
  - Manual: a future booking raises the custom SQLSTATE; a second call is a no-op.
  - `delete_guest`: guest row and their `guest_assignments` gone, bookings anonymized with `guest_id` NULL.
  - Only `service_role` can execute the four functions; `authenticated` cannot delete from `guests`.
  - One guest forced to fail: the others complete, `failed_count = 1`.
- `src/__tests__/database/retention-column-coverage.test.ts`: every column of the five tables is on the clear-list or the keep-list.
- `audit-trigger-coverage.test.ts`: remove the `bookings_conflict_backup` entry.

Unit tests: proof-delete helper (all succeed; one fails → `failed_files`); `cleanup-payment-proofs` returns `deleted_count`; `anonymize-guests` cron (auth, logs counts, `failed_count > 0` → 500); admin endpoints (staff/manager 403 on anonymize, owner 200, 409 and 404 mapping, manager can delete); UI (action owner/admin only, typed-name confirm, anonymized state hides Edit and shows the badge).

Prod (user): `supabase db push`, drift check, one manual `workflow_dispatch` run of `anonymize-guests` (expect 0 guests until 2027-10). Optional: anonymize one test guest by hand and confirm its audit rows are scrubbed.

## Not covered

- Supabase daily backups keep the data until they rotate out.
- Personal data in emails sent through Resend and in Cloudflare logs.
- Personal data typed into fields outside the five tables (for example a guest name in `expenses.description`).

## Decisions & Deferrals

- **Trigger: time since last stay, plus a manual erasure action (2026-10-20, user).** Why: covers both retention and data-subject requests with one rule set. Revisit: n/a.
- **Clear contact columns and free text; keep money, dates, status, units, counts (2026-10-20, user).** Why: free text can hold names and phones; money serves internal summaries. Revisit: when a new column is added (the coverage test forces it).
- **Window: 24 months after the last check-out (2026-10-20, user).** Why: same clock as audit rows; one number to explain. Not presented as legally compliant. Revisit: when counsel or NPC guidance gives a period (parameter default, one-line migration).
- **Audit rows: trigger unchanged, the guest's audit rows scrubbed in the same transaction (2026-10-20, user).** Why: no change to the hot trigger; a trace of the anonymization stays. Revisit: n/a.
- **Only an open balance blocks the weekly job (2026-10-20, user).** Why: stale non-final statuses would otherwise keep data forever. Revisit: if staff report anonymized guests with work still pending.
- **Manual action: owner/admin, guest page, typed-name confirm, refused on future bookings (2026-10-20, user).** Why: irreversible action, narrow access. Revisit: n/a.
- **Approach A: one per-guest SQL function called by both paths (2026-10-20, user).** Why: rules in one place; volume is 1–2 guests a week. Rejected: set-based batch (rules duplicated), Worker orchestration (no single transaction). Revisit: n/a.
- **Drop `bookings_conflict_backup` (2026-10-21, user).** Why: 2 test rows, no readers or writers. Revisit: n/a.
- **Delete guest anonymizes first, moves server-side, keeps manager+ (2026-10-21, user).** Why: a hard delete left more personal data than an anonymize; dropping the RLS delete policy stops a bypass. Managers can therefore erase a guest through Delete but not through Anonymize; this is today's delete power plus a scrub. Revisit: if delete should become owner/admin only.
- **Proof files deleted by the caller after commit, failures logged only (2026-10-21).** Why: Postgres owns rows, the Worker owns storage; same trade-off as the existing cleanup. Revisit: if `failed_files` is ever non-empty.
