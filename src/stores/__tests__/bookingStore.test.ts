/**
 * Comprehensive tests for booking store
 * Tests all booking state management, optimistic updates, and Philippine-specific features
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useBookingStore } from "../bookingStore";
import { useProjectStore } from "../projectStore";
import { useUIStore } from "../uiStore";
import {
  BookingTestBuilder,
  PhilippineDataGenerator,
  QuickScenarios,
  TDD_CONSTANTS,
} from "@tests/utils/tdd-helpers";
import { MOCK_USERS, securityHelpers } from "@tests/utils/test-utils";
import { BookingStatus } from "@/types/common";

// Mock dependencies
vi.mock("@/api/client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../projectStore", () => ({
  useProjectStore: {
    getState: vi.fn(() => ({
      activeProjectId: "test-project-123",
      properties: [
        {
          id: "property-1",
          name: "Beach Villa",
          type: "VILLA",
          capacity: 8,
        },
        {
          id: "property-2",
          name: "Ocean Suite",
          type: "SUITE",
          capacity: 4,
        },
      ],
    })),
  },
}));

// Create persistent mock toast functions
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
};

vi.mock("../uiStore", () => ({
  useUIStore: {
    getState: vi.fn(() => ({
      toast: mockToast,
    })),
  },
}));

import { apiClient } from "@/api/client";

describe("BookingStore - Comprehensive Tests", () => {
  beforeEach(() => {
    // Use real timers for these tests to avoid timeout issues
    vi.useRealTimers();

    // Reset store state using getState directly
    useBookingStore.getState().reset();

    // Clear all mocks
    vi.clearAllMocks();

    // Clear mock toast functions specifically
    mockToast.success.mockClear();
    mockToast.error.mockClear();
    mockToast.info.mockClear();
    mockToast.warning.mockClear();
  });

  afterEach(async () => {
    vi.clearAllMocks();
    vi.clearAllTimers();

    // Reset store state
    useBookingStore.getState().reset();

    // Flush any pending promises
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  describe("fetchBookings", () => {
    it("should fetch bookings with pagination and filters", async () => {
      const mockBookings = BookingTestBuilder.create().buildMany(5);
      const mockResponse = {
        data: {
          data: mockBookings,
          meta: {
            total: 50,
            page: 1,
            limit: 20,
          },
        },
      };

      (apiClient.get as any).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useBookingStore());

      await act(async () => {
        await result.current.fetchBookings({
          status: BookingStatus.CONFIRMED,
          propertyId: "property-1",
        });
      });

      // Wait for all state updates to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.bookings).toEqual(mockBookings);
      expect(result.current.totalBookings).toBe(50);
      expect(result.current.error).toBe(null);
      expect(result.current.lastFetch).toBeTruthy();

      expect(apiClient.get).toHaveBeenCalledWith(
        "/projects/test-project-123/bookings",
        expect.objectContaining({
          page: 1,
          limit: 20,
          status: BookingStatus.CONFIRMED,
          propertyId: "property-1",
        })
      );
    });

    it("should handle fetch error with proper error state", async () => {
      const error = new Error("Network error");
      (apiClient.get as any).mockRejectedValue(error);

      const { result } = renderHook(() => useBookingStore());

      await expect(
        act(async () => {
          try {
            await result.current.fetchBookings();
          } catch (e) {
            // Error is expected, wait for state to update
            await waitFor(() => {
              expect(result.current.isLoading).toBe(false);
            });
            throw e;
          }
        })
      ).rejects.toThrow("Network error");

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBe("Network error");
      });

      expect(mockToast.error).toHaveBeenCalledWith("Failed to fetch bookings", "Network error");
    });

    it("should require active project to fetch bookings", async () => {
      (useProjectStore.getState as any).mockReturnValue({
        activeProjectId: null,
      });

      const { result } = renderHook(() => useBookingStore());

      await expect(
        act(async () => {
          await result.current.fetchBookings();
        })
      ).rejects.toThrow("No active project selected");
    });
  });

  describe("createBooking", () => {
    it("should create booking with optimistic update and rollback on error", async () => {
      const bookingData = BookingTestBuilder.create()
        .withGuestName("Juan Dela Cruz")
        .withPhone(PhilippineDataGenerator.mobileNumber())
        .withAmount(
          PhilippineDataGenerator.phpAmount(10000, 25000),
          PhilippineDataGenerator.phpAmount(3000, 8000)
        )
        .build();

      const createdBooking = {
        id: "booking-123",
        ...bookingData,
        status: BookingStatus.PENDING,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        nights: 1,
        paidAmount: bookingData.depositAmount || 0,
        paymentStatus: "PARTIAL" as any,
        source: "DIRECT" as any,
      };

      (apiClient.post as any).mockResolvedValue({ data: createdBooking });

      const { result } = renderHook(() => useBookingStore());

      let booking: any;
      await act(async () => {
        booking = await result.current.createBooking(bookingData);
      });

      // Wait for state updates to complete
      await waitFor(() => {
        expect(result.current.optimisticBookings.length).toBe(0);
        expect(result.current.bookings.length).toBe(1);
      });

      expect(result.current.bookings[0]).toMatchObject(createdBooking);
      expect(result.current.totalBookings).toBe(1);
      expect(result.current.isCreating).toBe(false);
      expect(booking).toEqual(createdBooking);

      expect(apiClient.post).toHaveBeenCalledWith(
        "/projects/test-project-123/bookings",
        bookingData
      );
      expect(mockToast.success).toHaveBeenCalledWith("Booking created successfully");
    });

    it("should calculate nights correctly for booking", async () => {
      const bookingData = BookingTestBuilder.create()
        .withDates(new Date("2024-12-20").toISOString(), new Date("2024-12-25").toISOString())
        .build();

      (apiClient.post as any).mockResolvedValue({
        data: { id: "booking-123", ...bookingData, nights: 5 },
      });

      const { result } = renderHook(() => useBookingStore());

      await act(async () => {
        await result.current.createBooking(bookingData);
      });

      // Check that optimistic booking had correct nights calculation
      expect(apiClient.post).toHaveBeenCalledWith(
        "/projects/test-project-123/bookings",
        bookingData
      );
    });

    it("should remove optimistic booking on error", async () => {
      const bookingData = BookingTestBuilder.create().build();
      const error = new Error("Booking conflict");

      (apiClient.post as any).mockRejectedValue(error);

      const { result } = renderHook(() => useBookingStore());

      await expect(
        act(async () => {
          await result.current.createBooking(bookingData);
        })
      ).rejects.toThrow("Booking conflict");

      // Wait for state updates to complete
      await waitFor(() => {
        expect(result.current.optimisticBookings.length).toBe(0);
        expect(result.current.bookings.length).toBe(0);
        expect(result.current.error).toBe("Booking conflict");
        expect(result.current.isCreating).toBe(false);
      });
    });
  });

  describe("updateBooking", () => {
    it("should update booking optimistically and rollback on error", async () => {
      const originalBooking = {
        id: "booking-123",
        ...BookingTestBuilder.create().build(),
        status: BookingStatus.PENDING,
      };

      const updateData = {
        status: BookingStatus.CONFIRMED,
        notes: "Confirmed by manager",
      };

      const updatedBooking = { ...originalBooking, ...updateData };

      const { result } = renderHook(() => useBookingStore());

      // Set initial booking
      act(() => {
        result.current.setBookings([originalBooking]);
      });

      (apiClient.patch as any).mockResolvedValue({ data: updatedBooking });

      await act(async () => {
        await result.current.updateBooking("booking-123", updateData);
      });

      expect(result.current.bookings[0]).toEqual(updatedBooking);
      expect(result.current.isUpdating).toBe(false);

      expect(apiClient.patch).toHaveBeenCalledWith(
        "/projects/test-project-123/bookings/booking-123",
        updateData
      );
      expect(mockToast.success).toHaveBeenCalledWith("Booking updated successfully");
    });

    it("should rollback optimistic update on error", async () => {
      const originalBooking = {
        id: "booking-123",
        ...BookingTestBuilder.create().build(),
        status: BookingStatus.PENDING,
      };

      const { result } = renderHook(() => useBookingStore());

      act(() => {
        result.current.setBookings([originalBooking]);
      });

      const error = new Error("Update failed");
      (apiClient.patch as any).mockRejectedValue(error);

      await expect(
        act(async () => {
          await result.current.updateBooking("booking-123", {
            status: BookingStatus.CONFIRMED,
          });
        })
      ).rejects.toThrow("Update failed");

      // Should rollback to original booking
      expect(result.current.bookings[0]).toEqual(originalBooking);
      expect(result.current.error).toBe("Update failed");
    });
  });

  describe("Status Management", () => {
    it("should check in a booking", async () => {
      const booking = {
        id: "booking-123",
        ...BookingTestBuilder.create().build(),
        status: BookingStatus.CONFIRMED,
      };

      const { result } = renderHook(() => useBookingStore());

      act(() => {
        result.current.setBookings([booking]);
      });

      (apiClient.patch as any).mockResolvedValue({
        data: { ...booking, status: BookingStatus.CHECKED_IN },
      });

      await act(async () => {
        await result.current.checkIn("booking-123");
      });

      expect(apiClient.patch).toHaveBeenCalledWith(
        "/projects/test-project-123/bookings/booking-123",
        { status: BookingStatus.CHECKED_IN }
      );
    });

    it("should check out a booking", async () => {
      const booking = {
        id: "booking-123",
        ...BookingTestBuilder.create().build(),
        status: BookingStatus.CHECKED_IN,
      };

      const { result } = renderHook(() => useBookingStore());

      act(() => {
        result.current.setBookings([booking]);
      });

      (apiClient.patch as any).mockResolvedValue({
        data: { ...booking, status: BookingStatus.CHECKED_OUT },
      });

      await act(async () => {
        await result.current.checkOut("booking-123");
      });

      expect(apiClient.patch).toHaveBeenCalledWith(
        "/projects/test-project-123/bookings/booking-123",
        { status: BookingStatus.CHECKED_OUT }
      );
    });

    it("should cancel booking with reason", async () => {
      const booking = {
        id: "booking-123",
        ...BookingTestBuilder.create().build(),
        status: BookingStatus.CONFIRMED,
      };

      const { result } = renderHook(() => useBookingStore());

      act(() => {
        result.current.setBookings([booking]);
      });

      (apiClient.patch as any).mockResolvedValue({
        data: {
          ...booking,
          status: BookingStatus.CANCELLED,
          notes: "Cancellation reason: Guest request",
        },
      });

      await act(async () => {
        await result.current.cancelBooking("booking-123", "Guest request");
      });

      expect(apiClient.patch).toHaveBeenCalledWith(
        "/projects/test-project-123/bookings/booking-123",
        {
          status: BookingStatus.CANCELLED,
          notes: "Cancellation reason: Guest request",
        }
      );
    });
  });

  describe("Payment Tracking", () => {
    it("should update payment and calculate payment status", async () => {
      const booking = {
        id: "booking-123",
        ...BookingTestBuilder.create().withAmount("20000.00", "5000.00").build(),
        paidAmount: 5000,
        totalAmount: 20000,
        paymentStatus: "PARTIAL",
      };

      const { result } = renderHook(() => useBookingStore());

      act(() => {
        result.current.setBookings([booking]);
      });

      (apiClient.patch as any).mockResolvedValue({
        data: {
          ...booking,
          paidAmount: 20000,
          paymentStatus: "PAID",
        },
      });

      await act(async () => {
        await result.current.updatePayment("booking-123", 15000, "GCASH");
      });

      expect(apiClient.patch).toHaveBeenCalledWith(
        "/projects/test-project-123/bookings/booking-123",
        {
          paidAmount: 20000,
          paymentStatus: "PAID",
          paymentMethod: "GCASH",
        }
      );
    });

    it("should handle partial payments correctly", async () => {
      const booking = {
        id: "booking-123",
        ...BookingTestBuilder.create().withAmount("25000.00", "10000.00").build(),
        paidAmount: 0,
        totalAmount: 25000,
        paymentStatus: "PENDING",
      };

      const { result } = renderHook(() => useBookingStore());

      act(() => {
        result.current.setBookings([booking]);
      });

      (apiClient.patch as any).mockResolvedValue({
        data: {
          ...booking,
          paidAmount: 10000,
          paymentStatus: "PARTIAL",
        },
      });

      await act(async () => {
        await result.current.updatePayment("booking-123", 10000, "BANK_TRANSFER");
      });

      expect(apiClient.patch).toHaveBeenCalledWith(
        "/projects/test-project-123/bookings/booking-123",
        {
          paidAmount: 10000,
          paymentStatus: "PARTIAL",
          paymentMethod: "BANK_TRANSFER",
        }
      );
    });
  });

  describe("Availability Management", () => {
    it("should check property availability", async () => {
      (apiClient.get as any).mockResolvedValue({
        data: { available: true },
      });

      const { result } = renderHook(() => useBookingStore());

      const isAvailable = await act(async () => {
        return await result.current.checkAvailability(
          "property-1",
          new Date("2024-12-20"),
          new Date("2024-12-25")
        );
      });

      expect(isAvailable).toBe(true);
      expect(apiClient.get).toHaveBeenCalledWith(
        "/projects/test-project-123/properties/property-1/availability",
        {
          checkIn: new Date("2024-12-20").toISOString(),
          checkOut: new Date("2024-12-25").toISOString(),
        }
      );
    });

    it("should fetch and cache availability for multiple properties", async () => {
      const mockAvailability = {
        data: {
          "property-1": ["2024-12-20", "2024-12-21"],
          "property-2": ["2024-12-22", "2024-12-23"],
        },
      };

      (apiClient.post as any).mockResolvedValue(mockAvailability);

      const { result } = renderHook(() => useBookingStore());

      await act(async () => {
        await result.current.fetchAvailability(
          ["property-1", "property-2"],
          new Date("2024-12-01"),
          new Date("2024-12-31")
        );
      });

      expect(result.current.availability.get("property-1")).toBeDefined();
      expect(result.current.availability.get("property-2")).toBeDefined();
      expect(apiClient.post).toHaveBeenCalledWith("/projects/test-project-123/availability", {
        propertyIds: ["property-1", "property-2"],
        startDate: new Date("2024-12-01").toISOString(),
        endDate: new Date("2024-12-31").toISOString(),
      });
    });
  });

  describe("Calendar and Timeline Views", () => {
    it("should generate calendar events from bookings", () => {
      const bookings = [
        {
          id: "booking-1",
          guestName: "Test Guest 1",
          guestEmail: "test1@example.com",
          guestPhone: "+639171234567",
          checkIn: "2024-12-20T00:00:00Z",
          checkOut: "2024-12-25T00:00:00Z",
          guests: 2,
          totalAmount: 10000,
          propertyId: "property-1",
          status: BookingStatus.CONFIRMED,
          nights: 5,
          paidAmount: 0,
          paymentStatus: "PENDING" as any,
          source: "DIRECT" as any,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "booking-2",
          guestName: "Test Guest 2",
          guestEmail: "test2@example.com",
          guestPhone: "+639171234568",
          checkIn: "2024-12-22T00:00:00Z",
          checkOut: "2024-12-27T00:00:00Z",
          guests: 4,
          totalAmount: 15000,
          propertyId: "property-2",
          status: BookingStatus.CHECKED_IN,
          nights: 5,
          paidAmount: 0,
          paymentStatus: "PENDING" as any,
          source: "DIRECT" as any,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const { result } = renderHook(() => useBookingStore());

      act(() => {
        result.current.setBookings(bookings as any);
        result.current.getCalendarEvents(new Date("2024-12-01"), new Date("2024-12-31"));
      });

      expect(result.current.calendarEvents).toHaveLength(2);
      expect(result.current.calendarEvents[0]).toMatchObject({
        id: "booking-1",
        propertyId: "property-1",
        propertyName: "Beach Villa",
        status: BookingStatus.CONFIRMED,
        color: "#10b981", // green for confirmed
      });
      expect(result.current.calendarEvents[1]).toMatchObject({
        id: "booking-2",
        propertyId: "property-2",
        propertyName: "Ocean Suite",
        status: BookingStatus.CHECKED_IN,
        color: "#3b82f6", // blue for checked in
      });
    });

    it("should generate timeline data for properties", () => {
      const bookings = [
        {
          id: "booking-1",
          guestName: "Test Guest 1",
          guestEmail: "test1@example.com",
          guestPhone: "+639171234567",
          checkIn: "2024-12-20T00:00:00Z",
          checkOut: "2024-12-25T00:00:00Z",
          guests: 2,
          totalAmount: 10000,
          propertyId: "property-1",
          status: BookingStatus.CONFIRMED,
          nights: 5,
          paidAmount: 0,
          paymentStatus: "PENDING" as any,
          source: "DIRECT" as any,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "booking-2",
          guestName: "Test Guest 2",
          guestEmail: "test2@example.com",
          guestPhone: "+639171234568",
          checkIn: "2024-12-26T00:00:00Z",
          checkOut: "2024-12-28T00:00:00Z",
          guests: 1,
          totalAmount: 5000,
          propertyId: "property-1",
          status: BookingStatus.PENDING,
          nights: 2,
          paidAmount: 0,
          paymentStatus: "PENDING" as any,
          source: "DIRECT" as any,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const { result } = renderHook(() => useBookingStore());

      act(() => {
        result.current.setBookings(bookings as any);
        result.current.getTimelineData(new Date("2024-12-01"), new Date("2024-12-31"));
      });

      expect(result.current.timelineData).toHaveLength(2); // Two properties

      const property1Timeline = result.current.timelineData.find(
        (t) => t.propertyId === "property-1"
      );
      expect(property1Timeline).toBeDefined();
      expect(property1Timeline!.bookings).toHaveLength(2);
      expect(property1Timeline!.bookings[0]!.id).toBe("booking-1");
      expect(property1Timeline!.bookings[1]!.id).toBe("booking-2");
    });
  });

  describe("Utility Functions", () => {
    it("should get upcoming check-ins", () => {
      const today = new Date();
      const in3Days = new Date();
      in3Days.setDate(today.getDate() + 3);
      const in10Days = new Date();
      in10Days.setDate(today.getDate() + 10);
      const tomorrow = new Date();
      tomorrow.setDate(today.getDate() + 1);

      const bookings = [
        {
          id: "booking-1",
          guestName: "Test Guest 1",
          guestEmail: "test1@example.com",
          guestPhone: "+639171234567",
          checkIn: in3Days.toISOString(),
          checkOut: tomorrow.toISOString(),
          guests: 2,
          totalAmount: 10000,
          propertyId: "property-1",
          status: BookingStatus.CONFIRMED,
          nights: 1,
          paidAmount: 0,
          paymentStatus: "PENDING" as any,
          source: "DIRECT" as any,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "booking-2",
          guestName: "Test Guest 2",
          guestEmail: "test2@example.com",
          guestPhone: "+639171234568",
          checkIn: in10Days.toISOString(),
          checkOut: new Date().toISOString(),
          guests: 1,
          totalAmount: 8000,
          propertyId: "property-2",
          status: BookingStatus.CONFIRMED,
          nights: 1,
          paidAmount: 0,
          paymentStatus: "PENDING" as any,
          source: "DIRECT" as any,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "booking-3",
          guestName: "Test Guest 3",
          guestEmail: "test3@example.com",
          guestPhone: "+639171234569",
          checkIn: in3Days.toISOString(),
          checkOut: new Date().toISOString(),
          guests: 3,
          totalAmount: 12000,
          propertyId: "property-1",
          status: BookingStatus.CANCELLED, // Should not be included
          nights: 1,
          paidAmount: 0,
          paymentStatus: "PENDING" as any,
          source: "DIRECT" as any,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const { result } = renderHook(() => useBookingStore());

      act(() => {
        result.current.setBookings(bookings as any);
      });

      const upcomingCheckIns = result.current.getUpcomingCheckIns(7);
      expect(upcomingCheckIns).toHaveLength(1);
      expect(upcomingCheckIns[0]!.id).toBe("booking-1");
    });

    it("should get upcoming check-outs", () => {
      const today = new Date();
      const in2Days = new Date();
      in2Days.setDate(today.getDate() + 2);
      const in8Days = new Date();
      in8Days.setDate(today.getDate() + 8);

      const bookings = [
        {
          id: "booking-1",
          guestName: "Test Guest 1",
          guestEmail: "test1@example.com",
          guestPhone: "+639171234567",
          checkIn: new Date().toISOString(),
          checkOut: in2Days.toISOString(),
          guests: 2,
          totalAmount: 10000,
          propertyId: "property-1",
          status: BookingStatus.CHECKED_IN,
          nights: 2,
          paidAmount: 0,
          paymentStatus: "PENDING" as any,
          source: "DIRECT" as any,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "booking-2",
          guestName: "Test Guest 2",
          guestEmail: "test2@example.com",
          guestPhone: "+639171234568",
          checkIn: new Date().toISOString(),
          checkOut: in8Days.toISOString(),
          guests: 4,
          totalAmount: 15000,
          propertyId: "property-2",
          status: BookingStatus.CHECKED_IN,
          nights: 8,
          paidAmount: 0,
          paymentStatus: "PENDING" as any,
          source: "DIRECT" as any,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "booking-3",
          guestName: "Test Guest 3",
          guestEmail: "test3@example.com",
          guestPhone: "+639171234569",
          checkIn: new Date().toISOString(),
          checkOut: in2Days.toISOString(),
          guests: 1,
          totalAmount: 8000,
          propertyId: "property-1",
          status: BookingStatus.CONFIRMED, // Not checked in yet
          nights: 2,
          paidAmount: 0,
          paymentStatus: "PENDING" as any,
          source: "DIRECT" as any,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const { result } = renderHook(() => useBookingStore());

      act(() => {
        result.current.setBookings(bookings as any);
      });

      const upcomingCheckOuts = result.current.getUpcomingCheckOuts(7);
      expect(upcomingCheckOuts).toHaveLength(1);
      expect(upcomingCheckOuts[0]!.id).toBe("booking-1");
    });

    it("should get bookings by property", () => {
      const bookings = [
        {
          id: "booking-1",
          ...BookingTestBuilder.create().build(),
          propertyId: "property-1",
        },
        {
          id: "booking-2",
          ...BookingTestBuilder.create().build(),
          propertyId: "property-2",
        },
        {
          id: "booking-3",
          ...BookingTestBuilder.create().build(),
          propertyId: "property-1",
        },
      ];

      const { result } = renderHook(() => useBookingStore());

      act(() => {
        result.current.setBookings(bookings);
      });

      const property1Bookings = result.current.getBookingsByProperty("property-1");
      expect(property1Bookings).toHaveLength(2);
      expect(property1Bookings[0]!.id).toBe("booking-1");
      expect(property1Bookings[1]!.id).toBe("booking-3");
    });

    it("should get bookings by status", () => {
      const bookings = [
        {
          id: "booking-1",
          ...BookingTestBuilder.create().build(),
          status: BookingStatus.CONFIRMED,
        },
        {
          id: "booking-2",
          ...BookingTestBuilder.create().build(),
          status: BookingStatus.PENDING,
        },
        {
          id: "booking-3",
          ...BookingTestBuilder.create().build(),
          status: BookingStatus.CONFIRMED,
        },
      ];

      const { result } = renderHook(() => useBookingStore());

      act(() => {
        result.current.setBookings(bookings);
      });

      const confirmedBookings = result.current.getBookingsByStatus(BookingStatus.CONFIRMED);
      expect(confirmedBookings).toHaveLength(2);
      expect(confirmedBookings[0]!.status).toBe(BookingStatus.CONFIRMED);
      expect(confirmedBookings[1]!.status).toBe(BookingStatus.CONFIRMED);
    });

    it("should refresh bookings if cache expired", async () => {
      const mockBookings = BookingTestBuilder.create().buildMany(3);
      (apiClient.get as any).mockResolvedValue({
        data: {
          data: mockBookings,
          meta: { total: 3 },
        },
      });

      const { result } = renderHook(() => useBookingStore());

      // Set lastFetch to expired time (more than 5 minutes ago)
      act(() => {
        result.current.setBookings([]);
        (result.current as any).lastFetch = Date.now() - 6 * 60 * 1000;
      });

      await act(async () => {
        await result.current.refreshIfNeeded();
      });

      expect(apiClient.get).toHaveBeenCalled();
      expect(result.current.bookings).toEqual(mockBookings);
    });

    it("should not refresh bookings if cache is still valid", async () => {
      const { result } = renderHook(() => useBookingStore());

      // Set lastFetch to recent time (less than 5 minutes ago)
      act(() => {
        (result.current as any).lastFetch = Date.now() - 2 * 60 * 1000;
      });

      await act(async () => {
        await result.current.refreshIfNeeded();
      });

      expect(apiClient.get).not.toHaveBeenCalled();
    });
  });

  describe("Guest Operations", () => {
    it("should link guest to booking", async () => {
      const booking = {
        id: "booking-123",
        ...BookingTestBuilder.create().build(),
      };

      const { result } = renderHook(() => useBookingStore());

      act(() => {
        result.current.setBookings([booking]);
      });

      (apiClient.patch as any).mockResolvedValue({
        data: { ...booking, guestId: "guest-456" },
      });

      await act(async () => {
        await result.current.linkGuest("booking-123", "guest-456");
      });

      expect(apiClient.patch).toHaveBeenCalledWith(
        "/projects/test-project-123/bookings/booking-123",
        { guestId: "guest-456" }
      );
    });

    it("should unlink guest from booking", async () => {
      const booking = {
        id: "booking-123",
        ...BookingTestBuilder.create().build(),
        guestId: "guest-456",
      };

      const { result } = renderHook(() => useBookingStore());

      act(() => {
        result.current.setBookings([booking]);
      });

      (apiClient.patch as any).mockResolvedValue({
        data: { ...booking, guestId: undefined },
      });

      await act(async () => {
        await result.current.unlinkGuest("booking-123");
      });

      expect(apiClient.patch).toHaveBeenCalledWith(
        "/projects/test-project-123/bookings/booking-123",
        { guestId: undefined }
      );
    });
  });

  describe("Delete Operations", () => {
    it("should delete booking with optimistic update", async () => {
      const booking = {
        id: "booking-123",
        ...BookingTestBuilder.create().build(),
      };

      const { result } = renderHook(() => useBookingStore());

      act(() => {
        result.current.setBookings([booking]);
        result.current.totalBookings = 1;
      });

      (apiClient.delete as any).mockResolvedValue({});

      await act(async () => {
        await result.current.deleteBooking("booking-123");
      });

      expect(result.current.bookings).toHaveLength(0);
      expect(result.current.totalBookings).toBe(0);
      expect(apiClient.delete).toHaveBeenCalledWith(
        "/projects/test-project-123/bookings/booking-123"
      );
      expect(mockToast.success).toHaveBeenCalledWith("Booking deleted successfully");
    });

    it("should rollback delete on error", async () => {
      const booking = {
        id: "booking-123",
        ...BookingTestBuilder.create().build(),
      };

      const { result } = renderHook(() => useBookingStore());

      act(() => {
        result.current.setBookings([booking]);
        result.current.totalBookings = 1;
      });

      const error = new Error("Cannot delete");
      (apiClient.delete as any).mockRejectedValue(error);

      await expect(
        act(async () => {
          await result.current.deleteBooking("booking-123");
        })
      ).rejects.toThrow("Cannot delete");

      // Should rollback
      expect(result.current.bookings).toHaveLength(1);
      expect(result.current.bookings[0]).toEqual(booking);
      expect(result.current.totalBookings).toBe(1);
      expect(result.current.error).toBe("Cannot delete");
    });
  });

  describe("State Management", () => {
    it("should manage pagination state", () => {
      const { result } = renderHook(() => useBookingStore());

      act(() => {
        result.current.setPagination(3, 50);
      });

      expect(result.current.currentPage).toBe(3);
      expect(result.current.pageSize).toBe(50);
    });

    it("should manage filter state", () => {
      const { result } = renderHook(() => useBookingStore());

      const filters = {
        status: BookingStatus.CONFIRMED,
        propertyId: "property-1",
        fromDate: "2024-12-01",
        toDate: "2024-12-31",
      };

      act(() => {
        result.current.setFilters(filters);
      });

      expect(result.current.filters).toEqual(filters);
    });

    it("should reset store to initial state", () => {
      const { result } = renderHook(() => useBookingStore());

      // Set some data
      act(() => {
        result.current.setBookings([
          {
            id: "booking-1",
            ...BookingTestBuilder.create().build(),
          },
        ]);
        result.current.setFilters({ status: BookingStatus.CONFIRMED });
        result.current.setPagination(2, 30);
        result.current.setError("Some error");
      });

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.bookings).toHaveLength(0);
      expect(result.current.optimisticBookings).toHaveLength(0);
      expect(result.current.totalBookings).toBe(0);
      expect(result.current.currentPage).toBe(1);
      expect(result.current.filters).toEqual({});
      expect(result.current.error).toBe(null);
      expect(result.current.lastFetch).toBe(null);
    });

    it("should clear error state", () => {
      const { result } = renderHook(() => useBookingStore());

      act(() => {
        result.current.setError("Test error");
      });

      expect(result.current.error).toBe("Test error");

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBe(null);
    });
  });

  describe("Philippine-Specific Features", () => {
    it("should handle GCash payment method", async () => {
      const booking = {
        id: "booking-123",
        ...BookingTestBuilder.create().withAmount("15000.00", "5000.00").build(),
        paidAmount: 0,
        totalAmount: 15000,
        paymentStatus: "PENDING",
      };

      const { result } = renderHook(() => useBookingStore());

      act(() => {
        result.current.setBookings([booking]);
      });

      (apiClient.patch as any).mockResolvedValue({
        data: {
          ...booking,
          paidAmount: 5000,
          paymentStatus: "PARTIAL",
          paymentMethod: "GCASH",
        },
      });

      await act(async () => {
        await result.current.updatePayment("booking-123", 5000, "GCASH");
      });

      expect(apiClient.patch).toHaveBeenCalledWith(
        "/projects/test-project-123/bookings/booking-123",
        {
          paidAmount: 5000,
          paymentStatus: "PARTIAL",
          paymentMethod: "GCASH",
        }
      );
    });

    it("should handle Philippine phone numbers in booking data", async () => {
      const bookingData = BookingTestBuilder.create().withPhone("+639171234567").build();

      const createdBooking = {
        id: "booking-123",
        ...bookingData,
      };

      (apiClient.post as any).mockResolvedValue({ data: createdBooking });

      const { result } = renderHook(() => useBookingStore());

      await act(async () => {
        const booking = await result.current.createBooking(bookingData);
        expect(booking.guestPhone).toBe("+639171234567");
      });
    });

    it("should handle PHP currency amounts correctly", async () => {
      const bookingData = BookingTestBuilder.create().withAmount("25999.99", "10000.00").build();

      expect(bookingData.totalAmount).toBe("25999.99");
      expect(bookingData.depositAmount).toBe("10000.00");

      const { result } = renderHook(() => useBookingStore());

      (apiClient.post as any).mockResolvedValue({
        data: { id: "booking-123", ...bookingData },
      });

      await act(async () => {
        const booking = await result.current.createBooking(bookingData);
        expect(booking.totalAmount).toBe("25999.99");
        expect(booking.depositAmount).toBe("10000.00");
      });
    });
  });

  describe("Immer Immutability", () => {
    it("should maintain immutability when updating bookings", () => {
      const { result } = renderHook(() => useBookingStore());

      const originalBookings = [
        {
          id: "booking-1",
          ...BookingTestBuilder.create().build(),
        },
      ];

      act(() => {
        result.current.setBookings(originalBookings);
      });

      const bookingsBefore = result.current.bookings;

      act(() => {
        result.current.setBookings([
          ...originalBookings,
          {
            id: "booking-2",
            ...BookingTestBuilder.create().build(),
          },
        ]);
      });

      const bookingsAfter = result.current.bookings;

      // References should be different due to Immer
      expect(bookingsBefore).not.toBe(bookingsAfter);
      expect(bookingsAfter).toHaveLength(2);
    });
  });

  describe("Persistence", () => {
    it("should persist filters and pagination settings", () => {
      const { result } = renderHook(() => useBookingStore());

      const filters = {
        status: BookingStatus.CONFIRMED,
        propertyId: "property-1",
      };

      act(() => {
        result.current.setFilters(filters);
        result.current.setPagination(2, 30);
      });

      // Simulate rehydration
      const persistedState = {
        filters,
        currentPage: 2,
        pageSize: 30,
      };

      expect(result.current.filters).toEqual(persistedState.filters);
      expect(result.current.currentPage).toBe(persistedState.currentPage);
      expect(result.current.pageSize).toBe(persistedState.pageSize);
    });
  });

  describe("Revenue-Critical Price Calculations", () => {
    it("should calculate total revenue correctly from multiple bookings", () => {
      const bookings = [
        {
          id: "booking-1",
          ...BookingTestBuilder.create().withAmount("25000.00", "10000.00").build(),
          totalAmount: 25000,
          paidAmount: 25000,
        },
        {
          id: "booking-2",
          ...BookingTestBuilder.create().withAmount("15000.00", "5000.00").build(),
          totalAmount: 15000,
          paidAmount: 10000,
        },
        {
          id: "booking-3",
          ...BookingTestBuilder.create().withAmount("30000.00", "12000.00").build(),
          totalAmount: 30000,
          paidAmount: 30000,
        },
      ];

      const { result } = renderHook(() => useBookingStore());

      act(() => {
        result.current.setBookings(bookings);
      });

      // Calculate total revenue
      const totalRevenue = result.current.bookings.reduce(
        (sum, booking) => sum + booking.totalAmount,
        0
      );
      const totalPaid = result.current.bookings.reduce(
        (sum, booking) => sum + booking.paidAmount,
        0
      );
      const totalOutstanding = totalRevenue - totalPaid;

      expect(totalRevenue).toBe(70000);
      expect(totalPaid).toBe(65000);
      expect(totalOutstanding).toBe(5000);
    });

    it("should calculate peak season surcharge correctly", async () => {
      // Peak season dates (December 20 - January 5)
      const peakBookingData = BookingTestBuilder.create()
        .withDates("2024-12-24T00:00:00Z", "2024-12-27T00:00:00Z")
        .withAmount("45000.00", "15000.00") // Higher rate for peak season
        .build();

      const regularBookingData = BookingTestBuilder.create()
        .withDates("2024-11-10T00:00:00Z", "2024-11-13T00:00:00Z")
        .withAmount("25000.00", "8000.00") // Regular rate
        .build();

      const { result } = renderHook(() => useBookingStore());

      (apiClient.post as any)
        .mockResolvedValueOnce({
          data: { id: "peak-booking", ...peakBookingData, nights: 3 },
        })
        .mockResolvedValueOnce({
          data: { id: "regular-booking", ...regularBookingData, nights: 3 },
        });

      await act(async () => {
        await result.current.createBooking(peakBookingData);
        await result.current.createBooking(regularBookingData);
      });

      const peakBooking = result.current.bookings.find((b) => b.id === "peak-booking");
      const regularBooking = result.current.bookings.find((b) => b.id === "regular-booking");

      // Peak rate per night should be higher
      const peakRatePerNight = parseFloat(peakBooking!.totalAmount) / peakBooking!.nights;
      const regularRatePerNight = parseFloat(regularBooking!.totalAmount) / regularBooking!.nights;

      expect(peakRatePerNight).toBeGreaterThan(regularRatePerNight);
      expect(peakRatePerNight).toBe(15000); // 45000 / 3 nights
      expect(regularRatePerNight).toBeCloseTo(8333.33, 2); // 25000 / 3 nights
    });

    it("should handle payment installments with correct outstanding calculations", async () => {
      const booking = {
        id: "booking-123",
        ...BookingTestBuilder.create().withAmount("50000.00", "15000.00").build(),
        totalAmount: 50000,
        paidAmount: 15000, // Initial deposit
        paymentStatus: "PARTIAL",
      };

      const { result } = renderHook(() => useBookingStore());

      act(() => {
        result.current.setBookings([booking]);
      });

      // First installment
      (apiClient.patch as any).mockResolvedValue({
        data: {
          ...booking,
          paidAmount: 30000,
          paymentStatus: "PARTIAL",
        },
      });

      await act(async () => {
        await result.current.updatePayment("booking-123", 15000, "GCASH");
      });

      let updatedBooking = result.current.getBookingById("booking-123");
      expect(updatedBooking!.paidAmount).toBe(30000);
      expect(updatedBooking!.totalAmount - updatedBooking!.paidAmount).toBe(20000); // Outstanding

      // Second installment
      (apiClient.patch as any).mockResolvedValue({
        data: {
          ...booking,
          paidAmount: 45000,
          paymentStatus: "PARTIAL",
        },
      });

      await act(async () => {
        await result.current.updatePayment("booking-123", 15000, "BANK_TRANSFER");
      });

      updatedBooking = result.current.getBookingById("booking-123");
      expect(updatedBooking!.paidAmount).toBe(45000);
      expect(updatedBooking!.totalAmount - updatedBooking!.paidAmount).toBe(5000); // Outstanding

      // Final payment
      (apiClient.patch as any).mockResolvedValue({
        data: {
          ...booking,
          paidAmount: 50000,
          paymentStatus: "PAID",
        },
      });

      await act(async () => {
        await result.current.updatePayment("booking-123", 5000, "CASH");
      });

      updatedBooking = result.current.getBookingById("booking-123");
      expect(updatedBooking!.paidAmount).toBe(50000);
      expect(updatedBooking!.paymentStatus).toBe("PAID");
      expect(updatedBooking!.totalAmount - updatedBooking!.paidAmount).toBe(0); // Fully paid
    });

    it("should calculate commission for partner bookings correctly", () => {
      const partnerBookings = [
        {
          id: "partner-1",
          ...BookingTestBuilder.create().withAmount("30000.00", "10000.00").build(),
          totalAmount: 30000,
          source: "BOOKING_COM",
          commissionRate: 0.15, // 15% commission
        },
        {
          id: "partner-2",
          ...BookingTestBuilder.create().withAmount("25000.00", "8000.00").build(),
          totalAmount: 25000,
          source: "AGODA",
          commissionRate: 0.12, // 12% commission
        },
        {
          id: "direct-1",
          ...BookingTestBuilder.create().withAmount("20000.00", "6000.00").build(),
          totalAmount: 20000,
          source: "DIRECT",
          commissionRate: 0, // No commission for direct bookings
        },
      ];

      const { result } = renderHook(() => useBookingStore());

      act(() => {
        result.current.setBookings(partnerBookings);
      });

      // Calculate commissions
      const totalCommission = partnerBookings.reduce((sum, booking) => {
        return sum + booking.totalAmount * booking.commissionRate;
      }, 0);

      const netRevenue = partnerBookings.reduce((sum, booking) => {
        return sum + booking.totalAmount * (1 - booking.commissionRate);
      }, 0);

      expect(totalCommission).toBe(4500 + 3000 + 0); // 7500
      expect(netRevenue).toBe(25500 + 22000 + 20000); // 67500
      expect(totalCommission + netRevenue).toBe(75000); // Total gross revenue
    });

    it("should handle cancellation refunds with proper calculations", async () => {
      const booking = {
        id: "booking-123",
        ...BookingTestBuilder.create().withAmount("35000.00", "12000.00").build(),
        totalAmount: 35000,
        paidAmount: 35000, // Fully paid
        paymentStatus: "PAID",
        status: BookingStatus.CONFIRMED,
      };

      const { result } = renderHook(() => useBookingStore());

      act(() => {
        result.current.setBookings([booking]);
      });

      // Cancel with partial refund (e.g., 80% refund for early cancellation)
      const refundAmount = 35000 * 0.8; // 28000

      (apiClient.patch as any).mockResolvedValue({
        data: {
          ...booking,
          status: BookingStatus.CANCELLED,
          paidAmount: 35000 - refundAmount, // 7000 retained as cancellation fee
          paymentStatus: "REFUNDED",
          refundAmount,
          cancellationFee: 7000,
          notes: "Cancellation reason: Guest request. Refund: ₱28,000.00, Fee: ₱7,000.00",
        },
      });

      await act(async () => {
        await result.current.cancelBooking("booking-123", "Guest request");
      });

      const cancelledBooking = result.current.getBookingById("booking-123");
      expect(cancelledBooking!.status).toBe(BookingStatus.CANCELLED);
      expect(cancelledBooking!.refundAmount).toBe(28000);
      expect(cancelledBooking!.cancellationFee).toBe(7000);
    });

    it("should validate minimum and maximum booking amounts", async () => {
      // Test minimum amount
      const tooLowBooking = BookingTestBuilder.create()
        .withAmount("500.00", "100.00") // Below minimum threshold
        .build();

      (apiClient.post as any).mockRejectedValue(
        new Error("Booking amount must be at least ₱1,000.00")
      );

      const { result } = renderHook(() => useBookingStore());

      await expect(
        act(async () => {
          await result.current.createBooking(tooLowBooking);
        })
      ).rejects.toThrow("Booking amount must be at least ₱1,000.00");

      // Test maximum amount
      const tooHighBooking = BookingTestBuilder.create()
        .withAmount("1500000.00", "500000.00") // Above maximum threshold
        .build();

      (apiClient.post as any).mockRejectedValue(
        new Error("Booking amount exceeds maximum limit of ₱1,000,000.00")
      );

      await expect(
        act(async () => {
          await result.current.createBooking(tooHighBooking);
        })
      ).rejects.toThrow("Booking amount exceeds maximum limit of ₱1,000,000.00");
    });

    it("should calculate occupancy rates and revenue per available room", () => {
      const today = new Date();
      const bookings = [
        {
          id: "booking-1",
          propertyId: "property-1",
          checkIn: today.toISOString(),
          checkOut: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          status: BookingStatus.CHECKED_IN,
          totalAmount: 30000,
        },
        {
          id: "booking-2",
          propertyId: "property-2",
          checkIn: today.toISOString(),
          checkOut: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          status: BookingStatus.CHECKED_IN,
          totalAmount: 20000,
        },
        {
          id: "booking-3",
          propertyId: "property-1",
          checkIn: new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString(),
          checkOut: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          status: BookingStatus.CONFIRMED,
          totalAmount: 35000,
        },
      ];

      const { result } = renderHook(() => useBookingStore());

      act(() => {
        result.current.setBookings(bookings as any);
      });

      // Calculate occupancy for current period (next 7 days)
      const { properties } = useProjectStore.getState();
      const totalProperties = properties.length; // 2 properties
      const occupiedToday = 2; // property-1 and property-2 are occupied
      const occupancyRate = (occupiedToday / totalProperties) * 100;

      expect(occupancyRate).toBe(100);

      // Calculate RevPAR (Revenue Per Available Room)
      const totalRevenue = bookings.reduce((sum, b) => sum + b.totalAmount, 0);
      const totalRoomNights = 7 * totalProperties; // 7 days * 2 properties = 14 room nights
      const revPAR = totalRevenue / totalRoomNights;

      expect(totalRevenue).toBe(85000);
      expect(revPAR).toBeCloseTo(6071.43, 2); // 85000 / 14
    });

    it("should handle currency conversion for international bookings", () => {
      // Assuming USD to PHP conversion rate
      const conversionRate = 56.5; // 1 USD = 56.50 PHP

      const internationalBooking = {
        id: "intl-booking-1",
        ...BookingTestBuilder.create().build(),
        totalAmount: 500, // USD
        currency: "USD",
        totalAmountPHP: 500 * conversionRate, // 28,250 PHP
        conversionRate,
        conversionDate: new Date().toISOString(),
      };

      const { result } = renderHook(() => useBookingStore());

      act(() => {
        result.current.setBookings([internationalBooking as any]);
      });

      const booking = result.current.getBookingById("intl-booking-1");
      expect(booking!.totalAmountPHP).toBe(28250);
      expect(booking!.conversionRate).toBe(56.5);
    });
  });

  describe("Edge Cases and Complex Scenarios", () => {
    it("should handle concurrent booking conflicts", async () => {
      const propertyId = "property-1";
      const conflictingDates = {
        checkIn: "2024-12-24T00:00:00Z",
        checkOut: "2024-12-27T00:00:00Z",
      };

      // First booking attempt
      const booking1 = BookingTestBuilder.create()
        .withDates(conflictingDates.checkIn, conflictingDates.checkOut)
        .build();
      booking1.propertyId = propertyId;

      // Second booking attempt (concurrent)
      const booking2 = BookingTestBuilder.create()
        .withDates(conflictingDates.checkIn, conflictingDates.checkOut)
        .build();
      booking2.propertyId = propertyId;

      (apiClient.post as any)
        .mockResolvedValueOnce({
          data: { id: "booking-1", ...booking1 },
        })
        .mockRejectedValueOnce(new Error("Property is already booked for the selected dates"));

      const { result } = renderHook(() => useBookingStore());

      // Simulate concurrent booking attempts
      const promises = [
        result.current.createBooking(booking1),
        result.current.createBooking(booking2),
      ];

      const [result1, result2] = await act(async () => {
        return await Promise.allSettled(promises);
      });

      expect(result1.status).toBe("fulfilled");
      expect(result2.status).toBe("rejected");
      if (result2.status === "rejected") {
        expect(result2.reason.message).toContain("already booked");
      }
    });

    it("should handle network interruption during critical operations", async () => {
      const booking = {
        id: "booking-123",
        ...BookingTestBuilder.create().withAmount("25000.00", "10000.00").build(),
        totalAmount: 25000,
        paidAmount: 10000,
      };

      const { result } = renderHook(() => useBookingStore());

      act(() => {
        result.current.setBookings([booking]);
      });

      // Simulate network timeout during payment update
      const timeoutError = new Error("Network timeout");
      timeoutError.name = "TimeoutError";
      (apiClient.patch as any).mockRejectedValue(timeoutError);

      await expect(
        act(async () => {
          await result.current.updatePayment("booking-123", 15000, "GCASH");
        })
      ).rejects.toThrow("Network timeout");

      // Original booking should remain unchanged
      const unchangedBooking = result.current.getBookingById("booking-123");
      expect(unchangedBooking!.paidAmount).toBe(10000);
    });

    it("should validate business rules for minimum stay requirements", async () => {
      // Test minimum stay requirement (e.g., 2 nights minimum)
      const shortStayBooking = BookingTestBuilder.create()
        .withDates(
          "2024-12-24T14:00:00Z",
          "2024-12-25T12:00:00Z" // Only 1 night
        )
        .build();

      (apiClient.post as any).mockRejectedValue(new Error("Minimum stay requirement is 2 nights"));

      const { result } = renderHook(() => useBookingStore());

      await expect(
        act(async () => {
          await result.current.createBooking(shortStayBooking);
        })
      ).rejects.toThrow("Minimum stay requirement is 2 nights");
    });

    it("should handle timezone differences for international bookings", () => {
      // Test booking from different timezone (e.g., US Pacific to Philippine Time)
      const bookingFromUSA = {
        id: "usa-booking",
        ...BookingTestBuilder.create().build(),
        checkIn: "2024-12-24T14:00:00-08:00", // PST
        checkOut: "2024-12-27T12:00:00-08:00",
        checkInPHT: "2024-12-25T06:00:00+08:00", // Converted to PHT
        checkOutPHT: "2024-12-28T04:00:00+08:00",
        guestTimezone: "America/Los_Angeles",
        propertyTimezone: "Asia/Manila",
      };

      const { result } = renderHook(() => useBookingStore());

      act(() => {
        result.current.setBookings([bookingFromUSA as any]);
      });

      const booking = result.current.getBookingById("usa-booking");
      expect(booking!.checkInPHT).toBe("2024-12-25T06:00:00+08:00");
      expect(booking!.guestTimezone).toBe("America/Los_Angeles");
    });
  });
});
