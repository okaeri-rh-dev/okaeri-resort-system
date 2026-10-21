import { expect, test, type Page } from "@playwright/test";

import { TEST_GUEST } from "./fixtures/test-data";
import { BookingFormPage } from "./pages/BookingFormPage";

/**
 * After a guest submits a booking, the confirmation page shows it from the submit
 * response kept in the tab (issue 92). The submit API is stubbed, so this needs only
 * the dev server and wrangler (for rates and pricing).
 */

const REFERENCE = "BK-202612-E2EC0N";

async function stubSubmit(page: Page) {
  await page.route("**/api/guest-booking/multi-unit", (route) =>
    route.fulfill({
      status: 201,
      json: {
        success: true,
        booking: {
          booking_id: "00000000-0000-0000-0000-000000000092",
          booking_reference: REFERENCE,
          total_amount: 7000,
          downpayment_amount: 3500,
        },
        unit_requests: [{ guests_per_unit: 2 }],
        pricing_breakdown: {
          base_total: 7000,
          weekend_surcharge: 0,
          extra_person_fees: 0,
          subtotal: 7000,
          discount_amount: 0,
          total: 7000,
          nights: 1,
        },
        message: "Booking created.",
        is_duplicate: false,
      },
    })
  );
}

function recordBookingLookups(page: Page) {
  const lookups: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "GET" && request.url().includes(`/api/guest-booking/${REFERENCE}`)) {
      lookups.push(request.url());
    }
  });
  return lookups;
}

test.describe("Guest booking confirmation", () => {
  test("shows the submitted booking without a booking lookup, also after a reload", async ({
    page,
  }) => {
    await stubSubmit(page);
    const lookups = recordBookingLookups(page);

    const form = new BookingFormPage(page);
    await form.goto();
    await form.goToNextStep();
    await form.goToNextStep();
    await form.fillContactInfo(TEST_GUEST);
    await form.goToNextStep();
    await form.expectStep4Visible();
    await form.goToNextStep();
    await form.acceptTerms();
    await form.submitBooking();

    await expect(page).toHaveURL(`/booking/confirmation/${REFERENCE}`);
    await expect(page.getByRole("heading", { name: "Booking Confirmed!" })).toBeVisible();
    await expect(page.getByText("Booking Summary")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Booking Confirmed!" })).toBeVisible();

    expect(lookups).toEqual([]);
  });

  test("a new session links to the status lookup with the reference filled in", async ({
    page,
  }) => {
    await page.goto(`/booking/confirmation/${REFERENCE}`);

    await expect(page.getByText(REFERENCE)).toBeVisible();
    await expect(page.getByText(/booking not found/i)).toHaveCount(0);

    await page.getByRole("link", { name: "Check booking status" }).click();

    await expect(page).toHaveURL(`/booking/check-status?reference=${REFERENCE}`);
    await expect(page.getByLabel("Booking Reference")).toHaveValue(REFERENCE);
    await expect(page.getByLabel("Email Address")).toHaveValue("");
  });
});
