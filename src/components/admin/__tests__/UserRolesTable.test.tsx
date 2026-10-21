import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAllRoles } from "@/hooks/useRoleManagement";
import type { AppRole } from "@/lib/audit-roles";
import { stubPaneWidth } from "@/test/pane-width";

import { UserRolesTable } from "../UserRolesTable";

vi.mock("@/hooks/useRoleManagement", () => ({ useAllRoles: vi.fn() }));
vi.mock("@/components/admin/RoleChangeHistory", () => ({ RoleChangeHistory: () => null }));

const staffRole = {
  user_id: "user-staff",
  email: "staff@okaeri.test",
  role: "staff",
  is_active: true,
  notes: "Weekend help",
  granted_at: "2026-10-01T09:00:00Z",
} as AppRole;

describe("UserRolesTable", () => {
  beforeEach(() => {
    vi.mocked(useAllRoles).mockReturnValue({
      data: [staffRole],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useAllRoles>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("lists each user as a card on a narrow pane, with the role actions", async () => {
    stubPaneWidth(390);
    const onDeactivateRole = vi.fn();
    render(<UserRolesTable onUpdateRole={vi.fn()} onDeactivateRole={onDeactivateRole} />);

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const [card] = within(screen.getByRole("list", { name: "User roles" })).getAllByRole(
      "listitem"
    );
    expect(within(card).getByText("staff@okaeri.test")).toBeVisible();
    expect(within(card).getByText("Weekend help")).toBeVisible();
    expect(within(card).getByText("Active")).toBeVisible();

    await userEvent.click(within(card).getByRole("button", { name: /Open menu/ }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Deactivate" }));
    expect(onDeactivateRole).toHaveBeenCalledWith(staffRole);
  });

  it("shows a table on a wide pane", () => {
    stubPaneWidth(1280);
    render(<UserRolesTable onUpdateRole={vi.fn()} onDeactivateRole={vi.fn()} />);

    const table = screen.getByRole("table", { name: "User roles" });
    const row = within(table).getByRole("row", { name: /staff@okaeri\.test/ });
    expect(within(row).getByRole("button", { name: /Open menu/ })).toBeVisible();
  });

  it("keeps a row menu open when the table re-renders", async () => {
    stubPaneWidth(1280);
    const onUpdateRole = vi.fn();
    const onDeactivateRole = vi.fn();
    const { rerender } = render(
      <UserRolesTable onUpdateRole={onUpdateRole} onDeactivateRole={onDeactivateRole} />
    );

    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    rerender(<UserRolesTable onUpdateRole={onUpdateRole} onDeactivateRole={onDeactivateRole} />);

    await userEvent.click(screen.getByRole("menuitem", { name: "Update Role" }));
    expect(onUpdateRole).toHaveBeenCalledWith(staffRole);
  });
});
