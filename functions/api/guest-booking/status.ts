import { z } from "zod";

import { checkKVRateLimit, createAdvancedFingerprint } from "@/lib/kv-rate-limit";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getClientIp, verifyTurnstile } from "@/lib/turnstile";

// Environment type
interface Env {
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_URL: string;
  RATE_LIMIT_KV: KVNamespace;
  TURNSTILE_SECRET_KEY?: string;
  ENVIRONMENT: "production" | "development";
}

// Request validation schema
const statusCheckSchema = z.object({
  booking_reference: z.string().regex(/^BK-\d{4}-[A-Z0-9]{6}$/),
  email: z.string().email().toLowerCase(),
  turnstile_token: z.string().optional(), // Optional, required after rate limiting
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
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

// Handle OPTIONS request
export async function onRequestOptions(context: { request: Request }): Promise<Response> {
  const corsHeaders = getCorsHeaders(context.request.headers.get("Origin"));
  return new Response(null, { headers: corsHeaders });
}

// Handle POST request for status check
export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request.headers.get("Origin"));

  try {
    // Enhanced rate limiting with fingerprinting
    const clientIp = getClientIp(request);
    const fingerprint = await createAdvancedFingerprint(request);

    // Use fingerprint for more accurate rate limiting
    const rateLimitKey = `status:${fingerprint}`;
    const rateLimitResult = await checkKVRateLimit(env.RATE_LIMIT_KV, rateLimitKey, {
      limit: 20,
      windowSeconds: 3600,
      environment: env.ENVIRONMENT, // Development bypass enabled
    });

    // Check if CAPTCHA is required (after 20 attempts)
    const requiresCaptcha = !rateLimitResult.allowed && env.ENVIRONMENT === "production";

    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          error: "RATE_LIMITED",
          message: "Too many status checks. Please complete the security check below.",
          retryAfter: rateLimitResult.retryAfter,
          requiresCaptcha, // Signal frontend to show Turnstile
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(rateLimitResult.retryAfter),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    // Parse and validate request
    const body = await request.json();
    const validationResult = statusCheckSchema.safeParse(body);

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: "Validation error",
          message: "Invalid booking reference or email format",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { booking_reference, email, turnstile_token } = validationResult.data;

    // Optional Turnstile verification for high-volume users
    if (turnstile_token && env.TURNSTILE_SECRET_KEY) {
      const isValid = await verifyTurnstile(turnstile_token, env.TURNSTILE_SECRET_KEY, {
        remoteip: clientIp,
        expectedHostname: new URL(request.url).hostname,
        expectedAction: "status-check",
      });

      if (!isValid) {
        return new Response(
          JSON.stringify({
            error: "CAPTCHA_FAILED",
            message: "Security verification failed. Please try again.",
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Reset rate limit on successful CAPTCHA (give them more attempts)
      await env.RATE_LIMIT_KV.delete(rateLimitKey);
    }

    // Create Supabase admin client
    const supabaseAdmin = createSupabaseAdmin(env);

    // Query booking with dual-factor verification
    const { data: booking, error } = await supabaseAdmin
      .from("bookings")
      .select(
        `
        booking_id,
        booking_reference,
        booking_status,
        payment_status,
        check_in,
        check_out,
        total_amount,
        num_guests,
        special_requests,
        created_at,
        upload_status,
        unit:units(unit_name, unit_type)
      `
      )
      .eq("booking_reference", booking_reference)
      .eq("email", email)
      .eq("is_guest_booking", true)
      .single();

    if (error || !booking) {
      // Don't reveal if booking exists but email doesn't match
      return new Response(
        JSON.stringify({
          error: "BOOKING_NOT_FOUND",
          message: "No booking found with the provided reference and email combination",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Prepare response with limited information
    const statusResponse = {
      booking_reference: booking.booking_reference,
      status: booking.booking_status,
      payment_status: booking.payment_status,
      check_in: booking.check_in,
      check_out: booking.check_out,
      total_amount: booking.total_amount,
      num_guests: booking.num_guests,
      unit_name: booking.unit?.unit_name,
      unit_type: booking.unit?.unit_type,
      created_at: booking.created_at,
      upload_status: booking.upload_status || "pending",
      special_requests: booking.special_requests,
      message: getStatusMessage(booking.booking_status, booking.payment_status),
    };

    return new Response(JSON.stringify(statusResponse), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Status check error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: "Failed to retrieve booking status",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * Generate user-friendly status message
 */
function getStatusMessage(bookingStatus: string, paymentStatus: string): string {
  if (bookingStatus === "Cancelled") {
    return "This booking has been cancelled. Please contact support for assistance.";
  }

  if (bookingStatus === "Confirmed" && paymentStatus === "Paid") {
    return "Your booking is confirmed! You will receive check-in details via email.";
  }

  if (bookingStatus === "Confirmed" && paymentStatus === "Partial") {
    return "Your booking is confirmed with partial payment. Please settle the remaining balance upon arrival.";
  }

  if (bookingStatus === "Pending" && paymentStatus === "Pending") {
    return "Your booking is pending payment verification. We'll confirm within 24 hours.";
  }

  if (bookingStatus === "Pending") {
    return "Your booking is being reviewed by our team. You'll receive confirmation soon.";
  }

  return "Please contact support for assistance with your booking.";
}
