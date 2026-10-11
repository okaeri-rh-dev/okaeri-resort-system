# Make the repo public

Goal: make the GitHub repo public so Actions runs on free public-repo minutes instead of manual deploys.

Blockers found 2026-10-11: shared test-account password in docs (owner/admin/staff logins worked on prod), and `supabase/seed.sql` is a data dump with real auth users (bcrypt hashes), sessions, refresh tokens, guests and payments, in history since 2025-10-07.

## Tasks

- [x] Remove the shared password from `docs/qa-tests/` (3f77f79)
- [x] User: delete `jasonacido+owner|admin|staff@gmail.com` on prod (2026-10-11)
- [ ] Re-run the prod login probe; all three must return `invalid_credentials`
- [x] User: revoke prod sessions for the 8 users in `seed.sql` (2026-10-11; 3 of the 8 IDs exist on prod, confirming a prod dump)
- [x] Replace `supabase/seed.sql` with synthetic data: 3 units, 2 buckets, 4 local users; verified on an isolated stack (all 4 logins, `test:db` 93/93)
- [x] Local test users come from the seed (`owner|admin|manager|staff@okaeri.test` / `test-password`), matching the e2e fixture defaults
- [ ] User: drop the `TEST_*` lines from `.env.test` (or point them at `@okaeri.test`), then `supabase db reset` the main local stack
- [ ] Full secret + PII scan of all history (`gitleaks detect`, grep for guest names/phones from the old seed); list every file to purge
- [ ] Wait until no other session has unpushed commits or uncommitted work; push `main`
- [ ] `git filter-repo --invert-paths --path supabase/seed.sql` (plus anything the scan found) on a fresh mirror clone; re-add the synthetic seed; verify with `git log --all -- supabase/seed.sql`
- [ ] Force-push all branches/tags; re-clone every local checkout and worktree (old clones would re-push the purged history)
- [ ] Move or trim docs that list open security weaknesses (guardrails "Deferred list") before the visibility switch
- [ ] Settings → Actions: require approval for fork PR workflows from outside contributors
- [ ] Switch visibility to public; confirm the next push runs `ci.yml` + deploy without billing

## Decisions & Deferrals

- Rewrite history rather than start a fresh repo — keeps the 700+ commit history; revisit if filter-repo misses something.
- History rewrite waits for parallel sessions to land their work — a force-push under an active session strands its commits.
- Test accounts deleted on prod, not just re-passworded — nothing uses them there (CI never sets `TEST_*`; `.env.test` targets local).
- Seed has no guests/bookings/payments — the old seed's payments pointed at bookings it never inserted, and DB tests create their own rows; revisit if local dev needs sample bookings.
- Seed users use the fixture defaults so e2e works without `TEST_*` env vars; the password is public by design and local-only.
