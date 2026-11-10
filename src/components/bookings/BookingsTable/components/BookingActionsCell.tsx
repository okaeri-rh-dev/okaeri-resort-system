import type { Booking, BookingStatus } from "@/types";

import { BookingOverflowMenu } from "./BookingOverflowMenu";
import { MainActionButton } from "./MainActionButton";

// Type for TanStack Query mutation objects (simplified from UseMutationResult)
interface MutationObject<TVariables = unknown> {
  mutate: (variables: TVariables) => void;
  [key: string]: unknown; // Allow other mutation properties
}

interface BookingActionsCellProps {
  booking: Booking;
  updateBookingStatus: MutationObject<{ bookingId: string; status: BookingStatus }>;
  cancelBooking: MutationObject<string>;
  handleUploadPayment: (booking: Booking) => void;
}

export const BookingActionsCell: React.FC<BookingActionsCellProps> = ({
  booking,
  updateBookingStatus,
  cancelBooking,
  handleUploadPayment,
}) => (
  <div className="flex items-center justify-end gap-2">
    <MainActionButton
      booking={booking}
      updateBookingStatus={updateBookingStatus}
      onRecordPayment={() => handleUploadPayment(booking)}
    />
    <BookingOverflowMenu
      booking={booking}
      updateBookingStatus={updateBookingStatus}
      onRecordPayment={() => handleUploadPayment(booking)}
      onCancel={() => cancelBooking.mutate(booking.booking_id)}
    />
  </div>
);
