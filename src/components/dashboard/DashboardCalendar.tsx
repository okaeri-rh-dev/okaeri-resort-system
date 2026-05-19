import React, { useCallback, useMemo, useState } from "react";

import { format, getDay } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import type { DayButton as DayButtonType } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
function getDayBackgroundClass(bookingCount: number): string {
  if (bookingCount === 0) return "";
  return "bg-slate-50/60 hover:bg-slate-100/60";
}

// Extracted DayButton component for better performance
interface DayButtonProps {
  day: { date: Date };
  modifiers?: unknown;
  bookingsByDate: { [key: string]: Booking[] };
  [key: string]: unknown; // For other props passed by Calendar
}

const DayButton = React.memo(function DayButton({
  day,
  modifiers,
  bookingsByDate,
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
          "relative h-20 w-full p-1 text-sm font-normal sm:h-24 md:h-28",
          "min-w-0", // Allow shrinking below content size
          "transition-all duration-150",
          // Base weekend styling (only if no bookings)
          isWeekend && dayBookings.length === 0 && !isToday && "bg-slate-50/50",
          // Booking count-based colors
          bookingCountClass,
          // Today special styling (overrides other backgrounds)
          isToday &&
            "border border-blue-300 bg-blue-100 font-semibold text-blue-900 hover:bg-blue-200",
          // Make text bolder when there are bookings
          dayBookings.length > 0 && "font-medium",
          // Outside month dates - reduce opacity but not for the button itself
          isOutsideMonth && "opacity-40 hover:opacity-60"
        )}
        aria-label={`${format(date, "MMMM d, yyyy")}${
          dayBookings.length > 0
            ? `, ${dayBookings.length} booking${dayBookings.length !== 1 ? "s" : ""}`
            : ""
        }`}
      >
        <div className="flex h-full w-full min-w-0 flex-col items-center justify-start overflow-hidden">
          <span className={cn("text-xs font-medium sm:text-sm", isToday && "text-blue-900")}>
            {format(date, "d")}
          </span>
          {dayBookings.length > 0 && (
            <BookingIndicators bookings={dayBookings} className="mt-1 w-full min-w-0" />
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
    <CardHeader className="rounded-t-lg bg-gradient-to-r from-slate-50 to-blue-50/30 pb-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CardTitle className="flex items-center gap-2 text-xl font-semibold">
            <CalendarDays className="size-5 text-blue-600" />
            <span className="text-slate-800">Booking Calendar</span>
          </CardTitle>
          {monthlyBookingCount > 0 && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-sm font-medium text-slate-600">
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
            <div className="min-w-[140px] rounded-md border border-slate-200 bg-white px-3 py-1 text-center">
              <span className="text-sm font-semibold text-slate-800">
                {format(currentMonth, "MMMM yyyy")}
              </span>
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

export function StackedHeader({
  currentMonth,
  monthlyBookingCount,
  onPrev,
  onNext,
  onToday,
}: CalendarHeaderProps) {
  return (
    <CardHeader className="space-y-2 rounded-t-lg bg-gradient-to-r from-slate-50 to-blue-50/30 pb-3">
      {/* Row 1: hero month navigation */}
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
          className="min-w-0 truncate px-3 text-base font-semibold text-slate-800 tabular-nums"
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

      {/* Row 2: metadata + reset action */}
      <div className="flex items-center justify-between gap-2">
        {monthlyBookingCount > 0 ? (
          <span className="min-w-0 truncate text-xs text-slate-500">
            {monthlyBookingCount} booking{monthlyBookingCount !== 1 ? "s" : ""} this month
          </span>
        ) : (
          <span aria-hidden="true" />
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onToday}
          className="h-8 shrink-0 px-2.5 text-xs font-medium"
        >
          Today
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
    (props: React.ComponentProps<typeof DayButtonType>) => (
      <DayButton {...props} bookingsByDate={bookingsByDate} />
    ),
    [bookingsByDate]
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

      <CardContent className={cn("pt-0", headerVariant === "stacked" ? "p-0" : "p-4")}>
        {isLoading ? (
          <div className="flex h-[480px] items-center justify-center">
            <div className="text-sm text-neutral-600">Loading calendar...</div>
          </div>
        ) : (
          <Calendar
            mode="single"
            selected={undefined}
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            showOutsideDays={true}
            className={cn("w-full rounded-md border", headerVariant === "stacked" && "p-0")}
            classNames={{
              months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 w-full",
              month: "space-y-3 w-full",
              month_caption: "hidden", // Hide default caption since we have custom navigation (v9 slot)
              caption: "hidden", // Back-compat alias for older react-day-picker
              caption_label: "text-sm font-medium",
              nav: "hidden", // Hide default nav since we have custom navigation
              nav_button: cn("h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"),
              nav_button_previous: "absolute left-1",
              nav_button_next: "absolute right-1",
              month_grid:
                "w-full table-fixed border-collapse space-y-1 [container-type:inline-size]", // renamed from 'table'; table-fixed prevents the table from growing beyond its declared width
              weekdays: "flex w-full", // renamed from 'head_row'
              weekday:
                "text-slate-600 rounded-md min-w-0 flex-1 font-medium text-[11px] uppercase tracking-wider", // renamed from 'head_cell'
              week: "flex w-full mt-1", // renamed from 'row'
              day: cn(
                "relative h-20 sm:h-24 md:h-28 min-w-0 flex-1 p-0 text-center text-sm",
                "[&:has([aria-selected])]:bg-accent",
                "first:[&:has([aria-selected])]:rounded-l-md",
                "last:[&:has([aria-selected])]:rounded-r-md",
                "focus-within:relative focus-within:z-20"
              ), // renamed from 'cell'
              day_button: cn(
                "h-20 sm:h-24 md:h-28 w-full p-0 font-normal hover:bg-accent hover:text-accent-foreground",
                "aria-selected:opacity-100"
              ), // renamed from 'day'
              selected:
                "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground", // renamed from 'day_selected'
              today: "bg-accent/50 text-accent-foreground font-semibold", // renamed from 'day_today'
              outside: "text-neutral-400 opacity-50", // renamed from 'day_outside'
              disabled: "text-neutral-400 opacity-50", // renamed from 'day_disabled'
              range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground", // renamed from 'day_range_middle'
              hidden: "invisible", // renamed from 'day_hidden'
            }}
            components={{
              DayButton: dayButtonComponent,
            }}
          />
        )}
      </CardContent>
    </Card>
  );
});
