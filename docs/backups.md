# Backups

Free Supabase has no backups. `.github/workflows/nightly-backup.yml` runs daily at 18:00 UTC (02:00 PHT) and on manual dispatch. It dumps the prod database (roles, schema, data) and copies the `payment-proofs` and `receipts` buckets. It encrypts each file with `age` on the runner and uploads only the `.age` files to Cloudflare R2 under `<bucket>/<YYYY-MM-DD>/`:

- `roles.sql.age`, `schema.sql.age`, `data.sql.age`: `supabase db dump` output.
- `storage.tar.age`: one folder per bucket.

A failed step fails the run, and GitHub emails the owner.

The manual `supabase db dump` before each prod `db push` still applies.

## Retention

The R2 lifecycle rule deletes backups after 30 days. A backup keeps guest data for up to 30 days after guest anonymization, audit anonymization or payment-proof cleanup removes it from prod. An erasure request is complete only when the last backup taken before it expires.

## Setup (human)

1. Create a private R2 bucket. Add a lifecycle rule on it: delete objects 30 days after upload.
2. Create an R2 API token with Object Read & Write on that bucket only.
3. In Supabase, Storage > S3 Configuration, create an S3 access key.
4. Make the key pair on your machine: `age-keygen -o okaeri-backup.key`. Keep the key file off GitHub and off this repo, for example in a password manager. Its public key is the `# public key:` line.
5. Add these GitHub Actions secrets (Settings > Secrets and variables > Actions):

| Secret                          | Value                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `BACKUP_DB_URL`                 | Prod **session pooler** URL (Supabase > Connect > Session pooler). Runners have no IPv6 for the direct host. |
| `BACKUP_AGE_RECIPIENT`          | The `age1…` public key                                                                                       |
| `R2_ACCOUNT_ID`                 | Cloudflare account ID                                                                                        |
| `R2_ACCESS_KEY_ID`              | R2 token access key ID                                                                                       |
| `R2_SECRET_ACCESS_KEY`          | R2 token secret access key                                                                                   |
| `R2_BUCKET`                     | R2 bucket name                                                                                               |
| `SUPABASE_S3_ACCESS_KEY_ID`     | Supabase S3 access key ID                                                                                    |
| `SUPABASE_S3_SECRET_ACCESS_KEY` | Supabase S3 secret access key                                                                                |

6. Run Actions > Nightly Backup > Run workflow. The last step lists the four files in R2.

## Restore into the local stack

The restore script refuses any target except the local stack. It runs `supabase db reset --local --no-seed`, so it wipes local data. The schema comes from the local migrations, because `schema.sql` has no storage policies. `schema.sql` is for a restore into a new Supabase project (Supabase guide: "Restore dashboard backup").

```sh
rclone copy r2:<bucket>/<YYYY-MM-DD> ./backup  # any S3 client works
supabase start
scripts/restore-backup.sh ./backup okaeri-backup.key
```

The script prints row counts for bookings, guests, auth users and storage objects per bucket. Delete `./backup` after use: it is encrypted, but the key opens it.
