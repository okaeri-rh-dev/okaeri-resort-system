#!/bin/bash

# Security Headers Validation Script
# Validates CSP and other security headers in vercel.json
# Usage: ./scripts/validate-security-headers.sh

set -e

echo "🔒 Security Headers Validation"
echo "=============================="
echo ""

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Exit code
EXIT_CODE=0

# Check if vercel.json exists
if [ ! -f "vercel.json" ]; then
    echo -e "${RED}❌ Error: vercel.json not found!${NC}"
    exit 1
fi

echo "🔍 Checking Content Security Policy..."
echo "--------------------------------------"

# Check for unsafe-eval (CRITICAL)
if grep -q "'unsafe-eval'" vercel.json; then
    echo -e "${RED}❌ CRITICAL: 'unsafe-eval' found in CSP!${NC}"
    echo "   This allows arbitrary code execution and MUST be removed from production."
    echo "   Location: vercel.json"
    EXIT_CODE=1
else
    echo -e "${GREEN}✅ No 'unsafe-eval' directive found${NC}"
fi

# Check for unsafe-inline in script-src (HIGH)
if grep -q "script-src[^;]*'unsafe-inline'" vercel.json; then
    echo -e "${YELLOW}⚠️  WARNING: 'unsafe-inline' found in script-src${NC}"
    echo "   Consider using nonces or hashes instead for better XSS protection."
    echo "   See: docs/implementation/CI_CD_PIPELINE_GUIDE.md"
else
    echo -e "${GREEN}✅ No 'unsafe-inline' in script-src${NC}"
fi

# Check for unsafe-inline in style-src (MEDIUM)
if grep -q "style-src[^;]*'unsafe-inline'" vercel.json; then
    echo -e "${YELLOW}⚠️  NOTICE: 'unsafe-inline' found in style-src${NC}"
    echo "   While less critical than scripts, consider using nonces for styles."
else
    echo -e "${GREEN}✅ No 'unsafe-inline' in style-src${NC}"
fi

echo ""
echo "🔍 Checking Required CSP Directives..."
echo "--------------------------------------"

# Required CSP directives
REQUIRED_DIRECTIVES=(
    "frame-ancestors"
    "object-src"
    "base-uri"
    "form-action"
    "upgrade-insecure-requests"
)

MISSING_DIRECTIVES=()

for directive in "${REQUIRED_DIRECTIVES[@]}"; do
    if ! grep -q "$directive" vercel.json; then
        MISSING_DIRECTIVES+=("$directive")
        echo -e "${RED}❌ Missing: $directive${NC}"
    else
        echo -e "${GREEN}✅ Found: $directive${NC}"
    fi
done

if [ ${#MISSING_DIRECTIVES[@]} -gt 0 ]; then
    echo -e "${RED}Missing ${#MISSING_DIRECTIVES[@]} required CSP directives${NC}"
    EXIT_CODE=1
fi

echo ""
echo "🔍 Checking Security Headers..."
echo "-------------------------------"

# Required security headers
REQUIRED_HEADERS=(
    "X-Content-Type-Options"
    "X-Frame-Options"
    "Strict-Transport-Security"
    "Permissions-Policy"
    "Referrer-Policy"
)

MISSING_HEADERS=()

for header in "${REQUIRED_HEADERS[@]}"; do
    if ! grep -q "\"key\": \"$header\"" vercel.json; then
        MISSING_HEADERS+=("$header")
        echo -e "${YELLOW}⚠️  Missing: $header${NC}"
    else
        echo -e "${GREEN}✅ Found: $header${NC}"
    fi
done

if [ ${#MISSING_HEADERS[@]} -gt 0 ]; then
    echo -e "${YELLOW}Missing ${#MISSING_HEADERS[@]} recommended security headers${NC}"
fi

echo ""
echo "📊 Security Score Calculation"
echo "----------------------------"

SCORE=100
GRADE=""

# Deduct points for security issues
if grep -q "'unsafe-eval'" vercel.json; then
    SCORE=$((SCORE - 30))
    echo "  -30 points: Uses 'unsafe-eval' (CRITICAL)"
fi

if grep -q "script-src[^;]*'unsafe-inline'" vercel.json; then
    SCORE=$((SCORE - 15))
    echo "  -15 points: Uses 'unsafe-inline' in script-src"
fi

if grep -q "style-src[^;]*'unsafe-inline'" vercel.json; then
    SCORE=$((SCORE - 5))
    echo "  -5 points: Uses 'unsafe-inline' in style-src"
fi

# Deduct for missing directives
MISSING_COUNT=${#MISSING_DIRECTIVES[@]}
if [ $MISSING_COUNT -gt 0 ]; then
    DEDUCTION=$((MISSING_COUNT * 5))
    SCORE=$((SCORE - DEDUCTION))
    echo "  -$DEDUCTION points: Missing $MISSING_COUNT required CSP directives"
fi

# Deduct for missing headers
MISSING_HEADER_COUNT=${#MISSING_HEADERS[@]}
if [ $MISSING_HEADER_COUNT -gt 0 ]; then
    DEDUCTION=$((MISSING_HEADER_COUNT * 3))
    SCORE=$((SCORE - DEDUCTION))
    echo "  -$DEDUCTION points: Missing $MISSING_HEADER_COUNT security headers"
fi

# Ensure score doesn't go below 0
if [ $SCORE -lt 0 ]; then
    SCORE=0
fi

echo ""
echo "Final Score: $SCORE/100"

# Calculate grade
if [ $SCORE -ge 95 ]; then
    GRADE="A+"
    COLOR=$GREEN
elif [ $SCORE -ge 90 ]; then
    GRADE="A"
    COLOR=$GREEN
elif [ $SCORE -ge 85 ]; then
    GRADE="B+"
    COLOR=$YELLOW
elif [ $SCORE -ge 80 ]; then
    GRADE="B"
    COLOR=$YELLOW
elif [ $SCORE -ge 75 ]; then
    GRADE="C"
    COLOR=$YELLOW
else
    GRADE="F"
    COLOR=$RED
    EXIT_CODE=1
fi

echo -e "Security Grade: ${COLOR}${GRADE}${NC}"

echo ""
echo "=============================="

if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Security validation PASSED!${NC}"
    echo ""
    echo "Your security configuration meets production standards."
else
    echo -e "${RED}❌ Security validation FAILED!${NC}"
    echo ""
    echo "Please fix the issues above before deploying to production."
    echo "Refer to the following documentation:"
    echo "  - docs/security/SECURITY_CHECKLIST.md"
    echo "  - docs/security/SECURITY_AUDIT_2025_08.md"
    echo "  - docs/implementation/CI_CD_PIPELINE_GUIDE.md"
fi

echo ""
echo "💡 Tips for improving security:"
echo "  1. Remove all 'unsafe-*' directives from CSP"
echo "  2. Use nonces or hashes for inline scripts/styles"
echo "  3. Add all recommended security headers"
echo "  4. Test changes in staging before production"
echo "  5. Use CSP reporting to monitor violations"

exit $EXIT_CODE