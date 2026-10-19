import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { Button, DetailSection } from "@/components/patterns";

describe("DetailSection", () => {
  it("renders its title as a section heading over its content", () => {
    render(
      <DetailSection title="Guest">
        <p>Maria Santos</p>
      </DetailSection>
    );

    expect(screen.getByRole("heading", { level: 2, name: "Guest" })).toBeVisible();
    expect(screen.getByText("Maria Santos")).toBeVisible();
  });

  it("shows a header action when the section is not collapsible", () => {
    render(
      <DetailSection title="Guest" action={<Button>Edit guest</Button>}>
        <p>Maria Santos</p>
      </DetailSection>
    );

    expect(screen.getByRole("button", { name: "Edit guest" })).toBeVisible();
  });

  it("collapses and expands from its toggle", async () => {
    render(
      <DetailSection title="Notes" collapsible action={<Button>Edit notes</Button>}>
        <p>Late arrival</p>
      </DetailSection>
    );

    expect(screen.queryByRole("button", { name: "Edit notes" })).not.toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "Collapse Notes" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(toggle);
    expect(screen.queryByText("Late arrival")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand Notes" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );

    await userEvent.click(screen.getByRole("button", { name: "Expand Notes" }));
    expect(screen.getByText("Late arrival")).toBeVisible();
  });

  it("starts collapsed when asked", () => {
    render(
      <DetailSection title="Notes" collapsible defaultCollapsed>
        <p>Late arrival</p>
      </DetailSection>
    );

    expect(screen.queryByText("Late arrival")).not.toBeInTheDocument();
  });

  it("has no axe violations, expanded and collapsed", async () => {
    const { container } = render(
      <div>
        <DetailSection title="Guest">
          <p>Maria Santos</p>
        </DetailSection>
        <DetailSection title="Notes" collapsible defaultCollapsed>
          <p>Late arrival</p>
        </DetailSection>
      </div>
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
