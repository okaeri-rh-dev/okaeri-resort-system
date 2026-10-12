/**
 * POST /api/admin/verify-payment
 *
 * Admin endpoint to verify or reject payment proof submissions.
 *
 * @requires Authentication - Manager role or above (from app_roles)
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

import type { PaymentStatus } from "@/types";
import type { TablesInsert } from "@/types/database.types";

import { MANAGER_OR_ABOVE } from "../../lib/rbac";
import { lookupUserRole } from "../../lib/role-lookup";
import { createSupabaseAdmin } from "../../lib/supabase-admin";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RATE_LIMIT_KV?: KVNamespace;
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

    // Authorize from app_roles (server-side), NOT client-mutable user_metadata /
    // app_metadata. Payment verification requires manager-or-above, matching the
    // frontend Payments guard (requireManager).
    const appRole = await lookupUserRole(user.id, env);

    if (!MANAGER_OR_ABOVE.includes(appRole)) {
      return new Response(
        JSON.stringify({
          error: "Forbidden",
          message: "Manager access or higher is required to verify payments",
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

    const supabase = createSupabaseAdmin(env);

    // Fetch booking to verify existence and current status
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("payment_status, downpayment_required, payment_method, payment_proof_url")
      .eq("booking_id", body.booking_id)
      .maybeSingle();

    if (bookingError) {
      console.error("Failed to fetch booking:", bookingError);
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

    if (!booking) {
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

    // Verify records the downpayment; a trigger derives payment_status (docs/adr/0001).
    // Reject leaves the booking and its proof as they are; the reason goes to the audit log.
    let newPaymentStatus: PaymentStatus = booking.payment_status;
    if (body.action === "verify") {
      const downpayment = booking.downpayment_required;
      if (downpayment === null) {
        return new Response(
          JSON.stringify({
            error: "Conflict",
            message: "This booking has no downpayment to record",
          }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { error: paymentError } = await supabase.from("payments").insert({
        booking_id: body.booking_id,
        amount: downpayment,
        payment_method: booking.payment_method,
        proof_url: booking.payment_proof_url,
        status: "Active",
        notes: "Online booking downpayment",
      } satisfies TablesInsert<"payments">);

      if (paymentError) {
        console.error("Failed to record payment:", paymentError);
        return new Response(
          JSON.stringify({
            error: "Internal Server Error",
            message: "Failed to record the downpayment",
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: refreshed } = await supabase
        .from("bookings")
        .select("payment_status")
        .eq("booking_id", body.booking_id)
        .single();
      newPaymentStatus = refreshed?.payment_status ?? booking.payment_status;
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

      // App events use action INSERT + source "app", like logAuditEventWorker
      const { error: auditInsertError } = await supabase.from("audit_logs").insert({
        action: "INSERT",
        source: "app",
        event_type: auditAction,
        table_name: "bookings",
        record_id: body.booking_id,
        user_id: user.id,
        user_email: user.email ?? null,
        old_data: { payment_status: booking.payment_status },
        new_data: { payment_status: newPaymentStatus },
        metadata: auditMetadata,
      } satisfies TablesInsert<"audit_logs">);

      if (auditInsertError) {
        console.error("Failed to write audit log:", auditInsertError);
      } else {
        auditLogged = true;
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
