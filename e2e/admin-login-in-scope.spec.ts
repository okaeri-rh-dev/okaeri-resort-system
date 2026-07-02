import { expect, test } from "@playwright/test";

/**
 * Verifies the admin login lives inside the /admin PWA scope and that the
 * un-nested /admin/login route escapes the /admin auth guard (no redirect loop).
 *
 * These tests assume an UNAUTHENTICATED browser. The Playwright config injects
 * no global storageState, so `context.isAuthenticated` is false by default and
 * the /admin guard will redirect to /admin/login.
 */
test.describe("admin login is in /admin scope", () => {
  test("logged-out visit to /admin redirects to /admin/login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("/admin/login renders and does NOT loop (guard is escaped)", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page).toHaveURL(/\/admin\/login/); // stays put, no bounce
    await expect(
      page.getByRole("heading", { level: 2, name: "Okaeri Resort System" })
    ).toBeVisible();
  });
});
