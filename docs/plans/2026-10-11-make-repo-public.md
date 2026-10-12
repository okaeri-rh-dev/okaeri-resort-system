# Make the repo public

Goal: make the GitHub repo public so Actions runs on free public-repo minutes instead of manual deploys.

Blockers found 2026-10-11: shared test-account password in docs (owner/admin/staff logins worked on prod), and `supabase/seed.sql` is a data dump with real auth users (bcrypt hashes), sessions, refresh tokens, guests and payments, in history since 2025-10-07.

## Tasks

- [x] Remove the shared password from `docs/qa-tests/` (3f77f79)
- [x] User: delete `jasonacido+owner|admin|staff@gmail.com` on prod (2026-10-11)
- [x] Re-run the prod login probe; all three must return `invalid_credentials` (2026-10-11: all three did)
- [x] User: revoke prod sessions for the 8 users in `seed.sql` (2026-10-11; 3 of the 8 IDs exist on prod, confirming a prod dump)
- [x] Replace `supabase/seed.sql` with synthetic data: 3 units, 2 buckets, 4 local users; verified on an isolated stack (all 4 logins, `test:db` 93/93)
- [x] Local test users come from the seed (`owner|admin|manager|staff@okaeri.test` / `test-password`), matching the e2e fixture defaults
- [x] User: drop the `TEST_*` lines from `.env.test` (or point them at `@okaeri.test`), then `supabase db reset` the main local stack
- [x] Full secret + PII scan of all history (2026-10-11, gitleaks 8.30.1: 141 hits, all placeholders, local defaults, md5 checksums or fake test tokens; old-seed emails/phones appear nowhere else except the owner's own email and sample numbers). Purge list: `supabase/seed.sql` only
- [x] Wait until no other session has unpushed commits or uncommitted work; push `main` (a95cbf7)
- [x] `git filter-repo --strip-blobs-with-ids` for the 3 old seed blobs on a bare clone; main tree unchanged (42e3de49), gitleaks 0 hits in `seed.sql`
- [x] Old repo renamed to `okaeri-resort-system-archive` (private, Actions off); new private `okaeri-resort-system` holds the rewritten `main` (c759e2d); `jrga03` added as collaborator
- [x] New repo secrets: the 7 the workflows use; `CRON_SECRET` and the `drift_reader` password rotated, new Cloudflare API token
- [x] Local checkout moved to `../okaeri-resort-system-archive` (origin repointed to the archive); fresh clone at the original path with local env files copied
- [x] User: run the `alter role drift_reader password` SQL on prod (proven by `prod-drift` success, run 38196613733)
- [x] User: enable Actions on the new repo (2026-10-12; runs still blocked by the private-repo minutes quota until public)
- [x] Manual deploy of c759e2d (deployment `d3b745da-2d36-406e-8668-7523a98e4a87`; rollback `923ceccb-ebb1-4e17-8c64-1d7f56ea0d10` = 79396f4); live entry `index-BGcGYCc4.js`, `/api/health` 200
- [x] Fix `audit_logs` forged inserts (guardrails Deferred list #1): migration `20261012000000_audit_logs_block_client_writes.sql` + `audit-logs-write-lockdown.test.ts` (585b7f0); local `test:db` 102/102, `verify` exit 0; pushed to prod 2026-10-12
- [x] User: confirm prod grants on `audit_logs`/`audit_logs_archive` (2026-10-12: `REFERENCES,SELECT,TRIGGER` for `anon`/`authenticated`; no write privileges)
- [x] Correct the stale "P0 is only half-closed" line in `docs/whole-app-audit-2026-07-21.md` (8cfd2c1)
- [ ] User: Settings → Actions → require approval for fork PR workflows from all outside collaborators (only possible once public; still `first_time_contributors` on 2026-10-12)
- [x] After going public: `Scheduled Cleanup Tasks` idempotency run HTTP 200 (run 38196269890); `infra-health` all jobs green on 0b07ca5 after dropping 4 fixed baseline entries
- [ ] User: delete the old Cloudflare API token once the first deploy succeeds
- [ ] User: change passwords of the 3 prod accounts whose hashes were in the old seed
- [x] Switch visibility to public (2026-10-12); push of 7eb529b ran the quality gate + deploy without billing (deployment ed4c2244, `/api/health` 200)

## Decisions & Deferrals

- Rewritten history goes into a fresh repo, not a force-push — the 11 Dependabot PR refs (`refs/pull/*`) still reach the old seed and only GitHub Support can delete them; the fresh repo keeps the name, so remotes and URLs are unchanged.
- Cloudflare unaffected by the repo swap — Pages project `okaeri-resort` is Direct Upload (Git Provider: No), deploys come from `wrangler pages deploy` with the API token.
- Prod still carried the 2025 `GRANT ALL` on the audit tables (anon could insert with `user_id` NULL until 2026-10-12); leftover `REFERENCES`/`TRIGGER` grants are unusable without DDL access, so revoking them is deferred — revisit with the next grants or drift-baseline migration.
- Fix forged `audit_logs` inserts before going public; don't trim the open-weakness docs — the migrations show the same thing, and the docs are working notes.
- Only the 7 secrets the workflows reference were re-added — the other 6 (incl. `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY`) were unused in Actions.
- History rewrite waits for parallel sessions to land their work — a force-push under an active session strands its commits.
- Test accounts deleted on prod, not just re-passworded — nothing uses them there (CI never sets `TEST_*`; `.env.test` targets local).
- Seed has no guests/bookings/payments — the old seed's payments pointed at bookings it never inserted, and DB tests create their own rows; revisit if local dev needs sample bookings.
- Seed users use the fixture defaults so e2e works without `TEST_*` env vars; the password is public by design and local-only.
