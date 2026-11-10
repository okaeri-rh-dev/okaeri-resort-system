import { expect, test, type Page } from "@playwright/test";

import { E2E_REF } from "../scripts/e2e/fixtures";
import { loginAsStaff } from "./fixtures/auth";

/**
 * Staff check a guest in from the bookings list on the check-in day, and see no Confirm.
 * Needs the E2E-* fixtures (`npm run seed:e2e` or `npm run test:e2e:hooked`).
 */

async function openBooking(page: Page, ref: string) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginAsStaff(page);
  await page.goto(`/admin/bookings?q=${ref}`);
  const row = page.getByRole("row").filter({ hasText: ref });
  await expect(row).toBeVisible();
  return row;
}

test("staff check in a Confirmed booking on its check-in day, then undo it", async ({ page }) => {
  const row = await openBooking(page, E2E_REF.CHECK_IN);
  await row.getByRole("button", { name: "Check in" }).click();

  await expect(row.getByRole("button", { name: "Check out" })).toBeVisible();
  await expect(row.getByRole("button", { name: "Check in" })).toHaveCount(0);

  await page.getByRole("button", { name: "Undo" }).click();

  await expect(row.getByRole("button", { name: "Check in" })).toBeVisible();
  await expect(row.getByRole("button", { name: "Check out" })).toHaveCount(0);
});

test("staff do not see Confirm on a Pending booking", async ({ page }) => {
  const row = await openBooking(page, E2E_REF.PENDING);
  await expect(row.getByRole("button", { name: /^Confirm$/ })).toHaveCount(0);
});
