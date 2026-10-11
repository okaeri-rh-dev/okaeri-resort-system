import { format, parseISO } from "date-fns";

import { manilaDayOf } from "./stay";

export type UnitAvailability = {
  unit_id: string;
  unit_name: string;
  is_available: boolean;
  conflicting_bookings: number;
  /** When the conflicting stays end ("booked until"); null when available */
  next_available_date: string | null;
};

// Units missing from the result are not bookable (status other than Available)
export function unavailableReason(
  availability: UnitAvailability[] | undefined,
  unitId: string
): string | null {
  if (!availability) return null;
  const result = availability.find((entry) => entry.unit_id === unitId);
  if (!result) return "Not available";
  if (result.is_available) return null;
  if (!result.next_available_date) return "Booked";
  return `Booked until ${format(parseISO(manilaDayOf(result.next_available_date)), "MMM d")}`;
}
