#!/bin/bash

# Database Migration Runner for Supabase
# Handles guest booking schema migrations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "================================================"
echo "   Supabase Database Migration Runner"
echo "================================================"
echo ""

# Function to display usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -u, --url DATABASE_URL     Database connection URL"
    echo "  -p, --project PROJECT_REF   Supabase project reference"
    echo "  -k, --password PASSWORD     Database password"
    echo "  -m, --method METHOD         Migration method (cli|api|psql)"
    echo "  -h, --help                  Display this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --method cli"
    echo "  $0 --url 'postgresql://...'"
    echo "  $0 --project abc123xyz --password mypassword"
    exit 0
}

# Parse command line arguments
METHOD="cli"
while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--url)
            DATABASE_URL="$2"
            shift 2
            ;;
        -p|--project)
            PROJECT_REF="$2"
            shift 2
            ;;
        -k|--password)
            DB_PASSWORD="$2"
            shift 2
            ;;
        -m|--method)
            METHOD="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            usage
            ;;
    esac
done

# Migration SQL file
MIGRATION_FILE="database/migrations/013-guest-booking-schema.sql"

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Migration file not found: $MIGRATION_FILE${NC}"
    exit 1
fi

echo -e "${BLUE}📄 Migration file: $MIGRATION_FILE${NC}"
echo ""

# Function to run migration via Supabase CLI
run_migration_cli() {
    echo "Method: Supabase CLI"
    echo "----------------------------------------"

    # Check if Supabase CLI is installed
    if ! command -v supabase &> /dev/null; then
        echo -e "${YELLOW}⚠️  Supabase CLI not installed${NC}"
        echo ""
        echo "Install with: brew install supabase/tap/supabase"
        echo "Or visit: https://supabase.com/docs/guides/cli"
        return 1
    fi

    # Check if project is linked
    if [ ! -f "supabase/.temp/project-ref" ]; then
        echo -e "${YELLOW}Project not linked. Linking now...${NC}"

        if [ -z "$PROJECT_REF" ]; then
            echo -e "${RED}❌ Project reference required${NC}"
            echo "Run: supabase link --project-ref YOUR_PROJECT_REF"
            return 1
        fi

        supabase link --project-ref "$PROJECT_REF"
    fi

    # Run migration
    echo "Running migration..."
    if supabase db push --include "$MIGRATION_FILE"; then
        echo -e "${GREEN}✅ Migration completed successfully via CLI${NC}"
        return 0
    else
        echo -e "${RED}❌ Migration failed${NC}"
        return 1
    fi
}

# Function to run migration via API (SQL Editor)
run_migration_api() {
    echo "Method: Supabase API (SQL Editor)"
    echo "----------------------------------------"

    # Check required variables
    if [ -z "$PROJECT_REF" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
        echo -e "${YELLOW}Loading from .env.local...${NC}"
        if [ -f .env.local ]; then
            source .env.local
            PROJECT_REF="${SUPABASE_PROJECT_REF:-$PROJECT_REF}"
        fi
    fi

    if [ -z "$PROJECT_REF" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
        echo -e "${RED}❌ Missing required environment variables${NC}"
        echo "Required: PROJECT_REF and SUPABASE_SERVICE_ROLE_KEY"
        return 1
    fi

    # Read migration SQL
    MIGRATION_SQL=$(cat "$MIGRATION_FILE")

    # Execute via Supabase API
    echo "Executing migration via API..."
    RESPONSE=$(curl -s -X POST \
        "https://${PROJECT_REF}.supabase.co/rest/v1/rpc/exec_sql" \
        -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"query\": $(echo "$MIGRATION_SQL" | jq -Rs .)}" 2>&1)

    if echo "$RESPONSE" | grep -q "error"; then
        echo -e "${RED}❌ Migration failed:${NC}"
        echo "$RESPONSE" | jq .
        return 1
    else
        echo -e "${GREEN}✅ Migration completed successfully via API${NC}"
        return 0
    fi
}

# Function to run migration via psql
run_migration_psql() {
    echo "Method: psql (Direct Connection)"
    echo "----------------------------------------"

    # Check if psql is installed
    if ! command -v psql &> /dev/null; then
        echo -e "${RED}❌ psql not installed${NC}"
        echo "Install with: brew install postgresql"
        return 1
    fi

    # Build connection URL if not provided
    if [ -z "$DATABASE_URL" ]; then
        if [ -z "$PROJECT_REF" ] || [ -z "$DB_PASSWORD" ]; then
            echo -e "${YELLOW}Loading from .env.local...${NC}"
            if [ -f .env.local ]; then
                source .env.local
                PROJECT_REF="${SUPABASE_PROJECT_REF:-$PROJECT_REF}"
                DB_PASSWORD="${SUPABASE_DB_PASSWORD:-$DB_PASSWORD}"
            fi
        fi

        if [ -z "$PROJECT_REF" ] || [ -z "$DB_PASSWORD" ]; then
            echo -e "${RED}❌ Missing database connection details${NC}"
            echo "Provide either DATABASE_URL or PROJECT_REF + DB_PASSWORD"
            return 1
        fi

        DATABASE_URL="postgresql://postgres:${DB_PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres"
    fi

    # Run migration
    echo "Connecting to database..."
    if psql "$DATABASE_URL" -f "$MIGRATION_FILE"; then
        echo -e "${GREEN}✅ Migration completed successfully via psql${NC}"
        return 0
    else
        echo -e "${RED}❌ Migration failed${NC}"
        return 1
    fi
}

# Function to verify migration
verify_migration() {
    echo ""
    echo "Verifying migration..."
    echo "----------------------------------------"

    local PROJECT_REF="${PROJECT_REF:-${SUPABASE_PROJECT_REF}}"
    local ANON_KEY="${VITE_SUPABASE_ANON_KEY}"

    if [ -z "$PROJECT_REF" ] || [ -z "$ANON_KEY" ]; then
        echo -e "${YELLOW}⚠️  Cannot verify - missing API credentials${NC}"
        return 1
    fi

    # Check if columns exist
    RESPONSE=$(curl -s "https://${PROJECT_REF}.supabase.co/rest/v1/bookings?select=is_guest_booking,upload_status&limit=0" \
        -H "apikey: ${ANON_KEY}" \
        -H "Prefer: count=exact" 2>&1)

    if echo "$RESPONSE" | grep -q "error"; then
        echo -e "${RED}❌ Verification failed - columns not found${NC}"
        echo "Error: $RESPONSE"
        return 1
    else
        echo -e "${GREEN}✅ Guest booking columns verified${NC}"
    fi

    # Check if function exists
    FUNC_CHECK=$(curl -s "https://${PROJECT_REF}.supabase.co/rest/v1/rpc/check_unit_availability" \
        -H "apikey: ${ANON_KEY}" \
        -H "Content-Type: application/json" \
        -d '{"p_unit_id": "00000000-0000-0000-0000-000000000000", "p_check_in": "2025-01-01T00:00:00Z", "p_check_out": "2025-01-02T00:00:00Z"}' 2>&1)

    if echo "$FUNC_CHECK" | grep -q "true\|false"; then
        echo -e "${GREEN}✅ Availability check function verified${NC}"
    else
        echo -e "${YELLOW}⚠️  Function may not be accessible${NC}"
    fi

    return 0
}

# Main execution
echo -e "${BLUE}🚀 Starting migration process...${NC}"
echo ""

case $METHOD in
    cli)
        run_migration_cli
        ;;
    api)
        run_migration_api
        ;;
    psql)
        run_migration_psql
        ;;
    *)
        echo -e "${RED}❌ Invalid method: $METHOD${NC}"
        echo "Valid methods: cli, api, psql"
        exit 1
        ;;
esac

# Verify if successful
if [ $? -eq 0 ]; then
    verify_migration
    echo ""
    echo -e "${GREEN}════════════════════════════════════════${NC}"
    echo -e "${GREEN}✅ Migration completed successfully!${NC}"
    echo -e "${GREEN}════════════════════════════════════════${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Test guest booking functionality"
    echo "2. Verify file upload works"
    echo "3. Check status endpoint"
else
    echo ""
    echo -e "${RED}════════════════════════════════════════${NC}"
    echo -e "${RED}❌ Migration failed!${NC}"
    echo -e "${RED}════════════════════════════════════════${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "1. Check database connection"
    echo "2. Verify credentials in .env.local"
    echo "3. Try a different method (--method api|psql)"
    echo "4. Check Supabase dashboard logs"
    exit 1
fi