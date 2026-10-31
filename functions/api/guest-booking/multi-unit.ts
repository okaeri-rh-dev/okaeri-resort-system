import { createClient } from "@supabase/supabase-js";

import { isBlockedNightError } from "@/lib/bookings/availability";
import { generateGuestBookingReference } from "@/lib/bookings/reference";
import { toStayInstants } from "@/lib/bookings/stay";
import { checkKVRateLimit } from "@/lib/kv-rate-limit";
import { sanitizeNameWorker, sanitizeTextWorker } from "@/lib/security/sanitize-worker";
import { getClientIp, verifyTurnstile } from "@/lib/turnstile";
import type { Database, Json } from "@/types/database.types";
import {
  ERROR_CODES,
  multiUnitBookingSchema,
  type CreatedMultiUnitBookingResponse,
  type DuplicateMultiUnitBookingResponse,
} from "@/types/guest-booking-multi-unit";

import { toGuestBookingData } from "../../lib/guest-booking-data";
import { calculateBookingPrice } from "../../lib/pricing";

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
// Subset of the jsonb built by create_guest_booking (20261030400000)
interface CreateGuestBookingResult {
  booking: { booking_id: string; booking_reference: string };
  is_duplicate?: boolean;
}

function isCreateGuestBookingResult(result: Json): result is Json & CreateGuestBookingResult {
  if (typeof result !== "object" || result === null || Array.isArray(result)) return false;
  const { booking } = result;
  return (
    typeof booking === "object" &&
    booking !== null &&
    !Array.isArray(booking) &&
    typeof booking.booking_id === "string" &&
    typeof booking.booking_reference === "string"
  );
}

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  RATE_LIMIT_KV: KVNamespace;
  ENVIRONMENT?: string;
}

// Handle POST request
export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

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
        { status: 400 }
      );
    }

    const data = validation.data;
    const clientIp = getClientIp(request);

    // 2. Verify Turnstile CAPTCHA
    const turnstileValid = await verifyTurnstile(data.turnstile_token, env.TURNSTILE_SECRET_KEY, {
      remoteip: clientIp,
      expectedHostname: "okaeri-resort.pages.dev",
      expectedAction: "guest-booking-multi-unit",
      environment: env.ENVIRONMENT || "production", // Pass environment for dev bypass
      skipInDev: true, // Enable development mode bypass
    });

    if (!turnstileValid) {
      return Response.json(
        {
          success: false,
          error: "Security verification failed",
          error_code: ERROR_CODES.TURNSTILE_VERIFICATION_FAILED,
        },
        { status: 403 }
      );
    }

    // 3. Check rate limit (5 requests per hour per IP)
    const rateLimit = await checkKVRateLimit(env.RATE_LIMIT_KV, clientIp, {
      limit: 5,
      windowSeconds: 3600,
      environment: env.ENVIRONMENT, // Development bypass enabled
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
            "X-RateLimit-Limit": "5",
            "X-RateLimit-Remaining": rateLimit.remaining.toString(),
            "X-RateLimit-Reset": rateLimit.retryAfter.toString(),
            "Retry-After": rateLimit.retryAfter.toString(),
          },
        }
      );
    }

    // Initialize Supabase client
    const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
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
      const duplicateResponse: DuplicateMultiUnitBookingResponse = {
        success: true,
        booking: existing.bookings,
        message: "Booking already created (duplicate detected)",
        is_duplicate: true,
      };
      return Response.json(duplicateResponse, { status: 200 });
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
        { status: 500 }
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
          { status: 400 }
        );
      }
    }

    // Validation 2: Booking size vs system capacity
    const { count: systemUnitCount } = await supabase
      .from("units")
      .select("*", { count: "exact", head: true });

    if (data.unit_requests.length > (systemUnitCount || 0)) {
      return Response.json(
        {
          success: false,
          error: `Maximum ${systemUnitCount} units available in system`,
          error_code: ERROR_CODES.UNIT_LIMIT_EXCEEDED,
        },
        { status: 400 }
      );
    }

    // Bookings are not checked here: staff assign cabins later. create_guest_booking
    // refuses nights with fewer unblocked cabins than requested.

    // 6. Calculate pricing using Workers pricing library
    // Calculate for each unit and aggregate
    const stay = toStayInstants(data.check_in, data.check_out);
    const checkIn = new Date(stay.check_in);
    const checkOut = new Date(stay.check_out);

    const unitRequestsJson = data.unit_requests.map((r) => ({
      guests_per_unit: r.guests_per_unit,
    }));

    // Declare pricing before try block since it's used after the block
    let pricing: {
      nights: number;
      base_total: number;
      weekend_surcharge: number;
      extra_person_fees: number;
      subtotal: number;
      total: number;
      downpayment_required: number;
      currency: string;
      discount: { percent: number; amount: number; rule_name: string } | null;
      unit_breakdown: Array<{
        unit_index: number;
        guests: number;
        subtotal: number;
        extra_person_fees: number;
        total: number;
        downpayment: number;
      }>;
    };

    try {
      // Calculate pricing for each unit separately
      const unitPricingResults = await Promise.all(
        data.unit_requests.map((unitRequest) =>
          calculateBookingPrice(supabase, {
            checkIn,
            checkOut,
            guestCount: unitRequest.guests_per_unit,
          })
        )
      );

      // Aggregate pricing across all units
      const aggregatedPricing = {
        nights: unitPricingResults[0]?.nights || 0,
        base_total: unitPricingResults.reduce((sum, p) => sum + p.subtotal, 0),
        weekend_surcharge: unitPricingResults.reduce((sum, p) => {
          // Calculate weekend surcharge from nightly breakdown
          const weekendTotal = p.nightlyBreakdown
            .filter((n) => n.isWeekend)
            .reduce((s, n) => s + (n.finalRate - n.baseRate), 0);
          return sum + weekendTotal;
        }, 0),
        extra_person_fees: unitPricingResults.reduce((sum, p) => sum + p.extraPersonTotal, 0),
        subtotal: unitPricingResults.reduce((sum, p) => sum + p.subtotal + p.extraPersonTotal, 0),
        total: unitPricingResults.reduce((sum, p) => sum + p.total, 0),
        downpayment_required: unitPricingResults.reduce((sum, p) => sum + p.downpayment, 0),
        currency: unitPricingResults[0]?.currency || "PHP",
        // Discounts not implemented in pricing lib - will return null
        discount: null as { percent: number; amount: number; rule_name: string } | null,
        // Store breakdown per unit for transparency
        unit_breakdown: unitPricingResults.map((p, i) => ({
          unit_index: i + 1,
          guests: data.unit_requests[i].guests_per_unit,
          subtotal: p.subtotal,
          extra_person_fees: p.extraPersonTotal,
          total: p.total,
          downpayment: p.downpayment,
        })),
      };

      if (aggregatedPricing.total <= 0) {
        console.error("[PRICING] Invalid total calculated:", aggregatedPricing.total);
        return Response.json(
          {
            success: false,
            error: "Pricing calculation failed",
            error_code: ERROR_CODES.DATABASE_ERROR,
            details: "Invalid total amount calculated",
          },
          { status: 500 }
        );
      }

      pricing = aggregatedPricing;
    } catch (pricingError: unknown) {
      console.error("[PRICING] Error:", pricingError);
      return Response.json(
        {
          success: false,
          error: "Pricing calculation failed",
          error_code: ERROR_CODES.DATABASE_ERROR,
          details: pricingError instanceof Error ? pricingError.message : "Unknown pricing error",
        },
        { status: 500 }
      );
    }

    // 7. Sanitize inputs (Worker-compatible sanitization)
    const sanitizedData = {
      guest_name: sanitizeNameWorker(data.guest_name),
      special_requests: data.special_requests
        ? sanitizeTextWorker(data.special_requests)
        : undefined,
    };

    // 8. Create booking atomically via PostgreSQL function
    const bookingReference = generateGuestBookingReference();
    const totalGuests = data.unit_requests.reduce((sum, r) => sum + r.guests_per_unit, 0);

    const { data: result, error: createError } = await supabase.rpc("create_guest_booking", {
      p_turnstile_token: data.turnstile_token || "dev-mock-token",
      p_booking_data: toGuestBookingData({
        bookingReference,
        guestName: sanitizedData.guest_name,
        email: data.email,
        phoneNumber: data.phone_number,
        checkInDay: data.check_in,
        checkOutDay: data.check_out,
        numGuests: totalGuests,
        specialRequests: sanitizedData.special_requests || null,
        pricing,
        paymentProofUrl: data.payment_proof_url ?? null,
        idempotencyKey,
      }),
      p_unit_requests: unitRequestsJson,
      p_guest_data: null, // Guest data is included in p_booking_data for simplified interface
    });

    if (isBlockedNightError(createError)) {
      return Response.json(
        {
          success: false,
          error: "These dates are unavailable. Please choose other dates.",
          error_code: ERROR_CODES.DATES_UNAVAILABLE,
        },
        { status: 409 }
      );
    }

    if (createError || !result) {
      // ============================================================
      // BUG-003 FIX: Improved error handling for guest booking creation
      // ============================================================
      // Previously: Only logged generic error, hiding actual database error
      // Now: Logs full error details and returns specific error code
      // ============================================================

      // Log comprehensive error details for debugging
      console.error("[BOOKING] Creation error details:", {
        error: createError,
        errorMessage: createError?.message,
        errorCode: createError?.code,
        errorHint: createError?.hint,
        errorDetails: createError?.details,
        bookingReference: bookingReference,
        guestName: sanitizedData.guest_name,
        email: data.email,
        checkIn: data.check_in,
        checkOut: data.check_out,
        unitCount: data.unit_requests.length,
        totalGuests: totalGuests,
        pricingTotal: pricing.total,
      });

      // Parse database error for specific error codes
      const errorMessage = createError?.message || "Unknown database error";
      const errorCode = createError?.code;

      // Determine appropriate error response based on PostgreSQL error code
      let errorType: (typeof ERROR_CODES)[keyof typeof ERROR_CODES] = ERROR_CODES.DATABASE_ERROR;
      let userMessage = "Your booking was not saved. Nothing was charged; please try again.";

      if (errorCode === "23505") {
        // Unique violation - likely duplicate booking
        errorType = ERROR_CODES.DUPLICATE_BOOKING;
        userMessage = "A booking with similar details already exists.";
      } else if (errorCode === "23503") {
        // Foreign key violation - invalid reference
        userMessage = "Invalid booking data. Please verify your selections.";
      } else if (errorCode === "23502") {
        // Not null violation - missing required field
        userMessage = "Missing required booking information.";
        console.error("[BOOKING] Missing field:", errorMessage);
      } else if (errorCode === "P0001") {
        // Raised exception from PL/pgSQL
        userMessage = errorMessage.replace("Booking creation failed: ", "");
      }

      return Response.json(
        {
          success: false,
          error: userMessage,
          error_code: errorType,
          details: {
            message: errorMessage,
            code: errorCode,
            hint: createError?.hint,
            // Include booking reference for support inquiries
            booking_reference: bookingReference,
          },
        },
        { status: 500 }
      );
    }

    if (!isCreateGuestBookingResult(result)) {
      throw new Error("create_guest_booking returned an unexpected result");
    }

    // A concurrent submit with the same key got past step 4 first
    if (result.is_duplicate === true) {
      const duplicateResponse: DuplicateMultiUnitBookingResponse = {
        success: true,
        booking: result.booking,
        message: "Booking already created (duplicate detected)",
        is_duplicate: true,
      };
      return Response.json(duplicateResponse, { status: 200 });
    }

    // 9. Build response
    const { booking } = result;
    const response: CreatedMultiUnitBookingResponse = {
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
    });
  } catch (error: unknown) {
    // BUG-003 FIX: Improved error handling for unexpected errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error("[BOOKING] Unexpected error:", {
      message: errorMessage,
      stack: errorStack,
      error: error,
    });

    return Response.json(
      {
        success: false,
        error: "Your booking was not saved. Please try again later.",
        error_code: ERROR_CODES.INTERNAL_ERROR,
        details: {
          message: errorMessage,
        },
      },
      { status: 500 }
    );
  }
};
