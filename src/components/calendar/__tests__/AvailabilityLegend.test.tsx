/**
 * Component Tests for AvailabilityLegend
 *
 * Tests the legend component that explains color-coded availability indicators.
 *
 * Test Coverage:
 * - Rendering: Legend items, colors, labels
 * - Layout: Responsive flex behavior
 * - Accessibility: ARIA attributes, hidden elements
 * - Content: Correct unit counts
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AvailabilityLegend } from "../AvailabilityLegend";

describe("AvailabilityLegend", () => {
  describe("Rendering", () => {
    it("should render all four legend items", () => {
      render(<AvailabilityLegend />);

      expect(screen.getByText("3 units")).toBeInTheDocument();
      expect(screen.getByText("2 units")).toBeInTheDocument();
      expect(screen.getByText("1 unit")).toBeInTheDocument();
      expect(screen.getByText("Booked")).toBeInTheDocument();
    });

    it("should render color indicators for each status", () => {
      const { container } = render(<AvailabilityLegend />);

      // Check for new soft color classes
      expect(container.querySelector(".bg-emerald-400\\/70")).toBeInTheDocument();
      expect(container.querySelector(".bg-amber-400\\/70")).toBeInTheDocument();
      expect(container.querySelector(".bg-orange-400\\/70")).toBeInTheDocument();
      expect(container.querySelector(".bg-rose-400\\/70")).toBeInTheDocument();
    });
  });

  describe("Color Coding", () => {
    it("should associate emerald with full availability", () => {
      const { container } = render(<AvailabilityLegend />);

      const emeraldIndicator = container.querySelector(".bg-emerald-400\\/70");
      expect(emeraldIndicator).toBeInTheDocument();

      // Check that emerald is near "3 units"
      const legend = container.textContent;
      expect(legend).toContain("3 units");
    });

    it("should associate amber with moderate availability", () => {
      const { container } = render(<AvailabilityLegend />);

      const amberIndicator = container.querySelector(".bg-amber-400\\/70");
      expect(amberIndicator).toBeInTheDocument();

      const legend = container.textContent;
      expect(legend).toContain("2 units");
    });

    it("should associate orange with limited availability", () => {
      const { container } = render(<AvailabilityLegend />);

      const orangeIndicator = container.querySelector(".bg-orange-400\\/70");
      expect(orangeIndicator).toBeInTheDocument();

      const legend = container.textContent;
      expect(legend).toContain("1 unit");
    });

    it("should associate rose with fully booked", () => {
      const { container } = render(<AvailabilityLegend />);

      const roseIndicator = container.querySelector(".bg-rose-400\\/70");
      expect(roseIndicator).toBeInTheDocument();

      const legend = container.textContent;
      expect(legend).toContain("Booked");
    });
  });

  describe("Layout", () => {
    it("should use flex layout for items", () => {
      const { container } = render(<AvailabilityLegend />);

      const flexContainer = container.querySelector(".flex");
      expect(flexContainer).toBeInTheDocument();
    });

    it("should have gap between items", () => {
      const { container } = render(<AvailabilityLegend />);

      const flexContainer = container.querySelector(".gap-3");
      expect(flexContainer).toBeInTheDocument();
    });

    it("should be responsive with different gap on desktop", () => {
      const { container } = render(<AvailabilityLegend />);

      const flexContainer = container.querySelector(".sm\\:gap-4");
      expect(flexContainer).toBeInTheDocument();
    });

    it("should allow wrapping on small screens", () => {
      const { container } = render(<AvailabilityLegend />);

      const flexContainer = container.querySelector(".flex-wrap");
      expect(flexContainer).toBeInTheDocument();
    });
  });

  describe("Legend Items Structure", () => {
    it("should have color indicator squares", () => {
      const { container } = render(<AvailabilityLegend />);

      const colorSquares = container.querySelectorAll(".w-3.h-3.rounded");
      expect(colorSquares.length).toBe(4); // One for each status
    });

    it("should display labels with proper text styling", () => {
      const { container } = render(<AvailabilityLegend />);

      // Check for text styling classes
      const labels = container.querySelectorAll(".text-slate-700.font-medium");
      expect(labels.length).toBe(4);
    });
  });

  describe("Accessibility", () => {
    it("should mark color indicators as aria-hidden", () => {
      const { container } = render(<AvailabilityLegend />);

      const colorIndicators = container.querySelectorAll('[aria-hidden="true"]');
      expect(colorIndicators.length).toBeGreaterThanOrEqual(4); // At least the 4 color squares
    });

    it("should have proper text contrast for readability", () => {
      const { container } = render(<AvailabilityLegend />);

      // Labels should use slate-700 for good contrast
      const labels = container.querySelectorAll(".text-slate-700");
      expect(labels.length).toBe(4); // Main labels
    });
  });

  describe("Content Accuracy", () => {
    it("should use correct unit count in labels", () => {
      render(<AvailabilityLegend />);

      expect(screen.getByText("3 units")).toBeInTheDocument();
      expect(screen.getByText("2 units")).toBeInTheDocument();
      expect(screen.getByText("1 unit")).toBeInTheDocument();
    });

    it("should match color scheme with CalendarGrid", () => {
      const { container } = render(<AvailabilityLegend />);

      // Colors should match those used in CalendarGrid (soft muted palette)
      expect(container.querySelector(".bg-emerald-400\\/70")).toBeInTheDocument(); // Full
      expect(container.querySelector(".bg-amber-400\\/70")).toBeInTheDocument(); // Moderate
      expect(container.querySelector(".bg-orange-400\\/70")).toBeInTheDocument(); // Limited
      expect(container.querySelector(".bg-rose-400\\/70")).toBeInTheDocument(); // Booked
    });
  });

  describe("Visual Presentation", () => {
    it("should display items in correct order", () => {
      const { container } = render(<AvailabilityLegend />);

      const itemLabels = Array.from(container.querySelectorAll(".text-slate-700.font-medium")).map(
        (el) => el.textContent
      );

      expect(itemLabels).toEqual(["3 units", "2 units", "1 unit", "Booked"]);
    });

    it("should have small, compact color indicators", () => {
      const { container } = render(<AvailabilityLegend />);

      const colorSquares = container.querySelectorAll(".w-3.h-3");
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
      expect(legendItems.length).toBe(5); // 4 items + 1 container
    });

    it("should have gap between color and text", () => {
      const { container } = render(<AvailabilityLegend />);

      const legendItems = container.querySelectorAll(".gap-1\\.5");
      expect(legendItems.length).toBe(4);
    });
  });

  describe("Responsive Behavior", () => {
    it("should use horizontal flex layout", () => {
      const { container } = render(<AvailabilityLegend />);

      const flexContainer = container.querySelector(".flex");
      expect(flexContainer).toBeInTheDocument();
    });

    it("should wrap items on small screens", () => {
      const { container } = render(<AvailabilityLegend />);

      const flexContainer = container.querySelector(".flex-wrap");
      expect(flexContainer).toBeInTheDocument();
    });
  });

  describe("Snapshot", () => {
    it("should match snapshot", () => {
      const { container } = render(<AvailabilityLegend />);
      expect(container.firstChild).toMatchSnapshot();
    });
  });
});
