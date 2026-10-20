import { expect, test, type Page } from "@playwright/test";

import { E2E_REF, E2E_UNIT_ID, E2E_USER } from "../scripts/e2e/fixtures";
import { findLowContrastText } from "./fixtures/contrast";
import { LoginPage } from "./pages/LoginPage";

/**
 * Dark mode is readable on the surfaces #71 fixed: no text under WCAG AA against what is
 * painted behind it. Needs the E2E-* fixtures (`npm run seed:e2e`).
 */

const COMPACT = { width: 390, height: 844 };
const EXPANDED = { width: 1280, height: 900 };

async function useDarkTheme(page: Page) {
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
}

async function loginAsE2EOwner(page: Page) {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.loginAndWaitForDashboard(E2E_USER.email, E2E_USER.password);
}

async function expectReadable(page: Page, root = "main") {
  expect(await findLowContrastText(page, root)).toEqual([]);
}

test.describe("Dark mode surfaces", () => {
  test.beforeEach(async ({ page }) => {
    await useDarkTheme(page);
  });

  test("admin bookings table fits the expanded pane and reads in dark", async ({ page }) => {
    await page.setViewportSize(EXPANDED);
    await loginAsE2EOwner(page);
    await page.goto("/admin/bookings");
    await expect(page.getByRole("link", { name: E2E_REF.PENDING })).toBeVisible();

    const actionsHeader = page.getByRole("columnheader", { name: "Actions" });
    const box = await actionsHeader.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(EXPANDED.width);
    await expectReadable(page);
  });

  test("admin booking cards read in dark", async ({ page }) => {
    await page.setViewportSize(COMPACT);
    await loginAsE2EOwner(page);
    await page.goto("/admin/bookings");
    await expect(page.getByText(E2E_REF.PENDING)).toBeVisible();
    await expectReadable(page);
  });

  test("admin dashboard reads in dark", async ({ page }) => {
    await page.setViewportSize(EXPANDED);
    await loginAsE2EOwner(page);
    await expect(page.getByText("Total Bookings")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Booking Calendar" })).toBeVisible();
    await expectReadable(page);
  });

  test("admin cabins read in dark", async ({ page }) => {
    await page.setViewportSize(EXPANDED);
    await loginAsE2EOwner(page);
    await page.goto(`/admin/units/${E2E_UNIT_ID}`);
    await expect(page.getByText("Current Global Rates")).toBeVisible();
    await expectReadable(page);
  });

  test("public availability calendar reads in dark", async ({ page }) => {
    await page.setViewportSize(COMPACT);
    await page.goto("/calendar");
    await expect(page.getByRole("grid").first()).toBeVisible();
    await expectReadable(page);
  });
});
