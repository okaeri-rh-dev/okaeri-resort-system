import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { Button, PageHeader, StatusBadge } from "@/components/patterns";

describe("PageHeader", () => {
  it("renders the title as the page's level-one heading", () => {
    render(<PageHeader title="Bookings" description="Every stay, newest first." />);

    expect(screen.getByRole("heading", { level: 1, name: "Bookings" })).toBeVisible();
    expect(screen.getByText("Every stay, newest first.")).toBeVisible();
  });

  it("keeps the status beside the title and the actions apart from it", () => {
    render(
      <PageHeader
        title="Booking OKR-1042"
        status={<StatusBadge tone="success">Confirmed</StatusBadge>}
        actions={<Button>Record payment</Button>}
      />
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Booking OKR-1042");
    expect(screen.getByText("Confirmed")).toBeVisible();
    const actions = screen.getByRole("group", { name: "Page actions" });
    expect(within(actions).getByRole("button", { name: "Record payment" })).toBeVisible();
  });

  it("renders the guest surface's header with the same structure", () => {
    render(<PageHeader title="Book your stay" surface="guest" />);

    expect(screen.getByRole("heading", { level: 1, name: "Book your stay" })).toBeVisible();
    expect(screen.queryByRole("group", { name: "Page actions" })).not.toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <main>
        <PageHeader
          title="Payments"
          description="Downpayments and balances."
          actions={<Button>Record payment</Button>}
        />
      </main>
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
