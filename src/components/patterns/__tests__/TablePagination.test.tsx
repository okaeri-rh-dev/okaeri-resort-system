import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { GuestTable } from "./test-table";

describe("TablePagination", () => {
  it("says which rows are showing and pages forward and back", async () => {
    render(<GuestTable />);
    expect(screen.getByText("Showing 1 to 10 of 23 results")).toBeVisible();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Showing 11 to 20 of 23 results")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(screen.getByText("Showing 1 to 10 of 23 results")).toBeVisible();
  });

  it("jumps to a page and marks it as the current one", async () => {
    render(<GuestTable />);

    await userEvent.click(screen.getByRole("button", { name: "Page 3" }));

    expect(screen.getByText("Showing 21 to 23 of 23 results")).toBeVisible();
    expect(screen.getByRole("button", { name: "Page 3" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("has no axe violations", async () => {
    const { container } = render(<GuestTable />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
