# Fast git hooks

Goal: pushes from Claude sessions must not hit the 2-min Bash timeout, and both hooks should be as fast as possible. CI (`ci.yml`) is the merge gate; hooks are fast local feedback.

## Baseline (2026-10-20, 12 CPUs, warm, Supabase up)

| Lane                                      | Wall time                                           |
| ----------------------------------------- | --------------------------------------------------- |
| pre-commit: tsc ×4 chained                | 4.7 s (root project 7.0 s cold)                     |
| pre-commit: cached ESLint, not type-aware | 1.0 s                                               |
| pre-push: type-aware ESLint, no cache     | 15.6 s, 3.2 GB peak                                 |
| pre-push: vitest non-DB                   | 18.2 s, exited 1 on 1 of 2 runs (flaky date picker) |

Not measured: the globalSetup `supabase stop/start` path when Supabase is down, and hooks under load from parallel sessions.

## Tasks

- [x] 1. `src/test/global-setup.ts`: return early when `SKIP_DB_SETUP=1`; the pre-push vitest command sets it.
- [x] 2. `src/components/ui/responsive-date-picker.tsx:194`: clear the `setTimeout` on unmount (fixes intermittent "window is not defined" after teardown).
- [x] 3. Delete the dead pool options: `threads`/`maxThreads`/`minThreads` in `vitest.config.ts` and `--poolOptions.threads.maxThreads=8` in `.husky/pre-push`.
- [x] 4. Move every `.tsbuildinfo` from `node_modules/.cache/` to `.cache/tsc/` in the checkout (already gitignored): `.husky/pre-commit`, `functions/tsconfig.json`, `tsconfig.e2e.json`, `tsconfig.tests.json`, `tsconfig.eslint.json`, `scripts/claude/stop-check.mjs`.
- [x] 5. `.husky/pre-commit`: delete the warning-only greps (sensitive patterns, `console.log`, TODO/FIXME). Keep the blocking debugger and >1 MB checks.
- [x] 6. `.husky/pre-push`: remove type-aware ESLint; run `vitest run --changed <base>` where base = `@{upstream}` if set, else `origin/main`, else full suite.
- [ ] 7. GitHub: set `allow_auto_merge: true`.
- [ ] 8. GitHub: "protect main" ruleset covers `main` and `design/foundations`; add required status checks Lint, Type-check, Unit tests, Knip; add repo-admin bypass in `pull_request` mode.
- [x] 9. CLAUDE.md: update the pre-push description (affected unit tests only; type-aware lint runs in CI), keep the long-timeout push rule, add "merge with `gh pr merge --auto --merge`".
- [ ] 10. Verify: time pre-commit and pre-push end to end (warm, and from a worktree), run `npm run verify`, open a PR and confirm auto-merge waits for the required checks.

## Decisions & Deferrals

- Keep tsc in pre-commit — costs ~5 s and pushes are the pain; moving it would slow pushes. Revisit if commits feel slow after task 4.
- Type-aware ESLint is CI-only — saves 15.6 s and CPU contention per push; safe because required checks block the merge. Revisit if type-aware errors keep landing in red PRs.
- Pre-push runs affected tests only (`--changed`) — CI runs the full suite. Revisit if a missed test reaches CI more than rarely.
- Pre-push runs the full suite when the diff touches package.json/lock, vite(st) config, tsconfig or test setup — measured: `--changed` ignored a `vitest.config.ts` + `global-setup.ts` diff ("No test files found"), so `forceRerunTriggers` does not cover it.
- `SKIP_DB_SETUP` env flag, not a separate vitest DB project — smaller change. Revisit when the "Vitest global setup stops Supabase" infra issue is fixed properly.
- No `maxForks` limit — forks already use all cores. Revisit if end-to-end timing shows contention.
- npm audit is not a required check — upstream advisories would block unrelated merges. It still runs on every PR.
- Admin bypass in `pull_request` mode only — hotfixes go through a PR; direct pushes still need checks.
- Auto-merge uses merge commits — matches existing history.
- Keep the "never push at the 2-min default" rule in CLAUDE.md — a full vitest run under load can still take minutes.
