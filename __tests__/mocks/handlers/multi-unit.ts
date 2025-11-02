/**
 * MSW Handlers for Multi-Unit Booking API Endpoints
 *
 * Mocks the multi-unit booking endpoints for testing.
 */

import { http, HttpResponse } from "msw";

// In-memory storage for multi-unit bookings
const multiUnitBookings = new Map<string, any>();
let bookingIdCounter = 1;

// Helper to generate booking ID
function generateBookingId(): string {
  return `MU-${String(bookingIdCounter++).padStart(8, "0")}`;
}

export const multiUnitHandlers = [
  // GET /api/bookings/multi-unit - Fetch all multi-unit bookings
  http.get("*/api/bookings/multi-unit", () => {
    const bookings = Array.from(multiUnitBookings.values());
    return HttpResponse.json({
      success: true,
      data: bookings,
    });
  }),

  // GET /api/availability/multi-unit - Check availability for multiple units
  http.get("*/api/availability/multi-unit", ({ request }) => {
    const url = new URL(request.url);
    const unitIds = url.searchParams.getAll("units[]");
    const checkIn = url.searchParams.get("checkIn");
    const checkOut = url.searchParams.get("checkOut");

    if (!unitIds.length || !checkIn || !checkOut) {
      return HttpResponse.json(
        {
          success: false,
          error: "Missing required parameters",
        },
        { status: 400 }
      );
    }

    // Mock availability response - all units available for testing
    const availability = unitIds.map((unitId) => ({
      unit_id: unitId,
      available: true,
      conflicts: [],
    }));

    return HttpResponse.json({
      success: true,
      data: {
        available: true,
        units: availability,
      },
    });
  }),

  // POST /api/pricing/quote - Get pricing quote
  http.post("*/api/pricing/quote", async ({ request }) => {
    const body: any = await request.json();
    const { check_in, check_out, unit_requests } = body;

    if (!check_in || !check_out || !unit_requests) {
      return HttpResponse.json(
        {
          success: false,
          error: "Missing required fields",
        },
        { status: 400 }
      );
    }

    // Calculate nights
    const checkInDate = new Date(check_in);
    const checkOutDate = new Date(check_out);
    const nights = Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Mock pricing calculation
    const baseRatePerNight = 2000;
    const subtotal = baseRatePerNight * nights * unit_requests.length;
    const total = subtotal;
    const downpayment = total * 0.5;

    return HttpResponse.json({
      success: true,
      pricing: {
        nights,
        total_units: unit_requests.length,
        total_guests: unit_requests.reduce(
          (sum: number, req: any) => sum + (req.guests_per_unit || 2),
          0
        ),
        subtotal,
        total,
        downpayment_required: downpayment,
        base_amount: subtotal,
        rates: {
          base_rate: baseRatePerNight,
          weekend_rate: 2500,
          extra_person_rate: 300,
          base_occupancy: 2,
        },
      },
    });
  }),

  // POST /api/bookings/multi-unit - Create multi-unit booking
  http.post("*/api/bookings/multi-unit", async ({ request }) => {
    const body: any = await request.json();

    const bookingId = generateBookingId();
    const booking = {
      booking_id: bookingId,
      ...body,
      booking_status: "Confirmed",
      payment_status: "Pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    multiUnitBookings.set(bookingId, booking);

    return HttpResponse.json(
      {
        success: true,
        data: booking,
      },
      { status: 201 }
    );
  }),

  // POST /api/bookings/:bookingId/units/add - Add unit to booking
  http.post("*/api/bookings/:bookingId/units/add", async ({ request, params }) => {
    const { bookingId } = params;
    const body: any = await request.json();

    const booking = multiUnitBookings.get(bookingId as string);
    if (!booking) {
      return HttpResponse.json(
        {
          success: false,
          error: "Booking not found",
        },
        { status: 404 }
      );
    }

    // Add unit to booking
    const updatedBooking = {
      ...booking,
      units: [...(booking.units || []), body],
      updated_at: new Date().toISOString(),
    };

    multiUnitBookings.set(bookingId as string, updatedBooking);

    return HttpResponse.json({
      success: true,
      data: updatedBooking,
    });
  }),

  // POST /api/bookings/:bookingId/units/remove - Remove unit from booking
  http.post("*/api/bookings/:bookingId/units/remove", async ({ request, params }) => {
    const { bookingId } = params;
    const body: any = await request.json();
    const { unitId } = body;

    const booking = multiUnitBookings.get(bookingId as string);
    if (!booking) {
      return HttpResponse.json(
        {
          success: false,
          error: "Booking not found",
        },
        { status: 404 }
      );
    }

    // Remove unit from booking
    const updatedBooking = {
      ...booking,
      units: (booking.units || []).filter((u: any) => u.unit_id !== unitId),
      updated_at: new Date().toISOString(),
    };

    multiUnitBookings.set(bookingId as string, updatedBooking);

    return HttpResponse.json({
      success: true,
      data: updatedBooking,
    });
  }),

  // PUT /api/bookings/multi-unit/:bookingId - Update booking
  http.put("*/api/bookings/multi-unit/:bookingId", async ({ request, params }) => {
    const { bookingId } = params;
    const body: any = await request.json();

    const booking = multiUnitBookings.get(bookingId as string);
    if (!booking) {
      return HttpResponse.json(
        {
          success: false,
          error: "Booking not found",
        },
        { status: 404 }
      );
    }

    const updatedBooking = {
      ...booking,
      ...body,
      updated_at: new Date().toISOString(),
    };

    multiUnitBookings.set(bookingId as string, updatedBooking);

    return HttpResponse.json({
      success: true,
      data: updatedBooking,
    });
  }),

  // DELETE /api/bookings/multi-unit/:bookingId - Delete booking
  http.delete("*/api/bookings/multi-unit/:bookingId", ({ params }) => {
    const { bookingId } = params;

    if (!multiUnitBookings.has(bookingId as string)) {
      return HttpResponse.json(
        {
          success: false,
          error: "Booking not found",
        },
        { status: 404 }
      );
    }

    multiUnitBookings.delete(bookingId as string);

    return HttpResponse.json({
      success: true,
      message: "Booking deleted successfully",
    });
  }),

  // POST /api/bookings/:bookingId/payments/record - Record payment
  http.post("*/api/bookings/:bookingId/payments/record", async ({ request, params }) => {
    const { bookingId } = params;
    const body: any = await request.json();

    const booking = multiUnitBookings.get(bookingId as string);
    if (!booking) {
      return HttpResponse.json(
        {
          success: false,
          error: "Booking not found",
        },
        { status: 404 }
      );
    }

    const payment = {
      payment_id: crypto.randomUUID(),
      booking_id: bookingId,
      amount: body.amount,
      payment_method: body.payment_method || "cash",
      payment_status: "Completed",
      created_at: new Date().toISOString(),
    };

    return HttpResponse.json({
      success: true,
      data: payment,
    });
  }),

  // POST /api/bookings/:bookingId/payments/refund - Process refund
  http.post("*/api/bookings/:bookingId/payments/refund", async ({ request, params }) => {
    const { bookingId } = params;
    const body: any = await request.json();

    const booking = multiUnitBookings.get(bookingId as string);
    if (!booking) {
      return HttpResponse.json(
        {
          success: false,
          error: "Booking not found",
        },
        { status: 404 }
      );
    }

    const refund = {
      refund_id: crypto.randomUUID(),
      booking_id: bookingId,
      amount: body.amount,
      reason: body.reason,
      notes: body.notes,
      refund_status: "Completed",
      created_at: new Date().toISOString(),
    };

    return HttpResponse.json({
      success: true,
      data: refund,
    });
  }),
];

// Export helper to reset bookings between tests
export function resetMultiUnitBookings() {
  multiUnitBookings.clear();
  bookingIdCounter = 1;
}
