import type { ReactNode } from "react";

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { Button, DetailPageLayout, DetailSection, StatusBadge } from "@/components/patterns";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    children,
    className,
  }: {
    to: string;
    params?: Record<string, string>;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={`${to}?${new URLSearchParams(params ?? {}).toString()}`} className={className}>
      {children}
    </a>
  ),
}));

describe("DetailPageLayout", () => {
  it("renders the title as the page heading, the subtitle and the sections", () => {
    render(
      <DetailPageLayout title="Booking OKR-1042" subtitle="Created Oct 19" breadcrumbs={[]}>
        <DetailSection title="Stay">
          <p>Two nights</p>
        </DetailSection>
      </DetailPageLayout>
    );

    expect(screen.getByRole("heading", { level: 1, name: "Booking OKR-1042" })).toBeVisible();
    expect(screen.getByText("Created Oct 19")).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "Stay" })).toBeVisible();
  });

  it("links earlier breadcrumbs and marks the last as the current page", () => {
    render(
      <DetailPageLayout
        title="Booking OKR-1042"
        breadcrumbs={[{ label: "Bookings", to: "/admin/bookings" }, { label: "OKR-1042" }]}
      >
        <p>Body</p>
      </DetailPageLayout>
    );

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(nav).getByRole("link", { name: "Bookings" })).toHaveAttribute(
      "href",
      expect.stringContaining("/admin/bookings")
    );
    expect(within(nav).getByText("OKR-1042")).toHaveAttribute("aria-current", "page");
  });

  it("shows the status and the actions, with Edit as a link to the edit route", () => {
    render(
      <DetailPageLayout
        title="Booking OKR-1042"
        breadcrumbs={[]}
        status={<StatusBadge tone="success">Confirmed</StatusBadge>}
        actions={<Button>Record payment</Button>}
        editRoute={{ to: "/admin/bookings/$bookingId/edit", params: { bookingId: "b1" } }}
      >
        <p>Body</p>
      </DetailPageLayout>
    );

    expect(screen.getByText("Confirmed")).toBeVisible();
    const actions = screen.getByRole("group", { name: "Page actions" });
    expect(within(actions).getByRole("button", { name: "Record payment" })).toBeVisible();
    expect(within(actions).getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      expect.stringContaining("bookingId=b1")
    );
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <main>
        <DetailPageLayout
          title="Booking OKR-1042"
          breadcrumbs={[{ label: "Bookings", to: "/admin/bookings" }, { label: "OKR-1042" }]}
          status={<StatusBadge tone="warning">Pending</StatusBadge>}
          editRoute={{ to: "/admin/bookings/$bookingId/edit", params: { bookingId: "b1" } }}
        >
          <DetailSection title="Stay" collapsible>
            <p>Two nights</p>
          </DetailSection>
        </DetailPageLayout>
      </main>
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
