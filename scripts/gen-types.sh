#!/bin/sh
# Regenerate src/types/database.generated.ts from the local Supabase database
# (supabase start applies every migration, so this reflects supabase/migrations).
# Uses --db-url because `supabase gen types --local` fails (v2.109.1: password
# auth; v2.122.0: exit 1 with no message).
set -e

db_url=$(supabase status -o env | sed -n 's/^DB_URL="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p')
if [ -z "$db_url" ]; then
  echo "Local Supabase is not running. Run: supabase start" >&2
  exit 1
fi

supabase gen types typescript --db-url "$db_url" > src/types/database.generated.ts
npx prettier --write src/types/database.generated.ts > /dev/null
