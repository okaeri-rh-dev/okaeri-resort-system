import { useNavigate } from "@tanstack/react-router";

import { ActionMenu } from "@/components/tables/utils";
import type { Booking, BookingStatus } from "@/types";

// Type for TanStack Query mutation objects (simplified from UseMutationResult)
interface MutationObject<TVariables = unknown> {
  mutate: (variables: TVariables) => void;
  [key: string]: unknown; // Allow other mutation properties
}

interface BookingActionsCellProps {
  booking: Booking;
  updateBookingStatus: MutationObject<{ bookingId: string; status: BookingStatus }>;
  cancelBooking: MutationObject<string>;
  deleteBooking: MutationObject<string>;
  handleUploadPayment: (booking: Booking) => void;
}

export const BookingActionsCell: React.FC<BookingActionsCellProps> = ({
  booking,
  updateBookingStatus,
  cancelBooking,
  deleteBooking,
  handleUploadPayment,
}) => {
  const navigate = useNavigate();

  const actions = [
    {
      label: "Edit Booking",
      onClick: () => {
        navigate({
          to: "/admin/bookings/$bookingId/edit",
          params: { bookingId: booking.booking_id },
        });
      },
    },
    ...(booking.payment_status !== "Completed"
      ? [
          {
            label: "Upload Payment",
            onClick: () => handleUploadPayment(booking),
          },
        ]
      : []),
    ...(booking.booking_status === "Pending"
      ? [
          {
            label: "Confirm",
            onClick: () => {
              updateBookingStatus.mutate({
                bookingId: booking.booking_id,
                status: "Confirmed" as BookingStatus,
              });
            },
          },
        ]
      : []),
    ...(booking.booking_status !== "Cancelled"
      ? [
          {
            label: "Cancel",
            onClick: () => {
              cancelBooking.mutate(booking.booking_id);
            },
            variant: "destructive" as const,
          },
        ]
      : []),
    {
      label: "Delete",
      onClick: () => {
        if (
          confirm(
            `Are you sure you want to permanently delete booking "${booking.booking_reference}"? This action cannot be undone.`
          )
        ) {
          deleteBooking.mutate(booking.booking_id);
        }
      },
      variant: "destructive" as const,
    },
  ];

  return <ActionMenu actions={actions} />;
};
