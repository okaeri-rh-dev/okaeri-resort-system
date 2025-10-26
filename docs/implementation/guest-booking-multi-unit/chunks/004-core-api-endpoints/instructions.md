# Implementation Instructions: Chunk 004

## Overview

This guide walks you through implementing 4 Cloudflare Workers API endpoints for multi-unit guest booking. All code is copy-pasteable and production-ready.

**Estimated Time**: 120 minutes total

- Step 1-2: Setup environment (15 min)
- Step 3-6: Create API endpoints (60 min)
- Step 7-9: Create helper utilities (20 min)
- Step 10-12: Testing (25 min)

---

## Step 1: Setup Environment Variables (10 minutes)

Add Turnstile and Supabase configuration to your environment.

### Add to `.env.local`

```bash
# Supabase Configuration (should already exist)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Cloudflare Turnstile (NEW)
VITE_TURNSTILE_SITE_KEY=0x4AAAAAAA... # Your site key
TURNSTILE_SECRET_KEY=0x4AAAAAAA...     # Your secret key (server-side only)

# API Configuration (NEW)
ALLOWED_ORIGINS=http://localhost:5173,https://your-domain.com
```

### Get Turnstile Keys

1. Go to https://dash.cloudflare.com/
2. Navigate to **Turnstile** in sidebar
3. Click **Add Site**
4. Configure:
   - **Domain**: `localhost` (for development) or your production domain
   - **Widget Mode**: Managed
5. Copy **Site Key** → `VITE_TURNSTILE_SITE_KEY`
6. Copy **Secret Key** → `TURNSTILE_SECRET_KEY`

**Verification**: Both keys should start with `0x4AAAAAAA`

---

## Step 2: Create Cloudflare KV Namespace (5 minutes)

Rate limiting requires a KV namespace to store request counts.

### Using Wrangler CLI

```bash
# Install wrangler if not already installed
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create KV namespace for rate limiting
wrangler kv:namespace create RATE_LIMIT_KV

# Expected output:
# 🌀 Creating namespace with title "RATE_LIMIT_KV"
# ✨ Success!
# Add the following to your configuration file:
# kv_namespaces = [
#   { binding = "RATE_LIMIT_KV", id = "xxxxxxxxxxxxx" }
# ]
```

### Add KV Binding to `wrangler.toml`

```toml
# Add to wrangler.toml (create file if doesn't exist)
name = "okaeri-resort-api"
compatibility_date = "2024-01-01"

kv_namespaces = [
  { binding = "RATE_LIMIT_KV", id = "your-kv-namespace-id" }
]

[env.production]
kv_namespaces = [
  { binding = "RATE_LIMIT_KV", id = "your-production-kv-id" }
]
```

**Verification**: Run `wrangler kv:namespace list` to see your namespace

---

## Step 3: Create Type Definitions (15 minutes)

Create Zod schemas and TypeScript types for API contracts.

### Create `src/types/guest-booking-multi-unit.ts`

```typescript
import { z } from "zod";

// ============================================
// Request Schemas (Zod Validation)
// ============================================

/**
 * Array-based model: each entry = 1 unit
 * NO quantity field
 */
export const unitRequestSchema = z.object({
  guests_per_unit: z
    .number()
    .int("Guest count must be a whole number")
    .min(1, "At least 1 guest per unit"),
  // Maximum validated dynamically from pricing_config.max_capacity_per_unit
  // IMPORTANT: All units have identical capacity
});

export type UnitRequest = z.infer<typeof unitRequestSchema>;

/**
 * Multi-unit booking request schema
 * Validates entire booking payload
 */
export const multiUnitBookingSchema = z
  .object({
    guest_name: z.string().min(2, "Name too short").max(100, "Name too long"),
    email: z.string().email("Invalid email").toLowerCase(),
    phone_number: z.string().regex(/^\+?[0-9\s\-()]{10,20}$/, "Invalid phone number format"),

    check_in: z
      .string()
      .datetime()
      .refine((date) => new Date(date) > new Date(), "Check-in must be in future"),
    check_out: z.string().datetime(),

    // Array: each entry = 1 unit (NO quantity field)
    unit_requests: z
      .array(unitRequestSchema)
      .min(1, "At least one unit required")
      .max(10, "Maximum 10 units per booking"),

    special_requests: z.string().max(1000, "Special requests too long").optional(),
    turnstile_token: z.string().min(1, "CAPTCHA token required"),
    terms_accepted: z.boolean().refine((val) => val === true, "Must accept terms"),
    idempotency_key: z.string().uuid().optional(),
  })
  .refine((data) => new Date(data.check_out) > new Date(data.check_in), {
    message: "Check-out must be after check-in",
    path: ["check_out"],
  });

export type MultiUnitBookingRequest = z.infer<typeof multiUnitBookingSchema>;

// ============================================
// Response Types
// ============================================

export interface MultiUnitBookingResponse {
  success: boolean;
  booking: {
    booking_id: string;
    booking_reference: string;
    total_amount: number;
    downpayment_amount: number;
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
  description?: string;
  conditions: Array<{
    type: "min_nights" | "date_range" | "advance_booking" | "unit_count";
    operator?: "gte" | "lte" | "between";
    value: any;
  }>;
  discount_type: "percentage" | "fixed" | "per_night";
  discount_value: number;
  priority: number;
  is_active: boolean;
}

export interface PricingConfig {
  base_rate: number;
  weekend_rate: number;
  extra_person_rate: number;
  base_occupancy: number;
  max_capacity_per_unit: number;
  downpayment_percent: number;
  currency: string;
}

// ============================================
// Error Codes
// ============================================

export const ERROR_CODES = {
  // Validation errors (400)
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_DATE_RANGE: "INVALID_DATE_RANGE",
  INVALID_GUEST_COUNT: "INVALID_GUEST_COUNT",
  CAPACITY_EXCEEDED: "CAPACITY_EXCEEDED",
  UNIT_LIMIT_EXCEEDED: "UNIT_LIMIT_EXCEEDED",
  TERMS_NOT_ACCEPTED: "TERMS_NOT_ACCEPTED",

  // Authentication errors (401)
  TURNSTILE_VERIFICATION_FAILED: "TURNSTILE_VERIFICATION_FAILED",

  // Conflict errors (409)
  DUPLICATE_BOOKING: "DUPLICATE_BOOKING",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",

  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",

  // Server errors (500)
  DATABASE_ERROR: "DATABASE_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface ErrorResponse {
  success: false;
  error: string;
  error_code: ErrorCode;
  details?: unknown;
}
```

**Verification**: Run `npm run type-check` to ensure no TypeScript errors.

---

## Step 4: Create Turnstile Verification Helper (10 minutes)

Create a reusable utility for Turnstile CAPTCHA verification.

### Create `src/lib/turnstile.ts`

```typescript
/**
 * Turnstile CAPTCHA Verification
 *
 * Verifies Cloudflare Turnstile tokens server-side.
 * Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */

export interface TurnstileVerificationResult {
  success: boolean;
  error?: string;
  "error-codes"?: string[];
}

/**
 * Verify Turnstile token with Cloudflare API
 *
 * @param token - Turnstile token from client widget
 * @param secretKey - Turnstile secret key (from env)
 * @param clientIp - Client IP address (from CF-Connecting-IP header)
 * @returns Verification result
 */
export async function verifyTurnstile(
  token: string,
  secretKey: string,
  clientIp: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Abort after 5 seconds to prevent hanging
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

    const result: TurnstileVerificationResult = await response.json();

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
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.error("[TURNSTILE] Timeout after 5 seconds");
      return { success: false, error: "Turnstile verification timeout" };
    }
    console.error("[TURNSTILE] Exception:", error);
    return { success: false, error: "Turnstile verification error" };
  }
}
```

**Verification**: Import this function in your API endpoints (next steps).

---

## Step 5: Create Rate Limiting Helper (15 minutes)

Implement KV-based rate limiting for API endpoints.

### Create `src/lib/rate-limit.ts`

```typescript
/**
 * Cloudflare KV Rate Limiting
 *
 * Tracks API requests per IP address using Cloudflare KV store.
 * Free tier: 1,000 writes/day (sufficient for rate limit tracking)
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number; // Unix timestamp (seconds)
}

/**
 * Check rate limit for a specific IP and endpoint
 *
 * @param kv - Cloudflare KV namespace binding
 * @param clientIp - Client IP address
 * @param endpoint - Endpoint identifier (e.g., "guest-booking")
 * @param maxRequests - Maximum requests allowed in time window
 * @param windowSeconds - Time window in seconds
 * @returns Rate limit result
 */
export async function checkKVRateLimit(
  kv: KVNamespace,
  clientIp: string,
  endpoint: string,
  maxRequests: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const key = `ratelimit:${endpoint}:${clientIp}`;
  const now = Math.floor(Date.now() / 1000);

  try {
    // Get current count and reset time
    const stored = await kv.get(key, { type: "json" });
    const data = stored as { count: number; resetTime: number } | null;

    // No previous requests or window expired
    if (!data || now >= data.resetTime) {
      const resetTime = now + windowSeconds;

      // Store new count
      await kv.put(key, JSON.stringify({ count: 1, resetTime }), { expirationTtl: windowSeconds });

      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime,
      };
    }

    // Within existing window
    if (data.count >= maxRequests) {
      // Rate limit exceeded
      return {
        allowed: false,
        remaining: 0,
        resetTime: data.resetTime,
      };
    }

    // Increment count
    const newCount = data.count + 1;
    await kv.put(key, JSON.stringify({ count: newCount, resetTime: data.resetTime }), {
      expirationTtl: data.resetTime - now,
    });

    return {
      allowed: true,
      remaining: maxRequests - newCount,
      resetTime: data.resetTime,
    };
  } catch (error) {
    console.error("[RATE_LIMIT] KV error:", error);
    // Fail open (allow request if KV is down)
    return {
      allowed: true,
      remaining: maxRequests,
      resetTime: now + windowSeconds,
    };
  }
}
```

**Verification**: This utility will be used in all API endpoints (next steps).

---

## Step 6: Create Main Booking Endpoint (20 minutes)

Implement POST `/api/guest-booking` - the core booking creation endpoint.

### Create `functions/api/guest-booking.ts`

```typescript
import type { Request as CloudflareRequest } from "@cloudflare/workers-types";
import { createClient } from "@supabase/supabase-js";
import DOMPurify from "isomorphic-dompurify";

import { checkKVRateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import {
  ERROR_CODES,
  multiUnitBookingSchema,
  type MultiUnitBookingResponse,
} from "@/types/guest-booking-multi-unit";

/**
 * POST /api/guest-booking
 *
 * Creates multi-unit guest booking with server-side pricing.
 *
 * Flow:
 * 1. Validate request (Zod schema)
 * 2. Verify Turnstile CAPTCHA
 * 3. Check rate limit
 * 4. Check idempotency (prevent duplicates)
 * 5. Validate capacity constraints
 * 6. Call PostgreSQL pricing function (AUTHORITATIVE)
 * 7. Sanitize inputs
 * 8. Create booking atomically
 * 9. Return response (NO email notifications)
 */
export async function onRequest(context: {
  request: CloudflareRequest;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGINS || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // Handle preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    // 1. Parse and validate request
    const body = await request.json();
    const validation = multiUnitBookingSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Validation failed",
          error_code: ERROR_CODES.VALIDATION_ERROR,
          details: validation.error.flatten(),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = validation.data;
    const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";

    // 2. Verify Turnstile CAPTCHA
    const turnstileResult = await verifyTurnstile(
      data.turnstile_token,
      env.TURNSTILE_SECRET_KEY,
      clientIp
    );

    if (!turnstileResult.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Security verification failed",
          error_code: ERROR_CODES.TURNSTILE_VERIFICATION_FAILED,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Check rate limit (5 requests per hour per IP)
    const rateLimit = await checkKVRateLimit(env.RATE_LIMIT_KV, clientIp, "guest-booking", 5, 3600);

    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Rate limit exceeded. Please try again later.",
          error_code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
          retry_after: rateLimit.resetTime - Math.floor(Date.now() / 1000),
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "X-RateLimit-Limit": "5",
            "X-RateLimit-Remaining": rateLimit.remaining.toString(),
            "X-RateLimit-Reset": rateLimit.resetTime.toString(),
            "Retry-After": (rateLimit.resetTime - Math.floor(Date.now() / 1000)).toString(),
          },
        }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    // 4. Check idempotency (48-hour window)
    const idempotencyKey = data.idempotency_key || crypto.randomUUID();
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const { data: existing } = await supabase
      .from("idempotency_keys")
      .select("booking_id, bookings(*)")
      .eq("key", idempotencyKey)
      .gte("created_at", fortyEightHoursAgo.toISOString())
      .maybeSingle();

    if (existing) {
      // Return existing booking (duplicate detected)
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

    // 5. Fetch pricing configuration and validate capacity
    const { data: config } = await supabase
      .from("pricing_config")
      .select("*")
      .eq("id", "default")
      .single();

    if (!config) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Configuration not found. Please contact support.",
          error_code: ERROR_CODES.INTERNAL_ERROR,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validation 1: Guest capacity per unit (physical limit)
    const maxCapacity = config.max_capacity_per_unit;

    for (const unitRequest of data.unit_requests) {
      if (unitRequest.guests_per_unit > maxCapacity) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Maximum ${maxCapacity} guests per unit`,
            error_code: ERROR_CODES.CAPACITY_EXCEEDED,
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
          error_code: ERROR_CODES.UNIT_LIMIT_EXCEEDED,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Note: We do NOT validate availability (whether units are currently booked)
    // Admin handles availability during unit assignment

    // 6. Call PostgreSQL pricing function (AUTHORITATIVE)
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

    if (pricingError) {
      console.error("[PRICING] Error:", pricingError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Pricing calculation failed",
          error_code: ERROR_CODES.DATABASE_ERROR,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pricing = pricingResult;

    // 7. Sanitize inputs (DOMPurify)
    const sanitizedData = {
      guest_name: DOMPurify.sanitize(data.guest_name, { ALLOWED_TAGS: [] }),
      special_requests: data.special_requests
        ? DOMPurify.sanitize(data.special_requests, { ALLOWED_TAGS: [] })
        : undefined,
    };

    // 8. Create booking atomically via PostgreSQL function
    const bookingReference = generateBookingReference();
    const totalGuests = data.unit_requests.reduce((sum, r) => sum + r.guests_per_unit, 0);

    const { data: result, error: createError } = await supabase.rpc("create_guest_booking", {
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

    if (createError) {
      console.error("[BOOKING] Creation error:", createError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Booking creation failed",
          error_code: ERROR_CODES.DATABASE_ERROR,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // 9. Build response
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
  } catch (error: any) {
    console.error("[BOOKING] Unexpected error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Booking creation failed",
        error_code: ERROR_CODES.INTERNAL_ERROR,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

/**
 * Generate unique booking reference
 * Format: BK-YYYYMM-XXXXXX
 * Example: BK-202503-A7B9C2
 */
function generateBookingReference(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `BK-${year}${month}-${random}`;
}

// TypeScript environment types
interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  ALLOWED_ORIGINS: string;
  RATE_LIMIT_KV: KVNamespace;
}
```

**Verification**: This is the main endpoint. Test it in Step 10.

---

## Step 7: Create Rates Endpoint (5 minutes)

Implement GET `/api/guest-booking/rates` for displaying static pricing.

### Create `functions/api/guest-booking/rates.ts`

```typescript
import type { Request as CloudflareRequest } from "@cloudflare/workers-types";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/guest-booking/rates
 *
 * Returns current pricing configuration from pricing_config table.
 * Used by frontend to display rate card.
 * Cached for 1 hour (CDN).
 */
export async function onRequest(context: {
  request: CloudflareRequest;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=3600", // 1 hour CDN cache
  };

  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    // Fetch from pricing_config (single source of truth)
    const { data, error } = await supabase
      .from("pricing_config")
      .select(
        "base_rate, weekend_rate, extra_person_rate, base_occupancy, max_capacity_per_unit, downpayment_percent, currency"
      )
      .eq("id", "default")
      .single();

    if (error) {
      console.error("[RATES] Database error:", error);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
  } catch (error: any) {
    console.error("[RATES] Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to fetch configuration" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}
```

**Verification**: Test with `curl -X GET http://localhost:8787/api/guest-booking/rates`

---

## Step 8: Create Discount Rules Endpoint (5 minutes)

Implement GET `/api/guest-booking/discount-rules` for active discounts.

### Create `functions/api/guest-booking/discount-rules.ts`

```typescript
import type { Request as CloudflareRequest } from "@cloudflare/workers-types";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/guest-booking/discount-rules
 *
 * Returns active discount rules for display to guests.
 * Cached for 30 minutes.
 */
export async function onRequest(context: {
  request: CloudflareRequest;
  env: Env;
}): Promise<Response> {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=1800", // 30 minutes
  };

  if (context.request.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

    const { data, error } = await supabase
      .from("discount_rules")
      .select("id, name, description, conditions, discount_type, discount_value, priority")
      .eq("is_active", true)
      .order("priority", { ascending: false });

    if (error) {
      console.error("[DISCOUNTS] Database error:", error);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch discount rules" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find duration discount for display message
    const durationDiscount = data?.find((rule) =>
      rule.conditions.some((c: any) => c.type === "min_nights")
    );

    return new Response(
      JSON.stringify({
        success: true,
        discount_rules: data || [],
        display_message: durationDiscount
          ? `Book ${durationDiscount.conditions.find((c: any) => c.type === "min_nights")?.value}+ nights and save ${durationDiscount.discount_value}%!`
          : null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[DISCOUNTS] Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to fetch discount rules" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}
```

**Verification**: Test with `curl -X GET http://localhost:8787/api/guest-booking/discount-rules`

---

## Step 9: Create Preview Pricing Endpoint (10 minutes)

Implement POST `/api/guest-booking/preview-pricing` for real-time calculations.

### Create `functions/api/guest-booking/preview-pricing.ts`

```typescript
import type { Request as CloudflareRequest } from "@cloudflare/workers-types";
import { createClient } from "@supabase/supabase-js";

import { checkKVRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/types/guest-booking-multi-unit";

/**
 * POST /api/guest-booking/preview-pricing
 *
 * Real-time pricing preview by calling PostgreSQL calculate_booking_pricing() function.
 * This endpoint is NOT a separate calculator - it wraps the authoritative function.
 *
 * Debounced client-side (500ms) for UX.
 * No caching (real-time calculations).
 */
export async function onRequest(context: {
  request: CloudflareRequest;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache", // No caching for preview
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";

    // Rate limit: 20 requests per hour per IP
    const rateLimit = await checkKVRateLimit(
      env.RATE_LIMIT_KV,
      clientIp,
      "preview-pricing",
      20,
      3600
    );

    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Too many preview requests. Please try again later.",
          error_code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "X-RateLimit-Remaining": rateLimit.remaining.toString(),
            "Retry-After": (rateLimit.resetTime - Math.floor(Date.now() / 1000)).toString(),
          },
        }
      );
    }

    const { unit_requests, check_in, check_out } = await request.json();

    // Validate input
    if (!unit_requests || !Array.isArray(unit_requests) || unit_requests.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid unit_requests",
          error_code: ERROR_CODES.VALIDATION_ERROR,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    // Call PostgreSQL pricing function (AUTHORITATIVE)
    const { data: pricing, error } = await supabase.rpc("calculate_booking_pricing", {
      p_unit_requests: unit_requests,
      p_check_in: check_in,
      p_check_out: check_out,
    });

    if (error) {
      console.error("[PREVIEW] Pricing error:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Pricing calculation failed",
          error_code: ERROR_CODES.DATABASE_ERROR,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        pricing: pricing,
        _note: "PREVIEW ONLY - Final pricing calculated at booking submission",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[PREVIEW] Unexpected error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Pricing preview failed",
        error_code: ERROR_CODES.INTERNAL_ERROR,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  RATE_LIMIT_KV: KVNamespace;
}
```

**Verification**: Test with curl (see Step 10).

---

## Step 10: Test Endpoints with curl (15 minutes)

Verify all endpoints work correctly.

### Test 1: Get Rates

```bash
curl -X GET http://localhost:8787/api/guest-booking/rates \
  -H "Content-Type: application/json"

# Expected response:
# {
#   "success": true,
#   "rates": {
#     "base_rate": 3000.00,
#     "weekend_rate": 3500.00,
#     "extra_person_rate": 500.00,
#     "base_occupancy": 2,
#     "max_capacity_per_unit": 20,
#     "max_units_in_system": 10,
#     "downpayment_percentage": 50.00,
#     "currency": "PHP"
#   }
# }
```

### Test 2: Get Discount Rules

```bash
curl -X GET http://localhost:8787/api/guest-booking/discount-rules \
  -H "Content-Type: application/json"

# Expected response:
# {
#   "success": true,
#   "discount_rules": [
#     {
#       "id": "...",
#       "name": "Week Stay Discount",
#       "description": "5% off for 7+ nights",
#       "conditions": [{"type": "min_nights", "value": 7}],
#       "discount_value": 5.00
#     }
#   ],
#   "display_message": "Book 7+ nights and save 5%!"
# }
```

### Test 3: Preview Pricing

```bash
curl -X POST http://localhost:8787/api/guest-booking/preview-pricing \
  -H "Content-Type: application/json" \
  -d '{
    "unit_requests": [
      {"guests_per_unit": 2},
      {"guests_per_unit": 3}
    ],
    "check_in": "2025-11-01T14:00:00Z",
    "check_out": "2025-11-08T11:00:00Z"
  }'

# Expected response:
# {
#   "success": true,
#   "pricing": {
#     "nights": 7,
#     "total_units": 2,
#     "total_guests": 5,
#     "weekend_nights": 1,
#     "base_total": 42000.00,
#     "weekend_surcharge": 1000.00,
#     "extra_person_fees": 3500.00,
#     "subtotal": 46500.00,
#     "discount": {
#       "percent": 5.00,
#       "amount": 2325.00,
#       "rule_name": "Week Stay Discount"
#     },
#     "total": 44175.00,
#     "downpayment_required": 22087.50
#   },
#   "_note": "PREVIEW ONLY - Final pricing calculated at booking submission"
# }
```

### Test 4: Create Booking (Production Token Required)

```bash
# Note: Replace test-token with actual Turnstile token from widget
curl -X POST http://localhost:8787/api/guest-booking \
  -H "Content-Type: application/json" \
  -d '{
    "guest_name": "Test Guest",
    "email": "test@example.com",
    "phone_number": "+1234567890",
    "check_in": "2025-11-01T14:00:00Z",
    "check_out": "2025-11-08T11:00:00Z",
    "unit_requests": [
      {"guests_per_unit": 2},
      {"guests_per_unit": 3}
    ],
    "turnstile_token": "1x00000000000000000000AA",
    "terms_accepted": true
  }'

# Expected response:
# {
#   "success": true,
#   "booking": {
#     "booking_id": "...",
#     "booking_reference": "BK-202511-ABC123",
#     "total_amount": 44175.00,
#     "downpayment_amount": 22087.50
#   },
#   "unit_requests": [...],
#   "pricing_breakdown": {...},
#   "message": "Booking created. Downpayment: ₱22,087.50. Admin will assign units within 24 hours."
# }
```

**Note**: For development, use Turnstile test token `1x00000000000000000000AA` (always passes).

---

## Step 11: Test Idempotency (5 minutes)

Verify duplicate prevention works.

```bash
# Send same request twice with identical idempotency_key
curl -X POST http://localhost:8787/api/guest-booking \
  -H "Content-Type: application/json" \
  -d '{
    "guest_name": "Test Guest",
    "email": "test@example.com",
    "phone_number": "+1234567890",
    "check_in": "2025-11-01T14:00:00Z",
    "check_out": "2025-11-08T11:00:00Z",
    "unit_requests": [{"guests_per_unit": 2}],
    "turnstile_token": "1x00000000000000000000AA",
    "terms_accepted": true,
    "idempotency_key": "550e8400-e29b-41d4-a716-446655440000"
  }'

# First request: Creates booking (201 Created)
# Second request: Returns existing booking with "is_duplicate": true (200 OK)
```

**Expected**: Second request returns `"is_duplicate": true` and the same booking reference.

---

## Step 12: Test Rate Limiting (5 minutes)

Verify rate limits enforce properly.

```bash
# Send 6 requests rapidly (limit is 5 per hour)
for i in {1..6}; do
  echo "Request $i"
  curl -X POST http://localhost:8787/api/guest-booking/preview-pricing \
    -H "Content-Type: application/json" \
    -d '{
      "unit_requests": [{"guests_per_unit": 2}],
      "check_in": "2025-11-01T14:00:00Z",
      "check_out": "2025-11-04T11:00:00Z"
    }'
  echo ""
done

# Expected:
# Requests 1-20: 200 OK (preview has 20 requests/hour limit)
# Request 21: 429 Too Many Requests with Retry-After header
```

**Expected**: Request 21+ returns 429 status with rate limit headers.

---

## Done! ✅

### What You've Accomplished

- ✅ Created 4 API endpoints (guest-booking, rates, discount-rules, preview-pricing)
- ✅ Implemented Turnstile CAPTCHA verification
- ✅ Implemented KV-based rate limiting
- ✅ Created idempotency checking (48-hour window)
- ✅ Validated capacity constraints
- ✅ Integrated PostgreSQL pricing function (server-side authority)
- ✅ Sanitized user inputs with DOMPurify
- ✅ Tested all endpoints with curl
- ✅ Verified idempotency prevents duplicates
- ✅ Verified rate limiting enforces limits

### Next Steps

1. **Run Complete Verification** - Execute all tests in `checkpoint.md`
2. **Commit Changes** - `git add . && git commit -m "feat: complete chunk 004-core-api-endpoints"`
3. **Tag Milestone** - `git tag chunk-004`
4. **Move to Chunk 005** - Idempotency and Rate Limiting (advanced cleanup)
   - OR **Chunk 006** - Date and Unit Selection UI (start frontend)

### If Something Failed

- Consult `troubleshooting.md` for common issues
- Check Cloudflare Workers logs for errors
- Verify environment variables are set correctly
- Verify Turnstile keys are valid
- Ask for help if stuck

---

**Congratulations!** You've completed Chunk 004. The core API endpoints for multi-unit guest booking are now functional.
