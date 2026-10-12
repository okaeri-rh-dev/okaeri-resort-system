import { expect, type Locator, type Page } from "@playwright/test";

import { BOOKING_STATUS, PAYMENT_STATUS, ROUTES, TIMEOUTS } from "../fixtures/test-data";

/**
 * Guest information structure
 */
export interface GuestInfo {
  name: string;
  email: string;
  phone: string;
}

/**
 * Page Object Model for the Booking Detail Page
 *
 * Handles viewing and managing individual booking details,
 * including status updates, payment info, and unit assignments.
 */
export class BookingDetailPage {
  readonly page: Page;

  // Page container
  readonly container: Locator;
  readonly pageTitle: Locator;

  // Booking header info
  readonly bookingReference: Locator;
  readonly bookingStatus: Locator;
  readonly paymentStatus: Locator;
  readonly createdDate: Locator;

  // Guest information
  readonly guestSection: Locator;
  readonly guestName: Locator;
  readonly guestEmail: Locator;
  readonly guestPhone: Locator;
  readonly guestCount: Locator;

  // Stay details
  readonly staySection: Locator;
  readonly checkInDate: Locator;
  readonly checkOutDate: Locator;
  readonly numberOfNights: Locator;
  readonly assignedUnits: Locator;

  // Pricing details
  readonly pricingSection: Locator;
  readonly totalAmount: Locator;
  readonly paidAmount: Locator;
  readonly balanceAmount: Locator;
  readonly priceBreakdown: Locator;

  // Payment proof
  readonly paymentProofSection: Locator;
  readonly paymentProofImage: Locator;
  readonly viewProofButton: Locator;

  // Special requests/notes
  readonly notesSection: Locator;
  readonly specialRequests: Locator;
  readonly adminNotes: Locator;

  // Action buttons
  readonly editButton: Locator;
  readonly cancelButton: Locator;
  readonly verifyPaymentButton: Locator;
  readonly assignUnitsButton: Locator;
  readonly checkInButton: Locator;
  readonly checkOutButton: Locator;
  readonly actionsMenu: Locator;

  // Status update
  readonly statusDropdown: Locator;
  readonly saveStatusButton: Locator;

  // History/Timeline
  readonly historySection: Locator;
  readonly historyItems: Locator;

  // Loading and feedback
  readonly loadingState: Locator;
  readonly successMessage: Locator;
  readonly errorMessage: Locator;

  // Navigation
  readonly backButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Page container
    this.container = page.getByTestId("booking-detail");
    this.pageTitle = page.getByRole("heading", { name: /booking|OKR-/i }).first();

    // Booking header info
    this.bookingReference = page.locator(
      '[data-testid="booking-reference"], [class*="booking-ref"], h1:has-text("OKR-")'
    );
    this.bookingStatus = page.locator(
      '[data-testid="booking-status"], [class*="booking-status"] [class*="badge"]'
    );
    this.paymentStatus = page.locator(
      '[data-testid="payment-status"], [class*="payment-status"] [class*="badge"]'
    );
    this.createdDate = page.locator('[data-testid="created-date"], [class*="created-date"]');

    // Guest information
    this.guestSection = page.locator('[data-testid="guest-section"], [class*="guest-info"]');
    this.guestName = page.locator('[data-testid="guest-name"], [class*="guest-name"]');
    this.guestEmail = page.locator(
      '[data-testid="guest-email"], [class*="guest-email"], a[href^="mailto:"]'
    );
    this.guestPhone = page.locator(
      '[data-testid="guest-phone"], [class*="guest-phone"], a[href^="tel:"]'
    );
    this.guestCount = page.locator('[data-testid="guest-count"], [class*="guest-count"]');

    // Stay details
    this.staySection = page.locator('[data-testid="stay-section"], [class*="stay-details"]');
    this.checkInDate = page.locator('[data-testid="check-in-date"], [class*="check-in"]');
    this.checkOutDate = page.locator('[data-testid="check-out-date"], [class*="check-out"]');
    this.numberOfNights = page.locator('[data-testid="nights-count"], [class*="nights"]');
    this.assignedUnits = page.locator('[data-testid="assigned-units"], [class*="assigned-units"]');

    // Pricing details
    this.pricingSection = page.locator('[data-testid="pricing-section"], [class*="pricing"]');
    this.totalAmount = page.locator('[data-testid="total-amount"], [class*="total-amount"]');
    this.paidAmount = page.locator('[data-testid="paid-amount"], [class*="paid-amount"]');
    this.balanceAmount = page.locator('[data-testid="balance-amount"], [class*="balance"]');
    this.priceBreakdown = page.locator('[data-testid="price-breakdown"], [class*="breakdown"]');

    // Payment proof
    this.paymentProofSection = page.locator('[data-testid="payment-proof"], [class*="proof"]');
    this.paymentProofImage = page.locator('[data-testid="proof-image"], img[alt*="proof" i]');
    this.viewProofButton = page.getByRole("button", {
      name: /view.*proof|see.*proof/i,
    });

    // Special requests/notes
    this.notesSection = page.locator('[data-testid="notes-section"], [class*="notes"]');
    this.specialRequests = page.locator(
      '[data-testid="special-requests"], [class*="special-requests"]'
    );
    this.adminNotes = page.locator('[data-testid="admin-notes"], [class*="admin-notes"]');

    // Action buttons
    this.editButton = page.getByRole("button", { name: /edit/i });
    this.cancelButton = page.getByRole("button", { name: /cancel.*booking/i });
    this.verifyPaymentButton = page.getByRole("button", {
      name: /verify.*payment/i,
    });
    this.assignUnitsButton = page.getByRole("button", {
      name: /assign.*unit/i,
    });
    this.checkInButton = page.getByRole("button", { name: /check.?in/i });
    this.checkOutButton = page.getByRole("button", { name: /check.?out/i });
    this.actionsMenu = page.getByRole("button", { name: /actions|more/i });

    // Status update
    this.statusDropdown = page.getByLabel(/status/i);
    this.saveStatusButton = page.getByRole("button", { name: /save.*status/i });

    // History/Timeline
    this.historySection = page.locator(
      '[data-testid="history-section"], [class*="timeline"], [class*="history"]'
    );
    this.historyItems = page.locator('[data-testid="history-item"], [class*="timeline-item"]');

    // Loading and feedback
    this.loadingState = page.locator('[data-testid="loading"], [class*="loading"]');
    this.successMessage = page.locator(
      '[data-testid="success"], [role="alert"]:has-text("success")'
    );
    this.errorMessage = page.locator('[data-testid="error"], [role="alert"]:has-text("error")');

    // Navigation
    this.backButton = page.getByRole("button", { name: /back|return/i });
  }

  /**
   * Navigate to a specific booking's detail page
   */
  async goto(bookingId: string): Promise<void> {
    await this.page.goto(ROUTES.admin.bookingDetail(bookingId));
    await this.waitForPageLoad();
  }

  /**
   * Wait for page to fully load
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState("networkidle");
    // Check each locator independently to avoid strict mode violation
    const containerVisible = await this.container.isVisible().catch(() => false);
    const refVisible = await this.bookingReference.isVisible().catch(() => false);

    if (containerVisible) {
      await expect(this.container).toBeVisible({ timeout: TIMEOUTS.navigation });
    } else if (refVisible) {
      await expect(this.bookingReference).toBeVisible({ timeout: TIMEOUTS.navigation });
    } else {
      // Fallback: wait for page title which contains booking reference
      await expect(this.pageTitle).toBeVisible({ timeout: TIMEOUTS.navigation });
    }
  }

  // ================== Read Booking Info ==================

  /**
   * Get the booking reference
   */
  async getBookingReference(): Promise<string> {
    const text = await this.bookingReference.textContent();
    const match = text?.match(/OKR-[\w-]+/);
    return match ? match[0] : "";
  }

  /**
   * Get the booking status
   */
  async getStatus(): Promise<string> {
    return (await this.bookingStatus.textContent())?.trim().toLowerCase() || "";
  }

  /**
   * Get the payment status
   */
  async getPaymentStatus(): Promise<string> {
    return (await this.paymentStatus.textContent())?.trim().toLowerCase() || "";
  }

  /**
   * Get the total amount
   */
  async getTotalAmount(): Promise<number> {
    const text = await this.fieldValue("Total Amount").textContent();
    const cleaned = text?.replace(/[^\d.-]/g, "") || "0";
    return parseFloat(cleaned);
  }

  /**
   * Get guest information
   */
  async getGuestInfo(): Promise<GuestInfo> {
    const name = (await this.guestName.textContent())?.trim() || "";
    const email = (await this.guestEmail.textContent())?.trim() || "";
    const phone = (await this.guestPhone.textContent())?.trim() || "";

    return { name, email, phone };
  }

  /**
   * Get check-in date
   */
  async getCheckInDate(): Promise<string> {
    return (await this.fieldValue("Check-in Date").textContent())?.trim() || "";
  }

  /**
   * Get check-out date
   */
  async getCheckOutDate(): Promise<string> {
    return (await this.fieldValue("Check-out Date").textContent())?.trim() || "";
  }

  /**
   * Get number of nights
   */
  async getNumberOfNights(): Promise<number> {
    const text = await this.numberOfNights.textContent();
    const match = text?.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }

  /**
   * Get assigned units list
   */
  async getAssignedUnits(): Promise<string[]> {
    return this.fieldValue(/^Cabins?$/)
      .getByRole("link")
      .allTextContents();
  }

  /**
   * Value element of a DetailField, located by its label
   */
  private fieldValue(label: string | RegExp): Locator {
    return this.container
      .getByText(label, { exact: true })
      .locator("xpath=../following-sibling::div[1]");
  }

  // ================== Actions ==================

  /**
   * Edit the booking
   */
  async editBooking(): Promise<void> {
    await this.editButton.click();
    await this.page.waitForURL(/\/edit$/);
  }

  /**
   * Cancel the booking
   */
  async cancelBooking(): Promise<void> {
    await this.cancelButton.click();
    // Handle confirmation dialog
    const confirmButton = this.page.getByRole("button", {
      name: /confirm|yes/i,
    });
    await confirmButton.click();
    await this.successMessage.waitFor({
      state: "visible",
      timeout: TIMEOUTS.medium,
    });
  }

  /**
   * Navigate to verify payment
   */
  async goToVerifyPayment(): Promise<void> {
    await this.verifyPaymentButton.click();
    await this.page.waitForURL(/\/verify-payment/);
  }

  /**
   * Navigate to assign units
   */
  async goToAssignUnits(): Promise<void> {
    await this.assignUnitsButton.click();
    await this.page.waitForURL(/\/assign-units/);
  }

  /**
   * Perform check-in
   */
  async performCheckIn(): Promise<void> {
    await this.checkInButton.click();
    await this.successMessage.waitFor({
      state: "visible",
      timeout: TIMEOUTS.medium,
    });
  }

  /**
   * Perform check-out
   */
  async performCheckOut(): Promise<void> {
    await this.checkOutButton.click();
    await this.successMessage.waitFor({
      state: "visible",
      timeout: TIMEOUTS.medium,
    });
  }

  /**
   * Update booking status via dropdown
   */
  async updateStatus(newStatus: keyof typeof BOOKING_STATUS): Promise<void> {
    await this.statusDropdown.click();
    await this.page.getByRole("option", { name: new RegExp(newStatus, "i") }).click();
    await this.saveStatusButton.click();
    await this.successMessage.waitFor({
      state: "visible",
      timeout: TIMEOUTS.medium,
    });
  }

  /**
   * Go back to bookings list
   */
  async goBack(): Promise<void> {
    await this.backButton.click();
    await this.page.waitForURL(/\/bookings/);
  }

  // ================== Assertions ==================

  /**
   * Verify page loaded correctly
   */
  async expectPageLoaded(): Promise<void> {
    await expect(this.container).toBeVisible();
  }

  /**
   * Verify booking reference matches expected
   */
  async expectBookingReference(reference: string): Promise<void> {
    await expect(this.bookingReference).toContainText(reference);
  }

  /**
   * Verify booking status matches expected
   */
  async expectStatus(status: keyof typeof BOOKING_STATUS): Promise<void> {
    await expect(this.bookingStatus).toContainText(new RegExp(status, "i"));
  }

  /**
   * Verify payment status matches expected
   */
  async expectPaymentStatus(status: keyof typeof PAYMENT_STATUS): Promise<void> {
    await expect(this.paymentStatus).toContainText(new RegExp(status, "i"));
  }

  /**
   * Verify total amount matches expected
   */
  async expectTotalAmount(amount: number, tolerance: number = 1): Promise<void> {
    const actual = await this.getTotalAmount();
    expect(Math.abs(actual - amount)).toBeLessThanOrEqual(tolerance);
  }

  /**
   * Verify guest name matches expected
   */
  async expectGuestName(name: string): Promise<void> {
    await expect(this.guestName).toContainText(name);
  }

  /**
   * Verify edit button is visible
   */
  async expectEditButtonVisible(): Promise<void> {
    await expect(this.editButton).toBeVisible();
  }

  /**
   * Verify edit button is NOT visible (for unauthorized users)
   */
  async expectEditButtonHidden(): Promise<void> {
    await expect(this.editButton).not.toBeVisible();
  }

  /**
   * Verify cancel button is visible
   */
  async expectCancelButtonVisible(): Promise<void> {
    await expect(this.cancelButton).toBeVisible();
  }

  /**
   * Verify cancel button is NOT visible
   */
  async expectCancelButtonHidden(): Promise<void> {
    await expect(this.cancelButton).not.toBeVisible();
  }

  /**
   * Verify units are assigned
   */
  async expectUnitsAssigned(count: number): Promise<void> {
    const units = await this.getAssignedUnits();
    expect(units.length).toBe(count);
  }

  /**
   * Verify specific unit is assigned
   */
  async expectUnitAssigned(unitName: string): Promise<void> {
    await expect(this.fieldValue(/^Cabins?$/)).toContainText(unitName);
  }

  /**
   * Verify booking history shows an event
   */
  async expectHistoryEvent(eventText: string): Promise<void> {
    await expect(this.historySection).toContainText(eventText);
  }

  /**
   * Verify success message
   */
  async expectSuccessMessage(): Promise<void> {
    await expect(this.successMessage).toBeVisible();
  }

  /**
   * Verify error message
   */
  async expectErrorMessage(): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
  }
}
