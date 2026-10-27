import { expect, test, type Page } from "@playwright/test";

import { loginAsAdmin, loginAsStaff } from "./fixtures/auth";

/**
 * The navigation form per window size class (ADR 0004).
 *
 * Admin: bottom bar below 600px, collapsed rail 600–1199px (group items open a flyout), expanded
 * rail from 1200px (group headings). Guest:
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
    for (const group of ["Bookings", "Cabins", "Money", "Admin"]) {
      await expect(menu.getByRole("list", { name: group })).toBeVisible();
    }
    await expect(
      menu.getByRole("list", { name: "Bookings" }).getByRole("link", { name: "Guests" })
    ).toBeVisible();
    await expect(
      menu.getByRole("list", { name: "Admin" }).getByRole("link", { name: "User Roles" })
    ).toBeVisible();
    await expect(menu.getByRole("button", { name: "Sign Out" })).toHaveCount(0);

    await menu.getByRole("link", { name: "Guests" }).click();
    await expect(page).toHaveURL(/\/admin\/guests/);
    await expect(menu).toBeHidden();
    await expectNoSidewaysScroll(page);
  });

  for (const width of [600, 900, 1199]) {
    test(`${width}px: a collapsed rail with one item per group`, async ({ page }) => {
      await page.setViewportSize({ width, height: HEIGHT });
      await loginAsAdmin(page);

      const { nav, box } = await mainNavBox(page);
      expect(box.x).toBe(0);
      expect(box.width).toBeLessThanOrEqual(96);
      await expect(nav.getByRole("link", { name: "Dashboard" })).toBeVisible();
      for (const group of ["Bookings", "Cabins", "Money", "Admin"]) {
        await expect(nav.getByRole("button", { name: group })).toBeVisible();
      }
      await expect(nav.getByRole("link", { name: "Guests" })).toBeHidden();
      await expect(page.getByRole("button", { name: "More" })).toBeHidden();

      await nav.getByRole("button", { name: "Money" }).click();
      const flyout = page.getByRole("menu", { name: "Money" });
      await flyout.getByRole("menuitem", { name: "Expenses" }).click();
      await expect(page).toHaveURL(/\/admin\/expenses/);
      await expect(flyout).toBeHidden();
      await expect(nav.getByRole("button", { name: "Money" })).toHaveAttribute(
        "aria-current",
        "true"
      );

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
    for (const group of ["Bookings", "Cabins", "Money", "Admin"]) {
      await expect(nav.getByRole("list", { name: group })).toBeVisible();
      await expect(nav.getByRole("button", { name: group })).toBeHidden();
    }
    await expect(
      nav.getByRole("list", { name: "Cabins" }).getByRole("link", { name: "Availability" })
    ).toBeVisible();
    await expectNoSidewaysScroll(page);
  });

  test("short large window: the expanded rail scrolls to User Roles", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await loginAsAdmin(page);

    const { nav } = await mainNavBox(page);
    const userRoles = nav.getByRole("link", { name: "User Roles" });
    await userRoles.scrollIntoViewIfNeeded();
    await expect(userRoles).toBeInViewport({ ratio: 1 });
  });

  test("small phone: the menu sheet scrolls to its last destination", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await loginAsAdmin(page);

    await page.getByRole("button", { name: "More" }).click();
    await expect(
      page.getByRole("dialog", { name: "Okaeri Resort" }).getByRole("radiogroup", { name: "Theme" })
    ).toBeInViewport();

    const lastLink = page.getByRole("navigation", { name: "Menu" }).getByRole("link").last();
    await lastLink.scrollIntoViewIfNeeded();
    await expect(lastLink).toBeInViewport();
  });

  test("landscape phone: the whole rail scrolls to its last group and the account menu", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 740, height: 360 });
    await loginAsAdmin(page);

    const { nav } = await mainNavBox(page);
    await expect(nav.getByRole("link", { name: "Dashboard" })).toBeInViewport();
    for (const target of [
      nav.getByRole("button", { name: "Admin" }),
      page.getByRole("button", { name: "Account menu" }),
    ]) {
      await target.scrollIntoViewIfNeeded();
      await expect(target).toBeInViewport({ ratio: 1 });
    }
  });

  test("compact: a role with five or fewer destinations gets no More slot", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsStaff(page);

    const { nav } = await mainNavBox(page);
    await expect(nav.getByRole("link")).toHaveCount(4);
    for (const name of ["Dashboard", "Bookings", "Booking Queue", "Availability"]) {
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
