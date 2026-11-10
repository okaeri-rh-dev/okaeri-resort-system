import { vi } from "vitest";

import type { Booking } from "@/types";

// Replaces the booking query and mutation hooks, keeping the rest of the module real:
// vi.mock("@/hooks/useBookings", async (importOriginal) => ({
//   ...(await importOriginal<typeof import("@/hooks/useBookings")>()),
//   ...(await import("@/test/booking-hook-stubs")).bookingHookStubs([]),
// }))
export function bookingHookStubs(bookings: Booking[]) {
  const noopMutation = { mutate: vi.fn() };
  const bookingsResult = { data: bookings, isLoading: false, error: null };
  return {
    useAllBookings: () => bookingsResult,
    useCancelBooking: () => noopMutation,
    useUpdateBookingStatus: () => noopMutation,
    useUploadPaymentProof: () => noopMutation,
  };
}
