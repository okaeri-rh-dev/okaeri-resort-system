/**
 * Public Availability Calendar Component
 *
 * Main component for displaying real-time unit availability to guests.
 * Fetches aggregated availability data from public API endpoint with
 * 5-minute CDN caching.
 *
 * Features:
 * - Month navigation (previous, next, today)
 * - Color-coded availability grid
 * - Philippine Time (UTC+8) normalization
 * - Loading and error states
 * - Date validation (no past months, max 1 year ahead)
 * - TanStack Query with stale-while-revalidate
 * - Responsive mobile layout
 *
 * @component
 */

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  getMonthEnd,
  getMonthStart,
  getTodayPhilippineTime,
  toISODateString,
} from "@/lib/timezone";
import { validateMonth } from "@/lib/validation/calendar";
import { useQuery } from "@tanstack/react-query";
import { isAfter, max } from "date-fns";
import { ChevronLeft, ChevronRight, Info, Loader2 } from "lucide-react";
import { useState } from "react";
import { AvailabilityLegend } from "./AvailabilityLegend";
import type { AvailabilityDay } from "./CalendarGrid";
import { CalendarGrid } from "./CalendarGrid";
import { useSwipeGesture } from "./useSwipeGesture";

/**
 * API response structure from /api/public/v1/availability
 */
interface AvailabilityResponse {
  totalUnits: number;
  dateRange: {
    start: string;
    end: string;
  };
  availability: AvailabilityDay[];
  metadata: {
    generatedAt: string;
    cacheMaxAge: number;
    version: string;
  };
}

/**
 * Fetch availability data from public API endpoint
 * Fetches extended range to include adjacent month dates visible in calendar grid
 *
 * @param month - Date representing the month to fetch
 * @returns Promise resolving to availability response
 * @throws Error if API call fails
 */
async function fetchAvailability(month: Date): Promise<AvailabilityResponse> {
  // Get month boundaries in Philippine Time
  const firstDayOfMonth = getMonthStart(month);
  const lastDayOfMonth = getMonthEnd(month);

  // Calculate first day of calendar grid (may be in previous month)
  const startDayOfWeek = firstDayOfMonth.getDay();
  const calendarStart = new Date(firstDayOfMonth);
  calendarStart.setDate(calendarStart.getDate() - startDayOfWeek);

  // Calculate last day of calendar grid (may be in next month)
  // Grid always shows complete weeks (multiples of 7)
  const daysInMonthPlusPrefix = lastDayOfMonth.getDate() + startDayOfWeek;
  const totalWeeks = Math.ceil(daysInMonthPlusPrefix / 7);
  const totalDays = totalWeeks * 7;
  const calendarEnd = new Date(calendarStart);
  calendarEnd.setDate(calendarStart.getDate() + totalDays - 1);

  // Smart clamping: never fetch before today, but allow future overflow dates
  const today = getTodayPhilippineTime();

  // For future months, include overflow dates if they're >= today
  // For current/past months, start from today
  const apiStartDate = isAfter(firstDayOfMonth, today)
    ? max([calendarStart, today]) // Future month: include overflow >= today
    : today; // Current month: start from today

  const startISO = toISODateString(apiStartDate);
  const endISO = toISODateString(calendarEnd);

  // Call public API endpoint with full calendar grid range
  const response = await fetch(`/api/public/v1/availability?start=${startISO}&end=${endISO}`);

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorData.error || "Failed to fetch availability");
  }

  return response.json();
}

export function PublicAvailabilityCalendar() {
  // State: Current month being displayed (initialized to today in Philippine Time)
  const [currentMonth, setCurrentMonth] = useState(getTodayPhilippineTime());

  // Navigation: Go to previous month
  const goToPreviousMonth = () => {
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    const validation = validateMonth(newMonth);

    if (validation.valid) {
      setCurrentMonth(newMonth);
    } else {
      console.warn("Cannot navigate to past month:", validation.error);
    }
  };

  // Navigation: Go to next month
  const goToNextMonth = () => {
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    const validation = validateMonth(newMonth);

    if (validation.valid) {
      setCurrentMonth(newMonth);
    } else {
      console.warn("Cannot navigate more than 1 year ahead:", validation.error);
    }
  };

  // Enable swipe gestures for mobile navigation
  useSwipeGesture({
    onSwipeLeft: goToNextMonth,
    onSwipeRight: goToPreviousMonth,
  });

  // Fetch availability data with TanStack Query
  // Uses 5-minute stale time to match CDN cache duration
  const { data, isLoading, error, isFetching } = useQuery<AvailabilityResponse>({
    queryKey: ["publicAvailability", currentMonth.toISOString()],
    queryFn: () => fetchAvailability(currentMonth),
    staleTime: 5 * 60 * 1000, // 5 minutes (matches CDN cache)
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: true,
    refetchOnMount: false,
    retry: 2,
    // Only fetch if month is valid (not past, not > 1 year ahead)
    enabled: validateMonth(currentMonth).valid,
    // Keep previous data visible while fetching new month (prevents flicker)
    placeholderData: (previousData) => previousData,
  });

  // Navigation: Return to today's month
  const goToToday = () => {
    setCurrentMonth(getTodayPhilippineTime());
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-white rounded-lg shadow-lg p-8">
        <Loader2
          className="w-12 h-12 animate-spin text-blue-600 mb-4"
          role="progressbar"
          aria-label="Loading calendar"
        />
        <p className="text-gray-600">Loading availability calendar...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto">
        <Info className="h-4 w-4" />
        <AlertDescription>
          Failed to load availability data. Please try refreshing the page.
          {error instanceof Error && (
            <span className="block mt-2 text-sm opacity-75">Error: {error.message}</span>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return null;
  }

  // Format month name for display
  const monthName = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // Check if navigation buttons should be disabled based on validation
  const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
  const isPrevMonthValid = validateMonth(prevMonth).valid;

  const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
  const isNextMonthValid = validateMonth(nextMonth).valid;

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Calendar Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
        <div className="flex items-center justify-between mb-4">
          {/* Previous Month Button */}
          <Button
            onClick={goToPreviousMonth}
            disabled={!isPrevMonthValid}
            variant="ghost"
            size="sm"
            className="text-white hover:bg-blue-500/20 disabled:opacity-30"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>

          {/* Current Month Display */}
          <div className="text-center">
            <h3 className="text-2xl font-bold">{monthName}</h3>
            {isFetching && (
              <span className="text-sm text-blue-200 flex items-center justify-center gap-1 mt-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Updating...
              </span>
            )}
          </div>

          {/* Next Month Button */}
          <Button
            onClick={goToNextMonth}
            disabled={!isNextMonthValid}
            variant="ghost"
            size="sm"
            className="text-white hover:bg-blue-500/20 disabled:opacity-30"
            aria-label="Next month"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Today Button */}
        <Button
          onClick={goToToday}
          variant="secondary"
          size="sm"
          className="w-full bg-white/10 hover:bg-white/20 text-white border-0"
        >
          Today
        </Button>
      </div>

      {/* Legend */}
      <div className="px-6 pt-6">
        <AvailabilityLegend />
      </div>

      {/* Calendar Grid */}
      <div className="p-6">
        <CalendarGrid
          availability={data.availability}
          currentMonth={currentMonth}
          onDateClick={(date) => {
            // Navigate to the clicked date's month
            const clickedMonth = new Date(date.getFullYear(), date.getMonth(), 1);
            const validation = validateMonth(clickedMonth);
            if (validation.valid) {
              setCurrentMonth(clickedMonth);
            }
          }}
        />
      </div>

      {/* Last Updated Timestamp */}
      <div className="px-6 pb-4 text-center text-xs text-gray-500">
        Last updated:{" "}
        {new Date(data.metadata.generatedAt).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })}
      </div>
    </div>
  );
}
