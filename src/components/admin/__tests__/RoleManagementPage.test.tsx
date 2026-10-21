import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePendingUsers } from "@/hooks/usePendingUsers";
import { stubPaneWidth } from "@/test/pane-width";

import { RoleManagementPage } from "../RoleManagementPage";

vi.mock("@/hooks/usePendingUsers", () => ({ usePendingUsers: vi.fn() }));
vi.mock("../UserRolesTable", () => ({ UserRolesTable: () => null }));
vi.mock("../RoleStatistics", () => ({ RoleStatistics: () => null }));
vi.mock("../GrantRoleDialog", () => ({ GrantRoleDialog: () => null }));
vi.mock("../UpdateRoleDialog", () => ({
  UpdateRoleDialog: () => null,
  DeactivateRoleDialog: () => null,
}));

describe("RoleManagementPage pending approval", () => {
  beforeEach(() => {
    vi.mocked(usePendingUsers).mockReturnValue({
      data: [
        {
          id: "user-new",
          email: "new.helper@example.com",
          full_name: "Ana Cruz",
          created_at: "2026-10-18T09:00:00Z",
          email_confirmed_at: null,
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof usePendingUsers>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("lists each user awaiting a role as a card on a narrow pane", () => {
    stubPaneWidth(390);
    render(<RoleManagementPage />);

    const [card] = within(
      screen.getByRole("list", { name: "Users awaiting approval" })
    ).getAllByRole("listitem");
    expect(within(card).getByText("new.helper@example.com")).toBeVisible();
    expect(within(card).getByText("Ana Cruz")).toBeVisible();
    expect(within(card).getByText("Unverified")).toBeVisible();
    expect(within(card).getByRole("button", { name: "Grant Role" })).toBeVisible();
  });

  it("shows a table on a wide pane", () => {
    stubPaneWidth(1280);
    render(<RoleManagementPage />);

    const table = screen.getByRole("table", { name: "Users awaiting approval" });
    expect(within(table).getByRole("row", { name: /new\.helper@example\.com/ })).toBeVisible();
  });
});
