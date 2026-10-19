import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { FormSkeleton } from "../FormSkeleton";

describe("FormSkeleton", () => {
  it("announces that the form is loading", () => {
    render(<FormSkeleton label="Loading booking form" />);

    expect(screen.getByRole("status", { name: "Loading booking form" })).toBeInTheDocument();
  });

  it.each([
    ["plain form", {}],
    ["step form", { steps: 4, currentStep: 2 }],
    ["form without actions", { fields: 2, actions: false }],
  ])("has no axe violations as a %s", async (_name, props) => {
    const { container } = render(<FormSkeleton {...props} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
