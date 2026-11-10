import { format } from "date-fns";

import { utcToResortTime } from "@/utils/date-helpers";

export const formatStayRange = (checkIn: string, checkOut: string): string => {
  try {
    const inDate = utcToResortTime(checkIn);
    const outDate = utcToResortTime(checkOut);
    const sameMonth =
      inDate.getFullYear() === outDate.getFullYear() && inDate.getMonth() === outDate.getMonth();
    return sameMonth
      ? `${format(inDate, "MMM d")} → ${format(outDate, "d")}`
      : `${format(inDate, "MMM d")} → ${format(outDate, "MMM d")}`;
  } catch {
    return "Invalid Date";
  }
};

export const getNights = (checkIn: string, checkOut: string): number => {
  try {
    const inDate = utcToResortTime(checkIn);
    const outDate = utcToResortTime(checkOut);
    const ms = outDate.getTime() - inDate.getTime();
    return Math.max(1, Math.round(ms / 86_400_000));
  } catch {
    return 0;
  }
};
