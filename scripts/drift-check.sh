#!/bin/sh
# Weekly prod drift check: diff the public-schema catalog of the local database
# (built from supabase/migrations by `supabase start`) against prod.
# Differences already listed in scripts/drift/baseline.txt are known drift.
# Fails on new drift and on baseline entries that no longer differ.
#
# Needs `supabase start` and psql. Prod is read through SUPABASE_DRIFT_DB_URL (drift_reader
# role, used in CI) or, when it is unset, `supabase db query --linked` (local, needs supabase login).
# Rebuild the baseline after fixing or accepting drift: sh scripts/drift-check.sh --write-baseline
set -eu

fingerprint_sql=scripts/drift/catalog-fingerprint.sql
baseline=scripts/drift/baseline.txt

local_db_url=$(supabase status -o env | sed -n 's/^DB_URL="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p')
if [ -z "$local_db_url" ]; then
  echo "Local Supabase is not running. Run: supabase start" >&2
  exit 1
fi

work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT

fingerprint() {
  psql "$1" -X -q -A -t -v ON_ERROR_STOP=1 -f "$fingerprint_sql" -o "$2.unsorted"
  LC_ALL=C sort "$2.unsorted" > "$2"
}

fingerprint "$local_db_url" "$work_dir/local"
if [ -n "${SUPABASE_DRIFT_DB_URL:-}" ]; then
  fingerprint "$SUPABASE_DRIFT_DB_URL" "$work_dir/prod"
else
  supabase db query --linked -f "$fingerprint_sql" --output-format json > "$work_dir/prod.json"
  jq -r '.rows[].line' "$work_dir/prod.json" | LC_ALL=C sort > "$work_dir/prod"
fi
if [ ! -s "$work_dir/prod" ]; then
  echo "Prod fingerprint is empty; refusing to compare." >&2
  exit 1
fi

{
  LC_ALL=C comm -23 "$work_dir/local" "$work_dir/prod" | sed 's/^/local-only /'
  LC_ALL=C comm -13 "$work_dir/local" "$work_dir/prod" | sed 's/^/prod-only /'
} | LC_ALL=C sort > "$work_dir/drift"

if [ "${1:-}" = "--write-baseline" ]; then
  {
    echo "# Known prod drift: lines from scripts/drift-check.sh that are expected to differ."
    echo "# Keep reasons as comments above each group. Delete lines once the drift is fixed."
    cat "$work_dir/drift"
  } > "$baseline"
  echo "Wrote $(wc -l < "$work_dir/drift" | tr -d ' ') drift lines to $baseline"
  exit 0
fi

touch "$work_dir/known"
if [ -f "$baseline" ]; then
  grep -v -e '^#' -e '^$' "$baseline" | LC_ALL=C sort > "$work_dir/known"
fi
LC_ALL=C comm -23 "$work_dir/drift" "$work_dir/known" > "$work_dir/new"
LC_ALL=C comm -13 "$work_dir/drift" "$work_dir/known" > "$work_dir/stale"

status=0
if [ -s "$work_dir/new" ]; then
  echo "New drift between migrations (local-only) and prod (prod-only):"
  cat "$work_dir/new"
  echo "A local-only 'migration <version>' line means it was never pushed: supabase db push."
  status=1
fi
if [ -s "$work_dir/stale" ]; then
  echo "Baseline entries that no longer differ (drift fixed; delete them from $baseline):"
  cat "$work_dir/stale"
  status=1
fi
if [ "$status" -eq 0 ]; then
  echo "No new drift ($(wc -l < "$work_dir/known" | tr -d ' ') known lines in $baseline)."
fi
exit "$status"
