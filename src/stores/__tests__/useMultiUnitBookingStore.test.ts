/**
 * Unit Tests for Multi-Unit Booking Store
 *
 * Tests cover:
 * - Initial state and store creation
 * - Unit management (add/remove/assign)
 * - Pricing calculations
 * - Edge cases and boundary conditions
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BookingUnit, MultiUnitBooking } from "@/types";

import { useMultiUnitBookingStore } from "../useMultiUnitBookingStore";

describe("useMultiUnitBookingStore", () => {
  beforeEach(() => {
    act(() => {
      useMultiUnitBookingStore.getState().clearDraftBooking();
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Initial State", () => {
    it("should initialize with default state", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      expect(result.current.selectedUnits).toEqual([]);
      expect(result.current.draftBooking).toBeNull();
    });

    it("should persist and load draft booking state", () => {
      const mockDraft = {
        booking_id: "draft-123",
        total_amount: 5000,
      } as MultiUnitBooking;

      const { result, unmount } = renderHook(() => useMultiUnitBookingStore());

      act(() => {
        result.current.setDraftBooking(mockDraft);
      });

      expect(result.current.draftBooking).toEqual(mockDraft);

      // Unmount to trigger persistence
      unmount();

      // Render new instance - should load from persisted state
      const { result: newResult } = renderHook(() => useMultiUnitBookingStore());

      expect(newResult.current.draftBooking).toEqual(mockDraft);
    });
  });

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
        result.current.addUnit(mockUnit);
      });

      expect(result.current.selectedUnits).toHaveLength(1);
    });

    it("should enforce MAX_UNITS_PER_BOOKING limit", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.addUnit({
            ...mockUnit,
            unit_id: `unit-${i}`,
          });
        }

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

      expect(result.current.selectedUnits).toHaveLength(1);
      expect(result.current.selectedUnits[0].unit_id).toBe("unit-2");
    });

    it("should prevent removing the last unit", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      act(() => {
        result.current.addUnit(mockUnit);
        result.current.removeUnit("unit-1");
      });

      expect(result.current.selectedUnits).toHaveLength(1);
      expect(result.current.error?.message).toContain("Cannot remove the last unit");
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

    it("should reprice the draft when guests are assigned", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      act(() => {
        result.current.setDraftBooking({
          check_in: "2025-10-01",
          check_out: "2025-10-03",
          discount_amount: 100,
        });
        result.current.addUnit({ ...mockUnit, weekend_rate: 1000 });
        result.current.assignGuestsToUnit("unit-1", ["guest-1"], 3);
      });

      expect(result.current.selectedUnits[0].pricing.unit_total).toBe(2400);
      expect(result.current.draftBooking).toMatchObject({
        base_amount: 2000,
        total_surcharges: 400,
        total_amount: 2300,
      });
    });
  });

  describe("Pricing Calculations", () => {
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
  });

  describe("Edge Cases", () => {
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

      expect(pricing!.nights).toBeLessThanOrEqual(0);
    });

    it("should clear the draft, units and error", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      act(() => {
        result.current.setDraftBooking({ check_in: "2025-10-01" });
        result.current.addUnit({ unit_id: "unit-1" } as BookingUnit);
        result.current.removeUnit("unit-1");
        result.current.clearDraftBooking();
      });

      expect(result.current.draftBooking).toBeNull();
      expect(result.current.selectedUnits).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it("should handle unit not found in remove operations", () => {
      const { result } = renderHook(() => useMultiUnitBookingStore());

      act(() => {
        result.current.removeUnit("non-existent-unit");
      });

      expect(result.current.selectedUnits).toHaveLength(0);
    });
  });

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
  });
});
