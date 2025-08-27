/**
 * End-to-End Authentication Flow Tests
 * Comprehensive E2E tests for the complete authentication system using Playwright
 */

import { test, expect, type Page, type BrowserContext } from "@playwright/test";

// Test data
const TEST_USER = {
  name: "Juan Dela Cruz",
  email: "juan.delacruz@okaeriresort.ph",
  password: "SecurePassword123!",
  confirmPassword: "SecurePassword123!",
  projectName: "Okaeri Beach Resort",
  phone: "+639171234567",
};

const EXISTING_USER = {
  email: "owner@okaeriresort.ph",
  password: "correct-password",
};

// Helper functions
async function fillLoginForm(page: Page, email: string, password: string) {
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
}

async function fillRegistrationForm(page: Page, userData = TEST_USER) {
  await page.fill('input[name="name"]', userData.name);
  await page.fill('input[name="email"]', userData.email);
  await page.fill('input[name="password"]', userData.password);
  await page.fill('input[name="confirmPassword"]', userData.confirmPassword);

  if (userData.projectName) {
    await page.fill('input[name="projectName"]', userData.projectName);
  }

  if (userData.phone) {
    await page.fill('input[name="phone"]', userData.phone);
  }

  // Accept terms
  await page.check('input[name="acceptTerms"]');
}

async function waitForNetworkIdle(page: Page) {
  await page.waitForLoadState("networkidle");
}

test.describe("Authentication Flow E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Start each test on the login page
    await page.goto("/login");
    await waitForNetworkIdle(page);
  });

  test.describe("Login Flow", () => {
    test("should successfully log in with valid credentials", async ({ page }) => {
      // Fill and submit login form
      await fillLoginForm(page, EXISTING_USER.email, EXISTING_USER.password);

      // Check remember me option
      await page.check('input[name="rememberMe"]');

      // Submit form
      await page.click('button[type="submit"]');

      // Wait for navigation to dashboard
      await expect(page).toHaveURL("/dashboard");

      // Verify user is logged in
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
      await expect(page.locator("text=Welcome Back")).toBeVisible();
    });

    test("should show error for invalid credentials", async ({ page }) => {
      // Fill with wrong credentials
      await fillLoginForm(page, "wrong@email.com", "wrongpassword");
      await page.click('button[type="submit"]');

      // Wait for error message
      await expect(page.locator("text=Invalid email or password")).toBeVisible();

      // Should stay on login page
      expect(page.url()).toContain("/login");
    });

    test("should handle rate limiting", async ({ page }) => {
      // Attempt multiple failed logins rapidly
      for (let i = 0; i < 6; i++) {
        await page.fill('input[type="email"]', "ratelimit@test.com");
        await page.fill('input[type="password"]', "wrongpassword");
        await page.click('button[type="submit"]');

        if (i < 4) {
          await expect(page.locator("text=Invalid credentials")).toBeVisible();
        }
      }

      // Should show rate limit error
      await expect(page.locator("text=Too many login attempts")).toBeVisible();
    });

    test("should validate form fields", async ({ page }) => {
      // Submit empty form
      await page.click('button[type="submit"]');

      // Check validation messages
      await expect(page.locator("text=Email is required")).toBeVisible();
      await expect(page.locator("text=Password is required")).toBeVisible();

      // Test invalid email format
      await page.fill('input[type="email"]', "invalid-email");
      await page.click('button[type="submit"]');
      await expect(page.locator("text=Please enter a valid email address")).toBeVisible();
    });

    test("should toggle password visibility", async ({ page }) => {
      const passwordInput = page.locator('input[type="password"]');
      const toggleButton = page.locator('button[aria-label*="password"]');

      // Initially password should be hidden
      await expect(passwordInput).toHaveAttribute("type", "password");

      // Click toggle to show password
      await toggleButton.click();
      await expect(page.locator('input[type="text"]')).toHaveCount(2); // email + password as text

      // Click again to hide
      await toggleButton.click();
      await expect(passwordInput).toHaveAttribute("type", "password");
    });

    test("should remember login state", async ({ page, context }) => {
      // Login with remember me checked
      await fillLoginForm(page, EXISTING_USER.email, EXISTING_USER.password);
      await page.check('input[name="rememberMe"]');
      await page.click('button[type="submit"]');

      // Wait for dashboard
      await expect(page).toHaveURL("/dashboard");

      // Create new page in same context (simulating page refresh)
      const newPage = await context.newPage();
      await newPage.goto("/dashboard");

      // Should still be logged in
      await expect(newPage.locator('[data-testid="user-menu"]')).toBeVisible();

      await newPage.close();
    });

    test("should redirect to intended page after login", async ({ page }) => {
      // Try to access protected page while not logged in
      await page.goto("/settings");

      // Should be redirected to login
      await expect(page).toHaveURL(/\/login/);

      // Login
      await fillLoginForm(page, EXISTING_USER.email, EXISTING_USER.password);
      await page.click('button[type="submit"]');

      // Should be redirected back to settings
      await expect(page).toHaveURL("/settings");
    });
  });

  test.describe("Registration Flow", () => {
    test("should successfully register a new user", async ({ page }) => {
      // Go to registration page
      await page.click("text=Create your resort account");
      await expect(page).toHaveURL("/register");

      // Fill registration form
      await fillRegistrationForm(page);

      // Submit form
      await page.click('button[type="submit"]');

      // Should redirect to dashboard after successful registration
      await expect(page).toHaveURL("/dashboard");

      // Verify user is logged in
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    });

    test("should validate registration form", async ({ page }) => {
      await page.goto("/register");

      // Submit empty form
      await page.click('button[type="submit"]');

      // Check required field validations
      await expect(page.locator("text=Name is required")).toBeVisible();
      await expect(page.locator("text=Email is required")).toBeVisible();
      await expect(page.locator("text=Password must be at least 8 characters")).toBeVisible();
      await expect(page.locator("text=You must accept the terms")).toBeVisible();
    });

    test("should validate password strength", async ({ page }) => {
      await page.goto("/register");

      // Test weak password
      await page.fill('input[name="password"]', "weak");
      await page.fill('input[name="confirmPassword"]', "weak");

      // Should show password strength indicator
      await expect(page.locator('[data-testid="password-strength"]')).toBeVisible();
      await expect(page.locator("text=weak", { exact: false })).toBeVisible();

      // Test strong password
      await page.fill('input[name="password"]', "StrongPassword123!");
      await page.fill('input[name="confirmPassword"]', "StrongPassword123!");

      await expect(page.locator("text=strong", { exact: false })).toBeVisible();
    });

    test("should validate password confirmation", async ({ page }) => {
      await page.goto("/register");

      await page.fill('input[name="name"]', TEST_USER.name);
      await page.fill('input[name="email"]', TEST_USER.email);
      await page.fill('input[name="password"]', TEST_USER.password);
      await page.fill('input[name="confirmPassword"]', "DifferentPassword123!");
      await page.check('input[name="acceptTerms"]');

      await page.click('button[type="submit"]');

      await expect(page.locator("text=Passwords do not match")).toBeVisible();
    });

    test("should validate Philippine phone numbers", async ({ page }) => {
      await page.goto("/register");

      // Test invalid phone numbers
      const invalidNumbers = [
        "1234567890", // Non-Philippine
        "09171234", // Too short
        "+63917123456789", // Too long
        "not-a-number", // Invalid format
      ];

      for (const number of invalidNumbers) {
        await page.fill('input[name="phone"]', number);
        await page.click('input[name="name"]'); // Trigger validation

        await expect(
          page.locator("text=Please enter a valid Philippine phone number")
        ).toBeVisible();
        await page.fill('input[name="phone"]', ""); // Clear for next test
      }

      // Test valid phone number
      await page.fill('input[name="phone"]', "+639171234567");
      await page.click('input[name="name"]');

      // Should not show error
      await expect(
        page.locator("text=Please enter a valid Philippine phone number")
      ).not.toBeVisible();
    });

    test("should handle registration with existing email", async ({ page }) => {
      await page.goto("/register");

      // Try to register with existing user's email
      await fillRegistrationForm(page, {
        ...TEST_USER,
        email: EXISTING_USER.email,
      });

      await page.click('button[type="submit"]');

      // Should show error
      await expect(page.locator("text=User already exists")).toBeVisible();
    });

    test("should show loading state during registration", async ({ page }) => {
      await page.goto("/register");
      await fillRegistrationForm(page);

      await page.click('button[type="submit"]');

      // Should show loading state
      await expect(page.locator("text=Creating account...")).toBeVisible();
      await expect(page.locator("button[disabled]")).toBeVisible();
    });
  });

  test.describe("Forgot Password Flow", () => {
    test("should send password reset email", async ({ page }) => {
      // Go to forgot password page
      await page.click("text=Forgot password?");
      await expect(page).toHaveURL("/forgot-password");

      // Fill email
      await page.fill('input[type="email"]', EXISTING_USER.email);
      await page.click('button[type="submit"]');

      // Should show success message
      await expect(page.locator("text=Password reset email sent")).toBeVisible();
    });

    test("should validate email in forgot password form", async ({ page }) => {
      await page.goto("/forgot-password");

      // Submit without email
      await page.click('button[type="submit"]');
      await expect(page.locator("text=Email is required")).toBeVisible();

      // Submit with invalid email
      await page.fill('input[type="email"]', "invalid-email");
      await page.click('button[type="submit"]');
      await expect(page.locator("text=Please enter a valid email address")).toBeVisible();
    });

    test("should handle rate limiting for password reset", async ({ page }) => {
      await page.goto("/forgot-password");

      // Attempt multiple resets
      for (let i = 0; i < 4; i++) {
        await page.fill('input[type="email"]', "ratelimit@test.com");
        await page.click('button[type="submit"]');
        await page.waitForTimeout(100);
      }

      // Should show rate limit error
      await expect(page.locator("text=Too many password reset attempts")).toBeVisible();
    });
  });

  test.describe("Protected Routes", () => {
    test("should redirect unauthenticated users to login", async ({ page }) => {
      const protectedRoutes = [
        "/dashboard",
        "/settings",
        "/bookings",
        "/expenses",
        "/properties",
        "/reports",
        "/team",
      ];

      for (const route of protectedRoutes) {
        await page.goto(route);
        await expect(page).toHaveURL(/\/login/);
      }
    });

    test("should allow access to protected routes for authenticated users", async ({ page }) => {
      // Navigate to login page first
      await page.goto("/login");
      await waitForNetworkIdle(page);

      // Login first
      await fillLoginForm(page, EXISTING_USER.email, EXISTING_USER.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL("/dashboard");

      // Test accessing protected routes
      const protectedRoutes = ["/settings", "/bookings", "/expenses", "/properties", "/reports"];

      for (const route of protectedRoutes) {
        await page.goto(route);
        await expect(page).toHaveURL(route);

        // Should see user menu (indicates authenticated)
        await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
      }
    });

    test("should handle role-based access control", async ({ page }) => {
      // Navigate to login page first
      await page.goto("/login");
      await waitForNetworkIdle(page);

      // Login as non-admin user
      await fillLoginForm(page, "staff@okaeriresort.ph", "correct-password");
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL("/dashboard");

      // Try to access admin-only route
      await page.goto("/settings/admin");

      // Should be redirected or show permission denied
      await expect(
        page.locator("text=Permission denied").or(page.locator("text=Unauthorized"))
      ).toBeVisible();
    });
  });

  test.describe("Logout Flow", () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to login page first
      await page.goto("/login");
      await waitForNetworkIdle(page);

      // Login before each logout test
      await fillLoginForm(page, EXISTING_USER.email, EXISTING_USER.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL("/dashboard");
    });

    test("should successfully log out user", async ({ page }) => {
      // Click user menu
      await page.click('[data-testid="user-menu"]');

      // Click logout
      await page.click("text=Logout");

      // Should redirect to login page
      await expect(page).toHaveURL("/login");

      // User menu should not be visible
      await expect(page.locator('[data-testid="user-menu"]')).not.toBeVisible();
    });

    test("should clear session after logout", async ({ page, context }) => {
      // Logout
      await page.click('[data-testid="user-menu"]');
      await page.click("text=Logout");
      await expect(page).toHaveURL("/login");

      // Create new page and try to access protected route
      const newPage = await context.newPage();
      await newPage.goto("/dashboard");

      // Should be redirected to login
      await expect(newPage).toHaveURL(/\/login/);

      await newPage.close();
    });
  });

  test.describe("Session Management", () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to login page first
      await page.goto("/login");
      await waitForNetworkIdle(page);

      await fillLoginForm(page, EXISTING_USER.email, EXISTING_USER.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL("/dashboard");
    });

    test("should show session timeout warning", async ({ page }) => {
      // Mock session timeout scenario
      await page.evaluate(() => {
        // Simulate session near expiry
        window.dispatchEvent(
          new CustomEvent("sessionWarning", {
            detail: { timeLeft: 60000 }, // 1 minute left
          })
        );
      });

      // Should show warning dialog
      await expect(page.locator('[data-testid="session-warning"]')).toBeVisible();
      await expect(page.locator("text=Your session will expire")).toBeVisible();
    });

    test("should extend session when user is active", async ({ page }) => {
      // Simulate user activity
      await page.click("body");
      await page.keyboard.press("Space");
      await page.mouse.move(100, 100);

      // Session should be extended (no warning should appear)
      await page.waitForTimeout(1000);
      await expect(page.locator('[data-testid="session-warning"]')).not.toBeVisible();
    });

    test("should handle session expiry", async ({ page }) => {
      // Mock session expiry
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent("sessionExpired"));
      });

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);

      // Should show session expired message
      await expect(page.locator("text=Your session has expired")).toBeVisible();
    });
  });

  test.describe("Error Handling", () => {
    test("should handle network errors gracefully", async ({ page }) => {
      // Simulate offline condition
      await page.context().setOffline(true);

      await fillLoginForm(page, EXISTING_USER.email, EXISTING_USER.password);
      await page.click('button[type="submit"]');

      // Should show network error
      await expect(page.locator("text=Network error")).toBeVisible();

      // Restore network
      await page.context().setOffline(false);
    });

    test("should show proper error messages for server errors", async ({ page }) => {
      // Try to trigger server error endpoint
      await page.goto("/login");
      await page.evaluate(() => {
        // Mock server error response
        window.fetch = () =>
          Promise.resolve(
            new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 })
          );
      });

      await fillLoginForm(page, EXISTING_USER.email, EXISTING_USER.password);
      await page.click('button[type="submit"]');

      await expect(page.locator("text=Internal server error")).toBeVisible();
    });
  });

  test.describe("Accessibility", () => {
    test("should be keyboard navigable", async ({ page }) => {
      // Tab through login form
      await page.keyboard.press("Tab"); // Email field
      await expect(page.locator('input[type="email"]')).toBeFocused();

      await page.keyboard.press("Tab"); // Password field
      await expect(page.locator('input[type="password"]')).toBeFocused();

      await page.keyboard.press("Tab"); // Password toggle
      await expect(page.locator('button[aria-label*="password"]')).toBeFocused();

      await page.keyboard.press("Tab"); // Remember me
      await expect(page.locator('input[type="checkbox"]')).toBeFocused();

      await page.keyboard.press("Tab"); // Submit button
      await expect(page.locator('button[type="submit"]')).toBeFocused();
    });

    test("should have proper ARIA labels", async ({ page }) => {
      // Check for proper ARIA labels
      await expect(page.locator('input[type="email"]')).toHaveAttribute("aria-describedby");
      await expect(page.locator('button[aria-label*="password"]')).toBeVisible();

      // Test with validation errors
      await page.click('button[type="submit"]');
      await expect(page.locator('input[type="email"][aria-describedby*="error"]')).toBeVisible();
    });

    test("should announce form errors to screen readers", async ({ page }) => {
      await page.click('button[type="submit"]');

      // Check that error messages have proper role
      await expect(page.locator('[role="alert"]')).toBeVisible();
    });

    test("should support high contrast mode", async ({ page }) => {
      // Enable high contrast mode simulation
      await page.emulateMedia({ colorScheme: "dark" });

      // Form should still be usable
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
    });
  });

  test.describe("Mobile Responsiveness", () => {
    test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE size

    test("should work on mobile devices", async ({ page }) => {
      // Form should be responsive
      const loginForm = page.locator("form");
      await expect(loginForm).toBeVisible();

      // Should be able to fill and submit form
      await fillLoginForm(page, EXISTING_USER.email, EXISTING_USER.password);
      await page.click('button[type="submit"]');

      await expect(page).toHaveURL("/dashboard");
    });

    test("should handle mobile keyboard properly", async ({ page }) => {
      const emailInput = page.locator('input[type="email"]');

      // Click email field
      await emailInput.click();

      // Should have proper input type for mobile keyboard
      await expect(emailInput).toHaveAttribute("type", "email");
      await expect(emailInput).toHaveAttribute("autocomplete", "email");
    });
  });

  test.describe("Performance", () => {
    test("should load login page quickly", async ({ page }) => {
      const startTime = Date.now();
      await page.goto("/login");
      await page.waitForLoadState("domcontentloaded");
      const loadTime = Date.now() - startTime;

      // Should load within reasonable time (adjust threshold as needed)
      expect(loadTime).toBeLessThan(3000);
    });

    test("should handle form submission without delays", async ({ page }) => {
      const startTime = Date.now();

      await fillLoginForm(page, EXISTING_USER.email, EXISTING_USER.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL("/dashboard");

      const totalTime = Date.now() - startTime;

      // Should complete login flow within reasonable time
      expect(totalTime).toBeLessThan(5000);
    });
  });
});

// Cleanup function for test data
test.afterAll(async () => {
  // Clean up any test data created during tests
  console.log("E2E Auth tests completed");
});
