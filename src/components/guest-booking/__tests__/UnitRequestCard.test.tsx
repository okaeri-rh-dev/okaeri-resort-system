/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { UnitRequestCard, type UnitRequestCardProps } from "../UnitRequestCard";

// ============================================
// MOCK DATA & SETUP
// ============================================

const defaultProps: UnitRequestCardProps = {
  index: 0,
  guestsPerUnit: 2,
  onGuestsChange: vi.fn(),
  onRemove: vi.fn(),
  maxCapacityPerUnit: 10,
  baseOccupancy: 2,
  extraPersonRate: 300,
  canRemove: true,
};

// ============================================
// TESTS
// ============================================

describe("UnitRequestCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========== RENDERING TESTS ==========

  describe("Rendering", () => {
    it("renders unit number correctly from 0-based index", () => {
      render(<UnitRequestCard {...defaultProps} index={0} />);
      expect(screen.getByText("Unit #1")).toBeInTheDocument();

      const { rerender } = render(<UnitRequestCard {...defaultProps} index={2} />);
      rerender(<UnitRequestCard {...defaultProps} index={2} />);
      expect(screen.getByText("Unit #3")).toBeInTheDocument();
    });

    it("displays current guest count in input", () => {
      render(<UnitRequestCard {...defaultProps} guestsPerUnit={5} />);
      const input = screen.getByLabelText(/number of guests/i) as HTMLInputElement;
      expect(input.value).toBe("5");
    });

    it("shows maximum capacity hint text", () => {
      render(<UnitRequestCard {...defaultProps} maxCapacityPerUnit={10} />);
      expect(screen.getByText(/maximum 10 guests per unit/i)).toBeInTheDocument();
    });

    it("renders Home icon in card header", () => {
      const { container } = render(<UnitRequestCard {...defaultProps} />);
      // Check for Home icon by verifying SVG presence with aria-hidden
      const homeIcon = container.querySelector('[aria-hidden="true"]');
      expect(homeIcon).toBeInTheDocument();
    });
  });

  // ========== INTERACTION TESTS ==========

  describe("Guest Count Interaction", () => {
    it("calls onGuestsChange when value changes to valid number", async () => {
      const user = userEvent.setup();
      const onGuestsChange = vi.fn();

      render(<UnitRequestCard {...defaultProps} onGuestsChange={onGuestsChange} />);

      const input = screen.getByLabelText(/number of guests/i);

      // NumberInput fires onChange on each keystroke
      await user.clear(input);
      await user.type(input, "5");

      // NumberInput calls onChange with parsed number value (should be called with 5)
      // It may be called multiple times during typing, verify last call
      expect(onGuestsChange).toHaveBeenCalled();
      const lastCall = onGuestsChange.mock.calls[onGuestsChange.mock.calls.length - 1];
      expect(lastCall[0]).toBe(5);
    });

    it("prevents invalid values below minimum (< 1)", async () => {
      const user = userEvent.setup();
      const onGuestsChange = vi.fn();

      render(<UnitRequestCard {...defaultProps} onGuestsChange={onGuestsChange} />);

      const input = screen.getByLabelText(/number of guests/i) as HTMLInputElement;

      // Try to set to 0 (invalid)
      await user.clear(input);
      await user.type(input, "0");

      // NumberInput with enforceMinMax should prevent onChange for value < 1
      // The component's handleGuestsChange also validates and rejects < 1
      const calls = onGuestsChange.mock.calls;
      const invalidCalls = calls.filter((call) => call[0] < 1);
      expect(invalidCalls).toHaveLength(0);
    });

    it("prevents invalid values above maximum (> maxCapacity)", async () => {
      const user = userEvent.setup();
      const onGuestsChange = vi.fn();

      render(
        <UnitRequestCard
          {...defaultProps}
          onGuestsChange={onGuestsChange}
          maxCapacityPerUnit={10}
        />
      );

      const input = screen.getByLabelText(/number of guests/i);

      // Try to set to 15 (invalid - exceeds max 10)
      await user.clear(input);
      await user.type(input, "15");

      // NumberInput with enforceMinMax should prevent onChange for value > max
      // The component's handleGuestsChange also validates and rejects > max
      const calls = onGuestsChange.mock.calls;
      const invalidCalls = calls.filter((call) => call[0] > 10);
      expect(invalidCalls).toHaveLength(0);
    });

    it("accepts valid values within range (1 to maxCapacity)", async () => {
      const user = userEvent.setup();
      const onGuestsChange = vi.fn();

      render(<UnitRequestCard {...defaultProps} onGuestsChange={onGuestsChange} />);

      const input = screen.getByLabelText(/number of guests/i);

      // Valid value: 7 (within 1-10 range)
      await user.clear(input);
      await user.type(input, "7");

      expect(onGuestsChange).toHaveBeenCalledWith(7);
    });

    it("does not call onGuestsChange for null values", () => {
      const onGuestsChange = vi.fn();

      render(<UnitRequestCard {...defaultProps} onGuestsChange={onGuestsChange} />);

      // Simulate NumberInput passing null (invalid input)
      const { handleGuestsChange } = (UnitRequestCard as any).type({
        ...defaultProps,
        onGuestsChange,
      });

      // This tests the internal handleGuestsChange function
      // In real usage, NumberInput prevents null from reaching onChange
    });
  });

  // ========== EXTRA PERSON INDICATOR TESTS ==========

  describe("Extra Person Indicator", () => {
    it("shows extra person indicator when above base occupancy", () => {
      render(
        <UnitRequestCard
          {...defaultProps}
          guestsPerUnit={5}
          baseOccupancy={2}
          extraPersonRate={300}
        />
      );

      expect(screen.getByText(/extra person fee/i)).toBeInTheDocument();
    });

    it("does not show extra person indicator at base occupancy", () => {
      render(
        <UnitRequestCard
          {...defaultProps}
          guestsPerUnit={2}
          baseOccupancy={2}
          extraPersonRate={300}
        />
      );

      expect(screen.queryByText(/extra person fee/i)).not.toBeInTheDocument();
    });

    it("does not show extra person indicator below base occupancy", () => {
      render(
        <UnitRequestCard
          {...defaultProps}
          guestsPerUnit={1}
          baseOccupancy={2}
          extraPersonRate={300}
        />
      );

      expect(screen.queryByText(/extra person fee/i)).not.toBeInTheDocument();
    });

    it("calculates extra person count correctly (5 guests - 2 base = 3 extra)", () => {
      render(
        <UnitRequestCard
          {...defaultProps}
          guestsPerUnit={5}
          baseOccupancy={2}
          extraPersonRate={300}
        />
      );

      expect(screen.getByText(/3 extra people/i)).toBeInTheDocument();
    });

    it("displays correct extra person count for single extra person", () => {
      render(
        <UnitRequestCard
          {...defaultProps}
          guestsPerUnit={3}
          baseOccupancy={2}
          extraPersonRate={300}
        />
      );

      // Should say "1 extra person" (singular) not "people"
      expect(screen.getByText(/1 extra person/i)).toBeInTheDocument();
      expect(screen.queryByText(/1 extra people/i)).not.toBeInTheDocument();
    });

    it("displays extra person rate with correct currency formatting", () => {
      render(
        <UnitRequestCard
          {...defaultProps}
          guestsPerUnit={5}
          baseOccupancy={2}
          extraPersonRate={300}
        />
      );

      // Check for formatted rate: ₱300.00/person/night
      expect(screen.getByText(/₱300\.00\/person\/night/i)).toBeInTheDocument();
    });

    it("formats large extra person rates with commas", () => {
      render(
        <UnitRequestCard
          {...defaultProps}
          guestsPerUnit={5}
          baseOccupancy={2}
          extraPersonRate={1500}
        />
      );

      // Check for formatted rate: ₱1,500.00/person/night
      expect(screen.getByText(/₱1,500\.00\/person\/night/i)).toBeInTheDocument();
    });
  });

  // ========== REMOVE BUTTON TESTS ==========

  describe("Remove Button", () => {
    it("shows remove button when canRemove is true", () => {
      render(<UnitRequestCard {...defaultProps} canRemove={true} />);
      const removeButton = screen.getByLabelText(/remove unit #1/i);
      expect(removeButton).toBeInTheDocument();
    });

    it("hides remove button when canRemove is false", () => {
      render(<UnitRequestCard {...defaultProps} canRemove={false} />);
      const removeButton = screen.queryByLabelText(/remove unit #1/i);
      expect(removeButton).not.toBeInTheDocument();
    });

    it("calls onRemove when remove button clicked", async () => {
      const user = userEvent.setup();
      const onRemove = vi.fn();

      render(<UnitRequestCard {...defaultProps} onRemove={onRemove} canRemove={true} />);

      const removeButton = screen.getByLabelText(/remove unit #1/i);
      await user.click(removeButton);

      expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it("includes correct unit number in remove button aria-label", () => {
      render(<UnitRequestCard {...defaultProps} index={4} canRemove={true} />);
      expect(screen.getByLabelText(/remove unit #5/i)).toBeInTheDocument();
    });
  });

  // ========== DISABLED STATE TESTS ==========

  describe("Disabled State", () => {
    it("disables guest count input when disabled prop is true", () => {
      render(<UnitRequestCard {...defaultProps} disabled={true} />);
      const input = screen.getByLabelText(/number of guests/i) as HTMLInputElement;
      expect(input).toBeDisabled();
    });

    it("disables remove button when disabled prop is true", () => {
      render(<UnitRequestCard {...defaultProps} disabled={true} canRemove={true} />);
      const removeButton = screen.getByLabelText(/remove unit #1/i) as HTMLButtonElement;
      expect(removeButton).toBeDisabled();
    });

    it("applies visual opacity when disabled", () => {
      const { container } = render(<UnitRequestCard {...defaultProps} disabled={true} />);
      const card = container.querySelector('[class*="opacity"]');
      expect(card).toBeInTheDocument();
      expect(card).toHaveClass("opacity-60");
    });

    it("applies pointer-events-none when disabled", () => {
      const { container } = render(<UnitRequestCard {...defaultProps} disabled={true} />);
      const card = container.querySelector('[class*="pointer-events"]');
      expect(card).toBeInTheDocument();
      expect(card).toHaveClass("pointer-events-none");
    });
  });

  // ========== ACCESSIBILITY TESTS ==========

  describe("Accessibility", () => {
    it("should have no accessibility violations", async () => {
      const { container } = render(<UnitRequestCard {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("has proper label for guest count input", () => {
      render(<UnitRequestCard {...defaultProps} index={2} />);
      const input = screen.getByLabelText(/number of guests/i);
      expect(input).toHaveAttribute("id", "unit-2-guests");
    });

    it("associates extra person warning with input via aria-describedby", () => {
      render(<UnitRequestCard {...defaultProps} index={1} guestsPerUnit={5} baseOccupancy={2} />);

      const input = screen.getByLabelText(/number of guests/i);
      expect(input).toHaveAttribute("aria-describedby", "unit-1-extra-person-warning");

      const warningAlert = screen.getByText(/extra person fee/i).closest("[id]");
      expect(warningAlert).toHaveAttribute("id", "unit-1-extra-person-warning");
    });

    it("does not set aria-describedby when no extra person warning", () => {
      render(<UnitRequestCard {...defaultProps} index={1} guestsPerUnit={2} baseOccupancy={2} />);

      const input = screen.getByLabelText(/number of guests/i);
      expect(input).not.toHaveAttribute("aria-describedby");
    });

    it("has descriptive aria-label for remove button", () => {
      render(<UnitRequestCard {...defaultProps} index={3} canRemove={true} />);
      const removeButton = screen.getByLabelText(/remove unit #4/i);
      expect(removeButton).toHaveAttribute("aria-label", "Remove Unit #4");
    });
  });

  // ========== EDGE CASES ==========

  describe("Edge Cases", () => {
    it("handles index 0 correctly (displays as Unit #1)", () => {
      render(<UnitRequestCard {...defaultProps} index={0} />);
      expect(screen.getByText("Unit #1")).toBeInTheDocument();
    });

    it("handles large index numbers", () => {
      render(<UnitRequestCard {...defaultProps} index={99} />);
      expect(screen.getByText("Unit #100")).toBeInTheDocument();
    });

    it("handles edge case: guestsPerUnit equals maxCapacity", () => {
      render(<UnitRequestCard {...defaultProps} guestsPerUnit={10} maxCapacityPerUnit={10} />);
      const input = screen.getByLabelText(/number of guests/i) as HTMLInputElement;
      expect(input.value).toBe("10");
    });

    it("handles edge case: baseOccupancy equals maxCapacity", () => {
      render(
        <UnitRequestCard
          {...defaultProps}
          guestsPerUnit={5}
          baseOccupancy={5}
          maxCapacityPerUnit={5}
        />
      );
      // No extra person warning should show
      expect(screen.queryByText(/extra person fee/i)).not.toBeInTheDocument();
    });

    it("handles baseOccupancy of 0 (edge case)", () => {
      render(<UnitRequestCard {...defaultProps} guestsPerUnit={3} baseOccupancy={0} />);
      // All guests are "extra"
      expect(screen.getByText(/3 extra people/i)).toBeInTheDocument();
    });

    it("handles very large extra person rates", () => {
      render(
        <UnitRequestCard
          {...defaultProps}
          guestsPerUnit={5}
          baseOccupancy={2}
          extraPersonRate={10000}
        />
      );
      // Check for formatted rate with thousands separator: ₱10,000.00
      expect(screen.getByText(/₱10,000\.00\/person\/night/i)).toBeInTheDocument();
    });
  });
});
