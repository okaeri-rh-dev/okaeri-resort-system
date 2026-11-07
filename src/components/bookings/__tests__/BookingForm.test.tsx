/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BookingForm } from "../BookingForm";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: () => Promise.resolve({ data: { session: null } }) } },
}));

vi.mock("@/hooks/useMultiUnitBookingQueries", () => ({
  useMultiUnitAvailability: () => ({ data: undefined, isFetching: false, isError: false }),
}));

vi.mock("@/stores/useBookingStore", () => ({
  useCreateBooking: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/usePricingConfig", () => ({
  usePricingConfig: () => ({
    data: { base_rate: 3000, weekend_rate: 3500, extra_person_rate: 500, base_occupancy: 2 },
  }),
}));

const UNIT_ID = "11111111-1111-4111-8111-111111111111";

// The unit's own rates differ from pricing_config, as Cabin 1 does in seed.sql.
vi.mock("@/stores/useUnitStore", () => ({
  useUnits: () => ({
    isLoading: false,
    data: [
      {
        unit_id: UNIT_ID,
        unit_name: "Cabin 1",
        unit_type: "Standard",
        base_rate: 9000,
        weekend_rate: 9000,
        extra_person_rate: 1000,
        base_occupancy: 6,
        max_occupancy: 8,
      },
    ],
  }),
}));

// One Friday night at pricing_config rates: ₱3,500 room + 2 extra persons × ₱500.
const PRICING_RESPONSE = {
  success: true,
  notice: null,
  calculated_at: new Date().toISOString(),
  pricing: {
    nights: 1,
    nightlyBreakdown: [],
    subtotal: 3500,
    extraPersons: 2,
    extraPersonTotal: 1000,
    total: 4500,
    downpayment: 2250,
    balance: 2250,
    currency: "PHP",
  },
};

function renderForm() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <BookingForm
        initialData={{
          unit_id: UNIT_ID,
          check_in: new Date(2026, 10, 13),
          check_out: new Date(2026, 10, 14),
          num_guests: 4,
          guest_name: "Test Guest",
          email: "guest@example.com",
          contact_number: "09171234567",
          payment_method: "Cash",
        }}
      />
    </QueryClientProvider>
  );
}

describe("BookingForm pricing", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify(PRICING_RESPONSE))))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows pricing_config rates, not the unit's own, while picking a unit", async () => {
    renderForm();

    expect(await screen.findByText(/Base occupancy: 2 guests/)).toBeInTheDocument();
    expect(screen.getByText(/Extra person rate: ₱500.00/)).toBeInTheDocument();
    expect(screen.getByText("₱3,000.00/night")).toBeInTheDocument();
  });

  it("shows the room-rate and extra-person lines from the pricing response", async () => {
    const user = userEvent.setup();
    renderForm();

    await screen.findByText("₱4,500.00");
    for (let step = 0; step < 3; step++) {
      await user.click(screen.getByRole("button", { name: "Next" }));
    }

    const breakdown = (await screen.findByText("Pricing Breakdown")).parentElement!;
    expect(within(breakdown).getByText(/Room rate/).nextSibling).toHaveTextContent("₱3,500.00");
    expect(within(breakdown).getByText(/Extra person/).nextSibling).toHaveTextContent("₱1,000.00");
    expect(screen.getByText("Total Amount:").nextSibling).toHaveTextContent("₱4,500.00");
  });
});
