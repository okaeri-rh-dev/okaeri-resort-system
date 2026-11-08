/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useBookingStore } from "@/stores/useBookingStore";
import { stubPaneWidth } from "@/test/pane-width";

import { BookingsTable } from "..";

vi.mock("@tanstack/react-router", async () => ({
  Link: (await import("@/test/router-link-stub")).RouterLinkStub,
  useNavigate: () => vi.fn(),
}));

vi.mock("@/stores/useBookingStore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/stores/useBookingStore")>()),
  ...(await import("@/test/booking-store-stub")).bookingStoreHookStubs([]),
}));

describe("BookingsTable empty state", () => {
  beforeEach(() => {
    stubPaneWidth(1024);
    useBookingStore.setState({ filters: {}, searchQuery: "" });
  });

  it("shows 'No bookings yet' with no search and no filter", () => {
    render(<BookingsTable />);

    expect(screen.getByText("No bookings yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear Filters" })).not.toBeInTheDocument();
  });

  it("shows 'No bookings found' when a search matches nothing", async () => {
    useBookingStore.setState({ searchQuery: "nonexistent-xyz" });
    render(<BookingsTable />);

    expect(screen.getByText("No bookings found")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Clear Filters" }));
    expect(useBookingStore.getState().searchQuery).toBe("");
  });

  it("shows 'No bookings found' when a filter matches nothing", async () => {
    useBookingStore.setState({ filters: { status: "Cancelled" } });
    render(<BookingsTable />);

    expect(screen.getByText("No bookings found")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Clear Filters" }));
    expect(useBookingStore.getState().filters).toEqual({});
  });
});
