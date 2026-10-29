import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardCalendar } from "../DashboardCalendar";

const blocks = vi.hoisted(() => [
  {
    blackout_id: "b1",
    unit_id: "unit-1",
    start_date: "2026-11-02",
    end_date: "2026-11-03",
    reason: "Aircon cleaning",
  },
  {
    blackout_id: "b3",
    unit_id: "unit-2",
    start_date: "2026-11-10",
    end_date: "2026-11-10",
    reason: "Painting",
  },
  {
    blackout_id: "b4",
    unit_id: "unit-1",
    start_date: "2026-11-10",
    end_date: "2026-11-10",
    reason: "Painting",
  },
  {
    blackout_id: "b2",
    unit_id: null,
    start_date: "2026-11-20",
    end_date: "2026-11-20",
    reason: "Family event",
  },
]);

vi.mock("@/lib/supabase", () => ({
  db: {
    blackouts: { inDateRange: async () => ({ data: blocks, error: null }) },
    units: {
      all: async () => ({
        data: [
          { unit_id: "unit-1", unit_name: "Cabin 1" },
          { unit_id: "unit-2", unit_name: "Cabin 2" },
        ],
        error: null,
      }),
    },
  },
  handleSupabaseError: (error: unknown) => String(error),
}));

function renderCalendar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <DashboardCalendar bookings={[]} />
    </QueryClientProvider>
  );
}

describe("DashboardCalendar blocked days", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-11-10T10:00:00+08:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a Blocked chip with the cabin name on each blocked night", async () => {
    renderCalendar();

    for (const day of ["November 2, 2026", "November 3, 2026"]) {
      const dayButton = await screen.findByRole("button", { name: `${day}, blocked: Cabin 1` });
      expect(within(dayButton).getByText("Blocked")).toBeVisible();
      expect(within(dayButton).getByText("Cabin 1")).toBeVisible();
    }
    const dayAfter = screen.getByRole("button", { name: "November 4, 2026" });
    expect(within(dayAfter).queryByText("Blocked")).not.toBeInTheDocument();
  });

  it("shows Whole resort on a resort closure night", async () => {
    renderCalendar();

    const dayButton = await screen.findByRole("button", {
      name: "November 20, 2026, blocked: Whole resort",
    });
    expect(within(dayButton).getByText("Whole resort")).toBeVisible();
  });

  it("names every blocked cabin, and counts them for a narrow cell", async () => {
    renderCalendar();

    const dayButton = await screen.findByRole("button", {
      name: "November 10, 2026, blocked: Cabin 1, Cabin 2",
    });
    expect(within(dayButton).getByText("Blocked")).toBeInTheDocument();
    expect(within(dayButton).getByText("Cabin 1, Cabin 2")).toBeInTheDocument();
    expect(within(dayButton).getByText("2 cabins")).toBeInTheDocument();
  });

  it("does not open the block form from the chip", async () => {
    const user = userEvent.setup();
    renderCalendar();

    const dayButton = await screen.findByRole("button", { name: /November 2, 2026, blocked/ });
    await user.click(within(dayButton).getByText("Blocked"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
