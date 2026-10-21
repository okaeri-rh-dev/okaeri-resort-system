/**
 * Contact channels: a manager manages them on the Settings tab and guests see the result on the
 * root page notice and the booking confirmation page.
 *
 * The spec changes shared rows, so it snapshots which channels were shown before it ran and
 * restores them afterwards, and it deletes the channel it adds. The confirmation page shows a
 * seeded booking snapshot; the contact channels on it come from the real database.
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { loginAsManager, loginAsStaff } from "./fixtures/auth";
import { seedConfirmation } from "./fixtures/confirmation";

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
    await expect(
      page.getByText("This channel is already listed. Edit or show the existing one.")
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();

    await openGuestPage(page, "/");
    await expect(page.getByRole("link", CHANNEL_LINK)).toHaveAttribute(
      "href",
      `https://instagram.com/${HANDLE}`
    );

    await seedConfirmation(page, { booking_reference: BOOKING_REFERENCE });
    await openGuestPage(page, `/booking/confirmation/${BOOKING_REFERENCE}`);
    await expect(page.getByText(CONFIRMATION_CONTACT_TEXT)).toBeVisible();
    await expect(page.getByRole("link", CHANNEL_LINK)).toHaveAttribute(
      "href",
      `https://instagram.com/${HANDLE}`
    );
  });

  test("a manager moves a channel up and down and guests see the new order", async ({ page }) => {
    await loginAsManager(page);
    const table = await openContactChannelsTab(page);
    const rows = table.locator("tbody tr");
    await expect(rows.filter({ hasText: `@${HANDLE}` })).toBeVisible();

    // The shown channel just above the new one, so the move is visible to guests.
    const rowTexts = await rows.allInnerTexts();
    const ownIndex = rowTexts.findIndex((text) => text.includes(`@${HANDLE}`));
    const neighbourIndex = rowTexts
      .slice(0, ownIndex)
      .map((text) => text.includes("Shown"))
      .lastIndexOf(true);
    expect(neighbourIndex).toBeGreaterThanOrEqual(0);
    const neighbour = rows.nth(neighbourIndex);
    const neighbourKind = (await neighbour
      .getByRole("button", { name: / down$/ })
      .getAttribute("aria-label"))!.replace(/^Move (.*) down$/, "$1");
    const neighbourValue = (await neighbour.locator("td").nth(2).innerText()).trim();
    const neighbourLink = `${neighbourKind}: ${neighbourValue}`;

    const moveOwn = async (direction: "up" | "down", toIndex: number) => {
      await rows
        .filter({ hasText: `@${HANDLE}` })
        .getByRole("button", { name: `Move Instagram ${direction}` })
        .press("Enter");
      await expect(rows.nth(toIndex)).toContainText(`@${HANDLE}`);
    };

    for (let index = ownIndex - 1; index >= neighbourIndex; index--) {
      await moveOwn("up", index);
    }
    await expect(page.getByText("Contact channel moved").first()).toBeVisible();

    const guestLinkOrder = async () => {
      await openGuestPage(page, "/");
      const names = await page
        .locator("dl a")
        .evaluateAll((links) => links.map((link) => link.getAttribute("aria-label")));
      expect(names).toEqual(expect.arrayContaining([CHANNEL_LINK.name, neighbourLink]));
      return names.indexOf(CHANNEL_LINK.name) - names.indexOf(neighbourLink);
    };
    expect(await guestLinkOrder()).toBe(-1);

    await openContactChannelsTab(page);
    await moveOwn("down", neighbourIndex + 1);
    expect(await guestLinkOrder()).toBe(1);
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

    await seedConfirmation(page, { booking_reference: BOOKING_REFERENCE });
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
