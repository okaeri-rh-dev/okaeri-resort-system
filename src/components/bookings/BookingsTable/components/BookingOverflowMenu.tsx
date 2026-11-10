import { useState } from "react";

import { useNavigate } from "@tanstack/react-router";

import {
  ActionMenu,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  type ActionMenuAction,
} from "@/components/patterns";
import { useUserRole } from "@/hooks";
import { manilaDayOf, overflowActionsFor, type OverflowAction } from "@/lib/bookings";
import type { Booking } from "@/types";

import type { BookingCardProps } from "../types";

interface BookingOverflowMenuProps {
  booking: Booking;
  updateBookingStatus: BookingCardProps["updateBookingStatus"];
  onRecordPayment: () => void;
  onCancel: () => void;
}

export const BookingOverflowMenu = ({
  booking,
  updateBookingStatus,
  onRecordPayment,
  onCancel,
}: BookingOverflowMenuProps) => {
  const navigate = useNavigate();
  const { role, userId } = useUserRole();
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const now = new Date();
  const items = overflowActionsFor(booking, role, manilaDayOf(now), userId, now);
  if (items.length === 0) return null;

  const bookingId = booking.booking_id;
  const run: Record<OverflowAction, () => void> = {
    "Record payment": onRecordPayment,
    Edit: () => void navigate({ to: "/admin/bookings/$bookingId/edit", params: { bookingId } }),
    "Undo check-in": () => updateBookingStatus.mutate({ bookingId, status: "Confirmed" }),
    "Undo check-out": () => updateBookingStatus.mutate({ bookingId, status: "CheckedIn" }),
    Cancel: () => setShowCancelDialog(true),
  };
  const actions: ActionMenuAction[] = items.map((label) => ({
    label,
    onClick: run[label],
    ...(label === "Cancel" && { variant: "destructive" as const }),
  }));

  return (
    <>
      <ActionMenu actions={actions} label={`Actions for ${booking.booking_reference}`} />

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel booking</AlertDialogTitle>
            <AlertDialogDescription>
              {booking.booking_reference} will be cancelled and its unit freed for these days. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep booking</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onCancel();
                setShowCancelDialog(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
