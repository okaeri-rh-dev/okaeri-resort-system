import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { Button, PageBottomBar } from "@/components/patterns";

describe("PageBottomBar", () => {
  it("renders the page's actions", () => {
    render(
      <PageBottomBar>
        <Button>Next</Button>
      </PageBottomBar>
    );

    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <PageBottomBar>
        <Button>Next</Button>
      </PageBottomBar>
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
