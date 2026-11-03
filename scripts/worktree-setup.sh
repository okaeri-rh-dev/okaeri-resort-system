#!/bin/sh
# Link this checkout to the prod project once after `git worktree add`.
# The link writes supabase/.temp/, which `supabase db reset` and `supabase db push` need.
set -e

project_ref=gxgpdlvathotgqtszabo

if ! supabase projects list > /dev/null 2>&1; then
  echo "Supabase CLI is not logged in (or cannot reach the API). Run: supabase login" >&2
  exit 1
fi

supabase link --project-ref "$project_ref"
