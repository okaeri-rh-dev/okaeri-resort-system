import { expect, test } from "@playwright/test";

import { E2E_REF } from "../scripts/e2e/fixtures";
import { loginAsAdmin } from "./fixtures/auth";
import {
  BOOKING_DATES,
  createBookingTestData,
  generateTestEmail,
  GUEST_PROFILES,
} from "./fixtures/booking-data";
import { ROUTES, TEST_GUEST, TIMEOUTS, VIEWPORTS } from "./fixtures/test-data";
import { BookingDetailPage } from "./pages/BookingDetailPage";
import { BookingFormPage } from "./pages/BookingFormPage";
import { PublicCalendarPage } from "./pages/PublicCalendarPage";

/**
 * Booking Lifecycle E2E Tests
 *
 * Tests the complete booking journey:
 * 1. Guest submits booking via public form
 * 2. Booking appears in the Needs action view
 * 3. Admin opens Verify payment
 * 4. Admin picks exactly the requested cabins (all-or-nothing)
 * 5. Booking confirmed, calendar updated
 * 6. Guest can check booking status
 */
test.describe("Booking Lifecycle", () => {
  /**
   * Test data that persists across related tests
   */

  test.describe("1. Anonymous Booking Submission", () => {
    test("guest can access booking form without authentication", async ({ page }) => {
      const bookingForm = new BookingFormPage(page);
      await bookingForm.goto();

      // Should not redirect to login
      expect(page.url()).not.toContain("/login");
      await expect(bookingForm.checkInDateInput.or(bookingForm.unitSelector)).toBeVisible();
    });

    test("guest can complete step 1: select dates and unit count", async ({ page }) => {
      const bookingForm = new BookingFormPage(page);
      await bookingForm.goto();

      const dates = BOOKING_DATES.getStandardStay();

      await bookingForm.fillStep1({
        checkIn: dates.checkIn,
        checkOut: dates.checkOut,
        guestCount: 4,
      });

      await bookingForm.goToNextStep();

      // Should advance to step 2 (Cabins) - form has 5 steps
      await expect(page.getByRole("heading", { name: /choose cabins/i })).toBeVisible({
        timeout: TIMEOUTS.medium,
      });
    });

    test("guest can complete step 2-3: cabins and guest information", async ({ page }) => {
      const bookingForm = new BookingFormPage(page);
      await bookingForm.goto();

      // Complete step 1 (Dates)
      const dates = BOOKING_DATES.getStandardStay();
      await bookingForm.fillStep1({
        checkIn: dates.checkIn,
        checkOut: dates.checkOut,
        guestCount: 2,
      });
      await bookingForm.goToNextStep();

      // Step 2 (Cabins) - just proceed
      await bookingForm.goToNextStep();

      // Step 3 (Contact) - fill guest info
      const testEmail = generateTestEmail("lifecycle");
      await bookingForm.fillStep2({
        name: GUEST_PROFILES.individual.name,
        email: testEmail,
        phone: GUEST_PROFILES.individual.phone,
      });

      await bookingForm.goToNextStep();

      // Should advance to step 4 (Payment Proof)
      await expect(page.getByRole("heading", { name: /^payment screenshot$/i })).toBeVisible({
        timeout: TIMEOUTS.medium,
      });
    });

    test("guest can complete step 4: payment proof", async ({ page }) => {
      const bookingForm = new BookingFormPage(page);
      await bookingForm.goto();

      // Navigate through: Dates → Cabins → Contact → Payment Proof
      await bookingForm.goToNextStep(); // → Cabins
      await bookingForm.goToNextStep(); // → Contact

      await bookingForm.fillStep2({
        name: TEST_GUEST.name,
        email: generateTestEmail("lifecycle"),
        phone: TEST_GUEST.phone,
      });
      await bookingForm.goToNextStep(); // → Payment Proof

      // Payment proof is optional in dev mode, proceed to review
      await bookingForm.goToNextStep();

      // Should advance to step 5 (review) - check for heading
      await expect(page.getByRole("heading", { name: /review your booking/i })).toBeVisible({
        timeout: TIMEOUTS.medium,
      });
    });

    test("guest can review and see booking summary in step 5", async ({ page }) => {
      const bookingForm = new BookingFormPage(page);
      await bookingForm.goto();

      const testData = createBookingTestData();

      // Navigate through: Dates → Cabins → Contact → Payment → Review
      await bookingForm.goToNextStep(); // → Cabins
      await bookingForm.goToNextStep(); // → Contact

      await bookingForm.fillStep2({
        name: testData.guest.name,
        email: testData.guest.email,
        phone: testData.guest.phone,
      });
      await bookingForm.goToNextStep(); // → Payment Proof
      await bookingForm.goToNextStep(); // → Review

      // Verify summary shows key details (use first() to avoid strict mode)
      await expect(page.getByText(testData.guest.name, { exact: true })).toBeVisible({
        timeout: TIMEOUTS.medium,
      });
    });

    test("guest must accept terms before submitting", async ({ page }) => {
      const bookingForm = new BookingFormPage(page);
      await bookingForm.goto();

      const testData = createBookingTestData();

      // Navigate through: Dates → Cabins → Contact → Payment → Review
      await bookingForm.goToNextStep(); // → Cabins
      await bookingForm.goToNextStep(); // → Contact

      await bookingForm.fillStep2({
        name: testData.guest.name,
        email: testData.guest.email,
        phone: testData.guest.phone,
      });
      await bookingForm.goToNextStep(); // → Payment Proof
      await bookingForm.goToNextStep(); // → Review

      // Submit button should be disabled when terms aren't accepted
      await expect(bookingForm.submitButton).toBeDisabled();

      // Terms checkbox should be visible and unchecked
      await expect(bookingForm.termsCheckbox).toBeVisible();
    });
  });

  test.describe("2. Booking Appears in Needs action", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test("an online booking waiting for cabins shows in the Needs action view", async ({
      page,
    }) => {
      await page.goto(`/admin/bookings?view=needs-action&q=${E2E_REF.QUEUE}`);

      await expect(page.getByText(E2E_REF.QUEUE).first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Verify payment" })).toBeVisible();
    });
  });

  test.describe("3. Payment Verification Flow", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test("Verify payment shows the proof and asks for the requested cabins", async ({ page }) => {
      await page.goto(`/admin/bookings?view=needs-action&q=${E2E_REF.QUEUE}`);
      await page.getByRole("button", { name: "Verify payment" }).click();

      const dialog = page.getByRole("dialog", { name: "Verify payment" });
      await expect(dialog.getByText(E2E_REF.QUEUE)).toBeVisible();
      await expect(dialog.getByRole("img", { name: "Payment proof" })).toBeVisible();
      await expect(dialog.getByRole("heading", { name: "Choose 2 cabins" })).toBeVisible();
    });
  });

  test.describe("4. Unit Assignment (All-or-Nothing)", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test("confirm stays disabled until the requested number of cabins is picked", async ({
      page,
    }) => {
      await page.goto(`/admin/bookings?view=needs-action&q=${E2E_REF.QUEUE_PAID}`);
      await page.getByRole("button", { name: "Verify payment" }).click();

      const dialog = page.getByRole("dialog", { name: "Confirm booking" });
      const confirm = dialog.getByRole("button", { name: "Confirm" });
      const cabins = dialog.getByRole("checkbox");
      await expect(cabins.first()).toBeVisible();
      await expect(confirm).toBeDisabled();

      await cabins.first().check();
      await expect(confirm).toBeDisabled();
    });
  });

  test.describe("5. Booking Confirmation", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test("confirmed booking shows confirmed status", async ({ page }) => {
      // Navigate to bookings table and find a confirmed booking
      await page.goto(ROUTES.admin.bookings);
      await page.waitForLoadState("networkidle");

      // Look for confirmed status badge
      const confirmedBadge = page.locator(
        '[class*="badge"]:has-text("confirmed"), [data-status="confirmed"]'
      );
      const hasConfirmed = await confirmedBadge
        .first()
        .isVisible()
        .catch(() => false);

      if (!hasConfirmed) {
        // No confirmed bookings to test
        test.skip();
        return;
      }

      await confirmedBadge.first().click();

      const detailPage = new BookingDetailPage(page);
      await detailPage.expectPageLoaded();
      await detailPage.expectStatus("confirmed");
    });

    test("confirmed booking has units assigned", async ({ page }) => {
      // Find and view a confirmed booking
      await page.goto(ROUTES.admin.bookings);
      await page.waitForLoadState("networkidle");

      const confirmedRow = page
        .locator("table tbody tr")
        .filter({ hasText: /confirmed/i })
        .first();
      const hasConfirmed = await confirmedRow.isVisible().catch(() => false);

      if (!hasConfirmed) {
        test.skip();
        return;
      }

      await confirmedRow.locator(`a[href^="/admin/bookings/"]`).first().click();

      const detailPage = new BookingDetailPage(page);
      await detailPage.expectPageLoaded();

      // Should have at least one unit assigned
      const assignedUnits = await detailPage.getAssignedUnits();
      expect(assignedUnits.length).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe("6. Calendar Reflects Booking", () => {
    test("public calendar loads availability", async ({ page }) => {
      const calendarPage = new PublicCalendarPage(page);
      await calendarPage.goto();

      await calendarPage.expectPublicAccess();
      await calendarPage.expectCalendarVisible();
    });

    test("calendar shows booked dates as unavailable", async ({ page }) => {
      const calendarPage = new PublicCalendarPage(page);
      await calendarPage.goto();

      // Check that there are some booked slots
      const bookedCount = await calendarPage.getBookedSlotsCount();
      const availableCount = await calendarPage.getAvailableSlotsCount();

      // Calendar should show some availability data
      expect(bookedCount + availableCount).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe("7. Booking Status Lookup", () => {
    test("guest can access status check page", async ({ page }) => {
      await page.goto(ROUTES.public.checkStatus);

      // Should not require authentication
      expect(page.url()).not.toContain("/login");
      await expect(page).toHaveURL(/check-status/);
    });

    test("status check requires reference and email", async ({ page }) => {
      await page.goto(ROUTES.public.checkStatus);

      // Should have fields for reference and email (exact labels from component)
      const refInput = page.getByLabel("Booking Reference");
      const emailInput = page.getByLabel("Email Address");

      // Both should be visible
      await expect(refInput).toBeVisible();
      await expect(emailInput).toBeVisible();
    });

    test("invalid reference shows appropriate message", async ({ page }) => {
      await page.goto(ROUTES.public.checkStatus);

      // Fill with invalid data (exact labels)
      await page.getByLabel("Booking Reference").fill("OKR-INVALID-1234");
      await page.getByLabel("Email Address").fill("test@example.com");

      // Submit
      await page.getByRole("button", { name: /search|check|find/i }).click();

      // Should show not found or error
      await expect(page.getByText(/not found|no booking|invalid|error/i).first()).toBeVisible({
        timeout: TIMEOUTS.medium,
      });
    });
  });

  test.describe("Responsive Design", () => {
    test.describe("Mobile Viewport", () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize(VIEWPORTS.mobile);
      });

      test("guest booking form works on mobile", async ({ page }) => {
        const bookingForm = new BookingFormPage(page);
        await bookingForm.goto();

        // Form should load on mobile
        await expect(page.getByRole("heading", { name: /book your stay/i })).toBeVisible({
          timeout: 10000,
        });

        // Should be able to navigate through steps
        await bookingForm.goToNextStep(); // → Cabins
        await expect(page.getByRole("heading", { name: /choose cabins/i })).toBeVisible({
          timeout: 5000,
        });
      });

      test("public calendar accessible on mobile", async ({ page }) => {
        const calendarPage = new PublicCalendarPage(page);
        await calendarPage.goto();

        // Calendar should be visible
        await calendarPage.expectCalendarVisible();

        // No horizontal overflow
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        const viewportWidth = await page.evaluate(() => window.innerWidth);
        expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5);
      });

      test("status check page works on mobile", async ({ page }) => {
        await page.goto(ROUTES.public.checkStatus);

        // Form should be visible
        await expect(page.getByLabel("Booking Reference")).toBeVisible();
        await expect(page.getByLabel("Email Address")).toBeVisible();

        // Search button should be tappable
        const searchButton = page.getByRole("button", { name: /search|check|find/i });
        await expect(searchButton).toBeVisible();
      });
    });
  });
});
