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
      color: "bg-green-500",
      label: "3 units available",
      status: "Full availability",
    },
    {
      color: "bg-yellow-500",
      label: "2 units available",
      status: "Moderate",
    },
    {
      color: "bg-orange-500",
      label: "1 unit available",
      status: "Limited",
    },
    {
      color: "bg-red-500",
      label: "Fully booked",
      status: "No availability",
    },
  ];

  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">Availability Legend</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <div className={cn("w-4 h-4 rounded", item.color)} aria-hidden="true" />
            <div className="flex flex-col">
              <span className="text-xs font-medium text-gray-900">{item.label}</span>
              <span className="text-xs text-gray-500">{item.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
