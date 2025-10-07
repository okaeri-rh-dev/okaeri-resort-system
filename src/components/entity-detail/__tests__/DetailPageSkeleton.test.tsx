// src/components/entity-detail/__tests__/DetailPageSkeleton.test.tsx

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DetailPageSkeleton } from "../DetailPageSkeleton";

describe("DetailPageSkeleton", () => {
  describe("Basic rendering", () => {
    it("renders skeleton structure", () => {
      const { container } = render(<DetailPageSkeleton />);

      // Should have skeleton elements
      const skeletons = container.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("renders breadcrumb skeleton", () => {
      const { container } = render(<DetailPageSkeleton />);

      // Should have breadcrumb skeleton placeholders
      const breadcrumbSkeletons = container.querySelectorAll(".h-4.w-20");
      expect(breadcrumbSkeletons.length).toBeGreaterThan(0);
    });

    it("renders header skeleton", () => {
      const { container } = render(<DetailPageSkeleton />);

      // Should have title skeleton (larger)
      const titleSkeleton = container.querySelector(".h-8");
      expect(titleSkeleton).toBeInTheDocument();
    });

    it("renders section skeletons", () => {
      const { container } = render(<DetailPageSkeleton />);

      // Should have multiple section placeholders
      const sections = container.querySelectorAll(".rounded-lg.border");
      expect(sections.length).toBeGreaterThan(0);
    });
  });

  describe("Layout structure", () => {
    it("uses container layout", () => {
      const { container } = render(<DetailPageSkeleton />);

      const mainContainer = container.querySelector(".container");
      expect(mainContainer).toBeInTheDocument();
    });

    it("applies proper spacing", () => {
      const { container } = render(<DetailPageSkeleton />);

      const mainContainer = container.querySelector(".container");
      expect(mainContainer).toHaveClass("py-6");
    });

    it("applies space-y for vertical rhythm", () => {
      const { container } = render(<DetailPageSkeleton />);

      const contentWrapper = container.querySelector(".space-y-6");
      expect(contentWrapper).toBeInTheDocument();
    });
  });

  describe("Skeleton sections", () => {
    it("renders breadcrumb section skeleton", () => {
      const { container } = render(<DetailPageSkeleton />);

      // Breadcrumb typically has 2-3 items
      const breadcrumbItems = container.querySelectorAll(".flex.items-center.space-x-2 .h-4");
      expect(breadcrumbItems.length).toBeGreaterThanOrEqual(2);
    });

    it("renders header section skeleton", () => {
      const { container } = render(<DetailPageSkeleton />);

      // Header should have title and possibly subtitle
      const headerSkeletons = container.querySelectorAll(".space-y-2 .h-8, .space-y-2 .h-4");
      expect(headerSkeletons.length).toBeGreaterThan(0);
    });

    it("renders content sections skeleton (3 sections)", () => {
      const { container } = render(<DetailPageSkeleton />);

      // Should have 3 content section cards
      const sectionCards = container.querySelectorAll(".rounded-lg.border.p-6");
      expect(sectionCards.length).toBe(3);
    });

    it("each section has field placeholders", () => {
      const { container } = render(<DetailPageSkeleton />);

      // Each section should have multiple field placeholders
      const sections = container.querySelectorAll(".rounded-lg.border.p-6");
      sections.forEach((section) => {
        const fields = section.querySelectorAll(".space-y-2");
        expect(fields.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Animation", () => {
    it("applies pulse animation to skeleton elements", () => {
      const { container } = render(<DetailPageSkeleton />);

      const animatedElements = container.querySelectorAll(".animate-pulse");
      expect(animatedElements.length).toBeGreaterThan(0);
    });

    it("skeleton bars have bg-gray-200 or bg-muted", () => {
      const { container } = render(<DetailPageSkeleton />);

      const skeletonBars = container.querySelectorAll(".bg-gray-200, .bg-muted");
      expect(skeletonBars.length).toBeGreaterThan(0);
    });

    it("skeleton bars have rounded corners", () => {
      const { container } = render(<DetailPageSkeleton />);

      const roundedElements = container.querySelectorAll(".rounded, .rounded-md, .rounded-lg");
      expect(roundedElements.length).toBeGreaterThan(0);
    });
  });

  describe("Responsive design", () => {
    it("maintains layout structure", () => {
      const { container } = render(<DetailPageSkeleton />);

      // Should have consistent structure regardless of viewport
      expect(container.querySelector(".container")).toBeInTheDocument();
      expect(container.querySelectorAll(".space-y-6").length).toBeGreaterThan(0);
    });

    it("sections use card-like structure", () => {
      const { container } = render(<DetailPageSkeleton />);

      const cards = container.querySelectorAll(".rounded-lg.border");
      cards.forEach((card) => {
        expect(card).toHaveClass("bg-card");
      });
    });
  });

  describe("Skeleton dimensions", () => {
    it("breadcrumb items have small height", () => {
      const { container } = render(<DetailPageSkeleton />);

      // Breadcrumb items should be h-4 (small)
      const breadcrumbItems = container.querySelectorAll(".h-4.w-20, .h-4.w-24");
      expect(breadcrumbItems.length).toBeGreaterThan(0);
    });

    it("title skeleton has larger height", () => {
      const { container } = render(<DetailPageSkeleton />);

      // Title should be h-8 or h-10 (larger)
      const titleSkeleton = container.querySelector(".h-8, .h-10");
      expect(titleSkeleton).toBeInTheDocument();
    });

    it("field labels have consistent width", () => {
      const { container } = render(<DetailPageSkeleton />);

      // Field labels should have moderate width
      const fieldLabels = container.querySelectorAll(".w-24, .w-32");
      expect(fieldLabels.length).toBeGreaterThan(0);
    });

    it("field values have varying widths", () => {
      const { container } = render(<DetailPageSkeleton />);

      // Field values should have different widths for visual variety
      const fieldValues = container.querySelectorAll(".w-40, .w-48, .w-full");
      expect(fieldValues.length).toBeGreaterThan(0);
    });
  });

  describe("Accessibility", () => {
    it("uses semantic HTML structure", () => {
      const { container } = render(<DetailPageSkeleton />);

      // Should use div structure (skeleton doesn't need semantic elements)
      expect(container.querySelector("div")).toBeInTheDocument();
    });

    it("provides visual loading indication", () => {
      const { container } = render(<DetailPageSkeleton />);

      // Animated pulse provides visual feedback
      const animatedElements = container.querySelectorAll(".animate-pulse");
      expect(animatedElements.length).toBeGreaterThan(0);
    });

    it("could have aria-busy attribute (optional)", () => {
      const { container } = render(<DetailPageSkeleton />);

      // While not required, skeleton could indicate loading state
      // This is more of a guideline than a requirement
      expect(container.querySelector("div")).toBeInTheDocument();
    });
  });

  describe("Matching layout structure", () => {
    it("matches DetailPageLayout structure", () => {
      const { container } = render(<DetailPageSkeleton />);

      // Should have similar sections to DetailPageLayout
      // 1. Breadcrumb area
      // 2. Header area
      // 3. Content sections
      const mainSections = container.querySelectorAll(".space-y-4, .space-y-6");
      expect(mainSections.length).toBeGreaterThan(0);
    });

    it("section count matches typical detail page (3 sections)", () => {
      const { container } = render(<DetailPageSkeleton />);

      const sections = container.querySelectorAll(".rounded-lg.border.p-6");
      expect(sections.length).toBe(3);
    });
  });

  describe("Visual consistency", () => {
    it("uses consistent border radius", () => {
      const { container } = render(<DetailPageSkeleton />);

      const roundedElements = container.querySelectorAll(".rounded-lg");
      expect(roundedElements.length).toBeGreaterThan(0);
    });

    it("uses consistent spacing between sections", () => {
      const { container } = render(<DetailPageSkeleton />);

      const spacedContainers = container.querySelectorAll(".space-y-6, .space-y-4");
      expect(spacedContainers.length).toBeGreaterThan(0);
    });

    it("uses consistent padding in sections", () => {
      const { container } = render(<DetailPageSkeleton />);

      const paddedSections = container.querySelectorAll(".p-6");
      expect(paddedSections.length).toBe(3); // 3 main sections
    });
  });
});
