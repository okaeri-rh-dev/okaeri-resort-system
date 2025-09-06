/**
 * useAvailabilityChecker.test.ts - Tests for the availability checker React hook
 *
 * Tests the React hook that provides availability checking functionality to components,
 * including state management, error handling, and integration with TanStack Query.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAvailabilityChecker } from "@/features/booking/hooks/useAvailabilityChecker";
import { createWrapper } from "@/test/utils/test-utils";
import type { DateRange, DayAvailability } from "@/types/common";

// Mock the availability service
const mockAvailabilityService = {
  checkRoomAvailability: vi.fn(),
  getBulkAvailability: vi.fn(),
  getCalendarAvailability: vi.fn(),
};

vi.mock("@/features/booking/services/AvailabilityService", () => ({
  AvailabilityService: {
    getInstance: () => mockAvailabilityService,
  },
}));

// Mock project store
const mockProjectStore = {
  activeProjectId: "test-project-001",
};

vi.mock("@/stores/projectStore", () => ({
  useProjectStore: () => mockProjectStore,
}));

// Test constants
const TEST_PROJECT_ID = "test-project-001";
const VILLA_1_ID = "villa-001";
const VILLA_2_ID = "villa-002";

// Mock availability data
const mockAvailabilityData: Map<string, DayAvailability[]> = new Map([
  [
    VILLA_1_ID,
    [
      { date: "2024-06-01", available: true, price: 3000 },
      { date: "2024-06-02", available: false, price: null, reason: "Booked" },
      { date: "2024-06-03", available: true, price: 3000 },
    ],
  ],
  [
    VILLA_2_ID,
    [
      { date: "2024-06-01", available: true, price: 4500 },
      { date: "2024-06-02", available: true, price: 4500 },
      { date: "2024-06-03", available: true, price: 4500 },
    ],
  ],
]);

describe("useAvailabilityChecker - Basic Functionality", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const createTestWrapper = () => createWrapper(queryClient);

  describe("Single room availability checking", () => {
    it("should check availability for a single room", async () => {
      mockAvailabilityService.checkRoomAvailability.mockResolvedValueOnce(true);

      const { result } = renderHook(() => useAvailabilityChecker(), {
        wrapper: createTestWrapper(),
      });

      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      await result.current.checkRoomAvailability(VILLA_1_ID, checkIn, checkOut);

      expect(mockAvailabilityService.checkRoomAvailability).toHaveBeenCalledWith(
        TEST_PROJECT_ID,
        VILLA_1_ID,
        checkIn,
        checkOut
      );
    });

    it("should return availability status correctly", async () => {
      mockAvailabilityService.checkRoomAvailability.mockResolvedValueOnce(false);

      const { result } = renderHook(() => useAvailabilityChecker(), {
        wrapper: createTestWrapper(),
      });

      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      const isAvailable = await result.current.checkRoomAvailability(VILLA_1_ID, checkIn, checkOut);

      expect(isAvailable).toBe(false);
    });

    it("should handle errors gracefully", async () => {
      const error = new Error("Network error");
      mockAvailabilityService.checkRoomAvailability.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useAvailabilityChecker(), {
        wrapper: createTestWrapper(),
      });

      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      await expect(
        result.current.checkRoomAvailability(VILLA_1_ID, checkIn, checkOut)
      ).rejects.toThrow("Network error");
    });

    it("should validate date parameters", async () => {
      const { result } = renderHook(() => useAvailabilityChecker(), {
        wrapper: createTestWrapper(),
      });

      const checkIn = new Date("2024-06-05");
      const checkOut = new Date("2024-06-03"); // Before check-in

      await expect(
        result.current.checkRoomAvailability(VILLA_1_ID, checkIn, checkOut)
      ).rejects.toThrow("Check-out must be after check-in");
    });

    it("should require valid property ID", async () => {
      const { result } = renderHook(() => useAvailabilityChecker(), {
        wrapper: createTestWrapper(),
      });

      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      await expect(result.current.checkRoomAvailability("", checkIn, checkOut)).rejects.toThrow(
        "Property ID is required"
      );
    });
  });

  describe("Bulk availability checking", () => {
    it("should fetch availability for multiple properties", async () => {
      mockAvailabilityService.getBulkAvailability.mockResolvedValueOnce(mockAvailabilityData);

      const { result } = renderHook(() => useAvailabilityChecker(), {
        wrapper: createTestWrapper(),
      });

      const propertyIds = [VILLA_1_ID, VILLA_2_ID];
      const dateRange: DateRange = {
        from: "2024-06-01",
        to: "2024-06-03",
      };

      const availability = await result.current.getBulkAvailability(propertyIds, dateRange);

      expect(mockAvailabilityService.getBulkAvailability).toHaveBeenCalledWith(
        TEST_PROJECT_ID,
        propertyIds,
        dateRange
      );
      expect(availability).toBe(mockAvailabilityData);
    });

    it("should handle empty property list", async () => {
      mockAvailabilityService.getBulkAvailability.mockResolvedValueOnce(new Map());

      const { result } = renderHook(() => useAvailabilityChecker(), {
        wrapper: createTestWrapper(),
      });

      const dateRange: DateRange = {
        from: "2024-06-01",
        to: "2024-06-03",
      };

      const availability = await result.current.getBulkAvailability([], dateRange);

      expect(availability.size).toBe(0);
    });

    it("should validate date range for bulk checks", async () => {
      const { result } = renderHook(() => useAvailabilityChecker(), {
        wrapper: createTestWrapper(),
      });

      const propertyIds = [VILLA_1_ID];
      const invalidDateRange: DateRange = {
        from: "2024-06-05",
        to: "2024-06-01", // Invalid range
      };

      await expect(
        result.current.getBulkAvailability(propertyIds, invalidDateRange)
      ).rejects.toThrow("Invalid date range");
    });

    it("should handle service errors in bulk operations", async () => {
      const error = new Error("Database connection failed");
      mockAvailabilityService.getBulkAvailability.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useAvailabilityChecker(), {
        wrapper: createTestWrapper(),
      });

      const propertyIds = [VILLA_1_ID, VILLA_2_ID];
      const dateRange: DateRange = {
        from: "2024-06-01",
        to: "2024-06-03",
      };

      await expect(result.current.getBulkAvailability(propertyIds, dateRange)).rejects.toThrow(
        "Database connection failed"
      );
    });
  });

  describe("Calendar availability", () => {
    it("should fetch calendar availability for month view", async () => {
      const mockCalendarData = {
        year: 2024,
        month: 6,
        properties: mockAvailabilityData,
      };

      mockAvailabilityService.getCalendarAvailability.mockResolvedValueOnce(mockCalendarData);

      const { result } = renderHook(() => useAvailabilityChecker(), {
        wrapper: createTestWrapper(),
      });

      const calendar = await result.current.getCalendarAvailability(2024, 6);

      expect(mockAvailabilityService.getCalendarAvailability).toHaveBeenCalledWith(
        TEST_PROJECT_ID,
        2024,
        6
      );
      expect(calendar).toBe(mockCalendarData);
    });

    it("should validate month and year parameters", async () => {
      const { result } = renderHook(() => useAvailabilityChecker(), {
        wrapper: createTestWrapper(),
      });

      // Invalid month
      await expect(result.current.getCalendarAvailability(2024, 13)).rejects.toThrow(
        "Invalid month: must be between 1 and 12"
      );

      // Invalid year
      await expect(result.current.getCalendarAvailability(1900, 6)).rejects.toThrow(
        "Invalid year: must be current year or future"
      );
    });
  });
});

describe("useAvailabilityChecker - State Management", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: 0 },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const createTestWrapper = () => createWrapper(queryClient);

  describe("Loading states", () => {
    it("should indicate loading state during availability check", async () => {
      let resolvePromise: (value: boolean) => void;
      const promise = new Promise<boolean>((resolve) => {
        resolvePromise = resolve;
      });

      mockAvailabilityService.checkRoomAvailability.mockReturnValueOnce(promise);

      const { result } = renderHook(() => useAvailabilityChecker(), {
        wrapper: createTestWrapper(),
      });

      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      // Start the availability check
      const availabilityPromise = result.current.checkRoomAvailability(
        VILLA_1_ID,
        checkIn,
        checkOut
      );

      // Should indicate loading
      expect(result.current.isLoading).toBe(true);

      // Resolve the promise
      resolvePromise!(true);
      await availabilityPromise;

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it("should handle concurrent availability checks", async () => {
      mockAvailabilityService.checkRoomAvailability
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const { result } = renderHook(() => useAvailabilityChecker(), {
        wrapper: createTestWrapper(),
      });

      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      // Start two concurrent checks
      const check1 = result.current.checkRoomAvailability(VILLA_1_ID, checkIn, checkOut);
      const check2 = result.current.checkRoomAvailability(VILLA_2_ID, checkIn, checkOut);

      const [result1, result2] = await Promise.all([check1, check2]);

      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });
  });

  describe("Error handling and recovery", () => {
    it("should recover from network errors with retry", async () => {
      mockAvailabilityService.checkRoomAvailability
        .mockRejectedValueOnce(new Error("Network timeout"))
        .mockResolvedValueOnce(true);

      const { result } = renderHook(() => useAvailabilityChecker(), {
        wrapper: createTestWrapper(),
      });

      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      // First attempt fails
      await expect(
        result.current.checkRoomAvailability(VILLA_1_ID, checkIn, checkOut)
      ).rejects.toThrow("Network timeout");

      // Second attempt succeeds
      const isAvailable = await result.current.checkRoomAvailability(VILLA_1_ID, checkIn, checkOut);
      expect(isAvailable).toBe(true);
    });

    it("should handle server errors gracefully", async () => {
      const serverError = new Error("Internal Server Error");
      mockAvailabilityService.checkRoomAvailability.mockRejectedValueOnce(serverError);

      const { result } = renderHook(() => useAvailabilityChecker(), {
        wrapper: createTestWrapper(),
      });

      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      await expect(
        result.current.checkRoomAvailability(VILLA_1_ID, checkIn, checkOut)
      ).rejects.toThrow("Internal Server Error");
    });
  });

  describe("Caching and optimization", () => {
    it("should cache availability results", async () => {
      mockAvailabilityService.checkRoomAvailability.mockResolvedValue(true);

      const { result } = renderHook(() => useAvailabilityChecker(), {
        wrapper: createTestWrapper(),
      });

      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      // First call
      await result.current.checkRoomAvailability(VILLA_1_ID, checkIn, checkOut);

      // Second call should use cache
      await result.current.checkRoomAvailability(VILLA_1_ID, checkIn, checkOut);

      // Should only call service once due to caching
      expect(mockAvailabilityService.checkRoomAvailability).toHaveBeenCalledTimes(1);
    });

    it("should invalidate cache when needed", async () => {
      mockAvailabilityService.checkRoomAvailability.mockResolvedValue(true);
      mockAvailabilityService.getBulkAvailability.mockResolvedValue(new Map());

      const { result } = renderHook(() => useAvailabilityChecker(), {
        wrapper: createTestWrapper(),
      });

      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      // First call
      await result.current.checkRoomAvailability(VILLA_1_ID, checkIn, checkOut);

      // Invalidate cache
      result.current.invalidateCache();

      // Second call should hit service again
      await result.current.checkRoomAvailability(VILLA_1_ID, checkIn, checkOut);

      expect(mockAvailabilityService.checkRoomAvailability).toHaveBeenCalledTimes(2);
    });

    it("should batch multiple availability requests", async () => {
      mockAvailabilityService.getBulkAvailability.mockResolvedValueOnce(mockAvailabilityData);

      const { result } = renderHook(() => useAvailabilityChecker(), {
        wrapper: createTestWrapper(),
      });

      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      // Multiple rapid availability checks should be batched
      const checks = [
        result.current.checkRoomAvailability(VILLA_1_ID, checkIn, checkOut),
        result.current.checkRoomAvailability(VILLA_2_ID, checkIn, checkOut),
      ];

      await Promise.all(checks);

      // Should batch into single bulk request
      expect(mockAvailabilityService.getBulkAvailability).toHaveBeenCalledTimes(1);
    });
  });

  describe("Project context handling", () => {
    it("should handle missing project context", async () => {
      // Mock no active project
      mockProjectStore.activeProjectId = null;

      const { result } = renderHook(() => useAvailabilityChecker(), {
        wrapper: createTestWrapper(),
      });

      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      await expect(
        result.current.checkRoomAvailability(VILLA_1_ID, checkIn, checkOut)
      ).rejects.toThrow("No active project selected");
    });

    it("should update when project context changes", async () => {
      mockAvailabilityService.checkRoomAvailability.mockResolvedValue(true);

      const { result, rerender } = renderHook(() => useAvailabilityChecker(), {
        wrapper: createTestWrapper(),
      });

      // Change project
      mockProjectStore.activeProjectId = "new-project-002";
      rerender();

      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      await result.current.checkRoomAvailability(VILLA_1_ID, checkIn, checkOut);

      expect(mockAvailabilityService.checkRoomAvailability).toHaveBeenCalledWith(
        "new-project-002",
        VILLA_1_ID,
        checkIn,
        checkOut
      );
    });
  });
});

describe("useAvailabilityChecker - Performance and Edge Cases", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const createTestWrapper = () => createWrapper(queryClient);

  describe("Performance optimization", () => {
    it("should debounce rapid availability checks", async () => {
      mockAvailabilityService.checkRoomAvailability.mockResolvedValue(true);

      const { result } = renderHook(() => useAvailabilityChecker(), {
        wrapper: createTestWrapper(),
      });

      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      // Rapid calls should be debounced
      const rapidCalls = Array.from({ length: 5 }, () =>
        result.current.checkRoomAvailability(VILLA_1_ID, checkIn, checkOut)
      );

      await Promise.all(rapidCalls);

      // Should only make one actual service call
      expect(mockAvailabilityService.checkRoomAvailability).toHaveBeenCalledTimes(1);
    });

    it("should handle large date ranges efficiently", async () => {
      const largeDateRange: DateRange = {
        from: "2024-01-01",
        to: "2024-12-31", // Full year
      };

      const largeAvailabilityMap = new Map();
      // Simulate large response
      for (let i = 1; i <= 365; i++) {
        const date = new Date("2024-01-01");
        date.setDate(i);
        largeAvailabilityMap.set(VILLA_1_ID, [
          {
            date: date.toISOString().split("T")[0],
            available: true,
            price: 3000,
          },
        ]);
      }

      mockAvailabilityService.getBulkAvailability.mockResolvedValueOnce(largeAvailabilityMap);

      const { result } = renderHook(() => useAvailabilityChecker(), {
        wrapper: createTestWrapper(),
      });

      const startTime = Date.now();
      await result.current.getBulkAvailability([VILLA_1_ID], largeDateRange);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(200); // Should complete within 200ms
    });

    it("should handle memory efficiently with large datasets", async () => {
      const manyProperties = Array.from({ length: 50 }, (_, i) => `property-${i}`);
      const largeDateRange: DateRange = {
        from: "2024-06-01",
        to: "2024-06-30",
      };

      mockAvailabilityService.getBulkAvailability.mockResolvedValueOnce(new Map());

      const { result } = renderHook(() => useAvailabilityChecker(), {
        wrapper: createTestWrapper(),
      });

      // Should not cause memory issues
      await expect(
        result.current.getBulkAvailability(manyProperties, largeDateRange)
      ).resolves.toBeDefined();
    });
  });

  describe("Edge cases", () => {
    it("should handle timezone edge cases", async () => {
      mockAvailabilityService.checkRoomAvailability.mockResolvedValueOnce(true);

      const { result } = renderHook(() => useAvailabilityChecker(), {
        wrapper: createTestWrapper(),
      });

      // Test with different timezone dates
      const checkIn = new Date("2024-06-01T00:00:00+08:00"); // Manila time
      const checkOut = new Date("2024-06-03T00:00:00+08:00");

      await result.current.checkRoomAvailability(VILLA_1_ID, checkIn, checkOut);

      expect(mockAvailabilityService.checkRoomAvailability).toHaveBeenCalledWith(
        TEST_PROJECT_ID,
        VILLA_1_ID,
        checkIn,
        checkOut
      );
    });

    it("should handle daylight saving transitions", async () => {
      mockAvailabilityService.checkRoomAvailability.mockResolvedValueOnce(true);

      const { result } = renderHook(() => useAvailabilityChecker(), {
        wrapper: createTestWrapper(),
      });

      // Test around DST transition (though Philippines doesn't have DST)
      const checkIn = new Date("2024-03-10T14:00:00"); // Hypothetical DST change
      const checkOut = new Date("2024-03-12T11:00:00");

      await result.current.checkRoomAvailability(VILLA_1_ID, checkIn, checkOut);

      expect(mockAvailabilityService.checkRoomAvailability).toHaveBeenCalled();
    });

    it("should handle invalid Date objects", async () => {
      const { result } = renderHook(() => useAvailabilityChecker(), {
        wrapper: createTestWrapper(),
      });

      const invalidDate = new Date("invalid-date");
      const validDate = new Date("2024-06-03");

      await expect(
        result.current.checkRoomAvailability(VILLA_1_ID, invalidDate, validDate)
      ).rejects.toThrow("Invalid check-in date");
    });

    it("should handle very long property ID lists", async () => {
      const manyPropertyIds = Array.from({ length: 1000 }, (_, i) => `property-${i}`);
      const dateRange: DateRange = {
        from: "2024-06-01",
        to: "2024-06-03",
      };

      mockAvailabilityService.getBulkAvailability.mockResolvedValueOnce(new Map());

      const { result } = renderHook(() => useAvailabilityChecker(), {
        wrapper: createTestWrapper(),
      });

      await expect(
        result.current.getBulkAvailability(manyPropertyIds, dateRange)
      ).resolves.toBeDefined();
    });

    it("should handle component unmounting gracefully", async () => {
      mockAvailabilityService.checkRoomAvailability.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(true), 1000))
      );

      const { result, unmount } = renderHook(() => useAvailabilityChecker(), {
        wrapper: createTestWrapper(),
      });

      const checkIn = new Date("2024-06-01");
      const checkOut = new Date("2024-06-03");

      // Start availability check
      const promise = result.current.checkRoomAvailability(VILLA_1_ID, checkIn, checkOut);

      // Unmount component before promise resolves
      unmount();

      // Should not throw error on unmount
      await expect(promise).resolves.toBe(true);
    });
  });
});
