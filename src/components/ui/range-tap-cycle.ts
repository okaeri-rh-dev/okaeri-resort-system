import { isBefore, isSameDay } from "date-fns";
import type { DateRange } from "react-day-picker";

/**
 * The range after a tap: tap 1 sets the start, tap 2 the end, tap 3 starts a new range.
 * Without `allowSameDay`, a second tap on the start day changes nothing.
 */
export function nextRangeOnTap(
  range: DateRange | undefined,
  tappedDay: Date,
  { allowSameDay = true } = {}
): DateRange {
  if (!range?.from || range.to || isBefore(tappedDay, range.from)) {
    return { from: tappedDay, to: undefined };
  }
  if (!allowSameDay && isSameDay(tappedDay, range.from)) return range;
  return { from: range.from, to: tappedDay };
}

/** What the next tap sets, in the words shown above the calendar. */
export function nextTapHint(
  range: DateRange | undefined,
  { startHint = "Select start date", endHint = "Select end date" } = {}
): string {
  return range?.from && !range.to ? endHint : startHint;
}
