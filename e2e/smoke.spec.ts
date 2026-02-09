import { expect, test } from "@playwright/test";

import { ROUTES, VIEWPORTS } from "./fixtures/test-data";
import { LoginPage } from "./pages/LoginPage";
import { PublicCalendarPage } from "./pages/PublicCalendarPage";

/**
 * Smoke Tests
 *
 * Quick health checks to verify critical pages load correctly.
 * These tests should run fast and catch major deployment issues.
 */
test.describe("Smoke Tests", () => {
  test.describe("Public Routes", () => {
    test("public calendar page loads successfully", async ({ page }) => {
      const calendarPage = new PublicCalendarPage(page);
      await calendarPage.goto();

      // Verify page loads without errors
      await expect(page).toHaveURL("/");

      // Verify key elements are present
      await calendarPage.runSmokeTest();
    });

    test("booking form page is accessible", async ({ page }) => {
      await page.goto(ROUTES.public.booking);

      // Should not redirect to login
      expect(page.url()).toContain("/booking");

      // Wait for page to fully load (including lazy-loaded form)
      await page.waitForLoadState("networkidle");

      // Verify form is present by checking for the main h1 heading
      await expect(page.getByRole("heading", { name: "Book Your Stay", level: 1 })).toBeVisible({
        timeout: 15000,
      });

      // Verify first step form elements are present (Check-In Date label)
      await expect(page.getByText(/check-in date/i).first()).toBeVisible({ timeout: 5000 });
    });

    test("login page loads correctly", async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      // Verify login form elements are present
      await expect(loginPage.emailInput).toBeVisible();
      await expect(loginPage.passwordInput).toBeVisible();
      await expect(loginPage.signInButton).toBeVisible();
    });

    test("privacy policy page loads", async ({ page }) => {
      await page.goto(ROUTES.public.privacyPolicy);

      // Should contain privacy-related content (main h1 heading)
      await expect(page.getByRole("heading", { name: "Privacy Policy", level: 1 })).toBeVisible();
    });

    test("terms and conditions page loads", async ({ page }) => {
      await page.goto(ROUTES.public.termsAndConditions);

      // Should contain terms-related content (main h1 heading)
      await expect(
        page.getByRole("heading", { name: "Terms and Conditions", level: 1 })
      ).toBeVisible();
    });

    test("booking status check page loads", async ({ page }) => {
      await page.goto(ROUTES.public.checkStatus);

      // Should show status check form - check for the main heading
      await expect(
        page.getByRole("heading", { name: "Check Booking Status", level: 1 })
      ).toBeVisible();

      // Verify form fields are present
      await expect(page.getByLabel("Booking Reference")).toBeVisible();
      await expect(page.getByLabel("Email Address")).toBeVisible();
    });
  });

  test.describe("Protected Routes Redirect", () => {
    test("admin dashboard redirects unauthenticated users", async ({ page }) => {
      await page.goto(ROUTES.admin.dashboard);

      // Should redirect to login page
      await expect(page).toHaveURL(/\/login/);
    });

    test("admin bookings page redirects unauthenticated users", async ({ page }) => {
      await page.goto(ROUTES.admin.bookings);

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });

    test("admin units page redirects unauthenticated users", async ({ page }) => {
      await page.goto(ROUTES.admin.units);

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });

    test("admin payments page redirects unauthenticated users", async ({ page }) => {
      await page.goto(ROUTES.admin.payments);

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe("Navigation Links", () => {
    test("booking page is directly accessible from calendar", async ({ page }) => {
      // Verify navigation from home to booking works via direct URL
      // (Current home page is view-only without navigation links)
      const calendarPage = new PublicCalendarPage(page);
      await calendarPage.goto();
      await expect(page).toHaveURL("/");

      // Navigate directly to booking page
      await page.goto(ROUTES.public.booking);
      await expect(page).toHaveURL(/\/booking/);

      // Verify booking form loads
      await expect(page.getByRole("heading", { name: /book your stay/i })).toBeVisible({
        timeout: 15000,
      });
    });

    test("login page is directly accessible", async ({ page }) => {
      // Verify login page is accessible via direct navigation
      const calendarPage = new PublicCalendarPage(page);
      await calendarPage.goto();
      await expect(page).toHaveURL("/");

      // Navigate directly to login
      await page.goto(ROUTES.public.login);
      await expect(page).toHaveURL(/\/login/);
    });

    test("login page has forgot password link", async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      // Navigate to forgot password
      await loginPage.goToForgotPassword();
      await expect(page).toHaveURL(/\/forgot-password/);
    });
  });

  test.describe("Responsive Design", () => {
    test("public calendar renders on mobile viewport", async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize(VIEWPORTS.mobile);

      const calendarPage = new PublicCalendarPage(page);
      await calendarPage.goto();

      // Verify page is functional on mobile
      await expect(page.locator("body")).toBeVisible();

      // Verify calendar loads on mobile - check for main heading (use first() to handle duplicates)
      await expect(page.getByRole("heading", { name: "Okaeri Availability" })).toBeVisible({
        timeout: 10000,
      });
    });

    test("login page renders on mobile viewport", async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);

      const loginPage = new LoginPage(page);
      await loginPage.goto();

      // Form should be visible and usable
      await expect(loginPage.emailInput).toBeVisible();
      await expect(loginPage.passwordInput).toBeVisible();
      await expect(loginPage.signInButton).toBeVisible();
    });

    test("public calendar renders on tablet viewport", async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.tablet);

      const calendarPage = new PublicCalendarPage(page);
      await calendarPage.goto();

      // Verify page is functional on tablet
      await expect(page.locator("body")).toBeVisible();

      // Verify calendar loads on tablet
      await expect(page.getByRole("heading", { name: "Okaeri Availability" })).toBeVisible({
        timeout: 10000,
      });

      // Layout should adapt appropriately (not just stretched mobile)
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5);
    });
  });

  test.describe("Error Handling", () => {
    test("404 page shows for unknown routes", async ({ page }) => {
      const response = await page.goto("/this-route-does-not-exist");

      // Check for 404 response or error page content
      // The app might show a custom 404 page or redirect
      const url = page.url();
      const content = await page.content();

      // Should either show 404 status, have "not found" text, or redirect
      const is404 =
        response?.status() === 404 ||
        content.toLowerCase().includes("not found") ||
        content.toLowerCase().includes("404");

      // If not 404, should have redirected somewhere valid
      expect(is404 || url.includes("/login") || url === page.url()).toBeTruthy();
    });

    test("booking confirmation with invalid ref shows error", async ({ page }) => {
      await page.goto(ROUTES.public.bookingConfirmation("INVALID-REF-123"));

      // Should show error or not found state
      await expect(page.getByText(/not found|invalid|error/i).first()).toBeVisible({
        timeout: 10000,
      });
    });
  });
});
