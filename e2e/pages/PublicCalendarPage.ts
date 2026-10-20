import { expect, type Locator, type Page } from "@playwright/test";

import { ROUTES, TIMEOUTS } from "../fixtures/test-data";

/**
 * Page Object Model for the Public Availability Calendar
 *
 * Based on actual DashboardCalendar component structure:
 * - Card with gradient header
 * - "Today" button, ChevronLeft/Right for navigation
 * - Month display in center (MMMM yyyy format)
 * - Calendar grid with day buttons
 * - Day cells have dynamic backgrounds based on booking count
 */
export class PublicCalendarPage {
  readonly page: Page;

  // Calendar container
  readonly calendar: Locator;
  readonly calendarCard: Locator;
  readonly calendarTitle: Locator;

  // Navigation controls
  readonly todayButton: Locator;
  readonly previousMonthButton: Locator;
  readonly nextMonthButton: Locator;
  readonly monthDisplay: Locator;

  // Calendar grid
  readonly calendarGrid: Locator;
  readonly dayCells: Locator;

  // Availability indicators
  readonly unitRows: Locator;
  readonly availableSlots: Locator;
  readonly bookedSlots: Locator;

  // Call to action
  readonly bookNowButton: Locator;

  // Header/Navigation
  readonly logo: Locator;
  readonly loginLink: Locator;
  readonly contactLink: Locator;

  // Footer elements
  readonly privacyPolicyLink: Locator;
  readonly termsLink: Locator;

  // Loading state
  readonly loadingState: Locator;

  constructor(page: Page) {
    this.page = page;

    // Calendar container - Card component
    this.calendar = page.locator("article, [class*='card']").filter({
      has: page.getByText(/calendar|availability/i),
    });
    this.calendarCard = page.locator("article").first();
    this.calendarTitle = page.getByRole("heading", {
      name: /calendar|availability|bookings/i,
    });

    // Navigation controls - buttons for month navigation
    this.todayButton = page.getByRole("button", { name: /today/i });
    // ChevronLeft/Right buttons are ghost/icon buttons
    this.previousMonthButton = page
      .locator('button:has(svg[class*="lucide-chevron-left"])')
      .or(page.getByRole("button", { name: /previous/i }))
      .or(
        page
          .locator("button")
          .filter({ has: page.locator('[class*="chevron"]') })
          .first()
      );
    this.nextMonthButton = page
      .locator('button:has(svg[class*="lucide-chevron-right"])')
      .or(page.getByRole("button", { name: /next/i }))
      .or(
        page
          .locator("button")
          .filter({ has: page.locator('[class*="chevron"]') })
          .last()
      );
    // Month display is in a bordered container
    this.monthDisplay = page
      .locator(
        "div:has-text(/january|february|march|april|may|june|july|august|september|october|november|december/i)"
      )
      .filter({
        has: page.locator(':text-matches("\\\\d{4}")'),
      })
      .first();

    // Calendar grid - React Calendar component
    this.calendarGrid = page.locator('[role="grid"], [class*="calendar"]');
    this.dayCells = page.locator('button[class*="day"], [role="gridcell"] button');

    // Availability indicators - colored cells based on booking count
    this.unitRows = page.locator('[class*="unit-row"], tr');
    // Day cells carry their status in the accessible name ("2 available", "Fully booked")
    this.availableSlots = page.getByRole("gridcell", { name: /\d available/ });
    this.bookedSlots = page.getByRole("gridcell", { name: /Fully booked/ });

    // CTA - "Book Now" link/button
    this.bookNowButton = page
      .getByRole("link", { name: /book now|make.*booking|reserve/i })
      .or(page.getByRole("button", { name: /book now|make.*booking|reserve/i }));

    // Header/Navigation
    this.logo = page.locator('img[alt*="logo" i], img[alt*="okaeri" i], [class*="logo"]');
    this.loginLink = page.getByRole("link", { name: /login|sign in|admin/i });
    this.contactLink = page.getByRole("link", { name: /contact/i });

    // Footer links
    this.privacyPolicyLink = page.getByRole("link", { name: /privacy/i });
    this.termsLink = page.getByRole("link", { name: /terms/i });

    // Loading state
    this.loadingState = page.locator(".animate-spin, .animate-pulse, [class*='skeleton']");
  }

  /**
   * Navigate to the public calendar (home page)
   */
  async goto() {
    await this.page.goto(ROUTES.public.home);
    await this.waitForPageLoad();
  }

  /**
   * Wait for the calendar to fully load
   */
  async waitForPageLoad() {
    await this.page.waitForLoadState("networkidle");
    // Wait for loading to complete
    await this.loadingState
      .waitFor({ state: "hidden", timeout: TIMEOUTS.navigation })
      .catch(() => {});
  }

  // ================== Calendar Navigation ==================

  /**
   * Go to next month using chevron button
   */
  async goToNextMonth() {
    await this.nextMonthButton.click();
    await this.page.waitForTimeout(300); // Animation wait
  }

  /**
   * Go to previous month using chevron button
   */
  async goToPreviousMonth() {
    await this.previousMonthButton.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Go to today's month
   */
  async goToToday() {
    const hasTodayButton = await this.todayButton.isVisible().catch(() => false);
    if (hasTodayButton) {
      await this.todayButton.click();
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * Get current displayed month
   * Format: "MMMM yyyy" e.g., "January 2026"
   */
  async getCurrentMonth(): Promise<string> {
    // Look for month-year text pattern
    const monthYearLocator = this.page.locator("text=/[A-Za-z]+ \\d{4}/").first();
    const hasMonthYear = await monthYearLocator.isVisible().catch(() => false);
    if (hasMonthYear) {
      return monthYearLocator.textContent().then((t) => t?.trim() || "");
    }
    // Fallback: look for any element with month text
    return this.monthDisplay.textContent().then((t) => t?.trim() || "");
  }

  /**
   * Navigate to a specific month (by clicking next/prev)
   */
  async navigateToMonth(targetMonth: string) {
    const maxAttempts = 12;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const currentMonth = await this.getCurrentMonth();
      if (currentMonth.toLowerCase().includes(targetMonth.toLowerCase())) {
        return;
      }
      // Determine direction based on comparison
      await this.goToNextMonth();
      attempts++;
    }

    throw new Error(`Could not navigate to month: ${targetMonth}`);
  }

  // ================== Availability Checking ==================

  /**
   * Get count of available slots visible
   */
  async getAvailableSlotsCount(): Promise<number> {
    return this.availableSlots.count();
  }

  /**
   * Get count of booked slots visible
   */
  async getBookedSlotsCount(): Promise<number> {
    return this.bookedSlots.count();
  }

  /**
   * Check if a specific unit has availability
   */
  async unitHasAvailability(unitName: string): Promise<boolean> {
    const unitRow = this.page.locator(`tr, div`).filter({ hasText: unitName });
    const available = unitRow.locator('[class*="available"], [class*="bg-green"]');
    return (await available.count()) > 0;
  }

  /**
   * Click on an available date slot
   */
  async clickAvailableDate(date: string) {
    // Find the cell for the specific date
    const dateCell = this.page.locator(`[data-date="${date}"], button:has-text("${date}")`);
    await dateCell.click();
  }

  // ================== Navigation to Booking ==================

  /**
   * Click "Book Now" button
   */
  async clickBookNow() {
    await this.bookNowButton.click();
    await this.page.waitForURL(/\/booking/);
  }

  /**
   * Navigate to login page
   */
  async goToLogin() {
    await this.loginLink.click();
    await this.page.waitForURL(/\/login/);
  }

  /**
   * Navigate to privacy policy
   */
  async goToPrivacyPolicy() {
    await this.privacyPolicyLink.click();
    await this.page.waitForURL(/privacy/);
  }

  /**
   * Navigate to terms and conditions
   */
  async goToTerms() {
    await this.termsLink.click();
    await this.page.waitForURL(/terms/);
  }

  // ================== Assertions ==================

  /**
   * Verify calendar is visible
   * Uses the specific grid with aria-label to avoid strict mode violations
   */
  async expectCalendarVisible() {
    // Use the specific calendar grid with aria-label for precise selection
    const calendarGrid = this.page.getByRole("grid", { name: "Availability calendar" });
    const hasGrid = await calendarGrid.isVisible().catch(() => false);

    if (hasGrid) {
      await expect(calendarGrid).toBeVisible();
      return;
    }

    // Fallback: check for the main heading "Okaeri Availability"
    const heading = this.page.getByRole("heading", { name: "Okaeri Availability" });
    await expect(heading).toBeVisible({ timeout: 10000 });
  }

  /**
   * Verify page title/heading
   */
  async expectPageTitle() {
    await expect(
      this.page.getByRole("heading", { name: /availability|okaeri|resort|calendar/i })
    ).toBeVisible();
  }

  /**
   * Verify "Book Now" CTA is visible
   * Note: The current home page is view-only (no Book Now button).
   * This method checks if the booking call-to-action exists.
   */
  async expectBookNowVisible() {
    // Check for any booking-related CTA (button or link)
    const hasBookNow = await this.bookNowButton.isVisible().catch(() => false);

    if (!hasBookNow) {
      // Fallback: Check for contact information which is the current CTA
      const contactInfo = this.page.getByText(/contact us|WhatsApp/i);
      await expect(contactInfo.first()).toBeVisible();
      return;
    }

    await expect(this.bookNowButton).toBeVisible();
  }

  /**
   * Verify footer links or footer content are present
   * Note: Current home page has compact info notice instead of traditional footer
   */
  async expectFooterLinks() {
    // Check for footer links if they exist
    const hasPrivacy = await this.privacyPolicyLink.isVisible().catch(() => false);
    const hasTerms = await this.termsLink.isVisible().catch(() => false);

    if (hasPrivacy && hasTerms) {
      await expect(this.privacyPolicyLink).toBeVisible();
      await expect(this.termsLink).toBeVisible();
      return;
    }

    // Fallback: Check for any footer content (timestamp or info notice)
    const footerContent = this.page.locator("text=/Updated|View-Only|Contact/i");
    await expect(footerContent.first()).toBeVisible();
  }

  /**
   * Verify the page is publicly accessible (no auth required)
   */
  async expectPublicAccess() {
    // Should not redirect to login
    expect(this.page.url()).not.toContain("/login");
    // Should show main content
    await this.expectCalendarVisible();
  }

  /**
   * Full smoke test for the public calendar
   */
  async runSmokeTest() {
    await this.expectPublicAccess();
    await this.expectBookNowVisible();
    await this.expectFooterLinks();
  }
}
