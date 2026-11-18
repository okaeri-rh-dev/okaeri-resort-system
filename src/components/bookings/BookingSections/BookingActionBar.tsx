import { usePageBottomBarRef } from "@/components/patterns";
import { useUserRole } from "@/hooks";
import { mainActionFor, manilaDayOf, overflowActionsFor } from "@/lib/bookings";
import { cn } from "@/lib/utils";
import type { Booking } from "@/types";

import { BookingOverflowMenu } from "./BookingOverflowMenu";
import { MainActionButton } from "./MainActionButton";
import type { UpdateBookingStatus } from "./types";

interface BookingActionBarProps {
  booking: Booking;
  updateBookingStatus: UpdateBookingStatus;
  onRecordPayment: () => void;
  onCancel: () => void;
  placement: keyof typeof PLACEMENT_CLASSES;
}

const PLACEMENT_CLASSES = {
  // Fixed above the compact bottom nav, then at the top right of the page header from expanded
  page: "fixed inset-x-0 bottom-(--admin-bottom-bar-height) medium:bottom-0 medium:left-20 medium:pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] expanded:static expanded:w-72 expanded:shrink-0",
  // Last in the sheet and stuck to its bottom, then under the sheet header from expanded.
  // The negative offsets cancel SheetContent's p-6.
  sheet:
    "sticky -bottom-6 order-last -mx-6 -mb-6 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] expanded:static expanded:order-none expanded:m-0",
};

/** The main action and overflow menu: a bottom bar until expanded, then beside or under the header. Anonymized bookings have none. */
export function BookingActionBar({
  booking,
  updateBookingStatus,
  onRecordPayment,
  onCancel,
  placement,
}: BookingActionBarProps) {
  const { role, userId } = useUserRole();
  const bottomBarRef = usePageBottomBarRef(placement === "page");
  const now = new Date();
  const hasActions =
    !!mainActionFor(booking, role, manilaDayOf(now)) ||
    overflowActionsFor(booking, role, userId, now).length > 0;
  if (booking.anonymized_at || !hasActions) return null;

  return (
    <div
      ref={bottomBarRef}
      className={cn(
        "bg-card shadow-popover expanded:border-0 expanded:bg-transparent expanded:p-0 expanded:shadow-none z-30 flex items-center gap-2 border-t px-4 py-2",
        PLACEMENT_CLASSES[placement]
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
