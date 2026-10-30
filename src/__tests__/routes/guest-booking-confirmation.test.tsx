import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { saveConfirmationSnapshot } from "@/lib/bookings/confirmation-snapshot";
import type { StatusResponse } from "@/lib/schema-transform";
import { Route as CheckStatusRoute } from "@/routes/booking/check-status";
import { Route as ConfirmationRoute } from "@/routes/booking/confirmation/$bookingReference";

vi.mock("@/components/pwa/InstallBanner", () => ({ InstallBanner: () => null }));

const REFERENCE = "BK-202610-A7B9C2";

function renderAt(path: string) {
  const rootRoute = createRootRoute();
  const routeTree = rootRoute.addChildren([
    ConfirmationRoute.update({
      id: "/booking/confirmation/$bookingReference",
      path: "/booking/confirmation/$bookingReference",
      getParentRoute: () => rootRoute,
    } as never),
    CheckStatusRoute.update({
      id: "/booking/check-status",
      path: "/booking/check-status",
      getParentRoute: () => rootRoute,
    } as never),
  ]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

function saveBooking(reference: string) {
  saveConfirmationSnapshot(
    {
      success: true,
      booking: {
        booking_id: "00000000-0000-0000-0000-000000000092",
        booking_reference: reference,
        total_amount: 13000,
        downpayment_amount: 6500,
        discount_applied: { percent: 10, amount: 1300, rule_name: "Early bird" },
      },
      unit_requests: [{ guests_per_unit: 2 }, { guests_per_unit: 4 }],
      pricing_breakdown: {
        base_total: 12000,
        weekend_surcharge: 1300,
        extra_person_fees: 1000,
        subtotal: 14300,
        discount_amount: 1300,
        total: 13000,
        nights: 2,
      },
      message: "Booking created.",
      is_duplicate: false,
    },
    { check_in: "2026-12-04", check_out: "2026-12-06", special_requests: "Late arrival" }
  );
}

let fetchSpy: MockInstance<typeof fetch>;

beforeEach(() => {
  sessionStorage.clear();
  fetchSpy = vi.spyOn(globalThis, "fetch");
});

afterEach(() => {
  fetchSpy.mockRestore();
});

function bookingLookups() {
  return fetchSpy.mock.calls.filter(([url]) => String(url).includes("/api/guest-booking/"));
}

describe("booking confirmation page", () => {
  it("shows the booking the guest just submitted, with no booking lookup", async () => {
    saveBooking(REFERENCE);
    renderAt(`/booking/confirmation/${REFERENCE}`);

    expect(await screen.findByRole("heading", { name: "Booking Confirmed!" })).toBeVisible();
    expect(screen.getByText("Early bird", { exact: false })).toBeVisible();
    expect(screen.getByText("Late arrival")).toBeVisible();
    expect(bookingLookups()).toEqual([]);
  });

  it("links to the status lookup when this tab has no saved booking", async () => {
    renderAt(`/booking/confirmation/${REFERENCE}`);

    expect(await screen.findByText(REFERENCE)).toBeVisible();
    expect(screen.queryByText(/booking not found/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /check booking status/i })).toHaveAttribute(
      "href",
      `/booking/check-status?reference=${REFERENCE}`
    );
    expect(bookingLookups()).toEqual([]);
  });

  it("does not show another booking saved in this tab", async () => {
    saveBooking("BK-202610-ZZZZZZ");
    renderAt(`/booking/confirmation/${REFERENCE}`);

    expect(await screen.findByRole("link", { name: /check booking status/i })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Booking Confirmed!" })).not.toBeInTheDocument();
  });

  it("opens the status lookup with the reference filled in and the email empty", async () => {
    renderAt(`/booking/confirmation/${REFERENCE}`);

    await userEvent.click(await screen.findByRole("link", { name: /check booking status/i }));

    expect(await screen.findByLabelText("Booking Reference")).toHaveValue(REFERENCE);
    expect(screen.getByLabelText("Email Address")).toHaveValue("");
  });
});

describe("booking status lookup", () => {
  it("ignores a reference that is not a booking reference", async () => {
    renderAt("/booking/check-status?reference=not-a-reference");

    expect(await screen.findByLabelText("Booking Reference")).toHaveValue("");
  });

  it("works as before with no reference", async () => {
    renderAt("/booking/check-status");

    expect(await screen.findByLabelText("Booking Reference")).toHaveValue("");
    expect(screen.getByLabelText("Email Address")).toHaveValue("");
  });

  it("shows the booking the status API returns", async () => {
    fetchSpy.mockResolvedValue(
      Response.json({
        booking_reference: REFERENCE,
        status: "Pending",
        payment_status: "Pending",
        check_in: "2099-12-10T06:00:00+00:00",
        check_out: "2099-12-11T04:00:00+00:00",
        total_amount: 7000,
        num_guests: 2,
        unit_name: "",
        unit_type: "",
        created_at: "2026-10-21T08:50:01.915793+00:00",
        upload_status: "pending",
        special_requests: null,
        message: "Your booking is pending payment verification. We'll confirm within 24 hours.",
      } satisfies StatusResponse)
    );
    renderAt(`/booking/check-status?reference=${REFERENCE}`);

    await userEvent.type(await screen.findByLabelText("Email Address"), "guest@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Search Booking" }));

    expect(await screen.findByText("Booking Details")).toBeVisible();
    expect(screen.getByText(`Reference: ${REFERENCE}`)).toBeVisible();
    expect(screen.getByText("Cabins to be assigned")).toBeVisible();
    expect(screen.getByText(/₱7,000\.00/)).toBeVisible();
  });
});
