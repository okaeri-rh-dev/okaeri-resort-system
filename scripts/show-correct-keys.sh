#!/bin/bash

# Script to show the CORRECT Supabase keys from local instance
# These are the JWT format keys that work with authentication

echo ""
echo "======================================================"
echo "  CORRECT SUPABASE KEYS (JWT FORMAT)"
echo "======================================================"
echo ""

# Get the full status
STATUS=$(npx supabase status --output json 2>/dev/null)

if [ $? -ne 0 ]; then
    echo "❌ Error: Could not get Supabase status"
    echo "Make sure Supabase is running: npx supabase start"
    exit 1
fi

# Extract the keys
ANON_KEY=$(echo "$STATUS" | jq -r '.ANON_KEY')
SERVICE_KEY=$(echo "$STATUS" | jq -r '.SERVICE_ROLE_KEY')
PUBLISHABLE=$(echo "$STATUS" | jq -r '.PUBLISHABLE_KEY')
SECRET=$(echo "$STATUS" | jq -r '.SECRET_KEY')

echo "📦 Local Supabase provides TWO types of keys:"
echo ""
echo "1️⃣  JWT FORMAT (✅ USE THESE):"
echo "   These work with Supabase client and authentication"
echo ""
echo "   ANON_KEY (for frontend):"
echo "   $ANON_KEY"
echo ""
echo "   SERVICE_ROLE_KEY (for backend):"
echo "   $SERVICE_KEY"
echo ""
echo ""
echo "2️⃣  SHORT FORMAT (❌ DON'T USE THESE):"
echo "   These are just identifiers, don't work with auth"
echo ""
echo "   PUBLISHABLE_KEY:"
echo "   $PUBLISHABLE"
echo ""
echo "   SECRET_KEY:"
echo "   $SECRET"
echo ""
echo "======================================================"
echo "  UPDATE YOUR .env.local"
echo "======================================================"
echo ""
echo "Replace these lines in your .env.local:"
echo ""
echo "VITE_SUPABASE_ANON_KEY=$ANON_KEY"
echo ""
echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY"
echo ""
echo "======================================================"
echo ""
