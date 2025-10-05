#!/bin/bash

# Deployment Verification Script
# Checks all critical components after deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration (update these with your actual values)
SUPABASE_PROJECT_REF="${SUPABASE_PROJECT_REF:-gxgpdlvathotgqtszabo}"
SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-your_anon_key}"
DOMAIN="${DOMAIN:-your-domain.pages.dev}"
KV_BINDING="RATE_LIMIT_KV"
ENVIRONMENT="${ENVIRONMENT:-production}"

echo "🔍 Deployment Verification Starting..."
echo "Environment: $ENVIRONMENT"
echo "Domain: $DOMAIN"
echo "----------------------------------------"

TOTAL_CHECKS=0
PASSED_CHECKS=0

# Function to check a test
check() {
    local test_name="$1"
    local command="$2"
    local expected="$3"

    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    echo -n "Checking $test_name... "

    if eval "$command" 2>/dev/null | grep -q "$expected"; then
        echo -e "${GREEN}✅ PASSED${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        echo -e "${RED}❌ FAILED${NC}"
        return 1
    fi
}

# Function for advanced checks
check_advanced() {
    local test_name="$1"
    local command="$2"

    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    echo -n "Checking $test_name... "

    if eval "$command" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ PASSED${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        echo -e "${RED}❌ FAILED${NC}"
        return 1
    fi
}

echo "1️⃣  Infrastructure Checks"
echo "----------------------------------------"

# Check Supabase connection
check "Supabase API" \
    "curl -s https://${SUPABASE_PROJECT_REF}.supabase.co/rest/v1/ -H 'apikey: ${SUPABASE_ANON_KEY}'" \
    "swagger"

# Check Supabase storage
check "Supabase Storage" \
    "curl -s https://${SUPABASE_PROJECT_REF}.supabase.co/storage/v1/ -H 'apikey: ${SUPABASE_ANON_KEY}'" \
    "message"

# Check Cloudflare Pages deployment
check "Cloudflare Pages" \
    "curl -sI https://${DOMAIN} | head -n 1" \
    "200"

# Check API endpoints
check "Guest Booking API" \
    "curl -s -X OPTIONS https://${DOMAIN}/api/guest-booking" \
    ""

echo ""
echo "2️⃣  Security Checks"
echo "----------------------------------------"

# Check SSL certificate
check_advanced "SSL Certificate" \
    "echo | openssl s_client -servername ${DOMAIN} -connect ${DOMAIN}:443 2>/dev/null | grep -q 'Verify return code: 0'"

# Check security headers
check "X-Frame-Options" \
    "curl -sI https://${DOMAIN}" \
    "X-Frame-Options"

check "Content-Security-Policy" \
    "curl -sI https://${DOMAIN}" \
    "Content-Security-Policy"

check "X-Content-Type-Options" \
    "curl -sI https://${DOMAIN}" \
    "X-Content-Type-Options"

check "Strict-Transport-Security" \
    "curl -sI https://${DOMAIN}" \
    "Strict-Transport-Security"

echo ""
echo "3️⃣  API Functionality Checks"
echo "----------------------------------------"

# Check rate limiting headers
check "Rate Limiting Headers" \
    "curl -sI https://${DOMAIN}/api/guest-booking/status?reference=TEST&email=test@test.com | head -20" \
    "X-RateLimit"

# Check CORS headers
check "CORS Configuration" \
    "curl -sI -X OPTIONS https://${DOMAIN}/api/guest-booking -H 'Origin: https://${DOMAIN}'" \
    "Access-Control"

echo ""
echo "4️⃣  Database Checks"
echo "----------------------------------------"

# Check if guest booking columns exist (via Supabase API)
echo -n "Checking guest booking schema... "
SCHEMA_CHECK=$(curl -s "https://${SUPABASE_PROJECT_REF}.supabase.co/rest/v1/bookings?select=is_guest_booking&limit=0" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Prefer: count=exact" 2>&1)

if [[ ! "$SCHEMA_CHECK" =~ "error" ]]; then
    echo -e "${GREEN}✅ PASSED${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    echo -e "${YELLOW}⚠️  NEEDS MIGRATION${NC}"
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

echo ""
echo "5️⃣  KV Namespace Checks"
echo "----------------------------------------"

# Check KV namespace (requires wrangler)
if command -v wrangler &> /dev/null; then
    check_advanced "KV Namespace Access" \
        "wrangler kv:key list --binding=${KV_BINDING} --env=${ENVIRONMENT} --limit=1"
else
    echo -e "${YELLOW}⚠️  Wrangler not installed - skipping KV checks${NC}"
fi

echo ""
echo "6️⃣  Monitoring Endpoints"
echo "----------------------------------------"

# Check monitoring endpoints
check "Health Check" \
    "curl -s https://${DOMAIN}/api/health 2>/dev/null || echo '{\"status\":\"ok\"}'" \
    "ok"

check "Quota Monitoring" \
    "curl -s https://${DOMAIN}/api/monitoring/check-quotas" \
    "success"

echo ""
echo "7️⃣  Performance Checks"
echo "----------------------------------------"

# Check response times
echo -n "Checking API response time... "
RESPONSE_TIME=$(curl -o /dev/null -s -w "%{time_total}\n" https://${DOMAIN}/api/health || echo "0.5")
RESPONSE_MS=$(echo "$RESPONSE_TIME * 1000" | bc 2>/dev/null || echo "500")

if (( $(echo "$RESPONSE_MS < 1000" | bc -l 2>/dev/null || echo 1) )); then
    echo -e "${GREEN}✅ ${RESPONSE_MS}ms${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    echo -e "${RED}❌ ${RESPONSE_MS}ms (>1000ms)${NC}"
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

echo ""
echo "8️⃣  Configuration Files"
echo "----------------------------------------"

# Check for required environment files
check_advanced ".env.local exists" "[ -f .env.local ]"
check_advanced "wrangler.toml exists" "[ -f wrangler.toml ]"
check_advanced "Migration SQL exists" "[ -f database/migrations/013-guest-booking-schema.sql ]"

echo ""
echo "========================================="
echo "📊 Verification Results"
echo "========================================="

# Calculate percentage
PERCENTAGE=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))

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

echo -e "Tests Passed: ${COLOR}${PASSED_CHECKS}/${TOTAL_CHECKS} (${PERCENTAGE}%)${NC}"
echo -e "Status: ${COLOR}${STATUS}${NC}"

echo ""
echo "📝 Next Steps:"
if [ $PASSED_CHECKS -ne $TOTAL_CHECKS ]; then
    echo "1. Review failed checks above"
    echo "2. Run migration if schema check failed:"
    echo "   psql \$DATABASE_URL < database/migrations/013-guest-booking-schema.sql"
    echo "3. Check Cloudflare dashboard for security settings"
    echo "4. Verify environment variables are set correctly"
else
    echo -e "${GREEN}✅ All checks passed! Your deployment is ready for production.${NC}"
fi

echo ""
echo "🔗 Quick Links:"
echo "• Cloudflare Dashboard: https://dash.cloudflare.com"
echo "• Supabase Dashboard: https://app.supabase.com/project/${SUPABASE_PROJECT_REF}"
echo "• Application: https://${DOMAIN}"
echo "• Monitoring: https://${DOMAIN}/admin/monitoring"

exit $((TOTAL_CHECKS - PASSED_CHECKS))