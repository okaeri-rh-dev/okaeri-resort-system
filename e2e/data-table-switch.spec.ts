import { expect, test, type Page } from "@playwright/test";

import { E2E_REF } from "../scripts/e2e/fixtures";
import { loginAsOwner } from "./fixtures/auth";
import { serviceClient } from "./fixtures/service-client";

/**
 * DataTable table ↔ card switch on the admin bookings list.
 *
 * DataTable measures its own pane: cards below ~600px, a table from 600px. Needs the E2E
 * fixtures: run `npm run seed:e2e` first (or `npm run test:e2e:hooked`).
 */

async function openBookings(page: Page) {
  await loginAsOwner(page);
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

  test("a click anywhere on a table row opens that booking", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openBookings(page);

    const pendingRow = page
      .getByRole("table", { name: "Bookings" })
      .getByRole("row")
      .filter({ hasText: E2E_REF.PENDING });
    await pendingRow.getByRole("cell", { name: "₱2,500.00" }).click();
    await expect(page).toHaveURL(/[?&]booking=[0-9a-f-]{36}/);
  });

  // The virtualized list has a sticky header, so it cannot scroll sideways: low-priority columns go.
  test("a slim table pane drops low-priority columns and keeps the row menu in view", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await loginAsOwner(page);
    await page.goto("/admin/bookings");

    const table = page.getByRole("table", { name: "Bookings" });
    const pane = table.locator("xpath=../..");
    await expect(table.getByRole("columnheader", { name: "Reference" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Payment" })).toHaveCount(0);
    await expect(table.getByRole("columnheader", { name: "Amount" })).toHaveCount(0);
    const paneBox = (await pane.boundingBox())!;
    const tableBox = (await table.boundingBox())!;
    expect(tableBox.x + tableBox.width).toBeLessThanOrEqual(paneBox.x + paneBox.width);

    const rowMenu = page.getByRole("button", { name: `Actions for ${E2E_REF.PENDING}` });
    await expect(rowMenu).toBeInViewport({ ratio: 1 });
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

test.describe("Long bookings list", () => {
  // One worker, so the fixtures are inserted and deleted once.
  test.describe.configure({ mode: "serial" });
  const LONG_LIST_SIZE = 210;
  const longRef = (n: number) => `E2E-LONG-${String(n).padStart(3, "0")}`;
  const db = serviceClient();

  test.beforeAll(async () => {
    // Cancelled stays in 2020: they sort last in All and touch no cabin, so other specs see no change.
    const rows = Array.from({ length: LONG_LIST_SIZE }, (_, index) => {
      const day = new Date(Date.UTC(2020, 0, 1 + index));
      return {
        booking_reference: longRef(index + 1),
        guest_name: "E2E Long List",
        num_guests: 2,
        check_in: day.toISOString(),
        check_out: new Date(day.getTime() + 86_400_000).toISOString(),
        total_amount: 2500,
        booking_status: "Cancelled",
      };
    });
    const { error } = await db.from("bookings").insert(rows);
    expect(error).toBeNull();
  });

  test.afterAll(async () => {
    await db.from("bookings").delete().like("booking_reference", "E2E-LONG-%");
  });

  async function openLongList(page: Page) {
    await loginAsOwner(page);
    await page.goto("/admin/bookings?view=cancelled&q=E2E%20Long%20List");
    await expect(page.getByRole("main").getByText(longRef(LONG_LIST_SIZE))).toBeVisible();
    await expect(page.getByText(longRef(1))).toHaveCount(0);
  }

  async function scrollToLast(page: Page) {
    const main = page.getByRole("main");
    await expect(async () => {
      await main.evaluate((el) => el.scrollTo(0, el.scrollHeight));
      await expect(main.getByText(longRef(1))).toBeVisible({ timeout: 500 });
    }).toPass();
  }

  test("phone: scrolls to the last booking, and cards give their position", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openLongList(page);
    await expect(page.getByRole("button", { name: /^Previous|^Next/ })).toHaveCount(0);

    const firstCard = bookingCards(page).getByRole("listitem").first();
    await expect(firstCard).toHaveAttribute("aria-setsize", String(LONG_LIST_SIZE));
    await expect(firstCard).toHaveAttribute("aria-posinset", "1");

    await scrollToLast(page);
    const lastCard = bookingCards(page)
      .getByRole("listitem")
      .filter({ hasText: longRef(1) });
    await expect(lastCard).toHaveAttribute("aria-posinset", String(LONG_LIST_SIZE));
  });

  test("laptop: scrolls to the last booking under a sticky header", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openLongList(page);

    const table = page.getByRole("table", { name: "Bookings" });
    await expect(table).toHaveAttribute("aria-rowcount", String(LONG_LIST_SIZE + 1));

    await scrollToLast(page);
    const lastRow = table.getByRole("row").filter({ hasText: longRef(1) });
    await expect(lastRow).toHaveAttribute("aria-rowindex", String(LONG_LIST_SIZE + 1));
    await expect(table.getByRole("columnheader", { name: "Guest" })).toBeInViewport();
    await expect(lastRow.getByText("1 night · 2 guests")).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Guests" })).toHaveCount(0);
    await expect(lastRow.getByRole("link", { name: "E2E Long List" })).toHaveCount(0);
  });
});
