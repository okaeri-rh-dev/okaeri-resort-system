import { expect, test } from "@playwright/test";

import { loginAsStaff } from "./fixtures/auth";
import { BookingsTablePage } from "./pages/BookingsTablePage";

/** Staff enter an Airbnb booking with its payout and find it by source (ADR 0006). */
test("staff create an Airbnb booking and find it with Source = Airbnb", async ({ page }) => {
  // Guest names allow letters only, so the unique suffix spells the timestamp's digits.
  const guestName = `Airbnb Guest ${String(Date.now()).replace(/\d/g, (d) => "abcdefghij"[+d])}`;
  await loginAsStaff(page);
  const bookings = new BookingsTablePage(page);
  await bookings.goto();

  await bookings.clickNewBooking();
  await page.getByRole("menuitem", { name: /single cabin booking/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Checking availability…")).toBeHidden();
  await dialog.getByLabel("Select Unit").click();
  await page.locator('[role="option"]:not([data-disabled])').first().click();
  await dialog.getByRole("button", { name: "Next" }).click();

  await dialog.getByLabel("Booking source").click();
  await page.getByRole("option", { name: "Airbnb" }).click();
  await dialog.getByLabel("Full Name").fill(guestName);
  await dialog.getByRole("button", { name: "Next" }).click();

  await expect(dialog.getByLabel("Payment Method")).toBeHidden();
  await dialog.getByLabel("Payout").fill("4321.50");
  await dialog.getByRole("button", { name: "Next" }).click();
  await dialog.getByRole("button", { name: "Confirm Booking" }).click();
  await expect(page.getByText(/Booking .+ created/)).toBeVisible();

  await page.getByRole("button", { name: "Source" }).click();
  await page.getByRole("combobox").last().click();
  await page.getByRole("option", { name: "Airbnb" }).click();
  await page.keyboard.press("Escape");
  await bookings.search(guestName);

  await expect(page.getByText(guestName).first()).toBeVisible();
});
