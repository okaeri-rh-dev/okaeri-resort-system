import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./fixtures/auth";
import { seedConfirmation } from "./fixtures/confirmation";

/**
 * Printing drops the shell's chrome, and the booking confirmation prints with the full logo
 * above its heading. Print CSS only applies in a real browser, so this is checked here.
 */

const REFERENCE = "BK-202612-PR1NT0";
const PRINT_LOGO = { name: "Okaeri Rest House" } as const;

test.describe("Printing the booking confirmation", () => {
  test.beforeEach(async ({ page }) => {
    await seedConfirmation(page, { booking_reference: REFERENCE });
  });

  test("on screen the page shows no print logo", async ({ page }) => {
    await page.goto(`/booking/confirmation/${REFERENCE}`);

    await expect(page.getByRole("heading", { name: "Booking Confirmed!" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await expect(page.getByRole("img", PRINT_LOGO)).toBeHidden();
  });

  test("in print the shell is hidden and the full logo sits above the heading", async ({
    page,
  }) => {
    await page.emulateMedia({ media: "print" });
    await page.goto(`/booking/confirmation/${REFERENCE}`);

    const heading = page.getByRole("heading", { name: "Booking Confirmed!" });
    await expect(heading).toBeVisible();
    await expect(page.getByRole("banner")).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
    await expect(page.getByRole("radiogroup", { name: "Theme" })).toBeHidden();
    await expect(page.getByRole("switch", { name: "Dark mode" })).toBeHidden();

    const logo = page.getByRole("img", PRINT_LOGO);
    await expect(logo).toBeVisible();
    const [logoBox, headingBox] = await Promise.all([logo.boundingBox(), heading.boundingBox()]);
    expect(logoBox!.y + logoBox!.height).toBeLessThanOrEqual(headingBox!.y);
  });
});

test("printing an admin page hides the rail, header and account menu", async ({ page }) => {
  await loginAsAdmin(page);
  await page.emulateMedia({ media: "print" });
  await page.goto("/admin");

  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
  await expect(page.getByRole("banner")).toBeHidden();
  await expect(page.getByRole("button", { name: "Account menu" })).toBeHidden();
  await expect(page.getByRole("radiogroup", { name: "Theme" })).toBeHidden();
});
