import { UNIT_SLOT_MAP } from "@/components/dashboard/unit-calendar-config";
import { cn } from "@/lib/utils";
import type { Booking } from "@/types";

type BookingUnit = NonNullable<Booking["booking_units"]>[number];

/** A booked cabin's code, in that cabin's calendar lane colour. */
export function CabinChip({ bookingUnit }: { bookingUnit: BookingUnit }) {
  const unitCode = bookingUnit.unit?.unit_code;
  const slot = unitCode ? UNIT_SLOT_MAP.get(unitCode) : undefined;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        slot
          ? cn(slot.bg, slot.text, slot.border)
          : "bg-secondary text-secondary-foreground border-transparent"
      )}
    >
      {unitCode || bookingUnit.unit?.unit_name || `Unit ${bookingUnit.unit_id.slice(0, 4)}`}
    </span>
  );
}
