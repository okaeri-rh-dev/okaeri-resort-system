# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. It intentionally contains only what a fresh session cannot derive from the codebase — commands live in `package.json` scripts, structure comes from the source tree, and coding patterns come from the existing code.

## Pushing to Remote

- `.husky/pre-push` runs lint + the unit suite and can take several minutes. **Never run `git push` at the default 2-minute Bash timeout** — the hook gets killed (exit 143) and the push does NOT complete. Either:
  1. Run with an explicit long timeout (`timeout: 600000`), or
  2. Run with `run_in_background: true` and monitor until it exits.
- After every push, verify it landed before reporting success: `git fetch origin && git rev-parse HEAD origin/main` — the two hashes must match. A started hook is not a completed push.
- If the hook fails or hangs on pre-existing/unrelated failures: run `npm run verify` directly; if it passes, ASK the user before `git push --no-verify`. Never use `--no-verify` on your own.
- DB tests (need `supabase start`) and Playwright E2E are not part of the hook; they run in CI (`.github/workflows/infra-health.yml`) and explicitly when relevant.

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

## Phase Suffixes

Files suffixed `.phase3-4` (plus `api/workflows.phase3-4/**` and `api/cron/*.phase3-4.*`) are excluded from TypeScript compilation and may follow older patterns — check the suffix before using one as a template.

## Known Infrastructure Issues

Check this list BEFORE debugging any test/CLI failure you did not cause. To confirm a failure is pre-existing: `git stash` (or checkout main) and re-run — if it still fails, it is infrastructure debt, not your regression.

Rules:

- Do NOT root-cause a listed issue mid-task. Cite the entry, use its documented workaround, and move on.
- If you hit a NEW pre-existing failure, add an entry here in the SAME commit as any workaround/exclusion. Unlogged "temporary" exclusions are forbidden.
- When an issue is fixed, delete its entry and re-enable whatever was disabled (grep for TEMPORARY, test.skip, test.fixme).

Current entries:

- **Supabase CLI output parsing** — helper scripts that regex `supabase status` human output break on CLI upgrades (bit household-hub at v2.105.0). Any new script must use `supabase status -o env` (machine-readable) instead. Known-good CLI version at last check: v2.101.0.
- **`supabase gen types --local` fails password auth** (CLI v2.109.1: `password authentication failed for user "postgres"`; v2.119.0 exits 1 with no message). Workaround: `npm run gen:types`, which passes `--db-url` from `supabase status -o env`.

## Important Notes

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

Audits, checklists, fix guides and implementation/verification write-ups live in the Obsidian vault at `~/repos/personal/Obsidian/2 Areas/Okaeri Resort System/` (hub note `Okaeri Resort System.md`), not in the repo; load on demand. "vault note [[Title]]" in code or docs means `<Title>.md` in that folder.
