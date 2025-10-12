# API Specification

## Overview

This document specifies all API endpoints for the two-phase booking system, including request/response formats, authentication requirements, error codes, and rate limiting policies.

## Base Configuration

### API Base URLs

```
Production: https://api.okaeri-resort.com
Staging: https://staging-api.okaeri-resort.com
Development: http://localhost:8788/api
```

### Authentication

```http
Authorization: Bearer {jwt_token}
```

- Public endpoints: No authentication required (uses Turnstile)
- Protected endpoints: JWT token required
- Admin endpoints: JWT token with admin role required

### Common Headers

```http
Content-Type: application/json
Accept: application/json
X-Request-ID: {uuid}
X-Idempotency-Key: {unique-key}
X-API-Version: 2.0
```

### Rate Limiting

| Endpoint Type | Limit         | Window | Headers                                                           |
| ------------- | ------------- | ------ | ----------------------------------------------------------------- |
| Public        | 5 requests    | 1 hour | `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` |
| Authenticated | 100 requests  | 1 hour | Same as above                                                     |
| Admin         | 1000 requests | 1 hour | Same as above                                                     |

## Public Endpoints (Guest)

### 1. Create Booking Request

Creates a new booking request without unit assignment.

```http
POST /api/guest-booking-v2
```

#### Request Body

```json
{
  "turnstile_token": "cf-turnstile-response-token",
  "guest_info": {
    "name": "John Doe",
    "email": "john.doe@example.com",
    "phone": "+639123456789"
  },
  "booking_details": {
    "check_in": "2024-12-20T14:00:00Z",
    "check_out": "2024-12-22T11:00:00Z",
    "requested_units": 2,
    "guests_per_unit": [3, 3],
    "special_requests": "Adjoining units if possible"
  }
}
```

#### Validation Rules

```typescript
interface BookingRequestValidation {
  guest_info: {
    name: string; // 2-100 chars, sanitized
    email: string; // valid email format
    phone: string; // Philippine format: +63XXXXXXXXXX
  };
  booking_details: {
    check_in: DateTime; // must be future date
    check_out: DateTime; // must be after check_in
    requested_units: number; // 1-10
    guests_per_unit: number[]; // length must match requested_units
    special_requests?: string; // max 500 chars, sanitized
  };
}
```

#### Success Response (200 OK)

```json
{
  "booking": {
    "booking_id": "550e8400-e29b-41d4-a716-446655440000",
    "booking_reference": "BKG-2024-001",
    "status": "PendingAssignment",
    "created_at": "2024-12-06T10:30:00Z",
    "guest_info": {
      "guest_id": "guest-uuid",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "phone": "+639123456789"
    },
    "booking_details": {
      "check_in": "2024-12-20T14:00:00Z",
      "check_out": "2024-12-22T11:00:00Z",
      "requested_units": 2,
      "guests_per_unit": [3, 3],
      "total_guests": 6,
      "special_requests": "Adjoining units if possible"
    },
    "pricing": {
      "estimated_min": 10000,
      "estimated_max": 15000,
      "currency": "PHP",
      "note": "Final price depends on assigned units"
    },
    "assignment": {
      "status": "pending",
      "estimated_time": "2024-12-06T14:30:00Z",
      "assigned_units": []
    }
  },
  "meta": {
    "request_id": "req-uuid",
    "timestamp": "2024-12-06T10:30:00Z"
  }
}
```

#### Error Responses

```json
// 400 Bad Request - Validation Error
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "guest_info.email": "Invalid email format",
      "booking_details.check_in": "Check-in date must be in the future"
    }
  },
  "meta": {
    "request_id": "req-uuid"
  }
}

// 400 Bad Request - No Availability
{
  "error": {
    "code": "NO_AVAILABILITY",
    "message": "Not enough units available for requested dates",
    "details": {
      "requested": 3,
      "available": 2,
      "suggestion": "Try requesting fewer units or different dates"
    }
  }
}

// 429 Too Many Requests
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "retry_after": 3456
  },
  "headers": {
    "Retry-After": "3456",
    "X-RateLimit-Limit": "5",
    "X-RateLimit-Remaining": "0",
    "X-RateLimit-Reset": "1701860400"
  }
}
```

### 2. Check Booking Status

Retrieves current status of a booking request.

```http
GET /api/check-booking?reference={booking_reference}
```

#### Query Parameters

| Parameter | Type   | Required | Description                             |
| --------- | ------ | -------- | --------------------------------------- |
| reference | string | Yes      | Booking reference (e.g., BKG-2024-001)  |
| include   | string | No       | Comma-separated: units,payments,history |

#### Success Response (200 OK)

```json
{
  "booking": {
    "booking_reference": "BKG-2024-001",
    "status": "PendingPayment",
    "created_at": "2024-12-06T10:30:00Z",
    "updated_at": "2024-12-06T12:30:00Z",
    "guest_info": {
      "name": "John Doe",
      "email": "john.doe@example.com"
    },
    "booking_details": {
      "check_in": "2024-12-20T14:00:00Z",
      "check_out": "2024-12-22T11:00:00Z",
      "requested_units": 2,
      "total_guests": 6
    },
    "assignment": {
      "status": "completed",
      "assigned_at": "2024-12-06T12:30:00Z",
      "assigned_by": "Manager Name",
      "units": [
        {
          "unit_id": "unit-uuid-1",
          "unit_code": "A3",
          "unit_name": "Garden View Cottage",
          "guests": 3,
          "price_per_night": 2500,
          "subtotal": 5000
        },
        {
          "unit_id": "unit-uuid-2",
          "unit_code": "B2",
          "unit_name": "Poolside Villa",
          "guests": 3,
          "price_per_night": 3000,
          "subtotal": 6000
        }
      ]
    },
    "pricing": {
      "total_amount": 11000,
      "currency": "PHP",
      "breakdown": {
        "accommodation": 11000,
        "taxes": 0,
        "fees": 0
      }
    },
    "payment": {
      "status": "pending",
      "amount_due": 11000,
      "deadline": "2024-12-08T12:30:00Z",
      "instructions": {
        "bank_transfer": {
          "bank_name": "BDO",
          "account_name": "Okaeri Resort Inc.",
          "account_number": "0012345678"
        },
        "gcash": {
          "number": "+639123456789",
          "name": "Okaeri Resort"
        }
      }
    }
  }
}
```

### 3. Confirm Payment Upload

Confirms that payment proof has been uploaded.

```http
POST /api/guest-booking/confirm
```

#### Request Body

```json
{
  "booking_id": "550e8400-e29b-41d4-a716-446655440000",
  "payment_details": {
    "amount": 11000,
    "method": "bank_transfer",
    "reference_number": "REF123456",
    "proof_url": "https://storage.okaeri.com/payment-proofs/2024/12/booking-123.jpg"
  }
}
```

#### Success Response (200 OK)

```json
{
  "payment": {
    "payment_id": "payment-uuid",
    "status": "pending_verification",
    "submitted_at": "2024-12-06T15:00:00Z",
    "amount": 11000,
    "method": "bank_transfer",
    "reference": "REF123456"
  },
  "booking": {
    "booking_reference": "BKG-2024-001",
    "status": "PendingConfirmation",
    "message": "Payment proof received and awaiting verification"
  }
}
```

## Protected Endpoints (Manager)

### 4. Get Pending Assignments

Retrieves all bookings awaiting unit assignment.

```http
GET /api/bookings/pending-assignment
```

#### Headers

```http
Authorization: Bearer {jwt_token}
```

#### Query Parameters

| Parameter | Type    | Default    | Description                     |
| --------- | ------- | ---------- | ------------------------------- |
| limit     | number  | 20         | Items per page                  |
| offset    | number  | 0          | Pagination offset               |
| sort      | string  | created_at | Sort field                      |
| order     | string  | asc        | Sort order (asc/desc)           |
| urgent    | boolean | false      | Only show urgent (>2 hours old) |

#### Success Response (200 OK)

```json
{
  "bookings": [
    {
      "booking_id": "booking-uuid-1",
      "booking_reference": "BKG-2024-001",
      "priority": "urgent",
      "created_at": "2024-12-06T08:30:00Z",
      "time_waiting": "2h 30m",
      "guest": {
        "name": "John Doe",
        "email": "john.doe@example.com",
        "phone": "+639123456789",
        "previous_bookings": 3
      },
      "request": {
        "check_in": "2024-12-20T14:00:00Z",
        "check_out": "2024-12-22T11:00:00Z",
        "requested_units": 2,
        "guests_per_unit": [3, 3],
        "total_guests": 6,
        "special_requests": "Adjoining units if possible"
      },
      "availability": {
        "total_available": 5,
        "suitable_units": [
          {
            "unit_id": "unit-uuid-1",
            "code": "A3",
            "name": "Garden View",
            "capacity": 4,
            "price": 2500,
            "features": ["garden_view", "ground_floor"]
          }
        ]
      }
    }
  ],
  "pagination": {
    "total": 15,
    "limit": 20,
    "offset": 0,
    "has_more": false
  },
  "statistics": {
    "urgent": 3,
    "normal": 12,
    "average_wait_time": "1h 45m"
  }
}
```

### 5. Assign Units to Booking

Assigns specific units to a booking request.

```http
POST /api/bookings/{booking_id}/assign-units
```

#### Request Body

```json
{
  "assignments": [
    {
      "unit_id": "unit-uuid-1",
      "guest_count": 3,
      "notes": "Garden view as requested"
    },
    {
      "unit_id": "unit-uuid-2",
      "guest_count": 3,
      "notes": "Adjacent to first unit"
    }
  ],
  "manager_notes": "Assigned adjoining units as requested",
  "send_notification": true
}
```

#### Success Response (200 OK)

```json
{
  "assignment": {
    "assignment_id": "assign-uuid",
    "booking_id": "booking-uuid",
    "status": "completed",
    "assigned_at": "2024-12-06T11:00:00Z",
    "assigned_by": {
      "user_id": "user-uuid",
      "name": "Manager Name",
      "email": "manager@okaeri.com"
    },
    "units": [
      {
        "booking_unit_id": "bu-uuid-1",
        "unit_id": "unit-uuid-1",
        "unit_code": "A3",
        "unit_name": "Garden View Cottage",
        "guest_count": 3,
        "price_per_night": 2500,
        "subtotal": 5000
      },
      {
        "booking_unit_id": "bu-uuid-2",
        "unit_id": "unit-uuid-2",
        "unit_code": "B2",
        "unit_name": "Poolside Villa",
        "guest_count": 3,
        "price_per_night": 3000,
        "subtotal": 6000
      }
    ],
    "pricing": {
      "total_amount": 11000,
      "currency": "PHP"
    }
  },
  "notifications": {
    "email_sent": true,
    "sms_sent": false,
    "sent_at": "2024-12-06T11:00:15Z"
  }
}
```

#### Error Responses

```json
// 409 Conflict - Unit Already Assigned
{
  "error": {
    "code": "UNIT_CONFLICT",
    "message": "One or more units are no longer available",
    "details": {
      "conflicting_units": ["unit-uuid-1"],
      "available_alternatives": ["unit-uuid-3", "unit-uuid-4"]
    }
  }
}

// 422 Unprocessable Entity - Assignment Mismatch
{
  "error": {
    "code": "ASSIGNMENT_MISMATCH",
    "message": "Assignment does not match booking request",
    "details": {
      "requested_units": 2,
      "assigned_units": 3,
      "requested_guests": 6,
      "assigned_guests": 8
    }
  }
}
```

### 6. Reassign Units

Modifies existing unit assignments.

```http
PUT /api/bookings/{booking_id}/reassign-units
```

#### Request Body

```json
{
  "reason": "Guest requested different unit type",
  "remove_assignments": ["bu-uuid-1"],
  "add_assignments": [
    {
      "unit_id": "unit-uuid-3",
      "guest_count": 3,
      "notes": "Premium unit as requested"
    }
  ],
  "notify_guest": true
}
```

### 7. Get Available Units

Retrieves units available for specific dates.

```http
GET /api/units/available
```

#### Query Parameters

| Parameter    | Type   | Required | Description            |
| ------------ | ------ | -------- | ---------------------- |
| check_in     | date   | Yes      | Check-in date          |
| check_out    | date   | Yes      | Check-out date         |
| min_capacity | number | No       | Minimum guest capacity |
| unit_type    | string | No       | Filter by unit type    |

#### Success Response (200 OK)

```json
{
  "units": [
    {
      "unit_id": "unit-uuid-1",
      "code": "A1",
      "name": "Standard Room",
      "type": "standard",
      "capacity": {
        "min": 1,
        "max": 4,
        "optimal": 2
      },
      "pricing": {
        "per_night": 2000,
        "currency": "PHP"
      },
      "features": ["wifi", "aircon", "hot_shower"],
      "location": {
        "building": "A",
        "floor": "1",
        "view": "garden"
      },
      "availability": {
        "status": "available",
        "conflicts": []
      }
    }
  ],
  "summary": {
    "total_available": 8,
    "by_type": {
      "standard": 3,
      "deluxe": 3,
      "premium": 2
    }
  }
}
```

### 8. Get Assignment History

Retrieves audit trail of all assignments.

```http
GET /api/assignment-history
```

#### Query Parameters

| Parameter  | Type   | Default | Description       |
| ---------- | ------ | ------- | ----------------- |
| booking_id | uuid   | -       | Filter by booking |
| user_id    | uuid   | -       | Filter by manager |
| date_from  | date   | -       | Start date        |
| date_to    | date   | -       | End date          |
| limit      | number | 50      | Items per page    |

#### Success Response (200 OK)

```json
{
  "history": [
    {
      "history_id": "history-uuid",
      "action": "assigned",
      "booking_id": "booking-uuid",
      "booking_reference": "BKG-2024-001",
      "unit_id": "unit-uuid",
      "unit_code": "A3",
      "performed_by": {
        "user_id": "user-uuid",
        "name": "Manager Name"
      },
      "performed_at": "2024-12-06T11:00:00Z",
      "details": {
        "guest_count": 3,
        "price": 2500,
        "notes": "As requested by guest"
      }
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0
  }
}
```

## Admin Endpoints

### 9. Booking Metrics

Provides assignment performance metrics.

```http
GET /api/metrics/assignment-stats
```

#### Success Response (200 OK)

```json
{
  "metrics": {
    "period": {
      "start": "2024-12-01T00:00:00Z",
      "end": "2024-12-06T23:59:59Z"
    },
    "assignments": {
      "total": 127,
      "completed": 125,
      "pending": 2,
      "reassigned": 5
    },
    "performance": {
      "average_time_to_assign": "1h 23m",
      "fastest_assignment": "5m",
      "slowest_assignment": "4h 30m",
      "within_sla": {
        "count": 120,
        "percentage": 94.5
      }
    },
    "managers": [
      {
        "user_id": "user-uuid",
        "name": "Manager 1",
        "assignments": 45,
        "average_time": "1h 10m",
        "accuracy": 98.5
      }
    ],
    "guest_satisfaction": {
      "assignment_rating": 4.7,
      "total_reviews": 89
    }
  }
}
```

### 10. System Health Check

Monitors system status and dependencies.

```http
GET /api/health
```

#### Success Response (200 OK)

```json
{
  "status": "healthy",
  "timestamp": "2024-12-06T12:00:00Z",
  "version": "2.0.0",
  "services": {
    "database": {
      "status": "healthy",
      "latency": "12ms"
    },
    "email": {
      "status": "healthy",
      "queue": 3
    },
    "storage": {
      "status": "healthy",
      "usage": "45%"
    },
    "cache": {
      "status": "healthy",
      "hit_rate": "89%"
    }
  },
  "metrics": {
    "uptime": "99.95%",
    "requests_per_minute": 125,
    "average_response_time": "145ms"
  }
}
```

## Webhook Endpoints

### 11. Assignment Complete Webhook

Triggered when units are assigned to a booking.

```http
POST /webhooks/assignment-complete
```

#### Webhook Payload

```json
{
  "event": "booking.assignment.completed",
  "timestamp": "2024-12-06T11:00:00Z",
  "data": {
    "booking_id": "booking-uuid",
    "booking_reference": "BKG-2024-001",
    "guest_email": "john.doe@example.com",
    "assigned_units": ["A3", "B2"],
    "total_amount": 11000,
    "payment_deadline": "2024-12-08T11:00:00Z"
  },
  "signature": "hmac-sha256-signature"
}
```

### 12. Payment Verified Webhook

Triggered when payment is verified.

```http
POST /webhooks/payment-verified
```

#### Webhook Payload

```json
{
  "event": "payment.verified",
  "timestamp": "2024-12-06T16:00:00Z",
  "data": {
    "booking_id": "booking-uuid",
    "payment_id": "payment-uuid",
    "amount": 11000,
    "method": "bank_transfer",
    "verified_by": "auto",
    "booking_status": "Confirmed"
  },
  "signature": "hmac-sha256-signature"
}
```

## Error Code Reference

| Code                | HTTP Status | Description                      |
| ------------------- | ----------- | -------------------------------- |
| VALIDATION_ERROR    | 400         | Input validation failed          |
| INVALID_TURNSTILE   | 400         | Turnstile verification failed    |
| NO_AVAILABILITY     | 400         | Insufficient units available     |
| UNAUTHORIZED        | 401         | Authentication required          |
| FORBIDDEN           | 403         | Insufficient permissions         |
| NOT_FOUND           | 404         | Resource not found               |
| UNIT_CONFLICT       | 409         | Unit assignment conflict         |
| ASSIGNMENT_MISMATCH | 422         | Assignment doesn't match request |
| RATE_LIMIT_EXCEEDED | 429         | Too many requests                |
| INTERNAL_ERROR      | 500         | Server error                     |
| SERVICE_UNAVAILABLE | 503         | Service temporarily unavailable  |

## SDK Examples

### JavaScript/TypeScript

```typescript
import { OkaeriAPI } from "@okaeri/sdk";

const api = new OkaeriAPI({
  baseURL: "https://api.okaeri-resort.com",
  apiKey: process.env.OKAERI_API_KEY,
});

// Create booking request
const booking = await api.bookings.create({
  guestInfo: {
    name: "John Doe",
    email: "john@example.com",
    phone: "+639123456789",
  },
  bookingDetails: {
    checkIn: new Date("2024-12-20"),
    checkOut: new Date("2024-12-22"),
    requestedUnits: 2,
    guestsPerUnit: [3, 3],
  },
});

// Check status
const status = await api.bookings.getStatus(booking.bookingReference);

// Manager: Assign units
await api.manager.assignUnits(booking.id, {
  assignments: [
    { unitId: "unit-1", guestCount: 3 },
    { unitId: "unit-2", guestCount: 3 },
  ],
});
```

### Python

```python
from okaeri_sdk import OkaeriAPI

api = OkaeriAPI(
    base_url='https://api.okaeri-resort.com',
    api_key=os.getenv('OKAERI_API_KEY')
)

# Create booking
booking = api.bookings.create(
    guest_info={
        'name': 'John Doe',
        'email': 'john@example.com',
        'phone': '+639123456789'
    },
    booking_details={
        'check_in': '2024-12-20T14:00:00Z',
        'check_out': '2024-12-22T11:00:00Z',
        'requested_units': 2,
        'guests_per_unit': [3, 3]
    }
)

# Check status
status = api.bookings.get_status(booking['booking_reference'])
```

### cURL Examples

```bash
# Create booking request
curl -X POST https://api.okaeri-resort.com/api/guest-booking-v2 \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: unique-key-123" \
  -d '{
    "turnstile_token": "cf-token",
    "guest_info": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+639123456789"
    },
    "booking_details": {
      "check_in": "2024-12-20T14:00:00Z",
      "check_out": "2024-12-22T11:00:00Z",
      "requested_units": 2,
      "guests_per_unit": [3, 3]
    }
  }'

# Check booking status
curl -X GET "https://api.okaeri-resort.com/api/check-booking?reference=BKG-2024-001" \
  -H "Accept: application/json"

# Manager: Assign units (requires auth)
curl -X POST https://api.okaeri-resort.com/api/bookings/550e8400/assign-units \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "assignments": [
      {"unit_id": "unit-1", "guest_count": 3},
      {"unit_id": "unit-2", "guest_count": 3}
    ]
  }'
```

## Migration Notes

### Breaking Changes from v1

1. **Unit Selection Removed**: Guests no longer select specific units
2. **New Status Flow**: Added `PendingAssignment` status
3. **Assignment Endpoints**: New manager-only assignment endpoints
4. **Pricing Changes**: Now returns estimated ranges until assigned

### Deprecation Schedule

| Endpoint                | Deprecated | Removal Date | Replacement             |
| ----------------------- | ---------- | ------------ | ----------------------- |
| POST /api/guest-booking | 2024-12-01 | 2025-03-01   | /api/guest-booking-v2   |
| POST /api/bookings      | 2024-12-01 | 2025-03-01   | Manager assignment flow |

### Backwards Compatibility

To maintain compatibility during transition:

1. Old endpoints will auto-assign units if available
2. Warning headers indicate deprecated endpoints
3. Response includes migration guidance
4. 3-month transition period

## Performance Benchmarks

### Target Response Times

| Endpoint       | Target | P95   | P99    |
| -------------- | ------ | ----- | ------ |
| Create Booking | 500ms  | 800ms | 1200ms |
| Check Status   | 100ms  | 150ms | 300ms  |
| Assign Units   | 300ms  | 500ms | 800ms  |
| Get Available  | 200ms  | 350ms | 600ms  |

### Load Testing Results

```
Concurrent Users: 100
Request Rate: 50 req/s
Duration: 10 minutes

Results:
- Success Rate: 99.8%
- Average Response: 245ms
- Error Rate: 0.2%
- Throughput: 49.7 req/s
```
