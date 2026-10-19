import { useState } from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { Checkbox, FilterPopover, Label } from "@/components/patterns";

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

function StatusFilter({ onApply = () => {}, onClear = () => {} }) {
  const [open, setOpen] = useState(false);
  return (
    <FilterPopover
      open={open}
      onOpenChange={setOpen}
      isActive
      badgeLabel="2"
      showActions
      onApply={onApply}
      onClear={onClear}
      content={
        <div className="flex items-center gap-2">
          <Checkbox id="pending" />
          <Label htmlFor="pending">Pending</Label>
        </div>
      }
    >
      Status
    </FilterPopover>
  );
}

describe("FilterPopover", () => {
  it("shows the filter name and the active value on its trigger", () => {
    render(<StatusFilter />);

    expect(screen.getByRole("button", { name: /Status/ })).toHaveTextContent("Status2");
  });

  it("opens its content and applies, closing the popover", async () => {
    const onApply = vi.fn();
    render(<StatusFilter onApply={onApply} />);

    await userEvent.click(screen.getByRole("button", { name: /Status/ }));
    expect(screen.getByRole("checkbox", { name: "Pending" })).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("checkbox", { name: "Pending" })).not.toBeInTheDocument();
  });

  it("clears without closing", async () => {
    const onClear = vi.fn();
    render(<StatusFilter onClear={onClear} />);

    await userEvent.click(screen.getByRole("button", { name: /Status/ }));
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("checkbox", { name: "Pending" })).toBeVisible();
  });

  it("has no axe violations, closed and open", async () => {
    const { container } = render(<StatusFilter />);
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.click(screen.getByRole("button", { name: /Status/ }));
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
