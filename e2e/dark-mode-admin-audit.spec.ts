import { expect, test, type Page } from "@playwright/test";

import { loginAsAdmin } from "./fixtures/auth";
import { findLowContrastText } from "./fixtures/contrast";

/**
 * Dark mode is readable on the role management, booking queue, payment verification and audit
 * trail screens (#106): no text under WCAG AA against what is painted behind it. Needs the
 * seeded admin; queue, booking, proof and role-history data are stubbed so every urgency,
 * payment state and change type renders regardless of what the shared database holds.
 */

const COMPACT = { width: 390, height: 844 };
const EXPANDED = { width: 1280, height: 900 };

const roleHistoryEntry = (
  action: "INSERT" | "UPDATE" | "DELETE",
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
  createdAt: string
) => ({
  audit_id: `e2e-role-${action}-${createdAt}`,
  table_name: "app_roles",
  record_id: "00000000-0000-4000-8000-000000000004",
  action,
  source: "db",
  old_data: oldData,
  new_data: newData,
  changed_fields: null,
  description: null,
  metadata: null,
  user_id: "00000000-0000-4000-8000-000000000002",
  user_email: "admin@okaeri.test",
  created_at: createdAt,
});

/** Every change type the history timeline draws: grant, change, deactivate, remove. */
const ROLE_HISTORY = [
  roleHistoryEntry("DELETE", { role: "manager", is_active: false }, null, "2026-10-04T09:00:00Z"),
  roleHistoryEntry(
    "UPDATE",
    { role: "manager", is_active: true },
    { role: "manager", is_active: false, notes: "Season ended" },
    "2026-10-03T09:00:00Z"
  ),
  roleHistoryEntry(
    "UPDATE",
    { role: "staff", is_active: true },
    { role: "manager", is_active: true },
    "2026-10-02T09:00:00Z"
  ),
  roleHistoryEntry("INSERT", null, { role: "staff", is_active: true }, "2026-10-01T09:00:00Z"),
];

const queuedBooking = (
  reference: string,
  urgency: "critical" | "high" | "medium" | "low",
  paymentStatus: "Pending" | "Partial" | "Completed" | "Refunded"
) => ({
  booking_id: `00000000-0000-4000-8000-0000000e2e${reference.slice(-2)}`,
  booking_reference: reference,
  guest_name: "Maria Santos",
  guest_contact: "maria@example.com",
  check_in_date: "2026-11-14",
  check_out_date: "2026-11-16",
  requested_unit_count: 2,
  total_amount: 12500,
  payment_status: paymentStatus,
  urgency_score: { critical: 92, high: 71, medium: 48, low: 12 }[urgency],
  urgency_level: urgency,
  created_at: "2026-10-20T08:00:00Z",
});

const QUEUE = [
  queuedBooking("E2E-STUB-01", "critical", "Pending"),
  queuedBooking("E2E-STUB-02", "high", "Partial"),
  queuedBooking("E2E-STUB-03", "medium", "Completed"),
  queuedBooking("E2E-STUB-04", "low", "Refunded"),
];

const PROOF_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);

async function stubQueue(page: Page) {
  await page.route("**/api/admin/pending-bookings", (route) =>
    route.fulfill({ json: { bookings: QUEUE } })
  );
}

/** Stubs one booking awaiting review, with an uploaded proof the viewer can sign and load. */
async function stubBookingWithProof(page: Page, paymentStatus: "Pending" | "Completed") {
  const booking = QUEUE[0];
  await page.route(`**/api/admin/bookings/${booking.booking_id}`, (route) =>
    route.fulfill({
      json: {
        ...booking,
        check_in: booking.check_in_date,
        check_out: booking.check_out_date,
        payment_status: paymentStatus,
        payment_proof_url: "E2E-STUB-01_proof.png",
      },
    })
  );
  await page.route("**/storage/v1/object/sign/payment-proofs/**", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          json: { signedURL: "/object/sign/payment-proofs/E2E-STUB-01_proof.png?token=e2e" },
        })
      : route.fulfill({ contentType: "image/png", body: PROOF_PNG })
  );
  return booking.booking_id;
}

async function expectReadable(page: Page, root = "main") {
  expect(await findLowContrastText(page, root)).toEqual([]);
}

test.describe("Dark mode admin and audit screens", () => {
  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD) test.skip();
    await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  });

  for (const viewport of [EXPANDED, COMPACT]) {
    test(`booking queue reads in dark at ${viewport.width}`, async ({ page }) => {
      await stubQueue(page);
      await page.setViewportSize(viewport);
      await loginAsAdmin(page);
      await page.goto("/admin/bookings/queue");
      await expect(page.getByText("E2E-STUB-04").first()).toBeVisible();
      await expectReadable(page);
    });

    test(`user roles read in dark at ${viewport.width}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await loginAsAdmin(page);
      await page.goto("/admin/roles");
      await expect(page.getByText("Full system access")).toBeVisible();
      await expect(
        page.getByText("No users awaiting approval.").or(page.getByText("Verified").first())
      ).toBeVisible();
      await expectReadable(page);
    });
  }

  test("payment verification reads in dark", async ({ page }) => {
    await stubQueue(page);
    await stubBookingWithProof(page, "Pending");
    await page.setViewportSize(EXPANDED);
    await loginAsAdmin(page);
    await page.goto("/admin/bookings/queue");
    const queueRow = page.getByRole("row").filter({ hasText: "E2E-STUB-01" });
    await queueRow.getByRole("button", { name: "Review Payment" }).click();
    await expect(page).toHaveURL(/\/admin\/verify-payment\//);
    await expect(page.getByText("Payment pending verification")).toBeVisible();
    await expect(page.getByRole("img", { name: "Payment proof" })).toBeVisible();
    await expectReadable(page);
  });

  test("verified payment reads in dark", async ({ page }) => {
    const bookingId = await stubBookingWithProof(page, "Completed");
    await page.setViewportSize(EXPANDED);
    await loginAsAdmin(page);
    await page.goto(`/admin/verify-payment/${bookingId}`);
    await expect(page.getByText("Payment verified")).toBeVisible();
    await expectReadable(page);
  });

  test("role change history reads in dark", async ({ page }) => {
    await page.route("**/rest/v1/audit_logs?*table_name=eq.app_roles*", (route) =>
      route.fulfill({ json: ROLE_HISTORY })
    );
    await page.setViewportSize(EXPANDED);
    await loginAsAdmin(page);
    await page.goto("/admin/roles");
    const staffRow = page.getByRole("row").filter({ hasText: "staff@okaeri.test" });
    await staffRow.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("menuitem", { name: "View Change History" }).click();
    const history = page.getByRole("dialog", { name: "Role Change History" });
    await expect(history.getByText("Role changed:")).toBeVisible();
    await expect(history.getByText("Role removed:")).toBeVisible();
    await expectReadable(page, '[role="dialog"]');
  });

  test("audit trail and its before/after diff read in dark", async ({ page }) => {
    await page.setViewportSize(EXPANDED);
    await loginAsAdmin(page);
    await page.goto("/admin/audit-logs");
    await expect(page.getByText("Total Logs")).toBeVisible();
    const updatedRow = page.getByRole("row").filter({ hasText: "Updated" }).first();
    await expect(updatedRow).toBeVisible();
    await updatedRow.getByRole("button", { name: "Show details" }).click();
    await expect(page.getByText("Description", { exact: true }).first()).toBeVisible();
    await expectReadable(page);

    await updatedRow.getByRole("button", { name: "View" }).click();
    const diff = page.getByRole("dialog", { name: "Audit Log Details" });
    await expect(diff.getByText("Before")).toBeVisible();
    await expect(diff.getByText("Changed").first()).toBeVisible();
    await expectReadable(page, '[role="dialog"]');
  });
});
