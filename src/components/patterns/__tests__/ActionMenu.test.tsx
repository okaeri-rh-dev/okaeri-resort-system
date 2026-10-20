import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { ActionMenu } from "@/components/patterns";

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("ActionMenu", () => {
  it("opens a named menu of row actions and runs the chosen one", async () => {
    const onView = vi.fn();
    render(
      <ActionMenu
        label="Actions for OKR-1042"
        actions={[
          { label: "View", onClick: onView },
          { label: "Cancel booking", onClick: () => {}, variant: "destructive" },
        ]}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Actions for OKR-1042" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "View" }));

    expect(onView).toHaveBeenCalledTimes(1);
  });

  it("disables an action the caller marks disabled", async () => {
    render(<ActionMenu actions={[{ label: "Refund", onClick: () => {}, disabled: true }]} />);

    await userEvent.click(screen.getByRole("button", { name: "Actions" }));

    expect(screen.getByRole("menuitem", { name: "Refund" })).toHaveAttribute("data-disabled");
  });

  it("has no axe violations, closed and open", async () => {
    const { container } = render(<ActionMenu actions={[{ label: "View", onClick: () => {} }]} />);
    expect(await axe(container)).toHaveNoViolations();

    // The open menu is modal: Radix aria-hides the rest of the page, so check the menu itself
    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    expect(await axe(screen.getByRole("menu"))).toHaveNoViolations();
  });
});
