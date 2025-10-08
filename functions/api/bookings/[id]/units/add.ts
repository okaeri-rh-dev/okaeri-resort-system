/**
 * Add Unit to Existing Booking Endpoint
 *
 * POST /api/bookings/:booking_id/units/add
 *
 * Adds an additional unit to an existing multi-unit booking.
 * Automatically adjusts payment if needed.
 *
 * Phase 2C: Unit Management Operations
 */

import type { PagesFunction } from "@cloudflare/workers-types";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { sanitizeTextWorker } from "../../../../../src/lib/security/sanitize-worker";

interface Env {
  VITE_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

// Validation schema
const addUnitSchema = z
  .object({
    unit_id: z.string().uuid(),
    guest_name: z.string().min(1).max(100),
    rate_per_night: z.number().positive(),
    num_nights: z.number().int().positive(),
    subtotal: z.number().positive(),
    notes: z.string().max(500).optional(),
  })
  .refine((data) => data.subtotal === data.rate_per_night * data.num_nights, {
    message: "subtotal must equal rate_per_night * num_nights",
    path: ["subtotal"],
  });

// Type for validation - prefix with underscore to indicate intentionally unused
type _AddUnitRequest = z.infer<typeof addUnitSchema>;

/**
 * Main handler for adding unit to booking
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
    const validationResult = addUnitSchema.safeParse(rawData);

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

    // Sanitize notes
    const sanitizedNotes = data.notes ? sanitizeTextWorker(data.notes) : undefined;

    const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    // 1. Verify booking exists and is modifiable
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("booking_id, booking_status, check_in, check_out, total_amount, payment_status")
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

    // 2. Validate num_nights matches booking date range
    const checkIn = new Date(booking.check_in);
    const checkOut = new Date(booking.check_out);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    if (data.num_nights !== nights) {
      return Response.json(
        {
          error: "VALIDATION_ERROR",
          message: `num_nights (${data.num_nights}) must match booking's date range (${nights} nights)`,
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // 3. Check unit availability for booking dates
    const { data: availabilityData, error: availError } = await supabase.rpc(
      "check_multi_unit_availability",
      {
        p_unit_ids: [data.unit_id],
        p_check_in: booking.check_in,
        p_check_out: booking.check_out,
        p_exclude_booking_id: bookingId, // Exclude current booking from check
      }
    );

    if (availError || !availabilityData || availabilityData[0]?.is_available === false) {
      return Response.json(
        {
          error: "UNIT_UNAVAILABLE",
          message: "Unit is not available for the booking dates",
        },
        { status: 409, headers: corsHeaders }
      );
    }

    // 4. Insert into booking_units table
    const { data: _newBookingUnit, error: insertError } = await supabase
      .from("booking_units")
      .insert({
        booking_id: bookingId,
        unit_id: data.unit_id,
        unit_price: data.rate_per_night * data.num_nights,
        weekend_surcharge: 0, // TODO: Calculate from pricing logic
        extra_person_charge: 0, // TODO: Calculate from pricing logic
        subtotal: data.subtotal,
        assigned_guests: 0, // TODO: Extract from request
        unit_notes: sanitizedNotes,
      })
      .select()
      .single();

    if (insertError) {
      // Check for duplicate unit error
      if (insertError.code === "23505") {
        // Unique constraint violation
        return Response.json(
          {
            error: "DUPLICATE_UNIT",
            message: "This unit is already in the booking",
          },
          { status: 409, headers: corsHeaders }
        );
      }

      throw insertError;
    }

    // 5. Triggers will auto-update booking totals
    // 6. Handle payment adjustment if payment exists
    await adjustPaymentForUnitChange(supabase, bookingId, data.subtotal, "unit_added");

    // 7. Fetch updated booking
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
    console.error("[Add Unit] Error:", error);

    return Response.json(
      {
        error: "INTERNAL_ERROR",
        message: "Failed to add unit to booking",
        details: process.env.NODE_ENV === "development" ? { error: String(error) } : undefined,
      },
      { status: 500, headers: corsHeaders }
    );
  }
};

/**
 * Adjust payment when unit is added
 * From spec lines 1368-1423
 */
async function adjustPaymentForUnitChange(
  supabase: ReturnType<typeof createClient>,
  bookingId: string,
  deltaAmount: number,
  reason: string
) {
  // Get existing payment
  const { data: payment } = await supabase
    .from("payments")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!payment) {
    // No payment yet, triggers will update booking total
    return;
  }

  if (deltaAmount > 0) {
    // Unit added - additional payment needed
    await supabase.from("payment_adjustments").insert({
      payment_id: payment.payment_id,
      reason: reason,
      amount_change: deltaAmount,
    });

    // Update booking payment_status to Partial (needs additional payment)
    await supabase
      .from("bookings")
      .update({ payment_status: "Partial" })
      .eq("booking_id", bookingId);
  }
}
