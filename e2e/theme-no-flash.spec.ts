import { expect, test, type Page } from "@playwright/test";

import { loginAsAdmin } from "./fixtures/auth";

/**
 * Theme setting (light / dark / system) applies before first paint on every surface.
 * The class on <html> is recorded when <body> is inserted, which is before the stylesheet
 * (render-blocking) lets anything paint and before the app's JS runs.
 */

const BACKGROUND = { light: "rgb(245, 241, 236)", dark: "rgb(28, 24, 22)" };

type Theme = "light" | "dark" | "system";

async function recordThemeAtFirstBody(page: Page, savedTheme: Theme | null) {
  await page.addInitScript((theme) => {
    if (theme) localStorage.setItem("theme", theme);
    else localStorage.removeItem("theme");
    const observer = new MutationObserver(() => {
      if (!document.body) return;
      (window as unknown as { __themeAtFirstBody: string }).__themeAtFirstBody =
        document.documentElement.className;
      observer.disconnect();
    });
    observer.observe(document, { childList: true, subtree: true });
  }, savedTheme);
}

async function themeAtFirstBody(page: Page): Promise<string> {
  return page.evaluate(
    () => (window as unknown as { __themeAtFirstBody: string }).__themeAtFirstBody
  );
}

async function bodyBackground(page: Page): Promise<string> {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No 2d canvas context");
    context.fillStyle = getComputedStyle(document.body).backgroundColor;
    context.fillRect(0, 0, 1, 1);
    const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
    return `rgb(${red}, ${green}, ${blue})`;
  });
}

const cases: { saved: Theme | null; scheme: "light" | "dark"; expected: "light" | "dark" }[] = [
  { saved: null, scheme: "dark", expected: "dark" },
  { saved: null, scheme: "light", expected: "light" },
  { saved: "system", scheme: "dark", expected: "dark" },
  { saved: "dark", scheme: "light", expected: "dark" },
  { saved: "light", scheme: "dark", expected: "light" },
];

test.describe("Theme applies before first paint", () => {
  for (const { saved, scheme, expected } of cases) {
    test(`saved ${saved ?? "nothing"} with OS ${scheme} paints ${expected}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await recordThemeAtFirstBody(page, saved);

      await page.goto("/calendar");

      expect((await themeAtFirstBody(page)).split(" ")).toContain(expected);
      await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${expected}\\b`));
      expect(await bodyBackground(page)).toBe(BACKGROUND[expected]);
    });
  }
});

test.describe("Dark setting reaches every surface", () => {
  const surfaces = [
    { name: "public calendar", path: "/calendar", admin: false },
    { name: "guest booking", path: "/guest-booking", admin: false },
    { name: "admin dashboard", path: "/admin/dashboard", admin: true },
  ];

  for (const surface of surfaces) {
    test(`${surface.name} paints dark from the first frame`, async ({ page }) => {
      if (surface.admin && (!process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD)) {
        test.skip();
      }
      await page.emulateMedia({ colorScheme: "light" });
      if (surface.admin) await loginAsAdmin(page);
      await recordThemeAtFirstBody(page, "dark");

      await page.goto(surface.path);
      await page.waitForLoadState("networkidle");

      expect((await themeAtFirstBody(page)).split(" ")).toContain("dark");
      await expect(page.locator("html")).toHaveClass(/\bdark\b/);
      expect(await bodyBackground(page)).toBe(BACKGROUND.dark);
    });
  }
});
