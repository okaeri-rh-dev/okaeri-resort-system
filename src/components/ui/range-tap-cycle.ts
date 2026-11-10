import { isBefore } from "date-fns";
import type { DateRange } from "react-day-picker";

/** The range after a tap: tap 1 sets the start, tap 2 the end, tap 3 starts a new range. */
export function nextRangeOnTap(range: DateRange | undefined, tappedDay: Date): DateRange {
  if (!range?.from || range.to || isBefore(tappedDay, range.from)) {
    return { from: tappedDay, to: undefined };
  }
  return { from: range.from, to: tappedDay };
}
