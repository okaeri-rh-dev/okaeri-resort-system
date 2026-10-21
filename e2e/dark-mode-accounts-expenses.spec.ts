import { expect, test, type Page } from "@playwright/test";

import { loginAsAdmin } from "./fixtures/auth";
import { findLowContrastText } from "./fixtures/contrast";

/**
 * Dark mode is readable on the accounts, transfers and expenses screens (#108): no text under
 * WCAG AA against what is painted behind it. Needs the seeded admin; balances, transfers and one
 * expense are stubbed so money in, money out and a negative balance render whatever the shared
 * database holds.
 */

const COMPACT = { width: 390, height: 844 };
const EXPANDED = { width: 1280, height: 900 };

const account = (
  id: string,
  name: string,
  code: string,
  type: "Bank" | "E-Wallet" | "Cash",
  totals: { initial: number; payments: number; expenses: number; in: number; out: number }
) => ({
  account_id: `00000000-0000-4000-8000-00000000a${id}`,
  account_name: name,
  account_code: code,
  account_type: type,
  is_active: true,
  display_order: Number(id),
  initial_balance: totals.initial,
  total_payments: totals.payments,
  total_expenses: totals.expenses,
  transfers_in: totals.in,
  transfers_out: totals.out,
  current_balance: totals.initial + totals.payments - totals.expenses + totals.in - totals.out,
});

const ACCOUNTS = [
  account("001", "BDO Savings", "BDO-SAV", "Bank", {
    initial: 50000,
    payments: 42500,
    expenses: 12800,
    in: 5000,
    out: 0,
  }),
  account("002", "GCash Business", "GCASH", "E-Wallet", {
    initial: 0,
    payments: 18750,
    expenses: 2300,
    in: 0,
    out: 15000,
  }),
  account("003", "Petty Cash", "CASH", "Cash", {
    initial: 2000,
    payments: 0,
    expenses: 14650,
    in: 10000,
    out: 0,
  }),
];

const accountRef = (index: number) => {
  const { account_id, account_name, account_code, account_type } = ACCOUNTS[index];
  return { account_id, account_name, account_code, account_type };
};

const TRANSFERS = [
  {
    transfer_id: "00000000-0000-4000-8000-00000000b001",
    transfer_reference: "TRF-2026-0001",
    from_account_id: ACCOUNTS[1].account_id,
    to_account_id: ACCOUNTS[0].account_id,
    amount: 5000,
    transfer_date: "2026-10-12T00:00:00Z",
    notes: "Weekly GCash sweep to the bank",
    created_at: "2026-10-12T08:00:00Z",
    from_account: accountRef(1),
    to_account: accountRef(0),
  },
  {
    transfer_id: "00000000-0000-4000-8000-00000000b002",
    transfer_reference: "TRF-2026-0002",
    from_account_id: ACCOUNTS[1].account_id,
    to_account_id: ACCOUNTS[2].account_id,
    amount: 10000,
    transfer_date: "2026-10-15T00:00:00Z",
    notes: null,
    created_at: "2026-10-15T08:00:00Z",
    from_account: accountRef(1),
    to_account: accountRef(2),
  },
];

const EXPENSE_ID = "00000000-0000-4000-8000-00000000c001";

const EXPENSE = {
  expense_id: EXPENSE_ID,
  category: "Utilities",
  description: "Monthly electricity bill",
  amount: 4820.5,
  expense_date: "2026-10-05",
  account_id: ACCOUNTS[0].account_id,
  receipt_url: "https://receipts.e2e.local/electricity.png",
  notes: "Higher than usual: the cabins were full all week.",
  unit_id: null,
  created_at: "2026-10-05T08:00:00Z",
  updated_at: "2026-10-05T08:00:00Z",
};

const RECEIPT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);

async function stubAccounts(page: Page) {
  await page.route("**/rest/v1/rpc/get_all_account_balances*", (route) =>
    route.fulfill({ json: ACCOUNTS })
  );
}

async function stubTransfers(page: Page) {
  await page.route("**/rest/v1/account_transfers?*", (route) =>
    route.request().method() === "GET" ? route.fulfill({ json: TRANSFERS }) : route.continue()
  );
}

async function stubExpense(page: Page) {
  await page.route(`**/rest/v1/expenses?*expense_id=eq.${EXPENSE_ID}*`, (route) =>
    route.request().method() === "GET" ? route.fulfill({ json: EXPENSE }) : route.continue()
  );
  await page.route("https://receipts.e2e.local/**", (route) =>
    route.fulfill({ contentType: "image/png", body: RECEIPT_PNG })
  );
}

async function expectReadable(page: Page, root = "main") {
  expect(await findLowContrastText(page, root)).toEqual([]);
}

test.describe("Dark mode accounts, transfers and expenses", () => {
  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD) test.skip();
    await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  });

  for (const viewport of [EXPANDED, COMPACT]) {
    test(`accounts and their money in and out read in dark at ${viewport.width}`, async ({
      page,
    }) => {
      await stubAccounts(page);
      await page.setViewportSize(viewport);
      await loginAsAdmin(page);
      await page.goto("/admin/accounts");
      await expect(page.getByText("Petty Cash").last()).toBeVisible();
      await expect(page.getByText("-₱15,000.00").first()).toBeVisible();
      await expect(page.getByText("Total (3 accounts)")).toBeVisible();
      await expectReadable(page);

      await page.getByRole("button", { name: "Actions for Petty Cash" }).click();
      await expect(page.getByRole("menuitem", { name: "Deactivate" })).toBeVisible();
    });

    test(`transfers read in dark at ${viewport.width}`, async ({ page }) => {
      await stubTransfers(page);
      await page.setViewportSize(viewport);
      await loginAsAdmin(page);
      await page.goto("/admin/transfers");
      await expect(page.getByText("TRF-2026-0002").first()).toBeVisible();
      await expectReadable(page);
    });
  }

  test("account form reads in dark", async ({ page }) => {
    await page.setViewportSize(EXPANDED);
    await loginAsAdmin(page);
    await page.goto("/admin/accounts");
    await page.getByRole("button", { name: "Add Account" }).click();
    const dialog = page.getByRole("dialog", { name: "Add New Account" });
    await expect(dialog.getByLabel("Account Type *")).toBeVisible();
    await expectReadable(page, '[role="dialog"]');
  });

  test("transfer form reads in dark", async ({ page }) => {
    await page.setViewportSize(COMPACT);
    await loginAsAdmin(page);
    await page.goto("/admin/transfers");
    await page.getByRole("button", { name: /New Transfer/ }).click();
    const dialog = page.getByRole("dialog", { name: "New Transfer" });
    await expect(dialog.getByLabel("From Account *")).toBeVisible();
    await expectReadable(page, '[role="dialog"]');
  });

  test("expense list and form read in dark", async ({ page }) => {
    await page.setViewportSize(EXPANDED);
    await loginAsAdmin(page);
    await page.goto("/admin/expenses");
    await expect(page.getByRole("button", { name: "Filter by date range" })).toBeVisible();
    await expectReadable(page);

    await page.getByRole("button", { name: "Add Expense" }).click();
    const dialog = page.getByRole("dialog", { name: "Add New Expense" });
    await expect(dialog.getByLabel("Category *")).toBeVisible();
    await expect(dialog.getByLabel("Paid From *")).toBeVisible();
    await expectReadable(page, '[role="dialog"]');
  });

  for (const viewport of [EXPANDED, COMPACT]) {
    test(`expense detail reads in dark at ${viewport.width}`, async ({ page }) => {
      await stubExpense(page);
      await page.setViewportSize(viewport);
      await loginAsAdmin(page);
      await page.goto(`/admin/expenses/${EXPENSE_ID}`);
      await expect(page.getByText("Higher than usual")).toBeVisible();
      await expect(page.getByRole("img", { name: "Expense receipt" })).toBeVisible();
      await expectReadable(page);
    });
  }

  test("expense edit reads in dark", async ({ page }) => {
    await stubExpense(page);
    await page.setViewportSize(EXPANDED);
    await loginAsAdmin(page);
    await page.goto(`/admin/expenses/${EXPENSE_ID}/edit`);
    await expect(page.getByLabel("Category")).toBeVisible();
    await expect(page.getByRole("button", { name: "Expense date" })).toBeVisible();
    await expectReadable(page);
  });
});
