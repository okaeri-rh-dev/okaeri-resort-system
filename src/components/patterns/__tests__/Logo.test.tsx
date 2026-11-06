import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { Logo } from "@/components/patterns";

describe("Logo", () => {
  it("names the full logo when given a label", () => {
    render(<Logo label="Okaeri Rest House" />);

    expect(screen.getByRole("img", { name: "Okaeri Rest House" })).toBeInTheDocument();
  });

  it("hides an unlabelled mark from screen readers", () => {
    const { container } = render(<Logo variant="mark" />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelector("use")).toHaveAttribute("href", "/logo.svg#roof");
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <div>
        <Logo label="Okaeri Rest House" />
        <Logo variant="mark" />
      </div>
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
