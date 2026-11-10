import { manilaDayOf, needsActionReason } from "@/lib/bookings";
import type { Booking } from "@/types";

/** Why a live booking needs action ("Not checked in" / "Not checked out"), as text. */
export const NeedsActionLabel = ({ booking }: { booking: Booking }) => {
  const reason = needsActionReason(booking, manilaDayOf(new Date()));
  if (!reason) return null;
  return (
    <span className="text-warning-foreground text-xs font-medium whitespace-nowrap">{reason}</span>
  );
};
