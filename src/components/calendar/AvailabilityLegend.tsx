/**
 * Availability Legend Component
 *
 * Explains the calendar grid's availability shading: the availability ramp for
 * 3, 2 and 1 cabins left, and a hatched muted fill for booked days.
 *
 * @component
 */

import { cn } from "@/lib/utils";

import { availabilityFill } from "./availability-fill";

export function AvailabilityLegend() {
  const legendItems = [
    {
      color: availabilityFill.full,
      label: "3 units",
      count: 3,
    },
    {
      color: availabilityFill.moderate,
      label: "2 units",
      count: 2,
    },
    {
      color: availabilityFill.limited,
      label: "1 unit",
      count: 1,
    },
    {
      color: availabilityFill.booked,
      label: "Booked",
      count: 0,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs @lg:gap-4">
      {legendItems.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <div
            className={cn("border-border h-3 w-3 rounded border", item.color)}
            aria-hidden="true"
          />
          <span className="text-foreground font-medium">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
