import { expect, test, type Page } from "@playwright/test";

import { E2E_REF } from "../scripts/e2e/fixtures";
import { loginAsManager, loginAsStaff } from "./fixtures/auth";

/** Only managers and above change a booking's total. Needs the E2E-* fixtures (`npm run seed:e2e`). */
async function openEditForm(page: Page) {
  await page.goto("/admin/bookings");
  await page
    .getByRole("link", { name: E2E_REF.CONF_PAID })
    .or(page.getByRole("button", { name: `View booking ${E2E_REF.CONF_PAID}` }))
    .first()
    .click();
  await page.getByRole("dialog").getByRole("link", { name: "Open full page" }).click();
  await page.getByRole("link", { name: "Edit" }).click();
  return page.getByLabel("Total");
}

test("staff see the booking total read-only", async ({ page }) => {
  await loginAsStaff(page);
  const total = await openEditForm(page);

  await expect(total).not.toHaveValue("");
  await expect(total).not.toBeEditable();
});

test("a manager can edit the booking total", async ({ page }) => {
  await loginAsManager(page);
  const total = await openEditForm(page);

  await expect(total).toBeEditable();
});
