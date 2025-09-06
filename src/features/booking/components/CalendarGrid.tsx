/**
 * CalendarGrid Component
 *
 * 7-column grid layout for displaying calendar days with:
 * - Week headers (Sun-Sat)
 * - Day cells with availability status
 * - Date selection and range selection support
 * - Previous/next month trailing days
 * - Today highlighting and accessibility features
 * - Touch-friendly interactions
 */

import React, { useMemo, useCallback, useState, useDeferredValue } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday as dateFnsIsToday,
  isValid,
  parseISO,
  isBefore,
  isAfter,
} from "date-fns";
import { enUS } from "date-fns/locale";
import { cn } from "@/lib/utils";

// Component prop types
export interface CalendarGridProps {
  year: number;
  month: number; // 0-based (January = 0)
  selectedDate?: Date;
  selectedRange?: { start: Date; end: Date };
  onDateClick?: (date: Date) => void;
  onDateHover?: (date: Date | null) => void;
  availabilityData?: Record<string, any>;
  disabledDates?: Date[];
  minDate?: Date;
  maxDate?: Date;
  showWeekNumbers?: boolean;
  highlightToday?: boolean;
  locale?: string;
  timezone?: string;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 1 = Monday, etc.
  renderDay?: (date: Date, info: any) => React.ReactNode;
}

const CalendarGridComponent: React.FC<CalendarGridProps> = ({
  year,
  month,
  selectedDate,
  selectedRange,
  onDateClick,
  onDateHover,
  availabilityData = {},
  disabledDates = [],
  minDate,
  maxDate,
  showWeekNumbers = false,
  highlightToday = true,
  locale = "en-PH",
  timezone = "Asia/Manila",
  weekStartsOn = 0,
  renderDay,
}) => {
  const [focusedDate, setFocusedDate] = useState<Date | null>(null);

  // Defer availability data updates to prevent blocking urgent UI updates
  const deferredAvailabilityData = useDeferredValue(availabilityData);

  // Locale configuration
  const dateLocale = useMemo(() => {
    switch (locale) {
      case "fil-PH":
        return fil;
      default:
        return enUS;
    }
  }, [locale]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    if (!isValid(new Date(year, month))) {
      return [];
    }

    const monthStart = startOfMonth(new Date(year, month));
    const monthEnd = endOfMonth(new Date(year, month));
    const calendarStart = startOfWeek(monthStart, { weekStartsOn });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [year, month, weekStartsOn]);

  // Week headers
  const weekHeaders = useMemo(() => {
    const headers = [];
    for (let i = 0; i < 7; i++) {
      const dayIndex = (weekStartsOn + i) % 7;
      const date = new Date(2024, 0, dayIndex); // Use a sample week
      const dayName = format(date, "EEE", { locale: dateLocale });
      headers.push(dayName);
    }
    return headers;
  }, [weekStartsOn, dateLocale]);

  // Check if date is disabled
  const isDateDisabled = useCallback(
    (date: Date) => {
      // Check explicit disabled dates
      if (disabledDates.some((disabledDate) => isSameDay(date, disabledDate))) {
        return true;
      }

      // Check min/max constraints
      if (minDate && isBefore(date, minDate)) {
        return true;
      }

      if (maxDate && isAfter(date, maxDate)) {
        return true;
      }

      return false;
    },
    [disabledDates, minDate, maxDate]
  );

  // Check if date is in selected range
  const isInRange = useCallback(
    (date: Date) => {
      if (!selectedRange?.start || !selectedRange?.end) return false;
      return date >= selectedRange.start && date <= selectedRange.end;
    },
    [selectedRange]
  );

  // Check if date is range start or end
  const isRangeStart = useCallback(
    (date: Date) => {
      return selectedRange?.start && isSameDay(date, selectedRange.start);
    },
    [selectedRange]
  );

  const isRangeEnd = useCallback(
    (date: Date) => {
      return selectedRange?.end && isSameDay(date, selectedRange.end);
    },
    [selectedRange]
  );

  // Handle date click
  const handleDateClick = useCallback(
    (date: Date) => {
      if (isDateDisabled(date)) return;
      onDateClick?.(date);
    },
    [isDateDisabled, onDateClick]
  );

  // Handle date hover
  const handleDateHover = useCallback(
    (date: Date) => {
      if (isDateDisabled(date)) return;
      onDateHover?.(date);
    },
    [isDateDisabled, onDateHover]
  );

  const handleDateLeave = useCallback(() => {
    onDateHover?.(null);
  }, [onDateHover]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, date: Date) => {
      if (isDateDisabled(date)) return;

      switch (event.key) {
        case "Enter":
        case " ":
          event.preventDefault();
          handleDateClick(date);
          break;
        case "ArrowRight":
          event.preventDefault();
          // Focus next day logic could be added here
          break;
        case "ArrowLeft":
          event.preventDefault();
          // Focus previous day logic could be added here
          break;
        case "ArrowDown":
          event.preventDefault();
          // Focus same day next week logic could be added here
          break;
        case "ArrowUp":
          event.preventDefault();
          // Focus same day previous week logic could be added here
          break;
      }
    },
    [isDateDisabled, handleDateClick]
  );

  // Get date information for styling with deferred availability data
  const getDateInfo = useCallback(
    (date: Date) => {
      const dateString = format(date, "yyyy-MM-dd");
      const availability = deferredAvailabilityData[dateString];
      const currentMonth = new Date(year, month);

      return {
        isCurrentMonth: isSameMonth(date, currentMonth),
        isToday: highlightToday && dateFnsIsToday(date),
        isSelected: selectedDate && isSameDay(date, selectedDate),
        isRangeStart: isRangeStart(date),
        isRangeEnd: isRangeEnd(date),
        isInRange: isInRange(date),
        isDisabled: isDateDisabled(date),
        availability,
        dateString,
      };
    },
    [
      year,
      month,
      highlightToday,
      selectedDate,
      isRangeStart,
      isRangeEnd,
      isInRange,
      isDateDisabled,
      deferredAvailabilityData,
    ]
  );

  // Render day cell with memoization-friendly approach
  const renderDayCell = useCallback(
    (date: Date) => {
      const info = getDateInfo(date);

      if (renderDay) {
        return renderDay(date, info);
      }

      const dayNumber = format(date, "d");
      const isOutsideMonth = !info.isCurrentMonth;

      return (
        <button
          type="button"
          className={cn(
            // Base styles
            "focus:ring-primary relative flex h-12 w-full items-center justify-center rounded-md text-sm font-medium transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none",
            // Touch-friendly sizing
            "min-h-[44px] min-w-[44px]",
            // Current month vs outside month
            isOutsideMonth ? "text-muted-foreground/50" : "text-foreground",
            // Today highlighting
            info.isToday && "bg-primary text-primary-foreground font-semibold",
            // Selected state
            info.isSelected && !info.isToday && "bg-accent text-accent-foreground",
            // Range states
            info.isRangeStart && "bg-primary text-primary-foreground rounded-r-none",
            info.isRangeEnd && "bg-primary text-primary-foreground rounded-l-none",
            info.isInRange &&
              !info.isRangeStart &&
              !info.isRangeEnd &&
              "bg-primary/20 text-primary-foreground rounded-none",
            // Disabled state
            info.isDisabled && "cursor-not-allowed opacity-50",
            // Hover state (only if not disabled)
            !info.isDisabled && "hover:bg-accent hover:text-accent-foreground"
          )}
          onClick={() => handleDateClick(date)}
          onMouseEnter={() => handleDateHover(date)}
          onMouseLeave={handleDateLeave}
          onKeyDown={(e) => handleKeyDown(e, date)}
          disabled={info.isDisabled}
          aria-label={format(date, "EEEE, MMMM d, yyyy", { locale: dateLocale })}
          aria-selected={info.isSelected}
          aria-current={info.isToday ? "date" : undefined}
          tabIndex={info.isCurrentMonth ? 0 : -1}
        >
          {dayNumber}

          {/* Availability indicator */}
          {info.availability && (
            <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 transform gap-0.5">
              {info.availability.availableRooms > 0 && (
                <div className="h-1.5 w-1.5 rounded-full bg-green-500"></div>
              )}
              {info.availability.availableRooms === 0 && (
                <div className="h-1.5 w-1.5 rounded-full bg-red-500"></div>
              )}
              {info.availability.maintenanceBlocks?.length > 0 && (
                <div className="h-1.5 w-1.5 rounded-full bg-purple-500"></div>
              )}
            </div>
          )}
        </button>
      );
    },
    [
      getDateInfo,
      renderDay,
      dateLocale,
      handleDateClick,
      handleDateHover,
      handleDateLeave,
      handleKeyDown,
    ]
  );

  // Generate week number if needed
  const getWeekNumber = useCallback(
    (date: Date) => {
      const week = format(date, "w", { locale: dateLocale });
      return `W${week}`;
    },
    [dateLocale]
  );

  // Split days into weeks
  const weeks = useMemo(() => {
    const weeksArray = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      weeksArray.push(calendarDays.slice(i, i + 7));
    }
    return weeksArray;
  }, [calendarDays]);

  if (calendarDays.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-destructive">Invalid date</p>
      </div>
    );
  }

  return (
    <div
      className="calendar-grid"
      role="grid"
      aria-label={`Calendar for ${format(new Date(year, month), "MMMM yyyy", { locale: dateLocale })}`}
      aria-rowcount={weeks.length + 1}
      aria-colcount={showWeekNumbers ? 8 : 7}
    >
      {/* Week headers */}
      <div
        className="mb-2 grid gap-1"
        style={{
          gridTemplateColumns: showWeekNumbers ? "40px repeat(7, 1fr)" : "repeat(7, 1fr)",
        }}
        role="row"
      >
        {showWeekNumbers && (
          <div className="text-muted-foreground flex h-10 items-center justify-center text-xs font-medium">
            #
          </div>
        )}
        {weekHeaders.map((header, index) => (
          <div
            key={index}
            className="text-muted-foreground flex h-10 items-center justify-center text-xs font-medium"
            role="columnheader"
            aria-label={header}
          >
            {header}
          </div>
        ))}
      </div>

      {/* Calendar weeks */}
      {weeks.map((week, weekIndex) => (
        <div
          key={weekIndex}
          className="mb-1 grid gap-1"
          style={{
            gridTemplateColumns: showWeekNumbers ? "40px repeat(7, 1fr)" : "repeat(7, 1fr)",
          }}
          role="row"
        >
          {showWeekNumbers && (
            <div className="text-muted-foreground flex h-12 items-center justify-center text-xs">
              {getWeekNumber(week[0])}
            </div>
          )}
          {week.map((date, dayIndex) => (
            <div key={dayIndex} role="gridcell">
              {renderDayCell(date)}
            </div>
          ))}
        </div>
      ))}

      {/* Screen reader announcements */}
      <div role="status" aria-live="polite" className="sr-only">
        {focusedDate && `Focused on ${format(focusedDate, "MMMM d, yyyy", { locale: dateLocale })}`}
      </div>
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const CalendarGrid = React.memo(CalendarGridComponent, (prevProps, nextProps) => {
  // Custom comparison function for optimization
  return (
    prevProps.year === nextProps.year &&
    prevProps.month === nextProps.month &&
    prevProps.selectedDate === nextProps.selectedDate &&
    prevProps.selectedRange === nextProps.selectedRange &&
    prevProps.availabilityData === nextProps.availabilityData &&
    prevProps.minDate === nextProps.minDate &&
    prevProps.maxDate === nextProps.maxDate &&
    prevProps.showWeekNumbers === nextProps.showWeekNumbers &&
    prevProps.highlightToday === nextProps.highlightToday
  );
});

CalendarGrid.displayName = "CalendarGrid";

export default CalendarGrid;
