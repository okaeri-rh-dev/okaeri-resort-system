import { expect, test } from "@playwright/test";
import { addMonths, format, setDate } from "date-fns";

import { E2E_BOOKINGS, E2E_REF, E2E_UNIT_ID } from "../scripts/e2e/fixtures";
import { loginAsOwner } from "./fixtures/auth";
import { COMPACT } from "./fixtures/contrast";
import { expectPaymentRecorded, uploadPaymentProof } from "./fixtures/payment-proof";
import { serviceClient } from "./fixtures/service-client";
import { BookingDetailPage } from "./pages/BookingDetailPage";

// No other spec books Cabin 3, and the 20th three months ahead is clear of the near-term blocks and bookings other specs make
const MONTHS_AHEAD = 3;
const newCheckIn = setDate(addMonths(new Date(), MONTHS_AHEAD), 20);

/** On a phone, the booking page edits the stay and records a payment. Needs the E2E-* fixtures. */
test("a phone edits the stay and records a payment from the booking page", async ({ page }) => {
  const db = serviceClient();
  const { data: booking } = await db
    .from("bookings")
    .select("booking_id")
    .eq("booking_reference", E2E_REF.PHONE_EDIT)
    .single();
  test.skip(!booking, "E2E bookings not seeded — run `npm run seed:e2e`.");
  const bookingId = booking!.booking_id;
  // A CI retry starts from the seeded stay
  const seeded = E2E_BOOKINGS.find((fixture) => fixture.booking_reference === E2E_REF.PHONE_EDIT)!;
  await db.from("payments").delete().eq("booking_id", bookingId);
  await db.from("booking_units").delete().eq("booking_id", bookingId);
  await db
    .from("bookings")
    .update({ check_in: seeded.check_in, check_out: seeded.check_out, num_guests: 2 })
    .eq("booking_id", bookingId);
  await db.from("booking_units").insert({
    booking_id: bookingId,
    unit_id: E2E_UNIT_ID,
    subtotal: seeded.total_amount,
    unit_price: seeded.total_amount,
    assigned_guests: 2,
  });

  await page.setViewportSize(COMPACT);
  await loginAsOwner(page);

  // The retired edit page's old links land on the booking page
  await page.goto(`/admin/bookings/${bookingId}/edit`);
  await expect(page).toHaveURL(new RegExp(`/admin/bookings/${bookingId}$`));
  const detail = new BookingDetailPage(page);

  const sheet = await detail.openStaySheet();
  await detail.pickStayDates(sheet, MONTHS_AHEAD, / 20th, /, / 22nd, /);
  await sheet.getByRole("button", { name: "Remove E2E Test Unit" }).click();
  await sheet.getByRole("button", { name: "Add Cabin 3" }).click();
  await sheet.getByRole("button", { name: "One guest more in Cabin 3" }).click();
  await sheet.getByRole("button", { name: "Save changes" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText("Booking updated")).toBeVisible();
  expect(await detail.getCheckInDate()).toContain(format(newCheckIn, "MMM d"));
  expect(await detail.getAssignedUnits()).toEqual([expect.stringMatching(/Cabin 3.*3 guests/)]);

  const actions = page.getByRole("button", { name: `Actions for ${E2E_REF.PHONE_EDIT}` });
  await expect(actions, "the action bar sticks to the bottom of the screen").toBeInViewport();
  await actions.click();
  await uploadPaymentProof(page);
  await expectPaymentRecorded(db, bookingId);
});
