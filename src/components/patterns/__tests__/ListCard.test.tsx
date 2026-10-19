import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { ListCard, ListCardRow, StatusBadge } from "@/components/patterns";

describe("ListCard and ListCardRow", () => {
  it("lays out a record as labelled rows", () => {
    render(
      <ListCard>
        <ListCardRow label="Booking" value="OKR-1042" />
        <ListCardRow label="Status" value={<StatusBadge tone="success">Paid</StatusBadge>} />
      </ListCard>
    );

    expect(screen.getByText("Booking")).toBeVisible();
    expect(screen.getByText("OKR-1042")).toBeVisible();
    expect(screen.getByText("Paid")).toBeVisible();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <ListCard>
        <ListCardRow label="Amount" value="₱2,500.00" />
      </ListCard>
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
