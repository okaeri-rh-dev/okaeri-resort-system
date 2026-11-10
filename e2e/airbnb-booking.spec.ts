import { expect, test } from "@playwright/test";

import { loginAsStaff } from "./fixtures/auth";

/** Staff enter an Airbnb booking with its payout: Confirmed and fully paid (ADR 0006). */
test("staff create a 2-cabin Airbnb booking with its payout through the new flow", async ({
  page,
}) => {
  // Guest names allow letters only, so the unique suffix spells the timestamp's digits.
  const guestName = `Airbnb Guest ${String(Date.now()).replace(/\d/g, (d) => "abcdefghij"[+d])}`;
  await loginAsStaff(page);
  await page.goto("/admin/bookings/new?step=stay");

  await page.getByRole("button", { name: "Stay dates" }).click();
  const monthsAhead = 6 + Math.floor(Math.random() * 12);
  for (let i = 0; i < monthsAhead; i++) {
    await page.getByRole("button", { name: /next month/i }).click();
  }
  const calendar = page.getByRole("grid").first();
  await calendar.getByRole("button", { name: / 20th, / }).click();
  await calendar.getByRole("button", { name: / 22nd, / }).click();
  await page.getByRole("button", { name: "Add Cabin 1" }).click();
  await page.getByRole("button", { name: "Add Cabin 2" }).click();

  // Picking a payment method first proves a source change resets the Payment step.
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Guest", { exact: true }).fill(guestName);
  await page.getByRole("button", { name: /New guest/ }).click();
  await page.getByLabel("Phone").fill("09171234567");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("radio", { name: "Cash", exact: true }).click();
  await page.getByRole("button", { name: "Stay", exact: true }).click();

  await page.getByRole("radio", { name: /Airbnb/ }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  // Phone is optional for an Airbnb guest.
  await page.getByLabel("Phone (optional)").fill("");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/step=payment/);

  await expect(page.getByRole("radio", { name: "Cash", exact: true })).toBeHidden();
  await expect(page.getByText(/after Airbnb's fee\. Not the price the guest paid/)).toBeVisible();
  await expect(page.getByText(/split across cabins in proportion/)).toBeVisible();
  await page.getByLabel("Payout").fill("4321.50");
  await page.getByLabel(/Airbnb confirmation code/).fill(`HM${Date.now()}`);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/step=review/);
  await page.getByRole("button", { name: "Save booking" }).click();

  await expect(page).toHaveURL(/\/admin\/bookings\?booking=[0-9a-f-]{36}/);
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: guestName })).toBeVisible();
  await expect(sheet.getByText("Confirmed").first()).toBeVisible();
  await expect(sheet.getByText("₱4,321.50").first()).toBeVisible();
});
