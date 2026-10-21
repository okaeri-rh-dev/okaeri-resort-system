import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./fixtures/auth";
import { COMPACT, EXPANDED, expectReadable, useDarkTheme } from "./fixtures/contrast";

/**
 * Dark mode is readable on the markup the admin route files draw themselves (#104): the
 * detail and edit routes' load-failure screen and the list routes' page headers. Needs the
 * seeded admin. A nonexistent id makes each detail loader throw, so the route's own
 * errorComponent renders regardless of what the shared database holds.
 */

const MISSING_ID = "00000000-0000-4000-8000-00000000dead";
// The query client retries a failed detail fetch before the errorComponent shows.
const ERROR_SCREEN_WAIT = { timeout: 30_000 };

const DETAIL_ROUTES = [
  { path: `/admin/bookings/${MISSING_ID}`, heading: "Failed to Load Booking" },
  { path: `/admin/bookings/${MISSING_ID}/edit`, heading: "Failed to Load Booking Editor" },
  { path: `/admin/guests/${MISSING_ID}`, heading: "Failed to Load Guest" },
  { path: `/admin/guests/${MISSING_ID}/edit`, heading: "Failed to Load Guest Editor" },
  { path: `/admin/expenses/${MISSING_ID}`, heading: "Failed to Load Expense" },
  { path: `/admin/expenses/${MISSING_ID}/edit`, heading: "Failed to Load Expense Editor" },
  { path: `/admin/payments/${MISSING_ID}`, heading: "Failed to Load Payment" },
  { path: `/admin/payments/${MISSING_ID}/edit`, heading: "Failed to Load Payment Editor" },
  { path: `/admin/units/${MISSING_ID}`, heading: "Failed to Load Cabin" },
  { path: `/admin/units/${MISSING_ID}/edit`, heading: "Failed to Load Cabin Editor" },
];

test.describe("Dark mode admin routes", () => {
  test.beforeEach(async ({ page }) => {
    await useDarkTheme(page);
  });

  test("every detail route's load failure reads in dark", async ({ page }) => {
    test.slow();
    await page.setViewportSize(EXPANDED);
    await loginAsAdmin(page);

    for (const { path, heading } of DETAIL_ROUTES) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible(
        ERROR_SCREEN_WAIT
      );
      await expect(page.getByRole("button", { name: "Go Back" })).toBeVisible();
      await expectReadable(page);
    }
  });

  test("detail route load failure reads in dark on a phone", async ({ page }) => {
    await page.setViewportSize(COMPACT);
    await loginAsAdmin(page);
    await page.goto(`/admin/guests/${MISSING_ID}`);
    await expect(page.getByRole("heading", { name: "Failed to Load Guest" })).toBeVisible(
      ERROR_SCREEN_WAIT
    );
    await expectReadable(page);
  });

  test("transfers header and explainer read in dark", async ({ page }) => {
    await page.setViewportSize(COMPACT);
    await loginAsAdmin(page);
    await page.goto("/admin/transfers");
    await expect(page.getByRole("heading", { name: "About Transfers" })).toBeVisible();
    await expectReadable(page);
  });
});
