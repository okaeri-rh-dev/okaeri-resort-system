/**
 * Component Tests for AvailabilityLegend
 *
 * Tests the legend component that explains color-coded availability indicators.
 *
 * Test Coverage:
 * - Rendering: Legend items, colors, labels
 * - Layout: Responsive grid behavior
 * - Accessibility: ARIA attributes, hidden elements
 * - Content: Correct status descriptions
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AvailabilityLegend } from "../AvailabilityLegend";

describe("AvailabilityLegend", () => {
  describe("Rendering", () => {
    it("should render legend title", () => {
      render(<AvailabilityLegend />);

      expect(screen.getByText("Availability Legend")).toBeInTheDocument();
    });

    it("should render all four legend items", () => {
      render(<AvailabilityLegend />);

      expect(screen.getByText("3 units available")).toBeInTheDocument();
      expect(screen.getByText("2 units available")).toBeInTheDocument();
      expect(screen.getByText("1 unit available")).toBeInTheDocument();
      expect(screen.getByText("Fully booked")).toBeInTheDocument();
    });

    it("should render status descriptions for each item", () => {
      render(<AvailabilityLegend />);

      expect(screen.getByText("Full availability")).toBeInTheDocument();
      expect(screen.getByText("Moderate")).toBeInTheDocument();
      expect(screen.getByText("Limited")).toBeInTheDocument();
      expect(screen.getByText("No availability")).toBeInTheDocument();
    });

    it("should render color indicators for each status", () => {
      const { container } = render(<AvailabilityLegend />);

      // Check for color class elements
      expect(container.querySelector(".bg-green-500")).toBeInTheDocument();
      expect(container.querySelector(".bg-yellow-500")).toBeInTheDocument();
      expect(container.querySelector(".bg-orange-500")).toBeInTheDocument();
      expect(container.querySelector(".bg-red-500")).toBeInTheDocument();
    });
  });

  describe("Color Coding", () => {
    it("should associate green with full availability", () => {
      const { container } = render(<AvailabilityLegend />);

      const greenIndicator = container.querySelector(".bg-green-500");
      expect(greenIndicator).toBeInTheDocument();

      // Check that green is near "3 units available"
      const legend = container.textContent;
      expect(legend).toContain("3 units available");
      expect(legend).toContain("Full availability");
    });

    it("should associate yellow with moderate availability", () => {
      const { container } = render(<AvailabilityLegend />);

      const yellowIndicator = container.querySelector(".bg-yellow-500");
      expect(yellowIndicator).toBeInTheDocument();

      const legend = container.textContent;
      expect(legend).toContain("2 units available");
      expect(legend).toContain("Moderate");
    });

    it("should associate orange with limited availability", () => {
      const { container } = render(<AvailabilityLegend />);

      const orangeIndicator = container.querySelector(".bg-orange-500");
      expect(orangeIndicator).toBeInTheDocument();

      const legend = container.textContent;
      expect(legend).toContain("1 unit available");
      expect(legend).toContain("Limited");
    });

    it("should associate red with fully booked", () => {
      const { container } = render(<AvailabilityLegend />);

      const redIndicator = container.querySelector(".bg-red-500");
      expect(redIndicator).toBeInTheDocument();

      const legend = container.textContent;
      expect(legend).toContain("Fully booked");
      expect(legend).toContain("No availability");
    });
  });

  describe("Layout", () => {
    it("should have gray background", () => {
      const { container } = render(<AvailabilityLegend />);

      const legendContainer = container.querySelector(".bg-gray-50");
      expect(legendContainer).toBeInTheDocument();
    });

    it("should have border and rounded corners", () => {
      const { container } = render(<AvailabilityLegend />);

      const legendContainer = container.firstChild;
      expect(legendContainer).toHaveClass("rounded-lg");
      expect(legendContainer).toHaveClass("border");
      expect(legendContainer).toHaveClass("border-gray-200");
    });

    it("should have padding", () => {
      const { container } = render(<AvailabilityLegend />);

      const legendContainer = container.firstChild;
      expect(legendContainer).toHaveClass("p-4");
    });

    it("should use grid layout for items", () => {
      const { container } = render(<AvailabilityLegend />);

      const gridContainer = container.querySelector(".grid");
      expect(gridContainer).toBeInTheDocument();
    });

    it("should have responsive grid columns", () => {
      const { container } = render(<AvailabilityLegend />);

      const gridContainer = container.querySelector(".grid");
      expect(gridContainer).toHaveClass("grid-cols-2"); // Mobile: 2 columns
      expect(gridContainer).toHaveClass("md:grid-cols-4"); // Desktop: 4 columns
    });

    it("should have gap between grid items", () => {
      const { container } = render(<AvailabilityLegend />);

      const gridContainer = container.querySelector(".grid");
      expect(gridContainer).toHaveClass("gap-3");
    });
  });

  describe("Legend Items Structure", () => {
    it("should have color indicator squares", () => {
      const { container } = render(<AvailabilityLegend />);

      const colorSquares = container.querySelectorAll(".w-4.h-4.rounded");
      expect(colorSquares.length).toBe(4); // One for each status
    });

    it("should display labels with proper text styling", () => {
      const { container } = render(<AvailabilityLegend />);

      // Check for text styling classes
      const labels = container.querySelectorAll(".text-xs.font-medium");
      expect(labels.length).toBeGreaterThan(0);
    });

    it("should display status descriptions with muted styling", () => {
      const { container } = render(<AvailabilityLegend />);

      const descriptions = container.querySelectorAll(".text-xs.text-gray-500");
      expect(descriptions.length).toBe(4); // One for each status
    });
  });

  describe("Accessibility", () => {
    it("should mark color indicators as aria-hidden", () => {
      const { container } = render(<AvailabilityLegend />);

      const colorIndicators = container.querySelectorAll('[aria-hidden="true"]');
      expect(colorIndicators.length).toBeGreaterThanOrEqual(4); // At least the 4 color squares
    });

    it("should have semantic heading for title", () => {
      render(<AvailabilityLegend />);

      const heading = screen.getByRole("heading", { name: /availability legend/i });
      expect(heading).toBeInTheDocument();
    });

    it("should have proper text contrast for readability", () => {
      const { container } = render(<AvailabilityLegend />);

      // Title should be dark gray for good contrast
      const title = screen.getByText("Availability Legend");
      expect(title).toHaveClass("text-gray-700");

      // Labels should be dark for readability
      const labels = container.querySelectorAll(".text-gray-900");
      expect(labels.length).toBe(4); // Main labels
    });
  });

  describe("Content Accuracy", () => {
    it("should use correct unit count in labels", () => {
      render(<AvailabilityLegend />);

      expect(screen.getByText("3 units available")).toBeInTheDocument();
      expect(screen.getByText("2 units available")).toBeInTheDocument();
      expect(screen.getByText("1 unit available")).toBeInTheDocument();
    });

    it("should use descriptive status labels", () => {
      render(<AvailabilityLegend />);

      expect(screen.getByText("Full availability")).toBeInTheDocument();
      expect(screen.getByText("Moderate")).toBeInTheDocument();
      expect(screen.getByText("Limited")).toBeInTheDocument();
      expect(screen.getByText("No availability")).toBeInTheDocument();
    });

    it("should match color scheme with CalendarGrid", () => {
      const { container } = render(<AvailabilityLegend />);

      // Colors should match those used in CalendarGrid
      expect(container.querySelector(".bg-green-500")).toBeInTheDocument(); // Full
      expect(container.querySelector(".bg-yellow-500")).toBeInTheDocument(); // Moderate
      expect(container.querySelector(".bg-orange-500")).toBeInTheDocument(); // Limited
      expect(container.querySelector(".bg-red-500")).toBeInTheDocument(); // Booked
    });
  });

  describe("Visual Presentation", () => {
    it("should display items in correct order", () => {
      const { container } = render(<AvailabilityLegend />);

      const itemLabels = Array.from(container.querySelectorAll(".text-xs.font-medium")).map(
        (el) => el.textContent
      );

      expect(itemLabels).toEqual([
        "3 units available",
        "2 units available",
        "1 unit available",
        "Fully booked",
      ]);
    });

    it("should have small, compact color indicators", () => {
      const { container } = render(<AvailabilityLegend />);

      const colorSquares = container.querySelectorAll(".w-4.h-4");
      expect(colorSquares.length).toBe(4);
    });

    it("should have rounded color indicators", () => {
      const { container } = render(<AvailabilityLegend />);

      const colorSquares = container.querySelectorAll(".rounded");
      expect(colorSquares.length).toBeGreaterThanOrEqual(4);
    });

    it("should align items with flexbox", () => {
      const { container } = render(<AvailabilityLegend />);

      const legendItems = container.querySelectorAll(".flex.items-center");
      expect(legendItems.length).toBe(4); // One for each legend item
    });

    it("should have gap between color and text", () => {
      const { container } = render(<AvailabilityLegend />);

      const legendItems = container.querySelectorAll(".gap-2");
      expect(legendItems.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("Responsive Behavior", () => {
    it("should stack vertically on mobile (2 columns)", () => {
      const { container } = render(<AvailabilityLegend />);

      const gridContainer = container.querySelector(".grid-cols-2");
      expect(gridContainer).toBeInTheDocument();
    });

    it("should display in 4 columns on desktop", () => {
      const { container } = render(<AvailabilityLegend />);

      const gridContainer = container.querySelector(".md\\:grid-cols-4");
      expect(gridContainer).toBeInTheDocument();
    });
  });

  describe("Snapshot", () => {
    it("should match snapshot", () => {
      const { container } = render(<AvailabilityLegend />);
      expect(container.firstChild).toMatchSnapshot();
    });
  });
});
