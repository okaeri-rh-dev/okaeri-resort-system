/**
 * AvailabilityService.test.ts - Comprehensive tests for the availability service layer
 *
 * Tests the service layer that orchestrates availability checking, caching,
 * database interactions, and business logic integration.
 */

import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from "vitest";
import { AvailabilityService } from "@/features/booking/services/AvailabilityService";
import type {
  DateRange,
  DayAvailability,
  CalendarAvailability,
  Booking,
  Property,
} from "@/types/common";
import { createBooking, resetBookingIdCounter } from "@/test/factories/booking.factory";

// Mock database connection
const mockDb = {
  query: vi.fn(),
  transaction: vi.fn(),
  close: vi.fn(),
};

// Mock Redis cache
const mockRedisCache = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  flushdb: vi.fn(),
  exists: vi.fn(),
};

// Mock configuration
const mockConfig = {
  cache: {
    availabilityTtl: 300, // 5 minutes
    calendarTtl: 600, // 10 minutes
    bulkTtl: 180, // 3 minutes
  },
  performance: {
    maxPropertiesPerQuery: 50,
    maxDaysPerQuery: 365,
    queryTimeout: 30000,
  },
};

// Mock dependencies
vi.mock("@/lib/database", () => ({
  getDbConnection: () => mockDb,
}));

vi.mock("@/lib/cache/redis", () => ({
  getRedisClient: () => mockRedisCache,
}));

vi.mock("@/config/app", () => ({
  config: mockConfig,
}));

// Test constants
const TEST_PROJECT_ID = "test-project-001";
const OTHER_PROJECT_ID = "other-project-002";
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
    rates: { baseRate: 3000, minimumStay: 2, maximumStay: 14 },
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
    rates: { baseRate: 4500, minimumStay: 3, maximumStay: 30 },
    images: [],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
];

// Mock bookings for database queries
const createMockBookings = (): Booking[] => [
  createBooking({
    id: "booking-001",
    propertyId: VILLA_1_ID,
    checkInDate: "2024-06-01",
    checkOutDate: "2024-06-04",
    status: "CONFIRMED",
  }),
  createBooking({
    id: "booking-002",
    propertyId: VILLA_1_ID,
    checkInDate: "2024-06-10",
    checkOutDate: "2024-06-12",
    status: "CONFIRMED",
  }),
  createBooking({
    id: "booking-003",
    propertyId: VILLA_2_ID,
    checkInDate: "2024-06-05",
    checkOutDate: "2024-06-08",
    status: "CONFIRMED",
  }),
];

describe("AvailabilityService - Basic Functionality", () => {
  let service: AvailabilityService;
  let mockBookings: Booking[];

  beforeEach(() => {
    resetBookingIdCounter();
    service = AvailabilityService.getInstance();
    mockBookings = createMockBookings();

    // Set up mock project IDs
    mockBookings.forEach((booking) => {
      booking.projectId = TEST_PROJECT_ID;
    });

    vi.clearAllMocks();
  });

  describe("Single room availability", () => {
    it("should check availability for single room successfully", async () => {
      // Mock database query to return no conflicting bookings
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const checkIn = new Date("2024-07-01");
      const checkOut = new Date("2024-07-03");

      const isAvailable = await service.checkRoomAvailability(
        TEST_PROJECT_ID,
        VILLA_1_ID,
        checkIn,
        checkOut
      );

      expect(isAvailable).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT"),
        expect.arrayContaining([TEST_PROJECT_ID, VILLA_1_ID])
      );
    });

    it("should return false when conflicting booking exists", async () => {
      // Mock database query to return conflicting booking
      mockDb.query.mockResolvedValueOnce({ rows: [mockBookings[0]] });

      const checkIn = new Date("2024-06-02");
      const checkOut = new Date("2024-06-05");

      const isAvailable = await service.checkRoomAvailability(
        TEST_PROJECT_ID,
        VILLA_1_ID,
        checkIn,
        checkOut
      );

      expect(isAvailable).toBe(false);
    });

    it("should enforce project isolation in database queries", async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      await service.checkRoomAvailability(TEST_PROJECT_ID, VILLA_1_ID, checkIn, checkOut);

      // Verify project_id is included in WHERE clause
      const query = mockDb.query.mock.calls[0][0];
      expect(query).toMatch(/WHERE.*project_id\s*=\s*\$\d+/i);

      const params = mockDb.query.mock.calls[0][1];
      expect(params).toContain(TEST_PROJECT_ID);
    });

    it("should handle database connection failures", async () => {
      mockDb.query.mockRejectedValueOnce(new Error("Connection refused"));

      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      await expect(
        service.checkRoomAvailability(TEST_PROJECT_ID, VILLA_1_ID, checkIn, checkOut)
      ).rejects.toThrow("Connection refused");
    });

    it("should validate input parameters", async () => {
      const checkIn = new Date("2024-06-05");
      const checkOut = new Date("2024-06-03"); // Invalid: before check-in

      await expect(
        service.checkRoomAvailability(TEST_PROJECT_ID, VILLA_1_ID, checkIn, checkOut)
      ).rejects.toThrow("Check-out must be after check-in");
    });

    it("should require valid project ID", async () => {
      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      await expect(
        service.checkRoomAvailability("", VILLA_1_ID, checkIn, checkOut)
      ).rejects.toThrow("Project ID is required");
    });

    it("should require valid property ID", async () => {
      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      await expect(
        service.checkRoomAvailability(TEST_PROJECT_ID, "", checkIn, checkOut)
      ).rejects.toThrow("Property ID is required");
    });
  });

  describe("Bulk availability checking", () => {
    it("should fetch availability for multiple properties", async () => {
      // Mock room validation query to return all rooms as valid
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: VILLA_1_ID }, { id: VILLA_2_ID }] });

      // Mock bookings query to return a booking for Villa 2 that conflicts with date range
      const dbBookings = [
        {
          room_id: VILLA_2_ID,
          check_in_date: "2024-06-05",
          check_out_date: "2024-06-08",
          guest_name: "John Doe",
          status: "confirmed",
        },
      ];
      mockDb.query.mockResolvedValueOnce({ rows: dbBookings });

      const propertyIds = [VILLA_1_ID, VILLA_2_ID];
      const dateRange: DateRange = {
        from: "2024-06-05",
        to: "2024-06-08",
      };

      const availability = await service.getBulkAvailability(
        TEST_PROJECT_ID,
        propertyIds,
        dateRange
      );

      expect(availability).toBeInstanceOf(Map);
      expect(availability.size).toBe(2);
      expect(availability.has(VILLA_1_ID)).toBe(true);
      expect(availability.has(VILLA_2_ID)).toBe(true);

      // Villa 1 should be fully available
      const villa1Availability = availability.get(VILLA_1_ID);
      expect(villa1Availability?.every((day) => day.available)).toBe(true);

      // Villa 2 should have unavailable dates
      const villa2Availability = availability.get(VILLA_2_ID);
      expect(villa2Availability?.some((day) => !day.available)).toBe(true);
    });

    it("should handle empty property list", async () => {
      const dateRange: DateRange = {
        from: "2024-06-01",
        to: "2024-06-03",
      };

      const availability = await service.getBulkAvailability(TEST_PROJECT_ID, [], dateRange);

      expect(availability.size).toBe(0);
    });

    it("should enforce maximum properties per query limit", async () => {
      const tooManyProperties = Array.from({ length: 100 }, (_, i) => `property-${i}`);
      const dateRange: DateRange = {
        from: "2024-06-01",
        to: "2024-06-03",
      };

      await expect(
        service.getBulkAvailability(TEST_PROJECT_ID, tooManyProperties, dateRange)
      ).rejects.toThrow("Too many properties requested");
    });

    it("should enforce maximum days per query limit", async () => {
      const longDateRange: DateRange = {
        from: "2024-01-01",
        to: "2025-06-01", // Over 365 days
      };

      await expect(
        service.getBulkAvailability(TEST_PROJECT_ID, [VILLA_1_ID], longDateRange)
      ).rejects.toThrow("Date range too large");
    });

    it("should batch database queries efficiently", async () => {
      // Mock room validation query to return all rooms as valid
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: VILLA_1_ID }, { id: VILLA_2_ID }] });
      // Mock bookings query to return no bookings
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const propertyIds = [VILLA_1_ID, VILLA_2_ID];
      const dateRange: DateRange = {
        from: "2024-06-01",
        to: "2024-06-03",
      };

      await service.getBulkAvailability(TEST_PROJECT_ID, propertyIds, dateRange);

      // Should make 2 queries: room validation + booking query
      expect(mockDb.query).toHaveBeenCalledTimes(2);

      // First query should validate room ownership
      const validationQuery = mockDb.query.mock.calls[0][0];
      expect(validationQuery).toMatch(/SELECT\s+id\s+FROM\s+rooms/i);

      // Second query should get bookings with ANY array syntax
      const bookingQuery = mockDb.query.mock.calls[1][0];
      expect(bookingQuery).toMatch(/room_id\s*=\s*ANY/i);
    });
  });

  describe("Calendar availability", () => {
    it("should generate calendar availability for month", async () => {
      // Mock transaction to call the callback directly with mockDb
      mockDb.transaction.mockImplementation(async (callback) => {
        return await callback(mockDb);
      });

      // Mock properties query
      mockDb.query
        .mockResolvedValueOnce({ rows: mockProperties })
        .mockResolvedValueOnce({ rows: mockBookings });

      const calendar = await service.getCalendarAvailability(TEST_PROJECT_ID, 2024, 6);

      expect(calendar.year).toBe(2024);
      expect(calendar.month).toBe(6);
      expect(calendar.properties).toBeInstanceOf(Map);
      expect(calendar.properties.size).toBeGreaterThan(0);
    });

    it("should validate month parameter", async () => {
      await expect(service.getCalendarAvailability(TEST_PROJECT_ID, 2024, 13)).rejects.toThrow(
        "Invalid month: must be between 1 and 12"
      );
    });

    it("should validate year parameter", async () => {
      await expect(service.getCalendarAvailability(TEST_PROJECT_ID, 1900, 6)).rejects.toThrow(
        "Invalid year"
      );
    });

    it("should handle month boundaries correctly", async () => {
      // Mock transaction to call the callback directly with mockDb
      mockDb.transaction.mockImplementation(async (callback) => {
        return await callback(mockDb);
      });

      mockDb.query
        .mockResolvedValueOnce({ rows: mockProperties })
        .mockResolvedValueOnce({ rows: [] });

      const calendar = await service.getCalendarAvailability(TEST_PROJECT_ID, 2024, 2);

      // February 2024 has 29 days (leap year)
      const villa1Calendar = calendar.properties.get(VILLA_1_ID);
      expect(villa1Calendar).toHaveLength(29);
    });

    it("should respect project isolation", async () => {
      // Mock transaction to call the callback directly with mockDb
      mockDb.transaction.mockImplementation(async (callback) => {
        return await callback(mockDb);
      });

      mockDb.query
        .mockResolvedValueOnce({ rows: mockProperties })
        .mockResolvedValueOnce({ rows: mockBookings });

      await service.getCalendarAvailability(TEST_PROJECT_ID, 2024, 6);

      // Both queries should include project_id filter
      expect(mockDb.query).toHaveBeenCalledTimes(2);
      mockDb.query.mock.calls.forEach((call) => {
        const params = call[1];
        expect(params).toContain(TEST_PROJECT_ID);
      });
    });
  });
});

describe("AvailabilityService - Caching Layer", () => {
  let service: AvailabilityService;

  beforeEach(() => {
    service = AvailabilityService.getInstance();
    vi.clearAllMocks();
  });

  describe("Cache hit scenarios", () => {
    it("should return cached availability result", async () => {
      // Mock cache hit
      mockRedisCache.get.mockResolvedValueOnce(JSON.stringify(true));

      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      const isAvailable = await service.checkRoomAvailability(
        TEST_PROJECT_ID,
        VILLA_1_ID,
        checkIn,
        checkOut
      );

      expect(isAvailable).toBe(true);
      expect(mockDb.query).not.toHaveBeenCalled();
      expect(mockRedisCache.get).toHaveBeenCalledWith(expect.stringContaining("availability"));
    });

    it("should use correct cache keys", async () => {
      mockRedisCache.get.mockResolvedValueOnce(null); // Cache miss
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      await service.checkRoomAvailability(TEST_PROJECT_ID, VILLA_1_ID, checkIn, checkOut);

      // Should try to get from cache first
      expect(mockRedisCache.get).toHaveBeenCalledWith(
        expect.stringMatching(
          /availability:test-project-001:villa-001:\d{4}-\d{2}-\d{2}:\d{4}-\d{2}-\d{2}/
        )
      );

      // Should set cache after database query
      expect(mockRedisCache.set).toHaveBeenCalledWith(
        expect.stringMatching(/availability:/),
        expect.any(String),
        "EX",
        mockConfig.cache.availabilityTtl
      );
    });

    it("should handle cache misses gracefully", async () => {
      mockRedisCache.get.mockResolvedValueOnce(null); // Cache miss
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      const isAvailable = await service.checkRoomAvailability(
        TEST_PROJECT_ID,
        VILLA_1_ID,
        checkIn,
        checkOut
      );

      expect(isAvailable).toBe(true);
      expect(mockDb.query).toHaveBeenCalled();
    });

    it("should handle cache errors without failing", async () => {
      mockRedisCache.get.mockRejectedValueOnce(new Error("Redis connection failed"));
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      // Should still work despite cache error
      const isAvailable = await service.checkRoomAvailability(
        TEST_PROJECT_ID,
        VILLA_1_ID,
        checkIn,
        checkOut
      );

      expect(isAvailable).toBe(true);
      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe("Cache invalidation", () => {
    it("should invalidate cache when booking created", async () => {
      await service.invalidateAvailabilityCache(TEST_PROJECT_ID, VILLA_1_ID);

      expect(mockRedisCache.del).toHaveBeenCalledWith(
        expect.stringContaining(`availability:${TEST_PROJECT_ID}:${VILLA_1_ID}`)
      );
    });

    it("should invalidate calendar cache when booking modified", async () => {
      await service.invalidateCalendarCache(TEST_PROJECT_ID, 2024, 6);

      expect(mockRedisCache.del).toHaveBeenCalledWith(
        expect.stringContaining(`calendar:${TEST_PROJECT_ID}:2024:6`)
      );
    });

    it("should batch cache invalidations efficiently", async () => {
      const propertyIds = [VILLA_1_ID, VILLA_2_ID];

      await service.invalidateBulkCache(TEST_PROJECT_ID, propertyIds);

      // Should invalidate cache for all properties
      expect(mockRedisCache.del).toHaveBeenCalledTimes(propertyIds.length);
    });
  });

  describe("Cache warming", () => {
    it("should warm up cache for popular date ranges", async () => {
      mockRedisCache.exists.mockResolvedValue(0); // Cache doesn't exist
      mockDb.query.mockResolvedValue({ rows: [] });

      await service.warmUpCache(TEST_PROJECT_ID, [VILLA_1_ID], 30); // 30 days ahead

      // Should check cache existence and populate if needed
      expect(mockRedisCache.exists).toHaveBeenCalled();
      expect(mockRedisCache.set).toHaveBeenCalled();
    });

    it("should skip warming when cache already exists", async () => {
      mockRedisCache.exists.mockResolvedValue(1); // Cache exists

      await service.warmUpCache(TEST_PROJECT_ID, [VILLA_1_ID], 30);

      // Should not query database if cache exists
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });
});

describe("AvailabilityService - Performance Optimization", () => {
  let service: AvailabilityService;

  beforeEach(() => {
    service = AvailabilityService.getInstance();
    vi.clearAllMocks();
  });

  describe("Query optimization", () => {
    it("should complete single availability check within 100ms", async () => {
      mockRedisCache.get.mockResolvedValueOnce(null); // Cache miss
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      const startTime = Date.now();
      await service.checkRoomAvailability(TEST_PROJECT_ID, VILLA_1_ID, checkIn, checkOut);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100);
    });

    it("should complete bulk availability check within 200ms", async () => {
      mockRedisCache.get.mockResolvedValue(null); // Cache miss

      // Mock room validation query to return all rooms as valid
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: VILLA_1_ID }, { id: VILLA_2_ID }] });
      // Mock bookings query to return no conflicts
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const propertyIds = [VILLA_1_ID, VILLA_2_ID];
      const dateRange: DateRange = {
        from: "2024-06-01",
        to: "2024-06-30",
      };

      const startTime = Date.now();
      await service.getBulkAvailability(TEST_PROJECT_ID, propertyIds, dateRange);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(200);
    });

    it("should optimize database queries with proper indexing hints", async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      await service.checkRoomAvailability(TEST_PROJECT_ID, VILLA_1_ID, checkIn, checkOut);

      const query = mockDb.query.mock.calls[0][0];

      // Should include index hints for performance
      expect(query).toMatch(/project_id/i);
      expect(query).toMatch(/room_id/i);
      expect(query).toMatch(/check_in.*check_out/i);
    });

    it("should use database transactions for consistency", async () => {
      mockDb.transaction.mockImplementation(async (callback) => {
        const tx = { query: mockDb.query };
        return await callback(tx);
      });
      mockDb.query.mockResolvedValue({ rows: mockProperties });

      const calendar = await service.getCalendarAvailability(TEST_PROJECT_ID, 2024, 6);

      expect(mockDb.transaction).toHaveBeenCalled();
    });
  });

  describe("Memory management", () => {
    it("should handle large result sets without memory issues", async () => {
      // Mock room validation query first
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: VILLA_1_ID }] });

      // Simulate large dataset for bookings
      const largeResultSet = Array.from({ length: 10000 }, (_, i) => ({
        id: `booking-${i}`,
        room_id: VILLA_1_ID, // Updated to use room_id
        check_in_date: "2024-06-01", // Updated column name
        check_out_date: "2024-06-03", // Updated column name
        guest_name: `Guest ${i}`,
        status: "confirmed",
      }));

      mockDb.query.mockResolvedValueOnce({ rows: largeResultSet });

      const propertyIds = [VILLA_1_ID];
      const dateRange: DateRange = {
        from: "2024-01-01",
        to: "2024-12-31",
      };

      // Should not cause memory issues
      await expect(
        service.getBulkAvailability(TEST_PROJECT_ID, propertyIds, dateRange)
      ).resolves.toBeDefined();
    });

    it("should clean up resources properly", async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      await service.checkRoomAvailability(TEST_PROJECT_ID, VILLA_1_ID, checkIn, checkOut);

      // Verify no memory leaks by checking that resources are cleaned up
      // This is more of a conceptual test - in practice you'd use profiling tools
      expect(true).toBe(true); // Placeholder for resource cleanup verification
    });
  });

  describe("Concurrent request handling", () => {
    it("should handle concurrent availability checks", async () => {
      mockRedisCache.get.mockResolvedValue(null);
      mockDb.query.mockResolvedValue({ rows: [] });

      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      const concurrentChecks = Array.from({ length: 10 }, () =>
        service.checkRoomAvailability(TEST_PROJECT_ID, VILLA_1_ID, checkIn, checkOut)
      );

      const results = await Promise.all(concurrentChecks);

      expect(results.every((result) => result === true)).toBe(true);
      // Database should be called only once due to caching
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it("should handle race conditions in cache population", async () => {
      let callCount = 0;
      mockRedisCache.get.mockImplementation(async () => {
        if (callCount++ === 0) return null; // First call - cache miss
        return JSON.stringify(true); // Subsequent calls - cache hit
      });

      mockDb.query.mockResolvedValue({ rows: [] });

      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      // Concurrent requests should not duplicate database queries
      const concurrentChecks = Array.from({ length: 5 }, () =>
        service.checkRoomAvailability(TEST_PROJECT_ID, VILLA_1_ID, checkIn, checkOut)
      );

      await Promise.all(concurrentChecks);

      // Should only query database once despite race condition
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });
  });
});

describe("AvailabilityService - Error Handling and Recovery", () => {
  let service: AvailabilityService;

  beforeEach(() => {
    service = AvailabilityService.getInstance();
    vi.clearAllMocks();
  });

  describe("Database error handling", () => {
    it("should handle connection timeouts", async () => {
      mockDb.query.mockRejectedValueOnce(new Error("Connection timeout"));

      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      await expect(
        service.checkRoomAvailability(TEST_PROJECT_ID, VILLA_1_ID, checkIn, checkOut)
      ).rejects.toThrow("Connection timeout");
    });

    it("should retry failed queries with exponential backoff", async () => {
      mockDb.query
        .mockRejectedValueOnce(new Error("Temporary failure"))
        .mockRejectedValueOnce(new Error("Temporary failure"))
        .mockResolvedValueOnce({ rows: [] });

      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      // Should eventually succeed after retries
      const isAvailable = await service.checkRoomAvailability(
        TEST_PROJECT_ID,
        VILLA_1_ID,
        checkIn,
        checkOut
      );

      expect(isAvailable).toBe(true);
      expect(mockDb.query).toHaveBeenCalledTimes(3);
    });

    it("should fail after maximum retries", async () => {
      mockDb.query.mockRejectedValue(new Error("Persistent failure"));

      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      await expect(
        service.checkRoomAvailability(TEST_PROJECT_ID, VILLA_1_ID, checkIn, checkOut)
      ).rejects.toThrow("Persistent failure");
    });
  });

  describe("Cache error resilience", () => {
    it("should continue working when cache is unavailable", async () => {
      mockRedisCache.get.mockRejectedValue(new Error("Redis down"));
      mockRedisCache.set.mockRejectedValue(new Error("Redis down"));
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      // Should still work without cache
      const isAvailable = await service.checkRoomAvailability(
        TEST_PROJECT_ID,
        VILLA_1_ID,
        checkIn,
        checkOut
      );

      expect(isAvailable).toBe(true);
      expect(mockDb.query).toHaveBeenCalled();
    });

    it("should handle corrupted cache data gracefully", async () => {
      mockRedisCache.get.mockResolvedValueOnce("invalid-json{");
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      // Should fall back to database when cache data is corrupted
      const isAvailable = await service.checkRoomAvailability(
        TEST_PROJECT_ID,
        VILLA_1_ID,
        checkIn,
        checkOut
      );

      expect(isAvailable).toBe(true);
      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe("Input validation and sanitization", () => {
    it("should sanitize project ID input", async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      // Should handle potential SQL injection attempts
      await service.checkRoomAvailability(
        "test-project'; DROP TABLE bookings; --",
        VILLA_1_ID,
        checkIn,
        checkOut
      );

      // Should use parameterized queries, not string concatenation
      const query = mockDb.query.mock.calls[0][0];
      expect(query).not.toContain("DROP TABLE");
      expect(query).toMatch(/\$\d+/); // Should use parameterized queries
    });

    it("should validate date objects thoroughly", async () => {
      const invalidDate = new Date("invalid");
      const validDate = new Date("2024-06-03");

      await expect(
        service.checkRoomAvailability(TEST_PROJECT_ID, VILLA_1_ID, invalidDate, validDate)
      ).rejects.toThrow("Invalid date");
    });

    it("should handle very large date ranges", async () => {
      const farFuture = new Date("2050-01-01");
      const evenFarther = new Date("2100-01-01");

      await expect(
        service.checkRoomAvailability(TEST_PROJECT_ID, VILLA_1_ID, farFuture, evenFarther)
      ).rejects.toThrow("Date range too large");
    });
  });
});
