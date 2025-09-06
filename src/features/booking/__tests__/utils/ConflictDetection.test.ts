/**
 * ConflictDetection.test.ts - Comprehensive tests for booking conflict detection
 *
 * Tests the conflict detection algorithms that prevent double bookings and
 * validate booking modifications. Critical for data integrity.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ConflictDetector } from "@/features/booking/utils/ConflictDetector";
import type {
  Booking,
  BookingStatus,
  BookingConflict,
  ValidationResult,
  CreateBookingData,
  UpdateBookingData,
} from "@/types/common";
import { createBooking, resetBookingIdCounter } from "@/test/factories/booking.factory";

// Mock database for conflict detection testing
interface MockDatabase {
  bookings: Booking[];
}

// Test constants
const TEST_PROJECT_ID = "test-project-001";
const OTHER_PROJECT_ID = "other-project-002";
const VILLA_1_ID = "villa-001";
const VILLA_2_ID = "villa-002";
const ROOM_101_ID = "room-101";

// Mock conflict detector with database simulation
class MockConflictDetector extends ConflictDetector {
  constructor(private mockDb: MockDatabase) {
    super();
  }

  protected async queryOverlappingBookings(
    projectId: string,
    propertyId: string,
    checkIn: Date,
    checkOut: Date,
    excludeBookingId?: string
  ): Promise<Booking[]> {
    // Ensure project isolation - CRITICAL for multi-tenant security
    const projectBookings = this.mockDb.bookings.filter((b) => b.projectId === projectId);

    return projectBookings.filter((booking) => {
      // Exclude specific booking (useful for modification checks)
      if (excludeBookingId && booking.id === excludeBookingId) {
        return false;
      }

      // Only check bookings for the same property
      if (booking.propertyId !== propertyId) {
        return false;
      }

      // Ignore cancelled and no-show bookings
      if (booking.status === "CANCELLED" || booking.status === "NO_SHOW") {
        return false;
      }

      const bookingCheckIn = new Date(booking.checkIn);
      const bookingCheckOut = new Date(booking.checkOut);

      // Standard interval overlap detection
      return bookingCheckIn < checkOut && bookingCheckOut > checkIn;
    });
  }

  protected async queryBookingById(projectId: string, bookingId: string): Promise<Booking | null> {
    const booking = this.mockDb.bookings.find(
      (b) => b.id === bookingId && b.projectId === projectId
    );
    return booking || null;
  }
}

// Helper to create booking data for testing
function createBookingData(overrides: Partial<CreateBookingData> = {}): CreateBookingData {
  return {
    propertyId: VILLA_1_ID,
    guestName: "John Doe",
    guestEmail: "john@example.com",
    guestPhone: "+639123456789",
    checkIn: "2024-06-01",
    checkOut: "2024-06-03",
    guests: 2,
    source: "DIRECT",
    totalAmount: 6000,
    ...overrides,
  };
}

describe("ConflictDetector - Basic Conflict Detection", () => {
  let mockDb: MockDatabase;
  let conflictDetector: MockConflictDetector;

  beforeEach(() => {
    resetBookingIdCounter();
    mockDb = { bookings: [] };
    conflictDetector = new MockConflictDetector(mockDb);
  });

  describe("New booking conflict detection", () => {
    it("should detect no conflicts for available property", async () => {
      const bookingData = createBookingData();

      const conflicts = await conflictDetector.findBookingConflicts(TEST_PROJECT_ID, bookingData);

      expect(conflicts).toHaveLength(0);
    });

    it("should detect exact date overlap conflict", async () => {
      // Create existing booking
      const existingBooking = createBooking({
        propertyId: VILLA_1_ID,
        checkInDate: "2024-06-01",
        checkOutDate: "2024-06-03",
        status: "CONFIRMED",
      });
      existingBooking.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(existingBooking);

      // Try to create booking with exact same dates
      const bookingData = createBookingData({
        checkIn: "2024-06-01",
        checkOut: "2024-06-03",
      });

      const conflicts = await conflictDetector.findBookingConflicts(TEST_PROJECT_ID, bookingData);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]?.type).toBe("EXACT_OVERLAP");
      expect(conflicts[0]?.conflictingBooking.id).toBe(existingBooking.id);
      expect(conflicts[0]?.severity).toBe("HIGH");
    });

    it("should detect partial start overlap", async () => {
      const existingBooking = createBooking({
        propertyId: VILLA_1_ID,
        checkInDate: "2024-06-01",
        checkOutDate: "2024-06-04",
        status: "CONFIRMED",
      });
      existingBooking.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(existingBooking);

      // New booking starts before existing ends
      const bookingData = createBookingData({
        checkIn: "2024-06-03",
        checkOut: "2024-06-06",
      });

      const conflicts = await conflictDetector.findBookingConflicts(TEST_PROJECT_ID, bookingData);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]?.type).toBe("PARTIAL_OVERLAP");
      expect(conflicts[0]?.details.overlapDays).toBe(1); // June 3rd overlaps
      expect(conflicts[0]?.severity).toBe("HIGH");
    });

    it("should detect partial end overlap", async () => {
      const existingBooking = createBooking({
        propertyId: VILLA_1_ID,
        checkInDate: "2024-06-04",
        checkOutDate: "2024-06-07",
        status: "CONFIRMED",
      });
      existingBooking.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(existingBooking);

      // New booking ends after existing starts
      const bookingData = createBookingData({
        checkIn: "2024-06-01",
        checkOut: "2024-06-05",
      });

      const conflicts = await conflictDetector.findBookingConflicts(TEST_PROJECT_ID, bookingData);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]?.type).toBe("PARTIAL_OVERLAP");
      expect(conflicts[0]?.details.overlapDays).toBe(1); // June 4th overlaps
      expect(conflicts[0]?.severity).toBe("HIGH");
    });

    it("should detect containment conflicts (new booking inside existing)", async () => {
      const existingBooking = createBooking({
        propertyId: VILLA_1_ID,
        checkInDate: "2024-06-01",
        checkOutDate: "2024-06-10",
        status: "CONFIRMED",
      });
      existingBooking.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(existingBooking);

      // New booking completely contained within existing
      const bookingData = createBookingData({
        checkIn: "2024-06-03",
        checkOut: "2024-06-06",
      });

      const conflicts = await conflictDetector.findBookingConflicts(TEST_PROJECT_ID, bookingData);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]?.type).toBe("CONTAINED");
      expect(conflicts[0]?.severity).toBe("HIGH");
    });

    it("should detect surrounding conflicts (new booking surrounds existing)", async () => {
      const existingBooking = createBooking({
        propertyId: VILLA_1_ID,
        checkInDate: "2024-06-03",
        checkOutDate: "2024-06-06",
        status: "CONFIRMED",
      });
      existingBooking.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(existingBooking);

      // New booking completely surrounds existing
      const bookingData = createBookingData({
        checkIn: "2024-06-01",
        checkOut: "2024-06-10",
      });

      const conflicts = await conflictDetector.findBookingConflicts(TEST_PROJECT_ID, bookingData);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]?.type).toBe("SURROUNDING");
      expect(conflicts[0]?.severity).toBe("HIGH");
    });

    it("should allow same-day checkout and checkin", async () => {
      const existingBooking = createBooking({
        propertyId: VILLA_1_ID,
        checkInDate: "2024-06-01",
        checkOutDate: "2024-06-03",
        status: "CONFIRMED",
      });
      existingBooking.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(existingBooking);

      // New booking starts on same day as existing checkout
      const bookingData = createBookingData({
        checkIn: "2024-06-03",
        checkOut: "2024-06-05",
      });

      const conflicts = await conflictDetector.findBookingConflicts(TEST_PROJECT_ID, bookingData);

      expect(conflicts).toHaveLength(0);
    });

    it("should handle multiple conflicts correctly", async () => {
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

      // New booking overlaps with both
      const bookingData = createBookingData({
        checkIn: "2024-06-02",
        checkOut: "2024-06-05",
      });

      const conflicts = await conflictDetector.findBookingConflicts(TEST_PROJECT_ID, bookingData);

      expect(conflicts).toHaveLength(2);
    });
  });

  describe("Booking status filtering", () => {
    it("should ignore cancelled bookings", async () => {
      const cancelledBooking = createBooking({
        propertyId: VILLA_1_ID,
        checkInDate: "2024-06-01",
        checkOutDate: "2024-06-04",
        status: "CANCELLED",
      });
      cancelledBooking.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(cancelledBooking);

      const bookingData = createBookingData({
        checkIn: "2024-06-02",
        checkOut: "2024-06-05",
      });

      const conflicts = await conflictDetector.findBookingConflicts(TEST_PROJECT_ID, bookingData);

      expect(conflicts).toHaveLength(0);
    });

    it("should ignore no-show bookings", async () => {
      const noShowBooking = createBooking({
        propertyId: VILLA_1_ID,
        checkInDate: "2024-06-01",
        checkOutDate: "2024-06-04",
        status: "NO_SHOW",
      });
      noShowBooking.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(noShowBooking);

      const bookingData = createBookingData({
        checkIn: "2024-06-02",
        checkOut: "2024-06-05",
      });

      const conflicts = await conflictDetector.findBookingConflicts(TEST_PROJECT_ID, bookingData);

      expect(conflicts).toHaveLength(0);
    });

    it("should consider pending bookings as conflicts", async () => {
      const pendingBooking = createBooking({
        propertyId: VILLA_1_ID,
        checkInDate: "2024-06-01",
        checkOutDate: "2024-06-04",
        status: "PENDING",
      });
      pendingBooking.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(pendingBooking);

      const bookingData = createBookingData({
        checkIn: "2024-06-02",
        checkOut: "2024-06-05",
      });

      const conflicts = await conflictDetector.findBookingConflicts(TEST_PROJECT_ID, bookingData);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]?.conflictingBooking.status).toBe("PENDING");
    });

    it("should consider confirmed bookings as conflicts", async () => {
      const confirmedBooking = createBooking({
        propertyId: VILLA_1_ID,
        checkInDate: "2024-06-01",
        checkOutDate: "2024-06-04",
        status: "CONFIRMED",
      });
      confirmedBooking.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(confirmedBooking);

      const bookingData = createBookingData({
        checkIn: "2024-06-02",
        checkOut: "2024-06-05",
      });

      const conflicts = await conflictDetector.findBookingConflicts(TEST_PROJECT_ID, bookingData);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]?.conflictingBooking.status).toBe("CONFIRMED");
    });

    it("should consider checked-in bookings as conflicts", async () => {
      const checkedInBooking = createBooking({
        propertyId: VILLA_1_ID,
        checkInDate: "2024-06-01",
        checkOutDate: "2024-06-04",
        status: "CHECKED_IN",
      });
      checkedInBooking.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(checkedInBooking);

      const bookingData = createBookingData({
        checkIn: "2024-06-02",
        checkOut: "2024-06-05",
      });

      const conflicts = await conflictDetector.findBookingConflicts(TEST_PROJECT_ID, bookingData);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]?.conflictingBooking.status).toBe("CHECKED_IN");
    });
  });

  describe("Multi-tenant isolation (CRITICAL)", () => {
    it("should only consider bookings from same project", async () => {
      // Booking from different project
      const otherProjectBooking = createBooking({
        propertyId: VILLA_1_ID,
        checkInDate: "2024-06-01",
        checkOutDate: "2024-06-04",
        status: "CONFIRMED",
      });
      otherProjectBooking.projectId = OTHER_PROJECT_ID;
      mockDb.bookings.push(otherProjectBooking);

      const bookingData = createBookingData({
        checkIn: "2024-06-02",
        checkOut: "2024-06-05",
      });

      // Should not detect conflict from other project
      const conflicts = await conflictDetector.findBookingConflicts(TEST_PROJECT_ID, bookingData);

      expect(conflicts).toHaveLength(0);
    });

    it("should fail when project ID is empty", async () => {
      const bookingData = createBookingData();

      await expect(conflictDetector.findBookingConflicts("", bookingData)).rejects.toThrow(
        "Project ID is required"
      );
    });

    it("should handle invalid project ID gracefully", async () => {
      const bookingData = createBookingData();

      const conflicts = await conflictDetector.findBookingConflicts(
        "invalid-project-id",
        bookingData
      );

      expect(conflicts).toHaveLength(0);
    });
  });

  describe("Property isolation", () => {
    it("should only check conflicts within same property", async () => {
      // Booking for different property
      const otherPropertyBooking = createBooking({
        propertyId: VILLA_2_ID,
        checkInDate: "2024-06-01",
        checkOutDate: "2024-06-04",
        status: "CONFIRMED",
      });
      otherPropertyBooking.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(otherPropertyBooking);

      // New booking for Villa 1 (different property)
      const bookingData = createBookingData({
        propertyId: VILLA_1_ID,
        checkIn: "2024-06-02",
        checkOut: "2024-06-05",
      });

      const conflicts = await conflictDetector.findBookingConflicts(TEST_PROJECT_ID, bookingData);

      expect(conflicts).toHaveLength(0);
    });

    it("should handle invalid property ID", async () => {
      const bookingData = createBookingData({
        propertyId: "invalid-property-id",
      });

      const conflicts = await conflictDetector.findBookingConflicts(TEST_PROJECT_ID, bookingData);

      expect(conflicts).toHaveLength(0);
    });
  });
});

describe("ConflictDetector - Booking Modification Validation", () => {
  let mockDb: MockDatabase;
  let conflictDetector: MockConflictDetector;

  beforeEach(() => {
    resetBookingIdCounter();
    mockDb = { bookings: [] };
    conflictDetector = new MockConflictDetector(mockDb);
  });

  describe("Date modification conflicts", () => {
    it("should allow non-conflicting date changes", async () => {
      const existingBooking = createBooking({
        id: "booking-001",
        propertyId: VILLA_1_ID,
        checkInDate: "2024-06-01",
        checkOutDate: "2024-06-03",
        status: "CONFIRMED",
      });
      existingBooking.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(existingBooking);

      // Change dates to non-conflicting period
      const updateData: UpdateBookingData = {
        checkIn: "2024-06-10",
        checkOut: "2024-06-12",
      };

      const result = await conflictDetector.validateBookingModification(
        TEST_PROJECT_ID,
        "booking-001",
        updateData
      );

      expect(result.isValid).toBe(true);
      expect(result.conflicts).toHaveLength(0);
    });

    it("should detect conflicts when extending dates", async () => {
      // Create two bookings with a gap between them
      const booking1 = createBooking({
        id: "booking-001",
        propertyId: VILLA_1_ID,
        checkInDate: "2024-06-01",
        checkOutDate: "2024-06-03",
        status: "CONFIRMED",
      });
      const booking2 = createBooking({
        id: "booking-002",
        propertyId: VILLA_1_ID,
        checkInDate: "2024-06-05",
        checkOutDate: "2024-06-07",
        status: "CONFIRMED",
      });

      booking1.projectId = TEST_PROJECT_ID;
      booking2.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(booking1, booking2);

      // Try to extend booking 1 to overlap with booking 2
      const updateData: UpdateBookingData = {
        checkOut: "2024-06-06", // Extends into booking 2
      };

      const result = await conflictDetector.validateBookingModification(
        TEST_PROJECT_ID,
        "booking-001",
        updateData
      );

      expect(result.isValid).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]?.conflictingBooking.id).toBe("booking-002");
    });

    it("should exclude self when checking modification conflicts", async () => {
      const existingBooking = createBooking({
        id: "booking-001",
        propertyId: VILLA_1_ID,
        checkInDate: "2024-06-01",
        checkOutDate: "2024-06-03",
        status: "CONFIRMED",
      });
      existingBooking.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(existingBooking);

      // Modify dates but keep within original range (should be valid)
      const updateData: UpdateBookingData = {
        checkIn: "2024-06-01",
        checkOut: "2024-06-02", // Shortening stay
      };

      const result = await conflictDetector.validateBookingModification(
        TEST_PROJECT_ID,
        "booking-001",
        updateData
      );

      expect(result.isValid).toBe(true);
      expect(result.conflicts).toHaveLength(0);
    });

    it("should handle property changes with conflict checking", async () => {
      // Create booking in Villa 1
      const existingBooking = createBooking({
        id: "booking-001",
        propertyId: VILLA_1_ID,
        checkInDate: "2024-06-01",
        checkOutDate: "2024-06-03",
        status: "CONFIRMED",
      });

      // Create conflicting booking in Villa 2
      const villa2Booking = createBooking({
        id: "booking-002",
        propertyId: VILLA_2_ID,
        checkInDate: "2024-06-01",
        checkOutDate: "2024-06-03",
        status: "CONFIRMED",
      });

      existingBooking.projectId = TEST_PROJECT_ID;
      villa2Booking.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(existingBooking, villa2Booking);

      // Try to move booking from Villa 1 to Villa 2 (should conflict)
      const updateData: UpdateBookingData = {
        propertyId: VILLA_2_ID,
      };

      const result = await conflictDetector.validateBookingModification(
        TEST_PROJECT_ID,
        "booking-001",
        updateData
      );

      expect(result.isValid).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]?.conflictingBooking.id).toBe("booking-002");
    });

    it("should handle non-existent booking gracefully", async () => {
      const updateData: UpdateBookingData = {
        checkOut: "2024-06-05",
      };

      const result = await conflictDetector.validateBookingModification(
        TEST_PROJECT_ID,
        "non-existent-booking",
        updateData
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Booking not found");
    });
  });

  describe("Status change validation", () => {
    it("should allow valid status transitions", async () => {
      const existingBooking = createBooking({
        id: "booking-001",
        propertyId: VILLA_1_ID,
        status: "PENDING",
      });
      existingBooking.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(existingBooking);

      const updateData: UpdateBookingData = {
        status: "CONFIRMED",
      };

      const result = await conflictDetector.validateBookingModification(
        TEST_PROJECT_ID,
        "booking-001",
        updateData
      );

      expect(result.isValid).toBe(true);
    });

    it("should prevent invalid status transitions", async () => {
      const existingBooking = createBooking({
        id: "booking-001",
        propertyId: VILLA_1_ID,
        status: "CHECKED_OUT",
      });
      existingBooking.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(existingBooking);

      // Cannot go back from checked out to pending
      const updateData: UpdateBookingData = {
        status: "PENDING",
      };

      const result = await conflictDetector.validateBookingModification(
        TEST_PROJECT_ID,
        "booking-001",
        updateData
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Invalid status transition");
    });

    it("should allow cancellation from any active status", async () => {
      const statuses: BookingStatus[] = ["PENDING", "CONFIRMED", "CHECKED_IN"];

      for (const status of statuses) {
        const booking = createBooking({
          id: `booking-${status}`,
          propertyId: VILLA_1_ID,
          status,
        });
        booking.projectId = TEST_PROJECT_ID;
        mockDb.bookings.push(booking);

        const updateData: UpdateBookingData = {
          status: "CANCELLED",
        };

        const result = await conflictDetector.validateBookingModification(
          TEST_PROJECT_ID,
          `booking-${status}`,
          updateData
        );

        expect(result.isValid).toBe(true);
      }
    });
  });

  describe("Complex modification scenarios", () => {
    it("should handle simultaneous date and property changes", async () => {
      const existingBooking = createBooking({
        id: "booking-001",
        propertyId: VILLA_1_ID,
        checkInDate: "2024-06-01",
        checkOutDate: "2024-06-03",
        status: "CONFIRMED",
      });
      existingBooking.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(existingBooking);

      // Change both property and dates
      const updateData: UpdateBookingData = {
        propertyId: VILLA_2_ID,
        checkIn: "2024-06-05",
        checkOut: "2024-06-07",
      };

      const result = await conflictDetector.validateBookingModification(
        TEST_PROJECT_ID,
        "booking-001",
        updateData
      );

      expect(result.isValid).toBe(true);
    });

    it("should validate race condition scenarios", async () => {
      // Simulate race condition where another booking is created
      // between conflict check and actual modification
      const existingBooking = createBooking({
        id: "booking-001",
        propertyId: VILLA_1_ID,
        checkInDate: "2024-06-01",
        checkOutDate: "2024-06-03",
        status: "CONFIRMED",
      });
      existingBooking.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(existingBooking);

      // Start modification check
      const updateData: UpdateBookingData = {
        checkOut: "2024-06-05",
      };

      // Simulate another booking being created during modification
      const concurrentBooking = createBooking({
        id: "booking-002",
        propertyId: VILLA_1_ID,
        checkInDate: "2024-06-04",
        checkOutDate: "2024-06-06",
        status: "CONFIRMED",
      });
      concurrentBooking.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(concurrentBooking);

      const result = await conflictDetector.validateBookingModification(
        TEST_PROJECT_ID,
        "booking-001",
        updateData
      );

      expect(result.isValid).toBe(false);
      expect(result.conflicts).toHaveLength(1);
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle invalid date formats", async () => {
      const existingBooking = createBooking({
        id: "booking-001",
        propertyId: VILLA_1_ID,
        status: "CONFIRMED",
      });
      existingBooking.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(existingBooking);

      const updateData: UpdateBookingData = {
        checkIn: "invalid-date",
        checkOut: "2024-06-05",
      };

      const result = await conflictDetector.validateBookingModification(
        TEST_PROJECT_ID,
        "booking-001",
        updateData
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Invalid date format");
    });

    it("should handle checkout before checkin", async () => {
      const existingBooking = createBooking({
        id: "booking-001",
        propertyId: VILLA_1_ID,
        status: "CONFIRMED",
      });
      existingBooking.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(existingBooking);

      const updateData: UpdateBookingData = {
        checkIn: "2024-06-05",
        checkOut: "2024-06-03", // Before check-in
      };

      const result = await conflictDetector.validateBookingModification(
        TEST_PROJECT_ID,
        "booking-001",
        updateData
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Check-out must be after check-in");
    });

    it("should handle past date modifications based on business rules", async () => {
      const existingBooking = createBooking({
        id: "booking-001",
        propertyId: VILLA_1_ID,
        checkInDate: "2024-12-01",
        checkOutDate: "2024-12-03",
        status: "CONFIRMED",
      });
      existingBooking.projectId = TEST_PROJECT_ID;
      mockDb.bookings.push(existingBooking);

      // Try to change to past dates
      const updateData: UpdateBookingData = {
        checkIn: "2024-01-01",
        checkOut: "2024-01-03",
      };

      const result = await conflictDetector.validateBookingModification(
        TEST_PROJECT_ID,
        "booking-001",
        updateData
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Cannot modify booking to past dates");
    });

    it("should respect project isolation in modifications", async () => {
      // Booking exists in different project
      const otherProjectBooking = createBooking({
        id: "booking-001",
        propertyId: VILLA_1_ID,
        status: "CONFIRMED",
      });
      otherProjectBooking.projectId = OTHER_PROJECT_ID;
      mockDb.bookings.push(otherProjectBooking);

      const updateData: UpdateBookingData = {
        checkOut: "2024-06-05",
      };

      // Should not find booking in different project
      const result = await conflictDetector.validateBookingModification(
        TEST_PROJECT_ID,
        "booking-001",
        updateData
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Booking not found");
    });
  });
});
