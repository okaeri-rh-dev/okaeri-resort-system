import { expect, test, type Page } from "@playwright/test";

import { loginAsAdmin } from "./fixtures/auth";
import { findLowContrastText } from "./fixtures/contrast";

/**
 * Dark mode is readable on the cabin and pricing screens (#109): no text under WCAG AA against
 * what is painted behind it. Needs the seeded admin and seed cabin "Cabin 1"; seasonal rates and
 * discount rules are stubbed so every badge colour and discount type renders regardless of what
 * the shared database holds.
 */

const COMPACT = { width: 390, height: 844 };
const EXPANDED = { width: 1280, height: 900 };

const SEED_CABIN_ID = "b88857ce-bbc1-474b-ac02-86e8a416c22e";

const seasonalRate = (
  seasonId: string,
  name: string,
  multiplier: number,
  priority: number,
  color: string
) => ({
  id: `00000000-0000-4000-8000-00000000${priority.toString().padStart(4, "0")}`,
  season_id: seasonId,
  name,
  start_date: "03-01",
  end_date: "05-31",
  multiplier,
  priority,
  is_active: priority % 2 === 0,
  description: null,
  color,
});

/** One season per badge colour, with increases, a discount and no change. */
const SEASONAL_RATES = [
  seasonalRate("christmas", "Christmas & New Year", 2, 50, "red"),
  seasonalRate("holy_week", "Holy Week", 1.8, 40, "purple"),
  seasonalRate("peak_summer", "Peak Summer", 1.5, 30, "orange"),
  seasonalRate("regular", "Regular Season", 1, 20, "green"),
  seasonalRate("low_season", "Low Season", 0.8, 10, "blue"),
];

const discountRule = (
  name: string,
  discountType: string,
  discountValue: number,
  conditionType: string,
  priority: number
) => ({
  id: `00000000-0000-4000-8000-0000000d${priority.toString().padStart(4, "0")}`,
  name,
  description: `${name} for longer stays`,
  discount_type: discountType,
  discount_value: discountValue,
  max_discount: null,
  conditions: [{ type: conditionType, value: 7 }],
  priority,
  is_active: priority !== 3,
});

/** One rule per discount type and condition type. */
const DISCOUNT_RULES = [
  discountRule("Week Stay", "percentage", 5, "min_nights", 1),
  discountRule("Early Bird", "fixed", 1500, "advance_booking", 2),
  discountRule("Group Stay", "per_night", 250, "unit_count", 3),
];

async function stubPricingRules(page: Page) {
  await page.route("**/rest/v1/seasonal_rates*", (route) =>
    route.request().method() === "GET" ? route.fulfill({ json: SEASONAL_RATES }) : route.continue()
  );
  await page.route("**/rest/v1/discount_rules*", (route) =>
    route.request().method() === "GET" ? route.fulfill({ json: DISCOUNT_RULES }) : route.continue()
  );
}

async function expectReadable(page: Page, root = "main") {
  expect(await findLowContrastText(page, root)).toEqual([]);
}

test.describe("Dark mode cabin and pricing screens", () => {
  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD) test.skip();
    await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  });

  for (const viewport of [EXPANDED, COMPACT]) {
    test(`cabins list reads in dark at ${viewport.width}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await loginAsAdmin(page);
      await page.goto("/admin/units");
      await expect(page.getByText("Current Pricing Configuration")).toBeVisible();
      await expect(page.getByText("Cabin 1", { exact: true }).first()).toBeVisible();
      await expectReadable(page);
    });

    test(`cabin detail and edit read in dark at ${viewport.width}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await loginAsAdmin(page);
      await page.goto(`/admin/units/${SEED_CABIN_ID}`);
      await expect(page.getByText("Current Global Rates")).toBeVisible();
      await expectReadable(page);

      await page.goto(`/admin/units/${SEED_CABIN_ID}/edit`);
      await expect(page.getByLabel("Cabin Type")).toBeVisible();
      await expect(page.getByText("Current Global Rates")).toBeVisible();
      await expectReadable(page);
    });

    test(`pricing tabs read in dark at ${viewport.width}`, async ({ page }) => {
      await stubPricingRules(page);
      await page.setViewportSize(viewport);
      await loginAsAdmin(page);
      await page.goto("/admin/units/pricing");
      await expect(page.getByLabel("Base Rate (Weekdays)")).toBeVisible();
      await expect(page.getByText("Sample Calculation")).toBeVisible();
      await expectReadable(page);

      await page.getByRole("tab", { name: "Seasonal Rates" }).click();
      await expect(page.getByText("Holy Week")).toBeVisible();
      await expectReadable(page);

      await page.getByRole("tab", { name: "Discount Rules" }).click();
      await expect(page.getByText("Group Stay", { exact: true })).toBeVisible();
      await expectReadable(page);
    });
  }

  test("cabins table edit mode and batch actions read in dark", async ({ page }) => {
    await page.setViewportSize(EXPANDED);
    await loginAsAdmin(page);
    await page.goto("/admin/units");
    await expect(page.getByText("Cabin 1", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByRole("checkbox", { name: "Select row" }).first().check();
    await expect(page.getByText("1 cabin selected")).toBeVisible();
    // The Edit button turns into the filled Done button with a colour transition
    await page.waitForFunction(() => document.getAnimations().length === 0);
    await expectReadable(page);
  });

  test("create cabin dialog reads in dark", async ({ page }) => {
    await page.setViewportSize(EXPANDED);
    await loginAsAdmin(page);
    await page.goto("/admin/units");
    await page.getByRole("button", { name: "Add Cabin" }).click();
    const dialog = page.getByRole("dialog", { name: "Create New Cabin" });
    await expect(dialog.getByText("Weekend Rate")).toBeVisible();
    await expectReadable(page, '[role="dialog"]');
  });

  test("seasonal rate and discount rule dialogs read in dark", async ({ page }) => {
    await stubPricingRules(page);
    await page.setViewportSize(EXPANDED);
    await loginAsAdmin(page);
    await page.goto("/admin/units/pricing");

    await page.getByRole("tab", { name: "Seasonal Rates" }).click();
    await page.getByRole("button", { name: "Add Season" }).click();
    const seasonDialog = page.getByRole("dialog", { name: "Add Seasonal Rate" });
    await expect(seasonDialog.getByLabel("Badge Color")).toBeVisible();
    await expect(seasonDialog.getByLabel("Active")).toBeVisible();
    await expectReadable(page, '[role="dialog"]');
    await seasonDialog.getByRole("button", { name: "Cancel" }).click();

    await page.getByRole("tab", { name: "Discount Rules" }).click();
    await page.getByRole("button", { name: "Edit Early Bird" }).click();
    const ruleDialog = page.getByRole("dialog", { name: "Edit Discount Rule" });
    await expect(ruleDialog.getByLabel("Discount Type")).toBeVisible();
    await expectReadable(page, '[role="dialog"]');
  });

  test("availability cabins table reads in dark", async ({ page }) => {
    await page.setViewportSize(EXPANDED);
    await loginAsAdmin(page);
    await page.goto("/admin/availability");
    await page.getByRole("tab", { name: "Cabins Overview" }).click();
    await expect(page.getByText("Cabin 1", { exact: true }).first()).toBeVisible();
    await expectReadable(page);
  });
});
