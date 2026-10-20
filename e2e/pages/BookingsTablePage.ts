import { expect, type Locator, type Page } from "@playwright/test";

import { BOOKING_STATUS, ROUTES, TIMEOUTS } from "../fixtures/test-data";

/**
 * Page Object Model for the Admin Bookings Table
 *
 * Based on actual BookingsTable component structure:
 * - TanStack Table (React Table v8) with standard <table> element
 * - Desktop: Table view with rows
 * - Mobile: Card-based layout with ListCard components
 * - Booking references: links to /admin/bookings/$bookingId
 * - Actions menu: Edit Booking, Upload Payment, Confirm, Cancel, Delete
 * - BookingFilters component for search/filters
 */
export class BookingsTablePage {
  readonly page: Page;

  // Search and filters
  readonly searchInput: Locator;
  readonly statusFilter: Locator;
  readonly dateRangeFilter: Locator;
  readonly clearFiltersButton: Locator;

  // Table elements
  readonly table: Locator;
  readonly bookingList: Locator;
  readonly tableRows: Locator;
  readonly tableBodyRows: Locator;
  readonly tableHeaders: Locator;
  readonly emptyState: Locator;
  readonly loadingState: Locator;

  // Action buttons
  readonly newBookingButton: Locator;
  readonly exportButton: Locator;
  readonly refreshButton: Locator;

  // Pagination
  readonly pagination: Locator;
  readonly nextPageButton: Locator;
  readonly previousPageButton: Locator;
  readonly pageInfo: Locator;

  // Row actions - using ActionMenu dropdown
  readonly rowActionsMenu: Locator;

  constructor(page: Page) {
    this.page = page;

    // Search and filters - BookingFilters component uses FilterPopover
    this.searchInput = page.getByPlaceholder(/^search/i);
    // Status filter is a FilterPopover trigger button with text "Status"
    this.statusFilter = page.getByRole("button", { name: "Status" });
    // Date filter is a FilterPopover trigger
    this.dateRangeFilter = page.getByRole("button", { name: "Dates" });
    this.clearFiltersButton = page.getByRole("button", {
      name: "Clear Filters",
    });

    // Table elements
    this.table = page.getByRole("table");
    this.bookingList = this.table.or(page.getByRole("button", { name: /^View booking / }));
    this.tableRows = page.getByRole("row");
    this.tableBodyRows = page.locator("table tbody tr");
    this.tableHeaders = page.getByRole("columnheader");
    // TableEmptyState component shows "No bookings found"
    this.emptyState = page.getByText("No bookings found");
    this.loadingState = page.locator(".animate-pulse, .animate-spin");

    // Action buttons
    this.newBookingButton = page.getByRole("button", { name: /new booking/i });
    this.exportButton = page.getByRole("button", { name: /export/i });
    this.refreshButton = page.getByRole("button", { name: /refresh/i });

    // Pagination - TablePagination component
    this.pagination = page.locator("nav").filter({ hasText: /page/i });
    this.nextPageButton = page.getByRole("button", { name: /next/i });
    this.previousPageButton = page.getByRole("button", { name: /previous/i });
    this.pageInfo = page.getByText(/page \d+/i);

    // Row actions - ActionMenu with dropdown
    this.rowActionsMenu = page.getByRole("button", { name: /actions|more/i });
  }

  /**
   * Navigate to the bookings table page
   */
  async goto() {
    await this.page.goto(ROUTES.admin.bookings);
    await this.waitForPageLoad();
  }

  /**
   * Wait for the bookings table to load
   */
  async waitForPageLoad() {
    await this.page.waitForLoadState("networkidle");
    await expect(this.bookingList.or(this.emptyState).first()).toBeVisible({
      timeout: TIMEOUTS.navigation,
    });
  }

  /**
   * Wait for table data to load (after filter changes)
   */
  async waitForTableLoad() {
    // Wait for any loading states to clear
    await this.loadingState.waitFor({ state: "hidden", timeout: TIMEOUTS.medium }).catch(() => {});
    await this.page.waitForTimeout(300);
  }

  // ================== Search & Filters ==================

  /**
   * Search for bookings
   */
  async search(query: string) {
    await this.searchInput.fill(query);
    // Debounce wait
    await this.page.waitForTimeout(500);
    await this.waitForTableLoad();
  }

  /**
   * Clear search input
   */
  async clearSearch() {
    await this.searchInput.clear();
    await this.waitForTableLoad();
  }

  /**
   * Filter by booking status
   * Uses FilterPopover which opens a Select inside a popover
   */
  async filterByStatus(status: keyof typeof BOOKING_STATUS | string) {
    // Click the Status filter popover trigger
    await this.statusFilter.click();
    // Wait for popover to open
    await this.page.waitForTimeout(200);
    // Click the Select trigger inside the popover
    const selectTrigger = this.page.locator('[role="combobox"]').first();
    await selectTrigger.click();
    // Select the status option
    await this.page.getByRole("option", { name: new RegExp(status, "i") }).click();
    // Click outside to close popover
    await this.page.keyboard.press("Escape");
    await this.waitForTableLoad();
  }

  /**
   * Clear all filters
   */
  async clearAllFilters() {
    const isVisible = await this.clearFiltersButton.isVisible().catch(() => false);
    if (isVisible) {
      await this.clearFiltersButton.click();
      await this.waitForTableLoad();
    }
  }

  // ================== Table Operations ==================

  /**
   * Get the number of rows in the table (excluding header)
   */
  async getRowCount(): Promise<number> {
    return this.tableBodyRows.count();
  }

  /**
   * Get all booking references from the table
   * References link to the booking detail page
   */
  async getBookingReferences(): Promise<string[]> {
    const refs: string[] = [];
    const refLinks = this.page.locator('table tbody td a[href^="/admin/bookings/"]');
    const count = await refLinks.count();

    for (let i = 0; i < count; i++) {
      const text = await refLinks.nth(i).textContent();
      if (text) {
        refs.push(text.trim());
      }
    }
    return refs;
  }

  /**
   * Click on a booking row to view details
   * Booking references are links that navigate to details
   */
  async clickBookingRow(reference: string) {
    await this.page.locator(`a:has-text("${reference}")`).click();
    await this.page.waitForURL(/\/admin\/bookings\//);
  }

  /**
   * Get a specific row by booking reference
   */
  getRowByReference(reference: string): Locator {
    return this.page.locator("table tbody tr").filter({ hasText: reference });
  }

  /**
   * Check if a booking with given reference exists in table
   */
  async bookingExists(reference: string): Promise<boolean> {
    const row = this.getRowByReference(reference);
    return row.isVisible();
  }

  /**
   * Get status badge text for a booking
   * Status shown in Badge component
   */
  async getBookingStatus(reference: string): Promise<string> {
    const row = this.getRowByReference(reference);
    // Find badge in the status column (typically 4th-5th column)
    const badge = row.locator('[class*="badge"], span').filter({
      hasText: /pending|confirmed|cancelled|completed/i,
    });
    return badge
      .first()
      .textContent()
      .then((t) => t?.trim() || "");
  }

  // ================== Actions ==================

  /**
   * Click new booking button
   */
  async clickNewBooking() {
    await this.newBookingButton.click();
  }

  /**
   * Start new multi-unit booking
   */
  async startNewMultiBooking() {
    await this.newBookingButton.click();
    await this.page.waitForURL(/\/admin\/bookings\/new/);
  }

  /**
   * Open actions menu for a booking
   * ActionMenu is a dropdown with actions
   */
  async openActionsMenu(reference: string) {
    const row = this.getRowByReference(reference);
    // ActionMenu trigger is usually in the last cell
    await row.locator('button[aria-haspopup="menu"]').first().click();
  }

  /**
   * Click action in menu
   * Menu items: Edit Booking, Upload Payment, Confirm, Cancel, Delete
   */
  async clickAction(actionName: string) {
    await this.page.getByRole("menuitem", { name: new RegExp(actionName, "i") }).click();
  }

  /**
   * View booking details by clicking reference
   */
  async viewBookingDetails(reference: string) {
    await this.clickBookingRow(reference);
  }

  /**
   * Edit booking via actions menu
   */
  async editBooking(reference: string) {
    await this.openActionsMenu(reference);
    await this.clickAction("Edit Booking");
    await this.page.waitForURL(/\/edit/);
  }

  /**
   * Upload payment via actions menu
   */
  async uploadPayment(reference: string) {
    await this.openActionsMenu(reference);
    await this.clickAction("Upload Payment");
  }

  /**
   * Confirm booking via actions menu
   */
  async confirmBooking(reference: string) {
    await this.openActionsMenu(reference);
    await this.clickAction("Confirm");
  }

  /**
   * Cancel booking via actions menu
   */
  async cancelBooking(reference: string) {
    await this.openActionsMenu(reference);
    await this.clickAction("Cancel");
  }

  /**
   * Export bookings data
   */
  async exportBookings() {
    await this.exportButton.click();
  }

  // ================== Pagination ==================

  /**
   * Go to next page
   */
  async goToNextPage() {
    await this.nextPageButton.click();
    await this.waitForTableLoad();
  }

  /**
   * Go to previous page
   */
  async goToPreviousPage() {
    await this.previousPageButton.click();
    await this.waitForTableLoad();
  }

  /**
   * Check if there are more pages
   */
  async hasNextPage(): Promise<boolean> {
    return this.nextPageButton.isEnabled();
  }

  // ================== Assertions ==================

  /**
   * Verify the table is visible
   */
  async expectTableVisible() {
    await expect(this.table).toBeVisible();
  }

  /**
   * Verify bookings are listed as a table (desktop) or cards (mobile)
   */
  async expectBookingListVisible() {
    await expect(this.bookingList.first()).toBeVisible();
  }

  /**
   * Verify empty state is shown
   */
  async expectEmptyState() {
    await expect(this.emptyState).toBeVisible();
  }

  /**
   * Verify minimum number of rows
   */
  async expectMinimumRows(count: number) {
    const rowCount = await this.getRowCount();
    expect(rowCount).toBeGreaterThanOrEqual(count);
  }

  /**
   * Verify search results contain expected text
   */
  async expectSearchResultsContain(text: string) {
    await expect(this.table).toContainText(text);
  }

  /**
   * Verify a booking status
   */
  async expectBookingStatus(reference: string, status: string) {
    const actualStatus = await this.getBookingStatus(reference);
    expect(actualStatus.toLowerCase()).toContain(status.toLowerCase());
  }
}
