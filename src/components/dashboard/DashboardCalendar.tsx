import React, { useCallback, useMemo, useState } from "react";

import { format, getDay } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  InlineCalendar,
  type CalendarDayButtonProps,
} from "@/components/patterns";
import { useCalendarBookings } from "@/hooks/useCalendarBookings";
import { hasProperty, isObject } from "@/lib/type-guards";
import { cn } from "@/lib/utils";
import type { Booking } from "@/types";

import { BookingIndicators } from "./BookingIndicators";
import { BookingTooltip } from "./BookingTooltip";

interface DashboardCalendarProps {
  bookings: Booking[] | undefined;
  isLoading?: boolean;
  className?: string;
  headerVariant?: "row" | "stacked";
}

// Uniform subtle tint for any day with bookings (avoids competing with unit chip colors)
// A foreground tint darkens the day in light and lightens it in dark; in light, `muted` is the
// same colour as the grid's `background`, so a muted fill can't be seen
function getDayBackgroundClass(bookingCount: number): string {
  if (bookingCount === 0) return "";
  return "bg-foreground/10 hover:bg-accent";
}

// Extracted DayButton component for better performance
interface DayButtonProps {
  day: { date: Date };
  modifiers?: unknown;
  bookingsByDate: { [key: string]: Booking[] };
  compact?: boolean;
  [key: string]: unknown; // For other props passed by Calendar
}

const DayButton = React.memo(function DayButton({
  day,
  modifiers,
  bookingsByDate,
  compact = false,
  ...props
}: DayButtonProps) {
  const date = day.date;
  const dateKey = format(date, "yyyy-MM-dd");
  const dayBookings = bookingsByDate[dateKey] || [];
  const isToday = format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
  const isWeekend = getDay(date) === 0 || getDay(date) === 6; // Sunday = 0, Saturday = 6
  const bookingCountClass = getDayBackgroundClass(dayBookings.length);
  const isOutsideMonth =
    isObject(modifiers) && hasProperty(modifiers, "outside") ? Boolean(modifiers.outside) : false;

  return (
    <BookingTooltip bookings={dayBookings} date={date}>
      <Button
        {...props}
        variant="ghost"
        className={cn(
          "relative h-20 w-full text-sm font-normal @sm/calendar:h-24 @2xl/calendar:h-28",
          compact ? "p-0.5" : "p-1",
          "min-w-0", // Allow shrinking below content size
          "transition-colors duration-150",
          // Base weekend styling (only if no bookings)
          isWeekend && dayBookings.length === 0 && !isToday && "bg-foreground/5",
          // Booking count-based colors
          bookingCountClass,
          // Today special styling (overrides other backgrounds)
          isToday &&
            "border-primary bg-accent text-accent-foreground hover:bg-accent border font-semibold",
          // Make text bolder when there are bookings
          dayBookings.length > 0 && "font-medium",
          isOutsideMonth && "text-muted-foreground"
        )}
        aria-label={`${format(date, "MMMM d, yyyy")}${
          dayBookings.length > 0
            ? `, ${dayBookings.length} booking${dayBookings.length !== 1 ? "s" : ""}`
            : ""
        }`}
      >
        <div className="flex h-full w-full min-w-0 flex-col items-center justify-start overflow-hidden">
          <span className="text-xs font-medium @sm/calendar:text-sm">{format(date, "d")}</span>
          {dayBookings.length > 0 && (
            <BookingIndicators
              bookings={dayBookings}
              compact={compact}
              className="mt-1 w-full min-w-0"
            />
          )}
        </div>
      </Button>
    </BookingTooltip>
  );
});

interface CalendarHeaderProps {
  currentMonth: Date;
  monthlyBookingCount: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

function RowHeader({
  currentMonth,
  monthlyBookingCount,
  onPrev,
  onNext,
  onToday,
}: CalendarHeaderProps) {
  return (
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CardTitle className="flex items-center gap-2 text-xl font-semibold">
            <CalendarDays className="text-primary size-5" aria-hidden="true" />
            <span>Booking Calendar</span>
          </CardTitle>
          {monthlyBookingCount > 0 && (
            <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-sm font-medium">
              {monthlyBookingCount} booking{monthlyBookingCount !== 1 ? "s" : ""} this month
            </span>
          )}
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onToday}
            className="h-8 px-2.5 text-xs font-medium"
          >
            Today
          </Button>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onPrev}
              className="h-8 w-8 p-0"
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="border-border bg-background min-w-[140px] rounded-md border px-3 py-1 text-center">
              <span className="text-sm font-semibold">{format(currentMonth, "MMMM yyyy")}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onNext}
              className="h-8 w-8 p-0"
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </CardHeader>
  );
}

export function StackedHeader({ currentMonth, onPrev, onNext }: CalendarHeaderProps) {
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
        <span
          aria-live="polite"
          className="min-w-0 truncate px-3 text-base font-semibold tabular-nums"
        >
          {format(currentMonth, "MMMM yyyy")}
        </span>
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
  className,
  headerVariant = "row",
}: DashboardCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const visibleBookings = useMemo(
    () => bookings?.filter((b) => b.booking_status !== "Cancelled"),
    [bookings]
  );
  const { bookingsByDate, monthlyBookingCount } = useCalendarBookings(
    visibleBookings,
    currentMonth
  );
  const compact = headerVariant === "stacked";

  // Navigation handlers
  const handlePreviousMonth = () => {
    setCurrentMonth((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() - 1);
      return newDate;
    });
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + 1);
      return newDate;
    });
  };

  const handleToday = () => {
    setCurrentMonth(new Date());
  };

  // Create the DayButton component callback at the top level to follow React hooks rules
  const dayButtonComponent = useCallback(
    (props: CalendarDayButtonProps) => (
      <DayButton {...props} bookingsByDate={bookingsByDate} compact={compact} />
    ),
    [bookingsByDate, compact]
  );

  return (
    <Card className={cn("w-full", headerVariant === "stacked" && "p-1", className)}>
      {headerVariant === "stacked" ? (
        <StackedHeader
          currentMonth={currentMonth}
          monthlyBookingCount={monthlyBookingCount}
          onPrev={handlePreviousMonth}
          onNext={handleNextMonth}
          onToday={handleToday}
        />
      ) : (
        <RowHeader
          currentMonth={currentMonth}
          monthlyBookingCount={monthlyBookingCount}
          onPrev={handlePreviousMonth}
          onNext={handleNextMonth}
          onToday={handleToday}
        />
      )}

      {/* Named, because the month grid's <table> is also a container (for the chips' cqi) and a
          table can't answer width queries */}
      <CardContent
        className={cn("@container/calendar pt-0", headerVariant === "stacked" ? "p-0" : "p-4")}
      >
        {isLoading ? (
          <div className="flex h-[480px] items-center justify-center">
            <div className="text-muted-foreground text-sm">Loading calendar...</div>
          </div>
        ) : (
          <InlineCalendar
            variant="month-grid"
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            dayButton={dayButtonComponent}
            compact={headerVariant === "stacked"}
          />
        )}
      </CardContent>
    </Card>
  );
});
