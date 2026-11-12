#!/usr/bin/env bash
# Restore a nightly backup (.github/workflows/nightly-backup.yml) into the local stack.
# Usage: scripts/restore-backup.sh <backup-dir> <age-identity-file>
# The schema comes from the local migrations; schema.sql is only decrypted as a check,
# because it has no storage policies. This wipes the local database. See docs/backups.md.
set -euo pipefail

if [ $# -ne 2 ]; then
  echo "Usage: $0 <backup-dir> <age-identity-file>" >&2
  exit 1
fi
backup_dir=$1
identity=$2

for tool in age rclone psql supabase; do
  command -v "$tool" > /dev/null || { echo "Missing tool: $tool" >&2; exit 1; }
done

cd "$(dirname "$0")/.."
eval "$(supabase status -o env)"
for url in "$DB_URL" "$STORAGE_S3_URL"; do
  case "$url" in
    *://*@127.0.0.1:* | *://*@localhost:* | http://127.0.0.1:* | http://localhost:*) ;;
    *) echo "Refusing to restore into a non-local target: $url" >&2; exit 1 ;;
  esac
done

# The postgres role cannot write every auth and storage table; the local superuser can.
admin_url=${DB_URL/postgres:postgres@/supabase_admin:postgres@}

work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT

for name in roles.sql schema.sql data.sql storage.tar; do
  age -d -i "$identity" -o "$work_dir/$name" "$backup_dir/$name.age"
done

supabase db reset --local --no-seed

# No ON_ERROR_STOP: the migrations already create some roles, so CREATE ROLE can fail on them.
psql "$admin_url" -q -f "$work_dir/roles.sql"

# Migrations seed some rows (storage buckets, pricing); the backup replaces every table it holds.
tables=$(grep -oE '^COPY "[^"]+"\."[^"]+"' "$work_dir/data.sql" | cut -c6- | paste -sd, -)
psql "$admin_url" -q -v ON_ERROR_STOP=1 --single-transaction \
  -c "TRUNCATE $tables CASCADE" \
  -f "$work_dir/data.sql"

mkdir "$work_dir/storage"
tar -C "$work_dir/storage" -xf "$work_dir/storage.tar"
export RCLONE_CONFIG_LOCAL_TYPE=s3
export RCLONE_CONFIG_LOCAL_PROVIDER=Other
export RCLONE_CONFIG_LOCAL_ENDPOINT=$STORAGE_S3_URL
export RCLONE_CONFIG_LOCAL_REGION=$S3_PROTOCOL_REGION
export RCLONE_CONFIG_LOCAL_FORCE_PATH_STYLE=true
export RCLONE_CONFIG_LOCAL_ACCESS_KEY_ID=$S3_PROTOCOL_ACCESS_KEY_ID
export RCLONE_CONFIG_LOCAL_SECRET_ACCESS_KEY=$S3_PROTOCOL_ACCESS_KEY_SECRET
shopt -s nullglob
for bucket_dir in "$work_dir"/storage/*/; do
  # Supabase reserves this name for dashboard folders; its row is already in data.sql.
  rclone copy "$bucket_dir" "local:$(basename "$bucket_dir")" --exclude .emptyFolderPlaceholder
done

psql "$DB_URL" -c "
  SELECT 'bookings' AS restored, count(*) FROM public.bookings
  UNION ALL SELECT 'guests', count(*) FROM public.guests
  UNION ALL SELECT 'auth users', count(*) FROM auth.users
  UNION ALL SELECT 'storage objects: ' || bucket_id, count(*) FROM storage.objects GROUP BY bucket_id"
