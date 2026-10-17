---
name: stack-down
description: Stop the local dev stack — the Vite + wrangler dev server and every okaeri-resort Supabase Docker container. Use when the user asks to bring the local stack down, shut it down, or free its ports and containers.
---

# Local stack down

Scope is this project only: other projects' Supabase stacks (e.g. household-hub) and Docker Desktop itself keep running.

1. **Dev server.** If this session started `npm run dev:cf` as a background task, stop it with TaskStop. Then free any remaining listeners: `lsof -ti tcp:5173,8788 -sTCP:LISTEN | xargs -r kill`. Done when `lsof -nP -iTCP:5173,8788 -sTCP:LISTEN` prints nothing.

2. **Supabase containers.** Run `supabase stop --project-id okaeri-resort`. This removes the containers and keeps the data volumes, so the next `supabase start` comes back with the same data. Wiping data (`--no-backup`) or stopping every project (`--all`) happens only when the user asks for it.

3. **Verify containers.** `docker ps -a --filter label=com.supabase.cli.project=okaeri-resort --format '{{.Names}} {{.Status}}'` must print nothing. If any remain, stop them with `docker ps -q --filter label=com.supabase.cli.project=okaeri-resort | xargs -r docker stop`, then re-check.

Report the evidence: empty port check and empty container list.
