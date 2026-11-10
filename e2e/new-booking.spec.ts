import { expect, test, type Page } from "@playwright/test";

import { loginAsStaff } from "./fixtures/auth";

// Guest names allow letters only, so the unique suffix spells the timestamp's digits.
const uniqueName = (prefix: string) =>
  `${prefix} ${String(Date.now()).replace(/\d/g, (d) => "abcdefghij"[+d])}`;

/** Picks a 2-night stay some months ahead, away from the seeded bookings. */
async function pickStay(page: Page) {
  await page.getByRole("button", { name: "Stay dates" }).click();
  const monthsAhead = 6 + Math.floor(Math.random() * 12);
  for (let i = 0; i < monthsAhead; i++) {
    await page.getByRole("button", { name: /next month/i }).click();
  }
  const calendar = page.getByRole("grid").first();
  await calendar.getByRole("button", { name: / 10th, / }).click();
  await calendar.getByRole("button", { name: / 12th, / }).click();
}

test("staff book 2 cabins as Direct through all four steps and land in the sheet", async ({
  page,
}) => {
  const guestName = uniqueName("Stepper Guest");
  await loginAsStaff(page);
  await page.goto("/admin/bookings");

  await page.getByRole("link", { name: "New booking" }).click();
  await expect(page).toHaveURL(/\/admin\/bookings\/new\?step=stay/);
  await expect(page.getByRole("radio", { name: /Direct/ })).toHaveAttribute("aria-checked", "true");

  await pickStay(page);
  await page.getByRole("button", { name: "Add Cabin 1" }).click();
  await page.getByRole("button", { name: "Add Cabin 2" }).click();
  await page.getByRole("button", { name: "One guest more in Cabin 2" }).click();
  const summary = page.getByRole("complementary", { name: "Price summary" });
  await expect(summary.getByText("Cabin 1")).toBeVisible();
  await expect(summary.getByText("Cabin 2")).toBeVisible();

  await page.getByRole("button", { name: "Next" }).click();
  await expect(page).toHaveURL(/step=guest/);

  await page.goBack();
  await expect(page).toHaveURL(/step=stay/);
  await expect(page.getByRole("button", { name: "Remove Cabin 2" })).toBeVisible();

  // A started draft warns before leaving the flow.
  await page.getByRole("button", { name: "Cancel" }).click();
  const warning = page.getByRole("alertdialog");
  await expect(warning).toBeVisible();
  await warning.getByRole("button", { name: "Keep editing" }).click();
  await expect(page).toHaveURL(/\/admin\/bookings\/new\?step=stay/);

  await page.getByRole("button", { name: "Next" }).click();
  await expect(page).toHaveURL(/step=guest/);
  await page.getByLabel("Guest", { exact: true }).fill(guestName);
  await page.getByRole("button", { name: /New guest/ }).click();
  await page.getByLabel("Phone").fill("09171234567");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page).toHaveURL(/step=payment/);

  await page.getByRole("radio", { name: "Cash", exact: true }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page).toHaveURL(/step=review/);
  await expect(page.getByRole("main").getByText(guestName)).toBeVisible();
  // The quoted total is what the server stores.
  const total = await page.getByTestId("new-booking-total").first().textContent();

  await page.getByRole("button", { name: "Save booking" }).click();

  await expect(page).toHaveURL(/\/admin\/bookings\?booking=[0-9a-f-]{36}/);
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: guestName })).toBeVisible();
  await expect(sheet.getByText("Pending").first()).toBeVisible();
  await expect(sheet.getByText(total ?? "missing total").first()).toBeVisible();
});
