import { expect, type Locator, type Page } from "@playwright/test";

import type { SeasonalRateConfig } from "../fixtures/pricing-data";
import { ROUTES, TIMEOUTS } from "../fixtures/test-data";

/**
 * Page Object Model for the Pricing Configuration Page
 *
 * Handles admin pricing management including base rates,
 * weekend rates, seasonal pricing, and extra person fees.
 */
export class PricingConfigPage {
  readonly page: Page;

  // Page container
  readonly container: Locator;
  readonly pageTitle: Locator;

  // Unit selector
  readonly unitSelector: Locator;
  readonly unitOptions: Locator;

  // Base pricing section
  readonly basePricingSection: Locator;
  readonly baseRateInput: Locator;
  readonly weekendRateInput: Locator;
  readonly baseOccupancyInput: Locator;
  readonly maxOccupancyInput: Locator;
  readonly extraPersonRateInput: Locator;

  // Seasonal rates section
  readonly seasonalRatesSection: Locator;
  readonly seasonalRatesList: Locator;
  readonly addSeasonalRateButton: Locator;

  // Seasonal rate form (modal or inline)
  readonly seasonalRateForm: Locator;
  readonly seasonalRateNameInput: Locator;
  readonly seasonalRateMultiplierInput: Locator;
  readonly seasonalRateStartDateInput: Locator;
  readonly seasonalRateEndDateInput: Locator;
  readonly seasonalRateActiveToggle: Locator;
  readonly saveSeasonalRateButton: Locator;
  readonly cancelSeasonalRateButton: Locator;
  readonly deleteSeasonalRateButton: Locator;

  // Actions
  readonly saveButton: Locator;
  readonly resetButton: Locator;
  readonly cancelButton: Locator;

  // Validation
  readonly validationErrors: Locator;

  // Loading and feedback
  readonly loadingState: Locator;
  readonly successMessage: Locator;
  readonly errorMessage: Locator;

  // Price preview
  readonly pricePreviewSection: Locator;
  readonly previewCheckInInput: Locator;
  readonly previewCheckOutInput: Locator;
  readonly previewGuestCountInput: Locator;
  readonly previewCalculateButton: Locator;
  readonly previewResult: Locator;

  constructor(page: Page) {
    this.page = page;

    // Page container - use the page title as reliable indicator
    this.container = page.locator("div.space-y-6").first();
    this.pageTitle = page.getByRole("heading", { name: "Pricing Configuration", level: 1 });

    // Unit selector (not used in current design - global pricing)
    this.unitSelector = page.getByLabel(/unit|cabin/i);
    this.unitOptions = page.getByRole("option");

    // Base pricing section - use Card with title "Rate Configuration"
    this.basePricingSection = page.locator("article").filter({
      has: page.getByText("Rate Configuration"),
    });
    // Exact label matching from PricingConfigForm component
    this.baseRateInput = page.getByLabel("Base Rate (Weekdays)");
    this.weekendRateInput = page.getByLabel("Weekend Rate (Fri-Sat)");
    this.baseOccupancyInput = page.getByLabel("Base Occupancy");
    this.maxOccupancyInput = page.getByLabel("Max Capacity Per Unit");
    this.extraPersonRateInput = page.getByLabel("Extra Person Rate");

    // Seasonal rates section
    this.seasonalRatesSection = page.locator(
      '[data-testid="seasonal-rates"], [class*="seasonal-rates"]'
    );
    this.seasonalRatesList = page.locator(
      '[data-testid="seasonal-rates-list"], [class*="rates-list"]'
    );
    this.addSeasonalRateButton = page.getByRole("button", {
      name: /add.*season|new.*rate/i,
    });

    // Seasonal rate form
    this.seasonalRateForm = page.locator(
      '[data-testid="seasonal-rate-form"], [role="dialog"], [class*="rate-form"]'
    );
    this.seasonalRateNameInput = page.getByLabel(/name|season name/i);
    this.seasonalRateMultiplierInput = page.getByLabel(/multiplier|rate multiplier/i);
    this.seasonalRateStartDateInput = page.getByLabel(/start date/i);
    this.seasonalRateEndDateInput = page.getByLabel(/end date/i);
    this.seasonalRateActiveToggle = page.getByLabel(/active|enabled/i);
    this.saveSeasonalRateButton = page.locator(
      '[data-testid="save-seasonal"], button:has-text("Save")'
    );
    this.cancelSeasonalRateButton = page.locator(
      '[data-testid="cancel-seasonal"], button:has-text("Cancel")'
    );
    this.deleteSeasonalRateButton = page.getByRole("button", {
      name: /delete|remove/i,
    });

    // Actions - exact button text from component
    this.saveButton = page.getByRole("button", {
      name: "Save Pricing Configuration",
    });
    this.resetButton = page.getByRole("button", { name: /reset|revert/i });
    this.cancelButton = page.getByRole("button", { name: "Cancel" });

    // Validation
    this.validationErrors = page.locator(
      '[class*="error"], [role="alert"]:not(:has-text("success"))'
    );

    // Loading and feedback
    this.loadingState = page.locator('[data-testid="loading"], [class*="loading"]');
    this.successMessage = page.locator(
      '[data-testid="success"], [role="alert"]:has-text("success")'
    );
    this.errorMessage = page.locator('[data-testid="error"], [role="alert"]:has-text("error")');

    // Price preview
    this.pricePreviewSection = page.locator('[data-testid="price-preview"], [class*="preview"]');
    this.previewCheckInInput = page.locator(
      '[data-testid="preview-checkin"], [class*="preview"] input[type="date"]:first-of-type'
    );
    this.previewCheckOutInput = page.locator(
      '[data-testid="preview-checkout"], [class*="preview"] input[type="date"]:last-of-type'
    );
    this.previewGuestCountInput = page.locator(
      '[data-testid="preview-guests"], [class*="preview"] input[type="number"]'
    );
    this.previewCalculateButton = page.getByRole("button", {
      name: /calculate|preview/i,
    });
    this.previewResult = page.locator('[data-testid="preview-result"], [class*="preview-result"]');
  }

  /**
   * Navigate to the pricing configuration page
   */
  async goto(): Promise<void> {
    await this.page.goto(ROUTES.admin.unitsPricing);
    await this.waitForPageLoad();
  }

  /**
   * Wait for page to fully load
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState("networkidle");
    // Check each locator independently to avoid strict mode violation
    const containerVisible = await this.container.isVisible().catch(() => false);
    const basePricingVisible = await this.basePricingSection.isVisible().catch(() => false);

    if (containerVisible) {
      await expect(this.container).toBeVisible({ timeout: TIMEOUTS.navigation });
    } else if (basePricingVisible) {
      await expect(this.basePricingSection).toBeVisible({ timeout: TIMEOUTS.navigation });
    } else {
      // Wait for pricing page elements - use heading as reliable indicator
      await expect(this.pageTitle).toBeVisible({ timeout: TIMEOUTS.navigation });
    }
  }

  // ================== Unit Selection ==================

  /**
   * Select a unit to configure pricing
   */
  async selectUnit(unitName: string): Promise<void> {
    await this.unitSelector.click();
    await this.page.getByRole("option", { name: new RegExp(unitName, "i") }).click();
    await this.page.waitForTimeout(300); // Wait for form to update
  }

  /**
   * Get currently selected unit
   */
  async getSelectedUnit(): Promise<string> {
    return (await this.unitSelector.inputValue()) || "";
  }

  // ================== Base Pricing ==================

  /**
   * Set base rate for a unit
   */
  async setBaseRate(rate: number): Promise<void> {
    await this.baseRateInput.fill(rate.toString());
  }

  /**
   * Get current base rate
   */
  async getBaseRate(): Promise<number> {
    const value = await this.baseRateInput.inputValue();
    return parseFloat(value) || 0;
  }

  /**
   * Set weekend rate for a unit
   */
  async setWeekendRate(rate: number): Promise<void> {
    await this.weekendRateInput.fill(rate.toString());
  }

  /**
   * Get current weekend rate
   */
  async getWeekendRate(): Promise<number> {
    const value = await this.weekendRateInput.inputValue();
    return parseFloat(value) || 0;
  }

  /**
   * Set base occupancy
   */
  async setBaseOccupancy(count: number): Promise<void> {
    await this.baseOccupancyInput.fill(count.toString());
  }

  /**
   * Set maximum occupancy
   */
  async setMaxOccupancy(count: number): Promise<void> {
    await this.maxOccupancyInput.fill(count.toString());
  }

  /**
   * Set extra person rate
   */
  async setExtraPersonRate(rate: number): Promise<void> {
    await this.extraPersonRateInput.fill(rate.toString());
  }

  /**
   * Get current extra person rate
   */
  async getExtraPersonRate(): Promise<number> {
    const value = await this.extraPersonRateInput.inputValue();
    return parseFloat(value) || 0;
  }

  /**
   * Set all base pricing fields
   */
  async setBasePricing(config: {
    baseRate: number;
    weekendRate: number;
    baseOccupancy?: number;
    maxOccupancy?: number;
    extraPersonRate?: number;
  }): Promise<void> {
    await this.setBaseRate(config.baseRate);
    await this.setWeekendRate(config.weekendRate);
    if (config.baseOccupancy !== undefined) {
      await this.setBaseOccupancy(config.baseOccupancy);
    }
    if (config.maxOccupancy !== undefined) {
      await this.setMaxOccupancy(config.maxOccupancy);
    }
    if (config.extraPersonRate !== undefined) {
      await this.setExtraPersonRate(config.extraPersonRate);
    }
  }

  // ================== Seasonal Rates ==================

  /**
   * Add a new seasonal rate
   */
  async addSeasonalRate(config: SeasonalRateConfig): Promise<void> {
    await this.addSeasonalRateButton.click();
    await expect(this.seasonalRateForm).toBeVisible();

    await this.seasonalRateNameInput.fill(config.name);
    await this.seasonalRateMultiplierInput.fill(config.multiplier.toString());
    await this.seasonalRateStartDateInput.fill(config.startDate);
    await this.seasonalRateEndDateInput.fill(config.endDate);

    if (config.isActive !== undefined) {
      const isChecked = await this.seasonalRateActiveToggle.isChecked();
      if (isChecked !== config.isActive) {
        await this.seasonalRateActiveToggle.click();
      }
    }

    await this.saveSeasonalRateButton.click();
    await this.seasonalRateForm.waitFor({ state: "hidden" });
  }

  /**
   * Edit an existing seasonal rate
   */
  async editSeasonalRate(rateName: string, updates: Partial<SeasonalRateConfig>): Promise<void> {
    // Find and click edit on the rate row
    const rateRow = this.seasonalRatesList.locator(`:has-text("${rateName}")`);
    const editButton = rateRow.getByRole("button", { name: /edit/i });
    await editButton.click();

    await expect(this.seasonalRateForm).toBeVisible();

    if (updates.name) {
      await this.seasonalRateNameInput.fill(updates.name);
    }
    if (updates.multiplier !== undefined) {
      await this.seasonalRateMultiplierInput.fill(updates.multiplier.toString());
    }
    if (updates.startDate) {
      await this.seasonalRateStartDateInput.fill(updates.startDate);
    }
    if (updates.endDate) {
      await this.seasonalRateEndDateInput.fill(updates.endDate);
    }
    if (updates.isActive !== undefined) {
      const isChecked = await this.seasonalRateActiveToggle.isChecked();
      if (isChecked !== updates.isActive) {
        await this.seasonalRateActiveToggle.click();
      }
    }

    await this.saveSeasonalRateButton.click();
    await this.seasonalRateForm.waitFor({ state: "hidden" });
  }

  /**
   * Delete a seasonal rate
   */
  async deleteSeasonalRate(rateName: string): Promise<void> {
    const rateRow = this.seasonalRatesList.locator(`:has-text("${rateName}")`);
    const deleteButton = rateRow.getByRole("button", { name: /delete|remove/i });
    await deleteButton.click();

    // Handle confirmation dialog
    const confirmButton = this.page.getByRole("button", {
      name: /confirm|yes|delete/i,
    });
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }
  }

  /**
   * Get list of seasonal rate names
   */
  async getSeasonalRateNames(): Promise<string[]> {
    const nameElements = await this.seasonalRatesList
      .locator('[class*="rate-name"], td:first-child')
      .all();
    const names: string[] = [];
    for (const el of nameElements) {
      const text = await el.textContent();
      if (text) names.push(text.trim());
    }
    return names;
  }

  // ================== Price Preview ==================

  /**
   * Calculate price preview
   */
  async calculatePricePreview(
    checkIn: string,
    checkOut: string,
    guestCount: number
  ): Promise<number> {
    await this.previewCheckInInput.fill(checkIn);
    await this.previewCheckOutInput.fill(checkOut);
    await this.previewGuestCountInput.fill(guestCount.toString());
    await this.previewCalculateButton.click();

    await expect(this.previewResult).toBeVisible();
    const resultText = await this.previewResult.textContent();
    const cleaned = resultText?.replace(/[^\d.-]/g, "") || "0";
    return parseFloat(cleaned);
  }

  // ================== Save/Cancel ==================

  /**
   * Save all pricing changes
   */
  async saveChanges(): Promise<void> {
    await this.saveButton.click();
    await this.successMessage.waitFor({
      state: "visible",
      timeout: TIMEOUTS.medium,
    });
  }

  /**
   * Reset to saved values
   */
  async resetChanges(): Promise<void> {
    await this.resetButton.click();
  }

  /**
   * Cancel and go back
   */
  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }

  // ================== Assertions ==================

  /**
   * Verify page loaded correctly
   */
  async expectPageLoaded(): Promise<void> {
    // Use page title as reliable indicator - it's always present
    await expect(this.pageTitle).toBeVisible({ timeout: TIMEOUTS.navigation });
  }

  /**
   * Verify base rate matches expected
   */
  async expectBaseRate(rate: number): Promise<void> {
    const actual = await this.getBaseRate();
    expect(actual).toBe(rate);
  }

  /**
   * Verify weekend rate matches expected
   */
  async expectWeekendRate(rate: number): Promise<void> {
    const actual = await this.getWeekendRate();
    expect(actual).toBe(rate);
  }

  /**
   * Verify seasonal rate exists
   */
  async expectSeasonalRateExists(rateName: string): Promise<void> {
    const names = await this.getSeasonalRateNames();
    expect(names).toContain(rateName);
  }

  /**
   * Verify seasonal rate does NOT exist
   */
  async expectSeasonalRateNotExists(rateName: string): Promise<void> {
    const names = await this.getSeasonalRateNames();
    expect(names).not.toContain(rateName);
  }

  /**
   * Verify validation error is shown
   */
  async expectValidationError(): Promise<void> {
    await expect(this.validationErrors.first()).toBeVisible();
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

  /**
   * Verify save button is visible (for authorized users)
   */
  async expectSaveButtonVisible(): Promise<void> {
    await expect(this.saveButton).toBeVisible();
  }

  /**
   * Verify save button is NOT visible (for unauthorized users)
   */
  async expectSaveButtonHidden(): Promise<void> {
    await expect(this.saveButton).not.toBeVisible();
  }
}
