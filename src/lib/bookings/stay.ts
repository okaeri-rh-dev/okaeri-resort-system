import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { RESORT_OPERATION_HOURS, RESORT_TIMEZONE } from "@/config/settings";

// Stays are stored as a Manila day plus a fixed time (docs/adr/0002).

/** A Manila calendar day, `YYYY-MM-DD`. */
export type ManilaDay = string;

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const isManilaDay = (value: string): value is ManilaDay =>
  DAY_PATTERN.test(value) && !Number.isNaN(parseISO(value).getTime());

const atManilaTime = (day: ManilaDay, time: string) =>
  fromZonedTime(`${day}T${time}:00`, RESORT_TIMEZONE).toISOString();

export function toStayInstants(checkInDay: ManilaDay, checkOutDay: ManilaDay) {
  if (!isManilaDay(checkInDay) || !isManilaDay(checkOutDay)) {
    throw new Error("Stay days must be YYYY-MM-DD");
  }
  if (checkOutDay <= checkInDay) {
    throw new Error("The check-out day must be after the check-in day");
  }
  return {
    check_in: atManilaTime(checkInDay, RESORT_OPERATION_HOURS.checkInTime),
    check_out: atManilaTime(checkOutDay, RESORT_OPERATION_HOURS.checkOutTime),
  };
}

/** The day shown in a date picker, whose Date is local midnight of that day. */
export const pickedDay = (date: Date): ManilaDay => format(date, "yyyy-MM-dd");

export const manilaDayOf = (instant: string | Date): ManilaDay =>
  formatInTimeZone(new Date(instant), RESORT_TIMEZONE, "yyyy-MM-dd");

export const nightsBetween = (checkInDay: ManilaDay, checkOutDay: ManilaDay) =>
  differenceInCalendarDays(parseISO(checkOutDay), parseISO(checkInDay));

export const manilaDayStart = (day: ManilaDay) => atManilaTime(day, "00:00");

export const dayAfter = (day: ManilaDay): ManilaDay =>
  format(addDays(parseISO(day), 1), "yyyy-MM-dd");
