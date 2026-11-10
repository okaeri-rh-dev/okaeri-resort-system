/**
 * @vitest-environment jsdom
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { toStayInstants, type BookingsSearch } from "@/lib/bookings";
import { stubPaneWidth } from "@/test/pane-width";
import type { Booking } from "@/types";

import { BookingsTable } from "..";

const router = vi.hoisted(() => ({
  search: {} as BookingsSearch,
  navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", async () => ({
  Link: (await import("@/test/router-link-stub")).RouterLinkStub,
  useNavigate: () => router.navigate,
  useSearch: () => router.search,
}));

vi.mock("@/hooks/useBookings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/useBookings")>()),
  ...(await import("@/test/booking-store-stub")).bookingStoreHookStubs([
    {
      booking_id: "booking-1",
      booking_reference: "OKR-1",
      guest_name: "Maria Santos",
      booking_status: "Confirmed",
      booking_source: "Airbnb",
      ...toStayInstants("2026-10-01", "2026-10-03"),
    } as Booking,
  ]),
}));

vi.mock("@/hooks/useUnits", () => ({
  useAllUnits: () => ({
    data: [
      { unit_id: "unit-1", unit_code: "C1", unit_name: "Cabin 1" },
      { unit_id: "unit-2", unit_code: "C2", unit_name: "Cabin 2" },
    ],
  }),
}));

const lastSearch = () => {
  const [{ search }] = router.navigate.mock.lastCall!;
  return search(router.search);
};

describe("BookingsTable filters", () => {
  beforeEach(() => {
    stubPaneWidth(1024);
    router.search = {};
    router.navigate.mockClear();
  });

  it("adds a picked source in the Filters sheet and keeps the view and search", async () => {
    router.search = { view: "upcoming", q: "Santos", source: ["walk-in"] };
    render(<BookingsTable />);

    await userEvent.click(screen.getByRole("button", { name: "Filters, 1 active" }));
    const sheet = screen.getByRole("dialog", { name: "Filters" });
    await userEvent.click(within(sheet).getByRole("checkbox", { name: "Airbnb" }));
    await userEvent.click(within(sheet).getByRole("checkbox", { name: "C2" }));

    expect(lastSearch()).toEqual({
      view: "upcoming",
      q: "Santos",
      source: ["walk-in"],
      cabin: ["unit-2"],
    });
    expect(router.navigate.mock.calls.at(-2)![0].search(router.search)).toEqual({
      view: "upcoming",
      q: "Santos",
      source: ["walk-in", "airbnb"],
    });
  });

  it("counts each active filter and shows each value as a removable chip", async () => {
    router.search = {
      source: ["airbnb", "walk-in"],
      payment: ["partial"],
      cabin: ["unit-1"],
      from: "2026-10-01",
      to: "2026-10-05",
    };
    render(<BookingsTable />);

    expect(screen.getByRole("button", { name: "Filters, 4 active" })).toBeInTheDocument();
    for (const chip of ["Airbnb", "Walk-in", "Partial", "C1", "1 Oct – 5 Oct 2026"]) {
      expect(screen.getByRole("button", { name: `Remove filter ${chip}` })).toBeInTheDocument();
    }

    await userEvent.click(screen.getByRole("button", { name: "Remove filter Walk-in" }));
    expect(lastSearch()).toMatchObject({ source: ["airbnb"], payment: ["partial"] });

    await userEvent.click(screen.getByRole("button", { name: "Remove filter 1 Oct – 5 Oct 2026" }));
    expect(lastSearch()).toMatchObject({ from: undefined, to: undefined, cabin: ["unit-1"] });
  });
});
