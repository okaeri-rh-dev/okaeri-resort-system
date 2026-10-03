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

- [ ] Owners get 403 on refund/record/add-unit/remove-unit: `functions/lib/rbac.ts:17` `UserRole` lacks `owner`, and the `requireRole` lists in `functions/api/bookings/[id]/{payments/refund,payments/record,units/add,units/remove}.ts` and `isStaffOrAbove`/`isManagerOrAbove` omit it
- [ ] `functions/api/bookings/multi-unit.ts` uses the service-role key with no role check (any authenticated user, including role `user`, can create bookings): require staff+
- [ ] `functions/api/admin/available-units.ts:252-257` maps nonexistent columns (`unit_number`, `max_capacity`, `base_price`, `floor_level`, `view_type`)
- [ ] `functions/api/admin/assign-units.ts:102` references undefined `errorHint` (ReferenceError on the error path)
- [ ] Turnstile: wrong dynamic import path at `functions/api/public/v1/availability.ts:234`; fail-open on missing secret at `src/lib/turnstile.ts:44` (audit P1 #10)
- [ ] Expense dates likely saved a day early: `ExpenseForm.tsx:127`, `ExpenseEdit.tsx:78`, filters in `useExpenseStore.ts:232,442` and `ExpenseFilters.tsx:144` (reproduce first)
- [ ] `eslint.config.js` ignores `.claude/worktrees/**`

### Phase 1: Cheap wins

- [ ] Pre-commit strict (4.7)
- [ ] Cheap tsconfig flags and lint rules marked "error now" (4.3)
- [ ] Metadata-role lint, `supabase-admin` import ban (4.2)
- [ ] Timezone lint as warn (4.3)
- [ ] Global `MutationCache` error toast; fix 9 silent catches (4.5)
- [ ] Bash guard, per-file lint, and Stop hooks; verify the Stop loop guard with a deliberately failing file (4.6)
- [ ] Shadow-module test (4.4)
- [ ] Dependabot, non-blocking audit job, Node pin (4.7)

### Phase 2: Contracts

- [ ] `gen:types` from local migrations, fix `seasonal_rates`, remove `as any` bridges (4.1)
- [ ] `functions/tsconfig.json`, fix errors, add to `ci.yml` (4.1)
- [ ] Type all `createClient` calls; convert raw PostgREST fetches (4.1)
- [ ] `satisfies TablesInsert` lint (4.1)
- [ ] `UserRole` from DB type; service-role gating test (4.2)
- [ ] `booking_status` narrowing + CHECK parity test (4.4)
- [ ] Audit-trigger coverage test (4.4)
- [ ] Pricing parity test (4.4)
- [ ] `db lint` + type drift in `infra-health`; weekly prod drift check (4.1)
- [ ] `tsconfig.e2e.json` in CI (4.1)
- [ ] Split CI jobs (4.7)

### Phase 3: Depth

- [ ] Type-aware rules as warn, then error (4.3)
- [ ] Timezone rule to error after the 44 sites are fixed
- [ ] Query-key plugin + migrate duplicate roots, one entity per commit
- [ ] Knip after dead-code purge; audit job blocking after fix pass
- [ ] Exit criterion: zero lint warnings; `--max-warnings 0` in CI and the Stop hook

### Phase 4: Docs

- [ ] Rewrite the two CLAUDE.md rules (4.8)

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
