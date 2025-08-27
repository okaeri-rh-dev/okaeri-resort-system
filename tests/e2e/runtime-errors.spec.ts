import { test, expect, ConsoleMessage, Page } from "@playwright/test";

// Runtime error detection configuration
const RUNTIME_ERROR_PATTERNS = [
  // JavaScript syntax errors
  /SyntaxError:/,
  /ReferenceError:/,
  /TypeError:/,
  /RangeError:/,

  // Module loading errors
  /does not provide an export named/,
  /Cannot find module/,
  /Failed to resolve module/,

  // React-specific errors
  /Invalid hook call/,
  /Cannot read properties of undefined/,
  /Cannot read properties of null/,

  // Regex errors
  /Invalid regular expression/,
  /Range out of order in character class/,

  // PWA/Service Worker errors
  /Failed to register a ServiceWorker/,
  /workbox-build/,

  // Network errors that might indicate configuration issues
  /Failed to fetch/,
  /NetworkError/,

  // Vite-specific errors
  /\[vite\] Internal server error/,
  /\[vite\] page reload/,
];

// Pages to check for runtime errors
const PAGES_TO_CHECK = [
  { path: "/", name: "Home" },
  { path: "/auth/login", name: "Login" },
  { path: "/auth/register", name: "Register" },
  { path: "/dashboard", name: "Dashboard" },
  { path: "/bookings", name: "Bookings" },
  { path: "/properties", name: "Properties" },
  { path: "/expenses", name: "Expenses" },
  { path: "/analytics", name: "Analytics" },
  { path: "/settings", name: "Settings" },
];

// Helper to detect console errors
async function detectConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];

  page.on("console", (message: ConsoleMessage) => {
    if (message.type() === "error") {
      const text = message.text();

      // Check if it matches any runtime error pattern
      for (const pattern of RUNTIME_ERROR_PATTERNS) {
        if (pattern.test(text)) {
          errors.push(`Console error: ${text}`);
          break;
        }
      }
    }
  });

  // Also listen for uncaught exceptions
  page.on("pageerror", (error) => {
    errors.push(`Page error: ${error.message}`);
  });

  return errors;
}

test.describe("Runtime Error Detection", () => {
  test.beforeEach(async ({ page }) => {
    // Set up error detection before each test
    await page.goto("/", { waitUntil: "networkidle" });
  });

  test("should not have any runtime errors on initial load", async ({ page }) => {
    const errors = await detectConsoleErrors(page);

    // Navigate to the home page
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Wait for any async operations
    await page.waitForTimeout(2000);

    // Check for errors
    expect(errors).toHaveLength(0);
  });

  test("should detect regex validation errors", async ({ page }) => {
    const errors = await detectConsoleErrors(page);

    // Navigate to registration page where regex validation might occur
    await page.goto("/auth/register", { waitUntil: "domcontentloaded" });

    // Try to trigger validation by entering invalid characters
    const projectNameInput = page.locator('input[name="projectName"]');
    if ((await projectNameInput.count()) > 0) {
      // Test the fixed regex pattern
      await projectNameInput.fill("Test-Project'&");
      await page.waitForTimeout(500);
    }

    // Check that no regex errors occurred
    const regexErrors = errors.filter((e) => e.includes("Invalid regular expression"));
    expect(regexErrors).toHaveLength(0);
  });

  test("should detect module import errors", async ({ page }) => {
    const errors = await detectConsoleErrors(page);

    // Navigate through the app to trigger module loading
    for (const pageInfo of PAGES_TO_CHECK.slice(0, 3)) {
      try {
        await page.goto(pageInfo.path, {
          waitUntil: "domcontentloaded",
          timeout: 10000,
        });
        await page.waitForTimeout(1000);
      } catch (e) {
        // Continue even if navigation fails
      }
    }

    // Check for module export errors
    const moduleErrors = errors.filter(
      (e) => e.includes("does not provide an export named") || e.includes("Cannot find module")
    );

    expect(moduleErrors, "Module import errors detected").toHaveLength(0);
  });

  test("should detect PWA/Service Worker errors", async ({ page }) => {
    const errors = await detectConsoleErrors(page);

    // Only check in production-like environment
    const isProd = process.env.NODE_ENV === "production";

    if (isProd) {
      await page.goto("/", { waitUntil: "networkidle" });
      await page.waitForTimeout(3000); // Wait for SW registration

      const pwaErrors = errors.filter((e) => e.includes("ServiceWorker") || e.includes("workbox"));

      expect(pwaErrors, "PWA/Service Worker errors detected").toHaveLength(0);
    }
  });

  test("should check all main pages for runtime errors", async ({ page }) => {
    const pageErrors: { page: string; errors: string[] }[] = [];

    for (const pageInfo of PAGES_TO_CHECK) {
      const errors = await detectConsoleErrors(page);

      try {
        await page.goto(pageInfo.path, {
          waitUntil: "domcontentloaded",
          timeout: 10000,
        });

        // Wait for React to render
        await page.waitForTimeout(1500);

        if (errors.length > 0) {
          pageErrors.push({
            page: pageInfo.name,
            errors: [...errors],
          });
        }

        // Clear errors for next page
        errors.length = 0;
      } catch (e) {
        console.log(`Could not navigate to ${pageInfo.name}: ${e}`);
      }
    }

    // Report all errors found
    if (pageErrors.length > 0) {
      const errorReport = pageErrors
        .map((pe) => `${pe.page}:\n  ${pe.errors.join("\n  ")}`)
        .join("\n\n");

      throw new Error(`Runtime errors detected on pages:\n\n${errorReport}`);
    }
  });

  test("should detect React hook errors", async ({ page }) => {
    const errors = await detectConsoleErrors(page);

    // Navigate to a page with React components
    await page.goto("/dashboard", {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });

    await page.waitForTimeout(2000);

    // Check for React-specific errors
    const reactErrors = errors.filter(
      (e) =>
        e.includes("Invalid hook call") ||
        e.includes("Hooks can only be called") ||
        e.includes("use")
    );

    expect(reactErrors, "React hook errors detected").toHaveLength(0);
  });

  test("should detect undefined property access errors", async ({ page }) => {
    const errors = await detectConsoleErrors(page);

    // Navigate through interactive pages
    await page.goto("/bookings", {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });

    // Try to interact with elements that might trigger errors
    const buttons = page.locator("button");
    const buttonCount = await buttons.count();

    for (let i = 0; i < Math.min(3, buttonCount); i++) {
      try {
        await buttons.nth(i).click();
        await page.waitForTimeout(500);
      } catch (e) {
        // Continue if click fails
      }
    }

    // Check for undefined property errors
    const undefinedErrors = errors.filter(
      (e) =>
        e.includes("Cannot read properties of undefined") ||
        e.includes("Cannot read properties of null") ||
        e.includes("is not defined")
    );

    expect(undefinedErrors, "Undefined property access errors detected").toHaveLength(0);
  });

  test("should verify error boundaries are working", async ({ page }) => {
    // This test verifies that error boundaries catch errors gracefully
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    // Check if error boundary UI elements exist
    const errorBoundaryElements = page.locator("[data-error-boundary]");
    const hasErrorBoundary = (await errorBoundaryElements.count()) === 0;

    // No error boundary UI should be visible if everything is working
    expect(hasErrorBoundary, "Error boundary UI should not be visible").toBeTruthy();
  });
});

// Smoke test for critical functionality
test.describe("Critical Path Smoke Tests", () => {
  test("should be able to navigate to login", async ({ page }) => {
    await page.goto("/auth/login");

    // Check for login form elements
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible({
      timeout: 5000,
    });
  });

  test("should load dashboard without errors", async ({ page, context }) => {
    // Mock authentication if needed
    await context.addCookies([
      {
        name: "auth-token",
        value: "mock-token",
        domain: "localhost",
        path: "/",
      },
    ]);

    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/dashboard", { waitUntil: "networkidle" });

    expect(errors).toHaveLength(0);
  });
});
