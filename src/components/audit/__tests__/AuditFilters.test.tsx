import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DateRange } from "@/components/patterns";
import { useAuditStore } from "@/stores/useAuditStore";

import { AuditFilters } from "../AuditFilters";

vi.mock("@/lib/audit-hooks", () => ({ useExportAuditLogs: () => ({ mutateAsync: vi.fn() }) }));

const pickedRange: { current: DateRange | undefined } = { current: undefined };

vi.mock("@/components/patterns", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/patterns")>()),
  DateRangePicker: ({ onChange }: { onChange: (range: DateRange | undefined) => void }) => (
    <button onClick={() => onChange(pickedRange.current)}>Pick range</button>
  ),
}));

const pickRange = async (range: DateRange) => {
  pickedRange.current = range;
  render(<AuditFilters />);
  await userEvent.click(screen.getByRole("button", { name: "Pick range" }));
  return useAuditStore.getState().filters;
};

describe("AuditFilters date range", () => {
  beforeEach(() => {
    useAuditStore.getState().resetFilters();
  });

  it("covers the whole day for a one-day range", async () => {
    const filters = await pickRange({ from: new Date(2026, 10, 5), to: new Date(2026, 10, 5) });

    expect(filters.startDate).toBe(new Date(2026, 10, 5, 0, 0, 0, 0).toISOString());
    expect(filters.endDate).toBe(new Date(2026, 10, 5, 23, 59, 59, 999).toISOString());
  });

  it("covers the whole last day of a multi-day range", async () => {
    const filters = await pickRange({ from: new Date(2026, 10, 1), to: new Date(2026, 10, 7) });

    expect(filters.startDate).toBe(new Date(2026, 10, 1, 0, 0, 0, 0).toISOString());
    expect(filters.endDate).toBe(new Date(2026, 10, 7, 23, 59, 59, 999).toISOString());
  });

  it("sends no end date when the range has no end day", async () => {
    const filters = await pickRange({ from: new Date(2026, 10, 1), to: undefined });

    expect(filters.endDate).toBeUndefined();
  });

  it("shows the picked end day in the To chip", async () => {
    await pickRange({ from: new Date(2026, 10, 1), to: new Date(2026, 10, 7) });

    expect(screen.getByText(/To: Nov 7, 2026/)).toBeInTheDocument();
  });
});
