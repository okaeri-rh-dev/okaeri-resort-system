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

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { sanitizeTextWorker } from "../../../../../src/lib/security/sanitize-worker";
import { calculateExtraPersonFee, calculateWeekendNights } from "../../../../../src/utils/pricing";
import { logUnitAdded } from "../../../../lib/audit-logger-workers";
import { requireRole } from "../../../../lib/rbac";
import type { AuthenticatedRequest } from "../../../../lib/types";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

// Validation schema
const addUnitSchema = z
  .object({
    unit_id: z.string().uuid(),
    num_guests: z.number().int().min(1).max(20),
    rate_per_night: z.number().positive(),
    weekend_rate: z.number().positive().optional(),
    extra_person_rate: z.number().nonnegative().optional(),
    base_occupancy: z.number().int().positive().optional(),
    num_nights: z.number().int().positive(),
    subtotal: z.number().positive(),
    notes: z.string().max(500).optional(),
  })
  .refine((data) => data.subtotal >= data.rate_per_night * data.num_nights, {
    message: "subtotal must be at least rate_per_night * num_nights",
    path: ["subtotal"],
  });

/**
 * Main handler for adding unit to booking
 * Requires authentication (staff only)
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
    // RBAC: Require staff role or above
    try {
      requireRole(request, ["staff", "manager", "admin"]);
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

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Fetch unit data for pricing calculations
    const { data: unitData, error: unitFetchError } = await supabase
      .from("units")
      .select("base_rate, weekend_rate, extra_person_rate, base_occupancy")
      .eq("unit_id", data.unit_id)
      .single();

    if (unitFetchError || !unitData) {
      return Response.json(
        {
          error: "UNIT_NOT_FOUND",
          message: "Unit not found",
        },
        { status: 404, headers: corsHeaders }
      );
    }

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

    // 4. Calculate weekend surcharge and extra person fee
    const weekendNights = calculateWeekendNights(booking.check_in, booking.check_out);
    const weekendSurcharge = weekendNights * (unitData.weekend_rate - unitData.base_rate);
    const extraPersonCharge =
      calculateExtraPersonFee(
        data.num_guests,
        unitData.base_occupancy,
        unitData.extra_person_rate
      ) * data.num_nights;

    // 5. Insert into booking_units table
    const { data: newBookingUnit, error: insertError } = await supabase
      .from("booking_units")
      .insert({
        booking_id: bookingId,
        unit_id: data.unit_id,
        unit_price: data.rate_per_night * data.num_nights,
        weekend_surcharge: weekendSurcharge,
        extra_person_charge: extraPersonCharge,
        subtotal: data.subtotal,
        assigned_guests: data.num_guests,
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

    // 6. Triggers will auto-update booking totals
    // 7. Handle payment adjustment if payment exists
    await adjustPaymentForUnitChange(supabase, bookingId, data.subtotal, "unit_added");

    // 8. Audit logging
    const userId = (request as AuthenticatedRequest).user?.id;
    await logUnitAdded(supabase, bookingId, newBookingUnit, userId, request);

    // 9. Fetch updated booking
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
  supabase: SupabaseClient,
  bookingId: string,
  deltaAmount: number,
  reason: string
): Promise<void> {
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
