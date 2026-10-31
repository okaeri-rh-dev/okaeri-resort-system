import { expect, test } from "@playwright/test";

import { E2E_REF } from "../scripts/e2e/fixtures";
import { loginAsOwner } from "./fixtures/auth";
import { COMPACT } from "./fixtures/contrast";

/**
 * On a phone, the booking edit form scrolls inside the shell's <main> only. Radix Select puts a
 * hidden absolute <select> next to its trigger inside a <form>; if <main> is not a containing
 * block, that <select> escapes main's clip and makes the whole document scroll too. Needs the
 * E2E-* fixtures (`npm run seed:e2e`).
 */
test("booking edit on a phone has one scroller and shows the form actions at its end", async ({
  page,
}) => {
  await page.setViewportSize(COMPACT);
  await loginAsOwner(page);

  await page.goto("/admin/bookings");
  await page
    .getByRole("link", { name: E2E_REF.CONF_PAID })
    .or(page.getByRole("button", { name: `View booking ${E2E_REF.CONF_PAID}` }))
    .first()
    .click();
  await page.getByRole("link", { name: "Edit" }).click();
  const saveButton = page.getByRole("button", { name: /save changes/i });
  await expect(saveButton).toBeVisible();

  const documentScroll = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
  }));
  expect(documentScroll.scrollHeight, "the document itself must not scroll").toBe(
    documentScroll.clientHeight
  );

  const main = page.locator("main");
  await main.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  const mainBox = await main.boundingBox();
  const saveBox = await saveButton.boundingBox();
  expect(saveBox!.y + saveBox!.height).toBeLessThanOrEqual(mainBox!.y + mainBox!.height);
});
