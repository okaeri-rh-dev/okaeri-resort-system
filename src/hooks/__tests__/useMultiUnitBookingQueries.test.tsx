import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";

import { useMultiUnitBookingStore } from "@/stores/useMultiUnitBookingStore";

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
    act(() => useMultiUnitBookingStore.getState().setOnlineStatus(true));
  });

  it("rejects without sending the booking when offline", async () => {
    let requestCount = 0;
    server.use(
      http.post("*/api/bookings/multi-unit", () => {
        requestCount++;
        return HttpResponse.json({ data: { booking_id: "b-1" } });
      })
    );
    act(() => useMultiUnitBookingStore.getState().setOnlineStatus(false));

    const { result } = renderCreateHook();

    await expect(
      result.current.mutateAsync({ special_requests: "offline" })
    ).rejects.toBeInstanceOf(OfflineBookingError);
    expect(requestCount).toBe(0);
  });
});
