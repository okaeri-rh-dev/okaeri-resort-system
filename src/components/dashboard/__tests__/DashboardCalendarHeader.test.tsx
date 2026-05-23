import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StackedHeader } from "../DashboardCalendar";

describe("StackedHeader", () => {
  const baseProps = {
    currentMonth: new Date(2026, 4, 18), // May 2026
    monthlyBookingCount: 12,
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onToday: vi.fn(),
  };

  it("does not render the 'Booking Calendar' title (reclaimed for vertical space)", () => {
    render(<StackedHeader {...baseProps} />);
    expect(screen.queryByText("Booking Calendar")).not.toBeInTheDocument();
  });

  it("does not render the Today button (reclaimed for vertical space)", () => {
    render(<StackedHeader {...baseProps} />);
    expect(screen.queryByRole("button", { name: /today/i })).not.toBeInTheDocument();
  });

  it("renders the month label as a polite live region", () => {
    render(<StackedHeader {...baseProps} />);
    const monthLabel = screen.getByText("May 2026");
    expect(monthLabel).toHaveAttribute("aria-live", "polite");
  });

  it("renders prev and next month buttons with 44px touch targets", () => {
    render(<StackedHeader {...baseProps} />);
    const prev = screen.getByRole("button", { name: /previous month/i });
    const next = screen.getByRole("button", { name: /next month/i });
    expect(prev.className).toMatch(/h-11/);
    expect(prev.className).toMatch(/w-11/);
    expect(next.className).toMatch(/h-11/);
    expect(next.className).toMatch(/w-11/);
  });

  it("does not render booking count metadata (redundant with visible chips)", () => {
    render(<StackedHeader {...baseProps} />);
    expect(screen.queryByText(/bookings this month/)).not.toBeInTheDocument();
  });
});
