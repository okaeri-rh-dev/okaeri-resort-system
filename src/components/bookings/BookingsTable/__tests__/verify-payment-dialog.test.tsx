import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Booking } from "@/types";

import { VerifyPaymentDialog } from "../components/VerifyPaymentDialog";

const { verifyMock, freeUnitIds } = vi.hoisted(() => ({
  verifyMock: vi.fn(),
  freeUnitIds: { current: [] as string[] },
}));

const UNITS = [
  { unit_id: "u1", unit_code: "C1", unit_name: "Cabin 1" },
  { unit_id: "u2", unit_code: "C2", unit_name: "Cabin 2" },
  { unit_id: "u3", unit_code: "C3", unit_name: "Cabin 3" },
];

vi.mock("@/lib/supabase", () => ({
  handleSupabaseError: (error: { message: string }) => error.message,
  db: {
    units: { all: () => ({ order: () => Promise.resolve({ data: UNITS, error: null }) }) },
    bookings: {
      verifyAndConfirm: verifyMock,
      checkMultiUnitAvailability: () =>
        Promise.resolve({
          data: UNITS.map((unit) => ({
            unit_id: unit.unit_id,
            is_available: freeUnitIds.current.includes(unit.unit_id),
          })),
          error: null,
        }),
    },
  },
}));

const booking = {
  booking_id: "b1",
  booking_reference: "OB-001",
  guest_name: "Mara Cruz",
  check_in: "2027-04-10T06:00:00.000Z",
  check_out: "2027-04-12T04:00:00.000Z",
  booking_status: "Pending",
  booking_source: "Website",
  payment_status: "Pending",
  payment_proof_url: null,
  requested_unit_count: 1,
} as Booking;

const renderDialog = (overrides: Partial<Booking> = {}) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <VerifyPaymentDialog booking={{ ...booking, ...overrides }} open onOpenChange={vi.fn()} />
    </QueryClientProvider>
  );

describe("VerifyPaymentDialog", () => {
  beforeEach(() => {
    verifyMock.mockResolvedValue({ error: null });
  });

  it("verifies and confirms with exactly the requested cabins", async () => {
    freeUnitIds.current = ["u1", "u2"];
    const user = userEvent.setup();
    renderDialog();

    const submit = screen.getByRole("button", { name: "Verify and confirm" });
    expect(submit).toBeDisabled();
    await user.click(await screen.findByRole("checkbox", { name: "C2" }));

    expect(screen.getByRole("checkbox", { name: "C1" })).toBeDisabled();
    await user.click(submit);
    expect(verifyMock).toHaveBeenCalledWith("b1", ["u2"]);
  });

  it("keeps the button disabled when fewer cabins are free than requested", async () => {
    freeUnitIds.current = ["u3"];
    const user = userEvent.setup();
    renderDialog({ requested_unit_count: 2 });

    expect(await screen.findByText(/Only 1 cabin free on these nights/)).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "C3" }));
    expect(screen.getByRole("button", { name: "Verify and confirm" })).toBeDisabled();
  });

  it("skips the proof and says Confirm when a payment is already recorded", async () => {
    freeUnitIds.current = ["u1"];
    renderDialog({ payment_status: "Partial" });

    expect(screen.queryByRole("heading", { name: "Payment proof" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Verify and confirm" })).not.toBeInTheDocument();
  });
});
