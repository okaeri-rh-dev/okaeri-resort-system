import { useState, type ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@/components/patterns";
import { useUserRole } from "@/hooks";
import { mainActionFor, manilaDayOf, type MainAction, type UndoAction } from "@/lib/bookings";
import { outstandingBalance } from "@/lib/dashboard";
import { formatCurrency } from "@/lib/formatters";
import type { Booking, BookingStatus } from "@/types";

import type { BookingCardProps } from "../types";
import { VerifyPaymentDialog } from "./VerifyPaymentDialog";

const NEXT_STATUS: Record<Exclude<MainAction, "Verify payment">, BookingStatus> = {
  Confirm: "Confirmed",
  "Check in": "CheckedIn",
  "Check out": "CheckedOut",
};

// A check-out that leaves a balance offers no Undo
const undoOffer = (action: MainAction, booking: Booking): { undo?: UndoAction } => {
  if (action === "Check in") return { undo: "Undo check-in" };
  if (action === "Check out" && outstandingBalance(booking) === 0) {
    return { undo: "Undo check-out" };
  }
  return {};
};

interface MainActionButtonProps {
  booking: Booking;
  updateBookingStatus: BookingCardProps["updateBookingStatus"];
  onRecordPayment: () => void;
  className?: string;
  /** Shown when the booking has no main action for this user. */
  fallback?: ReactNode;
}

export const MainActionButton = ({
  booking,
  updateBookingStatus,
  onRecordPayment,
  className,
  fallback = null,
}: MainActionButtonProps) => {
  const { role } = useUserRole();
  const [askFirst, setAskFirst] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const action = mainActionFor(booking, role, manilaDayOf(new Date()));
  if (!action) return fallback;

  const balance = outstandingBalance(booking);
  const hasPayment = (booking.payments ?? []).some((payment) => payment.status === "Active");
  const needsWarning =
    (action === "Confirm" && !hasPayment) || (action === "Check out" && balance > 0);

  const move = () => {
    if (action === "Verify payment") {
      setVerifyOpen(true);
      return;
    }
    updateBookingStatus.mutate({
      bookingId: booking.booking_id,
      status: NEXT_STATUS[action],
      ...undoOffer(action, booking),
    });
  };

  return (
    <>
      <Button
        onClick={needsWarning ? () => setAskFirst(true) : move}
        size="sm"
        className={className}
      >
        {action}
      </Button>

      <AlertDialog open={askFirst} onOpenChange={setAskFirst}>
        <AlertDialogContent>
          {action === "Check out" ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{formatCurrency(balance)} due</AlertDialogTitle>
                <AlertDialogDescription>
                  {booking.guest_name} still owes {formatCurrency(balance)}. Record the payment
                  before check out?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={move}>Check out anyway</AlertDialogCancel>
                <AlertDialogAction onClick={onRecordPayment}>Record payment</AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>No payment recorded</AlertDialogTitle>
                <AlertDialogDescription>
                  {booking.booking_reference} has no payment yet. Confirm it anyway?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep pending</AlertDialogCancel>
                <AlertDialogAction onClick={move}>Confirm anyway</AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {action === "Verify payment" && (
        <VerifyPaymentDialog booking={booking} open={verifyOpen} onOpenChange={setVerifyOpen} />
      )}
    </>
  );
};
