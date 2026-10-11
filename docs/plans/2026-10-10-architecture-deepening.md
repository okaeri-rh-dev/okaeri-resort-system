# Architecture deepening (2026-10-10)

Source: architecture review run 2026-10-10 (`/improve-codebase-architecture`), scoped by git hot spots. Eight candidates; vocabulary from the codebase-design skill (module, interface, seam, depth, locality, leverage).

## Candidates

1. **Entity persistence, one write path per entity** (Strong): edit page and dialog both save through one module that owns input shape → row columns, Manila dates and side effects. Start with Payment.
2. **Admin request pipeline** (Strong): authenticate once, resolve role once (today 3× each on verify-payment), role declared per route, one error envelope.
3. **One pricing module** (Strong): pure core over a resolved rate card + seasons; replaces 4 TS engines whose fallbacks disagree.
4. **Invalidate by domain fact** (Strong): one table → cached-data map; mutations report what changed.
5. **Payment verification module** (Worth exploring): owns Pending → Verified transitions; design inside deferred item 4 of the guardrails plan.
6. **Stores shrink to UI state** (Worth exploring): follows 1.
7. **One unit-occupancy definition** (Speculative): wait for guardrails deferred item 4.
8. **Server-only modules out of `src/lib`** (Worth exploring): follows 2.

## Tasks

### Phase 0: bugs found in passing (one `fix:` commit each)

Deploy status 2026-10-10: pushed to `origin/main` (up to `2e3feb0`), but GitHub Actions did not start any job ("recent account payments have failed or your spending limit needs to be increased"), so the deploy (gated on CI) has not run. Last CI-deployed commit: `4e2abb1`; `ffc8927` deployed manually (see 1d). Re-run the workflows once billing is fixed. Cause found 2026-10-10: `okaeri-rh-dev` used 2,000/2,000 included Actions minutes with a $0 Actions budget (stop usage on); resets in 22 days (Nov 1).

- [x] (`8d7a838`) Offline multi-unit booking creates are queued then dropped on reconnect: delete offline queuing, fail loudly when offline
- [x] (`05baf35`) `BookingEdit` sends `payment_amount` (not a bookings column) and `toISOString()` dates. Fixed via `toBookingUpdate` (row-type checked, dates via `formDateToUTC` at check-in/out times like `BookingForm`); the payment amount field is removed (payments have their own page)
- [ ] New: `MultiUnitBookingForm.tsx:282,296` also sends `toISOString()` of the picked local midnight. Verified 2026-10-10: `create_multi_unit_booking` casts straight to `TIMESTAMPTZ`, so multi-unit rows are stored at 16:00Z the day before and `check_in::date` (UTC) reads a day early. Not a one-line fix: the form also checks availability with midnight times (line 148) while `BookingForm` stores 15:00/11:00, so the DB already holds two conventions; existing prod rows stay shifted. Moved to Phase 1 (see Decisions)
- [x] (`743c102`) Payment and expense mutations do not invalidate account balances (`invalidateAccounts`, new `afterExpenseChange`, `useEntityEdit` for payment/expense)
- [ ] RLS lets staff write `bookings.payment_status`; restrict to manager+ with a DB test (prod `db push` by the user). Blocked 2026-10-10: staff legitimately write it when recording a payment (`usePaymentStore.ts:297` recomputes Pending/Partial/Completed in the browser; `payments_insert_staff`) and on proof upload (`useBookingStore.ts:622`). A plain restriction breaks staff payment recording. Moved to Candidate 5 (see Decisions)
- [x] (`2467e32`) `bookings/multi-unit` accepts the client total when the server total ≤ 0: return 422 `PRICING_UNAVAILABLE`
- [x] (`528e2b1`) `invalidateDashboard()` targets `["dashboard-stats"]`, which nothing reads (dashboard reads `useBookings`, already invalidated); helper deleted

### Phase 1: Candidate 1 (Payment first)

- [x] Grill the design (constraints, seam, what tests survive). Rounds 1-3 settled 2026-10-10 (see Decisions); `GLOSSARY.md` started
- [x] 1a. (`53cac1d`) `fix:` `useUpdatePayment` nulls `proof_url` when the edit sends none
- [x] 1b. (`073cf4a`) Migration `20261010120000_derive_booking_payment_status.sql`: booking payment status trigger on `payments` + `bookings.total_amount`, backfill; DB tests (local)
- [x] 1c. (user `supabase db push` 2026-10-10; backfill audit query returned 0 rows, so no booking status changed; verified via read-only `supabase db dump --linked`: both triggers and 4 functions present, EXECUTE on derive/refresh granted to `service_role` only) Read-only prod diff of statuses the backfill would change → user reviews → user runs `db push` → confirm trigger in prod `pg_trigger`. Diff query (run in the Supabase SQL editor; reads only):

  ```sql
  SELECT b.booking_reference, b.payment_status AS current_status, d.derived_status,
         b.total_amount, paid.active_total, paid.refunded_count
  FROM public.bookings b
  CROSS JOIN LATERAL (
    SELECT COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'Active'), 0) AS active_total,
           COUNT(*) FILTER (WHERE p.status = 'Refunded') AS refunded_count
    FROM public.payments p WHERE p.booking_id = b.booking_id
  ) paid
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN paid.active_total = 0 AND paid.refunded_count > 0 THEN 'Refunded'
      WHEN paid.active_total = 0 THEN 'Pending'
      WHEN paid.active_total < b.total_amount THEN 'Partial'
      ELSE 'Completed'
    END AS derived_status
  ) d
  WHERE b.payment_status IS DISTINCT FROM d.derived_status
  ORDER BY b.check_in;
  ```

  Backfill changes after the fact (the audit trigger logged each one; the migration ran without a user JWT):

  ```sql
  SELECT created_at, new_data->>'booking_reference' AS booking,
         old_data->>'payment_status' AS before, new_data->>'payment_status' AS after
  FROM public.audit_logs
  WHERE table_name = 'bookings' AND 'payment_status' = ANY (changed_fields)
    AND user_id IS NULL AND created_at > '2026-10-10'
  ORDER BY created_at;
  ```

  After review: `supabase db push`, then confirm with `SELECT tgname FROM pg_trigger WHERE tgname IN ('refresh_booking_payment_status', 'refresh_payment_status_on_total_change');` (2 rows).

- [x] 1d. Done locally 2026-10-10, NOT pushed (gated on 1c): `fe3cf60` Payment module (`createPayment`, `updatePayment`, `softDeletePayment`, `appendVerificationNote`, plus `recordProofPayment` for the booking-table proof, which owns the outstanding balance) + 7 DB tests; `0392c20` hooks are adapters, client status recompute / optimistic map / `selectedPayment` / hard delete gone; `ec9428e` edit page via the module, `paymentEditSchema` uses column names, `useEntityEdit` payment branch and its mock test deleted; `2fa87b6` booking-table proof records the outstanding balance (file picker now PNG/JPEG, matching the upload validator). Browser check (local, manager): recorded ₱2,500 cash with no proof → row `payment_date` 04:00Z (Manila noon), booking Partial; edit page → ₱6,000, existing proof kept, booking Completed; row menu shows Remove and no Delete; Remove → payment Deleted, booking Pending. Not browser-checked: Verify, booking-table proof upload (DB-tested only)
- [x] Push 1d after 1c confirms both triggers on prod. Deployed 2026-10-10 by manual `wrangler pages deploy` (deployment `f55fa466`, Production, `main`, `ffc8927`); live `index.html` serves the verified build's entry `index-b2Ix7eyX.js`; `/api/health` 200. Urgent once billing is fixed: until 1d deploys, the deployed client (`4e2abb1`) rewrites `payment_status` after each payment insert with its old recompute, overriding the trigger
- [x] (`caf64c8`) New: payment list search filters on `reference_number` and sort-by-status orders by `payment_status`; neither is a `payments` column, so both requests fail (`usePaymentStore.ts` `paymentListQuery`). Search now matches booking reference, guest name and notes on the fetched rows; sort uses `payments.status`
- [x] Grill the booking entity (rounds 1-4 settled 2026-10-11; summary confirmed by the user 2026-10-11)
- [ ] Booking module: implementation plan `docs/plans/2026-10-11-booking-module.md` (10 tasks; checkboxes tracked there)
  - [x] 1. (`5998f5d`) Stay convention core (`toStayInstants`, 14:00/12:00, settings rule test under `TZ=America/Los_Angeles`)
  - [x] 2. (`5ebc878`, `5a46fc1`) Migration `20261011120000_normalize_booking_stays.sql` + DB tests
  - [x] 3. (`b2023ee`) `createBooking` (server side) + DB tests
  - [x] 4. (`c88e459`) Worker routes take Manila days
  - [x] 5. (`afeb4ab`) Dialog and multi-unit page create through the route
  - [x] 6. (`3d516a0`, `3035267`) Automatic availability in the dialog
  - [x] 7. (`fa8d4e7`, `542f923`) `updateBooking` + edit page
  - [x] 8. (`e7ed7f9`, `8a63830`) Cancel/status via the module; hard delete leaves the UI
  - [x] 9. (`d7b018d`) Readers (night count, list filter, confirmation card)
  - [ ] 10. Browser check, read-only prod preview, user `db push`, push, manual deploy, post-deploy normalize
- [ ] Then 4 → 6 on the client; 3 → 2 → 8 on the server

## Resume state (2026-10-11, evening)

- Booking module Tasks 1-9 done on local `main` (unpushed); ticks and commits on the task lines above, ledger in `.superpowers/sdd/progress.md` (git-ignored). Final whole-branch review done; its pre-deploy fixes and decisions are in "Booking module execution (2026-10-11)" below.
- Next: Task 10 of `docs/plans/2026-10-11-booking-module.md` (Step 1 full verify + `test:db`, Step 2 browser check, Step 3 read-only prod preview incl. overlap query, then user `db push`, push, user manual deploy, next-day normalize).
- A concurrent session committed into this working tree on 2026-10-11 and its commit crossed with Task 1; reworded to `5998f5d`/`419d12f`. Its orphaned phone-search fix was committed as `7798f7f` (user choice). Commit with `git commit -- <paths>` while other sessions share the tree.

## Decisions & Deferrals

Accepted 2026-10-10 (recommended defaults):

- **Fix the six passing bugs first, as standalone `fix:` commits.** Why: live data loss and authorization gaps outrank refactors. Revisit: n/a.
- **Delete offline queuing instead of finishing it.** Why: a small family resort does not need offline booking creation; a half-built queue silently loses bookings. Revisit: if staff report needing to book without signal.
- **~~RLS: only manager+ may change `bookings.payment_status`.~~ Superseded 2026-10-10: defer to Candidate 5.** Why: staff legitimately write `payment_status` when recording payments and uploading proof (browser recompute), so a plain restriction breaks them; the bypass only matters for the online verify flow, which is not live on prod. Candidate 5 should move the status derivation into the database (e.g. a trigger on payments) and then restrict direct writes. Revisit: when guardrails deferred item 4 (online-booking restore) starts.
- **Multi-unit date shift folds into Candidate 1, not a standalone fix.** Why: the DB holds two date conventions (local midnight vs 15:00/11:00 Manila) and availability checks use midnight; changing one form line mixes them further. Revisit: at the start of Candidate 1.
- **`bookings/multi-unit` returns 422 when the server total ≤ 0.** Why: the server must not trust a client-supplied price. Revisit: n/a.
- **Edit page and dialog saves converge on one path per entity, keeping store side effects (guest upsert, payment-status recompute).** Why: two save paths with separate mappings caused 4 column-name bugs. Revisit: n/a.
- **Order: client 1 → 4 → 6; server 3 → 2 → 8; candidates 5 and 7 inside guardrails deferred item 4.** Why: 1 is the hottest code with live bugs; 5 and 7 touch SQL that item 4 rewrites. Revisit: if item 4 is scheduled first.

Candidate 1 grilling, round 1 (2026-10-10):

- **Booking `payment_status` is derived by a Postgres trigger on `payments`, counting only `status = 'Active'`.** Why: the only seam every writer passes through (client, Workers, proof upload); fixes the stale status after update/delete and soft-deleted payments counting as paid; prerequisite for Candidate 5's RLS restriction. Needs a prod `db push` by the user. Revisit: n/a.
- **The Payment module is a plain async module taking the Supabase client; React Query hooks are thin adapters over it.** Why: tests call it against local Supabase without React. Revisit: n/a.
- **Payment edit input uses row column names (`amount`, `proof_url`); `paymentEditSchema` renamed to match; writes `satisfies TablesUpdate<"payments">`.** Why: one vocabulary removes the mapping where 4 column bugs lived. Revisit: n/a.
- **Operations: create, update, soft-delete. Hard delete leaves the staff UI; "verify" appends a line to `notes` instead of overwriting it, until Candidate 5 defines real verification.** Why: soft delete keeps audit and balance history; current verify destroys notes. Revisit: Candidate 5.
- **`useEntityEdit` loses one entity branch at a time (payment now, booking next with the date convention); deleted with its last branch.** Why: reviewable steps. Revisit: n/a.
- **`usePaymentStore` keeps only persisted filter/sort state; optimistic map and `selectedPayment` deleted.** Why: unread, fail the deletion test. Revisit: n/a.

Candidate 1 grilling, round 2 (2026-10-10):

- **Trigger rule:** over the booking's payments, no Active but ≥1 Refunded → `Refunded`; Active sum 0 → `Pending`; < `total_amount` → `Partial`; ≥ → `Completed`. `Deleted` never counts. Fires AFTER INSERT/UPDATE/DELETE on `payments` (old and new booking on a `booking_id` change). Why: every status derived, none hand-set. Revisit: Candidate 5 (online verification statuses).
- **Also recompute on `bookings` AFTER UPDATE OF `total_amount`.** Why: price edits otherwise leave stale status; no loop since the payments trigger writes only `payment_status`. Revisit: n/a.
- **Backfill all bookings in the migration, gated on a read-only prod diff the user reviews before `db push`.** Why: corrects rows already wrong from the update/delete paths. Revisit: n/a.
- **Tests:** DB tests for the trigger rule and the Payment module (create/update/soft-delete, row read back) against local Supabase; delete the `useEntityEdit` payment-branch mock tests; hooks untested (wiring). Revisit: n/a.
- **Hooks adapter owns cache invalidation (`afterBookingPaymentChange`); the module never sees the cache.** Revisit: Candidate 4.
- **The Payment module owns proof upload (optional `File` on create/update).** Why: serves `PaymentForm` and the booking-table proof upload; storage is local-substitutable. Revisit: n/a.
- **Booking-table proof upload records the outstanding balance, not `total_amount`, and stops writing `Completed`.** Why: double-counted downpayments. Revisit: n/a.
- **Fix the proof-erasing edit bug now as a standalone `fix:` (`useUpdatePayment` nulls `proof_url` when the form sends none).** Why: live data loss. Revisit: n/a.

Candidate 1 grilling, round 3 (2026-10-10):

- **Order 1a → 1b → 1c → 1d; 1d (which deletes the browser status recompute) must not deploy until the trigger is confirmed on prod.** Why: deploys run no migrations; without the gate prod would have neither the trigger nor the recompute. Revisit: n/a.
- **Module at `src/lib/payments/`, functions take `(client, …)`; `GLOSSARY.md` started with Payment, Booking payment status, Outstanding balance, Soft-deleted payment.** Revisit: n/a.
- **`payment_date` stored as the picked Manila day at 12:00 (`formDateToUTC(date, "12:00")`); no correction for existing rows.** Why: midday is far from day boundaries, so as-of balances count the right day; old one-day shifts only touch historical as-of reports. Revisit: if as-of reports matter for past months.
- **Proof stays optional on every payment (cash has none); the module only writes `proof_url` when a file is uploaded or the caller sets it.** Why: user check 2026-10-10. Revisit: n/a.
- **ADR 0001 records that booking payment status is derived in the database.** Revisit: n/a.
- **Booking-table proof upload accepts PNG/JPEG only, like `PaymentForm`.** Why: the shared payment-proof validator is image-only. Revisit: if guests send PDF receipts.
- **No Actions budget; wait for the Nov 1 reset and cut usage instead.** Why: user preference (2026-10-10). Revisit: if usage still exceeds 2,000 min/month after the trim.
- **Manual deploy of `ffc8927` run by the user, from a clean worktree with only `.env.production`.** Why: prod had the trigger but the old client overwrote `payment_status`; CI could not run. The bash guard blocks agent deploys, so the user runs `wrangler pages deploy`. Rollback: production deployment `0765f99b` (`4e2abb1`). Revisit: n/a.
- **CI trim: Security Scan on PRs + weekly only; infra-health `health` job (duplicate lint/unit) skipped on push; deploy and infra-health skip docs-only pushes.** Why: Security Scan (90 runs) and duplicates of the quality gate used most of October's minutes. Revisit: Nov 1 usage.

Booking entity grilling, round 1-2 (2026-10-11). Facts: read-only `supabase db dump --linked` + `migration list --linked`; prod split by Manila time of day: 106 rows 15:00/11:00, 72 rows 00:00/00:00, 1 row 00:00/11:00, 1 row 15:48/00:00 (180 total, none at other hours, so every row's Manila date is the picked day):

- **No re-run of the 1c diff query on prod.** Why: the backfill audit already showed 0 changed rows. Revisit: n/a.
- **Stays are stored as instants in the existing TIMESTAMPTZ columns: the picked Manila check-in day at the check-in time, the check-out day at the check-out time.** Why: `'[)'` exclusion keeps same-day turnover free, and UTC `::date` readers and Worker pricing read the right day; `DATE` columns would rewrite the exclusion, 3 SQL functions and every reader. Revisit: if a reader needs real arrival times.
- **The app's dates are always Manila days; the booking module's interface takes `YYYY-MM-DD` Manila day strings and one shared function in `src/lib/bookings/` turns them into instants (forms, API, availability checks).** Why: `formDateToUTC` reads browser-local fields, which is how guest-local midnights got stored. Revisit: n/a.
- **Slice 1 of the booking module: the admin "New booking" dialog creates through `create_multi_unit_booking`, and the real `check_multi_unit_availability` replaces its fake check.** Why: `useCreateBooking` inserts into `bookings` and `booking_units` but writes no `booking_unit_availability` row, so dialog bookings block nothing; the "check" is a `setTimeout` + success toast. Revisit: n/a.
- **Prod drift #2: migration `20251028154441` is recorded applied, but prod lacks `booking_units.check_in_date/check_out_date/status`, `booking_units_no_double_booking`, `assign_units_to_booking` and `check_units_available_for_booking`.** The assign-units page and `/api/admin/available-units` cannot work on prod. Out of scope here; nothing is designed against `booking_units` date columns. Revisit: guardrails deferred item 4.
- **Guest-path date bugs deferred to guardrails item 4:** the guest form stores the guest's local midnight; the guest schema's "today or later" check uses UTC midnight in the Worker (rejects a same-day Manila booking after 08:00); `guest-booking/multi-unit.ts` prices from the full ISO timestamp, so the stored total can differ from the preview. Why: online booking is not live; the shared day→instant function fixes all three. Revisit: item 4.

Booking entity grilling, round 3 (2026-10-11). Facts (read-only `supabase db query --linked`): 96 of 156 Confirmed bookings (plus 9 Cancelled, 2 Pending) have no `booking_unit_availability` row, exactly the dialog-created ones; 2 Confirmed double bookings exist (Cabin 3, 28-29 Jan: BKG-2026-02-394 + BKG-2026-06-481, same guest name; Cabin 1, 2-4 Apr: BKG-2026-03-548 + BKG-2026-03-866, different guests):

- **Check-in 14:00 / check-out 12:00 Manila, a code setting (`RESORT_OPERATION_HOURS`), changed by deploy; a test enforces check-out time < check-in time and both ≥ 08:00 Manila.** Why: the resort's real times; out < in keeps turnover free under `'[)'`; ≥ 08:00 keeps UTC date = Manila date. Old rows need no rewrite if the times change later. Revisit: if the times change often.
- **One migration rewrites all 180 prod rows to Manila day + 14:00 / 12:00 (check-ins first, then check-outs), gated on a read-only diff the user reviews before `db push`.** Why: one convention in the DB; no day changes. Revisit: n/a.
- **The same migration backfills availability rows for the 107 dialog bookings (one per Booking and Unit, with the Booking's status).** Why: old dialog bookings must block their Units. Revisit: n/a.
- **The user resolves the 2 double bookings by hand in the app before `db push`; the migration checks first and raises if any Confirmed overlap remains.** Why: the exclusion constraint rejects the backfill, and which booking is real is the user's call. Revisit: n/a. Chosen 2026-10-11: cancel BKG-2026-06-481 (re-entered duplicate) and BKG-2026-03-548 ("Kuya" hold; BKG-2026-03-866 holds the real guest). Done on the live admin 2026-10-11 19:46-19:47 Manila; verified by read-only query: both Cancelled, the kept pair still Confirmed, 0 Confirmed overlaps left on prod.

Booking entity grilling, round 4 (2026-10-11). Facts: prod `pricing_config` is flat ₱10,000/night (weekend same, ₱0 extra person, base occupancy 6); prod drift #3: `seasonal_rates` absent although `20251106000000` is recorded applied, so the seasonal multiplier falls back to 1 and both Worker engines give ₱10,000 × nights:

- **The dialog checks availability automatically: one `check_multi_unit_availability` query for all Units once both days are picked (via `useMultiUnitAvailability`); unavailable Units are disabled in the picker with "booked until <day>"; the button and fake toast are deleted. The server re-checks on save.** Why: user request; the hook already exists. Revisit: n/a.
- **The dialog creates through `POST /api/bookings/multi-unit` (server price, server availability check, `create_multi_unit_booking`).** The on-screen price stays on `/api/pricing/calculate` until Candidate 3; the stored total is the server's. Revisit: Candidate 3.
- **Module `src/lib/bookings/`: `toStayInstants`, `createBooking(client, input)` (Worker route, wraps the RPC), `updateBooking` (Manila days, keeps the guest upsert), `cancelBooking`, `setBookingStatus` (keeps `canTransitionStatus`). Hooks are thin adapters; `useEntityEdit` is deleted with its booking branch; the cancel adapter gets an error toast + refetch.** Revisit: n/a.
- **Hard delete leaves the staff UI; Cancel is the only removal.** Why: hard delete erases availability rows and orphans history; matches Payments. Revisit: n/a.
- **Fix only the readers the new times break: store night count (floor → Manila days), bookings list "to" filter (Manila days), confirmation card time (settings times or day only).** Browser-local day formatting (dashboard, tables, tooltip, check-status) is logged, not fixed. Why: it only misreads outside the Philippines. Revisit: if staff or guests use the app from abroad.
- **Deploy: user cancels the duplicates → `db push` → manual client deploy right after; then re-run the read-only split query and normalize any rows written in between (the normalization is idempotent).** Revisit: n/a.
- **`seasonal_rates` drift (#3) is logged under Candidate 3, out of scope here.** Revisit: Candidate 3.
- **Tests: DB tests (create writes an availability row; 12:00 → 14:00 turnover accepted; overlap rejected; date update moves the availability row; migration normalization + backfill); unit tests for `toStayInstants` and the settings rule run under `TZ=America/Los_Angeles`.** Why: a browser-local mistake is invisible in a Manila time zone. Revisit: n/a.
- **`GLOSSARY.md` gains Check-in day, Check-out day and Night; ADR 0002 records the stay storage convention.** Revisit: n/a.
- **Follow-up candidate for the guardrails list: a read-only schema-drift check (`supabase db dump --linked` vs local).** Why: three migrations are recorded applied with objects missing. Revisit: next guardrails pass.

Booking module planning (2026-10-11). Facts (read-only prod): `create_multi_unit_booking` ignores `payment_method`; `check_multi_unit_availability.next_available_date` is the earliest check-out of stays starting after the requested check-in (not "booked until") and units not `Available` are absent from its result, which the create route treats as available; the availability exclusion covers only Confirmed/CheckedIn, and `cascade_booking_status` copies status changes to availability rows; 0 same-day stays; 107 `booking_units` without availability rows. Local only: `booking_units_no_double_booking` (status defaults `'confirmed'`, dates NULL) blocks any second booking of a unit, which is why the Pending-overlap test was skipped. Recommended defaults, confirmed by the user 2026-10-11:

- **`createBooking` runs server side (Worker, service-role client); the browser calls the route through `requestBooking`.** Why: DB tests call the module directly; pricing stays on the server. Revisit: Candidate 3.
- **The migration drops `booking_units_no_double_booking` IF EXISTS (no-op on prod) and the Pending-overlap test is re-enabled.** Why: DB tests of turnover need a second booking per unit; prod has no such constraint. Revisit: guardrails item 4 (drift #2).
- **The migration stores `payment_method` in `create_multi_unit_booking` and redefines `next_available_date` as the latest check-out of the conflicting stays.** Why: the dialog's payment method would be lost; "booked until" needs the conflict's end. Nothing else reads `next_available_date`. Revisit: n/a.
- **Normalization is a function, `normalize_booking_stays()` (service_role only), called by the migration.** Why: DB-testable and re-runnable after the deploy. Revisit: n/a.
- **The routes take `YYYY-MM-DD` days; a unit missing from the availability result is unavailable (409).** Revisit: n/a.
- **Correction: `useEntityEdit` keeps its unit/guest/expense branches; only the booking branch goes.** Why: round-4 said "deleted with its booking branch", but three other edit pages use it. Revisit: when those entities get modules.
- **`BookingForm` loses its unused edit mode.** Why: no caller passes `bookingId`; the edit page is the edit path. Revisit: n/a.
- **Row Cancel gets a confirmation dialog (the Delete dialog reused).** Why: cancel frees the unit and cannot be undone. Revisit: n/a.
- **Dialog bookings stay `Pending` (as today) and do not block units until confirmed.** Why: matches the exclusion and existing workflow. Revisit: if staff expect a new booking to hold the unit.
- **Execute the booking module plan subagent-driven (one fresh subagent per task, review between tasks).** Why: user choice 2026-10-11. Revisit: n/a.

Booking module execution (2026-10-11). Tasks 1-9 done subagent-driven (per-task commits are on the task lines above); final whole-branch review: deploy with fixes, no Critical. Facts (read-only prod ACL query 2026-10-11): `create_multi_unit_booking` is SECURITY DEFINER with EXECUTE for PUBLIC, `anon`, `authenticated`. Confirmed by the user 2026-10-11:

- **Revoke EXECUTE on `create_multi_unit_booking` from PUBLIC/`anon`/`authenticated` in `20261011120000` (service_role only).** Why: anyone with the public anon key could create bookings with any price and status, bypassing server pricing; the Worker is the only caller now. Revisit: guardrails item 4, if the guest path needs it.
- **Post-deploy normalize runs the day after the deploy, once every family device has accepted the update.** Why: the PWA update is a prompt, so open tabs keep writing 15:00/11:00 without availability rows until reloaded; the function is idempotent. Revisit: n/a.
- **The availability route's 60 s cache (Worker KV + `Cache-Control: public`) stays; logged here.** Why: the server re-check on save is uncached, so a stale "free" only costs a 409. Revisit: Candidate 6 (stores shrink) or the next guardrails pass.
- **CheckedIn and CheckedOut bookings can no longer be cancelled.** Why: cancel now goes through `canTransitionStatus` (the old direct update skipped it); the UI offers Cancel only for Pending/Confirmed. No UI sets CheckedIn today. Revisit: if staff need to undo a check-in.
- **Before deploy, fix: refresh availability after a status change; map exclusion errors (23P01) to "This unit is already booked for some of these days".** Why: final review Important #1/#2; staff would otherwise see the unit as free after Confirm and raw Postgres text on a double booking. Revisit: n/a.
- **Logged, not fixed (final-review triage, all "can wait"):** dialog same-day stay passes the client and gets a Worker 400; ₱0 price preview on today→tomorrow (Candidate 3); `afterBookingUpdate` doesn't refresh upcoming check-ins; availability cache key ignores `exclude_booking_id`; dead old-format callers (`db.bookings.update`, `db.bookings.checkMultiUnitAvailability`, store `checkUnitAvailability`/`checkAllUnitsAvailability`; delete in Candidate 6); no DB test as a staff-role user; `update_guest_statistics` skipped for staff (not SECURITY DEFINER); `setBookingStatus` read-then-write race (compare-and-set later); email guest lookup case-sensitive with unordered `limit(1)`; stale docs (`forms-documentation.md`, `bookings/README.md`, `stores/README.md`, `hooks/entity/README.md`); 2 older tests fail only when the whole suite is forced to `TZ=America/Los_Angeles`. Revisit: Candidate 6 / next guardrails pass.
