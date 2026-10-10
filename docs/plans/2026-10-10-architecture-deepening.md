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

Deploy status 2026-10-10: pushed to `origin/main` (up to `2e3feb0`), but GitHub Actions did not start any job ("recent account payments have failed or your spending limit needs to be increased"), so the deploy (gated on CI) has not run. Last deployed commit: `4e2abb1`. Re-run the workflows once billing is fixed.

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
- [ ] 1c. Read-only prod diff of statuses the backfill would change → user reviews → user runs `db push` → confirm trigger in prod `pg_trigger`. Diff query (run in the Supabase SQL editor; reads only):

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

  After review: `supabase db push`, then confirm with `SELECT tgname FROM pg_trigger WHERE tgname IN ('refresh_booking_payment_status', 'refresh_payment_status_on_total_change');` (2 rows).

- [ ] 1d. `src/lib/payments/` module (`createPayment`, `updatePayment`, `softDeletePayment`, `appendVerificationNote`; proof upload; `payment_date` at Manila 12:00) + DB tests; hooks become adapters owning invalidation; delete client status recompute, hard delete from the UI, the store's optimistic map/`selectedPayment`, the `useEntityEdit` payment branch and its mock tests; `paymentEditSchema` uses column names; booking-table proof upload records the outstanding balance. Gated: do not deploy before 1c
- [ ] One booking-date convention (Manila day at 15:00 check-in / 11:00 check-out) owned by the booking persistence module; move `BookingForm`, `MultiUnitBookingForm` (create + availability, lines 148/282/296) and `toBookingUpdate` onto it; decide whether prod rows stored at local midnight need a correction migration
- [ ] Then 4 → 6 on the client; 3 → 2 → 8 on the server

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
