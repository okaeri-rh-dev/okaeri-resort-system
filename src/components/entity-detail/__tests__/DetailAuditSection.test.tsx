// src/components/entity-detail/__tests__/DetailAuditSection.test.tsx

import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/supabase";
import type { AuditLog } from "@/types/audit.types";

import { DetailAuditSection } from "../DetailAuditSection";

vi.mock("@/lib/supabase", () => ({
  db: { auditLogs: { recentByRecord: vi.fn() } },
}));

const recentByRecord = vi.mocked(db.auditLogs.recentByRecord);

const auditRow = (overrides: Partial<AuditLog>): AuditLog => ({
  action: "UPDATE",
  audit_id: crypto.randomUUID(),
  category: null,
  changed_fields: null,
  correlation_id: null,
  created_at: "2026-10-09T02:30:00Z",
  description: null,
  event_type: null,
  ip_address: null,
  metadata: null,
  new_data: null,
  old_data: null,
  record_id: "guest-1",
  record_pk: null,
  severity: "INFO",
  source: "db",
  table_name: "guests",
  user_agent: null,
  user_email: "owner@example.com",
  user_id: null,
  user_role: null,
  ...overrides,
});

describe("DetailAuditSection", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    recentByRecord.mockReset();
  });

  const renderSection = (ui: ReactNode) =>
    render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);

  it("reads the record's own history from its plural table", async () => {
    recentByRecord.mockResolvedValue([]);
    renderSection(<DetailAuditSection entityType="guest" entityId="guest-1" />);

    await screen.findByText("No history for this record yet");
    expect(recentByRecord).toHaveBeenCalledWith("guests", "guest-1");
  });

  it("lists the returned rows with their action and description", async () => {
    recentByRecord.mockResolvedValue([
      auditRow({
        source: "app",
        action: "INSERT",
        metadata: { action: "updated" },
        description: "guest updated",
      }),
      auditRow({ action: "INSERT", description: "Guest record created" }),
    ]);
    renderSection(<DetailAuditSection entityType="guest" entityId="guest-1" />);

    expect(await screen.findByText("guest updated")).toBeInTheDocument();
    expect(screen.getByText("Guest record created")).toBeInTheDocument();
    expect(screen.getByText("Updated")).toBeInTheDocument();
    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getAllByText("owner@example.com")).toHaveLength(2);
  });

  it("shows at most `limit` rows", async () => {
    recentByRecord.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => auditRow({ description: `change ${i}` }))
    );
    renderSection(<DetailAuditSection entityType="guest" entityId="guest-1" limit={2} />);

    expect(await screen.findByText("change 0")).toBeInTheDocument();
    expect(screen.getByText("change 1")).toBeInTheDocument();
    expect(screen.queryByText("change 2")).not.toBeInTheDocument();
  });

  it("uses a custom title", () => {
    recentByRecord.mockResolvedValue([]);
    renderSection(
      <DetailAuditSection entityType="booking" entityId="booking-1" title="Booking History" />
    );

    expect(screen.getByText("Booking History")).toBeInTheDocument();
  });

  it("hides the history when collapsed", () => {
    recentByRecord.mockResolvedValue([auditRow({ description: "hidden change" })]);
    renderSection(
      <DetailAuditSection entityType="unit" entityId="unit-1" defaultCollapsed={true} />
    );

    expect(screen.getByText("Audit Trail")).toBeInTheDocument();
    expect(screen.queryByText("hidden change")).not.toBeInTheDocument();
  });
});
