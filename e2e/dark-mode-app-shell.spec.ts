import { expect, test, type Page } from "@playwright/test";

import { E2E_USER } from "../scripts/e2e/fixtures";
import { findLowContrastText } from "./fixtures/contrast";
import { LoginPage } from "./pages/LoginPage";

/**
 * Dark mode is readable on the app shell, the public pages and the shared fallbacks (#103):
 * the login page, the PWA install banner, the error screens and the legal pages.
 */

const COMPACT = { width: 390, height: 844 };
const EXPANDED = { width: 1280, height: 900 };

async function useDarkTheme(page: Page) {
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
}

async function expectReadable(page: Page, root = "body") {
  expect(await findLowContrastText(page, root)).toEqual([]);
}

/**
 * Serves a component module that throws on render, so the nearest `ErrorBoundary` shows its
 * fallback. Relies on the Vite dev server serving source modules by path.
 */
async function forceRenderError(page: Page, modulePath: string, exportName: string) {
  await page.route(`**/${modulePath}*`, (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `export function ${exportName}() { throw new Error("E2E forced render error"); }`,
    })
  );
}

function injectBeforeInstallPrompt() {
  const fire = () => {
    const event = new Event("beforeinstallprompt") as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string; platform: string }>;
    };
    event.prompt = async () => undefined;
    event.userChoice = Promise.resolve({ outcome: "dismissed", platform: "web" });
    window.dispatchEvent(event);
  };
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", fire);
  } else {
    fire();
  }
}

test.describe("Dark mode app shell", () => {
  test.beforeEach(async ({ page }) => {
    await useDarkTheme(page);
  });

  test("login page reads in dark on a phone", async ({ page }) => {
    await page.setViewportSize(COMPACT);
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
    await expectReadable(page);
  });

  test("PWA install banner reads in dark", async ({ page }) => {
    await page.addInitScript(injectBeforeInstallPrompt);
    await page.setViewportSize(COMPACT);
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(E2E_USER.email, E2E_USER.password);

    const banner = page.getByRole("region", { name: /install okaeri/i });
    await expect(banner).toBeVisible();
    await expectReadable(page, '[aria-label="Install Okaeri app"]');
  });

  test("privacy policy reads in dark on a phone", async ({ page }) => {
    await page.setViewportSize(COMPACT);
    await page.goto("/privacy-policy");
    await expect(page.getByRole("heading", { name: /privacy policy/i }).first()).toBeVisible();
    await expectReadable(page);
  });

  test("terms and conditions read in dark on a phone", async ({ page }) => {
    await page.setViewportSize(COMPACT);
    await page.goto("/terms-and-conditions");
    await expect(page.getByRole("heading", { name: /terms/i }).first()).toBeVisible();
    await expectReadable(page);
  });
});

test.describe("Dark mode error boundary fallbacks", () => {
  test.beforeEach(async ({ page }) => {
    await useDarkTheme(page);
    await page.setViewportSize(COMPACT);
  });

  test("component fallback reads in dark", async ({ page }) => {
    await forceRenderError(page, "src/components/auth/LoginForm.tsx", "LoginForm");
    await page.goto("/login");
    await expect(page.getByText("Component Error")).toBeVisible();
    await expectReadable(page);
  });

  test("page fallback in the admin layout reads in dark", async ({ page }) => {
    await page.setViewportSize(EXPANDED);
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(E2E_USER.email, E2E_USER.password);

    // A numeric search value fails the route's string schema inside the admin page boundary
    await page.goto("/admin/transfers?search=123");
    await expect(page.getByText("Page Error")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    await expectReadable(page);
  });

  test("app fallback reads in dark", async ({ page }) => {
    // An invalid search param throws while the route renders, outside any page boundary
    await page.goto("/login?registered=oops");
    await expect(page.getByText("Application Error")).toBeVisible();
    await expect(page.getByRole("button", { name: "Go Home" })).toBeVisible();
    await expectReadable(page);
  });
});
