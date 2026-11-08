import { vi } from "vitest";

import type { Booking } from "@/types";

// Replaces the booking store's query and mutation hooks, keeping the real zustand store:
// vi.mock("@/stores/useBookingStore", async (importOriginal) => ({
//   ...(await importOriginal<typeof import("@/stores/useBookingStore")>()),
//   ...(await import("@/test/booking-store-stub")).bookingStoreHookStubs([]),
// }))
export function bookingStoreHookStubs(bookings: Booking[]) {
  const noopMutation = { mutate: vi.fn() };
  const bookingsResult = { data: bookings, isLoading: false, error: null };
  return {
    useBookings: () => bookingsResult,
    useCancelBooking: () => noopMutation,
    useUpdateBookingStatus: () => noopMutation,
    useUploadPaymentProof: () => noopMutation,
  };
}
