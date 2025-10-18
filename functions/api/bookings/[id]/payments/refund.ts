/**
 * Refund Payment Endpoint
 *
 * POST /api/bookings/:booking_id/payments/refund
 *
 * Processes manual refund for a booking (full or partial).
 * Updates payment_adjustments table and booking payment_status.
 *
 * Phase 2D: Payment Integration (Manual Tracking)
 */

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireRole } from "../../../../lib/rbac";
import { logPaymentRefunded } from "../../../../lib/audit-logger-workers";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

// Validation schema (from spec lines 1172-1180)
const refundPaymentSchema = z.object({
  amount: z.number().positive(),
  reason: z.enum(["unit_removed", "cancellation", "price_adjustment", "other"]),
  notes: z.string().max(1000).optional(),
});

/**
 * Main handler for processing refund
 * Requires authentication (manager only - higher privilege than staff)
 */
export const onRequestPost = async (context: {
  request: Request;
  env: Env;
  params: Record<string, string>;
}): Promise<Response> => {
  const { request, env, params } = context;
  const startTime = Date.now();
  const bookingId = params.id as string;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  try {
    // RBAC: Require manager role or above (refunds are sensitive operations)
    try {
      requireRole(request, ["manager", "admin"]);
    } catch (error) {
      return Response.json(
        {
          error: error instanceof Error ? error.name : "AUTHORIZATION_ERROR",
          message: error instanceof Error ? error.message : "Access denied",
        },
        {
          status: error instanceof Error && error.name === "UnauthorizedError" ? 401 : 403,
          headers: corsHeaders,
        }
      );
    }

    // Validate booking_id
    if (
      !bookingId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId)
    ) {
      return Response.json(
        {
          error: "VALIDATION_ERROR",
          message: "Invalid booking_id format",
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Parse and validate request
    const rawData = await request.json();
    const validationResult = refundPaymentSchema.safeParse(rawData);

    if (!validationResult.success) {
      return Response.json(
        {
          error: "VALIDATION_ERROR",
          message: "Invalid request data",
          details: {
            validation_errors: validationResult.error.errors.map((err) => ({
              field: err.path.join("."),
              message: err.message,
            })),
          },
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const data = validationResult.data;
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 1. Get most recent payment (from spec lines 1211-1219)
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (paymentError || !payment) {
      return Response.json(
        {
          error: "PAYMENT_NOT_FOUND",
          message: "No payment found for this booking",
        },
        { status: 404, headers: corsHeaders }
      );
    }

    // 2. Validate refund amount (from spec lines 1231-1244)
    const totalRefunded = (payment.refunded_amount || 0) + data.amount;
    if (totalRefunded > payment.amount) {
      return Response.json(
        {
          error: "REFUND_EXCEEDS_PAYMENT",
          message: `Cannot refund ${data.amount}. Total refund would be ${totalRefunded}, exceeding payment of ${payment.amount}`,
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // 3. Update payment refunded_amount (from spec lines 1246-1251)
    const { error: updateError } = await supabase
      .from("payments")
      .update({ refunded_amount: totalRefunded })
      .eq("payment_id", payment.payment_id);

    if (updateError) {
      return Response.json(
        {
          error: "REFUND_FAILED",
          message: updateError.message,
        },
        { status: 500, headers: corsHeaders }
      );
    }

    // 4. Create adjustment record (from spec lines 1262-1273)
    const { data: adjustment, error: adjustmentError } = await supabase
      .from("payment_adjustments")
      .insert({
        payment_id: payment.payment_id,
        reason: data.reason,
        amount_change: -data.amount, // Negative for refund
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (adjustmentError) {
      return Response.json(
        {
          error: "ADJUSTMENT_FAILED",
          message: adjustmentError.message,
        },
        { status: 500, headers: corsHeaders }
      );
    }

    // 5. Update booking payment status (from spec lines 1284-1296)
    let newPaymentStatus: string;
    if (totalRefunded === payment.amount) {
      // Full refund
      newPaymentStatus = "Refunded";
    } else if (totalRefunded > 0) {
      // Partial refund
      newPaymentStatus = "PartialRefund";
    } else {
      newPaymentStatus = "Paid";
    }

    await supabase
      .from("bookings")
      .update({ payment_status: newPaymentStatus })
      .eq("booking_id", bookingId);

    // Get booking reference for response
    const { data: booking } = await supabase
      .from("bookings")
      .select("booking_reference")
      .eq("booking_id", bookingId)
      .single();

    // 6. Audit logging
    const userId = (request as any).user?.id || undefined;
    await logPaymentRefunded(supabase, payment, data.amount, data.reason, userId, request);

    const processingTime = Date.now() - startTime;

    return Response.json(
      {
        success: true,
        data: {
          adjustment_id: adjustment.adjustment_id,
          payment_id: payment.payment_id,
          booking_id: bookingId,
          booking_reference: booking?.booking_reference,
          amount_refunded: data.amount,
          total_refunded: totalRefunded,
          reason: data.reason,
          payment_status: newPaymentStatus,
        },
      },
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-Processing-Time": `${processingTime}ms`,
        },
      }
    );
  } catch (error) {
    console.error("[Refund Payment] Error:", error);

    return Response.json(
      {
        error: "INTERNAL_ERROR",
        message: "Failed to process refund",
        details: process.env.NODE_ENV === "development" ? { error: String(error) } : undefined,
      },
      { status: 500, headers: corsHeaders }
    );
  }
};
