import { useCallback, useState } from "react";

import { useNavigate } from "@tanstack/react-router";

import { ActionMenu } from "@/components/tables/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useUserRole } from "@/hooks";
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
  const { canEdit, canDelete, canConfirmBookings } = useUserRole();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const confirmDelete = useCallback(() => {
    deleteBooking.mutate(booking.booking_id);
    setShowDeleteDialog(false);
  }, [deleteBooking, booking.booking_id]);

  // Build all possible actions
  const allActions = [
    // Edit - requires canEdit permission
    ...(canEdit
      ? [
          {
            label: "Edit Booking",
            onClick: () => {
              navigate({
                to: "/admin/bookings/$bookingId/edit",
                params: { bookingId: booking.booking_id },
              });
            },
          },
        ]
      : []),
    // Upload Payment - always visible (staff can upload on behalf of guests)
    ...(booking.payment_status !== "Completed"
      ? [
          {
            label: "Upload Payment",
            onClick: () => handleUploadPayment(booking),
          },
        ]
      : []),
    // Confirm - requires canConfirmBookings permission
    ...(canConfirmBookings && booking.booking_status === "Pending"
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
    // Cancel - requires canEdit permission
    ...(canEdit && booking.booking_status !== "Cancelled"
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
    // Delete - requires canDelete permission (owner+)
    ...(canDelete
      ? [
          {
            label: "Delete",
            onClick: () => setShowDeleteDialog(true),
            variant: "destructive" as const,
          },
        ]
      : []),
  ];

  // If no actions are available (shouldn't happen, but safety check)
  if (allActions.length === 0) {
    return null;
  }

  return (
    <>
      <ActionMenu actions={allActions} />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Booking</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete booking &quot;
              {booking.booking_reference}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
