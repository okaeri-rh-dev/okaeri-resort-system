import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { TableSkeleton } from "@/components/patterns";

describe("TableSkeleton", () => {
  it("announces that the table is loading", () => {
    render(<TableSkeleton label="Loading bookings" />);

    expect(screen.getByRole("status", { name: "Loading bookings" })).toBeInTheDocument();
  });

  it("defaults its announcement to a plain loading message", () => {
    render(<TableSkeleton />);

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it.each([
    ["table", { layout: "table" as const }],
    ["cards", { layout: "cards" as const }],
    ["table with toolbar and pagination", { toolbar: true, pagination: true }],
  ])("has no axe violations as a %s", async (_name, props) => {
    const { container } = render(<TableSkeleton rows={3} columns={4} {...props} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
