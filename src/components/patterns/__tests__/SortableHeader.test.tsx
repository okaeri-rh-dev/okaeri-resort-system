import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { GuestTable } from "./test-table";

function firstGuest() {
  return screen.getAllByRole("row")[1].querySelector("td")?.textContent;
}

describe("SortableHeader", () => {
  it("sorts the column when its header is pressed, and reverses on a second press", async () => {
    render(<GuestTable />);
    expect(firstGuest()).toBe("Guest 01");

    await userEvent.click(screen.getByRole("button", { name: /Guest/ }));
    const afterFirst = firstGuest();
    await userEvent.click(screen.getByRole("button", { name: /Guest/ }));

    expect([afterFirst, firstGuest()].sort()).toEqual(["Guest 01", "Guest 23"]);
  });

  it("renders a column that can't sort as plain text", () => {
    render(<GuestTable />);

    expect(screen.getByText("Nights")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Nights/ })).not.toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(<GuestTable />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
