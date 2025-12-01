# Local Supabase Development Setup

## Overview

This guide shows you how to set up and use Supabase locally for development, allowing you to test database changes, migrations, and API endpoints without affecting your production environment.

---

## Prerequisites

### 1. Docker Desktop

Supabase CLI uses Docker to run local containers for Postgres, PostgREST, GoTrue, and other services.

**Install Docker Desktop:**

- **macOS**: Download from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)
- **Windows**: Download from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)
- **Linux**: Follow [docs.docker.com/engine/install](https://docs.docker.com/engine/install/)

**Verify Docker is running:**

```bash
docker --version
# Docker version 24.0.0 or higher
```

### 2. Supabase CLI

**Install via npm (recommended for this project):**

```bash
npm install supabase --save-dev
```

**Alternative installation methods:**

```bash
# macOS (Homebrew)
brew install supabase/tap/supabase

# Windows (Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Linux packages
# Download from: https://github.com/supabase/cli/releases
```

**Verify installation:**

```bash
npx supabase --version
# 1.x.x or higher
```

---

## Understanding Your Existing Setup

Your project already has Supabase configured:

```
okaeri-resort/
├── supabase/                       # Local Supabase configuration
│   ├── config.toml                 # Services configuration
│   ├── migrations/                 # Database migrations
│   │   └── 20251006093452_remote_schema.sql
│   └── seed.sql                    # (optional) Seed data
├── database/                       # Schema documentation
│   ├── schema.sql                  # Core schema definition
│   ├── enable-rls.sql              # RLS policies
│   └── migrations/                 # Alternative migration location
└── .env.local                      # Environment variables
```

### Key Files

**`supabase/config.toml`**

- Defines local service configuration (ports, features, auth settings)
- Already configured with:
  - API port: `54321`
  - Database port: `54322`
  - Studio (dashboard) port: `54323`
  - Postgres version: `17`

**`supabase/migrations/`**

- Contains timestamped SQL migration files
- Automatically applied when starting local Supabase

---

## Starting Local Supabase

### 1. Start All Services

```bash
npx supabase start
```

This command will:

1. Pull Docker images (first time only, ~2-3 minutes)
2. Start Postgres database
3. Start API server (PostgREST)
4. Start Auth server (GoTrue)
5. Start Storage server
6. Start Realtime server
7. Start Studio (web dashboard)
8. Apply all migrations from `supabase/migrations/`

**Expected output:**

```
Started supabase local development setup.

         API URL: http://127.0.0.1:54321
     GraphQL URL: http://127.0.0.1:54321/graphql/v1
  S3 Storage URL: http://127.0.0.1:54321/storage/v1/s3
          DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      Studio URL: http://127.0.0.1:54323
    Inbucket URL: http://127.0.0.1:54324
      JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
        anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   S3 Access Key: 625729a08b95bf1b7ff351a663f3a23c
   S3 Secret Key: 850181e4652dd023b7a98c58ae0d2d34bd487ee0cc3254aed6eda37307425907
       S3 Region: local
```

### 2. Access Local Services

| Service      | URL                                                     | Purpose                         |
| ------------ | ------------------------------------------------------- | ------------------------------- |
| **Studio**   | http://127.0.0.1:54323                                  | Database management UI          |
| **API**      | http://127.0.0.1:54321                                  | REST API endpoint               |
| **Database** | postgresql://postgres:postgres@127.0.0.1:54322/postgres | Direct Postgres connection      |
| **Inbucket** | http://127.0.0.1:54324                                  | Email testing (catch-all inbox) |

### 3. Stop Services

```bash
npx supabase stop
```

To stop and remove all containers (clean slate):

```bash
npx supabase stop --no-backup
```

---

## Linking to Remote Supabase

Link your local environment to your production Supabase project for pulling/pushing migrations.

### 1. Get Project Reference

From Supabase Dashboard:

1. Go to **Project Settings** → **General**
2. Copy **Project ID** (e.g., `xyzabcdefgh`)

### 2. Create Access Token

From Supabase Dashboard:

1. Go to **Account Settings** → **Access Tokens**
2. Click **Generate New Token**
3. Copy the token (starts with `sbp_`)

### 3. Link Project

```bash
npx supabase link --project-ref <your-project-id>
```

You'll be prompted for:

- **Database password**: Get from **Project Settings** → **Database** → **Connection String**
- Access token: Paste the token you created

**Set environment variable to avoid password prompt:**

```bash
export SUPABASE_DB_PASSWORD='your_database_password'
npx supabase link --project-ref <your-project-id>
```

### 4. Verify Link

```bash
npx supabase status
```

---

## Working with Migrations

### Pull Remote Schema

Pull the current production schema into a new migration file:

```bash
npx supabase db pull
```

This creates a new migration file in `supabase/migrations/` with the current remote schema.

**Example output:**

```
Connecting to remote database...
Schema written to supabase/migrations/20251006120000_remote_schema.sql
Update remote migration history table? [Y/n] Y
Finished supabase db pull.
```

### Create New Migration

```bash
npx supabase migration new add_weekend_pricing
```

This creates an empty migration file:

```
supabase/migrations/20251006120530_add_weekend_pricing.sql
```

Edit the file with your SQL:

```sql
-- Add weekend_rate column to units table
ALTER TABLE units
  ADD COLUMN weekend_rate decimal(10,2);

ALTER TABLE units
  ADD CONSTRAINT valid_weekend_rate
  CHECK (weekend_rate IS NULL OR weekend_rate > 0);

CREATE INDEX idx_units_weekend_rate ON units(weekend_rate)
  WHERE weekend_rate IS NOT NULL;
```

### Apply Migrations Locally

```bash
# Reset local database (applies all migrations)
npx supabase db reset
```

This will:

1. Drop the local database
2. Recreate it
3. Apply all migrations in order
4. Run seed file (`supabase/seed.sql`) if it exists

**Alternatively, restart Supabase** (applies new migrations only):

```bash
npx supabase stop
npx supabase start
```

### Push Migrations to Remote

**⚠️ CAUTION: This affects production!**

```bash
# Dry run first (preview changes)
npx supabase db push --dry-run

# Apply to remote database
npx supabase db push
```

### View Migration History

```bash
npx supabase migration list
```

**Example output:**

```
        LOCAL      │     REMOTE     │     TIME (UTC)
  ─────────────────┼────────────────┼──────────────────────
   20251006093452  │ 20251006093452 │ 2025-10-06 09:34:52
   20251006120530  │                │ 2025-10-06 12:05:30
```

---

## Local Development Workflow

### Typical Development Cycle

```bash
# 1. Start local Supabase
npx supabase start

# 2. Make database changes
npx supabase migration new my_feature
# Edit the migration file

# 3. Test locally
npx supabase db reset
# Test your app against local database

# 4. Update frontend environment to use local API
# .env.local:
# VITE_SUPABASE_URL=http://127.0.0.1:54321
# VITE_SUPABASE_ANON_KEY=<anon_key_from_supabase_start>

# 5. Run your app
npm run dev

# 6. When satisfied, push to remote
npx supabase db push
```

### Using Local Studio

Open http://127.0.0.1:54323 for:

- **Table Editor**: View and edit data
- **SQL Editor**: Run queries
- **Database**: Manage schema
- **Authentication**: Manage users
- **Storage**: Manage files
- **Logs**: View API logs

### Seeding Test Data

Create `supabase/seed.sql`:

```sql
-- Insert test units
INSERT INTO units (unit_code, unit_name, unit_type, base_rate, base_occupancy, max_occupancy)
VALUES
  ('DEV-1', 'Dev Deluxe Room', 'Deluxe', 2500.00, 2, 4),
  ('DEV-2', 'Dev Standard Room', 'Standard', 2000.00, 2, 3),
  ('DEV-3', 'Dev Villa Suite', 'Villa', 5000.00, 4, 8);

-- Insert test guest
INSERT INTO guests (name, email, phone_number, address)
VALUES ('Test Guest', 'test@example.com', '+639171234567', 'Manila, Philippines');

-- Insert test booking
INSERT INTO bookings (
  booking_reference,
  guest_id,
  unit_id,
  check_in,
  check_out,
  num_guests,
  total_amount,
  booking_status,
  payment_status
)
SELECT
  'BKG-TEST-001',
  (SELECT guest_id FROM guests WHERE email = 'test@example.com'),
  (SELECT unit_id FROM units WHERE unit_code = 'DEV-1'),
  now() + interval '7 days',
  now() + interval '9 days',
  2,
  5000.00,
  'confirmed',
  'paid';
```

**Apply seed data:**

```bash
npx supabase db reset  # Automatically runs seed.sql
```

### Testing Different Scenarios

```bash
# Clean state for testing
npx supabase db reset

# Test specific migration
npx supabase db diff -f <migration_name>

# Inspect database
npx supabase db inspect
```

---

## Environment Configuration

### Local Development

**`.env.local`** (for local testing):

```bash
# Use local Supabase
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon_key_from_supabase_start_output>

# Direct database connection (for scripts)
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

### Production

**`.env.local`** (for production):

```bash
# Use remote Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_production_anon_key
```

### Switching Environments

```bash
# Use local
export VITE_SUPABASE_URL=http://127.0.0.1:54321

# Use production
export VITE_SUPABASE_URL=https://your-project.supabase.co

# Or use .env.local and .env.production files
```

---

## Adding npm Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "supabase:start": "supabase start",
    "supabase:stop": "supabase stop",
    "supabase:status": "supabase status",
    "supabase:reset": "supabase db reset",
    "supabase:migration:new": "supabase migration new",
    "supabase:migration:list": "supabase migration list",
    "supabase:db:pull": "supabase db pull",
    "supabase:db:push": "supabase db push --dry-run",
    "supabase:db:push:apply": "supabase db push",
    "supabase:studio": "open http://127.0.0.1:54323",
    "dev:local": "export VITE_SUPABASE_URL=http://127.0.0.1:54321 && npm run dev"
  }
}
```

**Usage:**

```bash
npm run supabase:start
npm run supabase:migration:new add_feature
npm run supabase:reset
npm run dev:local
```

---

## Troubleshooting

### Docker Connection Issues

**Problem:** `Cannot connect to the Docker daemon`

**Solution:**

```bash
# Ensure Docker Desktop is running
open -a Docker  # macOS
```

### Port Conflicts

**Problem:** `Error: port 54321 already in use`

**Solution:**

```bash
# Find process using port
lsof -i :54321

# Kill the process
kill -9 <PID>

# Or change ports in supabase/config.toml
[api]
port = 54421  # Use different port
```

### Migration Conflicts

**Problem:** Migration already exists remotely but not locally

**Solution:**

```bash
# Pull remote migrations first
npx supabase db pull

# Then reset local database
npx supabase db reset
```

### Database Connection Refused

**Problem:** Cannot connect to local database

**Solution:**

```bash
# Check status
npx supabase status

# Restart services
npx supabase stop
npx supabase start

# Check Docker containers
docker ps | grep supabase
```

### Reset Everything

If things are completely broken:

```bash
# Stop and remove all containers
npx supabase stop --no-backup

# Remove all Docker volumes (⚠️ deletes all local data)
docker volume ls | grep supabase | awk '{print $2}' | xargs docker volume rm

# Start fresh
npx supabase start
```

---

## Database Inspection Commands

Supabase CLI includes powerful inspection tools:

```bash
# View table sizes
npx supabase inspect db table-sizes

# View index usage
npx supabase inspect db index-usage

# View cache hit rates
npx supabase inspect db cache-hit

# View long-running queries
npx supabase inspect db long-running-queries

# View database locks
npx supabase inspect db locks

# View bloat estimation
npx supabase inspect db bloat
```

---

## Advanced: Testing with Multiple Databases

For complex testing scenarios:

```bash
# Start a second instance on different ports
npx supabase start --workdir ./test-setup

# Or use branches (requires Supabase Pro)
npx supabase branches create feature-branch
npx supabase db push --branch feature-branch
```

---

## Integration with Your Current Workflow

### 1. Existing Database Files

Your `database/` directory contains schema documentation and alternative migrations. To consolidate:

```bash
# Option 1: Copy schemas to migrations
npx supabase migration new initial_schema
# Copy content from database/schema.sql

# Option 2: Keep database/ for documentation
# Use supabase/migrations/ for actual migrations
```

### 2. RLS Testing

Test Row Level Security policies locally:

```sql
-- In Studio SQL Editor or psql
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "user-id-here"}';

-- Test RLS policies
SELECT * FROM bookings;  -- Should only show user's bookings

-- Reset role
RESET ROLE;
```

### 3. Cloudflare Workers Testing

Test your Workers functions against local Supabase:

```bash
# In wrangler.toml (for local dev)
[env.local.vars]
SUPABASE_URL = "http://127.0.0.1:54321"
SUPABASE_ANON_KEY = "<local_anon_key>"

# Run workers locally
npx wrangler dev --env local
```

---

## Best Practices

### ✅ Do's

- **Always test migrations locally first** before pushing to production
- **Use `db reset` frequently** to ensure migrations work from scratch
- **Commit migration files** to version control
- **Use seed files** for consistent test data
- **Run `supabase db diff`** to verify schema matches expectations
- **Link to remote** to keep local and production in sync

### ❌ Don'ts

- **Don't skip migrations** - always create migration files for schema changes
- **Don't edit migrations** after they've been pushed to production
- **Don't push without dry-run** - always use `--dry-run` first
- **Don't hardcode secrets** in seed.sql or migrations
- **Don't commit `.env.local`** with production credentials

---

## Quick Reference

```bash
# Essential Commands
npx supabase start                    # Start local Supabase
npx supabase stop                     # Stop local Supabase
npx supabase status                   # Check running services
npx supabase db reset                 # Reset local database

# Migrations
npx supabase migration new <name>     # Create new migration
npx supabase migration list           # View migration status
npx supabase db pull                  # Pull remote schema
npx supabase db push --dry-run        # Preview remote push
npx supabase db push                  # Push migrations to remote

# Linking
npx supabase link --project-ref <id>  # Link to remote project
npx supabase db diff                  # Compare local vs remote schema

# Inspection
npx supabase inspect db table-sizes   # View table sizes
npx supabase inspect db index-usage   # View index usage

# URLs
Studio:    http://127.0.0.1:54323
API:       http://127.0.0.1:54321
Database:  postgresql://postgres:postgres@127.0.0.1:54322/postgres
Inbucket:  http://127.0.0.1:54324
```

---

## Next Steps

1. **Install Supabase CLI**: `npm install supabase --save-dev`
2. **Start local Supabase**: `npx supabase start`
3. **Open Studio**: http://127.0.0.1:54323
4. **Link to remote**: `npx supabase link --project-ref <your-id>`
5. **Pull remote schema**: `npx supabase db pull`
6. **Test your app locally**: Update `.env.local` and run `npm run dev`

---

## Additional Resources

- [Supabase Local Development Docs](https://supabase.com/docs/guides/local-development)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli)
- [Database Migrations Guide](https://supabase.com/docs/guides/database/migrations)
- [Testing with Supabase](https://supabase.com/docs/guides/getting-started/testing)
- Project Database Documentation: `database/README.md`
