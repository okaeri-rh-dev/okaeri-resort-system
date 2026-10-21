import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PricingStatusBadge, PricingStatusIcon } from "../PricingStatusBadge";

describe("PricingStatusBadge", () => {
  describe("Rendering Behavior", () => {
    it("should render null when no notice and not loading", () => {
      const { container } = render(<PricingStatusBadge notice={null} isLoading={false} />);
      expect(container.firstChild).toBeNull();
    });

    it("should render loading state when isLoading is true", () => {
      render(<PricingStatusBadge notice={null} isLoading={true} />);
      expect(screen.getByText("Calculating pricing...")).toBeInTheDocument();
    });

    it("should render loading state with a spinner", () => {
      const { container } = render(<PricingStatusBadge notice={null} isLoading={true} />);
      expect(container.querySelector('[data-tone="neutral"] .animate-spin')).toBeInTheDocument();
    });

    it("should render notice when provided", () => {
      render(<PricingStatusBadge notice="Regular pricing" />);
      expect(screen.getByText("Regular pricing")).toBeInTheDocument();
    });
  });

  describe("Seasonal Rate Detection - Increase", () => {
    it("should render increase badge for peak season", () => {
      const { container } = render(
        <PricingStatusBadge notice="Seasonal rates applied (Peak Summer)" />
      );
      expect(screen.getByText("Seasonal rates applied (Peak Summer)")).toBeInTheDocument();

      const badge = container.querySelector('[data-tone="warning"]');
      expect(badge).toBeInTheDocument();
    });

    it("should render increase badge for high season", () => {
      const { container } = render(<PricingStatusBadge notice="High season rates in effect" />);

      const badge = container.querySelector('[data-tone="warning"]');
      expect(badge).toBeInTheDocument();
    });

    it("should render increase badge for Christmas", () => {
      const { container } = render(
        <PricingStatusBadge notice="Seasonal rates applied (Christmas & New Year)" />
      );

      const badge = container.querySelector('[data-tone="warning"]');
      expect(badge).toBeInTheDocument();
    });

    it("should render increase badge for holiday", () => {
      const { container } = render(<PricingStatusBadge notice="Holiday pricing in effect" />);

      const badge = container.querySelector('[data-tone="warning"]');
      expect(badge).toBeInTheDocument();
    });

    it("should show TrendingUp icon for increase", () => {
      const { container } = render(
        <PricingStatusBadge notice="Seasonal rates applied (Peak Summer)" />
      );

      // TrendingUp icon should be present
      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });
  });

  describe("Seasonal Rate Detection - Decrease", () => {
    it("should render decrease badge for low season", () => {
      const { container } = render(<PricingStatusBadge notice="Low season discount applied" />);

      const badge = container.querySelector('[data-tone="success"]');
      expect(badge).toBeInTheDocument();
    });

    it("should render decrease badge for discount", () => {
      const { container } = render(<PricingStatusBadge notice="Special discount pricing" />);

      const badge = container.querySelector('[data-tone="success"]');
      expect(badge).toBeInTheDocument();
    });

    it("should render decrease badge for off-season", () => {
      const { container } = render(<PricingStatusBadge notice="Off-season rates available" />);

      const badge = container.querySelector('[data-tone="success"]');
      expect(badge).toBeInTheDocument();
    });

    it("should show TrendingDown icon for decrease", () => {
      const { container } = render(<PricingStatusBadge notice="Low season discount applied" />);

      // TrendingDown icon should be present
      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });
  });

  describe("Neutral Pricing", () => {
    it("should render outline variant for neutral pricing", () => {
      render(<PricingStatusBadge notice="Standard rates apply" />);

      expect(screen.getByText("Standard rates apply")).toBeInTheDocument();
    });

    it("should use the neutral tone for neutral pricing", () => {
      const { container } = render(<PricingStatusBadge notice="Standard rates" />);

      expect(container.querySelector('[data-tone="neutral"]')).toBeInTheDocument();
      expect(container.querySelector('[data-tone="warning"]')).not.toBeInTheDocument();
      expect(container.querySelector('[data-tone="success"]')).not.toBeInTheDocument();
    });
  });

  describe("Custom Styling", () => {
    it("should apply custom className", () => {
      const { container } = render(<PricingStatusBadge notice="Test notice" className="mt-2" />);

      const badge = container.querySelector(".mt-2");
      expect(badge).toBeInTheDocument();
    });

    it("should merge custom className with default classes", () => {
      const { container } = render(<PricingStatusBadge notice="Peak Summer" className="mt-2" />);

      const badge = container.querySelector('.mt-2[data-tone="warning"]');
      expect(badge).toBeInTheDocument();
    });
  });

  describe("Case Insensitive Detection", () => {
    it("should detect PEAK in uppercase", () => {
      const { container } = render(<PricingStatusBadge notice="PEAK SUMMER SEASON" />);

      const badge = container.querySelector('[data-tone="warning"]');
      expect(badge).toBeInTheDocument();
    });

    it("should detect Low in mixed case", () => {
      const { container } = render(<PricingStatusBadge notice="Low Season Discount" />);

      const badge = container.querySelector('[data-tone="success"]');
      expect(badge).toBeInTheDocument();
    });

    it("should detect christmas in any case", () => {
      const { container } = render(<PricingStatusBadge notice="Christmas Special" />);

      const badge = container.querySelector('[data-tone="warning"]');
      expect(badge).toBeInTheDocument();
    });
  });
});

describe("PricingStatusIcon", () => {
  describe("Rendering Behavior", () => {
    it("should render null when no notice and not loading", () => {
      const { container } = render(<PricingStatusIcon notice={null} isLoading={false} />);
      expect(container.firstChild).toBeNull();
    });

    it("should render loading spinner when isLoading is true", () => {
      const { container } = render(<PricingStatusIcon notice={null} isLoading={true} />);
      const spinner = container.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });

    it("should render icon when notice is provided", () => {
      const { container } = render(<PricingStatusIcon notice="Regular pricing" />);
      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });
  });

  describe("Icon Type Detection", () => {
    it("should render TrendingUp icon for peak season", () => {
      const { container } = render(<PricingStatusIcon notice="Peak summer rates" />);

      const icon = container.querySelector(".text-warning-foreground");
      expect(icon).toBeInTheDocument();
    });

    it("should render TrendingUp icon for high season", () => {
      const { container } = render(<PricingStatusIcon notice="High season pricing" />);

      const icon = container.querySelector(".text-warning-foreground");
      expect(icon).toBeInTheDocument();
    });

    it("should render TrendingDown icon for low season", () => {
      const { container } = render(<PricingStatusIcon notice="Low season discount" />);

      const icon = container.querySelector(".text-success-foreground");
      expect(icon).toBeInTheDocument();
    });

    it("should render TrendingDown icon for discount", () => {
      const { container } = render(<PricingStatusIcon notice="Special discount" />);

      const icon = container.querySelector(".text-success-foreground");
      expect(icon).toBeInTheDocument();
    });

    it("should render neutral icon for standard pricing", () => {
      const { container } = render(<PricingStatusIcon notice="Standard rates" />);

      // Should have muted color for neutral
      const icon = container.querySelector(".text-muted-foreground");
      expect(icon).toBeInTheDocument();
    });
  });

  describe("Title Attribute", () => {
    it("should show notice in title attribute", () => {
      const { container } = render(<PricingStatusIcon notice="Peak summer rates applied" />);

      const icon = container.querySelector('[title="Peak summer rates applied"]');
      expect(icon).toBeInTheDocument();
    });

    it("should render null when notice is empty string", () => {
      // Empty string is treated as falsy, so component returns null
      const { container } = render(<PricingStatusIcon notice="" />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe("Custom Styling", () => {
    it("should apply custom className", () => {
      const { container } = render(<PricingStatusIcon notice="Test notice" className="mt-2" />);

      const icon = container.querySelector(".mt-2");
      expect(icon).toBeInTheDocument();
    });

    it("should merge custom className with color classes", () => {
      const { container } = render(<PricingStatusIcon notice="Peak Summer" className="mt-2" />);

      const icon = container.querySelector(".mt-2.text-warning-foreground");
      expect(icon).toBeInTheDocument();
    });
  });

  describe("Loading State", () => {
    it("should show muted spinner when loading", () => {
      const { container } = render(<PricingStatusIcon notice={null} isLoading={true} />);

      const spinner = container.querySelector(".animate-spin.text-muted-foreground");
      expect(spinner).toBeInTheDocument();
    });

    it("should ignore notice when loading", () => {
      const { container } = render(<PricingStatusIcon notice="Peak Summer" isLoading={true} />);

      // Should show spinner, not the peak summer icon color
      const spinner = container.querySelector(".animate-spin");
      const increaseIcon = container.querySelector(".text-warning-foreground");

      expect(spinner).toBeInTheDocument();
      expect(increaseIcon).not.toBeInTheDocument();
    });
  });

  describe("Case Insensitive Detection", () => {
    it("should detect PEAK in uppercase", () => {
      const { container } = render(<PricingStatusIcon notice="PEAK SEASON" />);

      const icon = container.querySelector(".text-warning-foreground");
      expect(icon).toBeInTheDocument();
    });

    it("should detect low in lowercase", () => {
      const { container } = render(<PricingStatusIcon notice="low season" />);

      const icon = container.querySelector(".text-success-foreground");
      expect(icon).toBeInTheDocument();
    });
  });
});
