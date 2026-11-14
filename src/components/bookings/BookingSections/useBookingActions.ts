import { useCallback } from "react";

import {
  useCancelBooking,
  useUpdateBookingStatus,
  useUploadPaymentProof,
} from "@/hooks/useBookings";
import type { Booking } from "@/types";

/** The mutations behind the main action and overflow menu, shared by the list and the booking page. */
export const useBookingActions = () => {
  const updateBookingStatus = useUpdateBookingStatus();
  const uploadPaymentProof = useUploadPaymentProof();
  const cancelBooking = useCancelBooking();

  const handleUploadPayment = useCallback(
    (booking: Booking) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/jpeg";
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          uploadPaymentProof.mutate({
            bookingId: booking.booking_id,
            file,
          });
        }
      };
      input.click();
    },
    [uploadPaymentProof]
  );

  return { updateBookingStatus, cancelBooking, handleUploadPayment };
};
