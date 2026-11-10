import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUpdateBookingStatus } from "@/hooks/useBookings";
import { afterWrite } from "@/lib/after-write";
import { setBookingStatus } from "@/lib/bookings";
import { bookingKeys } from "@/lib/query-keys";

vi.mock("@/lib/after-write", () => ({ afterWrite: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/supabase", () => ({ db: {}, supabase: {}, handleSupabaseError: vi.fn() }));
vi.mock("@/lib/bookings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/bookings")>()),
  setBookingStatus: vi.fn(),
}));

const ana = { booking_id: "b1", booking_reference: "OKR-1", booking_status: "Confirmed" };
const ben = { booking_id: "b2", booking_reference: "OKR-2", booking_status: "Confirmed" };
const list = bookingKeys.lists();

describe("useUpdateBookingStatus", () => {
  let queryClient: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    queryClient.setQueryData(list, [ana, ben]);
  });

  it.each([
    { outcome: "succeeds", status: "CheckedIn", failure: null },
    { outcome: "fails", status: "Confirmed", failure: new Error("Cannot change") },
  ])("patches the bookings list before the change $outcome", async ({ status, failure }) => {
    let finishChange!: () => void;
    vi.mocked(setBookingStatus).mockReturnValue(
      new Promise((resolve, reject) => {
        finishChange = () =>
          failure ? reject(failure) : resolve({ ...ana, booking_status: "CheckedIn" } as never);
      })
    );
    const { result } = renderHook(() => useUpdateBookingStatus(), { wrapper });

    result.current.mutate({ bookingId: "b1", status: "CheckedIn" });

    await waitFor(() =>
      expect(queryClient.getQueryData(list)).toEqual([{ ...ana, booking_status: "CheckedIn" }, ben])
    );

    finishChange();

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(queryClient.getQueryData(list)).toEqual([{ ...ana, booking_status: status }, ben]);
    expect(vi.mocked(toast.error).mock.calls.length).toBe(failure ? 1 : 0);
    expect(afterWrite).toHaveBeenCalledWith("bookings");
  });
});
