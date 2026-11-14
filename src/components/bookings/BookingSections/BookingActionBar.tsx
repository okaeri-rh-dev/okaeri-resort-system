import { BookingOverflowMenu } from "@/components/bookings/BookingsTable/components/BookingOverflowMenu";
import { MainActionButton } from "@/components/bookings/BookingsTable/components/MainActionButton";
import type { BookingCardProps } from "@/components/bookings/BookingsTable/types";
import { useUserRole } from "@/hooks";
import { mainActionFor, manilaDayOf, overflowActionsFor } from "@/lib/bookings";
import { cn } from "@/lib/utils";
import type { Booking } from "@/types";

interface BookingActionBarProps {
  booking: Booking;
  updateBookingStatus: BookingCardProps["updateBookingStatus"];
  onRecordPayment: () => void;
  onCancel: () => void;
  /** Where the bar sits from expanded, where it stops being a fixed bottom bar. */
  className?: string;
}

/** The main action and overflow menu, fixed above the compact bottom nav. Anonymized bookings have none. */
export function BookingActionBar({
  booking,
  updateBookingStatus,
  onRecordPayment,
  onCancel,
  className,
}: BookingActionBarProps) {
  const { role, userId } = useUserRole();
  const now = new Date();
  const hasActions =
    !!mainActionFor(booking, role, manilaDayOf(now)) ||
    overflowActionsFor(booking, role, userId, now).length > 0;
  if (booking.anonymized_at || !hasActions) return null;

  return (
    <div
      className={cn(
        "bg-card shadow-popover medium:bottom-0 medium:left-20 medium:pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] fixed inset-x-0 bottom-(--admin-bottom-bar-height) z-30 flex items-center gap-2 border-t px-4 py-2",
        className
      )}
    >
      <MainActionButton
        booking={booking}
        updateBookingStatus={updateBookingStatus}
        onRecordPayment={onRecordPayment}
        className="flex-1"
      />
      <BookingOverflowMenu
        booking={booking}
        updateBookingStatus={updateBookingStatus}
        onRecordPayment={onRecordPayment}
        onCancel={onCancel}
      />
    </div>
  );
}
