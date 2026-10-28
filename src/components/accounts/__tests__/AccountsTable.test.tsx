import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAccountBalances } from "@/stores/useAccountStore";
import { stubPaneWidth } from "@/test/pane-width";
import type { AccountWithBalance } from "@/types";

import { AccountsTable } from "../AccountsTable";

vi.mock("@/stores/useAccountStore", () => ({
  useAccountBalances: vi.fn(),
  useDeleteAccount: () => ({ mutateAsync: vi.fn() }),
  useReactivateAccount: () => ({ mutateAsync: vi.fn() }),
}));

function account(overrides: Partial<AccountWithBalance>): AccountWithBalance {
  return {
    account_id: "account",
    account_name: "Account",
    account_code: "ACC",
    account_type: "Bank",
    description: null,
    initial_balance: 0,
    is_active: true,
    display_order: 0,
    created_at: "2026-10-28T00:00:00Z",
    updated_at: "2026-10-28T00:00:00Z",
    total_payments: 0,
    total_expenses: 0,
    transfers_in: 0,
    transfers_out: 0,
    current_balance: 0,
    ...overrides,
  };
}

const balances = [
  account({ account_id: "gcash", account_name: "GCash Wallet", display_order: 2 }),
  account({ account_id: "old", account_name: "Closed Savings", is_active: false, display_order: 0 }),
  account({ account_id: "bdo", account_name: "BDO Payroll", display_order: 1 }),
];

const renderedNames = () =>
  screen
    .getAllByText(/GCash Wallet|Closed Savings|BDO Payroll/)
    .map((element) => element.textContent);

describe("AccountsTable", () => {
  beforeEach(() => {
    stubPaneWidth(390);
    vi.mocked(useAccountBalances).mockReturnValue({
      data: balances,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useAccountBalances>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("lists active accounts by display order and hides inactive ones", () => {
    render(<AccountsTable />);

    expect(renderedNames()).toEqual(["BDO Payroll", "GCash Wallet"]);
  });

  it("shows inactive accounts too when asked", () => {
    render(<AccountsTable showInactive />);

    expect(renderedNames()).toEqual(["Closed Savings", "BDO Payroll", "GCash Wallet"]);
  });
});
