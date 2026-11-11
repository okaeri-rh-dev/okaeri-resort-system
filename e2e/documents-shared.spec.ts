import { expect, test, type Page } from "@playwright/test";

import { loginAsManager } from "./fixtures/auth";
import { serviceClient } from "./fixtures/service-client";

/**
 * The letterhead and document numbers are shared through the database, not kept per device (#404).
 */

async function openDocuments(page: Page) {
  await loginAsManager(page);
  await page.goto("/admin/documents");
  await expect(page.getByRole("heading", { name: "Document Generator" })).toBeVisible();
}

test.describe("Shared documents", () => {
  test.afterEach(async () => {
    await serviceClient().from("letterhead").delete().eq("id", true);
  });

  test("a letterhead edit on one device shows on another after reload", async ({ browser }) => {
    const tagline = `Shared tagline ${Date.now()}`;
    const first = await browser.newPage();
    const second = await browser.newPage();
    await openDocuments(first);
    await openDocuments(second);

    await first.getByRole("button", { name: "Letterhead settings" }).click();
    const dialog = first.getByRole("dialog");
    await dialog.getByLabel("Tagline").fill(tagline);
    await dialog.getByRole("button", { name: "Save Settings" }).click();
    await expect(dialog).toBeHidden();

    await second.reload();
    await expect(second.getByText(tagline).first()).toBeVisible();

    await first.context().close();
    await second.context().close();
  });

  test("download with the network off makes no PDF and shows an error", async ({ page }) => {
    await openDocuments(page);
    await page.getByRole("button", { name: "Add Item" }).click();
    const download = page.getByRole("button", { name: "Download PDF" });
    await expect(download).toBeEnabled();

    let downloaded = false;
    page.on("download", () => (downloaded = true));
    await page.context().setOffline(true);
    await download.click();

    await expect(page.getByText("Could not get a document number")).toBeVisible();
    expect(downloaded).toBe(false);
  });
});
