import { expect, test, type Page } from "@playwright/test";

import { E2E_ASSIGN_PAID_BOOKING_ID, E2E_REF, E2E_UNIT_ID } from "../scripts/e2e/fixtures";
import { loginAsOwner } from "./fixtures/auth";
import { COMPACT, EXPANDED, expectReadable, useDarkTheme } from "./fixtures/contrast";
import { TEST_GUEST } from "./fixtures/test-data";
import { BookingFormPage } from "./pages/BookingFormPage";

/**
 * Dark mode is readable on the surfaces #71 fixed: no text under WCAG AA against what is
 * painted behind it. Needs the E2E-* fixtures (`npm run seed:e2e`).
 */

test.describe("Dark mode surfaces", () => {
  test.beforeEach(async ({ page }) => {
    await useDarkTheme(page);
  });

  test("admin bookings table fits the expanded pane and reads in dark", async ({ page }) => {
    await page.setViewportSize(EXPANDED);
    await loginAsOwner(page);
    await page.goto("/admin/bookings");
    await expect(page.getByRole("link", { name: E2E_REF.PENDING })).toBeVisible();

    const actionsHeader = page.getByRole("columnheader", { name: "Actions" });
    const box = await actionsHeader.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(EXPANDED.width);
    await expectReadable(page);
  });

  test("admin booking cards read in dark", async ({ page }) => {
    await page.setViewportSize(COMPACT);
    await loginAsOwner(page);
    await page.goto("/admin/bookings");
    await expect(page.getByText(E2E_REF.PENDING)).toBeVisible();
    await expectReadable(page);
  });

  test("admin dashboard reads in dark", async ({ page }) => {
    await page.setViewportSize(EXPANDED);
    await loginAsOwner(page);
    await expect(page.getByText("Total Bookings")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Booking Calendar" })).toBeVisible();
    await expectReadable(page);
  });

  test("admin cabins read in dark", async ({ page }) => {
    await page.setViewportSize(EXPANDED);
    await loginAsOwner(page);
    await page.goto(`/admin/units/${E2E_UNIT_ID}`);
    await expect(page.getByText("Current Global Rates")).toBeVisible();
    await expectReadable(page);
  });

  test("assign cabins reads in dark", async ({ page }) => {
    await page.setViewportSize(EXPANDED);
    await loginAsOwner(page);
    await page.goto(`/admin/bookings/${E2E_ASSIGN_PAID_BOOKING_ID}/assign-units`);
    await expect(page.getByText(E2E_REF.ASSIGN_PAID)).toBeVisible();

    const firstCabin = page.getByRole("button", { name: /^Cabin .*, not selected$/ }).first();
    await expect(firstCabin).toBeVisible();
    await expectReadable(page);

    await firstCabin.click();
    await expect(page.getByText("1/2 selected")).toBeVisible();
    await expectReadable(page);
  });

  test("public availability calendar reads in dark", async ({ page }) => {
    await page.setViewportSize(COMPACT);
    await page.goto("/calendar");
    await expect(page.getByRole("grid").first()).toBeVisible();
    await expectReadable(page);
  });
});

const PNG_SCREENSHOT = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

/** Stubs the signed-URL request and holds the storage PUT until `finishUpload` is called. */
async function stubScreenshotUpload(page: Page) {
  let finishUpload = () => {};
  const uploadFinished = new Promise<void>((resolve) => (finishUpload = resolve));

  await page.route("**/api/guest-booking/upload-url", (route) =>
    route.fulfill({
      json: {
        success: true,
        upload_url: "/e2e-stub-storage/gcash.png",
        file_path: "TEMP-E2E_1761000000.png",
      },
    })
  );
  await page.route("**/e2e-stub-storage/**", async (route) => {
    await uploadFinished;
    await route.fulfill({ status: 200, body: "" });
  });

  return finishUpload;
}

test.describe("Dark mode guest payment step", () => {
  test("uploaded payment screenshot reads in dark on a phone", async ({ page }) => {
    await useDarkTheme(page);
    await page.setViewportSize(COMPACT);
    const finishUpload = await stubScreenshotUpload(page);

    const form = new BookingFormPage(page);
    await form.goto();
    await form.goToNextStep();
    await form.goToNextStep();
    await form.fillContactInfo(TEST_GUEST);
    await form.goToNextStep();
    await form.expectStep4Visible();

    await form.fileUploadInput.setInputFiles({
      name: "gcash.png",
      mimeType: "image/png",
      buffer: PNG_SCREENSHOT,
    });
    await expect(page.getByText(/uploading…/i)).toBeVisible();
    await expect(form.nextButton).toBeDisabled();

    finishUpload();
    await expect(page.getByText("Uploaded", { exact: true })).toBeVisible();
    await expect(page.getByText("gcash.png")).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove" })).toBeEnabled();
    await expect(form.nextButton).toBeEnabled();
    await expect(page.getByText("Invalid payment proof")).toBeHidden();
    await expectReadable(page);
  });
});
