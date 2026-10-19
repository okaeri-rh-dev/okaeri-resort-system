import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { ResponsiveTable } from "@/components/patterns";

function GuestTable() {
  return (
    <ResponsiveTable>
      <table>
        <thead>
          <tr>
            <th>Guest</th>
            <th>Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Maria Santos</td>
            <td>₱2,500.00</td>
          </tr>
        </tbody>
      </table>
    </ResponsiveTable>
  );
}

describe("ResponsiveTable", () => {
  it("renders the table it wraps", () => {
    render(<GuestTable />);

    expect(screen.getByRole("columnheader", { name: "Guest" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "₱2,500.00" })).toBeVisible();
  });

  it("has no axe violations", async () => {
    const { container } = render(<GuestTable />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
