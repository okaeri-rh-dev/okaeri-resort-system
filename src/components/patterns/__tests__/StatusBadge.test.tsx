import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { StatusBadge, type StatusTone } from "@/components/patterns";

describe("StatusBadge", () => {
  it.each<StatusTone>(["success", "warning", "danger", "info", "neutral"])(
    "shows its label as text for the %s tone",
    (tone) => {
      render(<StatusBadge tone={tone}>Confirmed</StatusBadge>);

      expect(screen.getByText("Confirmed")).toBeVisible();
    }
  );

  it("renders the danger pill apart from a destructive action", () => {
    render(
      <>
        <StatusBadge tone="danger">Cancelled</StatusBadge>
        <StatusBadge tone="success">Paid</StatusBadge>
      </>
    );

    expect(screen.getByText("Cancelled")).toHaveAttribute("data-tone", "danger");
    expect(screen.getByText("Paid")).toHaveAttribute("data-tone", "success");
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <div>
        <StatusBadge tone="warning">Pending</StatusBadge>
        <StatusBadge tone="neutral">Checked out</StatusBadge>
      </div>
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
