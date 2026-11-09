# Legacy Deployment Checklist

This file was the manual runbook for legacy migrations 016 and 017 (commit range `f3da057` → `bdc7547`). Its docs were written on 2025-10-07. The steps no longer apply: the project moved to the Supabase CLI, and `supabase/migrations/` is the only source of truth (see `MIGRATION-INDEX.md`).

To deploy a migration to prod now:

1. Dump the linked prod database first. The free Supabase plan has no backups.
2. Run `supabase db push` from a checkout that has the migration (see `CLAUDE.md`, "Testing Notes").
