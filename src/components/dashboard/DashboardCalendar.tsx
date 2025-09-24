import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCalendarBookings } from "@/hooks/useCalendarBookings";
import { cn } from "@/lib/utils";
import type { Booking } from "@/types";
import { format } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import React, { useCallback, useState } from "react";
import { BookingIndicators } from "./BookingIndicators";
import { BookingTooltip } from "./BookingTooltip";

interface DashboardCalendarProps {
  bookings: Booking[] | undefined;
  isLoading?: boolean;
  className?: string;
}

// Extracted DayButton component for better performance
interface DayButtonProps {
  day: { date: Date };
  modifiers?: any;
  bookingsByDate: { [key: string]: Booking[] };
  [key: string]: any; // For other props passed by Calendar
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

  return (
    <BookingTooltip bookings={dayBookings} date={date}>
      <Button
        {...props}
        variant="ghost"
        className={cn(
          "relative h-16 sm:h-20 md:h-24 w-full p-1 font-normal text-sm",
          "min-w-0", // Allow shrinking below content size
          "hover:bg-accent hover:text-accent-foreground",
          "transition-colors duration-150",
          isToday && "bg-blue-50 font-semibold text-blue-900 hover:bg-blue-100",
          dayBookings.length > 0 && "font-medium"
        )}
        aria-label={`${format(date, "MMMM d, yyyy")}${
          dayBookings.length > 0
            ? `, ${dayBookings.length} booking${dayBookings.length !== 1 ? "s" : ""}`
            : ""
        }`}
      >
        <div className="flex flex-col items-start justify-start h-full p-1">
          <span className="text-xs sm:text-sm font-medium self-start">{format(date, "d")}</span>
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
    (props: any) => <DayButton {...props} bookingsByDate={bookingsByDate} />,
    [bookingsByDate]
  );

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <CalendarDays className="size-5 text-neutral-600" />
              Booking Calendar
            </CardTitle>
            {monthlyBookingCount > 0 && (
              <span className="text-sm text-neutral-600 font-medium">
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
              <div className="min-w-[140px] text-center">
                <span className="text-sm font-semibold text-neutral-900">
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
          <div className="flex items-center justify-center h-[480px]">
            <div className="text-sm text-neutral-600">Loading calendar...</div>
          </div>
        ) : (
          <Calendar
            mode="single"
            selected={undefined}
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            showOutsideDays={true}
            className="rounded-md border w-full"
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
                "text-neutral-500 rounded-md w-full font-normal text-[11px] uppercase tracking-wider", // renamed from 'head_cell'
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
