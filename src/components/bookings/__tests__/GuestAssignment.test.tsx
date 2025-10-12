/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { GuestAssignment } from "../GuestAssignment";
import type { BookingUnit } from "@/types/multi-unit-booking";

expect.extend(toHaveNoViolations);

const mockUnit: BookingUnit = {
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
  availability: { is_available: true, checking: false },
  guest_assignment: {
    guest_ids: [],
    num_guests: 2,
    special_requests: "",
  },
};

describe("GuestAssignment", () => {
  const mockOnSave = vi.fn();
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders dialog when open", () => {
      render(
        <GuestAssignment
          unit={mockUnit}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByText(/Assign Guests to Ocean View Suite/)).toBeInTheDocument();
    });

    it("does not render when closed", () => {
      render(
        <GuestAssignment
          unit={mockUnit}
          open={false}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      );

      expect(screen.queryByText(/Assign Guests/)).not.toBeInTheDocument();
    });

    it("returns null when no unit provided", () => {
      const { container } = render(
        <GuestAssignment
          unit={null}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe("Guest Count Input", () => {
    it("displays guest count input", () => {
      render(
        <GuestAssignment
          unit={mockUnit}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      );

      const input = screen.getByLabelText(/Number of Guests/);
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue(2); // Default from guest_assignment
    });

    it("shows max occupancy hint", () => {
      render(
        <GuestAssignment
          unit={mockUnit}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByText(/Maximum 4 guests/)).toBeInTheDocument();
    });

    it("updates guest count on input change", async () => {
      const user = userEvent.setup();
      render(
        <GuestAssignment
          unit={mockUnit}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      );

      const input = screen.getByLabelText(/Number of Guests/);
      await user.clear(input);
      await user.type(input, "3");

      expect(input).toHaveValue(3);
    });
  });

  describe("Special Requests", () => {
    it("displays special requests textarea", () => {
      render(
        <GuestAssignment
          unit={mockUnit}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      );

      const textarea = screen.getByLabelText(/Special Requests/);
      expect(textarea).toBeInTheDocument();
    });

    it("shows character count", () => {
      render(
        <GuestAssignment
          unit={mockUnit}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByText(/0\/500 characters/)).toBeInTheDocument();
    });

    it("updates character count when typing", async () => {
      const user = userEvent.setup();
      render(
        <GuestAssignment
          unit={mockUnit}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      );

      const textarea = screen.getByLabelText(/Special Requests/);
      await user.type(textarea, "Early check-in please");

      expect(screen.getByText(/21\/500 characters/)).toBeInTheDocument();
    });
  });

  describe("Validation", () => {
    it("shows error when guest count is less than 1", async () => {
      const user = userEvent.setup();
      render(
        <GuestAssignment
          unit={mockUnit}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      );

      const input = screen.getByLabelText(/Number of Guests/);
      await user.clear(input);
      await user.type(input, "0");

      const saveButton = screen.getByText("Save");
      await user.click(saveButton);

      expect(screen.getByRole("alert")).toHaveTextContent(/At least 1 guest is required/);
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it("shows error when guest count exceeds max occupancy", async () => {
      const user = userEvent.setup();
      render(
        <GuestAssignment
          unit={mockUnit}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      );

      const input = screen.getByLabelText(/Number of Guests/);
      await user.clear(input);
      await user.type(input, "5");

      const saveButton = screen.getByText("Save");
      await user.click(saveButton);

      expect(screen.getByRole("alert")).toHaveTextContent(/Maximum 4 guests allowed/);
      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  describe("Actions", () => {
    it("calls onSave with correct data when Save is clicked", async () => {
      const user = userEvent.setup();
      render(
        <GuestAssignment
          unit={mockUnit}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      );

      const input = screen.getByLabelText(/Number of Guests/);
      await user.clear(input);
      await user.type(input, "3");

      const textarea = screen.getByLabelText(/Special Requests/);
      await user.type(textarea, "Extra towels");

      const saveButton = screen.getByText("Save");
      await user.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledWith("unit-1", 3, "Extra towels");
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it("closes dialog without saving when Cancel is clicked", async () => {
      const user = userEvent.setup();
      render(
        <GuestAssignment
          unit={mockUnit}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      );

      const cancelButton = screen.getByText("Cancel");
      await user.click(cancelButton);

      expect(mockOnSave).not.toHaveBeenCalled();
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it("resets form when canceled", async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <GuestAssignment
          unit={mockUnit}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      );

      // Make changes
      const input = screen.getByLabelText(/Number of Guests/);
      await user.clear(input);
      await user.type(input, "4");

      // Cancel
      const cancelButton = screen.getByText("Cancel");
      await user.click(cancelButton);

      // Reopen
      rerender(
        <GuestAssignment
          unit={mockUnit}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      );

      // Should be reset to original value
      expect(input).toHaveValue(2);
    });
  });

  describe("Accessibility", () => {
    it("should have no accessibility violations", async () => {
      const { container } = render(
        <GuestAssignment
          unit={mockUnit}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("has proper ARIA attributes", () => {
      render(
        <GuestAssignment
          unit={mockUnit}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      );

      const input = screen.getByLabelText(/Number of Guests/);
      expect(input).toHaveAttribute("aria-required", "true");
      expect(input).toHaveAttribute("aria-describedby");
    });
  });
});
