---
name: deploy-secrets
description: Deployment secrets for okaeri-resort — Cloudflare Pages + Supabase env vars, the secret-rotation checklist, and debugging blanket 401 "Invalid or expired token" on protected routes. Use before adding/rotating any secret (SUPABASE_JWT_SECRET, CRON_SECRET, ...), after any wrangler pages secret change, or when every protected endpoint suddenly returns 401.
---

# Deployment Environment Variables & Secrets

Secrets live in TWO places (Cloudflare Pages dashboard + Supabase dashboard) and drift silently. Verify with CLI first — never ask the user to hand-copy dashboard lists:

```bash
npx wrangler pages secret list --project-name okaeri-resort      # prod secret NAMES (Cloudflare Pages)
npx wrangler pages deployment list --project-name okaeri-resort  # was there a deploy AFTER the secret change?
grep -rhoE 'env\.[A-Z_]+' functions --include='*.ts' | sort -u   # vars the code actually requires
```

Supabase project ref: `gxgpdlvathotgqtszabo` (already linked via supabase CLI).

## Gotchas (learned the hard way)

- **SUPABASE_JWT_SECRET must be the LEGACY JWT secret** (Supabase dashboard > Settings > API > JWT Settings, HS256), NOT the new JWT signing keys. `_middleware.ts` verifies HS256; a signing-key value causes blanket 401 `Invalid or expired token` on every protected route (e.g. multi-unit booking) while direct-to-Supabase flows still work.
- **If SUPABASE_JWT_SECRET is unset, middleware rejects ALL protected requests** — a missing secret looks identical to an expired token.
- **Cloudflare Pages secrets take effect only on the NEXT deployment.** After any `wrangler pages secret put` or dashboard edit, redeploy: `git commit --allow-empty -m "chore: redeploy to pick up secret" && git push` (or dashboard > Retry deployment).

## Secret-rotation checklist

1. `git log --oneline -10 -- functions/` — rule out recent code changes before blaming secrets.
2. `npx wrangler pages secret list --project-name okaeri-resort` — confirm the name exists in prod.
3. Update the value: `npx wrangler pages secret put <NAME> --project-name okaeri-resort` (also update `.dev.vars` and, for CRON_SECRET, the GitHub Actions secret).
4. Redeploy (empty commit or Retry deployment) — step 3 alone changes nothing live.
5. Verify: probe the previously failing endpoint and expect 200, not 401.
