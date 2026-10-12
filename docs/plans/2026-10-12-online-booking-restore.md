# Online booking restore

Deferred-list item 4 in `docs/plans/2026-10-03-guardrails-design.md`. Scheduled 2026-10-12 (user), after PR #20 turned out to be a no-op on prod.

## Problem

Prod has no multi-cabin guest booking path. Migrations `20251028154441`, `20251104184719` and `20251108000000` are recorded as applied, but their objects are absent (drift baseline group "Online booking and unit assignment"). The user's prod query on 2026-10-12 failed with `42703 column "unit_assignment_status" does not exist`. On prod:

- `POST /api/guest-booking/multi-unit` fails: `create_guest_booking` is absent.
- `/admin/booking-queue` returns its own 503 ("Multi-unit booking feature not yet configured").
- `/api/admin/bookings/[bookingId]` errors: it selects `unit_assignment_status` and joins `guest_booking_unit_requests`.
- `/api/admin/assign-units` fails: `assign_units_to_booking` is absent.

Copying the local objects to prod would not fix this. Most of them were never finished (checked 2026-10-12 with `pg_get_functiondef` and `supabase db lint --local`):

| Object                                                     | Local state                                                                                                                                                                                                                                                                                                         | App caller                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `create_guest_booking(p_turnstile_token, …)`               | Inserts the booking, but never writes `guest_booking_unit_requests`, `downpayment_required`, `discount_*`, `pricing_snapshot` or `requested_unit_count`. The `p_guest_data` branch writes 5 `guests` columns that don't exist (the caller passes NULL). `SECURITY DEFINER`, no `search_path`, executable by `anon`. | `functions/api/guest-booking/multi-unit.ts:354` |
| `create_guest_booking(p_guest_data, …, p_idempotency_key)` | Broken (`bookings.check_in_date`).                                                                                                                                                                                                                                                                                  | none                                            |
| `assign_units_to_booking`                                  | Reads `bookings.check_in_date` (absent), requires `'Verified'` (banned by `bookings_payment_status_check`), never inserts `booking_units` or availability rows.                                                                                                                                                     | `functions/api/admin/assign-units.ts:294`       |
| `calculate_booking_pricing`                                | Stub that returns 0.                                                                                                                                                                                                                                                                                                | none (pricing is in `multi-unit.ts`)            |
| `check_units_available_for_booking`                        | Checks `booking_units.check_in_date/status`, not the real overlap guard.                                                                                                                                                                                                                                            | none                                            |
| `booking_units.check_in_date/check_out_date/status`        | Always NULL. `20261011120000` made `booking_unit_availability` the only overlap guard.                                                                                                                                                                                                                              | `check_units_available_for_booking` only        |

Verify/reject is broken everywhere: `functions/api/admin/verify-payment.ts:254-259` writes `payment_status` `'Verified'`/`'Rejected'`, which the CHECK constraint rejects (500). Since ADR 0001, app code must not write `payment_status` at all; triggers derive it from `payments`. The E2E tests re-enabled in #20 only assert that the buttons render.

**Orphaned guest proofs on prod (user's read-only queries, 2026-10-12).** `payment-proofs` holds 8 objects. One is a staff upload (`bookings/<id>/…`, 2025-09-29). Seven are guest-form uploads (`TEMP-<session>_<ms>.png|JPG`, from `MultiUnitGuestBookingForm.tsx:529`), made Feb 2 21:15 to Feb 3 00:37 (4 sessions), Feb 5, Feb 9 and May 15 2026, Manila time. No prod booking has a `payment_proof_url`, so none of the 7 sessions created a booking: the form uploads the proof before it submits, and the submit failed. Whether any are real payments needs the user to look at the images; if so, the family follows up with those guests.

## Design

One forward migration, `supabase/migrations/20261013000000_online_booking.sql`. Idempotent (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP … IF EXISTS`), so it applies both to local (which has the objects) and to prod (which doesn't).

1. **Schema prod lacks, kept:** `bookings.unit_assignment_status`, `requested_unit_count`, `downpayment_required`, `discount_percent`; table `guest_booking_unit_requests` (with RLS, its read/insert policies, and the audit trigger, so it leaves the audit allowlist); the assignment indexes; constraint `payment_before_assignment`, rewritten for derived statuses (`unit_assignment_status <> 'assigned' OR payment_status IN ('Partial','Completed')`).
2. **Dropped everywhere instead of restored:** the idempotency `create_guest_booking` overload, `calculate_booking_pricing`, `check_units_available_for_booking`, and `booking_units.check_in_date/check_out_date/status` (with `idx_booking_units_dates_status`). These lines leave the drift baseline because local stops having them.
3. **`create_guest_booking`, rewritten:** same signature, so `multi-unit.ts` keeps working. It stores the unit requests, downpayment, discount, pricing snapshot and requested count. It drops the `p_guest_data` branch (always NULL), uses `SET search_path TO ''` with qualified names, and is executable by `service_role` only (the Worker), like `create_multi_unit_booking` after `20261011120000`.
4. **`assign_units_to_booking`, rewritten:** locks the booking (`FOR UPDATE`) and requires `unit_assignment_status = 'pending'` and `payment_status IN ('Partial','Completed')`. It inserts one `booking_units` row per unit, with per-unit price from `pricing_snapshot`. It inserts a `booking_unit_availability` row per unit using the booking's `check_in`/`check_out`, so the existing tstzrange exclusion rejects a conflict. Then it sets `unit_assignment_status = 'assigned'` and `booking_status = 'Confirmed'`. Executable by `service_role` only.
5. **Verify/reject in `verify-payment.ts`:** see decision D1.
6. **Rollback file**, as in `20261004000000`.

Out of scope: `cleanup_expired_payment_proofs` (deferred item 3, needs a retention rule), seasonal rates (item 5), the `pricing_config_admin_policy` and `booking_units` insert policy lines in the same baseline group (checked in Task 1; split out if unrelated).

## Decisions (D1–D3 accepted as recommended, user, 2026-10-12)

- **D1. What Verify records.** Accepted: insert one `payments` row (`amount = downpayment_required`, `payment_method = bookings.payment_method`, `proof_url = bookings.payment_proof_url`, `status = 'Active'`). The trigger then derives `Partial`, which matches the 50% downpayment the guest is shown in `PaymentSummary.tsx`. Alternative: the full `total_amount` (derives `Completed`).
- **D2. What Reject does.** Accepted: no booking write. `payment_status` stays `Pending` and the proof stays, so staff can still see what was rejected. The reason goes into the audit row (`payment.rejected`). Alternative: clear `payment_proof_url` so the guest's status page asks for a new upload. That needs a guest-side re-upload flow, which doesn't exist yet.
- **D3. Test against a prod schema replica before the push.** Accepted: you run `! supabase db dump --linked --schema public -f <scratchpad>/prod-schema.sql` (agent prod reads are blocked). I load it into a scratch database, apply the migration, and run the DB tests against it. The dump is never committed (public repo).

## Tasks (outline; next step: expand into full TDD steps with superpowers:writing-plans)

- [ ] 1. Investigation: confirm the remaining baseline lines in the group (`pricing_config_admin_policy`, `authenticated_users_insert_booking_units`) and decide whether they belong here.
- [ ] 2. DB tests first (`src/__tests__/database/`): guest booking creates booking + unit requests; `anon` cannot execute either function; assign fails before verify, succeeds after, writes `booking_units` + availability; a conflicting unit fails; a wrong unit count fails.
- [ ] 3. Migration + rollback; `npm run gen:types`; DB tests pass.
- [ ] 4. `verify-payment.ts` per D1/D2, with unit tests; narrow `payment_status` in `database.types.ts`.
- [ ] 4b. Booking-failure path: when `create_guest_booking` fails after the proof upload, the guest sees a clear "nothing was booked" message (check what `multi-unit.ts` and the form show today).
- [ ] 5. E2E: extend the verify-payment tests to click Verify and assert `Partial`, then assign units.
- [ ] 6. Replica check (D3); drift baseline lines removed; `npm run verify`; PR.
- [ ] 7. User: `supabase db push`; prod-drift check; one real test booking on prod (user).

## Resume state (2026-10-12, end of session)

- Branch `fix/restore-guest-booking-schema` (off main `8532694`): 3 docs-only commits, not pushed, no upstream. No migration, test or code written yet.
- Next: expand the task outline into full TDD steps (superpowers:writing-plans), then Task 1 (investigation).
- Prod schema dump (D3) not taken yet; ask the user to run it when Task 6 is reached, into that session's scratchpad.
- Not verified: the exact contents of `pricing_snapshot` per unit (needed for `booking_units.unit_price` in Task 3); whether `20261011120000` already drops anything this migration drops; the guest form's behaviour when booking creation fails (Task 4b).
- User still to review the 7 orphaned `TEMP-…` proofs in the dashboard.

## Decisions & Deferrals

- **D1–D3 accepted as recommended (2026-10-12, user).** Verify inserts a `payments` row for `downpayment_required` (derives `Partial`); Reject writes nothing to the booking, reason in audit; prod schema dump by the user, loaded into a scratch DB, never committed. Revisit: n/a.

- **Orphaned proofs left in storage (2026-10-12).** Why: they may be the only record of a guest's payment; deletion waits for the user's review and the cleanup cron (guardrails deferred item 3). Revisit: after the user checks the 7 images.

- **Online booking scheduled (2026-10-12, user).** Why: PR #20 fixed verify-payment only where the schema exists; prod has no guest-booking path. Revisit: n/a (active).
- **Finish, not restore (2026-10-12).** Why: the local objects are stubs or broken (table above); pushing them would ship broken functions. Unused ones are dropped locally rather than pushed. Revisit: if a caller for the pricing stub appears.
- **Verify records a payment instead of writing `payment_status` (2026-10-12).** Why: ADR 0001 (2026-10-10) supersedes the 2026-10-07 "Partial on verify" wording; the result is the same status, derived by the trigger. Revisit: n/a.
- **Detail-endpoint 503 skipped (2026-10-12, user).** Why: this restore removes the missing-column error. Revisit: if the restore stalls.
