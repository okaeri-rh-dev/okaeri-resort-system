/**
 * Booking API Handlers
 * MSW handlers for booking management endpoints using IndexedDB backend
 */

import { http, HttpResponse } from "msw";
import { mockDatabase, PhilippineValidators } from "../db/mock-database";
import { MockJWT, simulateDelay } from "./auth";
import type {
  Booking,
  BookingStatus,
  PaymentStatus,
  CreateBookingData,
  UpdateBookingData,
} from "@/types/common";

/**
 * Authentication middleware for protected routes
 */
async function requireAuth(
  request: Request
): Promise<{ success: true; userId: string } | { success: false; response: Response }> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      success: false,
      response: HttpResponse.json(
        { error: "Authentication required", message: "No valid authentication token provided" },
        { status: 401 }
      ),
    };
  }

  const token = authHeader.substring(7);
  const validation = MockJWT.validateToken(token);

  if (!validation.valid || !validation.userId) {
    return {
      success: false,
      response: HttpResponse.json(
        { error: "Invalid token", message: "Authentication token is invalid or expired" },
        { status: 401 }
      ),
    };
  }

  return { success: true, userId: validation.userId };
}

/**
 * Helper to validate booking dates
 */
function validateBookingDates(
  checkIn: string,
  checkOut: string
): { valid: boolean; error?: string } {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
    return { valid: false, error: "Invalid date format" };
  }

  if (checkInDate < today) {
    return { valid: false, error: "Check-in date cannot be in the past" };
  }

  if (checkOutDate <= checkInDate) {
    return { valid: false, error: "Check-out date must be after check-in date" };
  }

  return { valid: true };
}

/**
 * Helper to calculate nights between dates
 */
function calculateNights(checkIn: string, checkOut: string): number {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  return Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
}

const API_BASE_URL = "/api";

export const bookingHandlers = [
  // Get bookings with filters and pagination
  http.get(`${API_BASE_URL}/bookings`, async ({ request, params }) => {
    await simulateDelay();

    const auth = await requireAuth(request);
    if (!auth.success) {
      return auth.response;
    }

    try {
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = parseInt(url.searchParams.get("limit") || "20");
      const projectId = url.searchParams.get("projectId");
      const propertyId = url.searchParams.get("propertyId");
      const status = url.searchParams.getAll("status");
      const paymentStatus = url.searchParams.getAll("paymentStatus");
      const source = url.searchParams.get("source");
      const search = url.searchParams.get("search");
      const dateFrom = url.searchParams.get("dateFrom");
      const dateTo = url.searchParams.get("dateTo");

      // Build filters
      const filters: Array<{ field: string; operator: string; value: any }> = [];

      if (projectId) {
        filters.push({ field: "projectId", operator: "=", value: projectId });
      }

      if (propertyId) {
        filters.push({ field: "propertyId", operator: "=", value: propertyId });
      }

      if (status.length > 0) {
        filters.push({ field: "status", operator: "in", value: status });
      }

      if (paymentStatus.length > 0) {
        filters.push({ field: "paymentStatus", operator: "in", value: paymentStatus });
      }

      if (source) {
        filters.push({ field: "source", operator: "=", value: source });
      }

      if (search) {
        // For simplicity, search in guest name and email
        filters.push({ field: "guestName", operator: "like", value: search });
      }

      if (dateFrom) {
        filters.push({ field: "checkIn", operator: ">=", value: dateFrom });
      }

      if (dateTo) {
        filters.push({ field: "checkOut", operator: "<=", value: dateTo });
      }

      // Query bookings
      const result = await mockDatabase.queryBookings({
        filters,
        limit,
        offset: (page - 1) * limit,
        orderBy: { field: "createdAt", direction: "desc" },
      });

      // Calculate summary statistics
      const allBookings = await mockDatabase.queryBookings({
        filters: projectId ? [{ field: "projectId", operator: "=", value: projectId }] : [],
      });

      const stats = {
        totalBookings: allBookings.total,
        confirmedBookings: allBookings.data.filter((b) => b.status === "CONFIRMED").length,
        checkedInToday: allBookings.data.filter((b) => {
          const today = new Date().toISOString().split("T")[0];
          return b.checkIn === today && b.status === "CONFIRMED";
        }).length,
        checkingOutToday: allBookings.data.filter((b) => {
          const today = new Date().toISOString().split("T")[0];
          return b.checkOut === today && (b.status === "CONFIRMED" || b.status === "CHECKED_IN");
        }).length,
        totalRevenue: allBookings.data.reduce((sum, b) => sum + b.totalAmount, 0),
        totalPaid: allBookings.data.reduce((sum, b) => sum + b.paidAmount, 0),
        averageStayLength:
          allBookings.data.length > 0
            ? allBookings.data.reduce((sum, b) => sum + b.nights, 0) / allBookings.data.length
            : 0,
        averageGuests:
          allBookings.data.length > 0
            ? allBookings.data.reduce((sum, b) => sum + b.guests, 0) / allBookings.data.length
            : 0,
      };

      return HttpResponse.json({
        data: result.data,
        meta: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / result.limit),
          hasNext: result.hasNext,
          hasPrev: result.hasPrev,
        },
        stats,
      });
    } catch (error) {
      console.error("[Booking Handler] Get bookings error:", error);
      return HttpResponse.json(
        { error: "Internal server error", message: "An unexpected error occurred" },
        { status: 500 }
      );
    }
  }),

  // Get single booking
  http.get(`${API_BASE_URL}/bookings/:id`, async ({ request, params }) => {
    await simulateDelay(50, 200);

    const auth = await requireAuth(request);
    if (!auth.success) {
      return auth.response;
    }

    try {
      const bookingId = params.id as string;
      const booking = await mockDatabase.getBookingById(bookingId);

      if (!booking) {
        return HttpResponse.json(
          { error: "Booking not found", message: `No booking found with ID: ${bookingId}` },
          { status: 404 }
        );
      }

      return HttpResponse.json(booking);
    } catch (error) {
      console.error("[Booking Handler] Get booking error:", error);
      return HttpResponse.json(
        { error: "Internal server error", message: "An unexpected error occurred" },
        { status: 500 }
      );
    }
  }),

  // Create new booking
  http.post(`${API_BASE_URL}/bookings`, async ({ request }) => {
    await simulateDelay();

    const auth = await requireAuth(request);
    if (!auth.success) {
      return auth.response;
    }

    try {
      const data = (await request.json()) as CreateBookingData;

      // Validate required fields
      if (!data.propertyId || !data.guestName || !data.checkIn || !data.checkOut) {
        return HttpResponse.json(
          {
            error: "Validation failed",
            message: "Missing required fields: propertyId, guestName, checkIn, checkOut",
          },
          { status: 400 }
        );
      }

      // Validate dates
      const dateValidation = validateBookingDates(data.checkIn, data.checkOut);
      if (!dateValidation.valid) {
        return HttpResponse.json(
          { error: "Invalid dates", message: dateValidation.error },
          { status: 400 }
        );
      }

      // Validate Philippine phone number if provided
      if (data.guestPhone) {
        const normalizedPhone = PhilippineValidators.normalizePhoneNumber(data.guestPhone);
        if (!PhilippineValidators.validatePhoneNumber(normalizedPhone)) {
          return HttpResponse.json(
            {
              error: "Invalid phone number",
              message: "Please provide a valid Philippine mobile number",
            },
            { status: 400 }
          );
        }
        data.guestPhone = normalizedPhone;
      }

      // Validate email if provided
      if (data.guestEmail && !PhilippineValidators.validateEmail(data.guestEmail)) {
        return HttpResponse.json(
          { error: "Invalid email", message: "Please provide a valid email address" },
          { status: 400 }
        );
      }

      // Check availability
      const availability = await mockDatabase.checkBookingAvailability(
        data.propertyId,
        data.checkIn,
        data.checkOut
      );

      if (!availability.available) {
        return HttpResponse.json(
          {
            error: "Property not available",
            message: "The selected property is not available for the requested dates",
            conflicts: availability.conflicts,
          },
          { status: 409 }
        );
      }

      // Create booking
      const booking = await mockDatabase.createBooking({
        projectId: "project_okaeri_001", // TODO: Get from user context
        ...data,
      });

      return HttpResponse.json(booking, { status: 201 });
    } catch (error) {
      console.error("[Booking Handler] Create booking error:", error);
      return HttpResponse.json(
        { error: "Internal server error", message: "An unexpected error occurred" },
        { status: 500 }
      );
    }
  }),

  // Update booking
  http.put(`${API_BASE_URL}/bookings/:id`, async ({ request, params }) => {
    await simulateDelay();

    const auth = await requireAuth(request);
    if (!auth.success) {
      return auth.response;
    }

    try {
      const bookingId = params.id as string;
      const updates = (await request.json()) as UpdateBookingData;

      // Validate dates if provided
      if (updates.checkIn || updates.checkOut) {
        const currentBooking = await mockDatabase.getBookingById(bookingId);
        if (!currentBooking) {
          return HttpResponse.json(
            { error: "Booking not found", message: `No booking found with ID: ${bookingId}` },
            { status: 404 }
          );
        }

        const checkIn = updates.checkIn || currentBooking.checkIn;
        const checkOut = updates.checkOut || currentBooking.checkOut;

        const dateValidation = validateBookingDates(checkIn, checkOut);
        if (!dateValidation.valid) {
          return HttpResponse.json(
            { error: "Invalid dates", message: dateValidation.error },
            { status: 400 }
          );
        }

        // Check availability if dates changed
        if (updates.checkIn || updates.checkOut) {
          const availability = await mockDatabase.checkBookingAvailability(
            currentBooking.propertyId,
            checkIn,
            checkOut,
            bookingId
          );

          if (!availability.available) {
            return HttpResponse.json(
              {
                error: "Property not available",
                message: "The property is not available for the updated dates",
                conflicts: availability.conflicts,
              },
              { status: 409 }
            );
          }
        }
      }

      // Validate phone number if provided
      if (updates.guestPhone) {
        const normalizedPhone = PhilippineValidators.normalizePhoneNumber(updates.guestPhone);
        if (!PhilippineValidators.validatePhoneNumber(normalizedPhone)) {
          return HttpResponse.json(
            {
              error: "Invalid phone number",
              message: "Please provide a valid Philippine mobile number",
            },
            { status: 400 }
          );
        }
        updates.guestPhone = normalizedPhone;
      }

      // Update booking
      const updatedBooking = await mockDatabase.updateBooking(bookingId, updates);

      if (!updatedBooking) {
        return HttpResponse.json(
          { error: "Booking not found", message: `No booking found with ID: ${bookingId}` },
          { status: 404 }
        );
      }

      return HttpResponse.json(updatedBooking);
    } catch (error) {
      console.error("[Booking Handler] Update booking error:", error);
      return HttpResponse.json(
        { error: "Internal server error", message: "An unexpected error occurred" },
        { status: 500 }
      );
    }
  }),

  // Cancel booking
  http.delete(`${API_BASE_URL}/bookings/:id`, async ({ request, params }) => {
    await simulateDelay();

    const auth = await requireAuth(request);
    if (!auth.success) {
      return auth.response;
    }

    try {
      const bookingId = params.id as string;

      const updatedBooking = await mockDatabase.updateBooking(bookingId, {
        status: "CANCELLED" as BookingStatus,
        paymentStatus: "REFUNDED" as PaymentStatus,
      });

      if (!updatedBooking) {
        return HttpResponse.json(
          { error: "Booking not found", message: `No booking found with ID: ${bookingId}` },
          { status: 404 }
        );
      }

      return HttpResponse.json({
        message: "Booking cancelled successfully",
        booking: updatedBooking,
      });
    } catch (error) {
      console.error("[Booking Handler] Cancel booking error:", error);
      return HttpResponse.json(
        { error: "Internal server error", message: "An unexpected error occurred" },
        { status: 500 }
      );
    }
  }),

  // Check availability
  http.get(`${API_BASE_URL}/bookings/availability`, async ({ request }) => {
    await simulateDelay(100, 300);

    const auth = await requireAuth(request);
    if (!auth.success) {
      return auth.response;
    }

    try {
      const url = new URL(request.url);
      const propertyId = url.searchParams.get("propertyId");
      const checkIn = url.searchParams.get("checkIn");
      const checkOut = url.searchParams.get("checkOut");
      const excludeBookingId = url.searchParams.get("excludeBookingId");

      if (!propertyId || !checkIn || !checkOut) {
        return HttpResponse.json(
          {
            error: "Missing parameters",
            message: "propertyId, checkIn, and checkOut are required",
          },
          { status: 400 }
        );
      }

      const availability = await mockDatabase.checkBookingAvailability(
        propertyId,
        checkIn,
        checkOut,
        excludeBookingId || undefined
      );

      return HttpResponse.json(availability);
    } catch (error) {
      console.error("[Booking Handler] Check availability error:", error);
      return HttpResponse.json(
        { error: "Internal server error", message: "An unexpected error occurred" },
        { status: 500 }
      );
    }
  }),

  // Get calendar view
  http.get(`${API_BASE_URL}/bookings/calendar`, async ({ request }) => {
    await simulateDelay(200, 400);

    const auth = await requireAuth(request);
    if (!auth.success) {
      return auth.response;
    }

    try {
      const url = new URL(request.url);
      const propertyId = url.searchParams.get("propertyId");
      const month = parseInt(url.searchParams.get("month") || String(new Date().getMonth() + 1));
      const year = parseInt(url.searchParams.get("year") || String(new Date().getFullYear()));

      // Build filters for the calendar view
      const filters: Array<{ field: string; operator: string; value: any }> = [];

      if (propertyId) {
        filters.push({ field: "propertyId", operator: "=", value: propertyId });
      }

      // Get bookings for the month (plus buffer for overlapping bookings)
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      filters.push({
        field: "checkIn",
        operator: "<=",
        value: endDate.toISOString().split("T")[0],
      });
      filters.push({
        field: "checkOut",
        operator: ">=",
        value: startDate.toISOString().split("T")[0],
      });

      const bookings = await mockDatabase.queryBookings({
        filters,
        limit: 1000, // Calendar needs all data
      });

      // Format for calendar display
      const calendarBookings = bookings.data.map((booking) => ({
        id: booking.id,
        propertyId: booking.propertyId,
        propertyName: `Property ${booking.propertyId.split("_").pop()}`, // Mock property name
        guestName: booking.guestName,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        status: booking.status,
        nights: booking.nights,
        totalAmount: booking.totalAmount,
      }));

      return HttpResponse.json({
        month,
        year,
        bookings: calendarBookings,
      });
    } catch (error) {
      console.error("[Booking Handler] Get calendar error:", error);
      return HttpResponse.json(
        { error: "Internal server error", message: "An unexpected error occurred" },
        { status: 500 }
      );
    }
  }),
];
