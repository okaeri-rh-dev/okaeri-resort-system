# Whole-App Improvement Audit — 2026-07-21

Six parallel read-only audits (architecture, security, performance, testing, database/backend, frontend UX) plus a health baseline (type-check, lint, unit tests, production build, `npm outdated`). Every P0/P1 that touches production was re-verified first-hand against current code; file:line evidence is cited inline. Nothing in this audit changed application code.

## Health baseline (all green)

| Gate                      | Result                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------- |
| `tsc --noEmit`            | ✅ 0 errors                                                                        |
| `eslint .`                | ✅ 0 errors, 2 cosmetic `react-refresh` warnings (`button.tsx:26`, `form.tsx:168`) |
| Unit tests (`test:no-db`) | ✅ 1450 passed, 49 skipped, 81 files, 171s                                         |
| Production build          | ✅ 9.1s                                                                            |
| Bundle                    | ⚠️ `vendor-pdf` 1.57 MB + `index` 1.55 MB; SW precaches 6.5 MB / 67 entries        |

The tree is healthy on paper. The problems below are things the current gates **don't** catch — which is itself the theme of the audit.

## The one-paragraph story

The **live core** (routes, components, forms, the typed `db` helper, the global edge `_middleware.ts`) is well-built: layered route guards, 28+ consistent React-Hook-Form + Zod forms, DB-enforced double-booking prevention, a genuinely strong global middleware (CSP/HSTS, origin-allowlisted CORS, KV rate limiting, `app_roles`-based role lookup that explicitly refuses to trust user-mutable metadata). But that core is wrapped in **dead weight and ungated risk**: the `/api/admin/*` layer defeats the good auth design (any authenticated user is an admin), TypeScript is type-checked by _nothing_ automatically, production deploy is gated on _zero_ tests, and several production paths are quietly broken (a weekly cron that fails every Sunday, a payment-verification endpoint that queries a nonexistent column, an unauthenticated service-role deletion route). Around all that sits ~5,000 lines of dead code and doc traps that actively mislead future work.

---

## P0 — Fix now (security-critical or broken in production)

### 1. `/api/admin/*` grants admin to ANY authenticated user

_Independently found by the security and database lanes; verified first-hand._

`functions/api/admin/_middleware.ts:128` — Step 4 is literally commented "Phase 1: All authenticated users are admins," role check disabled. Endpoints that _do_ check (`verify-payment.ts:127`, `available-units.ts:80`, `assign-units.ts:65`) read `user_metadata.role`, which any user can self-set via `supabase.auth.updateUser({data:{role:'admin'}})`. `sign-up.ts` creates accounts with no `app_roles` row and self-signup is open.

**Impact:** any account that can register → reads all guest PII (`pending-bookings.ts:89` returns name/email/phone), verifies/rejects payments, assigns units, mutates bookings.

**Fix:** enforce `requireRole(request, ['admin','owner'])` (the correct helper already exists at `functions/lib/rbac.ts:78`, reading `request.user` computed safely by the root middleware) inside `admin/_middleware.ts`; delete every `user_metadata.role` check. ~half a day including tests.

### 2. Coarse RLS lets a low-privilege JWT bypass the API layer entirely

`supabase/migrations/20251006093452_remote_schema.sql:1685+` — policies are `auth.role() = 'authenticated'` for full CRUD (plus redundant `FOR ALL`) on `bookings`, `guests`, `payments`, `expenses`, `units`. Even after #1 is fixed, any authenticated user can talk to Supabase directly with the anon key and delete payments/guests, sidestepping all functions-layer RBAC.

**Fix:** replace with `is_manager()` / `is_admin_or_owner()` row policies (helpers exist per the hardening migration); drop the blanket `Enable all` policies. Half a day + careful testing against the E2E suite.

### 3. Production deploy is gated on zero tests

_Verified first-hand._ `deploy-cloudflare.yml` runs checkout → build → `wrangler pages deploy` with **no test step**, as a workflow independent of `infra-health.yml` (they race on `push:main`). A red suite never blocks a ship. The two workflows that used to gate PRs are renamed `*.yml.disabled`.

**Fix:** gate deploy on `infra-health` via `workflow_run`, or add lint + `tsc --noEmit` + `test:no-db` as `needs:` steps before the deploy job. ~1 hour.

---

## P1 — High value (broken paths, real risk, or big leverage)

### Broken production paths

4. **Weekly payment-proofs cron fails every Sunday.** `scheduled-cleanup.yml:66` POSTs `/api/cron/cleanup-payment-proofs` every Sun 03:00 UTC → calls `cleanup_expired_payment_proofs()`, which the restore migration (`20260715000000_...sql:16-21`) **explicitly documents as deliberately not created on prod** (schema mismatch: `check_out_date` vs real `check_out`; statuses `Completed/CheckedOut` vs real `Confirmed/Cancelled/Pending`). Job exits 1 weekly, visible only in GitHub Actions. _Fix:_ comment out the Sunday schedule until the function is ported against real columns, or write the ported migration (needs a retention-rule decision — see Decisions). Overlaps active memory `project_prod_schema_drift_migration_20251104184719`.

5. **`verify-payment` queries a nonexistent column.** `functions/api/admin/verify-payment.ts:204,266` fetch `bookings?id=eq.${booking_id}` — the PK is `booking_id` (the restore migration comment confirms it), and the sibling endpoint `bookings/[bookingId].ts:206` uses `booking_id` correctly. PostgREST returns 400 → the endpoint 500s. Called from `PaymentProofViewer.tsx:135`, so admin payment verification via this path can't work. _Fix:_ `booking_id=eq.` in both calls (one-line each). Note this is also finding #1's endpoint, so it's currently doubly-unreachable-then-broken.

6. **Unauthenticated service-role deletion route is live.** `functions/cron/cleanup-guest-bookings.ts` exports `onRequestGet/onRequestPost` using the service-role key; the root middleware early-returns for any non-`/api/` path (`_middleware.ts:306`), so this route has **no auth, no rate limit, no headers**. Anyone can trigger booking + storage deletions and read returned booking IDs. Nothing schedules it (orphaned) but it's deployed. _Fix:_ delete the file, or move under `functions/api/cron/` behind `CRON_SECRET`. ~1 hour.

### Type safety & CI gaps

7. **Nothing type-checks automatically.** _Found by architecture + testing._ `build` is plain `vite build` (no `tsc`, contradicting CLAUDE.md's "Type-check and build"); pre-commit allows up to 100 TS errors; pre-push is lint+unit; deploy skips it; the type-check workflow is `.disabled`. `tsc` exits 0 _today_, so enforcing 0 is nearly free — and prevents silent regressions. _Fix:_ add `tsc --noEmit` to `infra-health` (and drop pre-commit's threshold to 0). ~1 hour.

8. **`functions/` (46 server files) is outside tsconfig entirely.** `tsconfig.json:32` includes only `src`. Server booking/payment/auth code has zero type enforcement — exactly where #5's column bug hides. _Fix:_ add a `functions/tsconfig.json` and wire it into `type-check`. Half a day (expect to surface latent errors).

9. **No blocking PR CI; quality gates are local-only.** Only `security-scan.yml` runs on PR and its steps are `|| true` / `continue-on-error`. Husky hooks are a single, `--no-verify`-bypassable point of failure. _Fix:_ re-enable a slim PR workflow (lint + `tsc` + `test:no-db`).

### Turnstile

10. **CAPTCHA fails OPEN when the secret is unset.** `src/lib/turnstile.ts:44` returns `true` with a warning if `TURNSTILE_SECRET_KEY` is falsy. Given this project's documented recurring secret-drift, that silently disables bot protection on public booking + login. _Fix:_ fail closed (`return false`) when `ENVIRONMENT === 'production'`; only bypass in development. ~30 min.

### Bundle (mobile-first, matters here)

11. **One admin page pulls the PDF stack into the entry bundle.** `verify-payment.$bookingId.tsx:12` statically imports `PaymentProofViewer`, which statically imports `react-pdf` + `react-zoom-pan-pinch` (`PaymentProofViewer.tsx:18-19`); `pdfjs-dist` isn't in `manualChunks`. Result: ~1.5 MB of PDF machinery ships to _every_ visitor, including public guest-booking users, for a one-page admin viewer. _Fix:_ `React.lazy` the viewer (the pattern 22 sibling routes already use). ~1 hour — likely the single biggest mobile win.

12. **The service worker precaches the entire PDF stack onto every device.** `vite.config.ts:27` glob precaches all JS incl. the 1.57 MB `vendor-pdf` chunk + a 1.0 MB static `public/pdf.worker.js`; re-downloaded whenever hashes change. _Fix:_ `globIgnores` those + a `CacheFirst` runtime rule; import the worker via `pdfjs-dist/build/pdf.worker.min.mjs?url` (also fixes silent version drift on upgrades). ~1 hour.

### Dead-code traps that mislead future work

13. **Dead `BookingForm/` refactor shadows the live 982-line monolith.** _Found by architecture + frontend._ `routes/admin/bookings.tsx:23` imports `@/components/bookings/BookingForm` → resolves to `BookingForm.tsx` (file beats directory). The modular `BookingForm/{index,steps/,hooks/}` — **which ships its own README + CLAUDE.md telling you to work there** — has zero importers. Editing the "clean" version changes nothing. Same pattern: `expenses/ExpenseEdit.tsx` shadows `ExpenseEdit/index.tsx`. _Fix:_ pick canonical, delete the loser in one commit.

14. **~4,100-line dead advanced-search stack.** `useSearchStore.ts` (882 ln, `@ts-nocheck`, "PHASE 3-4") + `useSearch.ts` + `search-filter.ts` + `filter-builder.ts` + `search-presets.ts` + `utils/search.ts` — zero component/route consumers, reachable only via a barrel re-export. Largest dead mass in the repo. _Fix:_ delete the six files + the re-export block in `hooks/index.ts:40-49`.

15. **Legacy `database/` tree with an actively-wrong auto-loaded CLAUDE.md.** _Found by architecture + database + recon._ `database/` last changed 2026-01-30 vs `supabase/` (the live CLI-linked path) days ago; `database/CLAUDE.md` claims **"Neon PostgreSQL"**, wrong statuses, and a multi-tenant schema that doesn't exist — and Claude Code auto-loads it when working in that tree. _Fix:_ archive `database/` under `docs/legacy/` (keep any still-valid diagnostics/rollbacks), delete its CLAUDE.md, leave a one-line pointer to `supabase/migrations`.

### Frontend correctness (public-facing / trust)

16. **Guest-booking Terms/Privacy links 404 and wipe form state.** _Verified first-hand._ `BookingReviewStep.tsx:197-201` uses `<a href="/terms">` / `/privacy`; actual routes are `/terms-and-conditions` and `/privacy-policy`. Full-page nav on the public money path → 404 + loss of the guest's 5-step form. _Fix:_ correct hrefs + `target="_blank" rel="noopener"`, or render in a Sheet. ~30 min. (Listed open in the 2026-07-07 mobile audit, H4.)

17. **GuestsTable pagination frozen at page 1.** _Verified first-hand._ `GuestsTable.tsx:459` sets controlled `pagination: {pageIndex:0, pageSize:10}` with every handler wired **except** `onPaginationChange` — the classic TanStack trap. Guests beyond the first 10 are unreachable. _Fix:_ add `onPaginationChange` + `useState` like `BookingsTable`. ~30 min.

18. **Payment mutations fail silently.** `PaymentsTable.tsx:121,137,148` catch with `console.error` only; no store emits a toast. With optimistic updates, a failed delete/verify looks successful until a refetch silently reverts it. _Fix:_ add `toast.success/error` in the store's mutation `onSuccess/onError` (one place). ~1 hour. Also `PaymentsTable` has a **no-op Status filter** (`usePaymentStore.ts:142` — column doesn't exist) that highlights as active but never filters.

---

## P2 — Medium (consistency, maintainability, resilience)

- **Generated-types pipeline is broken.** `src/lib/supabase.ts:17` documents that types "cannot be regenerated" due to a `seasonal_rates` drift; `payment_methods`/`expense_categories` are absent from `database.types.ts` and bridged with `as any`. Type-safety illusion on the newest _financial_ surfaces. Reconcile drift → `supabase gen types` → delete the `as any` bridges.
- **Cron has no failure alerting** beyond a GitHub-Actions exit code (`_worker.ts:113` "TODO: admin alerting"). GitHub disables scheduled workflows after 60 days of repo inactivity → true silent failure for a family business. Add an `if: failure()` notify step (`ALERT_WEBHOOK_URL` already in Env).
- **CI runs 1 of 13 Playwright specs** (`run-hooked.sh:10`). The other 12 (auth, booking lifecycle incl. payment verification, admin queue, pricing integrity, multi-role) run only manually and rot invisibly. Add a nightly full run reusing the existing Supabase+`dev:cf` setup.
- **"Integration" tests validate an 824-line MSW mock, not real server code** (`msw-setup.ts` loads globally; `booking-api.test.ts` never reaches a server). The real `functions/api/guest-booking.ts` has zero tests. Add an env-flag to run the integration lane against `wrangler pages dev`.
- **Server layer ~9/45 functions files tested.** Untested: all `auth/*`, all `admin/*` (incl. the RBAC middleware from #1), `payments/refund`, `guest-booking/*`, `cron/*`, `lib/rbac.ts`. Extend the good `src/__tests__/api/` direct-import pattern to auth + admin + refund first.
- **Icon-only buttons lack accessible names in 3 shared table primitives** (`tables/utils.tsx:399` kebab, `:303` pagination chevrons, `:156` clear-search) — so every table inherits it. The correct sr-only pattern already exists at `settings/ExpenseCategoriesTable.tsx:107`. 3 primitive edits fix all tables.
- **Four divergent table error UIs, none using the existing `TableEmptyState variant="error"`;** only UnitsTable offers retry and it's a full `window.location.reload`. PaymentsTable is the only table with no skeleton. Standardize on the existing helper.
- **No router-level 404** — the designed `NotFoundPage` is unreachable dead code (`_404.tsx` is a pathless route with no children; no `defaultNotFoundComponent`). Bad URLs (incl. #16's links) get TanStack's unstyled default. Wire `defaultNotFoundComponent`.
- **Error response shape varies ≥5 ways across the API.** Add a shared `errorResponse()` helper in `functions/lib/`, adopt opportunistically.
- **Five orphaned `src/` dirs + 4 `phase3-4` files** (`src/pages/`, `patterns/`, `workflow/`, `examples/`, `scripts/`) with zero live importers, all inside tsconfig. Delete.
- **`src/utils/validation.ts` (845 ln) is a dead twin of the live `src/lib/validation/`.** Delete + shrink the 450-line `utils/index.ts` barrel.
- **11 stale checkpoint docs at repo root** (`TYPESCRIPT_FIXES_REMAINING.md` claims "79 errors" vs actual 0; `PROJECT_STRUCTURE.md` documents `database/` as canonical). Move to `docs/` or delete.
- **Rollback coverage ~1/33 migrations.** The 1,205-line `security_hardening` and `financial_accounts` migrations have no rollback pair.
- **Mobile admin parity gaps** (audit steps 3–7, still open in `docs/mobile-ux-audit-2026-07-07.md:53`): payments mobile cards lack Verify/View/Delete/filters/pagination; guests mobile has no Delete; UnitsTable has no mobile branch (`useResponsiveView()` result discarded).

---

## P3 — Polish

- Autocomplete route code-splitting: set `autoCodeSplitting: true` in the router plugin and delete manual `lazy()` boilerplate (4 straggler routes still eager: `new-multi`, `audit-logs`, `queue`, `roles`).
- `manualChunks` forces lazy-only libs (`react-table`, `react-day-picker`) into eagerly-loaded vendor chunks — remove those entries, let Rollup place them in lazy chunks.
- **`bundle-stats.html` (1.3 MB treemap) is generated on every prod build and deployed publicly** — gate the visualizer to `mode === 'analyze'`.
- Remove dead deps: `@types/dompurify` (dompurify ships its own types), top-level `pdfjs-dist` (react-pdf pins its own); move `resend`/`email.ts` under `functions/`.
- No `AbortSignal.timeout` on any of ~7 outbound `fetch` sites in `functions/` — a hung upstream burns worker duration.
- `date-helpers.ts` ships `PHILIPPINE_HOLIDAYS_2024` still consulted by `isHoliday()` in 2026; reimplements `date-fns` helpers. Refresh or drop.
- ~2,100 lines of fully-skipped vitest tests (`mobile-responsive.test.tsx`, `useMultiUnitBookingQueries.test.tsx` 100% skipped) inflate apparent coverage. Revive or delete with a ticket.
- Accessibility test coverage is calendar-only — add axe smoke tests for the 5 tables + guest-booking steps.
- Dead vitest config keys (`threads`, `maxThreads` — not v3 options) silently ignored; `navigateFallback: null` means the installed `/admin` PWA can't launch offline (deliberate per comment — revisit).
- Consolidate to one React plugin (both `@vitejs/plugin-react` and `-swc` are installed); dependency lag (`@supabase/supabase-js` 51 minors behind, TanStack Router ~37 behind) — schedule a `dep-update` pass.

---

## What's done well (don't regress these)

- **Global edge middleware** (`functions/_middleware.ts`): full CSP/HSTS/X-Frame-Options/nosniff, origin-allowlisted CORS, KV rate limiting + progressive IP auto-blocking, fail-closed on missing `SUPABASE_JWT_SECRET`/`CRON_SECRET`, and an `app_roles`-based role lookup (60s KV cache) that **explicitly refuses** user-mutable metadata. The correct authorization pattern exists — the admin layer just doesn't use it.
- **DB-enforced double-booking prevention, twice**: gist exclusion constraints on both `bookings` and `booking_units`, with supporting hot-path indexes.
- **Form discipline**: 28+ React-Hook-Form + Zod + `FormMessage` forms with double-submit guards; layered route guards (`/admin` `beforeLoad` + per-route `requireStaff/Manager`); tiered error boundaries (app/page/component).
- **Secrets hygiene**: no secrets tracked in git (only `.example` templates); `.gitignore` covers `.env*`/`.dev.vars`; no non-`VITE_` env access leaks into the client bundle; the sole `dangerouslySetInnerHTML` is static JSON-LD.
- **Real server tests exist** in `src/__tests__/api/` via direct handler import with JWT factories — the right architecture, just under-extended. `infra-health.yml` boots a fresh Supabase, applies all migrations (catches drift by construction), and uses machine-readable `supabase status -o env`.
- **The `20260715` restore migration is a model incident artifact**: idempotent, scoped, documents what was verified against prod and what was deliberately deferred and why.

---

## Decisions Needed

1. **Admin RBAC + RLS hardening (P0 #1, #2)** — _Recommended default: do both now, together._ They're the same threat (privilege escalation on PII + payments) at two layers; fixing only the API layer leaves the direct-Supabase bypass open. Requires prod migration + testing against E2E.
2. **CI gating (P0 #3, P1 #7–9)** — _Recommended default: one slim blocking workflow (lint + `tsc --noEmit` + `test:no-db`) on both PR and pre-deploy, plus `tsc` covering `functions/`._ Near-zero cost today (all green), highest leverage against future regressions.
3. **Weekly payment-proofs cron (P1 #4)** — _Recommended default: disable the Sunday schedule now_ (stop the weekly failure), then port the function against real columns as a separate considered change. The port needs a **retention-rule decision**: which real booking statuses make a payment proof eligible for 90-day deletion? (It mutates real booking data.)
4. **Dead code + doc traps (P1 #13–15)** — _Recommended default: one dedicated cleanup PR_ deleting the search stack, resolving both shadowed-directory pairs, and archiving `database/`. High mislead-risk, low regression-risk (zero live importers), independently verified.
5. **PDF bundle (P1 #11–12)** — _Recommended default: lazy-load `PaymentProofViewer` + fix the SW precache in one change._ Biggest mobile win; self-contained.
6. **Quick correctness wins (P1 #16–18)** — _Recommended default: batch the Terms/Privacy 404, GuestsTable pagination, and payment-toast fixes into one small PR._ Each is <1h, all user-facing, all verified.

### Suggested sequencing

1. **Safety net first** — Decision 2 (CI + type-check gate). Everything else is safer to change once red builds can't ship.
2. **Stop active bleeding** — Decision 3 (disable failing cron), P1 #6 (delete unauth route), P1 #5 (column bug).
3. **Close the P0 hole** — Decision 1 (RBAC + RLS).
4. **User-facing wins** — Decisions 5 + 6.
5. **Cleanup** — Decision 4.

---

## Implementation Log

### 2026-07-23 — Decision 2, part 1: CI safety-net gate (done, not yet committed)

- [x] Added `.github/workflows/ci.yml` — reusable quality gate (`lint` + `type-check` + `test:no-db`) on `pull_request` + `workflow_call` + `workflow_dispatch`. No secrets (vitest hard-codes local Supabase fallbacks; non-DB suite mocks the network via MSW, runs offline). ~2–3 min.
- [x] Gated `deploy-cloudflare.yml` on it: new `quality` job `uses: ./.github/workflows/ci.yml`; `deploy` job now `needs: quality`, so a red gate skips deploy entirely. **This closes P0 #3 (deploy gated on zero tests).**
- [x] Deleted the two inert `*.yml.disabled` PR workflows (superseded by `ci.yml`; salvageable ideas captured below).
- [x] Verified locally: `type-check` exit 0, `lint` exit 0 (2 cosmetic warnings), `test:no-db` 1450 passed (session baseline). All five workflow YAMLs parse.
- [x] Committed + pushed directly to `main` (user-directed) across three commits: `docs` (report), `ci` (gate), `ci` (route-tree fix below).
- [x] **Gate proven end-to-end on real CI.** First run caught a genuine bug: `tsc` failed in the clean CI checkout because `src/routeTree.gen.ts` (TanStack Router, gitignored, produced by the vite plugin) doesn't exist there — so `@/routeTree.gen` was unresolvable and every route type collapsed to `never`. Deploy was correctly **skipped**. Fixed by generating the tree up front (`scripts/generate-routes.mjs` + `generate:routes`, using the already-installed version-matched `@tanstack/router-generator`; output byte-identical to the vite build). Re-run: quality gate green (generate → lint → type-check → tests), **deploy proceeded**. Run `29986020214`.
- [ ] **Branch protection could NOT be set — plan limitation.** This is a **private repo on GitHub Free**, where classic branch protection and rulesets are both unavailable (`gh api` → 404 on protection; rulesets → 403 "Upgrade to GitHub Pro or make this repository public"). Options: upgrade to Pro, make the repo public, or accept the current state. **The deploy gate does not depend on this** — it already blocks a red build from shipping regardless (just proven). Branch protection would only add: blocking red _PR merges_ and preventing force-push/deletion.

### Decisions & Deferrals (this change)

- **Scope: src-level gate now, `functions/` type-check deferred.** The gate type-checks `src/` only. Reason: the 46-file `functions/` server layer has never been type-checked and can't be folded into a _blocking_ gate until it's green — doing so now would either produce a dead-red gate or stall the P0 fix. Revisit as the immediate next task (below).
- **Deploy gates on the FAST tier only** (lint + tsc + non-DB unit), not the 30-min Supabase/E2E `infra-health` job. Reason: blocking every deploy on flaky, slow E2E trains bypass habits; the approved Decision 2 default is the fast deterministic gate. `infra-health` stays an independent push + weekly health check. Revisit if we want deploys to also wait on E2E.
- **`infra-health.yml` left untouched.** Its `health` job still runs lint + non-DB unit on push, now redundant with the deploy gate (~2 min duplicate, runs in parallel, harmless). Reason: minimal blast radius — it's the one workflow that boots Supabase. Optional future trim: reduce its `health` job to the migration-filename lint only.

### Next task — type-check `functions/` (P1 #8), concrete blockers found

Writing a correct `functions/tsconfig.json` is blocked on two real inconsistencies that must be decided first:

1. **Duplicated module:** both `src/lib/supabase-admin.ts` and `functions/lib/supabase-admin.ts` exist. Pick one canonical copy.
2. **Mixed import styles:** functions import the same helpers both as `@/lib/...` (→ `src/`, e.g. `@/lib/turnstile`, `@/lib/email`, `@/utils/booking-reference`) and via relative paths (→ `functions/lib/`, e.g. `../../lib/supabase-admin`, `../../../../lib/rbac`). A functions tsconfig needs `paths: { "@/*": ["./src/*"] }` + `@cloudflare/workers-types`, and pulling `@/` into `src/` may drag in root-tsconfig-excluded files (`src/lib/supabase.ts`, `availability.ts`) that then need their own errors resolved.
   Expect real errors on first run (that's the point). Wire into `ci.yml` only once `tsc -p functions/tsconfig.json --noEmit` is green.

### Salvaged from the deleted `*.yml.disabled` workflows (deferred, non-blocking)

Worth resurrecting later as **non-blocking** PR checks (not deploy gates): a **bundle-size PR comment** (ties into P1 #11–12 and P3 bundle work), **Lighthouse CI** (`.lighthouserc.json` already exists), and **coverage upload** (the 70/80 thresholds in `vitest.config.ts` are currently a dead letter — P2). Their old component-size / console.log / TODO greps are noise — dropped deliberately.

### 2026-07-23 — Audit step 2: stop the active bleeding (done)

Three verified P1s fixed, each as its own commit; all validated on a clean-checkout gate (generate-routes → lint → type-check → `test:no-db`, 1450 passed) and pushed to `main`:

- [x] **P1 #5 — `verify-payment` column bug.** `functions/api/admin/verify-payment.ts` GET + PATCH now filter `bookings?booking_id=eq.` (was `id=eq.`, a nonexistent column → PostgREST 400 → 500). Commit `01e51de`. **Caveat:** the query is now correct, but this endpoint is still behind the broken admin auth (P0 #1) — authorization is a separate fix.
- [x] **P1 #6 — unauthenticated service-role deletion route.** Deleted `functions/cron/cleanup-guest-bookings.ts` (+ its orphaned README, emptying `functions/cron/`) and removed its dead `CronMonitor` registration in `cron-monitor.ts`. It sat outside the `/api/*` middleware (no auth/rate-limit/headers) and was unscheduled, so removal changed no live behavior. Commit `5274645`.
- [x] **P1 #4 — weekly-failing cron.** Removed the `0 3 * * 0` payment-proofs schedule from `scheduled-cleanup.yml` (kept the daily idempotency cron) and defaulted manual dispatch to `idempotency`; the job stays manually dispatchable. Commit `8fbee85`.

Deferrals from this step:

- **Guest-booking cleanup is removed, not reimplemented.** There is now no automated cleanup of abandoned Pending guest bookings. If wanted, re-add as a secured `/api/cron/*` job (CRON_SECRET via middleware) + schedule + verified schema — same care as the payment-proofs port.
- **payment-proofs port** still pending the retention-rule decision (Decision 3) — unchanged.
- **Stale docs:** `functions/CLAUDE.md` (tree diagram) and `src/lib/monitoring/CLAUDE.md` (cron example) still name the deleted `cleanup-guest-bookings` — fold into the P2 doc-cleanup pass (DB-lane finding #9).

**Remaining audit sequencing:** step 3 = close the P0 hole (admin RBAC + RLS, Decision 1); then step 4 (user-facing wins) and step 5 (cleanup). The deferred `functions/` type-check (P1 #8) is still the natural companion to the CI gate.

### 2026-07-23 — Audit step 3, part 1: admin API RBAC (done)

Closed the **API-layer half of P0 #1**. Authorization now comes from `public.app_roles` via `lookupUserRole` (fail-closed), never from client-mutable `user_metadata`. Verified: lint + type-check + `test:no-db` green (1467 passed, +17 new RBAC tests). Deploy-safe: the frontend already gates the admin UI on `app_roles` (`getUserAuditRole` → `get_current_audit_role`), so no one who can currently use the admin UI is newly locked out.

Role levels mirror the frontend route-guards (the app's expressed policy) rather than a blanket admin/owner lock, which would have broken legitimate staff/manager access:

- [x] `_middleware.ts` — baseline: active `app_roles` role of **staff+** (deny `user`/unapproved); attaches the real role to `adminContext`. (/admin min = `requireStaff`)
- [x] `verify-payment.ts` — **manager+** (Payments = `requireManager`); removed the `user_metadata.role` check.
- [x] `assign-units.ts` + `available-units.ts` — deleted the broken `checkAdminRole` (user_metadata shortcut + wrong `profiles` source); rely on the staff+ baseline (bookings = `requireStaff`).
- [x] `pending-users.ts` — tightened to **owner/admin** (exposes registered-user PII; roles page = `requireAdmin`); added a header guard so a missing token returns 401, not 500 (caught by a test).
- [x] Tests: `src/__tests__/api/admin-{middleware,pending-users}-auth.test.ts` — 17 tests, incl. the regression that a JWT with `user_metadata.role="admin"` is still denied when `app_roles` says `user`.

**Decision (role policy):** allowed-role sets mirror the frontend guards. If the org runs owner/admin-only (no staff/managers), tighten the constants — trivial, flagged for confirmation.

**Still open — P0 is only half-closed:** this fixes the functions API layer. A low-privilege authenticated user can STILL bypass it by hitting Supabase directly with the anon key (coarse RLS = P0 #2). That is **part 2 (RLS hardening)** — a prod migration needing careful design + E2E testing, the remaining escalation path.

### 2026-07-31 — Audit step 3, part 2 (RLS): APPLIED TO PROD ✅

`supabase db push` applied `20260725000000` to prod (ref `gxgpdlvathotgqtszabo`) — it was the only pending migration (dry-run confirmed). **Verified live on prod:** `coarse_remaining = 0` (all `Authenticated users can…` / `Enable all` policies removed), each of the 6 core tables has exactly 4 role-based policies (24 total), and the corrected `bookings_delete_staff` / `payments_insert_staff` are present. **P0 #2 is closed** — a roleless/low-privilege authenticated user can no longer do full CRUD via the anon key. Rollback available at `supabase/rollbacks/20260725000000_*.sql` if any legitimate flow is found broken. Recommended final check: app smoke test (staff uploads a payment proof; owner views expenses).

### 2026-07-25 — Audit step 3, part 2 (RLS): BUILT + LOCALLY TESTED (now applied — see above)

**Status:** migration `20260725000000_rls_role_based_core_tables.sql` + rollback + `src/__tests__/database/rls-core-tables.test.ts` committed (`a0ddc8f`), then **corrected after an app-flow audit** (2026-07-31). Validated on a fresh local Supabase: **18 RLS tests pass** (SELECT/INSERT/DELETE × 6 tables × 5 roles); full local DB suite (42) green; test idempotent; existing DB tests unaffected. **NOT yet applied to prod** — needs `supabase db push` (approved step); no workflow auto-applies it.

**App-flow audit correction (2026-07-31):** the first matrix was derived from page-level route guards, which don't match the app's real per-operation reachability. Tracing every direct anon-client write against the `useUserRole` permission model found **two cells too strict** — they'd have broken legitimate staff flows:

- `payments INSERT`: manager+ → **staff+**. The "Upload Payment" action is "always visible (staff can upload on behalf of guests)" and inserts a payment (`useUploadPaymentProof`).
- `bookings DELETE`: manager+ → **staff+**. Booking creation rolls back with a client-side `DELETE` on error (`useBookingStore` create path), and staff can create bookings. (The explicit Delete button is still UI-gated to owner+ via `useUserRole.canDelete`.)

Everything else matched: payment edit/verify/delete and guest edit/delete are on their manager+ pages; units/expenses on owner+ pages; functions-API and public guest-booking use the service-role key (bypass RLS). Final matrix is in the migration header.

_Original design below (unchanged):_

**Confirmed current state (net across all migrations):** each of `bookings, guests, payments, expenses, units, maintenance_logs` still has coarse `view/insert/update/delete` policies **plus** a redundant `"Enable all for authenticated users"` FOR ALL policy, all `auth.role() = 'authenticated'`. The 2026-02 hardening only fixed `accounts`/`account_transfers`. RLS is permissive (OR'd), so the migration must **DROP every coarse policy** then add role-based ones — adding alone does nothing.

**Key constraint:** the authenticated frontend uses the anon-key client for direct CRUD, so these policies are the app's _real_ access control. The functions API + public guest-booking use the service-role key (bypass RLS), so they are unaffected. Existing public/anon policies (e.g. `public_unit_availability` view, `payment_methods` "Anyone can view active") must be preserved.

**Helpers available** (exact-match, SECURITY DEFINER): `is_staff`, `is_manager`, `is_admin` (one role each), `is_admin_or_owner` (admin/owner), `has_any_role` (staff+). Pattern to mirror: `booking_units_*` policies (20251008152700) use inline `role IN (...)` checks.

**Proposed access matrix** (authenticated; mirrors the frontend route-guards; SELECT kept staff+ where the bookings area cross-reads the table):

| Table            | SELECT | INSERT   | UPDATE   | DELETE   |
| ---------------- | ------ | -------- | -------- | -------- |
| bookings         | staff+ | staff+   | staff+   | manager+ |
| guests           | staff+ | staff+   | manager+ | manager+ |
| payments         | staff+ | manager+ | manager+ | manager+ |
| units            | staff+ | owner+   | owner+   | owner+   |
| expenses         | owner+ | owner+   | owner+   | owner+   |
| maintenance_logs | staff+ | staff+   | staff+   | manager+ |

(staff+ = `role IN ('admin','owner','manager','staff')`; manager+ = `role IN ('admin','owner','manager')`; owner+ = `role IN ('admin','owner')`.)

**Risk:** SELECT tightening is the app-breaking-sensitive part — staff booking views join guest/unit/payment data, so those stay staff+. `expenses` SELECT is owner+ (only shown on the requireOwner Expenses page).

**Execution plan (nothing touches prod until approved):**

1. Write the migration (drop coarse + `Enable all`, add matrix policies) + a rollback pair.
2. Test LOCALLY: `supabase start` (fresh), seed one user per role, assert allowed/denied CRUD per table+role. Iterate until the app's real access patterns pass.
3. Present tested results → **explicit approval** → `supabase db push` to prod → probe.

**Decision needed:** confirm the matrix (especially the staff+ SELECT breadth), or adjust, before I build + locally test.
