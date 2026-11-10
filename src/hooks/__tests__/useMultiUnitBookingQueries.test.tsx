import React from "react";

import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import { server } from "../../../__tests__/mocks/server";
import { OfflineBookingError, useCreateMultiUnitBooking } from "../useMultiUnitBookingQueries";

const renderCreateHook = () => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useCreateMultiUnitBooking(), { wrapper });
};

describe("useCreateMultiUnitBooking", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    onlineManager.setOnline(true);
  });

  it("rejects at once without sending the booking when the browser is offline", async () => {
    let requestCount = 0;
    server.use(
      http.post("*/api/bookings/multi-unit", () => {
        requestCount++;
        return HttpResponse.json({ data: { booking_id: "b-1" } });
      })
    );
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    onlineManager.setOnline(false);

    const { result } = renderCreateHook();

    await expect(
      result.current.mutateAsync({
        primary_guest: { guest_name: "Guest", email: "", contact_number: "" },
        check_in: "2026-12-20",
        check_out: "2026-12-22",
        units: [{ unit_id: "u1", num_guests: 2 }],
      })
    ).rejects.toBeInstanceOf(OfflineBookingError);
    expect(requestCount).toBe(0);
  });
});
