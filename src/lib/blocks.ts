import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

const shortDate = (night: string) => format(parseISO(night), "EEE d MMM");

/** "Thu 29 Oct – Fri 6 Nov · 9 nights" for an inclusive range of nights. */
export function blockNightsLabel(firstNight: string, lastNight: string): string {
  const count = differenceInCalendarDays(parseISO(lastNight), parseISO(firstNight)) + 1;
  const range =
    firstNight === lastNight
      ? shortDate(firstNight)
      : `${shortDate(firstNight)} – ${shortDate(lastNight)}`;
  return `${range} · ${count} ${count === 1 ? "night" : "nights"}`;
}

/** The form's summary of what a block leaves open on either side. */
export function describeBlockNights(firstNight: string, lastNight: string): string {
  const nextCheckIn = shortDate(format(addDays(parseISO(lastNight), 1), "yyyy-MM-dd"));
  return `${blockNightsLabel(firstNight, lastNight)}. Guests can still check out on ${shortDate(firstNight)}. The next check-in is ${nextCheckIn}.`;
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
