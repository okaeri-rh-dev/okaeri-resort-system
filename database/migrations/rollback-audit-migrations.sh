#!/bin/bash
# ============================================
# AUDIT SYSTEM ROLLBACK SCRIPT
# ============================================
# Purpose: Restore database from backup
# Usage: ./rollback-audit-migrations.sh <backup_file>
# Author: Okaeri Resort System - Audit Trail Phase 1

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
    echo "Usage: ./rollback-audit-migrations.sh <backup_file>"
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

# Parse DATABASE_URL if set (production), otherwise use local defaults
if [ -n "$DATABASE_URL" ]; then
    # Extract components from DATABASE_URL
    # Format: postgresql://user:password@host:port/database

    # Remove protocol prefix
    DB_URL_NO_PROTOCOL="${DATABASE_URL#*://}"

    # Extract user and password (before @)
    DB_USER_PASS="${DB_URL_NO_PROTOCOL%%@*}"
    DB_USER="${DB_USER_PASS%%:*}"
    DB_PASSWORD="${DB_USER_PASS#*:}"

    # Extract host, port, and database (after @)
    DB_HOST_PORT_DB="${DB_URL_NO_PROTOCOL#*@}"

    # Extract host and port (before /)
    DB_HOST_PORT="${DB_HOST_PORT_DB%%/*}"
    DB_HOST="${DB_HOST_PORT%%:*}"
    DB_PORT="${DB_HOST_PORT#*:}"

    # Extract database name (after /)
    DB_NAME="${DB_HOST_PORT_DB#*/}"
    # Remove any query parameters (like ?sslmode=require)
    DB_NAME="${DB_NAME%%\?*}"
else
    # Supabase local instance (default)
    DB_HOST="${SUPABASE_DB_HOST:-localhost}"
    DB_PORT="${SUPABASE_DB_PORT:-54322}"
    DB_NAME="${SUPABASE_DB_NAME:-postgres}"
    DB_USER="${SUPABASE_DB_USER:-postgres}"
    DB_PASSWORD="${SUPABASE_DB_PASSWORD:-postgres}"
fi

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
echo -e "${RED}  1. Drop all audit system objects (tables, triggers, functions)${NC}"
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
-- Drop tables (CASCADE to remove dependent objects)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS audit_logs_archive CASCADE;
DROP TABLE IF EXISTS app_roles CASCADE;

-- Drop functions (CASCADE removes triggers)
DROP FUNCTION IF EXISTS audit_trigger_func() CASCADE;
DROP FUNCTION IF EXISTS enforce_audit_identity_func() CASCADE;
DROP FUNCTION IF EXISTS attach_audit_trigger(TEXT) CASCADE;
DROP FUNCTION IF EXISTS detach_audit_trigger(TEXT) CASCADE;
DROP FUNCTION IF EXISTS archive_audit_logs(TIMESTAMPTZ, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS archive_logs_older_than_months(INTEGER, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS monthly_archive_until(TIMESTAMPTZ, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS restore_logs_from_archive(TIMESTAMPTZ, TIMESTAMPTZ) CASCADE;
DROP FUNCTION IF EXISTS get_current_audit_role() CASCADE;
DROP FUNCTION IF EXISTS is_audit_admin() CASCADE;
DROP FUNCTION IF EXISTS is_audit_owner() CASCADE;
DROP FUNCTION IF EXISTS is_audit_manager() CASCADE;
DROP FUNCTION IF EXISTS can_view_all_audit_logs() CASCADE;
DROP FUNCTION IF EXISTS grant_audit_role(UUID, TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS revoke_audit_role(UUID) CASCADE;

-- Drop views
DROP VIEW IF EXISTS audit_index_stats CASCADE;
DROP VIEW IF EXISTS audit_archive_stats CASCADE;
DROP VIEW IF EXISTS audit_system_status CASCADE;
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
echo "Database restored to state before audit migration."
echo "Backup used: $BACKUP_FILE"
echo ""

unset PGPASSWORD
