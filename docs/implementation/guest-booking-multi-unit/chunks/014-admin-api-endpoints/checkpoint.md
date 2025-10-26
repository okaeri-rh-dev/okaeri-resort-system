# Checkpoint: Chunk 014 - Admin API Endpoints

## Purpose

This checkpoint verifies that all admin API endpoints are implemented correctly, authentication is enforced, urgency scoring works, and rate limiting is configured properly.

---

## Automated Checks

Run these commands to verify technical correctness:

### 1. Type Checking

```bash
npm run type-check
```

**Expected Output**: ✅ No TypeScript errors

**What This Verifies**:

- `src/lib/urgency-scoring.ts` has correct types
- `functions/api/admin/*` files have correct type annotations
- All API handlers match Cloudflare Workers types
- Rate limiting configuration is type-safe

**If This Fails**: Check TypeScript errors and fix type mismatches. See `troubleshooting.md` section "TypeScript Errors".

---

### 2. Linting

```bash
npm run lint
```

**Expected Output**: ✅ No ESLint warnings

**What This Verifies**:

- Code follows project style guidelines
- No unused variables or imports
- Proper async/await usage
- CORS headers configured correctly

**If This Fails**: Run `npm run lint:fix` to auto-fix, then manually fix remaining issues.

---

### 3. Build Check

```bash
npm run build
```

**Expected Output**: ✅ Build succeeds without errors

**What This Verifies**:

- All imports resolve correctly
- No circular dependencies
- Cloudflare Workers bundle builds successfully

**If This Fails**: Check build errors for missing dependencies or import issues.

---

## Manual Checks

Perform these manual verifications to ensure functionality:

### 4. Urgency Scoring Calculation

**Test Scenario 1: Critical Urgency (Check-in <24 hours)**

Create test booking data:

```typescript
const booking = {
  booking_id: "test-1",
  check_in_date: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), // 12 hours from now
  created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
  total_amount: 35000,
  requested_unit_count: 3,
};

const urgency = calculateUrgencyScore(booking);
console.log(urgency);
// Expected: { score: 85, badge: "critical", slo_hours: 1 }
// Calculation: 50 (check-in <24h) + 10 (1-2 days pending) + 10 (₱30k-50k) + 10 (3-5 units) = 80
```

**Test Scenario 2: High Urgency (Check-in 24-48 hours)**

```typescript
const booking = {
  booking_id: "test-2",
  check_in_date: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(), // 36 hours from now
  created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 2 days ago
  total_amount: 55000,
  requested_unit_count: 6,
};

const urgency = calculateUrgencyScore(booking);
// Expected: { score: 75, badge: "critical", slo_hours: 1 }
// Calculation: 35 (check-in 24-48h) + 15 (2-3 days pending) + 15 (₱50k+) + 15 (6+ units) = 80
```

**Test Scenario 3: Low Urgency (Check-in >72 hours, new booking)**

```typescript
const booking = {
  booking_id: "test-3",
  check_in_date: new Date(Date.now() + 168 * 60 * 60 * 1000).toISOString(), // 7 days from now
  created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
  total_amount: 12000,
  requested_unit_count: 1,
};

const urgency = calculateUrgencyScore(booking);
// Expected: { score: 17, badge: "low", slo_hours: 24 }
// Calculation: 10 (check-in >72h) + 5 (<1 day pending) + 2 (<₱15k) + 2 (1 unit) = 19
```

**✅ Pass Criteria**: All 3 scenarios produce expected score ranges and correct badges.

---

### 5. Admin Authentication

**Test 5.1: Valid Admin Token**

```bash
# Replace YOUR_ADMIN_JWT_TOKEN with actual admin JWT
curl -X GET https://your-domain.com/api/admin/pending-bookings \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

**Expected Response**:

```json
{
  "success": true,
  "bookings": [...],
  "total": 5
}
```

**✅ Pass Criteria**: HTTP 200 with bookings array.

---

**Test 5.2: Missing Token**

```bash
curl -X GET https://your-domain.com/api/admin/pending-bookings
```

**Expected Response**:

```json
{
  "success": false,
  "error": "Unauthorized",
  "error_code": "UNAUTHORIZED",
  "message": "Missing or invalid Authorization header"
}
```

**✅ Pass Criteria**: HTTP 401 with error code.

---

**Test 5.3: Invalid Token**

```bash
curl -X GET https://your-domain.com/api/admin/pending-bookings \
  -H "Authorization: Bearer invalid-token-here"
```

**Expected Response**:

```json
{
  "success": false,
  "error": "Unauthorized",
  "error_code": "UNAUTHORIZED",
  "message": "Invalid or expired token"
}
```

**✅ Pass Criteria**: HTTP 401 with error code.

---

**Test 5.4: Non-Admin User Token**

```bash
# Use JWT token from non-admin user
curl -X GET https://your-domain.com/api/admin/pending-bookings \
  -H "Authorization: Bearer NON_ADMIN_JWT_TOKEN"
```

**Expected Response**:

```json
{
  "success": false,
  "error": "Forbidden - insufficient permissions",
  "error_code": "FORBIDDEN",
  "message": "Admin role required"
}
```

**✅ Pass Criteria**: HTTP 403 with error code.

---

### 6. Pending Bookings API

**Test 6.1: Fetch Pending Bookings**

```bash
curl -X GET https://your-domain.com/api/admin/pending-bookings \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

**Expected Response Structure**:

```json
{
  "success": true,
  "bookings": [
    {
      "booking_id": "uuid",
      "booking_reference": "BK-202503-ABC123",
      "guest_name": "John Doe",
      "email": "john@example.com",
      "phone_number": "+639123456789",
      "check_in_date": "2025-03-01",
      "check_out_date": "2025-03-08",
      "requested_unit_count": 3,
      "total_amount": 35000,
      "downpayment_required": 17500,
      "payment_status": "Pending",
      "payment_proof_url": null,
      "unit_assignment_status": "pending",
      "urgency_score": 85,
      "urgency_badge": "critical",
      "urgency_slo_hours": 1,
      "created_at": "2025-02-28T10:00:00Z"
    }
  ],
  "total": 5
}
```

**✅ Pass Criteria**:

- HTTP 200 response
- `bookings` array present
- Each booking has `urgency_score`, `urgency_badge`, `urgency_slo_hours`
- Bookings sorted by `urgency_score` descending (highest first)
- Only pending multi-unit bookings returned

---

**Test 6.2: Empty Queue**

If no pending bookings exist:

**Expected Response**:

```json
{
  "success": true,
  "bookings": [],
  "total": 0
}
```

**✅ Pass Criteria**: HTTP 200 with empty array (not error).

---

### 7. Available Units API

**Test 7.1: Valid Date Range**

```bash
curl -X GET "https://your-domain.com/api/admin/available-units?check_in=2025-03-01&check_out=2025-03-08" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

**Expected Response Structure**:

```json
{
  "success": true,
  "units": [
    {
      "unit_id": "uuid",
      "unit_number": "101",
      "unit_name": "Deluxe Room A",
      "unit_status": "Available",
      "max_capacity_per_unit": 4
    }
  ],
  "total": 8,
  "date_range": {
    "check_in": "2025-03-01",
    "check_out": "2025-03-08"
  }
}
```

**✅ Pass Criteria**:

- HTTP 200 response
- `units` array contains only available units
- Units with overlapping bookings excluded
- `max_capacity_per_unit` included from `pricing_config`

---

**Test 7.2: Missing Query Parameters**

```bash
curl -X GET "https://your-domain.com/api/admin/available-units" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

**Expected Response**:

```json
{
  "success": false,
  "error": "Missing required parameters: check_in, check_out",
  "error_code": "VALIDATION_ERROR"
}
```

**✅ Pass Criteria**: HTTP 400 with validation error.

---

**Test 7.3: Invalid Date Format**

```bash
curl -X GET "https://your-domain.com/api/admin/available-units?check_in=invalid&check_out=2025-03-08" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

**Expected Response**:

```json
{
  "success": false,
  "error": "Invalid date format",
  "error_code": "VALIDATION_ERROR"
}
```

**✅ Pass Criteria**: HTTP 400 with validation error.

---

**Test 7.4: Check-out Before Check-in**

```bash
curl -X GET "https://your-domain.com/api/admin/available-units?check_in=2025-03-08&check_out=2025-03-01" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

**Expected Response**:

```json
{
  "success": false,
  "error": "Check-out must be after check-in",
  "error_code": "INVALID_DATE_RANGE"
}
```

**✅ Pass Criteria**: HTTP 400 with validation error.

---

### 8. Assign Units API

**Test 8.1: Successful Assignment**

**Prerequisites**:

- Booking with `payment_status = 'Verified'`
- Booking with `unit_assignment_status = 'pending'`
- 3 units available for booking date range

```bash
curl -X POST https://your-domain.com/api/admin/assign-units \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": "valid-booking-uuid",
    "unit_ids": ["unit-uuid-1", "unit-uuid-2", "unit-uuid-3"]
  }'
```

**Expected Response**:

```json
{
  "success": true,
  "message": "Successfully assigned 3 units"
}
```

**✅ Pass Criteria**:

- HTTP 200 response
- Database: `bookings.unit_assignment_status = 'assigned'`
- Database: `bookings.booking_status = 'Confirmed'`
- Database: 3 rows in `booking_units` table
- Audit log entry created

---

**Test 8.2: Payment Not Verified**

```bash
curl -X POST https://your-domain.com/api/admin/assign-units \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": "unverified-payment-booking-uuid",
    "unit_ids": ["unit-uuid-1"]
  }'
```

**Expected Response**:

```json
{
  "success": false,
  "error": "Payment verification required before assignment",
  "error_code": "PAYMENT_NOT_VERIFIED"
}
```

**✅ Pass Criteria**: HTTP 403 with error code (DB constraint blocks).

---

**Test 8.3: All-or-Nothing Violation**

```bash
# Booking requests 3 units, but only 2 provided
curl -X POST https://your-domain.com/api/admin/assign-units \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": "booking-requests-3-units-uuid",
    "unit_ids": ["unit-uuid-1", "unit-uuid-2"]
  }'
```

**Expected Response**:

```json
{
  "success": false,
  "error": "Must assign all requested units",
  "error_code": "PARTIAL_ASSIGNMENT_NOT_ALLOWED"
}
```

**✅ Pass Criteria**: HTTP 400 with error code.

---

**Test 8.4: Unit Already Booked (Conflict)**

```bash
# One of the units is already booked for overlapping dates
curl -X POST https://your-domain.com/api/admin/assign-units \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": "valid-booking-uuid",
    "unit_ids": ["unit-already-booked-uuid", "unit-uuid-2"]
  }'
```

**Expected Response**:

```json
{
  "success": false,
  "error": "One or more units already booked for these dates",
  "error_code": "UNIT_ALREADY_BOOKED"
}
```

**✅ Pass Criteria**:

- HTTP 409 with error code
- Transaction rolled back (NO units assigned)
- Database: `unit_assignment_status` still 'pending'

---

### 9. Verify Payment API

**Test 9.1: Verify Payment (Accept)**

```bash
curl -X POST https://your-domain.com/api/admin/verify-payment \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": "valid-booking-uuid",
    "verified": true,
    "notes": "Payment confirmed via GCash screenshot"
  }'
```

**Expected Response**:

```json
{
  "success": true,
  "message": "Payment verified successfully",
  "payment_status": "Verified"
}
```

**✅ Pass Criteria**:

- HTTP 200 response
- Database: `bookings.payment_status = 'Verified'`
- Database: `bookings.payment_verification_notes` contains notes
- Database: `bookings.payment_verified_at` has timestamp
- Audit log entry created

---

**Test 9.2: Reject Payment**

```bash
curl -X POST https://your-domain.com/api/admin/verify-payment \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": "valid-booking-uuid",
    "verified": false,
    "notes": "Screenshot is blurry, cannot verify transaction"
  }'
```

**Expected Response**:

```json
{
  "success": true,
  "message": "Payment rejected successfully",
  "payment_status": "Rejected"
}
```

**✅ Pass Criteria**:

- HTTP 200 response
- Database: `bookings.payment_status = 'Rejected'`
- Database: `bookings.payment_verification_notes` contains notes
- Audit log entry created
- Cannot assign units (payment not verified)

---

### 10. Rate Limiting

**Test 10.1: Within Rate Limit**

```bash
# Make 5 requests rapidly (within limit of 100/hour)
for i in {1..5}; do
  curl -X GET https://your-domain.com/api/admin/pending-bookings \
    -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
done
```

**Expected**: All 5 requests succeed with HTTP 200.

**✅ Pass Criteria**: Rate limit headers present:

- `X-RateLimit-Limit: 100`
- `X-RateLimit-Remaining: 95` (decrements with each request)
- `X-RateLimit-Reset: <timestamp>`

---

**Test 10.2: Exceed Rate Limit**

```bash
# Make 101 requests rapidly to exceed limit
for i in {1..101}; do
  curl -X GET https://your-domain.com/api/admin/pending-bookings \
    -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
done
```

**Expected**: Request 101 returns HTTP 429.

**Expected Response (request 101)**:

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "error_code": "RATE_LIMIT_EXCEEDED",
  "retry_after": 3420
}
```

**✅ Pass Criteria**:

- First 100 requests succeed
- Request 101+ returns HTTP 429
- `Retry-After` header present

---

### 11. Audit Logging

**Test 11.1: Assignment Audit Log**

After assigning units (Test 8.1), check audit log:

```sql
SELECT * FROM audit_logs
WHERE entity_type = 'booking'
  AND entity_id = 'your-booking-uuid'
  AND action = 'booking.units_assigned'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Fields**:

- `action = 'booking.units_assigned'`
- `changes.before = { "unit_assignment_status": "pending" }`
- `changes.after.unit_assignment_status = 'assigned'`
- `changes.after.unit_ids = [array of assigned unit IDs]`
- `user_id = <admin user ID>`
- `metadata.ip_address` present
- `metadata.unit_count = 3`

**✅ Pass Criteria**: Audit log entry exists with correct data.

---

**Test 11.2: Payment Verification Audit Log**

After verifying payment (Test 9.1), check audit log:

```sql
SELECT * FROM audit_logs
WHERE entity_type = 'booking'
  AND entity_id = 'your-booking-uuid'
  AND action = 'booking.payment_verified'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Fields**:

- `action = 'booking.payment_verified'`
- `changes.before.payment_status = 'Pending'`
- `changes.after.payment_status = 'Verified'`
- `changes.after.notes` contains verification notes
- `user_id = <admin user ID>`

**✅ Pass Criteria**: Audit log entry exists with correct data.

---

### 12. CORS Headers

**Test 12.1: Preflight Request (OPTIONS)**

```bash
curl -X OPTIONS https://your-domain.com/api/admin/pending-bookings \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Authorization"
```

**Expected Headers**:

```
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

**✅ Pass Criteria**: HTTP 204 with correct CORS headers.

---

## Success Criteria

Mark each item when verified:

### Automated Checks

- [ ] TypeScript type checking passes (`npm run type-check`)
- [ ] ESLint linting passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)

### Urgency Scoring

- [ ] Critical urgency calculated correctly (75+ score)
- [ ] High urgency calculated correctly (50-74 score)
- [ ] Low urgency calculated correctly (<25 score)
- [ ] Badge thresholds work correctly

### Authentication

- [ ] Valid admin token succeeds (HTTP 200)
- [ ] Missing token returns 401 Unauthorized
- [ ] Invalid token returns 401 Unauthorized
- [ ] Non-admin user returns 403 Forbidden

### Pending Bookings API

- [ ] Fetches pending bookings successfully
- [ ] Urgency scores calculated and included
- [ ] Bookings sorted by urgency descending
- [ ] Empty queue returns empty array (not error)

### Available Units API

- [ ] Returns available units for date range
- [ ] Excludes booked units
- [ ] Validates date parameters
- [ ] Rejects invalid date format
- [ ] Rejects check-out before check-in

### Assign Units API

- [ ] Assigns units successfully (all-or-nothing)
- [ ] Blocks if payment not verified (403)
- [ ] Rejects partial assignments (400)
- [ ] Detects unit conflicts (409)
- [ ] Transaction rolls back on error
- [ ] Booking status updates to 'Confirmed'

### Verify Payment API

- [ ] Verifies payment successfully
- [ ] Rejects payment successfully
- [ ] Stores admin notes
- [ ] Updates payment_verified_at timestamp

### Rate Limiting

- [ ] Rate limit headers present in responses
- [ ] Requests within limit succeed
- [ ] Requests exceeding limit return 429
- [ ] Rate limit resets after time window

### Audit Logging

- [ ] Assignment creates audit log entry
- [ ] Payment verification creates audit log entry
- [ ] Audit logs include user_id
- [ ] Audit logs include IP address

### CORS

- [ ] OPTIONS requests return 204
- [ ] CORS headers present in all responses

---

## If Any Check Fails

### For Automated Checks (1-3)

See `troubleshooting.md` → **Section: Build and Type Errors**

### For Authentication Checks (5)

See `troubleshooting.md` → **Section: JWT Authentication Failures**

### For Urgency Scoring (4, 6)

See `troubleshooting.md` → **Section: Urgency Scoring Calculation Errors**

### For Available Units API (7)

See `troubleshooting.md` → **Section: Available Units Query Issues**

### For Assign Units API (8)

See `troubleshooting.md` → **Section: Unit Assignment Transaction Failures**

### For Verify Payment API (9)

See `troubleshooting.md` → **Section: Payment Verification Errors**

### For Rate Limiting (10)

See `troubleshooting.md` → **Section: Rate Limiting Not Working**

### For Audit Logging (11)

See `troubleshooting.md` → **Section: Audit Logs Not Created**

---

## When All Checks Pass

### Status Tracking

| Check Category       | Status                          | Time Taken | Issues Encountered | Notes |
| -------------------- | ------------------------------- | ---------- | ------------------ | ----- |
| Automated Checks     | ☐ Pass / ☐ Fail / ☐ In Progress | \_\_\_ min |                    |       |
| Urgency Scoring      | ☐ Pass / ☐ Fail / ☐ In Progress | \_\_\_ min |                    |       |
| Authentication       | ☐ Pass / ☐ Fail / ☐ In Progress | \_\_\_ min |                    |       |
| Pending Bookings API | ☐ Pass / ☐ Fail / ☐ In Progress | \_\_\_ min |                    |       |
| Available Units API  | ☐ Pass / ☐ Fail / ☐ In Progress | \_\_\_ min |                    |       |
| Assign Units API     | ☐ Pass / ☐ Fail / ☐ In Progress | \_\_\_ min |                    |       |
| Verify Payment API   | ☐ Pass / ☐ Fail / ☐ In Progress | \_\_\_ min |                    |       |
| Rate Limiting        | ☐ Pass / ☐ Fail / ☐ In Progress | \_\_\_ min |                    |       |
| Audit Logging        | ☐ Pass / ☐ Fail / ☐ In Progress | \_\_\_ min |                    |       |
| CORS                 | ☐ Pass / ☐ Fail / ☐ In Progress | \_\_\_ min |                    |       |

### Commit Your Changes

```bash
git add .
git commit -m "feat: complete chunk 014-admin-api-endpoints

- Implement urgency scoring utility (TypeScript application layer)
- Create admin authentication middleware (JWT + role verification)
- Create pending bookings API (queue with urgency scores)
- Create available units API (date range availability checker)
- Create assign units API (calls PostgreSQL function)
- Create verify payment API (unlocks unit assignment)
- Add rate limiting for all admin endpoints (100 req/hour)
- Add audit logging for assignment and verification actions
- Configure CORS headers for all endpoints

All checkpoints verified and passing."
```

### Next Chunk

**Chunk 015: Unit and Integration Tests**

**What it covers**:

- Test fixtures (images, PDFs, JSON payloads)
- Pricing calculation tests (all discount types)
- Idempotency tests
- Constraint violation tests
- API endpoint integration tests
- Mock data generation utilities

**Dependencies**: Requires completed admin API (this chunk) to test end-to-end workflows.

---

**Checkpoint Complete!** ✅

You are ready to move to Chunk 015: Unit and Integration Tests.
