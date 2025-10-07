// src/components/entity-detail/__tests__/DetailSection.test.tsx

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

    it("renders without title (optional)", () => {
      render(
        <DetailSection>
          <div data-testid="content">Content without title</div>
        </DetailSection>
      );

      expect(screen.getByTestId("content")).toBeInTheDocument();
    });
  });

  describe("Actions slot", () => {
    it("renders action buttons when provided", () => {
      render(
        <DetailSection
          title="Test Section"
          actions={<button data-testid="action-btn">Action</button>}
        >
          <div>Content</div>
        </DetailSection>
      );

      expect(screen.getByTestId("action-btn")).toBeInTheDocument();
    });

    it("does not render actions container when not provided", () => {
      const { container } = render(
        <DetailSection title="Test Section">
          <div>Content</div>
        </DetailSection>
      );

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

      const section = container.querySelector("section");
      expect(section).toHaveClass("rounded-lg", "border", "bg-card");
    });

    it("applies proper padding", () => {
      const { container } = render(
        <DetailSection title="Test">
          <div>Content</div>
        </DetailSection>
      );

      const section = container.querySelector("section");
      expect(section).toHaveClass("p-6");
    });
  });

  describe("Collapsible functionality", () => {
    it("shows content by default when defaultCollapsed is false", () => {
      render(
        <DetailSection title="Test" defaultCollapsed={false}>
          <div data-testid="content">Visible Content</div>
        </DetailSection>
      );

      expect(screen.getByTestId("content")).toBeVisible();
    });

    it("hides content when defaultCollapsed is true", () => {
      render(
        <DetailSection title="Test" defaultCollapsed={true}>
          <div data-testid="content">Hidden Content</div>
        </DetailSection>
      );

      // Content should not be in the document when collapsed
      expect(screen.queryByTestId("content")).not.toBeInTheDocument();
    });

    it("toggles content visibility when clicking header", () => {
      render(
        <DetailSection title="Collapsible Section" defaultCollapsed={false}>
          <div data-testid="content">Toggle me</div>
        </DetailSection>
      );

      // Content visible initially
      expect(screen.getByTestId("content")).toBeInTheDocument();

      // Click header to collapse
      const header = screen.getByText("Collapsible Section");
      fireEvent.click(header);

      // Content should be hidden
      expect(screen.queryByTestId("content")).not.toBeInTheDocument();

      // Click again to expand
      fireEvent.click(header);

      // Content should be visible again
      expect(screen.getByTestId("content")).toBeInTheDocument();
    });

    it("renders chevron icon for collapsible sections", () => {
      const { container } = render(
        <DetailSection title="Test" defaultCollapsed={false}>
          <div>Content</div>
        </DetailSection>
      );

      // Should have chevron icon (SVG)
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("rotates chevron when expanded/collapsed", () => {
      const { container } = render(
        <DetailSection title="Test" defaultCollapsed={true}>
          <div>Content</div>
        </DetailSection>
      );

      const svg = container.querySelector("svg");
      expect(svg).toHaveClass("rotate-0"); // Collapsed

      // Click to expand
      const header = screen.getByText("Test");
      fireEvent.click(header);

      expect(svg).toHaveClass("rotate-180"); // Expanded
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

      // Icon's parent should be before title in DOM
      expect(icon.compareDocumentPosition(title)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });
  });

  describe("Accessibility", () => {
    it("uses semantic section element", () => {
      const { container } = render(
        <DetailSection title="Test">
          <div>Content</div>
        </DetailSection>
      );

      expect(container.querySelector("section")).toBeInTheDocument();
    });

    it("header is keyboard accessible when collapsible", () => {
      const { container } = render(
        <DetailSection title="Test" defaultCollapsed={false}>
          <div data-testid="content">Content</div>
        </DetailSection>
      );

      const header = screen.getByText("Test").closest("button");
      expect(header).toBeInTheDocument();
      expect(header).toHaveAttribute("type", "button");
    });

    it("header has proper ARIA attributes", () => {
      render(
        <DetailSection title="Test" defaultCollapsed={false}>
          <div>Content</div>
        </DetailSection>
      );

      const header = screen.getByText("Test").closest("button");
      expect(header).toHaveAttribute("aria-expanded", "true");
    });
  });

  describe("Custom className", () => {
    it("applies custom className when provided", () => {
      const { container } = render(
        <DetailSection title="Test" className="custom-class">
          <div>Content</div>
        </DetailSection>
      );

      const section = container.querySelector("section");
      expect(section).toHaveClass("custom-class");
    });

    it("merges custom className with default classes", () => {
      const { container } = render(
        <DetailSection title="Test" className="custom-class">
          <div>Content</div>
        </DetailSection>
      );

      const section = container.querySelector("section");
      expect(section).toHaveClass("custom-class", "rounded-lg", "border");
    });
  });

  describe("Complex scenarios", () => {
    it("handles section with title, icon, actions, and collapsible", () => {
      render(
        <DetailSection
          title="Complex Section"
          icon={<span data-testid="icon">🔍</span>}
          actions={<button data-testid="action">Edit</button>}
          defaultCollapsed={false}
        >
          <div data-testid="content">Complex content</div>
        </DetailSection>
      );

      expect(screen.getByTestId("icon")).toBeInTheDocument();
      expect(screen.getByText("Complex Section")).toBeInTheDocument();
      expect(screen.getByTestId("action")).toBeInTheDocument();
      expect(screen.getByTestId("content")).toBeInTheDocument();
    });
  });
});
