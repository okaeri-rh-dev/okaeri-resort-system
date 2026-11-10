import type { ReactNode } from "react";

import { useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/patterns";
import { useUserRole } from "@/hooks";
import { mainActionFor, manilaDayOf, type MainAction } from "@/lib/bookings";
import type { Booking, BookingStatus } from "@/types";

import type { BookingCardProps } from "../types";

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
  const navigate = useNavigate();
  const { role } = useUserRole();
  const action = mainActionFor(booking, role, manilaDayOf(new Date()));
  if (!action) return fallback;

  const run = () => {
    if (action === "Verify payment") {
      navigate({
        to: "/admin/verify-payment/$bookingId",
        params: { bookingId: booking.booking_id },
      });
      return;
    }
    updateBookingStatus.mutate({ bookingId: booking.booking_id, status: NEXT_STATUS[action] });
  };

  return (
    <Button onClick={run} size="sm" className={className}>
      {action}
    </Button>
  );
};
