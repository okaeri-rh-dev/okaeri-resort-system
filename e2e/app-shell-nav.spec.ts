import { expect, test, type Page } from "@playwright/test";

import { loginAsAdmin, loginAsStaff } from "./fixtures/auth";

/**
 * The navigation form per window size class (ADR 0004).
 *
 * Admin: bottom bar below 600px, collapsed rail 600–1199px, expanded rail from 1200px. Guest:
 * menu sheet below 600px, inline links from 600px. Needs the seed.sql admin and staff users from
 * .env.test.
 */

const HEIGHT = 900;

async function mainNavBox(page: Page) {
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav).toBeVisible();
  const box = await nav.boundingBox();
  if (!box) throw new Error("Main navigation has no box");
  return { nav, box };
}

async function expectNoSidewaysScroll(page: Page) {
  const scrollsSideways = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(scrollsSideways).toBe(false);
}

test.describe("Admin navigation form", () => {
  test("compact: a bottom bar with the pinned destinations and More", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsAdmin(page);

    const { nav, box } = await mainNavBox(page);
    expect(box.y + box.height).toBeGreaterThan(844 - 2);
    expect(box.height).toBeLessThan(120);

    for (const name of ["Dashboard", "Bookings", "Booking Queue", "Payments"]) {
      await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
    }
    await expect(nav.getByRole("link", { name: "Guests" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();

    const tap = await nav.getByRole("link", { name: "Payments" }).boundingBox();
    expect(tap?.height).toBeGreaterThanOrEqual(44);

    await page.getByRole("button", { name: "More" }).click();
    const menu = page.getByRole("dialog", { name: "Okaeri Resort" });
    await expect(menu.getByRole("link", { name: "Guests" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "User Roles" })).toBeVisible();
    await expect(menu.getByRole("button", { name: "Sign Out" })).toBeVisible();

    await menu.getByRole("link", { name: "Guests" }).click();
    await expect(page).toHaveURL(/\/admin\/guests/);
    await expect(menu).toBeHidden();
    await expectNoSidewaysScroll(page);
  });

  for (const width of [600, 900, 1199]) {
    test(`${width}px: a collapsed rail with every destination`, async ({ page }) => {
      await page.setViewportSize({ width, height: HEIGHT });
      await loginAsAdmin(page);

      const { nav, box } = await mainNavBox(page);
      expect(box.x).toBe(0);
      expect(box.width).toBeLessThanOrEqual(96);
      await expect(nav.getByRole("link", { name: "Guests" })).toBeVisible();
      await expect(page.getByRole("button", { name: "More" })).toBeHidden();

      await page.getByRole("button", { name: "Open menu" }).click();
      await expect(
        page.getByRole("dialog", { name: "Okaeri Resort" }).getByRole("link", { name: "Settings" })
      ).toBeVisible();
      await expectNoSidewaysScroll(page);
    });
  }

  test("1280px: an expanded rail with labels beside the icons", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: HEIGHT });
    await loginAsAdmin(page);

    const { nav, box } = await mainNavBox(page);
    expect(box.x).toBe(0);
    expect(box.width).toBeGreaterThanOrEqual(240);
    await expect(page.getByRole("link", { name: "Okaeri Resort" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();

    const link = await nav.getByRole("link", { name: "Booking Queue" }).boundingBox();
    expect(link?.height).toBeLessThan(56);
    await expectNoSidewaysScroll(page);
  });

  test("compact: a role with five or fewer destinations gets no More slot", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsStaff(page);

    const { nav } = await mainNavBox(page);
    await expect(nav.getByRole("link")).toHaveCount(3);
    for (const name of ["Dashboard", "Bookings", "Booking Queue"]) {
      await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "More" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Account menu" })).toBeVisible();
  });
});

test.describe("Guest navigation form", () => {
  test("compact: a top bar with a menu sheet", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/booking/check-status");

    await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
    await page.getByRole("button", { name: "Open menu" }).click();
    const menu = page.getByRole("dialog", { name: "Okaeri Resort" });
    await expect(menu.getByRole("link", { name: "Availability" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Check a booking" })).toBeVisible();

    await menu.getByRole("link", { name: "Availability" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expectNoSidewaysScroll(page);
  });

  for (const width of [600, 1280]) {
    test(`${width}px: inline links in the top bar`, async ({ page }) => {
      await page.setViewportSize({ width, height: HEIGHT });
      await page.goto("/booking/check-status");

      const { nav, box } = await mainNavBox(page);
      expect(box.y).toBeLessThan(64);
      await expect(nav.getByRole("link", { name: "Check a booking" })).toHaveAttribute(
        "aria-current",
        "page"
      );
      await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
      await expectNoSidewaysScroll(page);
    });
  }
});
