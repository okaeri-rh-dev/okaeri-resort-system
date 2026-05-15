import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./fixtures/auth";

/**
 * Dispatches a synthetic `beforeinstallprompt` event on page load.
 * Wired via `page.addInitScript` so it runs in every navigated page
 * (including login → dashboard) before app code executes.
 */
function injectBeforeInstallPromptScript() {
  return () => {
    const fire = () => {
      const event = new Event("beforeinstallprompt") as Event & {
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: string; platform: string }>;
        platforms: string[];
      };
      event.prompt = async () => undefined;
      event.userChoice = Promise.resolve({ outcome: "dismissed", platform: "web" });
      event.platforms = ["web"];
      window.dispatchEvent(event);
    };
    if (document.readyState === "loading") {
      window.addEventListener("DOMContentLoaded", fire);
    } else {
      fire();
    }
  };
}

test.describe("PWA install banner", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(injectBeforeInstallPromptScript());
  });

  test("does not show on routes outside MainLayout", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("region", { name: /install okaeri/i })).toHaveCount(0);
  });

  test("shows when beforeinstallprompt has fired on an authenticated page", async ({ page }) => {
    await loginAsAdmin(page);
    const banner = page.getByRole("region", { name: /install okaeri/i });
    await expect(banner).toBeVisible();
    await expect(banner.getByRole("button", { name: /^install$/i })).toBeVisible();
    await expect(banner.getByRole("button", { name: /maybe later/i })).toBeVisible();
  });

  test("Maybe later snoozes for ~7 days", async ({ page, context }) => {
    await loginAsAdmin(page);
    const banner = page.getByRole("region", { name: /install okaeri/i });
    await expect(banner).toBeVisible();
    await banner.getByRole("button", { name: /maybe later/i }).click();
    await expect(banner).toHaveCount(0);

    const storage = await context.storageState();
    const origin = storage.origins.find((o) => o.origin.includes("localhost"));
    const snooze = origin?.localStorage.find((kv) => kv.name === "pwa-install-snoozed-until");
    expect(snooze, "snooze key written to localStorage").toBeDefined();
    const diffDays = (new Date(snooze!.value).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeGreaterThan(6.9);
    expect(diffDays).toBeLessThan(7.1);
  });

  test("Don't show again persists across reloads", async ({ page }) => {
    await loginAsAdmin(page);
    const banner = page.getByRole("region", { name: /install okaeri/i });
    await expect(banner).toBeVisible();
    await banner.getByRole("button", { name: /don't show again/i }).click();
    await expect(banner).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("region", { name: /install okaeri/i })).toHaveCount(0);
  });

  test("sidebar Install app escape hatch re-shows the banner", async ({ page }) => {
    await loginAsAdmin(page);
    const banner = page.getByRole("region", { name: /install okaeri/i });
    await expect(banner).toBeVisible();
    await banner.getByRole("button", { name: /don't show again/i }).click();
    await expect(banner).toHaveCount(0);

    // Sidebar escape hatch (desktop sidebar — Playwright default Desktop Chrome viewport)
    await page.getByRole("button", { name: /install app/i }).click();
    await expect(page.getByRole("region", { name: /install okaeri/i })).toBeVisible();
  });
});
