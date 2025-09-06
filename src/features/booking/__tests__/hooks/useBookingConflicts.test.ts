/**
 * useBookingConflicts.test.ts - Tests for the booking conflicts React hook
 *
 * Tests the React hook that provides conflict detection functionality to components,
 * including real-time conflict checking, validation, and conflict resolution helpers.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useBookingConflicts } from "@/features/booking/hooks/useBookingConflicts";
import { createWrapper } from "@/test/utils/test-utils";
import type {
  Booking,
  BookingConflict,
  ValidationResult,
  CreateBookingData,
  UpdateBookingData,
} from "@/types/common";
import { createBooking, createBookingData } from "@/test/factories/booking.factory";

// Mock the conflict detection service
const mockConflictService = {
  findBookingConflicts: vi.fn(),
  validateBookingModification: vi.fn(),
  resolveConflict: vi.fn(),
  getConflictSuggestions: vi.fn(),
};

vi.mock("@/features/booking/services/ConflictDetectionService", () => ({
  ConflictDetectionService: {
    getInstance: () => mockConflictService,
  },
}));

// Mock project store
const mockProjectStore = {
  activeProjectId: "test-project-001",
};

vi.mock("@/stores/projectStore", () => ({
  useProjectStore: () => mockProjectStore,
}));

// Mock UI store for notifications
const mockUIStore = {
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  },
};

vi.mock("@/stores/uiStore", () => ({
  useUIStore: () => mockUIStore,
}));

// Test constants
const TEST_PROJECT_ID = "test-project-001";
const VILLA_1_ID = "villa-001";
const VILLA_2_ID = "villa-002";

// Mock conflict data
const mockBookingConflict: BookingConflict = {
  type: "PARTIAL_OVERLAP",
  severity: "HIGH",
  conflictingBooking: createBooking({
    id: "existing-booking-001",
    propertyId: VILLA_1_ID,
    checkInDate: "2024-06-01",
    checkOutDate: "2024-06-04",
    status: "CONFIRMED",
  }),
  details: {
    overlapDays: 2,
    overlapStart: "2024-06-02",
    overlapEnd: "2024-06-04",
  },
  message: "Booking overlaps with existing reservation",
  suggestions: [
    { type: "CHANGE_DATES", description: "Try dates after June 4th" },
    { type: "CHANGE_PROPERTY", description: "Villa 2 is available for these dates" },
  ],
};

const mockValidationResult: ValidationResult = {
  isValid: false,
  conflicts: [mockBookingConflict],
  errors: ["Date conflict detected"],
  warnings: ["High-demand period - consider premium pricing"],
};

describe("useBookingConflicts - Basic Functionality", () => {
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

  describe("New booking conflict detection", () => {
    it("should detect conflicts for new bookings", async () => {
      mockConflictService.findBookingConflicts.mockResolvedValueOnce([mockBookingConflict]);

      const { result } = renderHook(() => useBookingConflicts(), { wrapper: createTestWrapper() });

      const bookingData = createBookingData({
        propertyId: VILLA_1_ID,
        checkIn: "2024-06-02",
        checkOut: "2024-06-05",
      });

      const conflicts = await result.current.checkNewBookingConflicts(bookingData);

      expect(mockConflictService.findBookingConflicts).toHaveBeenCalledWith(
        TEST_PROJECT_ID,
        bookingData
      );
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toEqual(mockBookingConflict);
    });

    it("should return empty array when no conflicts found", async () => {
      mockConflictService.findBookingConflicts.mockResolvedValueOnce([]);

      const { result } = renderHook(() => useBookingConflicts(), { wrapper: createTestWrapper() });

      const bookingData = createBookingData({
        propertyId: VILLA_1_ID,
        checkIn: "2024-07-01",
        checkOut: "2024-07-03",
      });

      const conflicts = await result.current.checkNewBookingConflicts(bookingData);

      expect(conflicts).toHaveLength(0);
    });

    it("should handle errors in conflict detection", async () => {
      const error = new Error("Database connection failed");
      mockConflictService.findBookingConflicts.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useBookingConflicts(), { wrapper: createTestWrapper() });

      const bookingData = createBookingData();

      await expect(result.current.checkNewBookingConflicts(bookingData)).rejects.toThrow(
        "Database connection failed"
      );
    });

    it("should validate booking data before checking conflicts", async () => {
      const { result } = renderHook(() => useBookingConflicts(), { wrapper: createTestWrapper() });

      const invalidBookingData = createBookingData({
        propertyId: "", // Invalid property ID
        guestName: "", // Missing guest name
      });

      await expect(result.current.checkNewBookingConflicts(invalidBookingData)).rejects.toThrow(
        "Invalid booking data"
      );
    });
  });

  describe("Booking modification conflict detection", () => {
    it("should validate booking modifications", async () => {
      mockConflictService.validateBookingModification.mockResolvedValueOnce(mockValidationResult);

      const { result } = renderHook(() => useBookingConflicts(), { wrapper: createTestWrapper() });

      const updateData: UpdateBookingData = {
        checkOut: "2024-06-06", // Extending stay
      };

      const validationResult = await result.current.validateBookingModification(
        "booking-001",
        updateData
      );

      expect(mockConflictService.validateBookingModification).toHaveBeenCalledWith(
        TEST_PROJECT_ID,
        "booking-001",
        updateData
      );
      expect(validationResult).toEqual(mockValidationResult);
    });

    it("should handle successful modification validation", async () => {
      const successResult: ValidationResult = {
        isValid: true,
        conflicts: [],
        errors: [],
        warnings: [],
      };

      mockConflictService.validateBookingModification.mockResolvedValueOnce(successResult);

      const { result } = renderHook(() => useBookingConflicts(), { wrapper: createTestWrapper() });

      const updateData: UpdateBookingData = {
        checkOut: "2024-06-05",
      };

      const validationResult = await result.current.validateBookingModification(
        "booking-001",
        updateData
      );

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.conflicts).toHaveLength(0);
    });

    it("should reject modifications to non-existent bookings", async () => {
      const notFoundResult: ValidationResult = {
        isValid: false,
        conflicts: [],
        errors: ["Booking not found"],
        warnings: [],
      };

      mockConflictService.validateBookingModification.mockResolvedValueOnce(notFoundResult);

      const { result } = renderHook(() => useBookingConflicts(), { wrapper: createTestWrapper() });

      const updateData: UpdateBookingData = {
        checkOut: "2024-06-05",
      };

      const validationResult = await result.current.validateBookingModification(
        "non-existent-booking",
        updateData
      );

      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors).toContain("Booking not found");
    });

    it("should handle invalid modification data", async () => {
      const { result } = renderHook(() => useBookingConflicts(), { wrapper: createTestWrapper() });

      const invalidUpdateData: UpdateBookingData = {
        checkIn: "2024-06-10",
        checkOut: "2024-06-05", // Checkout before checkin
      };

      await expect(
        result.current.validateBookingModification("booking-001", invalidUpdateData)
      ).rejects.toThrow("Check-out must be after check-in");
    });
  });

  describe("Real-time conflict monitoring", () => {
    it("should monitor conflicts in real-time", async () => {
      mockConflictService.findBookingConflicts.mockResolvedValue([]);

      const { result } = renderHook(() => useBookingConflicts(), { wrapper: createTestWrapper() });

      const bookingData = createBookingData({
        propertyId: VILLA_1_ID,
        checkIn: "2024-06-01",
        checkOut: "2024-06-03",
      });

      await act(async () => {
        result.current.startConflictMonitoring(bookingData);
      });

      expect(result.current.isMonitoring).toBe(true);

      // Simulate real-time conflict detection
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for monitoring interval
      });

      expect(mockConflictService.findBookingConflicts).toHaveBeenCalled();
    });

    it("should stop conflict monitoring", async () => {
      const { result } = renderHook(() => useBookingConflicts(), { wrapper: createTestWrapper() });

      const bookingData = createBookingData();

      await act(async () => {
        result.current.startConflictMonitoring(bookingData);
      });

      expect(result.current.isMonitoring).toBe(true);

      await act(async () => {
        result.current.stopConflictMonitoring();
      });

      expect(result.current.isMonitoring).toBe(false);
    });

    it("should handle conflicts detected during monitoring", async () => {
      mockConflictService.findBookingConflicts
        .mockResolvedValueOnce([]) // First check - no conflicts
        .mockResolvedValueOnce([mockBookingConflict]); // Second check - conflict found

      const { result } = renderHook(() => useBookingConflicts(), { wrapper: createTestWrapper() });

      const bookingData = createBookingData();

      await act(async () => {
        result.current.startConflictMonitoring(bookingData);
      });

      // Wait for monitoring to detect conflict
      await waitFor(() => {
        expect(result.current.currentConflicts).toHaveLength(1);
      });

      expect(mockUIStore.toast.warning).toHaveBeenCalledWith(
        "Booking conflict detected",
        mockBookingConflict.message
      );
    });
  });

  describe("Conflict resolution helpers", () => {
    it("should suggest alternative dates", async () => {
      const suggestions = [
        { checkIn: "2024-06-05", checkOut: "2024-06-08", available: true },
        { checkIn: "2024-06-10", checkOut: "2024-06-13", available: true },
      ];

      mockConflictService.getConflictSuggestions.mockResolvedValueOnce({
        alternativeDates: suggestions,
        alternativeProperties: [],
      });

      const { result } = renderHook(() => useBookingConflicts(), { wrapper: createTestWrapper() });

      const conflictData = {
        propertyId: VILLA_1_ID,
        checkIn: new Date("2024-06-01"),
        checkOut: new Date("2024-06-04"),
        guests: 2,
      };

      const resolution = await result.current.getSuggestions(conflictData);

      expect(resolution.alternativeDates).toEqual(suggestions);
    });

    it("should suggest alternative properties", async () => {
      const propertyOptions = [
        { propertyId: VILLA_2_ID, name: "Villa 2", available: true, price: 4500 },
      ];

      mockConflictService.getConflictSuggestions.mockResolvedValueOnce({
        alternativeDates: [],
        alternativeProperties: propertyOptions,
      });

      const { result } = renderHook(() => useBookingConflicts(), { wrapper: createTestWrapper() });

      const conflictData = {
        propertyId: VILLA_1_ID,
        checkIn: new Date("2024-06-01"),
        checkOut: new Date("2024-06-04"),
        guests: 2,
      };

      const resolution = await result.current.getSuggestions(conflictData);

      expect(resolution.alternativeProperties).toEqual(propertyOptions);
    });

    it("should handle automatic conflict resolution", async () => {
      mockConflictService.resolveConflict.mockResolvedValueOnce({
        resolved: true,
        resolution: "AUTOMATIC_RESCHEDULE",
        newBookingData: createBookingData({
          checkIn: "2024-06-05",
          checkOut: "2024-06-08",
        }),
      });

      const { result } = renderHook(() => useBookingConflicts(), { wrapper: createTestWrapper() });

      const resolved = await result.current.resolveConflict(mockBookingConflict, {
        strategy: "AUTOMATIC",
        preferences: { flexibleDates: true },
      });

      expect(resolved.resolved).toBe(true);
      expect(resolved.resolution).toBe("AUTOMATIC_RESCHEDULE");
    });
  });
});

describe("useBookingConflicts - State Management", () => {
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
    it("should track loading state during conflict detection", async () => {
      let resolvePromise: (value: BookingConflict[]) => void;
      const promise = new Promise<BookingConflict[]>((resolve) => {
        resolvePromise = resolve;
      });

      mockConflictService.findBookingConflicts.mockReturnValueOnce(promise);

      const { result } = renderHook(() => useBookingConflicts(), { wrapper: createTestWrapper() });

      const bookingData = createBookingData();

      // Start conflict detection
      const conflictPromise = result.current.checkNewBookingConflicts(bookingData);

      // Should indicate loading
      expect(result.current.isLoading).toBe(true);

      // Resolve the promise
      resolvePromise!([]);
      await conflictPromise;

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it("should track validation loading state", async () => {
      let resolvePromise: (value: ValidationResult) => void;
      const promise = new Promise<ValidationResult>((resolve) => {
        resolvePromise = resolve;
      });

      mockConflictService.validateBookingModification.mockReturnValueOnce(promise);

      const { result } = renderHook(() => useBookingConflicts(), { wrapper: createTestWrapper() });

      const updateData: UpdateBookingData = { checkOut: "2024-06-05" };

      // Start validation
      const validationPromise = result.current.validateBookingModification(
        "booking-001",
        updateData
      );

      // Should indicate validating
      expect(result.current.isValidating).toBe(true);

      // Resolve the promise
      resolvePromise!(mockValidationResult);
      await validationPromise;

      await waitFor(() => {
        expect(result.current.isValidating).toBe(false);
      });
    });

    it("should handle concurrent operations", async () => {
      mockConflictService.findBookingConflicts.mockResolvedValue([]);
      mockConflictService.validateBookingModification.mockResolvedValue({
        isValid: true,
        conflicts: [],
        errors: [],
        warnings: [],
      });

      const { result } = renderHook(() => useBookingConflicts(), { wrapper: createTestWrapper() });

      const bookingData = createBookingData();
      const updateData: UpdateBookingData = { checkOut: "2024-06-05" };

      // Start concurrent operations
      const conflictCheck = result.current.checkNewBookingConflicts(bookingData);
      const validation = result.current.validateBookingModification("booking-001", updateData);

      await Promise.all([conflictCheck, validation]);

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isValidating).toBe(false);
    });
  });

  describe("Error handling", () => {
    it("should handle network errors gracefully", async () => {
      const networkError = new Error("Network timeout");
      mockConflictService.findBookingConflicts.mockRejectedValueOnce(networkError);

      const { result } = renderHook(() => useBookingConflicts(), { wrapper: createTestWrapper() });

      const bookingData = createBookingData();

      await expect(result.current.checkNewBookingConflicts(bookingData)).rejects.toThrow(
        "Network timeout"
      );

      expect(mockUIStore.toast.error).toHaveBeenCalledWith(
        "Failed to check for conflicts",
        "Network timeout"
      );
    });

    it("should handle service errors with user-friendly messages", async () => {
      const serviceError = new Error("Internal server error");
      mockConflictService.validateBookingModification.mockRejectedValueOnce(serviceError);

      const { result } = renderHook(() => useBookingConflicts(), { wrapper: createTestWrapper() });

      const updateData: UpdateBookingData = { checkOut: "2024-06-05" };

      await expect(
        result.current.validateBookingModification("booking-001", updateData)
      ).rejects.toThrow("Internal server error");

      expect(mockUIStore.toast.error).toHaveBeenCalledWith(
        "Validation failed",
        "Unable to validate booking changes. Please try again."
      );
    });

    it("should recover from transient errors", async () => {
      mockConflictService.findBookingConflicts
        .mockRejectedValueOnce(new Error("Temporary failure"))
        .mockResolvedValueOnce([]);

      const { result } = renderHook(() => useBookingConflicts(), { wrapper: createTestWrapper() });

      const bookingData = createBookingData();

      // First attempt fails
      await expect(result.current.checkNewBookingConflicts(bookingData)).rejects.toThrow(
        "Temporary failure"
      );

      // Second attempt succeeds
      const conflicts = await result.current.checkNewBookingConflicts(bookingData);
      expect(conflicts).toHaveLength(0);
    });
  });

  describe("Caching and optimization", () => {
    it("should cache conflict detection results", async () => {
      mockConflictService.findBookingConflicts.mockResolvedValue([]);

      const { result } = renderHook(() => useBookingConflicts(), { wrapper: createTestWrapper() });

      const bookingData = createBookingData();

      // First call
      await result.current.checkNewBookingConflicts(bookingData);

      // Second call with same data should use cache
      await result.current.checkNewBookingConflicts(bookingData);

      // Should only call service once
      expect(mockConflictService.findBookingConflicts).toHaveBeenCalledTimes(1);
    });

    it("should invalidate cache when booking data changes", async () => {
      mockConflictService.findBookingConflicts.mockResolvedValue([]);

      const { result } = renderHook(() => useBookingConflicts(), { wrapper: createTestWrapper() });

      const bookingData1 = createBookingData({
        checkIn: "2024-06-01",
        checkOut: "2024-06-03",
      });

      const bookingData2 = createBookingData({
        checkIn: "2024-06-05", // Different dates
        checkOut: "2024-06-07",
      });

      // First call
      await result.current.checkNewBookingConflicts(bookingData1);

      // Second call with different data should not use cache
      await result.current.checkNewBookingConflicts(bookingData2);

      expect(mockConflictService.findBookingConflicts).toHaveBeenCalledTimes(2);
    });

    it("should optimize repeated validation calls", async () => {
      mockConflictService.validateBookingModification.mockResolvedValue(mockValidationResult);

      const { result } = renderHook(() => useBookingConflicts(), { wrapper: createTestWrapper() });

      const updateData: UpdateBookingData = { checkOut: "2024-06-05" };

      // Multiple rapid calls should be debounced
      const validations = Array.from({ length: 5 }, () =>
        result.current.validateBookingModification("booking-001", updateData)
      );

      await Promise.all(validations);

      // Should only make one service call due to debouncing
      expect(mockConflictService.validateBookingModification).toHaveBeenCalledTimes(1);
    });
  });

  describe("Project context handling", () => {
    it("should handle missing project context", async () => {
      mockProjectStore.activeProjectId = null;

      const { result } = renderHook(() => useBookingConflicts(), { wrapper: createTestWrapper() });

      const bookingData = createBookingData();

      await expect(result.current.checkNewBookingConflicts(bookingData)).rejects.toThrow(
        "No active project selected"
      );
    });

    it("should update when project changes", async () => {
      mockConflictService.findBookingConflicts.mockResolvedValue([]);

      const { result, rerender } = renderHook(() => useBookingConflicts(), {
        wrapper: createTestWrapper(),
      });

      // Change project
      mockProjectStore.activeProjectId = "new-project-002";
      rerender();

      const bookingData = createBookingData();
      await result.current.checkNewBookingConflicts(bookingData);

      expect(mockConflictService.findBookingConflicts).toHaveBeenCalledWith(
        "new-project-002",
        bookingData
      );
    });

    it("should clear conflicts when project changes", async () => {
      mockConflictService.findBookingConflicts.mockResolvedValue([mockBookingConflict]);

      const { result, rerender } = renderHook(() => useBookingConflicts(), {
        wrapper: createTestWrapper(),
      });

      const bookingData = createBookingData();
      await result.current.checkNewBookingConflicts(bookingData);

      expect(result.current.currentConflicts).toHaveLength(1);

      // Change project
      mockProjectStore.activeProjectId = "new-project-002";
      rerender();

      // Conflicts should be cleared
      expect(result.current.currentConflicts).toHaveLength(0);
    });
  });
});
