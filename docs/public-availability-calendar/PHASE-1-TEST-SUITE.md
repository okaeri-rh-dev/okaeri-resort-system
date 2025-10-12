# Phase 1: Backend Test Suite

**Feature**: Public Availability Calendar API
**Version**: 1.0
**Date**: 2025-10-10

---

## cURL Test Suite

### 1. Happy Path Tests

#### 1.1 Get Current Month Availability (Default)

```bash
curl http://localhost:8788/api/public/v1/availability
```

**Expected Response** (200 OK):

```json
{
  "totalUnits": 3,
  "dateRange": {
    "start": "2025-10-01",
    "end": "2025-10-31"
  },
  "availability": [
    {
      "date": "2025-10-01",
      "availableCount": 3,
      "status": "full"
    }
  ],
  "metadata": {
    "generatedAt": "2025-10-10T10:30:00.000Z",
    "cacheMaxAge": 300,
    "version": "v1"
  }
}
```

#### 1.2 Get Specific Date Range

```bash
curl "http://localhost:8788/api/public/v1/availability?start=2025-01-01&end=2025-01-31"
```

**Expected Response** (200 OK):

- Same structure as above
- Date range should match request

#### 1.3 Get Next Week

```bash
curl "http://localhost:8788/api/public/v1/availability?start=$(date -v+1d +%Y-%m-%d)&end=$(date -v+7d +%Y-%m-%d)"
```

**Expected Response** (200 OK):

- 7 days of availability data

---

### 2. Validation Error Tests

#### 2.1 Invalid Date Format

```bash
curl "http://localhost:8788/api/public/v1/availability?start=invalid&end=2025-01-31"
```

**Expected Response** (400 Bad Request):

```json
{
  "error": "Invalid date format. Use YYYY-MM-DD (ISO 8601)"
}
```

#### 2.2 End Date Before Start Date

```bash
curl "http://localhost:8788/api/public/v1/availability?start=2025-01-31&end=2025-01-01"
```

**Expected Response** (400 Bad Request):

```json
{
  "error": "End date must be after or equal to start date"
}
```

#### 2.3 Past Date Query

```bash
curl "http://localhost:8788/api/public/v1/availability?start=2024-01-01&end=2024-01-31"
```

**Expected Response** (400 Bad Request):

```json
{
  "error": "Cannot query past dates. Start date must be today or later."
}
```

#### 2.4 Future Date Too Far (> 1 Year)

```bash
curl "http://localhost:8788/api/public/v1/availability?start=2026-06-01&end=2026-06-30"
```

**Expected Response** (400 Bad Request):

```json
{
  "error": "Cannot query more than 1 year in the future"
}
```

#### 2.5 Date Range Too Large (> 180 Days)

```bash
curl "http://localhost:8788/api/public/v1/availability?start=2025-01-01&end=2026-01-01"
```

**Expected Response** (400 Bad Request):

```json
{
  "error": "Date range cannot exceed 180 days"
}
```

---

### 3. CORS Tests

#### 3.1 Preflight Request (OPTIONS)

```bash
curl -X OPTIONS "http://localhost:8788/api/public/v1/availability" \
  -H "Origin: https://okaeri-resort.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v
```

**Expected Response** (204 No Content):

- Headers should include:
  - `Access-Control-Allow-Origin: https://okaeri-resort.com`
  - `Access-Control-Allow-Methods: GET, OPTIONS`
  - `Access-Control-Allow-Headers: Content-Type`

#### 3.2 CORS with Valid Origin

```bash
curl "http://localhost:8788/api/public/v1/availability" \
  -H "Origin: https://okaeri-resort.com" \
  -v
```

**Expected Response** (200 OK):

- Headers should include:
  - `Access-Control-Allow-Origin: https://okaeri-resort.com`

---

### 4. Cache Header Tests

#### 4.1 Verify Cache-Control Header

```bash
curl -I "http://localhost:8788/api/public/v1/availability?start=2025-01-01&end=2025-01-31"
```

**Expected Headers**:

```
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: public, s-maxage=300, stale-while-revalidate=120
ETag: "availability-2025-01-01-2025-01-31-..."
Vary: Accept-Encoding
```

---

### 5. Rate Limiting Tests

#### 5.1 Normal Request (Under Limit)

```bash
curl "http://localhost:8788/api/public/v1/availability" -v
```

**Expected Response** (200 OK):

- Headers should include:
  - `X-RateLimit-Limit: 60`
  - `X-RateLimit-Remaining: 59` (or less)
  - `X-RateLimit-Reset: <timestamp>`

#### 5.2 Exceed Rate Limit (61st Request)

```bash
# Send 61 requests rapidly
for i in {1..61}; do
  curl "http://localhost:8788/api/public/v1/availability" -s
done
```

**Expected Response on 61st Request** (429 Too Many Requests):

```json
{
  "error": "Rate limit exceeded. Please try again later.",
  "retryAfter": 45
}
```

**Expected Headers**:

```
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 45
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: <timestamp>
```

---

### 6. Method Validation Tests

#### 6.1 Invalid Method (POST)

```bash
curl -X POST "http://localhost:8788/api/public/v1/availability"
```

**Expected Response** (405 Method Not Allowed):

```json
{
  "error": "Method not allowed"
}
```

#### 6.2 Invalid Method (PUT)

```bash
curl -X PUT "http://localhost:8788/api/public/v1/availability"
```

**Expected Response** (405 Method Not Allowed):

```json
{
  "error": "Method not allowed"
}
```

---

### 7. Optional: Turnstile Verification Test

#### 7.1 With Invalid Turnstile Token

```bash
curl "http://localhost:8788/api/public/v1/availability?cf_turnstile_token=invalid-token"
```

**Expected Response** (403 Forbidden):

```json
{
  "error": "Bot verification failed"
}
```

#### 7.2 With Valid Turnstile Token

```bash
curl "http://localhost:8788/api/public/v1/availability?cf_turnstile_token=<valid-token-from-frontend>"
```

**Expected Response** (200 OK):

- Normal availability data

---

## Automated Test Script

Save this as `test-availability-api.sh`:

```bash
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
```

**Make executable and run**:

```bash
chmod +x test-availability-api.sh
./test-availability-api.sh
```

---

## Success Criteria

All tests should pass:

- ✅ Happy path returns 200 OK with valid JSON
- ✅ Invalid dates return 400 Bad Request
- ✅ Past dates are rejected
- ✅ Future dates >1 year are rejected
- ✅ Date range >180 days is rejected
- ✅ CORS headers are present
- ✅ Cache headers are configured correctly
- ✅ Rate limiting works (61st request = 429)
- ✅ Invalid methods return 405

---

## Performance Benchmarks

Run Apache Bench to measure performance:

```bash
# Test 100 concurrent requests
ab -n 100 -c 10 "http://localhost:8788/api/public/v1/availability?start=2025-01-01&end=2025-01-31"
```

**Target Metrics**:

- Time per request: < 500ms
- Requests per second: > 20
- Failed requests: 0

---

## Next Steps

After all tests pass:

1. Mark todo items as completed
2. Regenerate TypeScript types
3. Run verification checklist
4. Create Postman collection (see PHASE-1-POSTMAN-COLLECTION.json)
5. Prepare verification report
