/**
 * CalendarNavigation Component
 *
 * Navigation controls for the booking calendar including:
 * - Previous/Next month navigation
 * - Today button
 * - Month/Year dropdowns for quick navigation
 * - View mode toggles (month/week/day)
 * - Keyboard shortcuts support
 * - Mobile-friendly touch interactions
 */

import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  format,
  addMonths,
  subMonths,
  setMonth,
  setYear,
  isSameMonth,
  getMonth,
  getYear,
} from "date-fns";
import { enUS } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar, Clock, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Component prop types
export interface CalendarNavigationProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onViewChange?: (view: "month" | "week" | "day") => void;
  currentView?: "month" | "week" | "day";
  minDate?: Date;
  maxDate?: Date;
  locale?: string;
  timezone?: string;
  showViewToggle?: boolean;
  showTodayButton?: boolean;
  showQuickJump?: boolean;
  customActions?: React.ReactNode;
  disabled?: boolean;
}

export const CalendarNavigation: React.FC<CalendarNavigationProps> = ({
  currentDate,
  onDateChange,
  onViewChange,
  currentView = "month",
  minDate,
  maxDate,
  locale = "en-PH",
  timezone = "Asia/Manila",
  showViewToggle = true,
  showTodayButton = true,
  showQuickJump = true,
  customActions,
  disabled = false,
}) => {
  // Locale configuration
  const dateLocale = useMemo(() => {
    // Only enUS is available in date-fns, other locales fallback to default
    return enUS;
  }, [locale]);

  // Month/Year display
  const monthYearDisplay = useMemo(() => {
    return format(currentDate, "MMMM yyyy", { locale: dateLocale });
  }, [currentDate, dateLocale]);

  // Navigation constraints
  const canNavigatePrevious = useMemo(() => {
    if (!minDate) return true;
    const prevMonth = subMonths(currentDate, 1);
    return prevMonth >= minDate;
  }, [currentDate, minDate]);

  const canNavigateNext = useMemo(() => {
    if (!maxDate) return true;
    const nextMonth = addMonths(currentDate, 1);
    return nextMonth <= maxDate;
  }, [currentDate, maxDate]);

  // Today button visibility
  const canShowToday = useMemo(() => {
    const today = new Date();
    if (minDate && today < minDate) return false;
    if (maxDate && today > maxDate) return false;
    return !isSameMonth(today, currentDate);
  }, [currentDate, minDate, maxDate]);

  // Navigation handlers
  const handlePrevious = useCallback(async () => {
    if (disabled || !canNavigatePrevious) return;

    const prevMonth = subMonths(currentDate, 1);
    onDateChange(prevMonth);

    // Provide haptic feedback on mobile
    if ("vibrate" in navigator) {
      navigator.vibrate([10]);
    }
  }, [disabled, canNavigatePrevious, currentDate, onDateChange]);

  const handleNext = useCallback(async () => {
    if (disabled || !canNavigateNext) return;

    const nextMonth = addMonths(currentDate, 1);
    onDateChange(nextMonth);

    // Provide haptic feedback on mobile
    if ("vibrate" in navigator) {
      navigator.vibrate([10]);
    }
  }, [disabled, canNavigateNext, currentDate, onDateChange]);

  const handleToday = useCallback(() => {
    if (disabled) return;
    const today = new Date();
    onDateChange(today);

    // Provide haptic feedback on mobile
    if ("vibrate" in navigator) {
      navigator.vibrate([10]);
    }
  }, [disabled, onDateChange]);

  // Month/Year dropdown handlers
  const handleMonthChange = useCallback(
    (monthIndex: string) => {
      if (disabled) return;
      const newDate = setMonth(currentDate, parseInt(monthIndex));
      onDateChange(newDate);
    },
    [disabled, currentDate, onDateChange]
  );

  const handleYearChange = useCallback(
    (yearValue: string) => {
      if (disabled) return;
      const newDate = setYear(currentDate, parseInt(yearValue));
      onDateChange(newDate);
    },
    [disabled, currentDate, onDateChange]
  );

  // View change handler
  const handleViewChange = useCallback(
    (view: "month" | "week" | "day") => {
      if (disabled) return;
      onViewChange?.(view);
    },
    [disabled, onViewChange]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (disabled) return;

      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case "ArrowLeft":
            event.preventDefault();
            handlePrevious();
            break;
          case "ArrowRight":
            event.preventDefault();
            handleNext();
            break;
          case "t":
            event.preventDefault();
            handleToday();
            break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [disabled, handlePrevious, handleNext, handleToday]);

  // Generate month options for dropdown
  const monthOptions = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const date = new Date(currentDate.getFullYear(), i, 1);
      const monthName = format(date, "MMMM", { locale: dateLocale });
      return { value: i.toString(), label: monthName };
    });
  }, [currentDate, dateLocale]);

  // Generate year options for dropdown
  const yearOptions = useMemo(() => {
    const currentYear = getYear(currentDate);
    const startYear = minDate ? getYear(minDate) : currentYear - 5;
    const endYear = maxDate ? getYear(maxDate) : currentYear + 5;

    return Array.from({ length: endYear - startYear + 1 }, (_, i) => {
      const year = startYear + i;
      return { value: year.toString(), label: year.toString() };
    });
  }, [currentDate, minDate, maxDate]);

  return (
    <div
      className="bg-card flex items-center justify-between border-b p-4"
      role="navigation"
      aria-label="Calendar navigation"
    >
      {/* Left section - Navigation controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handlePrevious}
          disabled={disabled || !canNavigatePrevious}
          aria-label="Go to previous month"
          className="min-h-[44px] min-w-[44px]"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {showQuickJump ? (
          <div className="flex items-center gap-2">
            <Select
              value={getMonth(currentDate).toString()}
              onValueChange={handleMonthChange}
              disabled={disabled}
            >
              <SelectTrigger className="min-h-[44px] w-[120px]" aria-label="Select month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={getYear(currentDate).toString()}
              onValueChange={handleYearChange}
              disabled={disabled}
            >
              <SelectTrigger className="min-h-[44px] w-[90px]" aria-label="Select year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <h2 className="px-4 text-lg font-semibold">{monthYearDisplay}</h2>
        )}

        <Button
          variant="outline"
          size="icon"
          onClick={handleNext}
          disabled={disabled || !canNavigateNext}
          aria-label="Go to next month"
          className="min-h-[44px] min-w-[44px]"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Center section - Today button */}
      <div className="flex items-center gap-2">
        {showTodayButton && canShowToday && (
          <Button
            variant="outline"
            onClick={handleToday}
            disabled={disabled}
            aria-label="Go to today"
            className="min-h-[44px]"
          >
            <Calendar className="mr-2 h-4 w-4" />
            Today
          </Button>
        )}
        {customActions}
      </div>

      {/* Right section - View toggles */}
      {showViewToggle && (
        <div className="flex items-center gap-1 rounded-lg border p-1">
          <Button
            variant={currentView === "month" ? "default" : "ghost"}
            size="sm"
            onClick={() => handleViewChange("month")}
            disabled={disabled}
            aria-pressed={currentView === "month"}
            aria-label="Month view"
            className="min-h-[36px]"
          >
            <Calendar className="mr-1 h-4 w-4" />
            Month
          </Button>
          <Button
            variant={currentView === "week" ? "default" : "ghost"}
            size="sm"
            onClick={() => handleViewChange("week")}
            disabled={disabled}
            aria-pressed={currentView === "week"}
            aria-label="Week view"
            className="min-h-[36px]"
          >
            <Clock className="mr-1 h-4 w-4" />
            Week
          </Button>
          <Button
            variant={currentView === "day" ? "default" : "ghost"}
            size="sm"
            onClick={() => handleViewChange("day")}
            disabled={disabled}
            aria-pressed={currentView === "day"}
            aria-label="Day view"
            className="min-h-[36px]"
          >
            <Eye className="mr-1 h-4 w-4" />
            Day
          </Button>
        </div>
      )}

      {/* Screen reader announcements */}
      <div role="status" aria-live="polite" className="sr-only">
        {/* Navigation announcements handled by parent component */}
      </div>
    </div>
  );
};

CalendarNavigation.displayName = "CalendarNavigation";

export default CalendarNavigation;
