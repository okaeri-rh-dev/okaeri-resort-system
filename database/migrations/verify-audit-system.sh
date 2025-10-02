#!/bin/bash
# ============================================
# AUDIT SYSTEM VERIFICATION SCRIPT
# ============================================
# Purpose: Health check for audit system
# Usage: ./verify-audit-system.sh
# Author: Okaeri Resort System - Audit Trail Phase 1

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

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Audit System Health Check${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# ============================================
# CHECK 1: Tables Exist
# ============================================

echo "Checking tables..."

TABLE_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_logs');")

if [ "$TABLE_EXISTS" = "t" ]; then
    echo -e "  ${GREEN}✓${NC} audit_logs table exists"
else
    echo -e "  ${RED}✗${NC} audit_logs table missing"
fi

ARCHIVE_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_logs_archive');")

if [ "$ARCHIVE_EXISTS" = "t" ]; then
    echo -e "  ${GREEN}✓${NC} audit_logs_archive table exists"
else
    echo -e "  ${RED}✗${NC} audit_logs_archive table missing"
fi

APP_ROLES_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'app_roles');")

if [ "$APP_ROLES_EXISTS" = "t" ]; then
    echo -e "  ${GREEN}✓${NC} app_roles table exists"
else
    echo -e "  ${RED}✗${NC} app_roles table missing"
fi

# ============================================
# CHECK 2: Triggers
# ============================================

echo ""
echo "Checking triggers..."

TRIGGER_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT COUNT(DISTINCT trigger_name) FROM information_schema.triggers WHERE trigger_name LIKE 'audit_%_trigger';")

if [ "$TRIGGER_COUNT" -eq 6 ]; then
    echo -e "  ${GREEN}✓${NC} All 6 table triggers attached"
else
    echo -e "  ${RED}✗${NC} Expected 6 table triggers, found $TRIGGER_COUNT"
fi

IDENTITY_TRIGGER=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_name = 'enforce_audit_identity';")

if [ "$IDENTITY_TRIGGER" -eq 1 ]; then
    echo -e "  ${GREEN}✓${NC} Identity enforcement trigger exists"
else
    echo -e "  ${RED}✗${NC} Identity enforcement trigger missing"
fi

# ============================================
# CHECK 3: Indexes
# ============================================

echo ""
echo "Checking indexes..."

INDEX_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'audit_logs';")

if [ "$INDEX_COUNT" -ge 8 ]; then
    echo -e "  ${GREEN}✓${NC} Performance indexes created ($INDEX_COUNT indexes)"
else
    echo -e "  ${YELLOW}⚠${NC} Expected at least 8 indexes, found $INDEX_COUNT"
fi

# ============================================
# CHECK 4: RLS Enabled
# ============================================

echo ""
echo "Checking Row Level Security..."

RLS_AUDIT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT relrowsecurity FROM pg_class WHERE relname = 'audit_logs';")

if [ "$RLS_AUDIT" = "t" ]; then
    echo -e "  ${GREEN}✓${NC} RLS enabled on audit_logs"
else
    echo -e "  ${RED}✗${NC} RLS not enabled on audit_logs"
fi

RLS_ARCHIVE=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT relrowsecurity FROM pg_class WHERE relname = 'audit_logs_archive';")

if [ "$RLS_ARCHIVE" = "t" ]; then
    echo -e "  ${GREEN}✓${NC} RLS enabled on audit_logs_archive"
else
    echo -e "  ${RED}✗${NC} RLS not enabled on audit_logs_archive"
fi

RLS_APP_ROLES=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT relrowsecurity FROM pg_class WHERE relname = 'app_roles';")

if [ "$RLS_APP_ROLES" = "t" ]; then
    echo -e "  ${GREEN}✓${NC} RLS enabled on app_roles"
else
    echo -e "  ${RED}✗${NC} RLS not enabled on app_roles"
fi

# ============================================
# CHECK 5: Policies
# ============================================

echo ""
echo "Checking RLS policies..."

POLICY_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT COUNT(*) FROM pg_policies WHERE tablename = 'audit_logs';")

if [ "$POLICY_COUNT" -eq 4 ]; then
    echo -e "  ${GREEN}✓${NC} audit_logs has 4 policies (SELECT, INSERT, UPDATE, DELETE)"
else
    echo -e "  ${YELLOW}⚠${NC} Expected 4 policies, found $POLICY_COUNT"
fi

# ============================================
# CHECK 6: Active Roles
# ============================================

echo ""
echo "Checking active roles..."

ROLE_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT COUNT(*) FROM app_roles WHERE is_active = true;")

if [ "$ROLE_COUNT" -gt 0 ]; then
    echo -e "  ${GREEN}✓${NC} Active roles: $ROLE_COUNT"

    # List roles
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
        "SELECT '    ' || role || ': ' || email FROM app_roles WHERE is_active = true;"
else
    echo -e "  ${YELLOW}⚠${NC} No active roles found"
    echo "    Run 010-bootstrap-admin.sql to create initial admin"
fi

# ============================================
# CHECK 7: Recent Activity
# ============================================

echo ""
echo "Checking recent activity..."

RECENT_LOGS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT COUNT(*) FROM audit_logs WHERE created_at > NOW() - INTERVAL '1 hour';")

echo -e "  ${GREEN}✓${NC} Audit logs in last hour: $RECENT_LOGS"

# ============================================
# CHECK 8: Functions
# ============================================

echo ""
echo "Checking functions..."

ARCHIVE_FUNC_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('archive_audit_logs', 'archive_logs_older_than_months', 'monthly_archive_until', 'restore_logs_from_archive');")

if [ "$ARCHIVE_FUNC_COUNT" -ge 4 ]; then
    echo -e "  ${GREEN}✓${NC} Archive functions: $ARCHIVE_FUNC_COUNT"
else
    echo -e "  ${YELLOW}⚠${NC} Expected at least 4 archive functions, found $ARCHIVE_FUNC_COUNT"
fi

HELPER_FUNC_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name LIKE '%audit%';")

if [ "$HELPER_FUNC_COUNT" -ge 7 ]; then
    echo -e "  ${GREEN}✓${NC} Helper functions: $HELPER_FUNC_COUNT"
else
    echo -e "  ${YELLOW}⚠${NC} Expected at least 7 helper functions, found $HELPER_FUNC_COUNT"
fi

# ============================================
# CHECK 9: Table Sizes
# ============================================

echo ""
echo "Checking table sizes..."

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c \
    "SELECT
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
    FROM pg_tables
    WHERE tablename IN ('audit_logs', 'audit_logs_archive', 'app_roles')
    ORDER BY tablename;" \
    -t -A -F ' | ' | sed 's/^/  /'

# ============================================
# SUMMARY
# ============================================

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Health Check Complete${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

unset PGPASSWORD
