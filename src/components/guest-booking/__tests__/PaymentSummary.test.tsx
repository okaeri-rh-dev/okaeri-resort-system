import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PaymentSummary } from "../PaymentSummary";

// Mock API client
vi.mock("@/lib/api/guest-booking-client", () => ({
  previewPricing: vi.fn(() =>
    Promise.resolve({
      success: true,
      pricing: {
        nights: 7,
        total_units: 2,
        total_guests: 5,
        base_total: 28000,
        weekend_surcharge: 2000,
        extra_person_fees: 900,
        subtotal: 30900,
        discount: {
          percent: 5,
          amount: 1545,
          rule_name: "7-Night Discount",
        },
        total: 29355,
        downpayment_required: 14677.5,
        downpayment_percent: 50,
      },
    })
  ),
}));

describe("PaymentSummary", () => {
  const checkIn = new Date("2025-02-01");
  const checkOut = new Date("2025-02-08");
  const unitRequests = [{ guests_per_unit: 2 }, { guests_per_unit: 3 }];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows empty state when no units selected", () => {
    render(<PaymentSummary unitRequests={[]} checkIn={checkIn} checkOut={checkOut} />);

    expect(screen.getByText(/add units to see pricing/i)).toBeInTheDocument();
  });

  it("shows empty state when checkIn is undefined", () => {
    render(<PaymentSummary unitRequests={unitRequests} checkIn={undefined} checkOut={checkOut} />);

    expect(screen.getByText(/add units to see pricing/i)).toBeInTheDocument();
  });

  it("shows empty state when checkOut is undefined", () => {
    render(<PaymentSummary unitRequests={unitRequests} checkIn={checkIn} checkOut={undefined} />);

    expect(screen.getByText(/add units to see pricing/i)).toBeInTheDocument();
  });

  it("displays pricing breakdown after loading", async () => {
    render(<PaymentSummary unitRequests={unitRequests} checkIn={checkIn} checkOut={checkOut} />);

    await waitFor(() => {
      expect(screen.getByText("Booking Summary")).toBeInTheDocument();
    });

    // Check stay details
    expect(screen.getByText("2")).toBeInTheDocument(); // 2 units
    expect(screen.getByText("5")).toBeInTheDocument(); // 5 guests
    expect(screen.getByText("7")).toBeInTheDocument(); // 7 nights

    // Check pricing components
    expect(screen.getByText(/₱28,000/)).toBeInTheDocument(); // Base total
    expect(screen.getByText(/₱2,000/)).toBeInTheDocument(); // Weekend surcharge
    expect(screen.getByText(/₱900/)).toBeInTheDocument(); // Extra person fees
    expect(screen.getByText(/₱30,900/)).toBeInTheDocument(); // Subtotal
  });

  it("displays discount when applicable", async () => {
    render(<PaymentSummary unitRequests={unitRequests} checkIn={checkIn} checkOut={checkOut} />);

    await waitFor(() => {
      expect(screen.getByText(/7-Night Discount/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/5%/)).toBeInTheDocument(); // Discount percent
    expect(screen.getByText(/-₱1,545/)).toBeInTheDocument(); // Discount amount
  });

  it("displays total and downpayment", async () => {
    render(<PaymentSummary unitRequests={unitRequests} checkIn={checkIn} checkOut={checkOut} />);

    await waitFor(() => {
      expect(screen.getByText(/₱29,355/)).toBeInTheDocument(); // Total
    });

    expect(screen.getByText(/₱14,677.5/)).toBeInTheDocument(); // Downpayment (50%)
    expect(screen.getByText(/50%/)).toBeInTheDocument(); // Downpayment percent
  });

  it("shows preview warning banner", async () => {
    render(<PaymentSummary unitRequests={unitRequests} checkIn={checkIn} checkOut={checkOut} />);

    await waitFor(() => {
      expect(screen.getByText(/preview only/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/final pricing calculated by server/i)).toBeInTheDocument();
  });

  it("shows admin assignment notice", async () => {
    render(<PaymentSummary unitRequests={unitRequests} checkIn={checkIn} checkOut={checkOut} />);

    await waitFor(() => {
      expect(screen.getByText(/downpayment secures your booking/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/admin assigns specific units/i)).toBeInTheDocument();
  });

  it("handles API errors gracefully", async () => {
    const { previewPricing } = await import("@/lib/api/guest-booking-client");
    vi.mocked(previewPricing).mockRejectedValueOnce(new Error("Network error"));

    render(<PaymentSummary unitRequests={unitRequests} checkIn={checkIn} checkOut={checkOut} />);

    await waitFor(() => {
      expect(screen.getByText(/unable to calculate pricing/i)).toBeInTheDocument();
    });
  });

  it("does not show weekend surcharge if zero", async () => {
    const { previewPricing } = await import("@/lib/api/guest-booking-client");
    vi.mocked(previewPricing).mockResolvedValueOnce({
      success: true,
      pricing: {
        nights: 3,
        total_units: 1,
        total_guests: 2,
        base_total: 6000,
        weekend_surcharge: 0, // No weekend nights
        extra_person_fees: 0,
        subtotal: 6000,
        total: 6000,
        downpayment_required: 3000,
        downpayment_percent: 50,
      },
    });

    render(
      <PaymentSummary
        unitRequests={[{ guests_per_unit: 2 }]}
        checkIn={checkIn}
        checkOut={checkOut}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Booking Summary")).toBeInTheDocument();
    });

    // Weekend surcharge should not be displayed
    expect(screen.queryByText(/weekend surcharge/i)).not.toBeInTheDocument();
  });

  it("does not show extra person fees if zero", async () => {
    const { previewPricing } = await import("@/lib/api/guest-booking-client");
    vi.mocked(previewPricing).mockResolvedValueOnce({
      success: true,
      pricing: {
        nights: 3,
        total_units: 1,
        total_guests: 2,
        base_total: 6000,
        weekend_surcharge: 0,
        extra_person_fees: 0, // Within base occupancy
        subtotal: 6000,
        total: 6000,
        downpayment_required: 3000,
        downpayment_percent: 50,
      },
    });

    render(
      <PaymentSummary
        unitRequests={[{ guests_per_unit: 2 }]}
        checkIn={checkIn}
        checkOut={checkOut}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Booking Summary")).toBeInTheDocument();
    });

    // Extra person fees should not be displayed
    expect(screen.queryByText(/extra person fees/i)).not.toBeInTheDocument();
  });

  it("does not show discount section when no discount applied", async () => {
    const { previewPricing } = await import("@/lib/api/guest-booking-client");
    vi.mocked(previewPricing).mockResolvedValueOnce({
      success: true,
      pricing: {
        nights: 2,
        total_units: 1,
        total_guests: 2,
        base_total: 4000,
        weekend_surcharge: 0,
        extra_person_fees: 0,
        subtotal: 4000,
        // No discount field
        total: 4000,
        downpayment_required: 2000,
        downpayment_percent: 50,
      },
    });

    render(
      <PaymentSummary
        unitRequests={[{ guests_per_unit: 2 }]}
        checkIn={checkIn}
        checkOut={checkOut}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Booking Summary")).toBeInTheDocument();
    });

    // Discount section should not be displayed
    expect(screen.queryByText(/discount/i)).not.toBeInTheDocument();
  });
});
