import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { generateGuestBookingReference } from "../src/lib/bookings/reference";
import { TEST_GUEST } from "./fixtures/test-data";
import { BookingFormPage } from "./pages/BookingFormPage";

/**
 * After a guest submits a booking, the confirmation page shows it from the submit
 * response kept in the tab. The submit API is stubbed. In a new session the page links to
 * the status lookup, which runs against a booking seeded through create_guest_booking.
 */

const REFERENCE = "BK-202612-E2EC0N";
const LOOKUP_REFERENCE = generateGuestBookingReference();
const LOOKUP_EMAIL = "e2e-status-lookup-test@example.com";

function serviceClient() {
  // Local-only, like the other specs that seed through the service role.
  return createClient(
    process.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321",
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ||
      "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

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
  const db = serviceClient();
  let lookupBookingId = "";

  test.beforeAll(async () => {
    const { data, error } = await db.rpc("create_guest_booking", {
      p_turnstile_token: "e2e",
      p_booking_data: {
        booking_reference: LOOKUP_REFERENCE,
        guest_name: "E2E Status Guest",
        email: LOOKUP_EMAIL,
        phone_number: "+639171234567",
        check_in: "2099-12-10T06:00:00.000Z",
        check_out: "2099-12-11T04:00:00.000Z",
        total_amount: 7000,
        downpayment_required: 3500,
        pricing_snapshot: { total: 7000, downpayment_required: 3500, unit_breakdown: [] },
      },
      p_unit_requests: [{ guests_per_unit: 2 }],
      p_guest_data: null,
    });
    expect(error).toBeNull();
    lookupBookingId = (data as { booking: { booking_id: string } }).booking.booking_id;
  });

  test.afterAll(async () => {
    if (lookupBookingId) await db.from("bookings").delete().eq("booking_id", lookupBookingId);
  });

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

  test("a new session finds the booking through the status lookup", async ({ page }) => {
    await page.goto(`/booking/confirmation/${LOOKUP_REFERENCE}`);

    await expect(page.getByText(LOOKUP_REFERENCE)).toBeVisible();
    await expect(page.getByText(/booking not found/i)).toHaveCount(0);

    await page.getByRole("link", { name: "Check booking status" }).click();

    await expect(page).toHaveURL(`/booking/check-status?reference=${LOOKUP_REFERENCE}`);
    await expect(page.getByLabel("Booking Reference")).toHaveValue(LOOKUP_REFERENCE);
    await expect(page.getByLabel("Email Address")).toHaveValue("");

    await page.getByLabel("Email Address").fill(LOOKUP_EMAIL);
    await page.getByRole("button", { name: "Search Booking" }).click();

    await expect(page.getByText("Booking Details")).toBeVisible();
    await expect(page.getByText(`Reference: ${LOOKUP_REFERENCE}`)).toBeVisible();
    await expect(page.getByText("Cabins to be assigned")).toBeVisible();
  });
});
