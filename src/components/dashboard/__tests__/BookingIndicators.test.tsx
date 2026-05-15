/**
 * Component Tests for BookingIndicators and BookingCountBadge
 *
 * Tests the fixed 3-slot vertical lane layout used in the DashboardCalendar.
 * Each unit (C1/C2/C3) gets a fixed position with dedicated colors.
 *
 * Test Coverage:
 * - Null/empty returns
 * - Fixed 3-slot layout with invisible placeholders
 * - Mobile thin bars (sm:hidden) and desktop chips (sm:flex)
 * - Status hint modifier classes on both mobile/desktop elements
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

  // ─── Mobile rendering ───
  describe("Mobile rendering", () => {
    it("should render a mobile bar with sm:hidden class", () => {
      const booking = makeBooking({ unitCodes: ["C1"], guestName: "Alice" });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const mobileBar = container.querySelector(".sm\\:hidden");
      expect(mobileBar).toBeInTheDocument();
    });

    it("should apply correct mobile bar color for C1 (blue)", () => {
      const booking = makeBooking({ unitCodes: ["C1"] });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const mobileBar = container.querySelector(".sm\\:hidden");
      expect(mobileBar).toHaveClass("bg-blue-400");
    });

    it("should apply correct mobile bar color for C2 (emerald)", () => {
      const booking = makeBooking({ unitCodes: ["C2"] });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const mobileBar = container.querySelector(".sm\\:hidden");
      expect(mobileBar).toHaveClass("bg-emerald-400");
    });

    it("should apply correct mobile bar color for C3 (amber)", () => {
      const booking = makeBooking({ unitCodes: ["C3"] });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const mobileBar = container.querySelector(".sm\\:hidden");
      expect(mobileBar).toHaveClass("bg-amber-400");
    });

    it("should have aria-label with unit code and guest name", () => {
      const booking = makeBooking({ unitCodes: ["C1"], guestName: "Maria Santos" });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const mobileBar = container.querySelector(".sm\\:hidden");
      expect(mobileBar).toHaveAttribute("aria-label", "C1: Maria Santos");
    });

    it("should render mobile bar with rounded-sm class", () => {
      const booking = makeBooking({ unitCodes: ["C1"] });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const mobileBar = container.querySelector(".sm\\:hidden");
      expect(mobileBar).toHaveClass("rounded-sm");
    });
  });

  // ─── Desktop rendering ───
  describe("Desktop rendering", () => {
    it("should render a desktop chip with hidden sm:flex classes", () => {
      const booking = makeBooking({ unitCodes: ["C1"] });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const desktopChip = container.querySelector(".sm\\:flex");
      expect(desktopChip).toBeInTheDocument();
      expect(desktopChip).toHaveClass("hidden");
    });

    it("should apply correct desktop bg/text/border for C1 (blue)", () => {
      const booking = makeBooking({ unitCodes: ["C1"] });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const chip = container.querySelector(".sm\\:flex");
      expect(chip).toHaveClass("bg-blue-100");
      expect(chip).toHaveClass("text-blue-800");
      expect(chip).toHaveClass("border-blue-300");
    });

    it("should apply correct desktop bg/text/border for C2 (emerald)", () => {
      const booking = makeBooking({ unitCodes: ["C2"] });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const chip = container.querySelector(".sm\\:flex");
      expect(chip).toHaveClass("bg-emerald-100");
      expect(chip).toHaveClass("text-emerald-800");
      expect(chip).toHaveClass("border-emerald-300");
    });

    it("should apply correct desktop bg/text/border for C3 (amber)", () => {
      const booking = makeBooking({ unitCodes: ["C3"] });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const chip = container.querySelector(".sm\\:flex");
      expect(chip).toHaveClass("bg-amber-100");
      expect(chip).toHaveClass("text-amber-800");
      expect(chip).toHaveClass("border-amber-300");
    });

    it("should display unit code in a font-mono span", () => {
      const booking = makeBooking({ unitCodes: ["C2"] });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const monoSpan = container.querySelector(".font-mono");
      expect(monoSpan).toBeInTheDocument();
      expect(monoSpan).toHaveTextContent("C2");
    });

    it("should display guest name in a truncated font-sans span", () => {
      const booking = makeBooking({ unitCodes: ["C1"], guestName: "Juan dela Cruz" });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const nameSpan = container.querySelector(".font-sans.truncate");
      expect(nameSpan).toBeInTheDocument();
      expect(nameSpan).toHaveTextContent("Juan dela Cruz");
    });

    it("should have border and rounded-sm styling on the chip", () => {
      const booking = makeBooking({ unitCodes: ["C1"] });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const chip = container.querySelector(".sm\\:flex");
      expect(chip).toHaveClass("border");
      expect(chip).toHaveClass("rounded-sm");
    });
  });

  // ─── Status hints ───
  describe("Status hints on elements", () => {
    it("should apply no modifier classes for Confirmed status", () => {
      const booking = makeBooking({ unitCodes: ["C1"], status: "Confirmed" });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const mobileBar = container.querySelector(".sm\\:hidden");
      const chip = container.querySelector(".sm\\:flex");

      expect(mobileBar).not.toHaveClass("bg-white");
      expect(mobileBar).not.toHaveClass("border-dashed");
      expect(chip).not.toHaveClass("bg-white");
    });

    it("should apply no modifier classes for CheckedIn status", () => {
      const booking = makeBooking({ unitCodes: ["C1"], status: "CheckedIn" });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const mobileBar = container.querySelector(".sm\\:hidden");
      expect(mobileBar).not.toHaveClass("opacity-70");
      expect(mobileBar).not.toHaveClass("opacity-50");
      expect(mobileBar).not.toHaveClass("opacity-30");
    });

    it("should apply opacity-70 and preserve unit color for Pending on mobile bar", () => {
      const booking = makeBooking({ unitCodes: ["C1"], status: "Pending" });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const mobileBar = container.querySelector(".sm\\:hidden");
      expect(mobileBar).toHaveClass("opacity-70");
      expect(mobileBar).toHaveClass("bg-blue-400"); // unit color preserved
      expect(mobileBar).not.toHaveClass("bg-white");
    });

    it("should apply bg-white, border-2, dashed and darker border for Pending on desktop chip", () => {
      const booking = makeBooking({ unitCodes: ["C1"], status: "Pending" });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const chip = container.querySelector(".sm\\:flex");
      expect(chip).toHaveClass("bg-white");
      expect(chip).toHaveClass("border-2");
      expect(chip).toHaveClass("border-dashed");
      expect(chip).toHaveClass("border-blue-600"); // higher-contrast unit shade
      expect(chip).not.toHaveClass("border-blue-300"); // baseline shade not applied
    });

    it("should apply opacity-50 for CheckedOut on both elements", () => {
      const booking = makeBooking({ unitCodes: ["C2"], status: "CheckedOut" });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const mobileBar = container.querySelector(".sm\\:hidden");
      const chip = container.querySelector(".sm\\:flex");
      expect(mobileBar).toHaveClass("opacity-50");
      expect(chip).toHaveClass("opacity-50");
    });

    it("should apply opacity-30 (mobile bar) and opacity-30 + line-through (chip) for Cancelled", () => {
      const booking = makeBooking({ unitCodes: ["C3"], status: "Cancelled" });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const mobileBar = container.querySelector(".sm\\:hidden");
      const chip = container.querySelector(".sm\\:flex");
      expect(mobileBar).toHaveClass("opacity-30");
      // line-through is omitted on the bar (no text to strike through)
      expect(chip).toHaveClass("opacity-30");
      expect(chip).toHaveClass("line-through");
    });

    it("should apply Pending hint when booking_status is null (defaults to Pending)", () => {
      const booking = makeBooking({ unitCodes: ["C1"], status: "Confirmed" });
      booking.booking_status = null;
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const mobileBar = container.querySelector(".sm\\:hidden");
      const chip = container.querySelector(".sm\\:flex");
      expect(mobileBar).toHaveClass("opacity-70");
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

    it("should render the winning booking's guest name in the aria-label", () => {
      const bookings = [
        makeBooking({ guestName: "Low Priority", status: "Cancelled", unitCodes: ["C3"] }),
        makeBooking({ guestName: "High Priority", status: "CheckedIn", unitCodes: ["C3"] }),
      ];
      const { container } = render(<BookingIndicators bookings={bookings} />);

      const mobileBar = container.querySelector(".sm\\:hidden");
      expect(mobileBar).toHaveAttribute("aria-label", "C3: High Priority");
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

      const mobileBars = container.querySelectorAll(".sm\\:hidden");
      expect(mobileBars).toHaveLength(2);

      // 1 placeholder for C2
      const placeholders = container.querySelectorAll('[aria-hidden="true"]');
      expect(placeholders).toHaveLength(1);
    });

    it("should fill all 3 slots for a 3-unit booking", () => {
      const booking = makeBooking({ guestName: "Full House", unitCodes: ["C1", "C2", "C3"] });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const mobileBars = container.querySelectorAll(".sm\\:hidden");
      expect(mobileBars).toHaveLength(3);

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

      const mobileBars = container.querySelectorAll(".sm\\:hidden");
      // First bar should be C1 (blue), second should be C3 (amber)
      expect(mobileBars[0]).toHaveClass("bg-blue-400");
      expect(mobileBars[1]).toHaveClass("bg-amber-400");
    });
  });

  // ─── Edge cases ───
  describe("Edge cases", () => {
    it("should ignore unknown unit codes", () => {
      const booking = makeBooking({ unitCodes: ["C1", "X99"] });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      // Only C1 should render a mobile bar
      const mobileBars = container.querySelectorAll(".sm\\:hidden");
      expect(mobileBars).toHaveLength(1);
      expect(mobileBars[0]).toHaveClass("bg-blue-400");
    });

    it("should handle bu.unit being null/undefined", () => {
      const booking = makeBooking({ unitCodes: [null] });
      const { container } = render(<BookingIndicators bookings={[booking]} />);
      expect(container.firstChild).toBeNull();
    });

    it("should handle mix of valid and invalid codes", () => {
      const booking = makeBooking({ unitCodes: ["INVALID", "C2", "ALSO_INVALID"] });
      const { container } = render(<BookingIndicators bookings={[booking]} />);

      const mobileBars = container.querySelectorAll(".sm\\:hidden");
      expect(mobileBars).toHaveLength(1);
      expect(mobileBars[0]).toHaveClass("bg-emerald-400");
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
