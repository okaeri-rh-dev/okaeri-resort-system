/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { MultiUnitSelector } from "../MultiUnitSelector";
import type { Unit } from "@/types";
import type { BookingUnit } from "@/types/multi-unit-booking";

expect.extend(toHaveNoViolations);

// ============================================
// MOCK DATA
// ============================================

const mockUnits: Unit[] = [
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
    unit_status: "Available",
    amenities: null,
    created_at: null,
    updated_at: null,
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
    unit_status: "Available",
    amenities: null,
    created_at: null,
    updated_at: null,
  },
  {
    unit_id: "unit-3",
    unit_name: "Standard Cabin",
    unit_code: "SC301",
    unit_type: "Standard",
    base_occupancy: 2,
    max_occupancy: 3,
    base_rate: 2000,
    weekend_rate: 2200,
    extra_person_rate: 400,
    unit_status: "Occupied",
    amenities: null,
    created_at: null,
    updated_at: null,
  },
  {
    unit_id: "unit-4",
    unit_name: "Deluxe Cabin",
    unit_code: "DX401",
    unit_type: "Deluxe",
    base_occupancy: 2,
    max_occupancy: 4,
    base_rate: 2800,
    weekend_rate: 3200,
    extra_person_rate: 450,
    unit_status: "Available",
    amenities: null,
    created_at: null,
    updated_at: null,
  },
];

const mockSelectedUnits: BookingUnit[] = [
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
      extra_person_fee: 0,
      unit_total: 6500,
    },
    availability: {
      is_available: true,
      checking: false,
    },
  },
];

// ============================================
// TESTS
// ============================================

describe("MultiUnitSelector", () => {
  const mockOnAddUnit = vi.fn();
  const mockOnRemoveUnit = vi.fn();
  const mockOnViewDetails = vi.fn();

  const defaultProps = {
    units: mockUnits,
    selectedUnits: [],
    checkIn: "2025-12-20",
    checkOut: "2025-12-22",
    onAddUnit: mockOnAddUnit,
    onRemoveUnit: mockOnRemoveUnit,
    onViewDetails: mockOnViewDetails,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========== RENDERING TESTS ==========

  describe("Rendering", () => {
    it("renders without crashing", () => {
      render(<MultiUnitSelector {...defaultProps} />);
      expect(screen.getByText("Select Units")).toBeInTheDocument();
    });

    it("displays all available units", () => {
      render(<MultiUnitSelector {...defaultProps} />);
      // Component shows all units (including unavailable ones with visual indicators)
      const unitCards = screen.getAllByRole("article");
      expect(unitCards).toHaveLength(mockUnits.length);
    });

    it("shows selected units count", () => {
      render(<MultiUnitSelector {...defaultProps} selectedUnits={mockSelectedUnits} />);
      expect(screen.getByText("1 of 10 units selected")).toBeInTheDocument();
    });

    it("displays loading state", () => {
      render(<MultiUnitSelector {...defaultProps} isLoading={true} />);
      // Loading state hides the unit list
      const unitList = screen.queryByRole("list", { name: "Available units" });
      expect(unitList).not.toBeInTheDocument();
    });

    it("displays error message", () => {
      const errorMessage = "Failed to load units";
      render(<MultiUnitSelector {...defaultProps} error={errorMessage} />);
      expect(screen.getByRole("alert")).toHaveTextContent(errorMessage);
    });

    it("shows empty state when no units match filters", () => {
      render(<MultiUnitSelector {...defaultProps} units={[]} />);
      expect(screen.getByText("No units match your filters")).toBeInTheDocument();
    });
  });

  // ========== VIEW MODE TESTS ==========

  describe("View Mode Toggle", () => {
    it("defaults to grid view", () => {
      render(<MultiUnitSelector {...defaultProps} />);
      const gridButton = screen.getByLabelText("Grid view");
      const listButton = screen.getByLabelText("List view");
      // Grid button should have primary colors (active), list should have outline colors
      expect(gridButton).toHaveClass("bg-primary");
      expect(listButton).not.toHaveClass("bg-primary");
    });

    it("switches to list view", async () => {
      const user = userEvent.setup();
      render(<MultiUnitSelector {...defaultProps} />);

      const listButton = screen.getByLabelText("List view");
      await user.click(listButton);

      expect(listButton).toHaveClass("bg-primary");
    });

    it("switches back to grid view", async () => {
      const user = userEvent.setup();
      render(<MultiUnitSelector {...defaultProps} viewMode="list" />);

      const gridButton = screen.getByLabelText("Grid view");
      await user.click(gridButton);

      expect(gridButton).toHaveClass("bg-primary");
    });
  });

  // ========== FILTER TESTS ==========

  describe("Filtering", () => {
    it("filters by unit type", async () => {
      const user = userEvent.setup();
      render(<MultiUnitSelector {...defaultProps} />);

      // Open unit type filter
      const typeFilter = screen.getByLabelText("Filter by unit type");
      await user.click(typeFilter);

      // Select Suite
      const suiteOption = screen.getByText("Suite");
      await user.click(suiteOption);

      // Should show only Suite units
      const unitCards = screen.getAllByRole("article");
      expect(unitCards).toHaveLength(1); // Only Ocean View Suite
    });

    it("filters by max occupancy", async () => {
      const user = userEvent.setup();
      render(<MultiUnitSelector {...defaultProps} />);

      const occupancyFilter = screen.getByLabelText("Filter by occupancy");
      await user.click(occupancyFilter);

      const option = screen.getByText("4+ guests");
      await user.click(option);

      // Should show units with max_occupancy >= 4
      const unitCards = screen.getAllByRole("article");
      expect(unitCards.length).toBeGreaterThan(0);
    });

    it("filters by max price", async () => {
      const user = userEvent.setup();
      render(<MultiUnitSelector {...defaultProps} />);

      const priceFilter = screen.getByLabelText("Filter by max price");
      await user.click(priceFilter);

      const option = screen.getByText("Under ₱3,000");
      await user.click(option);

      // Should show units with base_rate <= 3000
      const unitCards = screen.getAllByRole("article");
      expect(unitCards.length).toBeGreaterThan(0);
    });

    it("shows clear filters button when filters are active", async () => {
      const user = userEvent.setup();
      render(<MultiUnitSelector {...defaultProps} />);

      const typeFilter = screen.getByLabelText("Filter by unit type");
      await user.click(typeFilter);
      const suiteOption = screen.getByText("Suite");
      await user.click(suiteOption);

      expect(screen.getByText("Clear Filters")).toBeInTheDocument();
    });

    it("clears all filters", async () => {
      const user = userEvent.setup();
      render(<MultiUnitSelector {...defaultProps} />);

      // Apply filter
      const typeFilter = screen.getByLabelText("Filter by unit type");
      await user.click(typeFilter);
      const suiteOption = screen.getByText("Suite");
      await user.click(suiteOption);

      // Clear filters
      const clearButton = screen.getByText("Clear Filters");
      await user.click(clearButton);

      // Should show all units again
      const unitCards = screen.getAllByRole("article");
      const availableUnits = mockUnits.filter((u) => u.unit_status === "Available");
      expect(unitCards).toHaveLength(availableUnits.length);
    });
  });

  // ========== UNIT SELECTION TESTS ==========

  describe("Unit Selection", () => {
    it("calls onAddUnit when adding a unit", async () => {
      const user = userEvent.setup();
      render(<MultiUnitSelector {...defaultProps} />);

      const addButtons = screen.getAllByText("Add to Booking");
      await user.click(addButtons[0]);

      expect(mockOnAddUnit).toHaveBeenCalledTimes(1);
      expect(mockOnAddUnit).toHaveBeenCalledWith(
        expect.objectContaining({
          unit_id: mockUnits[0].unit_id,
        })
      );
    });

    it("shows selected badge on selected units", () => {
      render(<MultiUnitSelector {...defaultProps} selectedUnits={mockSelectedUnits} />);
      expect(screen.getByText("Selected")).toBeInTheDocument();
    });

    it("shows Remove button for selected units", () => {
      render(<MultiUnitSelector {...defaultProps} selectedUnits={mockSelectedUnits} />);
      const removeButton = screen.getByText("Remove");
      expect(removeButton).toBeInTheDocument();
    });

    it("calls onRemoveUnit when removing a unit", async () => {
      const user = userEvent.setup();
      render(<MultiUnitSelector {...defaultProps} selectedUnits={mockSelectedUnits} />);

      const removeButton = screen.getByText("Remove");
      await user.click(removeButton);

      expect(mockOnRemoveUnit).toHaveBeenCalledWith("unit-1");
    });

    it("disables Add button when max units reached", () => {
      const maxedOutUnits = Array.from({ length: 10 }, (_, i) => ({
        ...mockSelectedUnits[0],
        unit_id: `unit-${i}`,
      }));

      render(<MultiUnitSelector {...defaultProps} selectedUnits={maxedOutUnits} maxUnits={10} />);

      const addButtons = screen.queryAllByText("Add to Booking");
      addButtons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });

    it("disables Add button for unavailable units", () => {
      render(<MultiUnitSelector {...defaultProps} />);

      // Find the Occupied unit card
      const occupiedCard = screen.getByText("Standard Cabin").closest('[role="article"]');
      const addButton = within(occupiedCard!).getByRole("button", {
        name: /add.*to booking/i,
      });

      expect(addButton).toBeDisabled();
    });
  });

  // ========== DETAILS VIEW TESTS ==========

  describe("Details View", () => {
    it("calls onViewDetails when Details button is clicked", async () => {
      const user = userEvent.setup();
      render(<MultiUnitSelector {...defaultProps} />);

      const detailsButtons = screen.getAllByText("Details");
      await user.click(detailsButtons[0]);

      expect(mockOnViewDetails).toHaveBeenCalledWith("unit-1");
    });
  });

  // ========== ACCESSIBILITY TESTS ==========

  describe("Accessibility", () => {
    it("should have no accessibility violations", async () => {
      const { container } = render(<MultiUnitSelector {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("has proper ARIA labels", () => {
      render(<MultiUnitSelector {...defaultProps} />);

      expect(screen.getByLabelText("Grid view")).toBeInTheDocument();
      expect(screen.getByLabelText("List view")).toBeInTheDocument();
      expect(screen.getByLabelText("Filter by unit type")).toBeInTheDocument();
      expect(screen.getByRole("list", { name: "Available units" })).toBeInTheDocument();
    });

    it("unit cards have descriptive aria-labels", () => {
      render(<MultiUnitSelector {...defaultProps} />);

      const cards = screen.getAllByRole("article");
      expect(cards[0]).toHaveAttribute("aria-label", expect.stringContaining("Ocean View Suite"));
      expect(cards[0]).toHaveAttribute("aria-selected");
    });
  });

  // ========== EDGE CASES ==========

  describe("Edge Cases", () => {
    it("handles empty units array", () => {
      render(<MultiUnitSelector {...defaultProps} units={[]} />);
      expect(screen.getByText("No units match your filters")).toBeInTheDocument();
    });

    it("handles custom maxUnits prop", () => {
      render(<MultiUnitSelector {...defaultProps} maxUnits={5} />);
      expect(screen.getByText("0 of 5 units selected")).toBeInTheDocument();
    });

    it("disables filters when enableFilters is false", () => {
      render(<MultiUnitSelector {...defaultProps} enableFilters={false} />);
      expect(screen.queryByLabelText("Filter by unit type")).not.toBeInTheDocument();
    });

    it("shows date range in unit cards", () => {
      render(<MultiUnitSelector {...defaultProps} />);
      expect(screen.getByText(/12\/20\/2025/)).toBeInTheDocument();
      expect(screen.getByText(/12\/22\/2025/)).toBeInTheDocument();
    });
  });
});
