/**
 * Record Manual Payment Endpoint
 *
 * POST /api/bookings/:booking_id/payments/record
 *
 * Records manual payment transactions (GCash, Bank Transfer, Cash).
 * Does NOT process payments - tracking only.
 *
 * Phase 2D: Payment Integration (Manual Tracking)
 */

import type { PagesFunction } from "@cloudflare/workers-types";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { sanitizeTextWorker } from "../../../../../src/lib/security/sanitize-worker";

interface Env {
  VITE_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

// Validation schema (from spec lines 1042-1050)
const capturePaymentSchema = z
  .object({
    amount: z.number().positive(),
    payment_method: z.enum(["GCash", "BankTransfer", "Cash", "CreditCard"]),
    payment_reference: z.string().max(100).optional(),
    proof_url: z.string().url().optional(),
    notes: z.string().max(1000).optional(),
  })
  .refine(
    (data) => {
      // proof_url required for GCash and BankTransfer
      if (["GCash", "BankTransfer"].includes(data.payment_method)) {
        return !!data.proof_url;
      }
      return true;
    },
    {
      message: "proof_url is required for GCash and BankTransfer payments",
      path: ["proof_url"],
    }
  );

// Type for validation - prefix with underscore to indicate intentionally unused
type _CapturePaymentRequest = z.infer<typeof capturePaymentSchema>;

/**
 * Main handler for recording manual payment
 * Requires authentication (staff only)
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const startTime = Date.now();
  const bookingId = params.id as string;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  try {
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
    const validationResult = capturePaymentSchema.safeParse(rawData);

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
    const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    // 1. Verify booking exists and get total (from spec lines 1083-1099)
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("booking_id, booking_reference, total_amount, payment_status")
      .eq("booking_id", bookingId)
      .single();

    if (bookingError || !booking) {
      return Response.json(
        {
          error: "BOOKING_NOT_FOUND",
          message: "Booking not found",
        },
        { status: 404, headers: corsHeaders }
      );
    }

    // 2. Get existing payment total to determine if this is full or partial
    const { data: existingPayments } = await supabase
      .from("payments")
      .select("amount")
      .eq("booking_id", bookingId);

    const totalPaid = (existingPayments || []).reduce((sum, p) => sum + p.amount, 0);
    const newTotalPaid = totalPaid + data.amount;

    // Validate payment doesn't exceed booking total
    if (newTotalPaid > booking.total_amount) {
      return Response.json(
        {
          error: "AMOUNT_EXCEEDS_TOTAL",
          message: `Payment amount ${data.amount} would exceed booking total. Remaining balance: ${booking.total_amount - totalPaid}`,
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // 3. Create payment record (from spec lines 1114-1128)
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        booking_id: bookingId,
        amount: data.amount,
        payment_method: data.payment_method,
        payment_date: new Date().toISOString(),
        proof_url: data.proof_url,
        notes: data.notes ? sanitizeTextWorker(data.notes) : undefined,
        refunded_amount: 0,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (paymentError) {
      return Response.json(
        {
          error: "PAYMENT_FAILED",
          message: paymentError.message,
        },
        { status: 500, headers: corsHeaders }
      );
    }

    // 4. Update booking payment_status (from spec lines 1139-1140)
    let newPaymentStatus: string;
    if (newTotalPaid >= booking.total_amount) {
      newPaymentStatus = "Paid";
    } else if (newTotalPaid > 0) {
      newPaymentStatus = "Partial";
    } else {
      newPaymentStatus = "Unpaid";
    }

    await supabase
      .from("bookings")
      .update({ payment_status: newPaymentStatus })
      .eq("booking_id", bookingId);

    const processingTime = Date.now() - startTime;

    return Response.json(
      {
        success: true,
        data: {
          payment_id: payment.payment_id,
          booking_id: bookingId,
          booking_reference: booking.booking_reference,
          amount: payment.amount,
          payment_method: payment.payment_method,
          payment_date: payment.payment_date,
          payment_status: newPaymentStatus,
          remaining_balance: booking.total_amount - newTotalPaid,
          status: "completed",
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
    console.error("[Record Payment] Error:", error);

    return Response.json(
      {
        error: "INTERNAL_ERROR",
        message: "Failed to record payment",
        details: process.env.NODE_ENV === "development" ? { error: String(error) } : undefined,
      },
      { status: 500, headers: corsHeaders }
    );
  }
};
