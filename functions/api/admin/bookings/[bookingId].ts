/**
 * Admin Booking Detail API Endpoint
 * GET /api/admin/bookings/{bookingId}
 *
 * Fetches detailed information about a specific booking by ID.
 * Requires admin authentication via Bearer token.
 */

import type { Request as CloudflareRequest } from "@cloudflare/workers-types";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

interface BookingDetailResponse {
  booking_id: string;
  booking_reference: string;
  guest_name: string;
  guest_contact: string;
  check_in: string;
  check_out: string;
  total_amount: number;
  payment_status: string;
  unit_assignment_status: string; // Added for route compatibility
  payment_proof_url: string | null;
  requested_unit_count: number;
  unit_requests: Array<{ id: string; guests_per_unit: number }>; // Added for route compatibility
  created_at: string;
}

interface BookingDatabaseRecord {
  booking_id: string;
  booking_reference: string;
  guest_name: string;
  contact_number: string;
  check_in: string;
  check_out: string;
  total_amount: number;
  payment_status: string | null;
  unit_assignment_status: string | null;
  payment_proof_url: string | null;
  requested_unit_count: number | null;
  created_at: string | null;
  guest_booking_unit_requests?: Array<{ id: string; guests_per_unit: number }>;
}

interface ErrorResponse {
  error: string;
  details?: string;
}

/**
 * CORS headers for cross-origin requests
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * Handles OPTIONS preflight requests
 */
function handleOptions(): Response {
  return new Response(null, {
    headers: corsHeaders,
    status: 204,
  });
}

/**
 * Creates error response with consistent structure
 */
function errorResponse(message: string, status: number, details?: string): Response {
  const body: ErrorResponse = {
    error: message,
    ...(details && { details }),
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

/**
 * Creates success response with booking data
 */
function successResponse(booking: BookingDetailResponse): Response {
  return new Response(JSON.stringify(booking), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

/**
 * Extracts and validates Bearer token from Authorization header
 */
function extractBearerToken(request: CloudflareRequest): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }

  return parts[1];
}

/**
 * Verifies user is authenticated
 *
 * Phase 1: All authenticated users have admin access (current behavior)
 * Phase 2: TODO - Will check for actual admin role via profiles table
 */
async function verifyAdminAuth(
  token: string,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<{ isValid: boolean; error?: string }> {
  try {
    const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify JWT and get user
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return {
        isValid: false,
        error: "Invalid or expired token",
      };
    }

    // Phase 1: All authenticated users have admin access
    // This matches the behavior documented in _middleware.ts
    // Phase 2: TODO - Uncomment the code below to enforce admin role
    //
    // const userRole = user.user_metadata?.role || user.app_metadata?.role || "guest";
    //
    // if (userRole !== "admin") {
    //   return {
    //     isValid: false,
    //     error: "Admin access required",
    //   };
    // }

    return { isValid: true };
  } catch (err) {
    console.error("Auth verification error:", err);
    return {
      isValid: false,
      error: "Authentication verification failed",
    };
  }
}

/**
 * Fetches booking details from database
 */
async function fetchBookingById(
  bookingId: string,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<{ booking: BookingDetailResponse | null; error?: string }> {
  try {
    const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase
      .from("bookings")
      .select(
        `
        booking_id,
        booking_reference,
        guest_name,
        contact_number,
        check_in,
        check_out,
        total_amount,
        payment_status,
        unit_assignment_status,
        payment_proof_url,
        requested_unit_count,
        created_at,
        guest_booking_unit_requests(id, guests_per_unit)
      `
      )
      .eq("booking_id", bookingId)
      .single();

    if (error) {
      console.error("Database query error:", error);
      return {
        booking: null,
        error: error.code === "PGRST116" ? "Booking not found" : error.message,
      };
    }

    if (!data) {
      return {
        booking: null,
        error: "Booking not found",
      };
    }

    // Transform response to match route expectations
    const dbRecord = data as unknown as BookingDatabaseRecord;
    const transformedBooking: BookingDetailResponse = {
      booking_id: dbRecord.booking_id,
      booking_reference: dbRecord.booking_reference,
      guest_name: dbRecord.guest_name,
      guest_contact: dbRecord.contact_number,
      check_in: dbRecord.check_in,
      check_out: dbRecord.check_out,
      total_amount: dbRecord.total_amount,
      payment_status: dbRecord.payment_status || "Pending",
      unit_assignment_status: dbRecord.unit_assignment_status || "pending",
      payment_proof_url: dbRecord.payment_proof_url,
      requested_unit_count: dbRecord.requested_unit_count || 0,
      unit_requests: Array.isArray(dbRecord.guest_booking_unit_requests)
        ? dbRecord.guest_booking_unit_requests.map((req) => ({
            id: req.id,
            guests_per_unit: req.guests_per_unit,
          }))
        : [],
      created_at: dbRecord.created_at || new Date().toISOString(),
    };

    return { booking: transformedBooking };
  } catch (err) {
    console.error("Fetch booking error:", err);
    return {
      booking: null,
      error: "Failed to fetch booking details",
    };
  }
}

/**
 * Main request handler
 */
export async function onRequest(context: {
  request: CloudflareRequest;
  env: Env;
  params: Record<string, string>;
}): Promise<Response> {
  const { request, env, params } = context;

  try {
    // Handle OPTIONS preflight
    if (request.method === "OPTIONS") {
      return handleOptions();
    }

    // Only allow GET requests
    if (request.method !== "GET") {
      return errorResponse("Method not allowed", 405);
    }

    // Validate environment variables
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing required environment variables");
      return errorResponse("Server configuration error", 500, "Missing Supabase credentials");
    }

    // Extract booking ID from route parameter
    const bookingId = params.bookingId;
    if (!bookingId) {
      return errorResponse("Booking ID is required", 400);
    }

    // Validate booking ID format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(bookingId)) {
      return errorResponse("Invalid booking ID format", 400);
    }

    // Extract and validate Bearer token
    const token = extractBearerToken(request);
    if (!token) {
      return errorResponse(
        "Authentication required",
        401,
        "Missing or invalid Authorization header"
      );
    }

    // Verify admin authentication
    const authResult = await verifyAdminAuth(
      token,
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY
    );

    if (!authResult.isValid) {
      const status = authResult.error?.includes("Admin") ? 403 : 401;
      return errorResponse(authResult.error || "Authentication failed", status);
    }

    // Fetch booking details
    const { booking, error } = await fetchBookingById(
      bookingId,
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY
    );

    if (error) {
      const status = error === "Booking not found" ? 404 : 500;
      return errorResponse(error, status);
    }

    if (!booking) {
      return errorResponse("Booking not found", 404);
    }

    // Return booking details
    return successResponse(booking);
  } catch (err) {
    console.error("Unexpected error in booking detail endpoint:", err);
    return errorResponse(
      "Internal server error",
      500,
      err instanceof Error ? err.message : "Unknown error"
    );
  }
}
