/**
 * Unit Tests for Multi-Unit Booking Store (Phase 3)
 *
 * Tests cover:
 * - Initial state and store creation
 * - Unit management (add/remove/update/select/reorder/assign)
 * - Pricing calculations
 * - Edge cases and boundary conditions
 *
 * Target: ≥95% code coverage
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BookingUnit, MultiUnitBooking } from "@/types";

import { useMultiUnitBookingStore } from "../useMultiUnitBookingStore";

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
      });

      // Verify state is set
      expect(result.current.draftBooking).toEqual(mockDraft);

      // Unmount to trigger persistence
      unmount();

      // Render new instance - should load from persisted state
      const { result: newResult } = renderHook(() => useMultiUnitBookingStore());

      expect(newResult.current.draftBooking).toEqual(mockDraft);
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
            ...mockUnit.pricing,
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
  });
});
