import type { PagesFunction } from "@cloudflare/workers-types";
import { createClient } from "@supabase/supabase-js";

import { checkKVRateLimit, getClientIp } from "@/lib/kv-rate-limit";
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

// Environment type
interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RATE_LIMIT_KV: KVNamespace;
}

// CORS helper
function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-cache", // No caching for preview
  };
}

// Handle OPTIONS preflight
export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { headers: getCorsHeaders() });
};

// Handle POST request
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders();

  try {
    const clientIp = getClientIp(request);

    // Rate limit: 20 requests per hour per IP (more generous for preview)
    const rateLimit = await checkKVRateLimit(env.RATE_LIMIT_KV, clientIp, {
      limit: 20,
      windowSeconds: 3600,
      environment: env.ENVIRONMENT, // Development bypass enabled
    });

    if (!rateLimit.allowed) {
      return Response.json(
        {
          success: false,
          error: "Too many preview requests. Please try again later.",
          error_code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
        },
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "X-RateLimit-Remaining": rateLimit.remaining.toString(),
            "Retry-After": rateLimit.retryAfter.toString(),
          },
        }
      );
    }

    const body = await request.json();
    const { unit_requests, check_in, check_out } = body;

    // Validate input
    if (!unit_requests || !Array.isArray(unit_requests) || unit_requests.length === 0) {
      return Response.json(
        {
          success: false,
          error: "Invalid unit_requests",
          error_code: ERROR_CODES.VALIDATION_ERROR,
        },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!check_in || !check_out) {
      return Response.json(
        {
          success: false,
          error: "Missing check_in or check_out dates",
          error_code: ERROR_CODES.VALIDATION_ERROR,
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Call PostgreSQL pricing function (AUTHORITATIVE)
    const { data: pricing, error } = await supabase.rpc("calculate_booking_pricing", {
      p_unit_requests: unit_requests,
      p_check_in: check_in,
      p_check_out: check_out,
    });

    if (error) {
      console.error("[PREVIEW] Pricing error:", error);
      return Response.json(
        {
          success: false,
          error: "Pricing calculation failed",
          error_code: ERROR_CODES.DATABASE_ERROR,
          details: error.message,
        },
        { status: 500, headers: corsHeaders }
      );
    }

    return Response.json(
      {
        success: true,
        pricing: pricing,
        _note: "PREVIEW ONLY - Final pricing calculated at booking submission",
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error: unknown) {
    console.error("[PREVIEW] Unexpected error:", error);
    return Response.json(
      {
        success: false,
        error: "Pricing preview failed",
        error_code: ERROR_CODES.INTERNAL_ERROR,
        details: error.message,
      },
      { status: 500, headers: corsHeaders }
    );
  }
};
