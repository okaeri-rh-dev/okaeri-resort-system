import { expect, test, type Page } from "@playwright/test";

import { E2E_REF, E2E_USER } from "../scripts/e2e/fixtures";
import { LoginPage } from "./pages/LoginPage";

/**
 * Mobile booking card E2E spec.
 *
 * Exercises the Density 2 + Option A mobile card built in
 * docs/plans/2026-05-24-mobile-booking-card-density-design.md.
 *
 * Assumes the orchestrator (scripts/e2e/run-hooked.sh) has seeded
 * the E2E-* fixtures and a dedicated owner user. Do not run directly
 * via `npm run test:e2e` — use `npm run test:e2e:hooked` or, during
 * iteration, `npm run e2e:dev` against a manually-seeded DB.
 */

// Scope to a single MobileCard by anchoring on the per-booking info-zone
// button (aria-label "View booking <ref>") and stepping up to its parent.
const cardFor = (page: Page, ref: string) =>
  page.getByRole("button", { name: `View booking ${ref}` }).locator("..");

test.describe("Mobile booking card", () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(E2E_USER.email, E2E_USER.password);
    await page.goto("/admin/bookings");
    // Cards lazy-load via TanStack Query; wait for our fixture to surface.
    await expect(page.getByText(E2E_REF.PENDING)).toBeVisible();
  });

  test("renders Density 2 layout for a Pending booking", async ({ page }) => {
    const card = cardFor(page, E2E_REF.PENDING);
    await expect(card).toContainText("Jun 26 → 27");
    await expect(card).toContainText("1 night");
    await expect(card).toContainText("1 guest");
    await expect(card.getByRole("button", { name: /^Confirm$/ })).toBeVisible();
  });

  test("renders cross-month date range with both months", async ({ page }) => {
    const card = cardFor(page, E2E_REF.CONF_PAID);
    await expect(card).toContainText("Jun 30 → Jul 2");
    // Paid + Confirmed → no primary action button rendered
    await expect(card.getByRole("button", { name: /Upload Payment|^Confirm$/ })).toHaveCount(0);
  });

  test("Confirm primary button transitions Pending → Confirmed", async ({ page }) => {
    const card = cardFor(page, E2E_REF.PENDING);
    await card.getByRole("button", { name: /^Confirm$/ }).click();
    // After mutation, the same card should now show Upload Payment as primary.
    await expect(card.getByRole("button", { name: /Upload Payment/ })).toBeVisible();
    await expect(card.getByRole("button", { name: /^Confirm$/ })).toHaveCount(0);
  });

  test("⋯ menu shows owner-only Delete + full action set on Confirmed", async ({ page }) => {
    const card = cardFor(page, E2E_REF.CONFIRMED);
    // ⋯ trigger is an unlabeled icon button inside the card header.
    await card.locator("button:has(svg.lucide-ellipsis)").click();
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem", { name: "Edit Booking" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Upload Payment" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Cancel" })).toBeVisible();
    // Owner-only:
    await expect(menu.getByRole("menuitem", { name: "Delete" })).toBeVisible();
    // Confirmed booking → no Confirm menu item
    await expect(menu.getByRole("menuitem", { name: "Confirm" })).toHaveCount(0);
  });

  test("info-zone tap navigates to booking detail route", async ({ page }) => {
    await page.getByRole("button", { name: `View booking ${E2E_REF.CONFIRMED}` }).click();
    await expect(page).toHaveURL(/\/admin\/bookings\/[0-9a-f-]{36}/);
    // Detail page must actually render — guard against the loader silently throwing
    // (e.g. a future schema mismatch like the payments.status filter we just removed).
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb" }).getByText(E2E_REF.CONFIRMED)
    ).toBeVisible();
  });
});
