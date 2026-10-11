---
name: deploy-production
description: Production deploy of okaeri-resort to Cloudflare Pages. Use when the user asks to deploy or ship to production, when a push to main did not deploy (the "Deploy to Cloudflare Pages" run failed or was skipped), or when GitHub Actions is blocked by the billing/minutes quota.
---

# Production deploy

Production is the Cloudflare Pages project `okaeri-resort` (https://okaeri-resort.pages.dev). The normal path is CI: a push to `main` runs `deploy-cloudflare.yml`, which deploys only after the `ci.yml` quality gate passes. Docs-only pushes (`docs/**`, `**/*.md`) skip the deploy.

The manual path exists for when CI cannot run. Actions minutes bill to the `okaeri-rh-dev` account (2,000/month, $0 budget); once exhausted, every job fails in ~3s with "recent account payments have failed or your spending limit needs to be increased". The user waits for the monthly reset rather than adding a budget.

The agent prepares and verifies; **the user runs the deploy command**. `scripts/claude/bash-guard.mjs` blocks `wrangler pages deploy` and `npm run deploy` for the agent, by design. Hand the user the command.

## 1. Choose the path

```bash
gh run list --workflow=deploy-cloudflare.yml -L 3
```

- Latest run for the target commit succeeded → it is already deployed; skip to step 6 to confirm.
- Run is in progress or Actions works → push to `main` and let CI deploy.
- Run failed in seconds on the quota error, or the user wants it live now → manual path, steps 2-7.

Done when: the path is chosen and the user knows which one and why.

## 2. Pin the target and the rollback

The target is a commit already on `origin/main` (`git fetch origin && git rev-parse --short origin/main`). Deploying unpushed work makes production differ from the repo.

```bash
npx wrangler pages deployment list --project-name okaeri-resort | head -8
```

Record the current top Production deployment ID and commit: that is the rollback target (Cloudflare dashboard > okaeri-resort > Deployments > the row > Rollback).

Done when: target SHA and rollback deployment ID are both written down.

## 3. Build from a clean worktree

Build in a detached worktree holding **only** `.env.production`. The main checkout's `.env.local` sets `VITE_SKIP_TURNSTILE=true` and a `127.0.0.1` Supabase URL; Vite bakes any `.env.local` into a production build, which would ship a local backend and disabled captcha.

```bash
SHA=$(git rev-parse --short origin/main)
WT="$SCRATCHPAD/deploy-$SHA"            # the session scratchpad directory
git worktree add --detach "$WT" "$SHA"
cp .env.production "$WT/"
cd "$WT" && npm ci && npm run generate:routes
```

Done when: `ls -a "$WT" | grep '^\.env'` prints exactly `.env.production`.

## 4. Run the full quality gate

Every job in `ci.yml`, in the worktree, each exiting 0:

```bash
npm run lint
npm run type-check
npm run test:no-db
npm run knip
npm audit --omit=dev --audit-level=high
```

Done when: all five exit 0. A failure stops the deploy; report it with the output.

## 5. Build and inspect the bundle

```bash
npm run build:full
grep -l 'gxgpdlvathotgqtszabo.supabase.co' dist/assets/*.js | head -3   # must print files
grep -lE '127\.0\.0\.1|localhost:54321' dist/assets/*.js               # must print nothing
ls dist/functions | head                                              # Pages functions built
grep -oE 'assets/index-[^"]+\.js' dist/index.html                     # note the entry file
```

Done when: prod host present, local host absent, `dist/functions` populated, and the entry filename recorded.

## 6. User deploys, agent verifies

Give the user this, with the real path and SHA filled in:

```
! cd <WT> && npx wrangler pages deploy dist --project-name=okaeri-resort --branch=main --commit-hash=<SHA>
```

After they run it:

```bash
npx wrangler pages deployment list --project-name okaeri-resort | head -6        # top row: Production, main, <SHA>
curl -s https://okaeri-resort.pages.dev/ | grep -oE 'assets/index-[^"]+\.js'     # equals the step 5 entry
curl -s -o /dev/null -w '%{http_code}\n' https://okaeri-resort.pages.dev/api/health  # 200
```

Done when: all three match, quoted in the report. A mismatch means the deploy is not live; report it and give the rollback ID.

## 7. Clean up and record

```bash
cd <repo root> && git worktree remove "$WT" && git worktree prune && pwd
```

Confirm the exit code and that the shell is back in the repo. Record the deploy in the active plan doc's `## Decisions & Deferrals`: deployment ID, commit, rollback ID.

Done when: worktree gone, plan doc updated.

## Related

- New or rotated secrets, or blanket 401s after a deploy: the `deploy-secrets` skill.
- Deploys run no migrations. If the target commit needs a schema change, the user runs `supabase db push` first, then deploys.
