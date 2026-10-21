/**
 * Contact channels: a manager manages them on the Settings tab and guests see the result on the
 * root page notice and the booking confirmation page.
 *
 * The spec changes shared rows, so it snapshots which channels were shown before it ran and
 * restores them afterwards, and it deletes the channel it adds. The confirmation page loads its
 * booking from /api/guest-booking/:ref, which no Pages function serves yet, so that response is
 * stubbed; the contact channels on it come from the real database.
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { loginAsManager, loginAsStaff } from "./fixtures/auth";

const HANDLE = "e2e.okaeri";
const INSTAGRAM_URL = `https://www.instagram.com/${HANDLE}/?igsh=e2e`;
const CHANNEL_LINK = { name: `Instagram: @${HANDLE}` };
const BOOKING_REFERENCE = "E2E-CHANNELS";
const CONFIRMATION_CONTACT_TEXT = "If you have any questions or need to make changes";

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

async function stubConfirmationBooking(page: Page) {
  await page.route(`**/api/guest-booking/${BOOKING_REFERENCE}`, (route) =>
    route.fulfill({
      json: {
        success: true,
        booking: {
          booking_id: "00000000-0000-0000-0000-0000000000c1",
          booking_reference: BOOKING_REFERENCE,
          guest_name: "E2E Test Guest",
          email: "guest@e2e.local",
          phone_number: "+639170000000",
          check_in: "2099-08-01",
          check_out: "2099-08-02",
          unit_requests: [{ guests_per_unit: 2 }],
          total_amount: 2500,
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
          payment_proof_url: null,
          status: "Pending",
          created_at: "2099-07-01T00:00:00Z",
        },
      },
    })
  );
}

/** Opens a guest page and waits for its contact channels to load, so absence checks mean something. */
async function openGuestPage(page: Page, path: string) {
  const channelsLoaded = page.waitForResponse(
    (response) => response.url().includes("/rest/v1/contact_channels") && response.ok()
  );
  await page.goto(path);
  await channelsLoaded;
}

async function openContactChannelsTab(page: Page) {
  await page.goto("/admin/settings");
  await page.getByRole("tab", { name: "Contact Channels" }).click();
  return page.getByRole("table", { name: "Contact channels" });
}

test.describe("Contact channels", () => {
  test.describe.configure({ mode: "serial" });

  const db = serviceClient();
  let shownBefore: string[] = [];

  test.beforeAll(async () => {
    await db.from("contact_channels").delete().eq("value", HANDLE);
    const { data, error } = await db.from("contact_channels").select("id").eq("is_active", true);
    if (error) throw error;
    shownBefore = data.map((row) => row.id);
  });

  test.afterAll(async () => {
    await db.from("contact_channels").delete().eq("value", HANDLE);
    if (shownBefore.length > 0) {
      await db.from("contact_channels").update({ is_active: true }).in("id", shownBefore);
    }
  });

  test("a manager adds a channel and guests see it on the root and confirmation pages", async ({
    page,
  }) => {
    await loginAsManager(page);
    const table = await openContactChannelsTab(page);
    await expect(table).toBeVisible();

    await page.getByRole("button", { name: "Add Channel" }).click();
    const dialog = page.getByRole("dialog", { name: "Add Contact Channel" });
    await dialog.getByRole("combobox", { name: "Kind" }).click();
    await page.getByRole("option", { name: "Instagram" }).click();
    await dialog.getByRole("textbox", { name: "Value" }).fill(INSTAGRAM_URL);
    await dialog.getByRole("button", { name: "Add channel" }).click();

    await expect(page.getByText("Contact channel added")).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(table.getByRole("row").filter({ hasText: `@${HANDLE}` })).toContainText("Shown");

    // The same kind and value again is refused with a plain message.
    await page.getByRole("button", { name: "Add Channel" }).click();
    await dialog.getByRole("combobox", { name: "Kind" }).click();
    await page.getByRole("option", { name: "Instagram" }).click();
    await dialog.getByRole("textbox", { name: "Value" }).fill(`@${HANDLE}`);
    await dialog.getByRole("button", { name: "Add channel" }).click();
    await expect(page.getByText("This channel already exists")).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();

    await openGuestPage(page, "/");
    await expect(page.getByRole("link", CHANNEL_LINK)).toHaveAttribute(
      "href",
      `https://instagram.com/${HANDLE}`
    );

    await stubConfirmationBooking(page);
    await openGuestPage(page, `/booking/confirmation/${BOOKING_REFERENCE}`);
    await expect(page.getByText(CONFIRMATION_CONTACT_TEXT)).toBeVisible();
    await expect(page.getByRole("link", CHANNEL_LINK)).toHaveAttribute(
      "href",
      `https://instagram.com/${HANDLE}`
    );
  });

  test("hiding every channel removes the contact part from both guest pages", async ({ page }) => {
    await loginAsManager(page);
    const table = await openContactChannelsTab(page);
    const shownRows = table.getByRole("row").filter({ hasText: "Shown" });
    await expect(shownRows.first()).toBeVisible();

    // Keyboard, because the stacked success toasts cover the lower rows' menu buttons.
    const shownCount = await shownRows.count();
    for (let remaining = shownCount - 1; remaining >= 0; remaining--) {
      await shownRows
        .first()
        .getByRole("button", { name: /^Actions for / })
        .press("Enter");
      await page.getByRole("menuitem", { name: "Hide" }).press("Enter");
      await expect(shownRows).toHaveCount(remaining);
    }
    await expect(page.getByText("Contact channel hidden").first()).toBeVisible();

    await openGuestPage(page, "/");
    await expect(page.getByText("Contact us to book available dates.")).toBeVisible();
    await expect(page.getByRole("link", CHANNEL_LINK)).toHaveCount(0);
    await expect(page.locator("dl a")).toHaveCount(0);

    await stubConfirmationBooking(page);
    await openGuestPage(page, `/booking/confirmation/${BOOKING_REFERENCE}`);
    await expect(page.getByRole("heading", { name: "Booking Confirmed!" })).toBeVisible();
    await expect(page.getByText(CONFIRMATION_CONTACT_TEXT)).toHaveCount(0);
  });

  test("staff cannot open the Settings page", async ({ page }) => {
    await loginAsStaff(page);
    await page.goto("/admin/settings");
    await expect(page.getByRole("tab", { name: "Contact Channels" })).toHaveCount(0);
    await expect(page).not.toHaveURL(/\/admin\/settings/);
  });
});
