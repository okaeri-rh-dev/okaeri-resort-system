/**
 * POST /api/admin/verify-payment
 *
 * Admin endpoint to verify or reject payment proof submissions.
 *
 * @requires Authentication - Admin role required
 * @param {string} booking_id - The booking ID to verify/reject
 * @param {'verify' | 'reject'} action - Action to perform
 * @param {string} [reason] - Required if action is 'reject'
 *
 * @returns {200} Payment status updated successfully
 * @returns {400} Invalid request body or validation error
 * @returns {401} Missing or invalid authentication token
 * @returns {403} User does not have admin role
 * @returns {404} Booking not found
 * @returns {409} Payment already processed (not in Pending state)
 * @returns {500} Internal server error
 */

import type { Request as CloudflareRequest } from "@cloudflare/workers-types";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

interface RequestBody {
  booking_id: string;
  action: "verify" | "reject";
  reason?: string;
}

interface SupabaseUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}

interface Booking {
  id: string;
  payment_status: string;
  guest_id: string;
  unit_id: string;
  check_in_date: string;
  check_out_date: string;
}

export async function onRequest(context: {
  request: CloudflareRequest;
  env: Env;
  params: Record<string, string>;
}) {
  const { request, env } = context;

  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  // Handle preflight OPTIONS request
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Only allow POST method
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({
        error: "Method not allowed",
        message: "Only POST method is supported",
      }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    // Extract and validate Authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          message: "Missing or invalid Authorization header",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Verify JWT token using Supabase service role client
    const userResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      },
    });

    if (!userResponse.ok) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          message: "Invalid authentication token",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const user = (await userResponse.json()) as SupabaseUser;

    // Verify admin role
    const userRole = (user.user_metadata?.role as string) || (user.app_metadata?.role as string);

    if (userRole !== "admin") {
      return new Response(
        JSON.stringify({
          error: "Forbidden",
          message: "Admin role required to verify payments",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse and validate request body
    let body: RequestBody;
    try {
      body = (await request.json()) as RequestBody;
    } catch (_error) {
      return new Response(
        JSON.stringify({
          error: "Bad Request",
          message: "Invalid JSON in request body",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate required fields
    if (!body.booking_id || typeof body.booking_id !== "string") {
      return new Response(
        JSON.stringify({
          error: "Bad Request",
          message: "Missing or invalid required field: booking_id",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!body.action || !["verify", "reject"].includes(body.action)) {
      return new Response(
        JSON.stringify({
          error: "Bad Request",
          message: "Invalid action. Must be 'verify' or 'reject'",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate reason field for reject action
    if (body.action === "reject") {
      if (!body.reason || typeof body.reason !== "string" || body.reason.trim() === "") {
        return new Response(
          JSON.stringify({
            error: "Bad Request",
            message: "Rejection reason is required when action is 'reject'",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Fetch booking to verify existence and current status
    const bookingResponse = await fetch(
      `${env.SUPABASE_URL}/rest/v1/bookings?id=eq.${body.booking_id}&select=*`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
      }
    );

    if (!bookingResponse.ok) {
      console.error("Failed to fetch booking:", await bookingResponse.text());
      return new Response(
        JSON.stringify({
          error: "Internal Server Error",
          message: "Failed to fetch booking",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const bookings = (await bookingResponse.json()) as Booking[];

    if (bookings.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Not Found",
          message: `Booking with ID ${body.booking_id} not found`,
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const booking = bookings[0];

    // Check for idempotency - if payment already processed
    if (booking.payment_status !== "Pending") {
      return new Response(
        JSON.stringify({
          error: "Conflict",
          message: `Payment already ${booking.payment_status}`,
          current_status: booking.payment_status,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Determine new payment status
    const newPaymentStatus = body.action === "verify" ? "Verified" : "Rejected";

    // Update booking payment status
    const updateResponse = await fetch(
      `${env.SUPABASE_URL}/rest/v1/bookings?id=eq.${body.booking_id}`,
      {
        method: "PATCH",
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          payment_status: newPaymentStatus,
        }),
      }
    );

    if (!updateResponse.ok) {
      console.error("Failed to update booking:", await updateResponse.text());
      return new Response(
        JSON.stringify({
          error: "Internal Server Error",
          message: "Failed to update payment status",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Prepare audit log metadata
    const auditMetadata = {
      admin_id: user.id,
      admin_email: user.email || "unknown",
      timestamp: new Date().toISOString(),
      ...(body.action === "reject" && { rejection_reason: body.reason }),
    };

    // Log to audit trail (non-fatal)
    let auditLogged = false;
    try {
      const auditAction = body.action === "verify" ? "payment.verified" : "payment.rejected";

      const auditResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/audit_logs`, {
        method: "POST",
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          action: auditAction,
          entity_type: "booking",
          entity_id: body.booking_id,
          user_id: user.id,
          metadata: auditMetadata,
        }),
      });

      if (auditResponse.ok) {
        auditLogged = true;
      } else {
        console.error("Failed to write audit log:", await auditResponse.text());
      }
    } catch (auditError) {
      console.error("Error writing audit log:", auditError);
      // Continue execution - audit logging is non-fatal
    }

    // Return success response
    const successMessage =
      body.action === "verify" ? "Payment verified successfully" : "Payment rejected successfully";

    return new Response(
      JSON.stringify({
        success: true,
        message: successMessage,
        payment_status: newPaymentStatus,
        audit_logged: auditLogged,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error in verify-payment endpoint:", error);

    return new Response(
      JSON.stringify({
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "An unexpected error occurred",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}
