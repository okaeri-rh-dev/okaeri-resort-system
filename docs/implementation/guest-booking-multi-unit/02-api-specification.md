# API Specification for Multi-Unit Guest Booking

## Overview

Complete API implementation for multi-unit guest booking system with server-side pricing calculations, flexible discounts, and security features.

**Key Principles:**

- Array-based unit requests (NO `quantity` field)
- Server-side pricing ONLY (PostgreSQL `calculate_booking_pricing()` function)
- Flexible discount conditions (duration, date_range, advance_booking)
- Idempotency via client-supplied UUIDs
- Rate limiting via checkKVRateLimit + Turnstile CAPTCHA
- NO email notifications (manual contact)

**Important**: No client-side pricing calculations. All pricing computed by PostgreSQL function.

## Type Definitions

### Request Types

```typescript
import { z } from "zod";

// Array-based model: each entry = 1 unit
export const unitRequestSchema = z.object({
  guests_per_unit: z
    .number()
    .int("Guest count must be a whole number")
    .min(1, "At least 1 guest per unit"),
  // Maximum validated dynamically from pricing_config.max_capacity_per_unit
  // IMPORTANT: All units have identical capacity equal to pricing_config.max_capacity_per_unit
  // NO quantity field
});

export type UnitRequest = z.infer<typeof unitRequestSchema>;

export const multiUnitBookingSchema = z
  .object({
    guest_name: z.string().min(2).max(100),
    email: z.string().email().toLowerCase(),
    phone_number: z.string().regex(/^\+?[0-9\s\-()]{10,20}$/),

    check_in: z
      .string()
      .datetime()
      .refine((date) => new Date(date) > new Date(), "Check-in must be in future"),
    check_out: z.string().datetime(),

    // Array: each entry = 1 unit
    unit_requests: z
      .array(unitRequestSchema)
      .min(1, "At least one unit required")
      .max(10, "Maximum 10 units per booking"),

    special_requests: z.string().max(1000).optional(),
    turnstile_token: z.string().min(1),
    terms_accepted: z.boolean().refine((val) => val === true),
    idempotency_key: z.string().uuid().optional(),
  })
  .refine((data) => new Date(data.check_out) > new Date(data.check_in), {
    message: "Check-out must be after check-in",
    path: ["check_out"],
  });

export type MultiUnitBookingRequest = z.infer<typeof multiUnitBookingSchema>;
```

### Response Types

```typescript
export interface MultiUnitBookingResponse {
  success: boolean;
  booking: {
    booking_id: string;
    booking_reference: string;
    total_amount: number;
    downpayment_amount: number; // Configurable via pricing_config.downpayment_percent (default: 50%)
    discount_applied?: {
      percent: number;
      amount: number;
      rule_name: string;
    };
  };
  unit_requests: Array<{ guests_per_unit: number }>;
  pricing_breakdown: {
    base_total: number;
    weekend_surcharge: number;
    extra_person_fees: number;
    subtotal: number;
    discount_amount: number;
    total: number;
    nights: number;
  };
  message: string;
  is_duplicate?: boolean;
}

export interface DiscountRule {
  id: string;
  name: string;
  conditions: Array<{
    type: "min_nights" | "date_range" | "advance_booking";
    operator: "gte" | "lte" | "between";
    value: any;
  }>;
  discount_type: "percentage" | "fixed" | "per_night";
  discount_value: number;
  priority: number;
  is_active: boolean;
}
```

## Main Booking Endpoint

### POST /api/guest-booking

```typescript
import type { Request as CloudflareRequest } from "@cloudflare/workers-types";

import { sanitizeInput } from "@/lib/security/sanitize";
import { supabase } from "@/lib/supabase-server";
import { multiUnitBookingSchema } from "@/types/guest-booking-multi-unit";

export async function onRequest(context: { request: CloudflareRequest; env: Env }) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGINS || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    // 1. Parse and validate
    const body = await request.json();
    const validation = multiUnitBookingSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Validation failed",
          details: validation.error.flatten(),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = validation.data;

    // 2. Verify Turnstile
    const turnstileResult = await verifyTurnstile(
      data.turnstile_token,
      env.TURNSTILE_SECRET_KEY,
      request.headers.get("CF-Connecting-IP") || "unknown"
    );

    if (!turnstileResult.success) {
      return new Response(
        JSON.stringify({ success: false, error: "Security verification failed" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Idempotency check
    const idempotencyKey = data.idempotency_key || crypto.randomUUID();
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const { data: existing } = await supabase
      .from("idempotency_keys")
      .select("booking_id, bookings(*)")
      .eq("key", idempotencyKey)
      .gte("created_at", fortyEightHoursAgo.toISOString())
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({
          success: true,
          booking: existing.bookings,
          message: "Booking already created (duplicate detected)",
          is_duplicate: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Fetch pricing configuration (cached for 1 hour)
    const config = await getPricingConfig(supabase);

    if (!config) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Configuration not found. Please contact support.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validation 1: Guest capacity per unit (physical limit)
    const maxCapacity = config.max_capacity_per_unit;

    for (const request of data.unit_requests) {
      if (request.guests_per_unit > maxCapacity) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Maximum ${maxCapacity} guests per unit`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Validation 2: Booking size vs system capacity
    const { count: systemUnitCount } = await supabase
      .from("units")
      .select("*", { count: "exact", head: true })
      .eq("unit_status", "Available");

    if (data.unit_requests.length > systemUnitCount) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Maximum ${systemUnitCount} units available in system`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Note: We do NOT validate availability (whether units are currently booked)
    // Admin handles availability during unit assignment

    // 5. Call PostgreSQL pricing function (AUTHORITATIVE)
    const totalUnits = data.unit_requests.length; // Array length = total requested units
    const unitRequestsJson = data.unit_requests.map((r) => ({
      guests_per_unit: r.guests_per_unit,
    }));

    const { data: pricingResult, error: pricingError } = await supabase.rpc(
      "calculate_booking_pricing",
      {
        p_unit_requests: unitRequestsJson,
        p_check_in: data.check_in,
        p_check_out: data.check_out,
      }
    );

    if (pricingError) throw pricingError;

    const pricing = pricingResult;

    // 6. Sanitize inputs
    const sanitizedData = {
      guest_name: sanitizeInput(data.guest_name),
      special_requests: data.special_requests ? sanitizeInput(data.special_requests) : undefined,
    };

    // 7. Use transactional function for atomic booking creation
    const bookingReference = generateBookingReference();
    const totalGuests = data.unit_requests.reduce((sum, r) => sum + r.guests_per_unit, 0);

    const { data: result, error } = await supabase.rpc("create_guest_booking", {
      p_guest_data: {
        guest_name: sanitizedData.guest_name,
        email: data.email,
        phone_number: data.phone_number,
      },
      p_booking_data: {
        booking_reference: bookingReference,
        check_in_date: data.check_in,
        check_out_date: data.check_out,
        num_guests: totalGuests,
        total_amount: pricing.total,
        discount_percent: pricing.discount?.percent,
        discount_amount: pricing.discount?.amount,
        downpayment_required: pricing.downpayment_required,
        pricing_snapshot: pricing,
        special_requests: sanitizedData.special_requests,
      },
      p_unit_requests: unitRequestsJson,
      p_idempotency_key: idempotencyKey,
    });

    if (error) throw error;

    // Check for duplicate
    if (result.is_duplicate) {
      return new Response(
        JSON.stringify({
          success: true,
          is_duplicate: true,
          booking: result.booking,
          message: "Booking already created (duplicate detected)",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 8. Response
    const booking = result.booking;
    const response: MultiUnitBookingResponse = {
      success: true,
      booking: {
        booking_id: booking.booking_id,
        booking_reference: booking.booking_reference,
        total_amount: pricing.total,
        downpayment_amount: pricing.downpayment_required,
        discount_applied: pricing.discount
          ? {
              percent: pricing.discount.percent,
              amount: pricing.discount.amount,
              rule_name: pricing.discount.rule_name,
            }
          : undefined,
      },
      unit_requests: data.unit_requests,
      pricing_breakdown: {
        base_total: pricing.base_total,
        weekend_surcharge: pricing.weekend_surcharge,
        extra_person_fees: pricing.extra_person_fees,
        subtotal: pricing.subtotal,
        discount_amount: pricing.discount?.amount || 0,
        total: pricing.total,
        nights: pricing.nights,
      },
      message: `Booking created. Downpayment: ₱${pricing.downpayment_required.toLocaleString()}. Admin will assign units within 24 hours.`,
      is_duplicate: false,
    };

    // NO EMAIL NOTIFICATIONS (manual contact by admin)

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Booking error:", error);
    return new Response(JSON.stringify({ success: false, error: "Booking creation failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function verifyTurnstile(
  token: string,
  secretKey: string,
  clientIp: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
        remoteip: clientIp,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error("[TURNSTILE] HTTP error:", response.status);
      return { success: false, error: "Turnstile verification service unavailable" };
    }

    const result = await response.json();

    if (!result || typeof result.success !== "boolean") {
      console.error("[TURNSTILE] Invalid response format:", result);
      return { success: false, error: "Invalid Turnstile response format" };
    }

    if (!result.success) {
      console.warn("[TURNSTILE] Verification failed:", result["error-codes"]);
      return {
        success: false,
        error: `Verification failed: ${result["error-codes"]?.join(", ") || "unknown"}`,
      };
    }

    return { success: true };
  } catch (error) {
    if (error.name === "AbortError") {
      console.error("[TURNSTILE] Timeout after 5 seconds");
      return { success: false, error: "Turnstile verification timeout" };
    }
    console.error("[TURNSTILE] Exception:", error);
    return { success: false, error: "Turnstile verification error" };
  }
}

/**
 * Generate unique booking reference
 * Format: BK-YYYYMM-XXXXXX
 * Example: BK-202503-A7B9C2
 * Where:
 *   BK- = Fixed prefix
 *   YYYYMM = Year and month (202503 = March 2025)
 *   XXXXXX = 6-character random alphanumeric (uppercase)
 */
function generateBookingReference(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `BK-${year}${month}-${random}`;
}

// Pricing configuration cache (1-hour expiry)
interface PricingConfig {
  max_capacity_per_unit: number;
  base_rate: number;
  weekend_rate: number;
  extra_person_rate: number;
  base_occupancy: number;
  downpayment_percent: number;
}

interface CachedConfig {
  data: PricingConfig;
  expires: number;
}

const configCache = new Map<string, CachedConfig>();

async function getPricingConfig(supabase: any): Promise<PricingConfig | null> {
  const cacheKey = "default";
  const cached = configCache.get(cacheKey);

  // Return cached if still valid
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  // Fetch fresh config
  const { data, error } = await supabase
    .from("pricing_config")
    .select("*")
    .eq("id", "default")
    .single();

  if (error || !data) {
    return null;
  }

  // Cache for 1 hour
  configCache.set(cacheKey, {
    data,
    expires: Date.now() + 60 * 60 * 1000,
  });

  return data;
}
```

---

## Supporting Endpoints

### GET /api/guest-booking/rates

```typescript
export async function onRequest(context: { request: CloudflareRequest; env: Env }) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=3600",
  };

  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    // Fetch from pricing_config (single source of truth)
    const { data, error } = await supabase
      .from("pricing_config")
      .select(
        "base_rate, weekend_rate, extra_person_rate, base_occupancy, max_capacity_per_unit, downpayment_percent, currency"
      )
      .eq("id", "default")
      .single();

    if (error) throw error;

    // Get total available units dynamically
    const { count: totalUnits } = await supabase
      .from("units")
      .select("*", { count: "exact", head: true })
      .eq("unit_status", "Available");

    return new Response(
      JSON.stringify({
        success: true,
        rates: {
          base_rate: data.base_rate,
          weekend_rate: data.weekend_rate,
          extra_person_rate: data.extra_person_rate,
          base_occupancy: data.base_occupancy,
          max_capacity_per_unit: data.max_capacity_per_unit,
          max_units_in_system: totalUnits,
          downpayment_percentage: data.downpayment_percent,
          currency: data.currency,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: "Failed to fetch configuration" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
```

### GET /api/guest-booking/discount-rules

**Purpose**: Fetch active discount rules for display to guests

**Admin Management**: Phase 1 uses direct database access. Phase 3 adds dedicated admin CRUD interface (see Admin Endpoints section below).

```typescript
export async function onRequest(context: { request: CloudflareRequest; env: Env }) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=1800",
  };

  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { data, error } = await supabase
      .from("discount_rules")
      .select("id, name, description, conditions, discount_type, discount_value, priority")
      .eq("is_active", true)
      .order("priority", { ascending: false });

    if (error) throw error;

    const durationDiscount = data?.find((rule) =>
      rule.conditions.some((c) => c.type === "min_nights")
    );

    return new Response(
      JSON.stringify({
        success: true,
        discount_rules: data || [],
        display_message: durationDiscount
          ? `Book ${durationDiscount.conditions.find((c) => c.type === "min_nights")?.value}+ nights and save ${durationDiscount.discount_value}%!`
          : null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: "Failed to fetch discount rules" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
```

### GET /api/guest-booking/status

```typescript
export async function onRequest(context: { request: CloudflareRequest }) {
  const { request } = context;
  const url = new URL(request.url);
  const bookingReference = url.searchParams.get("reference");
  const email = url.searchParams.get("email");

  const corsHeaders = { "Access-Control-Allow-Origin": "*" };

  if (!bookingReference || !email) {
    return new Response(JSON.stringify({ success: false, error: "Missing parameters" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { data: booking, error } = await supabase
      .from("bookings")
      .select("*, guest_booking_unit_requests(guests_per_unit)")
      .eq("booking_reference", bookingReference)
      .eq("email", email)
      .eq("is_guest_booking", true)
      .single();

    if (error || !booking) {
      return new Response(JSON.stringify({ success: false, error: "Booking not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        booking: {
          booking_reference: booking.booking_reference,
          status: booking.booking_status,
          payment_status: booking.payment_status,
          unit_assignment_status: booking.unit_assignment_status,
          check_in_date: booking.check_in_date,
          check_out_date: booking.check_out_date,
          total_amount: booking.total_amount,
          downpayment_required: booking.downpayment_required,
        },
        unit_requests: booking.guest_booking_unit_requests || [],
        created_at: booking.created_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: "Status check failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
```

### POST /api/guest-booking/preview-pricing

**Purpose**: Server-side pricing preview for UX. Calls PostgreSQL `calculate_booking_pricing()` function.

**Important**: This endpoint provides real-time pricing preview by calling the authoritative PostgreSQL function. It is NOT a separate pricing implementation.

```typescript
export async function onRequest(context: { request: CloudflareRequest; env: Env }) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache",
  };

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { unit_requests, check_in, check_out } = await request.json();

    // Validate input
    if (!unit_requests || !Array.isArray(unit_requests) || unit_requests.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Invalid unit_requests" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call PostgreSQL pricing function (AUTHORITATIVE)
    const { data: pricing, error } = await supabase.rpc("calculate_booking_pricing", {
      p_unit_requests: unit_requests,
      p_check_in: check_in,
      p_check_out: check_out,
    });

    if (error) throw error;

    return new Response(
      JSON.stringify({
        success: true,
        pricing: pricing,
        _note: "PREVIEW ONLY - Final pricing calculated at booking submission",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: "Pricing preview failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
```

### Performance Optimization (Optional Caching)

**Phase 1 Decision**: NO caching implemented. Direct PostgreSQL function calls only.

**Rationale**: Premature optimization. Expected load (<1000 previews/day) does not justify caching complexity.

**When to Add Caching**: Only if post-launch metrics indicate performance issues:

- Preview requests > 1000/day, OR
- Database CPU usage > 60%, OR
- p95 latency > 500ms

**Caching Strategy** (if needed):

```typescript
// Add to preview-pricing endpoint
const cacheKey = `pricing:${JSON.stringify({ dates, units })}`;
const cached = await kv.get(cacheKey);
if (cached) {
  return new Response(cached, {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "HIT" },
  });
}

// ... existing PostgreSQL call ...

// Cache for 1 hour
await kv.put(cacheKey, JSON.stringify(result), { expirationTtl: 3600 });
```

**Trade-offs**:

- ✅ Pros: Reduced database load, faster response times
- ❌ Cons: Cache invalidation complexity, stale pricing during config changes
- **Recommendation**: Start without caching, add only if metrics justify it

## File Upload (Payment Proof)

**Two-Tier File Upload Strategy:**

- **Client Optimization:** Frontend compresses images to ~2MB for faster uploads (Canvas API)
- **Server Security Boundary:** 5MB hard maximum enforced by server (files exceeding are REJECTED)
- **Allowed Formats:** JPEG, PNG, PDF only (validated by magic number and MIME type)

### POST /api/guest-booking/upload-url

**File Upload Policy:**

- **Client Optimization**: Frontend compresses images to ~2MB for faster uploads
- **Server Hard Limit**: 5MB maximum enforced by server (files exceeding are REJECTED)
- **Allowed Formats**: JPEG, PNG, PDF only (validated via magic number and MIME type)

```typescript
export async function onRequest(context: { request: CloudflareRequest; env: Env }) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { booking_reference, file_name, file_type, file_size } = await request.json();

    const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
    if (!allowedTypes.includes(file_type)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid file type" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const maxSize = 5 * 1024 * 1024;
    if (file_size > maxSize) {
      return new Response(
        JSON.stringify({ success: false, error: "File size exceeds 5MB limit" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const fileExtension = file_name.split(".").pop();
    const uniqueFileName = `${booking_reference}_${Date.now()}.${fileExtension}`;
    const filePath = `payment-proofs/${uniqueFileName}`;

    const { data: uploadUrl, error } = await supabase.storage
      .from("booking-files")
      .createSignedUploadUrl(filePath, { expiresIn: 300 });

    if (error) throw error;

    return new Response(
      JSON.stringify({
        success: true,
        upload_url: uploadUrl.signedUrl,
        file_path: filePath,
        expires_in: 300,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: "Upload URL generation failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
```

## Testing

### curl Examples

```bash
# Get rates
curl -X GET https://your-domain.com/api/guest-booking/rates

# Get discount rules
curl -X GET https://your-domain.com/api/guest-booking/discount-rules

# Preview pricing (server-side calculation)
curl -X POST https://your-domain.com/api/guest-booking/preview-pricing \
  -H "Content-Type: application/json" \
  -d '{
    "unit_requests": [
      { "guests_per_unit": 2 },
      { "guests_per_unit": 2 },
      { "guests_per_unit": 4 }
    ],
    "check_in": "2025-03-01T14:00:00Z",
    "check_out": "2025-03-08T11:00:00Z"
  }'

# Create booking (array-based: 3 units)
curl -X POST https://your-domain.com/api/guest-booking \
  -H "Content-Type: application/json" \
  -d '{
    "guest_name": "Test Guest",
    "email": "test@example.com",
    "phone_number": "+1234567890",
    "check_in": "2025-03-01T14:00:00Z",
    "check_out": "2025-03-08T11:00:00Z",
    "unit_requests": [
      { "guests_per_unit": 2 },
      { "guests_per_unit": 2 },
      { "guests_per_unit": 4 }
    ],
    "turnstile_token": "test-token",
    "terms_accepted": true
  }'

# Check status
curl -X GET "https://your-domain.com/api/guest-booking/status?reference=BK-202503-ABC123&email=test@example.com"
```

### Test Checklist

- [ ] Multi-unit booking (1, 3, 10 units)
- [ ] Duration discounts (7, 14, 28+ nights)
- [ ] Weekend surcharge calculation
- [ ] Extra person fees
- [ ] Pricing preview endpoint (server-side calculation)
- [ ] Idempotency (duplicate detection)
- [ ] Turnstile verification
- [ ] Rate limiting
- [ ] Validation errors with proper error codes
- [ ] PostgreSQL constraint error mapping
- [ ] File upload with signed URLs

## Deployment

### Environment Variables

```env
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-service-key
TURNSTILE_SECRET_KEY=your-turnstile-secret
ALLOWED_ORIGINS=https://your-domain.com

# Rate limiting configuration (see Rate Limiting Configuration table for endpoint-specific limits)
```

### Cloudflare KV

```bash
wrangler kv:namespace create RATE_LIMIT_KV
wrangler kv:namespace create IDEMPOTENCY_KV
```

## Rate Limiting & Security

### Rate Limiting Configuration

All public API endpoints implement rate limiting to prevent abuse. Limits are enforced per IP address using Cloudflare KV storage.

| Endpoint                             | Max Requests | Time Window    | Purpose              |
| ------------------------------------ | ------------ | -------------- | -------------------- |
| `/api/guest-booking/preview-pricing` | 20           | 1 hour (3600s) | Pricing calculations |
| `/api/guest-booking/rates`           | 30           | 1 hour (3600s) | Rate fetching        |
| `/api/guest-booking/discount-rules`  | 30           | 1 hour (3600s) | Discount browsing    |
| `/api/guest-booking`                 | 5            | 1 hour (3600s) | Booking submissions  |
| `/api/guest-booking/status`          | 10           | 1 hour (3600s) | Status checks        |
| `/api/guest-booking/upload-url`      | 10           | 1 hour (3600s) | File uploads         |
| `/api/admin/*`                       | 100          | 1 hour (3600s) | Admin operations     |

**Cloudflare KV Free Tier**: 1,000 writes/day (sufficient for rate limit tracking).

**Rate Limit Headers** (included in all responses):

```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 4
X-RateLimit-Reset: 1704067200
Retry-After: 3420
```

**Implementation Pattern:**

```typescript
import { checkKVRateLimit } from "./lib/rate-limit";

export async function onRequest(context: { request: CloudflareRequest; env: Env }) {
  const clientIP = context.request.headers.get("CF-Connecting-IP") || "unknown";

  // Use centralized configuration (see table above)
  const { allowed, remaining, resetTime } = await checkKVRateLimit(
    context.env.RATE_LIMIT_KV,
    clientIP,
    "guest-booking", // endpoint identifier
    5, // max requests
    3600 // window in seconds
  );

  if (!allowed) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Rate limit exceeded. Please try again later.",
        error_code: "RATE_LIMIT_EXCEEDED",
        retry_after: resetTime - Math.floor(Date.now() / 1000),
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": "5",
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": resetTime.toString(),
          "Retry-After": (resetTime - Math.floor(Date.now() / 1000)).toString(),
        },
      }
    );
  }

  // Process request...
}
```

### Turnstile CAPTCHA

**Integration:**

- Required on all guest booking submissions
- Protects against automated bot spam
- Free tier: Unlimited verifications
- Verification happens server-side before processing

**Token Verification:**

```typescript
async function verifyTurnstile(token: string, secretKey: string, clientIp: string) {
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: secretKey,
      response: token,
      remoteip: clientIp,
    }),
  });
  return await response.json();
}
```

**Test Tokens (Development Only):**

For development and automated testing, use Cloudflare's official test tokens:

| Token                      | Behavior            | Use Case                              |
| -------------------------- | ------------------- | ------------------------------------- |
| `1x00000000000000000000AA` | Always passes       | Development testing, happy path tests |
| `2x00000000000000000000AB` | Always fails        | Error handling tests                  |
| `3x00000000000000000000AC` | Token already spent | Idempotency tests                     |

**Important**: Production must use real tokens from Cloudflare Turnstile widget. Test tokens will not work in production mode.

**Error Response Example:**

```json
{
  "success": false,
  "error": "CAPTCHA verification failed",
  "error_code": "TURNSTILE_VERIFICATION_FAILED"
}
```

### Free Tier Resource Monitoring

**Cloudflare Workers Free Tier Limits:**

- 100,000 requests/day
- 10ms CPU time per request
- KV: 100,000 reads/day, 1,000 writes/day
- Cron triggers: 3/day (sufficient for idempotency cleanup)

**Monitoring Strategy:**

- Track request count approaching daily limit
- Alert when >80,000 requests/day
- Idempotency KV writes: ~5/hour typical (well under limit)

## Error Handling Strategy

### Error Codes Registry

**Centralized error codes** for consistent client-side handling:

```typescript
export const ERROR_CODES = {
  // Validation errors (400)
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_DATE_RANGE: "INVALID_DATE_RANGE",
  INVALID_GUEST_COUNT: "INVALID_GUEST_COUNT",
  INVALID_UNIT_COUNT: "INVALID_UNIT_COUNT",
  TERMS_NOT_ACCEPTED: "TERMS_NOT_ACCEPTED",
  CAPACITY_EXCEEDED: "CAPACITY_EXCEEDED",
  UNIT_LIMIT_EXCEEDED: "UNIT_LIMIT_EXCEEDED",
  INVALID_DATES: "INVALID_DATES",

  // Authentication errors (401)
  UNAUTHORIZED: "UNAUTHORIZED",
  TURNSTILE_VERIFICATION_FAILED: "TURNSTILE_VERIFICATION_FAILED",

  // Authorization errors (403)
  FORBIDDEN: "FORBIDDEN",
  SECURITY_VERIFICATION_FAILED: "SECURITY_VERIFICATION_FAILED",

  // Not found errors (404)
  BOOKING_NOT_FOUND: "BOOKING_NOT_FOUND",
  UNIT_NOT_FOUND: "UNIT_NOT_FOUND",

  // Conflict errors (409)
  DUPLICATE_BOOKING: "DUPLICATE_BOOKING",
  UNIT_ALREADY_BOOKED: "UNIT_ALREADY_BOOKED",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",

  // Constraint errors (400/409)
  PAYMENT_NOT_VERIFIED: "PAYMENT_NOT_VERIFIED",
  PARTIAL_ASSIGNMENT_NOT_ALLOWED: "PARTIAL_ASSIGNMENT_NOT_ALLOWED",
  INVALID_REFERENCE: "INVALID_REFERENCE",

  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",

  // Server errors (500)
  DATABASE_ERROR: "DATABASE_ERROR",
  STORAGE_ERROR: "STORAGE_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
```

### Complete Error Codes Reference

For comprehensive error handling, frontend must handle these error codes:

#### Validation Errors (4xx)

| Error Code            | HTTP Status | Description                                       | User Action                            |
| --------------------- | ----------- | ------------------------------------------------- | -------------------------------------- |
| `VALIDATION_ERROR`    | 400         | Input validation failed (Zod schema)              | Fix form inputs per validation details |
| `INVALID_DATE_RANGE`  | 400         | Check-in date >= check-out date                   | Select valid date range                |
| `INVALID_GUEST_COUNT` | 400         | `guests_per_unit` exceeds `max_capacity_per_unit` | Reduce guests per unit                 |
| `INVALID_UNIT_COUNT`  | 400         | Requested units exceeds available units in system | Reduce number of units                 |
| `TERMS_NOT_ACCEPTED`  | 400         | `terms_accepted` must be true                     | Accept terms and conditions            |

#### Authentication & Authorization Errors (401/403)

| Error Code                      | HTTP Status | Description                  | User Action                  |
| ------------------------------- | ----------- | ---------------------------- | ---------------------------- |
| `UNAUTHORIZED`                  | 401         | Missing or invalid JWT token | Re-authenticate (admin only) |
| `TURNSTILE_VERIFICATION_FAILED` | 401         | CAPTCHA verification failed  | Refresh page and retry       |
| `FORBIDDEN`                     | 403         | Insufficient permissions     | Contact administrator        |

#### Not Found Errors (404)

| Error Code          | HTTP Status | Description                 | User Action              |
| ------------------- | ----------- | --------------------------- | ------------------------ |
| `BOOKING_NOT_FOUND` | 404         | Booking reference not found | Verify booking reference |
| `UNIT_NOT_FOUND`    | 404         | Unit ID not found           | Verify unit exists       |

#### Conflict Errors (409)

| Error Code             | HTTP Status | Description                                 | User Action                                        |
| ---------------------- | ----------- | ------------------------------------------- | -------------------------------------------------- |
| `UNIT_ALREADY_BOOKED`  | 409         | Double-booking attempt (EXCLUDE constraint) | Select different dates or units                    |
| `IDEMPOTENCY_CONFLICT` | 409         | Different payload with same idempotency_key | Use new idempotency key or verify existing booking |

#### Business Logic Errors (400/409)

| Error Code                       | HTTP Status | Description                                     | User Action                         |
| -------------------------------- | ----------- | ----------------------------------------------- | ----------------------------------- |
| `PAYMENT_NOT_VERIFIED`           | 400         | Cannot assign units before payment verification | Wait for admin payment verification |
| `PARTIAL_ASSIGNMENT_NOT_ALLOWED` | 409         | All-or-nothing assignment constraint            | Admin must assign all units         |

#### Rate Limiting (429)

| Error Code            | HTTP Status | Description                    | User Action                          |
| --------------------- | ----------- | ------------------------------ | ------------------------------------ |
| `RATE_LIMIT_EXCEEDED` | 429         | Too many requests from this IP | Wait `retry_after` seconds and retry |

#### System Errors (500)

| Error Code       | HTTP Status | Description                | User Action              |
| ---------------- | ----------- | -------------------------- | ------------------------ |
| `DATABASE_ERROR` | 500         | Database operation failed  | Retry or contact support |
| `STORAGE_ERROR`  | 500         | File upload/storage failed | Retry file upload        |
| `INTERNAL_ERROR` | 500         | Unexpected server error    | Contact support          |

### Error Response Format

All API endpoints return consistent error responses:

```typescript
interface ErrorResponse {
  success: false;
  error: string; // Human-readable message
  error_code: string; // Machine-readable code (required for client error handling)
  details?: unknown; // Optional validation details (Zod errors, etc.)
}
```

### HTTP Status Codes

| Code | Scenario            | Error Code                     | Description                                  |
| ---- | ------------------- | ------------------------------ | -------------------------------------------- |
| 400  | Invalid input       | `VALIDATION_FAILED`            | Zod validation errors, malformed JSON        |
| 400  | Capacity exceeded   | `CAPACITY_EXCEEDED`            | `guests_per_unit` exceeds MIN(max_occupancy) |
| 400  | Unit limit exceeded | `UNIT_LIMIT_EXCEEDED`          | More than 10 units requested                 |
| 400  | Invalid dates       | `INVALID_DATES`                | Check-out before check-in, past dates        |
| 403  | Turnstile failed    | `SECURITY_VERIFICATION_FAILED` | Invalid Turnstile token                      |
| 404  | Not found           | `BOOKING_NOT_FOUND`            | Booking reference not found                  |
| 404  | Not found           | `UNIT_NOT_FOUND`               | Unit ID not found                            |
| 409  | Duplicate           | `DUPLICATE_BOOKING`            | Idempotency key collision                    |
| 409  | Conflict            | `UNIT_ALREADY_BOOKED`          | Double-booking attempt (EXCLUDE constraint)  |
| 429  | Rate limited        | `RATE_LIMIT_EXCEEDED`          | Too many requests from IP                    |
| 500  | Server error        | `INTERNAL_ERROR`               | Database errors, unexpected failures         |

### PostgreSQL Constraint Error Mapping

```typescript
function mapDatabaseError(error: PostgrestError): ErrorResponse {
  // EXCLUDE constraint violation (no_double_booking)
  if (error.code === "23P01") {
    return {
      success: false,
      error: "Selected unit is already booked for these dates",
      error_code: "UNIT_ALREADY_BOOKED",
    };
  }

  // CHECK constraint violations
  if (error.code === "23514") {
    if (error.message.includes("payment_before_assignment")) {
      return {
        success: false,
        error: "Payment must be verified before assigning units",
        error_code: "PAYMENT_NOT_VERIFIED",
      };
    }
    if (error.message.includes("all_or_nothing_assignment")) {
      return {
        success: false,
        error: "Must assign all requested units",
        error_code: "PARTIAL_ASSIGNMENT_NOT_ALLOWED",
      };
    }
  }

  // Foreign key violations
  if (error.code === "23503") {
    return {
      success: false,
      error: "Referenced entity not found",
      error_code: "INVALID_REFERENCE",
    };
  }

  // Default
  return {
    success: false,
    error: "Database operation failed",
    error_code: "INTERNAL_ERROR",
    details: process.env.NODE_ENV === "development" ? error : undefined,
  };
}
```

### Example Error Responses

**Validation Error:**

```json
{
  "success": false,
  "error": "Validation failed",
  "error_code": "VALIDATION_FAILED",
  "details": {
    "fieldErrors": {
      "guest_name": ["String must contain at least 2 character(s)"],
      "email": ["Invalid email"]
    }
  }
}
```

**Capacity Exceeded:**

```json
{
  "success": false,
  "error": "Maximum 4 guests per unit available for your selected dates",
  "error_code": "CAPACITY_EXCEEDED"
}
```

**Rate Limited:**

```json
{
  "success": false,
  "error": "Too many requests. Please try again later.",
  "error_code": "RATE_LIMIT_EXCEEDED"
}
```

## Admin Endpoints

**Authentication Required**: All admin endpoints require valid JWT with `app_role = 'admin'` claim.

### Admin Authentication & Authorization

All admin endpoints enforce JWT-based authentication and role-based authorization.

**JWT Structure**:

```json
{
  "sub": "user-uuid",
  "email": "admin@example.com",
  "app_role": "admin",
  "iat": 1234567890,
  "exp": 1234571490
}
```

**Authorization Rules**:

| Endpoint                          | Required Role | Additional Checks                                               |
| --------------------------------- | ------------- | --------------------------------------------------------------- |
| GET `/api/admin/pending-bookings` | `admin`       | None                                                            |
| GET `/api/admin/available-units`  | `admin`       | None                                                            |
| POST `/api/admin/assign-units`    | `admin`       | Booking must be in `pending` status, payment must be `Verified` |
| POST `/api/admin/verify-payment`  | `admin`       | Booking must have `payment_proof_url`                           |

**Authentication Middleware**:

```typescript
async function verifyAdminAuth(
  request: CloudflareRequest
): Promise<{ user_id: string; email: string } | null> {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);

  // Verify JWT with Supabase
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  // Check admin role
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("app_role")
    .eq("user_id", user.id)
    .single();

  if (profile?.app_role !== "admin") {
    return null;
  }

  return { user_id: user.id, email: user.email };
}
```

**Error Responses**:

**Unauthorized (401)**:

```json
{
  "success": false,
  "error": "Unauthorized",
  "error_code": "UNAUTHORIZED"
}
```

**Forbidden (403)**:

```json
{
  "success": false,
  "error": "Forbidden - insufficient permissions",
  "error_code": "FORBIDDEN"
}
```

### JWT Authentication Flow

**Overview**: All admin endpoints use Supabase Auth for authentication. JWT tokens are issued, refreshed, and validated through Supabase's built-in authentication system.

#### Token Issuance

**Login Endpoint**: Handled by Supabase Auth

```typescript
// Client-side login
const { data, error } = await supabase.auth.signInWithPassword({
  email: "admin@example.com",
  password: "secure-password",
});

// Returns:
// - access_token (JWT, 1-hour expiry)
// - refresh_token (used to obtain new access tokens)
// - user object with metadata
```

**JWT Structure**:

```json
{
  "sub": "user-uuid",
  "email": "admin@example.com",
  "app_role": "admin",
  "iat": 1234567890,
  "exp": 1234571490
}
```

**Custom Claims**: The `app_role` claim is stored in `user_profiles` table and added to JWT via Supabase database trigger.

#### Token Refresh

**Automatic Refresh**: Supabase client libraries handle automatic token refresh before expiry.

```typescript
// Manual refresh if needed
const { data, error } = await supabase.auth.refreshSession();
```

**Refresh Flow**:

1. Access token expires after 1 hour
2. Client detects expiry (or approaching expiry)
3. Uses refresh token to obtain new access token
4. Refresh tokens are valid for 30 days (configurable)

#### Session Management

**Session Storage**: Tokens stored in browser localStorage (or memory for sensitive environments).

**Session Verification**:

```typescript
// Get current session
const {
  data: { session },
} = await supabase.auth.getSession();

// Verify user
const {
  data: { user },
} = await supabase.auth.getUser(session.access_token);
```

**Session Events**: Listen for auth state changes:

```typescript
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") {
    // Redirect to login
  } else if (event === "TOKEN_REFRESHED") {
    // Update stored token
  }
});
```

#### Logout & Revocation

**Logout**:

```typescript
await supabase.auth.signOut();
```

**Effects**:

- Clears local session
- Invalidates refresh token on server
- Access token remains valid until expiry (1 hour max)

**Admin Forced Logout**: Can be implemented via database trigger that tracks revoked sessions.

#### API Request Authentication

**Request Headers**:

```
Authorization: Bearer <access_token>
```

**Server-Side Verification** (already shown in earlier sections):

```typescript
const authHeader = request.headers.get("Authorization");
const token = authHeader?.substring(7); // Remove 'Bearer '

const {
  data: { user },
  error,
} = await supabase.auth.getUser(token);
```

**Role Check**:

```typescript
const { data: profile } = await supabase
  .from("user_profiles")
  .select("app_role")
  .eq("user_id", user.id)
  .single();

if (profile?.app_role !== "admin") {
  return 403; // Forbidden
}
```

### Transaction Handling for Unit Assignment

All unit assignments occur within a single atomic database transaction via the `assign_units_to_booking()` PostgreSQL function.

**Rollback Behavior**:

- If ANY unit assignment fails, ALL assignments are rolled back
- No partial assignments are ever committed
- Error response includes conflicting unit details

**Transaction Flow**:

```sql
BEGIN;
  -- Validate booking status and payment
  -- Insert all booking_units rows
  -- Update booking status to 'assigned'
  -- If any step fails: ROLLBACK
COMMIT;
```

**Error Response with Conflict Details**:

```json
{
  "success": false,
  "error": "Unit assignment failed",
  "error_code": "UNIT_ALREADY_BOOKED",
  "details": {
    "conflicting_unit_id": "unit-102",
    "conflicting_booking_id": "existing-booking-uuid"
  }
}
```

**Implementation ensures**:

- Atomicity: All units assigned or none
- Consistency: All-or-nothing constraint enforced
- Isolation: EXCLUDE constraint prevents concurrent conflicts
- Durability: Transaction committed only after all validations pass

### GET /api/admin/pending-bookings

Retrieve all pending multi-unit bookings sorted by urgency score.

**Authentication**: JWT with admin role required.

**Response:**

```typescript
{
  success: true,
  bookings: Array<{
    booking_id: string;
    booking_reference: string;
    guest_id: string;
    guest_name: string;
    email: string;
    phone_number: string;
    check_in_date: string;
    check_out_date: string;
    requested_unit_count: number;
    total_amount: number;
    downpayment_required: number;
    payment_status: 'Pending' | 'Verified';
    payment_proof_url?: string;
    unit_assignment_status: 'pending';
    urgency_score: number;  // 0-100, calculated server-side
    created_at: string;
    special_requests?: string;
  }>
}
```

**Example:**

```bash
curl -X GET https://your-domain.com/api/admin/pending-bookings \
  -H "Authorization: Bearer <admin-jwt-token>"
```

### GET /api/admin/available-units

Retrieve units available for given date range.

**Authentication**: JWT with admin role required.

**Query Parameters:**

- `check_in` (required): ISO datetime string
- `check_out` (required): ISO datetime string

**Response:**

```typescript
{
  success: true,
  units: Array<{
    unit_id: string;
    unit_number: string;
    unit_name: string;
    unit_status: 'Available' | 'Maintenance' | 'Out of Service';
    max_capacity_per_unit: number;  // From pricing_config (uniform across all units)
  }>
}
```

**Example:**

```bash
curl -X GET "https://your-domain.com/api/admin/available-units?check_in=2025-03-01T14:00:00Z&check_out=2025-03-08T11:00:00Z" \
  -H "Authorization: Bearer <admin-jwt-token>"
```

**Implementation:**

```typescript
export async function onRequest(context: { request: CloudflareRequest }) {
  const url = new URL(context.request.url);
  const checkIn = url.searchParams.get("check_in");
  const checkOut = url.searchParams.get("check_out");

  if (!checkIn || !checkOut) {
    return new Response(JSON.stringify({ success: false, error: "Missing required parameters" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Query units NOT in booking_units for given date range
  const { data: units, error } = await supabase
    .from("units")
    .select("unit_id, unit_number, unit_name, unit_status")
    .eq("unit_status", "Available")
    .not(
      "unit_id",
      "in",
      supabase
        .from("booking_units")
        .select("unit_id")
        .overlaps(
          "daterange(check_in_date, check_out_date, '[]')",
          `daterange('${checkIn}', '${checkOut}', '[]')`
        )
        .neq("status", "cancelled")
    );

  if (error) throw error;

  // Fetch capacity from pricing_config (uniform for all units)
  const { data: config } = await supabase
    .from("pricing_config")
    .select("max_capacity_per_unit")
    .eq("id", "default")
    .single();

  const unitsWithCapacity = units.map((unit) => ({
    ...unit,
    max_capacity_per_unit: config.max_capacity_per_unit,
  }));

  return new Response(JSON.stringify({ success: true, units: unitsWithCapacity }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
```

### POST /api/admin/assign-units

Assign specific units to a pending booking. All-or-nothing atomicity enforced.

**Authentication**: JWT with admin role required.

**Request Body:**

```typescript
{
  booking_id: string;
  unit_ids: string[];  // Must match requested_unit_count exactly
}
```

**Response:**

```typescript
{
  success: true;
  message: string;
}
```

**Error Responses:**

- `400`: Invalid request (wrong number of units)
- `403`: Payment not verified
- `404`: Booking not found or not pending
- `409`: Unit already booked (EXCLUDE constraint violation)
- `500`: Assignment transaction failed

**Example:**

```bash
curl -X POST https://your-domain.com/api/admin/assign-units \
  -H "Authorization: Bearer <admin-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": "uuid-here",
    "unit_ids": ["unit-uuid-1", "unit-uuid-2", "unit-uuid-3"]
  }'
```

**Implementation:**

```typescript
export async function onRequest(context: { request: CloudflareRequest }) {
  // Verify admin JWT (omitted for brevity)

  const { booking_id, unit_ids } = await context.request.json();

  // Call PostgreSQL function for atomic assignment
  const { data, error } = await supabase.rpc("assign_units_to_booking", {
    p_booking_id: booking_id,
    p_unit_ids: unit_ids,
  });

  if (error) {
    // Map database errors to HTTP responses
    if (error.code === "23P01") {
      // EXCLUDE constraint
      return new Response(
        JSON.stringify({
          success: false,
          error: "One or more units already booked for these dates",
          error_code: "UNIT_ALREADY_BOOKED",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    if (error.message.includes("Payment must be verified")) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Payment verification required before assignment",
          error_code: "PAYMENT_NOT_VERIFIED",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: false, error: "Assignment failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true, message: "Units assigned successfully" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
```

### POST /api/admin/verify-payment

Mark payment as verified for a booking.

**Authentication**: JWT with admin role required.

**Request Body:**

```typescript
{
  booking_id: string;
}
```

**Response:**

```typescript
{
  success: true;
  message: string;
}
```

**Example:**

```bash
curl -X POST https://your-domain.com/api/admin/verify-payment \
  -H "Authorization: Bearer <admin-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"booking_id": "uuid-here"}'
```

---

## Admin Endpoints (Phase 3)

### Discount Rules Management

Admin interface for managing discount rules. **Status**: Planned for Phase 3.

#### POST /api/admin/discount-rules

Create new discount rule.

**Authentication**: Requires admin JWT token.

```typescript
// Request body
{
  "name": "Summer Special",
  "description": "10% off for bookings in June-August",
  "conditions": [
    {"type": "date_range", "operator": "between", "value": ["2025-06-01", "2025-08-31"]}
  ],
  "discount_type": "percentage",
  "discount_value": 10.00,
  "priority": 5,
  "is_active": true
}

// Response
{
  "success": true,
  "rule_id": "uuid",
  "message": "Discount rule created successfully"
}
```

#### GET /api/admin/discount-rules

List all discount rules (including inactive).

**Query Parameters:**

- `active`: Filter by active status (true/false)
- `limit`: Pagination limit (default: 50)
- `offset`: Pagination offset

```typescript
// Response
{
  "success": true,
  "rules": [
    {
      "id": "uuid",
      "name": "Week Stay Discount",
      "description": "5% off for 7+ nights",
      "conditions": [{"type": "min_nights", "value": 7}],
      "discount_value": 5.00,
      "priority": 1,
      "is_active": true,
      "created_at": "2025-01-15T10:00:00Z"
    }
  ],
  "total": 4
}
```

#### PUT /api/admin/discount-rules/:id

Update existing discount rule.

```typescript
// Request body (partial updates allowed)
{
  "discount_value": 7.00,
  "description": "Updated: 7% off for 7+ nights"
}

// Response
{
  "success": true,
  "message": "Discount rule updated successfully"
}
```

#### PATCH /api/admin/discount-rules/:id/toggle

Toggle discount rule active status.

```typescript
// Response
{
  "success": true,
  "is_active": false,
  "message": "Discount rule deactivated"
}
```

#### POST /api/admin/discount-rules/:id/test

Test discount rule against sample booking data.

```typescript
// Request body
{
  "check_in": "2025-07-01",
  "check_out": "2025-07-08",
  "unit_requests": [
    {"guests_per_unit": 2},
    {"guests_per_unit": 3}
  ]
}

// Response
{
  "success": true,
  "applies": true,
  "discount_amount": 2100.00,
  "original_total": 21000.00,
  "discounted_total": 18900.00,
  "rule_name": "Week Stay Discount"
}
```

### Implementation Notes

**Phase 1 Workaround:**
Admins manage discount rules via Supabase dashboard or direct SQL:

```sql
-- Add new discount rule
INSERT INTO discount_rules (name, description, conditions, discount_type, discount_value, priority)
VALUES (
  'Holiday Special',
  '15% off for Christmas/New Year bookings',
  '[{"type": "date_range", "operator": "between", "value": ["2025-12-20", "2026-01-05"]}]'::JSONB,
  'percentage',
  15.00,
  10
);

-- Deactivate rule
UPDATE discount_rules SET is_active = false WHERE id = 'uuid';
```

**Phase 3 Benefits:**

- User-friendly admin interface
- Input validation and error prevention
- Visual JSONB condition builder
- Live discount testing
- Audit logging of rule changes

## Booking Size Validation Strategy

**Approach:** Dynamic validation against actual system inventory

The system validates the total number of requested units against the current count of available units in the database, rather than using a static configuration limit.

**Implementation:**

```typescript
// Validate total requested units against available units in system
const { count: totalUnits } = await supabase
  .from("units")
  .select("*", { count: "exact", head: true })
  .eq("unit_status", "Available");

if (unit_requests.length > totalUnits) {
  return {
    error: `Maximum ${totalUnits} units available in system`,
    error_code: "BOOKING_SIZE_EXCEEDED",
  };
}
```

**Why No Static Limit:**

- System adapts to actual inventory (see ADR-001 in architecture decisions)
- Adding/removing units doesn't require configuration changes
- Validation reflects real-time capacity
- Booking size limit scales with business growth

**Not Used:** `max_units_per_booking` static configuration field (rejected in ADR-001)

**Capacity vs Availability:**

- **Capacity** (validated): Physical guest limit per unit - checked against `pricing_config.max_capacity_per_unit`
- **Size** (validated): Total units requested vs total units in system - checked dynamically via COUNT()
- **Availability** (NOT validated): Whether specific units are currently booked - handled manually by admin during assignment

## Key Implementation Notes

**Pricing Authority:**

- PostgreSQL `calculate_booking_pricing()` is SOLE source of truth
- Preview endpoint `/api/guest-booking/preview-pricing` wraps PostgreSQL function for UX
- All pricing computed server-side (final and preview)

**Data Model:**

- Array-based: Each `unit_requests` entry = 1 unit
- NO `quantity` field exists
- Array length = total units requested

**Validation:**

- ✅ YES: Validate `guests_per_unit` ≤ `pricing_config.max_capacity_per_unit` (guest capacity per unit)
- ✅ YES: Validate total requested units ≤ COUNT(available units) dynamically (booking size validation)
- ✅ YES: Check-in/check-out date validity
- ❌ NO: Unit availability (whether units are currently booked)
- ❌ NO: Specific unit assignments

**Reasoning**: Admin handles actual unit assignment and booking status during assignment. Validation prevents physically impossible requests (too many guests per unit) and system capacity overflow (more units requested than exist in system).

**Email Notifications:**

- NOT IMPLEMENTED
- Manual guest contact by admin via phone/SMS
- Future: Resend/SendGrid integration

**Idempotency:**

- Client-supplied UUIDs
- Keys expire 48 hours after creation (cleaned daily at 2:00 AM UTC)
- Returns existing booking if duplicate detected

## Cron Workers

### Cleanup Idempotency Keys

**File**: `functions/cron/cleanup-idempotency-keys.ts`

**Schedule**: Daily at 2:00 AM UTC

```typescript
import { supabase } from "@/lib/supabase-server";

export async function scheduled(event: ScheduledEvent, env: Env) {
  console.log("[CRON] Starting idempotency key cleanup");

  try {
    const { data: deleted, error } = await supabase.rpc("cleanup_expired_idempotency_keys");

    if (error) {
      console.error("[CRON] Idempotency cleanup failed:", error);
      return;
    }

    console.log(`[CRON] Cleaned up ${deleted} expired idempotency keys`);
  } catch (error) {
    console.error("[CRON] Exception during cleanup:", error);
  }
}
```

### Cleanup Payment Proofs

**File**: `functions/cron/cleanup-payment-proofs.ts`

**Schedule**: Weekly on Sunday at 3:00 AM UTC

```typescript
import { supabase } from "@/lib/supabase-server";

export async function scheduled(event: ScheduledEvent, env: Env) {
  console.log("[CRON] Starting payment proof cleanup");

  try {
    const { data: filePaths, error: dbError } = await supabase.rpc(
      "cleanup_expired_payment_proofs"
    );

    if (dbError) {
      console.error("[CRON] Database cleanup failed:", dbError);
      return;
    }

    if (!filePaths || filePaths.length === 0) {
      console.log("[CRON] No expired payment proofs to delete");
      return;
    }

    let deletedCount = 0;
    for (const path of filePaths) {
      const { error: storageError } = await supabase.storage
        .from("booking-files")
        .remove([`payment-proofs/${path}`]);

      if (storageError) {
        console.error(`[CRON] Failed to delete ${path}:`, storageError);
      } else {
        deletedCount++;
      }
    }

    console.log(`[CRON] Deleted ${deletedCount}/${filePaths.length} payment proof files`);
  } catch (error) {
    console.error("[CRON] Exception during cleanup:", error);
  }
}
```

### wrangler.toml Configuration

```toml
[triggers]
crons = [
  "0 2 * * *",  # Daily at 2:00 AM UTC - cleanup_expired_idempotency_keys
  "0 3 * * 0"   # Weekly Sunday at 3:00 AM UTC - cleanup_expired_payment_proofs
]
```
