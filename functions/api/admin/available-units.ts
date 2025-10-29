import type { Request as CloudflareRequest } from "@cloudflare/workers-types";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../../../src/types/database.types";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

interface AvailableUnitsQuery {
  check_in_date: string;
  check_out_date: string;
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

/**
 * Checks if user has admin role
 */
async function isAdmin(
  supabase: ReturnType<typeof createClient<Database>>,
  userId: string
): Promise<boolean> {
  try {
    // Check user metadata first (fastest)
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);

    if (!userError && userData?.user?.user_metadata?.role === "admin") {
      return true;
    }

    // Fallback to profiles table check
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (profileError) {
      console.error("[available-units] Error checking admin role:", profileError);
      return false;
    }

    return profile?.role === "admin";
  } catch (error) {
    console.error("[available-units] Unexpected error checking admin role:", error);
    return false;
  }
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

    // Check if user is admin
    const isUserAdmin = await isAdmin(supabase, user.id);
    if (!isUserAdmin) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: "Forbidden",
        details: "Admin access required",
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // TODO: Add audit logging for admin access
    // await logAuditEvent({
    //   action: 'admin.available_units.query',
    //   entity_type: 'units',
    //   user_id: user.id,
    //   metadata: {
    //     check_in_date: checkInDate,
    //     check_out_date: checkOutDate,
    //     ip_address: request.headers.get('cf-connecting-ip'),
    //     user_agent: request.headers.get('user-agent'),
    //   },
    // });

    // Query all units with Available status
    const { data: allUnits, error: unitsError } = await supabase
      .from("units")
      .select("*")
      .eq("unit_status", "Available")
      .order("unit_number");

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

    // Query overlapping bookings for the date range
    // Two bookings overlap if: booking_check_in < requested_checkout AND booking_checkout > requested_checkin
    const { data: bookedUnits, error: bookingsError } = await supabase
      .from("booking_units")
      .select("unit_id")
      .eq("status", "confirmed")
      .lt("check_in_date", checkOutDate) // Existing check-in BEFORE requested check-out
      .gt("check_out_date", checkInDate); // Existing check-out AFTER requested check-in

    if (bookingsError) {
      console.error("[available-units] Error fetching bookings:", bookingsError);
      const errorResponse: ErrorResponse = {
        success: false,
        error: "Internal server error",
        details: "Failed to check bookings",
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create a set of booked unit IDs for efficient lookup
    const bookedUnitIds = new Set(bookedUnits?.map((bu) => bu.unit_id) || []);

    // Filter out booked units from available units
    const availableUnits: AvailableUnit[] = (allUnits || [])
      .filter((unit) => !bookedUnitIds.has(unit.unit_id))
      .map((unit) => ({
        unit_id: unit.unit_id, // Changed from id to match UI
        unit_number: unit.unit_number,
        unit_type: unit.unit_type,
        max_capacity: unit.max_capacity,
        rate_per_night: unit.base_rate || unit.base_price || 0, // Changed from base_price with fallback
        floor_level: unit.floor_level || null, // Added for UI
        view_type: unit.view_type || null, // Added for UI
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
