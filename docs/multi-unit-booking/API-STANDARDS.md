# Multi-Unit Booking API Standards

**Version**: 1.0
**Status**: Foundation Document
**Last Updated**: 2025-10-08

This document defines API endpoint standards, naming conventions, and payload specifications for multi-unit booking functionality.

---

## Table of Contents

1. [Endpoint Naming Conventions](#endpoint-naming-conventions)
2. [Multi-Unit Booking Endpoints](#multi-unit-booking-endpoints)
3. [Availability Endpoints](#availability-endpoints)
4. [Pricing Endpoints](#pricing-endpoints)
5. [Payment Endpoints (Manual Tracking)](#payment-endpoints-manual-tracking)
6. [Error Codes](#error-codes)
7. [Request/Response Patterns](#requestresponse-patterns)

---

## Endpoint Naming Conventions

### General Principles

- **RESTful**: Use standard HTTP methods (GET, POST, PUT, DELETE)
- **Resource-oriented**: Endpoints represent resources, not actions
- **Kebab-case**: Use hyphens for multi-word routes (`/multi-unit`, not `/multiUnit`)
- **Plural resources**: Use plural nouns (`/bookings`, not `/booking`)
- **Nested resources**: Show relationships (`/bookings/:id/units`)

### HTTP Method Semantics

| Method | Purpose                 | Idempotent | Safe   |
| ------ | ----------------------- | ---------- | ------ |
| GET    | Retrieve resource(s)    | ✅ Yes     | ✅ Yes |
| POST   | Create new resource     | ❌ No      | ❌ No  |
| PUT    | Replace entire resource | ✅ Yes     | ❌ No  |
| PATCH  | Partial update          | ❌ No      | ❌ No  |
| DELETE | Remove resource         | ✅ Yes     | ❌ No  |

---

## Multi-Unit Booking Endpoints

### 1. Create Multi-Unit Booking

**Endpoint**: `POST /api/bookings/multi-unit`

**Purpose**: Create a new booking with one or more units

**Authentication**: Optional (allows anonymous guest bookings)

**Request Body**:

```typescript
{
  // Guest information
  guest_name: string,
  email: string,
  contact_number: string,

  // Booking details
  check_in: string,  // ISO 8601 date (YYYY-MM-DD)
  check_out: string,  // ISO 8601 date (YYYY-MM-DD)
  num_guests: number,  // Total guests across all units

  // Units (1+ required)
  units: Array<{
    unit_id: string,
    guest_name: string,  // Guest assigned to this unit
    rate_per_night: number,
    num_nights: number,
    subtotal: number,
    notes?: string
  }>,

  // Optional fields
  special_requests?: string,
  internal_notes?: string,  // Staff only

  // Security (required for guest bookings)
  turnstile_token?: string,

  // Idempotency
  idempotency_key?: string
}
```

**Response (201 Created)**:

```typescript
{
  booking_id: string,  // UUID
  booking_reference: string,  // e.g., "BK-20251008-0001"
  booking_status: "Pending" | "Confirmed",
  check_in: string,
  check_out: string,
  total_amount: number,
  units: Array<{
    unit_id: string,
    unit_name: string,
    guest_name: string,
    subtotal: number
  }>,
  created_at: string,  // ISO 8601 timestamp
  guest: {
    guest_id: string,
    guest_name: string,
    email: string
  }
}
```

**Error Responses**:

- `400 Bad Request` - Invalid input (validation failed)
- `409 Conflict` - Unit(s) no longer available (`UNIT_BECAME_UNAVAILABLE`)
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

**Example**:

```bash
curl -X POST https://okaeri-resort.pages.dev/api/bookings/multi-unit \
  -H "Content-Type: application/json" \
  -d '{
    "guest_name": "John Doe",
    "email": "john@example.com",
    "contact_number": "+639123456789",
    "check_in": "2025-12-20",
    "check_out": "2025-12-25",
    "num_guests": 4,
    "units": [
      {
        "unit_id": "unit-1",
        "guest_name": "John Doe",
        "rate_per_night": 2500,
        "num_nights": 5,
        "subtotal": 12500
      },
      {
        "unit_id": "unit-2",
        "guest_name": "Jane Smith",
        "rate_per_night": 2500,
        "num_nights": 5,
        "subtotal": 12500
      }
    ],
    "turnstile_token": "0.xxx..."
  }'
```

---

### 2. Add Unit to Existing Booking

**Endpoint**: `POST /api/bookings/:booking_id/units/add`

**Purpose**: Add an additional unit to an existing multi-unit booking

**Authentication**: Required (staff only)

**Request Body**:

```typescript
{
  unit_id: string,
  guest_name: string,
  rate_per_night: number,
  num_nights: number,
  subtotal: number,
  notes?: string
}
```

**Response (200 OK)**:

```typescript
{
  booking_id: string,
  booking_reference: string,
  total_amount: number,  // Updated total
  units: Array<{
    unit_id: string,
    unit_name: string,
    guest_name: string,
    subtotal: number
  }>
}
```

**Validation Rules**:

- Booking must exist and be in `Pending` or `Confirmed` status
- Unit must be available for booking's date range
- `subtotal` must equal `rate_per_night * num_nights`
- `num_nights` must match booking's date range

---

### 3. Remove Unit from Booking

**Endpoint**: `POST /api/bookings/:booking_id/units/remove`

**Purpose**: Remove a unit from a multi-unit booking

**Authentication**: Required (staff only)

**Request Body**:

```typescript
{
  unit_id: string,
  reason?: string  // Optional reason for audit log
}
```

**Response (200 OK)**:

```typescript
{
  booking_id: string,
  booking_reference: string,
  total_amount: number,  // Updated total
  units: Array<{
    unit_id: string,
    unit_name: string,
    guest_name: string,
    subtotal: number
  }>,
  refund_amount?: number  // If applicable
}
```

**Business Rules**:

- Cannot remove last unit (use booking cancellation instead)
- If `payment_status = "FullyPaid"`, create refund for removed unit
- Update `total_amount` accordingly

---

## Availability Endpoints

### 1. Check Multi-Unit Availability

**Endpoint**: `GET /api/availability/multi-unit`

**Purpose**: Check if multiple units are available for a date range

**Authentication**: None (public endpoint)

**Query Parameters**:

```
?units[]=unit-1&units[]=unit-2&units[]=unit-3
&check_in=2025-12-20
&check_out=2025-12-25
```

**Response (200 OK)**:

```typescript
{
  check_in: string,
  check_out: string,
  num_nights: number,
  availability: Array<{
    unit_id: string,
    unit_name: string,
    is_available: boolean,
    blocked_dates: string[],  // Dates where unit is blocked
    conflicting_bookings?: Array<{
      booking_id: string,
      booking_reference: string,
      booking_status: string
    }>
  }>
}
```

**Availability Logic** (Aggressive Policy):

- **BLOCKED**: Unit has `Confirmed` or `CheckedIn` booking for ANY date in range
- **AVAILABLE**: No blocking bookings found
- **NOTE**: `Pending` bookings do NOT block availability

**Example**:

```bash
curl "https://okaeri-resort.pages.dev/api/availability/multi-unit?units[]=unit-1&units[]=unit-2&check_in=2025-12-20&check_out=2025-12-25"
```

**Response**:

```json
{
  "check_in": "2025-12-20",
  "check_out": "2025-12-25",
  "num_nights": 5,
  "availability": [
    {
      "unit_id": "unit-1",
      "unit_name": "Ocean View Suite",
      "is_available": true,
      "blocked_dates": []
    },
    {
      "unit_id": "unit-2",
      "unit_name": "Garden Villa",
      "is_available": false,
      "blocked_dates": ["2025-12-22", "2025-12-23"],
      "conflicting_bookings": [
        {
          "booking_id": "xxx",
          "booking_reference": "BK-20251001-0042",
          "booking_status": "Confirmed"
        }
      ]
    }
  ]
}
```

---

## Pricing Endpoints

### 1. Get Pricing Quote

**Endpoint**: `POST /api/pricing/quote`

**Purpose**: Calculate total pricing for multi-unit booking (NOT LOCKED)

**Authentication**: None (public endpoint)

**Request Body**:

```typescript
{
  units: Array<{
    unit_id: string;
    check_in: string; // ISO 8601 date
    check_out: string;
  }>;
}
```

**Response (200 OK)**:

```typescript
{
  total: number,
  units: Array<{
    unit_id: string,
    unit_name: string,
    check_in: string,
    check_out: string,
    num_nights: number,
    rate_per_night: number,  // May vary by date (weekends, holidays)
    subtotal: number,
    breakdown: Array<{
      date: string,
      rate: number,
      rate_type: "base" | "weekend" | "peak" | "holiday"
    }>
  }>
}
```

**Important**:

- Quote is **NOT locked** - price may change between quote and submit
- Server recalculates pricing on booking submission
- If price changes, user must confirm new total

**Example**:

```bash
curl -X POST https://okaeri-resort.pages.dev/api/pricing/quote \
  -H "Content-Type: application/json" \
  -d '{
    "units": [
      {
        "unit_id": "unit-1",
        "check_in": "2025-12-20",
        "check_out": "2025-12-25"
      },
      {
        "unit_id": "unit-2",
        "check_in": "2025-12-20",
        "check_out": "2025-12-25"
      }
    ]
  }'
```

---

## Payment Endpoints (Manual Tracking)

### Important Note on Payment Semantics

**These endpoints record MANUAL payment transactions only**. They do NOT process payments through a payment gateway (no Stripe, PayPal, etc.). They are used for:

- Recording GCash payments (with screenshot proof)
- Recording bank transfer payments
- Recording cash payments
- Tracking refunds and adjustments

### 1. Record Manual Payment

**Endpoint**: `POST /api/payments/record`

**Purpose**: Record a manual payment transaction (GCash, bank transfer, cash)

**Authentication**: Required (staff only)

**Request Body**:

```typescript
{
  booking_id: string,
  amount: number,
  method: "GCash" | "Bank Transfer" | "Cash",
  payment_date: string,  // ISO 8601 date
  proof_url?: string,  // Required for GCash/Bank Transfer
  reference_number?: string,  // Transaction reference
  notes?: string
}
```

**Response (200 OK)**:

```typescript
{
  payment_id: string,
  booking_id: string,
  booking_reference: string,
  amount: number,
  method: string,
  payment_status: "PartiallyPaid" | "FullyPaid",  // Updated status
  remaining_balance: number
}
```

**Business Rules**:

- `amount` must be > 0
- `payment_date` cannot be in the future
- `proof_url` required for GCash and Bank Transfer
- Update `bookings.payment_status` based on total paid vs `total_amount`

---

### 2. Record Refund

**Endpoint**: `POST /api/payments/refund`

**Purpose**: Record a refund transaction (manual payment returned)

**Authentication**: Required (staff only)

**Request Body**:

```typescript
{
  booking_id: string,
  amount: number,
  reason: string,
  refund_method: "GCash" | "Bank Transfer" | "Cash",
  refund_date: string,  // ISO 8601 date
  notes?: string
}
```

**Response (200 OK)**:

```typescript
{
  refund_id: string,
  booking_id: string,
  booking_reference: string,
  amount: number,
  payment_status: "PartiallyRefunded" | "Refunded",
  remaining_balance: number  // Negative if overpaid
}
```

---

### 3. Adjust Payment Balance

**Endpoint**: `POST /api/payments/adjust`

**Purpose**: Make manual balance adjustments (discounts, corrections)

**Authentication**: Required (manager/owner only)

**Request Body**:

```typescript
{
  booking_id: string,
  adjustment_amount: number,  // Can be negative (discount) or positive (extra charge)
  reason: string,  // Required for audit trail
  notes?: string
}
```

**Response (200 OK)**:

```typescript
{
  adjustment_id: string,
  booking_id: string,
  booking_reference: string,
  adjustment_amount: number,
  new_total_amount: number,
  payment_status: string
}
```

---

## Error Codes

### Standard Error Response Format

```typescript
{
  error: string,  // Error code (machine-readable)
  message: string,  // Human-readable message
  code: number,  // HTTP status code
  details?: object  // Additional error context
}
```

### Multi-Unit Booking Error Codes

| Error Code                | HTTP Status | Description                                                        | Resolution                                  |
| ------------------------- | ----------- | ------------------------------------------------------------------ | ------------------------------------------- |
| `UNIT_BECAME_UNAVAILABLE` | 409         | Unit was available during selection but got booked by someone else | Refresh availability, select different unit |
| `INVALID_DATE_RANGE`      | 400         | `check_out` must be after `check_in`                               | Fix date range                              |
| `UNIT_NOT_FOUND`          | 404         | Specified `unit_id` doesn't exist                                  | Check unit ID                               |
| `BOOKING_NOT_FOUND`       | 404         | Specified `booking_id` doesn't exist                               | Check booking ID                            |
| `CANNOT_MODIFY_BOOKING`   | 409         | Booking status prevents modification                               | Only `Pending`/`Confirmed` can be modified  |
| `LAST_UNIT_REMOVAL`       | 400         | Cannot remove last unit from booking                               | Cancel booking instead                      |
| `TOTAL_MISMATCH`          | 400         | Sum of unit subtotals != total_amount                              | Recalculate totals                          |
| `RATE_LIMIT_EXCEEDED`     | 429         | Too many requests from this IP                                     | Wait and retry after `Retry-After` header   |
| `INVALID_TURNSTILE`       | 400         | Turnstile token verification failed                                | Refresh page, get new token                 |
| `PAYMENT_PROOF_REQUIRED`  | 400         | `proof_url` required for GCash/Bank Transfer                       | Upload payment screenshot                   |
| `INSUFFICIENT_PAYMENT`    | 400         | Payment amount exceeds remaining balance                           | Check balance                               |

### Example Error Response

```json
{
  "error": "UNIT_BECAME_UNAVAILABLE",
  "message": "Unit 'Ocean View Suite' was just booked by another guest",
  "code": 409,
  "details": {
    "unit_id": "unit-1",
    "unit_name": "Ocean View Suite",
    "conflicting_booking": "BK-20251008-0123",
    "suggested_alternatives": ["unit-3", "unit-5"]
  }
}
```

---

## Request/Response Patterns

### Idempotency

**Purpose**: Prevent duplicate bookings from network retries

**Implementation**: Use `X-Idempotency-Key` header or `idempotency_key` in body

```bash
curl -X POST https://okaeri-resort.pages.dev/api/bookings/multi-unit \
  -H "X-Idempotency-Key: client-generated-uuid-here" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**Behavior**:

- If key seen before: Return cached response (200 OK with same booking)
- If key new: Process request normally (201 Created)
- Keys expire after 24 hours in Cloudflare KV

---

### Rate Limiting

**Limits** (per IP address):

- `/api/bookings/*`: 10 requests per hour
- `/api/availability/*`: 100 requests per hour
- `/api/pricing/*`: 100 requests per hour

**Headers**:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1696790400  (Unix timestamp)
```

**Response when exceeded**:

```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests. Please try again later.",
  "code": 429,
  "details": {
    "limit": 10,
    "window": "1 hour",
    "retry_after": 3600 // seconds
  }
}
```

---

### CORS Headers

**Allowed Origins** (production):

```
Access-Control-Allow-Origin: https://okaeri-resort.pages.dev
```

**Allowed Origins** (development):

```
Access-Control-Allow-Origin: *
```

**Allowed Methods**:

```
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
```

**Allowed Headers**:

```
Access-Control-Allow-Headers: Content-Type, Authorization, X-Idempotency-Key
```

---

### Security Headers

**All API responses include**:

```
Content-Security-Policy: default-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

---

### Pagination (Future Enhancement)

**Not implemented in MVP**, but pattern for future:

```
GET /api/bookings?page=2&limit=20&sort=-created_at

Response:
{
  data: [ ... ],
  pagination: {
    page: 2,
    limit: 20,
    total: 156,
    pages: 8
  }
}
```

---

## Testing Examples

### Complete Flow Test

```bash
# 1. Check availability
curl "https://okaeri-resort.pages.dev/api/availability/multi-unit?units[]=unit-1&units[]=unit-2&check_in=2025-12-20&check_out=2025-12-25"

# 2. Get pricing quote
curl -X POST https://okaeri-resort.pages.dev/api/pricing/quote \
  -H "Content-Type: application/json" \
  -d '{"units": [{"unit_id": "unit-1", "check_in": "2025-12-20", "check_out": "2025-12-25"}]}'

# 3. Create booking
curl -X POST https://okaeri-resort.pages.dev/api/bookings/multi-unit \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $(uuidgen)" \
  -d '{ ... }'

# 4. Record payment (staff authenticated)
curl -X POST https://okaeri-resort.pages.dev/api/payments/record \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -d '{"booking_id": "xxx", "amount": 25000, "method": "GCash", "payment_date": "2025-10-08", "proof_url": "https://..."}'
```

---

## References

- [REST API Best Practices](https://restfulapi.net/)
- [HTTP Status Codes](https://httpstatuses.com/)
- [Idempotency Keys](https://stripe.com/docs/api/idempotent_requests)
- [CORS Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

---

**Next Steps**: See [Emergency Runbook](./EMERGENCY-RUNBOOK.md) for operational procedures.
