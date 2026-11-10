import { expect, test } from "@playwright/test";

import { E2E_REF } from "../scripts/e2e/fixtures";
import { loginAsAdmin } from "./fixtures/auth";
import { COMPACT, EXPANDED, expectReadable, useDarkTheme } from "./fixtures/contrast";

/**
 * Dark mode is readable on the role management, verify payment and audit trail screens (#106):
 * no text under WCAG AA against what is painted behind it. Needs the seeded admin and E2E
 * bookings; role-history data is stubbed so every change type renders regardless of what the
 * shared database holds.
 */

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

test.describe("Dark mode admin and audit screens", () => {
  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD) test.skip();
    await useDarkTheme(page);
  });

  for (const viewport of [EXPANDED, COMPACT]) {
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

  test("the verify payment dialog and its proof read in dark", async ({ page }) => {
    await page.setViewportSize(EXPANDED);
    await loginAsAdmin(page);
    await page.goto(`/admin/bookings?view=needs-action&q=${E2E_REF.QUEUE}`);
    await page.getByRole("button", { name: "Verify payment" }).click();
    const dialog = page.getByRole("dialog", { name: "Verify payment" });
    await expect(dialog.getByRole("img", { name: "Payment proof" })).toBeVisible();
    await expectReadable(page, '[role="dialog"]');
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
