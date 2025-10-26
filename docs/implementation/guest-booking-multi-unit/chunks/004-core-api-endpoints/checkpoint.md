# Checkpoint: Chunk 004 Verification

## Overview

This document provides comprehensive verification procedures for the Core API Endpoints implementation. Complete all checks before marking this chunk as done.

**Estimated Time**: 25 minutes

- Automated checks: 10 minutes
- Manual checks: 10 minutes
- Status tracking: 5 minutes

---

## Automated Checks

Run these commands to verify endpoints are functional.

### 1. File Structure Check (2 minutes)

Verify all required files exist.

```bash
# Navigate to project root
cd /Users/jasonacido/repos/okaeri-dev/okaeri-resort-system

# Check API endpoint files
ls -1 functions/api/guest-booking.ts
ls -1 functions/api/guest-booking/rates.ts
ls -1 functions/api/guest-booking/discount-rules.ts
ls -1 functions/api/guest-booking/preview-pricing.ts

# Check helper utilities
ls -1 src/lib/turnstile.ts
ls -1 src/lib/rate-limit.ts

# Check type definitions
ls -1 src/types/guest-booking-multi-unit.ts

# Expected: All files exist (no "No such file" errors)
```

**✅ Pass Criteria**: All 7 files exist

---

### 2. TypeScript Compilation Check (2 minutes)

Ensure no type errors in API code.

```bash
# Run TypeScript type checker
npm run type-check

# Expected output: No errors in guest-booking API files
# Warnings are acceptable, errors are not
```

**✅ Pass Criteria**: `npm run type-check` exits with code 0 (no errors)

---

### 3. Environment Variables Check (1 minute)

Verify required environment variables are set.

```bash
# Check .env.local exists and has required keys
grep -E "VITE_SUPABASE_URL|VITE_SUPABASE_ANON_KEY|VITE_TURNSTILE_SITE_KEY|TURNSTILE_SECRET_KEY|ALLOWED_ORIGINS" .env.local

# Expected output:
# VITE_SUPABASE_URL=https://...
# VITE_SUPABASE_ANON_KEY=eyJhbGci...
# VITE_TURNSTILE_SITE_KEY=0x4AAAAAAA...
# TURNSTILE_SECRET_KEY=0x4AAAAAAA...
# ALLOWED_ORIGINS=http://localhost:5173,...
```

**✅ Pass Criteria**: All 5 environment variables are defined

---

### 4. Rates Endpoint Test (1 minute)

Test GET `/api/guest-booking/rates` returns pricing configuration.

```bash
# Start development server (if not running)
# npm run dev

# Test rates endpoint
curl -s -X GET http://localhost:8787/api/guest-booking/rates | jq

# Expected response:
# {
#   "success": true,
#   "rates": {
#     "base_rate": 3000,
#     "weekend_rate": 3500,
#     "extra_person_rate": 500,
#     "base_occupancy": 2,
#     "max_capacity_per_unit": 20,
#     "max_units_in_system": <number>,
#     "downpayment_percentage": 50,
#     "currency": "PHP"
#   }
# }
```

**✅ Pass Criteria**:

- HTTP 200 status
- `success: true`
- All rate fields present

---

### 5. Discount Rules Endpoint Test (1 minute)

Test GET `/api/guest-booking/discount-rules` returns active discounts.

```bash
curl -s -X GET http://localhost:8787/api/guest-booking/discount-rules | jq

# Expected response:
# {
#   "success": true,
#   "discount_rules": [
#     {
#       "id": "...",
#       "name": "Week Stay Discount",
#       "description": "5% off for 7+ nights",
#       "conditions": [{"type": "min_nights", "value": 7}],
#       "discount_type": "percentage",
#       "discount_value": 5,
#       "priority": 1
#     },
#     // ... more discount rules
#   ],
#   "display_message": "Book 7+ nights and save 5%!"
# }
```

**✅ Pass Criteria**:

- HTTP 200 status
- `success: true`
- At least 4 discount rules returned (from Chunk 001 default data)
- `display_message` is not null

---

### 6. Preview Pricing Endpoint Test (2 minutes)

Test POST `/api/guest-booking/preview-pricing` calculates pricing correctly.

#### Test 6a: Single Unit, No Discount

```bash
curl -s -X POST http://localhost:8787/api/guest-booking/preview-pricing \
  -H "Content-Type: application/json" \
  -d '{
    "unit_requests": [{"guests_per_unit": 2}],
    "check_in": "2025-11-01T14:00:00Z",
    "check_out": "2025-11-04T11:00:00Z"
  }' | jq

# Expected response:
# {
#   "success": true,
#   "pricing": {
#     "nights": 3,
#     "total_units": 1,
#     "total_guests": 2,
#     "weekend_nights": 1,
#     "base_total": 9000,
#     "weekend_surcharge": 500,
#     "extra_person_fees": 0,
#     "subtotal": 9500,
#     "discount": null,
#     "total": 9500,
#     "downpayment_required": 4750
#   }
# }
```

**✅ Pass Criteria**:

- `nights: 3`
- `total_units: 1`
- `base_total: 9000` (3000 \* 3 nights)
- `weekend_surcharge: 500` ((3500-3000) \* 1 weekend night)
- `discount: null` (< 7 nights)

#### Test 6b: Multiple Units with Discount

```bash
curl -s -X POST http://localhost:8787/api/guest-booking/preview-pricing \
  -H "Content-Type: application/json" \
  -d '{
    "unit_requests": [
      {"guests_per_unit": 2},
      {"guests_per_unit": 3}
    ],
    "check_in": "2025-11-01T14:00:00Z",
    "check_out": "2025-11-08T11:00:00Z"
  }' | jq

# Expected response:
# {
#   "success": true,
#   "pricing": {
#     "nights": 7,
#     "total_units": 2,
#     "total_guests": 5,
#     "weekend_nights": 1,
#     "base_total": 42000,
#     "weekend_surcharge": 1000,
#     "extra_person_fees": 3500,
#     "subtotal": 46500,
#     "discount": {
#       "percent": 5,
#       "amount": 2325,
#       "rule_name": "Week Stay Discount"
#     },
#     "total": 44175,
#     "downpayment_required": 22087.5
#   }
# }
```

**✅ Pass Criteria**:

- `nights: 7`
- `total_units: 2`
- `total_guests: 5` (2 + 3)
- `discount.percent: 5` (7-night discount applied)
- `extra_person_fees: 3500` (1 extra person _ 500 _ 7 nights)

---

### 7. Booking Endpoint Test (3 minutes)

Test POST `/api/guest-booking` creates booking successfully.

**Note**: Use Turnstile test token `1x00000000000000000000AA` for development.

```bash
curl -s -X POST http://localhost:8787/api/guest-booking \
  -H "Content-Type: application/json" \
  -d '{
    "guest_name": "Checkpoint Test Guest",
    "email": "checkpoint@test.com",
    "phone_number": "+1234567890",
    "check_in": "2025-12-01T14:00:00Z",
    "check_out": "2025-12-08T11:00:00Z",
    "unit_requests": [
      {"guests_per_unit": 2},
      {"guests_per_unit": 3}
    ],
    "special_requests": "Test booking from checkpoint verification",
    "turnstile_token": "1x00000000000000000000AA",
    "terms_accepted": true
  }' | jq

# Expected response:
# {
#   "success": true,
#   "booking": {
#     "booking_id": "<uuid>",
#     "booking_reference": "BK-202512-XXXXXX",
#     "total_amount": 44175,
#     "downpayment_amount": 22087.5,
#     "discount_applied": {
#       "percent": 5,
#       "amount": 2325,
#       "rule_name": "Week Stay Discount"
#     }
#   },
#   "unit_requests": [
#     {"guests_per_unit": 2},
#     {"guests_per_unit": 3}
#   ],
#   "pricing_breakdown": {...},
#   "message": "Booking created. Downpayment: ₱22,087.50. Admin will assign units within 24 hours.",
#   "is_duplicate": false
# }
```

**✅ Pass Criteria**:

- HTTP 201 status
- `success: true`
- `booking.booking_reference` matches format `BK-YYYYMM-XXXXXX`
- `is_duplicate: false`
- `total_amount` matches preview pricing
- `discount_applied` is present (7-night discount)

---

## Manual Checks

Perform these manual verifications to ensure business logic works correctly.

### 8. Idempotency Test (3 minutes)

Verify duplicate prevention works.

**Steps:**

1. Submit a booking with explicit `idempotency_key`
2. Submit identical booking again with same key
3. Verify second request returns existing booking

```bash
# Generate UUID for idempotency key
IDEMPOTENCY_KEY="550e8400-e29b-41d4-a716-446655440000"

# First request
curl -s -X POST http://localhost:8787/api/guest-booking \
  -H "Content-Type: application/json" \
  -d "{
    \"guest_name\": \"Idempotency Test\",
    \"email\": \"idempotency@test.com\",
    \"phone_number\": \"+1234567890\",
    \"check_in\": \"2025-12-10T14:00:00Z\",
    \"check_out\": \"2025-12-17T11:00:00Z\",
    \"unit_requests\": [{\"guests_per_unit\": 2}],
    \"turnstile_token\": \"1x00000000000000000000AA\",
    \"terms_accepted\": true,
    \"idempotency_key\": \"$IDEMPOTENCY_KEY\"
  }" | jq '.booking.booking_reference'

# Store booking reference
BOOKING_REF=$(curl -s -X POST http://localhost:8787/api/guest-booking \
  -H "Content-Type: application/json" \
  -d "{
    \"guest_name\": \"Idempotency Test\",
    \"email\": \"idempotency@test.com\",
    \"phone_number\": \"+1234567890\",
    \"check_in\": \"2025-12-10T14:00:00Z\",
    \"check_out\": \"2025-12-17T11:00:00Z\",
    \"unit_requests\": [{\"guests_per_unit\": 2}],
    \"turnstile_token\": \"1x00000000000000000000AA\",
    \"terms_accepted\": true,
    \"idempotency_key\": \"$IDEMPOTENCY_KEY\"
  }" | jq -r '.booking.booking_reference')

# Second request (should return existing booking)
curl -s -X POST http://localhost:8787/api/guest-booking \
  -H "Content-Type: application/json" \
  -d "{
    \"guest_name\": \"Idempotency Test\",
    \"email\": \"idempotency@test.com\",
    \"phone_number\": \"+1234567890\",
    \"check_in\": \"2025-12-10T14:00:00Z\",
    \"check_out\": \"2025-12-17T11:00:00Z\",
    \"unit_requests\": [{\"guests_per_unit\": 2}],
    \"turnstile_token\": \"1x00000000000000000000AA\",
    \"terms_accepted\": true,
    \"idempotency_key\": \"$IDEMPOTENCY_KEY\"
  }" | jq '.is_duplicate, .booking.booking_reference'
```

**✅ Pass Criteria**:

- Second request returns HTTP 200 (not 201)
- `is_duplicate: true`
- `booking_reference` matches first request
- No duplicate booking created in database

---

### 9. Rate Limiting Test (2 minutes)

Verify rate limits enforce correctly.

**Steps:**

1. Send multiple rapid requests to preview endpoint
2. Verify 21st request returns 429 status

```bash
# Send 21 requests rapidly
for i in {1..21}; do
  echo "Request $i:"
  curl -s -w "\nHTTP Status: %{http_code}\n" \
    -X POST http://localhost:8787/api/guest-booking/preview-pricing \
    -H "Content-Type: application/json" \
    -d '{
      "unit_requests": [{"guests_per_unit": 2}],
      "check_in": "2025-11-01T14:00:00Z",
      "check_out": "2025-11-04T11:00:00Z"
    }' | grep -E "success|HTTP Status"
  echo "---"
done
```

**✅ Pass Criteria**:

- Requests 1-20: HTTP 200 status
- Request 21: HTTP 429 status
- 429 response includes `error_code: "RATE_LIMIT_EXCEEDED"`
- 429 response includes `Retry-After` header

---

### 10. Capacity Validation Test (2 minutes)

Verify capacity constraints are enforced.

#### Test 10a: Exceed Guest Capacity Per Unit

```bash
curl -s -X POST http://localhost:8787/api/guest-booking \
  -H "Content-Type: application/json" \
  -d '{
    "guest_name": "Over Capacity Test",
    "email": "overcapacity@test.com",
    "phone_number": "+1234567890",
    "check_in": "2025-11-01T14:00:00Z",
    "check_out": "2025-11-04T11:00:00Z",
    "unit_requests": [{"guests_per_unit": 25}],
    "turnstile_token": "1x00000000000000000000AA",
    "terms_accepted": true
  }' | jq '.success, .error_code'

# Expected:
# false
# "CAPACITY_EXCEEDED"
```

**✅ Pass Criteria**:

- HTTP 400 status
- `success: false`
- `error_code: "CAPACITY_EXCEEDED"`
- Error message mentions `max_capacity_per_unit` (20)

#### Test 10b: Exceed System Unit Count

```bash
# Check total units in system first
TOTAL_UNITS=$(curl -s http://localhost:8787/api/guest-booking/rates | jq -r '.rates.max_units_in_system')

# Request more units than system has
curl -s -X POST http://localhost:8787/api/guest-booking \
  -H "Content-Type: application/json" \
  -d "{
    \"guest_name\": \"Too Many Units Test\",
    \"email\": \"toomanyunits@test.com\",
    \"phone_number\": \"+1234567890\",
    \"check_in\": \"2025-11-01T14:00:00Z\",
    \"check_out\": \"2025-11-04T11:00:00Z\",
    \"unit_requests\": $(for i in $(seq 1 $(($TOTAL_UNITS + 1))); do echo '{\"guests_per_unit\": 2}'; done | jq -s .),
    \"turnstile_token\": \"1x00000000000000000000AA\",
    \"terms_accepted\": true
  }" | jq '.success, .error_code'

# Expected:
# false
# "UNIT_LIMIT_EXCEEDED"
```

**✅ Pass Criteria**:

- HTTP 400 status
- `success: false`
- `error_code: "UNIT_LIMIT_EXCEEDED"`

---

### 11. Turnstile Verification Test (1 minute)

Verify invalid Turnstile token is rejected.

```bash
curl -s -X POST http://localhost:8787/api/guest-booking \
  -H "Content-Type: application/json" \
  -d '{
    "guest_name": "Invalid Token Test",
    "email": "invalidtoken@test.com",
    "phone_number": "+1234567890",
    "check_in": "2025-11-01T14:00:00Z",
    "check_out": "2025-11-04T11:00:00Z",
    "unit_requests": [{"guests_per_unit": 2}],
    "turnstile_token": "invalid-token-12345",
    "terms_accepted": true
  }' | jq '.success, .error_code'

# Expected:
# false
# "TURNSTILE_VERIFICATION_FAILED"
```

**✅ Pass Criteria**:

- HTTP 403 status
- `success: false`
- `error_code: "TURNSTILE_VERIFICATION_FAILED"`

**Note**: In development, use test token `2x00000000000000000000AB` (always fails) for this test.

---

### 12. Database Verification (2 minutes)

Verify booking was created in database correctly.

**Steps:**

1. Query Supabase database for test bookings
2. Verify `guest_booking_unit_requests` rows were created

```sql
-- Run in Supabase SQL Editor

-- 1. Find checkpoint test booking
SELECT
  booking_id,
  booking_reference,
  guest_name,
  email,
  total_amount,
  is_multi_unit,
  is_guest_booking,
  requested_unit_count,
  unit_assignment_status,
  pricing_snapshot->>'total' as pricing_total
FROM bookings
WHERE email = 'checkpoint@test.com'
ORDER BY created_at DESC
LIMIT 1;

-- Expected:
-- - is_multi_unit: true
-- - is_guest_booking: true
-- - requested_unit_count: 2
-- - unit_assignment_status: 'pending'
-- - pricing_snapshot exists (JSONB)

-- 2. Verify unit requests were created
SELECT
  id,
  booking_id,
  guests_per_unit,
  created_at
FROM guest_booking_unit_requests
WHERE booking_id = (
  SELECT booking_id FROM bookings WHERE email = 'checkpoint@test.com' LIMIT 1
);

-- Expected: 2 rows (one for each unit request)
-- - Row 1: guests_per_unit: 2
-- - Row 2: guests_per_unit: 3

-- 3. Verify idempotency key was stored
SELECT
  key,
  booking_id,
  expires_at
FROM idempotency_keys
WHERE booking_id = (
  SELECT booking_id FROM bookings WHERE email = 'checkpoint@test.com' LIMIT 1
);

-- Expected: 1 row
-- - expires_at should be ~48 hours from now
```

**✅ Pass Criteria**:

- Booking exists in `bookings` table
- 2 rows exist in `guest_booking_unit_requests` table
- `pricing_snapshot` JSONB column contains complete pricing data
- Idempotency key exists in `idempotency_keys` table
- `unit_assignment_status` is 'pending'

---

## Success Criteria Checklist

Mark each criterion as you verify it:

### API Functionality

- [ ] **Rates endpoint** returns pricing configuration (200 OK)
- [ ] **Discount rules endpoint** returns active discounts (200 OK)
- [ ] **Preview pricing endpoint** calculates accurate pricing (200 OK)
- [ ] **Booking endpoint** creates booking successfully (201 Created)

### Security & Validation

- [ ] **Turnstile verification** blocks invalid tokens (403 Forbidden)
- [ ] **Rate limiting** enforces request limits (429 Too Many Requests after threshold)
- [ ] **Idempotency** prevents duplicate bookings (returns existing booking)
- [ ] **Capacity validation** rejects over-capacity requests (400 Bad Request)
- [ ] **Unit count validation** rejects excessive unit requests (400 Bad Request)

### Pricing Accuracy

- [ ] **Single unit pricing** calculates correctly (matches PostgreSQL function)
- [ ] **Multiple unit pricing** calculates correctly
- [ ] **Weekend surcharge** applied for Friday/Saturday nights
- [ ] **Extra person fees** calculated correctly
- [ ] **7-night discount** applied automatically (5% off)

### Database Integrity

- [ ] **Booking created** in `bookings` table
- [ ] **Unit requests created** in `guest_booking_unit_requests` table (array-based)
- [ ] **Idempotency key stored** in `idempotency_keys` table
- [ ] **Pricing snapshot** stored in JSONB column (immutable)
- [ ] **Guest created or updated** in `guests` table

### Code Quality

- [ ] **TypeScript compilation** passes without errors
- [ ] **All endpoint files** exist in `functions/api/` directory
- [ ] **Helper utilities** created (`turnstile.ts`, `rate-limit.ts`)
- [ ] **Type definitions** created (`guest-booking-multi-unit.ts`)
- [ ] **Environment variables** configured correctly

---

## If Any Check Fails

1. **Review error messages** - Most failures provide specific error details
2. **Check Supabase logs** - Database errors often logged in Supabase dashboard
3. **Verify environment variables** - Incorrect keys cause authentication failures
4. **Consult troubleshooting.md** - Common issues and solutions documented
5. **Re-run failed test** - Transient network errors sometimes occur

---

## When All Checks Pass

### Cleanup Test Data (Optional)

```sql
-- Delete checkpoint test bookings
DELETE FROM bookings WHERE email IN (
  'checkpoint@test.com',
  'idempotency@test.com',
  'overcapacity@test.com',
  'toomanyunits@test.com',
  'invalidtoken@test.com'
);

-- Idempotency keys cascade delete automatically
-- guest_booking_unit_requests cascade delete automatically
```

### Commit Changes

```bash
# Stage all changes
git add \
  functions/api/guest-booking.ts \
  functions/api/guest-booking/rates.ts \
  functions/api/guest-booking/discount-rules.ts \
  functions/api/guest-booking/preview-pricing.ts \
  src/lib/turnstile.ts \
  src/lib/rate-limit.ts \
  src/types/guest-booking-multi-unit.ts \
  .env.local \
  wrangler.toml

# Commit with descriptive message
git commit -m "feat: complete chunk 004-core-api-endpoints

- Implement POST /api/guest-booking endpoint (booking creation)
- Implement GET /api/guest-booking/rates endpoint (pricing config)
- Implement GET /api/guest-booking/discount-rules endpoint (active discounts)
- Implement POST /api/guest-booking/preview-pricing endpoint (real-time pricing)
- Add Turnstile CAPTCHA verification
- Add KV-based rate limiting
- Add idempotency checking (48-hour window)
- Add capacity validation (guest capacity and system unit count)
- All endpoints tested and verified

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Tag milestone
git tag chunk-004
```

### Next Chunk

**Option 1: Chunk 005 - Idempotency and Rate Limiting**

- Advanced cleanup cron jobs
- Retry logic for failed bookings
- Enhanced monitoring

**Option 2: Chunk 006 - Date and Unit Selection UI**

- Start building frontend components
- Requires these API endpoints to be functional
- Better for visual progress

**Recommended**: Proceed to **Chunk 006** (frontend) to see immediate visual results.

---

## Status Tracking

| Check                           | Status                             | Time Taken | Issues | Notes |
| ------------------------------- | ---------------------------------- | ---------- | ------ | ----- |
| File Structure                  | ⬜ Pass / ⬜ Fail / ⬜ In Progress | **\_** min |        |       |
| TypeScript Compilation          | ⬜ Pass / ⬜ Fail / ⬜ In Progress | **\_** min |        |       |
| Environment Variables           | ⬜ Pass / ⬜ Fail / ⬜ In Progress | **\_** min |        |       |
| Rates Endpoint                  | ⬜ Pass / ⬜ Fail / ⬜ In Progress | **\_** min |        |       |
| Discount Rules Endpoint         | ⬜ Pass / ⬜ Fail / ⬜ In Progress | **\_** min |        |       |
| Preview Pricing (No Discount)   | ⬜ Pass / ⬜ Fail / ⬜ In Progress | **\_** min |        |       |
| Preview Pricing (With Discount) | ⬜ Pass / ⬜ Fail / ⬜ In Progress | **\_** min |        |       |
| Booking Creation                | ⬜ Pass / ⬜ Fail / ⬜ In Progress | **\_** min |        |       |
| Idempotency Test                | ⬜ Pass / ⬜ Fail / ⬜ In Progress | **\_** min |        |       |
| Rate Limiting Test              | ⬜ Pass / ⬜ Fail / ⬜ In Progress | **\_** min |        |       |
| Capacity Validation             | ⬜ Pass / ⬜ Fail / ⬜ In Progress | **\_** min |        |       |
| Turnstile Verification          | ⬜ Pass / ⬜ Fail / ⬜ In Progress | **\_** min |        |       |
| Database Verification           | ⬜ Pass / ⬜ Fail / ⬜ In Progress | **\_** min |        |       |

**Total Time**: **\_\_\_** minutes

**Overall Status**: ⬜ All Pass ⬜ Some Failures ⬜ In Progress

---

**Chunk 004 Complete!** ✅ All API endpoints are functional and verified.
