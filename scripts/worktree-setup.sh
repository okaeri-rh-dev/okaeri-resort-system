#!/bin/sh
# Make a new worktree ready to work in: env files, dependencies, the route tree,
# and the Supabase link that `supabase db reset` and `supabase db push` need.
set -e

project_ref=gxgpdlvathotgqtszabo
main_checkout=$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")

for env_file in .env.local .env.test .dev.vars .envrc; do
  if [ ! -e "$env_file" ] && [ -e "$main_checkout/$env_file" ]; then
    cp "$main_checkout/$env_file" "$env_file"
  fi
done

npm ci
npm run generate:routes

if [ -d supabase/.temp ]; then
  exit 0
fi

if [ -f "$main_checkout/supabase/.temp/project-ref" ]; then
  cp -R "$main_checkout/supabase/.temp" supabase/.temp
  exit 0
fi

if ! supabase projects list > /dev/null 2>&1; then
  echo "Supabase CLI is not logged in (or cannot reach the API). Run: supabase login" >&2
  exit 1
fi

supabase link --project-ref "$project_ref"
