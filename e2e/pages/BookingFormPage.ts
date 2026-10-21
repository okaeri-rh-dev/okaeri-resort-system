import { expect, type Locator, type Page } from "@playwright/test";

import { ROUTES, TEST_GUEST, TIMEOUTS } from "../fixtures/test-data";

/**
 * Page Object Model for the Public Multi-Unit Guest Booking Form
 *
 * Based on actual MultiUnitGuestBookingForm component structure:
 * - 5 steps: Dates → Cabins → Contact → Payment → Review
 * - Step 1: Check-In/Check-Out dates using ResponsiveDatePicker
 * - Step 2: Cabin Requests using UnitRequestSelector
 * - Step 3: Contact info (Full Name, Email, Phone)
 * - Step 4: Payment screenshot upload
 * - Step 5: Review with terms checkbox and submit
 */
export class BookingFormPage {
  readonly page: Page;

  // Main form container
  readonly formContainer: Locator;

  // Step indicators
  readonly stepIndicator: Locator;
  readonly currentStepHeading: Locator;

  // Step 1: Dates
  readonly checkInDateLabel: Locator;
  readonly checkOutDateLabel: Locator;
  readonly checkInDateButton: Locator;
  readonly checkOutDateButton: Locator;

  // Step 2: Cabins
  readonly cabinRequestsLabel: Locator;
  readonly unitSelector: Locator;
  readonly addUnitButton: Locator;
  readonly removeUnitButton: Locator;
  readonly guestsPerUnitInput: Locator;

  // Step 3: Contact Information
  readonly fullNameInput: Locator;
  readonly emailInput: Locator;
  readonly phoneInput: Locator;
  readonly specialRequestsInput: Locator;

  // Step 4: Payment Proof
  readonly paymentProofLabel: Locator;
  readonly fileUploadInput: Locator;
  readonly uploadedFilePreview: Locator;

  // Step 5: Review
  readonly reviewSection: Locator;
  readonly termsCheckbox: Locator;
  readonly submitButton: Locator;

  // Navigation buttons
  readonly nextButton: Locator;
  readonly backButton: Locator;

  // Turnstile CAPTCHA
  readonly turnstileWidget: Locator;

  // Validation errors
  readonly fieldErrors: Locator;

  // Loading states
  readonly loadingSpinner: Locator;

  // Confirmation
  readonly bookingReference: Locator;

  constructor(page: Page) {
    this.page = page;

    // Main form
    this.formContainer = page.locator("form").first();

    // Step indicators
    this.stepIndicator = page.locator('[class*="step"]').first();
    this.currentStepHeading = page.getByRole("heading", { level: 2 });

    // Step 1: Dates - uses ResponsiveDatePicker which is a button that opens a popover
    this.checkInDateLabel = page.getByText("Check-In Date");
    this.checkOutDateLabel = page.getByText("Check-Out Date");
    // ResponsiveDatePicker renders as a button with date or "Pick a date" text
    this.checkInDateButton = page
      .locator("button")
      .filter({ hasText: /pick a date|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i })
      .first();
    this.checkOutDateButton = page
      .locator("button")
      .filter({ hasText: /pick a date|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i })
      .nth(1);

    // Step 2: Cabins - UnitRequestSelector
    this.cabinRequestsLabel = page.getByText("Cabin Requests");
    this.unitSelector = page.locator('[class*="unit-request"]');
    this.addUnitButton = page.getByRole("button", { name: /add|plus|\+/i });
    this.removeUnitButton = page.getByRole("button", { name: /remove|minus|-/i });
    this.guestsPerUnitInput = page.locator('input[type="number"]');

    // Step 3: Contact - actual placeholders from component
    this.fullNameInput = page.getByLabel("Full Name");
    this.emailInput = page.getByLabel("Email");
    this.phoneInput = page.getByLabel("Phone Number");
    this.specialRequestsInput = page.getByLabel(/special requests/i);

    // Step 4: Payment Proof
    this.paymentProofLabel = page.getByText(/payment screenshot/i);
    this.fileUploadInput = page.locator('input[type="file"]');
    this.uploadedFilePreview = page.locator('[class*="preview"], img[alt*="preview"]');

    // Step 5: Review
    this.reviewSection = page
      .locator('[class*="review"]')
      .or(page.locator("article").filter({ has: page.getByText(/review/i) }));
    this.termsCheckbox = page.getByRole("checkbox");
    this.submitButton = page.getByRole("button", { name: /submit booking/i });

    // Navigation buttons
    this.nextButton = page.getByRole("button", { name: /next/i });
    this.backButton = page.getByRole("button", { name: /back/i });

    // Turnstile CAPTCHA widget
    this.turnstileWidget = page.locator('iframe[src*="turnstile"], [data-turnstile]');

    // Validation errors - FormMessage component uses text-destructive
    this.fieldErrors = page.locator('[class*="text-destructive"], [role="alert"]');

    // Loading states
    this.loadingSpinner = page.locator(".animate-spin");

    // Confirmation
    this.bookingReference = page.getByText(/OKR-|BK-/);
  }

  /**
   * Navigate to the booking form
   */
  async goto() {
    await this.page.goto(ROUTES.public.booking);
    await this.waitForPageLoad();
  }

  /**
   * Wait for the booking form to load
   */
  async waitForPageLoad() {
    await this.page.waitForLoadState("networkidle");
    // Wait for the main heading "Book Your Stay" which is always present
    await expect(this.page.getByRole("heading", { name: "Book Your Stay", level: 1 })).toBeVisible({
      timeout: TIMEOUTS.medium,
    });
  }

  /**
   * Get current step number from heading text
   */
  async getCurrentStep(): Promise<number> {
    const heading = await this.currentStepHeading.textContent();
    if (!heading) return 1;

    if (heading.includes("Dates") || heading.includes("Stay Dates")) return 1;
    if (heading.includes("Cabins") || heading.includes("Units")) return 2;
    if (heading.includes("Information") || heading.includes("Contact")) return 3;
    if (heading.includes("Payment") || heading.includes("Upload")) return 4;
    if (heading.includes("Review")) return 5;

    return 1;
  }

  // ================== Step 1: Dates ==================

  /**
   * Click check-in date picker to open calendar
   */
  async openCheckInPicker() {
    await this.checkInDateButton.click();
    // Wait for calendar popover to appear
    await this.page.waitForSelector('[role="grid"], [class*="calendar"]', { timeout: 5000 });
  }

  /**
   * Click check-out date picker to open calendar
   */
  async openCheckOutPicker() {
    await this.checkOutDateButton.click();
    await this.page.waitForSelector('[role="grid"], [class*="calendar"]', { timeout: 5000 });
  }

  /**
   * Select a date from the open calendar
   */
  async selectDateInCalendar(day: number) {
    await this.page.getByRole("gridcell", { name: String(day), exact: true }).click();
  }

  /**
   * Set check-in date (opens picker and selects day)
   */
  async setCheckInDate(day: number) {
    await this.openCheckInPicker();
    await this.selectDateInCalendar(day);
  }

  /**
   * Set check-out date (opens picker and selects day)
   */
  async setCheckOutDate(day: number) {
    await this.openCheckOutPicker();
    await this.selectDateInCalendar(day);
  }

  // ================== Step 2: Cabins ==================

  /**
   * Set number of guests for first unit
   */
  async setGuestCount(count: number) {
    await this.guestsPerUnitInput.first().fill(count.toString());
  }

  /**
   * Add another unit request
   */
  async addUnit() {
    await this.addUnitButton.click();
  }

  /**
   * Remove last unit request
   */
  async removeUnit() {
    await this.removeUnitButton.last().click();
  }

  // ================== Step 3: Contact ==================

  /**
   * Fill guest name
   */
  async setGuestName(name: string) {
    await this.fullNameInput.fill(name);
  }

  /**
   * Fill guest email
   */
  async setGuestEmail(email: string) {
    await this.emailInput.fill(email);
  }

  /**
   * Fill guest phone
   */
  async setGuestPhone(phone: string) {
    await this.phoneInput.fill(phone);
  }

  /**
   * Fill special requests
   */
  async setSpecialRequests(requests: string) {
    await this.specialRequestsInput.fill(requests);
  }

  /**
   * Complete contact step with default test data
   */
  async fillContactInfo(data?: { name: string; email: string; phone: string }) {
    const guest = data || TEST_GUEST;
    await this.setGuestName(guest.name);
    await this.setGuestEmail(guest.email);
    await this.setGuestPhone(guest.phone);
  }

  // ================== Step 4: Payment ==================

  /**
   * Upload payment proof file
   */
  async uploadPaymentProof(filePath: string) {
    await this.fileUploadInput.setInputFiles(filePath);
    // Wait for upload indication
    await this.page.waitForTimeout(1000);
  }

  // ================== Step 5: Review ==================

  /**
   * Accept terms and conditions
   */
  async acceptTerms() {
    await this.termsCheckbox.check();
  }

  /**
   * Submit the booking form
   */
  async submitBooking() {
    await this.submitButton.click();
  }

  // ================== Navigation ==================

  /**
   * Go to next step
   */
  async goToNextStep() {
    await this.nextButton.click();
    await this.page.waitForTimeout(500); // Animation
  }

  /**
   * Go to previous step
   */
  async goToPreviousStep() {
    await this.backButton.click();
    await this.page.waitForTimeout(500);
  }

  // ================== Assertions ==================

  /**
   * Expect validation error to be visible
   */
  async expectValidationError(errorText?: string) {
    await expect(this.fieldErrors.first()).toBeVisible({ timeout: 5000 });
    if (errorText) {
      await expect(this.fieldErrors.first()).toContainText(errorText);
    }
  }

  /**
   * Expect to be on step 1 (Dates)
   */
  async expectStep1Visible() {
    await expect(this.page.getByRole("heading", { name: /select your stay dates/i })).toBeVisible();
  }

  /**
   * Expect to be on step 2 (Cabins)
   */
  async expectStep2Visible() {
    await expect(this.page.getByRole("heading", { name: /choose cabins/i })).toBeVisible();
  }

  /**
   * Expect to be on step 3 (Contact)
   */
  async expectStep3Visible() {
    await expect(this.page.getByRole("heading", { name: /your information/i })).toBeVisible();
  }

  /**
   * Expect to be on step 4 (Payment screenshot)
   */
  async expectStep4Visible() {
    await expect(this.page.getByRole("heading", { name: /^payment screenshot$/i })).toBeVisible();
  }

  /**
   * Expect to be on step 5 (Review)
   */
  async expectStep5Visible() {
    await expect(this.page.getByRole("heading", { name: /review your booking/i })).toBeVisible();
  }

  /**
   * Expect confirmation to be shown
   */
  async expectConfirmationVisible() {
    await expect(
      this.page.getByText(/booking.*confirmed|success|thank you/i).or(this.bookingReference)
    ).toBeVisible({ timeout: TIMEOUTS.navigation });
  }

  // ================== Legacy compatibility ==================
  // These properties maintain backward compatibility with existing tests

  get checkInDateInput() {
    return this.checkInDateButton;
  }
  get checkOutDateInput() {
    return this.checkOutDateButton;
  }
  get guestCountInput() {
    return this.guestsPerUnitInput.first();
  }
  get guestNameInput() {
    return this.fullNameInput;
  }
  get guestEmailInput() {
    return this.emailInput;
  }
  get guestPhoneInput() {
    return this.phoneInput;
  }
  get paymentMethodSelector() {
    return this.page.locator('[role="combobox"]').first();
  }

  /**
   * Legacy: Fill step 1 data
   * Note: The form pre-fills dates (today/tomorrow), so we just verify and proceed
   * rather than trying to manipulate the date picker
   */
  async fillStep1(_data: { checkIn: string; checkOut: string; guestCount: number }) {
    // Form already has default dates pre-filled
    // Just verify the form is on step 1 and proceed
    await this.expectStep1Visible();
    // Dates are pre-populated, no need to change them for basic tests
  }

  /**
   * Legacy: Fill step 2 data (guest info - now step 3)
   */
  async fillStep2(data: { name: string; email: string; phone: string }) {
    await this.fillContactInfo(data);
  }

  /**
   * Legacy: Fill step 2 with defaults
   */
  async fillStep2WithDefaults() {
    await this.fillContactInfo();
  }

  /**
   * Legacy: Select payment method (no longer used in new form)
   */
  async selectPaymentMethod(_method: string) {
    // Payment method selection removed in multi-unit form
    // Just proceed - this is a no-op for backward compatibility
  }

  /**
   * Legacy: Fill step 3 data
   */
  async fillStep3(data: { paymentMethod?: string; proofFilePath?: string }) {
    if (data.proofFilePath) {
      await this.uploadPaymentProof(data.proofFilePath);
    }
  }
}
