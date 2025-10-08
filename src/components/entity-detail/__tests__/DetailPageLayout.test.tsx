// src/components/entity-detail/__tests__/DetailPageLayout.test.tsx

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DetailPageLayout } from "../DetailPageLayout";

// Mock TanStack Router Link
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, params, children, className }: any) => (
    <a
      href={`${to}?${new URLSearchParams(params || {}).toString()}`}
      className={className}
      data-testid="router-link"
    >
      {children}
    </a>
  ),
}));

describe("DetailPageLayout", () => {
  describe("Basic rendering", () => {
    it("renders title and children", () => {
      render(
        <DetailPageLayout title="Test Entity" breadcrumbs={[]}>
          <div data-testid="child-content">Child Content</div>
        </DetailPageLayout>
      );

      expect(screen.getByText("Test Entity")).toBeInTheDocument();
      expect(screen.getByTestId("child-content")).toBeInTheDocument();
    });

    it("renders subtitle when provided", () => {
      render(
        <DetailPageLayout title="Test Entity" subtitle="Test Subtitle" breadcrumbs={[]}>
          <div>Content</div>
        </DetailPageLayout>
      );

      expect(screen.getByText("Test Subtitle")).toBeInTheDocument();
    });

    it("does not render subtitle section when not provided", () => {
      const { container } = render(
        <DetailPageLayout title="Test Entity" breadcrumbs={[]}>
          <div>Content</div>
        </DetailPageLayout>
      );

      // Subtitle should not be in the document
      expect(container.querySelector("p.text-sm.text-neutral-500")).not.toBeInTheDocument();
    });
  });

  describe("Breadcrumbs", () => {
    it("renders breadcrumb navigation", () => {
      const breadcrumbs = [
        { label: "Home", to: "/" },
        { label: "Bookings", to: "/bookings" },
        { label: "BK-001" },
      ];

      render(
        <DetailPageLayout title="Booking Detail" breadcrumbs={breadcrumbs}>
          <div>Content</div>
        </DetailPageLayout>
      );

      expect(screen.getByText("Home")).toBeInTheDocument();
      expect(screen.getByText("Bookings")).toBeInTheDocument();
      expect(screen.getByText("BK-001")).toBeInTheDocument();
    });

    it("handles breadcrumbs without to (current page)", () => {
      const breadcrumbs = [
        { label: "Bookings", to: "/bookings" },
        { label: "Current Page" }, // No to - current page
      ];

      render(
        <DetailPageLayout title="Test" breadcrumbs={breadcrumbs}>
          <div>Content</div>
        </DetailPageLayout>
      );

      // Current page should not be a link (should be a span)
      const currentPage = screen.getByText("Current Page");
      expect(currentPage.tagName).toBe("SPAN");
    });

    it("renders empty breadcrumbs array", () => {
      const { container } = render(
        <DetailPageLayout title="Test Entity" breadcrumbs={[]}>
          <div>Content</div>
        </DetailPageLayout>
      );

      // Breadcrumb nav should still exist but be empty
      const nav = container.querySelector("nav[aria-label='Breadcrumb']");
      expect(nav).toBeInTheDocument();
      expect(nav?.children.length).toBe(0);
    });
  });

  describe("Status badge", () => {
    it("renders status badge when provided", () => {
      render(
        <DetailPageLayout
          title="Test Entity"
          breadcrumbs={[]}
          status={<span data-testid="status-badge">Active</span>}
        >
          <div>Content</div>
        </DetailPageLayout>
      );

      expect(screen.getByTestId("status-badge")).toBeInTheDocument();
      expect(screen.getByText("Active")).toBeInTheDocument();
    });

    it("does not render status badge section when not provided", () => {
      render(
        <DetailPageLayout title="Test Entity" breadcrumbs={[]}>
          <div>Content</div>
        </DetailPageLayout>
      );

      expect(screen.queryByTestId("status-badge")).not.toBeInTheDocument();
    });
  });

  describe("Actions", () => {
    it("renders action buttons when provided", () => {
      render(
        <DetailPageLayout
          title="Test Entity"
          breadcrumbs={[]}
          actions={<button data-testid="edit-button">Edit</button>}
        >
          <div>Content</div>
        </DetailPageLayout>
      );

      expect(screen.getByTestId("edit-button")).toBeInTheDocument();
    });

    it("does not render actions section when not provided", () => {
      render(
        <DetailPageLayout title="Test Entity" breadcrumbs={[]}>
          <div>Content</div>
        </DetailPageLayout>
      );

      expect(screen.queryByTestId("edit-button")).not.toBeInTheDocument();
    });
  });

  describe("Layout structure", () => {
    it("applies container max width", () => {
      const { container } = render(
        <DetailPageLayout title="Test" breadcrumbs={[]}>
          <div>Content</div>
        </DetailPageLayout>
      );

      const mainContainer = container.querySelector(".container");
      expect(mainContainer).toBeInTheDocument();
      expect(mainContainer).toHaveClass("max-w-[1400px]");
    });

    it("applies responsive padding", () => {
      const { container } = render(
        <DetailPageLayout title="Test" breadcrumbs={[]}>
          <div>Content</div>
        </DetailPageLayout>
      );

      const mainContainer = container.querySelector(".container");
      expect(mainContainer).toHaveClass("py-6");
    });

    it("renders children in main content area", () => {
      render(
        <DetailPageLayout title="Test" breadcrumbs={[]}>
          <div data-testid="main-content">
            <p>Main content goes here</p>
          </div>
        </DetailPageLayout>
      );

      expect(screen.getByTestId("main-content")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("renders semantic HTML structure", () => {
      const { container } = render(
        <DetailPageLayout title="Test Entity" breadcrumbs={[]}>
          <div>Content</div>
        </DetailPageLayout>
      );

      // Should use proper heading hierarchy
      const h1 = container.querySelector("h1");
      expect(h1).toBeInTheDocument();
      expect(h1).toHaveTextContent("Test Entity");
    });

    it("breadcrumb nav has proper aria-label", () => {
      const breadcrumbs = [{ label: "Home", to: "/" }, { label: "Current" }];

      const { container } = render(
        <DetailPageLayout title="Test" breadcrumbs={breadcrumbs}>
          <div>Content</div>
        </DetailPageLayout>
      );

      const nav = container.querySelector("nav");
      expect(nav).toHaveAttribute("aria-label", "Breadcrumb");
    });
  });

  describe("Complex layouts", () => {
    it("handles all props together", () => {
      const breadcrumbs = [{ label: "Bookings", to: "/bookings" }, { label: "BK-001" }];

      render(
        <DetailPageLayout
          title="Booking Detail"
          subtitle="Created 2024-01-01"
          breadcrumbs={breadcrumbs}
          status={<span data-testid="badge">Confirmed</span>}
          actions={<button data-testid="edit-btn">Edit</button>}
        >
          <div data-testid="content">Complex content</div>
        </DetailPageLayout>
      );

      expect(screen.getByText("Booking Detail")).toBeInTheDocument();
      expect(screen.getByText("Created 2024-01-01")).toBeInTheDocument();
      expect(screen.getByText("Bookings")).toBeInTheDocument();
      expect(screen.getByTestId("badge")).toBeInTheDocument();
      expect(screen.getByTestId("edit-btn")).toBeInTheDocument();
      expect(screen.getByTestId("content")).toBeInTheDocument();
    });
  });
});
