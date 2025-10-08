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

import type { PagesFunction } from "@cloudflare/workers-types";
import { createClient } from "@supabase/supabase-js";

interface Env {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
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
export const onRequestGet: PagesFunction<Env> = async (context) => {
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

    // Validate dates
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return Response.json(
        {
          error: "INVALID_DATES",
          message: "check_in and check_out must be valid dates",
        },
        { status: 400 }
      );
    }

    if (checkOutDate <= checkInDate) {
      return Response.json(
        {
          error: "INVALID_DATES",
          message: "check_out must be after check_in",
        },
        { status: 400 }
      );
    }

    // Convert dates to UTC timestamps for database
    const checkInUTC = checkInDate.toISOString();
    const checkOutUTC = checkOutDate.toISOString();

    // Call database function (from Phase 1)
    const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

    const { data, error } = await supabase.rpc("check_multi_unit_availability", {
      p_unit_ids: unitIds,
      p_check_in: checkInUTC,
      p_check_out: checkOutUTC,
      p_exclude_booking_id: excludeBookingId || null,
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

    return Response.json(
      {
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
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Processing-Time": `${processingTime}ms`,
          "Cache-Control": "public, max-age=60", // Cache for 1 minute
        },
      }
    );
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
