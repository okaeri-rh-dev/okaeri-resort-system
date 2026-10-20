import { useState } from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { Button, FilterBar, TableSearch } from "@/components/patterns";

function GuestsToolbar({
  activeFilterCount = 0,
  onClearFilters,
}: {
  activeFilterCount?: number;
  onClearFilters?: () => void;
}) {
  const [query, setQuery] = useState("");
  return (
    <FilterBar
      search={<TableSearch value={query} onChange={setQuery} placeholder="Search guests" />}
      filters={<Button variant="outline">Status</Button>}
      activeFilterCount={activeFilterCount}
      onClearFilters={onClearFilters}
      summary={<span>12 guests</span>}
      actions={<Button variant="outline">Export CSV</Button>}
    />
  );
}

describe("FilterBar", () => {
  it("lays out the search, filters, summary and actions", () => {
    render(<GuestsToolbar />);

    expect(screen.getByRole("textbox", { name: "Search guests" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Status" })).toBeVisible();
    expect(screen.getByText("12 guests")).toBeVisible();
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeVisible();
  });

  it("toggles the filter group from the Filters button", async () => {
    render(<GuestsToolbar />);

    const toggle = screen.getByRole("button", { name: "Filters" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    const group = document.getElementById(toggle.getAttribute("aria-controls") ?? "");
    expect(group).toContainElement(screen.getByRole("button", { name: "Status" }));

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("counts the active filters on the toggle", () => {
    render(<GuestsToolbar activeFilterCount={2} onClearFilters={() => {}} />);

    expect(screen.getByRole("button", { name: "Filters, 2 active" })).toBeVisible();
  });

  it("offers Clear filters only when there is something to clear", async () => {
    const clear = vi.fn();
    const { rerender } = render(<GuestsToolbar />);
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();

    rerender(<GuestsToolbar activeFilterCount={1} onClearFilters={clear} />);
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it("has no axe violations", async () => {
    const { container } = render(<GuestsToolbar activeFilterCount={1} onClearFilters={() => {}} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
