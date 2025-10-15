/**
 * Component Tests for CalendarGrid
 *
 * Tests the calendar grid component that renders month view with
 * color-coded availability indicators.
 *
 * Test Coverage:
 * - Rendering: Day headers, calendar days, overflow dates
 * - Color coding: Full/moderate/limited/booked status colors
 * - Interactive features: Date clicks, hover states
 * - Accessibility: ARIA roles, labels
 * - Edge cases: Month boundaries, leap years, past dates
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalendarGrid, type AvailabilityDay } from "../CalendarGrid";

describe("CalendarGrid", () => {
  // Mock availability data
  const mockAvailability: AvailabilityDay[] = [
    { date: "2025-01-01", availableCount: 3, status: "full" },
    { date: "2025-01-02", availableCount: 3, status: "full" },
    { date: "2025-01-15", availableCount: 2, status: "moderate" },
    { date: "2025-01-20", availableCount: 1, status: "limited" },
    { date: "2025-01-25", availableCount: 0, status: "booked" },
  ];

  const currentMonth = new Date(2025, 0, 15); // January 15, 2025

  describe("Rendering", () => {
    it("should render day headers (Sun-Sat)", () => {
      render(<CalendarGrid availability={mockAvailability} currentMonth={currentMonth} />);

      expect(screen.getByText("Sun")).toBeInTheDocument();
      expect(screen.getByText("Mon")).toBeInTheDocument();
      expect(screen.getByText("Tue")).toBeInTheDocument();
      expect(screen.getByText("Wed")).toBeInTheDocument();
      expect(screen.getByText("Thu")).toBeInTheDocument();
      expect(screen.getByText("Fri")).toBeInTheDocument();
      expect(screen.getByText("Sat")).toBeInTheDocument();
    });

    it("should render all days of the month", () => {
      render(<CalendarGrid availability={mockAvailability} currentMonth={currentMonth} />);

      // January 2025 has 31 days
      for (let day = 1; day <= 31; day++) {
        expect(screen.getByText(day.toString())).toBeInTheDocument();
      }
    });

    it("should render overflow dates from previous month", () => {
      render(<CalendarGrid availability={mockAvailability} currentMonth={currentMonth} />);

      // January 1, 2025 is a Wednesday, so we should have Sun-Tue from December
      // December 29, 30, 31 should be visible
      const allDayCells = screen.getAllByRole("gridcell");

      // First few cells should contain December dates
      expect(allDayCells.length).toBeGreaterThan(31); // More than just January days
    });

    it("should render grid with proper structure", () => {
      render(<CalendarGrid availability={mockAvailability} currentMonth={currentMonth} />);

      // Should have gridcell role for accessibility
      const dayCells = screen.getAllByRole("gridcell");
      expect(dayCells.length).toBeGreaterThan(0);
    });
  });

  describe("Color Coding", () => {
    it("should apply green background for full availability", () => {
      render(<CalendarGrid availability={mockAvailability} currentMonth={currentMonth} />);

      const fullAvailabilityCell = screen.getByLabelText(/January 1, 2025.*3 available/i);
      expect(fullAvailabilityCell).toHaveClass("bg-green-500");
    });

    it("should apply yellow background for moderate availability", () => {
      render(<CalendarGrid availability={mockAvailability} currentMonth={currentMonth} />);

      const moderateCell = screen.getByLabelText(/January 15, 2025.*2 available/i);
      expect(moderateCell).toHaveClass("bg-yellow-500");
    });

    it("should apply orange background for limited availability", () => {
      render(<CalendarGrid availability={mockAvailability} currentMonth={currentMonth} />);

      const limitedCell = screen.getByLabelText(/January 20, 2025.*1 available/i);
      expect(limitedCell).toHaveClass("bg-orange-500");
    });

    it("should apply red background for fully booked", () => {
      render(<CalendarGrid availability={mockAvailability} currentMonth={currentMonth} />);

      const bookedCell = screen.getByLabelText(/January 25, 2025.*Fully booked/i);
      expect(bookedCell).toHaveClass("bg-red-500");
    });

    it("should gray out past dates", () => {
      // Mock today as January 20, 2025
      vi.setSystemTime(new Date("2025-01-20T12:00:00Z"));

      render(<CalendarGrid availability={mockAvailability} currentMonth={currentMonth} />);

      // January 1 should be grayed out (past date)
      const pastDateCell = screen.getByLabelText(/January 1, 2025/i);
      expect(pastDateCell).toHaveClass("bg-gray-100");

      vi.useRealTimers();
    });

    it("should show reduced opacity for adjacent month dates", () => {
      render(<CalendarGrid availability={mockAvailability} currentMonth={currentMonth} />);

      // Get all gridcells and check for overflow dates (not current month)
      const allCells = screen.getAllByRole("gridcell");

      // December dates should have reduced opacity classes
      // Check for classes like bg-green-500/30 (30% opacity)
      const hasReducedOpacity = allCells.some(
        (cell) => cell.className.includes("/30") || cell.className.includes("/40")
      );

      expect(hasReducedOpacity).toBe(true);
    });
  });

  describe("Availability Count Display", () => {
    it("should display available count for dates with data", () => {
      render(<CalendarGrid availability={mockAvailability} currentMonth={currentMonth} />);

      // Day 15 should show "2" (2 units available)
      const day15Cell = screen.getByLabelText(/January 15, 2025/i);
      expect(within(day15Cell).getByText("2")).toBeInTheDocument();
    });

    it("should not display count for past dates", () => {
      vi.setSystemTime(new Date("2025-01-20T12:00:00Z"));

      render(<CalendarGrid availability={mockAvailability} currentMonth={currentMonth} />);

      // January 1 (past date) should not show availability count
      const pastCell = screen.getByLabelText(/January 1, 2025/i);
      expect(within(pastCell).queryByText("3")).not.toBeInTheDocument();

      vi.useRealTimers();
    });

    it("should show 0 for fully booked dates", () => {
      render(<CalendarGrid availability={mockAvailability} currentMonth={currentMonth} />);

      const bookedCell = screen.getByLabelText(/January 25, 2025/i);
      expect(within(bookedCell).getByText("0")).toBeInTheDocument();
    });
  });

  describe("Today Indicator", () => {
    it("should highlight today's date with blue ring", () => {
      vi.setSystemTime(new Date("2025-01-15T12:00:00Z"));

      render(<CalendarGrid availability={mockAvailability} currentMonth={currentMonth} />);

      const todayCell = screen.getByLabelText(/January 15, 2025/i);
      expect(todayCell).toHaveClass("ring-2", "ring-blue-600");

      vi.useRealTimers();
    });

    it("should show blue dot indicator for today", () => {
      vi.setSystemTime(new Date("2025-01-15T12:00:00Z"));

      render(<CalendarGrid availability={mockAvailability} currentMonth={currentMonth} />);

      const todayCell = screen.getByLabelText(/January 15, 2025/i);
      const indicator = within(todayCell).getByLabelText("Today");
      expect(indicator).toBeInTheDocument();

      vi.useRealTimers();
    });
  });

  describe("Interactive Features", () => {
    it("should call onDateClick when adjacent month date is clicked", async () => {
      const user = userEvent.setup();
      const onDateClick = vi.fn();

      render(
        <CalendarGrid
          availability={mockAvailability}
          currentMonth={currentMonth}
          onDateClick={onDateClick}
        />
      );

      // Find a December date (previous month overflow)
      const allCells = screen.getAllByRole("gridcell");
      const decemberCell = allCells[0]; // First cell should be from December

      await user.click(decemberCell);

      // Should have called onDateClick with the clicked date
      expect(onDateClick).toHaveBeenCalledTimes(1);
      expect(onDateClick).toHaveBeenCalledWith(expect.any(Date));
    });

    it("should not call onDateClick for current month dates", async () => {
      const user = userEvent.setup();
      const onDateClick = vi.fn();

      render(
        <CalendarGrid
          availability={mockAvailability}
          currentMonth={currentMonth}
          onDateClick={onDateClick}
        />
      );

      const currentMonthCell = screen.getByLabelText(/January 15, 2025/i);
      await user.click(currentMonthCell);

      // Should not call onDateClick for current month
      expect(onDateClick).not.toHaveBeenCalled();
    });

    it("should not call onDateClick for past dates", async () => {
      const user = userEvent.setup();
      const onDateClick = vi.fn();

      vi.setSystemTime(new Date("2025-01-20T12:00:00Z"));

      render(
        <CalendarGrid
          availability={mockAvailability}
          currentMonth={currentMonth}
          onDateClick={onDateClick}
        />
      );

      const pastCell = screen.getByLabelText(/January 1, 2025/i);
      await user.click(pastCell);

      // Should not navigate to past dates
      expect(onDateClick).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it("should show hover effects on future dates", () => {
      render(<CalendarGrid availability={mockAvailability} currentMonth={currentMonth} />);

      const futureCell = screen.getByLabelText(/January 15, 2025/i);
      expect(futureCell).toHaveClass("hover:shadow-md");
    });

    it("should show cursor-not-allowed for past dates", () => {
      vi.setSystemTime(new Date("2025-01-20T12:00:00Z"));

      render(<CalendarGrid availability={mockAvailability} currentMonth={currentMonth} />);

      const pastCell = screen.getByLabelText(/January 1, 2025/i);
      expect(pastCell).toHaveClass("cursor-not-allowed");

      vi.useRealTimers();
    });
  });

  describe("Accessibility", () => {
    it("should have gridcell role for each day", () => {
      render(<CalendarGrid availability={mockAvailability} currentMonth={currentMonth} />);

      const dayCells = screen.getAllByRole("gridcell");
      expect(dayCells.length).toBeGreaterThan(31); // At least all days of month
    });

    it("should have descriptive aria-labels for each day", () => {
      render(<CalendarGrid availability={mockAvailability} currentMonth={currentMonth} />);

      // Check for descriptive labels
      expect(screen.getByLabelText(/January 1, 2025.*3 available/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/January 15, 2025.*2 available/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/January 25, 2025.*Fully booked/i)).toBeInTheDocument();
    });

    it("should have title attributes for hover tooltips", () => {
      render(<CalendarGrid availability={mockAvailability} currentMonth={currentMonth} />);

      const cell = screen.getByLabelText(/January 15, 2025/i);
      expect(cell).toHaveAttribute("title", "2 available");
    });

    it("should indicate today with aria-label", () => {
      vi.setSystemTime(new Date("2025-01-15T12:00:00Z"));

      render(<CalendarGrid availability={mockAvailability} currentMonth={currentMonth} />);

      const todayIndicator = screen.getByLabelText("Today");
      expect(todayIndicator).toBeInTheDocument();

      vi.useRealTimers();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty availability array", () => {
      render(<CalendarGrid availability={[]} currentMonth={currentMonth} />);

      // Should still render all days, just without availability data
      expect(screen.getByText("15")).toBeInTheDocument();
    });

    it("should handle month with 31 days", () => {
      const januaryMonth = new Date(2025, 0, 1);
      render(<CalendarGrid availability={mockAvailability} currentMonth={januaryMonth} />);

      expect(screen.getByText("31")).toBeInTheDocument();
    });

    it("should handle month with 30 days", () => {
      const aprilMonth = new Date(2025, 3, 1); // April
      render(<CalendarGrid availability={[]} currentMonth={aprilMonth} />);

      expect(screen.getByText("30")).toBeInTheDocument();
      expect(screen.queryByText("31")).not.toBeInTheDocument();
    });

    it("should handle February in leap year", () => {
      const febLeapYear = new Date(2024, 1, 1); // February 2024
      render(<CalendarGrid availability={[]} currentMonth={febLeapYear} />);

      expect(screen.getByText("29")).toBeInTheDocument(); // Leap year has 29 days
    });

    it("should handle February in non-leap year", () => {
      const febNonLeap = new Date(2025, 1, 1); // February 2025
      render(<CalendarGrid availability={[]} currentMonth={febNonLeap} />);

      expect(screen.getByText("28")).toBeInTheDocument();
      expect(screen.queryByText("29")).not.toBeInTheDocument(); // No Feb 29 in non-leap year
    });

    it("should handle month starting on Sunday", () => {
      const sundayStart = new Date(2025, 5, 1); // June 2025 starts on Sunday
      render(<CalendarGrid availability={[]} currentMonth={sundayStart} />);

      // First day should be June 1
      const firstCell = screen.getAllByRole("gridcell")[7]; // After day headers
      expect(within(firstCell).getByText("1")).toBeInTheDocument();
    });

    it("should handle month starting on Saturday", () => {
      const saturdayStart = new Date(2025, 2, 1); // March 2025 starts on Saturday
      render(<CalendarGrid availability={[]} currentMonth={saturdayStart} />);

      // Should have 6 overflow days from previous month
      const allCells = screen.getAllByRole("gridcell");
      expect(allCells.length).toBeGreaterThanOrEqual(37); // 6 overflow + 31 days of March
    });
  });

  describe("Memoization", () => {
    it("should memoize availability map for performance", () => {
      const { rerender } = render(
        <CalendarGrid availability={mockAvailability} currentMonth={currentMonth} />
      );

      // Re-render with same availability data
      rerender(<CalendarGrid availability={mockAvailability} currentMonth={currentMonth} />);

      // Component should still work correctly
      expect(screen.getByLabelText(/January 15, 2025/i)).toBeInTheDocument();
    });

    it("should memoize calendar days generation", () => {
      const { rerender } = render(
        <CalendarGrid availability={mockAvailability} currentMonth={currentMonth} />
      );

      // Re-render with same month
      rerender(<CalendarGrid availability={mockAvailability} currentMonth={currentMonth} />);

      // Should still show all 31 days
      for (let day = 1; day <= 31; day++) {
        expect(screen.getByText(day.toString())).toBeInTheDocument();
      }
    });
  });
});
