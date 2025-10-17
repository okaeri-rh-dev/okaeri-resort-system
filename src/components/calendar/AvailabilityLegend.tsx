/**
 * Availability Legend Component
 *
 * Displays color-coded legend explaining availability status indicators.
 * Shows the meaning of each color used in the calendar grid.
 *
 * Color scheme:
 * - Green: Full availability (3 units)
 * - Yellow: Moderate availability (2 units)
 * - Orange: Limited availability (1 unit)
 * - Red: Fully booked (0 units)
 *
 * @component
 */

import { cn } from "@/lib/utils";

export function AvailabilityLegend() {
  const legendItems = [
    {
      color: "bg-emerald-400/70",
      label: "3 units",
      count: 3,
    },
    {
      color: "bg-amber-400/70",
      label: "2 units",
      count: 2,
    },
    {
      color: "bg-orange-400/70",
      label: "1 unit",
      count: 1,
    },
    {
      color: "bg-rose-400/70",
      label: "Booked",
      count: 0,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs">
      {legendItems.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <div className={cn("w-3 h-3 rounded", item.color)} aria-hidden="true" />
          <span className="text-slate-700 font-medium">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
