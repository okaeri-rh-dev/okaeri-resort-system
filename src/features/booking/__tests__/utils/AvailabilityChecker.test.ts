/**
 * AvailabilityChecker.test.ts - Comprehensive tests for availability checking algorithms
 *
 * Tests the core availability logic that determines if rooms are available
 * for specific date ranges. Critical business logic requiring thorough testing.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { AvailabilityChecker } from "@/features/booking/utils/AvailabilityChecker";
import type {
  Booking,
  Property,
  DateRange,
  BookingStatus,
  AvailabilityResult,
  DayAvailability,
  CalendarAvailability,
} from "@/types/common";
import { createBooking, resetBookingIdCounter } from "@/test/factories/booking.factory";

// Mock database interface for testing
interface MockDatabase {
  bookings: Booking[];
  properties: Property[];
}

// Test project ID for multi-tenant isolation
const TEST_PROJECT_ID = "test-project-001";
const OTHER_PROJECT_ID = "other-project-002";

// Test property IDs
const VILLA_1_ID = "villa-001";
const VILLA_2_ID = "villa-002";
const ROOM_101_ID = "room-101";

// Mock properties
const mockProperties: Property[] = [
  {
    id: VILLA_1_ID,
    projectId: TEST_PROJECT_ID,
    name: "Villa 1",
    type: "VILLA",
    status: "AVAILABLE",
    capacity: 4,
    bedrooms: 2,
    bathrooms: 2,
    amenities: ["wifi", "pool", "kitchen"],
    rates: { baseRate: 3000, minimumStay: 1 },
    images: [],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: VILLA_2_ID,
    projectId: TEST_PROJECT_ID,
    name: "Villa 2",
    type: "VILLA",
    status: "AVAILABLE",
    capacity: 6,
    bedrooms: 3,
    bathrooms: 2,
    amenities: ["wifi", "pool", "kitchen", "bbq"],
    rates: { baseRate: 4500, minimumStay: 2 },
    images: [],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: ROOM_101_ID,
    projectId: TEST_PROJECT_ID,
    name: "Room 101",
    type: "ROOM",
    status: "AVAILABLE",
    capacity: 2,
    bedrooms: 1,
    bathrooms: 1,
    amenities: ["wifi", "ac"],
    rates: { baseRate: 1500, minimumStay: 1 },
    images: [],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
];

// Mock booking repository interface
interface MockBookingRepository {
  findBookingsByDateRange(
    projectId: string,
    propertyId: string,
    checkIn: Date,
    checkOut: Date
  ): Promise<Booking[]>;

  findOverlappingBookings(
    projectId: string,
    propertyId: string,
    checkIn: Date,
    checkOut: Date,
    excludeBookingId?: string
  ): Promise<Booking[]>;
}

class MockAvailabilityChecker extends AvailabilityChecker {
  constructor(private mockDb: MockDatabase) {
    super();
  }

  protected async queryBookings(
    projectId: string,
    propertyId: string,
    checkIn: Date,
    checkOut: Date,
    excludeBookingId?: string
  ): Promise<Booking[]> {
    // Simulate application-level tenant isolation - CRITICAL for multi-tenant security
    const projectBookings = this.mockDb.bookings.filter((b) => b.projectId === projectId);

    return projectBookings.filter((booking) => {
      if (excludeBookingId && booking.id === excludeBookingId) {
        return false;
      }

      if (booking.propertyId !== propertyId) {
        return false;
      }

      // Ignore cancelled bookings for availability
      if (booking.status === "CANCELLED" || booking.status === "NO_SHOW") {
        return false;
      }

      const bookingCheckIn = new Date(booking.checkIn);
      const bookingCheckOut = new Date(booking.checkOut);

      // Check for any date overlap using standard interval overlap logic
      return bookingCheckIn < checkOut && bookingCheckOut > checkIn;
    });
  }
}

describe("AvailabilityChecker - Single Room Availability", () => {
  let mockDb: MockDatabase;
  let availabilityChecker: MockAvailabilityChecker;

  beforeEach(() => {
    resetBookingIdCounter();
    mockDb = {
      bookings: [],
      properties: mockProperties,
    };
    availabilityChecker = new MockAvailabilityChecker(mockDb);
  });

  describe("Basic availability checking", () => {
    it("should return true for available room with no existing bookings", async () => {
      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      const isAvailable = await availabilityChecker.checkRoomAvailability(
        TEST_PROJECT_ID,
        VILLA_1_ID,
        checkIn,
        checkOut
      );

      expect(isAvailable).toBe(true);
    });

    it("should return false when room has confirmed booking in date range", async () => {
      // Create existing booking that overlaps
      const existingBooking = createBooking({
        propertyId: VILLA_1_ID,
        checkInDate: "2024-06-01",
        checkOutDate: "2024-06-04",
        status: "CONFIRMED",
      });
      existingBooking.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(existingBooking);

      const checkIn = new Date("2024-06-02");
      const checkOut = new Date("2024-06-05");

      const isAvailable = await availabilityChecker.checkRoomAvailability(
        TEST_PROJECT_ID,
        VILLA_1_ID,
        checkIn,
        checkOut
      );

      expect(isAvailable).toBe(false);
    });

    it("should return true for same-day checkout and checkin (standard hotel logic)", async () => {
      // Existing booking checks out on June 3rd
      const existingBooking = createBooking({
        propertyId: VILLA_1_ID,
        checkInDate: "2024-06-01",
        checkOutDate: "2024-06-03",
        status: "CONFIRMED",
      });
      existingBooking.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(existingBooking);

      // New booking checks in on June 3rd (same day checkout)
      const checkIn = new Date("2024-06-03");
      const checkOut = new Date("2024-06-05");

      const isAvailable = await availabilityChecker.checkRoomAvailability(
        TEST_PROJECT_ID,
        VILLA_1_ID,
        checkIn,
        checkOut
      );

      expect(isAvailable).toBe(true);
    });

    it("should handle midnight transitions correctly (Asia/Manila timezone)", async () => {
      // Test booking spanning midnight in Philippine timezone
      const existingBooking = createBooking({
        propertyId: VILLA_1_ID,
        checkInDate: "2024-06-01",
        checkOutDate: "2024-06-02",
        status: "CONFIRMED",
      });
      existingBooking.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(existingBooking);

      // Check availability immediately after checkout
      const checkIn = new Date("2024-06-02T14:00:00+08:00"); // 2 PM Philippine time
      const checkOut = new Date("2024-06-03T11:00:00+08:00"); // 11 AM next day

      const isAvailable = await availabilityChecker.checkRoomAvailability(
        TEST_PROJECT_ID,
        VILLA_1_ID,
        checkIn,
        checkOut
      );

      expect(isAvailable).toBe(true);
    });

    it("should ignore cancelled bookings when checking availability", async () => {
      const cancelledBooking = createBooking({
        propertyId: VILLA_1_ID,
        checkInDate: "2024-06-01",
        checkOutDate: "2024-06-04",
        status: "CANCELLED",
      });
      cancelledBooking.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(cancelledBooking);

      const checkIn = new Date("2024-06-02");
      const checkOut = new Date("2024-06-05");

      const isAvailable = await availabilityChecker.checkRoomAvailability(
        TEST_PROJECT_ID,
        VILLA_1_ID,
        checkIn,
        checkOut
      );

      expect(isAvailable).toBe(true);
    });

    it("should ignore no-show bookings when checking availability", async () => {
      const noShowBooking = createBooking({
        propertyId: VILLA_1_ID,
        checkInDate: "2024-06-01",
        checkOutDate: "2024-06-04",
        status: "NO_SHOW",
      });
      noShowBooking.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(noShowBooking);

      const checkIn = new Date("2024-06-02");
      const checkOut = new Date("2024-06-05");

      const isAvailable = await availabilityChecker.checkRoomAvailability(
        TEST_PROJECT_ID,
        VILLA_1_ID,
        checkIn,
        checkOut
      );

      expect(isAvailable).toBe(true);
    });
  });

  describe("Multi-tenant isolation (CRITICAL)", () => {
    it("should only consider bookings from same project", async () => {
      // Booking from different project should be ignored
      const otherProjectBooking = createBooking({
        propertyId: VILLA_1_ID,
        checkInDate: "2024-06-01",
        checkOutDate: "2024-06-04",
        status: "CONFIRMED",
      });
      otherProjectBooking.projectId = OTHER_PROJECT_ID; // Different project
      mockDb.bookings.push(otherProjectBooking);

      const checkIn = new Date("2024-06-02");
      const checkOut = new Date("2024-06-05");

      // Should be available despite booking from other project
      const isAvailable = await availabilityChecker.checkRoomAvailability(
        TEST_PROJECT_ID,
        VILLA_1_ID,
        checkIn,
        checkOut
      );

      expect(isAvailable).toBe(true);
    });

    it("should fail when no project ID provided (security measure)", async () => {
      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      await expect(
        availabilityChecker.checkRoomAvailability(
          "", // Empty project ID should fail
          VILLA_1_ID,
          checkIn,
          checkOut
        )
      ).rejects.toThrow("Project ID is required");
    });

    it("should handle invalid project ID gracefully", async () => {
      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      const isAvailable = await availabilityChecker.checkRoomAvailability(
        "invalid-project-id",
        VILLA_1_ID,
        checkIn,
        checkOut
      );

      // Should return true (no bookings found for invalid project)
      expect(isAvailable).toBe(true);
    });
  });

  describe("Edge cases and error conditions", () => {
    it("should handle invalid date range (checkout before checkin)", async () => {
      const checkIn = new Date("2024-06-05");
      const checkOut = new Date("2024-06-03"); // Before check-in

      await expect(
        availabilityChecker.checkRoomAvailability(TEST_PROJECT_ID, VILLA_1_ID, checkIn, checkOut)
      ).rejects.toThrow("Check-out must be after check-in");
    });

    it("should handle same-day checkin and checkout", async () => {
      const checkIn = new Date("2024-06-01T14:00:00");
      const checkOut = new Date("2024-06-01T18:00:00"); // Same day

      const isAvailable = await availabilityChecker.checkRoomAvailability(
        TEST_PROJECT_ID,
        VILLA_1_ID,
        checkIn,
        checkOut
      );

      expect(isAvailable).toBe(true);
    });

    it("should handle leap year dates correctly", async () => {
      const checkIn = new Date("2024-02-28");
      const checkOut = new Date("2024-03-01"); // Spans leap day

      const isAvailable = await availabilityChecker.checkRoomAvailability(
        TEST_PROJECT_ID,
        VILLA_1_ID,
        checkIn,
        checkOut
      );

      expect(isAvailable).toBe(true);
    });

    it("should handle month boundaries correctly", async () => {
      // Booking that spans multiple months
      const existingBooking = createBooking({
        propertyId: VILLA_1_ID,
        checkInDate: "2024-05-30",
        checkOutDate: "2024-06-02",
        status: "CONFIRMED",
      });
      existingBooking.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(existingBooking);

      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      const isAvailable = await availabilityChecker.checkRoomAvailability(
        TEST_PROJECT_ID,
        VILLA_1_ID,
        checkIn,
        checkOut
      );

      expect(isAvailable).toBe(false);
    });

    it("should handle very long date ranges (annual bookings)", async () => {
      const checkIn = new Date("2024-01-01");
      const checkOut = new Date("2024-12-31"); // Full year

      const isAvailable = await availabilityChecker.checkRoomAvailability(
        TEST_PROJECT_ID,
        VILLA_1_ID,
        checkIn,
        checkOut
      );

      expect(isAvailable).toBe(true);
    });

    it("should handle invalid property ID", async () => {
      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      const isAvailable = await availabilityChecker.checkRoomAvailability(
        TEST_PROJECT_ID,
        "invalid-property-id",
        checkIn,
        checkOut
      );

      // Should return true (no bookings found for invalid property)
      expect(isAvailable).toBe(true);
    });
  });

  describe("Complex overlap scenarios", () => {
    it("should detect exact date overlap", async () => {
      const existingBooking = createBooking({
        propertyId: VILLA_1_ID,
        checkInDate: "2024-06-01",
        checkOutDate: "2024-06-04",
        status: "CONFIRMED",
      });
      existingBooking.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(existingBooking);

      // Exact same dates
      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-04");

      const isAvailable = await availabilityChecker.checkRoomAvailability(
        TEST_PROJECT_ID,
        VILLA_1_ID,
        checkIn,
        checkOut
      );

      expect(isAvailable).toBe(false);
    });

    it("should detect partial overlap at start", async () => {
      const existingBooking = createBooking({
        propertyId: VILLA_1_ID,
        checkInDate: "2024-06-01",
        checkOutDate: "2024-06-04",
        status: "CONFIRMED",
      });
      existingBooking.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(existingBooking);

      // Overlaps with end of existing booking
      const checkIn = new Date("2024-06-03");
      const checkOut = new Date("2024-06-06");

      const isAvailable = await availabilityChecker.checkRoomAvailability(
        TEST_PROJECT_ID,
        VILLA_1_ID,
        checkIn,
        checkOut
      );

      expect(isAvailable).toBe(false);
    });

    it("should detect partial overlap at end", async () => {
      const existingBooking = createBooking({
        propertyId: VILLA_1_ID,
        checkInDate: "2024-06-04",
        checkOutDate: "2024-06-07",
        status: "CONFIRMED",
      });
      existingBooking.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(existingBooking);

      // Overlaps with start of existing booking
      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-05");

      const isAvailable = await availabilityChecker.checkRoomAvailability(
        TEST_PROJECT_ID,
        VILLA_1_ID,
        checkIn,
        checkOut
      );

      expect(isAvailable).toBe(false);
    });

    it("should detect contained booking (new booking inside existing)", async () => {
      const existingBooking = createBooking({
        propertyId: VILLA_1_ID,
        checkInDate: "2024-06-01",
        checkOutDate: "2024-06-10",
        status: "CONFIRMED",
      });
      existingBooking.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(existingBooking);

      // Completely contained within existing booking
      const checkIn = new Date("2024-06-03");
      const checkOut = new Date("2024-06-06");

      const isAvailable = await availabilityChecker.checkRoomAvailability(
        TEST_PROJECT_ID,
        VILLA_1_ID,
        checkIn,
        checkOut
      );

      expect(isAvailable).toBe(false);
    });

    it("should detect surrounding booking (new booking surrounds existing)", async () => {
      const existingBooking = createBooking({
        propertyId: VILLA_1_ID,
        checkInDate: "2024-06-03",
        checkOutDate: "2024-06-06",
        status: "CONFIRMED",
      });
      existingBooking.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(existingBooking);

      // Completely surrounds existing booking
      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-10");

      const isAvailable = await availabilityChecker.checkRoomAvailability(
        TEST_PROJECT_ID,
        VILLA_1_ID,
        checkIn,
        checkOut
      );

      expect(isAvailable).toBe(false);
    });

    it("should handle multiple overlapping bookings", async () => {
      // Create multiple overlapping bookings
      const booking1 = createBooking({
        propertyId: VILLA_1_ID,
        checkInDate: "2024-06-01",
        checkOutDate: "2024-06-04",
        status: "CONFIRMED",
      });
      const booking2 = createBooking({
        propertyId: VILLA_1_ID,
        checkInDate: "2024-06-03",
        checkOutDate: "2024-06-06",
        status: "CONFIRMED",
      });

      booking1.projectId = TEST_PROJECT_ID;
      booking2.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(booking1, booking2);

      const checkIn = new Date("2024-06-02");
      const checkOut = new Date("2024-06-05");

      const isAvailable = await availabilityChecker.checkRoomAvailability(
        TEST_PROJECT_ID,
        VILLA_1_ID,
        checkIn,
        checkOut
      );

      expect(isAvailable).toBe(false);
    });
  });
});

describe("AvailabilityChecker - Bulk Availability", () => {
  let mockDb: MockDatabase;
  let availabilityChecker: MockAvailabilityChecker;

  beforeEach(() => {
    resetBookingIdCounter();
    mockDb = {
      bookings: [],
      properties: mockProperties,
    };
    availabilityChecker = new MockAvailabilityChecker(mockDb);
  });

  it("should check availability for multiple rooms efficiently", async () => {
    const propertyIds = [VILLA_1_ID, VILLA_2_ID, ROOM_101_ID];
    const dateRange: DateRange = {
      from: "2024-06-01",
      to: "2024-06-07",
    };

    const availability = await availabilityChecker.getBulkAvailability(
      TEST_PROJECT_ID,
      propertyIds,
      dateRange
    );

    expect(availability).toBeInstanceOf(Map);
    expect(availability.size).toBe(3);
    expect(availability.has(VILLA_1_ID)).toBe(true);
    expect(availability.has(VILLA_2_ID)).toBe(true);
    expect(availability.has(ROOM_101_ID)).toBe(true);
  });

  it("should return correct availability status for each property", async () => {
    // Book villa 1 for part of the period
    const booking = createBooking({
      propertyId: VILLA_1_ID,
      checkInDate: "2024-06-03",
      checkOutDate: "2024-06-05",
      status: "CONFIRMED",
    });
    booking.projectId = TEST_PROJECT_ID;
    mockDb.bookings.push(booking);

    const propertyIds = [VILLA_1_ID, VILLA_2_ID];
    const dateRange: DateRange = {
      from: "2024-06-01",
      to: "2024-06-07",
    };

    const availability = await availabilityChecker.getBulkAvailability(
      TEST_PROJECT_ID,
      propertyIds,
      dateRange
    );

    const villa1Availability = availability.get(VILLA_1_ID);
    const villa2Availability = availability.get(VILLA_2_ID);

    // Villa 1 should show unavailable dates
    expect(villa1Availability?.some((day) => !day.available)).toBe(true);

    // Villa 2 should be fully available
    expect(villa2Availability?.every((day) => day.available)).toBe(true);
  });

  it("should handle empty property list", async () => {
    const dateRange: DateRange = {
      from: "2024-06-01",
      to: "2024-06-07",
    };

    const availability = await availabilityChecker.getBulkAvailability(
      TEST_PROJECT_ID,
      [],
      dateRange
    );

    expect(availability.size).toBe(0);
  });

  it("should respect project isolation in bulk queries", async () => {
    // Create booking in different project
    const otherProjectBooking = createBooking({
      propertyId: VILLA_1_ID,
      checkInDate: "2024-06-03",
      checkOutDate: "2024-06-05",
      status: "CONFIRMED",
    });
    otherProjectBooking.projectId = OTHER_PROJECT_ID;
    mockDb.bookings.push(otherProjectBooking);

    const propertyIds = [VILLA_1_ID];
    const dateRange: DateRange = {
      from: "2024-06-01",
      to: "2024-06-07",
    };

    const availability = await availabilityChecker.getBulkAvailability(
      TEST_PROJECT_ID,
      propertyIds,
      dateRange
    );

    const villa1Availability = availability.get(VILLA_1_ID);
    // Should be fully available as other project booking is ignored
    expect(villa1Availability?.every((day) => day.available)).toBe(true);
  });
});
