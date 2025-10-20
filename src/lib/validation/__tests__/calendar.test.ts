/**
 * Unit Tests for Calendar Date Validation
 *
 * Tests frontend validation for public availability calendar.
 * Ensures guests can only query valid date ranges (not past, max 1 year ahead).
 *
 * Test Coverage:
 * - validateCalendarDate: Single date validation
 * - validateMonth: Month boundary validation
 * - Edge cases: Past dates, future dates, timezone boundaries
 * - Error messages: Descriptive validation errors
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { validateCalendarDate, validateMonth, type DateValidationResult } from "../calendar";

describe("Calendar Date Validation", () => {
  // Mock current date to 2025-01-15 12:00:00 UTC for consistent testing
  beforeEach(() => {
    vi.useRealTimers(); // Clear any existing timers first
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("validateCalendarDate", () => {
    describe("Valid dates", () => {
      it("should accept today's date", () => {
        const today = new Date("2025-01-15T00:00:00Z");
        const result = validateCalendarDate(today);

        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it("should accept future dates within 1 year", () => {
        const futureDate = new Date("2025-06-15T00:00:00Z"); // 5 months ahead
        const result = validateCalendarDate(futureDate);

        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it("should accept date exactly 1 year from today", () => {
        const oneYearAhead = new Date("2026-01-15T00:00:00Z");
        const result = validateCalendarDate(oneYearAhead);

        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it("should accept tomorrow's date", () => {
        const tomorrow = new Date("2025-01-16T00:00:00Z");
        const result = validateCalendarDate(tomorrow);

        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    describe("Past dates", () => {
      it("should reject yesterday's date", () => {
        const yesterday = new Date("2025-01-14T00:00:00Z");
        const result = validateCalendarDate(yesterday);

        expect(result.valid).toBe(false);
        expect(result.error).toBe(
          "Cannot query past dates. Please select a date from today onwards."
        );
      });

      it("should reject dates from last month", () => {
        const lastMonth = new Date("2024-12-15T00:00:00Z");
        const result = validateCalendarDate(lastMonth);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("Cannot query past dates");
      });

      it("should reject dates from last year", () => {
        const lastYear = new Date("2024-01-15T00:00:00Z");
        const result = validateCalendarDate(lastYear);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("Cannot query past dates");
      });
    });

    describe("Too far in future", () => {
      it("should reject dates more than 1 year ahead", () => {
        const tooFar = new Date("2026-01-16T00:00:00Z"); // 1 year + 1 day
        const result = validateCalendarDate(tooFar);

        expect(result.valid).toBe(false);
        expect(result.error).toBe("Cannot query more than 1 year in the future.");
      });

      it("should reject dates 2 years ahead", () => {
        const twoYearsAhead = new Date("2027-01-15T00:00:00Z");
        const result = validateCalendarDate(twoYearsAhead);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("more than 1 year in the future");
      });

      it("should reject dates far in the future", () => {
        const farFuture = new Date("2030-01-15T00:00:00Z");
        const result = validateCalendarDate(farFuture);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("more than 1 year in the future");
      });
    });

    describe("Timezone edge cases", () => {
      it("should handle UTC midnight correctly", () => {
        const midnightUTC = new Date("2025-01-15T00:00:00Z");
        const result = validateCalendarDate(midnightUTC);

        expect(result.valid).toBe(true);
      });

      it("should handle Philippine midnight correctly", () => {
        // Midnight in Philippine Time = 4:00 PM UTC previous day
        const midnightPH = new Date("2025-01-14T16:00:00Z");
        const result = validateCalendarDate(midnightPH);

        // This should be valid because it's today in Philippine Time
        expect(result.valid).toBe(true);
      });
    });

    describe("Return type structure", () => {
      it("should return object with valid and error properties", () => {
        const result = validateCalendarDate(new Date());

        expect(result).toHaveProperty("valid");
        expect(typeof result.valid).toBe("boolean");
      });

      it("should have error property when invalid", () => {
        const pastDate = new Date("2024-01-01T00:00:00Z");
        const result = validateCalendarDate(pastDate);

        expect(result).toHaveProperty("error");
        expect(typeof result.error).toBe("string");
        expect(result.error!.length).toBeGreaterThan(0);
      });

      it("should not have error property when valid", () => {
        const futureDate = new Date("2025-06-01T00:00:00Z");
        const result = validateCalendarDate(futureDate);

        expect(result.error).toBeUndefined();
      });
    });
  });

  describe("validateMonth", () => {
    describe("Valid months", () => {
      it("should accept current month", () => {
        const currentMonth = new Date("2025-01-15T00:00:00Z"); // Any day in January 2025
        const result = validateMonth(currentMonth);

        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it("should accept next month", () => {
        const nextMonth = new Date("2025-02-01T00:00:00Z");
        const result = validateMonth(nextMonth);

        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it("should accept months in the future within 1 year", () => {
        const futureMonth = new Date("2025-06-15T00:00:00Z");
        const result = validateMonth(futureMonth);

        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it("should accept month exactly 1 year ahead", () => {
        const oneYearAhead = new Date("2026-01-01T00:00:00Z");
        const result = validateMonth(oneYearAhead);

        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it("should accept current month even if some days have passed", () => {
        // Today is Jan 15, but we're checking Jan 1 (month start)
        const monthStart = new Date("2025-01-01T00:00:00Z");
        const result = validateMonth(monthStart);

        // Current month is always valid, even if past its start
        expect(result.valid).toBe(true);
      });
    });

    describe("Past months", () => {
      it("should reject previous month", () => {
        const previousMonth = new Date("2024-12-15T00:00:00Z");
        const result = validateMonth(previousMonth);

        expect(result.valid).toBe(false);
        expect(result.error).toBe(
          "Cannot query past months. Please select the current month or a future month."
        );
      });

      it("should reject months from last year", () => {
        const lastYear = new Date("2024-06-15T00:00:00Z");
        const result = validateMonth(lastYear);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("Cannot query past months");
      });

      it("should reject month from 2 years ago", () => {
        const twoYearsAgo = new Date("2023-01-15T00:00:00Z");
        const result = validateMonth(twoYearsAgo);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("Cannot query past months");
      });
    });

    describe("Too far in future", () => {
      it("should reject months more than 1 year ahead", () => {
        const tooFar = new Date("2026-02-01T00:00:00Z"); // 1 year + 1 month
        const result = validateMonth(tooFar);

        expect(result.valid).toBe(false);
        expect(result.error).toBe("Cannot query more than 1 year in the future.");
      });

      it("should reject months 2 years ahead", () => {
        const twoYearsAhead = new Date("2027-01-15T00:00:00Z");
        const result = validateMonth(twoYearsAhead);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("more than 1 year in the future");
      });
    });

    describe("Month boundary logic", () => {
      it("should validate based on month start, not specific day", () => {
        // Even if we check Jan 31, it's still January (current month)
        const endOfMonth = new Date("2025-01-31T00:00:00Z");
        const result = validateMonth(endOfMonth);

        expect(result.valid).toBe(true);
      });

      it("should compare year and month only, not day", () => {
        // Jan 1 should be same as Jan 31 for month validation
        const monthStart = new Date("2025-01-01T00:00:00Z");
        const monthEnd = new Date("2025-01-31T00:00:00Z");

        const result1 = validateMonth(monthStart);
        const result2 = validateMonth(monthEnd);

        expect(result1.valid).toBe(result2.valid);
      });

      it("should handle month transitions correctly", () => {
        // Last day of December 2024 (previous month) should be invalid
        const lastDayPrevMonth = new Date("2024-12-31T00:00:00Z");
        const result1 = validateMonth(lastDayPrevMonth);

        // First day of January 2025 (current month) should be valid
        const firstDayCurrMonth = new Date("2025-01-01T00:00:00Z");
        const result2 = validateMonth(firstDayCurrMonth);

        expect(result1.valid).toBe(false);
        expect(result2.valid).toBe(true);
      });
    });

    describe("Timezone normalization", () => {
      it("should normalize to Philippine Time before validation", () => {
        // Date that's Dec 31 in UTC but Jan 1 in Philippine Time (UTC+8)
        const newYearEveUTC = new Date("2024-12-31T18:00:00Z"); // 2:00 AM Jan 1 in PH

        const result = validateMonth(newYearEveUTC);

        // Should be valid because it's January (current month) in Philippine Time
        expect(result.valid).toBe(true);
      });

      it("should handle month end edge cases in Philippine Time", () => {
        // Jan 31 8:00 PM UTC = Feb 1 4:00 AM in Philippine Time
        const monthEndUTC = new Date("2025-01-31T20:00:00Z");

        const result = validateMonth(monthEndUTC);

        // Should validate as February in Philippine Time
        expect(result.valid).toBe(true);
      });
    });

    describe("Leap year months", () => {
      it("should validate February in leap year correctly", () => {
        vi.setSystemTime(new Date("2024-02-15T12:00:00Z"));

        const febLeapYear = new Date("2024-02-29T00:00:00Z");
        const result = validateMonth(febLeapYear);

        expect(result.valid).toBe(true);
      });

      it("should validate February in non-leap year correctly", () => {
        vi.setSystemTime(new Date("2025-02-15T12:00:00Z"));

        const febNonLeapYear = new Date("2025-02-28T00:00:00Z");
        const result = validateMonth(febNonLeapYear);

        expect(result.valid).toBe(true);
      });
    });

    describe("Return type structure", () => {
      it("should return DateValidationResult type", () => {
        const result: DateValidationResult = validateMonth(new Date());

        expect(result).toHaveProperty("valid");
        expect(typeof result.valid).toBe("boolean");
      });

      it("should include descriptive error message when invalid", () => {
        const pastMonth = new Date("2024-12-01T00:00:00Z");
        const result = validateMonth(pastMonth);

        expect(result.error).toBeTruthy();
        expect(result.error!.length).toBeGreaterThan(20); // Descriptive message
      });
    });
  });
});
