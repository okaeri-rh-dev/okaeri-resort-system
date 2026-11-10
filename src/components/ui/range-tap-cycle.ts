import { isBefore, isSameDay } from "date-fns";
import type { DateRange } from "react-day-picker";

/**
 * The range after a tap: tap 1 sets the start, tap 2 the end, tap 3 starts a new range.
 * A `stay` needs at least one night, so a second tap on the check-in day changes nothing.
 */
export function nextRangeOnTap(
  range: DateRange | undefined,
  tappedDay: Date,
  { stay = false } = {}
): DateRange {
  if (!range?.from || range.to || isBefore(tappedDay, range.from)) {
    return { from: tappedDay, to: undefined };
  }
  if (stay && isSameDay(tappedDay, range.from)) return range;
  return { from: range.from, to: tappedDay };
}

/** What the next tap sets, in the words shown above the calendar. */
export function nextTapHint(range: DateRange | undefined, { stay = false } = {}): string {
  const setsEnd = Boolean(range?.from && !range.to);
  if (stay) return setsEnd ? "Select check-out day" : "Select check-in day";
  return setsEnd ? "Select end date" : "Select start date";
}
