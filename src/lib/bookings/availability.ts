import { format, parseISO } from "date-fns";

import { manilaDayOf } from "./stay";

export type UnavailableReason = "Blocked" | "Booked";

export type UnitAvailability = {
  unit_id: string;
  unit_name: string;
  is_available: boolean;
  /** Blocked wins over Booked; null when available */
  reason: UnavailableReason | null;
  conflicting_bookings: number;
  /** When the conflicting stays end ("booked until"); null when available */
  next_available_date: string | null;
};

export const unitNotFreeMessage = (reason: string) =>
  `This unit is not free for these days (${reason})`;

/** What the forms show when the booking guard refuses a blocked night */
export const BLOCKED_UNIT_MESSAGE = unitNotFreeMessage("Blocked");

// SQLSTATE raised by refuse_booking_on_blocked_nights and create_guest_booking
const BLOCKED_NIGHT_CODE = "BLOCK";

export class BlockedUnitError extends Error {
  constructor() {
    super(BLOCKED_UNIT_MESSAGE);
    this.name = "BlockedUnitError";
  }
}

export const isBlockedNightError = (error: { code?: string } | null) =>
  error?.code === BLOCKED_NIGHT_CODE;

export function unavailableReason(
  availability: UnitAvailability[] | undefined,
  unitId: string
): string | null {
  if (!availability) return null;
  const result = availability.find((entry) => entry.unit_id === unitId);
  if (!result) return "Not available";
  if (result.is_available) return null;
  if (result.reason === "Blocked") return "Blocked";
  if (!result.next_available_date) return "Booked";
  return `Booked until ${format(parseISO(manilaDayOf(result.next_available_date)), "MMM d")}`;
}
