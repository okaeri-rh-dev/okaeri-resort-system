/**
 * Public Availability Calendar API Endpoint
 *
 * Returns aggregated availability counts for Okaeri Resort's units.
 * This is a public, unauthenticated endpoint with aggressive caching.
 *
 * VIEW-ONLY: No pricing information, no guest data, no booking details.
 * Supports manager-mediated booking (guest contacts manager after viewing).
 *
 * @endpoint GET /api/public/v1/availability
 * @query start - Start date (ISO 8601, YYYY-MM-DD)
 * @query end - End date (ISO 8601, YYYY-MM-DD)
 * @returns JSON with availability data
 *
 * @example
 * GET /api/public/v1/availability?start=2025-01-01&end=2025-01-31
 *
 * Response:
 * {
 *   "totalUnits": 3,
 *   "dateRange": { "start": "2025-01-01", "end": "2025-01-31" },
 *   "availability": [
 *     { "date": "2025-01-01", "availableCount": 3, "status": "full" },
 *     { "date": "2025-01-15", "availableCount": 2, "status": "moderate" }
 *   ],
 *   "metadata": {
 *     "generatedAt": "2025-01-10T10:30:00Z",
 *     "cacheMaxAge": 300,
 *     "version": "v1"
 *   }
 * }
 */

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import { verifyTurnstile } from "@/lib/turnstile";

import { createLogger } from "../../../lib/logger";
import { toManilaDateString } from "@/lib/timezone";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  ENVIRONMENT?: "production" | "development";
  TURNSTILE_SECRET_KEY?: string;
}

type AvailabilityDay =
  Database["public"]["Functions"]["get_public_aggregate_availability"]["Returns"][number];

type AvailabilityStatus = "full" | "moderate" | "limited" | "booked";

interface AvailabilityResponse {
  totalUnits: number;
  dateRange: {
    start: string;
    end: string;
  };
  availability: Array<{
    date: string;
    availableCount: number;
    status: AvailabilityStatus;
  }>;
  metadata: {
    generatedAt: string;
    cacheMaxAge: number;
    version: string;
  };
}

interface ErrorResponse {
  error: string;
}

export async function onRequest(context: {
  request: Request;
  env: Env;
  waitUntil: (promise: Promise<unknown>) => void;
}) {
  const { request, env, waitUntil } = context;

  // ============================================================================
  // CORS HEADERS (Specific Origins Only)
  // ============================================================================

  const allowedOrigins = [
    "https://okaeri-resort.com",
    "https://www.okaeri-resort.com",
    env.ENVIRONMENT === "development" ? "http://localhost:5173" : null,
  ].filter(Boolean) as string[];

  const origin = request.headers.get("Origin");
  const corsOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  const corsHeaders = {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "false",
  };

  // ============================================================================
  // PREFLIGHT REQUEST HANDLING
  // ============================================================================

  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    });
  }

  // ============================================================================
  // METHOD VALIDATION
  // ============================================================================

  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" } as ErrorResponse), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ============================================================================
    // QUERY PARAMETER PARSING
    // ============================================================================

    const url = new URL(request.url);
    const startParam = url.searchParams.get("start");
    const endParam = url.searchParams.get("end");

    // Default to current month if no parameters provided
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const startDate = startParam || toManilaDateString(defaultStart);
    const endDate = endParam || toManilaDateString(defaultEnd);

    // ============================================================================
    // DATE FORMAT VALIDATION (YYYY-MM-DD)
    // ============================================================================

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return new Response(
        JSON.stringify({
          error: "Invalid date format. Use YYYY-MM-DD (ISO 8601)",
        } as ErrorResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ============================================================================
    // DATE RANGE VALIDATION
    // ============================================================================

    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day (UTC-agnostic)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return new Response(JSON.stringify({ error: "Invalid date values" } as ErrorResponse), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (end < start) {
      return new Response(
        JSON.stringify({ error: "End date must be after or equal to start date" } as ErrorResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Prevent querying past MONTHS (allow current month even if some days have passed)
    // Compare month boundaries, not individual dates
    const startOfCurrentMonth = new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );
    startOfCurrentMonth.setHours(0, 0, 0, 0);

    if (start < startOfCurrentMonth) {
      return new Response(
        JSON.stringify({
          error:
            "Cannot query past months. Please select the current month or a future month.",
        } as ErrorResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Limit future queries to 1 year ahead
    const oneYearFromNow = new Date(today);
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    if (end > oneYearFromNow) {
      return new Response(
        JSON.stringify({ error: "Cannot query more than 1 year in the future" } as ErrorResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Limit range to 180 days
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 180) {
      return new Response(JSON.stringify({ error: "Date range cannot exceed 180 days" } as ErrorResponse), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============================================================================
    // OPTIONAL: TURNSTILE VERIFICATION
    // ============================================================================

    const turnstileToken = url.searchParams.get("cf_turnstile_token");

    if (turnstileToken && env.TURNSTILE_SECRET_KEY) {
      const clientIp = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";

      const isValid = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET_KEY, {
        remoteip: clientIp,
        expectedAction: "view-availability",
      });

      if (!isValid) {
        return new Response(JSON.stringify({ error: "Bot verification failed" } as ErrorResponse), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ============================================================================
    // DATABASE FUNCTION CALL
    // ============================================================================

    const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

    const { data, error } = await supabase.rpc("get_public_aggregate_availability", {
      p_start_date: startDate,
      p_end_date: endDate,
    });

    if (error) {
      console.error("[Availability API] Database error:", error);
      return new Response(JSON.stringify({ error: "Failed to fetch availability data" } as ErrorResponse), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============================================================================
    // RESPONSE TRANSFORMATION
    // ============================================================================

    const totalUnits = data[0]?.total_units ?? 0;
    const availability = data.map((day: AvailabilityDay) => ({
      date: day.date,
      availableCount: day.available_count,
      status: getAvailabilityStatus(day.available_count, totalUnits),
    }));

    const response: AvailabilityResponse = {
      totalUnits,
      dateRange: {
        start: startDate,
        end: endDate,
      },
      availability,
      metadata: {
        generatedAt: new Date().toISOString(),
        cacheMaxAge: 300, // 5 minutes in seconds
        version: "v1",
      },
    };

    // ============================================================================
    // OPTIONAL: AUDIT LOGGING
    // ============================================================================

    // Log calendar views for analytics (non-blocking)
    waitUntil(
      (async () => {
        try {
          const logger = createLogger(env);
          logger.info("[Availability API] Calendar viewed", {
            start_date: startDate,
            end_date: endDate,
            days_queried: daysDiff,
            ip_address: request.headers.get("cf-connecting-ip"),
            user_agent: request.headers.get("user-agent"),
            origin: request.headers.get("origin"),
          });
        } catch (err) {
          console.error("[Availability API] Audit logging failed:", err);
        }
      })()
    );

    // ============================================================================
    // CDN CACHING HEADERS
    // ============================================================================

    const etag = `"availability-${startDate}-${endDate}-${Math.floor(Date.now() / 300000)}"`;

    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        // CDN caching: 5 minutes fresh, 2 minutes stale-while-revalidate
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=120",
        ETag: etag,
        // Vary header ensures proper caching by query params
        Vary: "Accept-Encoding",
      },
      status: 200,
    });
  } catch (error) {
    console.error("[Availability API] Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" } as ErrorResponse), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

/** Grades a night's free cabins against the resort's cabin count. */
export function getAvailabilityStatus(count: number, totalUnits: number): AvailabilityStatus {
  if (count <= 0) return "booked";
  if (count >= totalUnits) return "full";
  if (count === 1) return "limited";
  return "moderate";
}
