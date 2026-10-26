/** PROTOTYPE — in-memory blocks and bookings for the Blocked dates admin UI ticket. Wipe me. */
import { addDays, differenceInCalendarDays, format, isAfter, isBefore, parseISO } from "date-fns";

export type ProtoRole = "staff" | "manager";

export interface ProtoCabin {
  id: string;
  name: string;
}

export interface ProtoBlock {
  id: string;
  /** null = resort closure */
  unitId: string | null;
  firstNight: string;
  lastNight: string;
  reason: string;
}

export interface ProtoBooking {
  id: string;
  reference: string;
  guest: string;
  unitIds: string[];
  checkIn: string;
  checkOut: string;
  status: "Pending" | "Confirmed" | "CheckedIn" | "Cancelled";
}

export interface Conflict {
  booking: ProtoBooking;
  partial: string | null;
  checkedIn: boolean;
}

export const CABINS: ProtoCabin[] = [
  { id: "c1", name: "Cabin 1" },
  { id: "c2", name: "Cabin 2" },
  { id: "c3", name: "Cabin 3" },
];

const iso = (offset: number) => format(addDays(new Date(), offset), "yyyy-MM-dd");

export const initialBlocks: ProtoBlock[] = [
  { id: "k1", unitId: "c3", firstNight: iso(-12), lastNight: iso(-10), reason: "Roof repair" },
  { id: "k2", unitId: "c3", firstNight: iso(-1), lastNight: iso(1), reason: "Septic tank work" },
  { id: "k3", unitId: "c2", firstNight: iso(9), lastNight: iso(10), reason: "Aircon cleaning" },
  { id: "k4", unitId: null, firstNight: iso(18), lastNight: iso(19), reason: "Water line repair" },
];

export const initialBookings: ProtoBooking[] = [
  {
    id: "b1",
    reference: "OKR-2411",
    guest: "Maria Santos",
    unitIds: ["c1"],
    checkIn: iso(-1),
    checkOut: iso(2),
    status: "CheckedIn",
  },
  {
    id: "b2",
    reference: "OKR-2415",
    guest: "Jun Reyes",
    unitIds: ["c1"],
    checkIn: iso(4),
    checkOut: iso(6),
    status: "Confirmed",
  },
  {
    id: "b3",
    reference: "OKR-2419",
    guest: "Ana Cruz",
    unitIds: ["c2", "c3"],
    checkIn: iso(5),
    checkOut: iso(8),
    status: "Pending",
  },
  {
    id: "b4",
    reference: "OKR-2422",
    guest: "Leo Lim",
    unitIds: ["c3"],
    checkIn: iso(12),
    checkOut: iso(15),
    status: "Confirmed",
  },
  {
    id: "b5",
    reference: "OKR-2425",
    guest: "Grace Tan",
    unitIds: ["c2"],
    checkIn: iso(25),
    checkOut: iso(27),
    status: "Confirmed",
  },
];

/** Joins the list between the form's first read and the confirm, for the "list changed" refusal. */
export const lateBooking: ProtoBooking = {
  id: "b9",
  reference: "OKR-2431",
  guest: "Paolo Garcia",
  unitIds: ["c1"],
  checkIn: iso(5),
  checkOut: iso(7),
  status: "Pending",
};

export const todayIso = () => iso(0);

export const cabinName = (unitId: string | null) =>
  unitId === null ? "Whole resort" : (CABINS.find((cabin) => cabin.id === unitId)?.name ?? unitId);

export const nightCount = (block: Pick<ProtoBlock, "firstNight" | "lastNight">) =>
  differenceInCalendarDays(parseISO(block.lastNight), parseISO(block.firstNight)) + 1;

export type BlockPhase = "upcoming" | "running" | "over";

export function blockPhase(block: ProtoBlock): BlockPhase {
  const today = todayIso();
  if (block.lastNight < today) return "over";
  if (block.firstNight <= today) return "running";
  return "upcoming";
}

export function nightBlocked(blocks: ProtoBlock[], unitId: string, night: string) {
  return blocks.find(
    (block) =>
      (block.unitId === null || block.unitId === unitId) &&
      block.firstNight <= night &&
      night <= block.lastNight
  );
}

export function nightBooking(bookings: ProtoBooking[], unitId: string, night: string) {
  return bookings.find(
    (booking) =>
      booking.status !== "Cancelled" &&
      booking.unitIds.includes(unitId) &&
      booking.checkIn <= night &&
      night < booking.checkOut
  );
}

/** Rules 4–6 of Block conflict rules: active bookings on a blocked night of a blocked cabin. */
export function findConflicts(
  bookings: ProtoBooking[],
  unitIds: string[] | null,
  firstNight: string,
  lastNight: string
): Conflict[] {
  if (!firstNight || !lastNight || lastNight < firstNight) return [];
  const afterLast = format(addDays(parseISO(lastNight), 1), "yyyy-MM-dd");

  return bookings
    .filter((booking) => booking.status !== "Cancelled")
    .filter((booking) => booking.checkIn < afterLast && firstNight < booking.checkOut)
    .filter(
      (booking) => unitIds === null || booking.unitIds.some((unitId) => unitIds.includes(unitId))
    )
    .map((booking) => {
      const otherCabins =
        unitIds === null ? [] : booking.unitIds.filter((unitId) => !unitIds.includes(unitId));
      const before = isBefore(parseISO(booking.checkIn), parseISO(firstNight));
      const after = isAfter(parseISO(booking.checkOut), parseISO(afterLast));
      const reasons = [
        otherCabins.length > 0 && `also uses ${otherCabins.map(cabinName).join(", ")}`,
        (before || after) && "stays past the block",
      ].filter(Boolean);
      return {
        booking,
        partial: reasons.length > 0 ? reasons.join(", ") : null,
        checkedIn: booking.status === "CheckedIn",
      };
    });
}

export const shortDate = (value: string) => format(parseISO(value), "EEE d MMM");

export const nightsLabel = (block: Pick<ProtoBlock, "firstNight" | "lastNight">) => {
  const count = nightCount(block);
  const range =
    block.firstNight === block.lastNight
      ? shortDate(block.firstNight)
      : `${shortDate(block.firstNight)} – ${shortDate(block.lastNight)}`;
  return `${range} · ${count} ${count === 1 ? "night" : "nights"}`;
};
