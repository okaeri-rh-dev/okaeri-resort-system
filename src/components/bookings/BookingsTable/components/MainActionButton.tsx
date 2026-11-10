import { useState, type ReactNode } from "react";

import { Button } from "@/components/patterns";
import { useUserRole } from "@/hooks";
import { mainActionFor, manilaDayOf, type MainAction } from "@/lib/bookings";
import type { Booking, BookingStatus } from "@/types";

import type { BookingCardProps } from "../types";
import { VerifyPaymentDialog } from "./VerifyPaymentDialog";

const NEXT_STATUS: Record<Exclude<MainAction, "Verify payment">, BookingStatus> = {
  Confirm: "Confirmed",
  "Check in": "CheckedIn",
  "Check out": "CheckedOut",
};

interface MainActionButtonProps {
  booking: Booking;
  updateBookingStatus: BookingCardProps["updateBookingStatus"];
  className?: string;
  /** Shown when the booking has no main action for this user. */
  fallback?: ReactNode;
}

export const MainActionButton = ({
  booking,
  updateBookingStatus,
  className,
  fallback = null,
}: MainActionButtonProps) => {
  const { role } = useUserRole();
  const [verifyOpen, setVerifyOpen] = useState(false);
  const action = mainActionFor(booking, role, manilaDayOf(new Date()));
  if (!action) return fallback;

  if (action === "Verify payment") {
    return (
      <>
        <Button onClick={() => setVerifyOpen(true)} size="sm" className={className}>
          {action}
        </Button>
        <VerifyPaymentDialog booking={booking} open={verifyOpen} onOpenChange={setVerifyOpen} />
      </>
    );
  }

  return (
    <Button
      onClick={() =>
        updateBookingStatus.mutate({ bookingId: booking.booking_id, status: NEXT_STATUS[action] })
      }
      size="sm"
      className={className}
    >
      {action}
    </Button>
  );
};
