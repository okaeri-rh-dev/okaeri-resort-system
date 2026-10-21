import { expect, test, type Page } from "@playwright/test";

import {
  E2E_ASSIGN_PAID_BOOKING_ID,
  E2E_GUEST,
  E2E_GUEST_ID,
  E2E_REF,
  E2E_USER,
} from "../scripts/e2e/fixtures";
import { findLowContrastText } from "./fixtures/contrast";
import { LoginPage } from "./pages/LoginPage";

/**
 * Booking and guest screens read in dark mode: no text under WCAG AA against what is painted
 * behind it (#105). The bookings list is covered in dark-mode-surfaces.spec.ts.
 * Needs the E2E-* fixtures (`npm run seed:e2e`).
 */

const COMPACT = { width: 390, height: 844 };
const EXPANDED = { width: 1280, height: 900 };

async function loginInDark(page: Page, viewport: typeof COMPACT) {
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  await page.setViewportSize(viewport);
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.loginAndWaitForDashboard(E2E_USER.email, E2E_USER.password);
}

async function expectReadable(page: Page, root = "main") {
  expect(await findLowContrastText(page, root)).toEqual([]);
}

async function openBookingDetail(page: Page, bookingReference: string) {
  await page.goto("/admin/bookings");
  await page
    .getByRole("link", { name: bookingReference })
    .or(page.getByRole("button", { name: `View booking ${bookingReference}` }))
    .first()
    .click();
  await expect(page.getByRole("heading", { name: `Booking #${bookingReference}` })).toBeVisible();
}

test.describe("Dark mode bookings and guests", () => {
  for (const [name, viewport] of [
    ["phone", COMPACT],
    ["desktop", EXPANDED],
  ] as const) {
    test(`booking detail and edit read in dark on ${name}`, async ({ page }) => {
      await loginInDark(page, viewport);
      await openBookingDetail(page, E2E_REF.CONF_PAID);
      await expect(page.getByRole("heading", { name: "Cabin Information" })).toBeVisible();
      await expectReadable(page);

      await page.getByRole("link", { name: "Edit" }).click();
      await expect(page.getByLabel("Guest Name")).toHaveValue(E2E_GUEST.guest_name);
      await expectReadable(page);
    });
  }

  test("unassigned multi-cabin booking detail reads in dark", async ({ page }) => {
    await loginInDark(page, EXPANDED);
    await page.goto(`/admin/bookings/${E2E_ASSIGN_PAID_BOOKING_ID}`);
    await expect(page.getByText("No units assigned")).toBeVisible();
    await expectReadable(page);
  });

  test("guest detail reads in dark", async ({ page }) => {
    await loginInDark(page, EXPANDED);
    await page.goto(`/admin/guests/${E2E_GUEST_ID}`);
    await expect(page.getByRole("heading", { name: "Guest Statistics" })).toBeVisible();
    await expectReadable(page);
  });

  test("guest edit reads in dark", async ({ page }) => {
    await loginInDark(page, COMPACT);
    await page.goto(`/admin/guests/${E2E_GUEST_ID}/edit`);
    await expect(page.getByLabel("Guest Name")).toHaveValue(E2E_GUEST.guest_name);
    await expectReadable(page);
  });

  test("single cabin booking dialog reads in dark", async ({ page }) => {
    await loginInDark(page, COMPACT);
    await page.goto("/admin/bookings");
    await page.getByRole("button", { name: /new booking/i }).click();
    await page.getByRole("menuitem", { name: /single cabin booking/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Create New Booking")).toBeVisible();
    await expectReadable(page, "[role=dialog]");
  });

  test("multi-cabin booking reads in dark", async ({ page }) => {
    await loginInDark(page, EXPANDED);
    await page.goto("/admin/bookings/new-multi");
    await page.getByRole("button", { name: /^Add .* to booking$/ }).first().click();
    await expect(page.getByRole("region", { name: "Pricing summary" })).toBeVisible();
    await expectReadable(page);
  });
});
