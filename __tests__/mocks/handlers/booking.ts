/**
 * MSW Handlers for Booking API Endpoints
 *
 * Mocks the Cloudflare Workers booking endpoints for testing without a running server.
 * Includes idempotency key tracking and proper error handling.
 */

import { http, HttpResponse } from "msw";

// In-memory storage for idempotency tracking
const seenIdempotencyKeys = new Map<string, any>();

// Helper to generate booking reference (format: BK-XXXXXXXXXX - 10 digits)
function generateBookingRef(): string {
  // Use last 10 digits of timestamp
  return `BK-${Date.now().toString().slice(-10)}`;
}

// Helper to calculate nights
function calculateNights(checkIn: string, checkOut: string): number {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

// Helper to calculate pricing
function calculatePricing(checkIn: string, checkOut: string, unitRequests: any[]) {
  const nights = calculateNights(checkIn, checkOut);
  const baseRatePerNight = 2000;
  const weekendRate = 2500;
  const extraPersonRate = 300;
  const baseOccupancy = 2;

  let subtotal = 0;
  let extraPersonFees = 0;
  let totalGuests = 0;
  let weekendSurcharge = 0;

  // Count weekend nights (Friday and Saturday nights)
  const checkInDate = new Date(checkIn);
  let weekendNights = 0;
  for (let i = 0; i < nights; i++) {
    const currentDate = new Date(checkInDate);
    currentDate.setDate(currentDate.getDate() + i);
    const dayOfWeek = currentDate.getDay();
    // Friday (5) or Saturday (6) nights count as weekend
    if (dayOfWeek === 5 || dayOfWeek === 6) {
      weekendNights++;
    }
  }

  // Calculate for each unit request
  for (const request of unitRequests) {
    const guestsPerUnit = request.guests_per_unit || 2;
    totalGuests += guestsPerUnit;
    const extraPersons = Math.max(0, guestsPerUnit - baseOccupancy);

    // Base price with weekend surcharge
    const weekdayNights = nights - weekendNights;
    subtotal += baseRatePerNight * weekdayNights + weekendRate * weekendNights;

    // Track weekend surcharge separately
    weekendSurcharge += (weekendRate - baseRatePerNight) * weekendNights;

    // Extra person charges
    const extraFee = extraPersonRate * extraPersons * nights;
    extraPersonFees += extraFee;
    subtotal += extraFee;
  }

  // Apply duration discounts
  let discountPercent = 0;
  let discountRuleName = null;
  if (nights >= 14) {
    discountPercent = 0.1; // 10% for 14+ nights
    discountRuleName = "Two Week Discount";
  } else if (nights >= 7) {
    discountPercent = 0.05; // 5% for 7+ nights
    discountRuleName = "Week Stay Discount";
  }

  const discountAmount = subtotal * discountPercent;
  const total = subtotal - discountAmount;
  const downpayment = total * 0.5; // 50% downpayment

  // Build discount object (null if no discount)
  const discount =
    discountAmount > 0
      ? {
          percent: discountPercent * 100,
          rule_name: discountRuleName,
          amount: discountAmount,
        }
      : null;

  return {
    nights,
    total_units: unitRequests.length,
    total_guests: totalGuests,
    base_total: subtotal,
    extra_person_fees: extraPersonFees,
    weekend_surcharge: weekendSurcharge,
    subtotal,
    discount,
    discount_amount: discountAmount,
    discount_percent: discountPercent * 100,
    total,
    downpayment_required: downpayment,
    base_amount: subtotal - discountAmount,
    rates: {
      base_rate: baseRatePerNight,
      weekend_rate: weekendRate,
      extra_person_rate: extraPersonRate,
      base_occupancy: baseOccupancy,
    },
  };
}

export const bookingHandlers = [
  // POST /api/guest-booking - Create booking
  http.post("http://localhost:8788/api/guest-booking", async ({ request }) => {
    try {
      const body: any = await request.json();

      // Validate required fields
      if (!body.guest_name || !body.email || !body.check_in || !body.check_out) {
        return HttpResponse.json(
          {
            success: false,
            error: "Missing required fields",
            details: "guest_name, email, check_in, and check_out are required",
          },
          { status: 400 }
        );
      }

      // Backward compatibility: Check for mixed legacy and new format (invalid)
      if (body.unit_id && body.unit_requests) {
        return HttpResponse.json(
          {
            success: false,
            error: "Invalid payload: cannot specify both unit_id and unit_requests",
          },
          { status: 400 }
        );
      }

      // Transform legacy single-unit format to multi-unit format
      let unitRequests = body.unit_requests;
      if (body.unit_id && !body.unit_requests) {
        // Legacy format: convert to multi-unit format
        unitRequests = [
          {
            guests_per_unit: body.num_guests || 2,
          },
        ];
      }

      // Validate unit requests
      if (!unitRequests || unitRequests.length === 0) {
        return HttpResponse.json(
          {
            success: false,
            error: "At least one unit request is required",
          },
          { status: 400 }
        );
      }

      // Validate max units
      if (unitRequests.length > 10) {
        return HttpResponse.json(
          {
            success: false,
            error: "Cannot request more than 10 units",
            details: "Maximum 10 units per booking",
          },
          { status: 400 }
        );
      }

      // Validate guest capacity (max 6 per unit)
      const maxOccupancyPerUnit = 6;
      for (const request of unitRequests) {
        if (request.guests_per_unit > maxOccupancyPerUnit) {
          return HttpResponse.json(
            {
              success: false,
              error: `Maximum ${maxOccupancyPerUnit} guests per unit`,
              details: "Guest count exceeds unit capacity",
            },
            { status: 400 }
          );
        }
      }

      // Check idempotency key
      if (body.idempotency_key && seenIdempotencyKeys.has(body.idempotency_key)) {
        const cachedBooking = seenIdempotencyKeys.get(body.idempotency_key);
        return HttpResponse.json(
          {
            success: true,
            booking: cachedBooking,
            is_duplicate: true,
          },
          { status: 200 }
        );
      }

      // Calculate pricing
      const pricing = calculatePricing(body.check_in, body.check_out, unitRequests);
      const nights = calculateNights(body.check_in, body.check_out);

      // Build discount_applied object
      let discountApplied = null;
      if (pricing.discount_amount > 0) {
        if (nights >= 14) {
          discountApplied = {
            percent: 10,
            rule_name: "Two Week Stay Discount",
            amount: pricing.discount_amount,
          };
        } else if (nights >= 7) {
          discountApplied = {
            percent: 5,
            rule_name: "Week Stay Discount",
            amount: pricing.discount_amount,
          };
        }
      }

      // Create mock booking
      const booking = {
        booking_id: crypto.randomUUID(),
        booking_reference: generateBookingRef(),
        guest_name: body.guest_name,
        email: body.email,
        contact_number: body.phone_number || body.contact_number || "+639171234567",
        check_in: body.check_in,
        check_out: body.check_out,
        num_guests: unitRequests.reduce(
          (sum: number, req: any) => sum + (req.guests_per_unit || 2),
          0
        ),
        is_multi_unit: unitRequests.length > 1,
        requested_unit_count: unitRequests.length,
        payment_status: "Pending",
        booking_status: "Confirmed",
        ...pricing,
        discount_applied: discountApplied,
        special_requests: body.special_requests || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Store for idempotency
      if (body.idempotency_key) {
        seenIdempotencyKeys.set(body.idempotency_key, booking);
      }

      return HttpResponse.json({ success: true, booking }, { status: 201 });
    } catch (error) {
      return HttpResponse.json(
        {
          success: false,
          error: "Internal server error",
        },
        { status: 500 }
      );
    }
  }),

  // POST /api/guest-booking/preview-pricing - Calculate pricing
  http.post("http://localhost:8788/api/guest-booking/preview-pricing", async ({ request }) => {
    try {
      const body: any = await request.json();

      // Validate required fields
      if (!body.check_in || !body.check_out || !body.unit_requests) {
        return HttpResponse.json(
          {
            success: false,
            error: "Missing required fields for pricing calculation",
          },
          { status: 400 }
        );
      }

      // Validate date range (check_out must be after check_in)
      const checkInDate = new Date(body.check_in);
      const checkOutDate = new Date(body.check_out);
      if (checkOutDate <= checkInDate) {
        return HttpResponse.json(
          {
            success: false,
            error: "Invalid date range: check_out must be after check_in",
          },
          { status: 400 }
        );
      }

      // Calculate pricing
      const pricing = calculatePricing(body.check_in, body.check_out, body.unit_requests);

      return HttpResponse.json(
        {
          success: true,
          pricing,
        },
        { status: 200 }
      );
    } catch (error) {
      return HttpResponse.json(
        {
          success: false,
          error: "Failed to calculate pricing",
        },
        { status: 500 }
      );
    }
  }),

  // GET /api/guest-booking/rates - Get static rates
  http.get("http://localhost:8788/api/guest-booking/rates", () => {
    return HttpResponse.json({
      success: true,
      rates: {
        base_rate: 2000,
        weekend_rate: 2500,
        extra_person_rate: 300,
        base_occupancy: 2,
        max_capacity_per_unit: 6,
      },
    });
  }),

  // GET /api/guest-booking/discount-rules - Get discount rules
  http.get("http://localhost:8788/api/guest-booking/discount-rules", () => {
    return HttpResponse.json({
      success: true,
      discount_rules: [
        {
          name: "Week Stay Discount",
          conditions: "7+ nights",
          discount_value: 5,
          description: "5% off for week-long stays",
        },
        {
          name: "Two Week Stay Discount",
          conditions: "14+ nights",
          discount_value: 10,
          description: "10% off for two-week stays",
        },
      ],
    });
  }),

  // GET /api/health - Health check
  http.get("http://localhost:8788/api/health", () => {
    return HttpResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  }),
];

// Export helper to reset idempotency cache between tests
export function resetIdempotencyCache() {
  seenIdempotencyKeys.clear();
}
