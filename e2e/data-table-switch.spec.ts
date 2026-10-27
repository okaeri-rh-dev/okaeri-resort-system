import { expect, test, type Page } from "@playwright/test";

import { E2E_REF, E2E_USER } from "../scripts/e2e/fixtures";
import { LoginPage } from "./pages/LoginPage";

/**
 * DataTable table ↔ card switch on the admin bookings list.
 *
 * DataTable measures its own pane: cards below ~600px, a table from 600px. Needs the E2E
 * fixtures: run `npm run seed:e2e` first (or `npm run test:e2e:hooked`).
 */

async function openBookings(page: Page) {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.loginAndWaitForDashboard(E2E_USER.email, E2E_USER.password);
  await page.goto("/admin/bookings");
  await expect(page.getByText(E2E_REF.PENDING)).toBeVisible();
}

// The menu's "Bookings" group is also a list named "Bookings", so look only in the page.
const bookingCards = (page: Page) => page.getByRole("main").getByRole("list", { name: "Bookings" });

test.describe("DataTable switch on the bookings list", () => {
  test("compact window shows booking cards and no table", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openBookings(page);

    const cards = bookingCards(page);
    await expect(cards).toBeVisible();
    await expect(
      cards.getByRole("button", { name: `View booking ${E2E_REF.PENDING}` })
    ).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);

    const scrollsSideways = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(scrollsSideways).toBe(false);
  });

  test("expanded window shows a table with 40px rows and right-aligned money", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openBookings(page);

    const table = page.getByRole("table", { name: "Bookings" });
    await expect(table).toBeVisible();
    await expect(bookingCards(page)).toHaveCount(0);

    const headerRow = table.getByRole("row").first();
    expect((await headerRow.boundingBox())?.height).toBe(40);

    const pendingRow = table.getByRole("row").filter({ hasText: E2E_REF.PENDING });
    const amountCell = pendingRow.getByRole("cell", { name: "₱2,500.00" });
    await expect(amountCell).toBeVisible();
    await expect(amountCell).toHaveCSS("text-align", "right");
    await expect(amountCell).toHaveCSS("font-variant-numeric", "tabular-nums");
  });

  test("a slim table pane keeps the row menu pinned in view", async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await openBookings(page);

    const table = page.getByRole("table", { name: "Bookings" });
    const pane = table.locator("xpath=..");
    expect(await pane.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);

    const rowMenu = page.getByRole("button", { name: `Actions for ${E2E_REF.PENDING}` });
    await expect(rowMenu).toBeInViewport({ ratio: 1 });
    const paneBox = (await pane.boundingBox())!;
    const menuBox = (await rowMenu.boundingBox())!;
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(paneBox.x + paneBox.width);
  });

  test("resizing the window across 600px swaps the form in place", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openBookings(page);
    await expect(page.getByRole("table", { name: "Bookings" })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(bookingCards(page)).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
  });
});
