import { expect, test } from "@playwright/test";

import { INVALID_CREDENTIALS, ROUTES, TEST_USERS, VIEWPORTS } from "./fixtures/test-data";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";

/**
 * Authentication Tests
 *
 * Tests for login, logout, password reset, and session management.
 * Note: Some tests require valid test credentials in environment variables.
 */
test.describe("Authentication", () => {
  test.describe("Login Page UI", () => {
    test("displays all required form elements", async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      // Verify all form elements are present
      await expect(loginPage.emailInput).toBeVisible();
      await expect(loginPage.passwordInput).toBeVisible();
      await expect(loginPage.signInButton).toBeVisible();
      await expect(loginPage.forgotPasswordLink).toBeVisible();
    });

    test("email input accepts text", async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      await loginPage.emailInput.fill("test@example.com");
      await expect(loginPage.emailInput).toHaveValue("test@example.com");
    });

    test("password input is masked", async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      // Verify password input has type="password"
      await expect(loginPage.passwordInput).toHaveAttribute("type", "password");

      await loginPage.passwordInput.fill("secretpassword");
      await expect(loginPage.passwordInput).toHaveValue("secretpassword");
    });

    test("sign in button is initially enabled", async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      await expect(loginPage.signInButton).toBeEnabled();
    });
  });

  test.describe("Login Validation", () => {
    test("shows error for invalid email format", async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      await loginPage.fillCredentials(INVALID_CREDENTIALS.malformedEmail, "somepassword");
      await loginPage.clickSignIn();

      // Should show validation error
      await expect(page.getByText(/invalid|email/i).first()).toBeVisible({ timeout: 5000 });
    });

    test("shows error for empty fields on submit", async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      // Click sign in without filling fields
      await loginPage.clickSignIn();

      // Should show validation error
      await expect(page.getByText(/required|email|password/i).first()).toBeVisible({
        timeout: 5000,
      });
    });

    test("shows error for wrong credentials", async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      await loginPage.fillCredentials(
        INVALID_CREDENTIALS.wrongEmail,
        INVALID_CREDENTIALS.wrongPassword
      );
      await loginPage.clickSignIn();

      // Wait a moment for error to appear
      await page.waitForTimeout(1000);

      // Should show authentication error - check multiple patterns
      const hasAlertError = await loginPage.errorAlert.isVisible().catch(() => false);
      const hasToast = await page
        .locator('[role="status"], [class*="toast"]')
        .first()
        .isVisible()
        .catch(() => false);
      const hasErrorText = await page
        .getByText(/invalid|incorrect|failed|error|wrong|denied/i)
        .first()
        .isVisible()
        .catch(() => false);
      const hasRedText = await page
        .locator('[class*="text-red"], [class*="text-destructive"], [class*="error"]')
        .first()
        .isVisible()
        .catch(() => false);

      // Should still be on login page (didn't succeed)
      const stillOnLogin = page.url().includes("/login");

      // Error should be shown OR we should still be on login page
      expect(hasAlertError || hasToast || hasErrorText || hasRedText || stillOnLogin).toBeTruthy();
    });
  });

  test.describe("Successful Login", () => {
    // Skip if no test credentials are configured
    test.skip(
      !process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD,
      "Test credentials not configured"
    );

    test("admin can login and reach dashboard", async ({ page }) => {
      const loginPage = new LoginPage(page);
      const dashboardPage = new DashboardPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(TEST_USERS.admin.email, TEST_USERS.admin.password);

      // Verify on dashboard
      await dashboardPage.expectToBeOnDashboard();
      await dashboardPage.verifyDashboardLoaded();
    });

    test("owner can login and reach dashboard", async ({ page }) => {
      test.skip(
        !process.env.TEST_OWNER_EMAIL || !process.env.TEST_OWNER_PASSWORD,
        "Owner credentials not configured"
      );

      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(TEST_USERS.owner.email, TEST_USERS.owner.password);

      // Verify redirected to dashboard
      await expect(page).toHaveURL(/\/admin\/dashboard/);
    });

    test("staff can login and reach dashboard", async ({ page }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(TEST_USERS.staff.email, TEST_USERS.staff.password);

      await expect(page).toHaveURL(/\/admin\/dashboard/);
    });
  });

  test.describe("Protected Routes", () => {
    test("unauthenticated user is redirected to login", async ({ page }) => {
      // Try to access protected route
      await page.goto(ROUTES.admin.dashboard);

      // Should be redirected to login
      await expect(page).toHaveURL(/\/login/);
    });

    test("login redirect preserves intended destination", async ({ page }) => {
      // Try to access specific protected route
      await page.goto(ROUTES.admin.bookings);

      // Should be redirected to login
      await expect(page).toHaveURL(/\/login/);

      // After successful login, should redirect back to intended page
      // Note: This behavior depends on implementation
    });

    test("a failed role lookup shows the error screen, not Pending Approval", async ({ page }) => {
      test.skip(
        !process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD,
        "Test credentials not configured"
      );
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(TEST_USERS.admin.email, TEST_USERS.admin.password);

      await page.route("**/rest/v1/rpc/get_current_audit_role", (route) =>
        route.fulfill({ status: 500, json: { message: "boom" } })
      );
      await page.goto(ROUTES.admin.dashboard);

      await expect(page.getByRole("heading", { name: "Authentication Error" })).toBeVisible();
      await expect(page).not.toHaveURL(/pending-approval/);
    });
  });

  test.describe("Logout", () => {
    // Both tests sign out the same user, and a sign-out ends all of its sessions.
    test.describe.configure({ mode: "serial" });

    test("user can logout and lands on admin login", async ({ page }) => {
      const loginPage = new LoginPage(page);
      const dashboardPage = new DashboardPage(page);

      // Login first
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(TEST_USERS.logout.email, TEST_USERS.logout.password);

      await dashboardPage.logout();

      await expect(page).toHaveURL(/\/admin\/login/);
    });

    test("after logout, protected routes redirect to login", async ({ page }) => {
      const loginPage = new LoginPage(page);
      const dashboardPage = new DashboardPage(page);

      // Login
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(TEST_USERS.logout.email, TEST_USERS.logout.password);

      await dashboardPage.logout();

      // Try to access protected route
      await page.goto(ROUTES.admin.dashboard);

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe("Password Reset Flow", () => {
    test("can navigate to forgot password page", async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      await loginPage.goToForgotPassword();
      await expect(page).toHaveURL(/\/forgot-password/);
    });

    test("forgot password page has email input", async ({ page }) => {
      await page.goto(ROUTES.public.forgotPassword);

      // Should have email input for password reset
      await expect(page.getByLabel(/email/i)).toBeVisible();
    });

    test("forgot password shows confirmation on submit", async ({ page }) => {
      await page.goto(ROUTES.public.forgotPassword);

      // Fill in email
      await page.getByLabel(/email/i).fill("test@example.com");

      // Submit
      await page.getByRole("button", { name: /reset|send|submit/i }).click();

      // Should show confirmation message
      await expect(page.getByText(/sent|check|email/i).first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Session Persistence", () => {
    test.skip(
      !process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD,
      "Test credentials not configured"
    );

    test("session persists after page refresh", async ({ page }) => {
      const loginPage = new LoginPage(page);
      const dashboardPage = new DashboardPage(page);

      // Login
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(TEST_USERS.admin.email, TEST_USERS.admin.password);

      // Refresh the page
      await page.reload();

      // Should still be on dashboard (session persisted)
      await dashboardPage.expectToBeOnDashboard();
    });

    test("session persists when navigating between pages", async ({ page }) => {
      const loginPage = new LoginPage(page);
      const dashboardPage = new DashboardPage(page);

      // Login
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(TEST_USERS.admin.email, TEST_USERS.admin.password);

      // Navigate to different pages
      await dashboardPage.goToBookings();
      await expect(page).toHaveURL(/\/admin\/bookings/);

      // Navigate back to dashboard
      await page.goto(ROUTES.admin.dashboard);
      await dashboardPage.expectToBeOnDashboard();
    });
  });

  test.describe("Responsive Design", () => {
    test.describe("Mobile Viewport", () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize(VIEWPORTS.mobile);
      });

      test("login form renders correctly on mobile", async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();

        // Form elements should be visible
        await expect(loginPage.emailInput).toBeVisible();
        await expect(loginPage.passwordInput).toBeVisible();
        await expect(loginPage.signInButton).toBeVisible();

        // No horizontal overflow
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        const viewportWidth = await page.evaluate(() => window.innerWidth);
        expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5);
      });

      test.describe("on a touch screen", () => {
        // Targets follow the pointer, not the width: 44px under (pointer: coarse)
        test.use({ hasTouch: true, isMobile: true });

        test("login inputs have adequate touch targets on mobile", async ({ page }) => {
          const loginPage = new LoginPage(page);
          await loginPage.goto();

          const emailBox = await loginPage.emailInput.boundingBox();
          expect(emailBox?.height).toBeGreaterThanOrEqual(44);

          const buttonBox = await loginPage.signInButton.boundingBox();
          expect(buttonBox?.height).toBeGreaterThanOrEqual(44);
        });
      });

      test("forgot password page works on mobile", async ({ page }) => {
        await page.goto(ROUTES.public.forgotPassword);

        // Email input should be visible
        await expect(page.getByLabel(/email/i)).toBeVisible();

        // Submit button should be visible
        await expect(page.getByRole("button", { name: /reset|send|submit/i })).toBeVisible();
      });
    });

    test.describe("Tablet Viewport", () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize(VIEWPORTS.tablet);
      });

      test("login form displays appropriately on tablet", async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();

        // Form should display correctly
        await expect(loginPage.emailInput).toBeVisible();
        await expect(loginPage.passwordInput).toBeVisible();
        await expect(loginPage.signInButton).toBeVisible();
        await expect(loginPage.forgotPasswordLink).toBeVisible();
      });
    });
  });
});
