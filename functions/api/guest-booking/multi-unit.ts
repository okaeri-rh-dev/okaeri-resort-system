import type { PagesFunction } from "@cloudflare/workers-types";
import { createClient } from "@supabase/supabase-js";

import { checkKVRateLimit } from "@/lib/kv-rate-limit";
import { sanitizeNameWorker, sanitizeTextWorker } from "@/lib/security/sanitize-worker";
import { getClientIp, verifyTurnstile } from "@/lib/turnstile";
import {
  ERROR_CODES,
  multiUnitBookingSchema,
  type MultiUnitBookingResponse,
} from "@/types/guest-booking-multi-unit";

/**
 * POST /api/guest-booking/multi-unit
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

// Environment type for Cloudflare Pages
interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  ALLOWED_ORIGINS?: string;
  RATE_LIMIT_KV: KVNamespace;
}

// CORS helper
function getCorsHeaders(origin?: string | null, allowedOriginsStr?: string) {
  const allowedOrigins = allowedOriginsStr
    ? allowedOriginsStr.split(",")
    : ["http://localhost:5173", "https://okaeri-resort-system.pages.dev"];

  const isAllowed = origin && allowedOrigins.includes(origin);

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowedOrigins[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Idempotency-Key",
  };
}

// Handle OPTIONS preflight
export const onRequestOptions: PagesFunction<Env> = async (context) => {
  const corsHeaders = getCorsHeaders(
    context.request.headers.get("Origin"),
    context.env.ALLOWED_ORIGINS
  );
  return new Response(null, { headers: corsHeaders });
};

// Handle POST request
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request.headers.get("Origin"), env.ALLOWED_ORIGINS);

  try {
    // 1. Parse and validate request
    const body = await request.json();
    const validation = multiUnitBookingSchema.safeParse(body);

    if (!validation.success) {
      return Response.json(
        {
          success: false,
          error: "Validation failed",
          error_code: ERROR_CODES.VALIDATION_ERROR,
          details: validation.error.flatten(),
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const data = validation.data;
    const clientIp = getClientIp(request);

    // 2. Verify Turnstile CAPTCHA
    const turnstileValid = await verifyTurnstile(data.turnstile_token, env.TURNSTILE_SECRET_KEY, {
      remoteip: clientIp,
      expectedHostname: "okaeri-resort-system.pages.dev",
      expectedAction: "guest-booking-multi-unit",
    });

    if (!turnstileValid) {
      return Response.json(
        {
          success: false,
          error: "Security verification failed",
          error_code: ERROR_CODES.TURNSTILE_VERIFICATION_FAILED,
        },
        { status: 403, headers: corsHeaders }
      );
    }

    // 3. Check rate limit (5 requests per hour per IP)
    const rateLimit = await checkKVRateLimit(env.RATE_LIMIT_KV, clientIp, {
      limit: 5,
      windowSeconds: 3600,
    });

    if (!rateLimit.allowed) {
      return Response.json(
        {
          success: false,
          error: "Rate limit exceeded. Please try again later.",
          error_code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
          retry_after: rateLimit.retryAfter,
        },
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "X-RateLimit-Limit": "5",
            "X-RateLimit-Remaining": rateLimit.remaining.toString(),
            "X-RateLimit-Reset": rateLimit.retryAfter.toString(),
            "Retry-After": rateLimit.retryAfter.toString(),
          },
        }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 4. Check idempotency (48-hour window)
    const idempotencyKey = data.idempotency_key || crypto.randomUUID();
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const { data: existing } = await supabase
      .from("idempotency_keys")
      .select("booking_id, bookings(*)")
      .eq("key", idempotencyKey)
      .gte("created_at", fortyEightHoursAgo.toISOString())
      .maybeSingle();

    if (existing && existing.bookings) {
      // Return existing booking (duplicate detected)
      return Response.json(
        {
          success: true,
          booking: existing.bookings,
          message: "Booking already created (duplicate detected)",
          is_duplicate: true,
        },
        { status: 200, headers: corsHeaders }
      );
    }

    // 5. Fetch pricing configuration and validate capacity
    const { data: config, error: configError } = await supabase
      .from("pricing_config")
      .select("*")
      .eq("id", "default")
      .single();

    if (configError || !config) {
      console.error("[PRICING_CONFIG] Error:", configError);
      return Response.json(
        {
          success: false,
          error: "Configuration not found. Please contact support.",
          error_code: ERROR_CODES.INTERNAL_ERROR,
        },
        { status: 500, headers: corsHeaders }
      );
    }

    // Validation 1: Guest capacity per unit (physical limit)
    const maxCapacity = config.max_capacity_per_unit;

    for (const unitRequest of data.unit_requests) {
      if (unitRequest.guests_per_unit > maxCapacity) {
        return Response.json(
          {
            success: false,
            error: `Maximum ${maxCapacity} guests per unit`,
            error_code: ERROR_CODES.CAPACITY_EXCEEDED,
          },
          { status: 400, headers: corsHeaders }
        );
      }
    }

    // Validation 2: Booking size vs system capacity
    const { count: systemUnitCount } = await supabase
      .from("units")
      .select("*", { count: "exact", head: true })
      .eq("unit_status", "Available");

    if (data.unit_requests.length > (systemUnitCount || 0)) {
      return Response.json(
        {
          success: false,
          error: `Maximum ${systemUnitCount} units available in system`,
          error_code: ERROR_CODES.UNIT_LIMIT_EXCEEDED,
        },
        { status: 400, headers: corsHeaders }
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

    if (pricingError || !pricingResult) {
      console.error("[PRICING] Error:", pricingError);
      return Response.json(
        {
          success: false,
          error: "Pricing calculation failed",
          error_code: ERROR_CODES.DATABASE_ERROR,
          details: pricingError?.message,
        },
        { status: 500, headers: corsHeaders }
      );
    }

    const pricing = pricingResult;

    // 7. Sanitize inputs (Worker-compatible sanitization)
    const sanitizedData = {
      guest_name: sanitizeNameWorker(data.guest_name),
      special_requests: data.special_requests
        ? sanitizeTextWorker(data.special_requests)
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
        discount_percent: pricing.discount?.percent || null,
        discount_amount: pricing.discount?.amount || null,
        downpayment_required: pricing.downpayment_required,
        pricing_snapshot: pricing,
        special_requests: sanitizedData.special_requests || null,
      },
      p_unit_requests: unitRequestsJson,
      p_idempotency_key: idempotencyKey,
    });

    if (createError || !result) {
      console.error("[BOOKING] Creation error:", createError);
      return Response.json(
        {
          success: false,
          error: "Booking creation failed",
          error_code: ERROR_CODES.DATABASE_ERROR,
          details: createError?.message,
        },
        { status: 500, headers: corsHeaders }
      );
    }

    // Check for duplicate
    if (result.is_duplicate) {
      return Response.json(
        {
          success: true,
          is_duplicate: true,
          booking: result.booking,
          message: "Booking already created (duplicate detected)",
        },
        { status: 200, headers: corsHeaders }
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

    return Response.json(response, {
      status: 201,
      headers: corsHeaders,
    });
  } catch (error: unknown) {
    console.error("[BOOKING] Unexpected error:", error);
    return Response.json(
      {
        success: false,
        error: "Booking creation failed",
        error_code: ERROR_CODES.INTERNAL_ERROR,
        details: error.message,
      },
      { status: 500, headers: corsHeaders }
    );
  }
};

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
