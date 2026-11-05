/**
 * Payment methods: an admin adds one on the Settings tab and edits it.
 *
 * The spec deletes the method it adds, before and after it runs.
 */
import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./fixtures/auth";
import { serviceClient } from "./fixtures/service-client";

const PROVIDER = "E2E Wallet";
const DISPLAY_NAME = "E2E Wallet Transfer";
const RENAMED = "E2E Wallet Renamed";

test.describe("Payment methods", () => {
  const db = serviceClient();

  test.beforeEach(async () => {
    if (!process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD) test.skip();
    await db.from("payment_methods").delete().eq("provider_name", PROVIDER);
  });

  test.afterEach(async () => {
    await db.from("payment_methods").delete().eq("provider_name", PROVIDER);
  });

  test("an admin adds a payment method and edits it", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/settings");

    await page.getByRole("button", { name: "Add Payment Method" }).click();
    const addDialog = page.getByRole("dialog", { name: "Add Payment Method" });
    await addDialog.getByRole("combobox", { name: "Method Type *" }).click();
    await page.getByRole("option", { name: "E-Wallet (GCash, Maya)" }).click();
    await addDialog.getByRole("textbox", { name: "Provider Name *" }).fill(PROVIDER);
    await addDialog.getByRole("textbox", { name: "Display Name *" }).fill(DISPLAY_NAME);
    await addDialog.getByRole("textbox", { name: "Account Number" }).fill("0917-000-0000");
    await addDialog.getByRole("button", { name: "Create Payment Method" }).click();

    await expect(page.getByText("Payment method created")).toBeVisible();
    await expect(addDialog).toBeHidden();
    await expect(page.getByText(DISPLAY_NAME).first()).toBeVisible();

    await page.getByRole("button", { name: `Actions for ${DISPLAY_NAME}` }).press("Enter");
    await page.getByRole("menuitem", { name: "Edit" }).press("Enter");
    const editDialog = page.getByRole("dialog", { name: "Edit Payment Method" });
    await editDialog.getByRole("textbox", { name: "Display Name *" }).fill(RENAMED);
    await editDialog.getByRole("button", { name: "Update Payment Method" }).click();

    await expect(page.getByText("Payment method updated")).toBeVisible();
    await expect(editDialog).toBeHidden();
    await expect(page.getByText(RENAMED).first()).toBeVisible();
    await expect(page.getByText(DISPLAY_NAME)).toHaveCount(0);
  });
});
