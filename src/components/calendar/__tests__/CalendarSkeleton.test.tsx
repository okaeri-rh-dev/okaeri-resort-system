import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CalendarSkeleton } from "../CalendarSkeleton";

describe("CalendarSkeleton", () => {
  it("stands in for every week of this month, not a spinner", () => {
    // March 2025 starts on a Saturday, so the grid needs six weeks
    vi.setSystemTime(new Date("2025-03-10T04:00:00Z"));
    const { container } = render(<CalendarSkeleton />);

    const status = screen.getByRole("status", { name: "Loading availability calendar" });
    expect(status.querySelectorAll("[data-slot='day']")).toHaveLength(42);
    expect(container.querySelector(".animate-spin")).not.toBeInTheDocument();
  });
});
