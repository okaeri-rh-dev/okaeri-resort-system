// src/components/entity-detail/__tests__/DetailSection.test.tsx

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DetailSection } from "../DetailSection";

describe("DetailSection", () => {
  describe("Basic rendering", () => {
    it("renders title and children", () => {
      render(
        <DetailSection title="Section Title">
          <div data-testid="section-content">Section Content</div>
        </DetailSection>
      );

      expect(screen.getByText("Section Title")).toBeInTheDocument();
      expect(screen.getByTestId("section-content")).toBeInTheDocument();
    });
  });

  describe("Actions slot", () => {
    it("renders action buttons when provided", () => {
      render(
        <DetailSection
          title="Test Section"
          action={<button data-testid="action-btn">Action</button>}
        >
          <div>Content</div>
        </DetailSection>
      );

      expect(screen.getByTestId("action-btn")).toBeInTheDocument();
    });

    it("does not render actions container when not provided", () => {
      render(
        <DetailSection title="Test Section">
          <div>Content</div>
        </DetailSection>
      );

      expect(screen.queryByTestId("action-btn")).not.toBeInTheDocument();
    });

    it("does not render action when collapsible is enabled", () => {
      render(
        <DetailSection
          title="Test Section"
          action={<button data-testid="action-btn">Action</button>}
          collapsible
        >
          <div>Content</div>
        </DetailSection>
      );

      // Action should not be rendered when collapsible is true (only collapse button is shown)
      expect(screen.queryByTestId("action-btn")).not.toBeInTheDocument();
    });
  });

  describe("Card styling", () => {
    it("applies card classes for elevated appearance", () => {
      const { container } = render(
        <DetailSection title="Test">
          <div>Content</div>
        </DetailSection>
      );

      // Component uses Card, not section element
      const card = container.querySelector(".bg-card");
      expect(card).toBeInTheDocument();
      expect(card).toHaveClass("border", "shadow-card");
    });

    it("applies proper padding", () => {
      const { container } = render(
        <DetailSection title="Test">
          <div>Content</div>
        </DetailSection>
      );

      // Card has p-6 padding
      const card = container.querySelector(".p-6");
      expect(card).toBeInTheDocument();
    });
  });

  describe("Collapsible functionality", () => {
    it("shows content by default when defaultCollapsed is false", () => {
      render(
        <DetailSection title="Test" collapsible defaultCollapsed={false}>
          <div data-testid="content">Visible Content</div>
        </DetailSection>
      );

      expect(screen.getByTestId("content")).toBeVisible();
    });

    it("hides content when defaultCollapsed is true", () => {
      render(
        <DetailSection title="Test" collapsible defaultCollapsed={true}>
          <div data-testid="content">Hidden Content</div>
        </DetailSection>
      );

      // Content should not be in the document when collapsed
      expect(screen.queryByTestId("content")).not.toBeInTheDocument();
    });

    it("toggles content visibility when clicking collapse button", () => {
      render(
        <DetailSection title="Collapsible Section" collapsible defaultCollapsed={false}>
          <div data-testid="content">Toggle me</div>
        </DetailSection>
      );

      // Content visible initially
      expect(screen.getByTestId("content")).toBeInTheDocument();

      // Click collapse button (not the header text)
      const collapseButton = screen.getByRole("button", { name: /collapse section/i });
      fireEvent.click(collapseButton);

      // Content should be hidden
      expect(screen.queryByTestId("content")).not.toBeInTheDocument();

      // Click again to expand
      const expandButton = screen.getByRole("button", { name: /expand section/i });
      fireEvent.click(expandButton);

      // Content should be visible again
      expect(screen.getByTestId("content")).toBeInTheDocument();
    });

    it("renders chevron icon for collapsible sections", () => {
      const { container } = render(
        <DetailSection title="Test" collapsible defaultCollapsed={false}>
          <div>Content</div>
        </DetailSection>
      );

      // Should have chevron icon (SVG) - ChevronUp when expanded
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("changes chevron direction when expanded/collapsed", () => {
      render(
        <DetailSection title="Test" collapsible defaultCollapsed={true}>
          <div>Content</div>
        </DetailSection>
      );

      // Collapsed: should show ChevronDown
      expect(screen.getByRole("button", { name: /expand section/i })).toBeInTheDocument();

      // Click to expand
      const expandButton = screen.getByRole("button", { name: /expand section/i });
      fireEvent.click(expandButton);

      // Expanded: should show ChevronUp
      expect(screen.getByRole("button", { name: /collapse section/i })).toBeInTheDocument();
    });

    it("does not show collapse button when not collapsible", () => {
      render(
        <DetailSection title="Test">
          <div>Content</div>
        </DetailSection>
      );

      // Should not have collapse button
      expect(screen.queryByRole("button", { name: /collapse section/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /expand section/i })).not.toBeInTheDocument();
    });
  });

  describe("Icon support", () => {
    it("renders icon when provided", () => {
      render(
        <DetailSection title="Test Section" icon={<span data-testid="section-icon">📋</span>}>
          <div>Content</div>
        </DetailSection>
      );

      expect(screen.getByTestId("section-icon")).toBeInTheDocument();
    });

    it("positions icon before title", () => {
      render(
        <DetailSection title="Test Section" icon={<span data-testid="icon">📋</span>}>
          <div>Content</div>
        </DetailSection>
      );

      const icon = screen.getByTestId("icon");
      const title = screen.getByText("Test Section");

      // Icon and title are in the same CardTitle container
      // Icon should appear before title text (using bitmask: DOCUMENT_POSITION_FOLLOWING = 4, DOCUMENT_POSITION_CONTAINED_BY = 8)
      // When icon is in a parent container with the text as a sibling, we get 4 + 16 = 20 or similar
      // Simplify: just check that icon is present and they share a parent
      const cardTitle = icon.closest(".tracking-tight");
      expect(cardTitle).toContain(title);
      expect(cardTitle?.textContent).toMatch(/📋.*Test Section/);
    });
  });

  describe("Accessibility", () => {
    it("uses Card component (not semantic section)", () => {
      const { container } = render(
        <DetailSection title="Test">
          <div>Content</div>
        </DetailSection>
      );

      // Component uses Card (div), not section element
      expect(container.querySelector("section")).not.toBeInTheDocument();
      expect(container.querySelector(".bg-card")).toBeInTheDocument();
    });

    it("collapse button is keyboard accessible when collapsible", () => {
      render(
        <DetailSection title="Test" collapsible defaultCollapsed={false}>
          <div data-testid="content">Content</div>
        </DetailSection>
      );

      const button = screen.getByRole("button", { name: /collapse section/i });
      expect(button).toBeInTheDocument();
      // Button component doesn't explicitly set type="button", but it's still a valid button element
      expect(button.tagName).toBe("BUTTON");
    });

    it("collapse button has proper ARIA label", () => {
      render(
        <DetailSection title="Test" collapsible defaultCollapsed={false}>
          <div>Content</div>
        </DetailSection>
      );

      const button = screen.getByRole("button", { name: /collapse section/i });
      expect(button).toHaveAttribute("aria-label", "Collapse section");
    });
  });

  describe("Custom className", () => {
    it("applies custom className when provided", () => {
      const { container } = render(
        <DetailSection title="Test" className="custom-class">
          <div>Content</div>
        </DetailSection>
      );

      // Custom class is applied to the Card component
      const card = container.querySelector(".custom-class");
      expect(card).toBeInTheDocument();
    });

    it("merges custom className with default classes", () => {
      const { container } = render(
        <DetailSection title="Test" className="custom-class">
          <div>Content</div>
        </DetailSection>
      );

      // Custom class is merged with Card's default classes
      const card = container.querySelector(".custom-class");
      expect(card).toHaveClass("custom-class", "border", "border-neutral-200");
    });
  });

  describe("Complex scenarios", () => {
    it("handles section with title, icon, and action (non-collapsible)", () => {
      render(
        <DetailSection
          title="Complex Section"
          icon={<span data-testid="icon">🔍</span>}
          action={<button data-testid="action">Edit</button>}
        >
          <div data-testid="content">Complex content</div>
        </DetailSection>
      );

      expect(screen.getByTestId("icon")).toBeInTheDocument();
      expect(screen.getByText("Complex Section")).toBeInTheDocument();
      expect(screen.getByTestId("action")).toBeInTheDocument();
      expect(screen.getByTestId("content")).toBeInTheDocument();
    });

    it("handles collapsible section with icon (action not shown when collapsible)", () => {
      render(
        <DetailSection
          title="Complex Section"
          icon={<span data-testid="icon">🔍</span>}
          action={<button data-testid="action">Edit</button>}
          collapsible
          defaultCollapsed={false}
        >
          <div data-testid="content">Complex content</div>
        </DetailSection>
      );

      expect(screen.getByTestId("icon")).toBeInTheDocument();
      expect(screen.getByText("Complex Section")).toBeInTheDocument();
      // Action is NOT rendered when collapsible is true
      expect(screen.queryByTestId("action")).not.toBeInTheDocument();
      // But collapse button should be present
      expect(screen.getByRole("button", { name: /collapse section/i })).toBeInTheDocument();
      expect(screen.getByTestId("content")).toBeInTheDocument();
    });
  });
});
