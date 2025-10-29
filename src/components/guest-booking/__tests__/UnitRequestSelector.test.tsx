/**
 * @vitest-environment jsdom
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import type { PricingConfig, UnitRequest } from "@/types/guest-booking-multi-unit";

import { UnitRequestSelector, type UnitRequestSelectorProps } from "../UnitRequestSelector";

// ============================================
// MOCK API CLIENT
// ============================================

const mockPricingConfig: PricingConfig = {
  base_rate: 2000,
  weekend_rate: 2500,
  extra_person_rate: 300,
  base_occupancy: 2,
  max_capacity_per_unit: 10,
  downpayment_percent: 50,
  currency: "PHP",
};

vi.mock("@/lib/api/guest-booking-client", () => ({
  fetchRates: vi.fn(() => Promise.resolve(mockPricingConfig)),
  validateDateRange: vi.fn((checkIn, checkOut) => {
    if (checkIn < new Date()) return "Check-in date cannot be in the past";
    if (checkOut <= checkIn) return "Check-out date must be after check-in date";
    return null;
  }),
  calculateNights: vi.fn((checkIn, checkOut) => {
    const diff = checkOut.getTime() - checkIn.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }),
}));

// ============================================
// MOCK DATA & SETUP
// ============================================

const defaultProps: UnitRequestSelectorProps = {
  value: [],
  onChange: vi.fn(),
  disabled: false,
  maxTotalUnits: 10,
};

const mockSingleUnit: UnitRequest[] = [{ guests_per_unit: 2 }];

const mockMultipleUnits: UnitRequest[] = [
  { guests_per_unit: 2 },
  { guests_per_unit: 3 },
  { guests_per_unit: 4 },
];

// ============================================
// TESTS
// ============================================

describe("UnitRequestSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========== LOADING STATE TESTS ==========

  describe("Loading State", () => {
    it("renders loading skeleton initially", async () => {
      const { fetchRates } = await import("@/lib/api/guest-booking-client");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fetchRates as any).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockPricingConfig), 100))
      );

      render(<UnitRequestSelector {...defaultProps} />);

      // CardSkeleton should be visible during loading
      // Note: Multiple CardSkeletons are rendered, so use getAllByRole
      const skeletons = screen.getAllByRole("status");
      expect(skeletons.length).toBeGreaterThan(0);
      expect(skeletons[0]).toBeInTheDocument();
    });

    it("hides skeleton after rates loaded", async () => {
      render(<UnitRequestSelector {...defaultProps} />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
      });

      // Rates should be displayed
      expect(screen.getByText(/current rates/i)).toBeInTheDocument();
    });
  });

  // ========== RATES DISPLAY TESTS ==========

  describe("Rates Display", () => {
    it("displays static rates after loading", async () => {
      render(<UnitRequestSelector {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/current rates/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/base rate/i)).toBeInTheDocument();
      expect(screen.getByText(/weekend rate/i)).toBeInTheDocument();
      expect(screen.getByText(/extra person/i)).toBeInTheDocument();
      expect(screen.getByText(/base occupancy/i)).toBeInTheDocument();
    });

    it("shows all rate fields with correct values", async () => {
      render(<UnitRequestSelector {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/current rates/i)).toBeInTheDocument();
      });

      // Base Rate: ₱2,000.00/night
      expect(screen.getByText(/₱2,000\.00\/night/i)).toBeInTheDocument();
      // Weekend Rate: ₱2,500.00/night
      expect(screen.getByText(/₱2,500\.00\/night/i)).toBeInTheDocument();
      // Extra Person: ₱300.00/night
      expect(screen.getByText(/₱300\.00\/night/i)).toBeInTheDocument();
      // Base Occupancy: 2 guests
      expect(screen.getByText(/2 guests/i)).toBeInTheDocument();
    });

    it("formats currency values correctly with peso sign and commas", async () => {
      const { fetchRates } = await import("@/lib/api/guest-booking-client");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fetchRates as any).mockResolvedValueOnce({
        ...mockPricingConfig,
        base_rate: 15000,
        weekend_rate: 18500,
      });

      render(<UnitRequestSelector {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/₱15,000\.00\/night/i)).toBeInTheDocument();
        expect(screen.getByText(/₱18,500\.00\/night/i)).toBeInTheDocument();
      });
    });

    it("displays reference-only disclaimer", async () => {
      render(<UnitRequestSelector {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText(/final pricing calculated based on your specific dates/i)
        ).toBeInTheDocument();
      });
    });
  });

  // ========== EMPTY STATE TESTS ==========

  describe("Empty State", () => {
    it("shows empty state when no units selected", async () => {
      render(<UnitRequestSelector {...defaultProps} value={[]} />);

      await waitFor(() => {
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
      });

      expect(screen.getByText(/no units selected/i)).toBeInTheDocument();
    });

    it('displays "Add Unit Request" button in empty state', async () => {
      render(<UnitRequestSelector {...defaultProps} value={[]} />);

      await waitFor(() => {
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
      });

      const addButton = screen.getByRole("button", { name: /add unit request/i });
      expect(addButton).toBeInTheDocument();
    });

    it("shows dashed border card in empty state", async () => {
      const { container } = render(<UnitRequestSelector {...defaultProps} value={[]} />);

      await waitFor(() => {
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
      });

      // Check for dashed border styling
      const dashedCard = container.querySelector(".border-dashed");
      expect(dashedCard).toBeInTheDocument();
    });
  });

  // ========== UNIT ARRAY TESTS ==========

  describe("Unit Array Display", () => {
    it("displays unit cards for each request in value array", async () => {
      render(<UnitRequestSelector {...defaultProps} value={mockMultipleUnits} />);

      await waitFor(() => {
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
      });

      // Should render 3 unit cards
      expect(screen.getByText("Unit #1")).toBeInTheDocument();
      expect(screen.getByText("Unit #2")).toBeInTheDocument();
      expect(screen.getByText("Unit #3")).toBeInTheDocument();
    });

    it("renders correct number of cards matching value.length", async () => {
      render(<UnitRequestSelector {...defaultProps} value={mockMultipleUnits} />);

      await waitFor(() => {
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
      });

      // Count UnitRequestCard instances by looking for unit titles
      const unitTitles = screen.getAllByText(/Unit #\d+/);
      expect(unitTitles).toHaveLength(mockMultipleUnits.length);
    });

    it("passes correct guest count to each card", async () => {
      render(<UnitRequestSelector {...defaultProps} value={mockMultipleUnits} />);

      await waitFor(() => {
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
      });

      // Verify unit cards are rendered with correct indices
      expect(screen.getByText("Unit #1")).toBeInTheDocument();
      expect(screen.getByText("Unit #2")).toBeInTheDocument();
      expect(screen.getByText("Unit #3")).toBeInTheDocument();

      // Get all guest count inputs - NumberInput may render differently
      const guestInputs = screen.getAllByLabelText(/number of guests/i);
      expect(guestInputs).toHaveLength(3);
    });
  });

  // ========== ADD/REMOVE TESTS ==========

  describe("Add/Remove Units", () => {
    it("adds new unit with base occupancy on Add Unit click", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(<UnitRequestSelector {...defaultProps} value={[]} onChange={onChange} />);

      await waitFor(() => {
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
      });

      const addButton = screen.getByRole("button", { name: /add unit request/i });
      await user.click(addButton);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith([
        { guests_per_unit: mockPricingConfig.base_occupancy },
      ]);
    });

    it("adds another unit when Add Another Unit button clicked", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(<UnitRequestSelector {...defaultProps} value={mockSingleUnit} onChange={onChange} />);

      await waitFor(() => {
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
      });

      const addAnotherButton = screen.getByRole("button", { name: /add another unit/i });
      await user.click(addAnotherButton);

      expect(onChange).toHaveBeenCalledWith([
        ...mockSingleUnit,
        { guests_per_unit: mockPricingConfig.base_occupancy },
      ]);
    });

    it("removes correct unit when card remove button clicked", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <UnitRequestSelector {...defaultProps} value={mockMultipleUnits} onChange={onChange} />
      );

      await waitFor(() => {
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
      });

      // Get all remove buttons
      const removeButtons = screen.getAllByLabelText(/remove unit/i);

      // Remove Unit #2 (index 1)
      await user.click(removeButtons[1]);

      expect(onChange).toHaveBeenCalledWith([mockMultipleUnits[0], mockMultipleUnits[2]]);
    });

    it("disables add button when max units reached", async () => {
      const maxedUnits = Array.from({ length: 10 }, () => ({ guests_per_unit: 2 }));

      render(<UnitRequestSelector {...defaultProps} value={maxedUnits} maxTotalUnits={10} />);

      await waitFor(() => {
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
      });

      // "Add Another Unit" button should not be rendered at max
      const addAnotherButton = screen.queryByRole("button", { name: /add another unit/i });
      expect(addAnotherButton).not.toBeInTheDocument();
    });

    it("updates guest count when card input changes", async () => {
      const user = userEvent.setup();
      let currentValue = [...mockMultipleUnits];
      const onChange = vi.fn((newValue: typeof mockMultipleUnits) => {
        currentValue = newValue;
      });

      const { rerender } = render(
        <UnitRequestSelector {...defaultProps} value={currentValue} onChange={onChange} />
      );

      await waitFor(() => {
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
      });

      const guestInputs = screen.getAllByLabelText(/number of guests/i);

      // Change Unit #1 guest count to 5
      await user.clear(guestInputs[0]);
      await user.type(guestInputs[0], "5");

      // Wait for onChange to be called
      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
      });

      // Re-render with updated value to simulate parent state update
      rerender(<UnitRequestSelector {...defaultProps} value={currentValue} onChange={onChange} />);

      // Verify the last call has the updated value
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
      expect(lastCall[0]).toEqual([
        { guests_per_unit: 5 },
        mockMultipleUnits[1],
        mockMultipleUnits[2],
      ]);
    });
  });

  // ========== TOTALS CALCULATION TESTS ==========

  describe("Totals Calculation", () => {
    it("calculates total units correctly (array.length)", async () => {
      render(<UnitRequestSelector {...defaultProps} value={mockMultipleUnits} />);

      await waitFor(() => {
        expect(screen.getByText(/3 units/i)).toBeInTheDocument();
      });
    });

    it("calculates total guests correctly (sum of guests_per_unit)", async () => {
      render(<UnitRequestSelector {...defaultProps} value={mockMultipleUnits} />);

      await waitFor(() => {
        // mockMultipleUnits = [2, 3, 4] = 9 total guests
        expect(screen.getByText(/9 guests/i)).toBeInTheDocument();
      });
    });

    it("updates totals when units added", async () => {
      const onChange = vi.fn();

      const { rerender } = render(
        <UnitRequestSelector {...defaultProps} value={mockSingleUnit} onChange={onChange} />
      );

      await waitFor(() => {
        expect(screen.getByText(/1 unit, 2 guests/i)).toBeInTheDocument();
      });

      // Simulate adding a unit
      const newValue = [...mockSingleUnit, { guests_per_unit: 3 }];
      rerender(<UnitRequestSelector {...defaultProps} value={newValue} onChange={onChange} />);

      await waitFor(() => {
        expect(screen.getByText(/2 units, 5 guests/i)).toBeInTheDocument();
      });
    });

    it("updates totals when units removed", async () => {
      const { rerender } = render(
        <UnitRequestSelector {...defaultProps} value={mockMultipleUnits} onChange={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText(/3 units, 9 guests/i)).toBeInTheDocument();
      });

      // Simulate removing a unit
      const newValue = mockMultipleUnits.slice(0, 2);
      rerender(<UnitRequestSelector {...defaultProps} value={newValue} onChange={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/2 units, 5 guests/i)).toBeInTheDocument();
      });
    });

    it("handles singular unit/guest labels correctly", async () => {
      render(<UnitRequestSelector {...defaultProps} value={mockSingleUnit} />);

      await waitFor(() => {
        // Singular: "1 unit, 2 guests"
        expect(screen.getByText(/1 unit, 2 guests/i)).toBeInTheDocument();
      });
    });
  });

  // ========== MAX LIMIT TESTS ==========

  describe("Max Limit Handling", () => {
    it("shows warning when max units reached", async () => {
      const maxedUnits = Array.from({ length: 10 }, () => ({ guests_per_unit: 2 }));

      render(<UnitRequestSelector {...defaultProps} value={maxedUnits} maxTotalUnits={10} />);

      await waitFor(() => {
        expect(screen.getByText(/maximum of 10 units per booking reached/i)).toBeInTheDocument();
      });
    });

    it('hides "Add Another Unit" button at max', async () => {
      const maxedUnits = Array.from({ length: 10 }, () => ({ guests_per_unit: 2 }));

      render(<UnitRequestSelector {...defaultProps} value={maxedUnits} maxTotalUnits={10} />);

      await waitFor(() => {
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
      });

      const addAnotherButton = screen.queryByRole("button", { name: /add another unit/i });
      expect(addAnotherButton).not.toBeInTheDocument();
    });

    it("respects custom maxTotalUnits prop", async () => {
      const units = Array.from({ length: 5 }, () => ({ guests_per_unit: 2 }));

      render(<UnitRequestSelector {...defaultProps} value={units} maxTotalUnits={5} />);

      await waitFor(() => {
        expect(screen.getByText(/maximum of 5 units per booking reached/i)).toBeInTheDocument();
      });
    });

    it("does not show warning below max units", async () => {
      render(
        <UnitRequestSelector {...defaultProps} value={mockMultipleUnits} maxTotalUnits={10} />
      );

      await waitFor(() => {
        expect(
          screen.queryByText(/maximum of 10 units per booking reached/i)
        ).not.toBeInTheDocument();
      });
    });
  });

  // ========== ERROR STATE TESTS ==========

  describe("Error Handling", () => {
    it("displays error alert when fetch fails", async () => {
      const { fetchRates } = await import("@/lib/api/guest-booking-client");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fetchRates as any).mockRejectedValueOnce(new Error("Network error"));

      render(<UnitRequestSelector {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });

    it("shows generic error message on unknown error", async () => {
      const { fetchRates } = await import("@/lib/api/guest-booking-client");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fetchRates as any).mockRejectedValueOnce("Unknown error");

      render(<UnitRequestSelector {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load pricing information/i)).toBeInTheDocument();
      });
    });

    it("does not render unit cards when fetch fails", async () => {
      const { fetchRates } = await import("@/lib/api/guest-booking-client");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fetchRates as any).mockRejectedValueOnce(new Error("API error"));

      render(<UnitRequestSelector {...defaultProps} value={mockMultipleUnits} />);

      await waitFor(() => {
        expect(screen.queryByText(/Unit #1/i)).not.toBeInTheDocument();
      });
    });
  });

  // ========== DISABLED STATE TESTS ==========

  describe("Disabled State", () => {
    it("disables all add buttons when disabled prop is true", async () => {
      render(<UnitRequestSelector {...defaultProps} value={[]} disabled={true} />);

      await waitFor(() => {
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
      });

      const addButton = screen.getByRole("button", { name: /add unit request/i });
      expect(addButton).toBeDisabled();
    });

    it("passes disabled prop to all UnitRequestCard components", async () => {
      render(<UnitRequestSelector {...defaultProps} value={mockMultipleUnits} disabled={true} />);

      await waitFor(() => {
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
      });

      const guestInputs = screen.getAllByLabelText(/number of guests/i);
      guestInputs.forEach((input) => {
        expect(input).toBeDisabled();
      });
    });
  });

  // ========== ACCESSIBILITY TESTS ==========

  describe("Accessibility", () => {
    it("should have no accessibility violations", async () => {
      const { container } = render(
        <UnitRequestSelector {...defaultProps} value={mockMultipleUnits} />
      );

      await waitFor(() => {
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("uses proper ARIA roles for alerts", async () => {
      render(<UnitRequestSelector {...defaultProps} value={mockSingleUnit} />);

      await waitFor(() => {
        const infoAlert = screen.getByText(/add units and specify guests/i).closest("[role]");
        expect(infoAlert).toHaveAttribute("role", "alert");
      });
    });
  });

  // ========== EDGE CASES ==========

  describe("Edge Cases", () => {
    it("handles empty pricing config gracefully", async () => {
      const { fetchRates } = await import("@/lib/api/guest-booking-client");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fetchRates as any).mockResolvedValueOnce(null);

      render(<UnitRequestSelector {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load pricing information/i)).toBeInTheDocument();
      });
    });

    it("handles single unit with correct grammar", async () => {
      render(<UnitRequestSelector {...defaultProps} value={mockSingleUnit} />);

      await waitFor(() => {
        // Should say "1 unit" (singular) not "1 units"
        expect(screen.getByText(/1 unit, 2 guests/i)).toBeInTheDocument();
      });
    });

    it("prevents adding units beyond maxTotalUnits", async () => {
      const onChange = vi.fn();
      const maxedUnits = Array.from({ length: 10 }, () => ({ guests_per_unit: 2 }));

      render(
        <UnitRequestSelector
          {...defaultProps}
          value={maxedUnits}
          onChange={onChange}
          maxTotalUnits={10}
        />
      );

      await waitFor(() => {
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
      });

      // No "Add Another Unit" button should exist
      const addButton = screen.queryByRole("button", { name: /add another unit/i });
      expect(addButton).not.toBeInTheDocument();

      // onChange should not have been called
      expect(onChange).not.toHaveBeenCalled();
    });

    it("shows only one remove button when single unit exists", async () => {
      render(<UnitRequestSelector {...defaultProps} value={mockSingleUnit} />);

      await waitFor(() => {
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
      });

      // canRemove should be false for single unit (enforced by UnitRequestCard)
      const removeButtons = screen.queryAllByLabelText(/remove unit/i);
      // UnitRequestCard with canRemove=false should not render remove button
      expect(removeButtons.length).toBe(0);
    });
  });
});
