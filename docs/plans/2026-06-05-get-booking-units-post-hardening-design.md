# `get_booking_units` — Post-Hardening Regression Fix

**Date:** 2026-06-05
**Surface:** `supabase/migrations/20260605120000_fix_get_booking_units_post_hardening.sql` (new)
**Goal:** Restore `get_booking_units` to its post-multi-unit shape. The function regressed during the 2026-02-09 security-hardening pass, which copy-pasted the pre-multi-unit body (with `b.unit_id` COALESCE fallbacks) into a `CREATE OR REPLACE` wrapped in `SET search_path = ''`, silently undoing the 2025-10-18 fix. Today the function fails with `42703 column b.unit_id does not exist` on every invocation. Two database/performance tests fail because of it.
**Source:** `docs/plans/2026-05-28-mobile-card-session-followups.md` (Item 4).

---

## Problem

Every call to `get_booking_units(UUID)` errors with:

```
code: 42703
message: column b.unit_id does not exist
hint:    Perhaps you meant to reference the column "bu.unit_id" or the column "u.unit_id"
```

Because `bookings.unit_id` was dropped in `20251017_unified_multi_unit.sql:399` and the live function body still references it. Two tests fail on every `npm run verify`:

- `src/__tests__/database/multi-unit-booking.test.ts:547` — `get_booking_units > should return units for multi-unit booking`
- `src/__tests__/performance/multi-unit-availability.test.ts:352` — `get_booking_units Performance > should fetch booking units in <50ms`

Both assert `expect(error).toBeNull()` immediately after the RPC call, so both fail at the first PostgreSQL error before reaching their row-shape or latency assertions.

## Migration timeline

The function is the protagonist of a small three-act regression story:

| When       | Migration                                       | What it did to the function                                                                                                                    |
| ---------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 2025-10-08 | `20251008152700_multi_unit_schema.sql:408`      | Born with `COALESCE(bu.unit_id, b.unit_id)` and `COALESCE(bu.unit_price, b.total_amount)` fallbacks — correct then; `b.unit_id` still existed. |
| 2025-10-17 | `20251017_unified_multi_unit.sql:399`           | `ALTER TABLE bookings DROP COLUMN unit_id;` — function now broken on every call.                                                               |
| 2025-10-18 | `20251018_fix_get_booking_units.sql`            | `DROP FUNCTION` + clean `CREATE OR REPLACE` with `bu.unit_id` only. **Correct fix.**                                                           |
| 2026-02-09 | `20260209120000_security_hardening.sql:289-315` | **Regressed.** Re-applied the pre-fix body (with COALESCE on the removed column) wrapped in `SET search_path = ''`.                            |

The 2026-02-09 pass appears to have taken the original 2025-10-08 body as its starting point for `SET search_path = ''` retrofitting, rather than the current live body. Mechanical cause; same kind of mistake as a stale fork.

## Live state verification (2026-06-05, local Supabase)

| Check                                    | Method                                                                                      | Result                                                                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Live `get_booking_units` body            | `SELECT prosrc FROM pg_proc WHERE proname='get_booking_units'`                              | Matches `20260209120000_security_hardening.sql:289-315` verbatim — `COALESCE(bu.unit_id, b.unit_id)` + LEFT JOIN on same.                       |
| `bookings.unit_id` column                | `\d public.bookings`                                                                        | **Absent.** Column was dropped 2025-10-17. Confirms the COALESCE fallback is unreachable.                                                       |
| App callers of `get_booking_units`       | `grep -rn "get_booking_units\|getBookingUnits\|get-booking-units" src/ functions/ scripts/` | Only test files. No app or serverless callers.                                                                                                  |
| Suspected app caller: `db.bookings.byId` | `src/lib/supabase.ts:123-138`                                                               | Uses Postgres embed `booking_units(*, unit:units(*))`, **not** the RPC. The plan's "silent runtime degradation" framing turns out not to apply. |
| Suspected app caller: `db.bookings.all`  | `src/lib/supabase.ts:115`                                                                   | Same embed pattern. Not the RPC.                                                                                                                |
| TypeScript binding                       | `src/types/database.types.ts:1378`                                                          | Generated RPC signature exists but no runtime caller imports it. Type definition only.                                                          |

**Implication of the caller audit:** Item 4 in the source plan flagged a "silent partial outage at runtime" for `get_booking_units` callers, modelled on Item 1's `payments.status` pattern. That hypothesis is wrong for this function — no app code path consumes the RPC. The actual blast radius is:

1. Two failing tests on every `npm run verify`.
2. Any future caller — including a developer adding a new feature that wants this RPC — would hit the 42703 immediately and (correctly) reach for a fix.

Demoting Item 4 from "silent runtime degradation" to "test-only failure + future-use safeguard" doesn't change the fix; it does change the priority story.

## Non-goals

- **Sweeping other RPCs for multi-unit transition damage.** The 2025-10-17 column drop may have left other broken references; a sweep is worthwhile but separate. Source plan explicitly carries this as out-of-scope.
- **Adding new regression tests.** The two failing tests already lock in the function's contract. Fixing the live function is sufficient.
- **Wiring app callers to use the RPC.** Whether `db.bookings.byId` should switch from its Postgres embed to the RPC is a performance question, not a correctness one, and is out of scope here.
- **Reverting the security-hardening migration.** `20260209120000` is broadly correct — it just carried this one regression. A targeted `CREATE OR REPLACE` is the right scalpel.
- **Restoring the `b.unit_id` fallback semantics.** The column is gone; the fallback is dead. There is no version of "make it work both ways" — there is only one way.

## Decisions (from brainstorming)

1. **New migration, not amendment.** `20260209120000_security_hardening.sql` has shipped to local DBs (and presumably remote). Editing it in place would silently desync developer DBs that already ran it. A new `CREATE OR REPLACE FUNCTION` migration is the only safe path.
2. **`CREATE OR REPLACE`, not `DROP + CREATE`.** The signature (parameter types and `RETURNS TABLE` shape) is unchanged. The 2025-10-18 fix used `DROP FUNCTION IF EXISTS` followed by `CREATE OR REPLACE` — that pairing is unnecessary when the signature is stable, and adds the (small) risk of a brief window where dependents would fail. Cleaner to just replace.
3. **Preserve security-hardening invariants verbatim.** The new body keeps `public.` prefixes on every table reference and `SET search_path = ''` on the function. These are codebase-wide invariants the 2026-02-09 pass established; dropping them in our fix would be its own regression and would invite the next hardening sweep to "re-fix" us and re-regress this function. We are the second iteration of exactly that mistake — explicit invariants prevent a third.
4. **`INNER JOIN` rather than `LEFT JOIN` for `units`.** `booking_units.unit_id` has a `NOT NULL REFERENCES units(unit_id)` FK (`20251008152700_multi_unit_schema.sql:45`), so every `booking_units` row has a matching `units` row. INNER JOIN matches the 2025-10-18 fix and expresses the actual data invariant. LEFT JOIN would be cosmetically defensive but couldn't produce additional rows.
5. **Drive the query from `booking_units`, not `bookings`.** The 2025-10-18 fix does `FROM booking_units bu INNER JOIN units u …`. There's no need to start from `bookings` because we're not selecting any `bookings` column — `WHERE bu.booking_id = p_booking_id` is sufficient and indexed (`idx_booking_units_composite` covers `(booking_id, unit_id)`). Matches the post-multi-unit world where `booking_units` is the source of truth for unit assignments.
6. **Filename uses full-timestamp convention.** Today's date as `20260605120000_fix_get_booking_units_post_hardening.sql`. The repo mixes `YYYYMMDD` and `YYYYMMDDHHMMSS`; the closest neighbor (`20260209120000_security_hardening.sql`) uses full timestamp, and `20260530...` for the audit fix used date-only. Either is technically valid; full timestamp here keeps ordering unambiguous and gives a clear lineage from the migration that introduced the regression.
7. **Single feat commit, no app changes.** No app code calls the RPC, so the fix is one file (the new migration). No companion edits to `seed.ts`, no helper changes, no test additions.

---

## Design

### 1. New migration — `20260605120000_fix_get_booking_units_post_hardening.sql`

Full target body. Idempotent (`CREATE OR REPLACE`), no DDL beyond the function body, no constraint changes, no data migration.

```sql
-- ============================================
-- Migration: Restore get_booking_units to post-multi-unit shape
-- Description: get_booking_units regressed during 20260209120000_security_hardening.sql.
--              That migration retrofitted SET search_path = '' onto every Postgres
--              function in the repo, and for this function it took the original
--              20251008152700_multi_unit_schema.sql body as its starting point
--              instead of the corrected 20251018_fix_get_booking_units.sql body.
--              The result re-introduced COALESCE(bu.unit_id, b.unit_id) and a JOIN
--              on the same expression — but bookings.unit_id was dropped in
--              20251017_unified_multi_unit.sql, so every call now errors with
--              42703 "column b.unit_id does not exist".
--
--              This patch restores the 2025-10-18 fix while preserving the
--              hardening conventions introduced 2026-02-09 (public. prefixes on
--              all tables, SET search_path = '' on the function).
--
--              No schema changes. No data migration. No constraint change.
-- Date: 2026-06-05
-- ============================================

CREATE OR REPLACE FUNCTION public.get_booking_units(p_booking_id UUID)
RETURNS TABLE (
    unit_id UUID,
    unit_name VARCHAR(100),
    unit_code VARCHAR(10),
    unit_type VARCHAR(50),
    unit_price DECIMAL(10,2),
    subtotal DECIMAL(10,2),
    assigned_guests INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        bu.unit_id,
        u.unit_name,
        u.unit_code,
        u.unit_type,
        bu.unit_price,
        bu.subtotal,
        bu.assigned_guests
    FROM public.booking_units bu
    INNER JOIN public.units u ON u.unit_id = bu.unit_id
    WHERE bu.booking_id = p_booking_id;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = '';

COMMENT ON FUNCTION public.get_booking_units IS
  'Get units for a booking (unified architecture - all bookings use booking_units junction table). Restored 2026-06-05 after the 2026-02-09 security-hardening pass re-introduced removed bookings.unit_id references.';
```

### 2. No app-side changes

Caller audit (see "Live state verification" above) confirms no `src/` or `functions/` code calls the RPC. The generated TypeScript binding in `src/types/database.types.ts:1378` matches the signature exactly — no change needed there either; the signature is preserved.

### 3. No new tests

The two failing tests already pin the function's contract:

- `src/__tests__/database/multi-unit-booking.test.ts:543-562` — full row-shape assertion against a 2-unit multi-unit booking.
- `src/__tests__/performance/multi-unit-availability.test.ts:345-355` — latency budget plus 3-unit row-count check.

After the migration, both must turn green with no test edits. If either test still fails, the fix is wrong (not the test) and needs revisiting before merge.

## Edge cases

- **Bookings with zero `booking_units` rows.** The function returns an empty result set, which is correct and matches the pre-regression behavior. Such a state shouldn't exist in practice (the multi-unit schema's `create_multi_unit_booking` always inserts at least one `booking_units` row), but is harmless if it does.
- **Bookings created before the multi-unit transition.** None exist in current schema — the 2025-10-17 unification migration backfilled every legacy single-unit booking into `booking_units` (see `20251017_unified_multi_unit.sql` for the migration logic). So the INNER JOIN cannot lose pre-multi-unit rows; there are none to lose.
- **Concurrent unit reassignment.** `STABLE` declaration is preserved, so a single statement sees a consistent snapshot. No change vs. prior behavior.
- **`SECURITY DEFINER`?** The 2026-02-09 hardening _did not_ mark `get_booking_units` as `SECURITY DEFINER` (read its body — only `SET search_path = '' STABLE`). The 2025-10-18 fix also didn't. We preserve that: the function runs with the caller's privileges, which is correct for a read-only RPC that wants RLS to apply. Worth checking the diff carefully in review.
- **Empty `units` join.** Cannot happen — `booking_units.unit_id` is `NOT NULL REFERENCES units(unit_id) ON DELETE RESTRICT` (`20251008152700:45`). So no `booking_units` row can outlive its `units` row, and INNER JOIN can never drop a row that LEFT JOIN would have kept. The choice is observationally equivalent; INNER expresses intent better.

## Testing plan

1. **Pre-fix sanity repro (confirm we're not solving a phantom):**

   ```sql
   SELECT * FROM public.get_booking_units(
     (SELECT booking_id FROM public.bookings LIMIT 1)
   );
   -- Expect: ERROR 42703, column b.unit_id does not exist.
   ```

2. **Apply migration locally:** `supabase migration up`. (No `db reset` needed; this is a function replacement only.)

3. **Post-fix verification of the same query:** repeat the call. Expect: zero rows for a single-unit booking that lacks a `booking_units` row, or one+ rows for any booking that does.

4. **Run the two pinned tests:**

   ```bash
   npx vitest run src/__tests__/database/multi-unit-booking.test.ts -t "get_booking_units"
   npx vitest run src/__tests__/performance/multi-unit-availability.test.ts -t "get_booking_units Performance"
   ```

   Both green. The performance test additionally enforces the <50ms budget — INNER JOIN starting from `booking_units` (indexed by `booking_id`) should outperform the original LEFT JOIN starting from `bookings`.

5. **Full verify:** `npm run verify`. Type-check + lint + the full Vitest suite should be clean (assuming no unrelated breakage exists).

6. **Caller-audit re-check:** `grep -rn "get_booking_units" src/ functions/ scripts/`. Confirms after-the-fact that no app code call was added during this work that would change the blast radius of a future regression.

## Risks

- **Migration is idempotent and side-effect-free at the schema level.** `CREATE OR REPLACE FUNCTION` is safe to re-run; no DDL on tables, indexes, constraints, or other functions; no data touched.
- **Production deploy.** Ships through whatever `supabase db push` flow the team uses. No app coordination needed — no app code calls the RPC, so there is no client/server version skew window to manage.
- **`SET search_path = ''` preservation.** The single largest risk is omitting this clause and silently weakening function security back to what it was before 2026-02-09. The migration includes it; reviewer should verify line 47 of the SQL has `STABLE SET search_path = ''`.
- **Future hardening passes.** If another sweep adds further security retrofits to this function (e.g. `SECURITY DEFINER`, role grants), it must again start from the current live body — not from an older migration. The migration's header comment documents the regression mechanism explicitly so the next maintainer has the context inline.
- **No impact on `audit_logs`.** The function is a `SELECT`-only RPC. It does not write, so it produces no audit rows directly and does not interact with the audit trigger Item 2 just fixed.

## Rollback

If the patched function misbehaves (no observed mechanism, but in principle):

1. Create a counter-migration `supabase/migrations/<timestamp>_revert_get_booking_units_post_hardening.sql` containing the verbatim `CREATE OR REPLACE FUNCTION` body from `20260209120000_security_hardening.sql:290-315`.
2. Apply it; the function reverts to the (broken) pre-fix state. The two failing tests resume failing.
3. No data cleanup. No schema unwind. No app coordination.

Worst case the rollback returns us to the current state, which is exactly the state every `npm run verify` is in today.

---

## Commit plan

Two commits, docs first per project convention:

1. `docs(plans): design for get_booking_units post-hardening fix`
2. `fix(db): restore get_booking_units after security-hardening regression`

Single-file feat commit (one new migration). No companion file edits — the fix is self-contained at the SQL layer.

## Regression-prevention note for future maintainers

The pattern that produced this bug: a cross-cutting refactor (security hardening) touched many functions, and for at least one function it diffed against the original definition rather than the latest live body. The 2025-10-18 fix was invisible to that diff.

Concrete prevention for future cross-cutting function refactors:

1. **Before retrofitting any function, read `pg_proc.prosrc` for the live body.** Not just the most recent named migration — the live body, in case there were unnamed `CREATE OR REPLACE` calls from hot-fixes or seed scripts.
2. **Grep the migrations directory for the function name.** Every hit is a candidate for "what does this function currently look like." Take the chronologically latest as the baseline.
3. **In the cross-cutting migration's commit message, list which functions were touched and which body each one was derived from.** Makes the next regression hunt orders of magnitude faster.

Not a hard rule, not part of the migration; just a paragraph the next person hitting this footgun can find via `git log --grep`.
