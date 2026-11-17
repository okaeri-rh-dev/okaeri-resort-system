import { expect, test, type Page } from "@playwright/test";

import { E2E_REF } from "../scripts/e2e/fixtures";
import { loginAsManager, loginAsStaff } from "./fixtures/auth";

/** Only managers and above change a booking's total. Needs the E2E-* fixtures (`npm run seed:e2e`). */
async function changeStayPrice(page: Page) {
  await page.goto("/admin/bookings");
  await page
    .getByRole("link", { name: E2E_REF.CONF_PAID })
    .or(page.getByRole("button", { name: `View booking ${E2E_REF.CONF_PAID}` }))
    .first()
    .click();
  await page.getByRole("dialog").getByRole("link", { name: "Open full page" }).click();
  await page.getByRole("button", { name: "Edit stay" }).click();
  const sheet = page.getByRole("dialog", { name: "Edit stay" });
  await sheet.getByRole("button", { name: "One guest more in E2E Test Unit" }).click();
  return sheet;
}

test("staff see the new price only as a hint", async ({ page }) => {
  await loginAsStaff(page);
  const sheet = await changeStayPrice(page);

  await expect(sheet.getByText("Ask a manager to update the total")).toBeVisible();
  await expect(sheet.getByLabel("Recompute total from current rates")).toHaveCount(0);
});

test("a manager can recompute the total", async ({ page }) => {
  await loginAsManager(page);
  const sheet = await changeStayPrice(page);

  await expect(sheet.getByLabel("Recompute total from current rates")).toBeEnabled();
});
