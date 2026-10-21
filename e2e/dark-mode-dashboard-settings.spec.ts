import { expect, test, type Locator, type Page } from "@playwright/test";

import { loginAsAdmin } from "./fixtures/auth";
import { findLowContrastText } from "./fixtures/contrast";

/**
 * The dashboard and settings screens read in light and dark (#110): no text under WCAG AA
 * against what is painted behind it. Needs the seeded admin. Bookings are stubbed so tomorrow's
 * schedule, the calendar chips and every recent-booking status render whatever the shared
 * database holds; settings use the seeded payment methods and expense categories.
 */

const COMPACT = { width: 390, height: 844 };
const EXPANDED = { width: 1280, height: 900 };
const THEMES = ["light", "dark"] as const;

const isoDay = (offsetDays: number) => {
  const day = new Date();
  day.setDate(day.getDate() + offsetDays);
  const month = String(day.getMonth() + 1).padStart(2, "0");
  const date = String(day.getDate()).padStart(2, "0");
  return `${day.getFullYear()}-${month}-${date}`;
};

const stubUnit = (unitCode: string) => ({
  unit_id: `00000000-0000-4000-8000-00000000c${unitCode.slice(-1)}00`,
  unit_name: `Cabin ${unitCode.slice(-1)}`,
  unit_code: unitCode,
  unit_type: "Cabin",
  base_occupancy: 2,
  max_occupancy: 4,
  base_rate: 2500,
  weekend_rate: 3000,
  extra_person_rate: 500,
  unit_status: "Available",
  amenities: [],
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
});

const stubBooking = (
  suffix: string,
  guestName: string,
  status: "Pending" | "Confirmed" | "CheckedIn" | "CheckedOut",
  checkIn: string,
  checkOut: string,
  unitCode: string
) => {
  const bookingId = `00000000-0000-4000-8000-0000000e2e${suffix}`;
  return {
    booking_id: bookingId,
    booking_reference: `E2E-DASH-${suffix}`,
    guest_id: null,
    guest_name: guestName,
    contact_number: "09171234567",
    email: "guest@example.com",
    num_guests: 2,
    check_in: checkIn,
    check_out: checkOut,
    total_amount: 7500,
    booking_status: status,
    payment_status: status === "Pending" ? "Pending" : "Completed",
    payment_method: "GCash",
    payment_proof_url: null,
    special_requests: null,
    internal_notes: null,
    is_multi_unit: false,
    is_walk_in: false,
    unit_count: 1,
    created_at: "2026-10-20T08:00:00Z",
    updated_at: "2026-10-20T08:00:00Z",
    booking_units: [
      {
        booking_unit_id: `${bookingId}-u`,
        booking_id: bookingId,
        unit_id: stubUnit(unitCode).unit_id,
        unit_price: 2500,
        weekend_surcharge: 0,
        extra_person_charge: 0,
        subtotal: 7500,
        assigned_guests: 2,
        unit_notes: null,
        created_at: "2026-10-20T08:00:00Z",
        updated_at: "2026-10-20T08:00:00Z",
        unit: stubUnit(unitCode),
      },
    ],
    guest: null,
  };
};

const BOOKINGS = [
  stubBooking("01", "Maria Santos", "Confirmed", isoDay(1), isoDay(3), "C1"),
  stubBooking("02", "Jose Rizal", "CheckedIn", isoDay(-1), isoDay(1), "C2"),
  stubBooking("03", "Ana Reyes", "Pending", isoDay(0), isoDay(2), "C3"),
  stubBooking("04", "Ben Cruz", "CheckedOut", isoDay(-4), isoDay(-2), "C1"),
];

async function stubBookings(page: Page) {
  await page.route("**/rest/v1/bookings?select=*", (route) =>
    route.request().method() === "GET" ? route.fulfill({ json: BOOKINGS }) : route.fallback()
  );
}

/** The dashboard renders its mobile and desktop layouts together and hides one with CSS. */
const visible = (locator: Locator) => locator.locator("visible=true").first();

async function expectReadable(page: Page, root = "main") {
  expect(await findLowContrastText(page, root)).toEqual([]);
}

test.describe("Dashboard and settings read in light and dark", () => {
  test.beforeEach(() => {
    if (!process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD) test.skip();
  });

  for (const theme of THEMES) {
    test.describe(theme, () => {
      test.beforeEach(async ({ page }) => {
        await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
      });

      test("desktop dashboard", async ({ page }) => {
        await stubBookings(page);
        await page.setViewportSize(EXPANDED);
        await loginAsAdmin(page);
        await expect(page.getByRole("heading", { name: "Recent Bookings" })).toBeVisible();
        await expect(visible(page.getByText("Ben Cruz"))).toBeVisible();
        await expect(visible(page.getByLabel("C3: Ana Reyes"))).toBeVisible();
        // A wide calendar pane names the cabin on each chip
        await expect(visible(page.getByText("C3", { exact: true }))).toBeVisible();
        await expectReadable(page);
      });

      test("mobile dashboard", async ({ page }) => {
        await stubBookings(page);
        await page.setViewportSize(COMPACT);
        await loginAsAdmin(page);
        await expect(visible(page.getByText("Tomorrow's Schedule"))).toBeVisible();
        await expect(visible(page.getByText("Maria Santos"))).toBeVisible();
        await expectReadable(page);
      });

      for (const viewport of [EXPANDED, COMPACT]) {
        test(`payment methods at ${viewport.width}`, async ({ page }) => {
          await page.setViewportSize(viewport);
          await loginAsAdmin(page);
          await page.goto("/admin/settings");
          await expect(page.getByText("BDO Bank Transfer").first()).toBeVisible();
          // Every field of a row is on screen without scrolling the list sideways
          await expect(page.getByText("1234-5678-9012")).toBeInViewport({ ratio: 1 });
          await expect(
            page.getByRole("button", { name: "Actions for BDO Bank Transfer" })
          ).toBeInViewport({ ratio: 1 });
          await expectReadable(page);
        });

        test(`expense categories at ${viewport.width}`, async ({ page }) => {
          await page.setViewportSize(viewport);
          await loginAsAdmin(page);
          await page.goto("/admin/settings");
          await page.getByRole("tab", { name: "Expense Categories" }).click();
          await expect(page.getByText("Maintenance & Repairs").first()).toBeVisible();
          await expect(
            page.getByRole("button", { name: "Actions for Maintenance & Repairs" })
          ).toBeInViewport({ ratio: 1 });
          await expectReadable(page);
        });
      }

      test("payment method form", async ({ page }) => {
        await page.setViewportSize(EXPANDED);
        await loginAsAdmin(page);
        await page.goto("/admin/settings");
        await page.getByRole("button", { name: "Add Payment Method" }).click();
        const dialog = page.getByRole("dialog");
        await expect(dialog.getByLabel("Method Type *")).toBeVisible();
        await expect(dialog.getByLabel("Icon Color")).toBeVisible();
        await expectReadable(page, '[role="dialog"]');
      });

      test("expense category form", async ({ page }) => {
        await page.setViewportSize(EXPANDED);
        await loginAsAdmin(page);
        await page.goto("/admin/settings");
        await page.getByRole("tab", { name: "Expense Categories" }).click();
        await page.getByRole("button", { name: "Add Category" }).click();
        const dialog = page.getByRole("dialog");
        await expect(dialog.getByLabel("Category Name *")).toBeVisible();
        await expect(dialog.getByRole("switch", { name: "Active" })).toBeVisible();
        await expectReadable(page, '[role="dialog"]');
      });
    });
  }
});
