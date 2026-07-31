/**
 * Browser-level RLS smoke test.
 *
 * Exercises the app's real, role-reachable flows against the role-based RLS
 * policies (migration 20260725000000). This is the integration-level guard that
 * catches "the UI performs an operation at a role the policy denies" — the exact
 * class of mismatch found for staff payment-proof uploads.
 *
 * Verifies:
 * - Staff can view bookings (staff SELECT under RLS) and upload a payment proof,
 *   which inserts a payment (staff payments INSERT under RLS). Success is a
 *   silent DB side-effect (no toast), so we assert the payment row directly.
 * - Owner can open the Expenses page (owner SELECT expenses under RLS).
 *
 * Requires: local Supabase with the migration applied, the role test users
 * (seeded by global-setup from .env.test), and the E2E booking fixtures
 * (`npm run seed:e2e`). Skips cleanly if the fixtures/credentials are absent.
 */

import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { E2E_REF } from "../scripts/e2e/fixtures";
import { loginAsOwner, loginAsStaff } from "./fixtures/auth";
import { BookingsTablePage } from "./pages/BookingsTablePage";

// 1x1 PNG — a valid image the payment-proofs bucket (accept image/*) will accept.
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

function admin(): SupabaseClient {
  // Local-only (all env files point at 127.0.0.1). Falls back to the well-known
  // local service key so the spec is self-contained.
  return createClient(
    process.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321",
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ||
      "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

test.describe("RLS role smoke (browser)", () => {
  const db = admin();
  let bookingId: string | null = null;

  test.beforeAll(async () => {
    // Locate the seeded Pending booking staff will upload a proof against.
    const { data } = await db
      .from("bookings")
      .select("booking_id")
      .eq("booking_reference", E2E_REF.PENDING)
      .maybeSingle();
    bookingId = data?.booking_id ?? null;
    // Clean any prior payment so the assertion observes a fresh insert.
    if (bookingId) await db.from("payments").delete().eq("booking_id", bookingId);
  });

  test.afterAll(async () => {
    if (bookingId) await db.from("payments").delete().eq("booking_id", bookingId);
  });

  test("staff can view bookings and upload a payment proof (staff SELECT + payments INSERT)", async ({
    page,
  }) => {
    test.skip(!bookingId, "E2E bookings not seeded — run `npm run seed:e2e`.");

    await loginAsStaff(page);

    const bookings = new BookingsTablePage(page);
    await bookings.goto();
    await bookings.waitForPageLoad();
    await bookings.search(E2E_REF.PENDING);

    // Scope to the seeded booking's row. The action trigger is an icon-only
    // button (no accessible name — see audit finding #7); Radix sets
    // aria-haspopup="menu" on the DropdownMenuTrigger, which is a stable hook.
    const row = page.getByRole("row").filter({ hasText: E2E_REF.PENDING });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.locator('button[aria-haspopup="menu"]').click();

    // "Upload Payment" triggers a native file chooser (handleUploadPayment
    // creates + clicks a file input).
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByRole("menuitem", { name: /upload payment/i }).click(),
    ]);
    await fileChooser.setFiles({ name: "proof.png", mimeType: "image/png", buffer: PNG_1X1 });

    // Success is silent in the UI — assert the payment row was inserted (this is
    // the staff payments INSERT that RLS must allow).
    await expect
      .poll(
        async () => {
          const { count } = await db
            .from("payments")
            .select("payment_id", { count: "exact", head: true })
            .eq("booking_id", bookingId!);
          return count ?? 0;
        },
        { timeout: 20_000, message: "expected a payment row after staff upload" }
      )
      .toBeGreaterThan(0);
  });

  test("owner can open the Expenses page (owner SELECT expenses)", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/admin/expenses");
    // Owner is allowed onto the page (not redirected by requireOwner) and it renders.
    await expect(page).toHaveURL(/\/admin\/expenses/);
    await expect(page.getByRole("heading", { name: /expenses/i })).toBeVisible({
      timeout: 15_000,
    });
  });
});
