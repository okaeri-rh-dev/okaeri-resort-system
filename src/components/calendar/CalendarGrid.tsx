/**
 * Calendar Grid Component
 *
 * Renders a month view calendar grid with color-coded availability indicators.
 * Each day cell shows the date and number of available units (0-3).
 *
 * Features:
 * - Generates calendar days with proper month boundaries
 * - Color-codes days based on availability (green/yellow/orange/red)
 * - Highlights today with blue ring indicator
 * - Grays out past dates
 * - Shows availability count on hover
 * - Responsive grid layout (7 columns for days of week)
 *
 * @component
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { toISODateString } from "@/lib/timezone";

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
      <div className="grid grid-cols-7 gap-2 mb-2" role="row">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="text-center text-xs font-semibold text-gray-600 uppercase py-2"
            role="columnheader"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar days grid */}
      <div className="grid grid-cols-7 gap-2" role="row">
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

  /**
   * Get background color based on availability status
   * Uses Tailwind utility classes for consistency
   */
  const getStatusColor = () => {
    // Past dates: gray (cannot navigate)
    if (isPast) return "bg-gray-100 text-gray-400";

    // Adjacent month dates: reduced opacity with availability colors
    if (!isCurrentMonth) {
      if (!availability) return "bg-gray-50/50 text-gray-500";

      switch (availability.status) {
        case "full":
          return "bg-green-500/30 text-green-800 hover:bg-green-500/40";
        case "moderate":
          return "bg-yellow-500/30 text-yellow-800 hover:bg-yellow-500/40";
        case "limited":
          return "bg-orange-500/30 text-orange-800 hover:bg-orange-500/40";
        case "booked":
          return "bg-red-500/30 text-red-800 hover:bg-red-500/40";
        default:
          return "bg-gray-50/50 text-gray-500";
      }
    }

    // Current month dates: full color
    if (!availability) return "bg-gray-50 text-gray-700";

    switch (availability.status) {
      case "full":
        return "bg-green-500 text-white hover:bg-green-600";
      case "moderate":
        return "bg-yellow-500 text-white hover:bg-yellow-600";
      case "limited":
        return "bg-orange-500 text-white hover:bg-orange-600";
      case "booked":
        return "bg-red-500 text-white hover:bg-red-600";
      default:
        return "bg-gray-50 text-gray-700";
    }
  };

  /**
   * Get tooltip label for availability status
   */
  const getStatusLabel = () => {
    if (!availability) return undefined;

    switch (availability.availableCount) {
      case 3:
        return "3 available";
      case 2:
        return "2 available";
      case 1:
        return "1 available";
      case 0:
        return "Fully booked";
      default:
        return undefined;
    }
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
        "relative aspect-square rounded-lg flex flex-col items-center justify-center",
        "transition-all duration-200",
        getStatusColor(),
        isToday && "ring-2 ring-blue-600 ring-offset-2",
        !isPast && isCurrentMonth && "hover:shadow-md",
        isPast && "cursor-not-allowed",
        isClickable && "cursor-pointer hover:shadow-md",
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
          "text-lg font-semibold"
          // No opacity reduction for adjacent months anymore - color handles visibility
        )}
      >
        {dayNumber}
      </span>

      {/* Available count (for all future dates with data) */}
      {availability && !isPast && (
        <span
          className={cn("text-xs font-medium mt-0.5", isCurrentMonth ? "opacity-90" : "opacity-75")}
        >
          {availability.availableCount}
        </span>
      )}

      {/* Today indicator (blue dot) */}
      {isToday && (
        <div
          className="absolute -bottom-1 w-1.5 h-1.5 bg-blue-600 rounded-full"
          aria-label="Today"
        />
      )}
    </div>
  );
}
