# Legacy Migration Index

The SQL files in this folder were applied by hand with `psql` before the project moved to the Supabase CLI. `README.md` here marked the folder legacy on 2025-11-04. They are history. Do not run them: the schema they built is in `supabase/migrations/`, which is the only source of truth.

To change the schema now, add a migration with `supabase migration new <name>`, apply it locally with `supabase migration up --local`, and push it to prod with `supabase db push` (see `CLAUDE.md`).

## Files

| Files       | Topic                                                                             |
| ----------- | --------------------------------------------------------------------------------- |
| 001–004     | Payment status, unit types, guest statistics triggers, occupancy pricing          |
| 005–011     | Audit logs: table, triggers, indexes, archive, RLS, admin bootstrap, verification |
| 012         | Fix for RLS recursion on `app_roles`                                              |
| 013–015     | Guest booking schema, exclusion constraint, conflict backup table                 |
| 016–017     | Helper function stability and grants for `authenticated`                          |
| 018         | Wipe of production test data                                                      |
| 019–021     | Multi-unit booking schema, public availability function, timezone hotfix          |
| 022–024     | Security constraints, cleanup functions, financial accounts                       |
| `rollback/` | Rollbacks for 001–003                                                             |

The `.sh` scripts and the other Markdown files here belong to the same manual process. `DEPLOYMENT-CHECKLIST.md` was the runbook for 016–017.
