import { expect, type Locator, type Page } from "@playwright/test";

import { ROUTES, TIMEOUTS } from "../fixtures/test-data";

/**
 * Page Object Model for the Admin Pending Bookings Queue Page
 *
 * Based on actual PendingBookingsQueue component structure:
 * - Card container with Table inside
 * - Urgency badges with destructive/warning/default/secondary variants
 * - Search input with "Search by reference or guest name..." placeholder
 * - Urgency and date range filter dropdowns
 * - Action buttons: "Review Payment" or "Assign Cabins"
 */
export class AdminQueuePage {
  readonly page: Page;

  // Queue container - Card with Table inside
  readonly queueContainer: Locator;
  readonly queueHeader: Locator;
  readonly queueDescription: Locator;
  readonly queueTable: Locator;

  // Search and filters
  readonly searchInput: Locator;
  readonly urgencyFilter: Locator;
  readonly dateRangeFilter: Locator;
  readonly clearFiltersButton: Locator;

  // Queue items/rows - Standard table rows
  readonly queueItems: Locator;
  readonly emptyState: Locator;
  readonly loadingState: Locator;

  // Urgency indicators - Badge variants match actual component
  readonly criticalBadges: Locator;
  readonly highBadges: Locator;
  readonly mediumBadges: Locator;
  readonly lowBadges: Locator;

  // Action buttons
  readonly reviewPaymentButtons: Locator;
  readonly assignUnitsButtons: Locator;
  readonly viewDetailsButtons: Locator;

  // Refresh and real-time
  readonly refreshButton: Locator;
  readonly lastUpdatedIndicator: Locator;
  readonly autoRefreshToggle: Locator;

  constructor(page: Page) {
    this.page = page;

    this.queueContainer = page.getByTestId("pending-bookings-queue");
    this.queueHeader = page.getByRole("heading", {
      name: /pending.*bookings.*queue/i,
    });
    this.queueDescription = page.getByText(/pending.*multi-unit.*bookings/i);
    this.queueTable = page.getByRole("table");

    // Search and filters - actual placeholder from component
    this.searchInput = page.getByPlaceholder(/search by reference or guest name/i);
    // Filter dropdowns use SelectTrigger - target by role or nearby label
    this.urgencyFilter = page
      .locator("button")
      .filter({ hasText: /all urgency|critical|high|medium|low/i })
      .first();
    this.dateRangeFilter = page
      .locator("button")
      .filter({ hasText: /all dates|check-in today|next 7 days|next 30 days/i })
      .first();
    this.clearFiltersButton = page.getByRole("button", {
      name: /clear|reset/i,
    });

    // Queue items - table body rows (excluding header)
    this.queueItems = page.locator("table tbody tr");
    this.emptyState = page.getByText("No pending bookings found");
    // Loading spinner with animate-spin class
    this.loadingState = page.locator(".animate-spin");

    // Urgency badges - based on Badge variant text content
    // Critical = destructive (red), High = warning (orange/amber)
    // Medium = default, Low = secondary (gray)
    this.criticalBadges = page.locator("table tbody").getByText("Critical");
    this.highBadges = page.locator("table tbody").getByText("High");
    this.mediumBadges = page.locator("table tbody").getByText("Medium");
    this.lowBadges = page.locator("table tbody").getByText("Low");

    // Action buttons - exact text from component
    this.reviewPaymentButtons = page.getByRole("button", {
      name: "Review Payment",
    });
    this.assignUnitsButtons = page.getByRole("button", {
      name: "Assign Cabins",
    });
    this.viewDetailsButtons = page.getByRole("link", { name: /view|details/i });

    // Refresh controls
    this.refreshButton = page.getByRole("button", { name: /refresh/i });
    // Auto-refresh badge shows "Auto-refresh: 30s"
    this.lastUpdatedIndicator = page.getByText(/auto-refresh.*30s/i);
    this.autoRefreshToggle = page.getByLabel(/auto.?refresh/i);
  }

  /**
   * Navigate to the admin booking queue
   */
  async goto(): Promise<void> {
    await this.page.goto(ROUTES.admin.bookingsQueue);
    await this.waitForPageLoad();
  }

  /**
   * Wait for page to fully load
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState("networkidle");
    // Wait for the queue header which is always present
    await expect(this.queueHeader).toBeVisible({
      timeout: TIMEOUTS.navigation,
    });
  }

  /**
   * Wait for queue data to refresh
   */
  async waitForQueueRefresh(): Promise<void> {
    await this.loadingState.waitFor({ state: "hidden", timeout: TIMEOUTS.medium }).catch(() => {});
    await this.page.waitForTimeout(300); // Allow for data to update
  }

  // ================== Search & Filters ==================

  /**
   * Search for a booking by reference
   */
  async searchByReference(reference: string): Promise<void> {
    await this.searchInput.fill(reference);
    await this.page.waitForTimeout(500); // Debounce time
    await this.waitForQueueRefresh();
  }

  /**
   * Clear search input
   */
  async clearSearch(): Promise<void> {
    await this.searchInput.clear();
    await this.waitForQueueRefresh();
  }

  /**
   * Filter by urgency level using the dropdown
   */
  async filterByUrgency(level: "critical" | "high" | "medium" | "low" | "all"): Promise<void> {
    await this.urgencyFilter.click();
    const optionLabels: Record<string, RegExp> = {
      all: /all urgency/i,
      critical: /critical/i,
      high: /high/i,
      medium: /medium/i,
      low: /low/i,
    };
    await this.page.getByRole("option", { name: optionLabels[level] }).click();
    await this.waitForQueueRefresh();
  }

  /**
   * Filter by date range using the dropdown
   */
  async filterByDateRange(range: "today" | "week" | "month" | "all"): Promise<void> {
    await this.dateRangeFilter.click();
    const rangeLabels: Record<string, RegExp> = {
      today: /check-in today/i,
      week: /next 7 days/i,
      month: /next 30 days/i,
      all: /all dates/i,
    };
    await this.page.getByRole("option", { name: rangeLabels[range] }).click();
    await this.waitForQueueRefresh();
  }

  /**
   * Clear all applied filters
   */
  async clearAllFilters(): Promise<void> {
    // Clear search first
    await this.searchInput.clear();
    // Reset dropdowns to "All" if clear button exists
    const isVisible = await this.clearFiltersButton.isVisible().catch(() => false);
    if (isVisible) {
      await this.clearFiltersButton.click();
    }
    await this.waitForQueueRefresh();
  }

  // ================== Queue Operations ==================

  /**
   * Get the total count of items in queue
   */
  async getQueueCount(): Promise<number> {
    // Try to get count from description text
    const descText = await this.queueDescription.textContent().catch(() => null);
    if (descText) {
      const match = descText.match(/(\d+)\s+pending/);
      if (match) return parseInt(match[1], 10);
    }
    // Fallback: count visible rows
    return this.queueItems.count();
  }

  /**
   * Get bookings filtered by urgency level
   */
  async getBookingsByUrgency(level: "critical" | "high" | "medium" | "low"): Promise<Locator[]> {
    const badges = {
      critical: this.criticalBadges,
      high: this.highBadges,
      medium: this.mediumBadges,
      low: this.lowBadges,
    };
    return badges[level].all();
  }

  /**
   * Get the urgency score for a specific booking
   * Score is displayed next to badge in font-mono text
   */
  async getUrgencyScore(bookingRef: string): Promise<number> {
    const row = this.getQueueItemByReference(bookingRef);
    // Score shown in first cell with font-mono class
    const scoreText = await row.locator(".font-mono").first().textContent();
    return parseInt(scoreText?.match(/\d+/)?.[0] || "0", 10);
  }

  /**
   * Get a queue item (table row) by booking reference
   */
  getQueueItemByReference(reference: string): Locator {
    return this.page.locator("table tbody tr").filter({ hasText: reference });
  }

  /**
   * Check if a booking exists in the queue
   */
  async bookingExistsInQueue(reference: string): Promise<boolean> {
    const item = this.getQueueItemByReference(reference);
    return item.isVisible();
  }

  /**
   * Get all booking references currently in queue
   * References are in font-mono styled cells
   */
  async getAllBookingReferences(): Promise<string[]> {
    const refs: string[] = [];
    const rows = await this.queueItems.all();
    for (const row of rows) {
      // Reference is typically in second column with font-mono
      const refCell = row.locator("td").nth(1).locator(".font-mono");
      const text = await refCell.textContent().catch(() => null);
      if (text) {
        refs.push(text.trim());
      }
    }
    return refs;
  }

  // ================== Actions ==================

  /**
   * Click "Review Payment" for a specific booking
   */
  async clickReviewPayment(bookingRef: string): Promise<void> {
    const row = this.getQueueItemByReference(bookingRef);
    const button = row.getByRole("button", { name: "Review Payment" });
    await button.click();
    await this.page.waitForURL(/\/verify-payment/);
  }

  /**
   * Click "Assign Cabins" for a specific booking
   */
  async clickAssignUnits(bookingRef: string): Promise<void> {
    const row = this.getQueueItemByReference(bookingRef);
    const button = row.getByRole("button", { name: "Assign Cabins" });
    await button.click();
    await this.page.waitForURL(/\/assign-units/);
  }

  /**
   * Click a row to view details
   */
  async clickViewDetails(bookingRef: string): Promise<void> {
    const row = this.getQueueItemByReference(bookingRef);
    await row.click();
    await this.page.waitForURL(/\/admin\/bookings\//);
  }

  /**
   * Manually refresh the queue (if refresh button exists)
   */
  async refreshQueue(): Promise<void> {
    const hasRefresh = await this.refreshButton.isVisible().catch(() => false);
    if (hasRefresh) {
      await this.refreshButton.click();
      await this.waitForQueueRefresh();
    } else {
      // Fallback: reload page
      await this.page.reload();
      await this.waitForPageLoad();
    }
  }

  /**
   * Toggle auto-refresh (if toggle exists)
   */
  async toggleAutoRefresh(enable: boolean): Promise<void> {
    const hasToggle = await this.autoRefreshToggle.isVisible().catch(() => false);
    if (hasToggle) {
      const isChecked = await this.autoRefreshToggle.isChecked();
      if (isChecked !== enable) {
        await this.autoRefreshToggle.click();
      }
    }
  }

  // ================== Assertions ==================

  /**
   * Verify queue is visible (header is always present)
   */
  async expectQueueVisible(): Promise<void> {
    await expect(this.queueHeader).toBeVisible();
  }

  /**
   * Verify empty state is shown
   */
  async expectEmptyQueue(): Promise<void> {
    await expect(this.emptyState).toBeVisible();
  }

  /**
   * Verify minimum number of items in queue
   */
  async expectMinimumItems(count: number): Promise<void> {
    const actualCount = await this.getQueueCount();
    expect(actualCount).toBeGreaterThanOrEqual(count);
  }

  /**
   * Verify booking appears in queue with expected urgency
   */
  async expectBookingWithUrgency(
    reference: string,
    urgency: "critical" | "high" | "medium" | "low"
  ): Promise<void> {
    const row = this.getQueueItemByReference(reference);
    await expect(row).toBeVisible();
    // Check urgency text in row
    await expect(row.getByText(new RegExp(urgency, "i"))).toBeVisible();
  }

  /**
   * Verify queue is sorted by urgency (highest first)
   */
  async expectSortedByUrgency(): Promise<void> {
    const rows = await this.queueItems.all();
    const scores: number[] = [];

    for (const row of rows) {
      const scoreText = await row.locator(".font-mono").first().textContent();
      const score = parseInt(scoreText?.match(/\d+/)?.[0] || "0", 10);
      scores.push(score);
    }

    // Verify descending order
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  }

  /**
   * Verify specific action button is visible for a booking
   */
  async expectActionVisible(
    bookingRef: string,
    action: "reviewPayment" | "assignUnits" | "viewDetails"
  ): Promise<void> {
    const row = this.getQueueItemByReference(bookingRef);
    const buttonNames = {
      reviewPayment: "Review Payment",
      assignUnits: "Assign Cabins",
      viewDetails: /view|details/i,
    };
    const button = row.getByRole("button", { name: buttonNames[action] });
    await expect(button).toBeVisible();
  }

  /**
   * Verify action button is NOT visible (e.g., for Staff role)
   */
  async expectActionHidden(
    bookingRef: string,
    action: "reviewPayment" | "assignUnits"
  ): Promise<void> {
    const row = this.getQueueItemByReference(bookingRef);
    const buttonNames = {
      reviewPayment: "Review Payment",
      assignUnits: "Assign Cabins",
    };
    const button = row.getByRole("button", { name: buttonNames[action] });
    await expect(button).not.toBeVisible();
  }
}
