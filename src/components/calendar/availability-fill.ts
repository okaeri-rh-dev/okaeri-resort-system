import type { AvailabilityDay } from "./CalendarGrid";

/**
 * A hatched muted fill: booked days on the guest calendar, blocked nights on the admin timeline
 * and the Blocked chip on the dashboard calendar.
 */
export const hatchedFill =
  "bg-muted bg-[repeating-linear-gradient(135deg,var(--border)_0_2px,transparent_2px_6px)]";

export const availabilityFill: Record<AvailabilityDay["status"], string> = {
  full: "bg-availability-high",
  moderate: "bg-availability-medium",
  limited: "bg-availability-low",
  booked: hatchedFill,
};

export const adjacentMonthAvailabilityFill: Record<AvailabilityDay["status"], string> = {
  full: "bg-availability-high/50",
  moderate: "bg-availability-medium/50",
  limited: "bg-availability-low/50",
  booked: hatchedFill,
};
