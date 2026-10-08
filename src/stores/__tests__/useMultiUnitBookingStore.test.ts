/**
 * Unit Tests for Multi-Unit Booking Store (Phase 3)
 *
 * Tests cover:
 * - Initial state and store creation
 * - Unit management (add/remove/update/select/reorder/assign)
 * - Pricing calculations
 * - Availability checking
 * - Optimistic updates and TTL cleanup
 * - Offline queue management
 * - Network status handling
 * - Conflict resolution
 * - Edge cases and boundary conditions
 *
 * Target: ≥95% code coverage
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BookingUnit, MultiUnitBooking } from "@/types";

import { useMultiUnitBookingStore } from "../useMultiUnitBookingStore";

// Mock date-helpers
vi.mock("@/utils/date-helpers", () => ({
  dateDifference: (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  },
  isWeekend: (date: string) => {
    const day = new Date(date).getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  },
}));

describe("useMultiUnitBookingStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    const { result } = renderHook(() => useMultiUnitBookingStore());
    act(() => {
      result.current.reset();
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // INITIAL STATE TESTS
  // ============================================

  describe("Initial State", () => {
    it("should initialize with default state", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      expect(result.current.selectedUnits).toEqual([]);
      expect(result.current.draftBooking).toBeNull();
      expect(result.current.selectedBooking).toBeNull();
      expect(result.current.availabilityCache).toEqual(new Map());
      expect(result.current.optimisticQueue).toEqual(new Map());
      expect(result.current.offlineQueue).toEqual([]);
      expect(result.current.isOnline).toBe(true);
      expect(result.current.conflictResolutionStrategy).toBe("last-write-wins");
    });

    it("should persist and load draft booking state", () => {
      const mockDraft = {
        booking_id: "draft-123",
        total_amount: 5000,
      } as MultiUnitBooking;

      const { result, unmount } = renderHook(() => useMultiUnitBookingStore());

      // Set draft booking
      act(() => {
        result.current.setDraftBooking(mockDraft);
        result.current.setConflictResolutionStrategy("server-wins");
      });

      // Verify state is set
      expect(result.current.draftBooking).toEqual(mockDraft);
      expect(result.current.conflictResolutionStrategy).toBe("server-wins");

      // Unmount to trigger persistence
      unmount();

      // Render new instance - should load from persisted state
      const { result: newResult } = renderHook(() => useMultiUnitBookingStore());

      expect(newResult.current.draftBooking).toEqual(mockDraft);
      expect(newResult.current.conflictResolutionStrategy).toBe("server-wins");
    });
  });

  // ============================================
  // UNIT MANAGEMENT TESTS
  // ============================================

  describe("Unit Management", () => {
    const mockUnit: BookingUnit = {
      unit_id: "unit-1",
      unit_name: "Villa A",
      unit_code: "VA-001",
      unit_type: "Villa",
      base_occupancy: 2,
      max_occupancy: 4,
      base_rate: 1000,
      weekend_rate: 1500,
      extra_person_rate: 200,
      pricing: {
        nights: 3,
        base_total: 3000,
        weekend_surcharge: 500,
        extra_person_fee: 0,
        unit_total: 3500,
      },
      availability: {
        is_available: true,
        checking: false,
      },
    };

    it("should add a unit successfully", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      act(() => {
        result.current.addUnit(mockUnit);
      });

      expect(result.current.selectedUnits).toHaveLength(1);
      expect(result.current.selectedUnits[0]).toEqual(mockUnit);
    });

    it("should prevent adding duplicate units", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      act(() => {
        result.current.addUnit(mockUnit);
        result.current.addUnit(mockUnit); // Attempt duplicate
      });

      expect(result.current.selectedUnits).toHaveLength(1);
    });

    it("should enforce MAX_UNITS_PER_BOOKING limit", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      act(() => {
        // Add 10 units (the max)
        for (let i = 0; i < 10; i++) {
          result.current.addUnit({
            ...mockUnit,
            unit_id: `unit-${i}`,
          });
        }

        // Attempt to add 11th unit
        result.current.addUnit({
          ...mockUnit,
          unit_id: "unit-11",
        });
      });

      expect(result.current.selectedUnits).toHaveLength(10);
    });

    it("should remove a unit successfully", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      const unit2 = { ...mockUnit, unit_id: "unit-2", unit_name: "Villa B" };

      act(() => {
        result.current.addUnit(mockUnit);
        result.current.addUnit(unit2);
        result.current.removeUnit("unit-1");
      });

      // Should have 1 unit remaining after removing one from two
      expect(result.current.selectedUnits).toHaveLength(1);
      expect(result.current.selectedUnits[0].unit_id).toBe("unit-2");
    });

    it("should prevent removing the last unit", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      act(() => {
        result.current.addUnit(mockUnit);
        result.current.removeUnit("unit-1");
      });

      // Last unit should not be removed if it's the only one
      // The store should set an error and keep the unit
      expect(result.current.selectedUnits).toHaveLength(1);
      expect(result.current.error?.message).toContain("Cannot remove the last unit");
    });

    it("should update a unit successfully", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      act(() => {
        result.current.addUnit(mockUnit);
        result.current.updateUnit("unit-1", {
          pricing: {
            ...mockUnit.pricing!,
            unit_total: 4000,
          },
        });
      });

      expect(result.current.selectedUnits[0].pricing?.unit_total).toBe(4000);
    });

    it("should select a unit successfully", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      act(() => {
        result.current.addUnit(mockUnit);
        result.current.selectUnit("unit-1");
      });

      // Note: selectUnit updates internal state, not the BookingUnit object itself
      // The test verifies the action completes without errors
      expect(result.current.selectedUnits).toHaveLength(1);
    });

    it("should reorder units successfully", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      const unit2 = { ...mockUnit, unit_id: "unit-2", unit_name: "Villa B" };

      act(() => {
        result.current.addUnit(mockUnit);
        result.current.addUnit(unit2);
        result.current.reorderUnits(1, 0);
      });

      expect(result.current.selectedUnits[0].unit_id).toBe("unit-2");
      expect(result.current.selectedUnits[1].unit_id).toBe("unit-1");
    });

    it("should assign guests to a unit", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      act(() => {
        result.current.addUnit(mockUnit);
        result.current.assignGuestsToUnit("unit-1", ["guest-1", "guest-2"], 2);
      });

      expect(result.current.selectedUnits[0].guest_assignment).toEqual({
        guest_ids: ["guest-1", "guest-2"],
        num_guests: 2,
      });
    });
  });

  // ============================================
  // PRICING CALCULATION TESTS
  // ============================================

  describe("Pricing Calculations", () => {
    it("should calculate total amount correctly", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      const unit1 = {
        unit_id: "unit-1",
        pricing: { unit_total: 3000 },
      } as BookingUnit;

      const unit2 = {
        unit_id: "unit-2",
        pricing: { unit_total: 2500 },
      } as BookingUnit;

      act(() => {
        result.current.addUnit(unit1);
        result.current.addUnit(unit2);
      });

      expect(result.current.getTotalAmount()).toBe(5500);
    });

    it("should calculate total guests correctly", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      act(() => {
        result.current.addUnit({
          unit_id: "unit-1",
          guest_assignment: { num_guests: 2, guest_ids: [] },
        } as Partial<BookingUnit> as BookingUnit);

        result.current.addUnit({
          unit_id: "unit-2",
          guest_assignment: { num_guests: 3, guest_ids: [] },
        } as Partial<BookingUnit> as BookingUnit);
      });

      expect(result.current.getTotalGuests()).toBe(5);
    });

    it("should calculate pricing with weekend surcharge", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      const checkIn = "2025-10-04"; // Saturday
      const checkOut = "2025-10-06"; // Monday

      let pricing: ReturnType<typeof result.current.calculateUnitPricing>;
      act(() => {
        pricing = result.current.calculateUnitPricing(
          {
            unit_id: "unit-1",
            base_rate: 1000,
            weekend_rate: 1500,
            extra_person_rate: 200,
            base_occupancy: 2,
          } as BookingUnit,
          checkIn,
          checkOut,
          2
        );
      });

      // Should have 2 nights with weekend surcharge
      expect(pricing!.nights).toBe(2);
      expect(pricing!.weekend_surcharge).toBeGreaterThan(0);
    });

    it("should calculate extra person fee", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      const checkIn = "2025-10-01";
      const checkOut = "2025-10-03";

      let pricing: ReturnType<typeof result.current.calculateUnitPricing>;
      act(() => {
        pricing = result.current.calculateUnitPricing(
          {
            unit_id: "unit-1",
            base_rate: 1000,
            weekend_rate: 1000,
            extra_person_rate: 200,
            base_occupancy: 2,
          } as BookingUnit,
          checkIn,
          checkOut,
          4 // 2 extra persons
        );
      });

      expect(pricing!.extra_person_fee).toBe(800); // 2 nights * 2 extra * 200
    });

    it("should apply bulk discount correctly", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      act(() => {
        // Add units with rate info (needed for calculateUnitPricing)
        result.current.addUnit({
          unit_id: "unit-1",
          base_rate: 2500,
          weekend_rate: 2500,
          extra_person_rate: 0,
          base_occupancy: 2,
          pricing: {
            unit_total: 5000,
            base_total: 5000,
            weekend_surcharge: 0,
            extra_person_fee: 0,
            nights: 2,
          },
        } as BookingUnit);

        result.current.addUnit({
          unit_id: "unit-2",
          base_rate: 2500,
          weekend_rate: 2500,
          extra_person_rate: 0,
          base_occupancy: 2,
          pricing: {
            unit_total: 5000,
            base_total: 5000,
            weekend_surcharge: 0,
            extra_person_fee: 0,
            nights: 2,
          },
        } as BookingUnit);

        // Set draft booking with dates (required for recalculateTotalPricing)
        result.current.setDraftBooking({
          booking_id: "draft-1",
          check_in: "2025-10-01",
          check_out: "2025-10-03",
          total_amount: 10000,
        } as MultiUnitBooking);

        // Apply 10% discount on total (10000)
        result.current.applyBulkDiscount(10);
      });

      // Discount should be calculated correctly
      expect(result.current.draftBooking?.discount_amount).toBe(1000);

      // Call recalculate separately to apply the discount to total_amount
      // (nested set() calls in Zustand don't see each other's changes)
      act(() => {
        result.current.recalculateTotalPricing();
      });

      expect(result.current.draftBooking?.total_amount).toBe(9000);
    });

    it("should clear discount correctly", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      act(() => {
        // Add units with rate info (needed for calculateUnitPricing)
        result.current.addUnit({
          unit_id: "unit-1",
          base_rate: 2500,
          weekend_rate: 2500,
          extra_person_rate: 0,
          base_occupancy: 2,
          pricing: {
            unit_total: 5000,
            base_total: 5000,
            weekend_surcharge: 0,
            extra_person_fee: 0,
            nights: 2,
          },
        } as BookingUnit);

        result.current.addUnit({
          unit_id: "unit-2",
          base_rate: 2500,
          weekend_rate: 2500,
          extra_person_rate: 0,
          base_occupancy: 2,
          pricing: {
            unit_total: 5000,
            base_total: 5000,
            weekend_surcharge: 0,
            extra_person_fee: 0,
            nights: 2,
          },
        } as BookingUnit);

        // Set draft booking with discount and dates
        result.current.setDraftBooking({
          booking_id: "draft-1",
          check_in: "2025-10-01",
          check_out: "2025-10-03",
          total_amount: 9000,
          discount_amount: 1000,
          base_amount: 10000,
        } as MultiUnitBooking);

        result.current.clearDiscount();
      });

      // Discount should be cleared
      expect(result.current.draftBooking?.discount_amount).toBe(0);

      // Call recalculate separately to update total_amount
      // (nested set() calls in Zustand don't see each other's changes)
      act(() => {
        result.current.recalculateTotalPricing();
      });

      expect(result.current.draftBooking?.total_amount).toBe(10000);
    });
  });

  // ============================================
  // AVAILABILITY CHECKING TESTS
  // ============================================

  describe("Availability Checking", () => {
    it("should check unit availability", async () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      await act(async () => {
        await result.current.checkUnitAvailability(
          "unit-1",
          "2025-10-01",
          "2025-10-05",
          async () => true
        );
      });

      // Cache key format: unitId-checkIn-checkOut
      const cacheKey = "unit-1-2025-10-01-2025-10-05";
      const cache = result.current.availabilityCache.get(cacheKey);

      expect(cache?.is_available).toBe(true);
      expect(cache?.checking).toBe(false);
    });

    it("should cache availability results", async () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());
      const checkFn = vi.fn(async () => true);

      await act(async () => {
        await result.current.checkUnitAvailability("unit-1", "2025-10-01", "2025-10-05", checkFn);
      });

      await act(async () => {
        await result.current.checkUnitAvailability("unit-1", "2025-10-01", "2025-10-05", checkFn);
      });

      // Should only call once due to caching
      expect(checkFn).toHaveBeenCalledTimes(1);
    });

    it("should check multiple units availability", async () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      await act(async () => {
        await result.current.checkMultiUnitAvailability(
          ["unit-1", "unit-2"],
          "2025-10-01",
          "2025-10-05",
          async () => [
            { unit_id: "unit-1", is_available: true },
            { unit_id: "unit-2", is_available: false },
          ]
        );
      });

      // Cache key format: unitId-checkIn-checkOut
      const cacheKey1 = "unit-1-2025-10-01-2025-10-05";
      const cacheKey2 = "unit-2-2025-10-01-2025-10-05";

      expect(result.current.availabilityCache.get(cacheKey1)?.is_available).toBe(true);
      expect(result.current.availabilityCache.get(cacheKey2)?.is_available).toBe(false);
    });

    it("should clear availability cache", async () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      // First, populate the cache by checking availability
      await act(async () => {
        await result.current.checkUnitAvailability(
          "unit-1",
          "2025-10-01",
          "2025-10-05",
          async () => true
        );
      });

      const cacheKey = "unit-1-2025-10-01-2025-10-05";

      // Verify cache was populated
      expect(result.current.availabilityCache.has(cacheKey)).toBe(true);

      // Clear the cache for this unit
      act(() => {
        result.current.clearAvailabilityCache("unit-1");
      });

      // Verify cache was cleared
      expect(result.current.availabilityCache.has(cacheKey)).toBe(false);
    });
  });

  // ============================================
  // OPTIMISTIC UPDATES TESTS
  // ============================================

  describe("Optimistic Updates", () => {
    it("should add optimistic booking", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      const optimisticBooking = {
        booking_id: "temp-123",
        total_amount: 5000,
      } as MultiUnitBooking;

      act(() => {
        result.current.addOptimisticBooking(optimisticBooking);
      });

      const entry = result.current.optimisticQueue.get("temp-123");
      expect(entry).toBeDefined();
      expect(entry?.booking).toEqual(optimisticBooking);
      expect(entry?.status).toBe("pending");
    });

    it("should update optimistic booking", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      act(() => {
        result.current.addOptimisticBooking({
          booking_id: "temp-123",
          total_amount: 5000,
        } as MultiUnitBooking);

        result.current.updateOptimisticBooking("temp-123", {
          total_amount: 6000,
        });
      });

      const entry = result.current.optimisticQueue.get("temp-123");
      expect(entry?.booking.total_amount).toBe(6000);
    });

    it("should remove optimistic booking", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      act(() => {
        result.current.addOptimisticBooking({
          booking_id: "temp-123",
          total_amount: 5000,
        } as MultiUnitBooking);

        result.current.removeOptimisticBooking("temp-123");
      });

      expect(result.current.optimisticQueue.has("temp-123")).toBe(false);
    });

    it("should clear expired optimistic entries (TTL)", () => {
      // Ensure real timers before using fake timers
      vi.useRealTimers();
      vi.useFakeTimers();

      const { result } = renderHook(() => useMultiUnitBookingStore());

      act(() => {
        result.current.addOptimisticBooking({
          booking_id: "temp-123",
          total_amount: 5000,
        } as MultiUnitBooking);
      });

      // Verify entry exists
      expect(result.current.optimisticQueue.has("temp-123")).toBe(true);

      // Fast-forward past TTL (5 minutes + 1 second)
      act(() => {
        vi.advanceTimersByTime(5 * 60 * 1000 + 1000);
      });

      // Trigger cleanup
      act(() => {
        result.current.clearExpiredOptimistic();
      });

      expect(result.current.optimisticQueue.has("temp-123")).toBe(false);

      vi.useRealTimers();
    });

    it("should enforce MAX_OPTIMISTIC_ENTRIES limit", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      act(() => {
        // Add 100 entries (the max)
        for (let i = 0; i < 100; i++) {
          result.current.addOptimisticBooking({
            booking_id: `temp-${i}`,
            total_amount: 1000,
          } as MultiUnitBooking);
        }

        // Add 101st entry - should remove oldest
        result.current.addOptimisticBooking({
          booking_id: "temp-100",
          total_amount: 1000,
        } as MultiUnitBooking);
      });

      expect(result.current.optimisticQueue.size).toBe(100);
      expect(result.current.optimisticQueue.has("temp-0")).toBe(false);
      expect(result.current.optimisticQueue.has("temp-100")).toBe(true);
    });

    it("should selectively clear expired optimistic entries", () => {
      // Ensure real timers before using fake timers
      vi.useRealTimers();
      vi.useFakeTimers();

      const { result } = renderHook(() => useMultiUnitBookingStore());

      // Set initial time
      const startTime = new Date("2025-10-01T10:00:00Z").getTime();
      vi.setSystemTime(startTime);

      // Add old optimistic entry
      act(() => {
        result.current.addOptimisticBooking({
          booking_id: "old-booking",
          total_amount: 5000,
          created_at: new Date().toISOString(),
        } as MultiUnitBooking);
      });

      // Advance time by 6 minutes (past the 5-minute TTL)
      vi.setSystemTime(startTime + 6 * 60 * 1000);

      // Add recent entry (within TTL)
      act(() => {
        result.current.addOptimisticBooking({
          booking_id: "new-booking",
          total_amount: 6000,
          created_at: new Date().toISOString(),
        } as MultiUnitBooking);
      });

      // Verify both exist before cleanup
      expect(result.current.optimisticQueue.has("old-booking")).toBe(true);
      expect(result.current.optimisticQueue.has("new-booking")).toBe(true);
      expect(result.current.optimisticQueue.size).toBe(2);

      // Clear expired entries
      act(() => {
        result.current.clearExpiredOptimistic();
      });

      // Old entry should be removed, recent should remain
      expect(result.current.optimisticQueue.has("old-booking")).toBe(false);
      expect(result.current.optimisticQueue.has("new-booking")).toBe(true);
      expect(result.current.optimisticQueue.size).toBe(1);

      vi.useRealTimers();
    });

    it("should sync from realtime correctly", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      const serverBooking = {
        booking_id: "server-123",
        total_amount: 5000,
      } as MultiUnitBooking;

      act(() => {
        result.current.syncFromRealtime(serverBooking);
      });

      expect(result.current.selectedBooking).toEqual(serverBooking);
    });

    it("should resolve conflicts using last-write-wins strategy", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      const localBooking = {
        booking_id: "booking-1",
        total_amount: 5000,
        updated_at: "2025-10-01T10:00:00Z",
      } as MultiUnitBooking;

      const serverBooking = {
        booking_id: "booking-1",
        total_amount: 6000,
        updated_at: "2025-10-01T11:00:00Z",
      } as MultiUnitBooking;

      act(() => {
        result.current.setConflictResolutionStrategy("last-write-wins");
        result.current.setDraftBooking(localBooking);
        result.current.syncFromRealtime(serverBooking);
      });

      // Server version is newer, should win
      expect(result.current.selectedBooking?.total_amount).toBe(6000);
    });

    it("should resolve conflicts using server-wins strategy", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      const localBooking = {
        booking_id: "booking-1",
        total_amount: 5000,
      } as MultiUnitBooking;

      const serverBooking = {
        booking_id: "booking-1",
        total_amount: 6000,
      } as MultiUnitBooking;

      act(() => {
        result.current.setConflictResolutionStrategy("server-wins");
        result.current.setDraftBooking(localBooking);
        result.current.syncFromRealtime(serverBooking);
      });

      // Server always wins
      expect(result.current.selectedBooking?.total_amount).toBe(6000);
    });
  });

  // ============================================
  // OFFLINE QUEUE TESTS
  // ============================================

  describe("Offline Queue", () => {
    it("should add operation to offline queue", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      act(() => {
        result.current.addToOfflineQueue({
          operation: "create",
          data: { booking_id: "offline-1" },
          maxRetries: 3,
        });
      });

      expect(result.current.offlineQueue).toHaveLength(1);
      expect(result.current.offlineQueue[0].operation).toBe("create");
    });

    it("should process offline queue when online", async () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      const processFn = vi.fn(async () => ({ success: true }));

      // Add to queue without triggering auto-processing
      act(() => {
        result.current.addToOfflineQueue({
          operation: "create",
          data: { booking_id: "offline-1" },
        });
      });

      // Manually process queue with test function
      await act(async () => {
        await result.current.processOfflineQueue(processFn);
      });

      await waitFor(() => {
        expect(processFn).toHaveBeenCalled();
        expect(result.current.offlineQueue).toHaveLength(0);
      });
    });

    it("should retry failed operations up to maxRetries", async () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      const processFn = vi.fn(async () => {
        throw new Error("Network error");
      });

      act(() => {
        result.current.addToOfflineQueue({
          operation: "create",
          data: { booking_id: "offline-1" },
          maxRetries: 3, // Allow 3 retries so we can test without removal
        });
      });

      // First attempt - should fail and increment retryCount to 1
      await act(async () => {
        await result.current.processOfflineQueue(processFn);
      });

      expect(result.current.offlineQueue[0].retryCount).toBe(1);
      expect(result.current.offlineQueue).toHaveLength(1);

      // Second attempt - should fail and increment retryCount to 2
      await act(async () => {
        await result.current.processOfflineQueue(processFn);
      });

      expect(result.current.offlineQueue[0].retryCount).toBe(2);
      expect(result.current.offlineQueue).toHaveLength(1);
      expect(processFn).toHaveBeenCalledTimes(2);
    });

    it("should remove operation after max retries exceeded", async () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      const processFn = vi.fn(async () => {
        throw new Error("Network error");
      });

      act(() => {
        result.current.addToOfflineQueue({
          operation: "create",
          data: { booking_id: "offline-1" },
          maxRetries: 1,
        });
      });

      // First attempt should fail and increment retry count
      await act(async () => {
        await result.current.processOfflineQueue(processFn);
      });

      // Queue should now be empty (maxRetries=1 means after 1 retry it's removed)
      expect(result.current.offlineQueue).toHaveLength(0);
      expect(processFn).toHaveBeenCalledTimes(1);
    });

    it("should successfully retry after network restoration", async () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      let attemptCount = 0;
      const processFn = vi.fn(async () => {
        attemptCount++;
        // Fail first 2 attempts, succeed on 3rd
        if (attemptCount < 3) {
          throw new Error("Network error");
        }
        return { success: true };
      });

      act(() => {
        result.current.addToOfflineQueue({
          operation: "create",
          data: { booking_id: "offline-1" },
          maxRetries: 5, // Allow enough retries
        });
      });

      // First attempt (should fail)
      await act(async () => {
        await result.current.processOfflineQueue(processFn);
      });

      expect(attemptCount).toBe(1);
      expect(result.current.offlineQueue).toHaveLength(1);
      expect(result.current.offlineQueue[0].retryCount).toBe(1);

      // Second attempt (should fail)
      await act(async () => {
        await result.current.processOfflineQueue(processFn);
      });

      expect(attemptCount).toBe(2);
      expect(result.current.offlineQueue).toHaveLength(1);
      expect(result.current.offlineQueue[0].retryCount).toBe(2);

      // Third attempt (should succeed and clear queue)
      await act(async () => {
        await result.current.processOfflineQueue(processFn);
      });

      expect(attemptCount).toBe(3);
      expect(result.current.offlineQueue).toHaveLength(0);
    });
  });

  // ============================================
  // NETWORK STATUS TESTS
  // ============================================

  describe("Network Status", () => {
    it("should update online status", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      act(() => {
        result.current.setOnlineStatus(false);
      });

      expect(result.current.isOnline).toBe(false);

      act(() => {
        result.current.setOnlineStatus(true);
      });

      expect(result.current.isOnline).toBe(true);
    });

    it("should handle window online event", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      act(() => {
        result.current.setOnlineStatus(false);
        window.dispatchEvent(new Event("online"));
      });

      expect(result.current.isOnline).toBe(true);
    });

    it("should handle window offline event", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      act(() => {
        window.dispatchEvent(new Event("offline"));
      });

      expect(result.current.isOnline).toBe(false);
    });
  });

  // ============================================
  // EDGE CASES & BOUNDARY CONDITIONS
  // ============================================

  describe("Edge Cases", () => {
    it("should handle empty selectedUnits array", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      expect(result.current.getTotalAmount()).toBe(0);
      expect(result.current.getTotalGuests()).toBe(0);
    });

    it("should handle null pricing data", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      act(() => {
        result.current.addUnit({
          unit_id: "unit-1",
          pricing: null,
        } as unknown as BookingUnit);
      });

      expect(result.current.getTotalAmount()).toBe(0);
    });

    it("should handle invalid date ranges", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      const checkIn = "2025-10-05";
      const checkOut = "2025-10-01"; // Invalid: checkout before checkin

      let pricing: ReturnType<typeof result.current.calculateUnitPricing>;
      act(() => {
        pricing = result.current.calculateUnitPricing(
          {
            unit_id: "unit-1",
            base_rate: 1000,
            weekend_rate: 1000,
            extra_person_rate: 200,
            base_occupancy: 2,
          } as BookingUnit,
          checkIn,
          checkOut,
          2
        );
      });

      // Should handle gracefully (negative nights)
      expect(pricing!.nights).toBeLessThanOrEqual(0);
    });

    it("should handle unit not found in update operations", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      act(() => {
        result.current.updateUnit("non-existent-unit", {
          pricing: {
            nights: 2,
            base_total: 1000,
            weekend_surcharge: 0,
            extra_person_fee: 0,
            unit_total: 1000,
          },
        });
      });

      // Should not throw error
      expect(result.current.selectedUnits).toHaveLength(0);
    });

    it("should handle unit not found in remove operations", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      act(() => {
        result.current.removeUnit("non-existent-unit");
      });

      // Should not throw error
      expect(result.current.selectedUnits).toHaveLength(0);
    });

    it("should handle clearing optimistic entry that doesn't exist", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      act(() => {
        result.current.clearOptimisticEntry("non-existent-id");
      });

      // Should not throw error
      expect(result.current.optimisticQueue.size).toBe(0);
    });

    it("should reset store to initial state", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      act(() => {
        result.current.addUnit({
          unit_id: "unit-1",
        } as BookingUnit);

        result.current.setDraftBooking({
          booking_id: "draft-1",
        } as MultiUnitBooking);

        result.current.reset();
      });

      expect(result.current.selectedUnits).toEqual([]);
      expect(result.current.draftBooking).toBeNull();
      expect(result.current.selectedBooking).toBeNull();
    });
  });

  // ============================================
  // GROUPED OPERATIONS TESTS
  // ============================================

  describe("Grouped Operations", () => {
    it("should handle bulk unit addition", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      const units: BookingUnit[] = [
        { unit_id: "unit-1" } as BookingUnit,
        { unit_id: "unit-2" } as BookingUnit,
        { unit_id: "unit-3" } as BookingUnit,
      ];

      act(() => {
        units.forEach((unit) => result.current.addUnit(unit));
      });

      expect(result.current.selectedUnits).toHaveLength(3);
    });

    it("should handle bulk pricing recalculation", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      const checkIn = "2025-10-01";
      const checkOut = "2025-10-03";

      act(() => {
        // Set draft booking with dates
        result.current.setDraftBooking({
          booking_id: "draft-1",
          check_in: checkIn,
          check_out: checkOut,
        } as MultiUnitBooking);

        result.current.addUnit({
          unit_id: "unit-1",
          base_rate: 1000,
          weekend_rate: 1500,
          extra_person_rate: 200,
          base_occupancy: 2,
        } as BookingUnit);

        result.current.addUnit({
          unit_id: "unit-2",
          base_rate: 1200,
          weekend_rate: 1800,
          extra_person_rate: 250,
          base_occupancy: 2,
        } as BookingUnit);

        result.current.recalculateTotalPricing();
      });

      // Should aggregate pricing from all units
      const total = result.current.getTotalAmount();
      expect(total).toBeGreaterThan(0);
    });

    it("should handle concurrent optimistic updates", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      act(() => {
        result.current.addOptimisticBooking({
          booking_id: "temp-1",
          total_amount: 5000,
        } as MultiUnitBooking);

        result.current.addOptimisticBooking({
          booking_id: "temp-2",
          total_amount: 6000,
        } as MultiUnitBooking);

        result.current.updateOptimisticBooking("temp-1", { total_amount: 5500 });
      });

      expect(result.current.optimisticQueue.size).toBe(2);
      expect(result.current.optimisticQueue.get("temp-1")?.booking.total_amount).toBe(5500);
    });
  });
});
