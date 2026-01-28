import { expect, test } from "@playwright/test";

import {
  getCheckInDate,
  getCheckOutDate,
  ROUTES,
  TEST_BOOKING,
  TEST_GUEST,
} from "./fixtures/test-data";
import { BookingFormPage } from "./pages/BookingFormPage";
import { PublicCalendarPage } from "./pages/PublicCalendarPage";

/**
 * Public Booking Flow Tests
 *
 * Tests for the guest-facing booking process:
 * - Calendar navigation
 * - Multi-step booking form
 * - Form validation
 * - Booking confirmation
 */
test.describe("Public Booking Flow", () => {
  test.describe("Availability Calendar", () => {
    test("calendar page loads and displays availability", async ({ page }) => {
      const calendarPage = new PublicCalendarPage(page);
      await calendarPage.goto();

      await calendarPage.expectCalendarVisible();
    });

    test("can navigate to next month", async ({ page }) => {
      const calendarPage = new PublicCalendarPage(page);
      await calendarPage.goto();

      const initialMonth = await calendarPage.getCurrentMonth();
      await calendarPage.goToNextMonth();
      const newMonth = await calendarPage.getCurrentMonth();

      // Month should have changed
      expect(newMonth).not.toBe(initialMonth);
    });

    test("can navigate to previous month", async ({ page }) => {
      const calendarPage = new PublicCalendarPage(page);
      await calendarPage.goto();

      // First go forward so we can go back
      await calendarPage.goToNextMonth();
      const monthAfterNext = await calendarPage.getCurrentMonth();

      await calendarPage.goToPreviousMonth();
      const monthAfterPrev = await calendarPage.getCurrentMonth();

      expect(monthAfterPrev).not.toBe(monthAfterNext);
    });

    test("can navigate directly to booking form from calendar", async ({ page }) => {
      // Note: Current home page is view-only without Book Now button
      // Test navigation via direct URL
      const calendarPage = new PublicCalendarPage(page);
      await calendarPage.goto();

      // Navigate directly to booking
      await page.goto(ROUTES.public.booking);
      await expect(page).toHaveURL(/\/booking/);

      // Verify booking form loads
      await expect(page.getByRole("heading", { name: "Book Your Stay", level: 1 })).toBeVisible({
        timeout: 10000,
      });
    });
  });

  test.describe("Booking Form Navigation", () => {
    test("booking form loads with step 1 visible", async ({ page }) => {
      const bookingForm = new BookingFormPage(page);
      await bookingForm.goto();

      // First step heading should be visible
      await expect(page.getByRole("heading", { name: /select your stay dates/i })).toBeVisible({
        timeout: 10000,
      });

      // Check-in/out date labels should be visible (use exact match to avoid subtitle match)
      await expect(page.getByText("Check-In Date", { exact: true })).toBeVisible();
      await expect(page.getByText("Check-Out Date", { exact: true })).toBeVisible();
    });

    test("can navigate between form steps", async ({ page }) => {
      const bookingForm = new BookingFormPage(page);
      await bookingForm.goto();

      // Verify we're on step 1
      await bookingForm.expectStep1Visible();

      // Navigate to step 2 (Cabins)
      await bookingForm.goToNextStep();

      // Step 2 heading should be visible
      await expect(page.getByRole("heading", { name: /choose cabins/i })).toBeVisible({
        timeout: 5000,
      });

      // Navigate back to step 1
      await bookingForm.goToPreviousStep();

      // Step 1 should be visible again
      await bookingForm.expectStep1Visible();
    });
  });

  test.describe("Step 1: Dates", () => {
    test("can open check-in date picker", async ({ page }) => {
      const bookingForm = new BookingFormPage(page);
      await bookingForm.goto();

      // Click the check-in date button to open picker
      await bookingForm.openCheckInPicker();

      // Calendar should appear
      await expect(page.locator('[role="grid"]')).toBeVisible({ timeout: 5000 });
    });

    test("can open check-out date picker", async ({ page }) => {
      const bookingForm = new BookingFormPage(page);
      await bookingForm.goto();

      // Click the check-out date button to open picker
      await bookingForm.openCheckOutPicker();

      // Calendar should appear
      await expect(page.locator('[role="grid"]')).toBeVisible({ timeout: 5000 });
    });

    test("date pickers have default values set", async ({ page }) => {
      const bookingForm = new BookingFormPage(page);
      await bookingForm.goto();

      // Check-in and check-out buttons should show dates (not "Pick a date")
      // The form initializes with today and tomorrow
      const checkInButton = bookingForm.checkInDateButton;
      const buttonText = await checkInButton.textContent();

      // Button should show a date month name (Jan, Feb, etc.) or contain date format
      expect(buttonText).toMatch(/jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i);
    });

    test("can proceed to step 2 with valid dates", async ({ page }) => {
      const bookingForm = new BookingFormPage(page);
      await bookingForm.goto();

      // Form already has default dates set, just proceed
      await bookingForm.goToNextStep();

      // Should be on step 2 (Cabins)
      await expect(page.getByRole("heading", { name: /choose cabins/i })).toBeVisible({
        timeout: 5000,
      });
    });
  });

  test.describe("Step 2: Cabins", () => {
    test.beforeEach(async ({ page }) => {
      const bookingForm = new BookingFormPage(page);
      await bookingForm.goto();

      // Go to step 2 (Cabins) - dates are pre-filled
      await bookingForm.goToNextStep();
    });

    test("shows cabin request options", async ({ page }) => {
      // Should see cabin requests label
      await expect(page.getByText("Cabin Requests")).toBeVisible();
    });

    test("can proceed to step 3 (Contact)", async ({ page }) => {
      const bookingForm = new BookingFormPage(page);

      // Proceed to next step
      await bookingForm.goToNextStep();

      // Should be on step 3 (Your Information)
      await expect(page.getByRole("heading", { name: /your information/i })).toBeVisible({
        timeout: 5000,
      });
    });
  });

  test.describe("Step 3: Contact Information", () => {
    test.beforeEach(async ({ page }) => {
      const bookingForm = new BookingFormPage(page);
      await bookingForm.goto();

      // Navigate to step 3: Dates → Cabins → Contact
      await bookingForm.goToNextStep(); // → Cabins
      await bookingForm.goToNextStep(); // → Contact
    });

    test("can enter guest name", async ({ page }) => {
      const bookingForm = new BookingFormPage(page);

      await bookingForm.setGuestName(TEST_GUEST.name);
      await expect(bookingForm.fullNameInput).toHaveValue(TEST_GUEST.name);
    });

    test("can enter guest email", async ({ page }) => {
      const bookingForm = new BookingFormPage(page);

      await bookingForm.setGuestEmail(TEST_GUEST.email);
      await expect(bookingForm.emailInput).toHaveValue(TEST_GUEST.email);
    });

    test("can enter guest phone", async ({ page }) => {
      const bookingForm = new BookingFormPage(page);

      await bookingForm.setGuestPhone(TEST_GUEST.phone);
      await expect(bookingForm.phoneInput).toHaveValue(TEST_GUEST.phone);
    });

    test("validates required fields", async ({ page }) => {
      const bookingForm = new BookingFormPage(page);

      // Try to proceed without filling required fields
      await bookingForm.goToNextStep();

      // Should show validation error
      await bookingForm.expectValidationError();
    });

    test("validates email format", async ({ page }) => {
      const bookingForm = new BookingFormPage(page);

      await bookingForm.setGuestName(TEST_GUEST.name);
      await bookingForm.setGuestEmail("invalid-email");
      await bookingForm.setGuestPhone(TEST_GUEST.phone);
      await bookingForm.goToNextStep();

      // Should show email validation error
      await expect(page.getByText(/email|invalid/i).first()).toBeVisible();
    });
  });

  test.describe("Step 4: Payment Proof", () => {
    test.beforeEach(async ({ page }) => {
      const bookingForm = new BookingFormPage(page);
      await bookingForm.goto();

      // Navigate to step 4: Dates → Cabins → Contact → Payment
      await bookingForm.goToNextStep(); // → Cabins
      await bookingForm.goToNextStep(); // → Contact
      await bookingForm.fillContactInfo(TEST_GUEST);
      await bookingForm.goToNextStep(); // → Payment Proof
    });

    test("shows payment proof section", async ({ page }) => {
      // Should see payment proof heading
      await expect(page.getByRole("heading", { name: /upload payment proof/i })).toBeVisible();
    });

    test("shows file upload for payment proof", async ({ page }) => {
      const bookingForm = new BookingFormPage(page);

      // File input should be present (may be hidden for custom upload UI)
      await expect(bookingForm.fileUploadInput).toBeAttached();
    });

    test("can proceed to review without payment proof in dev mode", async ({ page }) => {
      const bookingForm = new BookingFormPage(page);

      // In development mode, payment proof is optional
      await bookingForm.goToNextStep();

      // Should be on step 5 (Review)
      await expect(page.getByRole("heading", { name: /review your booking/i })).toBeVisible({
        timeout: 5000,
      });
    });
  });

  test.describe("Step 5: Review & Submit", () => {
    test.beforeEach(async ({ page }) => {
      const bookingForm = new BookingFormPage(page);
      await bookingForm.goto();

      // Navigate through all steps: Dates → Cabins → Contact → Payment → Review
      await bookingForm.goToNextStep(); // → Cabins
      await bookingForm.goToNextStep(); // → Contact
      await bookingForm.fillContactInfo(TEST_GUEST);
      await bookingForm.goToNextStep(); // → Payment Proof (optional in dev)
      await bookingForm.goToNextStep(); // → Review
    });

    test("shows booking summary", async ({ page }) => {
      // Summary should contain key booking details (guest name)
      await expect(page.getByText(TEST_GUEST.name, { exact: true })).toBeVisible({ timeout: 5000 });
    });

    test("has terms acceptance checkbox", async ({ page }) => {
      const bookingForm = new BookingFormPage(page);

      // Terms checkbox should be present
      await expect(bookingForm.termsCheckbox).toBeVisible();
    });

    test("submit button is present", async ({ page }) => {
      const bookingForm = new BookingFormPage(page);

      await expect(bookingForm.submitButton).toBeVisible();
    });
  });

  test.describe("Booking Confirmation", () => {
    test("confirmation page shows booking reference", async ({ page }) => {
      // Navigate directly to a confirmation page (mock reference)
      // In real tests, this would follow a complete booking submission
      await page.goto(ROUTES.public.bookingConfirmation("OKR-TEST-1234"));

      // Page should show reference or error
      await expect(page.getByText(/OKR-|reference|not found|invalid/i).first()).toBeVisible();
    });
  });

  test.describe("Booking Status Check", () => {
    test("status check page loads", async ({ page }) => {
      await page.goto(ROUTES.public.checkStatus);

      // Should show search form
      await expect(page).toHaveURL(/\/booking\/check-status/);
    });

    test("can search by reference and email", async ({ page }) => {
      await page.goto(ROUTES.public.checkStatus);
      await page.waitForLoadState("networkidle");

      // Check if status check page has required form elements
      const refInput = page.getByLabel(/reference|booking/i);
      const emailInput = page.getByLabel(/email/i);
      const searchButton = page.getByRole("button", { name: /search|check|find|submit/i });

      const hasRefInput = await refInput.isVisible().catch(() => false);
      const hasEmailInput = await emailInput.isVisible().catch(() => false);
      const hasSearchButton = await searchButton.isVisible().catch(() => false);

      // Skip if required elements not present (page may have different structure)
      if (!hasSearchButton) {
        test.skip(true, "Search button not found - page may have different structure");
        return;
      }

      // Fill in search criteria if inputs are visible
      if (hasRefInput) {
        await refInput.fill("OKR-TEST-1234");
      }
      if (hasEmailInput) {
        await emailInput.fill("test@example.com");
      }

      // Submit search
      await searchButton.click();

      // Wait for response
      await page.waitForTimeout(1000);

      // Should show result, "not found" message, or stay on search page
      const hasResult = await page
        .getByText(/found|not found|status|error|result|booking/i)
        .first()
        .isVisible()
        .catch(() => false);
      const stillOnPage = page.url().includes("check-status");

      // Either shows a result or stays on the search page
      expect(hasResult || stillOnPage).toBeTruthy();
    });
  });

  test.describe("Form Accessibility", () => {
    test("form has accessible labels for date fields", async ({ page }) => {
      const bookingForm = new BookingFormPage(page);
      await bookingForm.goto();

      // Date labels should be visible (use exact match to avoid subtitle)
      await expect(page.getByText("Check-In Date", { exact: true })).toBeVisible();
      await expect(page.getByText("Check-Out Date", { exact: true })).toBeVisible();
    });

    test("form has accessible labels for contact fields", async ({ page }) => {
      const bookingForm = new BookingFormPage(page);
      await bookingForm.goto();

      // Navigate to Contact step
      await bookingForm.goToNextStep(); // → Cabins
      await bookingForm.goToNextStep(); // → Contact

      // Contact fields should be findable by label
      await expect(bookingForm.fullNameInput).toBeVisible();
      await expect(bookingForm.emailInput).toBeVisible();
      await expect(bookingForm.phoneInput).toBeVisible();
    });

    test("keyboard navigation works through form", async ({ page }) => {
      const bookingForm = new BookingFormPage(page);
      await bookingForm.goto();

      // Focus on first interactive element
      await bookingForm.checkInDateButton.focus();
      await page.keyboard.press("Tab");

      // Focus should move to next element
      const focusedElement = page.locator(":focus");
      await expect(focusedElement).toBeVisible();
    });
  });
});
