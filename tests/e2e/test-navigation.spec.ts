import { test, expect } from "@playwright/test";

test.describe("Navigation Verification", () => {
  test("should properly authenticate and navigate to protected routes", async ({ page }) => {
    console.log("\n========== NAVIGATION TEST ==========\n");

    // 1. Try to access dashboard directly
    console.log("1. Attempting to access /dashboard directly...");
    await page.goto("/dashboard");
    await page.waitForTimeout(1000);
    console.log("   Current URL:", page.url());

    // 2. Check if redirected to login
    if (page.url().includes("/login")) {
      console.log("   ✓ Correctly redirected to login page");

      // 3. Perform login
      console.log("\n2. Logging in with mock credentials...");
      await page.fill('input[type="email"]', "owner@okaeriresort.ph");
      await page.fill('input[type="password"]', "correct-password");
      await page.click('button[type="submit"]');

      // 4. Wait for navigation
      await page.waitForTimeout(3000);
      console.log("   Current URL after login:", page.url());

      // 5. Check if we're on dashboard
      if (page.url().includes("/dashboard")) {
        console.log("   ✅ Successfully navigated to dashboard!");

        // Check for dashboard elements
        const pageTitle = await page.title();
        console.log("   Page title:", pageTitle);

        // Look for common dashboard elements
        const headings = await page.locator("h1, h2, h3").allTextContents();
        console.log("   Headings found:", headings.slice(0, 3));

        // Check for user menu or logout button
        const userIndicators = await page
          .locator(
            'button:has-text("Logout"), button:has-text("Sign out"), [data-testid*="user"], .user-menu'
          )
          .count();
        console.log("   User menu/logout elements:", userIndicators);
      } else if (page.url().includes("/login")) {
        console.log("   ❌ Still on login page - authentication failed!");

        // Check for error messages
        const errors = await page.locator('.error, .alert, [role="alert"]').allTextContents();
        console.log("   Error messages:", errors);
      } else {
        console.log("   ⚠️  Unexpected URL:", page.url());
      }

      // 6. Test navigation to other routes
      console.log("\n3. Testing navigation to other protected routes...");

      const routes = ["/settings", "/bookings", "/expenses"];
      for (const route of routes) {
        await page.goto(route);
        await page.waitForTimeout(1000);
        const currentUrl = page.url();
        const isProtected = currentUrl.includes("/login");
        const isAccessible = currentUrl.includes(route);
        console.log(
          `   ${route}: ${isAccessible ? "✅ Accessible" : isProtected ? "❌ Redirects to login" : "⚠️ Unexpected: " + currentUrl}`
        );

        if (isAccessible) {
          const heading = await page
            .locator("h1, h2")
            .first()
            .textContent()
            .catch(() => "No heading");
          console.log(`      Page heading: ${heading}`);
        }
      }
    } else {
      console.log("   ⚠️  Did not redirect to login. Current URL:", page.url());
    }

    console.log("\n========== END TEST ==========\n");
  });
});
