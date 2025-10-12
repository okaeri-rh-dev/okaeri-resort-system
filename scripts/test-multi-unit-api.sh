#!/bin/bash

# Test script for multi-unit availability API endpoint
# Tests the corrected parameter format

echo "🧪 Testing Multi-Unit Availability API"
echo "========================================"
echo ""

# Test data
UNIT_ID_1="b88857ce-bbc1-474b-ac02-86e8a416c22e"
UNIT_ID_2="4ca070ec-f5b8-4ce9-8901-ffafdad7a76f"
UNIT_ID_3="60ca3cec-b690-4673-8dc5-897f7b7c18e8"
CHECK_IN="2025-10-11T01:53:03.512Z"
CHECK_OUT="2025-10-12T01:53:03.512Z"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "Test Configuration:"
echo "  - Unit IDs: 3 test units"
echo "  - Check-in: $CHECK_IN"
echo "  - Check-out: $CHECK_OUT"
echo ""

# Function to test API endpoint
test_api() {
    local PORT=$1
    local DESC=$2

    echo -e "${YELLOW}Testing on port $PORT ($DESC)...${NC}"

    # Build the correct URL with multiple units[] parameters
    URL="http://localhost:$PORT/api/availability/multi-unit"
    URL="${URL}?units[]=${UNIT_ID_1}"
    URL="${URL}&units[]=${UNIT_ID_2}"
    URL="${URL}&units[]=${UNIT_ID_3}"
    URL="${URL}&check_in=${CHECK_IN}"
    URL="${URL}&check_out=${CHECK_OUT}"

    # Make the request
    RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$URL" 2>/dev/null)
    HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
    BODY=$(echo "$RESPONSE" | grep -v "HTTP_STATUS:")

    if [ "$HTTP_STATUS" = "200" ]; then
        echo -e "${GREEN}✅ Success (HTTP $HTTP_STATUS)${NC}"
        echo "Response preview:"
        echo "$BODY" | python3 -m json.tool 2>/dev/null | head -15 || echo "$BODY" | head -100
    else
        echo -e "${RED}❌ Failed (HTTP $HTTP_STATUS)${NC}"
        echo "Error response:"
        echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
    fi
    echo ""
}

# Check if servers are running
echo "Checking server status..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 | grep -q "200\|404"; then
    echo -e "${GREEN}✅ Vite server is running${NC}"
    VITE_RUNNING=1
else
    echo -e "${RED}⚠️  Vite server is not running${NC}"
    VITE_RUNNING=0
fi

if curl -s -o /dev/null -w "%{http_code}" http://localhost:8788 | grep -q "200\|404"; then
    echo -e "${GREEN}✅ Wrangler server is running${NC}"
    WRANGLER_RUNNING=1
else
    echo -e "${RED}⚠️  Wrangler server is not running${NC}"
    WRANGLER_RUNNING=0
fi
echo ""

# Run tests based on what's running
if [ "$VITE_RUNNING" = "1" ]; then
    test_api 5173 "Vite proxy to Wrangler"
fi

if [ "$WRANGLER_RUNNING" = "1" ]; then
    test_api 8788 "Wrangler directly"
fi

if [ "$VITE_RUNNING" = "0" ] && [ "$WRANGLER_RUNNING" = "0" ]; then
    echo -e "${RED}❌ No servers are running!${NC}"
    echo ""
    echo "To start the servers, run:"
    echo "  npm run dev:cf"
    echo ""
    echo "Or start them individually:"
    echo "  npm run dev:vite    # Frontend on port 5173"
    echo "  npm run dev:wrangler # Functions on port 8788"
fi

echo ""
echo "========================================"
echo "Test complete!"
echo ""
echo "Note: The API now expects multiple 'units[]' parameters, not 'unit_ids'."
echo "Example: units[]=id1&units[]=id2&units[]=id3"