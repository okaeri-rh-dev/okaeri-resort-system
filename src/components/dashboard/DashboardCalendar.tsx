import React, { useCallback, useState } from "react";

import { format, getDay } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

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
}

// Helper function to determine background color based on booking count
function getDayBackgroundClass(bookingCount: number): string {
  if (bookingCount === 0) return "";
  if (bookingCount <= 2) return "bg-blue-50 hover:bg-blue-100/80";
  if (bookingCount <= 4) return "bg-blue-100 hover:bg-blue-200/80";
  return "bg-amber-50 hover:bg-amber-100"; // 5+ bookings (busy day)
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
          "relative h-16 w-full p-1 text-sm font-normal sm:h-20 md:h-24",
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
        <div className="flex h-full flex-col items-start justify-start p-1">
          <span
            className={cn(
              "self-start text-xs font-medium sm:text-sm",
              isToday && "text-blue-900",
              dayBookings.length > 4 && "text-amber-700"
            )}
          >
            {format(date, "d")}
          </span>
          {dayBookings.length > 0 && (
            <BookingIndicators bookings={dayBookings} maxVisible={3} className="mt-1 w-full" />
          )}
        </div>
      </Button>
    </BookingTooltip>
  );
});

export const DashboardCalendar = React.memo(function DashboardCalendar({
  bookings,
  isLoading,
  className,
}: DashboardCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { bookingsByDate, monthlyBookingCount } = useCalendarBookings(bookings, currentMonth);

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
    (props: Omit<DayButtonProps, "bookingsByDate">) => (
      <DayButton {...props} bookingsByDate={bookingsByDate} />
    ),
    [bookingsByDate]
  );

  return (
    <Card className={cn("w-full", className)}>
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
              onClick={handleToday}
              className="h-8 px-2.5 text-xs font-medium"
            >
              Today
            </Button>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePreviousMonth}
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
                onClick={handleNextMonth}
                className="h-8 w-8 p-0"
                aria-label="Next month"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0">
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
            className="w-full rounded-md border"
            classNames={{
              months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 w-full",
              month: "space-y-3 w-full",
              caption: "hidden", // Hide default caption since we have custom navigation
              caption_label: "text-sm font-medium",
              nav: "hidden", // Hide default nav since we have custom navigation
              nav_button: cn("h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"),
              nav_button_previous: "absolute left-1",
              nav_button_next: "absolute right-1",
              month_grid: "w-full border-collapse space-y-1", // renamed from 'table'
              weekdays: "flex w-full", // renamed from 'head_row'
              weekday:
                "text-slate-600 rounded-md w-full font-medium text-[11px] uppercase tracking-wider", // renamed from 'head_cell'
              week: "flex w-full mt-1", // renamed from 'row'
              day: cn(
                "relative h-16 sm:h-20 md:h-24 flex-1 p-0 text-center text-sm",
                "[&:has([aria-selected])]:bg-accent",
                "first:[&:has([aria-selected])]:rounded-l-md",
                "last:[&:has([aria-selected])]:rounded-r-md",
                "focus-within:relative focus-within:z-20"
              ), // renamed from 'cell'
              day_button: cn(
                "h-16 sm:h-20 md:h-24 w-full p-0 font-normal hover:bg-accent hover:text-accent-foreground",
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
