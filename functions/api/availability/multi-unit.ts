/**
 * Multi-Unit Availability Check Endpoint
 *
 * GET /api/availability/multi-unit
 *
 * Checks availability for multiple units in a single request.
 * Performance target: <100ms for 10 units
 *
 * Phase 2B: Core Booking Operations
 */

import { createClient } from "@supabase/supabase-js";

import { isManilaDay, toStayInstants } from "@/lib/bookings/stay";
import type { Database } from "@/types/database.types";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  RATE_LIMIT_KV: KVNamespace;
}

/**
 * Availability check result from database
 */
interface AvailabilityResult {
  unit_id: string;
  is_available: boolean;
  conflicting_bookings: number;
  next_available_date: string | null;
}

/**
 * Main handler for multi-unit availability checking
 * Public endpoint - no authentication required
 */
export const onRequestGet = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request, env } = context;
  const startTime = Date.now();
  const url = new URL(request.url);

  try {
    // Parse query parameters
    const unitIds = url.searchParams.getAll("units[]");
    const checkIn = url.searchParams.get("check_in");
    const checkOut = url.searchParams.get("check_out");
    const excludeBookingId = url.searchParams.get("exclude_booking_id");

    // Validate parameters
    if (!unitIds || unitIds.length === 0) {
      return Response.json(
        {
          error: "VALIDATION_ERROR",
          message: "units[] query parameter is required",
        },
        { status: 400 }
      );
    }

    if (!checkIn || !checkOut) {
      return Response.json(
        {
          error: "VALIDATION_ERROR",
          message: "check_in and check_out query parameters are required",
        },
        { status: 400 }
      );
    }

    if (!isManilaDay(checkIn) || !isManilaDay(checkOut) || checkOut <= checkIn) {
      return Response.json(
        {
          error: "INVALID_DATES",
          message: "check_in and check_out must be YYYY-MM-DD days, check_out after check_in",
        },
        { status: 400 }
      );
    }
    const { check_in: checkInUTC, check_out: checkOutUTC } = toStayInstants(checkIn, checkOut);

    // ✅ Generate cache key
    const sortedUnitIds = [...unitIds].sort();
    const cacheKey = `availability:${sortedUnitIds.join(",")}:${checkIn}:${checkOut}`;

    // ✅ Check KV cache first (1 minute TTL)
    if (env.RATE_LIMIT_KV) {
      try {
        const cached = await env.RATE_LIMIT_KV.get(cacheKey);
        if (cached) {
          const cachedData = JSON.parse(cached);
          return Response.json(cachedData, {
            headers: {
              "Content-Type": "application/json",
              "X-Cache": "HIT",
              "Cache-Control": "public, max-age=60",
              "X-Processing-Time": "0ms",
            },
          });
        }
      } catch (cacheError) {
        console.warn("[Availability] Cache read error:", cacheError);
        // Continue to database query if cache fails
      }
    }

    // Call database function (from Phase 1)
    // Use Authorization header to authenticate as the logged-in user
    const authHeader = request.headers.get("Authorization");
    const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error } = await supabase.rpc("check_multi_unit_availability", {
      p_unit_ids: unitIds,
      p_check_in: checkInUTC,
      p_check_out: checkOutUTC,
      p_exclude_booking_id: excludeBookingId || undefined,
    });

    if (error) {
      console.error("[Availability] Database error:", error);
      return Response.json(
        {
          error: "DATABASE_ERROR",
          message: "Failed to check availability",
        },
        { status: 500 }
      );
    }

    // Fetch unit details for enriched response
    const { data: unitsData } = await supabase
      .from("units")
      .select("unit_id, unit_name, unit_code, unit_type")
      .in("unit_id", unitIds);

    const unitsMap = new Map(unitsData?.map((u) => [u.unit_id, u]) || []);

    // Build enriched results
    const results = (data as AvailabilityResult[]).map((item) => {
      const unitInfo = unitsMap.get(item.unit_id);
      return {
        unit_id: item.unit_id,
        unit_name: unitInfo?.unit_name || "Unknown",
        unit_code: unitInfo?.unit_code || "",
        is_available: item.is_available,
        conflicting_bookings: item.conflicting_bookings || 0,
        next_available_date: item.next_available_date || null,
      };
    });

    // Calculate summary
    const availableCount = results.filter((r) => r.is_available).length;
    const unavailableCount = results.filter((r) => !r.is_available).length;

    const processingTime = Date.now() - startTime;

    const responseData = {
      success: true,
      data: {
        check_in: checkIn,
        check_out: checkOut,
        results,
        summary: {
          total_units_checked: results.length,
          available_units: availableCount,
          unavailable_units: unavailableCount,
        },
      },
    };

    // ✅ Cache result for 1 minute
    if (env.RATE_LIMIT_KV) {
      try {
        await env.RATE_LIMIT_KV.put(cacheKey, JSON.stringify(responseData), {
          expirationTtl: 60, // 1 minute
        });
      } catch (cacheError) {
        console.warn("[Availability] Cache write error:", cacheError);
        // Continue even if caching fails
      }
    }

    return Response.json(responseData, {
      headers: {
        "Content-Type": "application/json",
        "X-Cache": "MISS",
        "X-Processing-Time": `${processingTime}ms`,
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (error) {
    console.error("[Availability] Error:", error);

    return Response.json(
      {
        error: "INTERNAL_ERROR",
        message: "Failed to check availability",
        details: process.env.NODE_ENV === "development" ? { error: String(error) } : undefined,
      },
      { status: 500 }
    );
  }
};
