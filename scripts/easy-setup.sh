#!/bin/bash

# Easy Setup Script for Guest Booking System
# Guides through the complete deployment process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

clear

echo -e "${CYAN}================================================${NC}"
echo -e "${CYAN}     🚀 Guest Booking System Easy Setup${NC}"
echo -e "${CYAN}================================================${NC}"
echo ""
echo "This script will help you deploy the guest booking system"
echo "step by step. Let's get started!"
echo ""

# Function to prompt for input
prompt() {
    local var_name="$1"
    local prompt_text="$2"
    local default_value="$3"

    if [ -n "$default_value" ]; then
        read -p "$prompt_text [$default_value]: " input_value
        eval "$var_name=\"${input_value:-$default_value}\""
    else
        read -p "$prompt_text: " input_value
        while [ -z "$input_value" ]; do
            echo -e "${RED}This field is required${NC}"
            read -p "$prompt_text: " input_value
        done
        eval "$var_name=\"$input_value\""
    fi
}

# Function to prompt for yes/no
confirm() {
    local prompt_text="$1"
    local response

    while true; do
        read -p "$prompt_text (y/n): " response
        case "$response" in
            [yY][eE][sS]|[yY])
                return 0
                ;;
            [nN][oO]|[nN])
                return 1
                ;;
            *)
                echo "Please answer yes or no."
                ;;
        esac
    done
}

# Check for required tools
echo -e "${BLUE}📋 Checking Prerequisites...${NC}"
echo "----------------------------------------"

MISSING_TOOLS=""

check_tool() {
    if command -v "$1" &> /dev/null; then
        echo -e "✅ $1 installed"
    else
        echo -e "❌ $1 not found"
        MISSING_TOOLS="$MISSING_TOOLS $1"
    fi
}

check_tool "node"
check_tool "npm"
check_tool "wrangler"
check_tool "psql"
check_tool "curl"
check_tool "jq"

if [ -n "$MISSING_TOOLS" ]; then
    echo ""
    echo -e "${YELLOW}⚠️  Missing tools:$MISSING_TOOLS${NC}"
    echo ""
    echo "Installation instructions:"
    echo "• Node.js: https://nodejs.org/"
    echo "• Wrangler: npm install -g wrangler"
    echo "• PostgreSQL: brew install postgresql"
    echo "• jq: brew install jq"
    echo ""

    if ! confirm "Continue anyway?"; then
        exit 1
    fi
fi

echo ""
echo -e "${BLUE}🔐 Step 1: Environment Configuration${NC}"
echo "----------------------------------------"

# Check for .env.local
if [ -f .env.local ]; then
    echo -e "${GREEN}Found existing .env.local${NC}"
    if confirm "Do you want to update it?"; then
        cp .env.local .env.local.backup
        echo "Backup saved as .env.local.backup"
    else
        source .env.local
        echo "Using existing configuration"
    fi
else
    echo "Creating .env.local..."
    touch .env.local
fi

# Collect environment variables
echo ""
echo "Please provide your configuration details:"
echo ""

prompt "SUPABASE_PROJECT_REF" "Supabase project reference" "${SUPABASE_PROJECT_REF}"
prompt "VITE_SUPABASE_URL" "Supabase URL" "https://${SUPABASE_PROJECT_REF}.supabase.co"
prompt "VITE_SUPABASE_ANON_KEY" "Supabase anon key" "${VITE_SUPABASE_ANON_KEY}"
prompt "SUPABASE_SERVICE_ROLE_KEY" "Supabase service role key (secret)" "${SUPABASE_SERVICE_ROLE_KEY}"
prompt "VITE_TURNSTILE_SITE_KEY" "Cloudflare Turnstile site key" "${VITE_TURNSTILE_SITE_KEY}"
prompt "TURNSTILE_SECRET_KEY" "Cloudflare Turnstile secret key" "${TURNSTILE_SECRET_KEY}"
prompt "RESEND_API_KEY" "Resend API key (optional)" "${RESEND_API_KEY}"
prompt "DOMAIN" "Your domain (e.g., your-resort.pages.dev)" "${DOMAIN}"

# Save to .env.local
cat > .env.local << EOF
# Supabase Configuration
SUPABASE_PROJECT_REF=${SUPABASE_PROJECT_REF}
VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}

# Cloudflare Turnstile
VITE_TURNSTILE_SITE_KEY=${VITE_TURNSTILE_SITE_KEY}
TURNSTILE_SECRET_KEY=${TURNSTILE_SECRET_KEY}

# Email Service (Optional)
RESEND_API_KEY=${RESEND_API_KEY}

# Application
DOMAIN=${DOMAIN}
VITE_APP_URL=https://${DOMAIN}
NODE_ENV=production
EOF

echo -e "${GREEN}✅ Environment configuration saved${NC}"

echo ""
echo -e "${BLUE}🗄️  Step 2: Database Migration${NC}"
echo "----------------------------------------"

if confirm "Run database migration now?"; then
    echo "Select migration method:"
    echo "1) Supabase CLI (recommended)"
    echo "2) Supabase API"
    echo "3) Direct psql connection"

    read -p "Choose method (1-3): " method_choice

    case "$method_choice" in
        1)
            ./scripts/run-migrations.sh --method cli --project "$SUPABASE_PROJECT_REF"
            ;;
        2)
            # Export variables for the API method
            export SUPABASE_PROJECT_REF
            export SUPABASE_SERVICE_ROLE_KEY
            ./scripts/run-migrations.sh --method api --project "$SUPABASE_PROJECT_REF"
            ;;
        3)
            prompt "DB_PASSWORD" "Database password" ""
            ./scripts/run-migrations.sh --method psql --project "$SUPABASE_PROJECT_REF" --password "$DB_PASSWORD"
            ;;
        *)
            echo -e "${YELLOW}Skipping migration - run manually later${NC}"
            ;;
    esac
else
    echo -e "${YELLOW}Skipping migration - run scripts/run-migrations.sh later${NC}"
fi

echo ""
echo -e "${BLUE}☁️  Step 3: Cloudflare Configuration${NC}"
echo "----------------------------------------"

if confirm "Configure Cloudflare settings?"; then
    prompt "CLOUDFLARE_ZONE_ID" "Cloudflare Zone ID" "${CLOUDFLARE_ZONE_ID}"
    prompt "CLOUDFLARE_API_TOKEN" "Cloudflare API Token" ""

    echo "Running Cloudflare configuration..."
    ./scripts/configure-cloudflare.sh \
        --zone "$CLOUDFLARE_ZONE_ID" \
        --token "$CLOUDFLARE_API_TOKEN" \
        --domain "$DOMAIN"
else
    echo -e "${YELLOW}Skipping Cloudflare config - run scripts/configure-cloudflare.sh later${NC}"
fi

echo ""
echo -e "${BLUE}🔑 Step 4: KV Namespace Setup${NC}"
echo "----------------------------------------"

if confirm "Create KV namespace for rate limiting?"; then
    echo "Creating KV namespace..."
    KV_OUTPUT=$(wrangler kv:namespace create "RATE_LIMIT_KV" 2>&1)

    if echo "$KV_OUTPUT" | grep -q "id ="; then
        KV_ID=$(echo "$KV_OUTPUT" | grep "id =" | cut -d'"' -f2)
        echo -e "${GREEN}✅ KV namespace created: $KV_ID${NC}"

        # Update wrangler.toml
        if grep -q "RATE_LIMIT_KV" wrangler.toml; then
            echo "KV namespace already in wrangler.toml"
        else
            cat >> wrangler.toml << EOF

[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "$KV_ID"
EOF
            echo "Added KV namespace to wrangler.toml"
        fi
    else
        echo -e "${RED}Failed to create KV namespace${NC}"
        echo "$KV_OUTPUT"
    fi
else
    echo -e "${YELLOW}Skipping KV setup - create manually with wrangler${NC}"
fi

echo ""
echo -e "${BLUE}🔒 Step 5: Set Cloudflare Secrets${NC}"
echo "----------------------------------------"

if confirm "Set Cloudflare secrets now?"; then
    echo "Setting secrets (you'll be prompted for each)..."

    echo "Setting SUPABASE_SERVICE_ROLE_KEY..."
    echo "$SUPABASE_SERVICE_ROLE_KEY" | wrangler secret put SUPABASE_SERVICE_ROLE_KEY

    echo "Setting TURNSTILE_SECRET_KEY..."
    echo "$TURNSTILE_SECRET_KEY" | wrangler secret put TURNSTILE_SECRET_KEY

    if [ -n "$RESEND_API_KEY" ]; then
        echo "Setting RESEND_API_KEY..."
        echo "$RESEND_API_KEY" | wrangler secret put RESEND_API_KEY
    fi

    echo -e "${GREEN}✅ Secrets configured${NC}"
else
    echo -e "${YELLOW}Remember to set secrets with wrangler secret put${NC}"
fi

echo ""
echo -e "${BLUE}🏗️  Step 6: Build & Deploy${NC}"
echo "----------------------------------------"

if confirm "Build and deploy to Cloudflare Pages?"; then
    echo "Building application..."
    npm run build

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Build successful${NC}"

        echo "Deploying to Cloudflare Pages..."
        npx wrangler pages deploy dist --project-name "${DOMAIN%%.*}"

        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Deployment successful!${NC}"
        else
            echo -e "${RED}Deployment failed - check error messages${NC}"
        fi
    else
        echo -e "${RED}Build failed - fix errors and try again${NC}"
    fi
else
    echo -e "${YELLOW}Skipping deployment - run ./scripts/deploy.sh later${NC}"
fi

echo ""
echo -e "${BLUE}✅ Step 7: Verification${NC}"
echo "----------------------------------------"

if confirm "Run deployment verification?"; then
    export DOMAIN
    export SUPABASE_PROJECT_REF
    export VITE_SUPABASE_ANON_KEY

    ./scripts/verify-deployment.sh
else
    echo -e "${YELLOW}Run scripts/verify-deployment.sh to verify${NC}"
fi

echo ""
echo -e "${CYAN}================================================${NC}"
echo -e "${CYAN}         🎉 Setup Complete!${NC}"
echo -e "${CYAN}================================================${NC}"
echo ""
echo -e "${GREEN}Your guest booking system is ready!${NC}"
echo ""
echo "📝 Next Steps:"
echo "1. Test the guest booking form at: https://${DOMAIN}/guest-booking"
echo "2. Monitor quotas at: https://${DOMAIN}/api/monitoring/check-quotas"
echo "3. View admin dashboard at: https://${DOMAIN}/admin/monitoring"
echo ""
echo "📚 Documentation:"
echo "• Guest Booking Docs: vault note [[guest-booking-multi-unit README]]"
echo "• Verification Report: vault note [[COMPLETE_SYSTEM_VERIFICATION_REPORT]]"
echo ""
echo "🛠️  Useful Commands:"
echo "• Check status: ./scripts/verify-deployment.sh"
echo "• View logs: wrangler tail"
echo "• Run tests: npm test"
echo "• Update deployment: ./scripts/deploy.sh production"
echo ""

if [ -f .env.local.backup ]; then
    echo -e "${YELLOW}Note: Your previous .env.local was backed up to .env.local.backup${NC}"
fi

echo ""
echo -e "${GREEN}Happy hosting! 🏖️${NC}"