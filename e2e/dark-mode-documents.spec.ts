import { expect, test, type Locator, type Page } from "@playwright/test";

import { loginAsAdmin } from "./fixtures/auth";
import { COMPACT, EXPANDED, expectReadable, useDarkTheme } from "./fixtures/contrast";

/**
 * Dark mode is readable on the document generator (#107): the form, the letterhead settings
 * and the paper preview, which stays a light printed page in either theme. Needs the seeded
 * admin; the document itself lives in the browser, so no fixtures are touched.
 */

const TABLET = { width: 1000, height: 900 };

function visible(page: Page, selector: string): Locator {
  return page.locator(`${selector} >> visible=true`).first();
}

/** Fills every part the preview draws: recipient, a line item, a discount and notes. */
async function fillDocument(page: Page) {
  await visible(page, 'input[name="recipient.name"]').fill("Maria Santos");
  await visible(page, 'input[name="recipient.company_name"]').fill("Santos Family Reunion");
  await visible(page, 'input[name="recipient.tin"]').fill("123-456-789-000");
  await visible(page, "button:has-text('Add Item')").click();
  await visible(page, 'input[placeholder="Description"]').fill("Cabin stay, 2 nights");
  await visible(page, 'input[name="line_items.0.unit_price"]').fill("4500");
  await visible(page, 'input[name="pricing.discount_label"]').fill("Early bird");
  await visible(page, 'input[name="pricing.discount_amount"]').fill("500");
  await visible(page, 'textarea[name="notes"]').fill("Check-in from 2 PM.");
  await visible(page, 'textarea[name="notes"]').blur();
}

/** Luminance of the paper behind the preview's document title: a printed page stays light. */
async function paperLuminance(page: Page) {
  const title = page.getByRole("heading", { name: "QUOTATION" }).locator("visible=true").first();
  return title.evaluate((element) => {
    let node: Element | null = element;
    while (node && getComputedStyle(node).backgroundColor === "rgba(0, 0, 0, 0)") {
      node = node.parentElement;
    }
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    context.fillStyle = node ? getComputedStyle(node).backgroundColor : "#fff";
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  });
}

test.describe("Dark mode documents", () => {
  test.beforeEach(async ({ page }) => {
    await useDarkTheme(page);
  });

  test("document generator and paper preview read in dark at expanded width", async ({ page }) => {
    await page.setViewportSize(EXPANDED);
    await loginAsAdmin(page);
    await page.goto("/admin/documents");
    await expect(page.getByRole("heading", { name: "Document Generator" })).toBeVisible();
    await fillDocument(page);

    await expect(page.getByText("Bill To").locator("visible=true").first()).toBeVisible();
    await expect(page.getByText("Discount (Early bird)").locator("visible=true")).toHaveCount(2);
    await expectReadable(page, "main");
    expect(await paperLuminance(page)).toBeGreaterThan(0.9);
  });

  test("document form and preview sheet read in dark at compact width", async ({ page }) => {
    await page.setViewportSize(COMPACT);
    await loginAsAdmin(page);
    await page.goto("/admin/documents");
    await expect(page.getByRole("heading", { name: "Document Generator" })).toBeVisible();
    await fillDocument(page);
    await expectReadable(page, "main");

    await page.getByRole("button", { name: "Preview" }).click();
    const sheet = page.getByRole("dialog", { name: "Document Preview" });
    await expect(sheet.getByText("Bill To")).toBeVisible();
    await expectReadable(page, '[role="dialog"]');
    expect(await paperLuminance(page)).toBeGreaterThan(0.9);
  });

  test("line item typed in the wide row reaches the preview and reads in dark", async ({
    page,
  }) => {
    await page.setViewportSize(TABLET);
    await loginAsAdmin(page);
    await page.goto("/admin/documents");
    await expect(page.getByRole("heading", { name: "Document Generator" })).toBeVisible();
    await fillDocument(page);
    await expect(visible(page, "text=Unit Price")).toBeVisible();
    await expectReadable(page, "main");

    await page.getByRole("tab", { name: "Preview" }).click();
    await expect(
      page.getByRole("cell", { name: "Cabin stay, 2 nights" }).locator("visible=true")
    ).toBeVisible();
    await expectReadable(page, "main");
    expect(await paperLuminance(page)).toBeGreaterThan(0.9);
  });

  test("letterhead settings read in dark", async ({ page }) => {
    await page.setViewportSize(EXPANDED);
    await loginAsAdmin(page);
    await page.goto("/admin/documents");
    await page.getByRole("button", { name: "Letterhead settings" }).click();
    const dialog = page.getByRole("dialog", { name: "Letterhead Settings" });
    await expect(dialog.getByLabel("Resort Name")).toBeVisible();
    await expect(dialog.getByText("Logo", { exact: true })).toBeVisible();
    await expectReadable(page, '[role="dialog"]');
  });
});
