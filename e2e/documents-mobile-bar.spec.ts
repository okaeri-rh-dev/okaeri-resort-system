import { expect, test, type Locator, type Page } from "@playwright/test";

import { loginAsAdmin } from "./fixtures/auth";
import { COMPACT } from "./fixtures/contrast";

/**
 * The document generator's Preview/Download bar sits directly above the admin bottom nav on
 * compact windows and at the foot of the screen from medium, where the nav is a rail (#130).
 */

const MEDIUM = { width: 700, height: 900 };

async function openDocuments(page: Page) {
  await loginAsAdmin(page);
  await page.goto("/admin/documents");
  await expect(page.getByRole("heading", { name: "Document Generator" })).toBeVisible();
}

function actionBar(page: Page) {
  return page.getByRole("button", { name: "Preview" }).locator("..");
}

async function box(locator: Locator) {
  const rect = await locator.boundingBox();
  if (!rect) throw new Error("element has no bounding box");
  return rect;
}

test.describe("Document generator mobile action bar", () => {
  test("sits above the bottom nav at 390px without covering it", async ({ page }) => {
    await page.setViewportSize(COMPACT);
    await openDocuments(page);

    const nav = page.getByRole("navigation", { name: "Main" });
    const bar = actionBar(page);
    await expect(nav).toBeVisible();
    await expect(bar).toBeVisible();
    await expect(bar.getByRole("button", { name: "Download PDF" })).toBeVisible();

    const navBox = await box(nav);
    const barBox = await box(bar);
    expect(barBox.y + barBox.height).toBeLessThanOrEqual(navBox.y);

    const notes = page.locator('textarea[name="notes"] >> visible=true');
    await notes.scrollIntoViewIfNeeded();
    await page.getByRole("main").evaluate((main) => main.scrollTo(0, main.scrollHeight));
    const notesBox = await box(notes);
    expect(notesBox.y + notesBox.height).toBeLessThanOrEqual(barBox.y);
  });

  test("sits at the foot of the screen at 700px", async ({ page }) => {
    await page.setViewportSize(MEDIUM);
    await openDocuments(page);

    const bar = actionBar(page);
    await expect(bar).toBeVisible();
    const barBox = await box(bar);
    expect(barBox.y + barBox.height).toBeCloseTo(MEDIUM.height, 0);
  });
});
