import { dayAfter, manilaDayOf } from "@/lib/bookings/stay";
import type { Tables } from "@/types/database.types";

/** One cabin's part of a booking. `check_in` and `check_out` are timestamps. */
export type TimelineStay = Pick<
  Tables<"booking_unit_availability">,
  "unit_id" | "booking_id" | "check_in" | "check_out"
>;

type TimelineBlock = Pick<Tables<"availability_blackouts">, "unit_id" | "start_date" | "end_date">;

export type TimelineCell<Stay, Block> =
  { kind: "free" } | { kind: "booked"; stay: Stay } | { kind: "blocked"; block: Block };

/** A night of a stay is a Manila day from the check-in day up to, not including, the check-out day. */
const stayHasNight = (stay: TimelineStay, night: string) =>
  manilaDayOf(stay.check_in) <= night && night < manilaDayOf(stay.check_out);

/**
 * What a timeline row shows on one night. `unitId` null is the Whole resort row, which shows
 * resort closures only. A block shows over a booking, though the guards keep a night from being both.
 */
export function timelineCell<Stay extends TimelineStay, Block extends TimelineBlock>(
  unitId: string | null,
  night: string,
  { blocks, stays }: { blocks: Block[]; stays: Stay[] }
): TimelineCell<Stay, Block> {
  const block = blocks.find(
    (candidate) =>
      (candidate.unit_id === null || candidate.unit_id === unitId) &&
      candidate.start_date <= night &&
      night <= candidate.end_date
  );
  if (block) return { kind: "blocked", block };
  if (unitId === null) return { kind: "free" };

  const stay = stays.find(
    (candidate) => candidate.unit_id === unitId && stayHasNight(candidate, night)
  );
  return stay ? { kind: "booked", stay } : { kind: "free" };
}

/** Who a night's blocks shut out: "Whole resort", or the blocked cabins in name order. */
export function blockedNightLabel(
  blocks: TimelineBlock[],
  night: string,
  cabinName: (unitId: string) => string
): string | null {
  const blocksOnNight = blocks.filter(
    (block) => block.start_date <= night && night <= block.end_date
  );
  if (blocksOnNight.length === 0) return null;
  if (blocksOnNight.some((block) => block.unit_id === null)) return "Whole resort";

  const cabinNames = new Set(
    blocksOnNight.flatMap((block) => (block.unit_id ? [cabinName(block.unit_id)] : []))
  );
  return [...cabinNames]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .join(", ");
}

/** A night picked on the timeline. `unitId` null is the Whole resort row. */
export interface TimelineNight {
  unitId: string | null;
  night: string;
}

export interface TimelineRange {
  unitId: string | null;
  firstNight: string;
  lastNight: string;
}

/**
 * The first tap holds a night; a second tap in the same row gives the range between the two.
 * A booked or blocked night between the taps makes the second tap the new first night.
 */
export function tapFreeNight(
  pending: TimelineNight | null,
  tapped: TimelineNight,
  timeline: { blocks: TimelineBlock[]; stays: TimelineStay[] }
): { pending: TimelineNight } | { range: TimelineRange } {
  if (!pending || pending.unitId !== tapped.unitId) return { pending: tapped };
  const [firstNight, lastNight] = [pending.night, tapped.night].sort();
  const crossesTakenNight = nightsFrom(firstNight, lastNight).some(
    (night) => timelineCell(tapped.unitId, night, timeline).kind !== "free"
  );
  if (crossesTakenNight) return { pending: tapped };
  return { range: { unitId: tapped.unitId, firstNight, lastNight } };
}

const nightsFrom = (firstNight: string, lastNight: string) => {
  const nights = [firstNight];
  while (nights[nights.length - 1] < lastNight) nights.push(dayAfter(nights[nights.length - 1]));
  return nights;
};
