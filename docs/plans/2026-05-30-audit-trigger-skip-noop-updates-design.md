# Audit Trigger — Skip No-op UPDATEs

**Date:** 2026-05-30
**Surface:** `supabase/migrations/20260530_fix_audit_trigger_skip_noop_updates.sql` (new), `scripts/e2e/seed.ts` (simplification), `src/__tests__/database/audit-trigger-noop.test.ts` (new regression test)
**Goal:** Patch `audit_trigger_func()` to short-circuit when an `UPDATE` produces no field-level changes, so cascading stats-trigger UPDATEs stop violating the `valid_changed_fields` CHECK on `audit_logs`. Once fixed, revert the single-row-insert workaround in the E2E seed and add a regression test that locks the new behavior in.
**Source:** `docs/plans/2026-05-28-mobile-card-session-followups.md` (Item 2).

---

## Problem

The active `audit_trigger_func()` rejects no-op UPDATEs on audited tables. Root cause (verbatim from the source plan):

1. `audit_trigger_func` computes `v_changed_fields` from a jsonb diff of OLD vs NEW.
2. `valid_changed_fields` on `audit_logs` requires non-empty `changed_fields` for any `source='db'` row whose `action='UPDATE'`.
3. When a cascade trigger (`trigger_update_guest_statistics`, `trigger_update_booking_totals`) fires twice in one statement and writes the same totals both times — which happens because `NOW()` returns the **transaction** start time, not the row/statement time — the second invocation sees `OLD = NEW` for every column. `v_changed_fields` becomes `NULL`, the constraint rejects the INSERT, and the whole outer statement aborts.

The pre-push E2E seed (`scripts/e2e/seed.ts`) currently works around the trap by inserting `bookings` and `booking_units` one row at a time in two `for` loops with explanatory comments at lines 68–75 and 100–103. The workaround is correct but is a permanent tax on any future batch-import code that nobody will remember to pay.

## Live state verification (2026-05-30, local Supabase)

Performed before writing this doc, to make sure the plan's claims still match reality:

| Check                                                                                                  | Method                                                          | Result                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `audit_trigger_func` source matches `20260221` migration verbatim                                      | `SELECT prosrc FROM pg_proc WHERE proname='audit_trigger_func'` | Match. No drift.                                                                                                                                                           |
| `valid_changed_fields` exists on both `audit_logs` and `audit_logs_archive` with identical definitions | `pg_constraint` lookup                                          | Confirmed. `CHECK ((source='app') OR (action <> 'UPDATE') OR (changed_fields IS NOT NULL AND array_length(changed_fields, 1) > 0))`                                        |
| Triggers wired to `audit_trigger_func`                                                                 | `information_schema.triggers`                                   | 6 tables: `bookings`, `expenses`, `guests`, `maintenance_logs`, `payments`, `units` (3 events × 6 tables = 18 rows). **Not** `booking_units` — see Item 3 follow-up below. |
| `audit_logs_archive` triggers                                                                          | `information_schema.triggers`                                   | **Zero.** Archive is populated only by `archive_audit_logs()` via `INSERT … SELECT FROM audit_logs`.                                                                       |
| App-side `changed_fields` consumers                                                                    | grep on `src/`, `functions/`                                    | `AuditLogViewer`, `AuditDiffViewer`, `audit-hooks.ts`, `src/lib/supabase.ts` all already handle null/empty defensively.                                                    |

Two implications of the verification:

- **`audit_logs_archive` does not need a separate fix.** Since the archive has no triggers and ingests only what already passed `audit_logs`' constraint, an empty-changed-fields row can never reach it as long as the trigger never inserts one. The plan's conditional ("apply the same fix only if archive ingestion uses the same function") resolves to **no archive change**.
- **The cascade chain that bites `booking_units` batch inserts** goes `booking_units INSERT → trigger_update_booking_totals → UPDATE bookings → audit_bookings_trigger → constraint violation`. `booking_units` itself isn't audited, so the cascade terminates at `bookings`. The bug is still real; the explanation in `seed.ts:100-103` is accurate.

## Non-goals

- **Relaxing the `valid_changed_fields` CHECK constraint.** Option B in the source plan, explicitly not recommended there; reaffirmed here. The constraint protects the audit log from uninformative rows, and Option A satisfies it without weakening it.
- **Backfilling `audit_logs` history.** Pre-fix data already contains no empty-changed-fields rows (else the constraint would have rejected them). Nothing to backfill.
- **Auditing `booking_units` mutations.** Surfaced during verification but out of scope here. Filed as Item 3 in the existing follow-ups doc.
- **Adding a column-level `updated_at` mechanism to break ties.** That would change app behavior far beyond the audit subsystem and is unnecessary if we just skip the no-op rows.
- **Touching `trigger_update_guest_statistics` or `trigger_update_booking_totals`.** They aren't buggy — they're correctly updating with the same value Postgres handed them. The bug lives in the audit trigger's reaction.

## Decisions (from brainstorming)

1. **Option A: skip the audit row when there's nothing to log.** Patch `audit_trigger_func` to early-return when `TG_OP='UPDATE'` and `v_changed_fields` is null/empty. Preserves the constraint, eliminates the trap, matches what most audit systems do for no-op writes.
2. **Migration is a `CREATE OR REPLACE FUNCTION`.** No DDL on `audit_logs`, `audit_logs_archive`, or any other relation. Rollback is re-applying the prior `CREATE OR REPLACE` body from `20260221_fix_audit_trigger_column_name.sql`.
3. **Migration filename follows the established convention** for the prior two audit-trigger fixes: `YYYYMMDD_snake_case`. Concretely: `supabase/migrations/20260530_fix_audit_trigger_skip_noop_updates.sql`. (The repo mixes `YYYYMMDD` and `YYYYMMDDHHMMSS` filenames; matching the adjacent audit migrations is what matters for legibility.)
4. **Same feat commit ships the migration AND the seed.ts simplification.** The source plan's acceptance test _is_ the seed revert succeeding — splitting them would mean the litmus check ran in a separate commit, which defeats the point. The commit covers: new SQL file, edited `scripts/e2e/seed.ts`, new Vitest regression file.
5. **Add a Vitest regression test** (`src/__tests__/database/audit-trigger-noop.test.ts`) that performs a no-op UPDATE via the service-role client and asserts the operation succeeds with zero new audit rows. Cheap permanent guard against re-regression.
6. **Use `IS NULL OR array_length(...) IS NULL` for the guard.** Postgres returns NULL from `array_length` on both NULL arrays and empty arrays, so the two-clause check covers both. Equivalent and clearer than `coalesce(array_length(...), 0) = 0`.
7. **Audit coverage trade-off is acceptable.** A deliberate "touch" UPDATE (`UPDATE bookings SET total_amount = total_amount`) will no longer produce an audit row. Today that statement errors out, so behavior is strictly better. Called out below.

---

## Design

### 1. New migration — `20260530_fix_audit_trigger_skip_noop_updates.sql`

Full target body of the function. Only one structural change vs. the `20260221` version: a guarded `RETURN NEW` between the changed-fields computation and the `INSERT INTO audit_logs`. Everything else is identical, copied verbatim to keep `git diff` between the two migrations small.

```sql
-- ============================================
-- Migration: Skip no-op UPDATE audit rows
-- Description: audit_trigger_func() previously inserted an audit_logs row for
--              every UPDATE on every audited table, even when no column changed.
--              That violates valid_changed_fields (which requires non-empty
--              changed_fields for source='db', action='UPDATE'), which in turn
--              aborts the outer statement. The trap fires on cascading stats
--              triggers (trigger_update_guest_statistics,
--              trigger_update_booking_totals) when multiple rows are inserted
--              in one statement and the cascade writes identical values per
--              row (NOW() is the transaction start time, so it's constant
--              across cascades within the same transaction).
--
--              This patch short-circuits the trigger when the computed
--              changed-fields array is null/empty, so no audit row is written
--              and no constraint violation occurs. Real UPDATEs still produce
--              audit rows with non-empty changed_fields.
--
--              No schema changes. No data migration. No constraint change.
-- Date: 2026-05-30
-- ============================================

CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    v_old_data JSONB;
    v_new_data JSONB;
    v_changed_fields TEXT[];
    v_record_id TEXT;
    v_record_data JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_new_data := to_jsonb(NEW);
        v_record_data := v_new_data;
    ELSIF TG_OP = 'UPDATE' THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        v_record_data := v_new_data;
        -- Compute changed fields
        SELECT array_agg(key) INTO v_changed_fields
        FROM jsonb_each(v_new_data) AS n(key, value)
        WHERE v_old_data->key IS DISTINCT FROM n.value;

        -- Skip no-op UPDATEs: nothing to audit, and writing an empty
        -- changed_fields would violate valid_changed_fields anyway.
        IF v_changed_fields IS NULL OR array_length(v_changed_fields, 1) IS NULL THEN
            RETURN NEW;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        v_old_data := to_jsonb(OLD);
        v_record_data := v_old_data;
    END IF;

    -- Extract record ID generically: try <table>_id, then id, then log_id
    v_record_id := COALESCE(
        v_record_data ->> (TG_TABLE_NAME || '_id'),
        v_record_data ->> (regexp_replace(TG_TABLE_NAME, 's$', '') || '_id'),
        v_record_data ->> 'id',
        v_record_data ->> 'log_id'
    );

    INSERT INTO public.audit_logs (
        action,
        table_name,
        record_id,
        old_data,
        new_data,
        changed_fields,
        user_id,
        category,
        severity,
        source
    ) VALUES (
        TG_OP,
        TG_TABLE_NAME,
        v_record_id,
        v_old_data,
        v_new_data,
        v_changed_fields,
        auth.uid(),
        'DATA',
        'INFO',
        'db'
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
```

### 2. `scripts/e2e/seed.ts` — remove the workaround

Two loops collapse back into single batch inserts. The explanatory comments that flag the workaround go away too — they document a trap that no longer exists.

**Bookings (current lines 68–98) becomes:**

```ts
const bookingRows = E2E_BOOKINGS.map((b) => ({
  ...b,
  guest_id: b.booking_status === "Cancelled" ? null : E2E_GUEST.guest_id,
  guest_name: E2E_GUEST.guest_name,
  contact_number: E2E_GUEST.phone_number,
  email: E2E_GUEST.email,
  is_walk_in: false,
  is_multi_unit: false,
}));

const { data: insertedBookings, error: bookingError } = await supabase
  .from("bookings")
  .insert(bookingRows)
  .select("booking_id, booking_reference");

if (bookingError || !insertedBookings) {
  throw new Error(`bookings insert failed: ${bookingError?.message ?? "no rows returned"}`);
}
```

**Booking_units (current lines 100–118) becomes:**

```ts
const bookingUnitRows = insertedBookings.map((b) => {
  const fixture = E2E_BOOKINGS.find((f) => f.booking_reference === b.booking_reference)!;
  return {
    booking_id: b.booking_id,
    unit_id: E2E_UNIT.unit_id,
    subtotal: fixture.total_amount,
    unit_price: fixture.total_amount,
    assigned_guests: fixture.num_guests,
    check_in_date: fixture.check_in,
    check_out_date: fixture.check_out,
    status: fixture.booking_status,
  };
});

const { error: buError } = await supabase.from("booking_units").insert(bookingUnitRows);
if (buError) {
  throw new Error(`booking_units insert failed: ${buError.message}`);
}
```

Note: `insertedBookings` order is not contractually guaranteed by Supabase to match input order. The mapping deliberately looks up the fixture by `booking_reference` rather than by index, so ordering doesn't matter. (The previous one-at-a-time loop incidentally guaranteed order; the batch version no longer relies on it.)

### 3. New regression test — `src/__tests__/database/audit-trigger-noop.test.ts`

Lives next to `multi-unit-booking.test.ts`, uses the same Node-environment + service-role pattern, same `beforeEach` cleanup discipline. Sketch:

```ts
/// <reference types="vitest" />
// @vitest-environment node

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.TEST_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? "<local-fallback>";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const FIXTURE_GUEST_ID = "00000000-0000-0000-0000-000000aud17e57"; // arbitrary; reserved test UUID
const FIXTURE_NAME = "Audit Noop Fixture";

async function cleanup() {
  await supabase.from("guests").delete().eq("guest_id", FIXTURE_GUEST_ID);
}

describe("audit_trigger_func no-op UPDATE behavior", () => {
  beforeAll(cleanup);
  afterAll(cleanup);
  beforeEach(cleanup);

  it("does not raise and does not insert an audit row when nothing changed", async () => {
    // Insert a fresh guest — produces one audit row (INSERT).
    const { error: insertErr } = await supabase
      .from("guests")
      .insert({ guest_id: FIXTURE_GUEST_ID, guest_name: FIXTURE_NAME });
    expect(insertErr).toBeNull();

    const { count: baselineCount, error: baselineErr } = await supabase
      .from("audit_logs")
      .select("*", { count: "exact", head: true })
      .eq("table_name", "guests")
      .eq("record_id", FIXTURE_GUEST_ID);
    expect(baselineErr).toBeNull();
    expect(baselineCount).toBe(1); // the INSERT audit row

    // No-op UPDATE: write the same name back. Pre-fix this fails with
    // valid_changed_fields constraint violation; post-fix it succeeds silently.
    const { error: updateErr } = await supabase
      .from("guests")
      .update({ guest_name: FIXTURE_NAME })
      .eq("guest_id", FIXTURE_GUEST_ID);
    expect(updateErr).toBeNull();

    const { count: afterCount, error: afterErr } = await supabase
      .from("audit_logs")
      .select("*", { count: "exact", head: true })
      .eq("table_name", "guests")
      .eq("record_id", FIXTURE_GUEST_ID);
    expect(afterErr).toBeNull();
    expect(afterCount).toBe(1); // unchanged — no audit row for the no-op UPDATE
  });

  it("still inserts an audit row for a real UPDATE with the changed field listed", async () => {
    const { error: insertErr } = await supabase
      .from("guests")
      .insert({ guest_id: FIXTURE_GUEST_ID, guest_name: FIXTURE_NAME });
    expect(insertErr).toBeNull();

    const newName = `${FIXTURE_NAME} (renamed)`;
    const { error: updateErr } = await supabase
      .from("guests")
      .update({ guest_name: newName })
      .eq("guest_id", FIXTURE_GUEST_ID);
    expect(updateErr).toBeNull();

    const { data: rows, error: selErr } = await supabase
      .from("audit_logs")
      .select("action, changed_fields")
      .eq("table_name", "guests")
      .eq("record_id", FIXTURE_GUEST_ID)
      .order("created_at", { ascending: true });

    expect(selErr).toBeNull();
    expect(rows).toHaveLength(2);
    expect(rows![0].action).toBe("INSERT");
    expect(rows![1].action).toBe("UPDATE");
    expect(rows![1].changed_fields).toContain("guest_name");
  });
});
```

**Notes on the test:**

- Uses `guests` (not `bookings`) because guests has the fewest cascading triggers, so the audit row count is deterministic — exactly one for INSERT, exactly zero or one for the UPDATE depending on diff.
- The reserved UUID `00000000-0000-0000-0000-000000aud17e57` is arbitrary and chosen so that `clearExistingE2E` won't touch it (it doesn't match the `E2E_*` prefix conventions). `beforeEach` cleanup is enough.
- Will need adjustment if `guests` gains additional BEFORE triggers that mutate NEW (e.g. an `updated_at` trigger). Not the case today; if added later, the test will catch the regression at the assertion `afterCount).toBe(1)`.

## Audit coverage — what changes

| Scenario                                                   | Pre-fix                                       | Post-fix                           |
| ---------------------------------------------------------- | --------------------------------------------- | ---------------------------------- |
| Real UPDATE (any column actually changes)                  | Audit row with `changed_fields = [list]`      | **Same.** No regression.           |
| Cascade UPDATE writing identical values (no field differs) | Constraint violation → outer statement aborts | Silently skipped, **no audit row** |
| Deliberate "touch" UPDATE (`SET col = col`)                | Constraint violation → outer statement aborts | Silently skipped, **no audit row** |
| INSERT / DELETE                                            | Audit row with `action='INSERT'`/`'DELETE'`   | **Same.** No regression.           |

The only semantic loss is the third row — a hypothetical deliberate-touch UPDATE no longer produces an audit row. This is acceptable because (a) such statements don't carry information worth auditing and (b) they currently _error out_, so consumers can't be relying on them either way. Net audit fidelity is unchanged for real changes and strictly improved for everything else (the trap goes away).

## Edge cases

- **`array_length(NULL, 1)` and `array_length(ARRAY[]::text[], 1)`.** Both return NULL in Postgres. The guard `v_changed_fields IS NULL OR array_length(v_changed_fields, 1) IS NULL` covers both. Verified by Postgres docs and `SELECT array_length(NULL::text[], 1), array_length(ARRAY[]::text[], 1);` returning `(NULL, NULL)`.
- **Statement-level vs row-level.** All current audit triggers are AFTER ROW (verified via the per-event trigger inventory). The fix preserves that — `RETURN NEW` is the standard early-return for an AFTER trigger that doesn't want to insert.
- **`SECURITY DEFINER` and `SET search_path = ''`.** Preserved verbatim from the prior version. The early-return is inside the same function body, so no security-context implications.
- **Concurrent multi-row INSERT into `bookings` with mixed Cancelled/Confirmed rows.** Currently seed.ts hides this by NULLing `guest_id` on Cancelled rows. Post-fix that workaround stays (it's a separate semantic: Cancelled bookings have no guest), but the batch insert will now succeed even when stats cascade lands on a no-op row.
- **Future triggers that compute random/timestamp values per row.** If someone later adds a BEFORE trigger that sets `column = clock_timestamp()` (which **does** advance within a transaction, unlike `NOW()`), no-op cascades would suddenly start producing real diffs again and the constraint would re-engage normally. Fix is robust to that — it only skips when there is genuinely nothing to log.

## Testing plan

1. **Pre-fix repro (sanity check we're not solving a phantom problem):**
   ```sql
   BEGIN;
   INSERT INTO guests (guest_id, guest_name) VALUES (gen_random_uuid(), 'repro');
   UPDATE guests SET guest_name = guest_name WHERE guest_name = 'repro';
   -- Expect: ERROR 23514, valid_changed_fields constraint violation.
   ROLLBACK;
   ```
2. **Apply migration locally:** `supabase migration up` (or `supabase db reset` if running from scratch).
3. **Post-fix verification of the same query:** repeat the pre-fix repro. Expect: both statements succeed; `SELECT count(*) FROM audit_logs WHERE table_name='guests' AND action='UPDATE'` is unchanged.
4. **Real UPDATE still audited:** `UPDATE guests SET guest_name = 'new' WHERE guest_name = 'repro'`. Expect: exactly one new `audit_logs` row with `changed_fields = ARRAY['guest_name']`.
5. **Vitest regression suite:** `npx vitest run src/__tests__/database/audit-trigger-noop.test.ts`. Both tests green.
6. **Seed litmus (the source plan's acceptance test):** `npm run seed:e2e`. Expect: no constraint error, all fixture rows inserted in batch.
7. **Full verify:** `npm run verify`. Type-check + lint + unit tests clean.
8. **E2E:** `npm run test:e2e` (or wait for the pre-push hook). Expect: green; mobile booking card spec from the previous session still passes against the batch-seeded data.
9. **`audit_logs` integrity check after suite:**
   ```sql
   SELECT count(*) FROM audit_logs WHERE source='db' AND action='UPDATE' AND (changed_fields IS NULL OR array_length(changed_fields, 1) IS NULL);
   ```
   Must return `0`. Anything else means the constraint is misbehaving or the patch didn't apply.

## Risks

- **Migration is idempotent and side-effect-free at the schema level.** `CREATE OR REPLACE FUNCTION` is safe to re-run; no constraints altered, no data touched, no other functions or triggers changed.
- **Cascade triggers continue to fire and update the rows.** We only suppress the _audit log_ of no-op cascade UPDATEs, not the underlying writes (Postgres still applies the UPDATE; the row is just identical to its prior state). This matches existing behavior — those writes were already "successful" from Postgres' perspective; the audit trigger was the only thing that failed.
- **`audit_logs_archive` re-confirmation.** Verified to have zero triggers; only path in is `archive_audit_logs()` from `audit_logs`. Since the trigger never inserts an empty-changed-fields row post-fix, archive ingestion cannot fail the constraint. No change required.
- **Production deploy.** The migration ships through whatever `supabase db push` flow the team uses. No app-side coordination needed; existing app code already tolerates audit rows being absent for a given record (no app feature depends on "an audit row exists for every UPDATE").
- **Reverting the seed.ts workaround.** If the migration didn't apply (e.g. on a developer's stale DB), the batch insert would re-trigger the original constraint violation. Mitigation: anyone pulling this PR runs `supabase migration up` (or `supabase db reset`) before `npm run seed:e2e`. The README / dev docs don't need updating because this is standard practice; the CI seed runs against a fresh DB.

## Rollback

If the patched trigger misbehaves in any way (no observed mechanism, but in principle):

1. Create a counter-migration `supabase/migrations/<timestamp>_revert_audit_trigger_noop_skip.sql` containing the verbatim `CREATE OR REPLACE FUNCTION` body from `20260221_fix_audit_trigger_column_name.sql`.
2. Apply it; the trigger reverts to the prior behavior.
3. Re-introduce the seed.ts workaround (the original loops) in the same revert commit, otherwise `npm run seed:e2e` will start failing again.
4. The audit_logs table needs no cleanup — no schema changes occurred, and any audit rows the patched trigger _didn't_ insert can't be reconstructed (which is fine; they were no-ops).

There is no destructive operation to unwind. Worst case the database goes back to refusing no-op UPDATEs, which is the current state.

---

## Commit plan

Two commits, docs first per project convention:

1. `docs(plans): design for audit trigger no-op update skip`
2. `fix(db): skip no-op update audit rows; revert e2e seed workaround`

The feat is a `fix:` (matches the prior two audit-trigger commits, which both used `fix(db)`/`fix(audit)`-style prefixes for trigger patches that resolve constraint violations). The commit bundles three file changes — the new migration, the simplified `scripts/e2e/seed.ts`, and the new regression test — because the source plan's acceptance criterion (`seed.ts` revert succeeds) only validates if all three land together.

---

## Cross-doc updates landing alongside

- **`docs/plans/2026-05-28-mobile-card-session-followups.md`** gets a new **Item 3 — `booking_units` audit gap (low priority)** appended at the bottom, before the "Priority and ordering" section. Captures the verification finding that `booking_units` writes have no audit trail, framed as a separate, lower-priority follow-up so it doesn't get lost. This edit ships in the **docs commit** above (single commit, two files: the new design doc and the appended Item 3).
