import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { BrandedScreen, Card, CardHeader, CardTitle } from "@/components/patterns";

function renderScreen(subtitle?: string) {
  return render(
    <BrandedScreen subtitle={subtitle}>
      <Card>
        <CardHeader>
          <CardTitle>Create Account</CardTitle>
        </CardHeader>
      </Card>
    </BrandedScreen>
  );
}

describe("BrandedScreen", () => {
  it("shows the named logo above the screen's own title", () => {
    renderScreen();

    const logo = screen.getByRole("img", { name: "Okaeri Rest House" });
    const title = screen.getByRole("heading", { name: "Create Account" });
    expect(logo.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows the subtitle under the logo when given one", () => {
    renderScreen("Sign in to access the resort management dashboard");

    expect(screen.getByText("Sign in to access the resort management dashboard")).toBeVisible();
  });

  it("has no axe violations", async () => {
    const { container } = renderScreen("A subtitle");

    expect(await axe(container)).toHaveNoViolations();
  });
});
