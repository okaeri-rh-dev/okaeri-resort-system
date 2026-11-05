import React, { createContext, useContext, useMemo, type ReactNode } from "react";

import { useQuery } from "@tanstack/react-query";
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { hatchedFill } from "@/components/calendar/availability-fill";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  InlineCalendar,
  type CalendarDayButtonProps,
} from "@/components/patterns";
import { blocksInNightsQuery } from "@/hooks/useAvailabilityTimeline";
import { useBlockCabins } from "@/hooks/useBlocks";
import { useCalendarBookings } from "@/hooks/useCalendarBookings";
import { blockedNightLabels } from "@/lib/availability-timeline";
import type { ManilaDay } from "@/lib/bookings/stay";
import { hasProperty, isObject } from "@/lib/type-guards";
import { cn } from "@/lib/utils";
import type { Booking } from "@/types";

import { BookingIndicators } from "./BookingIndicators";
import { BookingTooltip } from "./BookingTooltip";
import { calendarChipClass } from "./unit-calendar-config";

interface DashboardCalendarProps {
  bookings: Booking[] | undefined;
  isLoading?: boolean;
  month: Date;
  onMonthChange: (month: Date) => void;
  today: ManilaDay;
  selectedDay: ManilaDay | undefined;
  onSelectDay: (day: ManilaDay) => void;
  /** A line under the month name, such as the month's numbers */
  numbers?: ReactNode;
  className?: string;
}

// Uniform subtle tint for any day with bookings (avoids competing with unit chip colors)
// A foreground tint darkens the day in light and lightens it in dark; in light, `muted` is the
// same colour as the grid's `background`, so a muted fill can't be seen
function getDayBackgroundClass(bookingCount: number): string {
  if (bookingCount === 0) return "";
  return "bg-foreground/10 hover:bg-accent";
}

interface DayCellData {
  bookingsByDate: { [key: string]: Booking[] };
  blockedLabelByNight: Record<string, string>;
  today: ManilaDay;
  selectedDay: ManilaDay | undefined;
  onSelectDay: (day: ManilaDay) => void;
}

// Through context, not props: a day cell component made per render would remount the grid on
// every change (a selection, a query result) and lose the focus and a click in progress
const DayCellContext = createContext<DayCellData | null>(null);

function DayButton({ day, modifiers, ...props }: CalendarDayButtonProps) {
  const cell = useContext(DayCellContext);
  if (!cell) throw new Error("DayButton must be inside DashboardCalendar");
  const { bookingsByDate, blockedLabelByNight, today, selectedDay, onSelectDay } = cell;
  const date = day.date;
  const dateKey = format(date, "yyyy-MM-dd");
  const dayBookings = bookingsByDate[dateKey] || [];
  const blockedLabel = blockedLabelByNight[dateKey];
  const isToday = dateKey === today;
  const isSelected = dateKey === selectedDay;
  const isWeekend = getDay(date) === 0 || getDay(date) === 6; // Sunday = 0, Saturday = 6
  const bookingCountClass = getDayBackgroundClass(dayBookings.length);
  const isOutsideMonth =
    isObject(modifiers) && hasProperty(modifiers, "outside") ? Boolean(modifiers.outside) : false;

  return (
    <BookingTooltip bookings={dayBookings} date={date}>
      <Button
        {...props}
        data-calendar-day
        onClick={() => onSelectDay(dateKey)}
        aria-pressed={isSelected}
        variant="ghost"
        className={cn(
          "relative h-20 w-full text-sm font-normal @sm/calendar:h-24 @2xl/calendar:h-28",
          "min-w-0 p-0.5", // Allow shrinking below content size
          "transition-colors duration-150",
          // Base weekend styling (only if no bookings)
          isWeekend && dayBookings.length === 0 && !isToday && "bg-foreground/5",
          // Booking count-based colors
          bookingCountClass,
          // Today special styling (overrides other backgrounds)
          isToday &&
            "border-primary bg-accent text-accent-foreground hover:bg-accent border font-semibold",
          isSelected && "ring-primary ring-2 ring-inset",
          // Make text bolder when there are bookings
          dayBookings.length > 0 && "font-medium",
          isOutsideMonth && "text-muted-foreground"
        )}
        aria-label={`${format(date, "MMMM d, yyyy")}${
          dayBookings.length > 0
            ? `, ${dayBookings.length} booking${dayBookings.length !== 1 ? "s" : ""}`
            : ""
        }${blockedLabel ? `, blocked: ${blockedLabel}` : ""}`}
      >
        <div className="flex h-full w-full min-w-0 flex-col items-center justify-start overflow-hidden">
          <span className="text-xs font-medium @sm/calendar:text-sm">{format(date, "d")}</span>
          {dayBookings.length > 0 && (
            <BookingIndicators bookings={dayBookings} compact className="mt-1 w-full min-w-0" />
          )}
          {blockedLabel && <BlockedChip label={blockedLabel} />}
        </div>
      </Button>
    </BookingTooltip>
  );
}

/** Shows who a block shuts out; changing it is done on the Blocked dates page. */
function BlockedChip({ label }: { label: string }) {
  return (
    <div
      className={cn(calendarChipClass(true), "border-border text-foreground mt-0.5", hatchedFill)}
    >
      <span className="shrink-0">Blocked</span>
      {/* A narrow cell has no room for the cabins; the day's aria-label still names them */}
      <span className="ml-1 hidden truncate @sm/calendar:inline">{label}</span>
    </div>
  );
}

interface CalendarHeaderProps {
  currentMonth: Date;
  numbers?: ReactNode;
  onPrev: () => void;
  onNext: () => void;
}

export function StackedHeader({ currentMonth, numbers, onPrev, onNext }: CalendarHeaderProps) {
  return (
    <CardHeader className="px-3 py-2">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={onPrev}
          aria-label="Previous month"
          className="h-11 w-11 shrink-0"
        >
          <ChevronLeft className="size-5" />
        </Button>
        <div className="flex min-w-0 flex-col items-center px-3">
          <span aria-live="polite" className="truncate text-base font-semibold tabular-nums">
            {format(currentMonth, "MMMM yyyy")}
          </span>
          {numbers && (
            <span className="text-muted-foreground truncate text-xs tabular-nums">{numbers}</span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNext}
          aria-label="Next month"
          className="h-11 w-11 shrink-0"
        >
          <ChevronRight className="size-5" />
        </Button>
      </div>
    </CardHeader>
  );
}

export const DashboardCalendar = React.memo(function DashboardCalendar({
  bookings,
  isLoading,
  month,
  onMonthChange,
  today,
  selectedDay,
  onSelectDay,
  numbers,
  className,
}: DashboardCalendarProps) {
  const visibleBookings = useMemo(
    () => bookings?.filter((b) => b.booking_status !== "Cancelled"),
    [bookings]
  );
  const { bookingsByDate } = useCalendarBookings(visibleBookings, month);
  const firstVisibleNight = format(startOfWeek(startOfMonth(month)), "yyyy-MM-dd");
  const lastVisibleNight = format(endOfWeek(endOfMonth(month)), "yyyy-MM-dd");
  const { data: blocks } = useQuery(blocksInNightsQuery(firstVisibleNight, lastVisibleNight));
  const { cabinName } = useBlockCabins();
  const blockedLabelByNight = useMemo(
    () =>
      blockedNightLabels(
        blocks ?? [],
        { firstNight: firstVisibleNight, lastNight: lastVisibleNight },
        cabinName
      ),
    [blocks, firstVisibleNight, lastVisibleNight, cabinName]
  );

  const cell = useMemo(
    () => ({ bookingsByDate, blockedLabelByNight, today, selectedDay, onSelectDay }),
    [bookingsByDate, blockedLabelByNight, today, selectedDay, onSelectDay]
  );

  return (
    <Card className={cn("w-full p-1", className)}>
      <StackedHeader
        currentMonth={month}
        numbers={numbers}
        onPrev={() => onMonthChange(addMonths(month, -1))}
        onNext={() => onMonthChange(addMonths(month, 1))}
      />

      {/* Named, because the month grid's <table> is also a container (for the chips' cqi) and a
          table can't answer width queries */}
      <CardContent className="@container/calendar p-0">
        {isLoading ? (
          <div className="flex h-[480px] items-center justify-center">
            <div className="text-muted-foreground text-sm">Loading calendar...</div>
          </div>
        ) : (
          <DayCellContext.Provider value={cell}>
            <InlineCalendar
              variant="month-grid"
              month={month}
              onMonthChange={onMonthChange}
              dayButton={DayButton}
              compact
            />
          </DayCellContext.Provider>
        )}
      </CardContent>
    </Card>
  );
});
