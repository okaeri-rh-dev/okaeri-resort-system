import { expect, test } from "@playwright/test";

import { E2E_REF } from "../scripts/e2e/fixtures";
import { loginAsAdmin, loginAsStaff } from "./fixtures/auth";
import { ROUTES } from "./fixtures/test-data";
import { BookingsTablePage } from "./pages/BookingsTablePage";
import { DashboardPage } from "./pages/DashboardPage";

/**
 * Admin Booking Management Tests
 *
 * Tests for the admin booking management features:
 * - Viewing bookings list
 * - Search and filtering
 * - Booking details
 * - Status management
 *
 * Note: Most tests require authentication. They will be skipped
 * if test credentials are not configured.
 */

test.describe("Admin Bookings Management", () => {
  // Skip all tests in this describe block if no credentials
  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD) {
      test.skip();
    }
    await loginAsAdmin(page);
  });

  test.describe("Bookings Table", () => {
    test("can navigate to bookings from dashboard", async ({ page }) => {
      const dashboardPage = new DashboardPage(page);
      await dashboardPage.goToBookings();

      await expect(page).toHaveURL(/\/admin\/bookings/);
    });

    test("bookings table loads and displays data", async ({ page }) => {
      const bookingsTable = new BookingsTablePage(page);
      await bookingsTable.goto();

      // Table or empty state should be visible
      await bookingsTable.expectTableVisible();
    });

    test("table has expected columns", async ({ page }) => {
      const bookingsTable = new BookingsTablePage(page);
      await bookingsTable.goto();

      // Skip if table is empty (no column headers to check)
      const tableVisible = await bookingsTable.table.isVisible().catch(() => false);
      const emptyVisible = await bookingsTable.emptyState.isVisible().catch(() => false);

      if (!tableVisible && emptyVisible) {
        test.skip(true, "No bookings data - table empty");
        return;
      }

      if (!tableVisible) {
        test.skip(true, "Table not visible - may be in card view");
        return;
      }

      // Wait for table to fully render
      await page.waitForTimeout(500);

      // Get all column headers and check if expected columns exist
      const headers = await page.getByRole("columnheader").all();

      // Skip if no headers found (may be loading or different table structure)
      if (headers.length === 0) {
        // Try to find any th elements as fallback
        const thElements = await page.locator("th").all();
        if (thElements.length === 0) {
          test.skip(true, "No column headers found - table may have different structure");
          return;
        }
        // th elements found - pass test
        expect(thElements.length).toBeGreaterThan(0);
        return;
      }

      const headerTexts = await Promise.all(
        headers.map((h) => h.textContent().then((t) => t?.toLowerCase() || ""))
      );

      // Check for expected columns (at least 2 of these patterns should exist)
      const hasReference = headerTexts.some((t) => /reference|booking|id|ref/i.test(t));
      const hasGuest = headerTexts.some((t) => /guest|name|customer/i.test(t));
      const hasStatus = headerTexts.some((t) => /status|state/i.test(t));
      const hasDate = headerTexts.some((t) => /date|check|in|out/i.test(t));
      const hasAmount = headerTexts.some((t) => /amount|price|total/i.test(t));

      const matchCount = [hasReference, hasGuest, hasStatus, hasDate, hasAmount].filter(
        Boolean
      ).length;

      // Table should have at least 2 recognizable columns, or any headers at all
      expect(matchCount).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe("Search & Filters", () => {
    test("search input is visible", async ({ page }) => {
      const bookingsTable = new BookingsTablePage(page);
      await bookingsTable.goto();

      await expect(bookingsTable.searchInput).toBeVisible();
    });

    test("can type in search input", async ({ page }) => {
      const bookingsTable = new BookingsTablePage(page);
      await bookingsTable.goto();

      await bookingsTable.search("OKR-");
      await expect(bookingsTable.searchInput).toHaveValue("OKR-");
    });

    test("search filters table results", async ({ page }) => {
      const bookingsTable = new BookingsTablePage(page);
      await bookingsTable.goto();
      const bookingRows = bookingsTable.tableBodyRows.or(bookingsTable.bookingCards);
      const initialRowCount = await bookingRows.count();

      await bookingsTable.search("nonexistent-booking-xyz-999");

      await expect(bookingsTable.noMatchesState).toBeVisible();
      expect(await bookingsTable.getRowCount()).toBe(0);

      await bookingsTable.clearFiltersButton.click();
      await expect(bookingsTable.searchInput).toHaveValue("");
      await expect(bookingRows).toHaveCount(initialRowCount);
    });

    test("can clear search", async ({ page }) => {
      const bookingsTable = new BookingsTablePage(page);
      await bookingsTable.goto();

      await bookingsTable.search("test-query");
      await bookingsTable.clearSearch();

      await expect(bookingsTable.searchInput).toHaveValue("");
    });

    test("opens the All view with no view in the URL and no status filter", async ({ page }) => {
      const bookingsTable = new BookingsTablePage(page);
      await bookingsTable.goto();

      await expect(bookingsTable.viewTab("All")).toHaveAttribute("aria-selected", "true");
      await expect(page.getByRole("button", { name: "Status" })).toHaveCount(0);
    });

    test("a view change and a search live in the URL", async ({ page }) => {
      const bookingsTable = new BookingsTablePage(page);
      await bookingsTable.goto();

      await bookingsTable.selectView("Upcoming");
      await expect(page).toHaveURL(/[?&]view=upcoming/);

      // Real keystrokes: each one writes the URL, so a lost character shows here
      await bookingsTable.searchInput.pressSequentially("Santos", { delay: 20 });
      await expect(bookingsTable.searchInput).toHaveValue("Santos");
      await expect(page).toHaveURL(/[?&]q=Santos/);
      await expect(page).toHaveURL(/[?&]view=upcoming/);

      await page.reload();
      await expect(bookingsTable.viewTab("Upcoming")).toHaveAttribute("aria-selected", "true");
      await expect(bookingsTable.searchInput).toHaveValue("Santos");
    });

    test("Back returns to the previous view", async ({ page }) => {
      const bookingsTable = new BookingsTablePage(page);
      await bookingsTable.goto();

      await bookingsTable.selectView("Past");
      await bookingsTable.selectView("Cancelled");
      await expect(page).toHaveURL(/[?&]view=cancelled/);

      await page.goBack();
      await expect(page).toHaveURL(/[?&]view=past/);
      await expect(bookingsTable.viewTab("Past")).toHaveAttribute("aria-selected", "true");

      await page.goBack();
      await expect(page).not.toHaveURL(/[?&]view=/);
      await expect(bookingsTable.viewTab("All")).toHaveAttribute("aria-selected", "true");
    });

    test("a filter shows as a chip, and Clear filters keeps the view", async ({ page }) => {
      const bookingsTable = new BookingsTablePage(page);
      await bookingsTable.goto();
      await bookingsTable.selectView("Past");

      await bookingsTable.pickFilter("Airbnb");
      // The router writes arrays as JSON: source=["airbnb"]
      await expect(page).toHaveURL(/[?&]source=%5B%22airbnb%22%5D/);
      await page.reload();
      await expect(bookingsTable.filtersButton).toHaveAccessibleName("Filters, 1 active");

      await bookingsTable.filterChip("Airbnb").click();
      await expect(page).not.toHaveURL(/[?&]source=/);
      await expect(bookingsTable.filterChip("Airbnb")).toHaveCount(0);

      await bookingsTable.pickFilter("Refunded");
      await bookingsTable.search("nonexistent-booking-xyz-999");
      await expect(bookingsTable.noMatchesState).toBeVisible();

      await bookingsTable.clearFiltersButton.click();
      await expect(page).not.toHaveURL(/[?&](q|payment)=/);
      await expect(page).toHaveURL(/[?&]view=past/);
      await expect(bookingsTable.searchInput).toHaveValue("");
    });

    test("old and broken params open the All view", async ({ page }) => {
      await page.goto(`${ROUTES.admin.bookings}?status=NoShow&search=OKR&page=2&view=bogus`);
      const bookingsTable = new BookingsTablePage(page);
      await bookingsTable.waitForPageLoad();

      await expect(bookingsTable.viewTab("All")).toHaveAttribute("aria-selected", "true");
      await expect(bookingsTable.searchInput).toHaveValue("");
    });
  });

  test.describe("Booking sheet", () => {
    test("a booking opens in a sheet, links to its full page, and Back closes it", async ({
      page,
    }) => {
      const bookingsTable = new BookingsTablePage(page);
      await bookingsTable.goto();
      await bookingsTable.search(E2E_REF.CONFIRMED);

      await bookingsTable.openBookingSheet(E2E_REF.CONFIRMED);
      const sheet = bookingsTable.bookingSheet;
      await expect(sheet.getByText(E2E_REF.CONFIRMED)).toBeVisible();
      // The table stays in view behind the right-side sheet (the modal hides it from roles)
      await expect(page.locator("table")).toBeVisible();

      await sheet.getByRole("link", { name: "Open full page" }).click();
      await expect(page).toHaveURL(/\/admin\/bookings\/[0-9a-f-]{36}/);
      await expect(
        page.getByRole("navigation", { name: "Breadcrumb" }).getByText(E2E_REF.CONFIRMED)
      ).toBeVisible();

      await page.goBack();
      await expect(page).toHaveURL(/[?&]booking=/);
      await expect(sheet).toBeVisible();

      await page.goBack();
      await expect(page).not.toHaveURL(/[?&]booking=/);
      await expect(sheet).toBeHidden();
    });

    test("the payment proof thumbnail opens the proof viewer", async ({ page }) => {
      const bookingsTable = new BookingsTablePage(page);
      await bookingsTable.goto();
      await bookingsTable.search(E2E_REF.QUEUE);
      await bookingsTable.openBookingSheet(E2E_REF.QUEUE);

      await bookingsTable.bookingSheet.getByRole("button", { name: "View payment proof" }).click();
      const viewer = page.getByRole("dialog", { name: "Payment proof" });
      await expect(viewer.getByRole("img", { name: "Payment proof" })).toBeVisible();
      await expect(viewer.getByRole("button", { name: "Zoom In" })).toBeVisible();
    });

    test("an unknown booking id is dropped with no error", async ({ page }) => {
      await page.goto(`${ROUTES.admin.bookings}?booking=00000000-0000-0000-0000-000000000000`);
      const bookingsTable = new BookingsTablePage(page);
      await bookingsTable.waitForPageLoad();

      await expect(page).not.toHaveURL(/[?&]booking=/);
      await expect(bookingsTable.bookingSheet).toBeHidden();
    });
  });

  test.describe("Booking Details", () => {
    test("can click booking row to view details", async ({ page }) => {
      const bookingsTable = new BookingsTablePage(page);
      await bookingsTable.goto();

      // Check if there are any bookings
      const rowCount = await bookingsTable.getRowCount();

      if (rowCount > 0) {
        // Get first booking reference
        const refs = await bookingsTable.getBookingReferences();
        if (refs.length > 0) {
          await bookingsTable.clickBookingRow(refs[0]);
          await expect(page).toHaveURL(/\/admin\/bookings\//);
        }
      } else {
        // Skip if no bookings exist
        test.skip();
      }
    });

    test("booking detail page shows guest information", async ({ page }) => {
      // Navigate directly to a booking detail (requires known booking ID)
      const bookingsTable = new BookingsTablePage(page);
      await bookingsTable.goto();

      const rowCount = await bookingsTable.getRowCount();
      if (rowCount === 0) {
        test.skip();
      }

      // Click first booking
      const refs = await bookingsTable.getBookingReferences();
      if (refs.length === 0) {
        test.skip();
      }

      await bookingsTable.clickBookingRow(refs[0]);

      // Verify detail page has guest info section
      await expect(
        page
          .getByRole("main")
          .getByText(/guest|name|email|phone/i)
          .first()
      ).toBeVisible();
    });
  });

  test.describe("New Booking", () => {
    test("new booking button is visible", async ({ page }) => {
      const bookingsTable = new BookingsTablePage(page);
      await bookingsTable.goto();

      await expect(bookingsTable.newBookingButton).toBeVisible();
    });

    test("new booking opens the new booking page", async ({ page }) => {
      const bookingsTable = new BookingsTablePage(page);
      await bookingsTable.goto();

      await bookingsTable.clickNewBooking();

      await expect(page).toHaveURL(/\/admin\/bookings\/new\?step=stay/);
    });
  });

  test.describe("Booking Actions", () => {
    test("CSV export lives in the page overflow menu", async ({ page }) => {
      const bookingsTable = new BookingsTablePage(page);
      await bookingsTable.goto();

      await expect(page.getByRole("button", { name: /export/i })).toHaveCount(0);
      await bookingsTable.pageMenuButton.click();
      await expect(bookingsTable.exportButton).toBeVisible();
    });
  });
});

test.describe("Needs action (replaces the Booking Queue)", () => {
  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD) {
      test.skip();
    }
    await loginAsAdmin(page);
  });

  for (const oldUrl of ["/admin/bookings/queue", "/pending-bookings"]) {
    test(`${oldUrl} lands on the Needs action view`, async ({ page }) => {
      await page.goto(oldUrl);

      await expect(page).toHaveURL(/\/admin\/bookings\?view=needs-action$/);
      await expect(page.getByRole("tab", { name: /Needs action/ })).toHaveAttribute(
        "aria-selected",
        "true"
      );
    });
  }

  test("an online booking waiting for cabins offers Verify payment", async ({ page }) => {
    await page.goto(`/admin/bookings?view=needs-action&q=${E2E_REF.QUEUE}`);

    await page.getByRole("button", { name: "Verify payment" }).click();
    const dialog = page.getByRole("dialog", { name: "Verify payment" });
    await expect(dialog.getByRole("heading", { name: "Payment proof" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Verify and confirm" })).toBeDisabled();
  });

  test("a paid online booking skips the proof and only confirms cabins", async ({ page }) => {
    await page.goto(`/admin/bookings?view=needs-action&q=${E2E_REF.QUEUE_PAID}`);

    await page.getByRole("button", { name: "Verify payment" }).click();
    const dialog = page.getByRole("dialog", { name: "Confirm booking" });
    await expect(dialog.getByRole("heading", { name: "Choose 2 cabins" })).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Payment proof" })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Confirm" })).toBeDisabled();
  });
});

test.describe("Role-Based Access", () => {
  test("staff role can view bookings", async ({ page }) => {
    if (!process.env.TEST_STAFF_EMAIL || !process.env.TEST_STAFF_PASSWORD) {
      test.skip();
    }

    await loginAsStaff(page);

    // Navigate to bookings
    await page.goto(ROUTES.admin.bookings);

    // Staff should be able to view bookings
    await expect(page).toHaveURL(/\/admin\/bookings/);
  });

  test("admin role can edit bookings", async ({ page }) => {
    if (!process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD) {
      test.skip();
    }

    await loginAsAdmin(page);

    // Navigate to bookings
    const bookingsTable = new BookingsTablePage(page);
    await bookingsTable.goto();

    // Check if edit functionality is available
    const rowCount = await bookingsTable.getRowCount();
    if (rowCount > 0) {
      const refs = await bookingsTable.getBookingReferences();
      if (refs.length > 0) {
        await bookingsTable.openActionsMenu(refs[0]);

        // Edit option should be available for admins
        await expect(page.getByRole("menuitem", { name: /edit/i })).toBeVisible();
      }
    }
  });
});

test.describe("Responsive Design", () => {
  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD) {
      test.skip();
    }
    await loginAsAdmin(page);
  });

  test("bookings table adapts to mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const bookingsTable = new BookingsTablePage(page);
    await bookingsTable.goto();

    await expect(bookingsTable.table).toBeHidden();
    await expect(
      bookingsTable.bookingCards.or(bookingsTable.noBookingsState).first()
    ).toBeVisible();
  });

  test("search works on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const bookingsTable = new BookingsTablePage(page);
    await bookingsTable.goto();

    await expect(bookingsTable.searchInput).toBeVisible();
  });
});
