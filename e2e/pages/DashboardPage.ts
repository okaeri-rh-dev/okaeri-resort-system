import { expect, type Locator, type Page } from "@playwright/test";

import { ROUTES, TIMEOUTS } from "../fixtures/test-data";

/**
 * Page Object Model for the Admin Dashboard
 * Handles dashboard navigation and quick actions
 */
export class DashboardPage {
  readonly page: Page;

  /** The month's numbers under the calendar header */
  readonly monthNumbers: Locator;

  // Navigation links
  readonly bookingsLink: Locator;
  readonly unitsLink: Locator;
  readonly guestsLink: Locator;
  readonly paymentsLink: Locator;
  readonly expensesLink: Locator;

  // Quick actions
  readonly newBookingButton: Locator;

  // Sidebar footer
  readonly accountMenuButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.monthNumbers = page.getByText(/% occupancy · \d+ confirmed/);

    // Navigation - using link roles with navigation menu
    this.bookingsLink = page.getByRole("link", { name: /bookings/i }).first();
    this.unitsLink = page.getByRole("link", { name: /units|cabins/i }).first();
    this.guestsLink = page.getByRole("link", { name: /guests/i }).first();
    this.paymentsLink = page.getByRole("link", { name: /payments/i }).first();
    this.expensesLink = page.getByRole("link", { name: /expenses/i }).first();

    // Quick actions
    this.newBookingButton = page.getByRole("button", { name: /new booking/i });

    this.accountMenuButton = page.getByRole("button", { name: "Account menu" });
  }

  /**
   * Navigate to the dashboard
   */
  async goto() {
    await this.page.goto(ROUTES.admin.dashboard);
    await this.waitForPageLoad();
  }

  /**
   * Click a destination in the main nav (bottom bar or rail). When it is not shown directly
   * (unpinned on compact, grouped in the collapsed rail), More or Open menu opens the full list.
   */
  private async clickNavLink(name: RegExp) {
    const nav = this.page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link").first()).toBeVisible();
    const link = nav.getByRole("link", { name });
    if (await link.first().isVisible()) {
      await link.first().click();
    } else {
      await this.page.getByRole("button", { name: /^(More|Open menu)$/ }).click();
      await this.page.getByRole("dialog").getByRole("link", { name }).first().click();
    }
  }

  /**
   * Wait for dashboard to fully load
   */
  async waitForPageLoad() {
    await this.page.waitForLoadState("networkidle");
    await expect(this.monthNumbers).toBeVisible({ timeout: TIMEOUTS.navigation });
  }

  /**
   * Verify user is on dashboard
   */
  async expectToBeOnDashboard() {
    await expect(this.page).toHaveURL(/\/admin\/dashboard/);
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
    // The rail grows when the role-filtered nav replaces its placeholder, moving the account menu
    await expect(
      this.page.getByRole("navigation", { name: "Main" }).getByRole("link").first()
    ).toBeVisible();
    await this.accountMenuButton.click();
    await this.page.getByRole("menuitem", { name: "Sign Out" }).click();
    await this.page.waitForURL(/\/admin\/login/);
  }

  /**
   * Verify dashboard shows expected data (basic smoke test)
   */
  async verifyDashboardLoaded() {
    await expect(this.monthNumbers).toBeVisible();
  }
}
