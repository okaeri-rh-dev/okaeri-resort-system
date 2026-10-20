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

  // Sidebar footer
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

    this.logoutButton = page.getByRole("button", { name: "Sign Out" });
  }

  /**
   * Navigate to the dashboard
   */
  async goto() {
    await this.page.goto(ROUTES.admin.dashboard);
    await this.waitForPageLoad();
  }

  /**
   * True when the viewport uses the mobile dashboard variant (< md / 768px).
   * The app renders MobileDashboard and DesktopDashboard side by side and
   * toggles visibility with `md:hidden` / `hidden md:block`.
   */
  private isMobileDashboardViewport(): boolean {
    return (this.page.viewportSize()?.width ?? 1280) < 768;
  }

  /**
   * Click a destination in the main nav (bottom bar or rail). On compact windows the
   * unpinned destinations sit behind More, which opens the full list.
   */
  private async clickNavLink(name: RegExp) {
    const nav = this.page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link").first()).toBeVisible();
    const link = nav.getByRole("link", { name });
    if (await link.first().isVisible()) {
      await link.first().click();
    } else {
      await this.page.getByRole("button", { name: "More" }).click();
      await this.page.getByRole("dialog").getByRole("link", { name }).first().click();
    }
  }

  /**
   * Wait for dashboard to fully load
   */
  async waitForPageLoad() {
    await this.page.waitForLoadState("networkidle");
    // Wait for a marker of the active dashboard variant to be visible
    const marker = this.isMobileDashboardViewport()
      ? "text=Tomorrow's Schedule"
      : "text=Available Cabins";
    await this.page.waitForSelector(marker, {
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
    await this.clickNavLink(/bookings/i);
    await this.page.waitForURL(/\/admin\/bookings/);
  }

  /**
   * Navigate to units page
   */
  async goToUnits() {
    await this.clickNavLink(/units|cabins/i);
    await this.page.waitForURL(/\/admin\/units/);
  }

  /**
   * Navigate to guests page
   */
  async goToGuests() {
    await this.clickNavLink(/guests/i);
    await this.page.waitForURL(/\/admin\/guests/);
  }

  /**
   * Navigate to payments page
   */
  async goToPayments() {
    await this.clickNavLink(/payments/i);
    await this.page.waitForURL(/\/admin\/payments/);
  }

  /**
   * Navigate to expenses page
   */
  async goToExpenses() {
    await this.clickNavLink(/expenses/i);
    await this.page.waitForURL(/\/admin\/expenses/);
  }

  /**
   * Start new booking flow
   */
  async startNewBooking() {
    await this.newBookingButton.click();
  }

  /**
   * Perform logout
   */
  async logout() {
    await this.logoutButton.click();
    await this.page.waitForURL(/\/admin\/login/);
  }

  /**
   * Verify dashboard shows expected data (basic smoke test)
   */
  async verifyDashboardLoaded() {
    if (this.isMobileDashboardViewport()) {
      // MobileDashboard variant: no KPI cards; assert its stable section.
      // Both dashboard variants render this card; MobileDashboard comes first
      // in the DOM and is the visible one below the md breakpoint.
      await expect(this.page.getByText("Tomorrow's Schedule").first()).toBeVisible();
      return;
    }
    // DesktopDashboard variant: KPI section is visible
    await expect(this.page.locator("text=Available Cabins")).toBeVisible();
    await expect(this.page.locator("text=Active Bookings")).toBeVisible();
  }
}
