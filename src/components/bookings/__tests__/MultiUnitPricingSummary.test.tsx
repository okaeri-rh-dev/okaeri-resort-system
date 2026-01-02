/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import type { BookingUnit } from "@/types/multi-unit-booking";

import { MultiUnitPricingSummary } from "../MultiUnitPricingSummary";

const mockUnits: BookingUnit[] = [
  {
    unit_id: "unit-1",
    unit_name: "Ocean View Suite",
    unit_code: "OV101",
    unit_type: "Suite",
    base_occupancy: 2,
    max_occupancy: 4,
    base_rate: 3000,
    weekend_rate: 3500,
    extra_person_rate: 500,
    pricing: {
      nights: 2,
      base_total: 6000,
      weekend_surcharge: 500,
      extra_person_fee: 1000,
      unit_total: 7500,
    },
    availability: { is_available: true, checking: false },
  },
  {
    unit_id: "unit-2",
    unit_name: "Garden Villa",
    unit_code: "GV201",
    unit_type: "Villa",
    base_occupancy: 4,
    max_occupancy: 6,
    base_rate: 5000,
    weekend_rate: 6000,
    extra_person_rate: 800,
    pricing: {
      nights: 2,
      base_total: 10000,
      weekend_surcharge: 2000,
      extra_person_fee: 0,
      unit_total: 12000,
    },
    availability: { is_available: true, checking: false },
  },
];

describe("MultiUnitPricingSummary", () => {
  describe("Rendering", () => {
    it("renders pricing summary title", () => {
      render(<MultiUnitPricingSummary units={mockUnits} />);
      expect(screen.getByText("Pricing Summary")).toBeInTheDocument();
    });

    it("shows per-unit breakdown when multiple units", () => {
      render(<MultiUnitPricingSummary units={mockUnits} showBreakdown={true} />);

      expect(screen.getByText(/Cabin 1: Ocean View Suite/)).toBeInTheDocument();
      expect(screen.getByText(/Cabin 2: Garden Villa/)).toBeInTheDocument();
    });

    it("hides per-unit breakdown when showBreakdown is false", () => {
      render(<MultiUnitPricingSummary units={mockUnits} showBreakdown={false} />);

      expect(screen.queryByText(/Cabin 1:/)).not.toBeInTheDocument();
    });
  });

  describe("Price Calculations", () => {
    it("calculates correct subtotal", () => {
      render(<MultiUnitPricingSummary units={mockUnits} />);
      // 7500 + 12000 = 19500
      const subtotalRow = screen.getByText("Subtotal").parentElement;
      expect(subtotalRow).toHaveTextContent("₱19,500.00");
    });

    it("applies discount correctly", () => {
      render(<MultiUnitPricingSummary units={mockUnits} discount={1950} />);

      expect(screen.getByText("Bulk Discount")).toBeInTheDocument();
      expect(screen.getByText("-₱1,950.00")).toBeInTheDocument();

      // Total: 19500 - 1950 = 17550
      const totalElements = screen.getAllByText(/₱17,550\.00/);
      expect(totalElements.length).toBeGreaterThan(0);
    });

    it("shows correct total without discount", () => {
      render(<MultiUnitPricingSummary units={mockUnits} discount={0} />);

      const totalLabel = screen.getByText("TOTAL");
      expect(totalLabel.parentElement).toHaveTextContent("₱19,500.00");
    });
  });

  describe("Promotional Messages", () => {
    it("shows bulk discount promo when 3+ units and no discount", () => {
      const threeUnits = [...mockUnits, { ...mockUnits[0], unit_id: "unit-3" }];
      render(<MultiUnitPricingSummary units={threeUnits} discount={0} />);

      expect(screen.getByText(/Book 3\+ units to get a bulk discount!/)).toBeInTheDocument();
    });

    it("hides promo when less than 3 units", () => {
      render(<MultiUnitPricingSummary units={mockUnits} discount={0} />);

      expect(screen.queryByText(/Book 3\+ units/)).not.toBeInTheDocument();
    });

    it("shows discount applied message when discount exists", () => {
      render(<MultiUnitPricingSummary units={mockUnits} discount={1950} />);

      expect(screen.getByText(/Bulk discount applied!/)).toBeInTheDocument();
      expect(screen.getByText(/You saved ₱1,950\.00/)).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have no accessibility violations", async () => {
      const { container } = render(<MultiUnitPricingSummary units={mockUnits} />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("has proper ARIA regions and labels", () => {
      render(<MultiUnitPricingSummary units={mockUnits} />);

      expect(screen.getByRole("region", { name: "Pricing summary" })).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles single unit", () => {
      render(<MultiUnitPricingSummary units={[mockUnits[0]]} />);

      const totalRow = screen.getByText("TOTAL").parentElement;
      expect(totalRow).toHaveTextContent("₱7,500.00");
      expect(screen.queryByText(/Cabin 1:/)).not.toBeInTheDocument(); // No breakdown for single unit
    });

    it("handles empty units array", () => {
      render(<MultiUnitPricingSummary units={[]} />);

      const totalRow = screen.getByText("TOTAL").parentElement;
      expect(totalRow).toHaveTextContent("₱0.00");
    });
  });
});
