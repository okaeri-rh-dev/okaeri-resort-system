# Phase 2: Backend API

**Phase Duration:** October 14-18, 2025 (Week 2 - 5 days)
**Lead Agent:** `cloudflare-resort-api-architect`
**Status:** Not Started
**Dependencies:** Phase 1 (Database Foundation) must be complete

---

## Phase Overview

### Objectives

Design and implement REST API endpoints and serverless functions to support multi-unit booking operations, including creation, modification, availability checking, and payment processing.

### Success Criteria

- [ ] All API endpoints implemented and functional
- [ ] API response times < 200ms for all endpoints
- [ ] Atomic transactions for multi-unit booking creation
- [ ] Batch availability checking works correctly
- [ ] 95% API test coverage achieved
- [ ] Backwards compatibility maintained for existing endpoints
- [ ] Comprehensive error handling implemented
- [ ] API documentation (OpenAPI spec) complete

### Key Deliverables

1. Multi-unit booking API endpoints
2. Availability checking endpoints
3. Unit management endpoints (add/remove)
4. Payment processing updates
5. API compatibility layer
6. API documentation (OpenAPI/Swagger)
7. Integration tests
8. Performance benchmarks

---

## Agent Assignments

### Lead: `cloudflare-resort-api-architect`

**Primary Responsibilities:**

- Design RESTful API endpoints for multi-unit operations
- Implement Cloudflare Workers for serverless functions
- Create batch operation logic
- Implement availability checking for multiple units
- Update payment processing for consolidated payments
- Create API compatibility layer for backwards compatibility

**Deliverables:**

- `functions/api/bookings/multi-unit.ts`
- `functions/api/bookings/add-unit.ts`
- `functions/api/bookings/remove-unit.ts`
- `functions/api/availability/multi-unit.ts`
- `functions/api/payments/multi-unit.ts`
- API documentation (OpenAPI spec)
- Integration test suite

### Supporting: `serverless-saas-architect`

**Responsibilities:**

- Architecture review for scalability
- Multi-tenancy patterns validation
- Connection pooling optimization
- Cost optimization recommendations

### Supporting: `postgres-serverless-architect`

**Responsibilities:**

- Query optimization review
- Database function integration
- Connection pool configuration

### Supporting: `security-compliance-auditor`

**Responsibilities:**

- API security review
- Input validation audit
- Authentication/authorization review

---

## API Endpoints Specification

### 1. Create Multi-Unit Booking

**Endpoint:** `POST /api/bookings/multi-unit`

**Purpose:** Create a new booking with multiple units in a single atomic transaction

**Request Body:**

```typescript
{
  // Primary guest information
  primary_guest: {
    guest_name: string;
    email: string;
    contact_number: string;
    guest_id?: string;  // Optional: existing guest
  };

  // Booking dates
  check_in: string;  // ISO 8601 date
  check_out: string; // ISO 8601 date

  // Units to book
  units: Array<{
    unit_id: string;
    num_guests: number;
    guest_assignment?: {
      guest_ids: string[];
      guest_names?: string[];
    };
    unit_notes?: string;
  }>;

  // Payment information
  payment: {
    method: 'Cash' | 'GCash' | 'BankTransfer' | 'CreditCard';
    amount: number;
    proof_url?: string;
  };

  // Optional metadata
  special_requests?: string;
  internal_notes?: string;
  source?: string;  // 'web' | 'mobile' | 'admin'
}
```

**Response (Success - 201 Created):**

```typescript
{
  success: true;
  data: {
    booking_id: string;
    booking_reference: string;
    units: Array<{
      unit_id: string;
      unit_name: string;
      unit_code: string;
      unit_price: number;
      subtotal: number;
    }>;
    total_amount: number;
    payment_status: string;
    booking_status: string;
    created_at: string;
  }
  metadata: {
    units_booked: number;
    processing_time_ms: number;
  }
}
```

**Response (Error - 400/409/500):**

```typescript
{
  success: false;
  error: {
    code: string;  // e.g., 'UNIT_UNAVAILABLE', 'INVALID_DATES'
    message: string;
    details?: {
      unavailable_units?: string[];
      validation_errors?: Array<{
        field: string;
        message: string;
      }>;
    };
  };
}
```

**Implementation:**

```typescript
// functions/api/bookings/multi-unit.ts
import type { Request as CloudflareRequest } from "@cloudflare/workers-types";
import { z } from "zod";
import { sanitizeInput, sanitizeHTML } from "@/lib/security/sanitize";
import { logAuditEvent } from "@/lib/audit-logger";

// Validation schema
const multiUnitBookingSchema = z
  .object({
    primary_guest: z.object({
      guest_name: z.string().min(2).max(100),
      email: z.string().email(),
      contact_number: z.string().regex(/^[+]?[0-9\s\-()]{10,20}$/),
      guest_id: z.string().uuid().optional(),
    }),
    check_in: z.string().datetime(),
    check_out: z.string().datetime(),
    units: z
      .array(
        z.object({
          unit_id: z.string().uuid(),
          num_guests: z.number().int().min(1).max(20),
          guest_assignment: z
            .object({
              guest_ids: z.array(z.string().uuid()),
              guest_names: z.array(z.string()).optional(),
            })
            .optional(),
          unit_notes: z.string().max(500).optional(),
        })
      )
      .min(1)
      .max(10), // Allow 1-10 units per booking
    payment: z.object({
      method: z.enum(["Cash", "GCash", "BankTransfer", "CreditCard"]),
      amount: z.number().positive(),
      proof_url: z.string().url().optional(),
    }),
    special_requests: z.string().max(1000).optional(),
    internal_notes: z.string().max(1000).optional(),
    source: z.enum(["web", "mobile", "admin"]).optional(),
  })
  .refine((data) => new Date(data.check_out) > new Date(data.check_in), {
    message: "Check-out must be after check-in",
    path: ["check_out"],
  });

export async function onRequest(context: { request: CloudflareRequest; env: Env }) {
  const { request, env } = context;
  const startTime = Date.now();

  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "METHOD_NOT_ALLOWED", message: "Only POST allowed" },
      }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Parse and validate request
    const rawData = await request.json();
    const validationResult = multiUnitBookingSchema.safeParse(rawData);

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request data",
            details: {
              validation_errors: validationResult.error.errors.map((err) => ({
                field: err.path.join("."),
                message: err.message,
              })),
            },
          },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = validationResult.data;

    // Sanitize inputs
    const sanitizedData = {
      ...data,
      primary_guest: {
        ...data.primary_guest,
        guest_name: sanitizeInput(data.primary_guest.guest_name),
        email: sanitizeInput(data.primary_guest.email),
        contact_number: sanitizeInput(data.primary_guest.contact_number),
      },
      special_requests: data.special_requests ? sanitizeHTML(data.special_requests) : undefined,
      internal_notes: data.internal_notes ? sanitizeHTML(data.internal_notes) : undefined,
    };

    // Check availability for all units
    const availabilityCheck = await checkMultiUnitAvailability(
      env,
      sanitizedData.units.map((u) => u.unit_id),
      sanitizedData.check_in,
      sanitizedData.check_out
    );

    const unavailableUnits = availabilityCheck.filter((u) => !u.is_available);
    if (unavailableUnits.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "UNIT_UNAVAILABLE",
            message: "One or more units are not available for the selected dates",
            details: {
              unavailable_units: unavailableUnits.map((u) => u.unit_id),
            },
          },
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create booking using database function
    const booking = await createMultiUnitBooking(env, sanitizedData);

    // Log audit event
    await logAuditEvent({
      action: "booking.multi_unit.created",
      entity_type: "booking",
      entity_id: booking.booking_id,
      changes: {
        before: null,
        after: booking,
      },
      metadata: {
        units_count: sanitizedData.units.length,
        total_amount: booking.total_amount,
        source: sanitizedData.source || "web",
        ip_address: request.headers.get("cf-connecting-ip"),
        user_agent: request.headers.get("user-agent"),
      },
    });

    const processingTime = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        data: booking,
        metadata: {
          units_booked: sanitizedData.units.length,
          processing_time_ms: processingTime,
        },
      }),
      {
        status: 201,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-Processing-Time": `${processingTime}ms`,
        },
      }
    );
  } catch (error) {
    console.error("Multi-unit booking creation failed:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to create booking",
          details: process.env.NODE_ENV === "development" ? { error: error.message } : undefined,
        },
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// Helper: Check availability for multiple units
async function checkMultiUnitAvailability(
  env: Env,
  unitIds: string[],
  checkIn: string,
  checkOut: string
): Promise<Array<{ unit_id: string; is_available: boolean }>> {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

  const { data, error } = await supabase.rpc("check_multi_unit_availability", {
    p_unit_ids: unitIds,
    p_check_in: checkIn,
    p_check_out: checkOut,
  });

  if (error) throw error;
  return data as Array<{ unit_id: string; is_available: boolean }>;
}

// Helper: Create multi-unit booking
async function createMultiUnitBooking(env: Env, data: any) {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

  // Generate booking reference
  const { data: refData } = await supabase.rpc("generate_booking_reference");
  const bookingReference = refData || `BK-${Date.now()}`;

  // Calculate pricing for each unit
  const unitsWithPricing = await Promise.all(
    data.units.map(async (unit: any) => {
      const { data: unitData } = await supabase
        .from("units")
        .select("*")
        .eq("unit_id", unit.unit_id)
        .single();

      if (!unitData) throw new Error(`Unit not found: ${unit.unit_id}`);

      const pricing = calculateUnitPricing(
        unitData,
        data.check_in,
        data.check_out,
        unit.num_guests
      );

      return {
        unit_id: unit.unit_id,
        unit_price: pricing.unit_price,
        weekend_surcharge: pricing.weekend_surcharge,
        extra_person_charge: pricing.extra_person_charge,
        subtotal: pricing.subtotal,
        assigned_guests: unit.num_guests,
        unit_notes: unit.unit_notes,
      };
    })
  );

  // Call database function to create booking
  const { data: booking, error } = await supabase.rpc("create_multi_unit_booking", {
    p_booking_data: {
      booking_reference: bookingReference,
      guest_name: data.primary_guest.guest_name,
      contact_number: data.primary_guest.contact_number,
      email: data.primary_guest.email,
      check_in: data.check_in,
      check_out: data.check_out,
      num_guests: data.units.reduce((sum: number, u: any) => sum + u.num_guests, 0),
      special_requests: data.special_requests,
      internal_notes: data.internal_notes,
      booking_status: "Pending",
      payment_status: "Pending",
    },
    p_units: unitsWithPricing,
  });

  if (error) throw error;

  // Fetch created booking with units
  const { data: createdBooking } = await supabase
    .from("bookings")
    .select(
      `
      *,
      booking_units (
        *,
        unit:units (*)
      )
    `
    )
    .eq("booking_id", booking)
    .single();

  return createdBooking;
}

// Helper: Calculate pricing for a unit
function calculateUnitPricing(unit: any, checkIn: string, checkOut: string, numGuests: number) {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const nights = Math.ceil(
    (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  let unitPrice = 0;
  let weekendSurcharge = 0;

  // Calculate per-night pricing
  for (let i = 0; i < nights; i++) {
    const currentDate = new Date(checkInDate);
    currentDate.setDate(currentDate.getDate() + i);
    const dayOfWeek = currentDate.getDay();
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Friday or Saturday

    if (isWeekend && unit.weekend_rate > unit.base_rate) {
      unitPrice += unit.weekend_rate;
      weekendSurcharge += unit.weekend_rate - unit.base_rate;
    } else {
      unitPrice += unit.base_rate;
    }
  }

  // Calculate extra person fee
  const extraPersons = Math.max(0, numGuests - unit.base_occupancy);
  const extraPersonCharge = extraPersons * unit.extra_person_rate * nights;

  return {
    unit_price: unitPrice,
    weekend_surcharge: weekendSurcharge,
    extra_person_charge: extraPersonCharge,
    subtotal: unitPrice + extraPersonCharge,
  };
}
```

---

### 2. Add Unit to Existing Booking

**Endpoint:** `POST /api/bookings/:booking_id/units`

**Purpose:** Add an additional unit to an existing booking

**Request:**

```typescript
{
  unit_id: string;
  num_guests: number;
  guest_assignment?: {
    guest_ids: string[];
  };
  unit_notes?: string;
  recalculate_discount?: boolean;  // Default: true
}
```

**Response (Success - 200 OK):**

```typescript
{
  success: true;
  data: {
    booking_unit_id: string;
    booking_id: string;
    unit_id: string;
    unit_price: number;
    subtotal: number;
    new_booking_total: number;
  }
}
```

**Implementation File:** `functions/api/bookings/add-unit.ts`

**Key Logic:**

1. Validate booking exists and is modifiable
2. Check unit availability for booking dates
3. Check unit not already in booking (UNIQUE constraint)
4. Calculate pricing for the unit
5. Insert into booking_units table
6. Trigger will auto-update booking totals
7. Update availability table
8. Log audit event

---

### 3. Remove Unit from Booking

**Endpoint:** `DELETE /api/bookings/:booking_id/units/:unit_id`

**Purpose:** Remove a unit from a multi-unit booking

**Response (Success - 200 OK):**

```typescript
{
  success: true;
  data: {
    booking_id: string;
    removed_unit_id: string;
    remaining_units: number;
    new_total_amount: number;
  }
}
```

**Business Rules:**

- Cannot remove the LAST unit from a booking (must have at least 1 unit)
- Booking must not be in 'CheckedIn' or 'CheckedOut' status
- Payment status considerations (refund logic if paid)

**Implementation File:** `functions/api/bookings/remove-unit.ts`

---

### 4. Check Multi-Unit Availability

**Endpoint:** `GET /api/availability/multi-unit`

**Purpose:** Check availability for multiple units in a single request

**Query Parameters:**

```
?unit_ids=uuid1,uuid2,uuid3
&check_in=2025-12-20
&check_out=2025-12-22
&exclude_booking_id=optional-uuid
```

**Response:**

```typescript
{
  success: true;
  data: {
    check_in: string;
    check_out: string;
    results: Array<{
      unit_id: string;
      unit_name: string;
      unit_code: string;
      is_available: boolean;
      conflicting_bookings: number;
      next_available_date?: string;
    }>;
    summary: {
      total_units_checked: number;
      available_units: number;
      unavailable_units: number;
    }
  }
}
```

**Implementation File:** `functions/api/availability/multi-unit.ts`

**Performance Requirement:** <100ms for checking up to 10 units

---

### 5. Get Booking with Units

**Endpoint:** `GET /api/bookings/:booking_id`

**Purpose:** Retrieve booking details including all associated units

**Response (Enhanced):**

```typescript
{
  success: true;
  data: {
    booking_id: string;
    booking_reference: string;
    is_multi_unit: boolean;
    unit_count: number;

    // Legacy single-unit field (for backwards compat)
    unit_id?: string;

    // Multi-unit details
    booking_units: Array<{
      booking_unit_id: string;
      unit: {
        unit_id: string;
        unit_name: string;
        unit_code: string;
        unit_type: string;
        max_occupancy: number;
      };
      unit_price: number;
      weekend_surcharge: number;
      extra_person_charge: number;
      subtotal: number;
      assigned_guests: number;
      unit_notes?: string;
    }>;

    // Pricing breakdown
    base_amount: number;
    total_surcharges: number;
    discount_amount: number;
    total_amount: number;

    // Booking details
    primary_guest: {
      guest_id?: string;
      guest_name: string;
      email: string;
      contact_number: string;
    };
    check_in: string;
    check_out: string;
    booking_status: string;
    payment_status: string;
    special_requests?: string;
    internal_notes?: string;
    created_at: string;
    updated_at: string;
  };
}
```

**Backwards Compatibility:**

- For single-unit bookings, `unit_id` field is populated
- `booking_units` array always present (1 item for single-unit)

---

## Compatibility Layer

### Adapter Pattern

**Purpose:** Maintain backwards compatibility with existing API consumers

**Implementation:**

```typescript
// functions/api/bookings/index.ts (existing endpoint)

// Wrap response to include both formats
function adaptBookingResponse(booking: any) {
  return {
    ...booking,
    // Legacy field for single-unit bookings
    unit_id: booking.is_multi_unit ? null : booking.booking_units[0]?.unit_id,

    // Always include booking_units array
    booking_units:
      booking.booking_units ||
      (booking.unit_id
        ? [
            {
              unit_id: booking.unit_id,
              unit_price: booking.total_amount,
              subtotal: booking.total_amount,
              assigned_guests: booking.num_guests,
            },
          ]
        : []),
  };
}
```

---

## Error Handling Strategy

### Error Codes

```typescript
enum APIErrorCode {
  // Validation Errors (400)
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_DATES = "INVALID_DATES",
  INVALID_UNIT_COUNT = "INVALID_UNIT_COUNT",
  INVALID_GUEST_COUNT = "INVALID_GUEST_COUNT",

  // Authorization Errors (401/403)
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",

  // Not Found Errors (404)
  BOOKING_NOT_FOUND = "BOOKING_NOT_FOUND",
  UNIT_NOT_FOUND = "UNIT_NOT_FOUND",

  // Conflict Errors (409)
  UNIT_UNAVAILABLE = "UNIT_UNAVAILABLE",
  UNIT_ALREADY_BOOKED = "UNIT_ALREADY_BOOKED",
  DUPLICATE_UNIT = "DUPLICATE_UNIT",
  CANNOT_REMOVE_LAST_UNIT = "CANNOT_REMOVE_LAST_UNIT",

  // Server Errors (500)
  INTERNAL_ERROR = "INTERNAL_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  PAYMENT_ERROR = "PAYMENT_ERROR",
}
```

### Error Response Format

```typescript
interface APIError {
  success: false;
  error: {
    code: APIErrorCode;
    message: string;
    details?: Record<string, any>;
    timestamp?: string;
    request_id?: string;
  };
}
```

---

## Security Implementation

### Input Validation

1. **Zod Schema Validation**: All inputs validated before processing
2. **Sanitization**: HTML/SQL injection prevention
3. **Rate Limiting**: Cloudflare rate limiting rules
4. **CORS**: Proper CORS headers configured

### Authentication & Authorization

```typescript
// Middleware for auth check
async function requireAuth(request: Request, env: Env) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("UNAUTHORIZED");
  }

  // Validate JWT token with Supabase
  const token = authHeader.replace("Bearer ", "");
  const { data: user, error } = await verifyToken(token, env);

  if (error || !user) {
    throw new Error("UNAUTHORIZED");
  }

  return user;
}

// Role-based access control
async function requireRole(user: any, requiredRoles: string[]) {
  const { data: roles } = await supabase
    .from("app_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("is_active", true);

  const hasRole = roles?.some((r) => requiredRoles.includes(r.role));
  if (!hasRole) {
    throw new Error("FORBIDDEN");
  }
}
```

---

## Testing Requirements

### Unit Tests

1. **Endpoint Tests**
   - [ ] Multi-unit creation with valid data → 201
   - [ ] Multi-unit creation with invalid data → 400
   - [ ] Unavailable units → 409
   - [ ] Add unit to booking → 200
   - [ ] Remove unit from booking → 200
   - [ ] Cannot remove last unit → 409

2. **Validation Tests**
   - [ ] Date range validation
   - [ ] Guest count validation
   - [ ] Unit count limits (1-10)
   - [ ] Pricing calculation accuracy

3. **Security Tests**
   - [ ] XSS prevention (input sanitization)
   - [ ] SQL injection prevention
   - [ ] Authorization checks
   - [ ] Rate limiting

### Integration Tests

1. **End-to-End Booking Flow**
   - Create multi-unit booking → Check availability → Add unit → Remove unit → Get booking

2. **Availability Checking**
   - Batch availability check for 10 units
   - Concurrent availability checks

3. **Error Scenarios**
   - Network failures
   - Database connection issues
   - Invalid tokens

### Performance Tests

```bash
# Load test with Artillery
artillery run load-test.yml

# Example load-test.yml
config:
  target: 'https://api.example.com'
  phases:
    - duration: 60
      arrivalRate: 10  # 10 requests per second
scenarios:
  - name: "Multi-unit booking creation"
    flow:
      - post:
          url: "/api/bookings/multi-unit"
          json:
            # ... test data
```

**Performance Targets:**

- Median response time: <150ms
- 95th percentile: <200ms
- 99th percentile: <300ms
- Error rate: <0.1%

---

## API Documentation

### OpenAPI Specification

**File:** `docs/api/multi-unit-bookings-openapi.yaml`

```yaml
openapi: 3.0.0
info:
  title: Okaeri Resort Multi-Unit Booking API
  version: 1.0.0
  description: API for managing multi-unit bookings

paths:
  /api/bookings/multi-unit:
    post:
      summary: Create multi-unit booking
      operationId: createMultiUnitBooking
      tags:
        - Bookings
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/MultiUnitBookingRequest"
      responses:
        "201":
          description: Booking created successfully
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/MultiUnitBookingResponse"
        "400":
          description: Validation error
        "409":
          description: Unit unavailable
        "500":
          description: Server error

components:
  schemas:
    MultiUnitBookingRequest:
      type: object
      required:
        - primary_guest
        - check_in
        - check_out
        - units
        - payment
      properties:
        # ... full schema
```

---

## Rollback Procedures

### API Rollback Strategy

1. **Feature Flag Disable**

   ```typescript
   // Disable multi-unit endpoints
   if (!env.FEATURE_MULTI_UNIT_ENABLED) {
     return new Response(JSON.stringify({ error: "Feature temporarily disabled" }), {
       status: 503,
     });
   }
   ```

2. **Cloudflare Workers Rollback**
   - Revert to previous version in Cloudflare dashboard
   - Estimated rollback time: <5 minutes

3. **API Version Fallback**
   - Keep v1 (single-unit) endpoints active
   - Route traffic back to v1

---

## Acceptance Criteria

### Phase Completion Checklist

- [ ] All endpoints implemented and tested
- [ ] API documentation (OpenAPI) complete
- [ ] Integration tests achieve 95% coverage
- [ ] Performance benchmarks met (<200ms)
- [ ] Error handling comprehensive
- [ ] Security audit passed
- [ ] Backwards compatibility verified
- [ ] Load testing completed successfully

### Sign-Off Requirements

- [ ] `cloudflare-resort-api-architect` - API implementation
- [ ] `serverless-saas-architect` - Architecture review
- [ ] `security-compliance-auditor` - Security approval
- [ ] `postgres-serverless-architect` - Database integration review

---

## Next Phase Dependencies

**Phase 3 (State Management) depends on:**

- [ ] Multi-unit booking API functional
- [ ] Availability API working
- [ ] Add/remove unit APIs ready
- [ ] Error codes documented

---

## References

- Cloudflare Workers Documentation: https://developers.cloudflare.com/workers/
- Zod Validation: https://zod.dev/
- OpenAPI Specification: https://swagger.io/specification/
- API Security Best Practices: https://owasp.org/www-project-api-security/
