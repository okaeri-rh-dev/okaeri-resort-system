import { expect, type Locator, type Page } from "@playwright/test";

import { ROUTES, TIMEOUTS } from "../fixtures/test-data";

/**
 * Page Object Model for the Login Page
 * Handles authentication flows including login, error states, and redirects
 */
export class LoginPage {
  readonly page: Page;

  // Form elements
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;

  // Error/feedback elements
  readonly errorAlert: Locator;
  readonly loadingSpinner: Locator;

  // Links
  readonly forgotPasswordLink: Locator;

  // Turnstile CAPTCHA
  readonly turnstileWidget: Locator;

  constructor(page: Page) {
    this.page = page;

    // Form elements - using accessible selectors
    this.emailInput = page.getByLabel("Email");
    this.passwordInput = page.getByLabel("Password");
    this.signInButton = page.getByRole("button", { name: /sign in/i });

    // Error/feedback elements
    this.errorAlert = page.getByRole("alert");
    this.loadingSpinner = page.locator('[data-testid="loading-spinner"]');

    // Links
    this.forgotPasswordLink = page.getByRole("link", { name: /forgot/i });

    // Turnstile CAPTCHA (Cloudflare)
    this.turnstileWidget = page.locator('[data-testid="turnstile"], iframe[src*="turnstile"]');
  }

  /**
   * Navigate to the login page
   */
  async goto() {
    await this.page.goto(ROUTES.public.login);
    await this.waitForPageLoad();
  }

  /**
   * Wait for page to be fully loaded
   */
  async waitForPageLoad() {
    await this.page.waitForLoadState("networkidle");
    await expect(this.emailInput).toBeVisible({ timeout: TIMEOUTS.medium });
  }

  /**
   * Fill in login credentials
   */
  async fillCredentials(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
  }

  /**
   * Click the sign in button
   */
  async clickSignIn() {
    await this.signInButton.click();
  }

  /**
   * Perform complete login flow
   */
  async login(email: string, password: string) {
    await this.fillCredentials(email, password);
    await this.clickSignIn();
  }

  /**
   * Login and wait for successful redirect to dashboard
   */
  async loginAndWaitForDashboard(email: string, password: string) {
    await this.login(email, password);
    await this.page.waitForURL(/\/admin\/dashboard/, {
      timeout: TIMEOUTS.navigation,
    });
  }

  /**
   * Verify error message is displayed
   */
  async expectErrorMessage(messagePattern?: RegExp | string) {
    await expect(this.errorAlert).toBeVisible({ timeout: TIMEOUTS.medium });
    if (messagePattern) {
      await expect(this.errorAlert).toContainText(messagePattern);
    }
  }

  /**
   * Check if currently on login page
   */
  async isOnLoginPage(): Promise<boolean> {
    return this.page.url().includes("/login");
  }

  /**
   * Navigate to forgot password page
   */
  async goToForgotPassword() {
    await this.forgotPasswordLink.click();
    await this.page.waitForURL(/\/forgot-password/);
  }

  /**
   * Wait for Turnstile widget to be ready (for tests that need it)
   */
  async waitForTurnstile() {
    // Turnstile may not be present in test environments
    try {
      await this.turnstileWidget.waitFor({
        state: "visible",
        timeout: TIMEOUTS.short,
      });
    } catch {
      // Turnstile not present, continue
    }
  }
}
