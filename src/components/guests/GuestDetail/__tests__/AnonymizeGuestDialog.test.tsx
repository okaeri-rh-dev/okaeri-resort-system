import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AnonymizeGuestDialog } from "../AnonymizeGuestDialog";

// src/test/setup.ts pins the clock to 2025-09-25
const past = {
  booking_status: "CheckedOut",
  payment_status: "Completed",
  check_out: "2025-01-02T04:00:00Z",
};

async function open(props: Partial<Parameters<typeof AnonymizeGuestDialog>[0]> = {}) {
  const onConfirm = vi.fn();
  render(
    <AnonymizeGuestDialog
      guestName="Ana Cruz"
      bookings={[past]}
      onConfirm={onConfirm}
      isPending={false}
      {...props}
    />
  );
  await userEvent.click(screen.getByRole("button", { name: "Anonymize guest" }));
  return onConfirm;
}

describe("AnonymizeGuestDialog", () => {
  it("enables the action only after the guest name is typed", async () => {
    const onConfirm = await open();
    const confirm = screen.getByRole("button", { name: "Anonymize" });

    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/type the guest's name/i), "Ana Cruz");
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("warns about open balances", async () => {
    await open({ bookings: [{ ...past, payment_status: "Partial" }] });

    expect(screen.getByText(/1 booking has an unpaid balance/i)).toBeInTheDocument();
  });

  it("disables the trigger while a booking is current or upcoming", () => {
    render(
      <AnonymizeGuestDialog
        guestName="Ana Cruz"
        bookings={[{ ...past, booking_status: "Confirmed", check_out: "2025-10-02T04:00:00Z" }]}
        onConfirm={vi.fn()}
        isPending={false}
      />
    );

    expect(screen.getByRole("button", { name: "Anonymize guest" })).toBeDisabled();
    expect(screen.getByText(/cancel or finish the upcoming booking first/i)).toBeInTheDocument();
  });
});
