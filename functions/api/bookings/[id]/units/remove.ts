/**
 * Remove Unit from Booking Endpoint
 *
 * POST /api/bookings/:booking_id/units/remove
 *
 * Removes a unit from a multi-unit booking.
 * Automatically processes refund if payment exists.
 *
 * Phase 2C: Unit Management Operations
 */

import type { PagesFunction } from "@cloudflare/workers-types";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

interface Env {
  VITE_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

// Validation schema
const removeUnitSchema = z.object({
  unit_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

// Type for validation - prefix with underscore to indicate intentionally unused
type _RemoveUnitRequest = z.infer<typeof removeUnitSchema>;

/**
 * Main handler for removing unit from booking
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
    const validationResult = removeUnitSchema.safeParse(rawData);

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

    // 1. Verify booking exists and is modifiable
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("booking_id, booking_status, unit_count, payment_status")
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

    // Business rule: Only Pending or Confirmed bookings can be modified
    if (!["Pending", "Confirmed"].includes(booking.booking_status)) {
      return Response.json(
        {
          error: "CANNOT_MODIFY_BOOKING",
          message: `Cannot modify booking with status ${booking.booking_status}`,
        },
        { status: 409, headers: corsHeaders }
      );
    }

    // Business rule: Cannot remove last unit
    if (booking.unit_count <= 1) {
      return Response.json(
        {
          error: "LAST_UNIT_REMOVAL",
          message: "Cannot remove the last unit from a booking. Cancel the booking instead.",
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // 2. Get unit details for refund calculation
    const { data: bookingUnit, error: unitError } = await supabase
      .from("booking_units")
      .select("booking_unit_id, subtotal")
      .eq("booking_id", bookingId)
      .eq("unit_id", data.unit_id)
      .single();

    if (unitError || !bookingUnit) {
      return Response.json(
        {
          error: "UNIT_NOT_IN_BOOKING",
          message: "Unit not found in this booking",
        },
        { status: 404, headers: corsHeaders }
      );
    }

    // 3. Delete from booking_units table
    const { error: deleteError } = await supabase
      .from("booking_units")
      .delete()
      .eq("booking_unit_id", bookingUnit.booking_unit_id);

    if (deleteError) {
      throw deleteError;
    }

    // 4. Triggers will auto-update booking totals
    // 5. Handle refund if payment exists
    const refundResult = await processRefundForRemovedUnit(
      supabase,
      bookingId,
      bookingUnit.subtotal,
      data.reason || "unit_removed"
    );

    // 6. Fetch updated booking
    const { data: updatedBooking } = await supabase
      .from("bookings")
      .select(
        `
        *,
        booking_units (
          *,
          unit:units (*)
        )
      `
      )
      .eq("booking_id", bookingId)
      .single();

    const processingTime = Date.now() - startTime;

    return Response.json(
      {
        success: true,
        data: {
          booking_id: bookingId,
          booking_reference: updatedBooking?.booking_reference,
          total_amount: updatedBooking?.total_amount,
          units: updatedBooking?.booking_units || [],
          refund_amount: refundResult?.refund_amount,
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
    console.error("[Remove Unit] Error:", error);

    return Response.json(
      {
        error: "INTERNAL_ERROR",
        message: "Failed to remove unit from booking",
        details: process.env.NODE_ENV === "development" ? { error: String(error) } : undefined,
      },
      { status: 500, headers: corsHeaders }
    );
  }
};

/**
 * Process refund when unit is removed
 * From spec lines 1368-1423
 */
async function processRefundForRemovedUnit(
  supabase: ReturnType<typeof createClient>,
  bookingId: string,
  unitSubtotal: number,
  reason: string
): Promise<{ refund_amount?: number }> {
  // Get existing payment
  const { data: payment } = await supabase
    .from("payments")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!payment) {
    // No payment yet, just update booking total (triggers handle this)
    return {};
  }

  // Unit removed - refund needed
  const refundAmount = unitSubtotal;

  // Create payment adjustment record
  await supabase.from("payment_adjustments").insert({
    payment_id: payment.payment_id,
    reason: reason,
    amount_change: -refundAmount, // Negative for refund
  });

  // Update refunded_amount in payments table
  const newRefundedAmount = (payment.refunded_amount || 0) + refundAmount;

  await supabase
    .from("payments")
    .update({
      refunded_amount: newRefundedAmount,
    })
    .eq("payment_id", payment.payment_id);

  // Update booking payment_status
  if (newRefundedAmount >= payment.amount) {
    // Full refund
    await supabase
      .from("bookings")
      .update({ payment_status: "Refunded" })
      .eq("booking_id", bookingId);
  } else if (newRefundedAmount > 0) {
    // Partial refund
    await supabase
      .from("bookings")
      .update({ payment_status: "PartialRefund" })
      .eq("booking_id", bookingId);
  }

  return { refund_amount: refundAmount };
}
