/**
 * Component Tests for BookingIndicators and BookingCountBadge
 *
 * Tests the fixed 3-slot vertical lane layout used in the DashboardCalendar.
 * Each unit (C1/C2/C3) gets a fixed position with dedicated colors.
 *
 * Test Coverage:
 * - Null/empty returns
 * - Fixed 3-slot layout with invisible placeholders
 * - Unified chip render path (single element per occupied slot at all viewports)
 * - Unit code hidden on mobile, visible from sm: up; aria-label always preserved
 * - clamp() font-size inline style for container-query-driven scaling
 * - Status hint modifier classes on the chip
 * - Priority resolution when multiple bookings target the same slot
 * - Multi-unit bookings filling multiple slots
 * - Edge cases (unknown codes, null units, className merging)
 * - BookingCountBadge rendering and accessibility
 */

import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { beforeEach, describe, expect, it } from "vitest";

import type { Booking, BookingUnitRecord, Unit } from "@/types";

import { BookingCountBadge, BookingIndicators } from "../BookingIndicators";

// ─────────────────────────────────────────────
// Test factory
// ─────────────────────────────────────────────

let idCounter = 0;

beforeEach(() => {
  idCounter = 0;
});

/** Creates a typed Booking with booking_units populated from unit codes. */
function makeBooking({
  id,
  guestName = "Test Guest",
  status = "Confirmed",
  unitCodes = ["C1"],
}: {
  id?: string;
  guestName?: string;
  status?: string;
  unitCodes?: (string | null)[];
}): Booking {
  const bookingId = id ?? `booking-${++idCounter}`;

  const bookingUnits: BookingUnitRecord[] = unitCodes.map((code, i) => ({
    booking_unit_id: `bu-${bookingId}-${i}`,
    booking_id: bookingId,
    unit_id: `unit-${code ?? "null"}-${i}`,
    unit_price: 1000,
    weekend_surcharge: null,
    extra_person_charge: null,
    subtotal: 1000,
    assigned_guests: null,
    unit_notes: null,
    created_at: null,
    updated_at: null,
    unit: code
      ? ({
          unit_id: `unit-${code}-${i}`,
          unit_code: code,
          unit_name: `Unit ${code}`,
        } as Unit)
      : undefined,
  }));

  return {
    booking_id: bookingId,
    booking_reference: `REF-${bookingId}`,
    guest_name: guestName,
    contact_number: null,
    email: null,
    num_guests: 2,
    check_in: "2025-10-01",
    check_out: "2025-10-05",
    total_amount: 5000,
    booking_status: status,
    payment_status: "Pending",
    created_at: null,
    updated_at: null,
    booking_units: bookingUnits,
  };
}

// Convenience selectors for the unified chip render path
function getChips(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>("[aria-label]"));
}

// ─────────────────────────────────────────────
// BookingIndicators
// ─────────────────────────────────────────────

describe("BookingIndicators", () => {
  // ─── Null/empty returns ───
  describe("Null/empty returns", () => {
    it("should return null for empty bookings array", () => {
      const { container } = render(<BookingIndicators bookings={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it("should return null for undefined bookings", () => {
      const { container } = render(
        <BookingIndicators bookings={undefined as unknown as Booking[]} />
      );
      expect(container.firstChild).toBeNull();
    });

    it("should return null when all bookings have unknown unit codes", () => {
      const booking = makeBooking({ unitCodes: ["X1", "X2"] });
      const { container } = render(<BookingIndicators bookings={[booking]} />);
      expect(container.firstChild).toBeNull();
    });

    it("should return null when bookings have no booking_units", () => {
      const booking: Booking = {
        ...makeBooking({ unitCodes: ["C1"] }),
        booking_units: [],
      };
      const { container } = render(<BookingIndicators bookings={[booking]} />);
      expect(container.firstChild).toBeNull();
    });

    it("should return null when booking_units is undefined", () => {
      const booking: Booking = {
        ...makeBooking({ unitCodes: ["C1"] }),
        booking_units: undefined,
      };
      const { container } = render(<BookingIndicators bookings={[booking]} />);
      expect(container.firstChild).toBeNull();
    });
  });

  // ─── Fixed 3-slot layout ───
  describe("Fixed 3-slot layout", () => {
    it("should always render 3 child elements", () => {
      const booking = makeBooking({ unitCodes: ["C1"] });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.children).toHaveLength(3);
    });

    it("should render a flex-col container", () => {
      const booking = makeBooking({ unitCodes: ["C2"] });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const wrapper = container.querySelector(".flex-col");
      expect(wrapper).toBeInTheDocument();
    });

    it("should render invisible placeholders for empty slots", () => {
      const booking = makeBooking({ unitCodes: ["C2"] });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const placeholders = container.querySelectorAll('[aria-hidden="true"]');
      // C1 and C3 are empty → 2 placeholders
      expect(placeholders).toHaveLength(2);
    });

    it("should give placeholders the correct sizing classes", () => {
      const booking = makeBooking({ unitCodes: ["C1"] });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const placeholders = container.querySelectorAll('[aria-hidden="true"]');
      for (const placeholder of placeholders) {
        expect(placeholder).toHaveClass("h-3");
        expect(placeholder).toHaveClass("sm:h-4");
      }
    });

    it("should render 0 placeholders when all 3 slots are filled", () => {
      const bookings = [
        makeBooking({ guestName: "Alice", unitCodes: ["C1"] }),
        makeBooking({ guestName: "Bob", unitCodes: ["C2"] }),
        makeBooking({ guestName: "Carol", unitCodes: ["C3"] }),
      ];
      const { container } = render(<BookingIndicators bookings={bookings} />);

      const placeholders = container.querySelectorAll('[aria-hidden="true"]');
      expect(placeholders).toHaveLength(0);
    });
  });

  // ─── Unified chip render path ───
  describe("Unified chip render path", () => {
    it("renders a single chip per occupied unit slot at any viewport", () => {
      const booking = makeBooking({ unitCodes: ["C1"], guestName: "John Smith" });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      // No mobile-only color bar (the old `sm:hidden` branch)
      expect(container.querySelectorAll("[class*='sm:hidden']")).toHaveLength(0);
      // No desktop-only chip variant (the old `hidden sm:flex` branch)
      const hiddenSmFlexCount = Array.from(container.querySelectorAll<HTMLElement>("*")).filter(
        (el) => /\bhidden\b/.test(el.className) && /\bsm:flex\b/.test(el.className)
      ).length;
      expect(hiddenSmFlexCount).toBe(0);

      // One visible chip carries the guest name
      expect(screen.getByText(/john smith/i)).toBeInTheDocument();
      expect(getChips(container)).toHaveLength(1);
    });

    it("hides the unit code text on mobile but keeps it in the chip's aria-label", () => {
      const booking = makeBooking({ unitCodes: ["C1"], guestName: "Maria Santos" });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const unitCodeSpan = container.querySelector(".font-mono");
      expect(unitCodeSpan).toBeInTheDocument();
      expect(unitCodeSpan).toHaveClass("hidden");
      expect(unitCodeSpan).toHaveClass("sm:inline");

      const [chip] = getChips(container);
      expect(chip).toHaveAttribute("aria-label", "C1: Maria Santos");
    });

    it("applies the clamp() font-size inline style on each chip", () => {
      const booking = makeBooking({ unitCodes: ["C1"] });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const [chip] = getChips(container);
      expect(chip.style.fontSize).toBe("clamp(7px, 2cqi, 10px)");
    });

    it("applies correct per-unit chip bg/text/border for C1 (blue)", () => {
      const booking = makeBooking({ unitCodes: ["C1"] });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const [chip] = getChips(container);
      expect(chip).toHaveClass("bg-blue-100");
      expect(chip).toHaveClass("text-blue-800");
      expect(chip).toHaveClass("border-blue-300");
    });

    it("applies correct per-unit chip bg/text/border for C2 (emerald)", () => {
      const booking = makeBooking({ unitCodes: ["C2"] });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const [chip] = getChips(container);
      expect(chip).toHaveClass("bg-emerald-100");
      expect(chip).toHaveClass("text-emerald-800");
      expect(chip).toHaveClass("border-emerald-300");
    });

    it("applies correct per-unit chip bg/text/border for C3 (amber)", () => {
      const booking = makeBooking({ unitCodes: ["C3"] });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const [chip] = getChips(container);
      expect(chip).toHaveClass("bg-amber-100");
      expect(chip).toHaveClass("text-amber-800");
      expect(chip).toHaveClass("border-amber-300");
    });

    it("displays the unit code in a font-mono span", () => {
      const booking = makeBooking({ unitCodes: ["C2"] });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const monoSpan = container.querySelector(".font-mono");
      expect(monoSpan).toBeInTheDocument();
      expect(monoSpan).toHaveTextContent("C2");
    });

    it("displays the guest name in a truncated font-sans span", () => {
      const booking = makeBooking({ unitCodes: ["C1"], guestName: "Juan dela Cruz" });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const nameSpan = container.querySelector(".font-sans.truncate");
      expect(nameSpan).toBeInTheDocument();
      expect(nameSpan).toHaveTextContent("Juan dela Cruz");
    });

    it("renders the chip with border and rounded-sm styling", () => {
      const booking = makeBooking({ unitCodes: ["C1"] });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const [chip] = getChips(container);
      expect(chip).toHaveClass("border");
      expect(chip).toHaveClass("rounded-sm");
    });
  });

  // ─── Status hints on the chip ───
  describe("Status hints on the chip", () => {
    it("applies no modifier classes for Confirmed status", () => {
      const booking = makeBooking({ unitCodes: ["C1"], status: "Confirmed" });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const [chip] = getChips(container);
      expect(chip).not.toHaveClass("bg-white");
      expect(chip).not.toHaveClass("border-dashed");
      expect(chip).not.toHaveClass("opacity-50");
      expect(chip).not.toHaveClass("opacity-30");
      expect(chip).not.toHaveClass("line-through");
    });

    it("applies no opacity modifier for CheckedIn status", () => {
      const booking = makeBooking({ unitCodes: ["C1"], status: "CheckedIn" });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const [chip] = getChips(container);
      expect(chip).not.toHaveClass("opacity-50");
      expect(chip).not.toHaveClass("opacity-30");
      expect(chip).not.toHaveClass("border-dashed");
    });

    it("applies bg-white, border-2, dashed and amber border/text for Pending (unit-agnostic)", () => {
      const booking = makeBooking({ unitCodes: ["C1"], status: "Pending" });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const [chip] = getChips(container);
      expect(chip).toHaveClass("bg-white");
      expect(chip).toHaveClass("border-2");
      expect(chip).toHaveClass("border-dashed");
      expect(chip).toHaveClass("border-amber-600");
      expect(chip).toHaveClass("text-amber-800");
      expect(chip).not.toHaveClass("border-blue-300");
      expect(chip).not.toHaveClass("text-blue-800");
    });

    it("applies amber Pending styling to a C2 booking (Pending color is unit-agnostic)", () => {
      const booking = makeBooking({ unitCodes: ["C2"], status: "Pending" });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const [chip] = getChips(container);
      expect(chip).toHaveClass("border-amber-600");
      expect(chip).toHaveClass("text-amber-800");
      expect(chip).not.toHaveClass("border-emerald-300");
      expect(chip).not.toHaveClass("text-emerald-800");
    });

    it("still displays the booking's own unit code on a Pending chip (identity preserved)", () => {
      const c1Booking = makeBooking({ unitCodes: ["C1"], status: "Pending" });
      const c2Booking = makeBooking({ unitCodes: ["C2"], status: "Pending" });

      const { container: c1Container } = render(<BookingIndicators bookings={[c1Booking]} />);
      const { container: c2Container } = render(<BookingIndicators bookings={[c2Booking]} />);

      expect(c1Container.querySelector(".font-mono")).toHaveTextContent("C1");
      expect(c2Container.querySelector(".font-mono")).toHaveTextContent("C2");
    });

    it("applies opacity-50 for CheckedOut", () => {
      const booking = makeBooking({ unitCodes: ["C2"], status: "CheckedOut" });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const [chip] = getChips(container);
      expect(chip).toHaveClass("opacity-50");
    });

    it("applies opacity-30 and line-through for Cancelled", () => {
      const booking = makeBooking({ unitCodes: ["C3"], status: "Cancelled" });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const [chip] = getChips(container);
      expect(chip).toHaveClass("opacity-30");
      expect(chip).toHaveClass("line-through");
    });

    it("applies Pending hint when booking_status is null (defaults to Pending)", () => {
      const booking = makeBooking({ unitCodes: ["C1"], status: "Confirmed" });
      booking.booking_status = null;
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const [chip] = getChips(container);
      expect(chip).toHaveClass("bg-white");
      expect(chip).toHaveClass("border-dashed");
    });
  });

  // ─── Priority resolution ───
  describe("Priority resolution", () => {
    it("should pick CheckedIn over Confirmed for the same unit", () => {
      const bookings = [
        makeBooking({ guestName: "Confirmed Guest", status: "Confirmed", unitCodes: ["C1"] }),
        makeBooking({ guestName: "CheckedIn Guest", status: "CheckedIn", unitCodes: ["C1"] }),
      ];
      const { container } = render(<BookingIndicators bookings={bookings} />);

      const nameSpan = container.querySelector(".font-sans.truncate");
      expect(nameSpan).toHaveTextContent("CheckedIn Guest");
    });

    it("should pick Confirmed over Pending for the same unit", () => {
      const bookings = [
        makeBooking({ guestName: "Pending Guest", status: "Pending", unitCodes: ["C2"] }),
        makeBooking({ guestName: "Confirmed Guest", status: "Confirmed", unitCodes: ["C2"] }),
      ];
      const { container } = render(<BookingIndicators bookings={bookings} />);

      const nameSpan = container.querySelector(".font-sans.truncate");
      expect(nameSpan).toHaveTextContent("Confirmed Guest");
    });

    it("should reflect the winning booking's guest name in the chip's aria-label", () => {
      const bookings = [
        makeBooking({ guestName: "Low Priority", status: "Cancelled", unitCodes: ["C3"] }),
        makeBooking({ guestName: "High Priority", status: "CheckedIn", unitCodes: ["C3"] }),
      ];
      const { container } = render(<BookingIndicators bookings={bookings} />);

      const [chip] = getChips(container);
      expect(chip).toHaveAttribute("aria-label", "C3: High Priority");
    });

    it("should resolve priorities independently per slot", () => {
      const bookings = [
        makeBooking({ guestName: "Alice", status: "Pending", unitCodes: ["C1"] }),
        makeBooking({ guestName: "Bob", status: "CheckedIn", unitCodes: ["C1"] }),
        makeBooking({ guestName: "Carol", status: "Confirmed", unitCodes: ["C2"] }),
      ];
      const { container } = render(<BookingIndicators bookings={bookings} />);

      const monoSpans = container.querySelectorAll(".font-mono");
      const nameSpans = container.querySelectorAll(".font-sans.truncate");

      // C1 slot: Bob (CheckedIn > Pending)
      expect(monoSpans[0]).toHaveTextContent("C1");
      expect(nameSpans[0]).toHaveTextContent("Bob");

      // C2 slot: Carol
      expect(monoSpans[1]).toHaveTextContent("C2");
      expect(nameSpans[1]).toHaveTextContent("Carol");
    });
  });

  // ─── Multi-unit bookings ───
  describe("Multi-unit bookings", () => {
    it("should fill 2 slots for a 2-unit booking", () => {
      const booking = makeBooking({ guestName: "Multi Guest", unitCodes: ["C1", "C3"] });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      expect(getChips(container)).toHaveLength(2);

      // 1 placeholder for C2
      const placeholders = container.querySelectorAll('[aria-hidden="true"]');
      expect(placeholders).toHaveLength(1);
    });

    it("should fill all 3 slots for a 3-unit booking", () => {
      const booking = makeBooking({ guestName: "Full House", unitCodes: ["C1", "C2", "C3"] });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      expect(getChips(container)).toHaveLength(3);

      const placeholders = container.querySelectorAll('[aria-hidden="true"]');
      expect(placeholders).toHaveLength(0);
    });

    it("should show the same guest name in all occupied slots", () => {
      const booking = makeBooking({ guestName: "Same Guest", unitCodes: ["C1", "C2"] });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const nameSpans = container.querySelectorAll(".font-sans.truncate");
      expect(nameSpans).toHaveLength(2);
      expect(nameSpans[0]).toHaveTextContent("Same Guest");
      expect(nameSpans[1]).toHaveTextContent("Same Guest");
    });

    it("should apply correct per-unit colors for a multi-unit booking", () => {
      const booking = makeBooking({ unitCodes: ["C1", "C3"] });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const chips = getChips(container);
      // First chip should be C1 (blue), second should be C3 (amber)
      expect(chips[0]).toHaveClass("bg-blue-100");
      expect(chips[1]).toHaveClass("bg-amber-100");
    });
  });

  // ─── Edge cases ───
  describe("Edge cases", () => {
    it("should ignore unknown unit codes", () => {
      const booking = makeBooking({ unitCodes: ["C1", "X99"] });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const chips = getChips(container);
      expect(chips).toHaveLength(1);
      expect(chips[0]).toHaveClass("bg-blue-100");
    });

    it("should handle bu.unit being null/undefined", () => {
      const booking = makeBooking({ unitCodes: [null] });
      const { container } = render(<BookingIndicators bookings={[booking]} />);
      expect(container.firstChild).toBeNull();
    });

    it("should handle mix of valid and invalid codes", () => {
      const booking = makeBooking({ unitCodes: ["INVALID", "C2", "ALSO_INVALID"] });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const chips = getChips(container);
      expect(chips).toHaveLength(1);
      expect(chips[0]).toHaveClass("bg-emerald-100");
    });

    it("should merge className prop onto the container", () => {
      const booking = makeBooking({ unitCodes: ["C1"] });
      const { container } = render(
        <BookingIndicators bookings={[booking]} className="custom-class mt-2" />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass("flex-col");
      expect(wrapper).toHaveClass("mt-2");
      expect(wrapper).toHaveClass("custom-class");
    });

    it("should render correctly with a single booking across separate renders", () => {
      const booking1 = makeBooking({ unitCodes: ["C1"], guestName: "First" });
      const booking2 = makeBooking({ unitCodes: ["C3"], guestName: "Second" });

      const { container, rerender } = render(<BookingIndicators bookings={[booking1]} />);

      let nameSpans = container.querySelectorAll(".font-sans.truncate");
      expect(nameSpans).toHaveLength(1);
      expect(nameSpans[0]).toHaveTextContent("First");

      rerender(<BookingIndicators bookings={[booking2]} />);

      nameSpans = container.querySelectorAll(".font-sans.truncate");
      expect(nameSpans).toHaveLength(1);
      expect(nameSpans[0]).toHaveTextContent("Second");
    });
  });
});

// ─────────────────────────────────────────────
// BookingCountBadge
// ─────────────────────────────────────────────

describe("BookingCountBadge", () => {
  it("should return null for count=0", () => {
    const { container } = render(<BookingCountBadge count={0} />);
    expect(container.firstChild).toBeNull();
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9])("should show exact count for %i", (count) => {
    render(<BookingCountBadge count={count} />);
    expect(screen.getByText(String(count))).toBeInTheDocument();
  });

  it('should show "9+" for count 10 or higher', () => {
    render(<BookingCountBadge count={10} />);
    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  it('should show "9+" for very large counts', () => {
    render(<BookingCountBadge count={999} />);
    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  it("should have correct styling classes", () => {
    const { container } = render(<BookingCountBadge count={3} />);
    const badge = container.firstChild as HTMLElement;

    expect(badge).toHaveClass("absolute");
    expect(badge).toHaveClass("rounded-full");
    expect(badge).toHaveClass("bg-blue-600");
    expect(badge).toHaveClass("text-white");
    expect(badge).toHaveClass("font-bold");
  });

  it("should merge className prop", () => {
    const { container } = render(<BookingCountBadge count={5} className="z-50" />);
    const badge = container.firstChild as HTMLElement;

    expect(badge).toHaveClass("rounded-full");
    expect(badge).toHaveClass("z-50");
  });

  it("should have shadow for visual depth", () => {
    const { container } = render(<BookingCountBadge count={2} />);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass("shadow-sm");
  });

  it("should pass accessibility check", async () => {
    const { container } = render(<BookingCountBadge count={5} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
