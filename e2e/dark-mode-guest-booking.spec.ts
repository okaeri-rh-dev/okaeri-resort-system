import { expect, test, type Page } from "@playwright/test";

import { COMPACT, EXPANDED, expectReadable, useDarkTheme } from "./fixtures/contrast";
import { TEST_GUEST } from "./fixtures/test-data";
import { BookingFormPage } from "./pages/BookingFormPage";

/**
 * The guest booking flow reads in dark mode: every step of the booking form, the
 * confirmation page and the status lookup. The confirmation snapshot is seeded and the
 * status API is stubbed, so these tests need only the dev server and wrangler (for rates and pricing).
 */

const CONFIRMATION_REF = "OKR-E2E-DARK";

/** Seeds the snapshot the booking form saves on submit; the page makes no booking request. */
async function seedConfirmation(page: Page) {
  await page.addInitScript((reference) => {
    sessionStorage.setItem(
      "bookingConfirmation",
      JSON.stringify({
        booking_reference: reference,
        check_in: "2026-12-04T06:00:00.000Z",
        check_out: "2026-12-06T04:00:00.000Z",
        unit_requests: [{ guests_per_unit: 2 }, { guests_per_unit: 4 }],
        special_requests: "Late arrival, around 9 PM",
        downpayment_amount: 6500,
        discount_applied: { percent: 10, amount: 1300, rule_name: "Early bird" },
        pricing_breakdown: {
          base_total: 12000,
          weekend_surcharge: 1300,
          extra_person_fees: 1000,
          subtotal: 14300,
          discount_amount: 1300,
          total: 13000,
          nights: 2,
        },
        payment_proof_attached: false,
      })
    );
  }, CONFIRMATION_REF);
}

async function stubStatusLookup(page: Page) {
  await page.route("**/api/guest-booking/status", (route) =>
    route.fulfill({
      json: {
        booking_id: "00000000-0000-0000-0000-00000000da7c",
        booking_reference: CONFIRMATION_REF,
        booking_status: "Pending",
        payment_status: "Pending",
        check_in: "2026-12-04",
        check_out: "2026-12-06",
        total_amount: 13000,
        unit: { unit_name: "To be assigned", unit_type: "Cabin" },
      },
    })
  );
}

test.describe("Dark mode guest booking form", () => {
  test.beforeEach(async ({ page }) => {
    await useDarkTheme(page);
  });

  for (const size of [COMPACT, EXPANDED]) {
    test(`every booking step reads in dark at ${size.width}`, async ({ page }) => {
      await page.setViewportSize(size);
      const form = new BookingFormPage(page);
      await form.goto();

      await expect(page.getByRole("heading", { name: "Select Your Stay Dates" })).toBeVisible();
      await expectReadable(page);

      await form.goToNextStep();
      await expect(page.getByText("Current Rates (Reference Only)")).toBeVisible();
      await page.getByLabel("Number of Guests").fill("4");
      await expect(page.getByText(/extra person fee/i)).toBeVisible();
      await expectReadable(page);

      await form.goToNextStep();
      await expect(page.getByRole("heading", { name: "Your Information" })).toBeVisible();
      await form.goToNextStep();
      await expect(page.getByText(/at least 2 characters|required/i).first()).toBeVisible();
      await expectReadable(page);

      await form.fillContactInfo(TEST_GUEST);
      await form.goToNextStep();
      await form.expectStep4Visible();
      await expect(page.getByText(/payment proof is optional for testing/i)).toBeVisible();
      await expectReadable(page);

      await form.goToNextStep();
      await expect(page.getByRole("heading", { name: "Review Your Booking" })).toBeVisible();
      await expect(page.getByText(/downpayment required/i)).toBeVisible();
      await expectReadable(page);
    });
  }
});

test.describe("Dark mode booking confirmation", () => {
  test.beforeEach(async ({ page }) => {
    await useDarkTheme(page);
    await seedConfirmation(page);
  });

  for (const size of [COMPACT, EXPANDED]) {
    test(`confirmation page reads in dark at ${size.width}`, async ({ page }) => {
      const lookups: string[] = [];
      page.on("request", (request) => {
        if (request.url().includes(`/api/guest-booking/${CONFIRMATION_REF}`)) {
          lookups.push(request.url());
        }
      });
      await page.setViewportSize(size);
      await page.goto(`/booking/confirmation/${CONFIRMATION_REF}`);

      await expect(page.getByRole("heading", { name: "Booking Confirmed!" })).toBeVisible();
      await expect(page.getByText("Payment Instructions")).toBeVisible();
      await expect(page.getByText("Early bird")).toBeVisible();
      await expectReadable(page);
      expect(lookups).toEqual([]);
    });
  }
});

test.describe("Dark mode booking status lookup", () => {
  test("found booking reads in dark on a phone", async ({ page }) => {
    await useDarkTheme(page);
    await stubStatusLookup(page);
    await page.setViewportSize(COMPACT);
    await page.goto("/booking/check-status");

    await page.getByLabel("Booking Reference").fill(CONFIRMATION_REF);
    await page.getByLabel("Email Address").fill(TEST_GUEST.email);
    await page.getByRole("button", { name: "Search Booking" }).click();

    await expect(page.getByText("Booking Details")).toBeVisible();
    await expectReadable(page);
  });
});
