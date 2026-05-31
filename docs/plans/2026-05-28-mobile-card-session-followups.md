# Mobile Booking Card — Session Follow-ups

**Date:** 2026-05-28
**Surface (item 1):** `src/routes/admin/bookings/$bookingId/index.tsx`, `src/lib/supabase.ts` (db.payments helper)
**Surface (item 2):** active `audit_trigger_func()` in local Supabase + a new migration under `supabase/migrations/`
**Source:** session that shipped commits `8cb1919` → `e9eee95` (mobile booking card Density 2 + pre-push E2E). See `docs/plans/2026-05-24-mobile-booking-card-density-design.md` and `docs/plans/2026-05-24-prepush-e2e-seed-cleanup-design.md` for context.

This plan captures two issues surfaced during that session but deferred as out-of-scope. Each is independent and can be brainstormed/implemented in its own session.

---

## Item 1 — Booking detail page schema mismatch (P0)

### Why it matters

The new mobile booking card's info-zone tap navigates to `/admin/bookings/$bookingId`. That destination currently throws a route-match error for every booking the user taps. Users see an error boundary instead of the detail page. The Playwright E2E test passes only because we assert the URL change, not the page content.

### Symptoms (observed during the session)

1. **400 Bad Request** on `GET /rest/v1/payments?select=*&booking_id=eq.<id>&status=neq.Deleted`
   `column payments.status does not exist`
2. **406 Not Acceptable / PGRST116** on `GET /rest/v1/bookings?select=*,booking_units(*,unit:units(*)),guest:guests(*)&booking_id=eq.<id>`
   `Cannot coerce the result to a single JSON object` (i.e. 0 rows returned despite the row existing)

### What we already know

- The `payments` table has columns `payment_id, booking_id, amount, payment_method, payment_date, proof_url, notes, created_at, account_id` — there is **no** `status` column. The filter is a leftover that was never wired up to a soft-delete column.
- The offending helper is at `src/lib/supabase.ts:251-260`. Both `db.payments.all()` and `db.payments.byBooking()` apply `.neq("status", "Deleted")`. The detail page calls `byBooking` at `src/routes/admin/bookings/$bookingId/index.tsx:48`.
- The 406 on the bookings query is **separate** from the payments 400 — same page, both fire from the route loader. The booking exists (it shows up in the list), so 0 rows likely means an RLS policy is rejecting the joined SELECT for the current user, or one of the joined relations (`booking_units`, `guests`) is blocked and Supabase resolves it as no row.
- Cleanup confirmed: cleaning E2E data does **not** affect the bug; the same 406 happens for non-E2E bookings too.

### Investigation needed before fixing

1. Run `psql` against local Supabase: `SELECT * FROM pg_policies WHERE tablename IN ('bookings','booking_units','guests');` to see which roles each policy allows.
2. From the admin client logged in as `dev-admin@localhost` (or similar), confirm whether the joined `byId` query returns 0 rows because of RLS on `booking_units`/`guests` specifically. A naive `SELECT * FROM bookings WHERE booking_id = ...` may succeed while the joined version fails.
3. Compare against `db.bookings.all()` — which currently works on the list page using the same joined SELECT.

### Suggested fix (low-confidence, brainstorm first)

- **`db.payments.all()` / `byBooking()`**: drop the `.neq("status", "Deleted")` filter entirely. No soft-delete is implemented on `payments`; the filter is dead code that breaks every query.
- **Detail page 406**: depends on the investigation. Likely either an RLS policy fix or a query restructure (separate sub-queries instead of nested SELECT). Avoid the temptation to wrap in a try/catch — fix the underlying access control.

### Acceptance criteria

- Tapping a booking card on mobile (or clicking the desktop detail link) opens the detail page with no console errors.
- No 400, no 406 from the booking detail route loader.
- The mobile spec (`e2e/booking-card-mobile.spec.ts`) is extended with at least one assertion about detail-page content (e.g. guest name visible), so this regression cannot reappear silently.

### Out of scope for this fix

- Redesigning the booking detail page.
- Building a proper soft-delete for `payments` (separate question — if soft-delete is wanted, add the column and migration deliberately).
- Touching audit logging behavior (covered by Item 2).

---

## Item 2 — Audit trigger empty-changed-fields latent bug (P1)

### Why it matters

The active `audit_trigger_func()` rejects any `UPDATE` on an audited table that doesn't actually change any column values, because the `valid_changed_fields` CHECK on `audit_logs` requires non-empty `changed_fields` when `source != 'app'` and `action = 'UPDATE'`. The trigger computes `v_changed_fields` from the OLD-vs-NEW jsonb diff; when nothing differs, the array is NULL and the constraint blocks the INSERT.

This bites any code path that:

1. Inserts multiple rows into `bookings` or `booking_units` in one statement, and
2. Cascades through `trigger_update_guest_statistics` (or `trigger_update_booking_totals`), and
3. Lands on a stats-neutral row (e.g. a `Cancelled` booking, or a re-insert with identical totals).

The cascade UPDATE then writes the same `NOW()` (transaction timestamp is constant within one transaction) and the same computed totals — every column matches its prior value, `v_changed_fields = NULL`, constraint fails.

### What we already know

- Reproduced live during the session. The pre-push E2E seed (`scripts/e2e/seed.ts`) **works around it** by inserting bookings and booking_units **one-at-a-time**. Comments at lines 68-75 and 100-103 of that file flag the workaround explicitly.
- The trigger function source is reproduced verbatim in `supabase/migrations/20260221_fix_audit_trigger_column_name.sql`. The current live function matches that migration (confirmed via `SELECT prosrc FROM pg_proc WHERE proname = 'audit_trigger_func'`).
- The constraint is in `supabase/migrations/20251006093452_remote_schema.sql` lines 951 and 1072 (on `audit_logs` and `audit_logs_archive`):
  `CHECK (source = 'app' OR action <> 'UPDATE' OR (changed_fields IS NOT NULL AND array_length(changed_fields, 1) > 0))`

### Fix options

| Option | What it does                                                                                                                            | Cost                                              | Risk                                                                                                 |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **A**  | Patch `audit_trigger_func()`: when `TG_OP = 'UPDATE'` and `v_changed_fields` is NULL/empty, early-return without inserting an audit row | New migration; modifies the live trigger function | Low — only suppresses audit rows that would be no-ops anyway                                         |
| **B**  | Relax `valid_changed_fields`: drop the constraint or allow empty arrays                                                                 | New migration; alters the constraint              | Medium — silently allows uninformative audit rows; future audit consumers may rely on the constraint |
| **C**  | Keep current behavior; document the workaround everywhere                                                                               | No migration                                      | High — every future batch-insert or stats-neutral UPDATE has to know the trap                        |

### Recommended: Option A

Why: it preserves the constraint's intent (no useless audit rows), removes the trap, and aligns with what most audit-logging systems do (skip no-op UPDATEs).

Sketch of the migration:

```sql
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    v_old_data JSONB;
    v_new_data JSONB;
    v_changed_fields TEXT[];
    v_record_id TEXT;
    v_record_data JSONB;
BEGIN
    -- ... (same as before through changed_fields computation) ...

    -- NEW: skip no-op UPDATEs to avoid violating valid_changed_fields
    IF TG_OP = 'UPDATE' AND (v_changed_fields IS NULL OR array_length(v_changed_fields, 1) IS NULL) THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.audit_logs (...) VALUES (...);

    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
```

### Acceptance criteria

- The `scripts/e2e/seed.ts` workaround (single-row inserts in two `for` loops) can be reverted to a batch `.insert([...])` call without errors. **This is the test**: replace the loops with a single batch insert, run `npm run seed:e2e`, expect success.
- Existing unit and E2E tests still pass.
- Audit log table contains exactly the same rows as before for actual changes — no regression in audit coverage.
- No existing audit-log queries break (search for `changed_fields IS NOT NULL` in app code; none expected to break, but worth verifying).

### Out of scope for this fix

- Auditing the existing `audit_logs` data for gaps (the pre-fix data won't change).
- Migrating the `audit_logs_archive` table (same constraint exists there; apply the same trigger fix only if archive ingestion uses the same function — verify).
- Touching the booking detail page (Item 1) even though it also runs into audit-related noise.

---

## Item 3 — `booking_units` has no audit trail (low priority)

### Why it matters

Surfaced during the Item 2 verification pass (2026-05-30). `audit_trigger_func` is wired to 6 tables — `bookings, expenses, guests, maintenance_logs, payments, units` — but **not** to `booking_units`. Every multi-unit booking write, cancellation, or unit-assignment change happens unaudited at the row level. The parent `bookings` row still gets audited (via `trigger_update_booking_totals` cascading an UPDATE that the audit trigger then logs), but the per-unit detail — which unit, what price, what status — is invisible to the audit log.

Concrete consequence: if a staff member changes the unit assignment on a multi-unit booking from Unit A to Unit B, `audit_logs` will show an UPDATE on `bookings` with no field-level evidence of the unit swap. The swap lives only in `booking_units` and the live `booking_units` row reflects only the current state.

### What's not known yet

- Whether this is **deliberate** (someone consciously decided the per-unit churn was too noisy and the bookings-level cascade is "good enough") or **accidental** (the trigger just never got wired up when `booking_units` was introduced). Worth checking the multi-unit migration history (`20251104184719_multi_unit_guest_booking_schema.sql`) and any related design docs before adding the trigger.
- Whether the same `valid_changed_fields` trap would bite a `booking_units` audit trigger. `trigger_update_booking_totals` modifies `bookings.total_amount`/`payment_status`, not `booking_units`, so we don't have the same statement-snapshot cascade source. But there may be others (e.g. status-update triggers).

### Suggested approach (when picked up)

1. Investigate intent first — git log / design doc archaeology to see if the omission was a choice.
2. If accidental: add `CREATE TRIGGER audit_booking_units_trigger AFTER INSERT OR UPDATE OR DELETE ON public.booking_units FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();` in a new migration. Item 2's fix already protects against no-op UPDATEs, so the trigger is safe to wire up.
3. If deliberate: leave alone and document the decision in `docs/decisions/` so future-us doesn't keep re-discovering it.

### Acceptance criteria

- Decision recorded (either trigger added + tested, or decision documented as "no audit needed, here's why").

### Out of scope here

- Backfilling historical `booking_units` changes (impossible from current state — no audit data to reconstruct from).
- Designing a `booking_units`-specific audit shape (the generic `audit_trigger_func` would log the whole row; that's likely sufficient).

---

## Item 4 — `get_booking_units` RPC references removed column (low priority)

### Why it matters

Surfaced during the Item 2 verification pass (2026-05-30). Running `npm run verify` produces two test failures, both calling the `get_booking_units` RPC and both hitting the same PostgreSQL error:

```
code: '42703'
message: 'column b.unit_id does not exist'
hint: "Perhaps you meant to reference the column 'bu.unit_id' or the column 'u.unit_id'"
```

Failing tests:

- `src/__tests__/database/multi-unit-booking.test.ts:547` — `get_booking_units > should return units for multi-unit booking`
- `src/__tests__/performance/multi-unit-availability.test.ts:352` — `get_booking_units Performance > should fetch booking units in <50ms`

Confirmed pre-existing on clean `main` (verified by stashing in-progress work and re-running). The Item 2 work did not cause these failures and does not exacerbate them.

### What we already know

- The live `get_booking_units` function body (per `SELECT prosrc FROM pg_proc WHERE proname='get_booking_units'`) contains `COALESCE(bu.unit_id, b.unit_id)` and `LEFT JOIN public.units u ON u.unit_id = COALESCE(bu.unit_id, b.unit_id)`. Both reference `b.unit_id`.
- `bookings` no longer has a `unit_id` column — it was removed when the multi-unit schema landed in `20251008152700_multi_unit_schema.sql` and unit assignments moved into `booking_units`. So the function's COALESCE fallback is unreachable schema-wise.
- A prior fix attempt exists: `supabase/migrations/20251018_fix_get_booking_units.sql`. Either it didn't fully drop the `b.unit_id` references, or a later migration re-introduced them. Worth diffing.
- The two failing tests both assert `expect(error).toBeNull()` immediately after the RPC call, so they fail on the first 42703 — they don't get to exercise the row-shape assertions further down.
- This is a **silent partial outage** at runtime too: any app code path that calls `db.bookings.byId(...)` (or anything else that triggers `get_booking_units`) gets a 42703 from PostgREST and presumably falls back to an empty list, which is exactly the failure pattern Item 1 was about for `payments.status`. Worth grepping for callers.

### Suggested approach (when picked up)

1. **Confirm intent.** Read `20251018_fix_get_booking_units.sql` to see what the previous fix removed; compare against the current `pg_proc` body. Decide whether `b.unit_id` references should drop entirely (post-multi-unit world) or whether the COALESCE was deliberate hedging that's no longer needed.
2. **New migration** that does `CREATE OR REPLACE FUNCTION public.get_booking_units(...)` with the `b.unit_id` references removed. SELECT should pull `unit_id` straight from `bu.unit_id` (no COALESCE), and the units JOIN should use `u.unit_id = bu.unit_id`.
3. **Run the same two tests** to confirm green; add no new tests (the existing ones already cover the function's contract).
4. **Grep for callers** — `grep -rn "get_booking_units" src/ functions/` — and verify each caller's expectations. If any swallow the error silently, fix or surface.

### Acceptance criteria

- Both failing tests pass.
- No app-side regressions in any page that consumes `get_booking_units`.
- `npm run verify` clean (assuming Items 2 and 4 are the only outstanding test failures).

### Out of scope here

- Auditing other RPC functions for the same multi-unit transition bug. The `20251008152700_multi_unit_schema.sql` removal of `bookings.unit_id` may have left other broken references; a sweep is worthwhile but separate.
- Adding a regression test for the broken RPC contract — the existing tests already serve that purpose; restoring them is enough.

---

## Priority and ordering

| Order | Item                                           | Why                                                                                                                                                                           |
| ----- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Booking detail page fix (Item 1)               | User-facing regression. The new mobile card navigation we just shipped surfaces it on every tap. Until this is fixed, every successful E2E navigation lands on a broken page. |
| 2     | Audit trigger fix (Item 2)                     | Latent. Current code paths work around it. Worth fixing before someone writes new batch-import code and gets bitten again.                                                    |
| 3     | `booking_units` audit gap (Item 3)             | Low priority and possibly deliberate. Investigate intent before adding anything. Safe to defer until someone actually wants per-unit audit detail.                            |
| 4     | `get_booking_units` RPC broken column (Item 4) | Two pre-existing test failures plus a likely silent runtime degradation. Fix is small (one migration) once intent is confirmed. Worth doing before it masks a real bug.       |

These items are independent — they can run in parallel sessions if desired. Item 2's fix removes a constraint trap that would otherwise complicate adding the trigger Item 3 considers, so picking up Item 3 _after_ Item 2 ships is the natural order. Item 4 is independent of the others.

---

## How to pick this up in a future session

1. Read the source-session design docs first (`docs/plans/2026-05-24-mobile-booking-card-density-design.md`, `docs/plans/2026-05-24-prepush-e2e-seed-cleanup-design.md`) for context.
2. For each item, follow the project convention: brainstorm → write a design doc in `docs/plans/2026-XX-XX-<slug>-design.md` → implement → commit (docs commit first, then feat).
3. Item 1 needs psql-based investigation before the design doc can be finalized; treat the "Investigation needed before fixing" section as the brainstorming prerequisite.
4. Item 2 has a clear fix sketch above; the design doc can focus on the migration mechanics and the verification path (the seed revert is the litmus test).

---

## What is NOT a follow-up

- ~~`canConfirmBookings` only being available to Manager~~ — resolved in-session. `useUserRole.canConfirmBookings = isManager`, and `isManager = MANAGER || OWNER || ADMIN`. Owner and Admin already see the action.
- ~~Mobile card View button vs info-zone tap~~ — shipped.
- ~~Mobile card Confirm/Delete parity with desktop~~ — shipped.
- The two warnings in the existing pre-commit lint output (`react-refresh/only-export-components` on `button.tsx` and `form.tsx`). Pre-existing, unrelated to either item.
