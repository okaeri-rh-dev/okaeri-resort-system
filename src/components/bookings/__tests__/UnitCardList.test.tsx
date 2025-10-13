/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { UnitCardList } from "../UnitCardList";
import type { BookingUnit } from "@/types/multi-unit-booking";

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
    guest_assignment: { guest_ids: [], num_guests: 3 },
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

describe("UnitCardList", () => {
  const mockOnRemove = vi.fn();
  const mockOnUpdateGuestCount = vi.fn();
  const mockOnAssignGuests = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders all units", () => {
      render(
        <UnitCardList
          units={mockUnits}
          onRemove={mockOnRemove}
          onUpdateGuestCount={mockOnUpdateGuestCount}
        />
      );

      expect(screen.getByText("Ocean View Suite")).toBeInTheDocument();
      expect(screen.getByText("Garden Villa")).toBeInTheDocument();
    });

    it("shows empty state when no units", () => {
      render(
        <UnitCardList
          units={[]}
          onRemove={mockOnRemove}
          onUpdateGuestCount={mockOnUpdateGuestCount}
        />
      );

      expect(screen.getByText("No units selected")).toBeInTheDocument();
    });

    it("displays unit badges with correct numbers", () => {
      render(
        <UnitCardList
          units={mockUnits}
          onRemove={mockOnRemove}
          onUpdateGuestCount={mockOnUpdateGuestCount}
        />
      );

      expect(screen.getByLabelText("Unit number 1")).toBeInTheDocument();
      expect(screen.getByLabelText("Unit number 2")).toBeInTheDocument();
    });
  });

  describe("Guest Count Management", () => {
    it("displays guest count input", () => {
      render(
        <UnitCardList
          units={mockUnits}
          onRemove={mockOnRemove}
          onUpdateGuestCount={mockOnUpdateGuestCount}
        />
      );

      const inputs = screen.getAllByLabelText(/Number of guests/i);
      expect(inputs).toHaveLength(mockUnits.length);
    });

    it("calls onUpdateGuestCount when changed", async () => {
      const user = userEvent.setup();
      render(
        <UnitCardList
          units={mockUnits}
          onRemove={mockOnRemove}
          onUpdateGuestCount={mockOnUpdateGuestCount}
        />
      );

      const input = screen.getAllByLabelText(/Number of guests/i)[0];
      await user.clear(input);
      await user.type(input, "4");

      expect(mockOnUpdateGuestCount).toHaveBeenCalledWith("unit-1", 4);
    });

    it("shows Assign Guests button when callback provided", () => {
      render(
        <UnitCardList
          units={mockUnits}
          onRemove={mockOnRemove}
          onUpdateGuestCount={mockOnUpdateGuestCount}
          onAssignGuests={mockOnAssignGuests}
        />
      );

      const buttons = screen.getAllByText("Assign Guests");
      expect(buttons).toHaveLength(mockUnits.length);
    });

    it("calls onAssignGuests when button clicked", async () => {
      const user = userEvent.setup();
      render(
        <UnitCardList
          units={mockUnits}
          onRemove={mockOnRemove}
          onUpdateGuestCount={mockOnUpdateGuestCount}
          onAssignGuests={mockOnAssignGuests}
        />
      );

      const buttons = screen.getAllByText("Assign Guests");
      await user.click(buttons[0]);

      expect(mockOnAssignGuests).toHaveBeenCalledWith("unit-1");
    });
  });

  describe("Pricing Display", () => {
    it("shows total price for each unit", () => {
      render(
        <UnitCardList
          units={mockUnits}
          onRemove={mockOnRemove}
          onUpdateGuestCount={mockOnUpdateGuestCount}
        />
      );

      expect(screen.getByText("₱7,500.00")).toBeInTheDocument();
      expect(screen.getByText("₱12,000.00")).toBeInTheDocument();
    });

    it("displays pricing breakdown when expanded", async () => {
      const user = userEvent.setup();
      render(
        <UnitCardList
          units={mockUnits}
          onRemove={mockOnRemove}
          onUpdateGuestCount={mockOnUpdateGuestCount}
        />
      );

      const breakdownButtons = screen.getAllByText("Pricing Breakdown");
      await user.click(breakdownButtons[0]);

      expect(screen.getByText(/Base \(2 nights/i)).toBeInTheDocument();
      expect(screen.getByText("Weekend surcharge")).toBeInTheDocument();
      expect(screen.getByText("Extra persons")).toBeInTheDocument();
    });
  });

  describe("Unit Removal", () => {
    it("shows Remove button when editable", () => {
      render(
        <UnitCardList
          units={mockUnits}
          onRemove={mockOnRemove}
          onUpdateGuestCount={mockOnUpdateGuestCount}
          editable={true}
        />
      );

      const removeButtons = screen.getAllByText("Remove");
      expect(removeButtons).toHaveLength(mockUnits.length);
    });

    it("hides Remove button when not editable", () => {
      render(
        <UnitCardList
          units={mockUnits}
          onRemove={mockOnRemove}
          onUpdateGuestCount={mockOnUpdateGuestCount}
          editable={false}
        />
      );

      expect(screen.queryByText("Remove")).not.toBeInTheDocument();
    });

    it("calls onRemove with correct unit ID", async () => {
      const user = userEvent.setup();
      render(
        <UnitCardList
          units={mockUnits}
          onRemove={mockOnRemove}
          onUpdateGuestCount={mockOnUpdateGuestCount}
        />
      );

      const removeButtons = screen.getAllByText("Remove");
      await user.click(removeButtons[0]);

      expect(mockOnRemove).toHaveBeenCalledWith("unit-1");
    });
  });

  describe("Accessibility", () => {
    it("should have no accessibility violations", async () => {
      const { container } = render(
        <UnitCardList
          units={mockUnits}
          onRemove={mockOnRemove}
          onUpdateGuestCount={mockOnUpdateGuestCount}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("has proper ARIA labels", () => {
      render(
        <UnitCardList
          units={mockUnits}
          onRemove={mockOnRemove}
          onUpdateGuestCount={mockOnUpdateGuestCount}
        />
      );

      expect(screen.getByRole("list", { name: "Selected units" })).toBeInTheDocument();
    });
  });
});
