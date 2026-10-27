import type { Request as CloudflareRequest } from "@cloudflare/workers-types";
import { createClient } from "@supabase/supabase-js";

import { toStayInstants } from "@/lib/bookings/stay";

import type { Database } from "../../../src/types/database.types";
import { logAuditEventWorker } from "../../lib/audit-logger-workers";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

interface AvailableUnit {
  unit_id: string; // Changed from id to match UI expectations
  unit_number: string;
  unit_type: string;
  max_capacity: number;
  rate_per_night: number; // Changed from base_price to match UI expectations
  floor_level?: number | null; // Added for UI compatibility
  view_type?: string | null; // Added for UI compatibility
}

interface AvailableUnitsResponse {
  success: boolean;
  units: AvailableUnit[]; // Changed from available_units to match UI expectations
  count: number;
  date_range: {
    check_in: string;
    check_out: string;
  };
}

interface ErrorResponse {
  success: false;
  error: string;
  details?: string;
}

// CORS headers for all responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Date validation regex for YYYY-MM-DD format
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates date format and ensures date is valid
 */
function isValidDate(dateString: string): boolean {
  if (!DATE_REGEX.test(dateString)) {
    return false;
  }

  const date = new Date(dateString + "T00:00:00");
  return !isNaN(date.getTime());
}

/**
 * Validates that check-out date is after check-in date
 */
function validateDateRange(checkIn: string, checkOut: string): boolean {
  const checkInDate = new Date(checkIn + "T00:00:00");
  const checkOutDate = new Date(checkOut + "T00:00:00");
  return checkOutDate > checkInDate;
}

export async function onRequest(context: {
  request: CloudflareRequest;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  // Handle OPTIONS preflight request
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Only allow GET requests
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Parse query parameters
    const url = new URL(request.url);
    const checkInDate = url.searchParams.get("check_in_date");
    const checkOutDate = url.searchParams.get("check_out_date");

    // Validate required parameters
    if (!checkInDate || !checkOutDate) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: "Missing required parameters",
        details: "Both check_in_date and check_out_date are required",
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate date formats
    if (!isValidDate(checkInDate) || !isValidDate(checkOutDate)) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: "Invalid date format",
        details: "Dates must be in YYYY-MM-DD format",
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate date range
    if (!validateDateRange(checkInDate, checkOutDate)) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: "Invalid date range",
        details: "Check-out date must be after check-in date",
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract JWT token from Authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: "Unauthorized",
        details: "Missing or invalid authorization header",
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.substring(7);

    // Initialize Supabase client with service role key
    const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify JWT token and get user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("[available-units] Authentication failed:", authError);
      const errorResponse: ErrorResponse = {
        success: false,
        error: "Unauthorized",
        details: "Invalid or expired token",
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorization (staff-or-above, from app_roles) is enforced upstream by
    // functions/api/admin/_middleware.ts — this booking-area query is requireStaff.

    // Audit logging for admin access
    await logAuditEventWorker(
      supabase,
      {
        action: "admin.available_units.query",
        entity_type: "units",
        entity_id: undefined,
        user_id: user.id,
        severity: "INFO",
        description: `Admin querying available units for date range ${checkInDate} to ${checkOutDate}`,
        metadata: {
          check_in_date: checkInDate,
          check_out_date: checkOutDate,
          ip_address: request.headers.get("cf-connecting-ip") ?? undefined,
          user_agent: request.headers.get("user-agent") ?? undefined,
        },
      },
      request
    );

    const { data: allUnits, error: unitsError } = await supabase
      .from("units")
      .select("*")
      .order("unit_code");

    if (unitsError) {
      console.error("[available-units] Error fetching units:", unitsError);
      const errorResponse: ErrorResponse = {
        success: false,
        error: "Internal server error",
        details: "Failed to fetch units",
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // A cabin is free when no block covers a night and no Confirmed or CheckedIn stay overlaps
    const stay = toStayInstants(checkInDate, checkOutDate);
    const { data: availability, error: availabilityError } = await supabase.rpc(
      "check_multi_unit_availability",
      {
        p_unit_ids: allUnits.map((unit) => unit.unit_id),
        p_check_in: stay.check_in,
        p_check_out: stay.check_out,
      }
    );

    if (availabilityError) {
      console.error("[available-units] Error checking availability:", availabilityError);
      const errorResponse: ErrorResponse = {
        success: false,
        error: "Internal server error",
        details: "Failed to check availability",
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const freeUnitIds = new Set(
      availability.filter((unit) => unit.is_available).map((unit) => unit.unit_id)
    );

    const availableUnits: AvailableUnit[] = allUnits
      .filter((unit) => freeUnitIds.has(unit.unit_id))
      .map((unit) => ({
        unit_id: unit.unit_id,
        unit_number: unit.unit_code,
        unit_type: unit.unit_type,
        max_capacity: unit.max_occupancy,
        rate_per_night: unit.base_rate,
        // units has no floor or view columns; the UI hides these when null
        floor_level: null,
        view_type: null,
      }));

    // Prepare successful response
    const response: AvailableUnitsResponse = {
      success: true,
      units: availableUnits, // Changed from available_units to match UI expectations
      count: availableUnits.length,
      date_range: {
        check_in: checkInDate,
        check_out: checkOutDate,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[available-units] Unexpected error:", error);
    const errorResponse: ErrorResponse = {
      success: false,
      error: "Internal server error",
      details: error instanceof Error ? error.message : "An unexpected error occurred",
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
