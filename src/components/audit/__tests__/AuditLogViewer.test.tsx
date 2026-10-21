import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuditLogs } from "@/lib/audit-hooks";
import { stubPaneWidth } from "@/test/pane-width";
import type { AuditLog } from "@/types/audit.types";

import { AuditLogViewer } from "../AuditLogViewer";

vi.mock("@/lib/audit-hooks", () => ({ useAuditLogs: vi.fn() }));
vi.mock("../AuditDiffViewer", () => ({ AuditDiffViewer: () => null }));

const bookingUpdate = {
  audit_id: "audit-1",
  table_name: "bookings",
  record_id: "booking-1",
  action: "UPDATE",
  source: "db",
  old_data: { status: "Pending" },
  new_data: { status: "Confirmed" },
  changed_fields: ["status"],
  description: "Booking confirmed",
  metadata: null,
  user_id: "user-1",
  user_email: "owner@okaeri.test",
  created_at: "2026-10-20T08:00:00Z",
} as unknown as AuditLog;

describe("AuditLogViewer", () => {
  beforeEach(() => {
    vi.mocked(useAuditLogs).mockReturnValue({
      data: {
        data: [bookingUpdate],
        totalCount: 1,
        currentPage: 1,
        pageSize: 50,
        totalPages: 1,
        hasMore: false,
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useAuditLogs>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("lists each log as a card on a narrow pane that opens its details", async () => {
    stubPaneWidth(390);
    render(<AuditLogViewer />);

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const [card] = within(screen.getByRole("list", { name: "Audit logs" })).getAllByRole(
      "listitem"
    );
    expect(within(card).getByText("Updated")).toBeVisible();
    expect(within(card).getByText("owner@okaeri.test")).toBeVisible();
    expect(within(card).getByRole("button", { name: "View" })).toBeVisible();

    await userEvent.click(within(card).getByRole("button", { name: "Show details" }));
    expect(within(card).getByText("Booking confirmed")).toBeVisible();
  });

  it("shows a table on a wide pane whose rows expand to their details", async () => {
    stubPaneWidth(1280);
    render(<AuditLogViewer />);

    const table = screen.getByRole("table", { name: "Audit logs" });
    const row = within(table).getByRole("row", { name: /Updated/ });
    await userEvent.click(within(row).getByRole("button", { name: "Show details" }));
    expect(within(table).getByText("Booking confirmed")).toBeVisible();
  });
});
