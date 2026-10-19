import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { TableEmptyState } from "@/components/patterns";

describe("TableEmptyState", () => {
  it("explains the empty table and offers its actions", async () => {
    const onClear = vi.fn();
    const onAdd = vi.fn();
    render(
      <TableEmptyState
        variant="no-results"
        title="No bookings match"
        description="Try a different search or clear the filters."
        action={{ label: "Clear filters", onClick: onClear }}
        secondaryAction={{ label: "New booking", onClick: onAdd }}
      />
    );

    expect(screen.getByText("No bookings match")).toBeVisible();
    expect(screen.getByText("Try a different search or clear the filters.")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await userEvent.click(screen.getByRole("button", { name: "New booking" }));

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("renders without actions", () => {
    render(<TableEmptyState title="No payments yet" description="Payments show up here." />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it.each(["no-data", "no-results", "error"] as const)(
    "has no axe violations for the %s variant",
    async (variant) => {
      const { container } = render(
        <TableEmptyState variant={variant} title="Nothing here" description="Check back later." />
      );

      expect(await axe(container)).toHaveNoViolations();
    }
  );
});
