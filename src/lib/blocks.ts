import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

import { toManilaDateString } from "@/lib/timezone";

const SHORT_NIGHT = "EEE d MMM";

/** "Thu 29 Oct" for a yyyy-MM-dd night. */
export const shortNight = (night: string) => format(parseISO(night), SHORT_NIGHT);

/** "Thu 29 Oct – Sat 31 Oct": the Manila check-in and check-out days of a booking. */
export const stayLabel = (checkIn: string, checkOut: string) =>
  `${shortNight(toManilaDateString(new Date(checkIn)))} – ${shortNight(toManilaDateString(new Date(checkOut)))}`;

/** "Thu 29 Oct – Fri 6 Nov · 9 nights" for an inclusive range of nights. */
export function blockNightsLabel(firstNight: string, lastNight: string): string {
  const count = differenceInCalendarDays(parseISO(lastNight), parseISO(firstNight)) + 1;
  const range =
    firstNight === lastNight
      ? shortNight(firstNight)
      : `${shortNight(firstNight)} – ${shortNight(lastNight)}`;
  return `${range} · ${count} ${count === 1 ? "night" : "nights"}`;
}

/** The form's summary of what a block leaves open on either side. */
export function describeBlockNights(firstNight: string, lastNight: string): string {
  const nextCheckIn = format(addDays(parseISO(lastNight), 1), SHORT_NIGHT);
  return `${blockNightsLabel(firstNight, lastNight)}. Guests can still check out on ${shortNight(firstNight)}. The next check-in is ${nextCheckIn}.`;
}

export type BlockPhase = "upcoming" | "running" | "over";

/** Matches the database locks: `today` is the Manila date (yyyy-MM-dd). */
export function blockPhase(
  block: { start_date: string; end_date: string },
  today: string
): BlockPhase {
  if (block.end_date < today) return "over";
  if (block.start_date <= today) return "running";
  return "upcoming";
}

export type BlockFormMode = "create" | "edit" | "last-night-only" | "read-only";

export function blockFormMode(
  block: { start_date: string; end_date: string } | undefined,
  today: string,
  canManage: boolean
): BlockFormMode {
  if (!block) return "create";
  const phase = blockPhase(block, today);
  if (!canManage || phase === "over") return "read-only";
  return phase === "running" ? "last-night-only" : "edit";
}

/** The warning over the bookings a block would sit on. */
export const conflictsHeading = (count: number) =>
  `${count} ${count === 1 ? "booking uses" : "bookings use"} these nights`;
