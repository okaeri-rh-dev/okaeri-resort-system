# Okaeri Resort: AI Guardrails Design

**Status:** Approved (recommended defaults accepted 2026-10-03), Phase 0 in progress
**Date:** 2026-10-03
**Scope:** Lint rules, type checks, invariant tests, CI jobs, and Claude Code hooks that turn this repo's rules into enforced checks instead of documented ones.
**Origin:** Adapted from the household-hub guardrails design (2026-09-30). The method carries over; most of its specific rules do not (see section 3).

All counts were measured on `main` at `528fb5d` on 2026-10-03.

## 1. Problem

The rules in CLAUDE.md and the 2026-07-21 audit are documented but mostly unenforced, and the bugs that shipped cluster in classes no current gate catches:

| Bug class                             | Shipped fixes                                                                                      | Why no gate caught it                                                                                                                      |
| ------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Wrong column names                    | `ab11f54`, `01e51de`, `093faf4`, `dcf40e8`, plus SQL-function bugs `8992eb7`, `6e3c602`, `5b6d092` | Stale hand-edited types; `functions/` not type-checked; typed client accepts unknown insert columns; raw PostgREST fetches; SQL not linted |
| Role/authorization drift              | `17a72d1`, `1878fe6`, `32fcd5a`, `5274645`                                                         | Roles typed as `string`; no test that service-role endpoints are gated                                                                     |
| Timezone (UTC+8 date shift)           | `5bbcc6b`, `fe5d132`, `3821346`                                                                    | 44 `toISOString().split/slice` sites; `toISODateString` helper used in 3 files                                                             |
| Edits landing in a dead shadow module | `996a60f` → `5480e84`                                                                              | `BookingForm.tsx` and `BookingForm/` both exist; nothing flags it                                                                          |
| Status-string drift                   | `8fbee85`                                                                                          | `booking_status` typed `string`; two conflicting TS unions                                                                                 |
| Silent mutation failures              | `ab11f54`                                                                                          | 9 `console.error`-only catches; no global mutation error handler                                                                           |
| Client/server pricing divergence      | `f368e12`, `a43491e`                                                                               | Three pricing implementations, no parity test                                                                                              |

## 2. Principle

Same as household-hub: enforce each rule at the cheapest layer that can hold it (type, lint, invariant test, agent hook, CLAUDE.md last). A custom rule is only written for a bug class that already shipped, and every lint message says why the rule exists and what to do instead.

## 3. What carries over from household-hub, and what does not

| household-hub section    | Here                  | Reason                                                                                                           |
| ------------------------ | --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Typed schema + DB checks | Adopt, adapted (4.1)  | Highest value; needs the `satisfies` insert rule because the typed client does not reject unknown insert columns |
| Zod at boundaries        | Partial               | 14/20 body-reading endpoints already use Zod; no shipped row-parsing bug                                         |
| Query-key factory        | Phase 3, warn         | 250 inline keys, duplicate roots, unused factory at `src/lib/query-keys.ts`; no shipped incident                 |
| Branded `Cents`          | Dropped               | Money is `numeric(10,2)` pesos; no parse bug shipped. Replaced by a pricing parity test                          |
| Outbox / `readDb` facade | Dropped               | No Dexie/offline write layer                                                                                     |
| Transfer-exclusion view  | Not assessed          | accounts/account_transfers exist; no incident found                                                              |
| Type-aware lint          | Staged (Phase 3)      | Lint time 4s → 21s here, so not in the per-edit hook                                                             |
| Stricter tsconfig        | Cheap flags only      | See 4.3                                                                                                          |
| Claude Code hooks        | 3 of 4                | SessionStart duplicates the user-level hook                                                                      |
| Knip                     | After dead-code purge | Shadow-pair test covers the shipped incident now                                                                 |
| Dependabot / audit       | Non-blocking first    | `--omit=dev` has 1 critical + 5 high today                                                                       |
| CLAUDE.md slimming       | Done in `528fb5d`     | Two rules still need rewording (4.8)                                                                             |

## 4. Design

### 4.1 Schema-checked database access

- `gen:types` script generating `src/types/database.types.ts` from the **local** migrations (`supabase gen types --lang=typescript --local`). Fix the `seasonal_rates` mismatch noted at `src/lib/supabase.ts:17-19`, then delete the `as any` bridges at `supabase.ts:63,66` (`payment_methods`, `expense_categories` are missing from the types today).
- Type every `createClient` call as `createClient<Database>`: 28 of 30 in `functions/` are untyped, including `functions/lib/supabase-admin.ts:27` (10 call sites), plus `src/lib/monitoring/{cleanup,bandwidth}-monitor.ts`.
- Convert the 4 raw PostgREST fetches (`admin/verify-payment.ts:209,271,313`, `audit/log-with-ip.ts:174`) to the typed client.
- Insert/update payloads: the typed client (supabase-js 2.58 / postgrest-js 1.21) accepts unknown columns on `.insert()` because the parameter is a generic `Row extends Insert`. Require `satisfies TablesInsert<'t'>` / `TablesUpdate<'t'>`:

```js
{
  selector: "CallExpression[callee.property.name=/^(insert|update|upsert)$/] > ObjectExpression.arguments",
  message: "Annotate the payload with `satisfies TablesInsert<'table'>`. The typed client does not reject unknown columns on insert (see ab11f54).",
}
```

Scoped to `src/{stores,hooks,lib}/**` and `functions/**`.

- `functions/tsconfig.json` (paths `@/*` → `src/*`, `@cloudflare/workers-types`); 53 errors on a scratch run. Resolve the duplicated `supabase-admin` (`src/lib` vs `functions/lib`) first. Add to `ci.yml` once green.
- `tsconfig.e2e.json` for `e2e/**` + `playwright.config.ts` (33 errors, 32 unused vars). `src/__tests__` (255 errors) deferred.
- Remove dead tsconfig excludes: they have no effect on imported files, and `src/routes/_authenticated/units/**` no longer exists.
- `infra-health.yml` e2e job (already runs `supabase start`): add `supabase db lint` and a drift check (`npm run gen:types && git diff --exit-code src/types/database.types.ts`).
- Weekly prod drift check (`supabase migration list --linked` or `db diff --linked`), because `093faf4` and migration `20251104184719` were prod-side drift that no code check can see.

### 4.2 Authorization

- `UserRole` derived from the database (`Tables<'app_roles'>['role']`); the middleware's attached `role` and `lookupUserRole` return it instead of `string`, so an incomplete `requireRole([...])` list or a typo is a compile-time concern.
- Lint: ban `user_metadata` / `app_metadata` / `raw_user_meta_data` `.role` reads:

```js
{
  selector: "MemberExpression[object.property.name=/^(user_metadata|app_metadata|raw_user_meta_data)$/][property.name='role']",
  message: "user_metadata is user-mutable. Authorize via lookupUserRole/requireRole (app_roles).",
}
```

One remaining read: `src/lib/supabase.ts:670` (audit row `user_role`).

- Invariant test: every `functions/api/**` file that references `SUPABASE_SERVICE_ROLE_KEY` is either under a public path (`isPublicPath`, `_middleware.ts:242`), under `admin/` or `cron/`, or calls `requireRole`/`lookupUserRole`.
- `no-restricted-imports`: `@/lib/supabase-admin` banned everywhere in `src/` except the type-only import in `file-validation.ts`.

### 4.3 Lint and tsconfig

Error now (cost ≤ 21 fixes each): `noImplicitOverride` (2), `noImplicitReturns` (8), `verbatimModuleSyntax` (21), `await-thenable` (0), `no-unnecessary-type-assertion` (73, autofix), `--max-warnings 0` after the 2 shadcn `react-refresh` warnings are handled.

Warn then error (Phase 3): `no-floating-promises` (161), `no-misused-promises` with `checksVoidReturn: { attributes: false }` (about 11), `no-non-null-assertion` outside tests (36), `@tanstack/eslint-plugin-query`.

Skip: `exactOptionalPropertyTypes` (193), `noPropertyAccessFromIndexSignature` (149), `noUncheckedIndexedAccess` (140; revisit as warn later).

Other rules:

- Timezone: `CallExpression[callee.property.name=/^(split|slice|substring)$/][callee.object.callee.property.name='toISOString']` → "Use toISODateString() from @/lib/timezone (Asia/Manila)". Warn, fix the 44 sites, then error.
- `no-restricted-imports` of the `supabase` client in `src/{components,routes}/**` (11 violations, warn first).
- Catch blocks that only `console.error` (after the global `MutationCache` below).
- One `formatCurrency` (8 definitions today): ban redeclaring it outside `src/components/tables/formatters.ts`.
- `eslint.config.js` ignores `.claude/worktrees/**` (an agent worktree currently makes `eslint .` and pre-push fail).

### 4.4 Invariant tests

- **Booking status:** narrow `booking_status` to `Pending | Confirmed | CheckedIn | CheckedOut | Cancelled` via a type override on the generated types; delete the conflicting lowercase union in `src/lib/type-guards.ts:325`; a test parses the CHECK constraint from the migrations and asserts it equals the union.
- **Audit trail:** a DB test queries `pg_trigger` and requires every `public` base table to have the audit trigger or be on an explicit allowlist. Today 9+ tables have neither, including `app_roles`.
- **Shadow modules:** a test fails when both `X.tsx` and `X/index.tsx` exist under `src/`.
- **Pricing parity:** the same inputs through `src/utils/pricing.ts` and `functions/lib/pricing.ts` produce equal totals.
- **Turnstile:** `verifyTurnstile(token, "", { environment: "production" })` returns `false`.

### 4.5 Mutation errors

A global `new MutationCache({ onError })` in the query client that shows a toast, so a failed mutation is never silent. Then fix the 9 `console.error`-only catches.

### 4.6 Claude Code hooks

In the committed `.claude/settings.json` (which holds `statusLine`). Scripts read stdin with `node -e`.

- **PreToolUse Bash guard** (`scripts/agent-bash-guard.sh`), exit 2 with a reason on: `supabase db push`, `supabase migration repair`, `supabase link`, `supabase secrets set`, `supabase db reset` with `--linked`/`--db-url`, `wrangler pages deploy`, `wrangler pages secret`, `wrangler secret`, `npm run deploy*`, `git push` with `--force`/`-f`/`--force-with-lease`/`--no-verify`, and `git push` that is neither backgrounded nor given `timeout >= 600000`. This matters because `settings.local.json` allows `Bash(supabase:*)` and `Bash(npx wrangler:*)` unconditionally and the CLI is linked to prod.
- **PostToolUse Edit|Write** (`scripts/agent-lint-file.sh`): `npx eslint --cache` on the edited `.ts/.tsx/.js` file (about 0.8s), skips `*.phase3-4.*`, exit 2 on errors only. Not type-aware.
- **Stop** (`scripts/agent-stop-check.sh`): household-hub's script with eslint on files changed vs merge-base plus `tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/tsc.tsbuildinfo` (about 1.8s warm vs 9s cold), and the diff-hash loop guard. Never `eslint .`. Does not cover `functions/` until 4.1 lands; extend it then.
- **SessionStart: not added.** `~/.claude/settings.json` already injects git log/status and the newest `docs/plans` files on resume/compact.

### 4.7 CI and dependencies

- Pre-commit fails on any tsc error (today: fails only above 100) and drops `|| true` from eslint. Both counts are already 0.
- Split `ci.yml` into lint / type-check / unit jobs; deploy `needs` all of them.
- `npm audit --audit-level=high --omit=dev` as a job, non-blocking until the 1 critical + 5 high are fixed, then blocking. Full audit stays non-blocking.
- `.github/dependabot.yml`: npm weekly, grouped minor/patch.
- Pin Node: `.nvmrc` 22 + `engines`; align `deploy-cloudflare.yml` and `security-scan.yml` (currently Node 20) with `ci.yml` (22).
- Knip after the dead-code deletion pass (audit Decision 4).

### 4.8 CLAUDE.md

Once 4.2 and 4.4 are enforced, rewrite two rules that do not match the code:

- "Log every data mutation via `logAuditEvent`": no store calls it; DB triggers do the work. Replace with "every table has the audit trigger or is on the allowlist in the trigger invariant test".
- "Sanitize all user input with DOMPurify": React escapes output. Replace with: no `dangerouslySetInnerHTML` (`react/no-danger`) and escape interpolated values in HTML email templates (`src/lib/email.ts:74,162`).

## 5. Rollout

### Phase 0: Fix live bugs

- [x] (`1378e07`) `functions/lib/rbac.ts:17` `UserRole` lacked `owner`, so owners would get 403 on refund/record/add-unit/remove-unit. Correction 2026-10-04: these endpoints have no UI caller today (only the unused hooks in `useMultiUnitBookingQueries.ts`), so this was latent, not a live 403
- [x] (`bf7c35f`) `functions/api/bookings/multi-unit.ts` uses the service-role key with no role check (any authenticated user, including role `user`, can create bookings): require staff+
- [x] (`0ac2a91`) `functions/api/admin/available-units.ts:252-257` maps nonexistent columns (`unit_number`, `max_capacity`, `base_price`, `floor_level`, `view_type`); `.order("unit_number")` made every call return 500
- [x] (`8192637`) `functions/api/admin/assign-units.ts:102` references undefined `errorHint` (ReferenceError on the error path)
- [x] (`2ae1aa9`) Turnstile: wrong dynamic import path at `functions/api/public/v1/availability.ts:234` (requests with a token failed to resolve the module)
- [x] (`02523df`) Turnstile fail-open on missing secret (`src/lib/turnstile.ts:44`, audit P1 #10): now rejects outside development. Verified first on 2026-10-04: `TURNSTILE_SECRET_KEY` present in Cloudflare Pages production secrets and `ENVIRONMENT = "production"` in `wrangler.toml`
- [x] (`4aa5d20`) Expense dates saved a day early (reproduced: picking Oct 4 in Asia/Manila stored `2026-10-03`): create, edit, filters, stats, CSV name. Lint rule scoped to expense files
- [x] (`d113e0b`) `eslint.config.js` ignores `.claude/worktrees/**`
- [x] (`ba8628b`) `available-units` overlap check filtered `booking_units.status = 'confirmed'` only; now `('confirmed', 'checked_in')` like `assign_units_to_booking`
- [x] Checked 2026-10-04: not a live bug. `/api/bookings/multi-unit/${bookingId}` has no route, but its only callers (`useUpdateMultiUnitBooking`, `useDeleteMultiUnitBooking`) are unused, as are `useMultiUnitBookings` (GET has no handler), `useAddUnitToBooking`, `useRemoveUnitFromBooking`, `useRecordMultiUnitPayment`, `useRefundMultiUnitPayment`. Only `useCreateMultiUnitBooking` is used. Add these to the dead-code cleanup (audit Decision 4)

### Phase 1: Cheap wins

- [x] (`ea20102`) Pre-commit strict (4.7): tsc (incremental) and eslint errors block. Before: tolerated up to 100 tsc errors and ignored eslint's exit code; verified it let a TS2322 error through, then blocked it after the change
- [x] (`4690b22`) `noImplicitOverride` and `verbatimModuleSyntax` on (2 + 21 fixes). `noImplicitReturns` dropped (see Decisions). `await-thenable` / `no-unnecessary-type-assertion` moved to Phase 3 (they need type-aware linting)
- [x] (`8372755`, `7b28dc2`) Metadata-role lint (error, repo-wide incl. `functions/`) after fixing the last read in `db.auditLogs.create`; `supabase-admin` runtime-import ban in `src/` (type imports allowed); direct `supabase` client import in components/routes as warn (11)
- [ ] Timezone lint repo-wide: moved to Phase 3 (see Decisions). Expense files already at error since `4aa5d20`
- [x] (`74f1891`) Silent mutation failures: 9 table/handler catches now toast; lint rule for components/routes rejects a catch whose only statement is `console.error`. Global `MutationCache` dropped (see Decisions)
- [x] (`6decd93`) Bash guard, per-file lint, and Stop hooks in `.claude/settings.json`; guard covered by `src/__tests__/architecture/bash-guard.test.ts` (17 cases); Stop loop guard verified (blocks, lets the same tree through, re-blocks on a changed tree)
- [x] (`b4e5d21`) Shadow-module test with the two known pairs allowlisted until the dead-code cleanup
- [x] (`3bf66ba`) Dependabot (npm weekly grouped, actions monthly), non-blocking `npm audit --omit=dev --audit-level=high` job in `ci.yml`, `.nvmrc` 22 read by every workflow, `engines` = Vite's range

- [x] (`bb6e672`, `476ffb7`) Production audit fixed with `npm audit fix --omit=dev` (8 advisories, all minor/patch bumps) and the audit job made blocking. Note: `--omit=dev` also prunes dev packages from `node_modules`; run `npm ci` afterwards

### Phase 2: Contracts

- [x] (`c129d86`) `gen:types` (`scripts/gen-types.sh`, uses `--db-url`) regenerated from local migrations; `payment_methods` / `expense_categories` now typed, `as any` bridges removed; tsc stayed at 0. No `seasonal_rates` mismatch appeared. (Correction 2026-10-04: overloaded functions ARE generated, as union types; an earlier grep for `name: {` missed that format)
- [x] (`ead7847`, `2ac812b`) `functions/tsconfig.json`; 45 errors fixed; `npm run type-check` (CI), pre-commit and the Stop hook now check `functions/`. Verified a probe error in `functions/` fails `type-check` (exit 2)
- [x] (`32dec40`..`20f62ba`) Type all `createClient` calls; convert raw PostgREST fetches (4.1). 26 `createClient<Database>` in `functions/`; the only untyped one left is the payment-proof cron RPC client (deferred, see Decisions & Deferrals). Also typed the `SupabaseClient` params in `functions/lib/{pricing,audit-logger-workers}.ts` (0 new errors). The "10 call sites" for `functions/lib/supabase-admin.ts` was wrong: its only caller is `pricing/update-config.ts` (`guest-booking/status.ts` imports `@/lib/supabase-admin`, i.e. `src/lib`, already typed). 9 tsc errors, each fixed, none cast away:
  - `discount-rules.ts`: `as DiscountRule[]` hid that `conditions` is unchecked jsonb; a non-array value made `.some()` throw (500). Now guarded (`41a73b7`)
  - `guest-booking/multi-unit.ts`: `create_guest_booking` returns jsonb; the called (turnstile) variant never returns `is_duplicate`, so that branch was dead and is removed; result now checked by a runtime guard (`41a73b7`). Function is absent on prod (online booking deferred)
  - `pending-bookings.ts`: nullable `created_at` → `new Date(null)` = epoch, max days-pending points; null now scores as new, test added (red 34 → green 19) (`a084557`)
  - `bookings/multi-unit.ts`: the post-create booking fetch ignored its error and could return null into `logBookingCreated`; now throws. Optional RPC args (`p_guest_id`, `p_exclude_booking_id`, SQL `DEFAULT NULL`) pass `undefined` instead of `null` (`4446c61`)
  - `cleanup-idempotency.ts`: null `expires_at` counted as expired (epoch); now skipped (`4446c61`). Table is absent on prod (drift baseline)
  - `verify-payment.ts` (`b09e1ab`): 3 raw fetches → typed client (also removes the unescaped `booking_id` interpolated into the PostgREST filter). The audit POST used `entity_type`/`entity_id` (PGRST204) and a non-CRUD `action`, so **no payment audit row was ever written**; now `satisfies TablesInsert<'audit_logs'>` like `logAuditEventWorker`. **Open:** it writes `payment_status` `'Verified'`/`'Rejected'`, which `bookings_payment_status_check` rejects (local probe: 23514; prod CHECK read 2026-10-07 is `Pending/Partial/Completed/Refunded`, all 178 prod bookings `Pending`), so every verify/reject from `PaymentProofViewer` returns 500. Needs a status-mapping decision (Decisions & Deferrals)
  - `log-with-ip.ts` (`20f62ba`): raw fetch → typed client as the caller. `return=representation` needs SELECT on `audit_logs`, which staff and managers lack, so their login/password-reset audit events failed (local probe: old fetch 403/42501 for both roles, insert without select ok). Response drops `audit_id` (only caller just logs it)
  - `npm run verify` exit 0: 103 test files passed, 1525 tests passed
- [x] (`5538d2b`) `satisfies TablesInsert` lint: 46 payloads annotated by codemod; rule (first argument of `.from("t").insert/upsert/update`) is `error` outside tests. Annotating surfaced 4 more wrong-table/column writes (see below)
- [x] `UserRole` from DB type; service-role gating test (4.2). `app_roles.role` is a CHECK-constrained varchar (generated as `string`), so it got the `booking_status` treatment: `APP_ROLE_NAMES` in `src/types/app-role.ts`, narrowed in `database.types.ts` (now a per-relation `NarrowedColumns` map), and `src/__tests__/architecture/app-role-parity.test.ts` compares it with the latest `app_roles_role_check` (`20251006100404`) and with the `AuditRole` enum (CHECK parser shared in `check-constraint.ts`; adding `"guest"` fails it). `UserRole` in `functions/lib/rbac.ts` is `AppRoleName | "user"`, where `"user"` means no active `app_roles` row (fail-closed fallback). `lookupUserRole`, the attached `request.user.role`, `AdminContext.app_role` and the inline role lists in `verify-payment` / `pending-users` / `update-config` now use it; a probe confirmed `requireRole(req, ["manger"])`, `role === "owners"` and an `app_roles` insert of `"superadmin"` fail tsc. `pricing/update-config` replaced its own `app_roles` query with `lookupUserRole`. `src/__tests__/architecture/service-role-gating.test.ts` checks every `functions/api` file using `SUPABASE_SERVICE_ROLE_KEY` / `createSupabaseAdmin` is under `admin/` or `cron/`, matches the exported `isPublicPath`, or calls `requireRole`/`lookupUserRole`/`withRBAC` (checked: an ungated probe endpoint fails it). The `user_metadata .role` lint and the `supabase-admin` import ban were already in place from Phase 1
- [x] `booking_status` narrowing + CHECK parity test (4.4). `gen:types` now writes `database.generated.ts`; `database.types.ts` is a hand-written layer that narrows `booking_status` on `bookings`, `booking_unit_availability` and the `public_unit_availability` view (not `bookings_conflict_backup`), so all 39 existing imports got the narrow type. A lint rule blocks importing the generated file directly. `BOOKING_STATUSES` lives in `src/types/booking-status.ts`; `src/__tests__/architecture/booking-status-parity.test.ts` compares it with the latest `bookings_booking_status_check` in the migrations (checked: adding `'Hold'` to the CHECK fails the test). A probe confirmed that `=== "Completed"`, `.eq("booking_status", "pending")`, `.in(..., ["Hold"])` and `update({ booking_status: "expired" })` all fail tsc. Drift fixed: `Booking.booking_status` is now `BookingStatus | null`; the payment-proof health check compared to `"Completed"` (now `"CheckedOut"`, client typed); the uncalled `src/lib/monitoring/cleanup-monitor.ts` (filtered `"pending"`, wrote `"expired"`, selected a nonexistent `bookings.id`) deleted. The lowercase union in `src/lib/type-guards.ts` had no importers and was deleted
- [x] (`79a7e09`) Audit-trigger coverage test (4.4). Local DB had 6 of 23 public tables audited. Migration `20261005000000` attaches `audit_trigger_func` to the 10 app-written tables (`app_roles`, `accounts`, `account_transfers`, `availability_blackouts`, `booking_units`, `discount_rules`, `expense_categories`, `payment_methods`, `pricing_config`, `seasonal_rates`), skipping any table absent in prod, and lets a trigger argument name the record-id column (`app_roles.user_id`, `account_transfers.transfer_id`, `availability_blackouts.blackout_id`, which the generic lookup returned as NULL). `src/__tests__/database/audit-trigger-coverage.test.ts` requires every public base table to be audited or in `UNAUDITED_TABLES` (7 entries with reasons), fails on stale entries, checks every trigger resolves `record_id` to a real column, and checks an `app_roles` grant writes a row keyed by `user_id` (what `useRoleHistory` queries; it never had data). Probes: a new table fails the first test; a trigger on a table with an unresolvable PK fails the third. `test:db` 57 passed / 1 skipped; `db lint` still flags only the 7 known functions
- [x] Apply `20261005000000` to prod (`supabase db push`, user, 2026-10-06). Verified: prod has 15 `audit_trigger_func` triggers (6 old + 9 new; `seasonal_rates` skipped, table absent). Then confirm with `select tgrelid::regclass from pg_trigger where tgfoid = 'public.audit_trigger_func'::regproc` and check the NOTICE output for skipped tables
- [ ] `/api/auth/sign-up` is missing from `isPublicPath`, so the middleware should reject the anonymous sign-up form (`SignUpForm.tsx:48`, no `Authorization` header) with 401. Found by the gating test; code reading only, not probed on prod. Allowlisted in `KNOWN_UNGATED` for now (see Decisions & Deferrals)
- [x] (`52cb284`) Pricing parity test (4.4). The spec's pair (`src/utils/pricing.ts` vs `functions/lib/pricing.ts`) was not the risk: the live paths are the staff form (`useMultiUnitBookingStore.calculateUnitPricing`), booking creation (the stored price) and `functions/lib/pricing.ts` (`/api/pricing/calculate`, guest preview, guest booking). They disagreed on weekend nights: form and quote used Sat+Sun, creation used Fri+Sat, so a Fri→Sun stay showed ₱6,500 in the form and stored ₱7,000 (the form also sends its own total as the payment amount). Now one `isWeekendNight` (Fri+Sat, `src/lib/pricing/weekend-night.ts`) on every path incl. `quote.ts`, `src/utils/pricing.ts`, `pricing-with-db.ts`; creation's `calculateUnitPricing` moved to `functions/lib/unit-pricing.ts` so it can be tested; unused `useUnitStore.calculateRate` (Fri+Sat+Sun) deleted; two `pricing-with-db` tests that pinned Sat+Sun updated. `src/__tests__/architecture/pricing-parity.test.ts` runs 5 stays x 2 guest counts through all three paths against a hand-computed total (probe: the store on the old Sat+Sun rule fails 4 cases)
- [x] Seasonal rates apply only in `functions/lib/pricing.ts`, not in the form or the stored price. Prod check (2026-10-06): **`seasonal_rates` does not exist on prod** (`42P01`), although migration `20251106000000` that creates it is recorded as applied (same drift class as `20251104184719`). `getSeasonalRateForDate` swallows the error and returns null, so all three paths agree on prod. The admin seasonal-rates UI (`src/routes/admin/units/pricing.tsx`, `useSeasonalRates`) cannot work on prod (see Decisions & Deferrals)
- [x] (`7a349b2`) Dead pricing code deleted: `/api/pricing/quote` (+ its `isPublicPath` entry and test), `useMultiUnitPricingQuote`, `useSyncUnitPricing`, `src/utils/pricing-with-db.ts` (+ test, + a stale mock of it in `calculate.test.ts`). `npm run verify` exit 0, 1524 tests
- [x] Prod check of the form/creation weekend mismatch (2026-10-06, read-only): no impact. Prod `pricing_config` has `base_rate` = `weekend_rate` = 10000 and all 3 `units` rows have 9000 / 9000, so Fri-vs-Sun never changed a price; the `payments` table has 0 rows (178 bookings), so there is no recorded payment to compare against
- [x] (`94e3c6b`) Type drift + `supabase db lint` steps in `infra-health` (both non-blocking for now)
- [x] Weekly prod drift check (4.1). Built 2026-10-06: `scripts/drift/catalog-fingerprint.sql` prints one line per public-schema relation, column, constraint, index, trigger, policy, function (md5 of body), enum and `schema_migrations` version; `scripts/drift-check.sh` (`npm run drift:prod`) diffs local vs prod against `scripts/drift/baseline.txt` and fails on new drift or stale entries (probed: clean → exit 0; fake baseline line → exit 1 stale; removed line → exit 1 new). CHECK constraints are normalized (prod deparses `IN (...)` differently: 9 identical constraints differed). Prod is read as role `drift_reader` (migration `20261006000000`: NOLOGIN, `default_transaction_read_only`, usage on `extensions` so defaults deparse the same; verified locally: same 753 lines as `postgres`, `CREATE TABLE` refused) via `SUPABASE_DRIFT_DB_URL`, or `supabase db query --linked` locally. `prod-drift` job in `infra-health.yml` (schedule + manual only). Remaining:
  - [x] User: `supabase db push` (`20261005000000` + `20261006000000`), 2026-10-06; `drift_reader` exists on prod, `rolcanlogin=false`, `default_transaction_read_only=on`
  - [x] (2026-10-07) User: on prod `alter role drift_reader login password '<generated>'`; add GitHub secret `SUPABASE_DRIFT_DB_URL` = `postgresql://drift_reader.gxgpdlvathotgqtszabo:<pw>@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres`
  - [x] `baseline.txt` written after the push: 108 lines in 5 commented groups; `npm run drift:prod` exit 0. The push removed the audit-trigger and migration lines. Prod is also missing objects from `20251018004757` (`has_any_role`, `is_staff`), `20251028154441`, `20251107000000` and `20251108000000`, all recorded as applied
  - [x] `prod-drift` run 37578059278 (`workflow_dispatch`, `64e8b2f`): success, log shows "No new drift (108 known lines)", so the pooler URL and role password work. `health` and `e2e` also passed
- First drift run (2026-10-06, before the push), beyond the known `20251104184719` and `seasonal_rates` objects: 5 functions have `SET search_path TO ''` on prod only (`get_account_balance`, `archive_audit_logs(timestamptz,boolean)`, `archive_logs_older_than_months`, `monthly_archive_until`, `restore_logs_from_archive(timestamptz,timestamptz)`; hardening done outside migrations); `archive_audit_logs(timestamptz)` and `restore_logs_from_archive(date)` have different bodies on prod; `audit_logs_archive_insert_policy` is `public` locally vs `authenticated` on prod; `bookings.discount_percent` / `downpayment_required` are missing on prod (only the deferred guest-booking path writes them). Stray `functions/api/guest-booking/multi-unit.ts.bak` found
- [x] (`3e2d9a6`) `tsconfig.e2e.json` (e2e/\*\* + `playwright.config.ts`) in `type-check` (CI, verify), pre-commit and the Stop hook. Fixed its 33 errors: 32 unused imports/locals and `PaymentVerificationPage.downloadProof` typed `void` while returning the path. Probe file in `e2e/` fails `type-check` (exit 2); `playwright test --list` = 1464 tests before and after. Stray untracked `multi-unit.ts.bak` deleted. Several specs assert nothing (owner nav, export button, `expect(true)`), see Decisions & Deferrals
- [x] (`ddc9d05`) Prod-only `search_path` hardening (drift check, 2026-10-07). The 5 functions it touched outside migrations are **broken on prod**: bodies use unqualified names, so `get_account_balance` fails with `function get_all_account_balances(...) does not exist` (read-only probe). No UI caller (`db.accounts.getBalance` and `useArchiveAuditLogs` are unused; the account page uses `get_all_account_balances`, which works on prod: 6 rows). Migration `20261007000000` recreates the 5 with qualified names + `SET search_path TO ''`; verified locally: all 5 run under empty search_path, a real archive/restore moved 3 rows each way (rolled back), `test:db` 57 passed / 1 skipped
  - [x] User pushed 2026-10-07. Prod `get_account_balance` now returns 0 (was "does not exist"); drift check reported exactly the 10 stale lines, removed (baseline 98 lines)
- [x] (`f452b9c`) Split CI jobs (4.7). `ci.yml` now has parallel `lint`, `type-check`, `unit` and `audit` jobs; `deploy-cloudflare.yml` calls it as one reusable `quality` job, so `needs: quality` waits for all four. Deploy run 37596023305: lint, type-check, unit, audit and deploy all success; prod runs `f452b9c`
- [x] (`ac54d63`) Deploys were blocked since `64e8b2f` (2026-10-07): the production `npm audit` job failed on new advisories in `seroval` (via TanStack Router) and `source-map-js`, so the deploy job was skipped (runs 37578050963, 37594522279). Missed at the time because only `infra-health` was checked after the push. `npm audit fix --omit=dev` changed 4 lockfile versions only; build, `verify` (1524 tests) and the prod audit exit 0. Note: `--omit=dev` also prunes devDependencies from `node_modules`; run `npm ci` after it

Bugs found and fixed while doing Phase 2 (2026-10-04):

- [x] (`a5c6cc4`) Guests got 401 on `/api/guest-booking/status` (missing from `isPublicPath`), so `/booking/check-status` never worked. Made public after user approval; it has KV rate limiting and CAPTCHA after 20 attempts
- [x] (`1deab24`) `src/lib/supabase-admin.ts` read `env.VITE_SUPABASE_URL`, which Pages Functions do not receive; now prefers `SUPABASE_URL`. Verified on prod: the status lookup returns 404 for an unknown reference instead of failing
- [x] (`80657c9`) Status lookup embedded `unit:units(...)`, but `bookings.unit_id` was dropped in `20251017000000`; PostgREST returned PGRST200 so every real booking was "not found". Covered by `src/__tests__/database/guest-booking-status.test.ts` against local Supabase
- [x] (`1aba6c8`) `/api/pricing/calculate` priced `unit_id` / `custom_pricing` requests with an undefined `guest_count`; now a validation error
- [x] (`8b02763`) Dead code with the same broken `unit:units(...)` embed deleted: `QueryProvider._prefetchQueries.bookings`, the guest-detail loader's unused `["bookings", "guest", id]` prefetch, `src/stores/index.ts:252`, `src/hooks/useSearch.ts`. Delete in the dead-code cleanup
- [x] (`7fc6ad3`) Legacy `GuestBookingForm` and `/api/guest-booking` + `/confirm` deleted
- [x] (`55a06f2`) `createTestBooking` in `src/__tests__/setup/test-db.ts` defaults violated current constraints (`payment_status: "Paid"`, `unit_price` 4000 vs `subtotal` 5000); fix the defaults

Dead-code cleanup (audit Decision 4), 2026-10-04: `9080d01` search stack + phase3-4 files (6,787 lines), `1cf2db3` shadowed `BookingForm/` and `ExpenseEdit/`, `68ccc2a` `src/patterns`, `src/workflow`, `src/scripts`, `src/utils/validation.ts` (`src/pages` kept: the admin dashboard lazy-loads it). `database/` archive deferred: `scripts/run-migrations.sh`, `quick-migrate.sh` and `verify-deployment.sh` still read `database/migrations/`.

SQL function errors from `supabase db lint` (local migrations, 2026-10-04). Prod may differ (schema drift); confirm before fixing:

- [ ] `assign_units_to_booking` selects `bookings.check_in_date` / `check_out_date` (columns are `check_in` / `check_out`). Called by `/api/admin/assign-units`. **Prod (2026-10-04 probe): the function does not exist at all** (PGRST202; known drift from migration `20251104184719`), so admin unit assignment cannot work in production. Fix = new forward migration creating a corrected function, applied with approval
- [x] `revoke_audit_role`: dropped by the same migration `20261004000000`, applied to prod 2026-10-04
- [x] (`b569ea9`) `check_unit_availability` 3-arg overload: dropped by migration `20261004000000` (3-arg calls now resolve to the 4-arg version; DB test added). applied to prod 2026-10-04
- [ ] `create_guest_booking` uses `bookings.check_in_date` and `guests.nationality`
- [ ] `cleanup_expired_payment_proofs` uses `check_out_date` (known, audit P1 #4). It also never handles `Cancelled`, and its `TABLE(file_path)` return does not match what `functions/scheduled/cleanup-payment-proofs.ts` parses (`deleted_count`, `storage_freed_bytes`, `file_paths`); typing that RPC client shows the mismatch (TS2352). Fix the SQL and the cron together
- [ ] `attach_audit_trigger` / `detach_audit_trigger`: format-string syntax error
- [ ] `archive_logs_older_than_months` / `monthly_archive_until`: `archive_audit_logs(timestamptz)` is ambiguous between two overloads

**Online booking never worked in production (2026-10-04, read-only checks):** prod has 0 bookings with `is_guest_booking = true`; all bookings are staff-created. `/api/guest-booking/multi-unit` (the `/booking` page) calls `create_guest_booking`, which is absent in prod along with `guest_booking_unit_requests`, `calculate_booking_pricing` and `assign_units_to_booking` (drift from `20251104184719`). Restoring unit assignment alone has no data to act on. **Decided 2026-10-04: leave `/booking` and the status page as they are** (not hidden, so the feature is not forgotten); polishing online booking is a future project. See Decisions & Deferrals.

Found by the `satisfies` annotations (2026-10-04):

- [x] (`33314a3`) `logAuditEventWorker` wrote `entity_type`/`entity_id`/`changes` (absent) and event names as `action` (CHECK allows INSERT/UPDATE/DELETE): no server-side audit row was ever written. `update-config` had the same broken insert, so pricing changes were never audited. Now maps to `event_type`/`table_name`/`record_id`/`old_data`/`new_data`; DB test added; prod `audit_logs` has all 13 written columns
- [x] (`ec5dce6`) `units/add`, `units/remove`, `payments/record`, `payments/refund` wrote `payment_adjustments` (no such table) and `payments.refunded_amount` (no such column) and had no UI caller: deleted with 7 unused hooks. The owner-role fix for them (`1378e07`) is moot; the RBAC tier tests remain
- [x] (`ec5dce6`) uncalled `bandwidth-monitor.ts` updated `bookings.metadata` by `id`: deleted

### Phase 3: Depth

- [ ] Type-aware rules as warn, then error (4.3)
- [ ] Timezone rule to error after the 44 sites are fixed
- [ ] Query-key plugin + migrate duplicate roots, one entity per commit
- [ ] Knip after dead-code purge; audit job blocking after fix pass
- [ ] Exit criterion: zero lint warnings; `--max-warnings 0` in CI and the Stop hook

### Phase 4: Docs

- [ ] Rewrite the two CLAUDE.md rules (4.8)

## Resume state (2026-10-07)

- **Done 2026-10-07:** `tsconfig.e2e.json` in CI (`3e2d9a6`); `search_path` function fix (`ddc9d05`, pushed to prod by user, baseline now 98 lines); deploy unblocked (`ac54d63`, audit fix); CI split (`f452b9c`). All pushed (`origin/main` = `f452b9c`).
- **Verified 2026-10-07:** deploy run 37596023305 green on all 4 split jobs + deploy (prod runs `f452b9c`); infra-health 37596022921 and Security Scan 37596023018 green.
- **Done 2026-10-07 (later):** last Phase 2 item, typing `createClient` calls + raw PostgREST fetches (`32dec40`..`20f62ba`, see Phase 2 checklist). Stray `.bak` files deleted. **Open:** verify-payment `payment_status` mapping (Decisions & Deferrals).
- **Was in progress:** last Phase 2 item, "Type all `createClient` calls; convert raw PostgREST fetches (4.1)". Live count 2026-10-07: 23 untyped `createClient(` calls in `functions/` (incl. the shared factory `functions/lib/supabase-admin.ts:29`), 10 already typed; 4 raw `rest/v1` fetches (`admin/verify-payment.ts:210,272,314`, `audit/log-with-ip.ts:174`). Two more untracked, gitignored `.bak` files in `functions/api/guest-booking/` (`preview-pricing.ts.bak`, `rates.ts.bak`) show up in greps; delete them.

Earlier (2026-10-06):

- **Done:** Phase 0, Phase 1, and Phase 2 items `functions/` tsconfig, `gen:types`, `satisfies` payload rule, type drift + `db lint` CI steps; dead-code cleanup.
- **Done 2026-10-04:** `booking_status` narrowing + CHECK parity test.
- **Done 2026-10-05:** `UserRole` from DB type + service-role gating test (4.2).
- **Done 2026-10-05:** audit-trigger coverage test + migration `20261005000000` (local only; prod push pending, user).
- **Done 2026-10-05:** pricing parity test + Fri/Sat weekend rule on every path.
- **Done 2026-10-06:** pushed `52cb284`..`10d85be` (verified `HEAD` = `origin/main`); prod checks for weekend mismatch and seasonal rates (see Phase 2); dead pricing code deleted (`7a349b2`, not pushed).
- **Verified 2026-10-07:** `prod-drift` CI job green against prod; the booking form price in a browser (only store logic is tested).
- **Next:** push, then confirm the split CI jobs and the deploy run both go green. After that: typing `createClient` calls / raw PostgREST fetches (last Phase 2 item). Open follow-ups: forward migration matching prod's `search_path` hardening (removes 14 baseline lines); delete `functions/api/guest-booking/multi-unit.ts.bak`.
- **Verified on prod 2026-10-04:** migration `20261004000000` applied by the user (`check_unit_availability` 3-arg call returns `true`; `revoke_audit_role` gone); a pricing save wrote a `pricing_config.updated` audit row (`source: app`), the first server-side audit row in prod
- **First CI run of the two non-blocking `infra-health` steps (2026-10-04, run 37197028971):** both exited 1 but show green (`continue-on-error`). `db lint` flags exactly the 7 functions listed above (the 2 dropped by `20261004000000` are gone). Type drift failed on CLI version, not schema (CI ran latest, local was v2.109.1); fixed by upgrading the local CLI, see Decisions & Deferrals.
- **Remaining Phase 2:** prod push of `20261005000000`, weekly prod drift check, `tsconfig.e2e.json`, split CI jobs, typing remaining `createClient` calls / raw PostgREST fetches.

## 6. Costs and risks

- Type-aware lint is about 5x slower here (4s → 21s), so it stays out of the per-edit hook and pre-commit until measured again.
- Regenerating types will surface errors at once; some are real drift.
- `functions/` type-checking needs the duplicated `supabase-admin` and mixed `@/` vs relative imports resolved first (audit doc, "Next task").
- The `satisfies` rule is syntactic; a payload built in a variable first escapes it. The variable's own annotation is then the check.
- The Bash guard is regex-based and can be bypassed by unusual quoting; it is a seatbelt, not a permission system.

## 7. Not verified at design time

Turnstile import failing in the deployed bundle; the expense-date shift in a browser; type-aware lint on the 57 files outside the tsconfig program; actual `gen types` output; whether accounts/transfers need an exclusion rule; CI duration with new jobs. The draft ESLint selectors have not been run against the code.

## 8. Decisions & Deferrals

Accepted 2026-10-03 (recommended defaults):

- **Fix the four confirmed bugs (owner 403, multi-unit gate, available-units columns, assign-units `errorHint`) first, as separate `fix:` commits.** Why: owner 403 is live. Revisit: n/a.
- **Generate types from local migrations, not prod; prod drift is a separate check.** Why: migrations are the source of truth; prod drift is a different failure. Revisit: if local and prod diverge on purpose.
- **Bash guard now; narrowing `supabase:*` / `npx wrangler:*` allows is the user's call.** Why: user prefers allowlists over auto mode (memory). Revisit: if the guard misses a dangerous command.
- **Audit trail rule becomes "trigger on every table or allowlisted", enforced by a DB test; drop the per-call `logAuditEvent` mandate.** Why: no store calls it; triggers already do the work. Revisit: if app-level context (IP, reason) is needed in audit rows.
- **Booking status: TypeScript narrowing + CHECK parity test, not a Postgres enum migration.** Why: avoids a prod migration. Revisit: if statuses change often.
- **Branded `Cents` and the outbox/`readDb` sections dropped; pricing parity test added.** Why: no matching incidents or architecture here. Revisit: if a money-parsing bug ships.
- **SessionStart hook not added.** Why: the user-level hook already does it. Revisit: if the user-level hook is removed.
- **Doc-path check not added.** Why: 0 broken paths in the 3 current CLAUDE.md files. Revisit: if CLAUDE.md files grow again.
- **pgTAP deferred; `supabase db lint` first.** Why: RLS is already covered by the Vitest role matrix; SQL-function bugs are the gap. Revisit: when RLS or SQL functions grow.
- **`src/__tests__` type-checking deferred; `e2e/` first.** Why: 255 errors, mostly loose test helpers, no schema bugs found. Revisit: after Phase 2.

Decided during Phase 1 (2026-10-04):

- **`noImplicitReturns` dropped.** Why: all 8 hits are `useEffect` returning cleanup on one branch; satisfying it means adding `return undefined;` lines that guard nothing, and no shipped bug maps to it. Revisit: if a missing-return bug ships.
- **Global `MutationCache` error toast dropped; per-site toasts plus a scoped lint rule instead.** Why: 18 of 24 components using `mutateAsync` already toast in their catch, so a global handler double-toasts; skipping mutations with their own `onError` would skip the stores, whose `onError` only rolls back. Revisit: if mutations move to hooks that never toast.
- **Silent-catch rule scoped to `src/components` and `src/routes`.** Why: repo-wide it hits ~45 sites, most deliberate best-effort logging (middleware fail-soft, monitoring). Revisit: never repo-wide; extend to `src/hooks` if a hook swallows a user-facing failure.
- **Repo-wide timezone lint deferred to Phase 3.** Why: `no-restricted-syntax` is now `error` repo-wide for the metadata-role rule, and severity is per rule, so the timezone selector cannot be `warn` beside it; the 44 sites each need judgement (some are UTC timestamps on purpose). Revisit: Phase 3 sweep, then add it at error.
- **Turnstile fail-closed merged after verifying the prod secret.** Why: merging without the secret would block login, sign-up and guest booking. Verified via `wrangler pages secret list` on 2026-10-04. Revisit: if the secret is ever rotated, set the new value before removing the old.
- **Bash guard matches only at command start.** Why: matching anywhere blocked a commit message that mentioned `supabase db push`. Known limit: it does not parse quoting, so a blocked phrase after `&&` inside a quoted string is still blocked. Revisit: if false positives become frequent.
- **Public availability `"full"` status is not a bug.** Why: `"full"` means fully available (`getAvailabilityStatus`, count 3); the calendar renders it green and labels days from `availableCount`, with `"booked"` for zero. The name is confusing but the guest-facing result is correct. Revisit: rename only with a versioned API change.
- **Dev-dependency advisories left for Dependabot.** Why: the full `npm audit fix` hits a wrangler / `@cloudflare/workers-types` v5 peer conflict; dev tools do not ship to users. Revisit: when Dependabot opens the wrangler upgrade.
- **Online booking left visible, not hidden (2026-10-04, user).** Why: hiding it risks the feature being forgotten; it is a future polish project. Restoring it needs a forward migration for `create_guest_booking`, `guest_booking_unit_requests`, `calculate_booking_pricing` and `assign_units_to_booking` with corrected columns (see the drift memory). Revisit: when online booking is scheduled.
- **Broken SQL functions dropped, not fixed (2026-10-04, user).** Why: no callers; the 4-arg `check_unit_availability` already does the job. Migration `20261004000000` with rollback; prod needs `supabase db push` by the user (the Bash guard blocks it for agents). Revisit: never.

Decided during Phase 2 (2026-10-04):

- **Generated types moved to `database.generated.ts`; `database.types.ts` is the narrowing layer.** Why: a new override module would need 39 imports changed, and any missed import would quietly keep `string`. With the rename, every existing import is narrowed and the CI drift step diffs the generated file. Revisit: if the narrowing layer grows past a few columns (then consider type-fest `MergeDeep`).
- **`'Hold'` in the availability SQL functions left alone.** Why: bookings' CHECK rejects `'Hold'`, so `IN ('Confirmed', 'CheckedIn', 'Hold')` just never matches that value, and removing it needs a prod migration. Revisit: the next migration that touches those functions.
- **Payment-proof cron: only the health-check client is typed.** Why: typing the RPC client exposes the SQL return-shape mismatch, which is fixed with the SQL function (P1 #4 item above); a cast would hide it. Revisit: with that item.
- **Type drift vs unpinned CI CLI: local CLI upgraded to latest (2026-10-04, user chose option a).** Why: keeps the deliberate "CLI breakage fails in CI" canary. Local v2.109.1 → v2.119.0; regenerated output matches CI's diff line for line (66 lines). New output: `Args: Record<PropertyKey, never>` for no-arg RPCs, `NonNullable<Json>` for NOT NULL jsonb, which exposed `DiscountRule.conditions` typed nullable (fixed). Procedure when the step fails on a CLI-only change: upgrade local CLI, `npm run gen:types`, commit. Rejected: pinning (loses the canary), semantic compare (more machinery). Revisit: if CLI releases churn the output often.

Decided during Phase 2 (2026-10-05):

- **`UserRole` keeps `"user"` beside the DB roles.** Why: `"user"` is not a stored role; `lookupUserRole` returns it when there is no active `app_roles` row or the lookup fails, and the gates rely on it being rejected. Revisit: if pending accounts get a stored role.
- **`/api/auth/sign-up` allowlisted in the gating test, not made public (user).** Why: user's call; behavior left unchanged for now. The `KNOWN_UNGATED` entry fails the test once it is gated, so it cannot go stale. Revisit: when sign-up is needed, add it to `isPublicPath` (Turnstile is its abuse guard) and delete the allowlist entry.
- **Gating test detects service-role use per file (`SUPABASE_SERVICE_ROLE_KEY` or `createSupabaseAdmin`), not transitively.** Why: only `supabase-admin.ts` and `role-lookup.ts` in `functions/lib` touch the key, and the latter is the gate itself. Revisit: if another lib module starts using the service role.
- **Audit triggers on all 10 app-written tables in one migration (user chose this over app_roles-only or allowlist-everything).** Why: each is mutated by staff UI or functions, and `pricing_config` has a client update path (`db.pricingConfig.update`) that skips the app-level audit row. `pricing_config` saves through `update-config` now write two rows (`source: db` and `source: app`); kept, since the app row carries the event name. Revisit: if audit volume nears free-tier DB limits.
- **Seven tables allowlisted, not triggered:** `audit_logs`, `audit_logs_archive` (the audit store), `bookings_conflict_backup` (snapshot, no writers), `idempotency_keys` (cron-purged churn), `booking_unit_availability` (derived from audited `booking_units`), `guest_assignments` (no writers), `guest_booking_unit_requests` (online booking, deferred). Revisit: `guest_booking_unit_requests` when online booking is restored; the others if they gain writers.
- **Record-id column via trigger argument, not a `user_id` fallback in the generic lookup.** Why: `user_id` is a non-key column on other tables, so a global fallback could key rows to the wrong id. The coverage test mirrors the lookup, so an unresolvable trigger fails it. Revisit: n/a.
- **`attach_audit_trigger` helper not used or fixed.** Why: still has the `db lint` format-string error (open item above); the migration builds the triggers with `format('%I')` directly. Revisit: with that item.
- **Weekend rate = Friday and Saturday nights (user).** Why: what booking creation already stored, and the usual resort convention (Fri→Sun = 2 weekend nights). The form and quote paths changed; stored prices for new bookings do not. Revisit: if the resort changes its rate rules.
- **Seasonal rates deferred, not wired into booking creation or the form (user).** Why: only the quote path applies them; whether to extend or remove depends on whether prod has any active `seasonal_rates`, not checked yet. The parity test stubs no seasonal rate. Revisit: after that prod check.
- **Parity test asserts against a hand-computed total, not just form == stored == quote.** Why: three paths agreeing on a wrong rule would otherwise pass. Revisit: n/a.

Decided during Phase 2 (2026-10-06):

- **Admin seasonal-rates UI left as is; not restored on prod yet.** Why: the table is absent on prod (drift from `20251106000000`), the quote path already degrades to no seasonal rate, and nothing in the form or the stored price uses it. Restoring needs a forward migration, the same as the online-booking objects. Revisit: when seasonal pricing is wanted; until then the drift baseline lists it.
- **Weekly prod drift check compares the catalog, not just migration history (user).** Why: `migration list` passed for both known drifts (`20251104184719`, `20251106000000`) because the history rows exist while the objects do not. Revisit: n/a.
- **Drift check authenticates as a read-only Postgres role, not a personal access token (user).** Why: a leaked PAT can manage the whole Supabase account; the role can only read the catalog. The migration creates it `NOLOGIN` with no password; the user sets the password on prod, so no secret is in the repo. Revisit: if Supabase adds scoped read-only tokens.
- **Known prod drift goes in a committed baseline; the check fails on new drift and on stale baseline entries (user).** Why: a job that is always red gets ignored; stale-entry failure keeps the baseline honest (same pattern as `UNAUDITED_TABLES`). Revisit: delete entries as the drift is fixed.
- **Prod `search_path` drift fixed by qualifying the bodies, not by copying prod (2026-10-07).** Why: the recommended "forward migration matching prod" would have copied a setting that breaks the functions. Revisit: n/a.
- **verify-payment's `payment_status` values left as is pending a mapping decision (2026-10-07).** Why: `'Verified'`/`'Rejected'` fail `bookings_payment_status_check` on local and prod, but which allowed value a verified downpayment means (`Partial` vs `Completed`) and what a rejection resets to is a business call; the typed client cannot catch it because `payment_status` is a CHECK-constrained varchar, not narrowed. Revisit: when the user picks the mapping; then narrow `payment_status` in `database.types.ts` like `booking_status`.
- **Assertion-free e2e tests left as is.** Why: the owner-navigation, export-button and `expect(true)` tests need the intended role behaviour decided first; removing their unused variables did not change what they check. Revisit: when the e2e suite gets its CI pass (only part of it runs in CI).
