import { expect, test, type Locator, type Page } from "@playwright/test";

import { ROUTES } from "./fixtures/test-data";

/**
 * Primitive targets and motion (DESIGN.md, Motion and density; #44).
 * Pointer type and reduced motion are media features jsdom can't evaluate, so these run in a
 * real browser on the guest booking form (Button, the date picker's Popover and Sheet).
 */

const COMPACT = { width: 390, height: 844 };
const EXPANDED = { width: 1280, height: 900 };
// Tailwind's ease-out and ease-in utilities, as getComputedStyle reports them
const EASE_OUT = "cubic-bezier(0, 0, 0.2, 1)";
const EASE_IN = "cubic-bezier(0.4, 0, 1, 1)";

async function openBookingForm(page: Page) {
  await page.goto(ROUTES.public.booking);
  await expect(page.getByRole("heading", { name: /select your stay dates/i })).toBeVisible({
    timeout: 15000,
  });
}

/** Button primitives only; product-made buttons are Migration work. */
async function visibleButtonBoxes(page: Page) {
  return page.locator("[data-slot=button]:visible").evaluateAll((buttons) =>
    buttons.map((button) => {
      const box = button.getBoundingClientRect();
      return { name: button.textContent?.trim() || button.ariaLabel, ...box.toJSON() };
    })
  );
}

/** The check-in field's trigger; the form prefills today's date. */
function datePickerTrigger(page: Page) {
  return page.getByRole("button", { name: /\d{1,2}(st|nd|rd|th), \d{4}$/ }).first();
}

async function animationOf(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      name: style.animationName,
      duration: style.animationDuration,
      easing: style.animationTimingFunction,
    };
  });
}

/** Closes the overlay with Escape and reads its animation in the next frame, mid-exit. */
async function exitAnimationOf(page: Page, overlay: Locator) {
  const handle = await overlay.elementHandle();
  await page.keyboard.press("Escape");
  return page.evaluate(async (element) => {
    await new Promise(requestAnimationFrame);
    const style = getComputedStyle(element as Element);
    return {
      state: (element as Element).getAttribute("data-state"),
      name: style.animationName,
      duration: style.animationDuration,
      easing: style.animationTimingFunction,
    };
  }, handle);
}

// Pointer type, not window width, sets the targets: both are checked at both widths
for (const [width, viewport] of Object.entries({ compact: COMPACT, expanded: EXPANDED })) {
  test.describe(`targets on a fine pointer, ${width}`, () => {
    test.use({ viewport });

    test("controls keep 36px default height and a 24px floor", async ({ page }) => {
      await openBookingForm(page);
      expect(await page.evaluate(() => matchMedia("(pointer: fine)").matches)).toBe(true);

      const next = await page.getByRole("button", { name: "Next" }).boundingBox();
      expect(next?.height).toBe(36);

      for (const box of await visibleButtonBoxes(page)) {
        expect(box.height, `${box.name} height`).toBeGreaterThanOrEqual(24);
        expect(box.width, `${box.name} width`).toBeGreaterThanOrEqual(24);
      }
    });

    test("inputs match the default button height", async ({ page }) => {
      await page.goto(ROUTES.public.login);
      const email = await page.getByLabel("Email").boundingBox();
      expect(email?.height).toBe(36);
    });
  });

  test.describe(`targets on a coarse pointer, ${width}`, () => {
    test.use({ viewport, hasTouch: true, isMobile: true });

    test("every visible button is at least 44px", async ({ page }) => {
      await openBookingForm(page);
      expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);

      for (const box of await visibleButtonBoxes(page)) {
        expect(box.height, `${box.name} height`).toBeGreaterThanOrEqual(44);
        expect(box.width, `${box.name} width`).toBeGreaterThanOrEqual(44);
      }
    });

    test("inputs are at least 44px tall", async ({ page }) => {
      await page.goto(ROUTES.public.login);
      const email = await page.getByLabel("Email").boundingBox();
      expect(email?.height).toBeGreaterThanOrEqual(44);
    });
  });
}

test.describe("overlay motion", () => {
  test("a popover enters in 200ms ease-out and exits in 150ms ease-in", async ({ page }) => {
    await page.setViewportSize(EXPANDED);
    await openBookingForm(page);

    await datePickerTrigger(page).click();
    const popover = page.getByRole("dialog");
    await expect(popover).toBeVisible();

    expect(await animationOf(popover)).toEqual({
      name: "enter",
      duration: "0.2s",
      easing: EASE_OUT,
    });
    expect(await exitAnimationOf(page, popover)).toEqual({
      state: "closed",
      name: "exit",
      duration: "0.15s",
      easing: EASE_IN,
    });
  });

  test("a sheet and its overlay enter in 200ms ease-out and exit in 150ms ease-in", async ({
    page,
  }) => {
    await page.setViewportSize(COMPACT);
    await openBookingForm(page);

    await datePickerTrigger(page).click();
    const sheet = page.getByRole("dialog", { name: "Select Date" });
    await expect(sheet).toBeVisible();
    const overlay = page.locator("[data-slot=sheet-overlay]");

    expect(await animationOf(sheet)).toEqual({
      name: "enter",
      duration: "0.2s",
      easing: EASE_OUT,
    });
    expect(await animationOf(overlay)).toEqual({
      name: "enter",
      duration: "0.2s",
      easing: EASE_OUT,
    });
    expect(await exitAnimationOf(page, sheet)).toEqual({
      state: "closed",
      name: "exit",
      duration: "0.15s",
      easing: EASE_IN,
    });
  });
});

test.describe("reduced motion", () => {
  test.use({ viewport: EXPANDED });

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("overlays appear instantly", async ({ page }) => {
    await openBookingForm(page);

    await datePickerTrigger(page).click();
    const popover = page.getByRole("dialog");
    await expect(popover).toBeVisible();

    const { duration } = await animationOf(popover);
    expect(parseFloat(duration)).toBeLessThan(0.001);
  });

  test("spinners keep spinning", async ({ page }) => {
    await openBookingForm(page);

    const spinner = await page.evaluate(() => {
      const element = document.createElement("div");
      element.className = "animate-spin";
      document.body.append(element);
      const style = getComputedStyle(element);
      return { duration: style.animationDuration, iterations: style.animationIterationCount };
    });

    expect(spinner).toEqual({ duration: "1s", iterations: "infinite" });
  });
});

test("the public calendar has no month-change fade", async ({ page }) => {
  await page.goto(ROUTES.public.home);
  const grid = page.getByRole("grid", { name: "Availability calendar" });
  await expect(grid).toBeVisible({ timeout: 15000 });

  expect((await animationOf(grid)).name).toBe("none");
});
