import { expect, type Locator, type Page } from "@playwright/test";

import { ROUTES, TIMEOUTS } from "../fixtures/test-data";

/**
 * Page Object Model for the Admin Dashboard
 * Handles dashboard navigation, KPI cards, and quick actions
 */
export class DashboardPage {
  readonly page: Page;

  // KPI Cards
  readonly availableCabinsCard: Locator;
  readonly activeBookingsCard: Locator;
  readonly totalBookingsCard: Locator;
  readonly totalGuestsCard: Locator;

  // Calendar
  readonly calendarComponent: Locator;

  // Navigation links
  readonly bookingsLink: Locator;
  readonly unitsLink: Locator;
  readonly guestsLink: Locator;
  readonly paymentsLink: Locator;
  readonly expensesLink: Locator;

  // Quick actions
  readonly newBookingButton: Locator;

  // Header elements
  readonly userMenu: Locator;
  readonly logoutButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // KPI Cards - finding cards by their title text
    this.availableCabinsCard = page
      .locator("text=Available Cabins")
      .locator("xpath=ancestor::*[contains(@class, 'card') or contains(@class, 'Card')]")
      .first();
    this.activeBookingsCard = page
      .locator("text=Active Bookings")
      .locator("xpath=ancestor::*[contains(@class, 'card') or contains(@class, 'Card')]")
      .first();
    this.totalBookingsCard = page
      .locator("text=Total Bookings")
      .locator("xpath=ancestor::*[contains(@class, 'card') or contains(@class, 'Card')]")
      .first();
    this.totalGuestsCard = page
      .locator("text=Total Guests")
      .locator("xpath=ancestor::*[contains(@class, 'card') or contains(@class, 'Card')]")
      .first();

    // Calendar component
    this.calendarComponent = page.locator(
      '[data-testid="dashboard-calendar"], [class*="calendar"]'
    );

    // Navigation - using link roles with navigation menu
    this.bookingsLink = page.getByRole("link", { name: /bookings/i }).first();
    this.unitsLink = page.getByRole("link", { name: /units|cabins/i }).first();
    this.guestsLink = page.getByRole("link", { name: /guests/i }).first();
    this.paymentsLink = page.getByRole("link", { name: /payments/i }).first();
    this.expensesLink = page.getByRole("link", { name: /expenses/i }).first();

    // Quick actions
    this.newBookingButton = page.getByRole("button", { name: /new booking/i });

    // User menu and logout
    this.userMenu = page.locator(
      '[data-testid="user-menu"], [aria-label*="user"], [aria-label*="account"]'
    );
    this.logoutButton = page.getByRole("button", { name: /logout|sign out/i });
  }

  /**
   * Navigate to the dashboard
   */
  async goto() {
    await this.page.goto(ROUTES.admin.dashboard);
    await this.waitForPageLoad();
  }

  /**
   * Wait for dashboard to fully load
   */
  async waitForPageLoad() {
    await this.page.waitForLoadState("networkidle");
    // Wait for at least one KPI card to be visible
    await this.page.waitForSelector("text=Available Cabins", {
      timeout: TIMEOUTS.navigation,
    });
  }

  /**
   * Verify user is on dashboard
   */
  async expectToBeOnDashboard() {
    await expect(this.page).toHaveURL(/\/admin\/dashboard/);
  }

  /**
   * Get the value from a KPI card
   */
  async getKpiValue(card: Locator): Promise<string> {
    const valueElement = card.locator('[class*="text-2xl"], [class*="font-bold"]').first();
    return valueElement.innerText();
  }

  /**
   * Get available cabins count
   */
  async getAvailableCabinsCount(): Promise<number> {
    const value = await this.getKpiValue(this.availableCabinsCard);
    return parseInt(value, 10) || 0;
  }

  /**
   * Get active bookings count
   */
  async getActiveBookingsCount(): Promise<number> {
    const value = await this.getKpiValue(this.activeBookingsCard);
    return parseInt(value, 10) || 0;
  }

  /**
   * Navigate to bookings page
   */
  async goToBookings() {
    await this.bookingsLink.click();
    await this.page.waitForURL(/\/admin\/bookings/);
  }

  /**
   * Navigate to units page
   */
  async goToUnits() {
    await this.unitsLink.click();
    await this.page.waitForURL(/\/admin\/units/);
  }

  /**
   * Navigate to guests page
   */
  async goToGuests() {
    await this.guestsLink.click();
    await this.page.waitForURL(/\/admin\/guests/);
  }

  /**
   * Navigate to payments page
   */
  async goToPayments() {
    await this.paymentsLink.click();
    await this.page.waitForURL(/\/admin\/payments/);
  }

  /**
   * Navigate to expenses page
   */
  async goToExpenses() {
    await this.expensesLink.click();
    await this.page.waitForURL(/\/admin\/expenses/);
  }

  /**
   * Start new booking flow
   */
  async startNewBooking() {
    await this.newBookingButton.click();
  }

  /**
   * Open user menu
   */
  async openUserMenu() {
    await this.userMenu.click();
  }

  /**
   * Perform logout
   */
  async logout() {
    await this.openUserMenu();
    await this.logoutButton.click();
    await this.page.waitForURL(/\/(login)?$/);
  }

  /**
   * Verify dashboard shows expected data (basic smoke test)
   */
  async verifyDashboardLoaded() {
    // Check that KPI section is visible
    await expect(this.page.locator("text=Available Cabins")).toBeVisible();
    await expect(this.page.locator("text=Active Bookings")).toBeVisible();
  }
}
