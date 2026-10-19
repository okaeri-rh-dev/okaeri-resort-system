import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { Callout } from "@/components/patterns";

describe("Callout", () => {
  it("announces a danger callout as an alert, with its title and message", () => {
    render(
      <Callout tone="danger" title="Payment failed">
        Upload the receipt again.
      </Callout>
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Payment failed");
    expect(alert).toHaveTextContent("Upload the receipt again.");
  });

  it.each(["success", "info", "neutral"] as const)(
    "reads a %s callout as a polite status",
    (tone) => {
      render(<Callout tone={tone}>Saved</Callout>);

      expect(screen.getByRole("status")).toHaveTextContent("Saved");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    }
  );

  it("has no axe violations", async () => {
    const { container } = render(
      <div>
        <Callout tone="warning" title="Downpayment due">
          Pay within 24 hours to keep the dates.
        </Callout>
        <Callout tone="info">Check-in is from 2 PM.</Callout>
      </div>
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
