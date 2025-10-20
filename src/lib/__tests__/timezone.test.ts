/**
 * Unit Tests for Timezone Utilities
 *
 * Tests all timezone functions for public availability calendar.
 * Ensures correct Philippine Time (Asia/Manila, UTC+8) normalization
 * regardless of user's browser timezone.
 *
 * Test Coverage:
 * - toPhilippineTime: Conversion to Philippine timezone
 * - formatPhilippineDate: Date formatting in Philippine timezone
 * - toISODateString: ISO date string generation
 * - getTodayPhilippineTime: Today's date in Philippine timezone
 * - isPastDate: Past date detection
 * - isTooFarInFuture: Future date limit checking
 * - getMonthStart: First day of month
 * - getMonthEnd: Last day of month
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  formatPhilippineDate,
  getMonthEnd,
  getMonthStart,
  getTodayPhilippineTime,
  isPastDate,
  isTooFarInFuture,
  TIMEZONE,
  toISODateString,
  toPhilippineTime,
} from "../timezone";

describe("Timezone Utilities", () => {
  // Mock current date to 2025-01-15 12:00:00 UTC for consistent testing
  beforeEach(() => {
    vi.useRealTimers(); // Clear any existing timers first
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("toPhilippineTime", () => {
    it("should convert UTC date to Philippine Time (UTC+8)", () => {
      const utcDate = new Date("2025-01-15T00:00:00Z"); // Midnight UTC
      const phDate = toPhilippineTime(utcDate);

      // In Philippine Time, this should be 8:00 AM on Jan 15
      expect(phDate.getHours()).toBe(8);
      expect(phDate.getDate()).toBe(15);
    });

    it("should handle date object already in Philippine Time", () => {
      const phDate = new Date("2025-01-15T14:00:00"); // 2:00 PM local
      const converted = toPhilippineTime(phDate);

      expect(converted).toBeDefined();
      expect(converted.getDate()).toBe(15);
    });

    it("should preserve date boundaries correctly", () => {
      const utcDate = new Date("2025-01-31T23:00:00Z"); // 11:00 PM UTC on Jan 31
      const phDate = toPhilippineTime(utcDate);

      // In Philippine Time, this should be 7:00 AM on Feb 1
      expect(phDate.getMonth()).toBe(1); // February (0-indexed)
      expect(phDate.getDate()).toBe(1);
    });
  });

  describe("formatPhilippineDate", () => {
    it("should format date in Philippine Time with default format", () => {
      const date = new Date("2025-01-15T00:00:00Z");
      const formatted = formatPhilippineDate(date);

      // Default format is 'PPP' which produces "January 15th, 2025" (with ordinal suffix)
      expect(formatted).toMatch(/January 15(th)?, 2025/i);
    });

    it("should format date with custom format string", () => {
      const date = new Date("2025-01-15T00:00:00Z");
      const formatted = formatPhilippineDate(date, "yyyy-MM-dd");

      expect(formatted).toBe("2025-01-15");
    });

    it("should handle month boundaries correctly", () => {
      const date = new Date("2025-01-31T20:00:00Z"); // Jan 31 8:00 PM UTC
      const formatted = formatPhilippineDate(date, "yyyy-MM-dd");

      // In PH Time, this is Feb 1 4:00 AM
      expect(formatted).toBe("2025-02-01");
    });
  });

  describe("toISODateString", () => {
    it("should convert date to YYYY-MM-DD format", () => {
      const date = new Date(2025, 0, 15); // Jan 15, 2025
      const iso = toISODateString(date);

      expect(iso).toBe("2025-01-15");
    });

    it("should pad single-digit months and days", () => {
      const date = new Date(2025, 0, 5); // Jan 5, 2025
      const iso = toISODateString(date);

      expect(iso).toBe("2025-01-05");
    });

    it("should handle end of month dates", () => {
      const date = new Date(2025, 0, 31); // Jan 31, 2025
      const iso = toISODateString(date);

      expect(iso).toBe("2025-01-31");
    });

    it("should handle leap year February dates", () => {
      const date = new Date(2024, 1, 29); // Feb 29, 2024 (leap year)
      const iso = toISODateString(date);

      expect(iso).toBe("2024-02-29");
    });
  });

  describe("getTodayPhilippineTime", () => {
    it("should return today's date at midnight in Philippine Time", () => {
      const today = getTodayPhilippineTime();

      expect(today.getHours()).toBe(0);
      expect(today.getMinutes()).toBe(0);
      expect(today.getSeconds()).toBe(0);
      expect(today.getMilliseconds()).toBe(0);
    });

    it("should return consistent date across multiple calls", () => {
      const today1 = getTodayPhilippineTime();
      const today2 = getTodayPhilippineTime();

      expect(today1.getTime()).toBe(today2.getTime());
    });

    it("should return Philippine timezone date, not local", () => {
      const today = getTodayPhilippineTime();

      // Since we're mocking time to 2025-01-15T12:00:00Z (noon UTC),
      // in Philippine Time (UTC+8), it's 8:00 PM on Jan 15
      // getTodayPhilippineTime should return midnight of Jan 15 in PH Time
      expect(today.getDate()).toBe(15);
      expect(today.getMonth()).toBe(0); // January
      expect(today.getFullYear()).toBe(2025);
    });
  });

  describe("isPastDate", () => {
    it("should return true for dates before today", () => {
      const yesterday = new Date("2025-01-14T00:00:00Z");
      const result = isPastDate(yesterday);

      expect(result).toBe(true);
    });

    it("should return false for today", () => {
      const today = new Date("2025-01-15T00:00:00Z");
      const result = isPastDate(today);

      expect(result).toBe(false);
    });

    it("should return false for dates in the future", () => {
      const tomorrow = new Date("2025-01-16T00:00:00Z");
      const result = isPastDate(tomorrow);

      expect(result).toBe(false);
    });

    it("should handle timezone edge cases correctly", () => {
      // Date that's still "today" in UTC but "tomorrow" in Philippine Time
      const date = new Date("2025-01-15T18:00:00Z"); // 6:00 PM UTC = 2:00 AM Jan 16 in PH
      const result = isPastDate(date);

      // Should be false because it's tomorrow in Philippine Time
      expect(result).toBe(false);
    });
  });

  describe("isTooFarInFuture", () => {
    it("should return false for dates within 1 year", () => {
      const sixMonthsAhead = new Date("2025-07-15T00:00:00Z");
      const result = isTooFarInFuture(sixMonthsAhead);

      expect(result).toBe(false);
    });

    it("should return false for exactly 1 year ahead", () => {
      const oneYearAhead = new Date("2026-01-15T00:00:00Z");
      const result = isTooFarInFuture(oneYearAhead);

      expect(result).toBe(false);
    });

    it("should return true for dates more than 1 year ahead", () => {
      const overOneYearAhead = new Date("2026-01-16T00:00:00Z");
      const result = isTooFarInFuture(overOneYearAhead);

      expect(result).toBe(true);
    });

    it("should handle timezone edge cases correctly", () => {
      const justOverOneYear = new Date("2026-01-15T17:00:00Z"); // Midnight Jan 16 in PH
      const result = isTooFarInFuture(justOverOneYear);

      expect(result).toBe(true);
    });
  });

  describe("getMonthStart", () => {
    it("should return first day of month at midnight", () => {
      const date = new Date("2025-01-15T12:00:00Z");
      const monthStart = getMonthStart(date);

      expect(monthStart.getDate()).toBe(1);
      expect(monthStart.getMonth()).toBe(0); // January
      expect(monthStart.getFullYear()).toBe(2025);
      expect(monthStart.getHours()).toBe(0);
      expect(monthStart.getMinutes()).toBe(0);
    });

    it("should handle dates already at month start", () => {
      const date = new Date("2025-01-01T00:00:00Z");
      const monthStart = getMonthStart(date);

      expect(monthStart.getDate()).toBe(1);
      expect(monthStart.getMonth()).toBe(0);
    });

    it("should handle end of month dates", () => {
      const date = new Date("2025-01-31T23:59:59Z"); // 11:59:59 PM UTC = 7:59:59 AM Feb 1 in PH
      const monthStart = getMonthStart(date);

      expect(monthStart.getDate()).toBe(1);
      expect(monthStart.getMonth()).toBe(1); // February (because PH Time crosses into Feb)
    });

    it("should normalize to Philippine Time", () => {
      const date = new Date("2025-01-31T18:00:00Z"); // Feb 1 2:00 AM in PH Time
      const monthStart = getMonthStart(date);

      // Should return Feb 1 because that's the month in PH Time
      expect(monthStart.getMonth()).toBe(1); // February
      expect(monthStart.getDate()).toBe(1);
    });
  });

  describe("getMonthEnd", () => {
    it("should return last day of month", () => {
      const date = new Date("2025-01-15T12:00:00Z");
      const monthEnd = getMonthEnd(date);

      expect(monthEnd.getDate()).toBe(31); // January has 31 days
      expect(monthEnd.getMonth()).toBe(0); // January
      expect(monthEnd.getFullYear()).toBe(2025);
    });

    it("should handle February in non-leap year", () => {
      vi.setSystemTime(new Date("2025-02-15T12:00:00Z"));
      const date = new Date("2025-02-15T00:00:00Z");
      const monthEnd = getMonthEnd(date);

      expect(monthEnd.getDate()).toBe(28); // February 2025 has 28 days
      expect(monthEnd.getMonth()).toBe(1); // February
    });

    it("should handle February in leap year", () => {
      vi.setSystemTime(new Date("2024-02-15T12:00:00Z"));
      const date = new Date("2024-02-15T00:00:00Z");
      const monthEnd = getMonthEnd(date);

      expect(monthEnd.getDate()).toBe(29); // February 2024 has 29 days (leap year)
      expect(monthEnd.getMonth()).toBe(1); // February
    });

    it("should handle months with 30 days", () => {
      vi.setSystemTime(new Date("2025-04-15T12:00:00Z"));
      const date = new Date("2025-04-15T00:00:00Z");
      const monthEnd = getMonthEnd(date);

      expect(monthEnd.getDate()).toBe(30); // April has 30 days
      expect(monthEnd.getMonth()).toBe(3); // April
    });

    it("should normalize to Philippine Time", () => {
      const date = new Date("2025-01-31T18:00:00Z"); // Feb 1 2:00 AM in PH Time
      const monthEnd = getMonthEnd(date);

      // Should return last day of February because that's the month in PH Time
      expect(monthEnd.getMonth()).toBe(1); // February
      expect(monthEnd.getDate()).toBe(28); // Last day of Feb 2025
    });
  });

  describe("TIMEZONE constant", () => {
    it("should be set to Asia/Manila", () => {
      expect(TIMEZONE).toBe("Asia/Manila");
    });
  });
});
