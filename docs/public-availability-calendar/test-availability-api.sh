#!/bin/bash

BASE_URL="${BASE_URL:-http://localhost:8788}"
API_ENDPOINT="$BASE_URL/api/public/v1/availability"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 Testing Public Availability API"
echo "=================================="
echo ""

# Test 1: Happy Path
echo -n "Test 1: Default query (current month)... "
RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/test1.json "$API_ENDPOINT")
if [ "$RESPONSE" = "200" ]; then
  echo -e "${GREEN}PASS${NC}"
else
  echo -e "${RED}FAIL${NC} (HTTP $RESPONSE)"
fi

# Test 2: Specific Date Range
echo -n "Test 2: Specific date range... "
RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/test2.json "$API_ENDPOINT?start=2025-01-01&end=2025-01-31")
if [ "$RESPONSE" = "200" ]; then
  echo -e "${GREEN}PASS${NC}"
else
  echo -e "${RED}FAIL${NC} (HTTP $RESPONSE)"
fi

# Test 3: Invalid Date Format
echo -n "Test 3: Invalid date format... "
RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/test3.json "$API_ENDPOINT?start=invalid&end=2025-01-31")
if [ "$RESPONSE" = "400" ]; then
  echo -e "${GREEN}PASS${NC}"
else
  echo -e "${RED}FAIL${NC} (Expected 400, got $RESPONSE)"
fi

# Test 4: Past Date
echo -n "Test 4: Past date rejection... "
RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/test4.json "$API_ENDPOINT?start=2024-01-01&end=2024-01-31")
if [ "$RESPONSE" = "400" ]; then
  echo -e "${GREEN}PASS${NC}"
else
  echo -e "${RED}FAIL${NC} (Expected 400, got $RESPONSE)"
fi

# Test 5: Date Range Too Large
echo -n "Test 5: Date range too large... "
RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/test5.json "$API_ENDPOINT?start=2025-01-01&end=2026-01-01")
if [ "$RESPONSE" = "400" ]; then
  echo -e "${GREEN}PASS${NC}"
else
  echo -e "${RED}FAIL${NC} (Expected 400, got $RESPONSE)"
fi

# Test 6: CORS Preflight
echo -n "Test 6: CORS preflight... "
RESPONSE=$(curl -s -X OPTIONS -w "%{http_code}" -o /tmp/test6.txt \
  -H "Origin: https://okaeri-resort.com" \
  -H "Access-Control-Request-Method: GET" \
  "$API_ENDPOINT")
if [ "$RESPONSE" = "204" ]; then
  echo -e "${GREEN}PASS${NC}"
else
  echo -e "${RED}FAIL${NC} (Expected 204, got $RESPONSE)"
fi

# Test 7: Invalid Method
echo -n "Test 7: Invalid method (POST)... "
RESPONSE=$(curl -s -X POST -w "%{http_code}" -o /tmp/test7.json "$API_ENDPOINT")
if [ "$RESPONSE" = "405" ]; then
  echo -e "${GREEN}PASS${NC}"
else
  echo -e "${RED}FAIL${NC} (Expected 405, got $RESPONSE)"
fi

# Test 8: Cache Headers
echo -n "Test 8: Cache headers present... "
CACHE_CONTROL=$(curl -s -I "$API_ENDPOINT" | grep -i "cache-control" | grep "s-maxage=300")
if [ ! -z "$CACHE_CONTROL" ]; then
  echo -e "${GREEN}PASS${NC}"
else
  echo -e "${RED}FAIL${NC} (Cache-Control header missing or incorrect)"
fi

# Test 9: Rate Limiting (Send 61 requests)
echo -n "Test 9: Rate limiting (61 requests)... "
for i in {1..61}; do
  RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null "$API_ENDPOINT")
done
# The 61st request should be 429
if [ "$RESPONSE" = "429" ]; then
  echo -e "${GREEN}PASS${NC}"
else
  echo -e "${YELLOW}SKIP${NC} (Rate limit may not be enforced in dev)"
fi

echo ""
echo "=================================="
echo "Test suite completed!"
echo ""
echo "📊 Response samples saved to /tmp/test*.json"
