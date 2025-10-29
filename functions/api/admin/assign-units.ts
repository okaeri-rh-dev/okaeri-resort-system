import type { Request as CloudflareRequest } from "@cloudflare/workers-types";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../../../src/types/database.types";
import { logAuditEventWorker } from "../../lib/audit-logger-workers";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

interface AssignUnitsRequest {
  booking_id: string;
  unit_ids: string[];
}

interface AssignUnitsResponse {
  success: boolean;
  message: string;
  booking_id: string;
  assigned_unit_count: number;
  booking_status: string;
  unit_assignment_status: string;
}

interface ErrorResponse {
  success: false;
  error: string;
  details?: string;
}

interface RpcError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

// CORS headers for all responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * Validates UUID format
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
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
      console.error("[assign-units] Error checking admin role:", profileError);
      return false;
    }

    return profile?.role === "admin";
  } catch (error) {
    console.error("[assign-units] Unexpected error checking admin role:", error);
    return false;
  }
}

/**
 * Parse RPC error messages for user-friendly responses
 */
function parseRpcError(error: any): { status: number; message: string; details?: string } {
  const errorMessage = error?.message || "";
  const errorDetails = error?.details || "";
  const errorHint = error?.hint || "";

  // Check for specific error patterns
  if (errorMessage.includes("Payment must be verified")) {
    return {
      status: 400,
      message: "Payment verification required",
      details: "The booking payment must be verified before units can be assigned",
    };
  }

  if (errorMessage.includes("All-or-nothing violation")) {
    // Extract details from error message
    const requestedMatch = errorMessage.match(/Requested: (\d+)/);
    const availableMatch = errorMessage.match(/Available: (\d+)/);
    const requested = requestedMatch ? requestedMatch[1] : "unknown";
    const available = availableMatch ? availableMatch[1] : "unknown";

    return {
      status: 400,
      message: "Insufficient units available",
      details: `Cannot partially assign units. Requested: ${requested}, Available: ${available}. All requested units must be available.`,
    };
  }

  if (errorMessage.includes("not found or not in pending state")) {
    return {
      status: 400,
      message: "Invalid booking",
      details:
        "Booking not found or not in pending state. Only pending bookings can have units assigned.",
    };
  }

  if (errorMessage.includes("conflicting key value violates exclusion constraint")) {
    return {
      status: 409,
      message: "Double booking detected",
      details: "One or more units are already booked for the requested dates",
    };
  }

  if (errorHint?.includes("exclusion constraint")) {
    return {
      status: 409,
      message: "Booking conflict",
      details: "The selected units have conflicting bookings for the specified date range",
    };
  }

  // Generic database error
  if (error?.code === "23505") {
    return {
      status: 409,
      message: "Duplicate assignment",
      details: "One or more units are already assigned to another booking",
    };
  }

  // Default error
  return {
    status: 500,
    message: "Unit assignment failed",
    details: errorMessage || "An unexpected error occurred during unit assignment",
  };
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

  // Only allow POST requests
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Parse request body
    let requestBody: AssignUnitsRequest;
    try {
      requestBody = (await request.json()) as AssignUnitsRequest;
    } catch (parseError) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: "Invalid request body",
        details: "Request body must be valid JSON",
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate required fields
    const { booking_id, unit_ids } = requestBody;

    if (!booking_id || !unit_ids) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: "Missing required fields",
        details: "Both booking_id and unit_ids are required",
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate booking_id format
    if (!isValidUUID(booking_id)) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: "Invalid booking_id",
        details: "booking_id must be a valid UUID",
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate unit_ids array
    if (!Array.isArray(unit_ids) || unit_ids.length === 0) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: "Invalid unit_ids",
        details: "unit_ids must be a non-empty array",
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate each unit_id format
    for (const unitId of unit_ids) {
      if (!isValidUUID(unitId)) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: "Invalid unit_id format",
          details: `Invalid UUID format for unit_id: ${unitId}`,
        };
        return new Response(JSON.stringify(errorResponse), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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
    const supabase = createClient<Database>(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
      request
    );

    // Verify JWT token and get user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("[assign-units] Authentication failed:", authError);
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

    // Audit logging for unit assignment attempt
    await logAuditEventWorker(
      supabase,
      {
        action: "admin.units.assign_attempt",
        entity_type: "booking",
        entity_id: booking_id,
        user_id: user.id,
        severity: "INFO",
        description: `Admin attempting to assign ${unit_ids.length} units to booking`,
        metadata: {
          unit_ids: unit_ids,
          unit_count: unit_ids.length,
          ip_address: request.headers.get("cf-connecting-ip"),
          user_agent: request.headers.get("user-agent"),
        },
      },
      request
    );

    // Call PostgreSQL function via Supabase RPC
    const { data: rpcResult, error: rpcError } = await supabase.rpc("assign_units_to_booking", {
      p_booking_id: booking_id,
      p_unit_ids: unit_ids,
    });

    if (rpcError) {
      console.error("[assign-units] RPC error:", rpcError);

      // Parse error for user-friendly response
      const { status, message, details } = parseRpcError(rpcError);

      // Audit logging for failed assignment
      await logAuditEventWorker(supabase, {
        action: "admin.units.assign_failed",
        entity_type: "booking",
        entity_id: booking_id,
        user_id: user.id,
        severity: "WARNING",
        description: `Admin unit assignment failed: ${message}`,
        metadata: {
          error: message,
          details: details,
          unit_ids: unit_ids,
          ip_address: request.headers.get("cf-connecting-ip"),
        },
      });

      const errorResponse: ErrorResponse = {
        success: false,
        error: message,
        details: details,
      };
      return new Response(JSON.stringify(errorResponse), {
        status: status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Audit logging for successful assignment
    await logAuditEventWorker(
      supabase,
      {
        action: "admin.units.assign_success",
        entity_type: "booking",
        entity_id: booking_id,
        user_id: user.id,
        severity: "INFO",
        description: `Admin successfully assigned ${unit_ids.length} units to booking`,
        changes: {
          before: { status: "Pending", units: [] },
          after: { status: "Confirmed", units: unit_ids },
        },
        metadata: {
          unit_ids: unit_ids,
          unit_count: unit_ids.length,
          ip_address: request.headers.get("cf-connecting-ip"),
          user_agent: request.headers.get("user-agent"),
        },
      },
      request
    );

    // Prepare successful response
    const response: AssignUnitsResponse = {
      success: true,
      message: `Successfully assigned ${unit_ids.length} unit${unit_ids.length > 1 ? "s" : ""} to booking`,
      booking_id: booking_id,
      assigned_unit_count: unit_ids.length,
      booking_status: "Confirmed",
      unit_assignment_status: "assigned",
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[assign-units] Unexpected error:", error);

    // Audit logging for unexpected errors
    await logAuditEventWorker(
      supabase,
      {
        action: "admin.units.assign_error",
        entity_type: "booking",
        entity_id: undefined,
        user_id: user?.id,
        severity: "CRITICAL",
        description: `Admin unit assignment error: ${error instanceof Error ? error.message : "Unknown error"}`,
        metadata: {
          error: error instanceof Error ? error.message : "Unknown error",
          ip_address: request.headers.get("cf-connecting-ip"),
        },
      },
      request
    );

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
