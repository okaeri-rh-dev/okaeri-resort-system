/**
 * Calendar Grid Component
 *
 * Renders a month view calendar grid with color-coded availability indicators.
 * Each day cell shows the date and number of available units (0-3).
 *
 * Features:
 * - Generates calendar days with proper month boundaries
 * - Shades days by cabins left (availability ramp, hatched when booked)
 * - Rings today
 * - Mutes past dates
 * - Shows availability count on hover
 * - Responsive grid layout (7 columns for days of week)
 *
 * @component
 */

import { useMemo } from "react";

import { toISODateString } from "@/lib/timezone";
import { cn } from "@/lib/utils";

import { adjacentMonthAvailabilityFill, availabilityFill } from "./availability-fill";

/**
 * Availability data for a single day
 */
export interface AvailabilityDay {
  date: string; // ISO date string (YYYY-MM-DD)
  availableCount: number; // 0-3
  status: "full" | "moderate" | "limited" | "booked";
}

interface CalendarGridProps {
  /** Array of availability data from API */
  availability: AvailabilityDay[];
  /** Current month being displayed */
  currentMonth: Date;
  /** Callback when a date is clicked (for navigation to adjacent months) */
  onDateClick?: (date: Date) => void;
}

export function CalendarGrid({ availability, currentMonth, onDateClick }: CalendarGridProps) {
  // Build availability map for O(1) lookup
  const availabilityMap = useMemo(() => {
    const map = new Map<string, AvailabilityDay>();
    availability.forEach((day) => {
      map.set(day.date, day);
    });
    return map;
  }, [availability]);

  // Generate calendar days (including overflow from prev/next month)
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    // First day of month (0 = Sunday)
    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay();

    // Last day of month
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Build array of day objects
    const days: Array<{
      date: Date;
      dayNumber: number;
      isCurrentMonth: boolean;
      isPast: boolean;
      availability?: AvailabilityDay;
    }> = [];

    // Add previous month overflow dates to complete first week
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < startDayOfWeek; i++) {
      const date = new Date(year, month, -startDayOfWeek + i + 1);
      const dateStr = toISODateString(date);
      const isPast = date < today;

      days.push({
        date,
        dayNumber: date.getDate(),
        isCurrentMonth: false,
        isPast,
        availability: availabilityMap.get(dateStr), // Lookup availability data
      });
    }

    // Add days of current month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = toISODateString(date); // Use timezone-aware conversion
      const isPast = date < today;

      days.push({
        date,
        dayNumber: day,
        isCurrentMonth: true,
        isPast,
        availability: availabilityMap.get(dateStr),
      });
    }

    // Add overflow dates from next month to complete the last row
    const remainingCells = 7 - (days.length % 7);
    if (remainingCells < 7) {
      for (let i = 1; i <= remainingCells; i++) {
        const date = new Date(year, month + 1, i);
        const dateStr = toISODateString(date);

        days.push({
          date,
          dayNumber: i,
          isCurrentMonth: false,
          isPast: false,
          availability: availabilityMap.get(dateStr),
        });
      }
    }

    return days;
  }, [currentMonth, availabilityMap]);

  return (
    <div className="calendar-grid" role="grid" aria-label="Availability calendar">
      {/* Day headers (Sun, Mon, Tue, ...) */}
      <div className="mb-1 grid grid-cols-7 gap-1 sm:mb-2 sm:gap-2" role="row">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="text-muted-foreground py-1 text-center text-xs font-semibold uppercase sm:py-2"
            role="columnheader"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar days grid */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2" role="row">
        {calendarDays.map((day, index) => (
          <DayCell
            key={index}
            date={day.date}
            dayNumber={day.dayNumber}
            isCurrentMonth={day.isCurrentMonth}
            isPast={day.isPast}
            availability={day.availability}
            onDateClick={onDateClick}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Individual day cell component
 * Renders a single day in the calendar grid
 */
interface DayCellProps {
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
  isPast: boolean;
  availability?: AvailabilityDay;
  onDateClick?: (date: Date) => void;
}

function DayCell({
  date,
  dayNumber,
  isCurrentMonth,
  isPast,
  availability,
  onDateClick,
}: DayCellProps) {
  /**
   * Handle click on adjacent month dates for navigation
   */
  const handleClick = () => {
    if (!isCurrentMonth && !isPast && onDateClick) {
      onDateClick(date);
    }
  };

  const getStatusColor = () => {
    if (isPast) return "text-muted-foreground";
    if (!availability) return isCurrentMonth ? "text-foreground" : "text-muted-foreground";

    const fill = isCurrentMonth
      ? availabilityFill[availability.status]
      : adjacentMonthAvailabilityFill[availability.status];
    return cn(fill, "text-foreground");
  };

  /**
   * Get tooltip label for availability status
   */
  const getStatusLabel = () => {
    if (!availability) return undefined;

    const count = availability.availableCount;
    return count > 0 ? `${count} available` : "Fully booked";
  };

  /**
   * Check if this day is today (for blue ring indicator)
   */
  const isToday = date.toDateString() === new Date().toDateString();

  const isClickable = !isCurrentMonth && !isPast && onDateClick;

  return (
    <div
      onClick={handleClick}
      className={cn(
        // Further reduced heights for desktop to prevent scrolling
        "relative flex min-h-[44px] flex-col items-center justify-center rounded py-1 sm:min-h-[52px] md:min-h-[60px] lg:min-h-[64px]",
        "transition-all duration-200",
        getStatusColor(),
        isToday && "ring-primary ring-offset-card ring-2 ring-offset-1",
        !isPast && isCurrentMonth && "hover:shadow-sm",
        isPast && "cursor-not-allowed",
        isClickable && "cursor-pointer hover:shadow-sm",
        !isPast && !isClickable && isCurrentMonth && "cursor-default"
      )}
      title={getStatusLabel()}
      role="gridcell"
      aria-label={`${date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })}${getStatusLabel() ? ` - ${getStatusLabel()}` : ""}`}
    >
      {/* Day number */}
      <span
        className={cn(
          "text-sm font-semibold sm:text-base"
          // No opacity reduction for adjacent months anymore - color handles visibility
        )}
      >
        {dayNumber}
      </span>

      {/* Available count (for all future dates with data) */}
      {availability && !isPast && (
        <span className="mt-0.5 text-xs font-medium tabular-nums">
          {availability.availableCount}
        </span>
      )}

      {/* Today indicator dot */}
      {isToday && (
        <div
          className="bg-primary absolute -bottom-1 h-1.5 w-1.5 rounded-full"
          aria-label="Today"
        />
      )}
    </div>
  );
}
