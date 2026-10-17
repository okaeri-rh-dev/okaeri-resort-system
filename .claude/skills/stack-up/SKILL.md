---
name: stack-up
description: Start the local dev stack — Docker, the okaeri-resort Supabase containers, and the Vite + wrangler dev server. Use when the user asks to bring the local stack up, or before E2E runs, DB tests, or browsing the app locally when nothing answers on :5173 or :54321.
---

# Local stack up

The local stack is three layers, started in order. Each step is idempotent: check first, start only what is missing.

1. **Docker.** If `docker info >/dev/null 2>&1` fails, run `open -a Docker` and wait until `docker info` succeeds (poll with Monitor or a backgrounded `until docker info >/dev/null 2>&1; do sleep 2; done`).

2. **Supabase.** Run `supabase start` from the repo root with `timeout: 600000` (first start pulls images). An "already running" message is success. Done when `supabase status -o env` prints `API_URL="http://127.0.0.1:54321"`.

3. **Dev server.** If `lsof -nP -iTCP:5173 -sTCP:LISTEN` already shows a listener, skip. Otherwise run `npm run dev:cf` with `run_in_background: true`; it runs Vite on :5173, which proxies `/api` to wrangler on :8788. Done when both `curl -s -o /dev/null -w '%{http_code}' http://localhost:5173` and the same for `:8788` return an HTTP status (not `000`).

Report the URLs: app http://localhost:5173, Studio http://127.0.0.1:54323, Mailpit http://127.0.0.1:54324.

## Gotchas

- Wrangler reads secrets from `.dev.vars`. In a fresh worktree, copy `.dev.vars`, `.env.local`, `.env.test` and `.envrc` from the main checkout first; without `.dev.vars` login breaks and E2E times out in `beforeEach`.
- `concurrently --kill-others` ties Vite and wrangler together: if either exits, both stop. Read the background task output for the failing one.
- Other projects' Supabase stacks (e.g. household-hub) may share Docker; their containers are unrelated and stay as they are.
