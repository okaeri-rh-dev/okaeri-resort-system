import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { usePendingUsers, type PendingUser } from "@/hooks/usePendingUsers";
import { AuditRole } from "@/lib/audit-roles";

import { GrantRoleDialog } from "../GrantRoleDialog";

const grantRole = vi.fn();

vi.mock("@/hooks/usePendingUsers", () => ({ usePendingUsers: vi.fn() }));
vi.mock("@/hooks/useRoleManagement", () => ({
  useGrantRole: () => ({ mutateAsync: grantRole, isPending: false }),
}));

const maria: PendingUser = {
  id: "6e7aed61-41df-4949-ba63-47343e977ab8",
  email: "maria@okaeri.ph",
  full_name: "Maria Santos",
  created_at: "2026-10-01T00:00:00Z",
  email_confirmed_at: "2026-10-01T00:00:00Z",
};

const jose: PendingUser = {
  id: "0b8f3c2e-9a41-4d6b-8f0e-2c7d5e1a9b34",
  email: "jose@okaeri.ph",
  full_name: null,
  created_at: "2026-10-02T00:00:00Z",
  email_confirmed_at: null,
};

function stubPendingUsers(users: PendingUser[] | undefined, isLoading = false) {
  vi.mocked(usePendingUsers).mockReturnValue({
    data: users,
    isLoading,
  } as unknown as ReturnType<typeof usePendingUsers>);
}

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
});

beforeEach(() => {
  grantRole.mockReset();
  stubPendingUsers([maria, jose]);
});

describe("GrantRoleDialog user picker", () => {
  it("is a combobox named by its label", () => {
    render(<GrantRoleDialog open onOpenChange={() => {}} />);

    const picker = screen.getByLabelText("Select User");
    expect(picker).toHaveRole("combobox");
    expect(picker).toHaveTextContent("Select a pending user");
  });

  it("grants the role to the chosen pending user", async () => {
    grantRole.mockResolvedValue(undefined);
    render(<GrantRoleDialog open onOpenChange={() => {}} />);

    await userEvent.click(screen.getByLabelText("Select User"));
    await userEvent.click(
      await screen.findByRole("option", { name: "maria@okaeri.ph (Maria Santos)" })
    );
    expect(screen.getByLabelText("Select User")).toHaveTextContent("maria@okaeri.ph");

    await userEvent.click(screen.getByRole("button", { name: "Grant Role" }));

    await waitFor(() => expect(grantRole).toHaveBeenCalled());
    expect(grantRole).toHaveBeenCalledWith({
      userId: maria.id,
      email: maria.email,
      role: AuditRole.STAFF,
      notes: undefined,
    });
  });

  it("lists a user with no name by email alone", async () => {
    render(<GrantRoleDialog open onOpenChange={() => {}} />);

    await userEvent.click(screen.getByLabelText("Select User"));
    expect(await screen.findByRole("option", { name: "jose@okaeri.ph" })).toBeVisible();
  });

  it("says so and disables the picker when there are no pending users", () => {
    stubPendingUsers([]);
    render(<GrantRoleDialog open onOpenChange={() => {}} />);

    const picker = screen.getByLabelText("Select User");
    expect(picker).toBeDisabled();
    expect(picker).toHaveTextContent("No pending users");
  });

  it("shows the prefilled user as chosen", () => {
    render(<GrantRoleDialog open onOpenChange={() => {}} prefilledUser={maria} />);

    expect(screen.getByLabelText("Select User")).toHaveTextContent("maria@okaeri.ph");
  });
});
