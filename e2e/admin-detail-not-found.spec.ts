import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./fixtures/auth";

/**
 * Admin detail and edit routes show the not-found screen for an unknown or malformed id (issue 132).
 */

const UNKNOWN_UUID = "00000000-0000-4000-8000-000000000000";

const ENTITIES = [
  { path: "bookings", heading: "Booking Not Found" },
  { path: "guests", heading: "Guest Not Found" },
  { path: "expenses", heading: "Expense Not Found" },
  { path: "payments", heading: "Payment Not Found" },
  { path: "units", heading: "Cabin Not Found" },
];

test.describe("Admin detail routes with an unknown id", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const { path, heading } of ENTITIES) {
    test(`${path} detail and edit show "${heading}"`, async ({ page }) => {
      for (const id of [UNKNOWN_UUID, "abc"]) {
        for (const suffix of ["", "/edit"]) {
          await page.goto(`/admin/${path}/${id}${suffix}`);
          await expect(page.getByRole("heading", { name: heading })).toBeVisible();
          await expect(page.getByText("PGRST116")).toHaveCount(0);
        }
      }
    });
  }
});
