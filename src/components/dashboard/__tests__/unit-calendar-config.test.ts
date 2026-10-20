/**
 * Tests for unit-calendar-config
 *
 * Validates the static configuration that drives the fixed 3-slot
 * vertical lane layout in the DashboardCalendar.
 *
 * Test Coverage:
 * - UNIT_SLOTS: structure, order, and completeness
 * - UNIT_SLOT_MAP: O(1) lookup correctness
 * - getStatusHintClasses: Tailwind modifier classes per booking status
 */

import { describe, expect, it } from "vitest";

import {
  getStatusHintClasses,
  getStatusMobileBarClasses,
  PENDING_CHIP_COLORS,
  UNIT_SLOT_MAP,
  UNIT_SLOTS,
  type UnitSlotConfig,
} from "../unit-calendar-config";

describe("unit-calendar-config", () => {
  // ─────────────────────────────────────────────
  // UNIT_SLOTS
  // ─────────────────────────────────────────────
  describe("UNIT_SLOTS", () => {
    it("should have exactly 3 entries", () => {
      expect(UNIT_SLOTS).toHaveLength(3);
    });

    it("should have C1 at index 0 with lane 1 tokens", () => {
      const c1 = UNIT_SLOTS[0];
      expect(c1.unitCode).toBe("C1");
      expect(c1.slotIndex).toBe(0);
      expect(c1.bg).toBe("bg-unit-lane-1");
      expect(c1.text).toBe("text-unit-lane-1-foreground");
      expect(c1.border).toBe("border-unit-lane-1-accent");
      expect(c1.mobileBar).toBe("bg-unit-lane-1-accent");
    });

    it("should have C2 at index 1 with lane 2 tokens", () => {
      const c2 = UNIT_SLOTS[1];
      expect(c2.unitCode).toBe("C2");
      expect(c2.slotIndex).toBe(1);
      expect(c2.bg).toBe("bg-unit-lane-2");
      expect(c2.text).toBe("text-unit-lane-2-foreground");
      expect(c2.border).toBe("border-unit-lane-2-accent");
      expect(c2.mobileBar).toBe("bg-unit-lane-2-accent");
    });

    it("should have C3 at index 2 with lane 3 tokens", () => {
      const c3 = UNIT_SLOTS[2];
      expect(c3.unitCode).toBe("C3");
      expect(c3.slotIndex).toBe(2);
      expect(c3.bg).toBe("bg-unit-lane-3");
      expect(c3.text).toBe("text-unit-lane-3-foreground");
      expect(c3.border).toBe("border-unit-lane-3-accent");
      expect(c3.mobileBar).toBe("bg-unit-lane-3-accent");
    });

    it("should have all required fields on every entry", () => {
      const requiredKeys: (keyof UnitSlotConfig)[] = [
        "unitCode",
        "slotIndex",
        "bg",
        "text",
        "border",
        "mobileBar",
      ];

      for (const slot of UNIT_SLOTS) {
        for (const key of requiredKeys) {
          expect(slot[key], `${slot.unitCode} missing "${key}"`).toBeDefined();
        }
      }
    });

    it("should have sequential slotIndex values starting at 0", () => {
      UNIT_SLOTS.forEach((slot, index) => {
        expect(slot.slotIndex).toBe(index);
      });
    });

    it("should have unique unit codes", () => {
      const codes = UNIT_SLOTS.map((s) => s.unitCode);
      expect(new Set(codes).size).toBe(codes.length);
    });

    it("should have unique slot indexes", () => {
      const indexes = UNIT_SLOTS.map((s) => s.slotIndex);
      expect(new Set(indexes).size).toBe(indexes.length);
    });

    it("should use distinct color families per unit", () => {
      const bgs = UNIT_SLOTS.map((s) => s.bg);
      expect(new Set(bgs).size).toBe(3);

      const mobileBars = UNIT_SLOTS.map((s) => s.mobileBar);
      expect(new Set(mobileBars).size).toBe(3);
    });
  });

  // ─────────────────────────────────────────────
  // UNIT_SLOT_MAP
  // ─────────────────────────────────────────────
  describe("UNIT_SLOT_MAP", () => {
    it("should have exactly 3 entries", () => {
      expect(UNIT_SLOT_MAP.size).toBe(3);
    });

    it("should return correct config for C1", () => {
      const config = UNIT_SLOT_MAP.get("C1");
      expect(config).toBeDefined();
      expect(config!.slotIndex).toBe(0);
      expect(config!.bg).toBe("bg-unit-lane-1");
    });

    it("should return correct config for C2", () => {
      const config = UNIT_SLOT_MAP.get("C2");
      expect(config).toBeDefined();
      expect(config!.slotIndex).toBe(1);
      expect(config!.bg).toBe("bg-unit-lane-2");
    });

    it("should return correct config for C3", () => {
      const config = UNIT_SLOT_MAP.get("C3");
      expect(config).toBeDefined();
      expect(config!.slotIndex).toBe(2);
      expect(config!.bg).toBe("bg-unit-lane-3");
    });

    it("should return undefined for unknown unit codes", () => {
      expect(UNIT_SLOT_MAP.get("C4")).toBeUndefined();
      expect(UNIT_SLOT_MAP.get("")).toBeUndefined();
      expect(UNIT_SLOT_MAP.get("UNKNOWN")).toBeUndefined();
    });

    it("should reference the same objects as UNIT_SLOTS", () => {
      for (const slot of UNIT_SLOTS) {
        expect(UNIT_SLOT_MAP.get(slot.unitCode)).toBe(slot);
      }
    });
  });

  // ─────────────────────────────────────────────
  // getStatusHintClasses
  // ─────────────────────────────────────────────
  describe("getStatusHintClasses", () => {
    it('should return "" for Confirmed', () => {
      expect(getStatusHintClasses("Confirmed")).toBe("");
    });

    it('should return "" for CheckedIn', () => {
      expect(getStatusHintClasses("CheckedIn")).toBe("");
    });

    it('should return "bg-card border-2 border-dashed" for Pending', () => {
      expect(getStatusHintClasses("Pending")).toBe("bg-card border-2 border-dashed");
    });

    it('should return "opacity-50" for CheckedOut', () => {
      expect(getStatusHintClasses("CheckedOut")).toBe("opacity-50");
    });

    it('should return "opacity-30 line-through" for Cancelled', () => {
      expect(getStatusHintClasses("Cancelled")).toBe("opacity-30 line-through");
    });

    it('should return "" for unknown status (including lowercase variants)', () => {
      expect(getStatusHintClasses("SomeUnknownStatus")).toBe("");
      expect(getStatusHintClasses("")).toBe("");
      expect(getStatusHintClasses("confirmed")).toBe("");
      expect(getStatusHintClasses("pending")).toBe("");
    });
  });

  // ─────────────────────────────────────────────
  // getStatusMobileBarClasses
  // ─────────────────────────────────────────────
  describe("getStatusMobileBarClasses", () => {
    it('should return "" for Confirmed', () => {
      expect(getStatusMobileBarClasses("Confirmed")).toBe("");
    });

    it('should return "" for CheckedIn', () => {
      expect(getStatusMobileBarClasses("CheckedIn")).toBe("");
    });

    it('should return "opacity-70" for Pending (preserves unit color on mobile)', () => {
      expect(getStatusMobileBarClasses("Pending")).toBe("opacity-70");
    });

    it('should return "opacity-50" for CheckedOut', () => {
      expect(getStatusMobileBarClasses("CheckedOut")).toBe("opacity-50");
    });

    it('should return "opacity-30" for Cancelled', () => {
      expect(getStatusMobileBarClasses("Cancelled")).toBe("opacity-30");
    });

    it('should return "" for unknown status (including lowercase variants)', () => {
      expect(getStatusMobileBarClasses("SomeUnknownStatus")).toBe("");
      expect(getStatusMobileBarClasses("")).toBe("");
      expect(getStatusMobileBarClasses("pending")).toBe("");
    });
  });

  // ─────────────────────────────────────────────
  // PENDING_CHIP_COLORS
  // ─────────────────────────────────────────────
  describe("PENDING_CHIP_COLORS", () => {
    it("should use lane 3 tokens for all Pending bookings regardless of unit", () => {
      expect(PENDING_CHIP_COLORS.text).toBe("text-unit-lane-3-foreground");
      expect(PENDING_CHIP_COLORS.border).toBe("border-unit-lane-3-accent");
      expect(PENDING_CHIP_COLORS.mobileBar).toBe("bg-unit-lane-3-accent");
    });

    it("should match the C3 slot's color family (Pending mirrors C3 look)", () => {
      const c3 = UNIT_SLOTS[2];
      expect(PENDING_CHIP_COLORS.text).toBe(c3.text);
      expect(PENDING_CHIP_COLORS.mobileBar).toBe(c3.mobileBar);
    });
  });
});
