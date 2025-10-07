# Phase 2: Backend API

**Phase Duration:** October 14-20, 2025 (Week 2 - 7 days, +2 days for payment unification)
**Lead Agent:** `cloudflare-resort-api-architect`
**Status:** Not Started
**Dependencies:** Phase 1 (Database Foundation) must be complete
**Schema Reference:** See `SCHEMA-REFERENCE.md` for canonical column names

---

## Gap Resolutions Applied

This phase incorporates:

- **Gap #7:** Centralized pricing endpoint (`/api/pricing/quote`) as single source of truth
- **Gap #5:** Unified payment endpoints (capture, refund, adjust) with payment_adjustments tracking
- **Gap #8:** Auth middleware for all mutating endpoints (Cloudflare Workers, free-tier compatible)
- **Gap #6:** No feature flags (direct deployment)

---

## Phase Overview

### Objectives

Design and implement REST API endpoints and serverless functions to support multi-unit booking operations, including creation, modification, availability checking, unified payment processing, and centralized pricing calculation.

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

- `functions/api/pricing/quote.ts` (NEW: Single source of truth for pricing)
- `functions/api/bookings/multi-unit.ts`
- `functions/api/bookings/[id]/units/[unitId].ts` (add/remove units)
- `functions/api/bookings/[id]/payments/capture.ts` (NEW: Unified payment)
- `functions/api/bookings/[id]/payments/refund.ts` (NEW: Refund handling)
- `functions/api/availability/multi-unit.ts`
- `functions/_middleware.ts` (NEW: Auth enforcement)
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

## Auth Middleware (Gap Resolution #8)

**Purpose:** Centralized authentication enforcement for all mutating endpoints

**File:** `functions/_middleware.ts`

```typescript
import type { Request as CloudflareRequest } from "@cloudflare/workers-types";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_JWT_SECRET: string;
}

export async function onRequest(context: {
  request: CloudflareRequest;
  env: Env;
  next: () => Promise<Response>;
}) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // Public endpoints (no auth required)
  const publicPaths = [
    "/api/availability/check",
    "/api/availability/multi-unit",
    "/api/units",
    "/api/pricing/quote",
  ];

  if (publicPaths.some((path) => url.pathname.startsWith(path))) {
    return next();
  }

  // Extract JWT from Authorization header
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = authHeader.substring(7);

  // Verify Supabase JWT (free-tier compatible, CPU-bound only)
  const user = await verifySupabaseJWT(token, env.SUPABASE_JWT_SECRET);

  if (!user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Attach user to request context
  (request as any).user = user;

  return next();
}

async function verifySupabaseJWT(token: string, secret: string) {
  // Implementation using jose or similar lightweight JWT library
  // Free-tier compatible: <1ms CPU time, no external API calls
  try {
    const decoded = await jose.jwtVerify(token, new TextEncoder().encode(secret));
    return decoded.payload;
  } catch (error) {
    console.error("JWT verification failed:", error);
    return null;
  }
}
```

**Free-Tier Validation:**

- ✅ No external API calls (JWT verification is CPU-bound)
- ✅ Execution time: <1ms per request
- ✅ Works within Cloudflare Workers 100,000 req/day limit
- ✅ No additional costs incurred

---

## API Endpoints Specification

### 0. Centralized Pricing Quote (NEW - Gap Resolution #7)

**Endpoint:** `POST /api/pricing/quote`

**Purpose:** Single source of truth for pricing calculation (used by client for estimates and server for final totals)

**Authentication:** None (public endpoint)

**Request Body:**

```typescript
interface PricingQuoteRequest {
  units: Array<{
    unit_id: string;
    guests: number;
  }>;
  check_in: string; // ISO 8601 UTC timestamp
  check_out: string; // ISO 8601 UTC timestamp
}
```

**Response:**

```typescript
interface PricingQuoteResponse {
  total_amount: number;
  nights: number;
  units: Array<{
    unit_id: string;
    base_amount: number; // Sum of nightly rates
    weekend_surcharge: number; // Weekend premium
    extra_person_charge: number; // Charge for guests > base_occupancy
    subtotal: number; // base + weekend + extra_person
  }>;
}
```

**Implementation:**

```typescript
// functions/api/pricing/quote.ts
import type { Request as CloudflareRequest } from "@cloudflare/workers-types";
import { createClient } from "@supabase/supabase-js";

export async function onRequestPost(context: { request: CloudflareRequest; env: Env }) {
  const { request, env } = context;
  const data: PricingQuoteRequest = await request.json();

  // SINGLE SOURCE OF TRUTH: All pricing logic centralized here
  const pricing = await calculateMultiUnitPricing(data, env);

  return new Response(JSON.stringify(pricing), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300", // Cache for 5 minutes
    },
  });
}

async function calculateMultiUnitPricing(
  data: PricingQuoteRequest,
  env: Env
): Promise<PricingQuoteResponse> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  const checkIn = new Date(data.check_in);
  const checkOut = new Date(data.check_out);
  const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

  let totalAmount = 0;
  const unitBreakdowns = [];

  for (const unit of data.units) {
    // Fetch unit pricing data
    const { data: unitData } = await supabase
      .from("units")
      .select("base_rate, weekend_rate, extra_person_rate, base_occupancy")
      .eq("unit_id", unit.unit_id)
      .single();

    if (!unitData) {
      throw new Error(`Unit ${unit.unit_id} not found`);
    }

    let baseAmount = 0;
    let weekendSurcharge = 0;

    // Calculate nightly rates (weekend detection)
    for (let i = 0; i < nights; i++) {
      const currentDate = new Date(checkIn);
      currentDate.setDate(currentDate.getDate() + i);
      const dayOfWeek = currentDate.getDay();

      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Friday or Saturday
      const nightRate = isWeekend ? unitData.weekend_rate : unitData.base_rate;

      if (isWeekend) {
        weekendSurcharge += unitData.weekend_rate - unitData.base_rate;
      }

      baseAmount += nightRate;
    }

    // Extra person charges
    const extraPersons = Math.max(0, unit.guests - unitData.base_occupancy);
    const extraPersonCharge = extraPersons * unitData.extra_person_rate * nights;

    const subtotal = baseAmount + extraPersonCharge;

    unitBreakdowns.push({
      unit_id: unit.unit_id,
      base_amount: baseAmount,
      weekend_surcharge: weekendSurcharge,
      extra_person_charge: extraPersonCharge,
      subtotal,
    });

    totalAmount += subtotal;
  }

  return {
    total_amount: totalAmount,
    nights,
    units: unitBreakdowns,
  };
}
```

**Usage Pattern:**

```typescript
// Client: Get pricing estimate
const pricing = await fetch("/api/pricing/quote", {
  method: "POST",
  body: JSON.stringify({
    units: [
      { unit_id: "unit-1", guests: 2 },
      { unit_id: "unit-2", guests: 4 },
    ],
    check_in: "2025-03-15T06:00:00Z",
    check_out: "2025-03-18T04:00:00Z",
  }),
}).then((r) => r.json());

// Server: Use same function for booking creation
const finalPricing = await calculateMultiUnitPricing(bookingData, env);
await createBookingWithPricing(bookingData, finalPricing);
```

---

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

### 6. Capture Unified Payment (NEW - Gap Resolution #5)

**Endpoint:** `POST /api/bookings/:booking_id/payments/capture`

**Purpose:** Capture payment for all units in a multi-unit booking

**Authentication:** Required (staff only)

**Request Body:**

```typescript
interface CapturePaymentRequest {
  amount: number;
  payment_method: string; // 'GCash', 'BankTransfer', 'Cash', 'CreditCard'
  payment_reference?: string;
  proof_url?: string;
  notes?: string;
}
```

**Response:**

```typescript
{
  success: true;
  data: {
    payment_id: string;
    booking_id: string;
    amount: number;
    payment_method: string;
    payment_date: string;
    status: "completed";
  }
}
```

**Implementation:**

```typescript
// functions/api/bookings/[id]/payments/capture.ts
export async function onRequestPost(context: {
  request: CloudflareRequest;
  env: Env;
  params: { id: string };
}) {
  const { request, env, params } = context;
  const bookingId = params.id;
  const data: CapturePaymentRequest = await request.json();

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  // Verify booking exists and get total
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("booking_id, total_amount, payment_status")
    .eq("booking_id", bookingId)
    .single();

  if (bookingError || !booking) {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "BOOKING_NOT_FOUND", message: "Booking not found" },
      }),
      { status: 404 }
    );
  }

  // Validate payment amount
  if (data.amount !== booking.total_amount) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "AMOUNT_MISMATCH",
          message: `Payment amount ${data.amount} does not match booking total ${booking.total_amount}`,
        },
      }),
      { status: 400 }
    );
  }

  // Create payment record
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      booking_id: bookingId,
      amount: data.amount,
      payment_method: data.payment_method,
      payment_date: new Date().toISOString(),
      proof_url: data.proof_url,
      notes: data.notes,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (paymentError) {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "PAYMENT_FAILED", message: paymentError.message },
      }),
      { status: 500 }
    );
  }

  // Update booking payment status
  await supabase.from("bookings").update({ payment_status: "Paid" }).eq("booking_id", bookingId);

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        payment_id: payment.payment_id,
        booking_id: bookingId,
        amount: payment.amount,
        payment_method: payment.payment_method,
        payment_date: payment.payment_date,
        status: "completed",
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
```

---

### 7. Refund Payment (NEW - Gap Resolution #5)

**Endpoint:** `POST /api/bookings/:booking_id/payments/refund`

**Purpose:** Process full or partial refund for a booking

**Authentication:** Required (manager only)

**Request Body:**

```typescript
interface RefundPaymentRequest {
  amount: number;
  reason: string; // 'unit_removed', 'cancellation', 'price_adjustment', 'other'
  notes?: string;
}
```

**Response:**

```typescript
{
  success: true;
  data: {
    adjustment_id: string;
    payment_id: string;
    amount_refunded: number;
    total_refunded: number; // Cumulative refunds
    reason: string;
  }
}
```

**Implementation:**

```typescript
// functions/api/bookings/[id]/payments/refund.ts
export async function onRequestPost(context: {
  request: CloudflareRequest;
  env: Env;
  params: { id: string };
}) {
  const { request, env, params } = context;
  const bookingId = params.id;
  const data: RefundPaymentRequest = await request.json();

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  // Get most recent payment
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (paymentError || !payment) {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "PAYMENT_NOT_FOUND", message: "No payment found for this booking" },
      }),
      { status: 404 }
    );
  }

  // Validate refund amount
  const totalRefunded = payment.refunded_amount + data.amount;
  if (totalRefunded > payment.amount) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "REFUND_EXCEEDS_PAYMENT",
          message: `Cannot refund ${data.amount}. Total refund would be ${totalRefunded}, exceeding payment of ${payment.amount}`,
        },
      }),
      { status: 400 }
    );
  }

  // Update payment refunded_amount
  const { error: updateError } = await supabase
    .from("payments")
    .update({ refunded_amount: totalRefunded })
    .eq("payment_id", payment.payment_id);

  if (updateError) {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "REFUND_FAILED", message: updateError.message },
      }),
      { status: 500 }
    );
  }

  // Create adjustment record
  const { data: adjustment, error: adjustmentError } = await supabase
    .from("payment_adjustments")
    .insert({
      payment_id: payment.payment_id,
      reason: data.reason,
      amount_change: -data.amount, // Negative for refund
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (adjustmentError) {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "ADJUSTMENT_FAILED", message: adjustmentError.message },
      }),
      { status: 500 }
    );
  }

  // Update booking payment status if fully refunded
  if (totalRefunded === payment.amount) {
    await supabase
      .from("bookings")
      .update({ payment_status: "Refunded" })
      .eq("booking_id", bookingId);
  } else if (totalRefunded > 0) {
    await supabase
      .from("bookings")
      .update({ payment_status: "Partial" })
      .eq("booking_id", bookingId);
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        adjustment_id: adjustment.adjustment_id,
        payment_id: payment.payment_id,
        amount_refunded: data.amount,
        total_refunded: totalRefunded,
        reason: data.reason,
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
```

---

### 8. Adjust Payment (Automatic - Gap Resolution #5)

**Purpose:** Automatically triggered when units are added/removed post-payment

**Trigger Scenarios:**

1. **Unit Added:** Calculate price delta, create adjustment record, update booking total
2. **Unit Removed:** Calculate refund amount, create adjustment record, process refund

**Implementation (called internally by add-unit/remove-unit endpoints):**

```typescript
async function adjustPaymentForUnitChange(
  supabase: SupabaseClient,
  bookingId: string,
  deltaAmount: number, // Positive for add, negative for remove
  reason: string
) {
  // Get existing payment
  const { data: payment } = await supabase
    .from("payments")
    .select("*")
    .eq("booking_id", bookingId)
    .single();

  if (!payment) {
    // No payment yet, just update booking total
    await supabase
      .from("bookings")
      .update({
        total_amount: db.raw("total_amount + ?", [deltaAmount]),
      })
      .eq("booking_id", bookingId);
    return;
  }

  if (deltaAmount > 0) {
    // Unit added - additional payment needed
    await supabase.from("payment_adjustments").insert({
      payment_id: payment.payment_id,
      reason: "unit_added",
      amount_change: deltaAmount,
    });

    await supabase
      .from("bookings")
      .update({ payment_status: "Partial" })
      .eq("booking_id", bookingId);
  } else {
    // Unit removed - refund needed
    await supabase.from("payment_adjustments").insert({
      payment_id: payment.payment_id,
      reason: "unit_removed",
      amount_change: deltaAmount, // Negative value
    });

    const refundAmount = Math.abs(deltaAmount);
    await supabase
      .from("payments")
      .update({
        refunded_amount: db.raw("refunded_amount + ?", [refundAmount]),
      })
      .eq("payment_id", payment.payment_id);
  }
}
```

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
