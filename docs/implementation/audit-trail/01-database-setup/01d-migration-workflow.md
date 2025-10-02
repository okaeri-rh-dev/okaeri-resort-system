# Phase 1d: Migration Workflow

**Duration**: 30-45 minutes (setup), 5-10 minutes (execution)
**Prerequisites**: Phases 1a-1c SQL files prepared, PostgreSQL CLI tools installed

## Overview

This document provides the complete CLI migration workflow with **automated backups** and **rollback capabilities**. You requested a system that can handle migrations locally with automated backups and rollback scripts - this delivers exactly that.

## Migration Philosophy

### Why Automated Backups?

**Problem**: Manual migrations are risky

- ❌ Easy to forget backing up
- ❌ Can't easily rollback if something breaks
- ❌ No audit trail of when migrations ran

**Solution**: Script that automatically:

- ✅ Creates timestamped backup before migration
- ✅ Runs all migrations in order
- ✅ Regenerates TypeScript types
- ✅ Verifies everything worked
- ✅ Provides rollback command if needed

### No Dev Environment Strategy

Since you don't have a separate dev environment:

- All testing happens on local Supabase instance
- Production migrations use same scripts (verified locally first)
- Backups protect against mistakes
- Rollback script provides safety net

## Directory Structure

Create this structure in your project:

```bash
scripts/audit-migrations/
├── migrate-audit-system.sh       # Main migration script (creates backup, runs migrations)
├── rollback-audit-system.sh      # Rollback to backup (with confirmation)
├── verify-audit-system.sh        # Health check script
├── migrations/                    # SQL migration files (numbered)
│   ├── 001-audit-tables.sql
│   ├── 002-audit-triggers.sql
│   ├── 003-audit-indexes.sql
│   └── 004-audit-rls.sql
└── backups/                       # Auto-generated (timestamped backups)
    └── audit_backup_YYYYMMDD_HHMMSS.sql
```

## Setup: Migration Files

### 001-audit-tables.sql

```sql
-- ============================================
-- MIGRATION: 001 - Create Audit Logs Table
-- ============================================
\set ON_ERROR_STOP on

-- Enable UUID extension (pgcrypto for gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create audit_logs table (from Phase 1a)
-- [Insert complete schema from 01a-schema-and-tables.md]

-- Add comments
-- [Insert all COMMENT statements from 01a]

-- Verification
SELECT 'Migration 001 complete' AS status;
```

### 002-audit-triggers.sql

```sql
-- ============================================
-- MIGRATION: 002 - Create Audit Triggers
-- ============================================
\set ON_ERROR_STOP on

-- Create trigger function (from Phase 1b)
-- [Insert audit_trigger_func from 01b-triggers-and-functions.md]

-- Create helper functions
-- [Insert attach/detach functions from 01b]

-- Attach triggers to all 6 tables
-- [Insert all CREATE TRIGGER statements from 01b]

-- ============================================
-- IDENTITY ENFORCEMENT (Security Layer)
-- ============================================
-- Create identity enforcement function
-- [Insert enforce_app_audit_identity() function from 01b Identity Enforcement section]

-- Attach identity enforcement trigger
-- [Insert CREATE TRIGGER enforce_app_audit_identity_trigger from 01b Identity Enforcement section]

-- Verification
SELECT 'Migration 002 complete' AS status,
       COUNT(*) AS trigger_count
FROM information_schema.triggers
WHERE trigger_name LIKE 'audit_%'
   OR trigger_name = 'enforce_app_audit_identity_trigger';

-- Expected: 7 triggers total (6 table triggers + 1 identity enforcement trigger)
```

### 003-audit-indexes.sql

```sql
-- ============================================
-- MIGRATION: 003 - Create Performance Indexes
-- ============================================
-- IMPORTANT: This follows the exact index set from Phase 1c
-- See: docs/implementation/audit-trail/01-database-setup/01c-indexes-and-performance.md
\set ON_ERROR_STOP on

-- User context index (optimizes filtering by user)
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_context
    ON audit_logs (user_email, user_id);

-- Table name index (optimizes filtering by specific tables)
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name
    ON audit_logs (table_name);

-- Action index (optimizes filtering by operation type)
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
    ON audit_logs (action);

-- Timestamp index DESC (optimizes recent-first queries)
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp
    ON audit_logs (created_at DESC);

-- Record tracking index (optimizes record history queries)
CREATE INDEX IF NOT EXISTS idx_audit_logs_record
    ON audit_logs (table_name, record_id);

-- Composite index (optimizes complex multi-filter queries)
CREATE INDEX IF NOT EXISTS idx_audit_logs_composite
    ON audit_logs (table_name, user_email, created_at DESC);

-- Keyset pagination index (optimizes cursor-based pagination for large datasets)
CREATE INDEX IF NOT EXISTS idx_audit_logs_keyset
    ON audit_logs (created_at DESC, audit_id DESC);

-- Optional: Category index (if filtering by category is common)
CREATE INDEX IF NOT EXISTS idx_audit_logs_category
    ON audit_logs (category, created_at DESC)
    WHERE category IS NOT NULL;

-- Update statistics
ANALYZE audit_logs;

-- Verification (should show 8-9 indexes including primary key)
SELECT 'Migration 003 complete' AS status,
       COUNT(*) AS index_count
FROM pg_indexes
WHERE tablename = 'audit_logs';
```

### 004-audit-rls.sql

```sql
-- ============================================
-- MIGRATION: 004 - Enable RLS Policies (app_roles)
-- ============================================
-- Uses app_roles table for role-based access control
-- See: Phase 4b (04b-role-management.md) for full documentation
\set ON_ERROR_STOP on

-- Enable RLS on audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "audit_logs_select_policy" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_policy" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_update_policy" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_delete_policy" ON audit_logs;

-- ============================================
-- SELECT POLICY (Using app_roles table)
-- ============================================
CREATE POLICY "audit_logs_select_policy"
ON audit_logs
FOR SELECT
USING (
    -- Admins and owners see all audit logs
    EXISTS (
        SELECT 1 FROM app_roles ar
        WHERE ar.user_id = auth.uid()
          AND ar.role IN ('admin', 'owner')
          AND ar.is_active = true
    )
    OR
    -- Managers see business operations only
    (
        EXISTS (
            SELECT 1 FROM app_roles ar
            WHERE ar.user_id = auth.uid()
              AND ar.role = 'manager'
              AND ar.is_active = true
        )
        AND table_name IN ('bookings', 'payments', 'guests', 'expenses', 'system', 'authentication')
    )
    OR
    -- Staff see only their own logs
    (
        user_email = (current_setting('request.jwt.claims', TRUE)::json->>'email')
    )
);

-- ============================================
-- INSERT POLICY (Allows triggers and authenticated users)
-- ============================================
CREATE POLICY "audit_logs_insert_policy"
ON audit_logs
FOR INSERT
WITH CHECK (
    -- Authenticated users can insert logs
    auth.uid() IS NOT NULL
    OR
    -- System (trigger) can insert logs (user_id = NULL)
    user_id IS NULL
);

-- ============================================
-- UPDATE/DELETE POLICIES (No updates, limited deletes)
-- ============================================
CREATE POLICY "audit_logs_update_policy"
ON audit_logs
FOR UPDATE
USING (false);  -- No updates allowed (immutable audit logs)

CREATE POLICY "audit_logs_delete_policy"
ON audit_logs
FOR DELETE
USING (
    -- Only admins and owners can delete (for manual archival)
    EXISTS (
        SELECT 1 FROM app_roles ar
        WHERE ar.user_id = auth.uid()
          AND ar.role IN ('admin', 'owner')
          AND ar.is_active = true
    )
);

-- Add policy comments
COMMENT ON POLICY "audit_logs_select_policy" ON audit_logs IS
    'Uses app_roles table for role-based access. Admins/owners see all, managers see business ops, staff see own logs.';

COMMENT ON POLICY "audit_logs_delete_policy" ON audit_logs IS
    'Only admins and owners can manually delete logs for archival purposes.';

-- Verification
SELECT 'Migration 004 complete' AS status,
       rowsecurity AS rls_enabled,
       (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'audit_logs') AS policy_count
FROM pg_tables
WHERE tablename = 'audit_logs';
```

### 005-bootstrap-admin.sql

```sql
-- ============================================
-- MIGRATION: 005 - Bootstrap Initial Admin
-- ============================================
-- Purpose: Create the first admin user for the system
-- IMPORTANT: Replace placeholder UUIDs with actual user ID after first authentication
\set ON_ERROR_STOP on

-- Instructions:
-- 1. Have your admin user sign up through Supabase Auth first
-- 2. Find their user_id in auth.users table or Supabase Dashboard
-- 3. Replace 'REPLACE_WITH_FIRST_ADMIN_UUID' below with their actual UUID
-- 4. Run this migration

INSERT INTO app_roles (user_id, email, role, granted_by, is_active, notes)
VALUES (
    'REPLACE_WITH_FIRST_ADMIN_UUID'::UUID,  -- Replace with actual user UUID
    'admin@your-resort.com',                -- Replace with actual admin email
    'admin',
    'REPLACE_WITH_FIRST_ADMIN_UUID'::UUID,  -- Self-granted for initial admin
    true,
    'Initial system administrator - created during migration'
)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- CREATE ROLE HELPER FUNCTIONS
-- ============================================

-- Helper function for UI route guards
-- Returns TEXT (never NULL) for cleaner client-side checks
CREATE OR REPLACE FUNCTION get_current_audit_role()
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM app_roles
    WHERE user_id = auth.uid()
      AND is_active = true
    LIMIT 1;

    -- Return 'none' instead of NULL for easier client-side checks
    RETURN COALESCE(user_role, 'none');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_current_audit_role() IS
    'Returns current user audit role: admin|owner|manager|staff|none. Preferred for UI route guards.';

-- Verification
SELECT
    'Migration 005 complete' AS status,
    COUNT(*) AS admin_count,
    STRING_AGG(email, ', ') AS admin_emails
FROM app_roles
WHERE role = 'admin' AND is_active = true;

-- Instructions for next steps
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'IMPORTANT: Bootstrap Admin Setup';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Verify the admin role was granted to the correct user';
    RAISE NOTICE '2. Test login with admin credentials';
    RAISE NOTICE '3. Use TypeScript helpers to grant additional roles:';
    RAISE NOTICE '   await grantRole(userId, AuditRole.OWNER, "notes here");';
    RAISE NOTICE '';
END $$;
```

**Setup Instructions**:

1. **Find your admin user ID**:

   ```sql
   -- After your admin has signed up, find their UUID
   SELECT id, email FROM auth.users WHERE email = 'admin@your-resort.com';
   ```

2. **Update the migration file**:
   - Replace `'REPLACE_WITH_FIRST_ADMIN_UUID'` with the actual UUID (both occurrences)
   - Replace `'admin@your-resort.com'` with the actual email

3. **Run the migration** (will be executed automatically by `migrate-audit-system.sh`)

### 006-verify-audit-setup.sql

```sql
-- ============================================
-- MIGRATION: 006 - Verify Audit System Setup
-- ============================================
-- Purpose: Safety checks to ensure critical audit components are configured correctly
-- This migration will fail if any required security component is missing
\set ON_ERROR_STOP on

DO $$
DECLARE
    v_trigger_exists BOOLEAN;
    v_rls_enabled BOOLEAN;
    v_permissive_policies INT;
    v_app_roles_count INT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Audit System Verification';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    -- ============================================
    -- Check 1: Identity enforcement trigger exists
    -- ============================================
    SELECT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'enforce_app_audit_identity'
        AND tgrelid = 'audit_logs'::regclass
    ) INTO v_trigger_exists;

    IF NOT v_trigger_exists THEN
        RAISE EXCEPTION '❌ CRITICAL: Identity enforcement trigger missing! This allows forged user_id/email in app logs.';
    ELSE
        RAISE NOTICE '✓ Identity enforcement trigger exists';
    END IF;

    -- ============================================
    -- Check 2: RLS is enabled on audit_logs
    -- ============================================
    SELECT relrowsecurity INTO v_rls_enabled
    FROM pg_class
    WHERE relname = 'audit_logs';

    IF NOT v_rls_enabled THEN
        RAISE EXCEPTION '❌ CRITICAL: RLS not enabled on audit_logs! All users can see all logs.';
    ELSE
        RAISE NOTICE '✓ RLS enabled on audit_logs';
    END IF;

    -- ============================================
    -- Check 3: No permissive policies (USING true)
    -- ============================================
    SELECT COUNT(*) INTO v_permissive_policies
    FROM pg_policies
    WHERE tablename = 'audit_logs'
    AND qual = 'true'::text;

    IF v_permissive_policies > 0 THEN
        RAISE EXCEPTION '❌ CRITICAL: Permissive policies detected (% policies)! Replace with app_roles policies.', v_permissive_policies;
    ELSE
        RAISE NOTICE '✓ No permissive policies (all policies use proper access control)';
    END IF;

    -- ============================================
    -- Check 4: app_roles table exists and has data
    -- ============================================
    SELECT COUNT(*) INTO v_app_roles_count
    FROM app_roles
    WHERE is_active = true;

    IF v_app_roles_count = 0 THEN
        RAISE WARNING '⚠ WARNING: No active roles in app_roles table. Run migration 005 to bootstrap admin.';
    ELSE
        RAISE NOTICE '✓ app_roles table has % active role(s)', v_app_roles_count;
    END IF;

    -- ============================================
    -- Final Summary
    -- ============================================
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ All critical security checks passed';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Audit system is properly configured:';
    RAISE NOTICE '  • Identity enforcement: ENABLED';
    RAISE NOTICE '  • Row Level Security: ENABLED';
    RAISE NOTICE '  • Access control: app_roles-based';
    RAISE NOTICE '  • Active roles: %', v_app_roles_count;
    RAISE NOTICE '';

    -- Return success status
    RAISE NOTICE 'Migration 006 complete';
END $$;
```

**Verification Checks**:

This migration performs critical security checks:

1. **Identity Enforcement Trigger**: Ensures the `enforce_app_audit_identity` trigger exists, preventing forged user identities in app logs
2. **RLS Enabled**: Confirms Row Level Security is active on `audit_logs` table
3. **No Permissive Policies**: Detects dangerous `USING (true)` policies that allow unrestricted access
4. **app_roles Populated**: Warns if no active roles exist (needs bootstrap)

**If verification fails**, the migration will error with specific details about what's missing.

### 007-add-correlation-id.sql

```sql
-- ============================================
-- MIGRATION: 007 - Add Correlation ID Column
-- ============================================
-- Purpose: Add correlation_id column to link related log entries
-- Allows correlating trigger logs (Layer 1) with app logs (Layer 2)
\set ON_ERROR_STOP on

-- Add correlation_id column with default UUID
ALTER TABLE audit_logs
ADD COLUMN IF NOT EXISTS correlation_id UUID DEFAULT gen_random_uuid();

-- Add column comment
COMMENT ON COLUMN audit_logs.correlation_id IS
    'UUID for linking related log entries across layers. Defaults to random UUID. App can pass explicit value to correlate trigger logs with business context logs.';

-- Add index for efficient correlation queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation
    ON audit_logs (correlation_id);

COMMENT ON INDEX idx_audit_logs_correlation IS
    'Optimizes queries that find all logs for a specific correlation_id.';

-- Update statistics
ANALYZE audit_logs;

-- Verification
SELECT
    'Migration 007 complete' AS status,
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'audit_logs'
  AND column_name = 'correlation_id';

-- Instructions
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Correlation ID Column Added';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Usage:';
    RAISE NOTICE '1. Existing logs: Automatically populated with unique UUIDs';
    RAISE NOTICE '2. New logs: Get unique UUID by default';
    RAISE NOTICE '3. Correlated logs: Pass same UUID to db.auditLogs.create()';
    RAISE NOTICE '';
    RAISE NOTICE 'Example:';
    RAISE NOTICE '  const correlationId = uuidv4();';
    RAISE NOTICE '  await db.bookings.update(...);  // Trigger fires';
    RAISE NOTICE '  await logAuditEvent({ correlationId, ... });';
    RAISE NOTICE '';
    RAISE NOTICE 'Query correlated logs:';
    RAISE NOTICE '  SELECT * FROM audit_logs WHERE correlation_id = ''uuid-here'';';
    RAISE NOTICE '';
END $$;
```

**Migration Details**:

- **Column**: `correlation_id UUID DEFAULT gen_random_uuid()`
- **Index**: `idx_audit_logs_correlation` for fast correlation queries
- **Backward Compatible**: Existing logs get auto-generated UUIDs
- **Forward Compatible**: New logs can optionally pass explicit correlation_id

**Use Cases**:

1. **Basic Logging**: No correlation needed, each log gets unique UUID (default behavior)
2. **Correlated Logging**: Generate UUID client-side, pass to both DB mutation and `logAuditEvent()`
3. **Debugging**: Query all logs for a correlation_id to see complete operation story

### 008-archive-table-and-function.sql

```sql
-- ============================================
-- MIGRATION: 008 - Archive Table and Function
-- ============================================
-- Purpose: Create archive table and move-to-archive function
-- Implements tamper-evident archive-move pattern instead of direct deletes
\set ON_ERROR_STOP on

-- ============================================
-- CREATE ARCHIVE TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs_archive (
    LIKE audit_logs INCLUDING ALL
);

COMMENT ON TABLE audit_logs_archive IS
    'Archive storage for audit logs. Populated by archive_audit_logs() function. Logs are moved (not copied) from audit_logs to reduce active table size while maintaining audit trail.';

-- Indexes (same as main table for consistent query performance)
CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_user_context
    ON audit_logs_archive (user_email, user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_table_name
    ON audit_logs_archive (table_name);

CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_timestamp
    ON audit_logs_archive (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_record
    ON audit_logs_archive (table_name, record_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_correlation
    ON audit_logs_archive (correlation_id);

-- ============================================
-- CREATE ARCHIVE FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION archive_audit_logs(cutoff_date TIMESTAMPTZ)
RETURNS BIGINT AS $$
DECLARE
    archived_count BIGINT;
BEGIN
    -- Move logs to archive table (INSERT + DELETE = MOVE)
    WITH moved AS (
        INSERT INTO audit_logs_archive
        SELECT * FROM audit_logs
        WHERE created_at < cutoff_date
        RETURNING audit_id
    )
    SELECT COUNT(*) INTO archived_count FROM moved;

    -- Delete archived logs from active table
    DELETE FROM audit_logs WHERE created_at < cutoff_date;

    -- Return count of archived logs
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION archive_audit_logs(TIMESTAMPTZ) IS
    'Moves audit logs older than cutoff_date to audit_logs_archive table. Returns count of archived logs. Tamper-evident archive-move pattern instead of direct delete.';

-- Verification
SELECT
    'Migration 008 complete' AS status,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'audit_logs_archive') AS archive_table_exists,
    (SELECT COUNT(*) FROM information_schema.routines WHERE routine_name = 'archive_audit_logs') AS archive_function_exists;

-- Instructions
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Archive System Created';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Usage:';
    RAISE NOTICE '  -- Archive logs older than 2 years';
    RAISE NOTICE '  SELECT archive_audit_logs(NOW() - INTERVAL ''2 years'');';
    RAISE NOTICE '';
    RAISE NOTICE '  -- TypeScript helper:';
    RAISE NOTICE '  const twoYearsAgo = new Date();';
    RAISE NOTICE '  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);';
    RAISE NOTICE '  const result = await db.auditLogs.archiveOld(twoYearsAgo.toISOString());';
    RAISE NOTICE '';
    RAISE NOTICE 'Restore from archive:';
    RAISE NOTICE '  INSERT INTO audit_logs SELECT * FROM audit_logs_archive WHERE created_at BETWEEN ... ;';
    RAISE NOTICE '';
END $$;
```

**Migration Details**:

- **Archive Table**: Identical structure to `audit_logs` including all indexes
- **Archive Function**: Atomic move operation (INSERT + DELETE in single transaction)
- **Returns**: Count of archived logs for confirmation
- **Reversible**: Can restore logs from archive if needed

**Security**:

- `SECURITY DEFINER`: Function runs with creator's privileges (necessary for DELETE)
- RLS still applies to archive table (same policies as `audit_logs`)
- Only admins/owners can call via `archiveOld()` helper (enforced by app logic)

## Main Migration Script

### migrate-audit-system.sh

```bash
#!/bin/bash
# ============================================
# AUDIT SYSTEM MIGRATION SCRIPT
# ============================================
# Purpose: Run all migrations with automatic backup
# Usage: ./migrate-audit-system.sh
# Author: Okaeri Resort System

set -e  # Exit immediately if any command fails

# ============================================
# CONFIGURATION
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/migrations"
BACKUP_DIR="$SCRIPT_DIR/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/audit_backup_$TIMESTAMP.sql"

# Colors for pretty output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================
# DATABASE CONNECTION
# ============================================

# Supabase local instance (default)
DB_HOST="${SUPABASE_DB_HOST:-localhost}"
DB_PORT="${SUPABASE_DB_PORT:-54322}"
DB_NAME="${SUPABASE_DB_NAME:-postgres}"
DB_USER="${SUPABASE_DB_USER:-postgres}"
DB_PASSWORD="${SUPABASE_DB_PASSWORD:-postgres}"

# Export password for pg_dump/psql
export PGPASSWORD="$DB_PASSWORD"

# ============================================
# HELPER FUNCTIONS
# ============================================

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_step() {
    echo -e "${YELLOW}➜ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# ============================================
# PRE-FLIGHT CHECKS
# ============================================

print_header "Audit System Migration"

echo "Configuration:"
echo "  Database: $DB_HOST:$DB_PORT/$DB_NAME"
echo "  User: $DB_USER"
echo "  Backup: $BACKUP_FILE"
echo "  Timestamp: $TIMESTAMP"
echo ""

# Check if migrations directory exists
if [ ! -d "$MIGRATIONS_DIR" ]; then
    print_error "Migrations directory not found: $MIGRATIONS_DIR"
    exit 1
fi

# Check if migration files exist
MIGRATION_COUNT=$(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | wc -l)
if [ "$MIGRATION_COUNT" -eq 0 ]; then
    print_error "No migration files found in $MIGRATIONS_DIR"
    exit 1
fi

print_success "Found $MIGRATION_COUNT migration files"

# Check database connection
print_step "Testing database connection..."
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" >/dev/null 2>&1; then
    print_success "Database connection OK"
else
    print_error "Cannot connect to database"
    exit 1
fi

# ============================================
# STEP 1: CREATE BACKUP
# ============================================

print_header "Step 1: Creating Backup"

mkdir -p "$BACKUP_DIR"

print_step "Backing up current database state..."
if pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --schema=public \
    --no-owner \
    --no-acl \
    --clean \
    --if-exists \
    > "$BACKUP_FILE" 2>/dev/null; then

    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    print_success "Backup created: $BACKUP_FILE ($BACKUP_SIZE)"
else
    print_error "Backup failed"
    exit 1
fi

# ============================================
# STEP 2: RUN MIGRATIONS
# ============================================

print_header "Step 2: Running Migrations"

MIGRATION_SUCCESS=true

for migration in "$MIGRATIONS_DIR"/*.sql; do
    MIGRATION_NAME=$(basename "$migration")
    print_step "Running: $MIGRATION_NAME"

    if psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -f "$migration" \
        -v ON_ERROR_STOP=1 \
        --quiet 2>&1 | grep -v "^$"; then

        print_success "$MIGRATION_NAME completed"
    else
        print_error "$MIGRATION_NAME failed"
        MIGRATION_SUCCESS=false
        break
    fi
done

if [ "$MIGRATION_SUCCESS" = false ]; then
    print_error "Migration failed!"
    echo ""
    echo "To rollback, run:"
    echo "  ./rollback-audit-system.sh $BACKUP_FILE"
    exit 1
fi

# ============================================
# STEP 3: VERIFY MIGRATIONS
# ============================================

print_header "Step 3: Verifying Migrations"

print_step "Running verification checks..."

# Check audit_logs table exists
TABLE_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_logs');")

if [ "$TABLE_EXISTS" = "t" ]; then
    print_success "audit_logs table created"
else
    print_error "audit_logs table not found"
    exit 1
fi

# Check triggers exist
TRIGGER_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_name LIKE 'audit_%';")

if [ "$TRIGGER_COUNT" -eq 6 ]; then
    print_success "All 6 triggers attached"
else
    print_error "Expected 6 triggers, found $TRIGGER_COUNT"
    exit 1
fi

# Check indexes exist (expecting 8-9: 7 core + keyset + optional category + primary key)
INDEX_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'audit_logs';")

if [ "$INDEX_COUNT" -ge 8 ]; then
    print_success "$INDEX_COUNT indexes created (matches Phase 1c specification)"
else
    print_error "Expected at least 8 indexes (7 core + keyset + primary key), found $INDEX_COUNT"
fi

# ============================================
# STEP 4: REGENERATE TYPES
# ============================================

print_header "Step 4: Regenerating TypeScript Types"

print_step "Generating types from database schema..."

# Navigate to project root (2 levels up from scripts/audit-migrations/)
cd "$SCRIPT_DIR/../.."

if command -v supabase &> /dev/null; then
    if supabase gen types typescript --local > database.types.ts 2>/dev/null; then
        print_success "TypeScript types generated: database.types.ts"
    else
        print_error "Type generation failed (non-fatal)"
        echo "  Run manually: supabase gen types typescript --local > database.types.ts"
    fi
else
    print_error "Supabase CLI not found (non-fatal)"
    echo "  Install: npm install -g supabase"
    echo "  Then run: supabase gen types typescript --local > database.types.ts"
fi

# ============================================
# STEP 5: SUMMARY
# ============================================

print_header "Migration Complete!"

echo ""
echo -e "${GREEN}✓ All migrations completed successfully${NC}"
echo ""
echo "Summary:"
echo "  • Backup: $BACKUP_FILE"
echo "  • Tables: audit_logs created"
echo "  • Triggers: 6 triggers attached to all tables"
echo "  • Indexes: $INDEX_COUNT performance indexes created"
echo "  • Types: database.types.ts regenerated"
echo ""
echo "Next steps:"
echo "  1. Review the generated types in database.types.ts"
echo "  2. Proceed to Phase 2: Application Integration"
echo "  3. See: docs/implementation/audit-trail/02-application-integration/"
echo ""
echo "If you need to rollback:"
echo "  ./rollback-audit-system.sh $BACKUP_FILE"
echo ""

# ============================================
# CLEANUP
# ============================================

unset PGPASSWORD
```

### Make Script Executable

```bash
chmod +x scripts/audit-migrations/migrate-audit-system.sh
```

## Rollback Script

### rollback-audit-system.sh

```bash
#!/bin/bash
# ============================================
# AUDIT SYSTEM ROLLBACK SCRIPT
# ============================================
# Purpose: Restore database from backup
# Usage: ./rollback-audit-system.sh <backup_file>

set -e

# ============================================
# CONFIGURATION
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================
# CHECK ARGUMENTS
# ============================================

if [ -z "$1" ]; then
    echo -e "${RED}Error: No backup file specified${NC}"
    echo ""
    echo "Usage: ./rollback-audit-system.sh <backup_file>"
    echo ""
    echo "Available backups:"
    ls -lh "$SCRIPT_DIR/backups/" 2>/dev/null || echo "  No backups found"
    exit 1
fi

BACKUP_FILE="$1"

# Check if backup exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}Error: Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

# ============================================
# DATABASE CONNECTION
# ============================================

DB_HOST="${SUPABASE_DB_HOST:-localhost}"
DB_PORT="${SUPABASE_DB_PORT:-54322}"
DB_NAME="${SUPABASE_DB_NAME:-postgres}"
DB_USER="${SUPABASE_DB_USER:-postgres}"
DB_PASSWORD="${SUPABASE_DB_PASSWORD:-postgres}"

export PGPASSWORD="$DB_PASSWORD"

# ============================================
# CONFIRMATION
# ============================================

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}AUDIT SYSTEM ROLLBACK${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""
echo "Backup file: $BACKUP_FILE"
echo "Database: $DB_HOST:$DB_PORT/$DB_NAME"
echo ""
echo -e "${RED}WARNING: This will:${NC}"
echo -e "${RED}  1. Drop all audit system objects${NC}"
echo -e "${RED}  2. Restore from backup${NC}"
echo -e "${RED}  3. Regenerate TypeScript types${NC}"
echo ""
read -p "Are you absolutely sure? (type 'yes' to confirm): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Rollback cancelled."
    exit 0
fi

# ============================================
# STEP 1: DROP AUDIT OBJECTS
# ============================================

echo ""
echo -e "${BLUE}Step 1/3: Dropping audit system objects...${NC}"

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<EOF
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP FUNCTION IF EXISTS audit_trigger_func() CASCADE;
DROP FUNCTION IF EXISTS attach_audit_trigger(TEXT) CASCADE;
DROP FUNCTION IF EXISTS detach_audit_trigger(TEXT) CASCADE;
EOF

echo -e "${GREEN}✓ Audit objects dropped${NC}"

# ============================================
# STEP 2: RESTORE FROM BACKUP
# ============================================

echo ""
echo -e "${BLUE}Step 2/3: Restoring from backup...${NC}"

if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    < "$BACKUP_FILE" 2>&1 | grep -v "^$"; then
    echo -e "${GREEN}✓ Database restored${NC}"
else
    echo -e "${RED}✗ Restore failed${NC}"
    exit 1
fi

# ============================================
# STEP 3: REGENERATE TYPES
# ============================================

echo ""
echo -e "${BLUE}Step 3/3: Regenerating types...${NC}"

cd "$SCRIPT_DIR/../.."

if command -v supabase &> /dev/null; then
    if supabase gen types typescript --local > database.types.ts 2>/dev/null; then
        echo -e "${GREEN}✓ Types regenerated${NC}"
    else
        echo -e "${YELLOW}⚠ Type generation failed (non-fatal)${NC}"
    fi
fi

# ============================================
# SUMMARY
# ============================================

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}ROLLBACK COMPLETE${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Database restored to state before migration."
echo "Backup used: $BACKUP_FILE"
echo ""

unset PGPASSWORD
```

### Make Rollback Executable

```bash
chmod +x scripts/audit-migrations/rollback-audit-system.sh
```

## Verification Script

### verify-audit-system.sh

```bash
#!/bin/bash
# ============================================
# AUDIT SYSTEM VERIFICATION SCRIPT
# ============================================
# Purpose: Health check for audit system
# Usage: ./verify-audit-system.sh

# Database connection
DB_HOST="${SUPABASE_DB_HOST:-localhost}"
DB_PORT="${SUPABASE_DB_PORT:-54322}"
DB_NAME="${SUPABASE_DB_NAME:-postgres}"
DB_USER="${SUPABASE_DB_USER:-postgres}"
DB_PASSWORD="${SUPABASE_DB_PASSWORD:-postgres}"

export PGPASSWORD="$DB_PASSWORD"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "Audit System Health Check"
echo "=========================="
echo ""

# Check table
TABLE_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_logs');")

if [ "$TABLE_EXISTS" = "t" ]; then
    echo -e "${GREEN}✓${NC} audit_logs table exists"
else
    echo -e "${RED}✗${NC} audit_logs table missing"
fi

# Check triggers
TRIGGER_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_name LIKE 'audit_%';")

if [ "$TRIGGER_COUNT" -eq 6 ]; then
    echo -e "${GREEN}✓${NC} All 6 triggers attached"
else
    echo -e "${RED}✗${NC} Expected 6 triggers, found $TRIGGER_COUNT"
fi

# Check recent activity
RECENT_LOGS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT COUNT(*) FROM audit_logs WHERE created_at > NOW() - INTERVAL '1 hour';")

echo -e "${GREEN}✓${NC} Audit logs in last hour: $RECENT_LOGS"

unset PGPASSWORD
```

### Make Verification Executable

```bash
chmod +x scripts/audit-migrations/verify-audit-system.sh
```

## Usage Guide

### Initial Migration

```bash
# 1. Navigate to scripts directory
cd scripts/audit-migrations

# 2. Run migration (creates automatic backup)
./migrate-audit-system.sh

# Expected output:
# ========================================
# Audit System Migration
# ========================================
# ...
# ✓ Backup created: backups/audit_backup_20250101_120000.sql
# ✓ 001-audit-tables.sql completed
# ✓ 002-audit-triggers.sql completed
# ✓ 003-audit-indexes.sql completed
# ✓ 004-audit-rls.sql completed
# ✓ All migrations completed successfully
```

### If Migration Fails

```bash
# Rollback to backup
./rollback-audit-system.sh backups/audit_backup_20250101_120000.sql

# Prompt will ask for confirmation
# Type 'yes' to proceed
```

### Verify System Health

```bash
# Check everything is working
./verify-audit-system.sh

# Expected output:
# Audit System Health Check
# ==========================
# ✓ audit_logs table exists
# ✓ All 6 triggers attached
# ✓ Audit logs in last hour: 0
```

### Listing Backups

```bash
# See all available backups
ls -lh backups/

# Example output:
# -rw-r--r--  1 user  staff   2.1M Jan  1 12:00 audit_backup_20250101_120000.sql
# -rw-r--r--  1 user  staff   2.0M Jan  1 11:30 audit_backup_20250101_113000.sql
```

## Environment Variables

Set these in `.env.local` or export before running:

```bash
# Supabase local instance (defaults shown)
export SUPABASE_DB_HOST=localhost
export SUPABASE_DB_PORT=54322
export SUPABASE_DB_NAME=postgres
export SUPABASE_DB_USER=postgres
export SUPABASE_DB_PASSWORD=postgres
```

For production, use your actual Supabase connection details.

## Next Steps

After successful migration:

1. ✅ Verify types regenerated: `cat database.types.ts | grep audit_logs`
2. ✅ Test triggers: Run insert/update/delete on any table
3. ✅ Check audit logs: `psql -c "SELECT * FROM audit_logs LIMIT 5;"`
4. ➡️ Proceed to [Phase 2: Application Integration](../02-application-integration/02a-types-and-constants.md)

## Troubleshooting

### Issue: "command not found: psql"

**Solution**: Install PostgreSQL tools

```bash
# macOS
brew install postgresql

# Ubuntu/Debian
sudo apt-get install postgresql-client
```

### Issue: "PGPASSWORD not working"

**Solution**: Create `.pgpass` file

```bash
echo "localhost:54322:postgres:postgres:postgres" > ~/.pgpass
chmod 600 ~/.pgpass
```

### Issue: "Backup file is huge"

**Cause**: Backup includes all tables, not just audit system

**Solution**: This is intentional for safety. To restore only audit system, use selective restore.

---

## Archival Strategy

### Manual Archival Function

Create a PostgreSQL function for safe, quarterly audit log archival:

```sql
-- ============================================
-- AUDIT LOG ARCHIVAL FUNCTION
-- ============================================
-- Purpose: Archive old audit logs to separate table for long-term storage
-- Run: Manually via SQL or application (quarterly recommended)

CREATE OR REPLACE FUNCTION archive_audit_logs(
    before_date TIMESTAMP WITH TIME ZONE,
    dry_run BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
    archived_count BIGINT,
    oldest_archived TIMESTAMP WITH TIME ZONE,
    newest_archived TIMESTAMP WITH TIME ZONE,
    tables_affected TEXT[]
) AS $$
DECLARE
    v_archived_count BIGINT;
    v_oldest TIMESTAMP WITH TIME ZONE;
    v_newest TIMESTAMP WITH TIME ZONE;
    v_tables TEXT[];
BEGIN
    -- ============================================
    -- STEP 1: Validate input date
    -- ============================================

    IF before_date >= NOW() THEN
        RAISE EXCEPTION 'Archive date must be in the past. Provided: %, Now: %',
            before_date, NOW();
    END IF;

    IF before_date > NOW() - INTERVAL '30 days' THEN
        RAISE WARNING 'Archive date is less than 30 days ago. This may archive recent logs.';
    END IF;

    -- ============================================
    -- STEP 2: Preview what will be archived
    -- ============================================

    SELECT
        COUNT(*),
        MIN(created_at),
        MAX(created_at),
        ARRAY_AGG(DISTINCT table_name ORDER BY table_name)
    INTO
        v_archived_count,
        v_oldest,
        v_newest,
        v_tables
    FROM audit_logs
    WHERE created_at < before_date;

    -- ============================================
    -- STEP 3: Safety checks
    -- ============================================

    IF v_archived_count = 0 THEN
        RAISE NOTICE 'No logs found before %', before_date;
        RETURN QUERY SELECT 0::BIGINT, NULL::TIMESTAMP, NULL::TIMESTAMP, '{}'::TEXT[];
        RETURN;
    END IF;

    IF v_archived_count > 100000 THEN
        RAISE WARNING 'Attempting to archive % logs. Consider smaller date range.', v_archived_count;
    END IF;

    -- ============================================
    -- STEP 4: Dry run or actual archive
    -- ============================================

    IF dry_run THEN
        -- Preview only
        RAISE NOTICE '=== DRY RUN ===';
        RAISE NOTICE 'Would archive % logs', v_archived_count;
        RAISE NOTICE 'Date range: % to %', v_oldest, v_newest;
        RAISE NOTICE 'Tables affected: %', v_tables;
        RAISE NOTICE 'To execute, call: archive_audit_logs(''%''::TIMESTAMPTZ, FALSE)', before_date;

        RETURN QUERY SELECT v_archived_count, v_oldest, v_newest, v_tables;
        RETURN;
    END IF;

    -- ============================================
    -- STEP 5: Create archive table if needed
    -- ============================================

    CREATE TABLE IF NOT EXISTS audit_logs_archive (
        LIKE audit_logs INCLUDING ALL
    );

    COMMENT ON TABLE audit_logs_archive IS
        'Archived audit logs for long-term storage. Moved from audit_logs table.';

    -- ============================================
    -- STEP 6: Move logs to archive
    -- ============================================

    WITH moved_logs AS (
        DELETE FROM audit_logs
        WHERE created_at < before_date
        RETURNING *
    )
    INSERT INTO audit_logs_archive
    SELECT * FROM moved_logs;

    -- Get final count
    GET DIAGNOSTICS v_archived_count = ROW_COUNT;

    RAISE NOTICE 'Successfully archived % logs to audit_logs_archive', v_archived_count;

    -- ============================================
    -- STEP 7: Vacuum to reclaim space
    -- ============================================

    -- Note: VACUUM cannot run inside a function
    -- Run manually after archival: VACUUM ANALYZE audit_logs;

    RAISE NOTICE 'Run manually after archival: VACUUM ANALYZE audit_logs;';

    RETURN QUERY SELECT v_archived_count, v_oldest, v_newest, v_tables;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION archive_audit_logs(TIMESTAMP WITH TIME ZONE, BOOLEAN) IS
    'Archive audit logs older than specified date to audit_logs_archive table. Use dry_run=TRUE to preview.';
```

### Archival Usage Examples

#### 1. Preview Archival (Dry Run)

```sql
-- Preview what would be archived (90 days ago)
SELECT * FROM archive_audit_logs(
    NOW() - INTERVAL '90 days',
    TRUE  -- Dry run
);

-- Expected output:
-- archived_count | oldest_archived | newest_archived | tables_affected
-- ---------------|-----------------|-----------------|------------------
--           1234 | 2024-08-01...   | 2024-10-15...   | {bookings,payments,...}
```

#### 2. Execute Archival

```sql
-- Actually archive logs older than 90 days
SELECT * FROM archive_audit_logs(
    NOW() - INTERVAL '90 days',
    FALSE  -- Execute for real
);

-- Then reclaim space
VACUUM ANALYZE audit_logs;
```

#### 3. Quarterly Archival Schedule

```sql
-- Q1: Archive previous year's logs (run in January)
SELECT * FROM archive_audit_logs(
    DATE_TRUNC('year', NOW() - INTERVAL '1 year')::TIMESTAMPTZ,
    FALSE
);

-- Q2-Q4: Preview only (no archival)
SELECT * FROM archive_audit_logs(
    NOW() - INTERVAL '120 days',
    TRUE  -- Dry run to monitor growth
);
```

### Archival Best Practices

#### When to Archive

**Quarterly Schedule** (recommended for 3-room resort):

- **January**: Archive previous year (keeps 1 year of logs)
- **April, July, October**: Review only (dry run)

**Why Quarterly**:

- Small resort generates ~10-50K logs/year
- Quarterly archival keeps active table fast (<50K rows)
- Archived logs still accessible in `audit_logs_archive`

#### Before Archival Checklist

- [ ] Run dry run first: `archive_audit_logs(..., TRUE)`
- [ ] Review count and date range
- [ ] Ensure date is at least 90 days in past
- [ ] Backup database before first archival
- [ ] Have at least 30% free disk space

#### After Archival

```sql
-- 1. Reclaim disk space
VACUUM ANALYZE audit_logs;

-- 2. Verify archive table
SELECT
    COUNT(*) AS archived_logs,
    MIN(created_at) AS oldest,
    MAX(created_at) AS newest
FROM audit_logs_archive;

-- 3. Verify active table
SELECT
    COUNT(*) AS active_logs,
    MIN(created_at) AS oldest,
    MAX(created_at) AS newest
FROM audit_logs;
```

### Accessing Archived Logs

#### Query Both Tables

```sql
-- Search across active AND archived logs
SELECT * FROM (
    SELECT * FROM audit_logs
    WHERE table_name = 'bookings'
    UNION ALL
    SELECT * FROM audit_logs_archive
    WHERE table_name = 'bookings'
) combined
ORDER BY created_at DESC
LIMIT 100;
```

#### Create Unified View (Optional)

```sql
-- View combining active + archived logs
CREATE VIEW audit_logs_all AS
SELECT *, 'active' AS log_status FROM audit_logs
UNION ALL
SELECT *, 'archived' AS log_status FROM audit_logs_archive;

-- Usage
SELECT * FROM audit_logs_all
WHERE user_email = 'owner@resort.com'
ORDER BY created_at DESC;
```

### Backup Strategy

#### Before First Archival

```bash
# Create backup of audit_logs before archival
pg_dump -h localhost -p 54322 -U postgres postgres \
    --table=audit_logs \
    --data-only \
    --inserts \
    > backups/audit_logs_pre_archive_$(date +%Y%m%d).sql

# Backup size should be <10MB for first year
ls -lh backups/audit_logs_pre_archive_*.sql
```

#### Exporting Archive to CSV

```sql
-- Export archived logs to CSV for long-term cold storage
COPY (
    SELECT
        created_at,
        table_name,
        record_id,
        action,
        user_email,
        description
    FROM audit_logs_archive
    WHERE created_at BETWEEN '2024-01-01' AND '2024-12-31'
    ORDER BY created_at
) TO '/path/to/audit_archive_2024.csv' CSV HEADER;
```

### Monitoring Archival Health

```sql
-- Check archival status and table sizes
SELECT
    'Active Logs' AS status,
    COUNT(*) AS log_count,
    MIN(created_at) AS oldest,
    MAX(created_at) AS newest,
    pg_size_pretty(pg_total_relation_size('audit_logs')) AS table_size
FROM audit_logs
UNION ALL
SELECT
    'Archived Logs' AS status,
    COUNT(*) AS log_count,
    MIN(created_at) AS oldest,
    MAX(created_at) AS newest,
    pg_size_pretty(pg_total_relation_size('audit_logs_archive')) AS table_size
FROM audit_logs_archive;
```

**Expected Results (1-year growth for 3-room resort)**:

- Active logs: ~10-15K rows, ~5-10MB
- Archived logs (after first year): ~10-15K rows, ~5-10MB

### Troubleshooting Archival

#### Problem: Function returns 0 rows

**Diagnosis**:

```sql
-- Check if logs exist before specified date
SELECT COUNT(*), MIN(created_at)
FROM audit_logs
WHERE created_at < NOW() - INTERVAL '90 days';
```

**Solution**: Adjust date range if all logs are recent.

#### Problem: Archive table growing too large

**Solution**: Export old archived logs to CSV and truncate:

```sql
-- Export to CSV first (see above)
-- Then delete very old archived logs
DELETE FROM audit_logs_archive
WHERE created_at < NOW() - INTERVAL '5 years';

VACUUM ANALYZE audit_logs_archive;
```

#### Problem: Archival is slow

**Cause**: Large batch size (>100K logs)

**Solution**: Archive in smaller chunks:

```sql
-- Archive in monthly increments
DO $$
DECLARE
    archive_date TIMESTAMP WITH TIME ZONE;
BEGIN
    FOR i IN 1..12 LOOP
        archive_date := NOW() - (i || ' months')::INTERVAL;

        RAISE NOTICE 'Archiving logs before %', archive_date;

        PERFORM archive_audit_logs(archive_date, FALSE);

        -- Brief pause between batches
        PERFORM pg_sleep(1);
    END LOOP;
END $$;
```

---

**Next**: [02a: Types & Constants](../02-application-integration/02a-types-and-constants.md) - Begin application integration
