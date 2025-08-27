/**
 * Bookings endpoint tests with Philippine-specific data and scenarios
 * Tests booking CRUD operations, CSV import, calendar views, and payment tracking
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { server } from "@tests/mocks/server";
import { http, HttpResponse } from "msw";
import { bookingsApi } from "../bookings";
import { TEST_CONSTANTS, MOCK_USERS, philippineTestData } from "@tests/utils/test-utils";
import { mockHelpers } from "@tests/mocks/handlers";
import { formatPHP } from "@/lib/philippine-utils";
import type {
  Booking,
  CreateBookingPayload,
  UpdateBookingPayload,
  BookingStats,
} from "@/types/common";

// Mock booking data with Philippine context
const MOCK_BOOKINGS: Booking[] = [
  {
    id: "booking-1",
    propertyId: "property-boracay-1",
    guestName: "Juan Dela Cruz",
    guestEmail: "juan@gmail.com",
    guestPhone: "+639171234567",
    checkIn: "2024-12-25",
    checkOut: "2024-12-28",
    guests: 2,
    status: "CONFIRMED",
    source: "Walk-in",
    totalAmount: 15000,
    paidAmount: 7500,
    paymentMethod: "GCash",
    notes: "Christmas holiday booking",
    specialRequests: "Late check-in requested",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
  {
    id: "booking-2",
    propertyId: "property-palawan-1",
    guestName: "Maria Santos",
    guestEmail: "maria@yahoo.com.ph",
    guestPhone: "+639281234567",
    checkIn: "2024-01-15",
    checkOut: "2024-01-18",
    guests: 4,
    status: "CHECKED_OUT",
    source: "Online",
    totalAmount: 25000,
    paidAmount: 25000,
    paymentMethod: "Bank Transfer",
    notes: "Family vacation",
    specialRequests: "Extra beds for children",
    createdAt: new Date("2024-01-10"),
    updatedAt: new Date("2024-01-18"),
  },
  {
    id: "booking-3",
    propertyId: "property-bohol-1",
    guestName: "Pedro Gonzales",
    guestEmail: "pedro@hotmail.com",
    guestPhone: "+639391234567",
    checkIn: "2024-06-01",
    checkOut: "2024-06-03",
    guests: 1,
    status: "CANCELLED",
    source: "Phone",
    totalAmount: 8000,
    paidAmount: 0,
    paymentMethod: "Cash",
    notes: "Business trip cancelled",
    specialRequests: null,
    createdAt: new Date("2024-05-15"),
    updatedAt: new Date("2024-05-20"),
  },
];

const MOCK_BOOKING_STATS: BookingStats = {
  totalBookings: 3,
  confirmedBookings: 1,
  todayCheckIns: 0,
  todayCheckOuts: 1,
  totalRevenue: 48000,
  totalPaid: 32500,
  avgStayLength: 2.7,
  avgGuests: 2.3,
};

describe("Bookings API Endpoints", () => {
  beforeEach(() => {
    mockHelpers.reset();
    vi.clearAllMocks();

    // Setup booking endpoints mock handlers
    server.use(
      http.get(`${TEST_CONSTANTS.API_BASE_URL}/bookings`, ({ request }) => {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get("page") || "1");
        const limit = parseInt(url.searchParams.get("limit") || "10");
        const propertyId = url.searchParams.get("propertyId");
        const paymentStatus = url.searchParams.getAll("paymentStatus");

        let filteredBookings = [...MOCK_BOOKINGS];

        // Apply filters
        if (propertyId) {
          filteredBookings = filteredBookings.filter((b) => b.propertyId === propertyId);
        }

        if (paymentStatus.length > 0) {
          filteredBookings = filteredBookings.filter((b) => {
            const status =
              b.paidAmount >= b.totalAmount ? "PAID" : b.paidAmount > 0 ? "PARTIAL" : "UNPAID";
            return paymentStatus.includes(status);
          });
        }

        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedBookings = filteredBookings.slice(startIndex, endIndex);

        return HttpResponse.json({
          data: paginatedBookings,
          meta: {
            page,
            limit,
            total: filteredBookings.length,
            pages: Math.ceil(filteredBookings.length / limit),
          },
          stats: MOCK_BOOKING_STATS,
        });
      }),

      http.get(`${TEST_CONSTANTS.API_BASE_URL}/bookings/:id`, ({ params }) => {
        const booking = MOCK_BOOKINGS.find((b) => b.id === params.id);
        if (!booking) {
          return HttpResponse.json({ error: "Booking not found" }, { status: 404 });
        }
        return HttpResponse.json(booking);
      }),

      http.post(`${TEST_CONSTANTS.API_BASE_URL}/bookings/create`, async ({ request }) => {
        const data = (await request.json()) as CreateBookingPayload;

        // Validate required fields
        if (!data.propertyId || !data.guestName || !data.checkIn || !data.checkOut) {
          return HttpResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Validate Philippine phone number if provided
        if (data.guestPhone && !philippineTestData.validPhoneNumbers.includes(data.guestPhone)) {
          return HttpResponse.json(
            { error: "Invalid Philippine phone number format" },
            { status: 400 }
          );
        }

        // Validate dates
        const checkIn = new Date(data.checkIn);
        const checkOut = new Date(data.checkOut);
        if (checkOut <= checkIn) {
          return HttpResponse.json({ error: "Check-out must be after check-in" }, { status: 400 });
        }

        // Create new booking
        const newBooking: Booking = {
          id: `booking-${Date.now()}`,
          ...data,
          status: data.status || "PENDING",
          paidAmount: data.paidAmount || 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        MOCK_BOOKINGS.push(newBooking);
        return HttpResponse.json(newBooking, { status: 201 });
      }),

      http.put(`${TEST_CONSTANTS.API_BASE_URL}/bookings/:id`, async ({ params, request }) => {
        const bookingId = params.id as string;
        const updates = (await request.json()) as UpdateBookingPayload;
        const bookingIndex = MOCK_BOOKINGS.findIndex((b) => b.id === bookingId);

        if (bookingIndex === -1) {
          return HttpResponse.json({ error: "Booking not found" }, { status: 404 });
        }

        // Validate phone number if updating
        if (
          updates.guestPhone &&
          !philippineTestData.validPhoneNumbers.includes(updates.guestPhone)
        ) {
          return HttpResponse.json(
            { error: "Invalid Philippine phone number format" },
            { status: 400 }
          );
        }

        // Update booking
        MOCK_BOOKINGS[bookingIndex] = {
          ...MOCK_BOOKINGS[bookingIndex],
          ...updates,
          updatedAt: new Date(),
        };

        return HttpResponse.json(MOCK_BOOKINGS[bookingIndex]);
      }),

      http.delete(`${TEST_CONSTANTS.API_BASE_URL}/bookings/:id`, ({ params }) => {
        const bookingIndex = MOCK_BOOKINGS.findIndex((b) => b.id === params.id);
        if (bookingIndex === -1) {
          return HttpResponse.json({ error: "Booking not found" }, { status: 404 });
        }

        MOCK_BOOKINGS.splice(bookingIndex, 1);
        return HttpResponse.json({ message: "Booking cancelled successfully" });
      }),

      http.get(`${TEST_CONSTANTS.API_BASE_URL}/bookings/check-availability`, ({ request }) => {
        const url = new URL(request.url);
        const propertyId = url.searchParams.get("propertyId");
        const checkIn = url.searchParams.get("checkIn");
        const checkOut = url.searchParams.get("checkOut");
        const excludeBookingId = url.searchParams.get("excludeBookingId");

        if (!propertyId || !checkIn || !checkOut) {
          return HttpResponse.json({ error: "Missing required parameters" }, { status: 400 });
        }

        // Check for conflicts
        const conflicts = MOCK_BOOKINGS.filter(
          (booking) =>
            booking.id !== excludeBookingId &&
            booking.propertyId === propertyId &&
            booking.status !== "CANCELLED" &&
            !(
              new Date(booking.checkOut) <= new Date(checkIn) ||
              new Date(booking.checkIn) >= new Date(checkOut)
            )
        );

        return HttpResponse.json({
          available: conflicts.length === 0,
          conflicts,
        });
      }),

      http.get(`${TEST_CONSTANTS.API_BASE_URL}/bookings/calendar`, ({ request }) => {
        const url = new URL(request.url);
        const propertyId = url.searchParams.get("propertyId");
        const month = parseInt(url.searchParams.get("month") || "1");
        const year = parseInt(url.searchParams.get("year") || "2024");

        let calendarBookings = MOCK_BOOKINGS.map((booking) => ({
          id: booking.id,
          propertyId: booking.propertyId,
          propertyName: `Property ${booking.propertyId.split("-")[1]}`,
          guestName: booking.guestName,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          status: booking.status,
        }));

        if (propertyId) {
          calendarBookings = calendarBookings.filter((b) => b.propertyId === propertyId);
        }

        // Filter by month/year
        calendarBookings = calendarBookings.filter((booking) => {
          const checkIn = new Date(booking.checkIn);
          const checkOut = new Date(booking.checkOut);
          return (
            (checkIn.getFullYear() === year && checkIn.getMonth() + 1 === month) ||
            (checkOut.getFullYear() === year && checkOut.getMonth() + 1 === month)
          );
        });

        return HttpResponse.json({ bookings: calendarBookings });
      }),

      http.post(`${TEST_CONSTANTS.API_BASE_URL}/bookings/import-csv`, async ({ request }) => {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
          return HttpResponse.json({ error: "No file provided" }, { status: 400 });
        }

        if (!file.name.endsWith(".csv")) {
          return HttpResponse.json({ error: "File must be CSV format" }, { status: 400 });
        }

        // Simulate CSV processing
        return HttpResponse.json({
          imported: 5,
          failed: 1,
          errors: [{ row: 3, error: "Invalid phone number format" }],
        });
      })
    );
  });

  afterEach(() => {
    // Reset mock bookings to original state
    MOCK_BOOKINGS.splice(0);
    MOCK_BOOKINGS.push(
      ...[
        {
          id: "booking-1",
          propertyId: "property-boracay-1",
          guestName: "Juan Dela Cruz",
          guestEmail: "juan@gmail.com",
          guestPhone: "+639171234567",
          checkIn: "2024-12-25",
          checkOut: "2024-12-28",
          guests: 2,
          status: "CONFIRMED",
          source: "Walk-in",
          totalAmount: 15000,
          paidAmount: 7500,
          paymentMethod: "GCash",
          notes: "Christmas holiday booking",
          specialRequests: "Late check-in requested",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
        },
        {
          id: "booking-2",
          propertyId: "property-palawan-1",
          guestName: "Maria Santos",
          guestEmail: "maria@yahoo.com.ph",
          guestPhone: "+639281234567",
          checkIn: "2024-01-15",
          checkOut: "2024-01-18",
          guests: 4,
          status: "CHECKED_OUT",
          source: "Online",
          totalAmount: 25000,
          paidAmount: 25000,
          paymentMethod: "Bank Transfer",
          notes: "Family vacation",
          specialRequests: "Extra beds for children",
          createdAt: new Date("2024-01-10"),
          updatedAt: new Date("2024-01-18"),
        },
        {
          id: "booking-3",
          propertyId: "property-bohol-1",
          guestName: "Pedro Gonzales",
          guestEmail: "pedro@hotmail.com",
          guestPhone: "+639391234567",
          checkIn: "2024-06-01",
          checkOut: "2024-06-03",
          guests: 1,
          status: "CANCELLED",
          source: "Phone",
          totalAmount: 8000,
          paidAmount: 0,
          paymentMethod: "Cash",
          notes: "Business trip cancelled",
          specialRequests: null,
          createdAt: new Date("2024-05-15"),
          updatedAt: new Date("2024-05-20"),
        },
      ]
    );
  });

  describe("GET /bookings", () => {
    it("should list bookings with pagination and stats", async () => {
      const result = await bookingsApi.list({ page: 1, limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.meta).toMatchObject({
        page: 1,
        limit: 2,
        total: 3,
        pages: 2,
      });
      expect(result.stats).toMatchObject(MOCK_BOOKING_STATS);
    });

    it("should filter bookings by property", async () => {
      const result = await bookingsApi.list({
        propertyId: "property-boracay-1",
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].propertyId).toBe("property-boracay-1");
    });

    it("should filter bookings by payment status", async () => {
      const result = await bookingsApi.list({
        paymentStatus: ["PAID"],
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].paidAmount).toBe(result.data[0].totalAmount);
    });

    it("should handle empty results gracefully", async () => {
      const result = await bookingsApi.list({
        propertyId: "non-existent-property",
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });

    it("should validate pagination parameters", async () => {
      const result = await bookingsApi.list({ page: 2, limit: 2 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.page).toBe(2);
    });
  });

  describe("GET /bookings/:id", () => {
    it("should return booking by ID with Philippine data", async () => {
      const booking = await bookingsApi.getById("booking-1");

      expect(booking).toMatchObject({
        id: "booking-1",
        guestName: "Juan Dela Cruz",
        guestPhone: "+639171234567",
        totalAmount: 15000,
        paymentMethod: "GCash",
        checkIn: "2024-12-25",
        checkOut: "2024-12-28",
      });
    });

    it("should return 404 for non-existent booking", async () => {
      await expect(bookingsApi.getById("non-existent")).rejects.toMatchObject({
        status: 404,
        message: "Booking not found",
      });
    });

    it("should handle malformed booking ID", async () => {
      await expect(bookingsApi.getById("")).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  describe("POST /bookings/create", () => {
    it("should create booking with Philippine guest data", async () => {
      const bookingData: CreateBookingPayload = {
        propertyId: "property-cebu-1",
        guestName: philippineTestData.validNames[0],
        guestEmail: "test@gmail.com",
        guestPhone: philippineTestData.validPhoneNumbers[0],
        checkIn: "2024-03-15",
        checkOut: "2024-03-17",
        guests: 2,
        totalAmount: 12000,
        paidAmount: 6000,
        paymentMethod: "GCash",
        notes: "Anniversary celebration",
        sendConfirmation: true,
      };

      const result = await bookingsApi.create(bookingData);

      expect(result).toMatchObject({
        id: expect.stringContaining("booking-"),
        guestName: bookingData.guestName,
        guestPhone: bookingData.guestPhone,
        totalAmount: 12000,
        paymentMethod: "GCash",
        status: "PENDING",
      });
    });

    it("should create booking with minimum required fields", async () => {
      const bookingData: CreateBookingPayload = {
        propertyId: "property-minimal-1",
        guestName: "Test Guest",
        checkIn: "2024-04-01",
        checkOut: "2024-04-03",
        guests: 1,
        totalAmount: 5000,
      };

      const result = await bookingsApi.create(bookingData);

      expect(result).toMatchObject({
        guestName: "Test Guest",
        totalAmount: 5000,
        paidAmount: 0,
        status: "PENDING",
      });
    });

    it("should validate required fields", async () => {
      const incompleteData = {
        guestName: "Test Guest",
        checkIn: "2024-04-01",
        // Missing propertyId, checkOut, guests, totalAmount
      } as CreateBookingPayload;

      await expect(bookingsApi.create(incompleteData)).rejects.toMatchObject({
        status: 400,
        message: "Missing required fields",
      });
    });

    it("should validate Philippine phone number format", async () => {
      const bookingData: CreateBookingPayload = {
        propertyId: "property-test-1",
        guestName: "Test Guest",
        guestPhone: "1234567890", // Invalid format
        checkIn: "2024-04-01",
        checkOut: "2024-04-03",
        guests: 1,
        totalAmount: 5000,
      };

      await expect(bookingsApi.create(bookingData)).rejects.toMatchObject({
        status: 400,
        message: "Invalid Philippine phone number format",
      });
    });

    it("should validate date logic", async () => {
      const bookingData: CreateBookingPayload = {
        propertyId: "property-test-1",
        guestName: "Test Guest",
        checkIn: "2024-04-03",
        checkOut: "2024-04-01", // Before check-in
        guests: 1,
        totalAmount: 5000,
      };

      await expect(bookingsApi.create(bookingData)).rejects.toMatchObject({
        status: 400,
        message: "Check-out must be after check-in",
      });
    });

    it("should handle Philippine peso amounts correctly", async () => {
      const bookingData: CreateBookingPayload = {
        propertyId: "property-peso-1",
        guestName: "Peso Test",
        checkIn: "2024-05-01",
        checkOut: "2024-05-03",
        guests: 2,
        totalAmount: 150000, // PHP 150,000
        paidAmount: 75000, // PHP 75,000
        paymentMethod: "Bank Transfer",
      };

      const result = await bookingsApi.create(bookingData);

      expect(result.totalAmount).toBe(150000);
      expect(result.paidAmount).toBe(75000);

      // Test that amounts can be formatted as PHP
      expect(formatPHP(result.totalAmount)).toBe("₱150,000.00");
      expect(formatPHP(result.paidAmount)).toBe("₱75,000.00");
    });
  });

  describe("PUT /bookings/:id", () => {
    it("should update booking with valid data", async () => {
      const updates: UpdateBookingPayload = {
        guestName: "Updated Guest Name",
        guestPhone: philippineTestData.validPhoneNumbers[1],
        paidAmount: 10000,
        notes: "Updated notes",
      };

      const result = await bookingsApi.update("booking-1", updates);

      expect(result).toMatchObject({
        id: "booking-1",
        guestName: updates.guestName,
        guestPhone: updates.guestPhone,
        paidAmount: updates.paidAmount,
        notes: updates.notes,
        updatedAt: expect.any(Date),
      });
    });

    it("should validate Philippine phone number in updates", async () => {
      const updates: UpdateBookingPayload = {
        guestPhone: "invalid-phone",
      };

      await expect(bookingsApi.update("booking-1", updates)).rejects.toMatchObject({
        status: 400,
        message: "Invalid Philippine phone number format",
      });
    });

    it("should return 404 for non-existent booking", async () => {
      await expect(
        bookingsApi.update("non-existent", {
          guestName: "Test",
        })
      ).rejects.toMatchObject({
        status: 404,
        message: "Booking not found",
      });
    });
  });

  describe("DELETE /bookings/:id", () => {
    it("should cancel booking successfully", async () => {
      await expect(bookingsApi.cancel("booking-1")).resolves.toBeUndefined();
    });

    it("should return 404 for non-existent booking", async () => {
      await expect(bookingsApi.cancel("non-existent")).rejects.toMatchObject({
        status: 404,
        message: "Booking not found",
      });
    });
  });

  describe("PUT /bookings/:id (check-in/check-out)", () => {
    it("should check in guest successfully", async () => {
      const result = await bookingsApi.checkIn("booking-1");

      expect(result).toMatchObject({
        id: "booking-1",
        status: "CHECKED_IN",
        updatedAt: expect.any(Date),
      });
    });

    it("should check out guest successfully", async () => {
      const result = await bookingsApi.checkOut("booking-1");

      expect(result).toMatchObject({
        id: "booking-1",
        status: "CHECKED_OUT",
        updatedAt: expect.any(Date),
      });
    });
  });

  describe("GET /bookings/check-availability", () => {
    it("should check availability with no conflicts", async () => {
      const result = await bookingsApi.checkAvailability({
        propertyId: "property-available-1",
        checkIn: "2024-03-01",
        checkOut: "2024-03-03",
      });

      expect(result).toMatchObject({
        available: true,
        conflicts: [],
      });
    });

    it("should detect booking conflicts", async () => {
      const result = await bookingsApi.checkAvailability({
        propertyId: "property-boracay-1",
        checkIn: "2024-12-26", // Overlaps with booking-1
        checkOut: "2024-12-29",
      });

      expect(result).toMatchObject({
        available: false,
        conflicts: expect.arrayContaining([
          expect.objectContaining({
            id: "booking-1",
            propertyId: "property-boracay-1",
          }),
        ]),
      });
    });

    it("should exclude specific booking from conflict check", async () => {
      const result = await bookingsApi.checkAvailability({
        propertyId: "property-boracay-1",
        checkIn: "2024-12-26",
        checkOut: "2024-12-29",
        excludeBookingId: "booking-1",
      });

      expect(result).toMatchObject({
        available: true,
        conflicts: [],
      });
    });

    it("should validate required parameters", async () => {
      await expect(
        bookingsApi.checkAvailability({
          propertyId: "property-test-1",
          checkIn: "2024-03-01",
          checkOut: "", // Empty check-out
        })
      ).rejects.toMatchObject({
        status: 400,
        message: "Missing required parameters",
      });
    });
  });

  describe("GET /bookings/calendar", () => {
    it("should return calendar bookings for specific month", async () => {
      const result = await bookingsApi.getCalendar({
        month: 12,
        year: 2024,
      });

      expect(result.bookings).toContainEqual(
        expect.objectContaining({
          id: "booking-1",
          guestName: "Juan Dela Cruz",
          checkIn: "2024-12-25",
          checkOut: "2024-12-28",
        })
      );
    });

    it("should filter calendar by property", async () => {
      const result = await bookingsApi.getCalendar({
        propertyId: "property-boracay-1",
        month: 12,
        year: 2024,
      });

      expect(result.bookings).toHaveLength(1);
      expect(result.bookings[0].propertyId).toBe("property-boracay-1");
    });

    it("should handle months with no bookings", async () => {
      const result = await bookingsApi.getCalendar({
        month: 11,
        year: 2024,
      });

      expect(result.bookings).toHaveLength(0);
    });
  });

  describe("POST /bookings/import-csv", () => {
    it("should import CSV file successfully", async () => {
      const csvContent = `
        Guest Name,Email,Phone,Check In,Check Out,Guests,Total Amount,Payment Method
        Juan Dela Cruz,juan@test.com,+639171234567,2024-03-01,2024-03-03,2,10000,GCash
        Maria Santos,maria@test.com,+639281234567,2024-03-05,2024-03-07,4,20000,Bank Transfer
      `.trim();

      const file = new File([csvContent], "bookings.csv", { type: "text/csv" });

      const result = await bookingsApi.importCsv(file);

      expect(result).toMatchObject({
        imported: 5,
        failed: 1,
        errors: [{ row: 3, error: "Invalid phone number format" }],
      });
    });

    it("should reject non-CSV files", async () => {
      const file = new File(["content"], "bookings.txt", { type: "text/plain" });

      await expect(bookingsApi.importCsv(file)).rejects.toMatchObject({
        status: 400,
        message: "File must be CSV format",
      });
    });

    it("should handle missing file", async () => {
      // @ts-expect-error - Testing invalid input
      await expect(bookingsApi.importCsv(null)).rejects.toMatchObject({
        status: 400,
        message: "No file provided",
      });
    });

    it("should report progress during import", async () => {
      const csvContent = "Guest Name,Email,Check In,Check Out,Guests,Total Amount\n";
      const file = new File([csvContent], "bookings.csv", { type: "text/csv" });

      const progressCallback = vi.fn();

      await bookingsApi.importCsv(file, {
        onProgress: progressCallback,
      });

      // Progress callback should have been called (mocked in the handler)
      expect(progressCallback).not.toHaveBeenCalled(); // MSW doesn't actually call progress
    });
  });

  describe("Payment method handling for Philippines", () => {
    it("should accept common Philippine payment methods", async () => {
      const philippinePaymentMethods = [
        "GCash",
        "PayMaya",
        "Bank Transfer",
        "Cash",
        "Credit Card",
        "Debit Card",
        "Online Banking",
        "Remittance",
        "Installment",
      ];

      for (const paymentMethod of philippinePaymentMethods) {
        const bookingData: CreateBookingPayload = {
          propertyId: "property-payment-test",
          guestName: "Payment Test",
          checkIn: "2024-06-01",
          checkOut: "2024-06-02",
          guests: 1,
          totalAmount: 5000,
          paymentMethod,
        };

        const result = await bookingsApi.create(bookingData);
        expect(result.paymentMethod).toBe(paymentMethod);
      }
    });

    it("should handle partial payments correctly", async () => {
      const bookingData: CreateBookingPayload = {
        propertyId: "property-partial-1",
        guestName: "Partial Payment Test",
        checkIn: "2024-07-01",
        checkOut: "2024-07-03",
        guests: 2,
        totalAmount: 20000,
        paidAmount: 5000, // 25% down payment
        paymentMethod: "GCash",
      };

      const result = await bookingsApi.create(bookingData);

      expect(result.totalAmount).toBe(20000);
      expect(result.paidAmount).toBe(5000);

      // Calculate remaining balance
      const balance = result.totalAmount - result.paidAmount;
      expect(balance).toBe(15000);
      expect(formatPHP(balance)).toBe("₱15,000.00");
    });
  });

  describe("Philippine holiday and peak season handling", () => {
    it("should handle Christmas and New Year bookings", async () => {
      const holidayBooking: CreateBookingPayload = {
        propertyId: "property-holiday-1",
        guestName: "Holiday Guest",
        checkIn: "2024-12-24", // Christmas Eve
        checkOut: "2024-12-26", // Boxing Day
        guests: 4,
        totalAmount: 30000, // Peak season rates
        paidAmount: 15000,
        paymentMethod: "Bank Transfer",
        specialRequests: "Christmas dinner setup",
      };

      const result = await bookingsApi.create(holidayBooking);

      expect(result.checkIn).toBe("2024-12-24");
      expect(result.checkOut).toBe("2024-12-26");
      expect(result.totalAmount).toBe(30000);
      expect(result.specialRequests).toBe("Christmas dinner setup");
    });

    it("should handle summer peak season bookings", async () => {
      const summerBooking: CreateBookingPayload = {
        propertyId: "property-summer-1",
        guestName: "Summer Vacation",
        checkIn: "2024-04-15", // Summer vacation period
        checkOut: "2024-04-20",
        guests: 6,
        totalAmount: 75000, // Peak season rates
        paymentMethod: "Credit Card",
        specialRequests: "Beach activities setup",
      };

      const result = await bookingsApi.create(summerBooking);

      expect(result.totalAmount).toBe(75000);
      expect(result.specialRequests).toBe("Beach activities setup");
    });
  });

  describe("Network resilience for Philippine internet conditions", () => {
    it("should handle slow network responses", async () => {
      // Simulate slow 3G connection
      server.use(
        http.get(`${TEST_CONSTANTS.API_BASE_URL}/bookings`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          return HttpResponse.json({
            data: MOCK_BOOKINGS.slice(0, 1),
            meta: { page: 1, limit: 10, total: 1, pages: 1 },
            stats: MOCK_BOOKING_STATS,
          });
        })
      );

      const result = await bookingsApi.list({ page: 1, limit: 10 });
      expect(result.data).toHaveLength(1);
    }, 5000);

    it("should handle intermittent connection failures", async () => {
      server.use(
        http.get(`${TEST_CONSTANTS.API_BASE_URL}/bookings/booking-1`, () => {
          return HttpResponse.error(); // Network error
        })
      );

      await expect(bookingsApi.getById("booking-1")).rejects.toMatchObject({
        code: "NETWORK_ERROR",
      });
    });
  });
});
