# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. It intentionally contains only what a fresh session cannot derive from the codebase — commands live in `package.json` scripts, structure comes from the source tree, and coding patterns come from the existing code.

## Pushing to Remote

- `.husky/pre-push` runs only the unit tests affected by the branch (`vitest --changed`); type-aware lint, type-check, knip and the full unit suite run in CI as required checks. It is usually seconds, but a full run under load can take minutes. **Never run `git push` at the default 2-minute Bash timeout** — the hook gets killed (exit 143) and the push does NOT complete. Either:
  1. Run with an explicit long timeout (`timeout: 600000`), or
  2. Run with `run_in_background: true` and monitor until it exits.
- After every push, verify it landed before reporting success: `git fetch origin && git rev-parse HEAD origin/main` — the two hashes must match. A started hook is not a completed push.
- `main` needs green CI (Lint, Type-check, Unit tests, Knip, e2e) to merge, and direct pushes to it are rejected. Merge PRs with `gh pr merge --auto --merge`; it waits for the required checks.
- If the hook fails or hangs on pre-existing/unrelated failures: run `npm run verify` directly; if it passes, ASK the user before `git push --no-verify`. Never use `--no-verify` on your own.
- DB tests (need `supabase start`) and Playwright E2E are not part of the hook; they run in the `e2e` job of `.github/workflows/infra-health.yml` on every PR that changes app, DB or test files (`e2e-scope` decides; a skipped job passes the check), and again on push to main. The job takes about 25 minutes.

## Deployment Secrets & 401 Debugging

Secrets live in TWO places (Cloudflare Pages dashboard + Supabase dashboard) and drift silently. Before debugging blanket 401s on protected routes, or before adding/rotating any secret, use the **`deploy-secrets` skill** — it has the legacy-JWT-secret gotcha, the CLI verification commands, and the rotation checklist. Supabase project ref: `gxgpdlvathotgqtszabo` (already linked via supabase CLI).

## Environment Setup

Required environment variables in `.env.local`:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Testing Notes (non-obvious only)

- Database and performance tests require a local Supabase instance: run `supabase start` first. These tests use `@vitest-environment node` (bypasses CORS) with `beforeEach` cleanup; `TEST_SUPABASE_URL` / `TEST_SUPABASE_SERVICE_ROLE_KEY` default to the local instance in `vitest.config.ts`.
- Vitest global setup holds a machine-wide lock on the local Supabase stack for the whole run (it can restart the stack, and DB test cleanup deletes every booking), so a second run from any checkout or worktree logs "Waiting for vitest run …" and starts when the first ends. Watch mode (`npm test`) holds the lock until the watcher closes. Non-DB runs set `SKIP_DB_SETUP=1` (pre-push does) to skip the lock.
- Apply a new migration to the local DB with `supabase migration up --local`, never `psql -f`: `psql` writes no `schema_migrations` row, and the gap makes later `migration up` runs fail with `MigrationMissingRemoteError` (issue 243).
- Scripts read the local stack with `supabase status -o env` (never the human output), and DB types come from `npm run gen:types` (`supabase gen types --local` exits 1 on CLI v2.122.0).
- When `prod-drift` (CLI `latest`) is green on a newer CLI, bump the `setup-cli` pin in the `e2e` job of `infra-health.yml` by hand, and commit `npm run gen:types` output from that CLI (the blocking Type drift step checks it).

## Phase Suffixes

Files suffixed `.phase3-4` (plus `api/workflows.phase3-4/**` and `api/cron/*.phase3-4.*`) are excluded from TypeScript compilation and may follow older patterns — check the suffix before using one as a template.

## Known Infrastructure Issues

Check this list BEFORE debugging any test/CLI failure you did not cause. To confirm a failure is pre-existing: `git stash` (or checkout main) and re-run — if it still fails, it is infrastructure debt, not your regression.

Rules:

- Do NOT root-cause a listed issue mid-task. Cite the entry, use its documented workaround, and move on.
- If you hit a NEW pre-existing failure, add an entry here in the SAME commit as any workaround/exclusion. Unlogged "temporary" exclusions are forbidden.
- When an issue is fixed, delete its entry and re-enable whatever was disabled (grep for TEMPORARY, test.skip, test.fixme).

Current entries:

- **A fresh worktree has no `supabase/.temp/`** (gitignored), so (a) `supabase db reset` runs every storage migration, which drops the `(bucket_id, name)` unique index that the pinned storage-api still upserts on (`StorageApiError: database error, code: 42P10`), and (b) the worktree is not linked: `supabase db push` fails with `DbConfigIpv6Error`. Workaround: copy `storage-migration`, `storage-version`, `postgres-version`, `rest-version`, `gotrue-version`, `project-ref`, `pooler-url` and `linked-project.json` from the main checkout's `supabase/.temp/` into the worktree (not `start-secrets`), then reset or push again. A prod `supabase db push` runs from a checkout that has the migration: the main checkout may be on another branch.
- **PWA escape-hatch E2E flakes on desktop Chromium** — in `e2e/pwa-install-banner.spec.ts`, "account menu Install app escape hatch re-shows the banner" fails only under parallel local workers (8 of 20 on main with `--repeat-each=20`; 20 of 20 pass with `--workers=1`, and CI runs one worker, so CI is not affected). The `locator.click` on "Install app" times out with "element is outside of the viewport", because the desktop Account menu is at the foot of the scrolling nav rail. Workaround: re-run the spec with `--workers=1`.
- **`e2e/dark-mode-dashboard-settings.spec.ts` "mobile dashboard" always fails** (issue 256): its stub booking lacks `is_guest_booking` and `unit_assignment_status`, which `isPending` needs since 8830e92b, so the "waiting for verification" banner never shows. The spec is left out of `scripts/e2e/run-hooked.sh`. When fixed, add it to the chromium line there.

## Important Notes

- Read `DESIGN.md` before writing or reviewing UI (components, pages, `index.css`).
- Run `npm run verify` before committing. The pre-commit hook blocks on type and lint errors but runs no tests — passing the hook is NOT passing verify.
- Use the typed database helpers in `src/lib/supabase.ts` (`db.bookings.byId(...)`, `db.units.available()`, …) instead of raw Supabase queries where possible.
- React escapes rendered values, so XSS enters only through raw HTML: `dangerouslySetInnerHTML` is a lint error (raw HTML, if unavoidable, goes through `sanitizeRichText` with a justified disable), and any HTML email template must escape interpolated values.
- Every table has the audit trigger or is on the allowlist in `src/__tests__/database/audit-trigger-coverage.test.ts`; table writes need no app-side audit call (see `src/components/audit/CLAUDE.md`).
- Stay within free-tier quotas (Cloudflare KV / email / bandwidth): check `/api/monitoring/check-quotas` before adding chatty features; public endpoints need rate limiting.
- Financial features are INTERNAL tracking only (expense categories, receipt screenshots, simple revenue summaries for the family). Never implement tax/BIR compliance, withholding tax, official receipts, or government/regulatory reporting — if asked, flag it as out of scope (accountant + dedicated tax software territory).
- Maintain backwards compatibility when refactoring stores or types.

## Agent skills

### Issue tracker

GitHub Issues on okaeri-rh-dev/okaeri-resort-system, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default roles, label string = role name (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Long-form docs

Knowledge-base docs (audits, checklists, fix guides and implementation/verification write-ups) live in the Obsidian vault at `~/repos/personal/Obsidian/2 Areas/Okaeri Resort System/` (hub note `Okaeri Resort System.md`), not in the repo; load on demand. "vault note [[Title]]" in code or docs means `<Title>.md` in that folder. Docs that govern code (e.g. `DESIGN.md`, `docs/adr/`, `docs/plans/`) stay in the repo.
