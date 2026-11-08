import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { LogoLoader } from "@/components/patterns";

describe("LogoLoader", () => {
  it("is a status named Loading", () => {
    render(<LogoLoader />);

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("draws the splash-sized logo by default and a smaller one for content areas", () => {
    const { rerender } = render(<LogoLoader />);
    expect(screen.getByRole("status").querySelector("svg")).toHaveClass("w-[min(60vw,240px)]");

    rerender(<LogoLoader size="content" />);
    expect(screen.getByRole("status").querySelector("svg")).toHaveClass("w-32");
  });

  it("shows Loading… text only under reduced motion", () => {
    render(<LogoLoader />);

    // jsdom has no media queries, so the motion-safe variant is the observable contract
    expect(screen.getByText("Loading…")).toHaveClass("motion-safe:hidden");
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <div>
        <LogoLoader />
        <LogoLoader size="content" />
      </div>
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
