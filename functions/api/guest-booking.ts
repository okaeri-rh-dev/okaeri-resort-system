import { z } from "zod";

import { createResendClient, sendBookingConfirmation } from "@/lib/email";
import { checkIdempotency, getIdempotencyKey, setIdempotencyResult } from "@/lib/idempotency";
import { checkKVRateLimit } from "@/lib/kv-rate-limit";
import { sanitizeNameWorker, sanitizeTextWorker } from "@/lib/security/sanitize-worker";
import {
  checkUnitAvailability,
  createSupabaseAdmin,
  findOrCreateGuest,
  generateSignedUploadUrl,
} from "@/lib/supabase-admin";
import { getClientIp, verifyTurnstile } from "@/lib/turnstile";
import { generateBookingReference } from "@/utils/booking-reference";
import { calculatePricing } from "@/utils/pricing";

// Environment type for Cloudflare
interface Env {
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_URL: string;
  TURNSTILE_SECRET_KEY: string;
  RESEND_API_KEY: string;
  RATE_LIMIT_KV: KVNamespace;
}

// Request validation schema
const guestBookingSchema = z.object({
  guest_name: z
    .string()
    .min(2)
    .max(100)
    .transform((val) => sanitizeNameWorker(val)),
  email: z.string().email().toLowerCase(),
  phone_number: z
    .string()
    .regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,10}$/),
  unit_id: z.string().uuid(),
  check_in: z.string().datetime(),
  check_out: z.string().datetime(),
  num_guests: z.number().min(1).max(20),
  special_requests: z
    .string()
    .max(500)
    .optional()
    .transform((val) => (val ? sanitizeTextWorker(val) : undefined)),
  turnstile_token: z.string(),
  file_name: z.string().max(255),
  file_type: z.enum(["image/jpeg", "image/png", "image/jpg", "image/webp", "application/pdf"]),
  file_size: z.number().max(2 * 1024 * 1024), // 2MB max
});

// CORS headers helper
function getCorsHeaders(origin?: string | null) {
  const allowedOrigins = [
    "https://okaeri-resort-system.pages.dev",
    /^https:\/\/[a-z0-9-]+\.okaeri-resort-system\.pages\.dev$/,
  ];

  const isAllowed =
    origin &&
    allowedOrigins.some((allowed) =>
      typeof allowed === "string" ? allowed === origin : allowed.test(origin)
    );

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "https://okaeri-resort-system.pages.dev",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Idempotency-Key",
  };
}

// Handle OPTIONS request
export async function onRequestOptions(context: { request: Request }): Promise<Response> {
  const corsHeaders = getCorsHeaders(context.request.headers.get("Origin"));
  return new Response(null, { headers: corsHeaders });
}

// Handle POST request for guest booking
export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request.headers.get("Origin"));

  try {
    // Get client IP for rate limiting
    const clientIp = getClientIp(request);

    // Check KV rate limit (5 bookings per hour per IP)
    const rateLimitResult = await checkKVRateLimit(env.RATE_LIMIT_KV, clientIp, {
      limit: 5,
      windowSeconds: 3600, // 1 hour
    });

    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          error: "Too many requests",
          message: "Please wait before submitting another booking",
          retryAfter: rateLimitResult.retryAfter,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(rateLimitResult.retryAfter),
          },
        }
      );
    }

    // Check idempotency
    const idempotencyKey = await getIdempotencyKey(request);
    const idempotencyCheck = await checkIdempotency(
      env.RATE_LIMIT_KV,
      `idempotency:${idempotencyKey}`
    );

    if (idempotencyCheck.isProcessed && idempotencyCheck.response) {
      return new Response(idempotencyCheck.response, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-Idempotency-Cached": "true",
        },
      });
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = guestBookingSchema.safeParse(body);

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: "Validation failed",
          errors: validationResult.error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = validationResult.data;

    // Verify Turnstile CAPTCHA
    const turnstileValid = await verifyTurnstile(data.turnstile_token, env.TURNSTILE_SECRET_KEY, {
      remoteip: clientIp,
      expectedHostname: "okaeri-resort-system.pages.dev",
      expectedAction: "guest-booking",
    });

    if (!turnstileValid) {
      return new Response(
        JSON.stringify({
          error: "CAPTCHA verification failed",
          message: "Please complete the CAPTCHA challenge",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Supabase admin client
    const supabaseAdmin = createSupabaseAdmin(env);

    // Check unit availability
    const isAvailable = await checkUnitAvailability(
      supabaseAdmin,
      data.unit_id,
      data.check_in,
      data.check_out
    );

    if (!isAvailable) {
      return new Response(
        JSON.stringify({
          error: "AVAILABILITY_CONFLICT",
          message: "The selected unit is not available for these dates",
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get unit details for pricing calculation
    const { data: unit, error: unitError } = await supabaseAdmin
      .from("units")
      .select("*")
      .eq("unit_id", data.unit_id)
      .single();

    if (unitError || !unit) {
      return new Response(
        JSON.stringify({
          error: "Invalid unit",
          message: "Could not find unit details",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Calculate pricing
    const checkIn = new Date(data.check_in);
    const checkOut = new Date(data.check_out);

    const pricing = calculatePricing(unit, {
      checkIn,
      checkOut,
      guestCount: data.num_guests,
      includeTaxes: true,
    });

    const totalAmount = pricing.totalAmount;

    // Find or create guest
    const guestId = await findOrCreateGuest(supabaseAdmin, {
      guest_name: data.guest_name,
      email: data.email,
      phone_number: data.phone_number,
    });

    // Generate booking reference
    const bookingReference = generateBookingReference();

    // Create booking record
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .insert({
        booking_reference: bookingReference,
        unit_id: data.unit_id,
        guest_id: guestId,
        guest_name: data.guest_name,
        contact_number: data.phone_number,
        email: data.email,
        num_guests: data.num_guests,
        check_in: data.check_in,
        check_out: data.check_out,
        total_amount: totalAmount,
        booking_status: "Pending",
        payment_status: "Pending",
        special_requests: data.special_requests,
        is_guest_booking: true, // Identifies guest bookings
        upload_status: "pending", // Set initial upload status
        upload_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
      })
      .select()
      .single();

    if (bookingError || !booking) {
      console.error("Failed to create booking:", bookingError);
      return new Response(
        JSON.stringify({
          error: "BOOKING_CREATE_FAILED",
          message: "Could not process your booking request",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate signed upload URL
    const fileExt = data.file_name.split(".").pop()?.toLowerCase() || "jpg";
    const fileName = `${Date.now()}_${crypto.randomUUID().substring(0, 8)}.${fileExt}`;
    const filePath = `guest-bookings/${booking.booking_id}/${fileName}`;

    const uploadCredentials = await generateSignedUploadUrl(
      supabaseAdmin,
      "payment-proofs",
      filePath,
      3600 // 1 hour expiry
    );

    // Send confirmation email (async, don't wait)
    const resend = createResendClient(env.RESEND_API_KEY);
    sendBookingConfirmation(resend, {
      to: data.email,
      bookingReference,
      guestName: data.guest_name,
      checkIn: checkIn.toLocaleDateString(),
      checkOut: checkOut.toLocaleDateString(),
      totalAmount,
    }).catch((error) => {
      console.error("Failed to send confirmation email:", error);
      // Don't fail the request if email fails
    });

    // Prepare success response
    const successResponse = JSON.stringify({
      success: true,
      booking: {
        booking_id: booking.booking_id,
        booking_reference: bookingReference,
        total_amount: totalAmount,
      },
      upload: {
        path: uploadCredentials.path,
        token: uploadCredentials.token,
        bucket: uploadCredentials.bucket,
        expires_at: uploadCredentials.expires_at,
      },
      message: "Booking created successfully. Please upload your payment proof within 1 hour.",
    });

    // Cache successful response for idempotency
    await setIdempotencyResult(
      env.RATE_LIMIT_KV,
      `idempotency:${idempotencyKey}`,
      successResponse,
      600 // 10 minutes
    );

    return new Response(successResponse, {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Guest booking error:", error);

    return new Response(
      JSON.stringify({
        error: "INTERNAL_ERROR",
        message: "An unexpected error occurred. Please try again later.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}
