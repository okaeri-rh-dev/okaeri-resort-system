import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { MobileCard, MobileCardRow, StatusBadge } from "@/components/patterns";

describe("MobileCard and MobileCardRow", () => {
  it("lays out a record as labelled rows", () => {
    render(
      <MobileCard>
        <MobileCardRow label="Booking" value="OKR-1042" />
        <MobileCardRow label="Status" value={<StatusBadge tone="success">Paid</StatusBadge>} />
      </MobileCard>
    );

    expect(screen.getByText("Booking")).toBeVisible();
    expect(screen.getByText("OKR-1042")).toBeVisible();
    expect(screen.getByText("Paid")).toBeVisible();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <MobileCard>
        <MobileCardRow label="Amount" value="₱2,500.00" />
      </MobileCard>
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
