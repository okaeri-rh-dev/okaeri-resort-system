import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BookingReviewStep } from "../BookingReviewStep";

// West of UTC, so a UTC-midnight round trip would shift the picked days
process.env.TZ = "America/Los_Angeles";

describe("BookingReviewStep", () => {
  it("quotes the picked days in a US time zone", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        pricing: { nights: 2, total: 6000, downpayment: 3000 },
        calculated_at: new Date().toISOString(),
      }),
    });
    global.fetch = mockFetch;

    render(
      <QueryClientProvider client={new QueryClient()}>
        <BookingReviewStep
          formData={{
            // The date picker gives local midnight of the picked day (Fri to Sun)
            check_in: new Date(2027, 5, 11),
            check_out: new Date(2027, 5, 13),
            unit_requests: [{ guests_per_unit: 2 }],
          }}
          termsAccepted={false}
          onTermsChange={() => {}}
          turnstileToken="token"
          onTurnstileSuccess={() => {}}
        />
      </QueryClientProvider>
    );

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toMatchObject({ check_in: "2027-06-11", check_out: "2027-06-13" });
  });
});
