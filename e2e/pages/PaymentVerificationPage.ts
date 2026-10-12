import { expect, type Locator, type Page } from "@playwright/test";

import { ROUTES, TIMEOUTS } from "../fixtures/test-data";

/**
 * Page Object Model for the Payment Verification Page
 *
 * Handles admin payment review workflows including viewing payment proof,
 * verifying or rejecting payments, and adding notes.
 */
export class PaymentVerificationPage {
  readonly page: Page;

  // Page container
  readonly container: Locator;
  readonly pageTitle: Locator;

  // Booking info
  readonly bookingReference: Locator;
  readonly bookingAmount: Locator;
  readonly guestName: Locator;
  readonly paymentMethod: Locator;

  // Payment proof
  readonly paymentProofContainer: Locator;
  readonly paymentProofImage: Locator;
  readonly paymentProofPdf: Locator;
  readonly viewFullSizeButton: Locator;
  readonly downloadProofButton: Locator;

  // Payment status
  readonly currentStatus: Locator;
  readonly statusBadge: Locator;

  // Verification actions
  readonly verifyButton: Locator;
  readonly rejectButton: Locator;
  readonly requestMoreInfoButton: Locator;

  // Rejection modal
  readonly rejectionModal: Locator;
  readonly rejectionReasonInput: Locator;
  readonly confirmRejectButton: Locator;
  readonly cancelRejectButton: Locator;

  // Notes section
  readonly notesInput: Locator;
  readonly saveNotesButton: Locator;
  readonly notesHistory: Locator;

  // Loading and feedback
  readonly loadingState: Locator;
  readonly successMessage: Locator;
  readonly errorMessage: Locator;

  // Navigation
  readonly backToQueueButton: Locator;
  readonly viewBookingButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Page container
    this.container = page.getByTestId("payment-verification");
    this.pageTitle = page.getByRole("heading", { name: /payment|verify/i });

    // Booking info
    this.bookingReference = this.container.getByText(/^Booking: /);
    this.bookingAmount = page.locator('[data-testid="booking-amount"], [class*="total-amount"]');
    this.guestName = page.locator('[data-testid="guest-name"], [class*="guest-name"]');
    this.paymentMethod = page.locator('[data-testid="payment-method"], [class*="payment-method"]');

    // Payment proof
    this.paymentProofContainer = page.locator(
      '[data-testid="payment-proof"], [class*="proof-container"]'
    );
    this.paymentProofImage = page.locator(
      '[data-testid="proof-image"], img[alt*="proof" i], img[alt*="receipt" i]'
    );
    this.paymentProofPdf = page.locator(
      '[data-testid="proof-pdf"], iframe[src*="pdf"], embed[type="application/pdf"]'
    );
    this.viewFullSizeButton = page.getByRole("button", {
      name: /full size|enlarge|zoom/i,
    });
    this.downloadProofButton = page.getByRole("button", {
      name: /download/i,
    });

    // Payment status
    this.currentStatus = page.locator('[data-testid="payment-status"], [class*="payment-status"]');
    this.statusBadge = page.locator('[data-testid="status-badge"], [class*="badge"]');

    // Verification actions
    this.verifyButton = page.getByRole("button", {
      name: /verify|approve|confirm payment/i,
    });
    this.rejectButton = page.getByRole("button", {
      name: /reject|decline/i,
    });
    this.requestMoreInfoButton = page.getByRole("button", {
      name: /request.*info|need.*info/i,
    });

    // Rejection modal
    this.rejectionModal = page.locator('[data-testid="rejection-modal"], [role="dialog"]');
    this.rejectionReasonInput = page.getByLabel(/reason|note/i);
    this.confirmRejectButton = page.locator(
      '[data-testid="confirm-reject"], button:has-text("Confirm Rejection")'
    );
    this.cancelRejectButton = page.locator(
      '[data-testid="cancel-reject"], button:has-text("Cancel")'
    );

    // Notes section
    this.notesInput = page.getByLabel(/notes|comment/i);
    this.saveNotesButton = page.getByRole("button", { name: /save note/i });
    this.notesHistory = page.locator('[data-testid="notes-history"], [class*="notes-list"]');

    // Loading and feedback
    this.loadingState = page.locator('[data-testid="loading"], [class*="loading"]');
    this.successMessage = page.locator(
      '[data-testid="success"], [class*="success"], [role="alert"]:has-text("success")'
    );
    this.errorMessage = page.locator(
      '[data-testid="error"], [class*="error"], [role="alert"]:has-text("error")'
    );

    // Navigation
    this.backToQueueButton = page.getByRole("button", {
      name: /back.*queue|return/i,
    });
    this.viewBookingButton = page.getByRole("link", {
      name: /view booking|booking details/i,
    });
  }

  /**
   * Navigate to payment verification for a specific booking
   */
  async goto(bookingId: string): Promise<void> {
    await this.page.goto(ROUTES.admin.verifyPayment(bookingId));
    await this.waitForPageLoad();
  }

  /**
   * Wait for page to fully load
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState("networkidle");
    // Check each locator independently to avoid strict mode violation
    const containerVisible = await this.container.isVisible().catch(() => false);
    const proofVisible = await this.paymentProofContainer.isVisible().catch(() => false);

    if (containerVisible) {
      await expect(this.container).toBeVisible({ timeout: TIMEOUTS.navigation });
    } else if (proofVisible) {
      await expect(this.paymentProofContainer).toBeVisible({ timeout: TIMEOUTS.navigation });
    } else {
      // Fallback: wait for page title
      await expect(this.pageTitle).toBeVisible({ timeout: TIMEOUTS.navigation });
    }
  }

  // ================== Payment Proof ==================

  /**
   * Check if payment proof is visible
   */
  async isPaymentProofVisible(): Promise<boolean> {
    const imageVisible = await this.paymentProofImage.isVisible();
    const pdfVisible = await this.paymentProofPdf.isVisible();
    return imageVisible || pdfVisible;
  }

  /**
   * Get the type of payment proof (image or pdf)
   */
  async getProofType(): Promise<"image" | "pdf" | "none"> {
    if (await this.paymentProofImage.isVisible()) return "image";
    if (await this.paymentProofPdf.isVisible()) return "pdf";
    return "none";
  }

  /**
   * View proof in full size
   */
  async viewFullSizeProof(): Promise<void> {
    await this.viewFullSizeButton.click();
    // Wait for modal/lightbox
    await this.page.waitForTimeout(300);
  }

  /**
   * Download payment proof
   */
  async downloadProof(): Promise<string | null> {
    const [download] = await Promise.all([
      this.page.waitForEvent("download"),
      this.downloadProofButton.click(),
    ]);
    return download.path();
  }

  // ================== Verification Actions ==================

  /**
   * Verify/approve the payment
   */
  async verifyPayment(): Promise<void> {
    await this.verifyButton.click();
    // Wait for success or page change
    await Promise.race([
      this.successMessage.waitFor({ state: "visible", timeout: TIMEOUTS.medium }),
      this.page.waitForURL(/\/queue|\/bookings/, { timeout: TIMEOUTS.medium }),
    ]);
  }

  /**
   * Reject the payment with optional reason
   */
  async rejectPayment(reason?: string): Promise<void> {
    await this.rejectButton.click();

    // Handle rejection modal if present
    const modalVisible = await this.rejectionModal.isVisible().catch(() => false);
    if (modalVisible && reason) {
      await this.rejectionReasonInput.fill(reason);
    }

    // Confirm rejection
    if (modalVisible) {
      await this.confirmRejectButton.click();
    }

    // Wait for success or page change
    await Promise.race([
      this.successMessage.waitFor({ state: "visible", timeout: TIMEOUTS.medium }),
      this.page.waitForURL(/\/queue|\/bookings/, { timeout: TIMEOUTS.medium }),
    ]);
  }

  /**
   * Request more information from guest
   */
  async requestMoreInfo(): Promise<void> {
    await this.requestMoreInfoButton.click();
    await this.successMessage.waitFor({
      state: "visible",
      timeout: TIMEOUTS.medium,
    });
  }

  // ================== Notes ==================

  /**
   * Add a note to the payment record
   */
  async addNote(note: string): Promise<void> {
    await this.notesInput.fill(note);
    await this.saveNotesButton.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Get existing notes
   */
  async getNotes(): Promise<string[]> {
    const notes = await this.notesHistory.locator("[class*='note-item']").all();
    const noteTexts: string[] = [];
    for (const note of notes) {
      const text = await note.textContent();
      if (text) noteTexts.push(text.trim());
    }
    return noteTexts;
  }

  // ================== Status & Info ==================

  /**
   * Get current payment status
   */
  async getPaymentStatus(): Promise<string> {
    const badge = this.statusBadge.first();
    return (await badge.textContent())?.trim() || "unknown";
  }

  /**
   * Get booking reference displayed
   */
  async getBookingReference(): Promise<string> {
    const text = (await this.bookingReference.textContent()) ?? "";
    return text.replace(/^Booking:\s*/, "").trim();
  }

  /**
   * Get booking amount displayed
   */
  async getBookingAmount(): Promise<string> {
    return (await this.bookingAmount.textContent())?.trim() || "";
  }

  // ================== Navigation ==================

  /**
   * Go back to the booking queue
   */
  async goBackToQueue(): Promise<void> {
    await this.backToQueueButton.click();
    await this.page.waitForURL(/\/queue/);
  }

  /**
   * Navigate to view full booking details
   */
  async goToBookingDetails(): Promise<void> {
    await this.viewBookingButton.click();
    await this.page.waitForURL(/\/bookings\//);
  }

  // ================== Assertions ==================

  /**
   * Verify page loaded correctly
   */
  async expectPageLoaded(): Promise<void> {
    await expect(this.container).toBeVisible();
  }

  /**
   * Verify payment proof is displayed
   */
  async expectPaymentProofVisible(): Promise<void> {
    const proofVisible = await this.isPaymentProofVisible();
    expect(proofVisible).toBeTruthy();
  }

  /**
   * Verify verify button is visible (for authorized users)
   */
  async expectVerifyButtonVisible(): Promise<void> {
    await expect(this.verifyButton).toBeVisible();
  }

  /**
   * Verify verify button is NOT visible (for unauthorized users)
   */
  async expectVerifyButtonHidden(): Promise<void> {
    await expect(this.verifyButton).not.toBeVisible();
  }

  /**
   * Verify payment status matches expected
   */
  async expectPaymentStatus(status: "pending" | "verified" | "rejected"): Promise<void> {
    await expect(this.statusBadge).toContainText(new RegExp(status, "i"));
  }

  /**
   * Verify success message after action
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
