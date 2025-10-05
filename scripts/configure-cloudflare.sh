#!/bin/bash

# Cloudflare Configuration Script
# Automates Cloudflare settings via API

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo "================================================"
echo "   Cloudflare Automated Configuration"
echo "================================================"
echo ""

# Function to display usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Required:"
    echo "  -z, --zone ZONE_ID          Cloudflare Zone ID"
    echo "  -t, --token API_TOKEN       Cloudflare API Token"
    echo ""
    echo "Optional:"
    echo "  -d, --domain DOMAIN         Your domain name"
    echo "  -e, --email EMAIL           Admin email for alerts"
    echo "  --dry-run                   Show what would be configured"
    echo "  -h, --help                  Display this help message"
    echo ""
    echo "Example:"
    echo "  $0 -z abc123 -t your_api_token -d yourdomain.com"
    echo ""
    echo "To get your Zone ID and API Token:"
    echo "1. Log in to Cloudflare Dashboard"
    echo "2. Select your domain"
    echo "3. Zone ID is on the right sidebar"
    echo "4. Create API Token: My Profile → API Tokens → Create Token"
    exit 0
}

# Parse command line arguments
DRY_RUN=false
while [[ $# -gt 0 ]]; do
    case $1 in
        -z|--zone)
            ZONE_ID="$2"
            shift 2
            ;;
        -t|--token)
            API_TOKEN="$2"
            shift 2
            ;;
        -d|--domain)
            DOMAIN="$2"
            shift 2
            ;;
        -e|--email)
            ADMIN_EMAIL="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
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

# Check required parameters
if [ -z "$ZONE_ID" ] || [ -z "$API_TOKEN" ]; then
    # Try loading from .env.local
    if [ -f .env.local ]; then
        echo -e "${YELLOW}Loading from .env.local...${NC}"
        source .env.local
        ZONE_ID="${CLOUDFLARE_ZONE_ID:-$ZONE_ID}"
        API_TOKEN="${CLOUDFLARE_API_TOKEN:-$API_TOKEN}"
    fi
fi

if [ -z "$ZONE_ID" ] || [ -z "$API_TOKEN" ]; then
    echo -e "${RED}❌ Missing required parameters${NC}"
    echo "Required: --zone ZONE_ID --token API_TOKEN"
    echo ""
    usage
fi

# Cloudflare API endpoint
API_BASE="https://api.cloudflare.com/client/v4"

# Function to make API calls
cf_api() {
    local method="$1"
    local endpoint="$2"
    local data="$3"

    if [ "$DRY_RUN" = true ]; then
        echo -e "${CYAN}[DRY RUN] $method $endpoint${NC}"
        if [ -n "$data" ]; then
            echo "$data" | jq . 2>/dev/null || echo "$data"
        fi
        return 0
    fi

    local response
    if [ -n "$data" ]; then
        response=$(curl -s -X "$method" \
            "${API_BASE}${endpoint}" \
            -H "Authorization: Bearer ${API_TOKEN}" \
            -H "Content-Type: application/json" \
            --data "$data")
    else
        response=$(curl -s -X "$method" \
            "${API_BASE}${endpoint}" \
            -H "Authorization: Bearer ${API_TOKEN}")
    fi

    # Check for errors
    if echo "$response" | jq -e '.success == false' >/dev/null 2>&1; then
        echo -e "${RED}API Error:${NC}"
        echo "$response" | jq '.errors'
        return 1
    fi

    echo "$response"
}

echo -e "${BLUE}🔧 Configuring Cloudflare Settings...${NC}"
echo "Zone ID: $ZONE_ID"
echo "Domain: ${DOMAIN:-'(auto-detected)'}"
echo ""

# Configuration counter
TOTAL_CONFIGS=0
SUCCESSFUL_CONFIGS=0

# Function to apply a setting
apply_setting() {
    local name="$1"
    local endpoint="$2"
    local data="$3"

    TOTAL_CONFIGS=$((TOTAL_CONFIGS + 1))
    echo -n "Setting $name... "

    if cf_api "PATCH" "$endpoint" "$data" >/dev/null 2>&1; then
        echo -e "${GREEN}✅${NC}"
        SUCCESSFUL_CONFIGS=$((SUCCESSFUL_CONFIGS + 1))
    else
        echo -e "${RED}❌${NC}"
    fi
}

echo "1️⃣  SSL/TLS Configuration"
echo "----------------------------------------"

# Set SSL to Full (strict)
apply_setting "SSL Mode to Full (strict)" \
    "/zones/${ZONE_ID}/settings/ssl" \
    '{"value":"strict"}'

# Enable Always Use HTTPS
apply_setting "Always Use HTTPS" \
    "/zones/${ZONE_ID}/settings/always_use_https" \
    '{"value":"on"}'

# Set minimum TLS version
apply_setting "Minimum TLS Version to 1.2" \
    "/zones/${ZONE_ID}/settings/min_tls_version" \
    '{"value":"1.2"}'

# Enable HSTS
apply_setting "HTTP Strict Transport Security" \
    "/zones/${ZONE_ID}/settings/security_header" \
    '{"value":{"strict_transport_security":{"enabled":true,"max_age":31536000,"include_subdomains":true,"preload":true}}}'

echo ""
echo "2️⃣  Performance Optimization"
echo "----------------------------------------"

# Enable Auto Minify
apply_setting "Auto Minify (JS, CSS, HTML)" \
    "/zones/${ZONE_ID}/settings/minify" \
    '{"value":{"css":true,"html":true,"js":true}}'

# Enable Brotli compression
apply_setting "Brotli Compression" \
    "/zones/${ZONE_ID}/settings/brotli" \
    '{"value":"on"}'

# Set browser cache TTL
apply_setting "Browser Cache TTL (4 hours)" \
    "/zones/${ZONE_ID}/settings/browser_cache_ttl" \
    '{"value":14400}'

# Enable Early Hints
apply_setting "Early Hints" \
    "/zones/${ZONE_ID}/settings/early_hints" \
    '{"value":"on"}'

# Disable Rocket Loader (can break React)
apply_setting "Rocket Loader (OFF for React)" \
    "/zones/${ZONE_ID}/settings/rocket_loader" \
    '{"value":"off"}'

echo ""
echo "3️⃣  Security Settings"
echo "----------------------------------------"

# Set Security Level
apply_setting "Security Level to Medium" \
    "/zones/${ZONE_ID}/settings/security_level" \
    '{"value":"medium"}'

# Enable Email Obfuscation
apply_setting "Email Address Obfuscation" \
    "/zones/${ZONE_ID}/settings/email_obfuscation" \
    '{"value":"on"}'

# Enable Hotlink Protection
apply_setting "Hotlink Protection" \
    "/zones/${ZONE_ID}/settings/hotlink_protection" \
    '{"value":"on"}'

# Set Challenge TTL
apply_setting "Challenge Passage (30 minutes)" \
    "/zones/${ZONE_ID}/settings/challenge_ttl" \
    '{"value":1800}'

echo ""
echo "4️⃣  Caching Configuration"
echo "----------------------------------------"

# Set caching level
apply_setting "Caching Level to Standard" \
    "/zones/${ZONE_ID}/settings/cache_level" \
    '{"value":"standard"}'

# Enable Always Online
apply_setting "Always Online" \
    "/zones/${ZONE_ID}/settings/always_online" \
    '{"value":"on"}'

# Development Mode OFF
apply_setting "Development Mode OFF" \
    "/zones/${ZONE_ID}/settings/development_mode" \
    '{"value":"off"}'

echo ""
echo "5️⃣  Page Rules Configuration"
echo "----------------------------------------"

# Function to create page rule
create_page_rule() {
    local pattern="$1"
    local actions="$2"
    local priority="$3"

    echo -n "Creating rule for $pattern... "

    local data=$(jq -n \
        --arg pattern "$pattern" \
        --arg priority "$priority" \
        --argjson actions "$actions" \
        '{
            targets: [{
                target: "url",
                constraint: {
                    operator: "matches",
                    value: $pattern
                }
            }],
            actions: $actions,
            priority: $priority | tonumber,
            status: "active"
        }')

    if [ "$DRY_RUN" = true ]; then
        echo -e "${CYAN}[DRY RUN]${NC}"
        return 0
    fi

    if cf_api "POST" "/zones/${ZONE_ID}/pagerules" "$data" >/dev/null 2>&1; then
        echo -e "${GREEN}✅${NC}"
        SUCCESSFUL_CONFIGS=$((SUCCESSFUL_CONFIGS + 1))
    else
        echo -e "${YELLOW}⚠️  May already exist${NC}"
    fi
    TOTAL_CONFIGS=$((TOTAL_CONFIGS + 1))
}

# Create page rules (3 free rules available)
DOMAIN_PATTERN="${DOMAIN:-*}"

# Rule 1: API endpoints - bypass cache
create_page_rule \
    "${DOMAIN_PATTERN}/api/*" \
    '[
        {"id": "cache_level", "value": "bypass"},
        {"id": "security_level", "value": "high"},
        {"id": "disable_performance", "value": false}
    ]' \
    1

# Rule 2: Static assets - cache everything
create_page_rule \
    "${DOMAIN_PATTERN}/assets/*" \
    '[
        {"id": "cache_level", "value": "cache_everything"},
        {"id": "edge_cache_ttl", "value": 2678400},
        {"id": "browser_cache_ttl", "value": 2678400}
    ]' \
    2

# Rule 3: Root domain - standard caching
create_page_rule \
    "${DOMAIN_PATTERN}/*" \
    '[
        {"id": "cache_level", "value": "standard"},
        {"id": "automatic_https_rewrites", "value": "on"},
        {"id": "always_online", "value": "on"}
    ]' \
    3

echo ""
echo "6️⃣  Additional Configurations"
echo "----------------------------------------"

# Enable Web Analytics (if available)
echo -n "Enabling Web Analytics... "
if [ "$DRY_RUN" = true ]; then
    echo -e "${CYAN}[DRY RUN]${NC}"
else
    # Note: Web Analytics API might require different permissions
    echo -e "${YELLOW}⚠️  Manual setup required${NC}"
fi

# Set up Health Checks
echo -n "Setting up Health Check... "
if [ "$DRY_RUN" = true ]; then
    echo -e "${CYAN}[DRY RUN]${NC}"
else
    HEALTH_CHECK_DATA=$(jq -n \
        --arg name "API Health" \
        --arg address "${DOMAIN}/api/health" \
        '{
            name: $name,
            description: "Guest Booking API Health Check",
            type: "HTTPS",
            address: $address,
            check_regions: ["WNAM", "ENAM"],
            interval: 60,
            timeout: 10,
            retries: 2,
            expected_codes: "200"
        }')

    if cf_api "POST" "/zones/${ZONE_ID}/healthchecks" "$HEALTH_CHECK_DATA" >/dev/null 2>&1; then
        echo -e "${GREEN}✅${NC}"
        SUCCESSFUL_CONFIGS=$((SUCCESSFUL_CONFIGS + 1))
    else
        echo -e "${YELLOW}⚠️  May require paid plan${NC}"
    fi
    TOTAL_CONFIGS=$((TOTAL_CONFIGS + 1))
fi

echo ""
echo "========================================="
echo "📊 Configuration Results"
echo "========================================="

# Calculate percentage
if [ $TOTAL_CONFIGS -gt 0 ]; then
    PERCENTAGE=$((SUCCESSFUL_CONFIGS * 100 / TOTAL_CONFIGS))
else
    PERCENTAGE=0
fi

# Output summary with color coding
if [ $PERCENTAGE -ge 90 ]; then
    COLOR=$GREEN
    STATUS="EXCELLENT"
elif [ $PERCENTAGE -ge 70 ]; then
    COLOR=$YELLOW
    STATUS="GOOD"
else
    COLOR=$RED
    STATUS="NEEDS ATTENTION"
fi

echo -e "Settings Applied: ${COLOR}${SUCCESSFUL_CONFIGS}/${TOTAL_CONFIGS} (${PERCENTAGE}%)${NC}"
echo -e "Status: ${COLOR}${STATUS}${NC}"

if [ "$DRY_RUN" = true ]; then
    echo ""
    echo -e "${CYAN}This was a DRY RUN - no changes were made${NC}"
    echo "Run without --dry-run to apply changes"
fi

echo ""
echo "📝 Manual Configuration Required:"
echo "1. Turnstile CAPTCHA:"
echo "   - Go to: Cloudflare Dashboard → Turnstile"
echo "   - Create new site"
echo "   - Add site key to .env.local"
echo ""
echo "2. Email Routing (for alerts):"
echo "   - Go to: Cloudflare Dashboard → Email → Email Routing"
echo "   - Add your domain"
echo "   - Create routing rules"
echo ""
echo "3. Workers KV:"
echo "   - Already configured in wrangler.toml"
echo "   - Run: wrangler kv:namespace create RATE_LIMIT_KV"
echo ""

if [ -n "$DOMAIN" ]; then
    echo "🔗 Quick Links:"
    echo "• Cloudflare Dashboard: https://dash.cloudflare.com/${ZONE_ID}"
    echo "• SSL/TLS Settings: https://dash.cloudflare.com/${ZONE_ID}/ssl-tls"
    echo "• Page Rules: https://dash.cloudflare.com/${ZONE_ID}/page-rules"
    echo "• Analytics: https://dash.cloudflare.com/${ZONE_ID}/analytics"
fi

echo ""
echo -e "${GREEN}✅ Configuration script completed!${NC}"

exit 0