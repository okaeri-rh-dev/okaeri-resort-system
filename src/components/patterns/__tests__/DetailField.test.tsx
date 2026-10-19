import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { DetailField, StatusBadge } from "@/components/patterns";

describe("DetailField", () => {
  it("shows the label and a text value", () => {
    render(<DetailField label="Guest" value="Maria Santos" />);

    expect(screen.getByText("Guest")).toBeVisible();
    expect(screen.getByText("Maria Santos")).toBeVisible();
  });

  it.each([
    ["zero", 0, "0"],
    ["a number", 3, "3"],
  ])("renders %s as a value", (_name, value, text) => {
    render(<DetailField label="Guests" value={value} />);

    expect(screen.getByText(text)).toBeVisible();
  });

  it("renders an element value, such as a status pill", () => {
    render(
      <DetailField
        label="Status"
        direction="horizontal"
        value={<StatusBadge tone="success">Confirmed</StatusBadge>}
      />
    );

    expect(screen.getByText("Status")).toBeVisible();
    expect(screen.getByText("Confirmed")).toBeVisible();
  });

  it("renders the icon before the label", () => {
    render(<DetailField label="Check-in" value="Oct 19" icon={<svg data-testid="icon" />} />);

    const icon = screen.getByTestId("icon");
    expect(
      icon.compareDocumentPosition(screen.getByText("Check-in")) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("has no axe violations in either direction and every emphasis", async () => {
    const { container } = render(
      <div>
        <DetailField label="Guest" value="Maria Santos" emphasis="strong" />
        <DetailField label="Balance" value="₱2,500.00" emphasis="figure" direction="horizontal" />
        <DetailField label="Total" value="₱5,000.00" emphasis="total" />
      </div>
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
