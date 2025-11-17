import React from "react";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { format } from "date-fns";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Import the mocked module to control its behavior
import { useMediaQuery } from "@/hooks/useMediaQuery";

import { ResponsiveDatePicker, ResponsiveDateRangePicker } from "../responsive-date-picker";

// Mock ResizeObserver for floating-ui
beforeAll(() => {
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
});

// Mock the useMediaQuery hook
vi.mock("@/hooks/useMediaQuery", () => ({
  useMediaQuery: vi.fn(),
}));

describe("ResponsiveDatePicker", () => {
  const mockOnChange = vi.fn();
  const testDate = new Date(2024, 11, 25); // December 25, 2024
  const mockedUseMediaQuery = vi.mocked(useMediaQuery);

  beforeEach(() => {
    vi.clearAllMocks();
    // Default to desktop view
    mockedUseMediaQuery.mockReturnValue(false);
  });

  describe("Desktop View (≥768px)", () => {
    beforeEach(() => {
      mockedUseMediaQuery.mockReturnValue(false); // Not mobile
    });

    it("should render popover trigger button on desktop", () => {
      render(<ResponsiveDatePicker placeholder="Select date" />);
      const button = screen.getByRole("button", { name: /select date/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass("h-12", "sm:h-10"); // Responsive height classes
    });

    it("should display selected date in correct format", () => {
      render(<ResponsiveDatePicker value={testDate} onChange={mockOnChange} formatStr="PPP" />);
      const button = screen.getByRole("button");
      expect(button).toHaveTextContent("December 25th, 2024");
    });

    it("should show placeholder when no date is selected", () => {
      render(<ResponsiveDatePicker placeholder="Pick a date" onChange={mockOnChange} />);
      expect(screen.getByText("Pick a date")).toBeInTheDocument();
    });

    it("should open popover when clicked on desktop", async () => {
      const user = userEvent.setup();
      render(<ResponsiveDatePicker onChange={mockOnChange} />);

      const button = screen.getByRole("button");
      await user.click(button);

      // Check for calendar in popover
      await waitFor(() => {
        const calendar = document.querySelector('[data-slot="calendar"]');
        expect(calendar).toBeInTheDocument();
      });
    });

    it("should call onChange when date is selected on desktop", async () => {
      const user = userEvent.setup();
      render(<ResponsiveDatePicker onChange={mockOnChange} />);

      const button = screen.getByRole("button");
      await user.click(button);

      // Wait for calendar to be visible
      await waitFor(() => {
        const calendar = document.querySelector('[data-slot="calendar"]');
        expect(calendar).toBeInTheDocument();
      });

      // Find and click a date button
      const dateButtons = screen.getAllByRole("button");
      // Find a button that has an aria-label with date format
      const dateButton = dateButtons.find((btn) => {
        const label = btn.getAttribute("aria-label");
        return label && /\d{1,2}(st|nd|rd|th),\s+\d{4}/.test(label);
      });

      if (dateButton) {
        await user.click(dateButton);
        expect(mockOnChange).toHaveBeenCalledTimes(1);
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.any(Date),
          expect.anything(),
          expect.anything(),
          expect.anything()
        );
      }
    });

    it("should apply custom button className", () => {
      render(<ResponsiveDatePicker buttonClassName="custom-class" onChange={mockOnChange} />);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("custom-class");
    });

    it("should disable past dates when disabled function provided", async () => {
      const user = userEvent.setup();
      const today = new Date();
      const disablePastDates = (date: Date) => date < today;

      render(<ResponsiveDatePicker onChange={mockOnChange} disabled={disablePastDates} />);

      const button = screen.getByRole("button");
      await user.click(button);

      // Wait for calendar to be visible
      await waitFor(() => {
        const calendar = document.querySelector('[data-slot="calendar"]');
        expect(calendar).toBeInTheDocument();
      });

      // Past dates should be disabled (check for disabled attribute in date buttons)
      const dateButtons = screen.getAllByRole("button");
      const disabledButtons = dateButtons.filter((btn) => {
        const label = btn.getAttribute("aria-label");
        return label && btn.hasAttribute("disabled");
      });

      // There should be at least some disabled buttons for past dates
      expect(disabledButtons.length).toBeGreaterThan(0);
    });
  });

  describe("Mobile View (<768px)", () => {
    beforeEach(() => {
      mockedUseMediaQuery.mockReturnValue(true); // Is mobile
    });

    it("should render sheet trigger button on mobile", () => {
      render(<ResponsiveDatePicker placeholder="Select date" />);
      const button = screen.getByRole("button", { name: /select date/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass("touch-manipulation"); // Touch optimization
    });

    it("should open sheet when clicked on mobile", async () => {
      const user = userEvent.setup();
      render(<ResponsiveDatePicker onChange={mockOnChange} />);

      const button = screen.getByRole("button");
      await user.click(button);

      // Check for sheet header elements
      await waitFor(() => {
        expect(screen.getByText("Select Date")).toBeInTheDocument();
        expect(
          screen.getByText("Choose your preferred date from the calendar below")
        ).toBeInTheDocument();
      });
    });

    it("should display calendar with mobile-calendar class in sheet", async () => {
      const user = userEvent.setup();
      render(<ResponsiveDatePicker onChange={mockOnChange} />);

      const button = screen.getByRole("button");
      await user.click(button);

      await waitFor(() => {
        // Look for the calendar by data-slot attribute instead of role
        const calendar = document.querySelector('[data-slot="calendar"]');
        expect(calendar).toBeInTheDocument();
        expect(calendar).toHaveClass("mobile-calendar");
      });
    });

    it("should auto-close sheet after date selection on mobile", async () => {
      const user = userEvent.setup();
      render(<ResponsiveDatePicker onChange={mockOnChange} />);

      const button = screen.getByRole("button");
      await user.click(button);

      // Wait for sheet to open
      await waitFor(() => {
        expect(screen.getByText("Select Date")).toBeInTheDocument();
      });

      // Find and click a date button - look for buttons with specific aria-label pattern
      const dateButtons = screen.getAllByRole("button");
      // Find a button that has an aria-label with date format (e.g., "Tuesday, November 20th, 2024")
      const dateButton = dateButtons.find((btn) => {
        const label = btn.getAttribute("aria-label");
        return label && /\d{1,2}(st|nd|rd|th),\s+\d{4}/.test(label);
      });

      if (dateButton) {
        await user.click(dateButton);
      }

      // Check that onChange was called
      expect(mockOnChange).toHaveBeenCalledTimes(1);

      // Sheet should close (header text should disappear)
      await waitFor(() => {
        expect(screen.queryByText("Select Date")).not.toBeInTheDocument();
      });
    });

    it("should apply mobile-specific styles", async () => {
      const user = userEvent.setup();
      render(
        <ResponsiveDatePicker onChange={mockOnChange} calendarClassName="custom-calendar-class" />
      );

      const button = screen.getByRole("button");
      await user.click(button);

      await waitFor(() => {
        const calendar = screen.getByRole("application");
        expect(calendar.parentElement).toHaveClass("mobile-calendar", "custom-calendar-class");
      });
    });

    it("should have proper safe area padding on mobile", async () => {
      const user = userEvent.setup();
      render(<ResponsiveDatePicker onChange={mockOnChange} />);

      const button = screen.getByRole("button");
      await user.click(button);

      await waitFor(() => {
        // Find the sheet content element
        const sheetContent = screen.getByText("Select Date").closest('[role="dialog"]');
        expect(sheetContent).toHaveClass("pb-safe");
      });
    });
  });

  describe("Responsive behavior", () => {
    it("should switch from desktop to mobile view when viewport changes", async () => {
      const { rerender } = render(<ResponsiveDatePicker onChange={mockOnChange} />);

      // Start with desktop view
      mockedUseMediaQuery.mockReturnValue(false);
      rerender(<ResponsiveDatePicker onChange={mockOnChange} />);

      const user = userEvent.setup();
      let button = screen.getByRole("button");
      await user.click(button);

      // Should show popover on desktop
      await waitFor(() => {
        const calendar = document.querySelector('[data-slot="calendar"]');
        expect(calendar).toBeInTheDocument();
        expect(screen.queryByText("Select Date")).not.toBeInTheDocument(); // No sheet header
      });

      // Close popover
      await user.keyboard("{Escape}");

      // Switch to mobile view
      mockedUseMediaQuery.mockReturnValue(true);
      rerender(<ResponsiveDatePicker onChange={mockOnChange} />);

      button = screen.getByRole("button");
      await user.click(button);

      // Should show sheet on mobile
      await waitFor(() => {
        expect(screen.getByText("Select Date")).toBeInTheDocument(); // Sheet header present
      });
    });
  });
});

describe("ResponsiveDateRangePicker", () => {
  const mockOnChange = vi.fn();
  const startDate = new Date(2024, 11, 20); // December 20, 2024
  const endDate = new Date(2024, 11, 27); // December 27, 2024
  const mockedUseMediaQuery = vi.mocked(useMediaQuery);

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseMediaQuery.mockReturnValue(false); // Default to desktop
  });

  describe("Desktop View", () => {
    beforeEach(() => {
      mockedUseMediaQuery.mockReturnValue(false);
    });

    it("should render date range in button", () => {
      render(
        <ResponsiveDateRangePicker
          value={{ from: startDate, to: endDate }}
          onChange={mockOnChange}
        />
      );
      const button = screen.getByRole("button");
      expect(button).toHaveTextContent("Dec 20, 2024 - Dec 27, 2024");
    });

    it("should show placeholder when no range selected", () => {
      render(<ResponsiveDateRangePicker placeholder="Select dates" onChange={mockOnChange} />);
      expect(screen.getByText("Select dates")).toBeInTheDocument();
    });

    it("should show only start date when end date not selected", () => {
      render(<ResponsiveDateRangePicker value={{ from: startDate }} onChange={mockOnChange} />);
      const button = screen.getByRole("button");
      expect(button).toHaveTextContent("Dec 20, 2024");
      expect(button).not.toHaveTextContent(" - ");
    });

    it("should show multiple months on desktop", async () => {
      const user = userEvent.setup();
      render(<ResponsiveDateRangePicker onChange={mockOnChange} numberOfMonths={2} />);

      const button = screen.getByRole("button");
      await user.click(button);

      await waitFor(() => {
        const calendar = document.querySelector('[data-slot="calendar"]');
        expect(calendar).toBeInTheDocument();
        // Check for multiple month grids
        const monthGrids = document.querySelectorAll(".rdp-month");
        expect(monthGrids.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe("Mobile View", () => {
    beforeEach(() => {
      mockedUseMediaQuery.mockReturnValue(true);
    });

    it("should render sheet with range picker header on mobile", async () => {
      const user = userEvent.setup();
      render(<ResponsiveDateRangePicker onChange={mockOnChange} />);

      const button = screen.getByRole("button");
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText("Select Date Range")).toBeInTheDocument();
        expect(screen.getByText("Choose your check-in and check-out dates")).toBeInTheDocument();
      });
    });

    it("should show single month on mobile", async () => {
      const user = userEvent.setup();
      render(
        <ResponsiveDateRangePicker
          onChange={mockOnChange}
          numberOfMonths={2} // Should be ignored on mobile
        />
      );

      const button = screen.getByRole("button");
      await user.click(button);

      await waitFor(() => {
        const calendar = screen.getByRole("application");
        const monthGrids = calendar.querySelectorAll(".rdp-month");
        expect(monthGrids.length).toBe(1); // Only one month on mobile
      });
    });

    it("should auto-close after selecting both dates on mobile", async () => {
      const user = userEvent.setup();
      render(<ResponsiveDateRangePicker onChange={mockOnChange} />);

      const button = screen.getByRole("button");
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText("Select Date Range")).toBeInTheDocument();
      });

      // Select start date
      const startButton = screen.getByRole("button", { name: /^15[^0-9]/i });
      await user.click(startButton);

      // Sheet should stay open after first selection
      expect(screen.getByText("Select Date Range")).toBeInTheDocument();

      // Select end date
      const endButton = screen.getByRole("button", { name: /^20[^0-9]/i });
      await user.click(endButton);

      // Sheet should close after both dates selected
      await waitFor(
        () => {
          expect(screen.queryByText("Select Date Range")).not.toBeInTheDocument();
        },
        { timeout: 500 }
      );

      expect(mockOnChange).toHaveBeenCalled();
    });

    it("should truncate long date ranges on mobile", () => {
      const longRangeStart = new Date(2024, 0, 1); // January 1, 2024
      const longRangeEnd = new Date(2024, 11, 31); // December 31, 2024

      render(
        <ResponsiveDateRangePicker
          value={{ from: longRangeStart, to: longRangeEnd }}
          onChange={mockOnChange}
        />
      );

      const button = screen.getByRole("button");
      const span = button.querySelector(".truncate");
      expect(span).toBeInTheDocument();
      expect(span).toHaveClass("truncate");
    });
  });
});
