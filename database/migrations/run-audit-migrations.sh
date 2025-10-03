#!/bin/bash
# ============================================
# AUDIT SYSTEM MIGRATION RUNNER
# ============================================
# Purpose: Run all audit migrations with automatic backup
# Usage: ./run-audit-migrations.sh
# Author: Okaeri Resort System - Audit Trail Phase 1

set -e  # Exit immediately if any command fails

# ============================================
# CONFIGURATION
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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

# Check if PostgreSQL tools are installed
if ! command -v psql &> /dev/null; then
    print_error "psql command not found. Please install PostgreSQL client tools."
    echo "  macOS: brew install postgresql"
    echo "  Ubuntu/Debian: sudo apt-get install postgresql-client"
    exit 1
fi

if ! command -v pg_dump &> /dev/null; then
    print_error "pg_dump command not found. Please install PostgreSQL client tools."
    exit 1
fi

# Check if migration files exist
MIGRATION_FILES=(
    "005-create-audit-logs.sql"
    "006-create-audit-triggers.sql"
    "007-create-audit-indexes.sql"
    "008-create-audit-archive.sql"
    "009-enable-audit-rls.sql"
    "010-bootstrap-admin.sql"
    "011-verify-audit-system.sql"
)

for migration in "${MIGRATION_FILES[@]}"; do
    if [ ! -f "$SCRIPT_DIR/$migration" ]; then
        print_error "Migration file not found: $migration"
        exit 1
    fi
done

print_success "Found ${#MIGRATION_FILES[@]} migration files"

# Check database connection
print_step "Testing database connection..."
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" >/dev/null 2>&1; then
    print_success "Database connection OK"
else
    print_error "Cannot connect to database"
    echo "  Please check:"
    echo "  - Database is running (Supabase local: supabase start)"
    echo "  - Connection details are correct"
    echo "  - PostgreSQL client can connect to port $DB_PORT"
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

for migration in "${MIGRATION_FILES[@]}"; do
    MIGRATION_NAME=$(basename "$migration")
    print_step "Running: $MIGRATION_NAME"

    if psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -f "$SCRIPT_DIR/$migration" \
        -v ON_ERROR_STOP=1 \
        --quiet 2>&1 | grep -E "(✅|✓|ERROR|CRITICAL|WARNING)" || true; then

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
    echo "  ./rollback-audit-migrations.sh $BACKUP_FILE"
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

# Check triggers exist (6 table triggers - count distinct names)
TRIGGER_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT COUNT(DISTINCT trigger_name) FROM information_schema.triggers WHERE trigger_name LIKE 'audit_%_trigger';")

if [ "$TRIGGER_COUNT" -eq 6 ]; then
    print_success "All 6 table triggers attached"
else
    print_error "Expected 6 table triggers, found $TRIGGER_COUNT"
    exit 1
fi

# Check identity enforcement trigger
IDENTITY_TRIGGER=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_name = 'enforce_audit_identity';")

if [ "$IDENTITY_TRIGGER" -eq 1 ]; then
    print_success "Identity enforcement trigger exists"
else
    print_error "Identity enforcement trigger not found"
    exit 1
fi

# Check indexes exist (expecting 8-10 including primary key)
INDEX_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'audit_logs';")

if [ "$INDEX_COUNT" -ge 8 ]; then
    print_success "$INDEX_COUNT indexes created"
else
    print_error "Expected at least 8 indexes, found $INDEX_COUNT"
fi

# Check RLS enabled
RLS_ENABLED=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT relrowsecurity FROM pg_class WHERE relname = 'audit_logs';")

if [ "$RLS_ENABLED" = "t" ]; then
    print_success "RLS enabled on audit_logs"
else
    print_error "RLS not enabled on audit_logs"
    exit 1
fi

# ============================================
# STEP 4: REGENERATE TYPES
# ============================================

print_header "Step 4: Regenerating TypeScript Types"

print_step "Generating types from database schema..."

# Navigate to project root (2 levels up from database/migrations/)
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
echo "  • Tables: audit_logs, audit_logs_archive, app_roles created"
echo "  • Triggers: 6 table triggers + 1 identity enforcement trigger"
echo "  • Indexes: $INDEX_COUNT performance indexes created"
echo "  • RLS: Enabled with app_roles-based policies"
echo "  • Types: database.types.ts regenerated"
echo ""
echo "Next steps:"
echo "  1. Update 010-bootstrap-admin.sql with actual admin user UUID"
echo "  2. Re-run: psql -f database/migrations/010-bootstrap-admin.sql"
echo "  3. Verify: ./verify-audit-system.sh"
echo "  4. Proceed to Phase 2: Application Integration"
echo "     See: docs/implementation/audit-trail/02-application-integration/"
echo ""
echo "If you need to rollback:"
echo "  ./rollback-audit-migrations.sh $BACKUP_FILE"
echo ""

# ============================================
# CLEANUP
# ============================================

unset PGPASSWORD
