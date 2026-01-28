import { expect, type Locator, type Page } from "@playwright/test";

import { ROUTES, TIMEOUTS } from "../fixtures/test-data";

/**
 * Page Object Model for the Unit Assignment Page
 *
 * Handles the unit assignment workflow for bookings, including
 * all-or-nothing unit selection and availability validation.
 */
export class UnitAssignmentPage {
  readonly page: Page;

  // Page container
  readonly container: Locator;
  readonly pageTitle: Locator;

  // Booking info
  readonly bookingReference: Locator;
  readonly bookingDates: Locator;
  readonly guestInfo: Locator;
  readonly requestedUnits: Locator;

  // Unit selection
  readonly unitsGrid: Locator;
  readonly unitCards: Locator;
  readonly availableUnits: Locator;
  readonly unavailableUnits: Locator;
  readonly selectedUnits: Locator;

  // Selection counters
  readonly selectedCount: Locator;
  readonly requiredCount: Locator;
  readonly selectionStatus: Locator;

  // Validation
  readonly validationMessage: Locator;
  readonly validationError: Locator;
  readonly validationSuccess: Locator;

  // Actions
  readonly confirmAssignmentButton: Locator;
  readonly cancelButton: Locator;
  readonly clearSelectionButton: Locator;

  // Loading and feedback
  readonly loadingState: Locator;
  readonly successMessage: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    // Page container
    this.container = page.locator('[data-testid="unit-assignment"], [class*="unit-assignment"]');
    this.pageTitle = page.getByRole("heading", { name: /assign.*unit|unit.*assignment/i });

    // Booking info
    this.bookingReference = page.locator(
      '[data-testid="booking-reference"], [class*="booking-ref"]'
    );
    this.bookingDates = page.locator('[data-testid="booking-dates"], [class*="dates"]');
    this.guestInfo = page.locator('[data-testid="guest-info"], [class*="guest-info"]');
    this.requestedUnits = page.locator(
      '[data-testid="requested-units"], [class*="requested-count"]'
    );

    // Unit selection
    this.unitsGrid = page.locator('[data-testid="units-grid"], [class*="units-grid"]');
    this.unitCards = page.locator('[data-testid="unit-card"], [class*="unit-card"]');
    this.availableUnits = page.locator(
      '[data-available="true"], [class*="unit-card"]:not([data-unavailable])'
    );
    this.unavailableUnits = page.locator('[data-available="false"], [data-unavailable="true"]');
    this.selectedUnits = page.locator(
      '[data-selected="true"], [aria-selected="true"], [class*="selected"]'
    );

    // Selection counters
    this.selectedCount = page.locator('[data-testid="selected-count"], [class*="selected-count"]');
    this.requiredCount = page.locator('[data-testid="required-count"], [class*="required-count"]');
    this.selectionStatus = page.locator(
      '[data-testid="selection-status"], [class*="selection-status"]'
    );

    // Validation
    this.validationMessage = page.locator(
      '[data-testid="validation-message"], [class*="validation"]'
    );
    this.validationError = page.locator('[data-testid="validation-error"], [class*="error"]');
    this.validationSuccess = page.locator('[data-testid="validation-success"], [class*="success"]');

    // Actions
    this.confirmAssignmentButton = page.getByRole("button", {
      name: /confirm|assign|save/i,
    });
    this.cancelButton = page.getByRole("button", { name: /cancel|back/i });
    this.clearSelectionButton = page.getByRole("button", {
      name: /clear|reset/i,
    });

    // Loading and feedback
    this.loadingState = page.locator('[data-testid="loading"], [class*="loading"]');
    this.successMessage = page.locator(
      '[data-testid="success"], [role="alert"]:has-text("success")'
    );
    this.errorMessage = page.locator('[data-testid="error"], [role="alert"]:has-text("error")');
  }

  /**
   * Navigate to unit assignment for a specific booking
   */
  async goto(bookingId: string): Promise<void> {
    await this.page.goto(ROUTES.admin.bookingAssignUnits(bookingId));
    await this.waitForPageLoad();
  }

  /**
   * Wait for page to fully load
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState("networkidle");
    // Check each locator independently to avoid strict mode violation
    const containerVisible = await this.container.isVisible().catch(() => false);
    const gridVisible = await this.unitsGrid.isVisible().catch(() => false);

    if (containerVisible) {
      await expect(this.container).toBeVisible({ timeout: TIMEOUTS.navigation });
    } else if (gridVisible) {
      await expect(this.unitsGrid).toBeVisible({ timeout: TIMEOUTS.navigation });
    } else {
      // Fallback: wait for page title
      await expect(this.pageTitle).toBeVisible({ timeout: TIMEOUTS.navigation });
    }
  }

  // ================== Unit Selection ==================

  /**
   * Select a unit by name
   */
  async selectUnit(unitName: string): Promise<void> {
    const unitCard = this.page.locator(
      `[data-unit-name="${unitName}"], [class*="unit-card"]:has-text("${unitName}")`
    );
    await unitCard.click();
    await this.page.waitForTimeout(100); // Selection animation
  }

  /**
   * Deselect a unit by name
   */
  async deselectUnit(unitName: string): Promise<void> {
    const unitCard = this.page.locator(
      `[data-unit-name="${unitName}"][data-selected="true"], [class*="unit-card"][class*="selected"]:has-text("${unitName}")`
    );
    await unitCard.click();
    await this.page.waitForTimeout(100);
  }

  /**
   * Select multiple units by name
   */
  async selectUnits(unitNames: string[]): Promise<void> {
    for (const name of unitNames) {
      await this.selectUnit(name);
    }
  }

  /**
   * Clear all selected units
   */
  async clearSelection(): Promise<void> {
    const isVisible = await this.clearSelectionButton.isVisible();
    if (isVisible) {
      await this.clearSelectionButton.click();
    }
  }

  /**
   * Get unit card by name
   */
  getUnitCard(unitName: string): Locator {
    return this.page.locator(
      `[data-unit-name="${unitName}"], [class*="unit-card"]:has-text("${unitName}")`
    );
  }

  // ================== Selection Status ==================

  /**
   * Get count of currently selected units
   */
  async getSelectedCount(): Promise<number> {
    const countText = await this.selectedCount.textContent();
    if (countText) {
      const match = countText.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    }
    // Fallback: count selected elements
    return this.selectedUnits.count();
  }

  /**
   * Get the required number of units
   */
  async getRequiredCount(): Promise<number> {
    const countText = await this.requiredCount.textContent();
    if (countText) {
      const match = countText.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    }
    return 0;
  }

  /**
   * Check if a unit is available for selection
   */
  async isUnitAvailable(unitName: string): Promise<boolean> {
    const unitCard = this.getUnitCard(unitName);
    const isAvailable = await unitCard
      .getAttribute("data-available")
      .then((attr) => attr === "true")
      .catch(() => false);

    if (!isAvailable) {
      // Check if it doesn't have unavailable class
      const hasUnavailable = await unitCard
        .locator('[class*="unavailable"]')
        .isVisible()
        .catch(() => false);
      return !hasUnavailable;
    }
    return isAvailable;
  }

  /**
   * Check if a unit is currently selected
   */
  async isUnitSelected(unitName: string): Promise<boolean> {
    const unitCard = this.getUnitCard(unitName);
    const isSelected = await unitCard
      .getAttribute("data-selected")
      .then((attr) => attr === "true")
      .catch(() => false);

    if (!isSelected) {
      // Check for selected class
      const hasSelectedClass = await unitCard
        .locator('[class*="selected"]')
        .isVisible()
        .catch(() => false);
      return hasSelectedClass;
    }
    return isSelected;
  }

  // ================== Validation ==================

  /**
   * Check if current selection is valid (all-or-nothing)
   */
  async isAssignmentValid(): Promise<boolean> {
    const selected = await this.getSelectedCount();
    const required = await this.getRequiredCount();
    return selected === required;
  }

  /**
   * Get the current validation message
   */
  async getValidationMessage(): Promise<string> {
    const message = await this.validationMessage.textContent();
    return message?.trim() || "";
  }

  /**
   * Check if confirm button is enabled
   */
  async isConfirmEnabled(): Promise<boolean> {
    return this.confirmAssignmentButton.isEnabled();
  }

  // ================== Actions ==================

  /**
   * Confirm the unit assignment
   */
  async confirmAssignment(): Promise<void> {
    await this.confirmAssignmentButton.click();
    // Wait for success or navigation
    await Promise.race([
      this.successMessage.waitFor({ state: "visible", timeout: TIMEOUTS.medium }),
      this.page.waitForURL(/\/bookings\/|\/queue/, { timeout: TIMEOUTS.medium }),
    ]);
  }

  /**
   * Cancel and go back
   */
  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await this.page.waitForURL(/\/bookings|\/queue/);
  }

  // ================== Assertions ==================

  /**
   * Verify page loaded correctly
   */
  async expectPageLoaded(): Promise<void> {
    await expect(this.container).toBeVisible();
  }

  /**
   * Verify units grid is visible
   */
  async expectUnitsGridVisible(): Promise<void> {
    await expect(this.unitsGrid).toBeVisible();
  }

  /**
   * Verify a unit is available for selection
   */
  async expectUnitAvailable(unitName: string): Promise<void> {
    const unitCard = this.getUnitCard(unitName);
    await expect(unitCard).toBeVisible();
    const isAvailable = await this.isUnitAvailable(unitName);
    expect(isAvailable).toBeTruthy();
  }

  /**
   * Verify a unit is unavailable
   */
  async expectUnitUnavailable(unitName: string): Promise<void> {
    const unitCard = this.getUnitCard(unitName);
    await expect(unitCard).toBeVisible();
    const isAvailable = await this.isUnitAvailable(unitName);
    expect(isAvailable).toBeFalsy();
  }

  /**
   * Verify a unit is selected
   */
  async expectUnitSelected(unitName: string): Promise<void> {
    const isSelected = await this.isUnitSelected(unitName);
    expect(isSelected).toBeTruthy();
  }

  /**
   * Verify selection count matches expected
   */
  async expectSelectionCount(count: number): Promise<void> {
    const actual = await this.getSelectedCount();
    expect(actual).toBe(count);
  }

  /**
   * Verify assignment is valid (all required units selected)
   */
  async expectValidAssignment(): Promise<void> {
    const isValid = await this.isAssignmentValid();
    expect(isValid).toBeTruthy();
    await expect(this.confirmAssignmentButton).toBeEnabled();
  }

  /**
   * Verify assignment is invalid (wrong number of units)
   */
  async expectInvalidAssignment(): Promise<void> {
    const isValid = await this.isAssignmentValid();
    expect(isValid).toBeFalsy();
    await expect(this.confirmAssignmentButton).toBeDisabled();
  }

  /**
   * Verify success message after assignment
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

  /**
   * Verify confirm button is NOT visible (for unauthorized users)
   */
  async expectConfirmButtonHidden(): Promise<void> {
    await expect(this.confirmAssignmentButton).not.toBeVisible();
  }
}
