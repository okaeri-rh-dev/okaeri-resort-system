# Pre-push E2E for Mobile Booking Card — Seed + Cleanup Design

**Date:** 2026-05-24
**Surface:** new `scripts/e2e/` directory, new `e2e/booking-card-mobile.spec.ts`, append to `.husky/pre-push`
**Goal:** Add a focused, deterministic Playwright E2E run that exercises the new mobile booking card flows against local Supabase. The run is wired to the `pre-push` git hook only; it seeds known fixtures before tests and cleans them up unconditionally afterwards.

---

## Problem

The mobile booking card just gained Confirm + Delete actions, a status-dependent primary button, and an info-zone tap target. We already have unit tests for the role/state logic, but none of the production wiring (Supabase mutations, route navigation, Radix overlays in real browsers, audit logging) is exercised by those tests. The browser walk-through caught zero regressions but it was manual; we can't repeat it on every push.

Two concrete gaps to close:

1. **No automated end-to-end coverage** for the new card. Existing `e2e/admin-bookings.spec.ts` predates this work and exercises the desktop table.
2. **No deterministic data state for E2E.** Existing specs either rely on whatever happens to be in local Supabase or seed inline within each test, which is fragile across reruns. A pre-push gate needs guaranteed starting state.

## Non-goals

- Do not run any E2E during regular `npm test` or `npm run verify`. The user wants this on `pre-push` only.
- Do not modify the existing `npm run test:e2e` script or any of the 12 existing specs. The new spec lives alongside them.
- Do not change the existing `playwright.config.ts` projects/devices/`webServer` block.
- Do not introduce a CI-environment-specific path. The hook is local-dev-only; CI is a separate concern.
- Do not modify the existing pre-push parallel lint/unit/db block. Append the E2E step sequentially after it.
- Do not seed real-looking guest data (names like "John Doe"). All fixtures are obviously test data (`E2E_*` prefix, `@e2e.local` emails).
- Do not test the booking detail page. The walk-through surfaced a pre-existing schema bug there; out of scope for this work.

## Decisions (from brainstorming)

1. **Fixture identification: prefix matching.**
   All seed rows carry `booking_reference LIKE 'E2E-%'`. Cleanup is a single `DELETE WHERE booking_reference LIKE 'E2E-%'` cascaded across `booking_units`, `payments`, and `audit_log`. Safe on a local-dev Supabase that doesn't hold production data; obvious to the developer when inspecting tables.
2. **Cleanup on failure: shell `trap` on EXIT.**
   The orchestrator script runs cleanup unconditionally — whether Playwright passes, fails, or crashes. Idempotent: cleanup on a clean database is a no-op.
3. **Local Supabase missing: fail loudly.**
   A preflight check pings `http://127.0.0.1:54321/rest/v1/` before seeding. If unreachable, the script exits with a clear actionable message (`Run "supabase start" before pushing`). No auto-start, no skip.
4. **Spec scope: mobile booking card only, 5 tests.**
   Pre-push hooks rot at >60s. Targeting one device project (`Mobile Chrome` / Pixel 5) running one spec file keeps the run tight (~15–25s incl. dev server warm-up).
5. **Separate `e2e:dev` script for iteration.**
   Runs the same spec but skips seed/cleanup. Lets a developer iterate on test code against a pre-seeded or production-shaped local DB without paying the seed cost each run.

---

## Design

### 1. New npm scripts (`package.json`)

```jsonc
{
  "seed:e2e": "tsx scripts/e2e/seed.ts",
  "cleanup:e2e": "tsx scripts/e2e/cleanup.ts",
  "preflight:e2e": "tsx scripts/e2e/preflight.ts",
  "e2e:dev": "playwright test e2e/booking-card-mobile.spec.ts --project='Mobile Chrome'",
  "test:e2e:hooked": "bash scripts/e2e/run-hooked.sh",
}
```

- `seed:e2e` and `cleanup:e2e` are standalone — a developer can call them manually for debugging.
- `preflight:e2e` is the Supabase reachability check; called by the orchestrator and easy to call directly when troubleshooting.
- `e2e:dev` runs the spec without seed/cleanup — used during test development against an already-seeded or arbitrarily-stated DB.
- `test:e2e:hooked` is what `pre-push` calls; it orchestrates the whole lifecycle.

### 2. Orchestrator (`scripts/e2e/run-hooked.sh`)

```sh
#!/usr/bin/env bash
set -euo pipefail

# Always run cleanup, even on test failure or interrupt.
trap 'npm run cleanup:e2e' EXIT

npm run preflight:e2e
npm run seed:e2e
npx playwright test e2e/booking-card-mobile.spec.ts --project="Mobile Chrome"
```

- `set -euo pipefail` — fail on any error, unset var, or broken pipe.
- `trap '...' EXIT` — runs cleanup on every exit path (success, failure, signal). The single hardcoded EXIT trap keeps the script readable; we don't need separate ERR/EXIT traps.
- Spec target and project are explicit on the CLI so this doesn't depend on any config drift.

### 3. Preflight (`scripts/e2e/preflight.ts`)

Pings `http://127.0.0.1:54321/rest/v1/?apikey=<anon>` (anon key is fine; we only need the endpoint to respond). On failure, prints:

```
✗ Local Supabase is not reachable at http://127.0.0.1:54321.
  This pre-push E2E run requires a running local Supabase.
  Start it with:    supabase start
  Then push again.
```

Exits non-zero. No retries, no auto-start.

### 4. Fixtures (`scripts/e2e/fixtures.ts`)

A single source of truth for the seed data, imported by both `seed.ts` and the Playwright spec.

```ts
export const E2E_REFERENCE_PREFIX = "E2E-";

export const E2E_GUEST = {
  guest_id: "00000000-0000-0000-0000-000000000e2e",
  full_name: "E2E Test Guest",
  email: "guest@e2e.local",
  contact_number: "+639170000000",
};

export const E2E_UNIT = {
  unit_id: "00000000-0000-0000-0000-000000000ee2",
  unit_code: "E2E1",
  unit_name: "E2E Test Unit",
  base_price: 2500,
};

export const E2E_BOOKINGS = [
  {
    booking_reference: "E2E-PENDING-001",
    booking_status: "Pending",
    payment_status: "Pending",
    check_in: "2099-06-26",
    check_out: "2099-06-27",
    total_amount: 2500,
    num_guests: 1,
  },
  {
    booking_reference: "E2E-CONFIRMED-001",
    booking_status: "Confirmed",
    payment_status: "Pending",
    check_in: "2099-06-28",
    check_out: "2099-06-29",
    total_amount: 2500,
    num_guests: 2,
  },
  {
    booking_reference: "E2E-CONFIRMED-PAID-001",
    booking_status: "Confirmed",
    payment_status: "Completed",
    check_in: "2099-06-30",
    check_out: "2099-07-02", // cross-month for date format test
    total_amount: 5000,
    num_guests: 2,
  },
  {
    booking_reference: "E2E-CANCELLED-001",
    booking_status: "Cancelled",
    payment_status: "Pending",
    check_in: "2099-07-05",
    check_out: "2099-07-06",
    total_amount: 2500,
    num_guests: 1,
  },
];
```

- **Year 2099** ensures the fixtures don't collide with realistic dev data and don't drift over time.
- **Static UUIDs** (`...00000e2e`) make the rows easy to spot and idempotent — repeated seeds upsert instead of duplicating.
- The cross-month booking (`Jun 30 → Jul 2`) is the smart-date-format test case.

### 5. Seed (`scripts/e2e/seed.ts`)

Connects to local Supabase using the **service-role key** from `.env.local` (already required for the existing DB tests).

Sequence:

1. Upsert `E2E_GUEST` into `guests`.
2. Upsert `E2E_UNIT` into `units`.
3. Upsert each `E2E_BOOKINGS` row into `bookings` with `guest_id = E2E_GUEST.guest_id`.
4. Insert `booking_units` linking each booking to `E2E_UNIT`.
5. For the `Completed` payment fixture, insert a matching `payments` row.

All upserts use `onConflict: "booking_reference"` (or the appropriate unique key) so re-running seed on a non-cleaned DB is safe.

Logs a one-line success summary (`Seeded 1 guest, 1 unit, 4 bookings`) so the pre-push output is scannable.

### 6. Cleanup (`scripts/e2e/cleanup.ts`)

Deletion order to satisfy FK constraints:

1. `audit_log` — `WHERE entity_id IN (SELECT booking_id FROM bookings WHERE booking_reference LIKE 'E2E-%')`.
2. `payments` — same subquery.
3. `booking_units` — same subquery.
4. `bookings` — `WHERE booking_reference LIKE 'E2E-%'`.
5. `units` — `WHERE unit_id = E2E_UNIT.unit_id` (constant, safer than prefix on units).
6. `guests` — `WHERE guest_id = E2E_GUEST.guest_id` (constant).

Idempotent: deleting zero rows is success. Logs `Cleaned N E2E rows.`

### 7. Playwright spec (`e2e/booking-card-mobile.spec.ts`)

Five tests, all under `test.describe("Mobile booking card", () => { ... })`. Each test:

- Logs in as `TEST_USERS.owner` (so Delete is visible — exercises the maximum-permission path).
- Navigates to `/admin/bookings`.
- Asserts only against E2E fixtures (`page.getByText("E2E-PENDING-001")` etc.), never against pre-existing data.

| #   | Test                                                 | What it asserts                                                                                                                                                               |
| --- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Renders the Density 2 layout for a Pending booking   | Card shows facts strip `Jun 26 → 27 · 1 night · 1 guest`, payment dot, Confirm primary button, status badge.                                                                  |
| 2   | Smart date format for cross-month booking            | The `E2E-CONFIRMED-PAID-001` card shows `Jun 30 → Jul 2` (not `Jun 30 → 2` and not `Jun 30 — Jul 2`).                                                                         |
| 3   | Confirm primary button → status changes to Confirmed | Click Confirm on `E2E-PENDING-001`; assert status badge becomes "Confirmed" and primary button text becomes "Upload Payment".                                                 |
| 4   | ⋯ menu role gating (owner sees Delete)               | Open ⋯ on any card; assert Edit Booking, Upload Payment, Confirm (Pending only), Cancel, Delete are visible.                                                                  |
| 5   | Info-zone tap navigates to detail route              | Click the info zone on `E2E-PENDING-001`; assert URL matches `/admin/bookings/<uuid>`. (Does not assert detail page contents — pre-existing detail-page bug is out of scope.) |

The spec uses the existing `LoginPage` POM. The new selectors specific to this card (`[role="button"][aria-label^="View booking"]`, payment dot, etc.) live inline in the spec for now — extracting a `BookingCardMobile` POM is a follow-up if more tests appear.

### 8. Pre-push hook integration

Append to `.husky/pre-push`, after the existing parallel `concurrently` block and the success echo:

```sh
# Run mobile booking card E2E with seed/cleanup
echo "${GREEN}🎭 Running pre-push E2E (mobile booking card)...${NC}"
npm run test:e2e:hooked
```

- Sequential — does not parallelize with lint/unit because Playwright already starts its own webServer; running concurrently with vitest contends for ports and CPU.
- `set -e` in the existing script ensures the hook exits non-zero if E2E fails.

### 9. Environment requirements

The hook will fail with a clear message if any of these are not satisfied:

| Requirement                                               | Source                                                  | Failure message                                                          |
| --------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------ |
| Local Supabase running                                    | `preflight.ts`                                          | "Local Supabase not reachable at 127.0.0.1:54321 — run `supabase start`" |
| `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`               | `seed.ts` / `cleanup.ts`                                | "Missing SUPABASE_SERVICE_ROLE_KEY in .env.local"                        |
| `TEST_OWNER_EMAIL` / `TEST_OWNER_PASSWORD` in `.env.test` | Playwright spec                                         | Spec uses `test.skip` if missing — same pattern as existing E2E specs    |
| Port 5173 free for webServer                              | `playwright.config.ts` `webServer` (already configured) | Playwright handles startup                                               |

---

## Testing plan

The orchestrator script itself has three failure modes worth manually testing once during implementation:

1. **Supabase down** → preflight should fail before seed runs; cleanup should still execute (it's a no-op).
2. **Playwright test failure** → cleanup must still run. Verify by deliberately breaking an assertion and confirming `E2E-*` rows are gone after the failed push.
3. **Seed mid-flight failure** (e.g., FK violation) → cleanup must still run. Less critical because the prefix-based cleanup is idempotent; this is a defense-in-depth check.

No automated test of the orchestrator itself — overkill for a 4-line shell script with a clearly visible `trap`.

---

## Edge cases

| Scenario                                                                         | Handling                                                                                                                                                                            |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Developer pushes without running `supabase start`                                | Preflight exits with the actionable message; no seed runs; cleanup trap fires (no-op).                                                                                              |
| Developer's local DB already has unrelated `E2E-*` rows                          | Seed upserts (idempotent); cleanup removes them. Acceptable side effect since the prefix is reserved.                                                                               |
| Multiple developers running E2E simultaneously on the same Supabase              | Out of scope — local Supabase is per-developer. Documented assumption.                                                                                                              |
| Playwright crashes (segfault, OOM)                                               | Bash trap on EXIT still runs cleanup.                                                                                                                                               |
| Pre-push hook killed by Ctrl-C                                                   | Bash trap on EXIT still runs cleanup.                                                                                                                                               |
| `npm run e2e:dev` run in isolation against a clean DB                            | Spec fails because no E2E fixtures exist — developer is expected to either seed first or use the orchestrator. Acceptable: `e2e:dev` is for iteration, not first-run.               |
| New booking created by the user with `booking_reference = "E2E-MY-REAL-BOOKING"` | Would be deleted by cleanup. Mitigation: the documented convention is "`E2E-` prefix is reserved." Realistically zero chance in this resort's reference scheme (`BKG-YYYY-MM-NNN`). |

---

## Out of scope (deferred)

- Running E2E on other device projects (firefox, webkit, Mobile Safari). Mobile Chrome alone catches the issues we care about.
- A Page Object Model for the mobile booking card. Selectors inline for now; extract when a second mobile spec appears.
- Snapshot/visual regression testing.
- E2E coverage for desktop booking actions (existing `admin-bookings.spec.ts` already covers some).
- CI integration — separate concern, separate hook discipline.
- A `bypass` flag (e.g., `git push --no-verify` already does this).
