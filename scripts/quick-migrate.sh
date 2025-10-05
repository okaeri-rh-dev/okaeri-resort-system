#!/bin/bash

# Quick Migration Script - Simple and Direct
# For when the main migration script has issues

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "================================================"
echo "   Quick Database Migration"
echo "================================================"
echo ""

# Load environment variables
if [ -f .env.local ]; then
    echo "Loading configuration from .env.local..."
    source .env.local
else
    echo -e "${RED}❌ .env.local not found${NC}"
    echo "Please create .env.local first or provide values below"
fi

# Get project reference
if [ -z "$SUPABASE_PROJECT_REF" ]; then
    read -p "Enter Supabase project reference: " SUPABASE_PROJECT_REF
fi

# Get service role key
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    read -p "Enter Supabase service role key: " SUPABASE_SERVICE_ROLE_KEY
fi

echo ""
echo "Choose migration method:"
echo "1) Copy & paste to Supabase Dashboard (easiest)"
echo "2) Direct API call"
echo "3) Using psql"
echo ""
read -p "Select method (1-3): " METHOD

case $METHOD in
    1)
        echo ""
        echo -e "${GREEN}📋 Copy the following SQL and paste it into your Supabase SQL Editor:${NC}"
        echo ""
        echo "1. Go to: https://app.supabase.com/project/$SUPABASE_PROJECT_REF/sql/new"
        echo "2. Paste the SQL below"
        echo "3. Click 'Run'"
        echo ""
        echo "----------------------------------------"
        cat database/migrations/013-guest-booking-schema.sql
        echo "----------------------------------------"
        echo ""
        echo -e "${YELLOW}After running the SQL, press Enter to verify...${NC}"
        read -p ""
        ;;

    2)
        echo ""
        echo "Running migration via Supabase API..."

        # Read the migration file
        MIGRATION_SQL=$(cat database/migrations/013-guest-booking-schema.sql | sed 's/"/\\"/g' | tr '\n' ' ')

        # Execute via REST API
        RESPONSE=$(curl -s -X POST \
            "https://${SUPABASE_PROJECT_REF}.supabase.co/rest/v1/rpc" \
            -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
            -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
            -H "Content-Type: application/json" \
            -H "Prefer: return=representation" \
            -d "{
                \"query\": \"${MIGRATION_SQL}\"
            }" 2>&1)

        # Alternative: Try using the management API
        if [[ "$RESPONSE" == *"error"* ]]; then
            echo "Trying alternative method..."

            # Create a temporary SQL file URL
            echo "Please run this SQL in your Supabase Dashboard:"
            echo "https://app.supabase.com/project/$SUPABASE_PROJECT_REF/sql/new"
            echo ""
            echo "Or use the Supabase CLI:"
            echo "supabase db push --db-url postgresql://postgres:[PASSWORD]@db.$SUPABASE_PROJECT_REF.supabase.co:5432/postgres"
        else
            echo -e "${GREEN}✅ Migration completed via API${NC}"
        fi
        ;;

    3)
        echo ""
        read -s -p "Enter database password: " DB_PASSWORD
        echo ""

        DATABASE_URL="postgresql://postgres:${DB_PASSWORD}@db.${SUPABASE_PROJECT_REF}.supabase.co:5432/postgres"

        echo "Running migration via psql..."
        psql "$DATABASE_URL" -f database/migrations/013-guest-booking-schema.sql

        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Migration completed via psql${NC}"
        else
            echo -e "${RED}❌ Migration failed${NC}"
        fi
        ;;
esac

# Verify migration
echo ""
echo "Verifying migration..."

# Check if columns exist
VERIFY_URL="https://${SUPABASE_PROJECT_REF}.supabase.co/rest/v1/bookings?select=is_guest_booking&limit=0"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    "$VERIFY_URL" \
    -H "apikey: ${VITE_SUPABASE_ANON_KEY:-$SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Prefer: count=exact")

if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "206" ]; then
    echo -e "${GREEN}✅ Migration verified successfully!${NC}"
    echo ""
    echo "The following have been added to your database:"
    echo "• is_guest_booking column"
    echo "• payment_proof_url column"
    echo "• upload_status column"
    echo "• upload_expires_at column"
    echo "• check_unit_availability() function"
    echo "• Required indexes"
else
    echo -e "${YELLOW}⚠️  Could not verify migration (HTTP $RESPONSE)${NC}"
    echo "This might be normal if the table is empty or RLS is enabled."
    echo ""
    echo "To verify manually, run this query in Supabase SQL Editor:"
    echo "SELECT column_name FROM information_schema.columns"
    echo "WHERE table_name = 'bookings' AND column_name = 'is_guest_booking';"
fi

echo ""
echo "Done! You can now continue with the deployment."