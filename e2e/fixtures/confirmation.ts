import type { Page } from "@playwright/test";

import {
  CONFIRMATION_SNAPSHOT_KEY,
  type BookingConfirmationSnapshot,
} from "../../src/lib/bookings/confirmation-snapshot";

/** Seeds what the booking form saves on submit, so the confirmation page shows a booking. */
export async function seedConfirmation(
  page: Page,
  snapshot: Pick<BookingConfirmationSnapshot, "booking_reference"> &
    Partial<BookingConfirmationSnapshot>
) {
  const seeded: BookingConfirmationSnapshot = {
    check_in: "2099-08-01T06:00:00.000Z",
    check_out: "2099-08-02T04:00:00.000Z",
    unit_requests: [{ guests_per_unit: 2 }],
    downpayment_amount: 1250,
    pricing_breakdown: {
      base_total: 2500,
      weekend_surcharge: 0,
      extra_person_fees: 0,
      subtotal: 2500,
      discount_amount: 0,
      total: 2500,
      nights: 1,
    },
    payment_proof_attached: false,
    ...snapshot,
  };
  await page.addInitScript(([key, value]) => sessionStorage.setItem(key, value), [
    CONFIRMATION_SNAPSHOT_KEY,
    JSON.stringify(seeded),
  ] as const);
}
