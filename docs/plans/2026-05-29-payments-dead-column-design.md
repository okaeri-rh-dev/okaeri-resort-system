# Payments Dead-Column Filter — Booking Detail Loader Fix

**Date:** 2026-05-29
**Surface:** `src/lib/supabase.ts` (`db.payments.all`, `db.payments.byBooking`), `e2e/booking-card-mobile.spec.ts`
**Goal:** Remove the `.neq("status", "Deleted")` filter from both `payments` helpers — the column doesn't exist, so every call from the booking detail route loader emits a noisy 400. Add an E2E content assertion so a future regression on the detail page can't hide behind the existing "URL changed" assertion.

---

## Problem

The booking detail route loader (`src/routes/admin/bookings/$bookingId/index.tsx:48`) calls `db.payments.byBooking(bookingId)`. That helper is defined at `src/lib/supabase.ts:255` and appends `.neq("status", "Deleted")` to the SELECT. The `payments` table has **no** `status` column (`payment_id`, `booking_id`, `amount`, `payment_method`, `payment_date`, `proof_url`, `notes`, `created_at`, `account_id`), so PostgREST returns:

```
HTTP 400
{ "code": "42703", "message": "column payments.status does not exist" }
```

The loader catches this and falls back to `[]` (lines 50–53), so the page still renders. The visible cost is a console error on every booking detail tap — but the latent costs are real:

- The Payment Details section silently degrades to "no payments" regardless of actual data.
- The error shows up in real users' error tracking once monitoring lands, polluting signal.
- The mobile booking card we just shipped (`e9eee95`) drives every info-zone tap straight into this code path, so the noise count just jumped.

The same dead filter is also in `db.payments.all()` at line 252; not exercised by the detail page, but breaks any future caller for the same reason. Fix both.

### 406 non-reproduction note

The source plan (`docs/plans/2026-05-28-mobile-card-session-followups.md`, Item 1) listed a **second** symptom: a 406 / PGRST116 on the joined `bookings.byId` query. **This does not reproduce.** Verified 2026-05-29 against local Supabase (commit `def0806`):

- Authenticated as `jasonacido+owner@gmail.com` (active `app_roles.role='owner'`).
- Soft navigation (tap mobile card) and hard navigation (direct URL) on a booking with `booking_units` rows: joined `bookings.byId` returns **HTTP 200** with valid `{booking_units:[…], guest:null, …}`.
- Same query at the REST level via curl for `admin`, `owner`, and `staff` roles, against both bookings with and without `booking_units`: all 200.
- `payments` query is 400; `audit_logs` query is 200; `bookings` list query is 200.

The most parsimonious explanation for the original observation is a transient session-expiry at the moment of capture (JWT expired between login and loader fire, surfaced as 406-shaped output by the JS client). The DB schema, RLS, and PostgREST embed shape do not produce a permanent 406 against the current data.

**Out of scope for this fix:** investigating the 406 further. If it recurs, capture the request/response pair and we can revisit with concrete evidence.

## Non-goals

- Adding a soft-delete column to `payments`. The dead filter is a leftover, not a missing feature. Soft-delete is a separate product question.
- Fixing the 406 on `bookings.byId`. Doesn't reproduce; pre-emptive fixes risk solving phantom problems.
- Restructuring the loader (e.g., splitting joined SELECT into multiple queries, adding retry-on-401). The current shape works.
- Touching audit logging behavior. That's Item 2 of the source follow-ups plan.
- Adding broader E2E coverage of the detail page beyond a single content assertion. Out of scope here; can come later.

## Decisions (from brainstorming + investigation)

1. **Delete the filter, don't comment it out.** The `.neq` is dead code, not in-flight work. A code comment "TODO: re-enable when status column lands" would just rot. Anyone adding soft-delete in the future can re-add the filter as part of that feature's PR.
2. **Match the helper signature surrounding it.** Both `all()` and `byBooking()` become straightforward `SELECT *` builders, consistent with `expenses.all/.byId` directly below them.
3. **E2E content assertion is the regression guard.** The existing spec (`e2e/booking-card-mobile.spec.ts:70-73`) only asserts URL change. Extend the existing `"info-zone tap navigates to booking detail route"` test so it also asserts the booking reference is visible in the rendered detail page after navigation. One added line, same test.
4. **Don't add a separate "no error boundary" assertion.** Asserting the breadcrumb's `booking_reference` text is visible is sufficient — if the loader threw and the error boundary mounted, that text wouldn't render. Adding a second assertion for absence of the error-boundary heading would be redundant.
5. **Two commits, docs first.** Per project convention. Single feat commit covers both file changes (helper + spec).

---

## Design

### 1. `src/lib/supabase.ts` — drop dead filter

Current:

```ts
payments: {
  all: () => supabase.from("payments").select("*").neq("status", "Deleted"),
  byId: (id: string) => supabase.from("payments").select("*").eq("payment_id", id).single(),
  byBooking: (bookingId: string) =>
    supabase.from("payments").select("*").eq("booking_id", bookingId).neq("status", "Deleted"),
  // ...
}
```

Target:

```ts
payments: {
  all: () => supabase.from("payments").select("*"),
  byId: (id: string) => supabase.from("payments").select("*").eq("payment_id", id).single(),
  byBooking: (bookingId: string) =>
    supabase.from("payments").select("*").eq("booking_id", bookingId),
  // ...
}
```

No call sites need updating — every caller already handles `[]` for the no-payments case (the loader catches errors and returns `[]` anyway, and the detail page renders `"Not specified"` placeholders).

### 2. `e2e/booking-card-mobile.spec.ts` — assert detail content

Current test (lines 70–73):

```ts
test("info-zone tap navigates to booking detail route", async ({ page }) => {
  await page.getByRole("button", { name: `View booking ${E2E_REF.CONFIRMED}` }).click();
  await expect(page).toHaveURL(/\/admin\/bookings\/[0-9a-f-]{36}/);
});
```

Target:

```ts
test("info-zone tap navigates to booking detail route", async ({ page }) => {
  await page.getByRole("button", { name: `View booking ${E2E_REF.CONFIRMED}` }).click();
  await expect(page).toHaveURL(/\/admin\/bookings\/[0-9a-f-]{36}/);
  // Detail page must actually render — guard against the loader silently throwing
  // (e.g. a future schema mismatch like the payments.status filter we just removed).
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb" }).getByText(E2E_REF.CONFIRMED)
  ).toBeVisible();
});
```

Two things this asserts that the URL check alone doesn't:

- The route loader resolved without throwing (otherwise the error boundary renders "Failed to Load Booking" instead of the breadcrumb).
- The booking data made it through the joined SELECT (otherwise the breadcrumb would render the booking_id slug, not the human-readable reference).

The locator scopes to the breadcrumb to avoid matching the same reference if it leaks into other parts of the page (defensive against future copy changes).

## Testing plan

1. **Unit / type check:** `npm run verify` should still pass — only deletion of a method chain, no new types.
2. **Manual smoke (Playwright MCP, already done during investigation):**
   - Log in as `jasonacido+owner@gmail.com`, navigate `/admin/bookings`, tap a mobile card.
   - Network tab: payments call returns 200 (was 400). Bookings call still 200.
   - Console: zero errors on detail page load (was 2 — both from the payments 400).
3. **E2E:** `npm run e2e:dev` runs `booking-card-mobile.spec.ts` against an already-seeded local DB. The expanded `info-zone tap` test should pass; if the loader regresses, the breadcrumb assertion fails before the URL assertion would.
4. **Pre-push hook:** `git push` triggers `test:e2e:hooked` (orchestrator seeds → runs spec → cleans up). Expect green.

## Edge cases

- **Booking with no payments:** unchanged behavior. `byBooking` returns `[]`, the loader keeps the `[]` it already had as the catch-fallback, the Payment Details section renders placeholders.
- **Booking with payments:** previously, every call short-circuited to `[]` via the 400 catch. After fix, real payment rows surface. This is a behavior change: the Payment Details section will now reflect actual data. There are no existing payment rows in local DB seeded for E2E, so this is silent locally; in production-like data, payments will start appearing. Worth calling out so QA isn't surprised. This is the intended fix.
- **Future soft-delete on payments:** if `status` is later added with a `Deleted` value, the helpers will need the filter re-added — but as part of that feature's PR, not as a dangling comment now.
- **E2E_REF.CONFIRMED is a `Confirmed` booking:** chosen because the existing test on that ref already verifies it's there and visible. No new fixture state needed.

## Risks

- **None material.** The fix removes a filter that has never matched any row (column doesn't exist), so production behavior strictly improves: the 400 stops, the empty-result fallback only fires on genuinely empty payment lists.
- The E2E assertion could be flaky if the breadcrumb text takes longer than Playwright's default `expect` timeout on a cold dev server. Mitigation: the existing spec's `beforeEach` already waits for cards to lazy-load, so the dev server is warm by the time the test runs.

## Rollback

`git revert` the feat commit. The dead filter returns; the console error returns. No data migration to unwind. No schema change.

---

## Commit plan

Three commits, docs first per project convention. The code change splits into a helper fix and an E2E hardening so blame is cleaner and each commit has a single concern.

1. `docs(plans): payments dead-column design for booking detail fix`
2. `fix(payments): drop nonexistent status filter from helpers`
3. `test(e2e): assert booking detail content after mobile-card tap`

The helper commit is a `fix:` (not `feat:`) since this is a regression in helper behavior — the loader's failed query is the bug, removal restores correct behavior. The E2E commit is `test:` since it adds no production-code behavior, only a regression guard.
